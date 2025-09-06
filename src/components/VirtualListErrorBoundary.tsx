import { type ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function VirtualListErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('VirtualList error:', error, errorInfo);
      }}
      fallback={
        <div style={{
          padding: '16px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '13px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          margin: '8px 0'
        }}>
          <div style={{ marginBottom: '8px' }}>📋</div>
          <div>List rendering failed</div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
            Try refreshing to restore the outline
          </div>
        </div>
      }
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}