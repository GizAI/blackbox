import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Settings } from '../../database/models';

// Default settings
export const DEFAULT_SETTINGS = {
  // Recording settings
  recording: {
    screenshotInterval: 10000, // 10 seconds
    webHistoryInterval: 5000, // 5 seconds
    appMonitorInterval: 1000, // 1 second
    autoStart: true,
    captureScreenshots: true,
    captureAudio: true,
    captureWebHistory: true,
    captureAppUsage: true,
    silenceDetection: true,
    silenceThreshold: 0.05,
    maxSilenceDuration: 3000, // 3 seconds
  },

  // Storage settings
  storage: {
    screenshotQuality: 75, // 0-100
    screenshotFormat: 'webp',
    audioFormat: 'wav',
    maxStorageSize: 10 * 1024 * 1024 * 1024, // 10 GB
    storageLocation: path.join(app.getPath('userData')),
    retentionPeriod: 30, // days
    enableEncryption: false,
    encryptionKey: '',
  },

  // AI settings
  ai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
    generateDailySummary: true,
    generateWeeklySummary: true,
    autoProcessScreenshots: true,
    autoTranscribeAudio: true,
  },

  // UI settings
  ui: {
    theme: 'system', // system, light, dark
    language: 'en',
    startMinimized: false,
    showNotifications: true,
    timelineView: 'compact', // compact, detailed
  },

  // Privacy settings
  privacy: {
    enablePasswordProtection: false,
    password: '',
    excludedApps: [],
    excludedWebsites: [],
    sensitiveKeywords: [],
  },

  // System settings
  system: {
    startOnBoot: false,
    checkForUpdates: true,
    sendAnonymousUsageData: false,
    debugMode: false,
  }
};

// Settings manager
class SettingsManager {
  private settings: any = { ...DEFAULT_SETTINGS };
  private initialized: boolean = false;

  constructor() {
    this.loadSettings();
  }

  // Initialize settings
  async loadSettings() {
    try {
      // Load settings from database
      const dbSettings = await Settings.findAll();

      // Convert to object
      const settingsObj: any = {};
      for (const setting of dbSettings) {
        try {
          let value = setting.value;

          // Only try to parse if it's a string that looks like JSON
          if (typeof value === 'string' &&
              (value.startsWith('{') || value.startsWith('[') ||
               value === 'true' || value === 'false' ||
               /^\d+(\.\d+)?$/.test(value) || value === 'null')) {
            try {
              value = JSON.parse(value);
            } catch {
              // If parsing fails, keep the original string value
            }
          }

          // Handle nested settings
          if (setting.key.includes('.')) {
            const [category, key] = setting.key.split('.');
            if (!settingsObj[category]) {
              settingsObj[category] = {};
            }
            settingsObj[category][key] = value;
          } else {
            settingsObj[setting.key] = value;
          }
        } catch (error) {
          console.error(`Error parsing setting ${setting.key}:`, error);
        }
      }

      // Merge with default settings
      this.settings = this.mergeSettings(DEFAULT_SETTINGS, settingsObj);
      this.initialized = true;

      console.log('Settings loaded');
    } catch (error) {
      console.error('Error loading settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
      this.initialized = true;
    }
  }

  // Merge settings with defaults
  private mergeSettings(defaults: any, userSettings: any): any {
    const result = { ...defaults };

    for (const key in userSettings) {
      if (typeof userSettings[key] === 'object' && !Array.isArray(userSettings[key]) &&
          typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        // Recursively merge nested objects
        result[key] = this.mergeSettings(defaults[key], userSettings[key]);
      } else if (userSettings[key] !== undefined) {
        // Use user setting if defined
        result[key] = userSettings[key];
      }
    }

    return result;
  }

  // Save settings to database
  async saveSettings(newSettings?: any) {
    try {
      if (newSettings) {
        // Merge with current settings
        this.settings = this.mergeSettings(this.settings, newSettings);
      }

      // Save to database
      for (const category in this.settings) {
        if (typeof this.settings[category] === 'object' && !Array.isArray(this.settings[category])) {
          // Save category settings
          for (const key in this.settings[category]) {
            const value = this.settings[category][key];
            // Convert non-string values to JSON strings
            const storedValue = typeof value === 'string' ? value : JSON.stringify(value);

            await Settings.upsert({
              key: `${category}.${key}`,
              value: storedValue
            });
          }
        } else {
          // Save top-level settings
          const value = this.settings[category];
          // Convert non-string values to JSON strings
          const storedValue = typeof value === 'string' ? value : JSON.stringify(value);

          await Settings.upsert({
            key: category,
            value: storedValue
          });
        }
      }

      console.log('Settings saved');
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: 'Failed to save settings' };
    }
  }

  // Get all settings
  getSettings() {
    return { ...this.settings };
  }

  // Get specific setting
  getSetting(key: string) {
    if (key.includes('.')) {
      const [category, subKey] = key.split('.');
      return this.settings[category]?.[subKey];
    }
    return this.settings[key];
  }

  // Update specific setting
  async updateSetting(key: string, value: any) {
    try {
      if (key.includes('.')) {
        const [category, subKey] = key.split('.');
        if (!this.settings[category]) {
          this.settings[category] = {};
        }
        this.settings[category][subKey] = value;

        // Convert non-string values to JSON strings
        const storedValue = typeof value === 'string' ? value : JSON.stringify(value);

        // Save to database
        await Settings.upsert({
          key: key,
          value: storedValue
        });
      } else {
        this.settings[key] = value;

        // Convert non-string values to JSON strings
        const storedValue = typeof value === 'string' ? value : JSON.stringify(value);

        // Save to database
        await Settings.upsert({
          key: key,
          value: storedValue
        });
      }

      return { success: true };
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error);
      return { success: false, error: `Failed to update setting ${key}` };
    }
  }

  // Reset settings to defaults
  async resetSettings() {
    try {
      this.settings = { ...DEFAULT_SETTINGS };

      // Clear database settings
      await Settings.destroy({ where: {} });

      // Save defaults to database
      await this.saveSettings();

      return { success: true };
    } catch (error) {
      console.error('Error resetting settings:', error);
      return { success: false, error: 'Failed to reset settings' };
    }
  }

  // Encrypt sensitive data
  encryptData(data: string, key?: string): string {
    try {
      const encryptionKey = key || this.settings.storage.encryptionKey;
      if (!encryptionKey) {
        return data; // No encryption if no key
      }

      // Create key from password
      const derivedKey = crypto.scryptSync(encryptionKey, 'salt', 32);

      // Create initialization vector
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encrypting data:', error);
      return data;
    }
  }

  // Decrypt sensitive data
  decryptData(encryptedData: string, key?: string): string {
    try {
      const encryptionKey = key || this.settings.storage.encryptionKey;
      if (!encryptionKey || !encryptedData.includes(':')) {
        return encryptedData; // No encryption if no key or invalid format
      }

      // Split IV and encrypted data
      const [ivHex, encrypted] = encryptedData.split(':');

      // Create key from password
      const derivedKey = crypto.scryptSync(encryptionKey, 'salt', 32);

      // Create initialization vector
      const iv = Buffer.from(ivHex, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);

      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting data:', error);
      return encryptedData;
    }
  }

  // Generate encryption key
  generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate password
  validatePassword(password: string): boolean {
    if (!this.settings.privacy.enablePasswordProtection) {
      return true; // No password protection
    }

    return password === this.settings.privacy.password;
  }

  // Check if app should be excluded
  isAppExcluded(appName: string): boolean {
    return this.settings.privacy.excludedApps.includes(appName);
  }

  // Check if website should be excluded
  isWebsiteExcluded(url: string): boolean {
    try {
      const domain = new URL(url).hostname;
      return this.settings.privacy.excludedWebsites.some((excluded: string) =>
        domain === excluded || domain.endsWith('.' + excluded));
    } catch (error) {
      return false;
    }
  }

  // Check if content contains sensitive keywords
  containsSensitiveKeywords(content: string): boolean {
    if (!content || !this.settings.privacy.sensitiveKeywords.length) {
      return false;
    }

    return this.settings.privacy.sensitiveKeywords.some((keyword: string) =>
      content.toLowerCase().includes(keyword.toLowerCase()));
  }
}

// Create settings manager instance
const settingsManager = new SettingsManager();

// Set up IPC handlers
export function setupSettingsHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('settings:get');
    ipcMain.removeHandler('settings:save');
    ipcMain.removeHandler('settings:reset');
    ipcMain.removeHandler('settings:update');
    ipcMain.removeHandler('settings:validate-password');
    ipcMain.removeHandler('settings:generate-encryption-key');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('settings:get', async () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    return await settingsManager.saveSettings(settings);
  });

  ipcMain.handle('settings:reset', async () => {
    return await settingsManager.resetSettings();
  });

  ipcMain.handle('settings:update', async (_event, data) => {
    const { key, value } = data;
    return await settingsManager.updateSetting(key, value);
  });

  ipcMain.handle('settings:validate-password', (_event, password) => {
    return { success: settingsManager.validatePassword(password) };
  });

  ipcMain.handle('settings:generate-encryption-key', () => {
    return { success: true, key: settingsManager.generateEncryptionKey() };
  });
}

// Export settings manager
export default settingsManager;
