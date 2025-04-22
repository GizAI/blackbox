// Debug script for BlackBox AI
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log files
const mainLogPath = path.join(logsDir, 'main-process.log');
const rendererLogPath = path.join(logsDir, 'renderer-process.log');

// Create log streams
const mainLogStream = fs.createWriteStream(mainLogPath, { flags: 'a' });
const rendererLogStream = fs.createWriteStream(rendererLogPath, { flags: 'a' });

// Log header
const logHeader = `\n\n========== DEBUG SESSION STARTED AT ${new Date().toISOString()} ==========\n\n`;
mainLogStream.write(logHeader);
rendererLogStream.write(logHeader);

// Print system info
const systemInfo = `
System Information:
- Platform: ${os.platform()} ${os.release()}
- Architecture: ${os.arch()}
- Node Version: ${process.version}
- Total Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB
- Free Memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB
- CPU Cores: ${os.cpus().length}
`;

console.log(systemInfo);
mainLogStream.write(systemInfo);

// Start Electron with debugging flags
console.log('Starting Electron in debug mode...');
console.log(`Main process logs: ${mainLogPath}`);
console.log(`Renderer process logs: ${rendererLogPath}`);

// Set environment variables for debugging
process.env.ELECTRON_ENABLE_LOGGING = true;
process.env.ELECTRON_DEBUG_LOGGING = true;
process.env.NODE_ENV = 'development';
process.env.DEBUG = '*';

// Copy dev-mode.js to ensure it's available
const devModeSource = path.join(__dirname, 'src', 'renderer', 'dev-mode.js');
if (fs.existsSync(devModeSource)) {
  console.log(`Development mode script found at ${devModeSource}`);
} else {
  console.error(`Development mode script not found at ${devModeSource}`);
}

// Launch Electron with remote debugging port
const electronProcess = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'electron',
    '.',
    '--dev',
    '--remote-debugging-port=9222',
    '--enable-logging',
    '--log-level=0',
    '--trace-warnings',
    '--trace-deprecation'
  ],
  {
    stdio: 'pipe',
    env: process.env
  }
);

// Log process output
electronProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  mainLogStream.write(output);

  // Check for audio-related logs and highlight them
  if (output.includes('audio') || output.includes('Audio') || output.includes('recorder') || output.includes('Recorder')) {
    const highlightedOutput = `[AUDIO] ${output}`;
    console.log('\x1b[33m%s\x1b[0m', '[AUDIO]', output.trim()); // Yellow highlight
    rendererLogStream.write(highlightedOutput);
  }

  // Check for CSS-related logs
  if (output.includes('css') || output.includes('CSS') || output.includes('style')) {
    const highlightedOutput = `[STYLE] ${output}`;
    console.log('\x1b[36m%s\x1b[0m', '[STYLE]', output.trim()); // Cyan highlight
    rendererLogStream.write(highlightedOutput);
  }
});

electronProcess.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write('\x1b[31m%s\x1b[0m', output); // Red text for errors
  mainLogStream.write(`[ERROR] ${output}`);

  // Check for audio-related logs and highlight them
  if (output.includes('audio') || output.includes('Audio') || output.includes('recorder') || output.includes('Recorder')) {
    const highlightedOutput = `[AUDIO ERROR] ${output}`;
    console.log('\x1b[31m%s\x1b[0m', '[AUDIO ERROR]', output.trim()); // Red highlight
    rendererLogStream.write(highlightedOutput);
  }
});

// Handle process exit
electronProcess.on('close', (code) => {
  const exitMessage = `\n========== ELECTRON PROCESS EXITED WITH CODE ${code} AT ${new Date().toISOString()} ==========\n`;
  mainLogStream.write(exitMessage);
  rendererLogStream.write(exitMessage);
  mainLogStream.end();
  rendererLogStream.end();
  console.log(`Electron process exited with code ${code}`);
});

// Handle script termination
process.on('SIGINT', () => {
  console.log('Terminating debug session...');
  electronProcess.kill();
  process.exit(0);
});

console.log('\n\x1b[32m%s\x1b[0m', 'Debug session started. Press Ctrl+C to stop.');
console.log('\x1b[32m%s\x1b[0m', 'To debug the renderer process, open Chrome and navigate to: chrome://inspect');
console.log('\x1b[32m%s\x1b[0m', 'Click on "Configure..." next to "Discover network targets" and add "localhost:9222"');
console.log('\x1b[32m%s\x1b[0m', 'Then click on the "inspect" link under Remote Target to open DevTools\n');
