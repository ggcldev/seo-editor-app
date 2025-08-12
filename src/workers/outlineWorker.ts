// workers/outlineWorker.ts
export type WHeading = { level: 1|2|3|4|5|6; text: string; offset: number };

// Pre-compiled regex patterns for better performance
const ATX_PATTERN = /^(#{1,6})\s+(.+)$/;
const SETEXT_H1_PATTERN = /^=+\s*$/;
const SETEXT_H2_PATTERN = /^-+\s*$/;

// Optimized markdown cleaning function
const clean = (s: string): string => {
  // Single-pass cleaning with more efficient regex
  return s
    .replace(/(\*\*(.*?)\*\*|\*(.*?)\*|`(.*?)`|~~(.*?)~~|\[(.*?)\]\([^)]*\)|!\[(.*?)\]\([^)]*\))/g, 
      (_match, _full, bold, italic, code, strike, linkText, imgAlt) => 
        bold || italic || code || strike || linkText || imgAlt || '')
    .replace(/#+\s*$/, '') // trailing ###
    .trim();
};

self.onmessage = (e: MessageEvent<string>) => {
  const md = e.data || "";
  if (!md.trim()) { 
    postMessage([]); 
    return; 
  }

  // Normalize line endings once
  const normalizedMd = md.replace(/\r\n/g, "\n");
  const lines = normalizedMd.split("\n");
  const out: WHeading[] = [];
  let offset = 0;
  let fenced = false; // Track if we're inside a fenced code block

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    const trimmed = line.trim();
    
    // Check for fenced code block markers
    if (trimmed.startsWith('```')) {
      fenced = !fenced;
      offset += lineLength;
      continue;
    }
    
    // Skip heading detection inside fenced code blocks
    if (fenced) {
      offset += lineLength;
      continue;
    }
    
    // Check ATX headers (# ## ### etc)
    const atx = ATX_PATTERN.exec(line);
    if (atx) {
      const level = Math.max(1, Math.min(6, atx[1].length)) as WHeading["level"];
      const text = clean(atx[2]);
      if (text) {
        out.push({ level, text, offset });
      }
      offset += lineLength;
      continue;
    }

    // Check setext headers (underlined with = or -)
    const next = lines[i + 1];
    if (next) {
      const text = clean(line);
      if (text) {
        if (SETEXT_H1_PATTERN.test(next)) {
          out.push({ level: 1, text, offset });
          offset += lineLength + next.length + 1; // Skip both lines
          i++; 
          continue;
        }
        if (SETEXT_H2_PATTERN.test(next)) {
          out.push({ level: 2, text, offset });
          offset += lineLength + next.length + 1; // Skip both lines
          i++;
          continue;
        }
      }
    }
    
    offset += lineLength;
  }

  postMessage(out);
};