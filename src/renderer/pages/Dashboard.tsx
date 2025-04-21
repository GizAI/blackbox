import React, { useState, useEffect } from 'react';

interface ActivitySummary {
  screenshots: number;
  audioRecordings: number;
  webHistory: number;
  appUsage: number;
  topWebsites: string[];
  topApps: string[];
}

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<ActivitySummary>({
    screenshots: 0,
    audioRecordings: 0,
    webHistory: 0,
    appUsage: 0,
    topWebsites: [],
    topApps: []
  });
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('day');
  
  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get recent data
        const screenshots = await window.api.getScreenshots(100);
        const audioRecordings = await window.api.getAudioRecordings(100);
        const webHistory = await window.api.getWebHistory(100);
        const appUsage = await window.api.getAppUsage(100);
        
        // Calculate top websites
        const websiteCounts: Record<string, number> = {};
        webHistory.forEach((entry: any) => {
          try {
            const domain = new URL(entry.url).hostname;
            websiteCounts[domain] = (websiteCounts[domain] || 0) + 1;
          } catch (error) {
            // Skip invalid URLs
          }
        });
        
        const topWebsites = Object.entries(websiteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([domain]) => domain);
        
        // Calculate top apps
        const appCounts: Record<string, number> = {};
        appUsage.forEach((entry: any) => {
          appCounts[entry.appName] = (appCounts[entry.appName] || 0) + 1;
        });
        
        const topApps = Object.entries(appCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([app]) => app);
        
        // Update summary
        setSummary({
          screenshots: screenshots.length,
          audioRecordings: audioRecordings.length,
          webHistory: webHistory.length,
          appUsage: appUsage.length,
          topWebsites,
          topApps
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [timeframe]);
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => setTimeframe('day')}
            className={`px-3 py-1 rounded ${timeframe === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            Today
          </button>
          <button 
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1 rounded ${timeframe === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            Week
          </button>
          <button 
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1 rounded ${timeframe === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            Month
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Activity cards */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Screenshots</h2>
            <p className="text-3xl font-bold">{summary.screenshots}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Audio Recordings</h2>
            <p className="text-3xl font-bold">{summary.audioRecordings}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Websites Visited</h2>
            <p className="text-3xl font-bold">{summary.webHistory}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">App Sessions</h2>
            <p className="text-3xl font-bold">{summary.appUsage}</p>
          </div>
          
          {/* Top websites */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Top Websites</h2>
            {summary.topWebsites.length > 0 ? (
              <ul className="space-y-2">
                {summary.topWebsites.map((website, index) => (
                  <li key={index} className="flex items-center">
                    <span className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-full mr-3">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate">{website}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No website data available</p>
            )}
          </div>
          
          {/* Top apps */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Top Applications</h2>
            {summary.topApps.length > 0 ? (
              <ul className="space-y-2">
                {summary.topApps.map((app, index) => (
                  <li key={index} className="flex items-center">
                    <span className="w-8 h-8 flex items-center justify-center bg-green-100 dark:bg-green-900 rounded-full mr-3">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate">{app}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No application data available</p>
            )}
          </div>
          
          {/* Generate insights button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:col-span-4">
            <div className="flex justify-center">
              <button 
                onClick={() => window.api.generateSummary(timeframe)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
              >
                Generate AI Insights
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
