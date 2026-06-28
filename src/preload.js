'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // overlay
  onNotify: (cb) => ipcRenderer.on('notify', (_e, data) => cb(data)),
  ready: () => ipcRenderer.send('overlay-ready'),
  click: (payload) => ipcRenderer.send('overlay-click', payload),
  dismiss: () => ipcRenderer.send('overlay-dismiss'),

  // settings
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  pickSound: () => ipcRenderer.invoke('pick-sound'),
  listTerminals: () => ipcRenderer.invoke('list-terminals'),
  testNotification: () => ipcRenderer.send('test-notification')
});
