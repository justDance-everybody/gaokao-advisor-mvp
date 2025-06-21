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
        const userInput = getUserInput();

        if (!userInput) {
            showErrorState("无法获取输入内容，请检查您的输入。");
            return;
        }

        try {
            const response = await fetch('/api/handler', {
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
            console.error("Fetch Error:", error);
            showErrorState("网络请求失败，请检查您的网络连接或稍后重试。");
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
        submissionView.style.display = 'none';
        reportView.style.display = 'none';
        errorView.style.display = 'block';
        // Allow user to try again
        submitButton.disabled = false; 
    }

    // --- Data Gathering ---
    function getUserInput() {
        const activeTab = document.querySelector('.tab-button.active').dataset.tab;
        let rawText = "";
        let province = "", stream = "", rank = "", options = "", dilemma = "";

        if (activeTab === 'paste') {
            rawText = document.getElementById('raw-text-input').value;
        } else if (activeTab === 'upload') {
            // File handling would be more complex, requiring backend processing.
            // For MVP, we can simplify and just send the filename as an indicator.
            // A real implementation would use FileReader to get text content.
            const fileInput = document.getElementById('file-input');
            if (fileInput.files.length > 0) {
                rawText = `用户上传了文件: ${fileInput.files[0].name}`;
                 // In a real app, you'd use FileReader API here to read the file content.
            }
        } else if (activeTab === 'fill') {
            province = document.getElementById('province-input').value;
            stream = document.getElementById('stream-input').value;
            rank = document.getElementById('rank-input').value;
            options = document.getElementById('options-input').value;
            dilemma = document.getElementById('dilemma-input').value;
            rawText = `方案: ${options}\n困惑: ${dilemma}`;
        }

        return {
            province: province,
            stream: stream,
            rank: rank ? parseInt(rank, 10) : null,
            rawText: rawText,
        };
    }
});