document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let suggestions = [];
    let sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let isAuthenticated = false;

    // --- Element Cache ---
    const submitButton = document.getElementById('submit-button');
    const reportContainer = document.getElementById('report-container');
    const submissionArea = document.querySelector('.submission-area');
    const submissionHeader = document.getElementById('submission-header');
    const rankInput = document.getElementById('rank-input');
    const rankSlider = document.getElementById('rank-slider');
    const rankSliderValue = document.getElementById('rank-slider-value');
    const scoreTypeGroup = document.getElementById('score-type-group');
    const usageStats = document.getElementById('usage-stats');
    const dilemmaInput = document.getElementById('dilemma-input');
    const dilemmaTags = document.querySelector('.dilemma-tags');
    const savePdfBtn = document.getElementById('save-pdf-btn');
    
    // Modal elements
    const modalOverlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    const modalInput = document.getElementById('modal-input');
    const modalSubmit = document.getElementById('modal-submit');
    const modalError = document.getElementById('modal-error');
    const mainContainer = document.querySelector('.container');

    // --- Initial State ---
    initializePage();
    setupEventListeners();
    loadAutocompleteData();

    // --- Initialization ---
    async function initializePage() {
        try {
            const response = await fetch('/api/usage');
            if (!response.ok) throw new Error('Failed to fetch usage stats.');
            
            const data = await response.json();
            updateUsage(data);

            if (data.used >= data.limit) {
                showModalWithMessage("非常抱歉，今日的免费体验名额已被抢完！请您明日再来。", true);
            } else {
                showModal();
            }
        } catch (error) {
            console.error("Failed to fetch initial usage:", error);
            showModalWithMessage("无法连接到服务器，请稍后刷新重试。", true);
        }
    }

    function setupEventListeners() {
        submitButton.addEventListener('click', () => window.handleSubmit());
        modalSubmit.addEventListener('click', handleModalSubmit);
        modalInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleModalSubmit();
        });
        
        const mainStreamGroup = document.getElementById('main-stream-group');
        const newGaokaoOptions = document.getElementById('new-gaokao-options');
        mainStreamGroup.addEventListener('change', (e) => {
            newGaokaoOptions.style.display = e.target.value === '新高考' ? 'block' : 'none';
        });

        const secondChoiceGroup = document.getElementById('second-choice-group');
        secondChoiceGroup.addEventListener('change', (e) => {
            if (secondChoiceGroup.querySelectorAll('input[type="checkbox"]:checked').length > 2) {
                alert('再选科目最多只能选择两项。');
                e.target.checked = false;
            }
        });

        if (rankInput && rankSlider && rankSliderValue) {
            rankSlider.addEventListener('input', (e) => {
                rankInput.value = e.target.value;
                rankSliderValue.textContent = e.target.value;
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
                const isScore = type === 'score';
                rankInput.placeholder = isScore ? "例如: 650" : "例如: 12000";
                rankSlider.min = isScore ? 150 : 1;
                rankSlider.max = isScore ? 750 : 750000;
                rankSlider.step = isScore ? 1 : 100;
                const defaultValue = isScore ? 500 : 100000;
                rankSlider.value = defaultValue;
                rankSliderValue.textContent = defaultValue;
                rankInput.value = defaultValue;
            });
        }

        if (dilemmaTags) {
            dilemmaTags.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-btn')) {
                    dilemmaInput.value += (dilemmaInput.value ? '，' : '') + e.target.textContent;
                }
            });
        }

        if(savePdfBtn) {
            savePdfBtn.addEventListener('click', handleSavePdf);
        }
        setupCollapsibleSections();
    }

    async function loadAutocompleteData() {
        // This function is now obsolete as we removed the dependency.
        // Kept here as a placeholder in case it's needed in the future.
    }

    // --- Modal Logic ---
    function showModal() {
        mainContainer.classList.add('blurred');
        modalOverlay.classList.add('visible');
        modalInput.focus();
    }

    function hideModal() {
        mainContainer.classList.remove('blurred');
        modalOverlay.classList.remove('visible');
    }

    function showModalWithMessage(message, isError = true) {
        modal.innerHTML = `
            <h2 style="color: ${isError ? '#ff4d4d' : '#00aaff'}">${isError ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-info-circle"></i>'} 操作受限</h2>
            <p>${message}</p>
        `;
        showModal();
    }

    async function handleModalSubmit() {
        const code = modalInput.value.trim();
        if (!code) {
            modalError.textContent = '邀请码不能为空。';
            return;
        }

        modalSubmit.disabled = true;
        modalSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        modalError.textContent = '';

        try {
            const response = await fetch('/api/verify_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitationCode: code })
            });
            const data = await response.json();
            if (data.success) {
                isAuthenticated = true;
                hideModal();
            } else {
                modalError.textContent = data.error || '验证失败。';
            }
        } catch (error) {
            modalError.textContent = '验证请求失败，请检查网络。';
        } finally {
            modalSubmit.disabled = false;
            modalSubmit.textContent = '验证';
        }
    }

    // --- Collapsible Sections Logic ---
    function setupCollapsibleSections() {
        const isMobile = () => window.innerWidth <= 1024;
        let firstSubmit = true;

        if (!isMobile()) return;

        submissionArea.classList.remove('collapsed');
        updateCollapseIcons();

        submissionHeader.addEventListener('click', () => {
            if (!isAuthenticated) return;
            submissionArea.classList.toggle('collapsed');
            updateCollapseIcons();
        });
        
        function updateCollapseIcons() {
            const subIcon = submissionHeader.querySelector('.collapse-icon');
            subIcon.className = submissionArea.classList.contains('collapsed')
                ? 'fas fa-chevron-down collapse-icon'
                : 'fas fa-chevron-up collapse-icon';
        }

        window.originalHandleSubmit = handleSubmit;
        window.handleSubmit = async function() {
            if (isMobile() && firstSubmit) {
                submissionArea.classList.add('collapsed');
                updateCollapseIcons();
                firstSubmit = false;
            }
            await window.originalHandleSubmit.apply(this, arguments);
        }
    }

    // --- Main Handler Functions ---
    async function handleSubmit() {
        if (!isAuthenticated) {
            alert("请先通过邀请码验证。");
            return;
        }
        const userInput = await getUserInput();
        if (!userInput) return;

        // --- Create and display user message bubble ---
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'user-message';
        userMessageDiv.innerHTML = `<pre>${userInput.rawText}</pre>`;
        reportContainer.appendChild(userMessageDiv);
        reportContainer.scrollTop = reportContainer.scrollHeight;
        // ---

        const botMessageDiv = createBotMessage();
        const { thinkContainer, thinkContent, answerContent } = botMessageDiv;
        
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.innerHTML = '<i class="fas fa-brain"></i> AI正在深度思考中...';
        savePdfBtn.style.display = 'none';
        answerContent.innerHTML = '<div class="typing-cursor"></div>';

        let mode = 'thinking';
        let thinkAccumulator = '';
        let answerAccumulator = '';

        try {
            const response = await fetch('/api/handler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userInput,
                    sessionId,
                    invitationCode: modalInput.value.trim() // Use the verified code
                })
            });

            if (response.headers.get("Content-Type")?.includes("application/json")) {
                const errorData = await response.json();
                if (errorData.usage) updateUsage(errorData.usage);
                answerContent.innerHTML = `<pre style="color:red;">${errorData.error}</pre>`;
                return;
            }

            if (!response.ok || !response.body) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                let boundary = buffer.indexOf('\n\n');
                while (boundary !== -1) {
                    const message = buffer.substring(0, boundary);
                    buffer = buffer.substring(boundary + 2);

                    if (message.startsWith('event: message')) {
                        const data = message.substring(message.indexOf('data: ') + 6);
                        try {
                            let token = JSON.parse(data);
                            
                            if (mode === 'thinking') {
                                if (token.includes('</think>')) {
                                    const parts = token.split('</think>');
                                    thinkAccumulator += parts[0];
                                    answerAccumulator += parts[1];
                                    mode = 'answering';
                                } else {
                                    thinkAccumulator += token;
                                }
                            } else {
                                answerAccumulator += token;
                            }

                            const finalThink = thinkAccumulator.replace('<think>', '');
                            if (finalThink) {
                                thinkContainer.style.display = 'block';
                                thinkContent.innerHTML = marked.parse(finalThink);
                            }
                            
                            answerContent.innerHTML = marked.parse(answerAccumulator);

                            const cursorTarget = mode === 'thinking' ? thinkContent : answerContent;
                            document.querySelectorAll('.typing-cursor').forEach(c => c.remove());
                            cursorTarget.innerHTML += '<span class="typing-cursor"></span>';
                            
                            reportContainer.scrollTop = reportContainer.scrollHeight;

                        } catch (e) { console.error("Failed to parse token:", data); }
                    } else if (message.startsWith('event: usage')) {
                        const data = message.substring(message.indexOf('data: ') + 6);
                        try {
                            updateUsage(JSON.parse(data));
                        } catch (e) { console.error("Failed to parse usage data:", data); }
                    } else if (message.startsWith('event: end')) {
                        document.querySelectorAll('.typing-cursor').forEach(c => c.remove());
                        savePdfBtn.style.display = 'inline-block';
                        return;
                    } else if (message.startsWith('event: error')) {
                        const data = message.substring(message.indexOf('data: ') + 6);
                        try {
                            answerContent.innerHTML = `<pre style="color:red;">${JSON.stringify(JSON.parse(data), null, 2)}</pre>`;
                        } catch(e) {
                            answerContent.innerHTML = `<pre style="color:red;">${data}</pre>`;
                        }
                        return;
                    }
                    boundary = buffer.indexOf('\n\n');
                }
            }

        } catch(error) {
            console.error("Submit/Fetch Error:", error);
            answerContent.innerHTML = `<pre style="color:red;">网络请求失败: ${error.message}</pre>`;
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> 生成分析报告';
            document.querySelectorAll('.typing-cursor').forEach(c => c.remove());
        }
    }

    function createBotMessage() {
        const botMessageDiv = document.createElement('div');
        // The 'bot-message' class now just provides margin and full-width behavior
        botMessageDiv.className = 'bot-message';
        
        const thinkContainer = document.createElement('div');
        thinkContainer.className = 'think-container';
        thinkContainer.style.display = 'none';
        
        const toggleThink = document.createElement('div');
        toggleThink.className = 'toggle-think';
        toggleThink.innerHTML = '展开AI思考过程 <i class="fas fa-chevron-down"></i>';
        
        const thinkContent = document.createElement('div');
        thinkContent.className = 'think-content markdown-content';
        
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
            const icon = toggleThink.querySelector('.fas');
            if (thinkContent.classList.contains('expanded')) {
                toggleThink.innerHTML = '收起AI思考过程 <i class="fas fa-chevron-up"></i>';
            } else {
                toggleThink.innerHTML = '展开AI思考过程 <i class="fas fa-chevron-down"></i>';
            }
        });
        
        return { thinkContainer, thinkContent, answerContent };
    }

    function updateUsage(usage) {
        if (usage && usage.used !== undefined && usage.limit !== undefined) {
            usageStats.textContent = `今日用量: ${usage.used} / ${usage.limit}`;
        }
    }

    async function handleSavePdf() {
        const reportToSave = reportContainer.querySelector('.bot-message:last-child');
        const userBubbleToSave = reportContainer.querySelector('.user-message:last-child');

        if (!reportToSave) {
            alert("没有可保存的报告。");
            return;
        }
        
        savePdfBtn.disabled = true;
        savePdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在生成...';

        try {
            const { jsPDF } = window.jspdf;
            
            // Fetch the entire stylesheet content
            const styleSheetText = await fetch('style.css').then(res => res.text());

            // Create a container for PDF content
            const pdfContent = document.createElement('div');
            pdfContent.style.cssText = `
                width: 800px;
                background: white;
                color: black;
                padding: 20px;
            `;

            // Inject all styles directly into the container
            const styleElement = document.createElement('style');
            styleElement.innerHTML = styleSheetText;
            pdfContent.appendChild(styleElement);

            // Add user input bubble if it exists
            if (userBubbleToSave) {
                const userInputHeader = document.createElement('h3');
                userInputHeader.textContent = '我的输入';
                pdfContent.appendChild(userInputHeader);
                pdfContent.appendChild(userBubbleToSave.cloneNode(true));
            }

            // Add AI report content
            const reportHeader = document.createElement('h3');
            reportHeader.textContent = 'AI分析报告';
            reportHeader.style.marginTop = '20px';
            pdfContent.appendChild(reportHeader);
            pdfContent.appendChild(reportToSave.cloneNode(true));
            
            // Position the container off-screen before appending to the body
            pdfContent.style.position = 'absolute';
            pdfContent.style.left = '-9999px';
            pdfContent.style.top = '0';
            document.body.appendChild(pdfContent);

            const canvas = await html2canvas(pdfContent, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            document.body.removeChild(pdfContent); // Clean up

            // Generate and save PDF
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

    async function getUserInput() {
        const province = document.getElementById('province-select').value;
        const selectedStream = document.querySelector('input[name="stream"]:checked').value;
        const rank = document.getElementById('rank-input').value;
        const options = document.getElementById('options-input').value.trim();
        const dilemma = document.getElementById('dilemma-input').value.trim();
        const scoreType = document.querySelector('input[name="score_type"]:checked').value;
        const scoreLabel = scoreType === 'score' ? '分数' : '位次';

        if (!options && !dilemma) {
            alert('“纠结的方案”和“主要困惑”不能同时为空，请至少填写一项。');
            return null;
        }

        let streamText = selectedStream;
        if (selectedStream === '新高考') {
            const firstChoice = document.querySelector('input[name="first-choice"]:checked')?.value;
            const secondChoices = Array.from(document.querySelectorAll('input[name="second-choice"]:checked')).map(cb => cb.value);
            
            if (!firstChoice || secondChoices.length !== 2) {
                alert('请完成新高考的选科（1门首选+2门再选）。');
                return null;
            }
            streamText = `新高考 (3+1+2): ${firstChoice} + ${secondChoices.join(' + ')}`;
        }
        
        const rawText = `
省份: ${province}
科类: ${streamText}
${scoreLabel}: ${rank}
纠结的方案:
${options || '未填写'}
我的主要困惑:
${dilemma || '未填写'}
        `.trim();

        return {
            province: province,
            stream: streamText,
            rank: rank ? parseInt(rank, 10) : null,
            rawText: rawText,
        };
    }

    window.handleSubmit = handleSubmit;
});