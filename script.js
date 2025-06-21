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
            const userInput = await getUserInput(); // Can throw error

            if (!userInput || (userInput.rawText && !userInput.rawText.trim())) {
                 showErrorState("输入内容不能为空，请填写或上传您的方案。");
                 return;
            }

            const response = await fetch('/api/handler', { // Can throw error
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput })
            });

            const data = await response.json();

            if (!response.ok) {
                showErrorState(data.error || "服务返回了未知错误。");
            } else {
                const reportHtml = marked.parse(data.report);
                showReportState(reportHtml);
            }
        } catch (error) {
            console.error("Submit/Fetch Error:", error);
            let errorMessage = "网络请求失败，请检查您的网络连接或稍后重试。";
            if (error.message.includes("读取文件时出错")) {
                errorMessage = "读取文件时出错，请检查文件是否损坏或格式是否正确。";
            }
            showErrorState(errorMessage);
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
        document.getElementById('error-message').textContent = message;
        waitingView.style.display = 'none';
        // Keep submission view hidden if error occurs, show the error view instead.
        submissionView.style.display = 'none';
        reportView.style.display = 'none';
        errorView.style.display = 'block';
        // Allow user to try again, but they'll need to refresh or we need a "try again" button
        // For now, let's re-enable the main view to allow re-submission.
        // A better UX would be a dedicated "back" or "retry" button in the error view.
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
                // Use a promise to handle the async nature of FileReader
                rawText = await new Promise((resolve, reject) => {
                    // Basic type check
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

        // Consolidate data from the 'fill' tab into the final object
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