import { ipcMain } from 'electron';
import * as activeWin from 'active-win';
import { AppUsage } from '../../database/models';

// Configuration
let isMonitoring = false;
let monitoringInterval: NodeJS.Timeout | null = null;
const DEFAULT_INTERVAL = 1000; // 1 second
let currentInterval = DEFAULT_INTERVAL;
let currentApp: activeWin.Result | null = null;
let currentAppStartTime: Date | null = null;

// Start app monitoring
export function startAppMonitoring(interval = DEFAULT_INTERVAL) {
  if (isMonitoring) return;
  
  currentInterval = interval;
  isMonitoring = true;
  
  // Initial check
  checkActiveWindow();
  
  // Set up interval for regular checks
  monitoringInterval = setInterval(() => {
    checkActiveWindow();
  }, currentInterval);
  
  console.log(`App monitoring started with interval: ${currentInterval}ms`);
}

// Check active window
async function checkActiveWindow() {
  try {
    // Get current active window
    const activeWindow = await activeWin();
    const currentTime = new Date();
    
    // If no active window or couldn't get info
    if (!activeWindow) {
      if (currentApp && currentAppStartTime) {
        // Record previous app usage
        await recordAppUsage(currentApp, currentAppStartTime, currentTime);
        currentApp = null;
        currentAppStartTime = null;
      }
      return;
    }
    
    // If app changed
    if (!currentApp || 
        currentApp.owner.name !== activeWindow.owner.name || 
        currentApp.title !== activeWindow.title) {
      
      // Record previous app usage if there was one
      if (currentApp && currentAppStartTime) {
        await recordAppUsage(currentApp, currentAppStartTime, currentTime);
      }
      
      // Update current app
      currentApp = activeWindow;
      currentAppStartTime = currentTime;
    }
  } catch (error) {
    console.error('Error checking active window:', error);
  }
}

// Record app usage
async function recordAppUsage(app: activeWin.Result, startTime: Date, endTime: Date) {
  try {
    const duration = endTime.getTime() - startTime.getTime();
    
    // Only record if used for at least 500ms
    if (duration < 500) return;
    
    // Save to database
    await AppUsage.create({
      appName: app.owner.name,
      windowTitle: app.title,
      startTime,
      endTime,
      duration: Math.floor(duration / 1000), // Convert to seconds
      metadata: {
        pid: app.owner.pid,
        path: app.owner.path
      }
    });
    
    console.log(`Recorded app usage: ${app.owner.name} - ${app.title} (${duration}ms)`);
  } catch (error) {
    console.error('Error recording app usage:', error);
  }
}

// Stop app monitoring
export function stopAppMonitoring() {
  if (!isMonitoring) return;
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  // Record the last app usage if there is one
  if (currentApp && currentAppStartTime) {
    const currentTime = new Date();
    recordAppUsage(currentApp, currentAppStartTime, currentTime).catch(error => {
      console.error('Error recording final app usage:', error);
    });
  }
  
  isMonitoring = false;
  currentApp = null;
  currentAppStartTime = null;
  
  console.log('App monitoring stopped');
}

// Get recent app usage
export async function getRecentAppUsage(limit = 50) {
  try {
    const usage = await AppUsage.findAll({
      order: [['startTime', 'DESC']],
      limit
    });
    
    return usage;
  } catch (error) {
    console.error('Error fetching app usage:', error);
    return [];
  }
}

// Set up IPC handlers
export function setupAppMonitorHandlers() {
  ipcMain.handle('app-monitor:start', (event, interval) => {
    startAppMonitoring(interval);
    return true;
  });
  
  ipcMain.handle('app-monitor:stop', () => {
    stopAppMonitoring();
    return true;
  });
  
  ipcMain.handle('app-monitor:get', async (event, limit) => {
    return await getRecentAppUsage(limit);
  });
}
