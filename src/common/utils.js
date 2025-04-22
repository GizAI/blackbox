// Common utility functions

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number') {
    return '0s';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Format time to hours and minutes
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
export function formatTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Format date and time
 * @param {Date} date - Date object
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Capitalize first letter of a string
 * @param {string} string - Input string
 * @returns {string} String with first letter capitalized
 */
export function capitalizeFirstLetter(string) {
  if (typeof string !== 'string' || !string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Get activity title based on type
 * @param {string} type - Activity type
 * @returns {string} Activity title
 */
export function getActivityTitle(type) {
  switch (type) {
    case 'screenshot':
      return 'Screenshots';
    case 'audio':
      return 'Audio Recordings';
    case 'web':
      return 'Web Browsing';
    case 'app':
      return 'Application Usage';
    case 'insight':
      return 'AI Insights';
    default:
      return 'Activity';
  }
}

/**
 * Get activity icon based on type
 * @param {string} type - Activity type
 * @returns {string} Activity icon (emoji)
 */
export function getActivityIcon(type) {
  switch (type) {
    case 'screenshot':
      return '📷';
    case 'audio':
      return '🎤';
    case 'web':
      return '🌐';
    case 'app':
      return '📱';
    case 'insight':
      return '💡';
    default:
      return '📝';
  }
}

/**
 * Truncate text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url;
  }
}

/**
 * Generate a hash for a string
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
export function generateHash(str) {
  let hash = 0;
  if (typeof str !== 'string' || str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString();
}

/**
 * Check if two objects are equal
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @returns {boolean} True if objects are equal
 */
export function areObjectsEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Group array items by a key
 * @param {Array} array - Array to group
 * @param {string|Function} key - Key to group by or function that returns the key
 * @returns {Object} Grouped object
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}
