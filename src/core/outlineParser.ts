// src/core/outlineParser.ts
import { normalizeEOL } from '../utils/eol';
import { makeHeadingIdStable } from '../utils/ids';

export type Heading = {
  id: string;
  text: string;
  level: number;   // 1..6
  offset: number;  // absolute char index of the heading line start
};

/**
 * Parse Markdown headings (ATX # and Setext =/-) into a flat outline.
 * - Offsets are exact char positions in the source string, used for id uniqueness.
 * - Setext underlines produce level 1 (=) or level 2 (-) headings.
 * - Fenced code blocks are ignored so leading '#' in code doesn't create headings.
 * - Uses normalizeEOL to ensure consistent offsets across platforms.
 */
export function parseOutline(markdownInput: string): Heading[] {
  // Circuit breaker: Prevent memory exhaustion on extremely large documents
  if (markdownInput.length > 50_000_000) { // 50MB limit
    console.warn('Document too large for outline parsing (>50MB), outline disabled');
    return [];
  }
  
  const markdown = normalizeEOL(markdownInput);
  const out: Heading[] = [];
  const seen = new Map<string, number>(); // Track slug usage for stable de-duplication
  const len = markdown.length;

  let i = 0;
  let inFence: null | { char: '`' | '~'; len: number } = null;

  while (i <= len) {
    // Find end of current line
    let lineEnd = markdown.indexOf('\n', i);
    if (lineEnd === -1) lineEnd = len; // Handle last line without newline

    const line = markdown.slice(i, lineEnd);
    const trimmed = line.trimEnd();

    // Fence detection: ``` or ~~~ start/end (ignore language specifier)
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inFence) {
        // Opening fence - start ignoring heading markers
        const fenceStr = fenceMatch[2];
        inFence = { char: (fenceStr[0] as '`' | '~'), len: fenceStr.length };
      } else {
        // Allow closing fence with leading spaces and length >= opening
        const trimmed = line.trimStart();
        const closeMatch = trimmed.match(/^(`{3,}|~{3,})/);
        if (closeMatch) {
          const closeStr = closeMatch[1];
          if (closeStr[0] === inFence.char && closeStr.length >= inFence.len) {
            inFence = null;
          }
        }
      }
      i = lineEnd + 1; // Skip to next line
      continue;
    }

    if (!inFence) {
      // ATX headings: ^\s*#{1,6}\s+Title [###]? (hash-style headings)
      const atx = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (atx) {
        const level = Math.min(6, atx[1].length); // Count # symbols, max 6
        const text = atx[2].trim(); // Extract heading text, remove whitespace
        const offset = i; // Character position of line start
        out.push({
          id: makeHeadingIdStable(text, seen),
          text,
          level,
          offset
        });
      } else {
        // Setext: a non-empty line followed by === or --- (underline-style headings)
        if (trimmed.length > 0) {
          // Look ahead to next line for potential underline
          const nextStart = lineEnd + 1;
          if (nextStart <= len) {
            let nextEnd = markdown.indexOf('\n', nextStart);
            if (nextEnd === -1) nextEnd = len; // Handle last line
            const nextLine = markdown.slice(nextStart, nextEnd);
            const setext = nextLine.match(/^\s*(=+|-+)\s*$/); // === for h1, --- for h2
            if (setext) {
              const isEq = setext[1][0] === '=';
              const level = isEq ? 1 : 2; // = makes h1, - makes h2
              const text = trimmed; // Current line is the heading text
              const offset = i;
              out.push({
                id: makeHeadingIdStable(text, seen),
                text,
                level,
                offset
              });
              // Skip the underline line since we've processed it
              i = nextEnd + 1;
              continue; // Jump to outer loop to avoid double-processing
            }
          }
        }
      }
    }

    // Advance to next line
    i = lineEnd + 1;
  }

  return out;
}