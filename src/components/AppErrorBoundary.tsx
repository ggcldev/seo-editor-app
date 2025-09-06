import { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function AppErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, send to error reporting service (Sentry, LogRocket, etc.)
        console.error('Critical app error:', error, errorInfo);
        
        // Could also save error state to localStorage for debugging
        try {
          localStorage.setItem('lastError', JSON.stringify({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            componentStack: errorInfo.componentStack
          }));
        } catch (e) {
          // Ignore localStorage errors
        }
      }}
      fallback={
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '24px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            💥
          </div>
          <div>
            <h1 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '24px',
              fontWeight: '600',
              color: '#212529'
            }}>
              Something went wrong
            </h1>
            <p style={{ 
              margin: '0 0 32px 0',
              fontSize: '16px',
              color: '#6c757d',
              lineHeight: '1.5',
              maxWidth: '500px'
            }}>
              The application encountered an unexpected error and needs to restart.
              Your work may not be saved.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Restart Application
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: '1px solid #dee2e6',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear Data & Restart
            </button>
          </div>
          <details style={{ 
            fontSize: '12px', 
            color: '#868e96', 
            marginTop: '16px',
            textAlign: 'left'
          }}>
            <summary style={{ 
              cursor: 'pointer', 
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              Technical Details
            </summary>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '16px',
              fontFamily: 'Monaco, Menlo, monospace',
              fontSize: '11px',
              maxWidth: '600px',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              Check the browser console for detailed error information.
            </div>
          </details>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}