import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Timeline from './pages/Timeline';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

// Define window.api interface
declare global {
  interface Window {
    api: {
      // Screen capture
      startScreenCapture: () => Promise<boolean>;
      stopScreenCapture: () => Promise<boolean>;
      getScreenshots: (limit: number) => Promise<any[]>;
      
      // Audio recording
      startAudioRecording: () => Promise<boolean>;
      stopAudioRecording: () => Promise<boolean>;
      getAudioRecordings: (limit: number) => Promise<any[]>;
      
      // Web history
      startWebHistoryTracking: () => Promise<boolean>;
      stopWebHistoryTracking: () => Promise<boolean>;
      getWebHistory: (limit: number) => Promise<any[]>;
      
      // App monitoring
      startAppMonitoring: () => Promise<boolean>;
      stopAppMonitoring: () => Promise<boolean>;
      getAppUsage: (limit: number) => Promise<any[]>;
      
      // AI integration
      processWithAI: (data: any) => Promise<any>;
      generateSummary: (timeframe: string) => Promise<any>;
      
      // Settings
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<boolean>;
      
      // System
      getSystemInfo: () => Promise<any>;
      
      // Listeners
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

const App: React.FC = () => {
  const location = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  
  // Check recording status on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const settings = await window.api.getSettings();
        setIsRecording(settings.recording_active || false);
      } catch (error) {
        console.error('Error checking recording status:', error);
      }
    };
    
    checkStatus();
  }, []);
  
  // Toggle recording
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        // Stop all recording modules
        await window.api.stopScreenCapture();
        await window.api.stopAudioRecording();
        await window.api.stopWebHistoryTracking();
        await window.api.stopAppMonitoring();
        
        // Update settings
        await window.api.updateSettings({ recording_active: false });
        
        setIsRecording(false);
      } else {
        // Start all recording modules
        await window.api.startScreenCapture();
        await window.api.startAudioRecording();
        await window.api.startWebHistoryTracking();
        await window.api.startAppMonitoring();
        
        // Update settings
        await window.api.updateSettings({ recording_active: true });
        
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-md">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">BlackBox AI</h1>
        </div>
        
        <nav className="mt-6">
          <ul>
            <li className="px-4 py-2">
              <Link 
                to="/" 
                className={`flex items-center ${location.pathname === '/' ? 'text-blue-500 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <span className="mr-2">📊</span>
                Dashboard
              </Link>
            </li>
            <li className="px-4 py-2">
              <Link 
                to="/timeline" 
                className={`flex items-center ${location.pathname === '/timeline' ? 'text-blue-500 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <span className="mr-2">⏱️</span>
                Timeline
              </Link>
            </li>
            <li className="px-4 py-2">
              <Link 
                to="/insights" 
                className={`flex items-center ${location.pathname === '/insights' ? 'text-blue-500 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <span className="mr-2">💡</span>
                Insights
              </Link>
            </li>
            <li className="px-4 py-2">
              <Link 
                to="/settings" 
                className={`flex items-center ${location.pathname === '/settings' ? 'text-blue-500 font-medium' : 'text-gray-600 dark:text-gray-300'}`}
              >
                <span className="mr-2">⚙️</span>
                Settings
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="absolute bottom-0 w-64 p-4">
          <button
            onClick={toggleRecording}
            className={`w-full py-2 px-4 rounded-md ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
