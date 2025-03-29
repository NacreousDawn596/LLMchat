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
            closeButton: document.querySelector('#close-btn')
        };

        this.elements.closeButton.addEventListener('click', () => window.electronAPI.closeWindow());

        this.init();
    }

    async loadHistory() {
        try {
            const response = await window.electronAPI.getHistory(this.sessionId);
            this.state.history = response.messages || [];
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load history:', error);
            this.appendSystemMessage('Could not load chat history');
        }
    }

    renderMessages() {
        this.elements.chatMessages.innerHTML = '';

        this.state.history.forEach(msg => {
            this.appendMessage(
                msg.content,
                msg.role === 'user' ? 'user' : 'ai',
                msg.web_search || false
            );
        });

        this.scrollToBottom();
    }

    async init() {
        this.setupEventListeners();
        await this.loadHistory();
        this.renderMessages();
    }

    setupEventListeners() {
        this.elements.sendButton.addEventListener('click', () => this.handleSubmit());
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
        if (!message || this.state.isStreaming) return;

        this.state.isStreaming = true;
        this.elements.chatInput.value = '';
        this.disableInput();

        try {
            this.appendMessage(message, 'user');
            const response = await this.streamResponse(message);
            this.appendMessage(response, 'ai', this.state.webSearch);
        } catch (error) {
            this.appendMessage('Error: Failed to get response', 'ai');
        } finally {
            this.state.isStreaming = false;
            this.enableInput();
        }
    }

    async streamResponse(message) {
        const container = this.createMessageContainer('ai');
        let fullResponse = '';

        try {
            const responseText = await window.electronAPI.sendQuery({
                query: message,
                session_id: this.sessionId
            });

            const chunks = responseText.split('\n\n');
            for (const chunk of chunks) {
                if (chunk.startsWith('data: ')) {
                    const content = chunk.slice(6).trim();
                    fullResponse += content;
                    container.innerHTML = fullResponse;
                    this.scrollToBottom();
                }
            }

            return fullResponse;
        } catch (error) {
            container.textContent += '\n\n[Response interrupted]';
            throw error;
        }
    }

    appendMessage(content, type, isWebSearch = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        if (isWebSearch) {
            messageDiv.innerHTML = `${content.replace(/\n/g, '<br>')}
              <span class="web-search-badge">Web</span>`;
        } else {
            messageDiv.innerHTML = content.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
        }

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