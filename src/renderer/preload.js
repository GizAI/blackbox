// Preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // IPC communication
    send: (channel, data) => {
      // Whitelist channels
      const validChannels = [
        'audio-recorder:silence-detected',
        'audio-recorder:silence-ended',
        'audio-recorder:data',
        'audio-recorder:error',
        'audio-recorder:recording-complete',
        'recording:start-all',
        'recording:stop-all'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },

    receive: (channel, func) => {
      // Whitelist channels
      const validChannels = [
        'audio-recorder:start-recording',
        'audio-recorder:stop-recording',
        'app:ready'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },

    removeAllListeners: (channel) => {
      // Whitelist channels
      const validChannels = [
        'audio-recorder:start-recording',
        'audio-recorder:stop-recording',
        'app:ready'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },

    invoke: (channel, data) => {
      // Whitelist channels
      const validChannels = [
        'audio-recorder:save-blob',
        'audio-recorder:start',
        'audio-recorder:stop',
        'audio-recorder:get',
        'audio-recorder:transcribe',
        'audio-recorder:delete',
        'audio-recorder:update',
        'audio-recorder:get-devices',
        'recording:start-all',
        'recording:stop-all'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
    // Screenshot methods
    getScreenshots: (limit, options) => ipcRenderer.invoke('screen-capture:get', { limit, options }),
    startScreenCapture: (interval) => ipcRenderer.invoke('screen-capture:start', interval),
    stopScreenCapture: () => ipcRenderer.invoke('screen-capture:stop'),
    takeScreenshot: () => ipcRenderer.invoke('screen-capture:take-now'),
    generateScreenshotDescription: (id) => ipcRenderer.invoke('screen-capture:describe', id),
    getScreenshotsByDate: (startDate, endDate, limit) => ipcRenderer.invoke('screen-capture:get-by-date', { startDate, endDate, limit }),
    deleteScreenshot: (id) => ipcRenderer.invoke('screen-capture:delete', id),
    getDisplays: () => ipcRenderer.invoke('screen-capture:get-displays'),

    // Audio methods
    getAudioRecordings: (limit, options) => ipcRenderer.invoke('audio-recorder:get', { limit, options }),
    startAudioRecording: () => ipcRenderer.invoke('audio-recorder:start'),
    stopAudioRecording: () => ipcRenderer.invoke('audio-recorder:stop'),
    transcribeAudio: (id) => ipcRenderer.invoke('audio-recorder:transcribe', id),
    deleteAudioRecording: (id) => ipcRenderer.invoke('audio-recorder:delete', id),
    updateAudioRecording: (id, updates) => ipcRenderer.invoke('audio-recorder:update', { id, updates }),

    // Web history methods
    getWebHistory: (limit, options) => ipcRenderer.invoke('web-history:get', limit, options),
    startWebHistoryTracking: (interval) => ipcRenderer.invoke('web-history:start', interval),
    stopWebHistoryTracking: () => ipcRenderer.invoke('web-history:stop'),
    getRawBrowserHistory: (browser, limit) => ipcRenderer.invoke('web-history:get-raw', { browser, limit }),
    checkBrowserSupport: () => ipcRenderer.invoke('web-history:check-browsers'),
    getPageTitle: (url) => ipcRenderer.invoke('web-history:get-page-title', url),
    getPageInfo: (url) => ipcRenderer.invoke('web-history:get-page-info', url),
    deleteWebHistory: (id) => ipcRenderer.invoke('web-history:delete', id),
    deleteAllWebHistory: () => ipcRenderer.invoke('web-history:delete-all'),
    getWebHistoryByDate: (startDate, endDate, limit) => ipcRenderer.invoke('web-history:get-by-date', { startDate, endDate, limit }),

    // App monitoring methods
    getAppUsage: (limit) => ipcRenderer.invoke('app-monitor:get', limit),
    startAppMonitoring: (interval) => ipcRenderer.invoke('app-monitor:start', interval),
    stopAppMonitoring: () => ipcRenderer.invoke('app-monitor:stop'),
    getAppUsageStats: (timeRange) => ipcRenderer.invoke('app-monitor:get-stats', timeRange),
    getAppIcon: (appPath) => ipcRenderer.invoke('app-monitor:get-icon', appPath),
    getCurrentApp: () => ipcRenderer.invoke('app-monitor:get-current'),

    // Settings methods
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    // AI methods
    processScreenshot: (screenshotId, options) => ipcRenderer.invoke('ai:process-screenshot', { screenshotId, options }),
    processAudioRecording: (recordingId, options) => ipcRenderer.invoke('ai:process-audio', { recordingId, options }),
    generateSummary: (timeframe, options) => ipcRenderer.invoke('ai:summary', { timeframe, options }),
    getInsights: (limit, type) => ipcRenderer.invoke('ai:get-insights', { limit, type }),
    processText: (text, options) => ipcRenderer.invoke('ai:process-text', { text, options }),
    answerQuestion: (question, context, options) => ipcRenderer.invoke('ai:answer-question', { question, context, options }),
    setAIProvider: (providerSettings) => ipcRenderer.invoke('ai:set-provider', providerSettings),
    getAIProviderInfo: () => ipcRenderer.invoke('ai:get-provider-info'),
    getAIProviderSettings: () => ipcRenderer.invoke('ai:get-provider-settings'),
    getAvailableAIProviders: () => ipcRenderer.invoke('ai:get-available-providers'),
    generateInsights: (timeframe) => ipcRenderer.invoke('ai:summary', { timeframe }),

    // Data visualization methods
    getVisualizationData: (startDate, endDate) => {
      console.log('Calling getVisualizationData with:', startDate, endDate);
      return ipcRenderer.invoke('data-visualization:get-timeline', { startDate, endDate });
    },
    getActivitySummary: (startDate, endDate) => {
      console.log('Calling getActivitySummary with:', startDate, endDate);
      return ipcRenderer.invoke('data-visualization:get-activity-summary', { startDate, endDate });
    },
    getAppUsageSummary: (startDate, endDate, limit) => {
      console.log('Calling getAppUsageSummary with:', startDate, endDate, limit);
      return ipcRenderer.invoke('data-visualization:get-app-usage-summary', { startDate, endDate, limit });
    },
    getWebsiteSummary: (startDate, endDate, limit) => {
      console.log('Calling getWebsiteSummary with:', startDate, endDate, limit);
      return ipcRenderer.invoke('data-visualization:get-website-summary', { startDate, endDate, limit });
    },
    getDailySummary: (date) => {
      console.log('Calling getDailySummary with:', date);
      return ipcRenderer.invoke('data-visualization:get-daily-summary', { date });
    },
    formatDuration: (seconds) => ipcRenderer.invoke('data-visualization:format-duration', seconds),

    // Timeline methods
    getTimelineData: (date) => {
      console.log('Calling getTimelineData with:', date);
      return ipcRenderer.invoke('timeline:get-data', date);
    },
    getTimelineRange: (startDate, endDate) => {
      console.log('Calling getTimelineRange with:', startDate, endDate);
      return ipcRenderer.invoke('timeline:get-range', { startDate, endDate });
    },
    groupTimelineItems: (items, groupBy) => {
      console.log('Calling groupTimelineItems with groupBy:', groupBy);
      return ipcRenderer.invoke('timeline:group-items', { items, groupBy });
    },
    deleteTimelineItem: (data) => {
      console.log('Calling deleteTimelineItem with:', data);
      return ipcRenderer.invoke('timeline:delete-item', data);
    },
    deleteTimelineItemsByType: (data) => {
      console.log('Calling deleteTimelineItemsByType with:', data);
      return ipcRenderer.invoke('timeline:delete-items-by-type', data);
    },
    deleteAllTimelineItems: (date) => {
      console.log('Calling deleteAllTimelineItems with:', date);
      return ipcRenderer.invoke('timeline:delete-all-items', date);
    },

    // General methods
    startAllRecording: () => ipcRenderer.invoke('recording:start-all'),
    stopAllRecording: () => ipcRenderer.invoke('recording:stop-all'),
    getActivityCounts: () => ipcRenderer.invoke('activity:get-counts'),
    getRecentActivity: (limit) => ipcRenderer.invoke('activity:get-recent', limit)
  }
);
