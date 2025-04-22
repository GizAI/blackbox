// Audio recorder for the renderer process
// Define constants that were previously imported
// 하드코딩된 채널명 사용

// Prevent multiple initializations
if (window.audioRecorderInitialized) {
  console.log('Audio recorder already initialized, skipping initialization');
} else {
  window.audioRecorderInitialized = true;

  const ERROR_MESSAGES = {
    FAILED_TO_START_RECORDING: 'Failed to start recording',
    FAILED_TO_STOP_RECORDING: 'Failed to stop recording'
  };

  // State variables
  let mediaRecorder = null;
  let audioChunks = [];
  let silenceDetectionEnabled = true;
  let silenceThreshold = 0.02; // Even lower threshold for better voice detection
  let silenceDuration = 0;
  let maxSilenceDuration = 1000; // 1 second - shorter to detect pauses between sentences
  let lastSilenceStart = 0;
  let isSilent = false;
  let audioContext = null;
  let analyser = null;
  let scriptProcessor = null;
  let audioStream = null;
  let currentFilePath = null;
  let recordingStartTime = null;
  let isRecording = false; // 로컬에서 정의
  let speechSegments = []; // Track speech segments
  let currentSpeechStart = 0; // Track start of current speech segment
  let minSpeechDuration = 1000; // Minimum speech duration to be considered meaningful (1 second)
  let maxSpeechDuration = 30000; // Maximum speech segment duration (30 seconds)
  let energyHistory = []; // Store recent energy levels for better detection
  let energyHistorySize = 10; // Number of frames to keep in history

// Check audio API support
function checkAudioSupport() {
  console.log('Checking audio API support...');

  // Check MediaDevices API
  if (!navigator.mediaDevices) {
    console.error('MediaDevices API not supported');
    return false;
  }

  // Check getUserMedia
  if (!navigator.mediaDevices.getUserMedia) {
    console.error('getUserMedia not supported');
    return false;
  }

  // Check AudioContext
  if (!window.AudioContext && !window.webkitAudioContext) {
    console.error('AudioContext not supported');
    return false;
  }

  // Check MediaRecorder
  if (!window.MediaRecorder) {
    console.error('MediaRecorder not supported');
    return false;
  }

  // Check supported MIME types
  const supportedMimeTypes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg',
    'audio/wav'
  ];

  const supportedTypes = supportedMimeTypes.filter(type => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch (e) {
      return false;
    }
  });

  console.log('Supported audio MIME types:', supportedTypes);

  if (supportedTypes.length === 0) {
    console.error('No supported audio MIME types found');
    return false;
  }

  console.log('Audio API support check passed');
  return true;
}

// Initialize audio recorder
async function initAudioRecorder() {
  try {
    // Check audio API support first
    if (!checkAudioSupport()) {
      console.error('Audio API not supported');
      return false;
    }

    console.log('Requesting microphone access...');
    // Request microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Microphone access granted');

    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('AudioContext created, state:', audioContext.state);

    // Resume audio context if it's suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('AudioContext resumed, new state:', audioContext.state);
    }

    // Create analyser node
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    // Create script processor node
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    // Connect nodes
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    // Set up silence detection
    if (silenceDetectionEnabled) {
      scriptProcessor.onaudioprocess = detectSilence;
    }

    console.log('Audio recorder initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing audio recorder:', error);
    return false;
  }
}

// Calculate RMS (Root Mean Square) energy of audio buffer
function calculateRMSEnergy(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// Calculate ZCR (Zero Crossing Rate) of audio buffer
function calculateZCR(buffer) {
  let crossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    if ((buffer[i] >= 0 && buffer[i-1] < 0) ||
        (buffer[i] < 0 && buffer[i-1] >= 0)) {
      crossings++;
    }
  }
  return crossings / buffer.length;
}

// Detect speech vs silence in audio
function detectSilence(event) {
  if (!isRecording) return;

  const input = event.inputBuffer.getChannelData(0);
  const now = Date.now();

  // Calculate energy metrics
  const rmsEnergy = calculateRMSEnergy(input);
  const zcr = calculateZCR(input);

  // Add to energy history
  energyHistory.push(rmsEnergy);
  if (energyHistory.length > energyHistorySize) {
    energyHistory.shift();
  }

  // Calculate average energy from history for smoother detection
  const avgEnergy = energyHistory.reduce((sum, e) => sum + e, 0) / energyHistory.length;

  // Adaptive threshold - use ZCR to help distinguish between noise and speech
  // Speech typically has higher energy and lower ZCR than background noise
  const isSpeech = avgEnergy > silenceThreshold && zcr < 0.2; // Increased ZCR threshold for better speech detection

  if (!isSpeech) {
    silenceDuration += event.inputBuffer.duration * 1000;

    if (silenceDuration >= maxSilenceDuration && !isSilent) {
      // Mark the start of a silence period
      lastSilenceStart = now;
      isSilent = true;

      // If we were in a speech segment, end it
      if (currentSpeechStart > 0) {
        const speechDuration = now - currentSpeechStart;

        // Only consider meaningful speech segments (longer than minimum duration)
        if (speechDuration >= minSpeechDuration) {
          speechSegments.push({
            start: currentSpeechStart,
            end: now,
            duration: speechDuration
          });

          console.log(`Speech segment detected: ${speechDuration/1000}s`);
        }

        currentSpeechStart = 0;
      }

      // Notify main process
      if (window.api && window.api.send) {
        window.api.send('audio-recorder:silence-detected', {
          timestamp: now,
          level: avgEnergy,
          zcr: zcr
        });
      }
    }
  } else {
    // We have speech

    // If we were in a silence period, mark its end
    if (isSilent) {
      const duration = (now - lastSilenceStart) / 1000;

      // Notify main process
      if (window.api && window.api.send) {
        window.api.send('audio-recorder:silence-ended', {
          timestamp: now,
          duration
        });
      }

      isSilent = false;
    }

    // Reset silence counter
    silenceDuration = 0;

    // If we're not tracking a speech segment yet, start one
    if (currentSpeechStart === 0) {
      currentSpeechStart = now;
    } else {
      // Check if current speech segment is too long and should be split
      const speechDuration = now - currentSpeechStart;
      if (speechDuration >= maxSpeechDuration) {
        // End current segment and start a new one
        speechSegments.push({
          start: currentSpeechStart,
          end: now,
          duration: speechDuration
        });

        console.log(`Long speech segment split: ${speechDuration/1000}s`);

        // Start a new segment
        currentSpeechStart = now;

        // Notify main process about segment split
        if (window.api && window.api.send) {
          window.api.send('audio-recorder:segment-split', {
            timestamp: now,
            duration: speechDuration / 1000
          });
        }
      }
    }
  }
}

// Start recording
async function startRecording(options, filePath) {
  console.log('Start recording called with options:', options, 'filePath:', filePath);

  // If already recording, stop first
  if (isRecording) {
    console.log('Already recording, stopping first');
    await stopRecording();
  }

  try {
    // Set recording start time
    recordingStartTime = new Date();

    // Initialize if not already initialized
    if (!audioStream) {
      console.log('Audio stream not initialized, initializing now');
      try {
        const success = await initAudioRecorder();
        if (success) {
          console.log('Audio recorder initialized successfully');
          await startRecordingInternal(options, filePath);
        } else {
          console.error('Failed to initialize audio recorder');
          if (window.api && window.api.send) {
            window.api.send('audio-recorder:error', ERROR_MESSAGES.FAILED_TO_START_RECORDING);
          }
        }
      } catch (error) {
        console.error('Error initializing audio recorder:', error);
        if (window.api && window.api.send) {
          window.api.send('audio-recorder:error', error.message || ERROR_MESSAGES.FAILED_TO_START_RECORDING);
        }
      }
    } else {
      console.log('Audio stream already initialized, starting recording');
      await startRecordingInternal(options, filePath);
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    if (window.api && window.api.send) {
      window.api.send('audio-recorder:error', error.message || ERROR_MESSAGES.FAILED_TO_START_RECORDING);
    }
  }
}

// Internal start recording function
function startRecordingInternal(options, filePath) {
  try {
    // Reset variables
    audioChunks = [];
    silenceDuration = 0;
    isSilent = false;
    currentFilePath = filePath;
    isRecording = true; // Set recording flag
    speechSegments = [];
    currentSpeechStart = 0;
    energyHistory = [];

    // Create media recorder with the best supported format
    let mimeType = 'audio/webm;codecs=opus';

    // Check for supported formats in order of preference
    const preferredFormats = [
      'audio/webm;codecs=opus',  // Best quality and compression
      'audio/webm',             // Good fallback
      'audio/mp4',              // Widely supported
      'audio/ogg;codecs=opus',  // Good quality
      'audio/ogg',              // Fallback
      'audio/wav'               // Last resort
    ];

    // Find the first supported format
    for (const format of preferredFormats) {
      if (MediaRecorder.isTypeSupported(format)) {
        mimeType = format;
        console.log(`Found supported MIME type: ${mimeType}`);
        break;
      }
    }

    // If the specified format is supported, use it
    if (options.mimeType && MediaRecorder.isTypeSupported(options.mimeType)) {
      mimeType = options.mimeType;
      console.log(`Using specified MIME type: ${mimeType}`);
    }

    console.log(`Using MIME type: ${mimeType} for recording`);

    // Create the MediaRecorder with appropriate options
    try {
      console.log('Creating MediaRecorder with options:', {
        mimeType,
        audioBitsPerSecond: options.bitsPerSample * options.sampleRate * options.channels,
        stream: audioStream ? 'Available' : 'Not available',
        streamActive: audioStream ? audioStream.active : false,
        streamTracks: audioStream ? audioStream.getTracks().length : 0
      });

      mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: mimeType,
        audioBitsPerSecond: options.bitsPerSample * options.sampleRate * options.channels
      });

      console.log('MediaRecorder created successfully, state:', mediaRecorder.state);
    } catch (mediaRecorderError) {
      console.error('Error creating MediaRecorder:', mediaRecorderError);
      throw mediaRecorderError;
    }

    // Handle data available event
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        console.log(`Received audio chunk: ${event.data.size} bytes`);

        // Send data to main process in real-time
        try {
          // Convert blob to array buffer
          const buffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);

          // Log the data for debugging
          console.log(`Sending audio data to main process: ${uint8Array.length} bytes`);
          console.log(`First few bytes: ${Array.from(uint8Array.slice(0, 10))}`);

          // Send to main process
          if (window.api && window.api.send) {
            // Send in smaller chunks to avoid IPC message size limits
            const CHUNK_SIZE = 16384; // 16KB chunks
            for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
              const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
              window.api.send('audio-recorder:data', Array.from(chunk));
              console.log(`Sent chunk ${i/CHUNK_SIZE + 1} of ${Math.ceil(uint8Array.length/CHUNK_SIZE)}: ${chunk.length} bytes`);
            }
          }
        } catch (error) {
          console.error('Error sending audio data to main process:', error);
        }
      }
    };

    // Handle stop event
    mediaRecorder.onstop = async () => {
      try {
        console.log(`Recording stopped. Collected ${audioChunks.length} chunks.`);

        // Check if we have any audio data
        if (audioChunks.length === 0) {
          console.error('No audio chunks collected during recording');
          if (window.api && window.api.send) {
            window.api.send('audio-recorder:error', 'No audio data collected');
          }
          return;
        }

        // Create blob from chunks
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        console.log(`Created blob with size: ${blob.size} bytes and type: ${blob.type}`);

        // Check if blob is valid
        if (blob.size === 0) {
          console.error('Created blob is empty');
          if (window.api && window.api.send) {
            window.api.send('audio-recorder:error', 'Created audio blob is empty');
          }
          return;
        }

        // Get actual duration from audio context
        let audioDuration = audioChunks.length * 0.5; // Default: Approximate duration based on chunks (500ms each)

        // Create a more accurate duration calculation if possible
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await blob.arrayBuffer();
          const decodedData = await audioContext.decodeAudioData(audioBuffer);
          audioDuration = decodedData.duration;
          console.log(`Actual audio duration: ${audioDuration} seconds`);
          audioContext.close();
        } catch (decodeError) {
          console.warn('Could not decode audio for duration calculation:', decodeError);
        }

        // Convert blob to buffer
        const buffer = await blob.arrayBuffer();
        console.log(`Converted blob to ArrayBuffer with byte length: ${buffer.byteLength}`);

        // Create Uint8Array from buffer
        const uint8Array = new Uint8Array(buffer);
        console.log(`Created Uint8Array with length: ${uint8Array.length}`);

        // Save debug info to localStorage for inspection
        try {
          const debugInfo = {
            timestamp: new Date().toISOString(),
            blobSize: blob.size,
            blobType: blob.type,
            arrayBufferLength: buffer.byteLength,
            uint8ArrayLength: uint8Array.length,
            filePath: currentFilePath,
            audioDuration: audioDuration,
            chunks: audioChunks.length
          };

          localStorage.setItem('audioDebugInfo', JSON.stringify(debugInfo));
          console.log('Debug info saved to localStorage');
        } catch (debugError) {
          console.error('Error saving debug info:', debugError);
        }

        // Save to file
        if (window.api && window.api.invoke) {
          console.log(`Saving audio to file: ${currentFilePath}`);

          // Debug: Log browser capabilities
          console.log('Browser capabilities:', {
            audioContext: !!window.AudioContext,
            webkitAudioContext: !!window.webkitAudioContext,
            mediaRecorder: !!window.MediaRecorder,
            mediaDevices: !!navigator.mediaDevices,
            getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            blob: typeof Blob !== 'undefined',
            arrayBuffer: typeof ArrayBuffer !== 'undefined',
            localStorage: typeof localStorage !== 'undefined'
          });

          // Show saving indicator to user
          const statusElement = document.getElementById('recording-status');
          if (statusElement) {
            statusElement.textContent = 'Saving audio...';
          }

          // Proceed with saving the audio file
          try {
            const result = await window.api.invoke('audio-recorder:save-blob', {
              filePath: currentFilePath,
              buffer: Array.from(uint8Array),
              mimeType: mediaRecorder.mimeType
            });

            console.log('Audio save result:', result);

            // Update status
            if (statusElement) {
              statusElement.textContent = result.success ? 'Audio saved successfully' : 'Failed to save audio';
              setTimeout(() => {
                statusElement.textContent = '';
              }, 3000);
            }

            // Notify main process that recording is complete
            if (result && result.success) {
              window.api.send('audio-recorder:recording-complete', {
                filePath: result.filePath,
                timestamp: new Date().toISOString(),
                duration: audioDuration,
                mimeType: mediaRecorder.mimeType,
                speechSegments: speechSegments
              });

              console.log(`Audio recording saved successfully to ${result.filePath}`);

              // Create an audio element to verify the recording
              const audioElement = document.createElement('audio');
              audioElement.controls = true;
              audioElement.src = `file://${result.filePath}`;

              // Add to the page temporarily for testing
              const container = document.getElementById('audio-test-container');
              if (!container) {
                const newContainer = document.createElement('div');
                newContainer.id = 'audio-test-container';
                newContainer.style.position = 'fixed';
                newContainer.style.bottom = '10px';
                newContainer.style.right = '10px';
                newContainer.style.zIndex = '9999';
                document.body.appendChild(newContainer);
                newContainer.appendChild(audioElement);
              } else {
                container.innerHTML = '';
                container.appendChild(audioElement);
              }

              // Remove after 10 seconds
              setTimeout(() => {
                const container = document.getElementById('audio-test-container');
                if (container) {
                  container.innerHTML = '';
                }
              }, 10000);
            } else {
              console.error('Failed to save audio:', result?.error || 'Unknown error');
              if (window.api && window.api.send) {
                window.api.send('audio-recorder:error', result?.error || 'Failed to save audio');
              }
            }
          } catch (saveError) {
            console.error('Error invoking save-blob:', saveError);
            if (window.api && window.api.send) {
              window.api.send('audio-recorder:error', saveError.message || 'Error saving audio');
            }
          }
        } else {
          console.error('API not available for saving audio');
          if (window.api && window.api.send) {
            window.api.send('audio-recorder:error', 'API not available for saving audio');
          }
        }
      } catch (error) {
        console.error('Error processing audio recording:', error);
        if (window.api && window.api.send) {
          window.api.send('audio-recorder:error', error.message || 'Error processing audio recording');
        }
      }
    };

    // Start recording with appropriate chunk size
    // Smaller chunks (100ms) for better silence detection, larger chunks (500ms) for better file handling
    const chunkSize = options.silenceDetection ? 100 : 500;
    mediaRecorder.start(chunkSize);

    console.log(`Recording started with chunk size: ${chunkSize}ms`);

    // Add recording status element if it doesn't exist
    if (!document.getElementById('recording-status')) {
      const statusElement = document.createElement('div');
      statusElement.id = 'recording-status';
      statusElement.style.position = 'fixed';
      statusElement.style.top = '10px';
      statusElement.style.right = '10px';
      statusElement.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      statusElement.style.color = 'white';
      statusElement.style.padding = '5px 10px';
      statusElement.style.borderRadius = '5px';
      statusElement.style.zIndex = '9999';
      statusElement.textContent = 'Recording...';
      document.body.appendChild(statusElement);
    } else {
      document.getElementById('recording-status').textContent = 'Recording...';
    }
  } catch (error) {
    console.error('Error starting recording internal:', error);
    isRecording = false;
    if (window.api && window.api.send) {
      window.api.send('audio-recorder:error', error.message || 'Error starting recording');
    }
  }
}

// Stop recording
async function stopRecording() {
  console.log('Stop recording called');

  if (!isRecording) {
    console.log('Not recording, nothing to stop');
    return { success: true, message: 'Not recording' };
  }

  if (!mediaRecorder) {
    console.error('MediaRecorder not available');
    isRecording = false;
    return { success: false, error: ERROR_MESSAGES.FAILED_TO_STOP_RECORDING };
  }

  try {
    // Calculate recording duration
    const recordingDuration = recordingStartTime ?
      (new Date().getTime() - recordingStartTime.getTime()) / 1000 : 0;

    // Check if mediaRecorder is in a state where it can be stopped
    if (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused') {
      console.log(`Stopping MediaRecorder in state: ${mediaRecorder.state}`);

      // Create a promise that resolves when the mediaRecorder.onstop event fires
      const stopPromise = new Promise((resolve) => {
        const originalOnStop = mediaRecorder.onstop;
        mediaRecorder.onstop = (event) => {
          // Call the original onstop handler if it exists
          if (originalOnStop) {
            originalOnStop.call(mediaRecorder, event);
          }
          resolve();
        };
      });

      // Stop the recording
      mediaRecorder.stop();
      isRecording = false;
      console.log('Recording stopped');

      // Wait for the onstop event to fire
      await stopPromise;

      return {
        success: true,
        message: 'Recording stopped successfully',
        duration: recordingDuration
      };
    } else {
      console.log(`MediaRecorder in state: ${mediaRecorder.state}, cannot stop`);
      isRecording = false;
      return {
        success: false,
        error: ERROR_MESSAGES.FAILED_TO_STOP_RECORDING,
        message: `MediaRecorder in state: ${mediaRecorder.state}, cannot stop`
      };
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    isRecording = false;
    if (window.api && window.api.send) {
      window.api.send('audio-recorder:error', error.message || ERROR_MESSAGES.FAILED_TO_STOP_RECORDING);
    }
    return {
      success: false,
      error: ERROR_MESSAGES.FAILED_TO_STOP_RECORDING,
      message: error.message || 'Unknown error stopping recording'
    };
  }
}

// Clean up resources
function cleanUp() {
  try {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }

    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }

    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    isRecording = false;
    mediaRecorder = null;
    audioChunks = [];

    console.log('Audio recorder cleaned up');
  } catch (error) {
    console.error('Error cleaning up audio recorder:', error);
  }
}

// Set up IPC listeners
if (window.api && window.api.receive) {
  // Remove any existing listeners to avoid duplicates
  window.api.removeAllListeners?.('audio-recorder:start-recording');
  window.api.removeAllListeners?.('audio-recorder:stop-recording');

  // Add new listeners
  window.api.receive('audio-recorder:start-recording', async (data) => {
    console.log('Received start recording request:', data);
    try {
      await startRecording(data.options, data.filePath);
    } catch (error) {
      console.error('Error handling start recording request:', error);
      if (window.api && window.api.send) {
        window.api.send('audio-recorder:error', error.message || ERROR_MESSAGES.FAILED_TO_START_RECORDING);
      }
    }
  });

  window.api.receive('audio-recorder:stop-recording', async () => {
    console.log('Received stop recording request');
    try {
      const result = await stopRecording();
      if (window.api && window.api.send) {
        window.api.send('audio-recorder:recording-complete', result);
      }
    } catch (error) {
      console.error('Error handling stop recording request:', error);
      if (window.api && window.api.send) {
        window.api.send('audio-recorder:error', error.message || ERROR_MESSAGES.FAILED_TO_STOP_RECORDING);
      }
    }
  });
} else {
  console.warn('API not available for audio recorder');
}

// Clean up when window is unloaded
window.addEventListener('beforeunload', cleanUp);

// Export functions for testing and direct access
window.audioRecorder = {
  start: startRecording,
  stop: stopRecording,
  cleanup: cleanUp,
  isRecording: () => isRecording,
  getRecordingDuration: () => recordingStartTime ?
    (new Date().getTime() - recordingStartTime.getTime()) / 1000 : 0
};

console.log('Audio recorder module loaded');

} // End of initialization check
