// main.js - Main application functionality

// Import modules
import { initDashboard } from './dashboard.js';
import { initTimeline } from './timeline.js';
import { initSettings } from './settings.js';
import { initInsights } from './insights.js';

// DOM Elements
const screenshotModal = document.getElementById('screenshot-modal');
const modalClose = document.querySelector('.modal-close');

// Initialize the application
async function init() {
  console.log('Initializing application...');

  // Set up tab navigation - check if global switchTab function exists
  if (typeof window.switchTab === 'function') {
    console.log('Using global switchTab function for navigation');
    // Make initializeTab function available globally
    window.initializeTab = initializeTab;
  } else {
    console.error('Navigation functions not found! Make sure navigation.js is loaded before main.js');
  }

  // Set up modal functionality
  if (modalClose && screenshotModal) {
    modalClose.addEventListener('click', () => {
      screenshotModal.classList.remove('active');
    });

    // Close modal when clicking outside
    screenshotModal.addEventListener('click', (e) => {
      if (e.target === screenshotModal) {
        screenshotModal.classList.remove('active');
      }
    });
  }

  // Initialize current tab (default to dashboard)
  initializeTab('dashboard');

  console.log('Application initialization complete');
}

// Initialize tab
function initializeTab(tab) {
  switch (tab) {
    case 'dashboard':
      initDashboard();
      break;
    case 'timeline':
      initTimeline();
      break;
    case 'insights':
      initInsights();
      break;
    case 'settings':
      initSettings();
      break;
  }
}

// Add CSS styles for charts and notifications
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Chart styles */
    .chart-container {
      margin-top: 20px;
    }

    .chart-item {
      margin-bottom: 15px;
    }

    .chart-label {
      font-weight: 500;
      margin-bottom: 5px;
    }

    .chart-bar-container {
      height: 24px;
      background-color: var(--bg-light);
      border-radius: 4px;
      position: relative;
      overflow: hidden;
    }

    .chart-bar {
      height: 100%;
      background-color: var(--primary);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .chart-value {
      position: absolute;
      right: 10px;
      top: 0;
      height: 100%;
      display: flex;
      align-items: center;
      color: white;
      font-size: 0.8rem;
      font-weight: 500;
    }

    /* Timeline group styles */
    .timeline-group {
      margin-bottom: 30px;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      overflow: hidden;
    }

    .timeline-group-header {
      padding: 15px;
      background-color: var(--bg-light);
      border-bottom: 1px solid var(--border-light);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .timeline-group-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 0;
    }

    .timeline-group-info {
      font-size: 0.9rem;
      color: var(--text-light);
      display: flex;
      gap: 15px;
    }

    .timeline-group-items {
      padding: 15px;
    }

    /* Notification styles */
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      background-color: var(--bg-white);
      box-shadow: var(--shadow);
      z-index: 1000;
      transition: opacity 0.5s ease;
    }

    .notification.success {
      background-color: #10b981;
      color: white;
    }

    .notification.error {
      background-color: var(--danger);
      color: white;
    }

    .notification.info {
      background-color: #3b82f6;
      color: white;
    }

    .notification.fade-out {
      opacity: 0;
    }
  `;

  document.head.appendChild(style);
}

// Wait for app to be ready before initializing
window.appReady = false;

// Listen for app ready event from main process
if (window.api && window.api.receive) {
  window.api.receive('app:ready', () => {
    console.log('Received app:ready event from main process');
    window.appReady = true;
    if (document.readyState === 'complete') {
      initializeApp();
    }
  });
}

// Initialize the application when DOM is loaded and app is ready
function initializeApp() {
  if (!window.appReady) {
    console.log('Waiting for app to be ready...');
    // Show loading indicator or message
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'loading-message';
    loadingMessage.style.position = 'fixed';
    loadingMessage.style.top = '50%';
    loadingMessage.style.left = '50%';
    loadingMessage.style.transform = 'translate(-50%, -50%)';
    loadingMessage.style.padding = '20px';
    loadingMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loadingMessage.style.color = 'white';
    loadingMessage.style.borderRadius = '8px';
    loadingMessage.style.zIndex = '9999';
    loadingMessage.textContent = 'Initializing application...';
    document.body.appendChild(loadingMessage);
    return;
  }

  // Remove loading message if it exists
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.remove();
  }

  console.log('App is ready, initializing application...');
  addStyles();
  init();
  console.log('Main application initialized');
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  // Try to initialize, will wait for app ready if needed
  initializeApp();
});
