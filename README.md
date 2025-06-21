# 高考志愿AI决策顾问 (MVP) 🚀

本项目是一个移动端优先的H5单页应用，旨在为面临高考志愿填报最后抉择的考生及家长，提供一份由AI驱动的、结合了最新招生计划的深度分析报告。

---

## 🎯 核心技术栈

- **前端:** 原生 JavaScript (ES6+), HTML5, CSS3
- **后端:** Python 3.9+ Serverless Function (部署于 Vercel)
- **AI模型:** 兼容OpenAI的API (如 Kimi, Moonshot, DeepSeek 等)
- **数据库:** Vercel KV (基于Redis，用于成本控制)

---

## 部署与启动 (傻瓜版教程)

我们提供两种方式来运行本项目，请根据您的需求选择：

### 方式一：一键部署到线上 (推荐👍)

这是最简单、最快的方式，您不需要在自己电脑上安装任何东西，只需要一个GitHub账号。

**第1步：准备工作**
-   注册一个 [GitHub](https://github.com/) 账号。
-   注册一个 [Vercel](https://vercel.com/) 账号 (可以直接用GitHub账号登录)。
-   准备好您的 **OpenAI 兼容服务的API密钥** (包括 `API Key` 和 `Base URL`)。

**第2步：Fork本项目**
-   点击本项目页面右上角的 **"Fork"** 按钮，将这个项目复制到您自己的GitHub仓库中。

**第3步：在Vercel上导入项目**
1.  登录Vercel，进入您的仪表盘 (Dashboard)。
2.  点击 **"Add New..." -> "Project"**。
3.  选择您刚刚Fork的GitHub仓库，点击 **"Import"**。

**第4步：配置项目 (关键！)**
1.  **配置环境变量**:
    -   在配置页面，展开 **"Environment Variables"** 区域。
    -   添加以下三个变量：
        -   `OPENAI_API_KEY`: 填入您的API Key。
        -   `OPENAI_API_BASE`: 填入您的API Base URL。
        -   `OPENAI_MODEL_NAME`: 填入您想用的模型名 (例如 `moonshot-v1-8k`)。
2.  **创建并连接数据库**:
    -   点击顶部导航栏的 **"Storage"** 标签。
    -   选择 **"KV (New)"**，点击 **"Create"**。
    -   给数据库起个名字，选择一个离您近的地区，点击 **"Create"**。
    -   在接下来的页面，点击 **"Connect"** 按钮，Vercel会自动把数据库的连接信息（`KV_URL`等4个变量）添加到您的项目中。
3.  **部署！**
    -   完成以上配置后，点击 **"Deploy"** 按钮。
    -   等待几分钟，Vercel就会自动完成所有安装和部署工作。成功后，您会得到一个公开的网址，例如 `httpsxxx.vercel.app`。
    -   **恭喜！您的应用已成功上线！**

### 方式二：在本地电脑上开发和测试 (进阶)

如果您是开发者，想在本地修改代码或进行测试，请按以下步骤操作。

**第1步：准备本地环境**
1.  安装 [Python 3.9+](https://www.python.org/downloads/)。
2.  安装 [Node.js](https://nodejs.org/) (用于安装Vercel命令行工具)。
3.  在项目根目录，创建并激活Python虚拟环境：
    ```bash
    # 创建虚拟环境
    python -m venv venv
    # 激活虚拟环境 (Windows)
    venv\Scripts\activate
    # 激活虚拟环境 (macOS/Linux)
    source venv/bin/activate
    ```
4.  安装所有Python依赖：
    ```bash
    pip install -r requirements.txt
    ```

**第2步：运行后端单元测试**
-   这套测试**不需要任何API密钥**，可以直接运行，确保后端逻辑正确。
-   在项目根目录下，直接运行 `pytest` 命令：
    ```bash
    pytest
    ```
-   如果所有测试都显示 `PASSED`，说明后端核心功能完好。

**第3步：启动本地开发服务器**
1.  安装Vercel命令行工具 (CLI):
    ```bash
    npm install -g vercel
    ```
2.  登录并关联项目:
    ```bash
    vercel login
    vercel link
    ```
3.  **启动服务！**
    ```bash
    vercel dev
    ```
4.  终端会显示一个本地网址，通常是 `http://localhost:3000`。在浏览器中打开这个地址，您就可以像在线上一样与应用交互了。
    > **注意**: `vercel dev` 会自动从您在Vercel网站上为本项目配置的环境变量中拉取密钥，非常安全。

---

## ⚙️ 如何管理数据库 (测试用)

我们提供了一个命令行脚本 `scripts/kv_manager.py`，方便您在测试时手动修改数据库中的访问次数。

**使用方法:** (请确保已激活Python虚拟环境)

-   **查看**当前访问次数:
    ```bash
    python scripts/kv_manager.py get
    ```
-   **设置**访问次数为999 (用于测试"名额已满"功能):
    ```bash
    python scripts/kv_manager.py set 999
    ```
-   **重置**访问次数为0:
    ```bash
    python scripts/kv_manager.py reset
    ```

> **提示**: 这个脚本需要读取项目根目录下的 `.env` 文件才能连接到数据库。请将 `.env.example` 复制为 `.env`，并从Vercel网站上复制您的KV数据库连接信息填入其中。

---

## 🤔 常见问题 (Troubleshooting)

**问：页面显示 "网络请求失败..." 是怎么回事？**

**答：** 99%的可能性是您**直接用浏览器打开了 `index.html` 文件**。这是不行的！

**正确做法**是必须通过 `vercel dev` 命令启动本地开发服务器，然后访问终端提示的 `http://localhost:3000` 地址。只有这样，前端页面才能正确地找到后端服务。
