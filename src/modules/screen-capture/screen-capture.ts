import { app, ipcMain, screen, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as os from 'os';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { Screenshot } from '../../database/models';
import settingsManager from '../settings/settings';
import aiManager from '../ai-integration/ai-integration';

// Import axios for HTTP requests
const axios = require('axios');

// Configuration
let isCapturing = false;
let captureInterval: NodeJS.Timeout | null = null;
const DEFAULT_INTERVAL = 10000; // 10 seconds
let currentInterval = DEFAULT_INTERVAL;
let lastImageHash: string | null = null;

// Screenshot settings interface
interface ScreenshotSettings {
  interval: number;
  quality: number;
  format: 'webp' | 'jpeg' | 'png';
  captureAllMonitors: boolean;
  skipSimilarImages: boolean;
  similarityThreshold: number;
  autoDescribe: boolean;
  maxWidth: number | null;
  maxHeight: number | null;
}

// Default screenshot settings
const defaultSettings: ScreenshotSettings = {
  interval: DEFAULT_INTERVAL,
  quality: 75,
  format: 'webp',
  captureAllMonitors: true,
  skipSimilarImages: true,
  similarityThreshold: 0.95,
  autoDescribe: true,
  maxWidth: 1920,
  maxHeight: 1080
};

// Get screenshot settings from settings manager
function getScreenshotSettings(): ScreenshotSettings {
  try {
    const settings = settingsManager.getSettings();
    const storageSettings = settings.storage || {};

    return {
      interval: settings.recording?.screenshotInterval || defaultSettings.interval,
      quality: storageSettings.screenshotQuality || defaultSettings.quality,
      format: storageSettings.screenshotFormat || defaultSettings.format,
      captureAllMonitors: settings.recording?.captureAllMonitors !== undefined ?
        settings.recording.captureAllMonitors : defaultSettings.captureAllMonitors,
      skipSimilarImages: settings.recording?.skipSimilarImages !== undefined ?
        settings.recording.skipSimilarImages : defaultSettings.skipSimilarImages,
      similarityThreshold: settings.recording?.similarityThreshold || defaultSettings.similarityThreshold,
      autoDescribe: settings.ai?.autoProcessScreenshots !== undefined ?
        settings.ai.autoProcessScreenshots : defaultSettings.autoDescribe,
      maxWidth: storageSettings.maxScreenshotWidth || defaultSettings.maxWidth,
      maxHeight: storageSettings.maxScreenshotHeight || defaultSettings.maxHeight
    };
  } catch (error) {
    console.error('Error getting screenshot settings:', error);
    return defaultSettings;
  }
}

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
  try {
    // Resize to tiny thumbnail for quick comparison
    const thumbnail = await sharp(buffer)
      .resize(32, 32, { fit: 'cover' })
      .grayscale()
      .raw()
      .toBuffer();

    // Use crypto for more reliable hash
    return crypto.createHash('sha256').update(thumbnail).digest('hex');
  } catch (error) {
    console.error('Error calculating image hash:', error);
    // Fallback to a simpler method if sharp fails
    return crypto.createHash('md5').update(buffer).digest('hex');
  }
}

// Store last few image hashes to detect patterns and avoid duplicates
const recentImageHashes: string[] = [];
const MAX_RECENT_HASHES = 10;

// Check if image is significantly different from recent ones
async function isSignificantlyDifferent(buffer: Buffer): Promise<boolean> {
  try {
    // Calculate hash of current image
    const currentHash = await calculateImageHash(buffer);

    // If we have no history, this is a new image
    if (recentImageHashes.length === 0) {
      recentImageHashes.push(currentHash);
      lastImageHash = currentHash;
      return true;
    }

    // Check if current image is too similar to any recent ones
    // For now, we're using exact hash matching, but this could be improved
    // with perceptual hashing algorithms for fuzzy matching
    const isDifferent = !recentImageHashes.includes(currentHash);

    // If it's different, add to recent hashes
    if (isDifferent) {
      recentImageHashes.push(currentHash);
      // Keep only the most recent hashes
      if (recentImageHashes.length > MAX_RECENT_HASHES) {
        recentImageHashes.shift();
      }
      lastImageHash = currentHash;
    }

    return isDifferent;
  } catch (error) {
    console.error('Error checking image difference:', error);
    // If we can't compare, assume it's different to be safe
    return true;
  }
}

// Generate image description using Vision Language Model
async function generateImageDescription(filePath: string): Promise<string> {
  try {
    // Get AI provider settings from settings manager
    const settings = settingsManager.getSettings();
    const aiSettings = settings.ai || {};

    // Check if AI is configured
    if (!aiSettings.provider || !aiSettings.apiKey) {
      console.log('Invalid AI provider configuration');
      return 'Invalid AI provider configuration';
    }

    const aiProvider = {
      provider: aiSettings.provider,
      apiKey: aiSettings.apiKey,
      model: aiSettings.model || (aiSettings.provider === 'openai' ? 'gpt-4o' : 'gemini-pro-vision')
    };

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return 'Image file not found';
    }

    // Convert image to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    // Generate description based on provider
    try {
      if (aiProvider.provider === 'openai') {
        return await describeImageWithOpenAI(base64Image, aiProvider.apiKey, aiProvider.model);
      } else if (aiProvider.provider === 'gemini') {
        return await describeImageWithGemini(base64Image, aiProvider.apiKey);
      } else {
        return `Unsupported AI provider: ${aiProvider.provider}`;
      }
    } catch (providerError) {
      console.error(`Error with ${aiProvider.provider} image description:`, providerError);
      return `Error with ${aiProvider.provider} image description. Please check your API key and settings.`;
    }
  } catch (error) {
    console.error('Error generating image description:', error);
    return 'Error generating image description';
  }
}

// Describe image with OpenAI Vision API
async function describeImageWithOpenAI(base64Image: string, apiKey: string, model: string = 'gpt-4-vision-preview'): Promise<string> {
  try {
    // Use the appropriate model
    const visionModel = model.includes('vision') ? model : 'gpt-4-vision-preview';

    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe what you see in this screenshot in detail. Focus on the main content, applications, and any text visible. If you see any sensitive information like passwords, credit card numbers, or personal data, mention that there is sensitive information but do not repeat the actual data.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.5
      }
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      return 'No description generated';
    }
  } catch (error) {
    console.error('Error describing image with OpenAI:', error);
    return 'Error generating description with OpenAI';
  }
}

// Describe image with Google Gemini Vision API
async function describeImageWithGemini(base64Image: string, apiKey: string, model: string = 'gemini-pro-vision'): Promise<string> {
  try {
    // Use the appropriate model
    const visionModel = model.includes('vision') ? model : 'gemini-pro-vision';

    const response = await axios({
      method: 'post',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${visionModel}:generateContent?key=${apiKey}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        contents: [
          {
            parts: [
              {
                text: 'Describe what you see in this screenshot in detail. Focus on the main content, applications, and any text visible. If you see any sensitive information like passwords, credit card numbers, or personal data, mention that there is sensitive information but do not repeat the actual data.'
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.5
        }
      }
    });

    if (response.data && response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      return 'No description generated';
    }
  } catch (error) {
    console.error('Error describing image with Gemini:', error);
    return 'Error generating description with Gemini';
  }
}

// Get all displays
function getAllDisplays() {
  return screen.getAllDisplays();
}

// Capture screenshot of a specific display
async function captureDisplayScreenshot(display: Electron.Display): Promise<Buffer | null> {
  try {
    const { id, bounds } = display;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: bounds.width, height: bounds.height }
    });

    // Find the source for this display
    const source = sources.find(s => {
      // Try to match by display ID or position
      return s.display_id === id.toString() ||
        (s.thumbnail.getSize().width === bounds.width &&
         s.thumbnail.getSize().height === bounds.height);
    });

    if (!source) {
      console.error(`No source found for display ${id}`);
      return null;
    }

    // Get the thumbnail as buffer
    return source.thumbnail.toPNG();
  } catch (error) {
    console.error(`Error capturing display ${display.id}:`, error);
    return null;
  }
}

// Capture all displays
async function captureAllDisplays(): Promise<Buffer[]> {
  try {
    const displays = getAllDisplays();
    const buffers: Buffer[] = [];

    for (const display of displays) {
      const buffer = await captureDisplayScreenshot(display);
      if (buffer) {
        buffers.push(buffer);
      }
    }

    return buffers;
  } catch (error) {
    console.error('Error capturing all displays:', error);
    return [];
  }
}

// Capture and save screenshot
async function captureScreen() {
  try {
    // Get screenshot settings
    const settings = getScreenshotSettings();

    // Capture screenshot
    let buffer: Buffer | null = null;
    let displayInfo: any = null;
    let captureMethod = '';

    // Try multiple capture methods in sequence until one works
    const captureAttempts = [
      // Method 1: Electron's desktopCapturer API for multi-monitor support
      async () => {
        if (settings.captureAllMonitors) {
          const displays = getAllDisplays();
          if (displays.length > 0) {
            const buffers = await captureAllDisplays();
            if (buffers.length > 0) {
              captureMethod = 'electron-desktop-capturer';
              return {
                buffer: buffers[0],
                info: {
                  count: displays.length,
                  captured: buffers.length,
                  primary: displays[0].id,
                  displays: displays.map(d => ({ id: d.id, width: d.bounds.width, height: d.bounds.height }))
                }
              };
            }
          }
        }
        return null;
      },

      // Method 2: screenshot-desktop library
      async () => {
        try {
          const buf = await screenshot();
          if (buf) {
            captureMethod = 'screenshot-desktop';
            return {
              buffer: buf,
              info: { method: 'screenshot-desktop' }
            };
          }
        } catch (e) {
          console.log('screenshot-desktop method failed:', e);
        }
        return null;
      },

      // Method 3: Fallback to a simpler approach if available
      async () => {
        try {
          // Try to use a simpler method as last resort
          // This could be implemented with other libraries or native methods
          captureMethod = 'fallback-method';
          // For now, just return null as we don't have a third method implemented
        } catch (e) {
          console.log('Fallback capture method failed:', e);
        }
        return null;
      }
    ];

    // Try each capture method in sequence
    for (const attempt of captureAttempts) {
      try {
        const result = await attempt();
        if (result && result.buffer) {
          buffer = result.buffer;
          displayInfo = result.info;
          console.log(`Screenshot captured successfully using method: ${captureMethod}`);
          break;
        }
      } catch (error) {
        console.error(`Capture attempt failed:`, error);
        // Continue to next method
      }
    }

    // If all methods failed
    if (!buffer) {
      console.error('All screenshot capture methods failed');
      return null;
    }

    if (!buffer) {
      console.error('No screenshot buffer captured');
      return null;
    }

    // Check if the image is significantly different from the last one
    if (settings.skipSimilarImages) {
      try {
        const isDifferent = await isSignificantlyDifferent(buffer);
        if (!isDifferent) {
          console.log('Screenshot skipped - no significant changes');
          return null;
        }
      } catch (error) {
        console.error('Error comparing screenshots:', error);
        // Continue anyway
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date();
    let filename = `screenshot_${timestamp.getTime()}.${settings.format}`;
    let filePath = path.join(screenshotDir, filename);

    // Process and save the image
    try {
      const sharpInstance = sharp(buffer);

      // Resize if needed
      if (settings.maxWidth || settings.maxHeight) {
        const metadata = await sharpInstance.metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;

        if ((settings.maxWidth && width > settings.maxWidth) ||
            (settings.maxHeight && height > settings.maxHeight)) {
          sharpInstance.resize({
            width: settings.maxWidth || undefined,
            height: settings.maxHeight || undefined,
            fit: 'inside',
            withoutEnlargement: true
          });
        }
      }

      // Convert to the specified format
      switch (settings.format) {
        case 'webp':
          sharpInstance.webp({ quality: settings.quality, effort: 6 });
          break;
        case 'jpeg':
          sharpInstance.jpeg({ quality: settings.quality });
          break;
        case 'png':
          sharpInstance.png({ quality: settings.quality });
          break;
        default:
          sharpInstance.webp({ quality: settings.quality, effort: 6 });
      }

      // Save the file
      await sharpInstance.toFile(filePath);
    } catch (error) {
      console.error(`Error saving image as ${settings.format}:`, error);
      // Try to save as PNG instead
      try {
        filename = `screenshot_${timestamp.getTime()}.png`;
        filePath = path.join(screenshotDir, filename);
        fs.writeFileSync(filePath, buffer);
      } catch (pngError) {
        console.error('Failed to save image as PNG:', pngError);
        return null;
      }
    }

    // Save to database
    let screenshotRecord;
    try {
      screenshotRecord = await Screenshot.create({
        path: filePath,
        timestamp,
        textDescription: '', // Will be filled by VLM later
        metadata: { width: 0, height: 0, displayInfo } // Will be updated with actual dimensions
      });
    } catch (error) {
      console.error('Error saving screenshot to database:', error);
      return null;
    }

    // Get image dimensions and update metadata
    try {
      const metadata = await sharp(buffer).metadata();
      screenshotRecord.metadata = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: fs.statSync(filePath).size,
        displayInfo
      };
      await screenshotRecord.save();
    } catch (error) {
      console.error('Error updating screenshot metadata:', error);
      // Continue anyway
    }

    // Generate image description asynchronously if enabled
    if (settings.autoDescribe) {
      try {
        // Use AI integration module if available
        if (typeof aiManager.processScreenshot === 'function') {
          // Process screenshot in the background
          aiManager.processScreenshot(screenshotRecord.id).then(result => {
            if (result && result.success) {
              console.log(`Screenshot description generated successfully for ID ${screenshotRecord.id}`);
            } else if (result && !result.success) {
              console.log(`Failed to generate screenshot description: ${result.error || 'Unknown error'}`);
            }
          }).catch(error => {
            console.error('Error in AI image description generation:', error);
          });
        } else {
          // Fallback to direct API calls
          generateImageDescription(filePath).then(async (description) => {
            try {
              if (description && screenshotRecord) {
                screenshotRecord.textDescription = description;
                await screenshotRecord.save();
                console.log(`Screenshot description generated: ${description.substring(0, 50)}...`);
              }
            } catch (error) {
              console.error('Error saving screenshot description:', error);
            }
          }).catch(error => {
            console.error('Error in image description generation:', error);
          });
        }
      } catch (error) {
        console.error('Error initiating screenshot description:', error);
        // Continue without description - don't block the screenshot capture process
      }
    }

    console.log(`Screenshot saved: ${filePath}`);
    return screenshotRecord;
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
export async function getRecentScreenshots(limit = 50, options: any = {}) {
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

    const screenshots = await Screenshot.findAll(query);

    return { success: true, screenshots };
  } catch (error) {
    console.error('Error fetching screenshots:', error);
    return { success: false, error: 'Failed to fetch screenshots', screenshots: [] };
  }
}

// Set up IPC handlers
export function setupScreenCaptureHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('screen-capture:start');
    ipcMain.removeHandler('screen-capture:stop');
    ipcMain.removeHandler('screen-capture:get');
    ipcMain.removeHandler('screen-capture:describe');
    ipcMain.removeHandler('screen-capture:take-now');
    ipcMain.removeHandler('screen-capture:get-by-date');
    ipcMain.removeHandler('screen-capture:delete');
    ipcMain.removeHandler('screen-capture:get-displays');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('screen-capture:start', (_event, interval) => {
    startScreenCapture(interval);
    return { success: true };
  });

  ipcMain.handle('screen-capture:stop', () => {
    stopScreenCapture();
    return { success: true };
  });

  ipcMain.handle('screen-capture:get', async (_event, data) => {
    const { limit, options } = data || { limit: 50 };
    return await getRecentScreenshots(limit, options);
  });

  // Add handler for getting screenshots by date range
  ipcMain.handle('screen-capture:get-by-date', async (_event, data) => {
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

      const screenshots = await Screenshot.findAll(query);
      return { success: true, screenshots };
    } catch (error) {
      console.error('Error fetching screenshots by date:', error);
      return { success: false, error: 'Failed to fetch screenshots by date', screenshots: [] };
    }
  });

  // Add handler for deleting a screenshot
  ipcMain.handle('screen-capture:delete', async (_event, id) => {
    try {
      const screenshot = await Screenshot.findByPk(id);
      if (!screenshot) {
        return { success: false, error: 'Screenshot not found' };
      }

      // Delete file if it exists
      if (screenshot.path && fs.existsSync(screenshot.path)) {
        fs.unlinkSync(screenshot.path);
      }

      // Delete from database
      await screenshot.destroy();

      return { success: true };
    } catch (error) {
      console.error('Error deleting screenshot:', error);
      return { success: false, error: 'Failed to delete screenshot' };
    }
  });

  // Add handler for generating description for a specific screenshot
  ipcMain.handle('screen-capture:describe', async (_event, screenshotId) => {
    try {
      // Find the screenshot
      const screenshot = await Screenshot.findByPk(screenshotId);
      if (!screenshot) {
        return { success: false, error: 'Screenshot not found' };
      }

      // Generate description
      const description = await generateImageDescription(screenshot.path);

      // Update the screenshot with the description
      screenshot.textDescription = description;
      await screenshot.save();

      return { success: true, description };
    } catch (error) {
      console.error('Error generating screenshot description:', error);
      return { success: false, error: 'Failed to generate description' };
    }
  });

  // Add handler for taking a screenshot immediately
  ipcMain.handle('screen-capture:take-now', async () => {
    try {
      const screenshot = await captureScreen();
      return { success: !!screenshot, screenshot };
    } catch (error) {
      console.error('Error taking immediate screenshot:', error);
      return { success: false, error: 'Failed to take screenshot' };
    }
  });

  // Add handler for getting all displays
  ipcMain.handle('screen-capture:get-displays', () => {
    try {
      const displays = getAllDisplays();
      return {
        success: true,
        displays: displays.map(d => ({
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor,
          isPrimary: d.id === screen.getPrimaryDisplay().id
        }))
      };
    } catch (error) {
      console.error('Error getting displays:', error);
      return { success: false, error: 'Failed to get displays', displays: [] };
    }
  });
}
