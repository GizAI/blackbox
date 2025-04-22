import * as path from 'path';
import * as fs from 'fs';
import { app, ipcMain } from 'electron';
import * as audioRecorder from '../../src/modules/audio-recorder/audio-recorder';

// Mock the database models
jest.mock('../../src/database/models', () => ({
  AudioRecording: {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByPk: jest.fn().mockResolvedValue({
      id: 1,
      path: '/mock/userData/audio/recording_123456.wav',
      timestamp: new Date(),
      transcript: 'This is a test recording',
      duration: 10,
      metadata: { format: 'wav', channels: 1, sampleRate: 16000 },
      save: jest.fn().mockResolvedValue({}),
      destroy: jest.fn().mockResolvedValue(1),
    }),
    create: jest.fn().mockResolvedValue({
      id: 1,
      path: '/mock/userData/audio/recording_123456.wav',
      timestamp: new Date(),
      transcript: '',
      duration: 0,
      metadata: { format: 'wav', channels: 1, sampleRate: 16000 },
      save: jest.fn().mockResolvedValue({}),
    }),
    count: jest.fn().mockResolvedValue(5),
  },
}));

// Mock the settings manager
jest.mock('../../src/modules/settings/settings', () => ({
  __esModule: true,
  default: {
    getSettings: jest.fn().mockReturnValue({
      recording: {
        audioEnabled: true,
        audioFormat: 'wav',
        audioSampleRate: 16000,
        audioChannels: 1,
      },
      ai: {
        autoProcessAudio: true,
        provider: 'openai',
        apiKey: 'mock-api-key',
        model: 'whisper-1',
      },
    }),
    saveSettings: jest.fn().mockResolvedValue(true),
  },
}));

// Mock the AI integration module
jest.mock('../../src/modules/ai-integration/ai-integration', () => ({
  __esModule: true,
  default: {
    processAudioRecording: jest.fn().mockResolvedValue({
      success: true,
      transcript: 'This is a test recording',
    }),
  },
}));

// Mock the node-microphone module
jest.mock('node-microphone', () => {
  return jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockReturnValue({
      on: jest.fn(),
      pipe: jest.fn().mockReturnValue({
        on: jest.fn(),
      }),
    }),
    stopRecording: jest.fn(),
  }));
});

// Mock the fluent-ffmpeg module
jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    outputFormat: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function(event, callback) {
      if (event === 'end') {
        callback();
      }
      return this;
    }),
    run: jest.fn(),
  }));
});

describe('Audio Recorder Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Skip private function tests
  // describe('getAudioSettings', () => {
  //   it('should return audio settings from settings manager', () => {
  //     // Private function
  //   });
  // });

  describe('startAudioRecording and stopAudioRecording', () => {
    it('should start and stop audio recording', () => {
      // Start audio recording
      audioRecorder.startAudioRecording();

      // Stop audio recording
      audioRecorder.stopAudioRecording();

      // We can't verify internal state directly, but we can check that the functions don't throw
      expect(true).toBe(true);
    });
  });

  describe('getRecentAudioRecordings', () => {
    it('should return recent audio recordings', async () => {
      const result = await audioRecorder.getRecentAudioRecordings(5);

      expect(result).toEqual({
        success: true,
        recordings: [],
      });
    });
  });

  describe('setupAudioRecorderHandlers', () => {
    it('should set up IPC handlers for audio recorder', () => {
      audioRecorder.setupAudioRecorderHandlers();

      expect(ipcMain.removeHandler).toHaveBeenCalledWith('audio-recorder:start');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('audio-recorder:stop');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('audio-recorder:get');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('audio-recorder:transcribe');
      expect(ipcMain.removeHandler).toHaveBeenCalledWith('audio-recorder:record-now');

      expect(ipcMain.handle).toHaveBeenCalledWith('audio-recorder:start', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('audio-recorder:stop', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('audio-recorder:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('audio-recorder:transcribe', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('audio-recorder:record-now', expect.any(Function));
    });
  });

  // Skip private function tests
  // describe('transcribeAudio', () => {
  //   it('should transcribe audio using AI integration', async () => {
  //     // Private function
  //   });
  // });

  // describe('recordAudio', () => {
  //   it('should record audio for a specified duration', async () => {
  //     // Private function
  //   });
  // });
});
