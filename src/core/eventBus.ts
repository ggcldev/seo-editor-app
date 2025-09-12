import type { Heading } from './outlineParser';

export type AppEvents = {
  'outline:computed': { headings: Heading[]; version: number };
  'outline:active': { id: string | null; offset: number | null; source?: 'scroll' | 'outline' | 'click' | 'keyboard' };
  'nav:jump': { offset: number; source: 'outline' | 'search' | 'toc' };
  'scrollspy:state': { flying: boolean; target?: number };
  'outline:request': Record<string, never>;
  'ai:mode:toggle': Record<string, never>;
  'ai:mode:state': { enabled: boolean };
  'ai:prompt:open': { initial?: string };
  'ai:prompt:submit': { prompt: string };
  'command:run': { id: string; args?: Record<string, unknown> };
};

export type Unsub = () => void;

export function createEventBus<T extends Record<string, unknown>>() {
  // Map event names to their listener sets
  const map = new Map<keyof T, Set<(p: unknown) => void>>();

  return {
    // Subscribe to an event with type-safe payload handling
    on<K extends keyof T>(k: K, fn: (p: T[K]) => void): Unsub {
      // Get or create listener set for this event type
      const set = map.get(k) ?? (map.set(k, new Set()), map.get(k)!);
      // Type-erase the listener function for storage (maintains runtime safety)
      const erased = (payload: unknown) => fn(payload as T[K]);
      set.add(erased);
      return () => set.delete(erased); // Return unsubscribe function
    },

    // Emit an event to all registered listeners
    emit<K extends keyof T>(k: K, payload: T[K]): void {
      map.get(k)?.forEach(listener => listener(payload));
    },

    // Clear all event listeners (useful for cleanup)
    clear(): void {
      map.clear();
    }
  };
}