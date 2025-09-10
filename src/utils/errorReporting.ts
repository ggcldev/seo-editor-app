// Global error handling and reporting utilities

interface ErrorReport {
  message: string;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  type: 'error' | 'unhandledrejection' | 'chunk-load-error';
  source?: string;
  line?: number;
  column?: number;
}

class ErrorReporter {
  private errors: ErrorReport[] = [];
  private maxErrors = 10; // Limit stored errors to prevent memory issues

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'error',
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        type: 'unhandledrejection'
      });
    });

    // Handle chunk loading errors (common in code-split apps)
    window.addEventListener('error', (event) => {
      if (event.target && 'src' in event.target && typeof event.target.src === 'string') {
        const isChunkLoadError = event.target.src.includes('.js') && event.type === 'error';
        if (isChunkLoadError) {
          this.reportError({
            message: `Chunk load failed: ${event.target.src}`,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            type: 'chunk-load-error',
            source: event.target.src
          });

          // Attempt to reload the page to recover from chunk errors
          if (confirm('The application needs to reload to recover from an error. Reload now?')) {
            window.location.reload();
          }
        }
      }
    }, true);
  }

  private reportError(errorReport: ErrorReport) {
    console.error('Global error caught:', errorReport);

    // Store error in memory
    this.errors.push(errorReport);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift(); // Remove oldest error
    }

    // Store in localStorage for debugging
    try {
      localStorage.setItem('app-errors', JSON.stringify(this.errors));
    } catch {
      // Ignore localStorage errors
    }

    // In production, you would send to an error reporting service
    if (process.env['NODE_ENV'] === 'production') {
      this.sendToErrorService(errorReport);
    }
  }

  private sendToErrorService(_errorReport: ErrorReport) {
    // Example: Send to Sentry, LogRocket, or your own error service
    // This is a placeholder - implement based on your error reporting needs
    
    try {
      // Example API call (commented out as it's implementation-specific):
      // fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // }).catch(() => {
      //   // Ignore errors when reporting errors to avoid infinite loops
      // });
    } catch {
      // Silently fail to avoid infinite error loops
    }
  }

  getErrors(): ErrorReport[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
    try {
      localStorage.removeItem('app-errors');
    } catch {
      // Ignore localStorage errors
    }
  }
}

// Global error reporter instance
export const errorReporter = new ErrorReporter();

// Development-only error debugging helper
export function logErrorHistory() {
  if (process.env['NODE_ENV'] === 'development') {
    console.group('Error History');
    errorReporter.getErrors().forEach((error, index) => {
      console.error(`${index + 1}.`, error);
    });
    console.groupEnd();
  }
}

// Add to window for debugging in development
if (process.env['NODE_ENV'] === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).errorReporter = errorReporter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).logErrorHistory = logErrorHistory;
}