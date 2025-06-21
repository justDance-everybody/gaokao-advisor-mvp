document.addEventListener('DOMContentLoaded', () => {
    const submissionView = document.getElementById('submission-view');
    const waitingView = document.getElementById('waiting-view');
    const reportView = document.getElementById('report-view');
    const errorView = document.getElementById('error-view');

    const submitButton = document.getElementById('submit-button');
    const shareButton = document.getElementById('share-button');
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Tab Navigation ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });

    // --- Event Listeners ---
    submitButton.addEventListener('click', handleSubmit);
    shareButton.addEventListener('click', handleShare);

    // --- Main Handler Functions ---
    async function handleSubmit() {
        showLoadingState();

        try {
            const userInput = await getUserInput();

            if (!userInput || (userInput.rawText && !userInput.rawText.trim())) {
                 showErrorState("输入内容不能为空，请填写或上传您的方案。");
                 // Restore the initial view to allow user to try again
                 submissionView.style.display = 'block';
                 waitingView.style.display = 'none';
                 submitButton.disabled = false;
                 return;
            }

            const response = await fetch('/api/handler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput })
            });

            if (!response.ok) {
                let errorText = `服务返回错误。状态码: ${response.status} (${response.statusText})`;
                try {
                    const errorData = await response.json();
                    errorText += `\n后端信息: ${errorData.error || JSON.stringify(errorData)}`;
                } catch (e) {
                    errorText += `\n响应内容不是有效的JSON。`;
                }
                throw new Error(errorText);
            }

            const data = await response.json();
            const reportHtml = marked.parse(data.report);
            showReportState(reportHtml);

        } catch (error) {
            console.error("Submit/Fetch Error:", error);
            
            let detailedErrorMessage = "网络请求失败！\n\n";
            detailedErrorMessage += "这通常意味着前端页面无法与后端API服务正常通信。\n";
            detailedErrorMessage += "请检查浏览器开发者工具(F12)中的“网络(Network)”和“控制台(Console)”选项卡，查看是否有更详细的红色错误信息。\n\n";
            detailedErrorMessage += "--- 技术调试信息 ---\n";
            detailedErrorMessage += `错误类型: ${error.name}\n`;
            detailedErrorMessage += `错误信息: ${error.message}\n`;
            
            showErrorState(detailedErrorMessage);
        }
    }

    function handleShare() {
        if (navigator.share) {
            navigator.share({
                title: '我的AI志愿分析报告',
                text: '快来看看AI为我生成的志愿决策分析报告！',
                url: window.location.href,
            })
            .then(() => console.log('Successful share'))
            .catch((error) => console.log('Error sharing', error));
        } else {
            // Fallback for desktops
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('报告链接已复制到剪贴板！');
            }, () => {
                alert('复制链接失败，请手动复制浏览器地址。');
            });
        }
    }

    // --- UI State Management ---
    function showLoadingState() {
        submissionView.style.display = 'none';
        reportView.style.display = 'none';
        errorView.style.display = 'none';
        waitingView.style.display = 'block';
        submitButton.disabled = true;
    }

    function showReportState(htmlContent) {
        document.getElementById('report-content').innerHTML = htmlContent;
        waitingView.style.display = 'none';
        submissionView.style.display = 'none';
        errorView.style.display = 'none';
        reportView.style.display = 'block';
    }

    function showErrorState(message) {
        // Use <pre> tag to preserve formatting of the detailed error message
        document.getElementById('error-message').innerHTML = `<pre>${message}</pre>`;
        waitingView.style.display = 'none';
        submissionView.style.display = 'none';
        reportView.style.display = 'none';
        errorView.style.display = 'block';
        submitButton.disabled = false; 
    }

    // --- Data Gathering ---
    async function getUserInput() {
        const activeTab = document.querySelector('.tab-button.active').dataset.tab;
        let rawText = "";
        let province = "", stream = "", rank = "", options = "", dilemma = "";

        if (activeTab === 'paste') {
            rawText = document.getElementById('raw-text-input').value;
        } else if (activeTab === 'upload') {
            const fileInput = document.getElementById('file-input');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                rawText = await new Promise((resolve, reject) => {
                    if (file.type.startsWith('image/')) {
                        resolve(`用户上传了图片: ${file.name}。请注意，AI无法直接分析图片内容，请将图片中的文字手动粘贴。`);
                        return;
                    }
                    if (file.type.includes('word')) {
                         resolve(`用户上传了Word文档: ${file.name}。请注意，AI将尝试读取文本，但复杂格式可能无法解析。`);
                         return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (e) => reject(new Error("读取文件时出错"));
                    reader.readAsText(file, 'UTF-8');
                });
            }
        } else if (activeTab === 'fill') {
            province = document.getElementById('province-input').value;
            stream = document.getElementById('stream-input').value;
            rank = document.getElementById('rank-input').value;
            options = document.getElementById('options-input').value;
            dilemma = document.getElementById('dilemma-input').value;
            rawText = `省份: ${province}\n科类: ${stream}\n分数/位次: ${rank}\n方案: ${options}\n困惑: ${dilemma}`;
        }

        const finalProvince = province || document.getElementById('province-input').value;
        const finalStream = stream || document.getElementById('stream-input').value;
        const finalRank = rank || document.getElementById('rank-input').value;

        return {
            province: finalProvince,
            stream: finalStream,
            rank: finalRank ? parseInt(finalRank, 10) : null,
            rawText: rawText,
        };
    }
});