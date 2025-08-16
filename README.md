# SEO Editor

A scalable Markdown editor with EventBus architecture, real-time outline navigation, and intelligent scroll synchronization.

## What is this?

A modern web-based Markdown editor built with React, TypeScript, and CodeMirror 6. Features a service-oriented architecture with EventBus communication for maximum scalability and maintainability.

## Features

- **EventBus Architecture** - Decoupled service communication for scalability
- **Real-time editing** - Live Markdown rendering and editing
- **Smart outline** - Auto-generated document outline with O(1) lookups
- **Intelligent scroll sync** - Target-aware scroll suppression prevents conflicts
- **Performance optimized** - OutlineIndex with binary search and level indexing
- **Responsive design** - Works on desktop and mobile devices
- **Clean interface** - Distraction-free writing environment

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