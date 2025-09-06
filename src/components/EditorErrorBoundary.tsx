import { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function EditorErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // In production, you might want to send this to an error reporting service
        console.error('Editor error:', error, errorInfo);
      }}
      fallback={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#fafafa',
          border: '1px dashed #ccc'
        }}>
          <div style={{
            fontSize: '24px',
            color: '#666'
          }}>
            📝
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>
              Editor Unavailable
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              The editor encountered an error. Please refresh the page.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Refresh Page
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}