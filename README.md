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
├── core/               # EventBus architecture services
│   ├── eventBus.ts    # Typed event system
│   ├── BusContext.tsx # React Context wrapper
│   ├── outlineCore.ts # O(1) outline operations
│   └── scrollSync.ts  # Target-aware suppression
├── utils/              # Utility functions
├── workers/            # Web workers
└── test/               # Test setup and utilities
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ggcldev/seo-editor-app.git
cd seo-editor-app
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

## AI Integration

### 🤖 Inline AI Assistance

The editor includes a powerful, extensible AI provider system with streaming support.

#### Current Features
- **Inline AI Prompts** - Type `/ai-mode` to open AI prompt at cursor
- **Slash Commands** - Quick access with `/ai-prompt`, `/h1`, `/h2`, `/h3`
- **Real-time Streaming** - See AI responses appear as they're generated
- **Provider System** - Pluggable architecture for multiple AI services

#### Supported AI Providers

##### Mock Provider (Default)
```typescript
// No API key needed - for testing and demo purposes
// Automatically echoes prompts with sample text
```

##### OpenAI
```typescript
import { aiRegistry, OpenAIProvider } from '@/services/aiProviders';

// Configure OpenAI provider
aiRegistry.register(new OpenAIProvider({
  id: 'openai',
  name: 'OpenAI',
  apiKey: 'sk-...',
  model: 'gpt-4o',  // or 'gpt-4o-mini', 'gpt-3.5-turbo'
  enabled: true
}));

aiRegistry.setDefault('openai');
```

##### Anthropic (Claude)
```typescript
import { aiRegistry, AnthropicProvider } from '@/services/aiProviders';

// Configure Anthropic provider
aiRegistry.register(new AnthropicProvider({
  id: 'anthropic',
  name: 'Anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-3-5-sonnet-20241022',  // or other Claude models
  enabled: true
}));

aiRegistry.setDefault('anthropic');
```

#### Using AI in the Editor

1. **Type `/` in the editor** to see available commands
2. **Select `/ai-mode`** to open inline prompt
3. **Type your request** and press Enter
4. **Watch the AI response stream** directly into your document

#### Custom AI Providers

You can add custom providers by implementing the `AIProvider` interface:

```typescript
import { AIProvider, StreamChunk, aiRegistry } from '@/services/aiProviders';

class CustomAIProvider implements AIProvider {
  id = 'custom';
  name = 'My Custom AI';

  async *stream(prompt: string): AsyncGenerator<StreamChunk, void, void> {
    // Your custom streaming implementation
    const response = await fetch('https://your-api.com/stream', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });

    // Stream chunks back
    for await (const chunk of parseYourStream(response)) {
      yield { text: chunk };
    }
  }
}

// Register your provider
aiRegistry.register(new CustomAIProvider());
```

#### Event Bus Integration

The AI system uses the EventBus for communication:

```typescript
// Request AI stream
bus.emit('ai:stream:request', {
  id: 'unique-id',
  prompt: 'Your prompt',
  providerId: 'openai'  // Optional, uses default if not specified
});

// Listen for stream events
bus.on('ai:stream:start', ({ id }) => { /* Stream started */ });
bus.on('ai:stream:chunk', ({ id, text }) => { /* New chunk */ });
bus.on('ai:stream:done', ({ id }) => { /* Stream complete */ });
bus.on('ai:stream:error', ({ id, message }) => { /* Handle error */ });
```

#### Privacy & Security
- **User-Controlled API Keys**: You manage your own credentials
- **No Data Storage**: API keys and requests stay in your browser
- **Provider Choice**: Use OpenAI, Anthropic, or your own AI service
- **Opt-In System**: Mock provider by default, real APIs require configuration

#### Roadmap
- [ ] **Settings Panel** for easy AI provider configuration
- [ ] **Multiple Active Providers** - switch providers per request
- [ ] **Custom Slash Commands** - define your own AI shortcuts
- [ ] **Ollama Support** - local AI models without cloud APIs
- [ ] **Advanced Prompts** - pre-configured templates for SEO tasks
- [ ] **Content Analysis** - AI-powered SEO suggestions and improvements

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