import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Screenshot, AudioRecording, WebHistory, AppUsage, AIInsight } from '../../database/models';
import settingsManager from '../settings/settings';
import { TimelineItem, ActivitySummary, AppUsageSummary, WebsiteSummary, DailySummary } from '../../common/types';
import { getTimelineData as getTimelineDataFromTimeline } from '../timeline/timeline';

// Get timeline data for a specific date range
export async function getTimelineData(startDate: Date, endDate: Date): Promise<TimelineItem[]> {
  try {
    // Use the timeline module's function to get data for each day in the range
    const allItems: TimelineItem[] = [];

    // Loop through each day in the range
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayItems = await getTimelineDataFromTimeline(currentDate);
      allItems.push(...dayItems);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by timestamp
    allItems.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return allItems;
  } catch (error) {
    console.error('Error getting timeline data:', error);
    return [];
  }
}

// Get activity summary for a date range
export async function getActivitySummary(startDate: Date, endDate: Date): Promise<ActivitySummary[]> {
  try {
    // Group by day
    const days: { [key: string]: ActivitySummary } = {};

    // Initialize days
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      days[dateString] = {
        date: dateString,
        screenshots: 0,
        audioRecordings: 0,
        webHistory: 0,
        appUsage: 0,
        totalDuration: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Get screenshots
    const screenshots = await Screenshot.findAll({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['timestamp']
    });

    // Get audio recordings
    const audioRecordings = await AudioRecording.findAll({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['timestamp', 'duration']
    });

    // Get web history
    const webHistory = await WebHistory.findAll({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['timestamp', 'duration']
    });

    // Get app usage
    const appUsage = await AppUsage.findAll({
      where: {
        startTime: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['startTime', 'duration']
    });

    // Count by day
    screenshots.forEach(s => {
      const dateString = new Date(s.timestamp).toISOString().split('T')[0];
      if (days[dateString]) {
        days[dateString].screenshots++;
      }
    });

    audioRecordings.forEach(a => {
      const dateString = new Date(a.timestamp).toISOString().split('T')[0];
      if (days[dateString]) {
        days[dateString].audioRecordings++;
        days[dateString].totalDuration += a.duration || 0;
      }
    });

    webHistory.forEach(w => {
      const dateString = new Date(w.timestamp).toISOString().split('T')[0];
      if (days[dateString]) {
        days[dateString].webHistory++;
        days[dateString].totalDuration += w.duration || 0;
      }
    });

    appUsage.forEach(a => {
      const dateString = new Date(a.startTime).toISOString().split('T')[0];
      if (days[dateString]) {
        days[dateString].appUsage++;
        days[dateString].totalDuration += a.duration || 0;
      }
    });

    // Convert to array
    return Object.values(days);
  } catch (error) {
    console.error('Error getting activity summary:', error);
    return [];
  }
}

// Get app usage summary for a date range
export async function getAppUsageSummary(startDate: Date, endDate: Date, limit: number = 10): Promise<AppUsageSummary[]> {
  try {
    // Get app usage
    const appUsage = await AppUsage.findAll({
      where: {
        startTime: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['appName', 'startTime', 'duration']
    });

    // Group by app name
    const appSummary: { [key: string]: AppUsageSummary } = {};
    let totalDuration = 0;

    appUsage.forEach(a => {
      const appName = a.appName;
      const duration = a.duration || 0;
      totalDuration += duration;

      if (!appSummary[appName]) {
        appSummary[appName] = {
          appName,
          totalDuration: 0,
          count: 0,
          lastUsed: new Date(0),
          durationPercentage: 0
        };
      }

      appSummary[appName].totalDuration += duration;
      appSummary[appName].count++;

      const startTime = new Date(a.startTime);
      if (startTime > appSummary[appName].lastUsed) {
        appSummary[appName].lastUsed = startTime;
      }
    });

    // Calculate percentages
    Object.values(appSummary).forEach(app => {
      app.durationPercentage = totalDuration > 0 ? (app.totalDuration / totalDuration) * 100 : 0;
    });

    // Sort by total duration and limit
    return Object.values(appSummary)
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting app usage summary:', error);
    return [];
  }
}

// Get website usage summary for a date range
export async function getWebsiteSummary(startDate: Date, endDate: Date, limit: number = 10): Promise<WebsiteSummary[]> {
  try {
    // Get web history
    const webHistory = await WebHistory.findAll({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startDate,
          [Symbol.for('lte')]: endDate
        }
      },
      attributes: ['url', 'timestamp', 'duration']
    });

    // Group by domain
    const domainSummary: { [key: string]: WebsiteSummary } = {};
    let totalDuration = 0;

    webHistory.forEach(w => {
      let domain = '';
      try {
        domain = new URL(w.url).hostname;
      } catch (error) {
        domain = w.url;
      }

      const duration = w.duration || 0;
      totalDuration += duration;

      if (!domainSummary[domain]) {
        domainSummary[domain] = {
          domain,
          totalDuration: 0,
          count: 0,
          lastVisited: new Date(0),
          durationPercentage: 0
        };
      }

      domainSummary[domain].totalDuration += duration;
      domainSummary[domain].count++;

      const timestamp = new Date(w.timestamp);
      if (timestamp > domainSummary[domain].lastVisited) {
        domainSummary[domain].lastVisited = timestamp;
      }
    });

    // Calculate percentages
    Object.values(domainSummary).forEach(domain => {
      domain.durationPercentage = totalDuration > 0 ? (domain.totalDuration / totalDuration) * 100 : 0;
    });

    // Sort by total duration and limit
    return Object.values(domainSummary)
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting website summary:', error);
    return [];
  }
}

// Get daily summary for a specific date
export async function getDailySummary(date: Date): Promise<DailySummary> {
  try {
    // Set start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get app usage summary
    const appUsage = await getAppUsageSummary(startOfDay, endOfDay);

    // Get website summary
    const webUsage = await getWebsiteSummary(startOfDay, endOfDay);

    // Get screenshot count
    const screenshotCount = await Screenshot.count({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startOfDay,
          [Symbol.for('lte')]: endOfDay
        }
      }
    });

    // Get audio recording count
    const audioRecordingCount = await AudioRecording.count({
      where: {
        timestamp: {
          [Symbol.for('gte')]: startOfDay,
          [Symbol.for('lte')]: endOfDay
        }
      }
    });

    // Calculate total duration
    const totalDuration = appUsage.reduce((total, app) => total + app.totalDuration, 0);

    return {
      date: date.toISOString().split('T')[0],
      totalDuration,
      appUsage,
      webUsage,
      screenshots: screenshotCount,
      audioRecordings: audioRecordingCount
    };
  } catch (error) {
    console.error('Error getting daily summary:', error);
    return {
      date: date.toISOString().split('T')[0],
      totalDuration: 0,
      appUsage: [],
      webUsage: [],
      screenshots: 0,
      audioRecordings: 0
    };
  }
}

// Import formatDuration from common utils
import { formatDuration as formatDurationUtil } from '../../common/utils';

// Format duration in seconds to human-readable string
export function formatDuration(seconds: number): string {
  return formatDurationUtil(seconds);
}

// Set up IPC handlers
export function setupDataVisualizationHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('data-visualization:get-timeline');
    ipcMain.removeHandler('data-visualization:get-activity-summary');
    ipcMain.removeHandler('data-visualization:get-app-usage-summary');
    ipcMain.removeHandler('data-visualization:get-website-summary');
    ipcMain.removeHandler('data-visualization:get-daily-summary');
    ipcMain.removeHandler('data-visualization:format-duration');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('data-visualization:get-timeline', async (_event, data) => {
    try {
      const { startDate, endDate } = data;
      const timeline = await getTimelineData(new Date(startDate), new Date(endDate));
      return { success: true, timeline };
    } catch (error) {
      console.error('Error getting timeline data:', error);
      return { success: false, error: 'Failed to get timeline data', timeline: [] };
    }
  });

  ipcMain.handle('data-visualization:get-activity-summary', async (_event, data) => {
    try {
      const { startDate, endDate } = data;
      const summary = await getActivitySummary(new Date(startDate), new Date(endDate));
      return { success: true, summary };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      return { success: false, error: 'Failed to get activity summary', summary: [] };
    }
  });

  ipcMain.handle('data-visualization:get-app-usage-summary', async (_event, data) => {
    try {
      console.log('Received app usage summary request with data:', data);

      if (!data || !data.startDate || !data.endDate) {
        console.error('Invalid data for app usage summary:', data);
        return { success: false, error: 'Invalid date range', summary: [] };
      }

      const { startDate, endDate, limit } = data;
      console.log('Getting app usage summary for:', startDate, 'to', endDate, 'with limit:', limit);

      const summary = await getAppUsageSummary(new Date(startDate), new Date(endDate), limit);
      console.log('App usage summary result:', summary.length, 'items');

      return { success: true, summary };
    } catch (error) {
      console.error('Error getting app usage summary:', error);
      return { success: false, error: 'Failed to get app usage summary', summary: [] };
    }
  });

  ipcMain.handle('data-visualization:get-website-summary', async (_event, data) => {
    try {
      console.log('Received website summary request with data:', data);

      if (!data || !data.startDate || !data.endDate) {
        console.error('Invalid data for website summary:', data);
        return { success: false, error: 'Invalid date range', summary: [] };
      }

      const { startDate, endDate, limit } = data;
      console.log('Getting website summary for:', startDate, 'to', endDate, 'with limit:', limit);

      const summary = await getWebsiteSummary(new Date(startDate), new Date(endDate), limit);
      console.log('Website summary result:', summary.length, 'items');

      return { success: true, summary };
    } catch (error) {
      console.error('Error getting website summary:', error);
      return { success: false, error: 'Failed to get website summary', summary: [] };
    }
  });

  ipcMain.handle('data-visualization:get-daily-summary', async (_event, data) => {
    try {
      const { date } = data;
      const summary = await getDailySummary(new Date(date));
      return { success: true, summary };
    } catch (error) {
      console.error('Error getting daily summary:', error);
      return { success: false, error: 'Failed to get daily summary', summary: null };
    }
  });

  ipcMain.handle('data-visualization:format-duration', (_event, seconds) => {
    try {
      const formatted = formatDuration(seconds);
      return { success: true, formatted };
    } catch (error) {
      console.error('Error formatting duration:', error);
      return { success: false, error: 'Failed to format duration', formatted: '' };
    }
  });
}
