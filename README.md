# 高考志愿AI决策顾问 (Docker版) 🚀

本项目是一个移动端优先的H5单页应用，旨在为面临高考志愿填报最后抉择的考生及家长，提供一份由AI驱动的、结合了最新招生计划的深度分析报告。

本版本已重构为统一的Flask Web应用，并可通过Docker进行容器化部署。

---

## 🎯 核心技术栈

- **Web框架:** Flask
- **前端:** 原生 JavaScript (ES6+), HTML5, CSS3
- **AI模型:** 兼容OpenAI的API (如 Kimi, Moonshot, DeepSeek 等)
- **数据库:** Redis (用于成本控制)
- **容器化:** Docker / Docker Compose

---

## 启动项目 (傻瓜版教程) 🐳

现在，启动整个项目（包括Web应用和数据库）只需要一个命令！

### 前提条件

1.  **安装 Docker Desktop**:
    *   请从 [Docker官网](https://www.docker.com/products/docker-desktop/) 下载并安装适用于您操作系统（Windows/macOS/Linux）的Docker Desktop。这是唯一需要安装的软件。
2.  **配置环境变量**:
    *   将项目根目录下的 `.env.example` 文件复制一份，并重命名为 `.env`。
    *   打开 `.env` 文件，填入您的 **OpenAI 兼容服务的API密钥** (`OPENAI_API_KEY`) 和 **Base URL** (`OPENAI_API_BASE`)。
    *   (可选) 您可以添加 `DAILY_LIMIT=200` 这样的行来设置每日的请求上限，默认为100。

### 一键启动

1.  **打开终端**:
    *   在您的电脑上打开一个终端或命令行工具。
2.  **进入项目目录**:
    *   使用 `cd` 命令，进入本项目的根目录（即包含 `docker-compose.yml` 文件的目录）。
3.  **启动！**
    *   运行以下命令：
        ```bash
        docker-compose up --build
        ```
4.  **等待**:
    *   Docker会自动开始构建镜像、下载Redis、安装所有依赖并启动服务。第一次启动时可能需要几分钟。
5.  **访问应用**:
    *   当您在终端看到类似 `Listening at: http://0.0.0.0:5000` 的日志时，就表示启动成功了！
    *   现在，打开您的浏览器，访问 `http://localhost:5000` 即可开始使用。

### 如何停止

-   在您启动 `docker-compose` 的那个终端窗口中，按下 `Ctrl + C` 即可停止所有服务。

---

## ⚙️ 每日限额功能

-   本项目已重新引入**每日请求限额**功能，通过Redis数据库进行计数。
-   默认上限为**100次/天**。您可以通过在 `.env` 文件中设置 `DAILY_LIMIT` 变量来修改此值。
-   **如何重置计数?** 由于我们现在是独立的Docker应用，计数器需要手动重置。您可以使用任何Redis客户端连接到 `localhost:6379`，然后执行 `SET daily_requests_count 0` 命令来清零。在生产环境中，通常会设置一个服务器级别的定时任务（Cron Job）来自动执行此操作。
