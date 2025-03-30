class ChatUI {
    constructor() {
        this.sessionId = `session_${Date.now()}`;
        this.state = {
            model: 'gpt-4o',
            webSearch: false,
            isStreaming: false,
            history: []
        };

        this.elements = {
            chatInput: document.querySelector('.chat-input'),
            sendButton: document.querySelector('.send-button'),
            chatMessages: document.querySelector('.chat-messages'),
            modelSelect: document.querySelector('#model-select'),
            webSearchToggle: document.querySelector('#web-search-toggle'),
            statusIndicator: document.querySelector('#config-status'),
            closeButton: document.querySelector('#close-btn'),
            fileInput: document.querySelector('#file-input'),
            imagePreview: document.querySelector('#image-preview'),
        };

        this.elements.closeButton.addEventListener('click', () => window.electronAPI.closeWindow());

        this.init();
    }

    async loadHistory() {
        try {
            const response = await window.electronAPI.getHistory(this.sessionId);
            this.state.history = response.messages || [];
            this.state.history.forEach(msg => {
                if (msg.images) {
                    msg.images = msg.images.map(img => {
                        return {
                            name: img,
                            persisted: true
                        };
                    });
                }
            });
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.appendSystemMessage('Could not load chat history');
        }
    }

    renderMessages() {
        this.elements.chatMessages.innerHTML = '';

        this.state.history.forEach(msg => {
            const images = msg.images?.map(img => ({
                name: img,
                persisted: true
            })) || [];

            this.appendMessage(
                msg.content,
                msg.role === 'user' ? 'user' : 'ai',
                msg.web_search || false,
                images 
            );
        });

        this.scrollToBottom();
    }

    async init() {
        this.setupEventListeners();
        await this.loadHistory();
        this.renderMessages();
    }

    handleFileUpload(e) {
        const files = Array.from(e.target.files);
        this.state.attachedImages = files;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.createImagePreview(event.target.result, {
                    name: file.name,
                    persisted: false
                });
            };
            reader.readAsDataURL(file);
        });
    }

    createImagePreview(src, fileData) {
        const container = document.createElement('div');
        container.className = 'image-preview';

        const img = document.createElement('img');
        if (fileData?.persisted) {
            img.src = `/assets/temp_uploads/${fileData.name}?t=${Date.now()}`;
        } else {
            img.src = src;
            if (fileData) {
                img.dataset.filename = fileData.name;
            }
        }

        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
            container.remove();
            this.state.attachedImages = this.state.attachedImages.filter(
                f => f.name !== img.dataset.filename
            );
        };

        container.appendChild(img);
        container.appendChild(removeBtn);
        this.elements.imagePreview.appendChild(container);
    }


    setupEventListeners() {
        this.elements.sendButton.addEventListener('click', () => this.handleSubmit());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) this.handleSubmit();
        });

        this.elements.modelSelect.addEventListener('change', () => this.updateConfig());
        this.elements.webSearchToggle.addEventListener('change', () => this.updateConfig());
    }

    async updateConfig() {
        this.state.model = this.elements.modelSelect.value;
        this.state.webSearch = this.elements.webSearchToggle.checked;

        try {
            await window.electronAPI.setConfig({
                model: this.state.model,
                web_search: this.state.webSearch,
                session_id: this.sessionId
            });
            this.updateStatusIndicator();
        } catch (error) {
            console.error('Config update failed:', error);
        }
    }

    updateStatusIndicator() {
        const statusText = `Web Search: ${this.state.webSearch ? 'On' : 'Off'} | Model: ${this.state.model}`;
        this.elements.statusIndicator.textContent = statusText;
    }

    async handleSubmit() {
        const message = this.elements.chatInput.value.trim();
        if ((!message && !this.state.attachedImages?.length) || this.state.isStreaming) return;

        if (message.startsWith('/imagine ')) {
            const prompt = message.slice(9).trim();
            if (!prompt) return;

            this.state.isStreaming = true;
            this.elements.chatInput.value = '';
            this.disableInput();

            try {
                this.appendMessage(`/imagine ${prompt}`, 'user');

                const response = await fetch(`http://localhost:${PORT}/generate_image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        prompt: prompt
                    })
                });

                if (!response.ok) throw new Error('Image generation failed');
                const { image_url } = await response.json();

                const filename = image_url.split('/').pop();

                this.appendMessage(
                    'Generated image:',
                    'ai',
                    false,
                    [{ name: filename, persisted: true }]  // Note the persisted flag
                );

            } catch (error) {
                this.appendMessage('Error generating image. ' + error.message, 'ai');
            } finally {
                this.state.isStreaming = false;
                this.enableInput();
            }
        } else {

            const formData = new FormData();
            formData.append('query', message);
            formData.append('session_id', this.sessionId);

            this.state.attachedImages?.forEach((file, index) => {
                formData.append(`images`, file, file.name);
            });

            this.state.isStreaming = true;
            this.elements.chatInput.value = '';
            this.disableInput();

            try {
                this.appendMessage(message, 'user', false, this.state.attachedImages);
                const response = await this.streamResponse(message, formData);
                this.appendMessage(response, 'ai', this.state.webSearch);
            } catch (error) {
                this.appendMessage('Error: Failed to get response', 'ai');
            } finally {
                this.state.attachedImages = [];
                this.elements.imagePreview.innerHTML = '';
                this.state.isStreaming = false;
                this.enableInput();
            }
        }
    }

    async streamResponse(message, formData) {
        const container = this.createMessageContainer('ai');
        let fullResponse = '';

        try {
            const response = await fetch(`http://localhost:${PORT}/chat`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.error) {
                                container.textContent += `\n[ERROR: ${data.error}]`;
                            } else if (data.content) {
                                fullResponse += data.content;
                                container.textContent = fullResponse;
                            }
                            this.scrollToBottom();
                        } catch (e) {
                            console.error('Parsing error:', e);
                        }
                    }
                }
            }

            return fullResponse;
        } catch (error) {
            console.error('Stream error:', error);
            container.textContent = 'Error: Failed to get response. Check server connection.';
            throw error;
        } finally {
            this.scrollToBottom();
        }
    }

    appendMessage(content, type, isWebSearch = false, images = []) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        if (images && images.length > 0) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-grid mt-2';
            images.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.className = 'chat-image';
                if (img instanceof File) {
                    imgEl.src = URL.createObjectURL(img);
                    imgEl.dataset.filename = img.name;
                } else if (img.persisted) {
                    imgEl.src = `/assets/temp_uploads/${img.name}?t=${Date.now()}`;
                    imgEl.dataset.filename = img.name;
                }
                imageContainer.appendChild(imgEl);
            });
            messageDiv.appendChild(imageContainer);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const markedContent = marked.parse(content);
        const cleanContent = DOMPurify.sanitize(markedContent);

        if (isWebSearch) {
            contentDiv.innerHTML = `${cleanContent} 
            <span class="web-search-badge">Web</span>`;
        } else {
            contentDiv.innerHTML = cleanContent;
        }

        contentDiv.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });

        messageDiv.appendChild(contentDiv);
        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    appendSystemMessage(content) {
        const systemDiv = document.createElement('div');
        systemDiv.className = 'message system-message text-center text-gray-400 text-sm my-2';
        systemDiv.textContent = content;
        this.elements.chatMessages.appendChild(systemDiv);
        this.scrollToBottom();
    }

    createMessageContainer(type) {
        const div = document.createElement('div');
        div.className = `message ${type}-message`;
        return div;
    }

    disableInput() {
        this.elements.chatInput.disabled = true;
        this.elements.sendButton.disabled = true;
        this.elements.modelSelect.disabled = true;
    }

    enableInput() {
        this.elements.chatInput.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.modelSelect.disabled = false;
        this.elements.chatInput.focus();
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
});