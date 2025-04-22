import React, { useState, useEffect } from 'react';

interface SettingsData {
  auto_start: boolean;
  screen_capture_interval: number;
  web_history_interval: number;
  app_monitor_interval: number;
  ai_provider: {
    provider: string;
    apiKey: string;
  };
  storage_limit: number;
  encryption_enabled: boolean;
  notification_enabled: boolean;
  [key: string]: any;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsData>({
    auto_start: true,
    screen_capture_interval: 10000,
    web_history_interval: 5000,
    app_monitor_interval: 1000,
    ai_provider: {
      provider: 'openai',
      apiKey: ''
    },
    storage_limit: 10 * 1024 * 1024 * 1024, // 10 GB
    encryption_enabled: false,
    notification_enabled: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        // Get settings from API
        const result = await window.api.getSettings();

        // Update state with loaded settings
        if (result) {
          setSettings(result);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading settings:', error);
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Save settings
  const saveSettings = async () => {
    try {
      setSaving(true);

      // Save settings via API
      await window.api.updateSettings(settings);

      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);

      setSaving(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings');
      setTimeout(() => setSaveMessage(''), 3000);

      setSaving(false);
    }
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (name.includes('.')) {
      // Handle nested properties (e.g., ai_provider.provider)
      const [parent, child] = name.split('.');
      setSettings(prev => {
        const newSettings = { ...prev };
        const parentKey = parent as keyof SettingsData;
        const parentValue = prev[parentKey];

        if (typeof parentValue === 'object' && parentValue !== null) {
          newSettings[parentKey] = {
            ...parentValue,
            [child]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
          };
        }

        return newSettings;
      });
    } else {
      // Handle top-level properties
      setSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (
          type === 'number' ? parseInt(value) : value
        )
      }));
    }
  };

  // Format bytes to human-readable size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <div className="flex items-center">
          {saveMessage && (
            <span className={`mr-4 ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {saveMessage}
            </span>
          )}

          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Recording Settings */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Recording Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="auto_start"
                      checked={settings.auto_start}
                      onChange={handleChange}
                      className="mr-2 h-5 w-5"
                    />
                    <span>Start recording automatically on launch</span>
                  </label>
                </div>

                <div>
                  <label className="block mb-2">
                    Screenshot Interval (ms)
                  </label>
                  <input
                    type="number"
                    name="screen_capture_interval"
                    value={settings.screen_capture_interval}
                    onChange={handleChange}
                    min="1000"
                    step="1000"
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(settings.screen_capture_interval / 1000).toFixed(1)} seconds between screenshots
                  </p>
                </div>

                <div>
                  <label className="block mb-2">
                    Web History Tracking Interval (ms)
                  </label>
                  <input
                    type="number"
                    name="web_history_interval"
                    value={settings.web_history_interval}
                    onChange={handleChange}
                    min="1000"
                    step="1000"
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(settings.web_history_interval / 1000).toFixed(1)} seconds between web checks
                  </p>
                </div>

                <div>
                  <label className="block mb-2">
                    App Monitoring Interval (ms)
                  </label>
                  <input
                    type="number"
                    name="app_monitor_interval"
                    value={settings.app_monitor_interval}
                    onChange={handleChange}
                    min="500"
                    step="500"
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(settings.app_monitor_interval / 1000).toFixed(1)} seconds between app checks
                  </p>
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div>
              <h2 className="text-xl font-semibold mb-4">AI Integration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2">
                    AI Provider
                  </label>
                  <select
                    name="ai_provider.provider"
                    value={settings.ai_provider.provider}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    name="ai_provider.apiKey"
                    value={settings.ai_provider.apiKey}
                    onChange={handleChange}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Your API key is stored locally and never shared
                  </p>
                </div>
              </div>

              <h2 className="text-xl font-semibold mb-4 mt-8">Storage & Privacy</h2>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2">
                    Storage Limit
                  </label>
                  <select
                    name="storage_limit"
                    value={settings.storage_limit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={5 * 1024 * 1024 * 1024}>5 GB</option>
                    <option value={10 * 1024 * 1024 * 1024}>10 GB</option>
                    <option value={20 * 1024 * 1024 * 1024}>20 GB</option>
                    <option value={50 * 1024 * 1024 * 1024}>50 GB</option>
                    <option value={100 * 1024 * 1024 * 1024}>100 GB</option>
                  </select>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Current limit: {formatBytes(settings.storage_limit)}
                  </p>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="encryption_enabled"
                      checked={settings.encryption_enabled}
                      onChange={handleChange}
                      className="mr-2 h-5 w-5"
                    />
                    <span>Enable encryption for stored data</span>
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-7">
                    Encrypts all stored data with a local key
                  </p>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="notification_enabled"
                      checked={settings.notification_enabled}
                      onChange={handleChange}
                      className="mr-2 h-5 w-5"
                    />
                    <span>Enable AI insights notifications</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
