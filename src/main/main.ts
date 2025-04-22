import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { Op } from 'sequelize';
import { initDatabase } from '../database/database';
import { Screenshot, AudioRecording, WebHistory, AppUsage, Settings } from '../database/models';
import {
  setupScreenCaptureHandlers,
  startScreenCapture,
  stopScreenCapture
} from '../modules/screen-capture/screen-capture';
import {
  setupAudioRecorderHandlers,
  startAudioRecording,
  stopAudioRecording,
  setMainWindow
} from '../modules/audio-recorder/audio-recorder';
import {
  setupWebHistoryHandlers,
  startWebHistoryTracking,
  stopWebHistoryTracking
} from '../modules/web-history/web-history';
import {
  setupAppMonitorHandlers,
  startAppMonitoring,
  stopAppMonitoring
} from '../modules/app-monitor/app-monitor';
import { setupAIIntegrationHandlers } from '../modules/ai-integration/ai-integration';
import { setupSettingsHandlers } from '../modules/settings/settings';
import { setupDataVisualizationHandlers } from '../modules/data-visualization/data-visualization';
import { setupTimelineHandlers } from '../modules/timeline/timeline';
import settingsManager from '../modules/settings/settings';

// Flag to track if handlers are already set up
let handlersInitialized = false;

// Keep a global reference of the window object to avoid garbage collection
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Development mode flag
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// Initialize all modules
async function initializeModules() {
  try {
    // Initialize database
    await initDatabase();

    // Set up IPC handlers for all modules (only once)
    if (!handlersInitialized) {
      setupScreenCaptureHandlers();
      setupAudioRecorderHandlers();
      setupWebHistoryHandlers();
      setupAppMonitorHandlers();
      setupAIIntegrationHandlers();
      setupSettingsHandlers();
      setupDataVisualizationHandlers();
      setupTimelineHandlers();
      handlersInitialized = true;
    }

    // Get settings from settings manager
    const settings = settingsManager.getSettings();
    // Force autoStart to true to ensure recording starts automatically
    const autoStart = true; // Override settings.recording.autoStart

    // Start recording modules if auto-start is enabled
    if (autoStart) {
      try {
        // Get interval settings
        const screenInterval = settings.recording.screenshotInterval;
        const webInterval = settings.recording.webHistoryInterval;
        const appInterval = settings.recording.appMonitorInterval;

        // Start recording modules with error handling
        try {
          startScreenCapture(screenInterval);
          console.log('Screen capture module started');
        } catch (error) {
          console.error('Failed to start screen capture module:', error);
        }

        try {
          startAudioRecording();
          console.log('Audio recording module started');
        } catch (error) {
          console.error('Failed to start audio recording module:', error);
        }

        try {
          startWebHistoryTracking(webInterval);
          console.log('Web history tracking module started');
        } catch (error) {
          console.error('Failed to start web history tracking module:', error);
        }

        try {
          startAppMonitoring(appInterval);
          console.log('App monitoring module started');
        } catch (error) {
          console.error('Failed to start app monitoring module:', error);
        }

        console.log('Recording modules initialization completed');
      } catch (error) {
        console.error('Error starting recording modules:', error);
      }
    }

    console.log('All modules initialized successfully');
  } catch (error) {
    console.error('Error initializing modules:', error);
  }
}

async function createWindow() {

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js')
    },
    icon: path.join(__dirname, '../../assets/icons/icon.png')
  });

  // Load the index.html
  if (isDev) {
    // In development mode, load the local file
    const rendererPath = path.join(__dirname, '../../src/renderer/index.html');
    console.log('Loading renderer from:', rendererPath);

    mainWindow.loadURL(
      url.format({
        pathname: rendererPath,
        protocol: 'file:',
        slashes: true
      })
    );

    // Set up additional protocol handler for development mode
    // This allows loading CSS and other assets from the src directory
    mainWindow.webContents.session.protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substring(6); // Remove 'app://' prefix
      const filePath = path.join(__dirname, '../../src', url);
      callback({ path: filePath });
    });

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

  // Set main window for audio recorder
  setMainWindow(mainWindow);
}

function createTray() {
  try {
    // Create a programmatic icon using nativeImage
    const size = 16;

    // Create a simple colored icon
    const data = Buffer.alloc(size * size * 4);

    // Fill with a purple color (RGBA format)
    for (let i = 0; i < size * size * 4; i += 4) {
      // R: 79, G: 70, B: 229 (indigo color)
      data[i] = 79;     // R
      data[i + 1] = 70;  // G
      data[i + 2] = 229; // B
      data[i + 3] = 255; // A (fully opaque)
    }

    // Create the icon from the buffer
    const coloredIcon = nativeImage.createFromBuffer(data, { width: size, height: size });
    tray = new Tray(coloredIcon);
    console.log('Created programmatic tray icon');
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    // Fallback to an empty icon
    const emptyIcon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
    tray = new Tray(emptyIcon);
  }

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
        console.log('Recording paused:', menuItem.checked);
        // Implement pause/resume logic in the future
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
app.whenReady().then(async () => {
  console.log('Electron app is ready, initializing modules...');
  // Initialize modules first to ensure all handlers are registered
  await initializeModules();
  console.log('Modules initialized, creating window...');
  await createWindow();
  console.log('Window created, application ready');

  // Notify renderer that the app is ready
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('Window loaded, sending app-ready event');
      mainWindow?.webContents.send('app:ready', true);
    });
  }
});

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

// Activity counts handler
ipcMain.handle('activity:get-counts', async () => {
  try {
    const screenshotCount = await Screenshot.count();
    const audioCount = await AudioRecording.count();
    const webCount = await WebHistory.count();
    const appCount = await AppUsage.count();

    return {
      screenshotCount,
      audioCount,
      webCount,
      appCount
    };
  } catch (error) {
    console.error('Error getting activity counts:', error);
    return {
      screenshotCount: 0,
      audioCount: 0,
      webCount: 0,
      appCount: 0
    };
  }
});

// Recent activity handler
ipcMain.handle('activity:get-recent', async (_event, limit = 10) => {
  try {
    // Get recent screenshots
    const screenshots = await Screenshot.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });

    // Get recent audio recordings
    const audioRecordings = await AudioRecording.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });

    // Get recent web history
    const webHistory = await WebHistory.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });

    // Get recent app usage
    const appUsage = await AppUsage.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });

    // Combine all activities and sort by timestamp (newest first)
    const allActivities = [
      ...screenshots.map(s => ({ type: 'screenshot', ...s.toJSON() })),
      ...audioRecordings.map(a => ({ type: 'audio', ...a.toJSON() })),
      ...webHistory.map(w => ({ type: 'web', ...w.toJSON() })),
      ...appUsage.map(a => ({ type: 'app', ...a.toJSON() }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return allActivities.slice(0, limit);
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return [];
  }
});

// Timeline data handler
ipcMain.handle('activity:get-timeline', async (_event, date) => {
  try {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get screenshots for the date
    const screenshots = await Screenshot.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get audio recordings for the date
    const audioRecordings = await AudioRecording.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get web history for the date
    const webHistory = await WebHistory.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get app usage for the date
    const appUsage = await AppUsage.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Combine all activities and sort by timestamp (newest first)
    const allActivities = [
      ...screenshots.map(s => ({ type: 'screenshot', ...s.toJSON() })),
      ...audioRecordings.map(a => ({ type: 'audio', ...a.toJSON() })),
      ...webHistory.map(w => ({ type: 'web', ...w.toJSON() })),
      ...appUsage.map(a => ({ type: 'app', ...a.toJSON() }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return allActivities;
  } catch (error) {
    console.error('Error getting timeline data:', error);
    return [];
  }
});

// Start all recording
ipcMain.handle('recording:start-all', async () => {
  try {
    // Get interval settings
    const screenIntervalSetting = await Settings.findOne({ where: { key: 'screen_capture_interval' } });
    const screenInterval = screenIntervalSetting ? screenIntervalSetting.value : 10000;

    const webIntervalSetting = await Settings.findOne({ where: { key: 'web_history_interval' } });
    const webInterval = webIntervalSetting ? webIntervalSetting.value : 5000;

    const appIntervalSetting = await Settings.findOne({ where: { key: 'app_monitor_interval' } });
    const appInterval = appIntervalSetting ? appIntervalSetting.value : 1000;

    // Start recording modules
    startScreenCapture(screenInterval);
    startAudioRecording();
    startWebHistoryTracking(webInterval);
    startAppMonitoring(appInterval);

    return true;
  } catch (error) {
    console.error('Error starting all recording:', error);
    return false;
  }
});

// Stop all recording
ipcMain.handle('recording:stop-all', async () => {
  try {
    stopScreenCapture();
    await stopAudioRecording();
    stopWebHistoryTracking();
    stopAppMonitoring();

    return true;
  } catch (error) {
    console.error('Error stopping all recording:', error);
    return false;
  }
});

// Settings handlers
ipcMain.handle('settings:get', async () => {
  try {
    const settings = await Settings.findAll();
    const settingsObj: Record<string, any> = {};

    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    return settingsObj;
  } catch (error) {
    console.error('Error getting settings:', error);
    return {};
  }
});

ipcMain.handle('settings:save', async (_event, settings) => {
  try {
    for (const [key, value] of Object.entries(settings)) {
      await Settings.upsert({ key, value });
    }

    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

// AI insights handler
ipcMain.handle('ai:generate-insights', async (_event, timeframe) => {
  try {
    // In a real implementation, we would call the AI API
    // For now, we'll return a placeholder
    return {
      timeframe,
      date: new Date().toISOString(),
      insights: 'AI insights will be generated here based on your activity data.'
    };
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return null;
  }
});
