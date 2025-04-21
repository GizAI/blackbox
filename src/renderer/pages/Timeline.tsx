import React, { useState, useEffect } from 'react';

interface TimelineItem {
  id: number;
  type: 'screenshot' | 'audio' | 'web' | 'app';
  timestamp: string;
  title: string;
  description: string;
  metadata: any;
}

const Timeline: React.FC = () => {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  
  // Load timeline data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get data from all sources
        const screenshots = await window.api.getScreenshots(100);
        const audioRecordings = await window.api.getAudioRecordings(100);
        const webHistory = await window.api.getWebHistory(100);
        const appUsage = await window.api.getAppUsage(100);
        
        // Convert to timeline items
        const items: TimelineItem[] = [
          ...screenshots.map((item: any) => ({
            id: item.id,
            type: 'screenshot' as const,
            timestamp: new Date(item.timestamp).toISOString(),
            title: 'Screenshot',
            description: item.textDescription || 'No description available',
            metadata: {
              path: item.path,
              ...item.metadata
            }
          })),
          ...audioRecordings.map((item: any) => ({
            id: item.id,
            type: 'audio' as const,
            timestamp: new Date(item.timestamp).toISOString(),
            title: 'Audio Recording',
            description: item.transcript || 'No transcript available',
            metadata: {
              path: item.path,
              duration: item.duration,
              ...item.metadata
            }
          })),
          ...webHistory.map((item: any) => ({
            id: item.id,
            type: 'web' as const,
            timestamp: new Date(item.timestamp).toISOString(),
            title: item.title || 'Website Visit',
            description: item.url,
            metadata: {
              url: item.url,
              duration: item.duration,
              ...item.metadata
            }
          })),
          ...appUsage.map((item: any) => ({
            id: item.id,
            type: 'app' as const,
            timestamp: new Date(item.startTime).toISOString(),
            title: item.appName,
            description: item.windowTitle || 'No window title',
            metadata: {
              appName: item.appName,
              duration: item.duration,
              ...item.metadata
            }
          }))
        ];
        
        // Sort by timestamp (newest first)
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setTimelineItems(items);
        setLoading(false);
      } catch (error) {
        console.error('Error loading timeline data:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedDate]);
  
  // Filter items by selected date
  const filteredItems = timelineItems.filter(item => {
    const itemDate = new Date(item.timestamp).toISOString().split('T')[0];
    return itemDate === selectedDate;
  });
  
  // Group items by hour
  const groupedItems: Record<string, TimelineItem[]> = {};
  
  filteredItems.forEach(item => {
    const hour = new Date(item.timestamp).getHours();
    const hourKey = `${hour}:00`;
    
    if (!groupedItems[hourKey]) {
      groupedItems[hourKey] = [];
    }
    
    groupedItems[hourKey].push(item);
  });
  
  // Get hours in descending order
  const hours = Object.keys(groupedItems).sort((a, b) => {
    const hourA = parseInt(a.split(':')[0]);
    const hourB = parseInt(b.split(':')[0]);
    return hourB - hourA;
  });
  
  // Handle item click
  const handleItemClick = (item: TimelineItem) => {
    setSelectedItem(item);
  };
  
  // Get icon for item type
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'screenshot':
        return '📷';
      case 'audio':
        return '🎤';
      case 'web':
        return '🌐';
      case 'app':
        return '📱';
      default:
        return '📄';
    }
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Timeline</h1>
        
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="flex">
          {/* Timeline */}
          <div className="w-2/3 pr-6">
            {hours.length > 0 ? (
              hours.map(hour => (
                <div key={hour} className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">{hour}</h2>
                  
                  <div className="space-y-4">
                    {groupedItems[hour].map(item => (
                      <div 
                        key={`${item.type}-${item.id}`}
                        className={`p-4 rounded-lg cursor-pointer ${
                          selectedItem?.id === item.id && selectedItem?.type === item.type
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => handleItemClick(item)}
                      >
                        <div className="flex items-start">
                          <div className="mr-3 text-2xl">{getItemIcon(item.type)}</div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <h3 className="font-medium">{item.title}</h3>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No data available for this date
              </div>
            )}
          </div>
          
          {/* Detail panel */}
          <div className="w-1/3 bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-fit sticky top-6">
            {selectedItem ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    <span className="mr-2">{getItemIcon(selectedItem.type)}</span>
                    {selectedItem.title}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedItem.timestamp).toLocaleString()}
                  </span>
                </div>
                
                {selectedItem.type === 'screenshot' && (
                  <div className="mb-4">
                    <img 
                      src={`file://${selectedItem.metadata.path}`} 
                      alt="Screenshot" 
                      className="w-full rounded-lg"
                    />
                  </div>
                )}
                
                {selectedItem.type === 'audio' && (
                  <div className="mb-4">
                    <audio 
                      src={`file://${selectedItem.metadata.path}`} 
                      controls 
                      className="w-full"
                    />
                  </div>
                )}
                
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {selectedItem.description}
                  </p>
                </div>
                
                {selectedItem.type === 'web' && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">URL</h3>
                    <p className="text-blue-500 break-all">
                      {selectedItem.metadata.url}
                    </p>
                  </div>
                )}
                
                {(selectedItem.type === 'app' || selectedItem.type === 'web') && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Duration</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedItem.metadata.duration} seconds
                    </p>
                  </div>
                )}
                
                {selectedItem.type === 'app' && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Application</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {selectedItem.metadata.appName}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Select an item to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Timeline;
