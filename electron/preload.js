const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFile: (callback) => ipcRenderer.on('open-file', (_, data) => callback(data)),
  removeOpenFileListener: () => ipcRenderer.removeAllListeners('open-file'),
  platform: process.platform,
  isElectron: true,
});
