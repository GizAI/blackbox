import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
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

// Delete a timeline item by ID and type
export async function deleteTimelineItem(id: number, type: string): Promise<boolean> {
  try {
    let filePath = '';
    let success = false;

    // Delete from database based on type
    switch (type) {
      case 'screenshot':
        const screenshot = await Screenshot.findByPk(id);
        if (screenshot) {
          filePath = screenshot.path;
          await screenshot.destroy();
          success = true;
        }
        break;
      case 'audio':
        const audio = await AudioRecording.findByPk(id);
        if (audio) {
          filePath = audio.path;
          await audio.destroy();
          success = true;
        }
        break;
      case 'web':
        const web = await WebHistory.findByPk(id);
        if (web) {
          await web.destroy();
          success = true;
        }
        break;
      case 'app':
        const app = await AppUsage.findByPk(id);
        if (app) {
          await app.destroy();
          success = true;
        }
        break;
      case 'insight':
        const insight = await AIInsight.findByPk(id);
        if (insight) {
          await insight.destroy();
          success = true;
        }
        break;
      default:
        return false;
    }

    // Delete file if it exists
    if (filePath && fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    }

    return success;
  } catch (error) {
    console.error(`Error deleting ${type} item with ID ${id}:`, error);
    return false;
  }
}

// Delete all timeline items of a specific type for a date
export async function deleteTimelineItemsByType(date: Date, type: string): Promise<number> {
  try {
    // Set start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let count = 0;
    let items: any[] = [];

    // Get items based on type
    switch (type) {
      case 'screenshot':
        items = await Screenshot.findAll({
          where: {
            timestamp: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          }
        });
        break;
      case 'audio':
        items = await AudioRecording.findAll({
          where: {
            timestamp: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          }
        });
        break;
      case 'web':
        items = await WebHistory.findAll({
          where: {
            timestamp: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          }
        });
        break;
      case 'app':
        items = await AppUsage.findAll({
          where: {
            startTime: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          }
        });
        break;
      case 'insight':
        items = await AIInsight.findAll({
          where: {
            timestamp: {
              [Op.gte]: startOfDay,
              [Op.lte]: endOfDay
            }
          }
        });
        break;
      default:
        return 0;
    }

    // Delete each item
    for (const item of items) {
      // Delete file if it exists (for screenshots and audio)
      if (item.path && fs.existsSync(item.path)) {
        await fsPromises.unlink(item.path);
        console.log(`Deleted file: ${item.path}`);
      }

      // Delete from database
      await item.destroy();
      count++;
    }

    return count;
  } catch (error) {
    console.error(`Error deleting ${type} items:`, error);
    return 0;
  }
}

// Delete all timeline items for a date
export async function deleteAllTimelineItems(date: Date): Promise<number> {
  try {
    let totalCount = 0;

    // Delete each type of item
    totalCount += await deleteTimelineItemsByType(date, 'screenshot');
    totalCount += await deleteTimelineItemsByType(date, 'audio');
    totalCount += await deleteTimelineItemsByType(date, 'web');
    totalCount += await deleteTimelineItemsByType(date, 'app');
    totalCount += await deleteTimelineItemsByType(date, 'insight');

    return totalCount;
  } catch (error) {
    console.error('Error deleting all timeline items:', error);
    return 0;
  }
}

// Set up IPC handlers
export function setupTimelineHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('timeline:get-data');
    ipcMain.removeHandler('timeline:get-range');
    ipcMain.removeHandler('timeline:group-items');
    ipcMain.removeHandler('timeline:delete-item');
    ipcMain.removeHandler('timeline:delete-items-by-type');
    ipcMain.removeHandler('timeline:delete-all-items');
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

  // Delete a timeline item
  ipcMain.handle('timeline:delete-item', async (_event, data) => {
    try {
      const { id, type } = data;
      const success = await deleteTimelineItem(id, type);
      return { success, id, type };
    } catch (error) {
      console.error('Error deleting timeline item:', error);
      return { success: false, error: 'Failed to delete timeline item' };
    }
  });

  // Delete timeline items by type
  ipcMain.handle('timeline:delete-items-by-type', async (_event, data) => {
    try {
      const { date, type } = data;
      const count = await deleteTimelineItemsByType(new Date(date), type);
      return { success: true, count, type };
    } catch (error) {
      console.error('Error deleting timeline items by type:', error);
      return { success: false, error: 'Failed to delete timeline items' };
    }
  });

  // Delete all timeline items
  ipcMain.handle('timeline:delete-all-items', async (_event, date) => {
    try {
      const count = await deleteAllTimelineItems(new Date(date));
      return { success: true, count };
    } catch (error) {
      console.error('Error deleting all timeline items:', error);
      return { success: false, error: 'Failed to delete all timeline items' };
    }
  });
}
