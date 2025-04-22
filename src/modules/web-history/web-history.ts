import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import * as util from 'util';
import Database from 'better-sqlite3';
import { WebHistory } from '../../database/models';
import settingsManager from '../settings/settings';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { WebHistory as WebHistoryType, ApiResponse } from '../../common/types';
import { EVENTS, ERROR_MESSAGES, DEFAULT_INTERVALS, STORAGE_PATHS } from '../../common/constants';
import events from '../../common/events';

// Promisify exec
const exec = util.promisify(childProcess.exec);

// Temporary directory for browser history copies
const tempDir = path.join(app.getPath('userData'), STORAGE_PATHS.TEMP);

// Ensure temp directory exists
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configuration
let isTracking = false;
let trackingInterval: NodeJS.Timeout | null = null;
let currentInterval = DEFAULT_INTERVALS.WEB_HISTORY;
let lastUrl = '';
let lastTitle = '';
let lastSource = '';
let lastUrlStartTime: Date | null = null;

// Browser support flags
interface BrowserSupport {
  chrome: boolean;
  firefox: boolean;
  edge: boolean;
  [key: string]: boolean;
}

let browserSupport: BrowserSupport = {
  chrome: false,
  firefox: false,
  edge: false
};

// Check which browsers are installed
async function checkBrowserSupport() {
  const username = os.userInfo().username;
  const platform = os.platform() as SupportedPlatform;

  // Check Chrome
  try {
    if (platform in historyPaths.chrome) {
      const chromePath = historyPaths.chrome[platform](username);
      browserSupport.chrome = fs.existsSync(path.dirname(chromePath));
    } else {
      browserSupport.chrome = false;
    }
  } catch (error) {
    browserSupport.chrome = false;
  }

  // Check Firefox
  try {
    const firefoxProfileDir = await getFirefoxProfileDirectory();
    browserSupport.firefox = !!firefoxProfileDir;
  } catch (error) {
    browserSupport.firefox = false;
  }

  // Check Edge
  try {
    if (platform in historyPaths.edge) {
      const edgePath = historyPaths.edge[platform](username);
      browserSupport.edge = fs.existsSync(path.dirname(edgePath));
    } else {
      browserSupport.edge = false;
    }
  } catch (error) {
    browserSupport.edge = false;
  }

  console.log('Browser support:', browserSupport);
}

// Define supported platforms
type SupportedPlatform = 'win32' | 'darwin' | 'linux';

// Browser history file paths for different browsers and platforms
interface BrowserHistoryPaths {
  [browser: string]: {
    [platform in SupportedPlatform]: (username: string) => string;
  };
}

const historyPaths: BrowserHistoryPaths = {
  chrome: {
    win32: (username: string) => `C:\\Users\\${username}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\History`,
    darwin: (username: string) => `/Users/${username}/Library/Application Support/Google/Chrome/Default/History`,
    linux: (username: string) => `/home/${username}/.config/google-chrome/Default/History`
  },
  firefox: {
    win32: (username: string) => `C:\\Users\\${username}\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles`,
    darwin: (username: string) => `/Users/${username}/Library/Application Support/Firefox/Profiles`,
    linux: (username: string) => `/home/${username}/.mozilla/firefox`
  },
  edge: {
    win32: (username: string) => `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\History`,
    darwin: (username: string) => `/Users/${username}/Library/Application Support/Microsoft Edge/Default/History`,
    linux: (username: string) => `/home/${username}/.config/microsoft-edge/Default/History`
  }
};

// Start web history tracking
export async function startWebHistoryTracking(interval = DEFAULT_INTERVALS.WEB_HISTORY): Promise<ApiResponse<any>> {
  if (isTracking) {
    return {
      success: true,
      message: 'Already tracking',
      data: { browsers: browserSupport }
    };
  }

  try {
    // Check which browsers are installed
    await checkBrowserSupport();

    // Check if any browsers are supported
    const supportedBrowsers = Object.entries(browserSupport)
      .filter(([_, supported]) => supported)
      .map(([browser]) => browser);

    if (supportedBrowsers.length === 0) {
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
        message: 'No supported browsers found',
        data: { browsers: browserSupport }
      };
    }

    currentInterval = interval;
    isTracking = true;

    // Set up interval for regular checks
    trackingInterval = setInterval(async () => {
      await checkCurrentBrowserUrl();
    }, currentInterval);

    console.log(`Web history tracking started with interval: ${currentInterval}ms`);
    console.log(`Supported browsers: ${supportedBrowsers.join(', ')}`);

    // Emit event
    events.emit(EVENTS.RECORDING.STATUS_CHANGE, { module: 'web-history', isRecording: true });

    return {
      success: true,
      message: 'Web history tracking started',
      data: {
        browsers: browserSupport,
        supportedBrowsers
      }
    };
  } catch (error) {
    console.error('Error starting web history tracking:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { browsers: browserSupport }
    };
  }
}

// Get Firefox profile directory
async function getFirefoxProfileDirectory(): Promise<string | null> {
  try {
    const username = os.userInfo().username;
    const platform = os.platform() as SupportedPlatform;

    if (!(platform in historyPaths.firefox)) {
      return null;
    }

    const profilesDir = historyPaths.firefox[platform](username);

    if (!fs.existsSync(profilesDir)) {
      return null;
    }

    // Find the default profile
    let profilePath = null;

    // For Firefox, we need to find the default profile
    if (platform === 'win32' || platform === 'darwin' || platform === 'linux') {
      // Read profiles.ini to find the default profile
      const profilesIniPath = path.join(profilesDir, '..', 'profiles.ini');

      if (fs.existsSync(profilesIniPath)) {
        const profilesIni = fs.readFileSync(profilesIniPath, 'utf8');
        const profileLines = profilesIni.split('\n');

        let isDefault = false;
        let profileName = '';

        for (const line of profileLines) {
          if (line.includes('Default=1')) {
            isDefault = true;
          } else if (line.includes('Path=')) {
            profileName = line.split('=')[1].trim();
          }

          if (isDefault && profileName) {
            // Check if it's a relative or absolute path
            if (profileName.includes('/') || profileName.includes('\\')) {
              profilePath = profileName;
            } else {
              profilePath = path.join(profilesDir, profileName);
            }
            break;
          }
        }

        // If we didn't find a default profile, use the first one
        if (!profilePath) {
          const dirs = fs.readdirSync(profilesDir);
          for (const dir of dirs) {
            if (dir.endsWith('.default') || dir.includes('default-release')) {
              profilePath = path.join(profilesDir, dir);
              break;
            }
          }
        }
      }
    }

    return profilePath;
  } catch (error) {
    console.error('Error getting Firefox profile directory:', error);
    return null;
  }
}

// Copy browser history file to temp directory
async function copyBrowserHistoryFile(browser: string): Promise<string | null> {
  try {
    const username = os.userInfo().username;
    const platform = os.platform() as SupportedPlatform;
    let historyPath = null;

    // Get history file path based on browser and platform
    if ((browser === 'chrome' || browser === 'edge') && platform in historyPaths[browser]) {
      historyPath = historyPaths[browser][platform](username);
    } else if (browser === 'firefox') {
      const profileDir = await getFirefoxProfileDirectory();
      if (profileDir) {
        historyPath = path.join(profileDir, 'places.sqlite');
      }
    }

    if (!historyPath || !fs.existsSync(historyPath)) {
      return null;
    }

    // Create a copy of the history file to avoid locking issues
    const tempFilePath = path.join(tempDir, `${browser}_history_${Date.now()}.db`);

    // For Chrome and Edge, we need to copy the file first because it might be locked
    if (platform === 'win32') {
      // On Windows, use robocopy to copy potentially locked files
      try {
        const sourceDir = path.dirname(historyPath);
        const sourceFile = path.basename(historyPath);
        const targetDir = tempDir;

        await exec(`robocopy "${sourceDir}" "${targetDir}" "${sourceFile}" /R:0 /W:0`);
        // Rename the file
        if (fs.existsSync(path.join(targetDir, sourceFile))) {
          fs.renameSync(path.join(targetDir, sourceFile), tempFilePath);
        }
      } catch (error) {
        // Fallback to direct copy if robocopy fails
        fs.copyFileSync(historyPath, tempFilePath);
      }
    } else {
      // On other platforms, try direct copy
      fs.copyFileSync(historyPath, tempFilePath);
    }

    return tempFilePath;
  } catch (error) {
    console.error(`Error copying ${browser} history file:`, error);
    return null;
  }
}

// Get page title and favicon from URL
async function getPageInfo(url: string): Promise<{ title: string, favicon: string | null }> {
  try {
    // Skip non-HTTP URLs
    if (!url.startsWith('http')) {
      return { title: url, favicon: null };
    }

    // Try to fetch the page and extract the title and favicon
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    // Get title
    const title = document.title || url;

    // Get favicon
    let favicon = null;

    // Try to find favicon in different ways
    // 1. Look for link with rel="icon" or rel="shortcut icon"
    const iconLink = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (iconLink && iconLink.getAttribute('href')) {
      favicon = iconLink.getAttribute('href');
    }

    // 2. If not found, look for apple-touch-icon
    if (!favicon) {
      const appleIconLink = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleIconLink && appleIconLink.getAttribute('href')) {
        favicon = appleIconLink.getAttribute('href');
      }
    }

    // 3. If still not found, try the default /favicon.ico
    if (!favicon) {
      try {
        const urlObj = new URL(url);
        favicon = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;

        // Check if favicon exists
        const faviconResponse = await axios.head(favicon, { timeout: 2000 });
        if (faviconResponse.status !== 200) {
          favicon = null;
        }
      } catch (error) {
        favicon = null;
      }
    }

    // Make favicon URL absolute if it's relative
    if (favicon && !favicon.startsWith('http') && !favicon.startsWith('data:')) {
      try {
        const urlObj = new URL(url);
        if (favicon.startsWith('/')) {
          favicon = `${urlObj.protocol}//${urlObj.hostname}${favicon}`;
        } else {
          // Handle relative paths without leading slash
          const path = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
          favicon = `${urlObj.protocol}//${urlObj.hostname}${path}${favicon}`;
        }
      } catch (error) {
        console.error('Error making favicon URL absolute:', error);
      }
    }

    return { title, favicon };
  } catch (error) {
    // If we can't fetch the page, just return the URL
    return { title: url, favicon: null };
  }
}

// Get page title from URL (for backward compatibility)
async function getPageTitle(url: string): Promise<string> {
  const { title } = await getPageInfo(url);
  return title;
}

// Define history row interface
interface ChromiumHistoryRow {
  url: string;
  title: string;
  last_visit_time: number;
  visit_duration: number;
}

// Query Chrome/Edge history database
async function queryChromiumHistory(dbPath: string, limit = 10): Promise<any[]> {
  try {
    const db = new Database(dbPath, { readonly: true });

    const query = `
      SELECT
        urls.url,
        urls.title,
        urls.last_visit_time,
        visits.visit_duration
      FROM urls
      JOIN visits ON urls.id = visits.url
      ORDER BY urls.last_visit_time DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(limit) as ChromiumHistoryRow[];
    db.close();

    // Convert Chrome's timestamp (microseconds since Jan 1, 1601) to JS timestamp
    return rows.map(row => ({
      url: row.url,
      title: row.title || row.url,
      // Chrome timestamp is microseconds since Jan 1, 1601 UTC
      // Need to convert to milliseconds since Jan 1, 1970 UTC
      timestamp: new Date((row.last_visit_time / 1000) - 11644473600000),
      duration: Math.floor(row.visit_duration / 1000000) || 0, // Convert microseconds to seconds
      source: 'chrome'
    }));
  } catch (error) {
    console.error('Error querying Chromium history:', error);
    return [];
  }
}

// Define Firefox history row interface
interface FirefoxHistoryRow {
  url: string;
  title: string;
  visit_date: number;
  visit_type: number;
}

// Query Firefox history database
async function queryFirefoxHistory(dbPath: string, limit = 10): Promise<any[]> {
  try {
    const db = new Database(dbPath, { readonly: true });

    const query = `
      SELECT
        p.url,
        p.title,
        h.visit_date,
        h.visit_type
      FROM moz_places p
      JOIN moz_historyvisits h ON p.id = h.place_id
      ORDER BY h.visit_date DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(limit) as FirefoxHistoryRow[];
    db.close();

    // Convert Firefox's timestamp (microseconds since Jan 1, 1970) to JS timestamp
    return rows.map(row => ({
      url: row.url,
      title: row.title || row.url,
      // Firefox timestamp is microseconds since Jan 1, 1970 UTC
      timestamp: new Date(row.visit_date / 1000),
      duration: 0, // Firefox doesn't store duration
      source: 'firefox'
    }));
  } catch (error) {
    console.error('Error querying Firefox history:', error);
    return [];
  }
}

// Get recent browser history
async function getRecentBrowserHistory(browser: string, limit = 10): Promise<any[]> {
  try {
    // Copy history file to temp directory
    const historyFilePath = await copyBrowserHistoryFile(browser);

    if (!historyFilePath) {
      return [];
    }

    // Query history based on browser type
    let history = [];
    if (browser === 'chrome' || browser === 'edge') {
      history = await queryChromiumHistory(historyFilePath, limit);
    } else if (browser === 'firefox') {
      history = await queryFirefoxHistory(historyFilePath, limit);
    }

    // Clean up temp file
    try {
      fs.unlinkSync(historyFilePath);
    } catch (error) {
      console.error(`Error deleting temp history file ${historyFilePath}:`, error);
    }

    return history;
  } catch (error) {
    console.error(`Error getting ${browser} history:`, error);
    return [];
  }
}

// Define browser history entry interface
interface BrowserHistoryEntry {
  url: string;
  title: string;
  timestamp: Date;
  duration: number;
  source: string;
}

// Check current browser URL by scanning browser history
async function checkCurrentBrowserUrl() {
  try {
    const currentTime = new Date();
    let latestUrl = '';
    let latestTimestamp = new Date(0); // Jan 1, 1970
    let latestTitle = '';
    let source = '';
    let favicon = null;

    // Check each supported browser
    for (const browser of Object.keys(browserSupport)) {
      if (browserSupport[browser]) {
        const history = await getRecentBrowserHistory(browser, 1);
        if (history.length > 0) {
          const entry = history[0] as BrowserHistoryEntry;
          if (entry.timestamp > latestTimestamp) {
            latestUrl = entry.url;
            latestTimestamp = entry.timestamp;
            latestTitle = entry.title;
            source = browser;
          }
        }
      }
    }

    // If we found a URL and it's different from the last one
    if (latestUrl && lastUrlStartTime) {
      // Only process if URL changed or it's been a while since last update
      const timeSinceLastUpdate = currentTime.getTime() - lastUrlStartTime.getTime();
      const urlChanged = lastUrl !== latestUrl;

      if (urlChanged && timeSinceLastUpdate > 1000) {
        // Calculate duration for the previous URL
        const duration = timeSinceLastUpdate;

        // Try to get a better title and favicon if needed
        let title = lastTitle || lastUrl;
        if (title === lastUrl) {
          try {
            const pageInfo = await getPageInfo(lastUrl);
            title = pageInfo.title;
            favicon = pageInfo.favicon;
          } catch (error) {
            console.error('Error getting page info:', error);
          }
        }

        // Check if URL should be excluded based on settings
        const settings = settingsManager?.getSettings?.() || {};
        const shouldExclude = settings.privacy?.excludedWebsites?.some((domain: string) => {
          try {
            const urlObj = new URL(lastUrl);
            return urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain);
          } catch (error) {
            return false;
          }
        });

        if (!shouldExclude) {
          // Save to database
          await WebHistory.create({
            url: lastUrl,
            title: title,
            timestamp: lastUrlStartTime,
            duration: Math.floor(duration / 1000), // Convert to seconds
            metadata: {
              source: lastSource || 'unknown',
              favicon: favicon
            }
          });

          console.log(`Recorded web history: ${lastUrl} (${duration}ms)`);
        } else {
          console.log(`Excluded web history: ${lastUrl}`);
        }
      }
    }

    // Update last URL and start time if we have a new URL
    if (latestUrl) {
      lastUrl = latestUrl;
      lastTitle = latestTitle;
      lastSource = source;
      lastUrlStartTime = currentTime;
    }
  } catch (error) {
    console.error('Error checking browser URL:', error);
  }
}

// Stop web history tracking
export async function stopWebHistoryTracking(): Promise<ApiResponse<any>> {
  if (!isTracking) {
    return { success: true, message: 'Not tracking' };
  }

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  try {
    // Record the last URL if there is one
    if (lastUrl && lastUrlStartTime) {
      const currentTime = new Date();
      const duration = currentTime.getTime() - lastUrlStartTime.getTime();

      // Only record if duration is significant (more than 1 second)
      if (duration > 1000) {
        // Try to get a better title and favicon if needed
        let title = lastTitle || lastUrl;
        let favicon = null;

        if (title === lastUrl) {
          try {
            const pageInfo = await getPageInfo(lastUrl);
            title = pageInfo.title;
            favicon = pageInfo.favicon;
          } catch (error) {
            console.error('Error getting page info:', error);
          }
        }

        // Check if URL should be excluded based on settings
        const settings = settingsManager?.getSettings?.() || {};
        const shouldExclude = settings.privacy?.excludedWebsites?.some((domain: string) => {
          try {
            const urlObj = new URL(lastUrl);
            return urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain);
          } catch (error) {
            return false;
          }
        });

        if (!shouldExclude) {
          await WebHistory.create({
            url: lastUrl,
            title: title,
            timestamp: lastUrlStartTime,
            duration: Math.floor(duration / 1000),
            metadata: {
              source: lastSource || 'unknown',
              favicon: favicon
            }
          }).catch(error => {
            console.error('Error recording final web history entry:', error);
          });
        } else {
          console.log(`Excluded final web history: ${lastUrl}`);
        }
      }
    }

    isTracking = false;
    lastUrl = '';
    lastTitle = '';
    lastSource = '';
    lastUrlStartTime = null;

    // Clean up temp directory
    try {
      const tempFiles = fs.readdirSync(tempDir);
      for (const file of tempFiles) {
        if (file.includes('history')) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp directory:', error);
    }

    // Emit event
    events.emit(EVENTS.RECORDING.STATUS_CHANGE, { module: 'web-history', isRecording: false });

    console.log('Web history tracking stopped');
    return { success: true, message: 'Web history tracking stopped' };
  } catch (error) {
    console.error('Error stopping web history tracking:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_STOP_RECORDING,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get recent web history
export async function getRecentWebHistory(limit = 50, options: any = {}): Promise<ApiResponse<any>> {
  try {
    const query: any = {
      order: [['timestamp', 'DESC']],
      limit
    };

    // Add where clause if provided
    if (options.where) {
      query.where = options.where;
    }

    // Add include if provided
    if (options.include) {
      query.include = options.include;
    }

    // Get history from database
    const history = await WebHistory.findAll(query);

    return {
      success: true,
      message: `Retrieved ${history.length} web history entries`,
      data: { history }
    };
  } catch (error) {
    console.error('Error fetching web history:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_BROWSER_HISTORY,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { history: [] }
    };
  }
}

// Get raw browser history (not from our database)
export async function getRawBrowserHistory(browser: string, limit = 50): Promise<ApiResponse<any>> {
  try {
    // Check if browser is supported
    if (!browserSupport[browser]) {
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_GET_BROWSER_HISTORY,
        message: `Browser ${browser} is not supported or not installed`
      };
    }

    // Get history from browser
    const history = await getRecentBrowserHistory(browser, limit);

    return {
      success: true,
      message: `Retrieved ${history.length} entries from ${browser} history`,
      data: { history }
    };
  } catch (error) {
    console.error(`Error fetching raw ${browser} history:`, error);
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_BROWSER_HISTORY,
      message: error instanceof Error ? error.message : `Failed to fetch ${browser} history`,
      data: { history: [] }
    };
  }
}

// Set up IPC handlers
export function setupWebHistoryHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    // 하드코딩된 채널명 사용
    const webHistoryChannels = [
      'web-history:start',
      'web-history:stop',
      'web-history:get',
      'web-history:get-raw',
      'web-history:check-browsers',
      'web-history:get-page-title',
      'web-history:get-page-info',
      'web-history:delete',
      'web-history:delete-all',
      'web-history:get-by-date'
    ];

    webHistoryChannels.forEach(channel => {
      ipcMain.removeHandler(channel);
    });
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('web-history:start', async (_event, interval) => {
    return await startWebHistoryTracking(interval);
  });

  ipcMain.handle('web-history:stop', async () => {
    return await stopWebHistoryTracking();
  });

  ipcMain.handle('web-history:get', async (_event, limit) => {
    return await getRecentWebHistory(limit);
  });

  // Add handler for getting raw browser history
  ipcMain.handle('web-history:get-raw', async (_event, data) => {
    const { browser, limit } = data;
    return await getRawBrowserHistory(browser, limit);
  });

  // Add handler for checking which browsers are supported
  ipcMain.handle('web-history:check-browsers', async () => {
    await checkBrowserSupport();
    return {
      success: true,
      message: 'Browser support checked',
      data: { browsers: browserSupport }
    };
  });

  // Add handler for getting page title
  ipcMain.handle('web-history:get-page-title', async (_event, url) => {
    try {
      const title = await getPageTitle(url);
      return {
        success: true,
        message: 'Page title retrieved',
        data: { title }
      };
    } catch (error) {
      console.error('Error getting page title:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_GET_PAGE_TITLE,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Add handler for getting page info (title and favicon)
  ipcMain.handle('web-history:get-page-info', async (_event, url) => {
    try {
      const pageInfo = await getPageInfo(url);
      return {
        success: true,
        message: 'Page info retrieved',
        data: pageInfo
      };
    } catch (error) {
      console.error('Error getting page info:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_GET_PAGE_INFO,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: { title: url, favicon: null }
      };
    }
  });

  // Add handler for deleting web history
  ipcMain.handle('web-history:delete', async (_event, id) => {
    try {
      const entry = await WebHistory.findByPk(id);
      if (!entry) {
        return {
          success: false,
          error: ERROR_MESSAGES.WEB_HISTORY_NOT_FOUND,
          message: 'Web history entry not found'
        };
      }

      await entry.destroy();
      return {
        success: true,
        message: 'Web history entry deleted'
      };
    } catch (error) {
      console.error('Error deleting web history:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_DELETE_WEB_HISTORY,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Add handler for deleting all web history
  ipcMain.handle('web-history:delete-all', async () => {
    try {
      const count = await WebHistory.destroy({ where: {} });
      return {
        success: true,
        message: `Deleted ${count} web history entries`
      };
    } catch (error) {
      console.error('Error deleting all web history:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_DELETE_ALL_WEB_HISTORY,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Add handler for getting web history by date range
  ipcMain.handle('web-history:get-by-date', async (_event, data) => {
    try {
      const { startDate, endDate, limit } = data;

      const query: any = {
        order: [['timestamp', 'DESC']],
        where: {}
      };

      if (limit) {
        query.limit = limit;
      }

      if (startDate && endDate) {
        query.where.timestamp = {
          [Symbol.for('gte')]: new Date(startDate),
          [Symbol.for('lte')]: new Date(endDate)
        };
      } else if (startDate) {
        query.where.timestamp = {
          [Symbol.for('gte')]: new Date(startDate)
        };
      } else if (endDate) {
        query.where.timestamp = {
          [Symbol.for('lte')]: new Date(endDate)
        };
      }

      const history = await WebHistory.findAll(query);
      return {
        success: true,
        message: `Retrieved ${history.length} web history entries by date`,
        data: { history }
      };
    } catch (error) {
      console.error('Error fetching web history by date:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_GET_WEB_HISTORY_BY_DATE,
        message: error instanceof Error ? error.message : 'Unknown error',
        data: { history: [] }
      };
    }
  });
}
