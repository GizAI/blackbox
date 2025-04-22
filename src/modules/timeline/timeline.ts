import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Screenshot, AudioRecording, WebHistory, AppUsage, AIInsight } from '../../database/models';
import settingsManager from '../settings/settings';
import { TimelineItem, TimelineGroup } from '../../common/types';
import { getActivityTitle } from '../../common/utils';
import { Op } from 'sequelize';

// Get timeline data for a specific date
export async function getTimelineData(date: Date): Promise<TimelineItem[]> {
  try {
    // Set start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get screenshots
    const screenshots = await Screenshot.findAll({
      where: {
        timestamp: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get audio recordings
    const audioRecordings = await AudioRecording.findAll({
      where: {
        timestamp: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get web history
    const webHistory = await WebHistory.findAll({
      where: {
        timestamp: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Get app usage
    const appUsage = await AppUsage.findAll({
      where: {
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      order: [['startTime', 'DESC']]
    });

    // Get AI insights
    const insights = await AIInsight.findAll({
      where: {
        timestamp: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      order: [['timestamp', 'DESC']]
    });

    // Convert to timeline items
    const timelineItems: TimelineItem[] = [
      ...screenshots.map(s => ({
        id: s.id,
        type: 'screenshot' as const,
        timestamp: s.timestamp,
        title: `Screenshot ${new Date(s.timestamp).toLocaleTimeString()}`,
        description: s.textDescription || '',
        path: s.path,
        metadata: s.metadata
      })),
      ...audioRecordings.map(a => ({
        id: a.id,
        type: 'audio' as const,
        timestamp: a.timestamp,
        title: `Audio Recording ${new Date(a.timestamp).toLocaleTimeString()}`,
        description: a.transcript || '',
        duration: a.duration,
        path: a.path,
        metadata: a.metadata
      })),
      ...webHistory.map(w => ({
        id: w.id,
        type: 'web' as const,
        timestamp: w.timestamp,
        title: w.title || w.url,
        description: w.url,
        duration: w.duration,
        metadata: w.metadata
      })),
      ...appUsage.map(a => ({
        id: a.id,
        type: 'app' as const,
        timestamp: a.startTime,
        title: a.appName,
        description: a.windowTitle,
        duration: a.duration,
        metadata: a.metadata
      })),
      ...insights.map(i => ({
        id: i.id,
        type: 'insight' as const,
        timestamp: i.timestamp,
        title: `AI Insight: ${i.type}`,
        description: i.content,
        metadata: i.metadata
      }))
    ];

    // Sort by timestamp (newest first)
    timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return timelineItems;
  } catch (error) {
    console.error('Error getting timeline data:', error);
    return [];
  }
}

// Group timeline items by time periods
export function groupTimelineItems(items: TimelineItem[], groupBy: 'hour' | 'activity' = 'hour'): TimelineGroup[] {
  if (items.length === 0) {
    return [];
  }

  if (groupBy === 'hour') {
    // Group by hour
    const groups: { [key: string]: TimelineGroup } = {};

    items.forEach(item => {
      const hour = new Date(item.timestamp).getHours();
      const groupId = `hour-${hour}`;

      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          title: `${hour}:00 - ${hour + 1}:00`,
          items: [],
          startTime: new Date(item.timestamp),
          endTime: new Date(item.timestamp),
          duration: 0
        };
      }

      groups[groupId].items.push(item);

      // Update start and end times
      if (new Date(item.timestamp) < groups[groupId].startTime) {
        groups[groupId].startTime = new Date(item.timestamp);
      }

      const endTime = new Date(item.timestamp);
      if (item.duration) {
        endTime.setSeconds(endTime.getSeconds() + item.duration);
      }

      if (endTime > groups[groupId].endTime) {
        groups[groupId].endTime = endTime;
      }
    });

    // Calculate durations
    Object.values(groups).forEach(group => {
      group.duration = (group.endTime.getTime() - group.startTime.getTime()) / 1000;
    });

    // Sort by start time (newest first)
    return Object.values(groups).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  } else {
    // Group by activity (consecutive items of the same type)
    const groups: TimelineGroup[] = [];
    let currentGroup: TimelineGroup | null = null;

    items.forEach(item => {
      if (!currentGroup || currentGroup.items[0].type !== item.type) {
        // Start a new group
        currentGroup = {
          id: `activity-${groups.length}`,
          title: getActivityTitle(item.type),
          items: [item],
          startTime: new Date(item.timestamp),
          endTime: new Date(item.timestamp),
          duration: 0
        };

        // Add duration if available
        if (item.duration) {
          const endTime = new Date(item.timestamp);
          endTime.setSeconds(endTime.getSeconds() + item.duration);
          currentGroup.endTime = endTime;
        }

        groups.push(currentGroup);
      } else {
        // Add to current group
        currentGroup.items.push(item);

        // Update end time
        const endTime = new Date(item.timestamp);
        if (item.duration) {
          endTime.setSeconds(endTime.getSeconds() + item.duration);
        }

        if (endTime > currentGroup.endTime) {
          currentGroup.endTime = endTime;
        }
      }
    });

    // Calculate durations
    groups.forEach(group => {
      group.duration = (group.endTime.getTime() - group.startTime.getTime()) / 1000;
    });

    return groups;
  }
}

// getActivityTitle is now imported from common/utils.js

// Get timeline data for a date range
export async function getTimelineRange(startDate: Date, endDate: Date): Promise<{ [date: string]: TimelineItem[] }> {
  try {
    // Initialize result object
    const result: { [date: string]: TimelineItem[] } = {};

    // Loop through each day in the range
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      result[dateString] = await getTimelineData(currentDate);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error('Error getting timeline range:', error);
    return {};
  }
}

// Set up IPC handlers
export function setupTimelineHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('timeline:get-data');
    ipcMain.removeHandler('timeline:get-range');
    ipcMain.removeHandler('timeline:group-items');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('timeline:get-data', async (_event, date) => {
    try {
      console.log('Received timeline data request for date:', date);

      if (!date) {
        console.error('Invalid date for timeline data:', date);
        return { success: false, error: 'Invalid date', timeline: [] };
      }

      const timeline = await getTimelineData(new Date(date));
      console.log('Timeline data result:', timeline.length, 'items');

      return { success: true, timeline };
    } catch (error) {
      console.error('Error getting timeline data:', error);
      return { success: false, error: 'Failed to get timeline data', timeline: [] };
    }
  });

  ipcMain.handle('timeline:get-range', async (_event, data) => {
    try {
      const { startDate, endDate } = data;
      const timeline = await getTimelineRange(new Date(startDate), new Date(endDate));
      return { success: true, timeline };
    } catch (error) {
      console.error('Error getting timeline range:', error);
      return { success: false, error: 'Failed to get timeline range', timeline: {} };
    }
  });

  ipcMain.handle('timeline:group-items', (_event, data) => {
    try {
      const { items, groupBy } = data;
      const groups = groupTimelineItems(items, groupBy);
      return { success: true, groups };
    } catch (error) {
      console.error('Error grouping timeline items:', error);
      return { success: false, error: 'Failed to group timeline items', groups: [] };
    }
  });
}
