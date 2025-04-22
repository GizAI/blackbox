const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'landing/images');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function captureScreenshots() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src/renderer/preload.js')
    }
  });

  // Load the app
  await mainWindow.loadFile('src/renderer/index.html');
  
  // Wait for the app to load
  await sleep(3000);
  
  // Capture dashboard screenshot
  console.log('Capturing dashboard screenshot...');
  const dashboardImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'dashboard.png'), dashboardImage.toPNG());
  
  // Click on Timeline tab
  console.log('Navigating to Timeline tab...');
  await mainWindow.webContents.executeJavaScript('switchTab("timeline")');
  await sleep(2000);
  
  // Capture timeline screenshot
  console.log('Capturing timeline screenshot...');
  const timelineImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'timeline.png'), timelineImage.toPNG());
  
  // Click on Insights tab
  console.log('Navigating to Insights tab...');
  await mainWindow.webContents.executeJavaScript('switchTab("insights")');
  await sleep(2000);
  
  // Capture insights screenshot
  console.log('Capturing insights screenshot...');
  const insightsImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'insights.png'), insightsImage.toPNG());
  
  // Click on Settings tab
  console.log('Navigating to Settings tab...');
  await mainWindow.webContents.executeJavaScript('switchTab("settings")');
  await sleep(2000);
  
  // Capture settings screenshot
  console.log('Capturing settings screenshot...');
  const settingsImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'settings.png'), settingsImage.toPNG());
  
  // Navigate to different settings tabs
  console.log('Navigating to Recording Settings tab...');
  await mainWindow.webContents.executeJavaScript('switchSettingsTab("recording")');
  await sleep(1000);
  const recordingSettingsImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'settings-recording.png'), recordingSettingsImage.toPNG());
  
  console.log('Navigating to AI Settings tab...');
  await mainWindow.webContents.executeJavaScript('switchSettingsTab("ai")');
  await sleep(1000);
  const aiSettingsImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'settings-ai.png'), aiSettingsImage.toPNG());
  
  console.log('Navigating to Storage Settings tab...');
  await mainWindow.webContents.executeJavaScript('switchSettingsTab("storage")');
  await sleep(1000);
  const storageSettingsImage = await mainWindow.capturePage();
  fs.writeFileSync(path.join(screenshotsDir, 'settings-storage.png'), storageSettingsImage.toPNG());
  
  console.log('All screenshots captured successfully!');
  
  // Close the app
  app.quit();
}

// When Electron has finished initialization
app.whenReady().then(captureScreenshots);
