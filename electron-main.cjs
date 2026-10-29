const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Fix 1: Force userData and cache to local APPDATA (%APPDATA%\EngManager)
let logFile = '';
try {
  const localAppData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const appDataDir = path.join(localAppData, 'EngManager');
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  app.setPath('userData', appDataDir);
  logFile = path.join(appDataDir, 'EngManager_debug.log');

  const startMsg = `[${new Date().toISOString()}] [EngManager EXE Launched] System: ${os.platform()} ${os.release()} ${os.arch()}\n`;
  fs.appendFileSync(logFile, startMsg);
} catch (e) {
  console.warn('Failed to set local userData path:', e);
}

// Fix 2: Detect Network Drives / UNC paths and apply stability switches
const exePath = app.getPath('exe') || '';
const isUNC = exePath.startsWith('\\\\');
const isNonCPath = /^[A-Z]:/i.test(exePath) && !exePath.toLowerCase().startsWith('c:');

if (logFile) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] [EXE Path] ${exePath} (isUNC=${isUNC}, isNonCPath=${isNonCPath})\n`);
  } catch {}
}

// Disable disk GPU caching & hardware acceleration on network drives to prevent main thread freezing
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
if (isUNC || isNonCPath) {
  try {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-rasterization');
    if (logFile) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [GPU Disabled] Hardware acceleration and sandbox successfully disabled for stability on network share.\n`);
    }
  } catch (e) {
    if (logFile) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] [GPU Switch Error] ${e.message}\n`);
    }
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '英語管家 EngManager',
    icon: path.join(__dirname, 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#f8fafc',
    show: false,
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(indexPath).catch((err) => {
    if (logFile) {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] [LoadFile Error] ${err.message}\n`);
      } catch {}
    }
  });

  // Show window smoothly when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (logFile) {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] [Window Ready] EngManager main window displayed successfully.\n`);
      } catch {}
    }
  });

  // Disable standard menu bar for clean application UI
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Ensure single instance lock works smoothly on local drive
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
