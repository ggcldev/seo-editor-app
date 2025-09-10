const SAFE_PREFIX = 'seo-editor';
const SAFE_LIMIT_BYTES = 1_000_000; // ~1MB cap

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(`${SAFE_PREFIX}:${key}`);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    if (value.length > SAFE_LIMIT_BYTES) return;
    localStorage.setItem(`${SAFE_PREFIX}:${key}`, value);
  } catch {
    // ignore quota errors
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(`${SAFE_PREFIX}:${key}`);
  } catch {
    // ignore
  }
}