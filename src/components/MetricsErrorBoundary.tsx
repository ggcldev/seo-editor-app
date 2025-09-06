import { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function MetricsErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Metrics error:', error, errorInfo);
      }}
      fallback={
        <div style={{
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#856404',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>Metrics unavailable</span>
        </div>
      }
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}