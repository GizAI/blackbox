// Navigation script for BlackBox AI
console.log('Navigation script loaded');

// Global state variables
let isRecording = true;
let currentTab = 'dashboard';

// Global tab switching functions
window.switchTab = function(tabName) {
  console.log('Switching to tab:', tabName);

  // Update active tab
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(navItem => navItem.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Show selected tab content
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => content.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');

  // Handle auto-refresh for timeline when switching tabs
  if (window.stopAutoRefresh && currentTab === 'timeline' && tabName !== 'timeline') {
    // Stop auto-refresh when leaving timeline tab
    console.log('Stopping timeline auto-refresh when leaving tab');
    window.stopAutoRefresh();
  }

  // Update current tab
  currentTab = tabName;

  // Initialize tab if needed
  if (window.initializeTab) {
    // Use the function from main.js if available
    window.initializeTab(tabName);
  } else {
    // Fallback initialization
    if (tabName === 'dashboard') {
      console.log('Initializing dashboard');
      // Add dashboard initialization code here
    } else if (tabName === 'timeline') {
      console.log('Initializing timeline');
      // Restart auto-refresh when entering timeline tab
      if (window.startAutoRefresh) {
        console.log('Starting timeline auto-refresh when entering tab');
        window.startAutoRefresh(5 * 60 * 1000); // 5 minutes
      }
    } else if (tabName === 'insights') {
      console.log('Initializing insights');
      // Add insights initialization code here
    } else if (tabName === 'settings') {
      console.log('Initializing settings');
      // Add settings initialization code here
    }
  }
};

window.switchSettingsTab = function(tabName) {
  console.log('Switching to settings tab:', tabName);

  // Update active tab
  const tabs = document.querySelectorAll('[data-settings-tab]');
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-settings-tab="${tabName}"]`).classList.add('active');

  // Show selected tab content
  const tabContents = document.querySelectorAll('.settings-tab-content');
  tabContents.forEach(content => content.classList.remove('active'));
  document.getElementById(`${tabName}-settings`).classList.add('active');
};

// Toggle recording function
window.toggleRecording = async function() {
  try {
    const toggleButton = document.getElementById('toggle-recording');
    if (!toggleButton) return;

    if (isRecording) {
      // Stop recording
      const result = await window.api.stopAllRecording();

      if (result) {
        isRecording = false;
        updateRecordingButton();
      }
    } else {
      // Start recording
      const result = await window.api.startAllRecording();

      if (result) {
        isRecording = true;
        updateRecordingButton();
      }
    }
  } catch (error) {
    console.error('Error toggling recording:', error);
  }
};

// Update recording button UI
function updateRecordingButton() {
  const toggleButton = document.getElementById('toggle-recording');
  if (!toggleButton) return;

  if (isRecording) {
    toggleButton.textContent = 'Stop Recording';
    toggleButton.classList.remove('btn-primary');
    toggleButton.classList.add('btn-danger');
  } else {
    toggleButton.textContent = 'Start Recording';
    toggleButton.classList.remove('btn-danger');
    toggleButton.classList.add('btn-primary');
  }
}

// Check recording status
async function checkRecordingStatus() {
  try {
    // Get settings to check if recording is enabled
    const settings = await window.api.getSettings();

    if (settings) {
      isRecording = settings.recording?.isRecording !== false;
      updateRecordingButton();
    }
  } catch (error) {
    console.error('Error checking recording status:', error);
  }
}

// Add direct event listeners to elements
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded - adding direct event listeners');

  // Add click handlers to navigation items
  document.getElementById('nav-dashboard').addEventListener('click', function() {
    console.log('Dashboard clicked directly');
    window.switchTab('dashboard');
  });

  document.getElementById('nav-timeline').addEventListener('click', function() {
    console.log('Timeline clicked directly');
    window.switchTab('timeline');
  });

  document.getElementById('nav-insights').addEventListener('click', function() {
    console.log('Insights clicked directly');
    window.switchTab('insights');
  });

  document.getElementById('nav-settings').addEventListener('click', function() {
    console.log('Settings clicked directly');
    window.switchTab('settings');
  });

  // Add click handlers to settings tabs
  document.getElementById('settings-tab-recording').addEventListener('click', function() {
    console.log('Recording settings tab clicked directly');
    window.switchSettingsTab('recording');
  });

  document.getElementById('settings-tab-ai').addEventListener('click', function() {
    console.log('AI settings tab clicked directly');
    window.switchSettingsTab('ai');
  });

  document.getElementById('settings-tab-storage').addEventListener('click', function() {
    console.log('Storage settings tab clicked directly');
    window.switchSettingsTab('storage');
  });

  // Add click handler to toggle recording button
  const toggleButton = document.getElementById('toggle-recording');
  if (toggleButton) {
    toggleButton.addEventListener('click', window.toggleRecording);
  }

  // Check recording status on load
  checkRecordingStatus();

  console.log('All direct event listeners added');
});
