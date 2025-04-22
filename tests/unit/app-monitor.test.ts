import * as path from 'path';
import * as fs from 'fs';
import { app, ipcMain } from 'electron';
import * as appMonitor from '../../src/modules/app-monitor/app-monitor';

// Mock the database models
jest.mock('../../src/database/models', () => ({
  AppUsage: {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByPk: jest.fn().mockResolvedValue({
      id: 1,
      appName: 'Visual Studio Code',
      windowTitle: 'app-monitor.test.ts - blackbox',
      startTime: new Date(),
      endTime: new Date(Date.now() + 60000),
      duration: 60,
      metadata: { path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
      save: jest.fn().mockResolvedValue({}),
      destroy: jest.fn().mockResolvedValue(1),
    }),
    create: jest.fn().mockResolvedValue({
      id: 1,
      appName: 'Visual Studio Code',
      windowTitle: 'app-monitor.test.ts - blackbox',
      startTime: new Date(),
      endTime: null,
      duration: 0,
      metadata: { path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
      save: jest.fn().mockResolvedValue({}),
    }),
    count: jest.fn().mockResolvedValue(15),
  },
}));

// Mock the settings manager
jest.mock('../../src/modules/settings/settings', () => ({
  __esModule: true,
  default: {
    getSettings: jest.fn().mockReturnValue({
      recording: {
        appMonitorEnabled: true,
        appMonitorInterval: 1000,
        excludedApps: ['explorer.exe', 'SystemSettings.exe'],
      },
    }),
    saveSettings: jest.fn().mockResolvedValue(true),
  },
}));

// Mock the active-win module
jest.mock('active-win', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    title: 'app-monitor.test.ts - blackbox - Visual Studio Code',
    owner: {
      name: 'Code.exe',
      path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      processId: 12345,
    },
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  }),
}));

describe('App Monitor Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Skip private function tests
  // describe('getAppMonitorSettings', () => {
  //   it('should return app monitor settings from settings manager', () => {
  //     // Private function
  //   });
  // });

  describe('startAppMonitoring and stopAppMonitoring', () => {
    it('should start and stop app monitoring', () => {
      // Start app monitoring
      appMonitor.startAppMonitoring();

      // Stop app monitoring
      appMonitor.stopAppMonitoring();

      // We can't verify internal state directly, but we can check that the functions don't throw
      expect(true).toBe(true);
    });
  });

  describe('getRecentAppUsage', () => {
    it('should return recent app usage', async () => {
      const result = await appMonitor.getRecentAppUsage(15);

      expect(result).toEqual({
        success: true,
        appUsage: [],
      });
    });
  });

  describe('setupAppMonitorHandlers', () => {
    it('should set up IPC handlers for app monitor', () => {
      appMonitor.setupAppMonitorHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app-monitor:start');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app-monitor:stop');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app-monitor:get');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app-monitor:get-stats');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('app-monitor:get-current');

      expect(ipcMain.handle).toHaveBeenCalledWith('app-monitor:start', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('app-monitor:stop', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('app-monitor:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('app-monitor:get-stats', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('app-monitor:get-current', expect.any(Function));
    });
  });

  // Skip private function tests
  // describe('trackCurrentApp', () => {
  //   it('should track the current active app', async () => {
  //     // Private function
  //   });
  // });

  // describe('isAppExcluded', () => {
  //   it('should check if an app is excluded', () => {
  //     // Private function
  //   });
  // });

  describe('getCurrentApp', () => {
    it('should get information about the current active app', async () => {
      const result = await appMonitor.getCurrentApp();

      expect(result).toEqual({
        success: true,
        app: {
          title: 'app-monitor.test.ts - blackbox - Visual Studio Code',
          owner: {
            name: 'Code.exe',
            path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            processId: 12345,
          },
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        },
      });
    });
  });

  describe('getAppUsageStats', () => {
    it('should get app usage statistics', async () => {
      const startDate = new Date();
      const endDate = new Date(Date.now() + 86400000); // 1 day later

      const result = await appMonitor.getAppUsageStats(startDate, endDate);

      expect(result).toEqual({
        success: true,
        stats: {
          totalDuration: 0,
          appCount: 0,
          topApps: [],
        },
      });
    });
  });
});
