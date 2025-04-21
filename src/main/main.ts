import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { initDatabase } from '../database/database';

// Keep a global reference of the window object to avoid garbage collection
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Development mode flag
const isDev = process.argv.includes('--dev');

async function createWindow() {
  // Initialize database
  await initDatabase();

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  // Load the index.html
  if (isDev) {
    // In development mode, load from localhost
    mainWindow.loadURL('http://localhost:9000');
    // Open DevTools
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the bundled app
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../../dist/renderer/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  // Handle window close event
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    return true;
  });

  // Handle window closed event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create tray icon
  createTray();
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/icons/tray-icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open BlackBox AI', 
      click: () => {
        mainWindow?.show();
      }
    },
    { 
      label: 'Pause Recording',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        // Toggle recording state
        const isPaused = menuItem.checked;
        // Implement pause/resume logic
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('BlackBox AI');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS re-create a window when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit event
app.on('before-quit', () => {
  isQuitting = true;
});

// IPC handlers
// Add IPC handlers for communication between main and renderer processes
