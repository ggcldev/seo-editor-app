// src/core/eventBus.ts
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
  type Handler<K extends keyof T> = (p: T[K]) => void;
  const map = new Map<keyof T, Set<Handler<any>>>();

  return {
    on<K extends keyof T>(k: K, fn: Handler<K>): Unsub {
      const set = (map.get(k) ?? (map.set(k, new Set()), map.get(k)!)) as Set<Handler<K>>;
      set.add(fn);
      return () => set.delete(fn);
    },
    emit<K extends keyof T>(k: K, payload: T[K]): void {
      const set = map.get(k) as Set<Handler<K>> | undefined;
      set?.forEach(fn => fn(payload));
    },
    clear(): void { map.clear(); }
  };
}