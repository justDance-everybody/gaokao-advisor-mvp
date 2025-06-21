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
    const submitButton = document.getElementById('submit-button');
    const reportContainer = document.getElementById('report-container');
    const rankInput = document.getElementById('rank-input');
    const rankSlider = document.getElementById('rank-slider');
    const rankSliderValue = document.getElementById('rank-slider-value');
    const scoreTypeGroup = document.getElementById('score-type-group');
    const usageStats = document.getElementById('usage-stats');
    const dilemmaInput = document.getElementById('dilemma-input');
    const dilemmaTags = document.querySelector('.dilemma-tags');
    const savePdfBtn = document.getElementById('save-pdf-btn');

    // --- Event Listeners ---
    submitButton.addEventListener('click', handleSubmit);

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

    if (dilemmaTags) {
        dilemmaTags.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-btn')) {
                const tagText = e.target.textContent;
                dilemmaInput.value += (dilemmaInput.value ? '，' : '') + tagText;
            }
        });
    }

    if(savePdfBtn) {
        savePdfBtn.addEventListener('click', handleSavePdf);
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
             alert("输入内容不能为空，请填写或上传您的方案。");
             return;
        }

        const botMessageDiv = createBotMessage();
        const { thinkContainer, thinkContent, answerContent, toggleThink } = botMessageDiv;
        
        submitButton.disabled = true;
        savePdfBtn.style.display = 'none';
        answerContent.innerHTML = '<div class="typing-cursor"></div>'; // Show loading indicator

        try {
            const response = await fetch('/api/handler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput })
            });

            const data = await response.json();

            if (data.usage) {
                updateUsage(data.usage);
            }

            if (!response.ok) {
                let errorText = `服务返回错误。状态码: ${response.status} (${response.statusText})`;
                let backendMessage = data.error || JSON.stringify(data);
                if (data.traceback) {
                    backendMessage += `\n\n--- 后端堆栈跟踪 ---\n${data.traceback}`;
                }
                errorText += `\n后端信息: ${backendMessage}`;
                throw new Error(errorText);
            }
            
            processAndRenderFinalReport(data.report, thinkContainer, thinkContent, answerContent);
            savePdfBtn.style.display = 'inline-block';

        } catch (error) {
            console.error("Submit/Fetch Error:", error);
            let detailedErrorMessage = "网络请求失败！\n\n";
            detailedErrorMessage += "这通常意味着前端页面无法与后端API服务正常通信。\n";
            detailedErrorMessage += "请检查浏览器开发者工具(F12)中的“网络(Network)”和“控制台(Console)”选项卡，查看是否有更详细的红色错误信息。\n\n";
            detailedErrorMessage += "--- 技术调试信息 ---\n";
            detailedErrorMessage += `错误类型: ${error.name}\n`;
            detailedErrorMessage += `错误信息: ${error.message}\n`;
            answerContent.innerHTML = `<pre style="color:red;">${detailedErrorMessage}</pre>`;
        } finally {
            submitButton.disabled = false;
        }
    }

    function createBotMessage() {
        const botMessageDiv = document.createElement('div');
        botMessageDiv.className = 'bot-message';
        const thinkContainer = document.createElement('div');
        thinkContainer.className = 'think-container';
        thinkContainer.style.display = 'none';
        const toggleThink = document.createElement('div');
        toggleThink.className = 'toggle-think';
        toggleThink.innerHTML = '展开AI思考过程 <i class="fas fa-chevron-down"></i>';
        const thinkContent = document.createElement('div');
        thinkContent.className = 'think-content';
        thinkContainer.appendChild(toggleThink);
        thinkContainer.appendChild(thinkContent);
        const answerContent = document.createElement('div');
        answerContent.className = 'answer-content markdown-content';
        botMessageDiv.appendChild(thinkContainer);
        botMessageDiv.appendChild(answerContent);
        reportContainer.appendChild(botMessageDiv);
        reportContainer.scrollTop = reportContainer.scrollHeight;
        toggleThink.addEventListener('click', () => {
            thinkContent.classList.toggle('expanded');
            toggleThink.classList.toggle('expanded');
            toggleThink.innerHTML = thinkContent.classList.contains('expanded') 
                ? '收起AI思考过程 <i class="fas fa-chevron-down"></i>'
                : '展开AI思考过程 <i class="fas fa-chevron-down"></i>';
        });
        return { thinkContainer, thinkContent, answerContent, toggleThink };
    }

    function processAndRenderFinalReport(text, thinkContainer, thinkContent, answerContent) {
        const thinkMatch = text.match(/<think>([\s\S]*)<\/think>/);
        let finalAnswer = text;
        if (thinkMatch && thinkMatch[1].trim()) {
            const thinkText = thinkMatch[1];
            finalAnswer = text.replace(thinkMatch[0], '');
            thinkContainer.style.display = 'block';
            thinkContent.innerHTML = `<pre><code>${thinkText}</code></pre>`;
        } else {
            thinkContainer.style.display = 'none';
        }
        answerContent.innerHTML = marked.parse(finalAnswer);
        reportContainer.scrollTop = reportContainer.scrollHeight;
    }

    function updateUsage(usage) {
        if (usage && usage.used !== undefined && usage.limit !== undefined) {
            usageStats.textContent = `今日用量: ${usage.used} / ${usage.limit}`;
        }
    }

    async function handleSavePdf() {
        const reportToSave = reportContainer.querySelector('.bot-message:last-child');
        if (!reportToSave) {
            alert("没有可保存的报告。");
            return;
        }
        
        savePdfBtn.disabled = true;
        savePdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在生成...';

        try {
            const { jsPDF } = window.jspdf;
            const canvas = await html2canvas(reportToSave, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save("高考志愿AI分析报告.pdf");
        } catch (error) {
            console.error("Failed to save PDF:", error);
            alert("保存PDF失败，请检查控制台错误信息。");
        } finally {
            savePdfBtn.disabled = false;
            savePdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> 保存为PDF';
        }
    }

    // --- Data Gathering ---
    async function getUserInput() {
        const province = document.getElementById('province-select').value;
        const selectedStream = document.querySelector('input[name="stream"]:checked');
        const stream = selectedStream ? selectedStream.value : '';
        const rank = document.getElementById('rank-input').value;
        const options = document.getElementById('options-input').value;
        const dilemma = document.getElementById('dilemma-input').value;
        const scoreType = document.querySelector('input[name="score_type"]:checked').value;
        const scoreLabel = scoreType === 'score' ? '分数' : '位次';
        
        const rawText = `
省份: ${province}
科类: ${stream}
${scoreLabel}: ${rank}
纠结的方案: 
${options}
我的主要困惑: 
${dilemma}
        `.trim();

        return {
            province: province,
            stream: stream,
            rank: rank ? parseInt(rank, 10) : null,
            rawText: rawText,
        };
    }
});