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
    
    // Follow-up elements
    const followUpContainer = document.getElementById('follow-up-container');
    const followUpInput = document.getElementById('follow-up-input');
    const followUpSendBtn = document.getElementById('follow-up-send-btn');
    const followUpTooltip = document.getElementById('follow-up-tooltip');

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
        if(followUpSendBtn) {
            followUpSendBtn.addEventListener('click', handleFollowUpSubmit);
            followUpInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') handleFollowUpSubmit();
            });
            // Any click on the document should hide the tooltip
            document.addEventListener('click', () => {
                if (followUpTooltip.classList.contains('visible')) {
                    followUpTooltip.classList.remove('visible');
                }
            }, { once: true }); // The listener will be removed after being invoked once
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
        if (!isMobile()) {
            // Ensure handleSubmit is globally accessible on desktop too
            window.handleSubmit = handleSubmit;
            return;
        }

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

        // Wrap the original handleSubmit to add mobile-specific functionality
        const originalHandleSubmit = handleSubmit;
        window.handleSubmit = async function() {
            if (isMobile()) {
                submissionArea.classList.add('collapsed');
                updateCollapseIcons();
            }
            // Use .apply to pass arguments correctly to the original function
            await originalHandleSubmit.apply(this, arguments);
        }
    }

    // --- Main Handler Functions ---
    const autoCollapseTimers = new Map();

    function debounce(func, wait) {
        let timeout;
        function executedFunction(...args) {
            const context = this;
            const later = () => {
                timeout = null;
                func.apply(context, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            executedFunction._timeoutId = timeout;
        };
        executedFunction._timeoutId = null;
        return executedFunction;
    }

    function createBotMessage(isInitialSetup = false) {
        const msgId = `bot-msg-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
        const botMessageDiv = document.createElement("div");
        botMessageDiv.className = "bot-message";
        botMessageDiv.id = msgId;

        const contentArea = document.createElement('div');
        contentArea.className = 'message-content-area';

        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-indicator-container';
        loadingContainer.innerHTML = `<div class="loading-indicator"><i class="fas fa-spinner"></i><span></span></div>`;
        
        if (isInitialSetup) {
            loadingContainer.style.display = 'none';
        }
        contentArea.appendChild(loadingContainer);

        const thinkContainer = document.createElement('div');
        thinkContainer.className = 'think-container';
        thinkContainer.style.display = 'none';

        const preview = document.createElement('div');
        preview.className = 'think-preview';
        preview.innerHTML = `<i class="fas fa-brain"></i> 进行深度思考 <span class="think-duration"></span>`;
        thinkContainer.appendChild(preview);

        const toggle = document.createElement('div');
        toggle.className = 'toggle-think';
        toggle.innerHTML = `展开完整思考内容 <i class="fas fa-chevron-down"></i>`;
        thinkContainer.appendChild(toggle);

        const fullThinkWrapper = document.createElement('div');
        fullThinkWrapper.className = 'think-content-wrapper';
        const preElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.textContent = '';
        preElement.appendChild(codeElement);
        fullThinkWrapper.appendChild(preElement);
        thinkContainer.appendChild(fullThinkWrapper);
        contentArea.appendChild(thinkContainer);

        const answerContent = document.createElement('div');
        answerContent.className = 'answer-content markdown-content';
        contentArea.appendChild(answerContent);

        botMessageDiv.appendChild(contentArea);
        reportContainer.appendChild(botMessageDiv);
        reportContainer.scrollTop = reportContainer.scrollHeight;
        
        toggle.onclick = () => {
            if (autoCollapseTimers.has(msgId)) {
                clearTimeout(autoCollapseTimers.get(msgId));
                autoCollapseTimers.delete(msgId);
            }
            fullThinkWrapper.classList.toggle('expanded');
            toggle.classList.toggle('expanded');
            
            if (fullThinkWrapper.classList.contains('expanded')) {
                toggle.innerHTML = `收起思考内容 <i class="fas fa-chevron-up"></i>`;
            } else {
                toggle.innerHTML = `展开完整思考内容 <i class="fas fa-chevron-down"></i>`;
            }
        };

        return {
            botMessageDiv,
            loadingContainer,
            loadingIndicatorInner: loadingContainer.querySelector('.loading-indicator'),
            loadingTextSpan: loadingContainer.querySelector('.loading-indicator span'),
            thinkContainer,
            thinkCodeElement: codeElement,
            answerContent,
            previewElement: preview,
            toggleElement: toggle,
            thinkWrapperElement: fullThinkWrapper,
            msgId
        };
    }

    async function handleSubmit() {
        const userInput = await getUserInput();
        if (!userInput) return;
        
        // --- Mobile-specific UI change: Collapse submission area on submit ---
        const isMobile = () => window.innerWidth <= 1024;
        if (isMobile() && !submissionArea.classList.contains('collapsed')) {
            submissionArea.classList.add('collapsed');
            const subIcon = submissionHeader.querySelector('.collapse-icon');
            if (subIcon) {
                subIcon.className = 'fas fa-chevron-down collapse-icon';
            }
        }
        // ---

        await sendRequest(userInput);
    }

    async function handleFollowUpSubmit() {
        const followUpText = followUpInput.value.trim();
        if (!followUpText) return;

        const userInput = {
            rawText: followUpText,
            isFollowUp: true // Add a flag to indicate a follow-up question
        };
        
        followUpInput.value = '';
        await sendRequest(userInput);
    }

    async function sendRequest(userInput) {
        if (!isAuthenticated) {
            alert("请先通过邀请码验证。");
            return;
        }

        // --- Create and display user message bubble ---
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'user-message';
        userMessageDiv.innerHTML = `<pre>${userInput.rawText}</pre>`;
        reportContainer.appendChild(userMessageDiv);
        reportContainer.scrollTop = reportContainer.scrollHeight;
        // ---

        const uiRefs = createBotMessage();
        
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        followUpSendBtn.disabled = true;
        savePdfBtn.style.display = 'none';

        let streamHasStartedVisualOutput = false;
        const loadingPhases = ["发送请求中...", "信息搜寻中...", "AI正在深度思考中..."];
        let currentPhaseIndex = 0;
        let loadingPhaseTimeoutId = null;

        async function runLoadingPhases() {
            if (streamHasStartedVisualOutput || currentPhaseIndex >= loadingPhases.length) {
                if (uiRefs.loadingContainer.classList.contains('active')) {
                    uiRefs.loadingIndicatorInner.classList.remove('visible');
                    await new Promise(resolve => setTimeout(() => {
                        if (uiRefs.loadingContainer.classList.contains('active')) {
                            uiRefs.loadingContainer.classList.remove('active');
                        }
                        resolve();
                    }, 300));
                }
                return;
            }

            if (uiRefs.loadingIndicatorInner.classList.contains('visible')) {
                uiRefs.loadingIndicatorInner.classList.remove('visible');
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            if (streamHasStartedVisualOutput) {
                if (uiRefs.loadingContainer.classList.contains('active')) {
                    uiRefs.loadingContainer.classList.remove('active');
                }
                return;
            }
            
            uiRefs.loadingTextSpan.textContent = loadingPhases[currentPhaseIndex];
            uiRefs.loadingContainer.classList.add('active');
            uiRefs.loadingIndicatorInner.classList.add('visible');
            reportContainer.scrollTop = reportContainer.scrollHeight;

            if (currentPhaseIndex === loadingPhases.length - 1) {
                return;
            }

            currentPhaseIndex++;
            if (loadingPhaseTimeoutId) clearTimeout(loadingPhaseTimeoutId);
            loadingPhaseTimeoutId = setTimeout(runLoadingPhases, 1500);
        }
        runLoadingPhases();

        let currentThinkBuffer = "";
        let currentAnswerBuffer = "";
        let inThinkBlock = true;
        let thinkContentStarted = false;
        let accumulatedThoughtForDuration = "";
        const thinkStartTag = "<think>";
        const thinkEndTag = "</think>";
        let thinkStartTime = null;
        let firstThoughtChunkProcessed = false;
        let firstAnswerChunkReceived = false;

        const debouncedRenderAnswerMarkdown = debounce(() => {
            const currentScroll = reportContainer.scrollTop;
            const isAtBottom = reportContainer.scrollHeight - reportContainer.clientHeight <= currentScroll + 10;
    
            // Render the current answer buffer with a cursor
            uiRefs.answerContent.innerHTML = marked.parse(currentAnswerBuffer.trim() + "▍");
            
            if(isAtBottom) {
                reportContainer.scrollTop = reportContainer.scrollHeight;
            }
        }, 150);

        try {
            const response = await fetch('/api/handler', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userInput,
                    sessionId,
                    invitationCode: modalInput.value.trim()
                })
            });

            if (!response.ok || !response.body) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.usage) updateUsage(errorData.usage);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
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
                            let chunk = JSON.parse(data);
                            let chunkHadDisplayableContent = false;

                            if (inThinkBlock) {
                                if (!thinkContentStarted) {
                                    const startTagIndex = chunk.indexOf(thinkStartTag);
                                    if (startTagIndex !== -1) {
                                        chunk = chunk.substring(startTagIndex + thinkStartTag.length);
                                        thinkContentStarted = true;
                                        thinkStartTime = Date.now();
                                        uiRefs.thinkContainer.style.display = 'block';
                                    }
                                }

                                if (inThinkBlock && thinkContentStarted) {
                                    const endTagIndex = chunk.indexOf(thinkEndTag);
                                    if (endTagIndex !== -1) {
                                        const thoughtPart = chunk.substring(0, endTagIndex);
                                        currentThinkBuffer += thoughtPart;
                                        accumulatedThoughtForDuration += thoughtPart;
                                        if (thoughtPart.trim().length > 0) chunkHadDisplayableContent = true;

                                        const answerPart = chunk.substring(endTagIndex + thinkEndTag.length);
                                        currentAnswerBuffer += answerPart;
                                        inThinkBlock = false;
                                        if (answerPart.trim().length > 0) {
                                            firstAnswerChunkReceived = true;
                                            chunkHadDisplayableContent = true;
                                        }
                                        
                                        // Smart collapse: wait 1s after think is finished
                                        if (autoCollapseTimers.has(uiRefs.msgId)) clearTimeout(autoCollapseTimers.get(uiRefs.msgId));
                                        const timerId = setTimeout(() => {
                                            if (uiRefs.thinkWrapperElement.classList.contains('expanded')) {
                                                uiRefs.thinkWrapperElement.classList.remove('expanded');
                                                uiRefs.toggleElement.classList.remove('expanded');
                                                uiRefs.toggleElement.innerHTML = `展开完整思考内容 <i class="fas fa-chevron-down"></i>`;
                                            }
                                            autoCollapseTimers.delete(uiRefs.msgId);
                                        }, 1000);
                                        autoCollapseTimers.set(uiRefs.msgId, timerId);
                                    } else {
                                        currentThinkBuffer += chunk;
                                        accumulatedThoughtForDuration += chunk;
                                        if (chunk.trim().length > 0) chunkHadDisplayableContent = true;
                                    }
                                } else if (!inThinkBlock) {
                                    currentAnswerBuffer += chunk;
                                    if (chunk.trim().length > 0) {
                                        if (!firstAnswerChunkReceived) firstAnswerChunkReceived = true;
                                        chunkHadDisplayableContent = true;
                                    }
                                }
                            } else {
                                currentAnswerBuffer += chunk;
                                if (chunk.trim().length > 0) {
                                    if (!firstAnswerChunkReceived) firstAnswerChunkReceived = true;
                                    chunkHadDisplayableContent = true;
                                }
                            }

                            if (chunkHadDisplayableContent && !streamHasStartedVisualOutput) {
                                streamHasStartedVisualOutput = true;
                                if (loadingPhaseTimeoutId) clearTimeout(loadingPhaseTimeoutId);
                                await runLoadingPhases();
                            }

                            if (thinkContentStarted && currentThinkBuffer.trim().length > 0 && !firstThoughtChunkProcessed) {
                                firstThoughtChunkProcessed = true;
                                uiRefs.thinkWrapperElement.classList.add('expanded');
                                uiRefs.toggleElement.classList.add('expanded');
                                uiRefs.toggleElement.innerHTML = `收起思考内容 <i class="fas fa-chevron-up"></i>`;
                            }

                            if (inThinkBlock && thinkContentStarted) {
                                uiRefs.thinkCodeElement.textContent = currentThinkBuffer + (currentThinkBuffer.length > 0 ? "▍" : "");
                                if (uiRefs.thinkWrapperElement.classList.contains('expanded')) {
                                    uiRefs.thinkWrapperElement.scrollTop = uiRefs.thinkWrapperElement.scrollHeight;
                                }
                            } else if (currentThinkBuffer.length > 0 && uiRefs.thinkCodeElement.textContent.endsWith("▍")) {
                                uiRefs.thinkCodeElement.textContent = currentThinkBuffer.trim();
                            }

                            if (!inThinkBlock) {
                                if (!firstAnswerChunkReceived && currentAnswerBuffer.trim().length > 0) {
                                    firstAnswerChunkReceived = true;
                                }
                                // First, update the raw text immediately for responsiveness
                                uiRefs.answerContent.innerText = currentAnswerBuffer + "▍";
                                // Then, trigger the debounced markdown rendering
                                if (firstAnswerChunkReceived) {
                                    debouncedRenderAnswerMarkdown();
                                }
                            }
                            
                            reportContainer.scrollTop = reportContainer.scrollHeight;

                        } catch (e) { console.error("Failed to parse token:", data, e); }
                    } else if (message.startsWith('event: usage')) {
                        const data = message.substring(message.indexOf('data: ') + 6);
                        try { updateUsage(JSON.parse(data)); } catch (e) { console.error("Failed to parse usage data:", data); }
                    } else if (message.startsWith('event: end')) {
                        if (loadingPhaseTimeoutId) clearTimeout(loadingPhaseTimeoutId);
                        streamHasStartedVisualOutput = true;
                        await runLoadingPhases();

                        uiRefs.thinkCodeElement.textContent = currentThinkBuffer.trim();
                        
                        const debouncedFunc = debouncedRenderAnswerMarkdown;
                        if (debouncedFunc && debouncedFunc._timeoutId) {
                             clearTimeout(debouncedFunc._timeoutId);
                        }
                        uiRefs.answerContent.innerHTML = marked.parse(currentAnswerBuffer.trim());
                        
                        if (accumulatedThoughtForDuration.trim() && thinkStartTime) {
                            const thinkDuration = (Date.now() - thinkStartTime) / 1000;
                            const durationSpan = uiRefs.previewElement.querySelector('.think-duration');
                            if (durationSpan) durationSpan.textContent = `(耗时: ${thinkDuration.toFixed(1)}s)`;
                        } else { uiRefs.thinkContainer.style.display = 'none'; }
                        
                        if (!currentAnswerBuffer.trim() && !currentThinkBuffer.trim()){
                            uiRefs.answerContent.innerHTML = marked.parse("未收到有效回复。");
                        }
                        
                        savePdfBtn.style.display = 'inline-block';
                        
                        // Show follow-up bar for the first time after a 1-second delay
                        setTimeout(() => {
                            if (!followUpContainer.classList.contains('visible')) {
                                // Adjust padding to make space for the follow-up bar
                                const followUpHeight = followUpContainer.offsetHeight;
                                reportContainer.style.paddingBottom = `${followUpHeight}px`;
                                
                                // Use scrollIntoView for more reliable scrolling on all devices
                                const lastMessage = reportContainer.querySelector('.bot-message:last-child, .user-message:last-child');
                                if (lastMessage) {
                                    lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                } else {
                                    reportContainer.scrollTop = reportContainer.scrollHeight;
                                }

                                followUpContainer.classList.add('visible');
                                followUpTooltip.classList.add('visible');
                                
                                // Hide the tooltip after 2 seconds
                                setTimeout(() => {
                                    followUpTooltip.classList.remove('visible');
                                }, 2000);
                            }
                        }, 1000); // 1-second delay before showing the bar
                        return;
                    } else if (message.startsWith('event: error')) {
                        const data = message.substring(message.indexOf('data: ') + 6);
                        throw new Error(`Stream error: ${data}`);
                    }
                    boundary = buffer.indexOf('\n\n');
                }
            }
        } catch(error) {
            console.error("Submit/Fetch Error:", error);
            if (loadingPhaseTimeoutId) clearTimeout(loadingPhaseTimeoutId);
            streamHasStartedVisualOutput = true;
            await runLoadingPhases();
            uiRefs.answerContent.innerHTML = `<pre style="color:red;">请求失败: ${error.message}</pre>`;
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            followUpSendBtn.disabled = false;
        }
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
                background: #F4FAFA;
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
                backgroundColor: null
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