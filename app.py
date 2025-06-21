import os
import json
import traceback
from flask import Flask, request, jsonify, send_from_directory, Response
from openai import OpenAI

# Create a Flask app instance that serves static files from the root
app = Flask(__name__, static_url_path='', static_folder='.')

def prepare_prompt(user_data, enrollment_data):
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

    1.  **解析与总结:** 首先，仔细阅读学生的原始笔记，解析并清晰地总结出他正在纠纠的几个核心方案（例如：方案A vs 方案B）。
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
    def stream():
        try:
            # 1. Parse User Data
            body = request.get_json(silent=True)
            if not body or 'userInput' not in body:
                yield f"data: **错误**: 请求格式错误或缺少'userInput'字段。\n\n"
                return
            user_data = body.get('userInput', {})

            # 2. Prepare Prompt
            try:
                enrollment_data_path = os.path.join('_data', 'enrollment_data_2025.json')
                with open(enrollment_data_path, 'r', encoding='utf-8') as f:
                    enrollment_data = json.load(f)
                prompt = prepare_prompt(user_data, enrollment_data)
            except FileNotFoundError:
                yield f"data: **错误**: 服务器内部错误：关键数据文件丢失。\n\n"
                return
            
            # 3. Call AI API with streaming enabled
            api_key = os.environ.get("OPENAI_API_KEY")
            base_url = os.environ.get("OPENAI_API_BASE")
            if not api_key or not base_url:
                yield f"data: **错误**: 服务器环境变量 OPENAI_API_KEY 或 OPENAI_API_BASE 未配置。\n\n"
                return
            
            client = OpenAI(api_key=api_key, base_url=base_url)
            model_name = os.environ.get("OPENAI_MODEL_NAME", "qwen3-30b-a3b")
            
            stream_response = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model_name,
                stream=True
            )

            for chunk in stream_response:
                content = chunk.choices[0].delta.content
                if content:
                    # SSE format: data: <content>\n\n
                    yield f"data: {json.dumps(content)}\n\n"

        except Exception as e:
            error_trace = traceback.format_exc()
            print(f"UNHANDLED EXCEPTION: {error_trace}")
            error_message = f"**服务器发生未知致命错误**: {e}\n\n```\n{error_trace}\n```"
            yield f"data: {json.dumps(error_message)}\n\n"

    return Response(stream(), mimetype='text/event-stream')

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)