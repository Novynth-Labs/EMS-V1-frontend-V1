const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

const config = require('./config/index.cjs');
const { registerSystemIPCHandlers } = require('./ipc/system.cjs');
const { initAutoUpdater } = require('./updater.cjs');

let mainWindow;

// Register deep link custom protocol client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    if (process.platform === 'win32') {
      app.setAsDefaultProtocolClient(config.PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(config.PROTOCOL_SCHEME);
    }
  }
} else {
  app.setAsDefaultProtocolClient(config.PROTOCOL_SCHEME);
}



function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.WINDOW_DEFAULTS.width,
    height: config.WINDOW_DEFAULTS.height,
    minWidth: config.WINDOW_DEFAULTS.minWidth,
    minHeight: config.WINDOW_DEFAULTS.minHeight,
    title: config.WINDOW_DEFAULTS.title,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Handle window open requests (deep links, external links, internal route clicks)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Check if the URL is an internal meeting route
    const match = url.match(/(?:ems:\/\/*|https?:\/\/[^\/]+)\/?(meeting\/[a-zA-Z0-9]+)/);
    if (match && match[1]) {
      // Direct navigation to the matching component internally
      mainWindow.webContents.send('navigate', `/${match[1]}`);
      return { action: 'deny' };
    }

    // Securely handle other external links in default system browser
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Load local compiled assets directly from dist
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.webContents.openDevTools();
    
    // Pipe console messages to main process CLI output
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[RENDERER CONSOLE] ${message} (from ${sourceId}:${line})`);
    });
  }

  // Initialize Automatic Application Updater
  initAutoUpdater(mainWindow);

  // Configure cross-origin media & secure CSP in Electron Desktop window
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {};
    headers['Cross-Origin-Resource-Policy'] = ['cross-origin'];
    headers['Cross-Origin-Embedder-Policy'] = ['unsafe-none'];
    
    // Set modern CSP for desktop renderer
    if (details.url.startsWith('file:') || details.url.includes('localhost')) {
      headers['Content-Security-Policy'] = [
        "default-src 'self' file: app: blob:; " +
        "script-src 'self' 'unsafe-inline' blob:; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https: http:; " +
        "media-src 'self' data: blob: https: http:; " +
        "connect-src 'self' https: wss: ws: http: blob:;"
      ];
    }
    callback({ responseHeaders: headers });
  });

  // Grant camera/mic media permissions dynamically
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(false);
  });

  // Handle standard desktop screen sharing requests
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources.length > 0) {
          // Select primary screen (first source)
          callback({ video: sources[0] });
        } else {
          callback({ error: 'No screen capture source available' });
        }
      })
      .catch((err) => {
        console.error('[ELECTRON] Failed to retrieve screen sources:', err);
        callback({ error: err.message });
      });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock configuration
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const url = commandLine.find(arg => arg.startsWith(`${config.PROTOCOL_SCHEME}://`));
      if (url) {
        mainWindow.webContents.send('open-deep-link', url);
      }
    }
  });

  app.whenReady().then(() => {
    // Register secure IPC actions
    registerSystemIPCHandlers();

    createWindow();

    // Check if launched via deep link on startup
    const url = process.argv.find(arg => arg.startsWith(`${config.PROTOCOL_SCHEME}://`));
    if (url && mainWindow) {
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('open-deep-link', url);
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('open-deep-link', url);
  }
});
