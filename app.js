const { app, BrowserWindow, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

let flaskProcess = null
let mainWindow = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 800,
        frame: false, // Remove default window frame
        titleBarStyle: 'hidden', // For macOS
        titleBarStyle: 'hiddenInset',
        transparent: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    })

    mainWindow.loadURL('http://localhost:5000/')
}

app.whenReady().then(async () => {
    flaskProcess = spawn('python', ['./main.py']);    
    await waitForServer();    
    createWindow();    
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-ready');
    });
});

ipcMain.handle('chat', async (event, query) => {
    try {
        const response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(query)
        });
        
        return await response.text();
    } catch (error) {
        console.error('Chat error:', error);
        return '';
    }
});

function waitForServer() {
    return new Promise((resolve) => {
        const checkServer = async () => {
            try {
                const response = await fetch('http://localhost:5000/health');
                const data = await response.json();
                if (data.status === 'ready') {
                    resolve();
                } else {
                    setTimeout(checkServer, 200);
                }
            } catch (error) {
                setTimeout(checkServer, 200);
            }
        };
        checkServer();
    });
}

// ipcMain.handle('set-model', async (event, model) => {
//     const response = await fetch('http://localhost:5000/set_model', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ model })
//     })
//     return await response.json()
// })

// ipcMain.handle('get-current-model', async () => {
//     const response = await fetch('http://localhost:5000/current_model')
//     return await response.json()
// })

ipcMain.on('close-window', () => {
    mainWindow.close()
})

ipcMain.handle('set-config', async (event, config) => {
    const response = await fetch('http://localhost:5000/set_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    return await response.json();
});

ipcMain.handle('get-config', async (event, sessionId) => {
    const response = await fetch(`http://localhost:5000/history?session_id=${sessionId}`);
    return await response.json();
});

ipcMain.handle('get-history', async (event, sessionId) => {
    const response = await fetch(`http://localhost:5000/history?session_id=${sessionId}`);
    return await response.json();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        flaskProcess.kill()
        app.quit()
    }
})