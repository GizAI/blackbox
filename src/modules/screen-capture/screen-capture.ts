import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as screenshot from 'screenshot-desktop';
import * as sharp from 'sharp';
import { Screenshot } from '../../database/models';

// Configuration
let isCapturing = false;
let captureInterval: NodeJS.Timeout | null = null;
const DEFAULT_INTERVAL = 10000; // 10 seconds
let currentInterval = DEFAULT_INTERVAL;
let lastImageHash: string | null = null;

// Directory for storing screenshots
const screenshotDir = path.join(app.getPath('userData'), 'screenshots');

// Ensure screenshot directory exists
function ensureDirectoryExists() {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
}

// Calculate image hash for comparison
async function calculateImageHash(buffer: Buffer): Promise<string> {
  // Resize to tiny thumbnail for quick comparison
  const thumbnail = await sharp(buffer)
    .resize(16, 16, { fit: 'cover' })
    .grayscale()
    .raw()
    .toBuffer();
  
  // Simple hash calculation
  return Buffer.from(thumbnail).toString('base64');
}

// Check if image is significantly different from the last one
async function isSignificantlyDifferent(buffer: Buffer): Promise<boolean> {
  if (!lastImageHash) return true;
  
  const currentHash = await calculateImageHash(buffer);
  const isDifferent = currentHash !== lastImageHash;
  
  if (isDifferent) {
    lastImageHash = currentHash;
  }
  
  return isDifferent;
}

// Capture and save screenshot
async function captureScreen() {
  try {
    // Capture screenshot
    const buffer = await screenshot();
    
    // Check if the image is significantly different from the last one
    const isDifferent = await isSignificantlyDifferent(buffer);
    if (!isDifferent) {
      console.log('Screenshot skipped - no significant changes');
      return null;
    }
    
    // Generate filename with timestamp
    const timestamp = new Date();
    const filename = `screenshot_${timestamp.getTime()}.webp`;
    const filePath = path.join(screenshotDir, filename);
    
    // Convert to WebP for better compression
    await sharp(buffer)
      .webp({ quality: 80 })
      .toFile(filePath);
    
    // Save to database
    const screenshot = await Screenshot.create({
      path: filePath,
      timestamp,
      textDescription: '', // Will be filled by VLM later
      metadata: { width: 0, height: 0 } // Will be updated with actual dimensions
    });
    
    // Get image dimensions and update metadata
    const metadata = await sharp(buffer).metadata();
    screenshot.metadata = { 
      width: metadata.width, 
      height: metadata.height 
    };
    await screenshot.save();
    
    console.log(`Screenshot saved: ${filePath}`);
    return screenshot;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

// Start screen capture
export function startScreenCapture(interval = DEFAULT_INTERVAL) {
  if (isCapturing) return;
  
  ensureDirectoryExists();
  currentInterval = interval;
  isCapturing = true;
  
  // Take initial screenshot
  captureScreen().then(screenshot => {
    if (screenshot) {
      // Notify renderer process about new screenshot
      // This will be implemented later
    }
  });
  
  // Set up interval for regular captures
  captureInterval = setInterval(async () => {
    const screenshot = await captureScreen();
    if (screenshot) {
      // Notify renderer process about new screenshot
      // This will be implemented later
    }
  }, currentInterval);
  
  console.log(`Screen capture started with interval: ${currentInterval}ms`);
}

// Stop screen capture
export function stopScreenCapture() {
  if (!isCapturing) return;
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  isCapturing = false;
  console.log('Screen capture stopped');
}

// Get recent screenshots
export async function getRecentScreenshots(limit = 50) {
  try {
    const screenshots = await Screenshot.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });
    
    return screenshots;
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    return [];
  }
}

// Set up IPC handlers
export function setupScreenCaptureHandlers() {
  ipcMain.handle('screen-capture:start', (event, interval) => {
    startScreenCapture(interval);
    return true;
  });
  
  ipcMain.handle('screen-capture:stop', () => {
    stopScreenCapture();
    return true;
  });
  
  ipcMain.handle('screen-capture:get', async (event, limit) => {
    return await getRecentScreenshots(limit);
  });
}
