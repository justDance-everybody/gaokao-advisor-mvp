# 高考志愿AI决策顾问 (MVP)

本项目是一个移动端优先的H5单页应用，旨在为面临高考志愿填报最后抉择的考生及家长，提供一份由AI驱动的、结合了最新招生计划的深度分析报告。

## 技术栈

- **前端:** 原生 JavaScript (ES6+), HTML5, CSS3
- **后端:** Python 3.9+ Serverless Function (部署于 Vercel)
- **AI模型:** 兼容OpenAI的API
- **数据库:** Vercel KV (基于Redis)

## 如何启动和部署项目

本项目为Serverless架构，最佳实践是直接通过Vercel平台进行部署和启动，本地开发环境的配置相对复杂。

### 部署到Vercel (推荐)

1.  **Fork/Clone本项目到您的GitHub账户。**
2.  **登录Vercel:** 使用您的GitHub账户登录Vercel。
3.  **导入项目:** 在Vercel仪表盘中，选择 "Add New..." -> "Project"，然后选择您刚刚Fork/Clone的GitHub仓库。
4.  **配置项目:** Vercel会自动识别本项目为Python环境。您无需修改构建和输出设置。
5.  **配置环境变量 (关键步骤):**
    *   在项目设置的 "Environment Variables" 区域，添加以下变量：
        *   **`OPENAI_API_KEY` (必需):** 您的OpenAI API密钥。
        *   **`OPENAI_API_BASE` (必需):** 您使用的兼容OpenAI API的地址 (Base URL)。
        *   **`OPENAI_MODEL_NAME` (可选):** 您希望使用的模型名称。如果留空，将默认使用 `gpt-4o`。
        *   **`KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` (必需):** 这四个变量用于连接Vercel KV数据库。请在Vercel的 "Storage" 标签页创建一个新的KV数据库，Vercel会自动为您生成这些值并提示您添加到项目中。
6.  **部署:** 点击 "Deploy" 按钮。Vercel会自动安装 `requirements.txt` 中的依赖，并将您的前端和后端部署到全球CDN网络。部署完成后，您将获得一个可公开访问的URL。

### 如何在本地运行测试

在部署前，您可以在本地运行后端自动化测试，以确保核心逻辑正确。

1.  **创建虚拟环境:**
    ```bash
    python -m venv venv
    ```
2.  **激活虚拟环境:**
    *   **Windows (CMD):** `venv\Scripts\activate`
    *   **Linux/macOS (Bash):** `source venv/bin/activate`
3.  **安装依赖:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **运行测试:**
    *   在项目根目录下，运行`pytest`。它会自动发现并执行 `api/test_handler.py` 中的测试用例。
    ```bash
    pytest
    ```
    *   **重要提示**: 我编写的测试用例 (`api/test_handler.py`) 使用了“模拟”(Mocking)技术，它不会发出真实的API请求。因此，**您无需任何配置即可成功运行这套测试**。

### 如何为本地真实API测试配置环境变量 (进阶)

如果您想编写新的测试来真实地调用API，您需要为本地环境提供API密钥。

1.  **创建`.env`文件:**
    *   将项目中的 `.env.example` 文件复制一份，并重命名为 `.env`。
2.  **填写密钥:**
    *   打开 `.env` 文件，将 `OPENAI_API_KEY` 和 `OPENAI_API_BASE` 等变量替换为您的真实值。
    *   `.env` 文件已被 gitignore，所以您的密钥不会被上传到代码库。
3.  **运行测试:**
    *   现在，当您运行 `pytest` 时，`pytest-dotenv` 插件会自动从 `.env` 文件中加载这些环境变量，您的测试代码便可以通过 `os.environ.get(...)` 来获取它们。

### 如何在本地模拟运行 (进阶)

直接在本地运行完整的前后端交互比较困难，因为后端是为Vercel的Serverless环境设计的。但您可以使用Vercel的CLI工具来模拟。

1.  **安装Vercel CLI:**
    ```bash
    npm install -g vercel
    ```
2.  **登录Vercel:**
    ```bash
    vercel login
    ```
3.  **关联项目:**
    ```bash
    vercel link
    ```
4.  **本地开发服务器:**
    *   在项目根目录下运行：
    ```bash
    vercel dev
    ```
    *   Vercel CLI会启动一个本地服务器（通常在`localhost:3000`），它会模拟Vercel的生产环境，包括加载您在Vercel网站上配置的环境变量。您可以在浏览器中打开这个地址来测试完整的应用。
