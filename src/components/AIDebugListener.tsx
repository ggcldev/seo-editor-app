import { useEffect } from 'react';
import { useBus } from '@/core/BusContext';

// Simple component to test AI events in the console
export function AIDebugListener() {
  const bus = useBus();

  useEffect(() => {
    const unsubscribers = [
      bus.on('ai:mode:toggle', () => console.log('🤖 AI mode toggled')),
      bus.on('ai:mode:state', ({ enabled }) => console.log(`🤖 AI mode state: ${enabled ? 'ENABLED' : 'DISABLED'}`)),
      bus.on('ai:prompt:open', ({ initial }) => console.log('🤖 AI prompt open:', initial || '(empty)')),
      bus.on('ai:prompt:submit', ({ prompt }) => console.log('🤖 AI prompt submit:', prompt)),
      bus.on('command:run', ({ id, args }) => console.log('🤖 Command run:', id, args)),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [bus]);

  return null; // This component doesn't render anything
}