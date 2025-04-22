const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Create a simple audio file with a known pattern
async function testAudioFileSave() {
  // Define possible save locations
  const locations = [
    path.join(app.getPath('userData'), 'audio'),
    path.join(app.getPath('documents'), 'BlackBoxAI', 'audio'),
    path.join(app.getPath('desktop'), 'BlackBoxAI-audio'),
    path.join(__dirname, 'test-audio')
  ];

  console.log('Testing audio file save in multiple locations...');
  
  // Test each location
  for (const location of locations) {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(location)) {
        console.log(`Creating directory: ${location}`);
        fs.mkdirSync(location, { recursive: true });
      }
      
      // Create a test file path
      const testFilePath = path.join(location, `test-audio-${Date.now()}.wav`);
      console.log(`Attempting to save test file to: ${testFilePath}`);
      
      // Create a simple WAV file header (44 bytes)
      // This is a minimal valid WAV header for a silent audio file
      const header = Buffer.alloc(44);
      
      // RIFF header
      header.write('RIFF', 0);
      header.writeUInt32LE(36, 4); // File size - 8 (we'll have a 44 byte file, so 36)
      header.write('WAVE', 8);
      
      // Format chunk
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16); // Format chunk size
      header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
      header.writeUInt16LE(1, 22); // Number of channels
      header.writeUInt32LE(44100, 24); // Sample rate
      header.writeUInt32LE(44100 * 2, 28); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
      header.writeUInt16LE(2, 32); // Block align (NumChannels * BitsPerSample/8)
      header.writeUInt16LE(16, 34); // Bits per sample
      
      // Data chunk
      header.write('data', 36);
      header.writeUInt32LE(0, 40); // Data size (0 for empty file)
      
      // Write the file
      fs.writeFileSync(testFilePath, header);
      
      // Verify the file was created
      if (fs.existsSync(testFilePath)) {
        const stats = fs.statSync(testFilePath);
        console.log(`✅ SUCCESS: File created at ${testFilePath} with size ${stats.size} bytes`);
        
        // Try to read the file back
        const readData = fs.readFileSync(testFilePath);
        console.log(`✅ SUCCESS: File read back with size ${readData.length} bytes`);
        
        // Verify the content
        if (readData.toString('utf8', 0, 4) === 'RIFF' && 
            readData.toString('utf8', 8, 12) === 'WAVE') {
          console.log(`✅ SUCCESS: File content verified as WAV format`);
        } else {
          console.log(`❌ ERROR: File content verification failed`);
        }
        
        // Clean up
        fs.unlinkSync(testFilePath);
        console.log(`✅ SUCCESS: Test file removed`);
        
        return {
          success: true,
          location,
          message: `Audio file successfully saved and verified at ${location}`
        };
      } else {
        console.log(`❌ ERROR: File was not created at ${testFilePath}`);
      }
    } catch (error) {
      console.error(`❌ ERROR testing location ${location}:`, error);
    }
  }
  
  return {
    success: false,
    message: 'Failed to save audio file in any location'
  };
}

// Create a test audio buffer
function createTestAudioBuffer(duration = 1, sampleRate = 44100) {
  // Calculate buffer size for the given duration
  const numSamples = Math.floor(duration * sampleRate);
  const buffer = Buffer.alloc(numSamples * 2); // 16-bit samples = 2 bytes per sample
  
  // Generate a simple sine wave
  for (let i = 0; i < numSamples; i++) {
    // Generate a 440Hz sine wave
    const value = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0x7FFF;
    buffer.writeInt16LE(Math.floor(value), i * 2);
  }
  
  return buffer;
}

// Test saving a real audio buffer
async function testRealAudioSave(location) {
  try {
    // Create a test audio buffer (1 second of 440Hz tone)
    const audioBuffer = createTestAudioBuffer(1, 44100);
    console.log(`Created test audio buffer with size ${audioBuffer.length} bytes`);
    
    // Create a test file path
    const testFilePath = path.join(location, `test-real-audio-${Date.now()}.wav`);
    console.log(`Attempting to save real audio to: ${testFilePath}`);
    
    // Create WAV header
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
    
    // Write the file
    fs.writeFileSync(testFilePath, wavFile);
    
    // Verify the file was created
    if (fs.existsSync(testFilePath)) {
      const stats = fs.statSync(testFilePath);
      console.log(`✅ SUCCESS: Real audio file created at ${testFilePath} with size ${stats.size} bytes`);
      
      return {
        success: true,
        filePath: testFilePath,
        message: `Real audio file successfully saved at ${testFilePath}`
      };
    } else {
      console.log(`❌ ERROR: Real audio file was not created at ${testFilePath}`);
      return {
        success: false,
        message: `Failed to save real audio file at ${testFilePath}`
      };
    }
  } catch (error) {
    console.error(`❌ ERROR saving real audio:`, error);
    return {
      success: false,
      message: `Error saving real audio: ${error.message}`
    };
  }
}

// Run the tests when Electron is ready
app.whenReady().then(async () => {
  console.log('Starting audio file save tests...');
  
  // Test basic file save
  const basicResult = await testAudioFileSave();
  console.log('Basic test result:', basicResult);
  
  if (basicResult.success) {
    // Test real audio save
    const realResult = await testRealAudioSave(basicResult.location);
    console.log('Real audio test result:', realResult);
    
    if (realResult.success) {
      // Create a window to display the results
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      // Create a simple HTML to display the results
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Audio Save Test Results</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .success { color: green; }
          .error { color: red; }
          pre { background: #f5f5f5; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Audio Save Test Results</h1>
        <h2 class="success">✅ Tests Passed!</h2>
        <p>Audio files can be successfully saved to:</p>
        <pre>${basicResult.location}</pre>
        <p>Test audio file was saved to:</p>
        <pre>${realResult.filePath}</pre>
        <p>This location will be used for all audio recordings in the app.</p>
        <button id="playAudio">Play Test Audio</button>
        <script>
          const audioBtn = document.getElementById('playAudio');
          const audio = new Audio('file://${realResult.filePath.replace(/\\/g, '\\\\')}');
          audioBtn.addEventListener('click', () => {
            audio.play();
          });
        </script>
      </body>
      </html>
      `;
      
      // Write the HTML to a temporary file
      const tempHtmlPath = path.join(app.getPath('temp'), 'audio-test-results.html');
      fs.writeFileSync(tempHtmlPath, html);
      
      // Load the HTML file
      win.loadFile(tempHtmlPath);
      
      // Wait for user to see the results
      await sleep(10000);
    }
  }
  
  // Exit the app
  app.quit();
});
