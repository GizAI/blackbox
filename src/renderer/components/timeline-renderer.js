// Timeline renderer component
import { formatDuration, formatTime } from '../../common/utils.js';

/**
 * Render timeline items
 * @param {Array} items - Timeline items to render
 * @param {HTMLElement} element - DOM element to render into
 * @param {Object} options - Rendering options
 */
export function renderTimeline(items, element, options = {}) {
  if (!items || items.length === 0) {
    element.innerHTML = '<p>No activity found</p>';
    return;
  }
  
  let html = '';
  
  items.forEach(item => {
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
  
  element.innerHTML = html;
  
  // Add event listeners to screenshot images
  const screenshotImages = element.querySelectorAll('.timeline-card-image');
  screenshotImages.forEach(img => {
    img.addEventListener('click', () => {
      const modal = document.getElementById('screenshot-modal');
      const modalImage = document.getElementById('modal-image');
      modalImage.src = img.src;
      modal.classList.add('active');
    });
  });
}

/**
 * Render timeline groups
 * @param {Array} groups - Timeline groups to render
 * @param {HTMLElement} element - DOM element to render into
 * @param {Object} options - Rendering options
 */
export function renderTimelineGroups(groups, element, options = {}) {
  if (!groups || groups.length === 0) {
    element.innerHTML = '<p>No data available</p>';
    return;
  }
  
  let html = '';
  
  groups.forEach(group => {
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
    renderTimeline(group.items, document.createElement('div'), options);
    const itemsHtml = document.createElement('div');
    renderTimeline(group.items, itemsHtml, options);
    html += itemsHtml.innerHTML;
    
    html += `
        </div>
      </div>
    `;
  });
  
  element.innerHTML = html;
  
  // Add event listeners to screenshot images
  const screenshotImages = element.querySelectorAll('.timeline-card-image');
  screenshotImages.forEach(img => {
    img.addEventListener('click', () => {
      const modal = document.getElementById('screenshot-modal');
      const modalImage = document.getElementById('modal-image');
      modalImage.src = img.src;
      modal.classList.add('active');
    });
  });
}

/**
 * Apply filter to timeline items
 * @param {string} filter - Filter to apply ('all' or activity type)
 * @param {HTMLElement} container - Container element with timeline items
 */
export function applyTimelineFilter(filter, container) {
  const items = container.querySelectorAll('.timeline-item');
  
  items.forEach(item => {
    if (filter === 'all' || item.getAttribute('data-type') === filter) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}
