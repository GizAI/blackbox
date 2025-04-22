// timeline.js - Timeline page functionality

// Import common utilities and components
// Note: These imports are commented out to avoid module loading issues
// We'll use global variables instead for now
// import { formatDuration, formatTime } from '../common/utils.js';
// import { renderTimelineGroups, applyTimelineFilter } from './components/timeline-renderer.js';

// Define formatTime and formatDuration functions if not available globally
function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString();
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

// Define timeline rendering functions
function renderTimelineGroups(groups, element) {
  if (!groups || groups.length === 0) {
    if (element) {
      element.innerHTML = '<p>No data available</p>';
    }
    return;
  }

  let html = '';

  // Sort groups by start time (newest first)
  const sortedGroups = [...groups].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  sortedGroups.forEach(group => {
    html += `
      <div class="timeline-group">
        <div class="timeline-group-header">
          <h3 class="timeline-group-title">${group.title}</h3>
          <div class="timeline-group-info">
            <span>${formatTime(new Date(group.startTime))} - ${formatTime(new Date(group.endTime))}</span>
            <span>${formatDuration(group.duration)}</span>
          </div>
        </div>
        <div class="timeline-group-items">
    `;

    // Render items in the group
    const itemsHtml = renderTimeline(group.items);
    html += itemsHtml;

    html += `
        </div>
      </div>
    `;
  });

  if (element) {
    element.innerHTML = html;
  }

  return html;
}

function renderTimeline(items) {
  if (!items || items.length === 0) {
    return '<p>No activity found</p>';
  }

  let html = '';

  // Sort items by timestamp (newest first)
  const sortedItems = [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  sortedItems.forEach(item => {
    const time = formatTime(new Date(item.timestamp));
    const type = item.type;
    let title = item.title || '';
    let content = item.description || '';

    // Use default title if not provided
    if (!title) {
      switch (type) {
        case 'screenshot':
          title = `Screenshot at ${time}`;
          break;
        case 'audio':
          title = `Audio Recording at ${time}`;
          break;
        case 'web':
          title = 'Website Visited';
          break;
        case 'app':
          title = `Used ${item.appName || 'Application'}`;
          break;
        case 'insight':
          title = 'AI Insight';
          break;
        default:
          title = 'Activity';
      }
    }

    html += `
      <div class="timeline-item ${type}" data-type="${type}">
        <div class="timeline-time">${time}</div>
        <div class="timeline-card">
          <div class="timeline-card-header">
            <div class="timeline-card-title">${title}</div>
            <div class="timeline-card-type">${type}</div>
          </div>
          <div class="timeline-card-content">${content}</div>
    `;

    // Add screenshot image if available
    if (type === 'screenshot' && item.path) {
      html += `
        <img src="file://${item.path}" alt="Screenshot" class="timeline-card-image" data-path="${item.path}" onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22318%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20318%20180%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_158bd1d28ef%20text%20%7B%20fill%3Argba(0%2C0%2C0%2C.75)%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A16pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_158bd1d28ef%22%3E%3Crect%20width%3D%22318%22%20height%3D%22180%22%20fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22129.359375%22%20y%3D%2297.35%22%3EScreenshot%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E'">
      `;
    }

    // Add audio player if available
    if (type === 'audio') {
      html += `
        <div class="audio-player">
          <div class="audio-info">
            <span>Duration: ${formatDuration(item.duration || 0)}</span>
            ${item.transcript ? `<div class="audio-transcript">${item.transcript}</div>` : ''}
          </div>
      `;

      // Add audio controls if path is available
      if (item.path) {
        html += `
          <audio controls>
            <source src="file://${item.path}" type="audio/wav">
            Your browser does not support the audio element.
          </audio>
        `;
      } else {
        html += `<div class="audio-missing">Audio file not available</div>`;
      }

      html += `</div>`;
    }

    html += `
        </div>
      </div>
    `;
  });

  return html;
}

function applyTimelineFilter(filter, container) {
  if (!container) return;

  const items = container.querySelectorAll('.timeline-item');

  items.forEach(item => {
    if (filter === 'all' || item.getAttribute('data-type') === filter) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// State variables
let timelineData = [];
let currentFilter = 'all';
let currentDate = new Date().toISOString().split('T')[0];
let timelineGroups = [];
let autoRefreshInterval = null;
let isRefreshing = false;

// Initialize timeline
export async function initTimeline() {
  console.log('Initializing timeline...');

  // Set up date picker
  const datePicker = document.getElementById('timeline-date');
  if (datePicker) {
    datePicker.value = currentDate;
    datePicker.addEventListener('change', (e) => {
      currentDate = e.target.value;
      loadTimelineData(currentDate);
    });
  }

  // Set up filters
  const filters = document.querySelectorAll('.timeline-filter');
  filters.forEach(filter => {
    filter.addEventListener('click', () => {
      currentFilter = filter.getAttribute('data-filter');

      // Update active filter
      filters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');

      // Apply filter
      applyFilter(currentFilter);
    });
  });

  // Set up group by selector
  const groupBySelector = document.getElementById('group-by');
  if (groupBySelector) {
    groupBySelector.addEventListener('change', (e) => {
      const groupBy = e.target.value;
      groupTimelineItems(groupBy);
    });
  }

  // Set up refresh button
  const refreshButton = document.getElementById('refresh-timeline');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      refreshTimelineData();
    });
  }

  // Set up auto-refresh (every 5 minutes)
  startAutoRefresh(5 * 60 * 1000); // 5 minutes in milliseconds

  // Load initial data
  await loadTimelineData(currentDate);
}

// Load timeline data
async function loadTimelineData(date) {
  const timelineElement = document.getElementById('full-timeline');
  if (!timelineElement) return;

  timelineElement.innerHTML = '<p>Loading timeline data...</p>';
  console.log(`Loading timeline data for date: ${date}`);

  // Show loading indicator on refresh button
  const refreshButton = document.getElementById('refresh-timeline');
  if (refreshButton) {
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshButton.disabled = true;
  }

  isRefreshing = true;

  try {
    // Get timeline data
    const result = await window.api.getTimelineData(date);
    console.log('Timeline data result:', result);

    if (result.success && result.timeline && result.timeline.length > 0) {
      timelineData = result.timeline;
      console.log(`Loaded ${timelineData.length} timeline items`);

      // Group timeline items
      const groupBySelector = document.getElementById('group-by');
      const groupBy = groupBySelector ? groupBySelector.value : 'hour';
      console.log(`Grouping timeline items by: ${groupBy}`);
      await groupTimelineItems(groupBy);

      // Apply current filter
      applyFilter(currentFilter);
    } else {
      console.log('No timeline data available for this date');
      timelineElement.innerHTML = '<p>No data available for this date</p>';
    }
  } catch (error) {
    console.error('Error loading timeline data:', error);
    timelineElement.innerHTML = '<p>Error loading timeline data</p>';
  } finally {
    // Reset refresh button
    if (refreshButton) {
      refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
      refreshButton.disabled = false;
    }

    isRefreshing = false;
  }
}

// Group timeline items
async function groupTimelineItems(groupBy) {
  if (!timelineData || timelineData.length === 0) {
    console.log('No timeline data to group');
    return;
  }

  try {
    // Group items
    console.log(`Grouping ${timelineData.length} items by ${groupBy}`);
    const result = await window.api.groupTimelineItems(timelineData, groupBy);
    console.log('Grouping result:', result);

    if (result.success && result.groups) {
      timelineGroups = result.groups;
      console.log(`Created ${timelineGroups.length} timeline groups`);

      // Render the timeline groups
      const timelineElement = document.getElementById('full-timeline');
      if (timelineElement) {
        renderTimelineGroups(timelineGroups, timelineElement);
      } else {
        console.error('Timeline element not found for rendering');
      }
    } else {
      console.error('Failed to group timeline items:', result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error grouping timeline items:', error);
  }
}

// Function to apply filter to timeline
function applyFilter(filter) {
  const timelineElement = document.getElementById('full-timeline');
  if (!timelineElement) return;

  // Update current filter
  currentFilter = filter;

  // Apply filter
  applyTimelineFilter(filter, timelineElement);

  console.log(`Applied filter: ${filter}`);
}

// formatTime and formatDuration are now imported from common/utils.js

// Refresh timeline data
function refreshTimelineData() {
  if (isRefreshing) return; // Prevent multiple refreshes
  loadTimelineData(currentDate);
}

// Start auto-refresh
function startAutoRefresh(interval) {
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  // Set new interval
  autoRefreshInterval = setInterval(() => {
    if (!isRefreshing) { // Only refresh if not already refreshing
      console.log('Auto-refreshing timeline data...');
      refreshTimelineData();
    }
  }, interval);

  console.log(`Auto-refresh started with interval: ${interval}ms`);
}

// Stop auto-refresh
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log('Auto-refresh stopped');
  }
}

// Expose functions globally for navigation.js to use
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.refreshTimelineData = refreshTimelineData;
