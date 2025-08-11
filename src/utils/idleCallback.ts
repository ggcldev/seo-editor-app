export function idleCallback(cb: () => void, timeout = 200) {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(cb, { timeout });
  } else {
    return setTimeout(cb, timeout);
  }
}

export function cancelIdleCallback(id: number) {
  if ('cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}