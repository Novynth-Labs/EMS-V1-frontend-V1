const { ipcMain, dialog, Notification, BrowserWindow, app } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');

function registerSystemIPCHandlers() {
  const iconPath = path.join(__dirname, '../../build/icon.png');
  const hasIcon = fs.existsSync(iconPath);

  // IPC handle for Open File / Folder Dialog
  ipcMain.handle('dialog:open', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return result;
  });

  // IPC handle for Save File Dialog
  ipcMain.handle('dialog:save', async (event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  // IPC handle for OS Native Notification (Messages & General)
  ipcMain.on('notification:show', (event, { title, body, route, silent = false }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    // Subtle taskbar flash if app is in background
    if (win && !win.isFocused()) {
      win.flashFrame(true);
      win.once('focus', () => win.flashFrame(false));
    }

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: hasIcon ? iconPath : undefined,
        silent: Boolean(silent),
        urgency: 'normal'
      });

      // When user clicks the OS notification: bring app to front and navigate
      notification.on('click', () => {
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
          win.flashFrame(false);
          if (route) {
            win.webContents.send('navigate', route);
          }
        }
      });

      notification.show();
    }
  });

  // IPC handle for Incoming Call — pops up window on desktop, flashes taskbar, native critical notification
  ipcMain.on('incoming-call:show', (event, { title, body, route }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

    // Force window to popup in front of other apps on desktop
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.setAlwaysOnTop(true, 'screen-saver');
      win.focus();

      // Release always-on-top after 4s so user isn't trapped once noticed
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.setAlwaysOnTop(false);
        }
      }, 4000);

      win.flashFrame(true);
      win.once('focus', () => {
        win.flashFrame(false);
        win.setAlwaysOnTop(false);
      });
    }

    // Show native OS notification with critical priority
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: hasIcon ? iconPath : undefined,
        urgency: 'critical',
        timeoutType: 'never',
        silent: false,
      });

      // When user clicks the incoming call notification, focus window and navigate to room
      notification.on('click', () => {
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
          win.flashFrame(false);
          win.setAlwaysOnTop(false);
          if (route) {
            win.webContents.send('navigate', route);
          }
        }
      });

      notification.show();
    }
  });

  // IPC for dismissing flash (call declined/missed/accepted)
  ipcMain.on('incoming-call:dismiss', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) {
      win.flashFrame(false);
      win.setAlwaysOnTop(false);
    }
  });

  // IPC handle for System Information & Paths
  ipcMain.handle('system:info', () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpus: os.cpus().length,
      pathSeparator: path.sep,
      paths: {
        userData: app.getPath('userData'),
        logs: app.getPath('logs'),
        cache: app.getPath('cache'),
        downloads: app.getPath('downloads'),
        temp: app.getPath('temp'),
        home: app.getPath('home')
      }
    };
  });

  // IPC handle for getting specific app path by name
  ipcMain.handle('system:getPath', (event, name) => {
    try {
      return app.getPath(name);
    } catch (err) {
      console.error(`[IPC] Invalid app path requested: ${name}`, err);
      return null;
    }
  });
}

module.exports = { registerSystemIPCHandlers };

