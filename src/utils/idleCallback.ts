export type IdleId = number;

export function idleCallback(cb: () => void, timeout = 200): IdleId {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback(cb, { timeout }) as IdleId;
  }
  // Fallback: DOM timers return number; cast for SSR builds
  return (setTimeout(cb, timeout) as unknown) as IdleId;
}

export function cancelIdleCallback(id: IdleId) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
  } else {
    clearTimeout(id as unknown as number);
  }
}