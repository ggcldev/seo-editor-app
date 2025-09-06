# SEO Content Editor

A modern, fast, and intuitive markdown editor built specifically for SEO content creation and optimization.

## What is this?

A modern web-based Markdown editor built with React, TypeScript, and CodeMirror 6. Features a service-oriented architecture with EventBus communication for maximum scalability and maintainability.

## Features

- **Real-time Markdown Editor** with syntax highlighting powered by CodeMirror 6
- **Live Document Outline** with clickable navigation and scroll synchronization  
- **Content Metrics** showing word count, character count, reading time, and paragraph count
- **EventBus Architecture** for decoupled service communication and scalability
- **Performance Optimized** with binary search navigation and throttled calculations
- **Production Ready** with comprehensive error boundaries and 47+ test cases
- **Responsive Design** with adjustable pane widths and mobile-friendly layout
- **SEO-Focused** metrics and analysis tools

## Architecture

### Core Services

- **EventBus** (`src/core/eventBus.ts`) - Typed event system for decoupled communication
- **OutlineIndex** (`src/core/outlineCore.ts`) - O(1) heading lookups with binary search
- **ScrollSync** (`src/core/scrollSync.ts`) - Target-aware scroll suppression
- **Worker RPC** (`src/core/rpc.ts`) - Versioned worker communication protocol

### Event System

```typescript
type AppEvents = {
  'outline:computed': { headings: Heading[]; version: number };
  'outline:active': { id: string | null; offset: number | null };
  'nav:jump': { offset: number; source: 'outline' | 'search' | 'toc' };
  'scrollspy:state': { flying: boolean; target?: number };
  'outline:request': {};
};
```

## Project Structure

```
src/
├── components/         # React components
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── styles/            # Global styles
├── extensions/        # CodeMirror extensions
└── core/              # EventBus architecture services
    ├── eventBus.ts    # Typed event system
    ├── BusContext.tsx # React Context wrapper
    ├── outlineCore.ts # O(1) outline operations
    ├── scrollSync.ts  # Target-aware suppression
    └── rpc.ts         # Worker RPC protocol
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ggcldev/seo-editor-app.git
cd seo-editor
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## Technical Details

### Key Technologies
- **React 19** with TypeScript for type-safe component development
- **CodeMirror 6** for advanced text editing capabilities
- **Vite 7** for fast development and optimized production builds
- **Vitest** for comprehensive testing with 47 passing tests

### Quality Assurance
- **47 Test Cases** covering core algorithms and edge cases
- **TypeScript Strict Mode** for maximum type safety
- **Error Boundaries** at component and application levels
- **Global Error Handling** for unhandled exceptions

## Browser Support

Modern browsers with ES2020+ support:
- Chrome 88+
- Firefox 84+  
- Safari 14+
- Edge 88+

## Roadmap

### 🤖 AI Integration (Planned)

The SEO Content Editor is being designed with AI integration in mind. Future versions will include:

#### User-Configurable AI Models
- **Provider Flexibility**: Support for OpenAI, Anthropic, local models (Ollama), and custom APIs
- **Privacy-First**: Users control their own API keys and data
- **Cost Control**: Users pay for their own AI usage
- **Secure Configuration**: Encrypted storage of API credentials

#### AI Features Planned
- **Real-time Content Suggestions** while typing
- **SEO Optimization Recommendations** based on content analysis
- **Grammar and Style Improvements** with contextual suggestions
- **Content Structure Analysis** and outline recommendations
- **Automated Heading Generation** based on content flow
- **Smart Completions** integrated with CodeMirror editor

#### Technical Implementation
```typescript
// AI Provider Architecture
interface AIProvider {
  id: string;
  name: string;
  configure(config: AIConfig): Promise<void>;
  generateText(prompt: string): AsyncIterable<string>;
  analyzeContent(content: string): Promise<AIAnalysis>;
}

// Supported Providers
type AIProviderType = 'openai' | 'anthropic' | 'local' | 'custom';
```

#### Integration Points
- **Event Bus System**: Ready for AI communication
- **Error Boundaries**: Will contain AI failures gracefully
- **Text Pipeline**: Real-time content analysis infrastructure in place
- **Modular Architecture**: Easy addition of AI panels and features

#### Privacy & Security
- **Local-Only Processing**: Option for Ollama/local models
- **User-Controlled Data**: No data sent without explicit permission
- **Flexible Configuration**: Support for on-premises AI solutions
- **Opt-Out Available**: All AI features completely optional

The current architecture provides an excellent foundation for AI integration while maintaining user privacy and choice.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `npm run test:run`
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.