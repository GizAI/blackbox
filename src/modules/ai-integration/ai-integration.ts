import { ipcMain } from 'electron';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Screenshot, AudioRecording, WebHistory, AppUsage, AIInsight, Settings } from '../../database/models';
import * as fs from 'fs';

// AI Provider interfaces
interface AIProvider {
  processText(text: string): Promise<string>;
  processImage(imagePath: string): Promise<string>;
  generateSummary(data: any): Promise<string>;
}

// OpenAI Provider
class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async processText(text: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an AI assistant analyzing user activity data.' },
          { role: 'user', content: text }
        ],
        max_tokens: 500
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error processing text with OpenAI:', error);
      return '';
    }
  }
  
  async processImage(imagePath: string): Promise<string> {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe what you see in this screenshot in detail.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 500
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error processing image with OpenAI:', error);
      return '';
    }
  }
  
  async generateSummary(data: any): Promise<string> {
    try {
      const prompt = `
        Generate a summary of the following user activity data:
        
        Screenshots: ${data.screenshots.length} screenshots taken
        Audio Recordings: ${data.audioRecordings.length} recordings
        Web History: ${data.webHistory.length} websites visited
        App Usage: ${data.appUsage.length} app sessions
        
        Top websites: ${data.topWebsites.join(', ')}
        Top applications: ${data.topApps.join(', ')}
        
        Provide insights about productivity, patterns, and suggestions for improvement.
      `;
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an AI assistant analyzing user activity data.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating summary with OpenAI:', error);
      return '';
    }
  }
}

// Google Gemini Provider
class GeminiProvider implements AIProvider {
  private client: any;
  
  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.client = genAI.getGenerativeModel({ model: 'gemini-pro' });
  }
  
  async processText(text: string): Promise<string> {
    try {
      const result = await this.client.generateContent(text);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error processing text with Gemini:', error);
      return '';
    }
  }
  
  async processImage(imagePath: string): Promise<string> {
    try {
      // For image processing, we need to use the vision model
      const genAI = new GoogleGenerativeAI(this.client.apiKey);
      const visionModel = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
      
      const imageBuffer = fs.readFileSync(imagePath);
      
      const result = await visionModel.generateContent([
        'Describe what you see in this screenshot in detail.',
        { inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/jpeg' } }
      ]);
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error processing image with Gemini:', error);
      return '';
    }
  }
  
  async generateSummary(data: any): Promise<string> {
    try {
      const prompt = `
        Generate a summary of the following user activity data:
        
        Screenshots: ${data.screenshots.length} screenshots taken
        Audio Recordings: ${data.audioRecordings.length} recordings
        Web History: ${data.webHistory.length} websites visited
        App Usage: ${data.appUsage.length} app sessions
        
        Top websites: ${data.topWebsites.join(', ')}
        Top applications: ${data.topApps.join(', ')}
        
        Provide insights about productivity, patterns, and suggestions for improvement.
      `;
      
      const result = await this.client.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating summary with Gemini:', error);
      return '';
    }
  }
}

// AI Integration Manager
class AIIntegrationManager {
  private provider: AIProvider | null = null;
  
  constructor() {
    this.initializeProvider();
  }
  
  // Initialize AI provider based on settings
  async initializeProvider() {
    try {
      const settings = await Settings.findOne({ where: { key: 'ai_provider' } });
      
      if (!settings) {
        console.log('No AI provider configured');
        return;
      }
      
      const providerSettings = settings.value;
      
      if (providerSettings.provider === 'openai' && providerSettings.apiKey) {
        this.provider = new OpenAIProvider(providerSettings.apiKey);
        console.log('OpenAI provider initialized');
      } else if (providerSettings.provider === 'gemini' && providerSettings.apiKey) {
        this.provider = new GeminiProvider(providerSettings.apiKey);
        console.log('Gemini provider initialized');
      } else {
        console.log('Invalid AI provider configuration');
      }
    } catch (error) {
      console.error('Error initializing AI provider:', error);
    }
  }
  
  // Process a screenshot with AI
  async processScreenshot(screenshotId: number) {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return null;
    }
    
    try {
      const screenshot = await Screenshot.findByPk(screenshotId);
      if (!screenshot) return null;
      
      const description = await this.provider.processImage(screenshot.path);
      
      // Update screenshot with description
      screenshot.textDescription = description;
      await screenshot.save();
      
      console.log(`Processed screenshot ${screenshotId} with AI`);
      return description;
    } catch (error) {
      console.error('Error processing screenshot with AI:', error);
      return null;
    }
  }
  
  // Process audio recording with AI (transcription)
  async processAudioRecording(recordingId: number) {
    // In a real implementation, we would use a speech-to-text service
    // For now, we'll simulate with a placeholder
    try {
      const recording = await AudioRecording.findByPk(recordingId);
      if (!recording) return null;
      
      // Simulate transcription
      const transcript = 'This is a simulated transcript of the audio recording.';
      
      // Update recording with transcript
      recording.transcript = transcript;
      await recording.save();
      
      console.log(`Processed audio recording ${recordingId} with AI`);
      return transcript;
    } catch (error) {
      console.error('Error processing audio recording with AI:', error);
      return null;
    }
  }
  
  // Generate insights from recent activity
  async generateInsights(timeframe: string) {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return null;
    }
    
    try {
      // Determine time range based on timeframe
      const endDate = new Date();
      let startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate.setHours(startDate.getHours() - 1); // Default to last hour
      }
      
      // Get data from the specified timeframe
      const screenshots = await Screenshot.findAll({
        where: {
          timestamp: {
            $between: [startDate, endDate]
          }
        }
      });
      
      const audioRecordings = await AudioRecording.findAll({
        where: {
          timestamp: {
            $between: [startDate, endDate]
          }
        }
      });
      
      const webHistory = await WebHistory.findAll({
        where: {
          timestamp: {
            $between: [startDate, endDate]
          }
        }
      });
      
      const appUsage = await AppUsage.findAll({
        where: {
          startTime: {
            $between: [startDate, endDate]
          }
        }
      });
      
      // Calculate top websites and apps
      const websiteCounts: Record<string, number> = {};
      webHistory.forEach(entry => {
        const domain = new URL(entry.url).hostname;
        websiteCounts[domain] = (websiteCounts[domain] || 0) + 1;
      });
      
      const appCounts: Record<string, number> = {};
      appUsage.forEach(entry => {
        appCounts[entry.appName] = (appCounts[entry.appName] || 0) + 1;
      });
      
      // Get top 5 websites and apps
      const topWebsites = Object.entries(websiteCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([domain]) => domain);
      
      const topApps = Object.entries(appCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([app]) => app);
      
      // Generate summary with AI
      const summary = await this.provider.generateSummary({
        screenshots,
        audioRecordings,
        webHistory,
        appUsage,
        topWebsites,
        topApps
      });
      
      // Save insight to database
      const insight = await AIInsight.create({
        content: summary,
        timestamp: new Date(),
        type: `summary_${timeframe}`,
        metadata: {
          timeframe,
          startDate,
          endDate,
          dataPoints: {
            screenshots: screenshots.length,
            audioRecordings: audioRecordings.length,
            webHistory: webHistory.length,
            appUsage: appUsage.length
          }
        }
      });
      
      console.log(`Generated ${timeframe} insights with AI`);
      return insight;
    } catch (error) {
      console.error('Error generating insights with AI:', error);
      return null;
    }
  }
  
  // Get recent insights
  async getRecentInsights(limit = 10) {
    try {
      const insights = await AIInsight.findAll({
        order: [['timestamp', 'DESC']],
        limit
      });
      
      return insights;
    } catch (error) {
      console.error('Error fetching insights:', error);
      return [];
    }
  }
}

// Create AI manager instance
const aiManager = new AIIntegrationManager();

// Set up IPC handlers
export function setupAIIntegrationHandlers() {
  ipcMain.handle('ai:process-screenshot', async (event, screenshotId) => {
    return await aiManager.processScreenshot(screenshotId);
  });
  
  ipcMain.handle('ai:process-audio', async (event, recordingId) => {
    return await aiManager.processAudioRecording(recordingId);
  });
  
  ipcMain.handle('ai:summary', async (event, timeframe) => {
    return await aiManager.generateInsights(timeframe);
  });
  
  ipcMain.handle('ai:get-insights', async (event, limit) => {
    return await aiManager.getRecentInsights(limit);
  });
}

// Export AI manager
export default aiManager;
