# 🎀 LLMchat - Your AI Desktop Companion

![App Screenshot](./assets/screenshot.png)

A delightful cross-platform desktop chat application powered by AI, built with 💖 using Electron, Flask, and the magic of LLMs!

## ✨ Features

- 🧠 **AI-Powered Conversations** (GPT-4o, GPT-3.5, Claude, and more!)
- 🌐 **Web Search Integration** for enhanced responses
- 🔄 **Response Regeneration** with version history
- 🎨 **Sleek Glassmorphism UI** with dark mode
- 📚 **Session History** persistence
- ⚡ **Real-time Streaming** responses
- 🖱️ **Context Menu Actions** (Copy/Regenerate)
- 📱 **Responsive Design** for all screen sizes
- 🔧 **Model Configuration** on the fly

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+
- npm

### Installation
1. Clone the repository
```bash
git clone https://github.com/NacreousDawn596/LLMchat.git
cd LLMchat
```

2. Install Node.js and PIP dependencies
```bash
npm install
pip install --user -r requirements.txt
```

3. Start the application
```bash
npm start
```

## 🌈 Usage
- 💬 Type your message and press Enter
- 🔍 Toggle web search with the switch
- ⚙️ Select different AI models from the dropdown


## 🧩 Tech Stack
### Frontend
> 🎀 Electron | 🎨 Tailwind CSS | 💫 JavaScript

### Backend
> 🐍 Flask | 🧠 gpt4free

### Utilities
> 🔌 IPC Communication | 📦 Process Management | 🗃️ Session Storage

## 📂 Project Structure
```bash
LLMchat/
├── main.py            # Flask backend
├── app.js             # Electron main process
├── preload.js         # Electron preload script
├── main.js            # Renderer process
├── style.css          # Main styles
├── index.html         # Main window
└── requirements.txt   # Python dependencies
```

## 🤝 Contributing
**We 💖 contributions! Here's how to help:**
-    Fork the project

-    Create your feature branch (git checkout -b feature/AmazingFeature)

-    Commit your changes (git commit -m 'Add some AmazingFeature')

-    Push to the branch (git push origin feature/AmazingFeature)

-    Open a Pull Request

## 📜 License
Distributed under the MIT License. See LICENSE for more information.

## 🌟 Acknowledgments
- gpt4free for the AI magic
- Electron community for awesome desktop app framework
- Flask for simple yet powerful backend
- You, for being awesome! 😊

<hr>
Made with ✨🦄🔮 by NacreousDawn596 - Because every desktop deserves some AI magic!