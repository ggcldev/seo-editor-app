import { useEffect, useState } from 'react';
import { useBus } from '@/core/BusContext';

export function AIStateBridge() {
  const bus = useBus();
  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem('aiEnabled') === 'true');

  useEffect(() => {
    const off = bus.on('ai:mode:toggle', () => setAiEnabled(v => !v));
    return () => off();
  }, [bus]);

  useEffect(() => {
    localStorage.setItem('aiEnabled', String(aiEnabled));
    bus.emit('ai:mode:state', { enabled: aiEnabled });
  }, [aiEnabled, bus]);

  return null;
}