const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { app: expressApp, server } = require('./server.js'); // Import both app and server
const portfinder = require('portfinder');

let mainWindow;

// Start Express server with Socket.IO
async function startServer() {
    return new Promise((resolve, reject) => {
        const DEFAULT_PORT = 3001;

        portfinder.getPortPromise({ port: DEFAULT_PORT, stopPort: DEFAULT_PORT + 100 })
            .then(port => {
                server.listen(port, () => {
                    console.log(`✅ Server (Express + Socket.IO) berjalan di port ${port}`);
                    resolve(port);
                });
            })
            .catch(err => {
                console.error('❌ Gagal menemukan port kosong:', err);
                reject(err);
            });
    });
}

async function createWindow() {
    try {
        // Start Express server first
        const port = await startServer();

        mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                sandbox: false,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, '../build/lo1.png')
        });

        // Load React app based on environment
        if (app.isPackaged) {
            // Production: load built React app
            const indexPath = path.join(__dirname, '../client/dist/index.html');
            mainWindow.loadFile(indexPath);
        } else {
            // Development: load Vite dev server
            mainWindow.loadURL('http://localhost:5173');
        }

        // Send backend port to React app
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('server-port', port);
            console.log(`📡 Sent port ${port} to renderer`);
        });

        // Open DevTools in development
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }

        mainWindow.on('closed', () => {
            mainWindow = null;
            // Close server when window closes
            if (server) {
                server.close(() => {
                    console.log('🔴 Server closed');
                });
            }
        });
    } catch (error) {
        console.error('❌ Gagal memulai aplikasi:', error);
        app.quit();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Cleanup on quit
app.on('before-quit', () => {
    if (server) {
        server.close();
    }
});

// Handler untuk pilih file MBTiles
ipcMain.handle('select-mbtiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'MBTiles', extensions: ['mbtiles'] }]
    });

    if (result.canceled) return [];

    return result.filePaths.map(filePath => {
        const stats = fs.statSync(filePath);
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size
        };
    });
});

// Handler untuk XYZ
ipcMain.handle('select-xyz', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'XYZ Files', extensions: ['xyz'] }]
    });

    if (result.canceled) return [];

    return result.filePaths.map(filePath => {
        const stats = fs.statSync(filePath);
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size
        };
    });
});