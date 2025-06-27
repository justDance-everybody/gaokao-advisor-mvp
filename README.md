# 高考志愿AI决策顾问 V1.1 🚀

本项目是一个H5单页应用，旨在为面临高考志愿填报最后抉择的考生及家长，提供一份由AI驱动的、结合了历年分数线的深度分析报告。

V1.1版本在原基础上，新增了**邀请码认证**、**多轮对话**、**动态数据加载**、**IP速率限制**等核心功能，并优化了部署方式，使其能够**完全在GitHub Actions的免费环境中运行**，实现了状态的持久化。同时仍然支持Docker部署。


![PC端演示](images/pc_2.png)
![移动端演示](images/mobile.jpg)
![测试覆盖率](images/pytest.png)

## ✨ V1.1 功能特性

- **智能分析报告**: 
  - **个性化输入**: 用户可以输入省份、科类、分数/位次，以及最纠结的几个志愿方案和主要困惑。
  - **数据驱动**: 可选加载本地的历年分数线 (`_data/scorelines/`) 数据，为AI提供更精准的决策依据。
  - **深度思考过程**: 在生成报告前，AI会先输出一段被折叠的“思考过程”，展示其分析逻辑。
  - **多维度PK记分卡**: 报告的核心是一个Markdown表格，从录取概率、学校实力、专业前景等多个维度对用户的方案进行打分和对比。
  - **对话式解读**: 报告采用亲切的对话式口吻，对记分卡的每一项进行详细解读。

- **流畅的用户体验**:
  - **流式响应 (SSE)**: 通过流式响应，将AI生成的内容以“打字机”效果逐字显示在前端。
  - **加载动画**: 在AI思考期间，“生成报告”按钮会呈现动态的彩色渐变加载动画。
  - **不对称对话气泡**: 用户的输入会以带动画的气泡形式从右侧滑入，而AI的回复则保持通栏显示，界面清晰、生动。
  - **保存为PDF**: 用户可以将生成的完整分析报告一键保存为PDF文件。

- **安全与控制**:
  - **邀请码认证**: 用户访问时，会弹出模态窗口要求输入邀请码。邀请码列表在 `_data/users.json` 中配置。
  - **IP速率限制**: 对每个IP地址进行访问频率限制（默认为10次/分钟）。
  - **每日用量限制**: 通过 `_data/usage.json` 文件进行持久化计数，会在北京时间零点自动清零。

```
备注：当前预制的邀请码有：
    GAOKAO_2025_VIP
    TEST_CODE_123
    ok
```

![邀请码](images/key.png)
![频率过高](images/limit.png)


- **多轮对话**:
  - **会话保持**: 用户在同一次会话中的多次提问会被记录和关联。
  - **上下文理解**: AI在回答新的问题时，会自动参考最近几轮的对话历史（默认为3轮）。
  - **状态持久化**: 每个会话的历史记录都会被保存在 `sessions/` 目录下，并通过GitHub Actions自动提交回仓库。

![对话](images/conversation.png)

---

## 🛠️ 技术栈

- **后端 (Backend)**: Flask, Gunicorn, OpenAI SDK
- **前端 (Frontend)**: 原生 JavaScript (ES6+), HTML5, CSS3, Marked.js, jsPDF, html2canvas
- **状态存储**: 本地JSON文件 (`_data/`, `sessions/`)
- **开发与部署 (DevOps)**: Docker, Docker Compose, GitHub Actions, ngrok, Pytest 

---

## 📂 项目结构

```
.
├── .github/workflows/
│   └── run-app-on-actions.yml  # GitHub Actions工作流文件
├── _data/
│   ├── scorelines/                # 历年分数线数据 (按省份年份存放)
│   │   └── 江苏.json      # (示例文件)
│   ├── usage.json                 # 每日用量计数器 (自动生成/更新)
│   └── users.json                 # 有效邀请码列表
├── sessions/                        # 对话历史记录 (自动生成/更新)
├── .env.example                   # 环境变量配置模板
├── app.py                         # Flask后端主程序
└── ... (其他前端和配置文件)
```

---


# 如何使用

  项目使用集中的参数配置，使用Docker部署时所有参数均在.env文件中配置；使用Github Actions部署时为防止敏感配置泄露，所有参数使用 repository secret 配置。

## 📂 如何配置邀请码

本应用的访问是通过邀请码机制来控制的。您可以轻松地添加或修改有效的邀请码。

1.  **找到用户文件**: 打开项目根目录下的 `_data/users.json` 文件。
2.  **编辑邀请码列表**: 该文件包含一个名为 `valid_codes` 的JSON数组。您可以在这个数组中直接添加、删除或修改邀请码字符串。

**示例 `_data/users.json` 文件:**
```json
{
  "valid_codes": [
    "GAOKAO_2025_VIP",
    "TEST_CODE_123",
    "ok"
  ]
}
```
- **添加**: 在数组末尾加入一个新的字符串，例如 `"NEW_CODE_456"`。
- **删除**: 从数组中移除一个不再需要的字符串。

**重要提示**:
- 修改 `users.json` 文件后，如果应用正在运行，您**需要重启应用**（无论是重启Docker容器还是GitHub Actions工作流）才能使新的邀请码列表生效。
- 如果您是在GitHub Actions上运行本项目，请记得将修改后的 `users.json` 文件 `git push` 到您的仓库中，以便下次工作流运行时能够加载到最新的配置。

---

## 📂 如何配置分数线文件

见[_data/README.md](_data/README.md)中的详细说明

## 🚀 如何在 GitHub Actions 上运行

本项目经过特殊设计，可以“取巧”地利用GitHub Actions的免费额度来作为应用服务器。

### 前提
1.  **Fork本项目**: 将此仓库Fork到您自己的GitHub账户下。
2.  **注册ngrok**: 访问 [ngrok.com](https://ngrok.com) 注册一个免费账户，并在仪表板中找到您的 **Authtoken**。

![token](images/token.png)

### 配置步骤
进入您Fork后的GitHub仓库页面，点击 `Settings` -> `Secrets and variables` -> `Actions`，然后点击 `New repository secret` 添加以下 **Secrets**：

1.  **`NGROK_AUTHTOKEN`**: (必需) 粘贴您从ngrok获取的Authtoken。
2.  **`OPENAI_API_KEY`**: (必需) 您的AI服务API Key。
3.  **`OPENAI_API_BASE`**: (必需) 您的AI服务API地址。
4.  **`OPENAI_MODEL_NAME`**: (可选) 指定使用的AI模型名称，默认`gemini-2.5-flash`。
5.  **`DAILY_LIMIT`**: (可选) 每日使用总次数上限，默认`100`。
5.  **`RATE_LIMIT_PER_MINUTE`**: (可选) 单IP每分钟请求上限，默认`10`。
6.  **`CONTEXT_TURNS`**: (可选) AI记忆的上下文对话轮数，默认`3`。
7.  **`LOAD_SCORE_DATA`**: (可选) 设为 `"true"` 来加载本地的历年分数线数据，默认`"true"`。

&emsp;Github Actions Secrets最小化示例配置：
```
NGROK_AUTHTOKEN = 2z3U519yMIwxxxxxxxxxxxxxTWh_5GjRTTwge7SPPqnaHB96X

OPENAI_API_KEY = xxxxxxxx

OPENAI_API_BASE = https://xxxx.com/v1  
#如果使用gemini系列模型，则需配置为 https://generativelanguage.googleapis.com/v1beta/openai/

OPENAI_MODEL_NAME = gemini-2.5-pro

```

### 运行步骤
1.  **进入Actions页面**: 在您的仓库页面，点击 `Actions` 标签页。
2.  **选择工作流**: 在左侧边栏，点击 `Run App`。
3.  **手动触发**: 点击 `Run workflow` 按钮。
4.  **获取访问链接**: 等待约1-2分钟，待工作流运行起来后，在action日志即可查看：`
Your temporary URL is:
https://xxxxx.ngrok-free.app`或进入[https://dashboard.ngrok.com/agents](https://dashboard.ngrok.com/agents)即可查看链接。

**重要提示**:
- 每个任务最长运行6小时，之后服务会自动关闭。
- `_data/` 和 `sessions/` 目录下的文件会在任务结束时自动提交回仓库，请确保您本地的代码与远程同步（`git pull`）后再进行修改和推送。

---

##  如何在本地Docker环境启动 (用于开发)

### 前提
1.  **安装 Docker Desktop**
2.  **配置环境变量**: 复制 `.env.example` 为 `.env`，并填入您的 参数。**完整参数配置说明已在**`.env.example`**中提供**。

使用gemini-2.5-pro的最简.env文件示例：

```
OPENAI_API_KEY="xxxxx"

OPENAI_API_BASE="https://generativelanguage.googleapis.com/v1beta/openai/"

OPENAI_MODEL_NAME="gemini-2.5-pro"
```
只配置LLM参数的情况下，默认日限额100，上下文轮数3，单IP每分钟请求10，读取分数线文件。

### 一键启动
在项目根目录下，打开终端并运行：
```bash
docker-compose up --build
```
当看到日志显示 `Listening at: http://0.0.0.0:5000` 时，在浏览器中打开 `http://localhost:5000` 即可使用。
