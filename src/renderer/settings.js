// settings.js - Settings page functionality

// State variables
let currentSettings = {};
let currentTab = 'recording';

// Initialize settings
export async function initSettings() {
  console.log('Initializing settings...');

  // Set up tab navigation
  const tabs = document.querySelectorAll('[data-settings-tab]');
  console.log('Settings tabs found:', tabs.length);

  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-settings-tab');
      console.log('Settings tab clicked:', tabName);

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      // Show selected tab content
      const tabContents = document.querySelectorAll('.settings-tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      const targetContent = document.getElementById(`${tabName}-settings`);

      if (targetContent) {
        targetContent.classList.add('active');
        currentTab = tabName;
      } else {
        console.error(`Settings tab content not found: ${tabName}-settings`);
      }
    });
  });

  // Set up save button
  const saveButton = document.getElementById('save-settings-btn');
  if (saveButton) {
    saveButton.addEventListener('click', saveSettings);
  }

  // Load settings
  await loadSettings();

  // Set up interval inputs
  setupIntervalInputs();
}

// Load settings
async function loadSettings() {
  try {
    // Get settings from the backend
    const settings = await window.api.getSettings();

    if (settings) {
      currentSettings = settings;

      // Update UI with settings
      updateSettingsUI(settings);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Update settings UI
function updateSettingsUI(settings) {
  // Recording settings
  const autoStart = document.getElementById('auto-start');
  if (autoStart) {
    autoStart.checked = settings.recording?.autoStart !== false;
  }

  const screenshotInterval = document.getElementById('screenshot-interval');
  if (screenshotInterval) {
    screenshotInterval.value = settings.recording?.screenshotInterval || 10000;
    updateIntervalLabel('screenshot-interval-label', screenshotInterval.value);
  }

  const webInterval = document.getElementById('web-interval');
  if (webInterval) {
    webInterval.value = settings.recording?.webHistoryInterval || 5000;
    updateIntervalLabel('web-interval-label', webInterval.value);
  }

  const appInterval = document.getElementById('app-interval');
  if (appInterval) {
    appInterval.value = settings.recording?.appMonitorInterval || 1000;
    updateIntervalLabel('app-interval-label', appInterval.value);
  }

  const captureAllMonitors = document.getElementById('capture-all-monitors');
  if (captureAllMonitors) {
    captureAllMonitors.checked = settings.recording?.captureAllMonitors !== false;
  }

  const skipSimilarImages = document.getElementById('skip-similar-images');
  if (skipSimilarImages) {
    skipSimilarImages.checked = settings.recording?.skipSimilarImages !== false;
  }

  // AI settings
  const aiProvider = document.getElementById('ai-provider');
  if (aiProvider) {
    aiProvider.value = settings.ai?.provider || 'openai';
  }

  const apiKey = document.getElementById('api-key');
  if (apiKey) {
    apiKey.value = settings.ai?.apiKey || '';
  }

  const autoProcessScreenshots = document.getElementById('auto-process-screenshots');
  if (autoProcessScreenshots) {
    autoProcessScreenshots.checked = settings.ai?.autoProcessScreenshots !== false;
  }

  const autoProcessAudio = document.getElementById('auto-process-audio');
  if (autoProcessAudio) {
    autoProcessAudio.checked = settings.ai?.autoProcessAudio !== false;
  }

  // Storage settings
  const storageLimit = document.getElementById('storage-limit');
  if (storageLimit) {
    storageLimit.value = settings.storage?.limit || 10737418240; // 10 GB
  }

  const screenshotQuality = document.getElementById('screenshot-quality');
  if (screenshotQuality) {
    screenshotQuality.value = settings.storage?.screenshotQuality || 75;
  }

  const screenshotFormat = document.getElementById('screenshot-format');
  if (screenshotFormat) {
    screenshotFormat.value = settings.storage?.screenshotFormat || 'webp';
  }

  const encryptionEnabled = document.getElementById('encryption-enabled');
  if (encryptionEnabled) {
    encryptionEnabled.checked = settings.storage?.encryptionEnabled === true;
  }

  const notificationEnabled = document.getElementById('notification-enabled');
  if (notificationEnabled) {
    notificationEnabled.checked = settings.notifications?.enabled !== false;
  }
}

// Set up interval inputs
function setupIntervalInputs() {
  const screenshotInterval = document.getElementById('screenshot-interval');
  if (screenshotInterval) {
    screenshotInterval.addEventListener('input', () => {
      updateIntervalLabel('screenshot-interval-label', screenshotInterval.value);
    });
  }

  const webInterval = document.getElementById('web-interval');
  if (webInterval) {
    webInterval.addEventListener('input', () => {
      updateIntervalLabel('web-interval-label', webInterval.value);
    });
  }

  const appInterval = document.getElementById('app-interval');
  if (appInterval) {
    appInterval.addEventListener('input', () => {
      updateIntervalLabel('app-interval-label', appInterval.value);
    });
  }
}

// Update interval label
function updateIntervalLabel(labelId, value) {
  const label = document.getElementById(labelId);
  if (!label) return;

  const ms = parseInt(value);

  if (ms < 1000) {
    label.textContent = `${ms} milliseconds`;
  } else if (ms < 60000) {
    const seconds = ms / 1000;
    label.textContent = `${seconds} seconds`;
  } else {
    const minutes = ms / 60000;
    label.textContent = `${minutes} minutes`;
  }
}

// Save settings
async function saveSettings() {
  try {
    // Get values from form
    const settings = {
      recording: {
        autoStart: document.getElementById('auto-start')?.checked,
        screenshotInterval: parseInt(document.getElementById('screenshot-interval')?.value || 10000),
        webHistoryInterval: parseInt(document.getElementById('web-interval')?.value || 5000),
        appMonitorInterval: parseInt(document.getElementById('app-interval')?.value || 1000),
        captureAllMonitors: document.getElementById('capture-all-monitors')?.checked,
        skipSimilarImages: document.getElementById('skip-similar-images')?.checked
      },
      ai: {
        provider: document.getElementById('ai-provider')?.value || 'openai',
        apiKey: document.getElementById('api-key')?.value || '',
        autoProcessScreenshots: document.getElementById('auto-process-screenshots')?.checked,
        autoProcessAudio: document.getElementById('auto-process-audio')?.checked
      },
      storage: {
        limit: parseInt(document.getElementById('storage-limit')?.value || 10737418240),
        screenshotQuality: parseInt(document.getElementById('screenshot-quality')?.value || 75),
        screenshotFormat: document.getElementById('screenshot-format')?.value || 'webp',
        encryptionEnabled: document.getElementById('encryption-enabled')?.checked
      },
      notifications: {
        enabled: document.getElementById('notification-enabled')?.checked
      }
    };

    // Save settings to the backend
    const result = await window.api.saveSettings(settings);

    if (result && result.success) {
      showNotification('Settings saved successfully!', 'success');

      // Update current settings
      currentSettings = settings;
    } else {
      showNotification('Failed to save settings', 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings', 'error');
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 3000);
}
