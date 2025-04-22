import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as util from 'util';
import activeWin, { Result as ActiveWinResult } from 'active-win';
import { AppUsage } from '../../database/models';

// Promisify exec
const exec = util.promisify(childProcess.exec);

// Cache for app icons and metadata
const appIconCache = new Map<string, string>();
const appMetadataCache = new Map<string, any>();

// Directory for storing app icons
const appIconsDir = path.join(app.getPath('userData'), 'app-icons');

// Ensure app icons directory exists
if (!fs.existsSync(appIconsDir)) {
  fs.mkdirSync(appIconsDir, { recursive: true });
}

// Configuration
let isMonitoring = false;
let monitoringInterval: NodeJS.Timeout | null = null;
const DEFAULT_INTERVAL = 1000; // 1 second
let currentInterval = DEFAULT_INTERVAL;
let currentApp: ActiveWinResult | null = null;
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

// Get app icon
async function getAppIcon(appPath: string): Promise<string | null> {
  try {
    // Check if we already have the icon in cache
    if (appIconCache.has(appPath)) {
      return appIconCache.get(appPath) || null;
    }

    // Generate a unique filename based on the app path
    const appId = Buffer.from(appPath).toString('base64').replace(/[/+=]/g, '_');
    const iconPath = path.join(appIconsDir, `${appId}.png`);

    // Check if we already have the icon file
    if (fs.existsSync(iconPath)) {
      appIconCache.set(appPath, iconPath);
      return iconPath;
    }

    // Extract icon based on platform
    const platform = os.platform();
    let iconExtracted = false;

    if (platform === 'win32') {
      // On Windows, use PowerShell to extract icon
      try {
        const script = `
          Add-Type -AssemblyName System.Drawing
          $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${appPath.replace(/\\/g, '\\\\')}")
          if ($icon -ne $null) {
            $bitmap = $icon.ToBitmap()
            $bitmap.Save("${iconPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
            $bitmap.Dispose()
            $icon.Dispose()
            Write-Output "Success"
          } else {
            Write-Output "Failed"
          }
        `;
        const result = await exec(`powershell -Command "${script}"`);
        iconExtracted = result.stdout.trim() === 'Success';
      } catch (error) {
        console.error('Error extracting Windows app icon:', error);
      }
    } else if (platform === 'darwin') {
      // On macOS, use sips to extract icon
      try {
        // Get the .app bundle path if this is an executable within a bundle
        let appBundlePath = appPath;
        if (!appPath.endsWith('.app')) {
          const match = appPath.match(/(.+\.app)/);
          if (match) {
            appBundlePath = match[1];
          }
        }

        // Get the icon from the Info.plist file
        const iconName = (await exec(`defaults read "${appBundlePath}/Contents/Info" CFBundleIconFile`)).stdout.trim();
        let iconFile = path.join(appBundlePath, 'Contents', 'Resources', iconName);

        // Add .icns extension if missing
        if (!iconFile.endsWith('.icns')) {
          iconFile += '.icns';
        }

        // Convert icns to png
        if (fs.existsSync(iconFile)) {
          await exec(`sips -s format png "${iconFile}" --out "${iconPath}"`);
          iconExtracted = fs.existsSync(iconPath);
        }
      } catch (error) {
        console.error('Error extracting macOS app icon:', error);
      }
    } else if (platform === 'linux') {
      // On Linux, try to find the icon in standard locations
      try {
        // Extract app name from path
        const appName = path.basename(appPath).toLowerCase();

        // Common icon locations
        const iconLocations = [
          `/usr/share/icons/hicolor/128x128/apps/${appName}.png`,
          `/usr/share/icons/hicolor/256x256/apps/${appName}.png`,
          `/usr/share/pixmaps/${appName}.png`
        ];

        // Check each location
        for (const loc of iconLocations) {
          if (fs.existsSync(loc)) {
            fs.copyFileSync(loc, iconPath);
            iconExtracted = true;
            break;
          }
        }
      } catch (error) {
        console.error('Error extracting Linux app icon:', error);
      }
    }

    // If we extracted the icon, add it to cache
    if (iconExtracted && fs.existsSync(iconPath)) {
      appIconCache.set(appPath, iconPath);
      return iconPath;
    }

    // If we couldn't extract the icon, return null
    return null;
  } catch (error) {
    console.error('Error getting app icon:', error);
    return null;
  }
}

// Get app metadata
async function getAppMetadata(app: ActiveWinResult): Promise<any> {
  try {
    const appPath = app.owner.path;

    // Check if we already have metadata in cache
    if (appMetadataCache.has(appPath)) {
      return appMetadataCache.get(appPath) || {};
    }

    // Basic metadata
    const metadata: any = {
      path: appPath,
      name: app.owner.name,
      platform: os.platform()
    };

    // Add platform-specific properties
    if ('processId' in app.owner) {
      metadata.processId = app.owner.processId;
    }

    if ('bundleId' in app.owner && app.owner.bundleId) {
      metadata.bundleId = app.owner.bundleId;
    }

    // Get app icon
    const iconPath = await getAppIcon(appPath);
    if (iconPath) {
      metadata.iconPath = iconPath;
    }

    // Platform-specific metadata
    const platform = os.platform();
    if (platform === 'win32') {
      // On Windows, try to get file description and version
      try {
        const script = `
          $file = Get-Item "${appPath.replace(/\\/g, '\\\\')}"
          $fileVersion = $file.VersionInfo.FileVersion
          $productVersion = $file.VersionInfo.ProductVersion
          $fileDescription = $file.VersionInfo.FileDescription
          $productName = $file.VersionInfo.ProductName
          $company = $file.VersionInfo.CompanyName
          Write-Output "$fileDescription|$productName|$fileVersion|$productVersion|$company"
        `;
        const result = await exec(`powershell -Command "${script}"`);
        const [fileDescription, productName, fileVersion, productVersion, company] = result.stdout.trim().split('|');

        metadata.fileDescription = fileDescription || '';
        metadata.productName = productName || '';
        metadata.fileVersion = fileVersion || '';
        metadata.productVersion = productVersion || '';
        metadata.company = company || '';
      } catch (error) {
        console.error('Error getting Windows app metadata:', error);
      }
    } else if (platform === 'darwin') {
      // On macOS, get app bundle info
      try {
        // Get the .app bundle path if this is an executable within a bundle
        let appBundlePath = appPath;
        if (!appPath.endsWith('.app')) {
          const match = appPath.match(/(.+\.app)/);
          if (match) {
            appBundlePath = match[1];
          }
        }

        // Get bundle info
        const bundleId = (await exec(`defaults read "${appBundlePath}/Contents/Info" CFBundleIdentifier`)).stdout.trim();
        const version = (await exec(`defaults read "${appBundlePath}/Contents/Info" CFBundleShortVersionString`)).stdout.trim();
        const build = (await exec(`defaults read "${appBundlePath}/Contents/Info" CFBundleVersion`)).stdout.trim();

        metadata.bundleId = bundleId || '';
        metadata.version = version || '';
        metadata.build = build || '';
      } catch (error) {
        console.error('Error getting macOS app metadata:', error);
      }
    }

    // Cache metadata
    appMetadataCache.set(appPath, metadata);
    return metadata;
  } catch (error) {
    console.error('Error getting app metadata:', error);
    return { path: app.owner.path };
  }
}

// Record app usage
async function recordAppUsage(app: ActiveWinResult, startTime: Date, endTime: Date) {
  try {
    const duration = endTime.getTime() - startTime.getTime();

    // Only record if used for at least 500ms
    if (duration < 500) return;

    // Get app metadata
    const metadata = await getAppMetadata(app);

    // Save to database
    await AppUsage.create({
      appName: app.owner.name,
      windowTitle: app.title,
      startTime,
      endTime,
      duration: Math.floor(duration / 1000), // Convert to seconds
      metadata
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

// Get app icon by path
export async function getAppIconByPath(appPath: string): Promise<string | null> {
  return await getAppIcon(appPath);
}

// Define app stats interface
interface AppStats {
  totalDuration: number;
  count: number;
  lastUsed: Date | null;
  metadata: any;
  [key: string]: any;
}

// Define app stats map interface
interface AppStatsMap {
  [appName: string]: AppStats;
}

// Get app usage statistics
export async function getAppUsageStatistics(timeRange: string = 'day') {
  try {
    let startDate = new Date();
    let endDate = new Date();

    // Set time range
    switch (timeRange) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    // Get app usage for the time range
    const appUsage = await AppUsage.findAll({
      where: {
        startTime: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      }
    });

    // Group by app name
    const appStats: AppStatsMap = {};
    for (const usage of appUsage) {
      const appName = usage.appName;
      if (!appStats[appName]) {
        appStats[appName] = {
          totalDuration: 0,
          count: 0,
          lastUsed: null,
          metadata: usage.metadata
        };
      }

      appStats[appName].totalDuration += usage.duration;
      appStats[appName].count += 1;

      const usageTime = new Date(usage.startTime).getTime();
      if (!appStats[appName].lastUsed || usageTime > new Date(appStats[appName].lastUsed as Date).getTime()) {
        appStats[appName].lastUsed = usage.startTime;
      }
    }

    // Convert to array and sort by total duration
    const result = Object.entries(appStats).map(([appName, stats]) => ({
      appName,
      totalDuration: stats.totalDuration,
      count: stats.count,
      lastUsed: stats.lastUsed,
      metadata: stats.metadata,
      totalDurationFormatted: formatDuration(stats.totalDuration)
    })).sort((a, b) => b.totalDuration - a.totalDuration);

    return result;
  } catch (error) {
    console.error('Error getting app usage statistics:', error);
    return [];
  }
}

// Format duration in seconds to human-readable string
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

// Set up IPC handlers
export function setupAppMonitorHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('app-monitor:start');
    ipcMain.removeHandler('app-monitor:stop');
    ipcMain.removeHandler('app-monitor:get');
    ipcMain.removeHandler('app-monitor:get-stats');
    ipcMain.removeHandler('app-monitor:get-icon');
    ipcMain.removeHandler('app-monitor:get-current');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('app-monitor:start', (_event, interval) => {
    startAppMonitoring(interval);
    return { success: true };
  });

  ipcMain.handle('app-monitor:stop', () => {
    stopAppMonitoring();
    return { success: true };
  });

  ipcMain.handle('app-monitor:get', async (_event, limit) => {
    return await getRecentAppUsage(limit);
  });

  // Add handler for getting app usage statistics
  ipcMain.handle('app-monitor:get-stats', async (_event, timeRange) => {
    return await getAppUsageStatistics(timeRange);
  });

  // Add handler for getting app icon
  ipcMain.handle('app-monitor:get-icon', async (_event, appPath) => {
    const iconPath = await getAppIcon(appPath);
    return { success: !!iconPath, iconPath };
  });

  // Add handler for getting current active window
  ipcMain.handle('app-monitor:get-current', async () => {
    try {
      const activeWindow = await activeWin();
      if (!activeWindow) {
        return { success: false, error: 'No active window' };
      }

      const metadata = await getAppMetadata(activeWindow);
      return {
        success: true,
        app: {
          name: activeWindow.owner.name,
          title: activeWindow.title,
          metadata
        }
      };
    } catch (error) {
      console.error('Error getting current active window:', error);
      return { success: false, error: 'Failed to get active window' };
    }
  });
}
