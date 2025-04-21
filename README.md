# BlackBox AI

BlackBox AI is a personal productivity and memory augmentation tool that continuously records your computer activities, processes them using AI, and provides insights, summaries, and assistance based on your digital footprint.

## Features

- **Continuous Recording**: Capture screenshots, audio, web browsing history, and application usage
- **Intelligent Filtering**: Skip redundant data to optimize storage
- **AI Analysis**: Process data with AI to extract insights and generate summaries
- **Timeline View**: Browse your history with intuitive navigation
- **Local Storage**: All data stored locally for maximum privacy
- **Cross-Platform**: Support for Windows, macOS, and Linux

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

1. Clone the repository:
```
git clone https://github.com/blackbox-ai/blackbox-ai.git
cd blackbox-ai
```

2. Install dependencies:
```
npm install
```

3. Start the application in development mode:
```
npm run dev
```

### Building for Production

Build for your specific platform:

```
# For Windows
npm run build:win

# For macOS
npm run build:mac

# For Linux
npm run build:linux
```

## Architecture

BlackBox AI is built with Electron and consists of several key modules:

- **Screen Capture**: Periodically captures screenshots with intelligent filtering
- **Audio Recorder**: Records audio with silence detection
- **Web History**: Tracks web browsing activity
- **App Monitor**: Monitors application usage
- **AI Integration**: Processes data with AI models for insights
- **Database**: Stores all captured data locally

## Configuration

BlackBox AI can be configured through the Settings page in the application. Key settings include:

- Recording intervals
- Storage limits
- AI provider configuration
- Privacy controls
- Encryption settings

## Privacy & Security

BlackBox AI is designed with privacy in mind:

- All data is stored locally on your device
- Optional encryption for sensitive data
- Granular privacy controls to exclude specific applications or websites
- No data is sent to external servers without explicit permission

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Electron framework
- OpenAI and Google Gemini for AI capabilities
- All open-source libraries used in this project
