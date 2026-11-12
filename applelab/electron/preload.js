/* Exposes a tiny, safe flag so the web app knows it runs as the desktop edition. */
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('applelabDesktop', { isDesktop: true, platform: process.platform });
