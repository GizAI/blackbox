import { ipcMain } from 'electron';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Screenshot, AudioRecording, WebHistory, AppUsage, AIInsight, Settings } from '../../database/models';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as util from 'util';
import * as childProcess from 'child_process';

// Promisify exec
const exec = util.promisify(childProcess.exec);

// AI Provider types
type AIProviderType = 'openai' | 'gemini' | 'anthropic' | 'local';

// AI Provider settings interface
interface AIProviderSettings {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

// AI Provider interfaces
interface AIProvider {
  // Basic methods
  processText(text: string, options?: any): Promise<string>;
  processImage(imagePath: string, options?: any): Promise<string>;
  generateSummary(data: any, options?: any): Promise<string>;

  // Advanced methods
  transcribeAudio?(audioPath: string, options?: any): Promise<string>;
  generateInsightsFromData?(data: any, options?: any): Promise<string>;
  answerQuestion?(question: string, context: string, options?: any): Promise<string>;
  generateTimelineSummary?(timelineData: any, options?: any): Promise<string>;

  // Provider info
  getProviderInfo(): {
    name: string;
    supportedFeatures: string[];
    defaultModel: string;
    availableModels: string[];
  };
}

// OpenAI Provider
class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private defaultModel: string;
  private visionModel: string;
  private audioModel: string;
  private temperature: number;
  private maxTokens: number;

  constructor(settings: AIProviderSettings) {
    this.client = new OpenAI({ apiKey: settings.apiKey });
    this.defaultModel = settings.model || 'gpt-4o';
    this.visionModel = 'gpt-4o';
    this.audioModel = 'whisper-1';
    this.temperature = settings.temperature || 0.7;
    this.maxTokens = settings.maxTokens || 1000;
  }

  async processText(text: string, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;
      const systemPrompt = options?.systemPrompt || 'You are an AI assistant analyzing user activity data.';

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature,
        max_tokens: maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error processing text with OpenAI:', error);
      return 'Error processing text with OpenAI. Please check your API key and try again.';
    }
  }

  async processImage(imagePath: string, options?: any): Promise<string> {
    try {
      if (!fs.existsSync(imagePath)) {
        return `Image file not found: ${imagePath}`;
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const prompt = options?.prompt || 'Describe what you see in this screenshot in detail. Focus on the main content, applications, and any text visible.';
      const maxTokens = options?.maxTokens || this.maxTokens;

      const response = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error processing image with OpenAI:', error);
      return 'Error processing image with OpenAI. Please check your API key and try again.';
    }
  }

  async generateSummary(data: any, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Create a more detailed prompt with the data
      let prompt = `Generate a summary of the following user activity data:\n\n`;

      // Add basic stats
      if (data.screenshots) {
        prompt += `Screenshots: ${data.screenshots.length} screenshots taken\n`;
      }

      if (data.audioRecordings) {
        prompt += `Audio Recordings: ${data.audioRecordings.length} recordings\n`;
      }

      if (data.webHistory) {
        prompt += `Web History: ${data.webHistory.length} websites visited\n`;
      }

      if (data.appUsage) {
        prompt += `App Usage: ${data.appUsage.length} app sessions\n`;
      }

      // Add top websites and apps if available
      if (data.topWebsites && data.topWebsites.length > 0) {
        prompt += `\nTop websites: ${data.topWebsites.join(', ')}\n`;
      }

      if (data.topApps && data.topApps.length > 0) {
        prompt += `\nTop applications: ${data.topApps.join(', ')}\n`;
      }

      // Add time range if available
      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate).toLocaleString();
        const endDate = new Date(data.endDate).toLocaleString();
        prompt += `\nTime range: ${startDate} to ${endDate}\n`;
      }

      // Add request for insights
      prompt += `\nProvide insights about productivity, patterns, and suggestions for improvement. Format your response in markdown with sections for Summary, Productivity Analysis, Patterns Observed, and Recommendations.`;

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an AI assistant analyzing user activity data. Provide helpful insights and actionable recommendations.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating summary with OpenAI:', error);
      return 'Error generating summary with OpenAI. Please check your API key and try again.';
    }
  }

  async transcribeAudio(audioPath: string, options?: any): Promise<string> {
    try {
      if (!fs.existsSync(audioPath)) {
        return `Audio file not found: ${audioPath}`;
      }

      const audioFile = fs.createReadStream(audioPath);

      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: this.audioModel,
        language: options?.language || 'en',
        response_format: 'text'
      });

      return response.toString();
    } catch (error) {
      console.error('Error transcribing audio with OpenAI:', error);
      return 'Error transcribing audio with OpenAI. Please check your API key and try again.';
    }
  }

  async answerQuestion(question: string, context: string, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      const prompt = `Context information is below.\n\n${context}\n\nGiven the context information and not prior knowledge, answer the question: ${question}`;

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an AI assistant answering questions based only on the provided context.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error answering question with OpenAI:', error);
      return 'Error answering question with OpenAI. Please check your API key and try again.';
    }
  }

  async generateTimelineSummary(timelineData: any, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Create a timeline summary prompt
      let prompt = `Generate a timeline summary of the following user activity data:\n\n`;

      // Add timeline data
      if (timelineData && timelineData.length > 0) {
        timelineData.forEach((item: any, index: number) => {
          const time = new Date(item.timestamp).toLocaleTimeString();
          prompt += `${time}: `;

          if (item.type === 'screenshot') {
            prompt += `Screenshot taken - ${item.description || 'No description'}\n`;
          } else if (item.type === 'audio') {
            prompt += `Audio recorded - ${item.transcript || 'No transcript'}\n`;
          } else if (item.type === 'web') {
            prompt += `Visited website - ${item.title} (${item.url})\n`;
          } else if (item.type === 'app') {
            prompt += `Used application - ${item.appName} (${item.windowTitle})\n`;
          }
        });
      }

      // Add request for summary
      prompt += `\nProvide a chronological summary of the user's activities, identifying main tasks and work patterns. Format your response in markdown with sections for Overview and Detailed Timeline.`;

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are an AI assistant creating timeline summaries of user activity.' },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating timeline summary with OpenAI:', error);
      return 'Error generating timeline summary with OpenAI. Please check your API key and try again.';
    }
  }

  getProviderInfo() {
    return {
      name: 'OpenAI',
      supportedFeatures: [
        'text-processing',
        'image-analysis',
        'summary-generation',
        'audio-transcription',
        'question-answering',
        'timeline-summary'
      ],
      defaultModel: this.defaultModel,
      availableModels: [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ]
    };
  }
}

// Google Gemini Provider
class GeminiProvider implements AIProvider {
  private client: any;
  private visionModel: any;
  private genAI: any;
  private defaultModel: string;
  private temperature: number;
  private maxTokens: number;
  private apiKey: string;

  constructor(settings: AIProviderSettings) {
    this.apiKey = settings.apiKey;
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.defaultModel = settings.model || 'gemini-pro';
    this.client = this.genAI.getGenerativeModel({ model: this.defaultModel });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    this.temperature = settings.temperature || 0.7;
    this.maxTokens = settings.maxTokens || 1000;
  }

  async processText(text: string, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Use the specified model or default
      const modelToUse = model !== this.defaultModel ?
        this.genAI.getGenerativeModel({ model }) :
        this.client;

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error processing text with Gemini:', error);
      return 'Error processing text with Gemini. Please check your API key and try again.';
    }
  }

  async processImage(imagePath: string, options?: any): Promise<string> {
    try {
      if (!fs.existsSync(imagePath)) {
        return `Image file not found: ${imagePath}`;
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const prompt = options?.prompt || 'Describe what you see in this screenshot in detail. Focus on the main content, applications, and any text visible.';
      const maxTokens = options?.maxTokens || this.maxTokens;
      const temperature = options?.temperature || this.temperature;

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const result = await this.visionModel.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/jpeg' } }
          ]
        }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error processing image with Gemini:', error);
      return 'Error processing image with Gemini. Please check your API key and try again.';
    }
  }

  async generateSummary(data: any, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Use the specified model or default
      const modelToUse = model !== this.defaultModel ?
        this.genAI.getGenerativeModel({ model }) :
        this.client;

      // Create a more detailed prompt with the data
      let prompt = `Generate a summary of the following user activity data:\n\n`;

      // Add basic stats
      if (data.screenshots) {
        prompt += `Screenshots: ${data.screenshots.length} screenshots taken\n`;
      }

      if (data.audioRecordings) {
        prompt += `Audio Recordings: ${data.audioRecordings.length} recordings\n`;
      }

      if (data.webHistory) {
        prompt += `Web History: ${data.webHistory.length} websites visited\n`;
      }

      if (data.appUsage) {
        prompt += `App Usage: ${data.appUsage.length} app sessions\n`;
      }

      // Add top websites and apps if available
      if (data.topWebsites && data.topWebsites.length > 0) {
        prompt += `\nTop websites: ${data.topWebsites.join(', ')}\n`;
      }

      if (data.topApps && data.topApps.length > 0) {
        prompt += `\nTop applications: ${data.topApps.join(', ')}\n`;
      }

      // Add time range if available
      if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate).toLocaleString();
        const endDate = new Date(data.endDate).toLocaleString();
        prompt += `\nTime range: ${startDate} to ${endDate}\n`;
      }

      // Add request for insights
      prompt += `\nProvide insights about productivity, patterns, and suggestions for improvement. Format your response in markdown with sections for Summary, Productivity Analysis, Patterns Observed, and Recommendations.`;

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating summary with Gemini:', error);
      return 'Error generating summary with Gemini. Please check your API key and try again.';
    }
  }

  async answerQuestion(question: string, context: string, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Use the specified model or default
      const modelToUse = model !== this.defaultModel ?
        this.genAI.getGenerativeModel({ model }) :
        this.client;

      const prompt = `Context information is below.\n\n${context}\n\nGiven the context information and not prior knowledge, answer the question: ${question}`;

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error answering question with Gemini:', error);
      return 'Error answering question with Gemini. Please check your API key and try again.';
    }
  }

  async generateTimelineSummary(timelineData: any, options?: any): Promise<string> {
    try {
      const model = options?.model || this.defaultModel;
      const temperature = options?.temperature || this.temperature;
      const maxTokens = options?.maxTokens || this.maxTokens;

      // Use the specified model or default
      const modelToUse = model !== this.defaultModel ?
        this.genAI.getGenerativeModel({ model }) :
        this.client;

      // Create a timeline summary prompt
      let prompt = `Generate a timeline summary of the following user activity data:\n\n`;

      // Add timeline data
      if (timelineData && timelineData.length > 0) {
        timelineData.forEach((item: any, index: number) => {
          const time = new Date(item.timestamp).toLocaleTimeString();
          prompt += `${time}: `;

          if (item.type === 'screenshot') {
            prompt += `Screenshot taken - ${item.description || 'No description'}\n`;
          } else if (item.type === 'audio') {
            prompt += `Audio recorded - ${item.transcript || 'No transcript'}\n`;
          } else if (item.type === 'web') {
            prompt += `Visited website - ${item.title} (${item.url})\n`;
          } else if (item.type === 'app') {
            prompt += `Used application - ${item.appName} (${item.windowTitle})\n`;
          }
        });
      }

      // Add request for summary
      prompt += `\nProvide a chronological summary of the user's activities, identifying main tasks and work patterns. Format your response in markdown with sections for Overview and Detailed Timeline.`;

      const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
      };

      const result = await modelToUse.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
      });

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating timeline summary with Gemini:', error);
      return 'Error generating timeline summary with Gemini. Please check your API key and try again.';
    }
  }

  getProviderInfo() {
    return {
      name: 'Google Gemini',
      supportedFeatures: [
        'text-processing',
        'image-analysis',
        'summary-generation',
        'question-answering',
        'timeline-summary'
      ],
      defaultModel: this.defaultModel,
      availableModels: [
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
      ]
    };
  }
}

// AI Integration Manager
class AIIntegrationManager {
  private provider: AIProvider | null = null;
  private providerSettings: AIProviderSettings | null = null;

  constructor() {
    this.initializeProvider();
  }

  // Initialize AI provider based on settings
  async initializeProvider() {
    try {
      const settings = await Settings.findOne({ where: { key: 'ai_provider' } });

      if (!settings || !settings.value) {
        console.log('No AI provider configured');
        return;
      }

      const providerSettings = typeof settings.value === 'string' ?
        JSON.parse(settings.value) : settings.value;

      this.providerSettings = providerSettings as AIProviderSettings;

      // Validate provider settings
      if (!providerSettings.provider) {
        console.log('Missing AI provider type');
        return;
      }

      if (!providerSettings.apiKey) {
        console.log('Missing AI provider API key');
        return;
      }

      try {
        if (providerSettings.provider === 'openai') {
          this.provider = new OpenAIProvider(providerSettings);
          console.log('OpenAI provider initialized');
        } else if (providerSettings.provider === 'gemini') {
          this.provider = new GeminiProvider(providerSettings);
          console.log('Gemini provider initialized');
        } else {
          console.log(`Unsupported AI provider: ${providerSettings.provider}`);
        }
      } catch (providerError) {
        console.error(`Error creating ${providerSettings.provider} provider:`, providerError);
        // Reset provider to avoid using a partially initialized provider
        this.provider = null;
      }
    } catch (error) {
      console.error('Error initializing AI provider:', error);
      this.provider = null;
    }
  }

  // Process a screenshot with AI
  async processScreenshot(screenshotId: number, options?: any) {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return { success: false, error: 'AI provider not configured' };
    }

    try {
      const screenshot = await Screenshot.findByPk(screenshotId);
      if (!screenshot) return { success: false, error: 'Screenshot not found' };

      const description = await this.provider.processImage(screenshot.path, options);

      // Update screenshot with description
      screenshot.textDescription = description;
      await screenshot.save();

      console.log(`Processed screenshot ${screenshotId} with AI`);
      return { success: true, description };
    } catch (error) {
      console.error('Error processing screenshot with AI:', error);
      return { success: false, error: 'Failed to process screenshot with AI' };
    }
  }

  // Process audio recording with AI (transcription)
  async processAudioRecording(recordingId: number, options?: any) {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return { success: false, error: 'AI provider not configured' };
    }

    try {
      const recording = await AudioRecording.findByPk(recordingId);
      if (!recording) return { success: false, error: 'Audio recording not found' };

      let transcript = '';

      // Use transcribeAudio if available, otherwise use processText
      if (this.provider.transcribeAudio) {
        transcript = await this.provider.transcribeAudio(recording.path, options);
      } else {
        // Fallback to placeholder if transcription not supported
        transcript = 'Transcription not supported by the current AI provider.';
      }

      // Update recording with transcript
      recording.transcript = transcript;
      await recording.save();

      console.log(`Processed audio recording ${recordingId} with AI`);
      return { success: true, transcript };
    } catch (error) {
      console.error('Error processing audio recording with AI:', error);
      return { success: false, error: 'Failed to process audio recording with AI' };
    }
  }

  // Generate insights from recent activity
  async generateInsights(timeframe: string, options?: any) {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return { success: false, error: 'AI provider not configured' };
    }

    try {
      // Determine time range based on timeframe
      const endDate = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case 'day':
          startDate.setHours(0, 0, 0, 0); // Start of today
          break;
        case 'yesterday':
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          // Start from beginning of current week (Sunday)
          const dayOfWeek = startDate.getDay();
          startDate.setDate(startDate.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          // Start from beginning of current month
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          // Default to last 24 hours
          startDate.setDate(startDate.getDate() - 1);
      }

      // Get data from the specified timeframe
      const screenshots = await Screenshot.findAll({
        where: {
          timestamp: {
            [Symbol.for('gte')]: startDate,
            [Symbol.for('lte')]: endDate
          }
        },
        order: [['timestamp', 'ASC']]
      });

      const audioRecordings = await AudioRecording.findAll({
        where: {
          timestamp: {
            [Symbol.for('gte')]: startDate,
            [Symbol.for('lte')]: endDate
          }
        },
        order: [['timestamp', 'ASC']]
      });

      const webHistory = await WebHistory.findAll({
        where: {
          timestamp: {
            [Symbol.for('gte')]: startDate,
            [Symbol.for('lte')]: endDate
          }
        },
        order: [['timestamp', 'ASC']]
      });

      const appUsage = await AppUsage.findAll({
        where: {
          startTime: {
            [Symbol.for('gte')]: startDate,
            [Symbol.for('lte')]: endDate
          }
        },
        order: [['startTime', 'ASC']]
      });

      // Calculate top websites and apps
      const websiteCounts: {[key: string]: number} = {};
      const websiteDurations: {[key: string]: number} = {};

      webHistory.forEach(entry => {
        try {
          const domain = new URL(entry.url).hostname;
          websiteCounts[domain] = (websiteCounts[domain] || 0) + 1;
          websiteDurations[domain] = (websiteDurations[domain] || 0) + (entry.duration || 0);
        } catch (error) {
          // Skip invalid URLs
        }
      });

      const appCounts: {[key: string]: number} = {};
      const appDurations: {[key: string]: number} = {};

      appUsage.forEach(entry => {
        appCounts[entry.appName] = (appCounts[entry.appName] || 0) + 1;
        appDurations[entry.appName] = (appDurations[entry.appName] || 0) + (entry.duration || 0);
      });

      // Get top websites and apps by duration
      const topWebsites = Object.entries(websiteDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, duration]) => ({ domain, duration, count: websiteCounts[domain] }));

      const topApps = Object.entries(appDurations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([app, duration]) => ({ app, duration, count: appCounts[app] }));

      // Create timeline data for chronological analysis
      const timeline = [
        ...screenshots.map(s => ({
          type: 'screenshot',
          timestamp: s.timestamp,
          description: s.textDescription || 'No description',
          id: s.id
        })),
        ...audioRecordings.map(a => ({
          type: 'audio',
          timestamp: a.timestamp,
          transcript: a.transcript || 'No transcript',
          duration: a.duration,
          id: a.id
        })),
        ...webHistory.map(w => ({
          type: 'web',
          timestamp: w.timestamp,
          url: w.url,
          title: w.title,
          duration: w.duration,
          id: w.id
        })),
        ...appUsage.map(a => ({
          type: 'app',
          timestamp: a.startTime,
          appName: a.appName,
          windowTitle: a.windowTitle,
          duration: a.duration,
          id: a.id
        }))
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Generate summary with AI
      let summary;
      if (this.provider.generateTimelineSummary && timeline.length > 0) {
        // Use timeline summary if available and we have timeline data
        summary = await this.provider.generateTimelineSummary(timeline, options);
      } else {
        // Otherwise use regular summary
        summary = await this.provider.generateSummary({
          screenshots,
          audioRecordings,
          webHistory,
          appUsage,
          topWebsites: topWebsites.map(w => w.domain),
          topApps: topApps.map(a => a.app),
          startDate,
          endDate
        }, options);
      }

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
          },
          topWebsites,
          topApps
        }
      });

      console.log(`Generated ${timeframe} insights with AI`);
      return { success: true, insight, summary };
    } catch (error) {
      console.error('Error generating insights with AI:', error);
      return { success: false, error: 'Failed to generate insights with AI' };
    }
  }

  // Get recent insights
  async getRecentInsights(limit = 10, type?: string) {
    try {
      const query: any = {
        order: [['timestamp', 'DESC']],
        limit
      };

      if (type) {
        query.where = { type };
      }

      const insights = await AIInsight.findAll(query);

      return { success: true, insights };
    } catch (error) {
      console.error('Error fetching insights:', error);
      return { success: false, error: 'Failed to fetch insights', insights: [] };
    }
  }

  // Process text with AI
  async processText(text: string, options?: any): Promise<any> {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return { success: false, error: 'AI provider not configured' };
    }

    try {
      const result = await this.provider.processText(text, options);
      return { success: true, result };
    } catch (error) {
      console.error('Error processing text with AI:', error);
      return { success: false, error: 'Failed to process text with AI' };
    }
  }

  // Answer a question with AI
  async answerQuestion(question: string, context: string, options?: any): Promise<any> {
    if (!this.provider) {
      await this.initializeProvider();
      if (!this.provider) return { success: false, error: 'AI provider not configured' };
    }

    try {
      if (this.provider.answerQuestion) {
        const answer = await this.provider.answerQuestion(question, context, options);
        return { success: true, answer };
      } else {
        // Fallback to regular text processing
        const prompt = `Context information is below.\n\n${context}\n\nGiven the context information and not prior knowledge, answer the question: ${question}`;
        const answer = await this.provider.processText(prompt, options);
        return { success: true, answer };
      }
    } catch (error) {
      console.error('Error answering question with AI:', error);
      return { success: false, error: 'Failed to answer question with AI' };
    }
  }

  // Set AI provider
  async setProvider(providerSettings: AIProviderSettings): Promise<any> {
    try {
      this.providerSettings = providerSettings;

      if (providerSettings.provider === 'openai') {
        this.provider = new OpenAIProvider(providerSettings);
      } else if (providerSettings.provider === 'gemini') {
        this.provider = new GeminiProvider(providerSettings);
      } else {
        return { success: false, error: `Unsupported provider: ${providerSettings.provider}` };
      }

      // Save to database
      await Settings.upsert({
        key: 'ai_provider',
        value: providerSettings
      });

      return { success: true, provider: providerSettings.provider };
    } catch (error) {
      console.error('Error setting AI provider:', error);
      return { success: false, error: 'Failed to set AI provider' };
    }
  }

  // Get provider info
  getProviderInfo() {
    if (this.provider) {
      return { success: true, info: this.provider.getProviderInfo() };
    }

    return {
      success: false,
      info: {
        name: 'None',
        supportedFeatures: [],
        defaultModel: '',
        availableModels: []
      }
    };
  }

  // Get current provider settings
  getCurrentProviderSettings() {
    return { success: true, settings: this.providerSettings };
  }

  // Get available providers
  async getAvailableProviders() {
    return {
      success: true,
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          description: 'OpenAI API (GPT-4, GPT-3.5, DALL-E, Whisper)',
          requiresApiKey: true,
          defaultModel: 'gpt-4o',
          models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
        },
        {
          id: 'gemini',
          name: 'Google Gemini',
          description: 'Google Gemini API (Gemini Pro, Gemini Pro Vision)',
          requiresApiKey: true,
          defaultModel: 'gemini-pro',
          models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash']
        }
      ]
    };
  }
}

// Create AI manager instance
const aiManager = new AIIntegrationManager();

// Set up IPC handlers
export function setupAIIntegrationHandlers() {
  // Remove any existing handlers to avoid duplicates
  try {
    ipcMain.removeHandler('ai:process-screenshot');
    ipcMain.removeHandler('ai:process-audio');
    ipcMain.removeHandler('ai:summary');
    ipcMain.removeHandler('ai:get-insights');
    ipcMain.removeHandler('ai:process-text');
    ipcMain.removeHandler('ai:answer-question');
    ipcMain.removeHandler('ai:set-provider');
    ipcMain.removeHandler('ai:get-provider-info');
    ipcMain.removeHandler('ai:get-provider-settings');
    ipcMain.removeHandler('ai:get-available-providers');
  } catch (error) {
    // Ignore errors if handlers don't exist
  }

  // Add handlers
  ipcMain.handle('ai:process-screenshot', async (_event, data) => {
    const { screenshotId, options } = data || {};
    return await aiManager.processScreenshot(screenshotId, options);
  });

  ipcMain.handle('ai:process-audio', async (_event, data) => {
    const { recordingId, options } = data || {};
    return await aiManager.processAudioRecording(recordingId, options);
  });

  ipcMain.handle('ai:summary', async (_event, data) => {
    const { timeframe, options } = data || {};
    return await aiManager.generateInsights(timeframe || 'day', options);
  });

  ipcMain.handle('ai:get-insights', async (_event, data) => {
    const { limit, type } = data || {};
    return await aiManager.getRecentInsights(limit || 10, type);
  });

  ipcMain.handle('ai:process-text', async (_event, data) => {
    const { text, options } = data || {};
    return await aiManager.processText(text, options);
  });

  ipcMain.handle('ai:answer-question', async (_event, data) => {
    const { question, context, options } = data || {};
    return await aiManager.answerQuestion(question, context, options);
  });

  ipcMain.handle('ai:set-provider', async (_event, providerSettings) => {
    return await aiManager.setProvider(providerSettings);
  });

  ipcMain.handle('ai:get-provider-info', (_event) => {
    return aiManager.getProviderInfo();
  });

  ipcMain.handle('ai:get-provider-settings', (_event) => {
    return aiManager.getCurrentProviderSettings();
  });

  ipcMain.handle('ai:get-available-providers', async (_event) => {
    return await aiManager.getAvailableProviders();
  });
}

// Export AI manager
export default aiManager;
