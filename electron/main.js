const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'VisionSync AI',
    backgroundColor: '#0F172A',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // needed so file:// can call Gemini API
    },
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
  });

  // Show once ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in the default browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  buildMenu(win);
}

function buildMenu(win) {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Subtitle File…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog(win, {
              title: 'Open Subtitle File',
              filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }],
              properties: ['openFile'],
            });
            if (filePaths.length > 0) {
              const content = fs.readFileSync(filePaths[0], 'utf-8');
              win.webContents.send('open-file', { path: filePaths[0], content });
            }
          }
        },
        { type: 'separator' },
        process.platform !== 'darwin' ? { role: 'quit' } : { role: 'close' },
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Get Gemini API Key…',
          click: () => shell.openExternal('https://aistudio.google.com/apikey')
        },
        {
          label: 'Gemini API Docs…',
          click: () => shell.openExternal('https://ai.google.dev/docs')
        },
        { type: 'separator' },
        {
          label: 'About VisionSync AI',
          click: () => {
            dialog.showMessageBox(win, {
              title: 'VisionSync AI',
              message: 'VisionSync AI v2.0',
              detail: 'College Course Visualizer\nPowered by Google Gemini 2.0 Flash\n\nYour Gemini API key is stored locally on this device only.',
              type: 'info',
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
