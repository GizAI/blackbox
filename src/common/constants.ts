// Common constants

// Default intervals (in milliseconds)
export const DEFAULT_INTERVALS = {
  SCREENSHOT: 10000, // 10 seconds
  AUDIO: 60000, // 1 minute
  WEB_HISTORY: 5000, // 5 seconds
  APP_MONITOR: 1000, // 1 second
  AUDIO_SAMPLE_RATE: 16000, // 16 kHz
};

// File formats
export const FILE_FORMATS = {
  SCREENSHOT: {
    WEBP: 'webp',
    JPEG: 'jpeg',
    PNG: 'png',
  },
  AUDIO: {
    WAV: 'wav',
    MP3: 'mp3',
    OGG: 'ogg',
  },
};

// Default settings
export const DEFAULT_SETTINGS = {
  recording: {
    isRecording: false,
    screenshotInterval: DEFAULT_INTERVALS.SCREENSHOT,
    audioEnabled: true,
    audioFormat: FILE_FORMATS.AUDIO.WAV,
    audioSampleRate: 16000,
    audioChannels: 1,
    webHistoryEnabled: true,
    webHistoryInterval: DEFAULT_INTERVALS.WEB_HISTORY,
    appMonitorEnabled: true,
    appMonitorInterval: DEFAULT_INTERVALS.APP_MONITOR,
  },
  privacy: {
    excludedApps: [],
    excludedWebsites: [],
    encryptionEnabled: false,
  },
  storage: {
    path: '', // Default path will be set by the app
    maxSize: 10 * 1024 * 1024 * 1024, // 10 GB
    autoCleanup: true,
    retentionDays: 30,
  },
  ai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    autoProcessScreenshots: true,
    autoTranscribeAudio: true,
    generateDailySummary: true,
  },
  ui: {
    theme: 'system',
    language: 'en',
    showNotifications: true,
  },
};

// Event names
export const EVENTS = {
  RECORDING: {
    START: 'recording:start',
    STOP: 'recording:stop',
    STATUS_CHANGE: 'recording:status-change',
  },
  SCREENSHOT: {
    NEW: 'screenshot:new',
    PROCESSED: 'screenshot:processed',
    ERROR: 'screenshot:error',
  },
  AUDIO: {
    NEW: 'audio:new',
    PROCESSED: 'audio:processed',
    ERROR: 'audio:error',
    SILENCE_DETECTED: 'audio:silence-detected',
    SILENCE_ENDED: 'audio:silence-ended',
    TRANSCRIBED: 'audio:transcribed',
  },
  WEB_HISTORY: {
    NEW: 'web-history:new',
    ERROR: 'web-history:error',
  },
  APP_MONITOR: {
    NEW: 'app-monitor:new',
    ERROR: 'app-monitor:error',
  },
  AI: {
    INSIGHT_GENERATED: 'ai:insight-generated',
    ERROR: 'ai:error',
  },
  SETTINGS: {
    UPDATED: 'settings:updated',
  },
};

// IPC 채널은 하드코딩으로 사용합니다.

// Database tables
export const DB_TABLES = {
  SCREENSHOT: 'Screenshot',
  AUDIO_RECORDING: 'AudioRecording',
  WEB_HISTORY: 'WebHistory',
  APP_USAGE: 'AppUsage',
  AI_INSIGHT: 'AIInsight',
  SETTINGS: 'Settings',
};

// Storage paths
export const STORAGE_PATHS = {
  SCREENSHOTS: 'screenshots',
  AUDIO: 'audio',
  TEMP: 'temp',
};

// AI providers
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  AZURE: 'azure',
  LOCAL: 'local',
};

// Activity types
export const ACTIVITY_TYPES = {
  SCREENSHOT: 'screenshot',
  AUDIO: 'audio',
  WEB: 'web',
  APP: 'app',
  INSIGHT: 'insight',
};

// Error messages
export const ERROR_MESSAGES = {
  RECORDING_ALREADY_STARTED: 'Recording is already started',
  RECORDING_NOT_STARTED: 'Recording is not started',
  FAILED_TO_START_RECORDING: 'Failed to start recording',
  FAILED_TO_STOP_RECORDING: 'Failed to stop recording',
  FAILED_TO_SAVE_SCREENSHOT: 'Failed to save screenshot',
  FAILED_TO_SAVE_AUDIO: 'Failed to save audio recording',
  FAILED_TO_GET_BROWSER_HISTORY: 'Failed to get browser history',
  FAILED_TO_GET_ACTIVE_WINDOW: 'Failed to get active window',
  FAILED_TO_PROCESS_SCREENSHOT: 'Failed to process screenshot',
  FAILED_TO_TRANSCRIBE_AUDIO: 'Failed to transcribe audio',
  FAILED_TO_GENERATE_SUMMARY: 'Failed to generate summary',
  FAILED_TO_GET_INSIGHTS: 'Failed to get insights',
  FAILED_TO_PROCESS_TEXT: 'Failed to process text',
  FAILED_TO_ANSWER_QUESTION: 'Failed to answer question',
  FAILED_TO_SET_AI_PROVIDER: 'Failed to set AI provider',
  FAILED_TO_GET_SETTINGS: 'Failed to get settings',
  FAILED_TO_SET_SETTINGS: 'Failed to set settings',
  FAILED_TO_RESET_SETTINGS: 'Failed to reset settings',
  FAILED_TO_GET_TIMELINE: 'Failed to get timeline',
  FAILED_TO_GET_TIMELINE_GROUPS: 'Failed to get timeline groups',
  FAILED_TO_GET_VERSION: 'Failed to get version',
  FAILED_TO_GET_PATHS: 'Failed to get paths',
  FAILED_TO_OPEN_EXTERNAL: 'Failed to open external link',
  FAILED_TO_SHOW_ITEM_IN_FOLDER: 'Failed to show item in folder',

  // Web history specific errors
  FAILED_TO_GET_PAGE_TITLE: 'Failed to get page title',
  FAILED_TO_GET_PAGE_INFO: 'Failed to get page info',
  WEB_HISTORY_NOT_FOUND: 'Web history entry not found',
  FAILED_TO_DELETE_WEB_HISTORY: 'Failed to delete web history entry',
  FAILED_TO_DELETE_ALL_WEB_HISTORY: 'Failed to delete all web history',
  FAILED_TO_GET_WEB_HISTORY_BY_DATE: 'Failed to get web history by date',

  // Audio recording specific errors
  AUDIO_RECORDING_NOT_FOUND: 'Audio recording not found',
  FAILED_TO_DELETE_AUDIO_RECORDING: 'Failed to delete audio recording',
  FAILED_TO_DELETE_ALL_AUDIO_RECORDINGS: 'Failed to delete all audio recordings',
  FAILED_TO_GET_AUDIO_RECORDINGS: 'Failed to get audio recordings',
  FAILED_TO_GET_AUDIO_RECORDINGS_BY_DATE: 'Failed to get audio recordings by date',

  // Screenshot specific errors
  SCREENSHOT_NOT_FOUND: 'Screenshot not found',
  FAILED_TO_DELETE_SCREENSHOT: 'Failed to delete screenshot',
  FAILED_TO_DELETE_ALL_SCREENSHOTS: 'Failed to delete all screenshots',
  FAILED_TO_GET_SCREENSHOTS_BY_DATE: 'Failed to get screenshots by date',

  // App usage specific errors
  APP_USAGE_NOT_FOUND: 'App usage entry not found',
  FAILED_TO_DELETE_APP_USAGE: 'Failed to delete app usage entry',
  FAILED_TO_DELETE_ALL_APP_USAGE: 'Failed to delete all app usage entries',
  FAILED_TO_GET_APP_USAGE_BY_DATE: 'Failed to get app usage by date',
};

// Success messages
export const SUCCESS_MESSAGES = {
  RECORDING_STARTED: 'Recording started',
  RECORDING_STOPPED: 'Recording stopped',
  SCREENSHOT_SAVED: 'Screenshot saved',
  AUDIO_SAVED: 'Audio recording saved',
  SETTINGS_UPDATED: 'Settings updated',
  SETTINGS_RESET: 'Settings reset to defaults',
  AI_PROVIDER_SET: 'AI provider set',
};
