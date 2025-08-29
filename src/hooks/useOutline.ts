// hooks/useOutline.ts
import { useMemo } from "react";
import { makeHeadingIdStable } from "../utils/ids";

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
 */
export function useOutline(markdown: string): Heading[] {
  return useMemo(() => {
    const out: Heading[] = [];
    const seen = new Map<string, number>(); // Track slug usage for stable de-duplication
    const len = markdown.length;

    let i = 0;
    let inFence: null | { fence: string } = null;

    // Precompute line starts for efficient scanning
    while (i <= len) {
      // Find end of current line
      let lineEnd = markdown.indexOf("\n", i);
      if (lineEnd === -1) lineEnd = len;

      const line = markdown.slice(i, lineEnd);
      const trimmed = line.trimEnd();

      // Fence detection: ``` or ~~~ start/end (ignore language)
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        if (!inFence) {
          inFence = { fence: fenceMatch[2] };
        } else if (line.startsWith(inFence.fence)) {
          inFence = null; // closing fence
        }
        // Advance
        i = lineEnd + 1;
        continue;
      }

      if (!inFence) {
        // ATX headings: ^\s*#{1,6}\s+Title [###]?
        const atx = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (atx) {
          const level = Math.min(6, atx[1].length);
          const text = atx[2].trim();
          const offset = i; // start of the line
          out.push({
            id: makeHeadingIdStable(text, seen),
            text,
            level,
            offset
          });
        } else {
          // Setext: a non-empty line followed by === or --- (next line)
          // Only detect if current line has non-whitespace
          if (trimmed.length > 0) {
            // lookahead next line
            const nextStart = lineEnd + 1;
            if (nextStart <= len) {
              let nextEnd = markdown.indexOf("\n", nextStart);
              if (nextEnd === -1) nextEnd = len;
              const nextLine = markdown.slice(nextStart, nextEnd);
              const setext = nextLine.match(/^\s*(=+|-+)\s*$/);
              if (setext) {
                const isEq = setext[1][0] === "=";
                const level = isEq ? 1 : 2;
                const text = trimmed;
                const offset = i;
                out.push({
                  id: makeHeadingIdStable(text, seen),
                  text,
                  level,
                  offset
                });
                // Skip the underline line
                i = nextEnd + 1;
                continue; // continue outer loop
              }
            }
          }
        }
      }

      // Advance to next line
      i = lineEnd + 1;
    }

    return out;
  }, [markdown]);
}