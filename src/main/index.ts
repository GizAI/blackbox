import { app } from 'electron';
import { setupScreenCaptureHandlers, startScreenCapture } from '../modules/screen-capture/screen-capture';
import { setupAudioRecorderHandlers, startAudioRecording } from '../modules/audio-recorder/audio-recorder';
import { setupWebHistoryHandlers, startWebHistoryTracking } from '../modules/web-history/web-history';
import { setupAppMonitorHandlers, startAppMonitoring } from '../modules/app-monitor/app-monitor';
import { setupAIIntegrationHandlers } from '../modules/ai-integration/ai-integration';
import { Settings } from '../database/models';
import { initDatabase } from '../database/database';

// Initialize all modules
export async function initializeModules() {
  try {
    // Initialize database
    await initDatabase();
    
    // Set up IPC handlers for all modules
    setupScreenCaptureHandlers();
    setupAudioRecorderHandlers();
    setupWebHistoryHandlers();
    setupAppMonitorHandlers();
    setupAIIntegrationHandlers();
    
    // Get settings
    const autoStartSetting = await Settings.findOne({ where: { key: 'auto_start' } });
    const autoStart = autoStartSetting ? autoStartSetting.value : true;
    
    // Start recording modules if auto-start is enabled
    if (autoStart) {
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
      
      console.log('All recording modules started automatically');
    }
    
    console.log('All modules initialized successfully');
  } catch (error) {
    console.error('Error initializing modules:', error);
  }
}

// Initialize default settings
export async function initializeDefaultSettings() {
  try {
    // Define default settings
    const defaultSettings = [
      { key: 'auto_start', value: true },
      { key: 'screen_capture_interval', value: 10000 },
      { key: 'web_history_interval', value: 5000 },
      { key: 'app_monitor_interval', value: 1000 },
      { key: 'ai_provider', value: { provider: 'openai', apiKey: '' } },
      { key: 'storage_limit', value: 10 * 1024 * 1024 * 1024 }, // 10 GB
      { key: 'encryption_enabled', value: false },
      { key: 'notification_enabled', value: true }
    ];
    
    // Create settings if they don't exist
    for (const setting of defaultSettings) {
      const [_, created] = await Settings.findOrCreate({
        where: { key: setting.key },
        defaults: setting
      });
      
      if (created) {
        console.log(`Created default setting: ${setting.key}`);
      }
    }
    
    console.log('Default settings initialized');
  } catch (error) {
    console.error('Error initializing default settings:', error);
  }
}

// Initialize everything when app is ready
app.whenReady().then(async () => {
  await initializeDefaultSettings();
  await initializeModules();
});
