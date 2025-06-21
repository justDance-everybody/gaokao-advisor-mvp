import os
import json
import traceback
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
import redis

# --- Configuration ---
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", 100))
KV_KEY = 'daily_requests_count'

# --- Redis Connection ---
kv = None
try:
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
    kv = redis.from_url(redis_url, decode_responses=True)
    kv.ping()
    print("Successfully connected to Redis.")
except redis.exceptions.ConnectionError as e:
    print(f"--- REDIS CONNECTION FAILED: {e} ---")
    # Set kv to None to indicate failure, will be handled gracefully.

app = Flask(__name__, static_url_path='', static_folder='.')

def prepare_prompt(user_data, enrollment_data):
    user_info = user_data.get('rawText', '')
    province = user_data.get('province', '未知')
    rank = user_data.get('rank', '未知')
    enrollment_info = json.dumps(enrollment_data.get('data', {}), ensure_ascii=False, indent=2)
    prompt = f"""
    你是一位顶级的、资深的、充满智慧的高考志愿填报专家。你的任务是为一位正在纠结中的高三学生或家长，提供一份专业、客观、有深度、有温度的志愿对比分析报告。

    **重要指令**: 在你输出最终的分析报告之前，请务必先进行一步深度思考。将你的思考过程、分析逻辑、以及数据检索的步骤，完整地包含在 `<think>` 和 `</think>` 标签之间。这部分内容是给专业用户看的，可以帮助他们理解你的决策过程。思考结束后，再输出面向用户的、完整的Markdown格式报告。

    **学生背景:**
    - 省份: {province}
    - 分数/位次: {rank}
    - 他的原始笔记和困惑如下:
    ---
    {user_info}
    ---

    **参考数据 (2025年最新招生计划变动，你需要结合这份数据进行分析):**
    ---
    {enrollment_info}
    ---

    **你的任务和要求:**

    1.  **深度思考(在`<think>`标签内)**:
        *   第一步: 识别用户的核心问题和纠结的点。
        *   第二步: 检索并列出与用户方案相关的招生计划变动数据。
        *   第三步: 设定评估维度，并简述每个维度的评估逻辑。
    2.  **正式报告(在`<think>`标签外)**:
        *   **创建方案PK记分卡:** 这是报告的核心！请创建一个Markdown表格，从以下维度对核心方案进行对比打分（满分5星，用 ★★★☆☆ 表示）：录取概率、学校实力/声誉、专业前景/钱景、城市发展/生活品质、个人兴趣/困惑匹配度。
        *   **详细文字解读:** 针对记分卡中的每一项，展开详细的、有理有据的文字分析。
        *   **“对话式”分析与建议:** 模拟与学生面对面对话的口吻，设身处地地理解他的困惑。
        *   **最终结论总结:** 给出一个清晰的、总结性的结论。

    **输出格式要求:**
    - **必须**先输出`<think>`标签包裹的思考内容，然后再输出正式报告。
    - 正式报告**必须**是完整的Markdown格式。
    - 正式报告**必须**包含“方案PK记分卡”表格。
    """
    return prompt

# --- Static File Routes ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/_data/<path:path>')
def serve_data_files(path):
    return send_from_directory('_data', path)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# --- API Route ---
@app.route('/api/handler', methods=['POST'])
def handler():
    try:
        # --- Cost Control & Safety Check ---
        current_usage = 0
        if kv:
            try:
                current_usage = int(kv.get(KV_KEY) or 0)
                if current_usage >= DAILY_LIMIT:
                    error_msg = {"error": f"非常抱歉，今日的免费体验名额（{DAILY_LIMIT}次）已被抢完！请您明日再来。"}
                    return jsonify({**error_msg, "usage": {"used": current_usage, "limit": DAILY_LIMIT}}), 429
            except redis.exceptions.ConnectionError:
                return jsonify({"error": "数据库连接丢失，请联系管理员。"}), 500
        
        # --- Main Logic ---
        body = request.get_json(silent=True)
        if not body or 'userInput' not in body:
            return jsonify({"error": "请求格式错误或缺少'userInput'字段。"}), 400
        user_data = body.get('userInput', {})

        enrollment_data_path = os.path.join('_data', 'enrollment_data_2025.json')
        with open(enrollment_data_path, 'r', encoding='utf-8') as f:
            enrollment_data = json.load(f)
        
        prompt = prepare_prompt(user_data, enrollment_data)
        
        api_key = os.environ.get("OPENAI_API_KEY")
        base_url = os.environ.get("OPENAI_API_BASE")
        if not api_key or not base_url:
            raise ValueError("服务器环境变量 OPENAI_API_KEY 或 OPENAI_API_BASE 未配置。")
        
        client = OpenAI(api_key=api_key, base_url=base_url)
        model_name = os.environ.get("OPENAI_MODEL_NAME", "qwen3-30b-a3b")
        
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=model_name,
        )

        if kv:
            new_usage = kv.incr(KV_KEY)
        else:
            new_usage = current_usage + 1 # Simulate increment if redis is down

        if not chat_completion or not chat_completion.choices:
            error_message = "AI服务返回了意外的响应，没有有效的生成内容。"
            raw_response = str(chat_completion)
            print(f"AI service returned an invalid response: {raw_response}")
            error_message += f"\n\n--- LLM原始响应 ---\n{raw_response}"
            return jsonify({"error": error_message, "usage": {"used": new_usage, "limit": DAILY_LIMIT}}), 502

        report_markdown = chat_completion.choices[0].message.content
        if not report_markdown:
            error_message = "AI服务成功调用，但返回了空内容。"
            raw_response = str(chat_completion)
            print(f"AI service returned an empty message content: {raw_response}")
            error_message += f"\n\n--- LLM原始响应 ---\n{raw_response}"
            return jsonify({"error": error_message, "usage": {"used": new_usage, "limit": DAILY_LIMIT}}), 500

        return jsonify({"report": report_markdown, "usage": {"used": new_usage, "limit": DAILY_LIMIT}}), 200

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"UNHANDLED EXCEPTION: {error_trace}")
        return jsonify({
            "error": f"服务器发生未知致命错误: {e}",
            "traceback": error_trace
        }), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)