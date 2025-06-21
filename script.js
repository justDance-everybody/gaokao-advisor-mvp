document.addEventListener('DOMContentLoaded', async () => {
    // --- Autocomplete Data Loading ---
    let suggestions = [];
    try {
        const response = await fetch('_data/enrollment_data_2025.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        Object.values(data.data).forEach(province => {
            Object.values(province).forEach(stream => {
                Object.keys(stream).forEach(school => {
                    suggestions.push(school);
                    Object.keys(stream[school]).forEach(major => {
                        suggestions.push(`${school} ${major}`);
                    });
                });
            });
        });
        suggestions = [...new Set(suggestions)];
    } catch (error) {
        console.error("Failed to load autocomplete suggestions:", error);
    }

    // --- Element Cache ---
    const submissionView = document.getElementById('submission-view');
    const waitingView = document.getElementById('waiting-view');
    const reportView = document.getElementById('report-view');
    const errorView = document.getElementById('error-view');
    const submitButton = document.getElementById('submit-button');
    const shareButton = document.getElementById('share-button');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const rankInput = document.getElementById('rank-input');
    const rankSlider = document.getElementById('rank-slider');
    const rankSliderValue = document.getElementById('rank-slider-value');
    const scoreTypeGroup = document.getElementById('score-type-group');
    const reportContent = document.getElementById('report-content');

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

    if (rankInput && rankSlider && rankSliderValue) {
        rankSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            rankInput.value = value;
            rankSliderValue.textContent = value;
        });
        rankInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value && parseInt(value) <= parseInt(rankSlider.max) && parseInt(value) >= parseInt(rankSlider.min)) {
               rankSlider.value = value;
               rankSliderValue.textContent = value;
            }
        });
    }

    if (scoreTypeGroup) {
        scoreTypeGroup.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'score') {
                rankInput.placeholder = "例如: 650";
                rankSlider.min = 150;
                rankSlider.max = 750;
                rankSlider.step = 1;
                rankSlider.value = 500;
                rankSliderValue.textContent = 500;
                rankInput.value = 500;
            } else { // rank
                rankInput.placeholder = "例如: 12000";
                rankSlider.min = 1;
                rankSlider.max = 750000;
                rankSlider.step = 100;
                rankSlider.value = 100000;
                rankSliderValue.textContent = 100000;
                rankInput.value = 100000;
            }
        });
    }

    // --- Autocomplete Initialization ---
    if (suggestions.length > 0) {
        new autoComplete({
            selector: '#options-input',
            minChars: 1,
            source: function(term, suggest){
                term = term.toLowerCase();
                const choices = suggestions;
                const matches = [];
                for (let i=0; i<choices.length; i++)
                    if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
                suggest(matches);
            }
        });
    }

    // --- Main Handler Functions ---
    async function handleSubmit() {
        const userInput = await getUserInput();
        if (!userInput || (userInput.rawText && !userInput.rawText.trim())) {
             showErrorState("输入内容不能为空，请填写或上传您的方案。");
             return;
        }

        // Switch to report view immediately and clear old content
        showReportState(""); 
        
        const eventSource = new EventSource('/api/handler', {
            method: 'POST', // EventSource doesn't directly support POST, this is a conceptual representation.
                           // We will send the data in the request body via a custom fetch wrapper.
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInput })
        });
        
        let fullReport = "";

        eventSource.onmessage = function(event) {
            try {
                const token = JSON.parse(event.data);
                fullReport += token;
                reportContent.innerHTML = marked.parse(fullReport);
            } catch(e) {
                console.error("Failed to parse token:", event.data);
            }
        };

        eventSource.onerror = function(err) {
            console.error("EventSource failed:", err);
            showErrorState("与服务器的连接中断或发生错误。");
            eventSource.close();
        };
        
        // This is a workaround because EventSource doesn't natively support POST bodies.
        // We'll use a fetch request to initiate the stream.
        try {
            const response = await fetch('/api/handler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            function processText({ done, value }) {
                if (done) {
                    return;
                }
                const chunk = decoder.decode(value);
                // SSE messages are separated by \n\n
                const lines = chunk.split('\n\n');
                lines.forEach(line => {
                    if (line.startsWith('data:')) {
                        const data = line.substring(5).trim();
                        try {
                            const token = JSON.parse(data);
                            fullReport += token;
                            reportContent.innerHTML = marked.parse(fullReport);
                        } catch(e) {
                            console.error("Failed to parse token:", data);
                        }
                    }
                });
                return reader.read().then(processText);
            }
            reader.read().then(processText);

        } catch(error) {
            console.error("Submit/Fetch Error:", error);
            showErrorState(`网络请求失败: ${error.message}`);
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
        reportContent.innerHTML = htmlContent;
        waitingView.style.display = 'none';
        submissionView.style.display = 'none';
        errorView.style.display = 'none';
        reportView.style.display = 'block';
        submitButton.disabled = false; // Re-enable button after completion/error
    }

    function showErrorState(message) {
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
        let province = "", stream = "", rank = "";

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
            province = document.getElementById('province-select').value;
            const selectedStream = document.querySelector('input[name="stream"]:checked');
            stream = selectedStream ? selectedStream.value : '';
            rank = document.getElementById('rank-input').value;
            const options = document.getElementById('options-input').value;
            const dilemma = document.getElementById('dilemma-input').value;
            const scoreType = document.querySelector('input[name="score_type"]:checked').value;
            const scoreLabel = scoreType === 'score' ? '分数' : '位次';
            
            rawText = `
省份: ${province}
科类: ${stream}
${scoreLabel}: ${rank}
纠结的方案: 
${options}
我的主要困惑: 
${dilemma}
            `.trim();
        }

        return {
            province: province,
            stream: stream,
            rank: rank ? parseInt(rank, 10) : null,
            rawText: rawText,
        };
    }
});