// src/core/eventBus.ts
import type { Heading } from '../hooks/useOutline';

export type AppEvents = {
  'outline:computed': { headings: Heading[]; version: number };
  'outline:active': { id: string | null; offset: number | null };
  'nav:jump': { offset: number; source: 'outline' | 'search' | 'toc' };
  'scrollspy:state': { flying: boolean; target?: number };
  'outline:request': {};
};

export type Unsub = () => void;

export function createEventBus<T extends Record<string, any>>() {
  const map = new Map<keyof T, Set<(p: any) => void>>();
  return {
    on<K extends keyof T>(k: K, fn: (p: T[K]) => void): Unsub {
      const set = map.get(k) ?? (map.set(k, new Set()), map.get(k)!);
      set.add(fn);
      return () => set.delete(fn);
    },
    emit<K extends keyof T>(k: K, payload: T[K]) {
      map.get(k)?.forEach(fn => fn(payload));
    },
    clear() { map.clear(); }
  };
}