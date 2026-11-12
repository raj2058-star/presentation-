/* AppleLab desktop (Windows / macOS / Linux) — Electron main process */
const { app, BrowserWindow, Menu, session, shell, dialog } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 620,
    title: 'AppleLab',
    backgroundColor: '#0f1318',
    icon: path.join(ROOT, 'build', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // keep audio scheduling smooth when minimized
    },
  });
  win.loadFile(path.join(ROOT, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}

// Run an in-app action (same as clicking the web UI menu)
function run(action) {
  if (!win) return;
  win.webContents.executeJavaScript(`window.AL && AL.app && AL.app.actions[${JSON.stringify(action)}] && AL.app.actions[${JSON.stringify(action)}]()`).catch(() => {});
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Project…', accelerator: 'CmdOrCtrl+N', click: () => run('new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => run('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => run('save') },
        { type: 'separator' },
        { label: 'Open .applelab File…', click: () => run('import-project') },
        { label: 'Save as .applelab File…', accelerator: 'CmdOrCtrl+Shift+S', click: () => run('export-project') },
        { type: 'separator' },
        { label: 'Import Audio…', accelerator: 'CmdOrCtrl+I', click: () => run('import-audio') },
        { label: 'Export Mixdown (WAV)…', accelerator: 'CmdOrCtrl+Shift+E', click: () => run('export-wav') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => run('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => run('redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'Track',
      submenu: [
        { label: 'New Instrument Track', click: () => run('add-instrument') },
        { label: 'New Drum Track', click: () => run('add-drums') },
        { label: 'New Audio / Voice Track', click: () => run('add-audio') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: () => run('shortcuts') },
        { label: 'About AppleLab', click: () => run('about') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// single instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(() => {
    // allow microphone + MIDI for recording; deny everything else
    const allowed = new Set(['media', 'midi', 'midiSysex', 'clipboard-sanitized-write', 'fullscreen']);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
    buildMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  process.on('uncaughtException', (err) => dialog.showErrorBox('AppleLab error', String(err && err.stack || err)));
}
