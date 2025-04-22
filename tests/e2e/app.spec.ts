import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

// Path to the Electron app
const electronAppPath = path.join(__dirname, '../../');

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, '../../landing/images');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

test.describe('BlackBox AI Application', () => {
  test('should launch the app and take screenshots of main screens', async () => {
    // Launch Electron app
    const app = await electron.launch({
      args: [electronAppPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Get the first window
    const window = await app.firstWindow();

    // Wait for the app to be fully loaded
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(3000); // Wait for animations to complete

    console.log('Taking screenshot of Dashboard...');
    // Take screenshot of the dashboard
    await window.screenshot({ path: path.join(screenshotsDir, 'dashboard.png') });

    console.log('Navigating to Timeline tab...');
    // Navigate to Timeline tab
    await window.click('text=Timeline');
    await window.waitForTimeout(2000);

    console.log('Taking screenshot of Timeline...');
    // Take screenshot of the timeline
    await window.screenshot({ path: path.join(screenshotsDir, 'timeline.png') });

    console.log('Navigating to Insights tab...');
    // Navigate to Insights tab
    await window.click('text=Insights');
    await window.waitForTimeout(2000);

    console.log('Taking screenshot of Insights...');
    // Take screenshot of the insights
    await window.screenshot({ path: path.join(screenshotsDir, 'insights.png') });

    console.log('Navigating to Settings tab...');
    // Navigate to Settings tab
    await window.click('text=Settings');
    await window.waitForTimeout(2000);

    console.log('Taking screenshot of Settings...');
    // Take screenshot of the settings page
    await window.screenshot({ path: path.join(screenshotsDir, 'settings.png') });

    // Navigate to Settings tabs
    console.log('Navigating to Recording Settings tab...');
    await window.click('text=Recording');
    await window.waitForTimeout(1000);
    await window.screenshot({ path: path.join(screenshotsDir, 'settings-recording.png') });

    console.log('Navigating to AI Settings tab...');
    await window.click('text=AI');
    await window.waitForTimeout(1000);
    await window.screenshot({ path: path.join(screenshotsDir, 'settings-ai.png') });

    console.log('Navigating to Storage Settings tab...');
    await window.click('text=Storage');
    await window.waitForTimeout(1000);
    await window.screenshot({ path: path.join(screenshotsDir, 'settings-storage.png') });

    // Close the app
    console.log('Closing app...');
    await app.close();

    console.log('All screenshots captured successfully!');
  });
});
