// src/core/BusContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { createEventBus } from './eventBus';
import type { AppEvents } from './eventBus';

export const BusContext = createContext<ReturnType<typeof createEventBus<AppEvents>> | null>(null);

export const BusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const bus = useMemo(() => createEventBus<AppEvents>(), []);
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};

export function useBus() {
  const bus = useContext(BusContext);
  if (!bus) throw new Error("useBus must be used within BusProvider");
  return bus;
}