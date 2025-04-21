import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Screen capture
    startScreenCapture: () => ipcRenderer.invoke('screen-capture:start'),
    stopScreenCapture: () => ipcRenderer.invoke('screen-capture:stop'),
    getScreenshots: (limit: number) => ipcRenderer.invoke('screen-capture:get', limit),
    
    // Audio recording
    startAudioRecording: () => ipcRenderer.invoke('audio-recorder:start'),
    stopAudioRecording: () => ipcRenderer.invoke('audio-recorder:stop'),
    getAudioRecordings: (limit: number) => ipcRenderer.invoke('audio-recorder:get', limit),
    
    // Web history
    startWebHistoryTracking: () => ipcRenderer.invoke('web-history:start'),
    stopWebHistoryTracking: () => ipcRenderer.invoke('web-history:stop'),
    getWebHistory: (limit: number) => ipcRenderer.invoke('web-history:get', limit),
    
    // App monitoring
    startAppMonitoring: () => ipcRenderer.invoke('app-monitor:start'),
    stopAppMonitoring: () => ipcRenderer.invoke('app-monitor:stop'),
    getAppUsage: (limit: number) => ipcRenderer.invoke('app-monitor:get', limit),
    
    // AI integration
    processWithAI: (data: any) => ipcRenderer.invoke('ai:process', data),
    generateSummary: (timeframe: string) => ipcRenderer.invoke('ai:summary', timeframe),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    
    // System
    getSystemInfo: () => ipcRenderer.invoke('system:info'),
    
    // Listeners
    on: (channel: string, callback: (...args: any[]) => void) => {
      // Whitelist channels that can be listened to
      const validChannels = [
        'screen-capture:new', 
        'audio-recorder:new',
        'web-history:new',
        'app-monitor:new',
        'ai:insight',
        'system:notification'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (_, ...args) => callback(...args));
      }
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      const validChannels = [
        'screen-capture:new', 
        'audio-recorder:new',
        'web-history:new',
        'app-monitor:new',
        'ai:insight',
        'system:notification'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, callback);
      }
    }
  }
);
