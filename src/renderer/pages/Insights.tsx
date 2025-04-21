import React, { useState, useEffect } from 'react';

interface Insight {
  id: number;
  content: string;
  timestamp: string;
  type: string;
  metadata: any;
}

const Insights: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  
  // Load insights
  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        
        // Get insights from API
        const result = await window.api.getInsights(50);
        
        // Convert to insight objects
        const insightObjects: Insight[] = result.map((item: any) => ({
          id: item.id,
          content: item.content,
          timestamp: new Date(item.timestamp).toISOString(),
          type: item.type,
          metadata: item.metadata
        }));
        
        // Sort by timestamp (newest first)
        insightObjects.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setInsights(insightObjects);
        
        // Select the first insight by default
        if (insightObjects.length > 0 && !selectedInsight) {
          setSelectedInsight(insightObjects[0]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading insights:', error);
        setLoading(false);
      }
    };
    
    loadInsights();
    
    // Set up listener for new insights
    const handleNewInsight = (insight: any) => {
      setInsights(prev => [insight, ...prev]);
    };
    
    window.api.on('ai:insight', handleNewInsight);
    
    return () => {
      window.api.off('ai:insight', handleNewInsight);
    };
  }, []);
  
  // Generate new insight
  const generateInsight = async (timeframe: string) => {
    try {
      setGeneratingInsight(true);
      
      // Generate insight
      const result = await window.api.generateSummary(timeframe);
      
      if (result) {
        // Add to insights list
        const newInsight: Insight = {
          id: result.id,
          content: result.content,
          timestamp: new Date(result.timestamp).toISOString(),
          type: result.type,
          metadata: result.metadata
        };
        
        setInsights(prev => [newInsight, ...prev]);
        setSelectedInsight(newInsight);
      }
      
      setGeneratingInsight(false);
    } catch (error) {
      console.error('Error generating insight:', error);
      setGeneratingInsight(false);
    }
  };
  
  // Get friendly name for insight type
  const getInsightTypeName = (type: string) => {
    if (type.startsWith('summary_')) {
      const timeframe = type.replace('summary_', '');
      
      switch (timeframe) {
        case 'day':
          return 'Daily Summary';
        case 'week':
          return 'Weekly Summary';
        case 'month':
          return 'Monthly Summary';
        default:
          return 'Summary';
      }
    }
    
    return 'Insight';
  };
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Insights</h1>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => generateInsight('day')}
            disabled={generatingInsight}
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {generatingInsight ? 'Generating...' : 'Daily Insight'}
          </button>
          <button 
            onClick={() => generateInsight('week')}
            disabled={generatingInsight}
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Weekly Insight
          </button>
          <button 
            onClick={() => generateInsight('month')}
            disabled={generatingInsight}
            className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Monthly Insight
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="flex">
          {/* Insights list */}
          <div className="w-1/3 pr-6">
            {insights.length > 0 ? (
              <div className="space-y-4">
                {insights.map(insight => (
                  <div 
                    key={insight.id}
                    className={`p-4 rounded-lg cursor-pointer ${
                      selectedInsight?.id === insight.id
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedInsight(insight)}
                  >
                    <div className="flex justify-between">
                      <h3 className="font-medium">{getInsightTypeName(insight.type)}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(insight.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                      {insight.content.substring(0, 100)}...
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg">
                No insights available. Generate your first insight!
              </div>
            )}
          </div>
          
          {/* Detail panel */}
          <div className="w-2/3 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {selectedInsight ? (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {getInsightTypeName(selectedInsight.type)}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(selectedInsight.timestamp).toLocaleString()}
                  </span>
                </div>
                
                <div className="prose dark:prose-invert max-w-none">
                  {selectedInsight.content.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                
                {selectedInsight.metadata && selectedInsight.metadata.timeframe && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium mb-2">Time Period</h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {new Date(selectedInsight.metadata.startDate).toLocaleString()} to {new Date(selectedInsight.metadata.endDate).toLocaleString()}
                    </p>
                    
                    {selectedInsight.metadata.dataPoints && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Screenshots</h4>
                          <p className="text-lg">{selectedInsight.metadata.dataPoints.screenshots}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Audio Recordings</h4>
                          <p className="text-lg">{selectedInsight.metadata.dataPoints.audioRecordings}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Websites Visited</h4>
                          <p className="text-lg">{selectedInsight.metadata.dataPoints.webHistory}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">App Sessions</h4>
                          <p className="text-lg">{selectedInsight.metadata.dataPoints.appUsage}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Select an insight to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Insights;
