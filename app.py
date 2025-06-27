import os
import json
import traceback
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify, send_from_directory, Response
from openai import OpenAI
from dotenv import load_dotenv
import threading

load_dotenv() # Load environment variables from .env file

# --- Configuration ---
# --- App Configuration ---
DAILY_LIMIT = int(os.environ.get("DAILY_LIMIT", 100))
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", 10))
CONTEXT_TURNS = int(os.environ.get("CONTEXT_TURNS", 3))
LOAD_SCORE_DATA = os.environ.get("LOAD_SCORE_DATA", "true").lower() == "true"

# --- File Paths ---
DATA_DIR = '_data'
SESSIONS_DIR = 'sessions'
SCORE_LINES_DIR = os.path.join(DATA_DIR, 'scorelines')
USAGE_FILE = os.path.join(DATA_DIR, 'usage.json')
USERS_FILE = os.path.join(DATA_DIR, 'users.json')

# --- In-memory State ---
usage_data = {}
rate_limit_data = {} # { "ip": {"timestamp": time, "count": n} }
valid_invitation_codes = []
app_lock = threading.Lock()


# --- Time & Date Helpers ---
def get_beijing_today_str():
    """Gets the current date string in Beijing Time (UTC+8)."""
    beijing_tz = timezone(timedelta(hours=8))
    return datetime.now(beijing_tz).strftime('%Y-%m-%d')

# --- Initialization Functions ---
def load_or_initialize_data():
    """Loads all necessary data from files into memory."""
    global usage_data, valid_invitation_codes
    with app_lock:
        # Load Usage Data
        today_str = get_beijing_today_str()
        try:
            if os.path.exists(USAGE_FILE):
                with open(USAGE_FILE, 'r') as f:
                    data = json.load(f)
                if today_str not in data:
                    usage_data = {today_str: 0}
                else:
                    usage_data = data
            else:
                usage_data = {today_str: 0}
                _write_usage_file()
        except (json.JSONDecodeError, FileNotFoundError):
            usage_data = {today_str: 0}
            _write_usage_file()
        print(f"Usage initialized for {today_str}: {usage_data.get(today_str, 0)} requests.")

        # Load Users/Invitation Codes
        try:
            if os.path.exists(USERS_FILE):
                with open(USERS_FILE, 'r') as f:
                    users = json.load(f)
                    valid_invitation_codes = users.get("valid_codes", [])
            else:
                # Create a default users file if it doesn't exist
                valid_invitation_codes = ["DEFAULT_CODE"]
                with open(USERS_FILE, 'w') as f:
                    json.dump({"valid_codes": valid_invitation_codes}, f, indent=2)
        except (json.JSONDecodeError, FileNotFoundError):
            valid_invitation_codes = []
        print(f"Loaded {len(valid_invitation_codes)} invitation codes.")

        # Create sessions directory if it doesn't exist
        os.makedirs(SESSIONS_DIR, exist_ok=True)
        os.makedirs(SCORE_LINES_DIR, exist_ok=True)

# --- Usage & Rate Limit Helpers ---
def get_current_usage():
    """Gets the current usage count for today."""
    today_str = get_beijing_today_str()
    if today_str not in usage_data:
        load_or_initialize_data()
    return usage_data.get(today_str, 0)

def increment_usage():
    """Increments usage count and writes to file."""
    global usage_data
    with app_lock:
        today_str = get_beijing_today_str()
        if today_str not in usage_data:
            usage_data = {today_str: 1}
        else:
            usage_data[today_str] = usage_data.get(today_str, 0) + 1
        _write_usage_file()
        return usage_data[today_str]

def _write_usage_file():
    """Writes the current usage_data to the file (internal, needs lock)."""
    os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)
    with open(USAGE_FILE, 'w') as f:
        json.dump(usage_data, f, indent=2)

def check_rate_limit(ip):
    """Checks if an IP has exceeded the rate limit. Returns True if limited."""
    global rate_limit_data
    with app_lock:
        current_time = datetime.now().timestamp()
        
        # Clean up old entries
        for old_ip in list(rate_limit_data.keys()):
            if current_time - rate_limit_data[old_ip]['timestamp'] > 60:
                del rate_limit_data[old_ip]

        if ip not in rate_limit_data:
            rate_limit_data[ip] = {"timestamp": current_time, "count": 1}
            return False
        
        if current_time - rate_limit_data[ip]['timestamp'] > 60:
            rate_limit_data[ip] = {"timestamp": current_time, "count": 1}
            return False
        
        rate_limit_data[ip]['count'] += 1
        return rate_limit_data[ip]['count'] > RATE_LIMIT_PER_MINUTE

# --- Session History Helpers ---
def load_session_history(session_id):
    """Loads chat history for a given session ID."""
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    if os.path.exists(session_file):
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    return []

def save_session_history(session_id, history):
    """Saves chat history for a given session ID."""
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
    with open(session_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def load_score_data(province, stream):
    """
    Loads score line data for a given province and stream from a single file
    named after the province, e.g., '江苏.json'.
    """
    if not LOAD_SCORE_DATA or not province:
        return None

    # For new gaokao, map to traditional streams
    if "物理" in stream:
        stream_key = "理科"
    elif "历史" in stream:
        stream_key = "文科"
    else: # For provinces that don't distinguish
        stream_key = stream

    score_data = {}
    filepath = os.path.join(SCORE_LINES_DIR, f"{province}.json")

    if not os.path.exists(filepath):
        print(f"Score data file not found for province: {province}")
        return None

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if data.get('province') == province:
                for yearly_entry in data.get('yearly_data', []):
                    year = yearly_entry.get('year', '未知年份')
                    if stream_key in yearly_entry.get('batches', {}):
                        score_data[year] = yearly_entry['batches'][stream_key]
    except (json.JSONDecodeError, Exception) as e:
        print(f"Error loading or parsing score data for {province}: {e}")
    
    return score_data if score_data else None


app = Flask(__name__, static_url_path='', static_folder='.')

def get_system_prompt():
    """Generates the static system prompt for the AI."""
    return "\n\n".join([
        "你是一位顶级的、资深的、充满智慧的高考志愿填报专家。你的任务是为一位正在纠结中的高三学生或家长，提供一份专业、客观、有深度、有温度的志愿对比分析报告。",
        "**重要指令**: 在你输出最终的分析报告之前，请务必先进行一步深度思考。将你的思考过程、分析逻辑、以及数据检索的步骤，完整地包含在 `<think>` 和 `</think>` 标签之间。这部分内容是给专业用户看的，可以帮助他们理解你的决策过程。思考结束后，再输出面向用户的、完整的Markdown格式报告。",
        "**你的任务和要求:**",
        "1.  **深度思考**:",
        "    *   第一步: 识别用户的核心问题和纠结的点。",
        "    *   第二步: 基于你掌握的知识，并结合用户提供的结构化参考数据（如招生计划、分数线等）进行分析。",
        "    *   第三步: 设定评估维度，并简述每个维度的评估逻辑。",
        "2.  **正式报告**:",
        "    *   **创建方案PK记分卡:** 这是报告的核心！请创建一个Markdown表格，从以下维度对核心方案进行对比打分（满分5星，用 ★★★☆☆ 表示）：录取概率、学校实力/声誉、专业前景/钱景、城市发展/生活品质、个人兴趣/困惑匹配度。",
        "    *   **详细文字解读:** 针对记分卡中的每一项，展开详细的、有理有据的文字分析。",
        "    *   **“对话式”分析与建议:** 模拟与学生面对面对话的口吻，设身处地地理解他的困惑。",
        "    *   **最终结论总结:** 给出一个清晰的、总结性的结论。",
        "**输出格式要求:**",
        "- **必须**先输出`<think>`标签包裹的思考内容，然后再输出正式报告。",
        "- **绝对禁止**在正式报告中重复或提及任何`<think>`标签内的思考过程。正式报告必须是直接面向最终用户的、干净的、独立的分析内容。",
        "- 正式报告**必须**是完整的Markdown格式。",
        "- 正式报告**必须**包含“方案PK记- 记分卡”表格。",
        "- **格式示例**: `<think>这是我的思考过程...</think># 高考志愿对比分析报告\n## 方案PK记分卡\n| 评估维度 | ...`"
    ])

def prepare_user_prompt(user_data, score_data=None):
    """Prepares the user's input part of the prompt."""
    user_info = user_data.get('rawText', '')
    province = user_data.get('province', '未知')
    rank = user_data.get('rank', '未知')

    prompt_parts = [
        "**学生背景:**",
        f"- 省份: {province}",
        f"- 分数/位次: {rank}",
        "- 他本次的原始笔记和困惑如下:",
        "---",
        user_info,
        "---"
    ]
    
    if score_data:
        score_info = json.dumps(score_data, ensure_ascii=False, indent=2)
        prompt_parts.extend([
            "**参考数据 (历年分数线):**",
            "---",
            score_info,
            "---"
        ])

    return "\n\n".join(prompt_parts)

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

# --- API Routes ---
@app.route('/api/usage', methods=['GET'])
def get_usage():
    try:
        current_usage = get_current_usage()
        return jsonify({"used": current_usage, "limit": DAILY_LIMIT})
    except Exception as e:
        return jsonify({"used": "N/A", "limit": "N/A", "error": str(e)}), 500

@app.route('/api/verify_code', methods=['POST'])
def verify_code():
    body = request.get_json(silent=True)
    if not body or 'invitationCode' not in body:
        return jsonify({"success": False, "error": "无效的请求格式。"}), 400
    
    invitation_code = body.get('invitationCode')
    if invitation_code in valid_invitation_codes:
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "无效的邀请码。"}), 403

@app.route('/api/handler', methods=['POST'])
def handler():
    # --- Security & Rate Limiting ---
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "无效的请求格式。"}), 400

    # 1. Invitation Code Check
    invitation_code = body.get('invitationCode')
    if not invitation_code or invitation_code not in valid_invitation_codes:
        return jsonify({"error": "无效的邀请码。"}), 403

    # 2. IP-based Rate Limiting
    client_ip = request.remote_addr
    if check_rate_limit(client_ip):
        return jsonify({"error": "您的请求过于频繁，请稍后再试。"}), 429

    # 3. Daily Usage Limit
    try:
        current_usage = get_current_usage()
        if current_usage >= DAILY_LIMIT:
            error_msg = {"error": f"非常抱歉，今日的免费体验名额（{DAILY_LIMIT}次）已被抢完！请您明日再来。"}
            return jsonify({**error_msg, "usage": {"used": current_usage, "limit": DAILY_LIMIT}}), 429
    except Exception as e:
        print(f"Error during usage check: {e}")
        pass # Allow to proceed if usage check fails, but log it.

    # --- Main Logic ---
    try:
        if 'userInput' not in body:
            return jsonify({"error": "请求格式错误或缺少'userInput'字段。"}), 400
        
        user_data = body.get('userInput', {})
        session_id = body.get('sessionId')
        is_follow_up = user_data.get('isFollowUp', False)
        
        # Load history if session_id is provided
        history = []
        if session_id:
            history = load_session_history(session_id)

        # If it's a follow-up, the prompt is just the raw text.
        # Otherwise, prepare the full prompt with context.
        if is_follow_up:
            user_prompt = user_data.get('rawText', '')
        else:
            # Load score data only for initial requests
            score_data = load_score_data(user_data.get('province'), user_data.get('stream'))
            user_prompt = prepare_user_prompt(user_data, score_data)

    except FileNotFoundError:
        return jsonify({"error": "服务器内部错误：关键数据文件丢失。"}), 500
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"UNHANDLED EXCEPTION IN HANDLER: {error_trace}")
        return jsonify({"error": f"服务器在准备请求时发生错误: {e}"}), 500

    def stream_response(p):
        try:
            # --- Update usage and prepare for streaming ---
            new_usage = increment_usage()
            yield f"event: usage\ndata: {json.dumps({'used': new_usage, 'limit': DAILY_LIMIT})}\n\n"

            # --- Prepare messages for OpenAI API, including history ---
            system_prompt = get_system_prompt()
            messages_for_api = [{"role": "system", "content": system_prompt}]
            messages_for_api.extend(history[-CONTEXT_TURNS*2:])
            messages_for_api.append({"role": "user", "content": user_prompt})

            # --- Stream response from OpenAI ---
            api_key = os.environ.get("OPENAI_API_KEY")
            base_url = os.environ.get("OPENAI_API_BASE")
            if not api_key or not base_url:
                error_message = {'error': '服务器环境变量 OPENAI_API_KEY 或 OPENAI_API_BASE 未配置。'}
                yield f"event: error\ndata: {json.dumps(error_message, ensure_ascii=False)}\n\n"
                return
            
            client = OpenAI(api_key=api_key, base_url=base_url)
            model_name = os.environ.get("OPENAI_MODEL_NAME", "gemini-2.5-flash")
            
            stream = client.chat.completions.create(
                messages=messages_for_api,
                model=model_name,
                stream=True
            )

            # --- Handle streaming and save history ---
            assistant_response_full = ""
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    assistant_response_full += content
                    yield f"event: message\ndata: {json.dumps(content)}\n\n"
            
            if session_id:
                # Strip the <think> block before saving to history
                assistant_response_clean = assistant_response_full
                think_start = assistant_response_full.find('<think>')
                think_end = assistant_response_full.find('</think>')
                if think_start != -1 and think_end != -1:
                    assistant_response_clean = assistant_response_full[think_end + len('</think>'):].strip()

                new_history = history + [
                    {"role": "user", "content": user_data.get('rawText', '')},
                    {"role": "assistant", "content": assistant_response_clean}
                ]
                save_session_history(session_id, new_history)

            yield f"event: end\ndata: End of stream\n\n"

        except Exception as e:
            error_trace = traceback.format_exc()
            print(f"UNHANDLED EXCEPTION IN STREAM: {error_trace}")
            error_message = { "error": f"服务器在与AI通信时发生错误: {e}", "traceback": error_trace }
            yield f"event: error\ndata: {json.dumps(error_message, ensure_ascii=False)}\n\n"

    return Response(stream_response(user_prompt), mimetype='text/event-stream')

if __name__ == "__main__":
    load_or_initialize_data()
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)