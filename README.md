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
        *   **`OPENAI_MODEL_NAME` (可选):** 您希望使用的模型名称。如果留空，将默认使用 `qwen3-30b-a3b`。
        *   **Vercel KV 数据库环境变量 (必需):** `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`。这四个变量是连接成本控制数据库所必需的，以下是详细的创建和配置步骤。

### 如何为本地开发配置环境变量 (`vercel dev`)

当您在本地使用 `vercel dev` 命令时，它**不会**读取本地的 `.env` 文件。相反，它会安全地从您在Vercel云端为该项目配置的环境变量中拉取。

**配置步骤如下:**

1.  **确保项目已关联:** 在终端运行 `vercel link`，将您的本地文件夹与Vercel上的远程项目关联起来。
2.  **在Vercel云端设置变量:** 登录Vercel网站，进入您的项目，在 "Settings" -> "Environment Variables" 页面中，添加所有必需的变量（`OPENAI_API_KEY`, `KV_URL` 等）。
3.  **启动开发服务器:** 在终端运行 `vercel dev`。

Vercel CLI会自动将您在云端设置的变量下载并注入到本地的开发服务器中。这是Vercel推荐的安全做法，可以避免将密钥直接存储在本地文件中。

---

#### 如何创建和配置Vercel KV数据库

Vercel KV是一个基于Redis的无服务器键值存储数据库，非常适合用于本项目的成本控制计数器。以下是创建步骤：

1.  **进入项目仪表盘:**
    *   在Vercel上导入您的项目后，点击进入该项目的仪表盘页面。

2.  **找到Storage标签页:**
    *   在项目仪表盘的顶部导航栏中，找到并点击 "Storage" 标签。

3.  **创建新的KV数据库:**
    *   在Storage页面中，您会看到 "KV (New)" 的选项。点击它旁边的 "Create" 或 "Connect Store" 按钮。
    *   系统会弹出一个创建窗口。您可以为数据库起一个容易识别的名字（例如 `gaokao-advisor-kv`），并选择一个离您目标用户最近的区域（Region），例如 `Hong Kong (hkg1)`。
    *   点击 "Create" 完成创建。

4.  **连接到项目并获取环境变量:**
    *   创建成功后，Vercel会显示一个 "Connect to Project" 的界面。
    *   确保下拉菜单中选中的是您当前的项目。
    *   点击 "Connect" 按钮。
    *   **关键一步:** Vercel会自动生成连接数据库所需的所有环境变量 (`KV_URL`, `KV_REST_API_URL`, 等)，并显示它们。它还会提供一个按钮，让您一键将这些变量添加到当前项目中。**请务必点击这个 "Add to Project" 或类似的按钮。**

5.  **验证环境变量:**
    *   连接成功后，回到您项目的 "Settings" -> "Environment Variables" 页面。
    *   您应该能看到刚刚添加的四个 `KV_` 开头的环境变量。这表示您的后端代码现在已经可以成功连接到数据库了。
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

如果您想**不通过 `vercel dev`**，而是直接用 `pytest` 运行需要真实API密钥的测试，您才需要使用 `.env` 文件。

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

## 故障排查 (Troubleshooting)

### 错误: "网络请求失败，请检查您的网络连接或稍后重试。"

这个错误是前端（浏览器）无法成功连接到后端API服务时显示的。**99%的原因是项目的启动方式不正确。**

**错误原因:**

您不能直接在文件管理器中双击 `index.html` 在浏览器中打开它。这样做的话，前端页面虽然能显示，但它不知道后端API（`/api/handler`）在哪里，所以发出的网络请求会立即失败。

**正确启动方式 (本地开发):**

您必须使用Vercel的命令行工具 `vercel dev` 来启动一个本地开发服务器，它会同时模拟前端和后端环境。

1.  **确保已安装Vercel CLI:**
    ```bash
    npm install -g vercel
    ```
2.  **确保已登录并关联项目:**
    ```bash
    vercel login
    vercel link
    ```
3.  **启动开发服务器:**
    ```bash
    vercel dev
    ```
4.  **访问正确的地址:**
    *   命令执行后，终端会显示一个本地地址，通常是 `http://localhost:3000`。
    *   **请务必在浏览器中访问这个地址**。只有通过这个地址访问，前端页面才能正确地找到并与后端API通信。

**其他可能的原因:**

*   **防火墙:** 您的电脑防火墙或安全软件可能阻止了本地网络连接。
*   **环境变量未加载:** 如果您使用 `vercel dev` 启动，但忘记在Vercel网站上配置环境变量，后端服务可能会启动失败。请检查 `vercel dev` 的终端输出中是否有错误信息。

---
