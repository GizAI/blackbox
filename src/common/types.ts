// Common type definitions

// Activity type enum
export type ActivityType = 'screenshot' | 'audio' | 'web' | 'app' | 'insight';

// Base model interface
export interface BaseModel {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Timeline item interface
export interface TimelineItem extends BaseModel {
  type: ActivityType;
  timestamp: Date;
  title: string;
  description?: string;
  duration?: number;
  path?: string;
  metadata?: Record<string, any>;
}

// Timeline group interface
export interface TimelineGroup {
  id: string;
  title: string;
  items: TimelineItem[];
  startTime: Date;
  endTime: Date;
  duration: number;
}

// Screenshot interface
export interface Screenshot extends BaseModel {
  path: string;
  timestamp: Date;
  textDescription?: string;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    displayInfo?: any;
  };
}

// Audio recording interface
export interface AudioRecording extends BaseModel {
  path: string;
  timestamp: Date;
  duration: number;
  transcript?: string;
  metadata?: {
    format?: string;
    sampleRate?: number;
    channels?: number;
    size?: number;
    silenceMarkers?: Array<{start: number, end: number}>;
    speechSegments?: Array<{start: number, end: number, duration: number}>;
  };
}

// Web history interface
export interface WebHistory extends BaseModel {
  url: string;
  title?: string;
  timestamp: Date;
  duration?: number;
  metadata?: {
    source?: string;
    favicon?: string;
    domain?: string;
  };
}

// App usage interface
export interface AppUsage extends BaseModel {
  appName: string;
  windowTitle?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: {
    icon?: string;
    path?: string;
    category?: string;
  };
}

// AI insight interface
export interface AIInsight extends BaseModel {
  content: string;
  timestamp: Date;
  type: string;
  metadata?: {
    source?: string;
    confidence?: number;
    relatedItems?: number[];
  };
}

// Settings interface
export interface Settings {
  recording?: {
    isRecording?: boolean;
    screenshotInterval?: number;
    audioEnabled?: boolean;
    audioFormat?: string;
    audioSampleRate?: number;
    audioChannels?: number;
    webHistoryEnabled?: boolean;
    webHistoryInterval?: number;
    appMonitorEnabled?: boolean;
    appMonitorInterval?: number;
  };
  privacy?: {
    excludedApps?: string[];
    excludedWebsites?: string[];
    encryptionEnabled?: boolean;
  };
  storage?: {
    path?: string;
    maxSize?: number;
    autoCleanup?: boolean;
    retentionDays?: number;
  };
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
    autoProcessScreenshots?: boolean;
    autoTranscribeAudio?: boolean;
    generateDailySummary?: boolean;
  };
  ui?: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    showNotifications?: boolean;
  };
}

// Activity summary interface
export interface ActivitySummary {
  date: string;
  screenshots: number;
  audioRecordings: number;
  webHistory: number;
  appUsage: number;
  totalDuration: number;
}

// App usage summary interface
export interface AppUsageSummary {
  appName: string;
  totalDuration: number;
  count: number;
  lastUsed: Date;
  durationPercentage: number;
}

// Website summary interface
export interface WebsiteSummary {
  domain: string;
  totalDuration: number;
  count: number;
  lastVisited: Date;
  durationPercentage: number;
}

// Daily summary interface
export interface DailySummary {
  date: string;
  totalDuration: number;
  appUsage: AppUsageSummary[];
  webUsage: WebsiteSummary[];
  screenshots: number;
  audioRecordings: number;
}

// API response interface
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Date range interface
export interface DateRange {
  startDate: Date;
  endDate: Date;
}
