import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as mic from 'node-microphone';
import { AudioRecording } from '../../database/models';

// Configuration
let isRecording = false;
let microphone: any = null;
let audioStream: any = null;
let currentAudioFile: string | null = null;
let recordingStartTime: Date | null = null;
let silenceDetectionEnabled = true;
let silenceThreshold = 0.05; // Threshold for silence detection
let silenceDuration = 0;
let maxSilenceDuration = 3000; // 3 seconds of silence before pausing

// Directory for storing audio recordings
const audioDir = path.join(app.getPath('userData'), 'audio');

// Ensure audio directory exists
function ensureDirectoryExists() {
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }
}

// Start audio recording
export function startAudioRecording() {
  if (isRecording) return;
  
  ensureDirectoryExists();
  isRecording = true;
  recordingStartTime = new Date();
  
  try {
    // Initialize microphone
    microphone = new mic();
    
    // Generate filename with timestamp
    const timestamp = recordingStartTime.getTime();
    const filename = `audio_${timestamp}.wav`;
    currentAudioFile = path.join(audioDir, filename);
    
    // Start recording
    audioStream = microphone.startRecording();
    
    // Create write stream for saving audio
    const fileStream = fs.createWriteStream(currentAudioFile);
    audioStream.pipe(fileStream);
    
    // Set up silence detection
    if (silenceDetectionEnabled) {
      audioStream.on('data', (data: Buffer) => {
        // Simple silence detection by checking audio levels
        const audioLevel = calculateAudioLevel(data);
        
        if (audioLevel < silenceThreshold) {
          silenceDuration += 100; // Assuming data chunks come every ~100ms
          
          if (silenceDuration >= maxSilenceDuration) {
            // Too much silence, pause recording
            // In a real implementation, we would mark this section as silent
            // but keep recording to maintain timestamp continuity
            console.log('Silence detected, marking section');
          }
        } else {
          // Reset silence counter when sound is detected
          silenceDuration = 0;
        }
      });
    }
    
    console.log(`Audio recording started: ${currentAudioFile}`);
    return true;
  } catch (error) {
    console.error('Error starting audio recording:', error);
    isRecording = false;
    return false;
  }
}

// Calculate audio level from buffer
function calculateAudioLevel(buffer: Buffer): number {
  // Simple RMS calculation for audio level
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 2) {
    // Convert 16-bit PCM sample to float
    const sample = buffer.readInt16LE(i) / 32768.0;
    sum += sample * sample;
  }
  
  const rms = Math.sqrt(sum / (buffer.length / 2));
  return rms;
}

// Stop audio recording
export async function stopAudioRecording() {
  if (!isRecording || !microphone || !currentAudioFile || !recordingStartTime) return false;
  
  try {
    // Stop recording
    microphone.stopRecording();
    isRecording = false;
    
    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime.getTime() - recordingStartTime.getTime();
    const durationSec = durationMs / 1000;
    
    // Save to database
    await AudioRecording.create({
      path: currentAudioFile,
      timestamp: recordingStartTime,
      duration: durationSec,
      transcript: '', // Will be filled by STT later
      metadata: { format: 'wav', sampleRate: 44100 }
    });
    
    console.log(`Audio recording stopped: ${currentAudioFile}`);
    
    // Reset variables
    microphone = null;
    audioStream = null;
    currentAudioFile = null;
    recordingStartTime = null;
    silenceDuration = 0;
    
    return true;
  } catch (error) {
    console.error('Error stopping audio recording:', error);
    return false;
  }
}

// Get recent audio recordings
export async function getRecentAudioRecordings(limit = 50) {
  try {
    const recordings = await AudioRecording.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });
    
    return recordings;
  } catch (error) {
    console.error('Error fetching audio recordings:', error);
    return [];
  }
}

// Set up IPC handlers
export function setupAudioRecorderHandlers() {
  ipcMain.handle('audio-recorder:start', () => {
    return startAudioRecording();
  });
  
  ipcMain.handle('audio-recorder:stop', async () => {
    return await stopAudioRecording();
  });
  
  ipcMain.handle('audio-recorder:get', async (event, limit) => {
    return await getRecentAudioRecordings(limit);
  });
}
