import { app, ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as util from 'util';
import * as childProcess from 'child_process';
import { AudioRecording } from '../../database/models';
import settingsManager from '../settings/settings';
import aiManager from '../ai-integration/ai-integration';
import { AudioRecording as AudioRecordingType, ApiResponse } from '../../common/types';
import { EVENTS, ERROR_MESSAGES, DEFAULT_INTERVALS, STORAGE_PATHS } from '../../common/constants';
import events from '../../common/events';

// Import axios for HTTP requests
const axios = require('axios');
const FormData = require('form-data');

// Import ffmpeg for audio processing
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Promisify exec
const exec = util.promisify(childProcess.exec);

// Configuration
let isRecording = false;
let currentAudioFile: string | null = null;
let recordingStartTime: Date | null = null;
let silenceMarkers: {start: number, end: number}[] = [];
let mainWindow: BrowserWindow | null = null;

// Audio recorder options interface
interface AudioOptions {
  sampleRate: number;    // Sample rate
  channels: number;      // Number of channels
  bitsPerSample: number; // Bits per sample
  mimeType: string;      // MIME type
  format: string;        // File format
  silenceDetection: boolean; // Enable silence detection
  silenceThreshold: number;  // Silence threshold (0-1)
  maxSilenceDuration: number; // Max silence duration in ms
  deviceId?: string;     // Audio input device ID
}

// Default audio recorder options
const defaultAudioOptions: AudioOptions = {
  sampleRate: 44100,    // Sample rate
  channels: 1,          // Number of channels (mono for efficiency)
  bitsPerSample: 16,    // Bits per sample
  mimeType: 'audio/webm;codecs=opus', // MIME type (opus is more efficient)
  format: 'webm',       // File format (webm is more efficient than wav)
  silenceDetection: true, // Enable silence detection
  silenceThreshold: 0.05, // Silence threshold (0-1)
  maxSilenceDuration: 3000 // Max silence duration in ms
}

// Directory for storing audio recordings
// Try multiple locations for better compatibility
let audioDir = '';

// Function to test if a directory is writable
function isDirectoryWritable(dir: string): boolean {
  try {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Try to write a test file
    const testFile = path.join(dir, `write-test-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'test');

    // If we get here, the directory is writable
    // Clean up the test file
    fs.unlinkSync(testFile);
    return true;
  } catch (error) {
    console.error(`Directory ${dir} is not writable:`, error);
    return false;
  }
}

// Try multiple locations in order of preference
const possibleLocations = [
  path.join(app.getPath('documents'), 'BlackBoxAI', 'audio'),
  path.join(app.getPath('desktop'), 'BlackBoxAI-audio'),
  path.join(app.getPath('userData'), 'audio'),
  path.join(__dirname, '..', '..', '..', 'audio-recordings')
];

// Find the first writable location
for (const location of possibleLocations) {
  console.log(`Testing audio directory: ${location}`);
  if (isDirectoryWritable(location)) {
    audioDir = location;
    console.log(`Using audio directory: ${audioDir}`);
    break;
  }
}

// If no location is writable, use a fallback
if (!audioDir) {
  audioDir = path.join(app.getPath('temp'), 'blackbox-audio');
  console.log(`Using fallback audio directory: ${audioDir}`);
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
}

// Ensure audio directory exists
function ensureDirectoryExists() {
  console.log(`Checking if audio directory exists: ${audioDir}`);
  try {
    if (!fs.existsSync(audioDir)) {
      console.log(`Creating audio directory: ${audioDir}`);
      fs.mkdirSync(audioDir, { recursive: true });
      console.log(`Audio directory created successfully`);

      // Set permissions to ensure it's writable
      try {
        fs.chmodSync(audioDir, 0o755); // rwxr-xr-x
        console.log(`Set permissions on audio directory`);
      } catch (permError: any) {
        console.error(`Failed to set permissions: ${permError?.message || 'Unknown error'}`);
      }
    } else {
      console.log(`Audio directory already exists`);
    }

    // Verify directory is writable
    const testFile = path.join(audioDir, `write-test-${Date.now()}.tmp`);
    try {
      fs.writeFileSync(testFile, 'test');
      console.log(`Successfully wrote test file to audio directory`);
      fs.unlinkSync(testFile);
    } catch (writeError: any) {
      console.error(`Directory is not writable: ${writeError?.message || 'Unknown error'}`);
      throw new Error(`Audio directory is not writable: ${writeError?.message}`);
    }

    // List files in the directory
    try {
      const files = fs.readdirSync(audioDir);
      console.log(`Files in audio directory: ${files.length}`);
      files.forEach(file => {
        console.log(`- ${file}`);
      });
    } catch (readError: any) { // Use any type to avoid TS errors
      console.error(`Failed to read audio directory: ${readError?.message || 'Unknown error'}`);
    }

    return audioDir;
  } catch (error: any) {
    console.error(`Error ensuring audio directory exists: ${error?.message || 'Unknown error'}`);
    // Try alternative location
    try {
      // Try multiple alternative locations
      const alternatives = [
        path.join(app.getPath('documents'), 'blackbox-audio'),
        path.join(app.getPath('userData'), 'audio'),
        path.join(app.getPath('temp'), 'blackbox-audio')
      ];

      for (const altDir of alternatives) {
        console.log(`Trying alternative audio directory: ${altDir}`);
        if (!fs.existsSync(altDir)) {
          fs.mkdirSync(altDir, { recursive: true });
          console.log(`Alternative audio directory created successfully`);
        }

        // Test if writable
        const testFile = path.join(altDir, `write-test-${Date.now()}.tmp`);
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          console.log(`Found writable alternative directory: ${altDir}`);

          // Update the global audioDir variable
          audioDir = altDir;
          return audioDir;
        } catch (writeError) {
          console.error(`Alternative directory not writable: ${writeError}`);
          // Continue to next alternative
        }
      }

      // If we get here, none of the alternatives worked
      throw new Error('Could not find a writable directory for audio recordings');
    } catch (altError: any) {
      console.error(`Error creating alternative audio directory: ${altError?.message || 'Unknown error'}`);
      throw altError; // Re-throw to handle in the calling function
    }
  }
}

// Set the main window for communication with renderer process
export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

// Get audio options from settings
function getAudioOptions(): AudioOptions {
  const settings = settingsManager.getSettings();
  const recordingSettings = settings.recording;

  return {
    sampleRate: recordingSettings.audioSampleRate || defaultAudioOptions.sampleRate,
    channels: recordingSettings.audioChannels || defaultAudioOptions.channels,
    bitsPerSample: recordingSettings.audioBitsPerSample || defaultAudioOptions.bitsPerSample,
    mimeType: `audio/${recordingSettings.audioFormat || defaultAudioOptions.format}`,
    format: recordingSettings.audioFormat || defaultAudioOptions.format,
    silenceDetection: recordingSettings.silenceDetection !== undefined ?
      recordingSettings.silenceDetection : defaultAudioOptions.silenceDetection,
    silenceThreshold: recordingSettings.silenceThreshold || defaultAudioOptions.silenceThreshold,
    maxSilenceDuration: recordingSettings.maxSilenceDuration || defaultAudioOptions.maxSilenceDuration,
    deviceId: recordingSettings.audioDeviceId
  };
}

// Start audio recording
export function startAudioRecording(): ApiResponse<any> {
  if (isRecording) {
    console.log('Already recording audio, stopping current recording first');
    stopAudioRecording().catch(err => {
      console.error('Error stopping previous recording:', err);
    });
    // Return immediately to avoid race conditions
    return {
      success: false,
      error: ERROR_MESSAGES.RECORDING_ALREADY_STARTED,
      message: 'Already recording, please try again in a moment'
    };
  }

  try {
    // Ensure audio directory exists and is writable
    try {
      ensureDirectoryExists();
    } catch (dirError: any) {
      console.error('Failed to create audio directory:', dirError);
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
        message: `Failed to create audio directory: ${dirError?.message || 'Unknown error'}`
      };
    }

    isRecording = true;
    recordingStartTime = new Date();
    silenceMarkers = [];

    // Get audio options
    const audioOptions = getAudioOptions();

    // Generate filename with timestamp
    const timestamp = recordingStartTime.getTime();
    const filename = `audio_${timestamp}.${audioOptions.format}`;
    currentAudioFile = path.join(audioDir, filename);

    // Log information on the console
    console.log(`Audio recording started: ${currentAudioFile}`);

    // Use built-in audio recording approach
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Remove any existing handlers to avoid duplicates
      ipcMain.removeAllListeners('audio-recorder:silence-detected');
      ipcMain.removeAllListeners('audio-recorder:silence-ended');
      ipcMain.removeAllListeners('audio-recorder:data');
      ipcMain.removeAllListeners('audio-recorder:error');

      // Create an empty file to ensure it exists and is writable
      try {
        fs.writeFileSync(currentAudioFile, Buffer.from([]));
        console.log(`Created empty audio file: ${currentAudioFile}`);
      } catch (fileError: any) {
        console.error(`Failed to create audio file: ${fileError?.message || 'Unknown error'}`);
        isRecording = false;
        return {
          success: false,
          error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
          message: `Failed to create audio file: ${fileError?.message || 'Unknown error'}`
        };
      }

      // Send message to renderer process to start recording
      mainWindow.webContents.send('audio-recorder:start-recording', {
        options: audioOptions,
        filePath: currentAudioFile
      });

      // Set up IPC handler for silence detection
      ipcMain.on('audio-recorder:silence-detected', (_event, data) => {
        const { timestamp, level } = data;
        console.log(`Silence detected at ${new Date(timestamp).toISOString()}, level: ${level}`);

        // Add to silence markers
        if (silenceMarkers.length === 0 || silenceMarkers[silenceMarkers.length - 1].end !== 0) {
          silenceMarkers.push({
            start: timestamp,
            end: 0 // Will be updated when silence ends
          });
        }

        // Emit event
        events.emit(EVENTS.AUDIO.SILENCE_DETECTED, { timestamp, level });
      });

      // Set up IPC handler for silence ended
      ipcMain.on('audio-recorder:silence-ended', (_event, data) => {
        const { timestamp, duration } = data;
        console.log(`Silence ended at ${new Date(timestamp).toISOString()}, duration: ${duration}s`);

        // Update the last silence marker
        if (silenceMarkers.length > 0 && silenceMarkers[silenceMarkers.length - 1].end === 0) {
          silenceMarkers[silenceMarkers.length - 1].end = timestamp;
        }

        // Emit event
        events.emit(EVENTS.AUDIO.SILENCE_ENDED, { timestamp, duration });
      });

      // Set up IPC handler for recording data
      ipcMain.on('audio-recorder:data', (_event, chunk) => {
        // Process the audio data
        console.log(`Received audio data chunk: ${chunk ? chunk.length : 0} bytes`);

        // If we have a file path and data, append to file
        if (currentAudioFile && chunk && chunk.length > 0) {
          try {
            // Ensure directory exists
            const dir = path.dirname(currentAudioFile);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            // Log first few bytes for debugging
            console.log(`First few bytes: ${chunk.slice(0, 10)}`);

            // Create buffer from chunk
            const buffer = Buffer.from(chunk);
            console.log(`Created buffer with length: ${buffer.length} bytes`);

            // Append data to file
            fs.appendFileSync(currentAudioFile, buffer);
            console.log(`Appended ${buffer.length} bytes to ${currentAudioFile}`);

            // Verify file size after append
            try {
              const stats = fs.statSync(currentAudioFile);
              console.log(`Current file size: ${stats.size} bytes`);
            } catch (statError) {
              console.error('Error checking file size:', statError);
            }
          } catch (error) {
            console.error('Error appending audio data to file:', error);
          }
        } else {
          console.error('Cannot append audio data:', {
            hasCurrentAudioFile: !!currentAudioFile,
            hasChunk: !!chunk,
            chunkLength: chunk ? chunk.length : 0
          });
        }
      });

      // Set up IPC handler for recording error
      ipcMain.on('audio-recorder:error', (_event, error) => {
        console.error('Audio recording error:', error);
        isRecording = false;

        // Emit event
        events.emit(EVENTS.AUDIO.ERROR, { error });
      });

      // Emit event
      events.emit(EVENTS.RECORDING.STATUS_CHANGE, { module: 'audio', isRecording: true });

      return {
        success: true,
        message: 'Audio recording started',
        data: { filePath: currentAudioFile }
      };
    } else {
      console.error('Main window is not available');
      isRecording = false;
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
        message: 'Main window is not available'
      };
    }
  } catch (error: any) {
    console.error('Error starting audio recording:', error?.message || 'Unknown error');
    isRecording = false;
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_START_RECORDING,
      message: error?.message || 'Unknown error'
    };
  }
}



// Stop audio recording
export async function stopAudioRecording(): Promise<ApiResponse<any>> {
  if (!isRecording || !currentAudioFile || !recordingStartTime) {
    return {
      success: false,
      error: ERROR_MESSAGES.RECORDING_NOT_STARTED,
      message: 'Not recording or missing recording data'
    };
  }

  try {
    // Send message to renderer process to stop recording
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('audio-recorder:stop-recording');
    }

    isRecording = false;

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime.getTime() - recordingStartTime.getTime();
    const durationSec = durationMs / 1000;

    // Get audio options
    const audioOptions = getAudioOptions();

    // Process the audio file to remove silence if needed
    const processedFile = await processAudioFile(currentAudioFile, silenceMarkers);
    const finalFilePath = processedFile || currentAudioFile;

    // Save to database
    const recording = await AudioRecording.create({
      path: finalFilePath,
      timestamp: recordingStartTime,
      duration: durationSec,
      transcript: '', // Will be filled by STT later
      metadata: {
        format: audioOptions.format,
        sampleRate: audioOptions.sampleRate,
        channels: audioOptions.channels,
        bitsPerSample: audioOptions.bitsPerSample,
        silenceMarkers: silenceMarkers
      }
    });

    console.log(`Audio recording stopped: ${finalFilePath}`);

    // Remove IPC handlers
    ipcMain.removeAllListeners('audio-recorder:data');
    ipcMain.removeAllListeners('audio-recorder:silence-detected');
    ipcMain.removeAllListeners('audio-recorder:silence-ended');
    ipcMain.removeAllListeners('audio-recorder:error');

    // Auto-transcribe if enabled in settings
    const settings = settingsManager.getSettings();
    if (settings.ai?.autoTranscribeAudio && recording.id) {
      // Transcribe in the background without waiting
      transcribeAudioRecording(recording.id).catch(err => {
        console.error('Error auto-transcribing audio:', err);
      });
    }

    // Reset variables
    const savedFilePath = finalFilePath;
    const recordingId = recording.id;
    currentAudioFile = null;
    recordingStartTime = null;
    silenceMarkers = [];

    // Emit event
    events.emit(EVENTS.RECORDING.STATUS_CHANGE, { module: 'audio', isRecording: false });
    events.emit(EVENTS.AUDIO.PROCESSED, { recordingId, filePath: savedFilePath, duration: durationSec });

    return {
      success: true,
      message: 'Audio recording stopped successfully',
      data: {
        recordingId,
        filePath: savedFilePath,
        duration: durationSec
      }
    };
  } catch (error: any) {
    console.error('Error stopping audio recording:', error?.message || 'Unknown error');
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_STOP_RECORDING,
      message: error?.message || 'Unknown error'
    };
  }
}

// Process audio file to remove silence
async function processAudioFile(filePath: string, silenceMarkers: {start: number, end: number}[]): Promise<string | null> {
  // If no silence markers or silence detection is disabled, return the original file
  const audioOptions = getAudioOptions();
  if (!audioOptions.silenceDetection || silenceMarkers.length === 0 || !fs.existsSync(filePath)) {
    return filePath;
  }

  try {
    // Create a processed file path
    const originalExt = path.extname(filePath);
    const baseName = path.basename(filePath, originalExt);
    const processedPath = path.join(path.dirname(filePath), `${baseName}_processed${originalExt}`);

    // Use ffmpeg to process the file
    return new Promise<string>((resolve) => {
      console.log(`Processing audio file: ${filePath}`);
      console.log(`Silence markers: ${JSON.stringify(silenceMarkers)}`);

      // Create complex filter for silence removal
      // This approach uses the 'atrim' filter to keep only the non-silent parts
      let filterComplex = '';
      let segments = [];

      // If we have silence markers, create segments to keep
      if (silenceMarkers.length > 0) {
        // Start time of the recording
        const startTime = recordingStartTime ? recordingStartTime.getTime() : 0;

        // Create segments for each non-silent part
        let lastEnd = 0;

        silenceMarkers.forEach((marker, index) => {
          // Calculate relative timestamps in seconds
          const segmentStart = lastEnd / 1000;
          const segmentEnd = (marker.start - startTime) / 1000;

          // Only add segment if it has positive duration
          if (segmentEnd > segmentStart) {
            segments.push(`[0:a]atrim=${segmentStart}:${segmentEnd},asetpts=PTS-STARTPTS[s${index}]`);
          }

          // Update lastEnd for next segment
          lastEnd = marker.end - startTime;
        });

        // Add final segment if needed
        // Calculate approximate duration based on file size and audio properties
        const fileStats = fs.statSync(filePath);
        const bytesPerSecond = audioOptions.sampleRate * audioOptions.channels * (audioOptions.bitsPerSample / 8);
        const approximateDuration = fileStats.size / bytesPerSecond;

        if (lastEnd / 1000 < approximateDuration) {
          const segmentStart = lastEnd / 1000;
          segments.push(`[0:a]atrim=${segmentStart},asetpts=PTS-STARTPTS[s${silenceMarkers.length}]`);
        }

        // Create concat filter if we have segments
        if (segments.length > 0) {
          filterComplex = segments.join(';') + ';';

          // Add concat filter
          const segmentRefs = Array.from({length: segments.length}, (_, i) => `[s${i}]`).join('');
          filterComplex += `${segmentRefs}concat=n=${segments.length}:v=0:a=1[out]`;
        }
      }

      // Create ffmpeg command
      const command = ffmpeg(filePath);

      // Apply filter if we have one
      if (filterComplex) {
        command
          .outputOptions('-filter_complex', filterComplex)
          .outputOptions('-map', '[out]');
      } else {
        // If no silence markers or processing failed, just copy the audio
        command.outputOptions('-c:a', 'copy');
      }

      // Set output format and save
      command
        .outputFormat(audioOptions.format)
        .audioChannels(audioOptions.channels)
        .audioFrequency(audioOptions.sampleRate)
        .save(processedPath)
        .on('end', () => {
          console.log(`Audio processed: ${processedPath}`);
          resolve(processedPath);
        })
        .on('error', (err: Error) => {
          console.error('Error processing audio:', err);
          resolve(filePath); // Fallback to original file on error
        });
    });
  } catch (error: any) {
    console.error('Error processing audio file:', error?.message || 'Unknown error');
    return filePath; // Return original file on error
  }
}

// Transcribe audio with OpenAI Whisper API
async function transcribeWithOpenAI(filePath: string, apiKey: string, model: string = 'whisper-1'): Promise<string> {
  return new Promise<string>((resolve) => {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Audio file not found:', filePath);
        resolve('Audio file not found. Please try again.');
        return;
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('model', model);
      formData.append('response_format', 'text');

      // Get language from settings
      const settings = settingsManager.getSettings();
      if (settings.ui.language && settings.ui.language !== 'en') {
        formData.append('language', settings.ui.language);
      }

      // Send request to OpenAI API
      axios({
        method: 'post',
        url: 'https://api.openai.com/v1/audio/transcriptions',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        data: formData
      })
      .then((response: any) => {
        if (response.status !== 200) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        resolve(response.data);
      })
      .catch((error: Error) => {
        console.error('Error transcribing with OpenAI:', error);
        // Return a fallback message
        resolve('Transcription failed. Please check your API key and try again.');
      });
    } catch (error) {
      console.error('Error preparing OpenAI transcription request:', error);
      // Return a fallback message
      resolve('Error preparing transcription request. Please try again later.');
    }
  });
}

// Transcribe audio with AI integration module
async function transcribeAudioRecording(recordingId: number): Promise<any> {
  try {
    // Find the recording
    const recording = await AudioRecording.findByPk(recordingId);
    if (!recording) {
      return { success: false, error: 'Recording not found' };
    }

    // Check if file exists
    if (!fs.existsSync(recording.path)) {
      return { success: false, error: 'Audio file not found' };
    }

    // Use AI integration module for transcription
    let result;

    // Check if AI manager has transcribeAudio method
    if (typeof aiManager.processAudioRecording === 'function') {
      result = await aiManager.processAudioRecording(recordingId, {
        language: settingsManager.getSettings().ui.language || 'en'
      });
    } else {
      // Fallback to OpenAI Whisper API
      const aiSettings = settingsManager.getSettings().ai;
      if (aiSettings.apiKey && aiSettings.provider === 'openai') {
        result = await transcribeWithOpenAI(recording.path, aiSettings.apiKey);
      } else {
        return { success: false, error: 'No AI provider configured for transcription' };
      }
    }

    // If successful, update the recording with the transcript
    if (typeof result === 'string') {
      recording.transcript = result;
      await recording.save();
      return { success: true, transcript: result };
    } else if (result && result.success && result.transcript) {
      recording.transcript = result.transcript;
      await recording.save();
      return { success: true, transcript: result.transcript };
    } else {
      return { success: false, error: 'Failed to transcribe audio' };
    }
  } catch (error: any) {
    console.error('Error transcribing audio:', error?.message || 'Unknown error');
    return { success: false, error: 'Failed to transcribe audio' };
  }
}

// Get recent audio recordings
export async function getRecentAudioRecordings(limit = 50, options: any = {}): Promise<ApiResponse<any>> {
  try {
    const query: any = {
      order: [['timestamp', 'DESC']],
      limit
    };

    // Add where clause if provided
    if (options.where) {
      query.where = options.where;
    }

    // Add include if provided
    if (options.include) {
      query.include = options.include;
    }

    const recordings = await AudioRecording.findAll(query);

    return {
      success: true,
      message: `Retrieved ${recordings.length} audio recordings`,
      data: { recordings }
    };
  } catch (error) {
    console.error('Error fetching audio recordings:', error);
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_GET_AUDIO_RECORDINGS,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { recordings: [] }
    };
  }
}

// Set up IPC handlers
export function setupAudioRecorderHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    // 하드코딩된 채널명 사용
    const audioChannels = [
      'audio-recorder:start',
      'audio-recorder:stop',
      'audio-recorder:get',
      'audio-recorder:transcribe',
      'audio-recorder:get-by-date',
      'audio-recorder:delete',
      'audio-recorder:update',
      'audio-recorder:get-devices',
      'audio-recorder:save-blob'
    ];

    audioChannels.forEach(channel => {
      ipcMain.removeHandler(channel);
    });

    // Remove any existing event listeners
    ipcMain.removeAllListeners('audio-recorder:recording-complete');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Set up event listener for recording complete
  ipcMain.on('audio-recorder:recording-complete', async (_event, data) => {
    try {
      console.log('Recording complete event received:', data);
      const { filePath, timestamp, duration, mimeType } = data;

      // Debug: Log all available data
      console.log('Recording complete data:', JSON.stringify(data, null, 2));

      // Verify the file exists and is valid
      if (!fs.existsSync(filePath)) {
        console.error(`Audio file does not exist at path: ${filePath}`);
        // Debug: Check directory exists
        const dir = path.dirname(filePath);
        console.log(`Directory exists: ${fs.existsSync(dir)}`);
        console.log(`Directory contents:`, fs.readdirSync(dir));
        return;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.error(`Audio file is empty: ${filePath}`);
        return;
      }

      console.log(`Verified audio file: ${filePath}, size: ${stats.size} bytes`);

      // Extract format from file path or MIME type
      let format = path.extname(filePath).replace('.', '');
      if (!format && mimeType) {
        format = mimeType.split('/')[1];
        if (format.includes(';')) {
          format = format.split(';')[0];
        }
      }
      if (!format) {
        format = 'wav'; // Default format
      }

      // Save to database
      const recording = await AudioRecording.create({
        path: filePath,
        timestamp: new Date(timestamp),
        duration: duration,
        transcript: '', // Will be filled by STT later
        metadata: {
          format: format,
          mimeType: mimeType || `audio/${format}`,
          silenceMarkers: [],
          fileSize: stats.size
        }
      });

      console.log(`Audio recording saved to database with ID: ${recording.id}`);

      // Auto-transcribe if enabled in settings
      const settings = settingsManager.getSettings();
      if (settings.ai && settings.ai.autoTranscribeAudio && recording.id) {
        // Transcribe in the background without waiting
        transcribeAudioRecording(recording.id).catch(err => {
          console.error('Error auto-transcribing audio:', err);
        });
      }
    } catch (error) {
      console.error('Error saving audio recording to database:', error);
    }
  });

  // Add handlers
  ipcMain.handle('audio-recorder:start', () => {
    return startAudioRecording();
  });

  ipcMain.handle('audio-recorder:stop', async () => {
    return await stopAudioRecording();
  });

  ipcMain.handle('audio-recorder:get', async (_event, data) => {
    const { limit, options } = data || { limit: 50 };
    return await getRecentAudioRecordings(limit, options);
  });

  // Add handler for transcribing audio
  ipcMain.handle('audio-recorder:transcribe', async (_event, recordingId) => {
    return await transcribeAudioRecording(recordingId);
  });

  // Add handler for deleting audio recording
  ipcMain.handle('audio-recorder:delete', async (_event, recordingId) => {
    try {
      const recording = await AudioRecording.findByPk(recordingId);
      if (!recording) {
        return { success: false, error: 'Recording not found' };
      }

      // Delete file if it exists
      if (recording.path && fs.existsSync(recording.path)) {
        fs.unlinkSync(recording.path);
      }

      // Delete from database
      await recording.destroy();

      return { success: true };
    } catch (error) {
      console.error('Error deleting audio recording:', error);
      return { success: false, error: 'Failed to delete audio recording' };
    }
  });

  // Add handler for updating audio recording
  ipcMain.handle('audio-recorder:update', async (_event, data) => {
    try {
      const { id, updates } = data;

      const recording = await AudioRecording.findByPk(id);
      if (!recording) {
        return { success: false, error: 'Recording not found' };
      }

      // Update recording
      await recording.update(updates);

      return { success: true, recording };
    } catch (error) {
      console.error('Error updating audio recording:', error);
      return { success: false, error: 'Failed to update audio recording' };
    }
  });

  // Add handler for getting audio devices
  ipcMain.handle('audio-recorder:get-devices', async () => {
    return await getAudioDevices();
  });

  // Add handler for saving audio blob from renderer
  ipcMain.handle('audio-recorder:save-blob', async (_event, data) => {
    try {
      const { filePath, buffer, mimeType } = data;
      console.log(`Received audio blob with MIME type: ${mimeType} and buffer length: ${buffer.length}`);

      // Debug: Log audio directory and permissions
      console.log(`Audio directory: ${audioDir}`);
      try {
        const stats = fs.statSync(audioDir);
        console.log(`Audio directory stats: ${JSON.stringify({
          isDirectory: stats.isDirectory(),
          mode: stats.mode.toString(8),
          uid: stats.uid,
          gid: stats.gid,
          size: stats.size,
          mtime: stats.mtime
        })}`);
      } catch (statError) {
        console.error(`Error getting audio directory stats: ${statError}`);
      }

      // Create a more reliable file path in the tested audio directory
      const originalFileName = path.basename(filePath);
      const timestamp = new Date().getTime();
      const safeFilePath = path.join(audioDir, `audio_${timestamp}_${originalFileName}`);
      console.log(`Using safe file path: ${safeFilePath}`);

      // Create a buffer from the array
      const audioBuffer = Buffer.from(buffer);
      console.log(`Created audio buffer with length: ${audioBuffer.length} bytes`);

      // Check if buffer is valid
      if (audioBuffer.length === 0) {
        console.error('Audio buffer is empty');
        return { success: false, error: 'Audio buffer is empty' };
      }

      // First, save the raw audio data to ensure we have a copy
      const rawFilePath = `${safeFilePath}.raw`;
      try {
        fs.writeFileSync(rawFilePath, audioBuffer);
        console.log(`Raw audio data saved to ${rawFilePath}`);
      } catch (rawError) {
        console.error(`Failed to save raw audio data: ${rawError.message}`);
        // Continue anyway, we'll try the main save
      }

      // Determine the best output format based on MIME type
      let outputFormat = 'wav'; // Default to WAV for reliability
      let outputExt = '.wav';
      let finalFilePath = safeFilePath;

      // If the MIME type is specified, try to use a more efficient format
      if (mimeType) {
        if (mimeType.includes('webm') || mimeType.includes('opus')) {
          // WebM/Opus is already efficient, but convert to MP3 for compatibility
          outputFormat = 'mp3';
          outputExt = '.mp3';
        } else if (mimeType.includes('mp4') || mimeType.includes('aac')) {
          outputFormat = 'm4a';
          outputExt = '.m4a';
        } else if (mimeType.includes('ogg')) {
          outputFormat = 'ogg';
          outputExt = '.ogg';
        } else if (mimeType.includes('wav')) {
          outputFormat = 'wav';
          outputExt = '.wav';
        }
      }

      // Make sure the file path has the correct extension
      if (!finalFilePath.toLowerCase().endsWith(outputExt)) {
        finalFilePath = finalFilePath.replace(/\.[^\.]+$/, '') + outputExt;
      }

      // Try direct save first (most reliable)
      try {
        fs.writeFileSync(finalFilePath, audioBuffer);
        console.log(`Audio saved directly to ${finalFilePath}`);

        // Verify the file was written correctly
        const stats = fs.statSync(finalFilePath);
        console.log(`Saved file size: ${stats.size} bytes`);

        if (stats.size === 0) {
          throw new Error('Saved file is empty');
        }

        // Try to read the first few bytes to verify it's a valid file
        const fd = fs.openSync(finalFilePath, 'r');
        const headerBuffer = Buffer.alloc(16);
        fs.readSync(fd, headerBuffer, 0, 16, 0);
        fs.closeSync(fd);

        console.log(`File header: ${headerBuffer.toString('hex')}`);

        // If we get here, the direct save was successful
        return { success: true, filePath: finalFilePath };
      } catch (directSaveError) {
        console.error(`Direct save failed: ${directSaveError.message}`);
        // Fall through to try conversion
      }

      // If direct save failed and we have ffmpeg, try conversion
      if (ffmpeg) {
        try {
          console.log(`Attempting to save with ffmpeg conversion to ${outputFormat}`);

          // Create a temporary WAV file first
          const tempWavPath = `${safeFilePath}.temp.wav`;

          // Create a simple WAV header
          const header = Buffer.alloc(44);

          // RIFF header
          header.write('RIFF', 0);
          header.writeUInt32LE(36 + audioBuffer.length, 4); // File size - 8
          header.write('WAVE', 8);

          // Format chunk
          header.write('fmt ', 12);
          header.writeUInt32LE(16, 16); // Format chunk size
          header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
          header.writeUInt16LE(1, 22); // Number of channels
          header.writeUInt32LE(44100, 24); // Sample rate
          header.writeUInt32LE(44100 * 2, 28); // Byte rate
          header.writeUInt16LE(2, 32); // Block align
          header.writeUInt16LE(16, 34); // Bits per sample

          // Data chunk
          header.write('data', 36);
          header.writeUInt32LE(audioBuffer.length, 40); // Data size

          // Combine header and audio data
          const wavFile = Buffer.concat([header, audioBuffer]);

          // Write the WAV file
          fs.writeFileSync(tempWavPath, wavFile);
          console.log(`Temporary WAV file created at ${tempWavPath}`);

          // Convert to the desired format using ffmpeg
          await new Promise<void>((resolve, reject) => {
            const ffmpegCommand = ffmpeg(tempWavPath)
              .outputFormat(outputFormat)
              .audioChannels(1) // Mono for efficiency
              .audioFrequency(44100);

            // Add format-specific options
            if (outputFormat === 'mp3') {
              ffmpegCommand.audioBitrate('128k'); // Good quality
            } else if (outputFormat === 'm4a') {
              ffmpegCommand.audioBitrate('128k');
            } else if (outputFormat === 'ogg') {
              ffmpegCommand.audioBitrate('128k');
            }

            ffmpegCommand
              .on('start', (commandLine: string) => {
                console.log('FFmpeg command:', commandLine);
              })
              .on('end', () => {
                console.log(`Audio converted to ${outputFormat}: ${finalFilePath}`);
                // Remove the temporary file
                try {
                  fs.unlinkSync(tempWavPath);
                } catch (unlinkError) {
                  console.error('Error removing temporary file:', unlinkError);
                }
                resolve();
              })
              .on('error', (err: Error) => {
                console.error('Error converting audio:', err);
                reject(err);
              })
              .save(finalFilePath);
          });

          // Verify the converted file exists
          if (fs.existsSync(finalFilePath)) {
            const stats = fs.statSync(finalFilePath);
            console.log(`Converted file size: ${stats.size} bytes`);

            if (stats.size > 0) {
              return { success: true, filePath: finalFilePath };
            }
          }

          throw new Error('Conversion failed to produce a valid file');
        } catch (conversionError) {
          console.error(`Conversion failed: ${conversionError.message}`);
          // Fall through to last resort
        }
      }

      // Last resort: If we have a raw file, try to use that
      if (fs.existsSync(rawFilePath) && fs.statSync(rawFilePath).size > 0) {
        const lastResortPath = `${safeFilePath}.backup.bin`;
        fs.copyFileSync(rawFilePath, lastResortPath);
        console.log(`Created backup audio file: ${lastResortPath}`);
        return { success: true, filePath: lastResortPath };
      }

      return { success: false, error: 'All audio save methods failed' };
    } catch (error: any) {
      console.error('Error saving audio blob:', error?.message || 'Unknown error');
      return { success: false, error: 'Failed to save audio blob' };
    }
  });
}

// Get audio devices
export async function getAudioDevices(): Promise<any> {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Request audio devices from renderer process
      const devices = await mainWindow.webContents.executeJavaScript('navigator.mediaDevices.enumerateDevices()');

      // Filter audio input devices
      const audioInputDevices = devices.filter((device: any) => device.kind === 'audioinput');

      return { success: true, devices: audioInputDevices };
    } else {
      return { success: false, error: 'Main window is not available', devices: [] };
    }
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return { success: false, error: 'Failed to get audio devices', devices: [] };
  }
}

