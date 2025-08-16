// src/core/BusContext.tsx
import { createContext, useContext } from 'react';
import type { AppEvents } from './eventBus';
import { createEventBus } from './eventBus';

export const BusContext = createContext<ReturnType<typeof createEventBus<AppEvents>> | null>(null);

export const useBus = () => {
  const bus = useContext(BusContext);
  if (!bus) throw new Error('BusContext missing');
  return bus;
};