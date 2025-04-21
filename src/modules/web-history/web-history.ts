import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebHistory } from '../../database/models';

// Configuration
let isTracking = false;
let trackingInterval: NodeJS.Timeout | null = null;
const DEFAULT_INTERVAL = 5000; // 5 seconds
let currentInterval = DEFAULT_INTERVAL;
let lastUrl = '';
let lastUrlStartTime: Date | null = null;

// Browser history file paths for different browsers and platforms
const historyPaths = {
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
export function startWebHistoryTracking(interval = DEFAULT_INTERVAL) {
  if (isTracking) return;
  
  currentInterval = interval;
  isTracking = true;
  
  // Set up interval for regular checks
  trackingInterval = setInterval(async () => {
    await checkCurrentBrowserUrl();
  }, currentInterval);
  
  console.log(`Web history tracking started with interval: ${currentInterval}ms`);
}

// Check current browser URL
// Note: This is a simplified implementation. In a real application,
// we would need to use browser-specific APIs or extensions to get the actual current URL.
// For demonstration purposes, we'll simulate by checking browser history files.
async function checkCurrentBrowserUrl() {
  try {
    // In a real implementation, we would get the actual current URL from browsers
    // For now, we'll simulate by generating a random URL for demonstration
    const currentTime = new Date();
    
    // Simulate getting current URL (in a real app, this would come from browser APIs)
    const simulatedUrls = [
      'https://www.google.com',
      'https://www.github.com',
      'https://www.stackoverflow.com',
      'https://www.youtube.com',
      'https://www.reddit.com'
    ];
    const randomIndex = Math.floor(Math.random() * simulatedUrls.length);
    const currentUrl = simulatedUrls[randomIndex];
    
    // If URL changed, record the previous one with duration
    if (lastUrl && lastUrl !== currentUrl && lastUrlStartTime) {
      const duration = currentTime.getTime() - lastUrlStartTime.getTime();
      
      // Save to database
      await WebHistory.create({
        url: lastUrl,
        title: `Visit to ${lastUrl}`, // In a real app, we would get the actual page title
        timestamp: lastUrlStartTime,
        duration: Math.floor(duration / 1000), // Convert to seconds
        metadata: { source: 'simulation' }
      });
      
      console.log(`Recorded web history: ${lastUrl} (${duration}ms)`);
    }
    
    // Update last URL and start time
    lastUrl = currentUrl;
    lastUrlStartTime = currentTime;
  } catch (error) {
    console.error('Error checking browser URL:', error);
  }
}

// Stop web history tracking
export function stopWebHistoryTracking() {
  if (!isTracking) return;
  
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  
  // Record the last URL if there is one
  if (lastUrl && lastUrlStartTime) {
    const currentTime = new Date();
    const duration = currentTime.getTime() - lastUrlStartTime.getTime();
    
    WebHistory.create({
      url: lastUrl,
      title: `Visit to ${lastUrl}`,
      timestamp: lastUrlStartTime,
      duration: Math.floor(duration / 1000),
      metadata: { source: 'simulation' }
    }).catch(error => {
      console.error('Error recording final web history entry:', error);
    });
  }
  
  isTracking = false;
  lastUrl = '';
  lastUrlStartTime = null;
  
  console.log('Web history tracking stopped');
}

// Get recent web history
export async function getRecentWebHistory(limit = 50) {
  try {
    const history = await WebHistory.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });
    
    return history;
  } catch (error) {
    console.error('Error fetching web history:', error);
    return [];
  }
}

// Set up IPC handlers
export function setupWebHistoryHandlers() {
  ipcMain.handle('web-history:start', (event, interval) => {
    startWebHistoryTracking(interval);
    return true;
  });
  
  ipcMain.handle('web-history:stop', () => {
    stopWebHistoryTracking();
    return true;
  });
  
  ipcMain.handle('web-history:get', async (event, limit) => {
    return await getRecentWebHistory(limit);
  });
}
