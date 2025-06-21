import os
import json
from flask import Flask, request, jsonify
from vercel_kv import KV

# The KV client automatically reads the required credentials
# from environment variables.
kv = KV()
from openai import OpenAI

# --- Configuration ---
DAILY_LIMIT = 1000
KV_KEY = 'daily_requests_count'

# Create a Flask app instance
app = Flask(__name__)

def prepare_prompt(user_data, enrollment_data):
    # This is the core of the AI's instruction.
    # It needs to be carefully crafted to get the desired output.
    
    user_info = user_data.get('rawText', '')
    province = user_data.get('province', '未知')
    rank = user_data.get('rank', '未知')
    enrollment_info = json.dumps(enrollment_data.get('data', {}), ensure_ascii=False, indent=2)


    prompt = f"""
    你是一位顶级的、资深的、充满智慧的高考志愿填报专家。你的任务是为一位正在纠结中的高三学生或家长，提供一份专业、客观、有深度、有温度的志愿对比分析报告。

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

    1.  **解析与总结:** 首先，仔细阅读学生的原始笔记，解析并清晰地总结出他正在纠结的几个核心方案（例如：方案A vs 方案B）。
    2.  **创建方案PK记分卡:** 这是报告的核心！请创建一个Markdown表格，从以下维度对核心方案进行对比打分（满分5星，用 ★★★☆☆ 表示）：
        *   **录取概率:** 结合学生位次和常规认知，分析哪个方案更稳妥。
        *   **学校实力/声誉:** 综合学校的排名、口碑、学科评估等。
        *   **专业前景/钱景:** 分析相关专业的就业市场、薪资水平和未来发展。
        *   **城市发展/生活品质:** 评估学校所在城市的机遇、生活成本、便利性等。
        *   **个人兴趣/困惑匹配度:** 分析哪个方案更能解决学生的个人困扰。
    3.  **详细文字解读:** 针对记分卡中的每一项，展开详细的、有理有据的文字分析。为什么这么打分？你的判断依据是什么？
    4.  **“对话式”分析与建议:** 模拟与学生面对面对话的口吻，设身处地地理解他的困惑（例如“名校光环”和“热门专业”的纠结），给出有温度、有智慧的建议，帮助他理清思路，而不是替他做决定。
    5.  **最终结论总结:** 在报告的最后，给出一个清晰的、总结性的结论，点明每个方案的核心优势和潜在风险，并鼓励学生结合自身情况，做出最适合自己的选择。

    **输出格式要求:**
    - **必须**是完整的Markdown格式。
    - **必须**包含“方案PK记分卡”表格。
    - 结构清晰，逻辑严谨，语言专业且易于理解。
    """
    return prompt

# Vercel will automatically route requests to this app object.
# We define a single route to handle the POST requests.
@app.route('/api/handler', methods=['POST'])
def handler():
    # 1. Parse User Data FIRST
    try:
        body = request.get_json(silent=True)
        if not body or 'userInput' not in body:
            return jsonify({"error": "请求格式错误或缺少'userInput'字段。"}), 400
        user_data = body.get('userInput', {})
    except Exception as e:
        print(f"Data Parse Error: {e}")
        return jsonify({"error": "解析用户数据时出错。"}), 500

    # 2. Cost Control & Safety Check
    try:
        count = kv.get(KV_KEY) or 0
        if count >= DAILY_LIMIT:
            return jsonify({"error": "非常抱歉，今日的免费体验名额已被抢完！请您明日再来。"}), 429
    except Exception as e:
        print(f"KV Error: {e}")
        return jsonify({"error": "服务暂时不可用，无法连接到数据库。"}), 500

    # 3. Prepare Prompt
    try:
        enrollment_data_path = os.path.join(os.path.dirname(__file__), '_data', 'enrollment_data_2025.json')
        with open(enrollment_data_path, 'r', encoding='utf-8') as f:
            enrollment_data = json.load(f)
        
        prompt = prepare_prompt(user_data, enrollment_data)

    except Exception as e:
        print(f"Prompt Prep Error: {e}")
        return jsonify({"error": "准备分析数据时出错。"}), 500

    # 4. Call AI API
    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        base_url = os.environ.get("OPENAI_API_BASE")

        if not api_key or not base_url:
            raise ValueError("OPENAI_API_KEY or OPENAI_API_BASE not found in environment variables.")

        client = OpenAI(api_key=api_key, base_url=base_url)
        model_name = os.environ.get("OPENAI_MODEL_NAME", "qwen3-30b-a3b")

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=model_name,
        )
        report_markdown = chat_completion.choices[0].message.content

    except Exception as e:
        print(f"AI API Error: {e}")
        return jsonify({"error": "AI服务暂时无法响应，请稍后重试。"}), 503

    # 5. Update Counter & Return Result
    try:
        # Use atomic increment for safety and correctness
        kv.incr(KV_KEY)
    except Exception as e:
        # If increment fails, it's not critical enough to fail the whole request.
        # Log it for monitoring.
        print(f"KV increment failed: {e}")

    return jsonify({"report": report_markdown}), 200

@app.route('/api/cron/reset', methods=['GET'])
def reset_counter():
    """
    A dedicated endpoint for a Vercel Cron Job to call daily.
    Resets the daily request counter to 0.
    """
    try:
        kv.set(KV_KEY, 0)
        return jsonify({"message": "Counter reset successfully."}), 200
    except Exception as e:
        print(f"Cron job failed to reset counter: {e}")
        return jsonify({"error": "Failed to reset counter."}), 500


# This check allows running the app locally for development
if __name__ == "__main__":
    app.run(debug=True)