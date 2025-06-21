import os
import json
import traceback
from flask import Flask, request, jsonify
from vercel_kv import KV
from openai import OpenAI

# --- Configuration ---
DAILY_LIMIT = 1000
KV_KEY = 'daily_requests_count'

# Create a Flask app instance
app = Flask(__name__)

def prepare_prompt(user_data, enrollment_data):
    # ... (omitted for brevity, no changes here)
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

@app.route('/api/handler', methods=['POST'])
def handler():
    # Ultimate error catching block to ensure we always get a detailed error
    try:
        # Handle Vercel Cron Job execution
        if 'X-Vercel-Cron-Secret' in request.headers:
            secret = request.headers.get('X-Vercel-Cron-Secret')
            if secret == os.environ.get('CRON_SECRET'):
                try:
                    kv = KV()
                    kv.set(KV_KEY, 0)
                    print("Cron job: Daily counter reset successfully.")
                    return jsonify({"status": "OK", "message": "Counter reset."}), 200
                except Exception as e:
                    print(f"Cron job failed: {e}")
                    return jsonify({"status": "Error", "message": "Cron job failed."}), 500
            else:
                return jsonify({"status": "Error", "message": "Unauthorized cron job."}), 401

        # 1. Parse User Data FIRST
        try:
            body = request.get_json(silent=True)
            if not body or 'userInput' not in body:
                return jsonify({"error": "请求格式错误或缺少'userInput'字段。"}), 400
            user_data = body.get('userInput', {})
        except Exception as e:
            print(f"Data Parse Error: {e}")
            return jsonify({"error": f"解析用户数据时出错: {e}"}), 500

        # 2. Cost Control & Safety Check
        try:
            kv = KV()
            count = kv.get(KV_KEY) or 0
            if count >= DAILY_LIMIT:
                return jsonify({"error": "非常抱歉，今日的免费体验名额已被抢完！请您明日再来。"}), 429
        except Exception as e:
            print(f"KV Error: {e}")
            # Be more specific if it's a connection issue
            return jsonify({"error": f"数据库连接失败，请检查Vercel KV环境变量配置。错误: {e}"}), 500

        # 3. Prepare Prompt
        try:
            enrollment_data_path = os.path.join(os.path.dirname(__file__), '_data', 'enrollment_data_2025.json')
            with open(enrollment_data_path, 'r', encoding='utf-8') as f:
                enrollment_data = json.load(f)
            prompt = prepare_prompt(user_data, enrollment_data)
        except FileNotFoundError:
            print("FATAL: enrollment_data_2025.json not found. This is a deployment issue.")
            return jsonify({"error": "服务器内部错误：关键数据文件丢失。请检查vercel.json中的includeFiles配置。"}), 500
        except Exception as e:
            print(f"Prompt Prep Error: {e}")
            return jsonify({"error": f"准备分析数据时出错: {e}"}), 500

        # 4. Call AI API
        try:
            api_key = os.environ.get("OPENAI_API_KEY")
            base_url = os.environ.get("OPENAI_API_BASE")
            if not api_key or not base_url:
                raise ValueError("OPENAI_API_KEY or OPENAI_API_BASE not found in environment variables.")
            client = OpenAI(api_key=api_key, base_url=base_url)
            model_name = os.environ.get("OPENAI_MODEL_NAME", "qwen3-30b-a3b")
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model_name,
            )
            report_markdown = chat_completion.choices[0].message.content
        except Exception as e:
            print(f"AI API Error: {e}")
            return jsonify({"error": f"AI服务调用失败: {e}"}), 503

        # 5. Update Counter & Return Result
        try:
            kv = KV()
            kv.incr(KV_KEY)
        except Exception as e:
            print(f"KV increment failed: {e}")

        return jsonify({"report": report_markdown}), 200

    except Exception as e:
        # This is the final catch-all. It will catch any unexpected error.
        error_trace = traceback.format_exc()
        print(f"UNHANDLED EXCEPTION: {error_trace}")
        return jsonify({
            "error": "服务器发生未知致命错误。",
            "traceback": error_trace
        }), 500

if __name__ == "__main__":
    app.run(debug=True)