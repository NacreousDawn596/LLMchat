const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    sendQuery: (data) => ipcRenderer.invoke('chat', data),
    setConfig: (config) => ipcRenderer.invoke('set-config', config),
    getHistory: (sessionId) => ipcRenderer.invoke('get-history', sessionId),
    getConfig: () => ipcRenderer.invoke('get-config'),
    onServerReady: (callback) => ipcRenderer.on('server-ready', callback),
    closeWindow: () => ipcRenderer.send('close-window'),
});


window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})