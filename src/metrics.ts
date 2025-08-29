import { normalizeEOL } from './utils/eol';

export interface TextMetrics {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingTime: number; // minutes, 1 decimal
}

export interface MetricsOptions {
  wordsPerMinute?: number; // default 200
}

export function calculateMetrics(text: string, opts: MetricsOptions = {}): TextMetrics {
  const wpm = Math.max(60, Math.min(400, opts.wordsPerMinute ?? 200));

  // Normalize all line endings and Unicode separators
  const t = normalizeEOL(text).replace(/\u2028|\u2029/g, '\n');
  const characters = t.length;

  let words = 0, inWord = false, charactersNoSpaces = 0;
  for (let i = 0; i < characters; i++) {
    const ch = t.charCodeAt(i);
    const isSpace = ch === 32 || ch === 10 || ch === 9 || ch === 13 || ch === 160;
    if (!isSpace) charactersNoSpaces++;
    if (isSpace) {
      if (inWord) { words++; inWord = false; }
    } else {
      inWord = true;
    }
  }
  if (inWord) words++;

  // Paragraphs = blocks separated by 2+ newlines
  const paragraphs = t.trim().length
    ? t.split(/\n{2,}/).length
    : 0;

  const minutes = Math.max(0, Math.round((words / wpm) * 10) / 10);

  return { words, characters, charactersNoSpaces, paragraphs, readingTime: minutes };
}

// Throttled version with trailing-invoke
let throttleId: number | null = null;
let pendingArgs: [string, MetricsOptions, (m: TextMetrics) => void] | null = null;
let lastResult: TextMetrics = { words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, readingTime: 0 };

export function calculateMetricsThrottled(
  text: string,
  callback: (m: TextMetrics) => void,
  opts: MetricsOptions = {},
  wait = 150
): void {
  pendingArgs = [text, opts, callback];
  if (throttleId != null) return;

  throttleId = window.setTimeout(() => {
    if (pendingArgs) {
      const [tx, options, cb] = pendingArgs;
      pendingArgs = null;
      const res = (lastResult = calculateMetrics(tx, options));
      cb(res);
    }
    throttleId = null;
  }, wait);
}

export function getLastMetrics(): TextMetrics {
  return lastResult;
}

export function cancelMetricsThrottle(): void {
  if (throttleId != null) { 
    clearTimeout(throttleId); 
    throttleId = null; 
  }
  pendingArgs = null;
}