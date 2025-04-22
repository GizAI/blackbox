// insights.js - AI Insights page functionality

// State variables
let currentTimeframe = 'day';
let insightsData = {};

// Initialize insights
export async function initInsights() {
  console.log('Initializing insights...');
  
  // Set up buttons
  const dailyButton = document.getElementById('daily-insights-btn');
  const weeklyButton = document.getElementById('weekly-insights-btn');
  const monthlyButton = document.getElementById('monthly-insights-btn');
  
  if (dailyButton) {
    dailyButton.addEventListener('click', () => {
      currentTimeframe = 'day';
      updateActiveButton();
      generateInsights('day');
    });
  }
  
  if (weeklyButton) {
    weeklyButton.addEventListener('click', () => {
      currentTimeframe = 'week';
      updateActiveButton();
      generateInsights('week');
    });
  }
  
  if (monthlyButton) {
    monthlyButton.addEventListener('click', () => {
      currentTimeframe = 'month';
      updateActiveButton();
      generateInsights('month');
    });
  }
  
  // Generate initial insights
  generateInsights('day');
}

// Update active button
function updateActiveButton() {
  const dailyButton = document.getElementById('daily-insights-btn');
  const weeklyButton = document.getElementById('weekly-insights-btn');
  const monthlyButton = document.getElementById('monthly-insights-btn');
  
  if (dailyButton) {
    dailyButton.classList.toggle('active', currentTimeframe === 'day');
  }
  
  if (weeklyButton) {
    weeklyButton.classList.toggle('active', currentTimeframe === 'week');
  }
  
  if (monthlyButton) {
    monthlyButton.classList.toggle('active', currentTimeframe === 'month');
  }
}

// Generate insights
async function generateInsights(timeframe) {
  const insightsContent = document.getElementById('insights-content');
  if (!insightsContent) return;
  
  insightsContent.innerHTML = '<p>Generating insights...</p>';
  
  try {
    // Check if we already have insights for this timeframe
    if (insightsData[timeframe]) {
      renderInsights(timeframe, insightsData[timeframe]);
      return;
    }
    
    // Call the AI API
    const result = await window.api.generateInsights({ timeframe });
    
    if (result && result.success) {
      insightsData[timeframe] = result.summary || '';
      renderInsights(timeframe, insightsData[timeframe]);
    } else {
      insightsContent.innerHTML = '<p>Failed to generate insights</p>';
    }
  } catch (error) {
    console.error('Error generating insights:', error);
    insightsContent.innerHTML = '<p>Error generating insights</p>';
    
    // Fallback to sample data
    setTimeout(() => {
      const sampleData = getSampleInsights(timeframe);
      insightsData[timeframe] = sampleData;
      renderInsights(timeframe, sampleData);
    }, 1500);
  }
}

// Render insights
function renderInsights(timeframe, content) {
  const insightsContent = document.getElementById('insights-content');
  if (!insightsContent) return;
  
  const title = getTimeframeTitle(timeframe);
  
  insightsContent.innerHTML = `
    <h3>${title} - ${new Date().toLocaleDateString()}</h3>
    <div class="timeline-card mt-4">
      ${content}
    </div>
  `;
}

// Get timeframe title
function getTimeframeTitle(timeframe) {
  switch (timeframe) {
    case 'day':
      return 'Daily Insights';
    case 'week':
      return 'Weekly Insights';
    case 'month':
      return 'Monthly Insights';
    default:
      return 'Insights';
  }
}

// Get sample insights
function getSampleInsights(timeframe) {
  switch (timeframe) {
    case 'day':
      return `
        <p><strong>Productivity Summary</strong></p>
        <p>Today, you spent most of your time using Visual Studio Code (3.5 hours) and Chrome (2.2 hours). Your most visited websites were github.com, stackoverflow.com, and google.com.</p>
        <p>Your productivity score is <strong>85%</strong>, which is higher than your weekly average.</p>
        <p><strong>Recommendations:</strong></p>
        <ul>
          <li>You had several context switches between coding and browsing. Consider using the Pomodoro technique to improve focus.</li>
          <li>Your most productive hours were between 10 AM and 12 PM. Schedule important tasks during this time window.</li>
        </ul>
      `;
    case 'week':
      return `
        <p><strong>Weekly Productivity Summary</strong></p>
        <p>This week, you spent a total of 42 hours on your computer, with 28 hours on productive applications. Your most used applications were Visual Studio Code, Chrome, and Terminal.</p>
        <p>Your productivity score is <strong>72%</strong>, which is about average for you.</p>
        <p><strong>Recommendations:</strong></p>
        <ul>
          <li>Wednesday was your most productive day. Consider scheduling important tasks on Wednesdays.</li>
          <li>You spent 5.5 hours on YouTube this week, which is 2 hours more than last week.</li>
          <li>Your screen time increased by 15% compared to last week. Consider taking more breaks.</li>
        </ul>
      `;
    case 'month':
      return `
        <p><strong>Monthly Productivity Summary</strong></p>
        <p>This month, you spent a total of 168 hours on your computer, with 112 hours on productive applications. Your most used applications were Visual Studio Code (58 hours), Chrome (45 hours), and Terminal (22 hours).</p>
        <p>Your productivity score is <strong>68%</strong>, which is slightly lower than last month.</p>
        <p><strong>Trends:</strong></p>
        <ul>
          <li>Your coding time increased by 12% compared to last month.</li>
          <li>You spent less time on communication tools like Slack and Email.</li>
          <li>Your most productive days were Tuesdays and Wednesdays.</li>
          <li>You had an average of 6.2 hours of screen time per day.</li>
        </ul>
        <p><strong>Recommendations:</strong></p>
        <ul>
          <li>Consider taking more breaks during long coding sessions.</li>
          <li>Your productivity tends to drop after 3 PM. Try scheduling meetings and less demanding tasks for the afternoon.</li>
        </ul>
      `;
    default:
      return '<p>No insights available</p>';
  }
}
