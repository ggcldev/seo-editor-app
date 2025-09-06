import type { Heading } from './outlineParser';

export type AppEvents = {
  'outline:computed': { headings: Heading[]; version: number };
  'outline:active': { id: string | null; offset: number | null; source?: 'scroll' | 'outline' | 'click' | 'keyboard' };
  'nav:jump': { offset: number; source: 'outline' | 'search' | 'toc' };
  'scrollspy:state': { flying: boolean; target?: number };
  'outline:request': Record<string, never>;
};

export type Unsub = () => void;

export function createEventBus<T extends Record<string, unknown>>() {
  const map = new Map<keyof T, Set<(p: unknown) => void>>();

  return {
    on<K extends keyof T>(k: K, fn: (p: T[K]) => void): Unsub {
      const set = map.get(k) ?? (map.set(k, new Set()), map.get(k)!);
      const erased = (payload: unknown) => fn(payload as T[K]);
      set.add(erased);
      return () => set.delete(erased);
    },

    emit<K extends keyof T>(k: K, payload: T[K]): void {
      map.get(k)?.forEach(listener => listener(payload));
    },

    clear(): void {
      map.clear();
    }
  };
}