export interface TextMetrics {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingTime: number; // in minutes
}

// Optimized metrics calculation with faster algorithms
export function calculateMetrics(text: string): TextMetrics {
  if (!text || text.length === 0) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      paragraphs: 0,
      readingTime: 0
    };
  }

  const characters = text.length;
  
  // Fast word count - count non-whitespace runs instead of splitting
  let words = 0;
  let inWord = false;
  let charactersNoSpaces = 0;
  let paragraphs = 1; // Start with 1, increment on double newlines
  let consecutiveNewlines = 0;
  
  for (let i = 0; i < characters; i++) {
    const char = text[i];
    
    if (char === '\n') {
      consecutiveNewlines++;
      if (consecutiveNewlines >= 2) {
        paragraphs++;
        consecutiveNewlines = 0; // Reset to avoid counting multiple consecutive newlines
      }
      if (inWord) {
        words++;
        inWord = false;
      }
    } else if (char === ' ' || char === '\t' || char === '\r') {
      consecutiveNewlines = 0;
      if (inWord) {
        words++;
        inWord = false;
      }
    } else {
      consecutiveNewlines = 0;
      charactersNoSpaces++;
      if (!inWord) {
        inWord = true;
      }
    }
  }
  
  // Count the last word if text doesn't end with whitespace
  if (inWord) {
    words++;
  }
  
  // Ensure at least 1 paragraph if there's content
  if (paragraphs === 0 && charactersNoSpaces > 0) {
    paragraphs = 1;
  }
  
  // Reading time - average 200 words per minute, minimum 1 minute
  const readingTime = Math.max(1, Math.ceil(words / 200));
  
  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs,
    readingTime
  };
}

// Throttled version for real-time updates with adaptive performance
let throttleTimeout: number | null = null;
let lastResult: TextMetrics = { words: 0, characters: 0, charactersNoSpaces: 0, paragraphs: 0, readingTime: 0 };

export function calculateMetricsThrottled(text: string, callback: (metrics: TextMetrics) => void): void {
  // For very short texts, calculate immediately
  if (text.length < 100) {
    const result = calculateMetrics(text);
    lastResult = result;
    callback(result);
    return;
  }
  
  // For longer texts, throttle the calculation
  if (throttleTimeout) {
    clearTimeout(throttleTimeout);
  }
  
  throttleTimeout = window.setTimeout(() => {
    const result = calculateMetrics(text);
    lastResult = result;
    callback(result);
    throttleTimeout = null;
  }, 150); // 150ms throttle for smoother typing
}

export function getLastMetrics(): TextMetrics {
  return lastResult;
}

export function cancelMetricsThrottle(): void {
  if (throttleTimeout) {
    clearTimeout(throttleTimeout);
    throttleTimeout = null;
  }
}