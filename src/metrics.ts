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

/**
 * Calculates comprehensive text metrics including word count, character counts, 
 * paragraphs, and estimated reading time with performance optimizations.
 * 
 * Uses a single-pass character analysis algorithm for optimal performance on large texts.
 * Handles Unicode line separators and normalizes all line endings for consistent results.
 * 
 * @param text - Input text to analyze (markdown, plain text, etc.)
 * @param opts - Configuration options including words per minute for reading time
 * @returns Comprehensive metrics object with counts and reading time estimate
 * 
 * @example
 * ```typescript
 * const metrics = calculateMetrics("Hello world!\n\nSecond paragraph.", { wordsPerMinute: 250 });
 * // Returns: { words: 4, characters: 33, charactersNoSpaces: 29, paragraphs: 2, readingTime: 0.0 }
 * ```
 */
export function calculateMetrics(text: string, opts: MetricsOptions = {}): TextMetrics {
  // Clamp WPM to reasonable bounds (60-400 WPM)
  const wpm = Math.max(60, Math.min(400, opts.wordsPerMinute ?? 200));

  // Normalize all line endings and Unicode line/paragraph separators
  const t = normalizeEOL(text).replace(/\u2028|\u2029/g, '\n');
  const characters = t.length;

  // Single-pass character analysis for performance
  let words = 0, inWord = false, charactersNoSpaces = 0;
  for (let i = 0; i < characters; i++) {
    const ch = t.charCodeAt(i);
    // Check for common whitespace characters: space, newline, tab, CR, non-breaking space
    const isSpace = ch === 32 || ch === 10 || ch === 9 || ch === 13 || ch === 160;
    if (!isSpace) charactersNoSpaces++;
    if (isSpace) {
      if (inWord) { words++; inWord = false; } // End of word
    } else {
      inWord = true; // Start/continue word
    }
  }
  if (inWord) words++; // Handle final word if text doesn't end with whitespace

  // Paragraphs = blocks separated by 2+ consecutive newlines
  const paragraphs = t.trim().length
    ? t.split(/\n{2,}/).length
    : 0;

  // Reading time in minutes, rounded to 1 decimal place
  const minutes = Math.max(0, Math.round((words / wpm) * 10) / 10);

  return { words, characters, charactersNoSpaces, paragraphs, readingTime: minutes };
}

// Throttled version with trailing-invoke (debounced calculation for performance)
let throttleId: number | null = null;
let pendingArgs: [string, MetricsOptions, (m: TextMetrics) => void] | null = null;
let lastResult: TextMetrics = { words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, readingTime: 0 };

export function calculateMetricsThrottled(
  text: string,
  callback: (m: TextMetrics) => void,
  opts: MetricsOptions = {},
  wait = 150
): void {
  // Store most recent args to ensure latest state is processed
  pendingArgs = [text, opts, callback];
  if (throttleId != null) return; // Already waiting, will use latest args

  throttleId = window.setTimeout(() => {
    if (pendingArgs) {
      const [tx, options, cb] = pendingArgs;
      pendingArgs = null;
      const res = (lastResult = calculateMetrics(tx, options)); // Cache result
      cb(res);
    }
    throttleId = null; // Reset for next invocation
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