import { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function OutlineErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Outline error:', error, errorInfo);
      }}
      fallback={
        <div style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          textAlign: 'center',
          backgroundColor: '#fafafa',
          border: '1px solid #e1e5e9',
          borderRadius: '4px',
          margin: '10px'
        }}>
          <div style={{
            fontSize: '20px',
            marginBottom: '12px',
            color: '#666'
          }}>
            📋
          </div>
          <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>
            Outline Unavailable
          </h4>
          <p style={{ 
            margin: '0 0 16px 0', 
            color: '#666', 
            fontSize: '13px',
            lineHeight: '1.4'
          }}>
            The outline panel encountered an error.<br/>
            The document content is still available.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#495057',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reload
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}