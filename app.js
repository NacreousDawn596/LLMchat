const { app, BrowserWindow, ipcMain, screen } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const PORT = Math.floor(10000 + Math.random() * 90000);

let flaskProcess = null
let mainWindow = null

function createWindow() {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const { bounds } = primaryDisplay;
    
    const windowWidth = Math.floor(width / 4); 
    const windowHeight = Math.floor(height * 0.8); 
    
    const xPosition = bounds.x + (bounds.width - windowWidth); 
    const yPosition = process.platform === 'win32' ? bounds.y + (height - windowHeight) : bounds.y + (bounds.height - windowHeight); 

    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: xPosition,
        y: yPosition,
        frame: false,
        titleBarStyle: 'hidden',
        transparent: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    mainWindow.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(async () => {
    flaskProcess = spawn('python', ['./main.py', PORT.toString()]);
    await waitForServer();    
    createWindow();    
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('server-ready');
    });
});

ipcMain.on('minimize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
});

ipcMain.handle('chat', async (event, query) => {
    try {
        const response = await fetch(`http://localhost:${PORT}/chat`, {
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
                const response = await fetch(`http://localhost:${PORT}/health`);
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
//     const response = await fetch(`http://localhost:${PORT}/set_model`, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ model })
//     })
//     return await response.json()
// })

// ipcMain.handle('get-current-model', async () => {
//     const response = await fetch(`http://localhost:${PORT}/current_model`)
//     return await response.json()
// })

ipcMain.on('close-window', () => {
    mainWindow.close()
})

ipcMain.handle('set-config', async (event, config) => {
    const response = await fetch(`http://localhost:${PORT}/set_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    return await response.json();
});

ipcMain.handle('get-config', async (event, sessionId) => {
    const response = await fetch(`http://localhost:${PORT}/history?session_id=${sessionId}`);
    return await response.json();
});

ipcMain.handle('get-history', async (event, sessionId) => {
    const response = await fetch(`http://localhost:${PORT}/history?session_id=${sessionId}`);
    return await response.json();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        flaskProcess.kill()
        app.quit()
    }
})