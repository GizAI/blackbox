// dashboard.js - Dashboard page functionality

// Import common utilities and components
import { formatDuration, capitalizeFirstLetter } from '../common/utils.js';
import { renderTimeline } from './components/timeline-renderer.js';

// State variables
let activityData = {
  screenshots: [],
  audioRecordings: [],
  webHistory: [],
  appUsage: []
};

let appUsageSummary = [];
let websiteSummary = [];
let dailySummary = null;
let isRefreshing = false;

// Initialize dashboard
export async function initDashboard() {
  console.log('Initializing dashboard...');

  // Load data
  await loadDashboardData();

  // Set up event listeners
  document.getElementById('generate-insights-btn').addEventListener('click', () => {
    generateInsights('day');
  });

  // Set up refresh button
  const refreshButton = document.getElementById('refresh-dashboard');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      refreshDashboard();
    });
  }

  // Set up refresh interval
  setInterval(async () => {
    if (!isRefreshing) { // Only auto-refresh if not already refreshing
      await loadDashboardData();
    }
  }, 60000); // Refresh every minute
}

// Load dashboard data
async function loadDashboardData() {
  // Show loading indicator on refresh button
  const refreshButton = document.getElementById('refresh-dashboard');
  if (refreshButton) {
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshButton.disabled = true;
  }

  isRefreshing = true;

  try {
    // Check if app is ready
    if (!window.appReady) {
      console.log('App not ready yet, waiting to load dashboard data...');
      // Show a message in the dashboard
      const elements = [
        document.getElementById('screenshot-count'),
        document.getElementById('audio-count'),
        document.getElementById('web-count'),
        document.getElementById('app-count'),
        document.getElementById('app-usage-chart'),
        document.getElementById('website-chart'),
        document.getElementById('recent-activity')
      ];

      elements.forEach(el => {
        if (el) el.textContent = 'Initializing...';
      });

      return;
    }

    // Get activity counts
    await loadActivityCounts();

    // Get recent activity
    await loadRecentActivity();

    // Get app usage summary
    await loadAppUsageSummary();

    // Get website summary
    await loadWebsiteSummary();

    // Render charts
    renderCharts();

    console.log('Dashboard data refreshed successfully');
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  } finally {
    // Reset refresh button
    if (refreshButton) {
      refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
      refreshButton.disabled = false;
    }

    isRefreshing = false;
  }
}

// Load activity counts
async function loadActivityCounts() {
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get screenshots count
    const screenshotResult = await window.api.getScreenshots(1000, {
      where: {
        timestamp: {
          $gte: today,
          $lt: tomorrow
        }
      }
    });

    if (screenshotResult.success) {
      activityData.screenshots = screenshotResult.screenshots || [];
      document.getElementById('screenshot-count').textContent = activityData.screenshots.length;
    }

    // Get audio recordings count
    const audioResult = await window.api.getAudioRecordings(1000, {
      where: {
        timestamp: {
          $gte: today,
          $lt: tomorrow
        }
      }
    });

    if (audioResult.success) {
      activityData.audioRecordings = audioResult.recordings || [];
      document.getElementById('audio-count').textContent = activityData.audioRecordings.length;
    }

    // Get web history count
    const webResult = await window.api.getWebHistory(1000, {
      where: {
        timestamp: {
          $gte: today,
          $lt: tomorrow
        }
      }
    });

    if (webResult.success) {
      activityData.webHistory = webResult.history || [];
      document.getElementById('web-count').textContent = activityData.webHistory.length;
    }

    // Get app usage count
    const appResult = await window.api.getAppUsage(1000, {
      where: {
        startTime: {
          $gte: today,
          $lt: tomorrow
        }
      }
    });

    if (appResult.success) {
      activityData.appUsage = appResult.appUsage || [];
      document.getElementById('app-count').textContent = activityData.appUsage.length;
    }
  } catch (error) {
    console.error('Error loading activity counts:', error);
  }
}

// Load recent activity
async function loadRecentActivity() {
  const recentActivityElement = document.getElementById('recent-activity');
  if (!recentActivityElement) {
    console.error('Recent activity element not found');
    return;
  }

  recentActivityElement.innerHTML = '<p>Loading recent activity...</p>';

  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Getting timeline data for:', today.toISOString().split('T')[0]);

    // Get timeline data
    const timelineResult = await window.api.getTimelineData(today.toISOString().split('T')[0]);
    console.log('Timeline data result:', timelineResult);

    if (timelineResult && timelineResult.success && timelineResult.timeline && timelineResult.timeline.length > 0) {
      // Sort by timestamp (newest first)
      const sortedTimeline = timelineResult.timeline.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Get the 5 most recent items
      const recentItems = sortedTimeline.slice(0, 5);

      // Render timeline
      renderTimeline(recentItems, recentActivityElement);
    } else {
      console.warn('No timeline data available:', timelineResult);
      recentActivityElement.innerHTML = '<p>No recent activity found</p>';
    }
  } catch (error) {
    console.error('Error loading recent activity:', error);
    recentActivityElement.innerHTML = '<p>Error loading recent activity</p>';
  }
}

// Load app usage summary
async function loadAppUsageSummary() {
  const appUsageChartElement = document.getElementById('app-usage-chart');
  if (appUsageChartElement) {
    appUsageChartElement.innerHTML = '<p>Loading app usage data...</p>';
  }

  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Getting app usage summary for:', today.toISOString(), 'to', tomorrow.toISOString());

    // Get app usage summary
    const result = await window.api.getAppUsageSummary(today.toISOString(), tomorrow.toISOString(), 5);
    console.log('App usage summary result:', result);

    if (result && result.success) {
      appUsageSummary = result.summary || [];

      // Update app usage chart
      if (appUsageChartElement) {
        renderAppUsageChart(appUsageChartElement, appUsageSummary);
      }
    } else {
      console.error('Failed to get app usage summary:', result);
      if (appUsageChartElement) {
        appUsageChartElement.innerHTML = '<p>No app usage data available</p>';
      }
    }
  } catch (error) {
    console.error('Error loading app usage summary:', error);
    if (appUsageChartElement) {
      appUsageChartElement.innerHTML = '<p>Error loading app usage data</p>';
    }
  }
}

// Load website summary
async function loadWebsiteSummary() {
  const websiteChartElement = document.getElementById('website-chart');
  if (websiteChartElement) {
    websiteChartElement.innerHTML = '<p>Loading website data...</p>';
  }

  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Getting website summary for:', today.toISOString(), 'to', tomorrow.toISOString());

    // Get website summary
    const result = await window.api.getWebsiteSummary(today.toISOString(), tomorrow.toISOString(), 5);
    console.log('Website summary result:', result);

    if (result && result.success) {
      websiteSummary = result.summary || [];

      // Update website chart
      if (websiteChartElement) {
        renderWebsiteChart(websiteChartElement, websiteSummary);
      }
    } else {
      console.error('Failed to get website summary:', result);
      if (websiteChartElement) {
        websiteChartElement.innerHTML = '<p>No website data available</p>';
      }
    }
  } catch (error) {
    console.error('Error loading website summary:', error);
    if (websiteChartElement) {
      websiteChartElement.innerHTML = '<p>Error loading website data</p>';
    }
  }
}

// renderTimeline is now imported from components/timeline-renderer.js

// formatDuration is now imported from common/utils.js

// Render charts
function renderCharts() {
  // Render app usage chart
  const appUsageChartElement = document.getElementById('app-usage-chart');
  if (appUsageChartElement && appUsageSummary.length > 0) {
    renderAppUsageChart(appUsageChartElement, appUsageSummary);
  }

  // Render website chart
  const websiteChartElement = document.getElementById('website-chart');
  if (websiteChartElement && websiteSummary.length > 0) {
    renderWebsiteChart(websiteChartElement, websiteSummary);
  }
}

// Render app usage chart
function renderAppUsageChart(element, data) {
  if (!data || data.length === 0) {
    element.innerHTML = '<p>No app usage data available</p>';
    return;
  }

  let html = '<div class="chart-container">';

  // Create bars
  data.forEach(app => {
    const percentage = app.durationPercentage || 0;
    const duration = formatDuration(app.totalDuration || 0);

    html += `
      <div class="chart-item">
        <div class="chart-label">${app.appName}</div>
        <div class="chart-bar-container">
          <div class="chart-bar" style="width: ${percentage}%"></div>
          <div class="chart-value">${duration}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  element.innerHTML = html;
}

// Render website chart
function renderWebsiteChart(element, data) {
  if (!data || data.length === 0) {
    element.innerHTML = '<p>No website data available</p>';
    return;
  }

  let html = '<div class="chart-container">';

  // Create bars
  data.forEach(website => {
    const percentage = website.durationPercentage || 0;
    const duration = formatDuration(website.totalDuration || 0);

    html += `
      <div class="chart-item">
        <div class="chart-label">${website.domain}</div>
        <div class="chart-bar-container">
          <div class="chart-bar" style="width: ${percentage}%"></div>
          <div class="chart-value">${duration}</div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  element.innerHTML = html;
}

// Generate insights
export async function generateInsights(timeframe) {
  const insightsContent = document.getElementById('insights-content');
  if (!insightsContent) return;

  insightsContent.innerHTML = '<p>Generating insights...</p>';

  try {
    // Call the AI API
    const result = await window.api.generateInsights(timeframe);

    if (result && result.success) {
      // Format the content as HTML
      const content = result.summary || '';
      insightsContent.innerHTML = `
        <h3>${capitalizeFirstLetter(timeframe)}ly Insights - ${new Date().toLocaleDateString()}</h3>
        <div class="timeline-card mt-4">
          ${content}
        </div>
      `;
    } else {
      insightsContent.innerHTML = '<p>Failed to generate insights</p>';
    }
  } catch (error) {
    console.error('Error generating insights:', error);
    insightsContent.innerHTML = '<p>Error generating insights</p>';
  }
}

// capitalizeFirstLetter is now imported from common/utils.js

// Refresh dashboard data
function refreshDashboard() {
  if (isRefreshing) return; // Prevent multiple refreshes
  loadDashboardData();
}

// Expose function globally for navigation.js to use
window.refreshDashboard = refreshDashboard;
