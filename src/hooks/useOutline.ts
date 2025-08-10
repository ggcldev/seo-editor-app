import { useMemo } from 'react';
import { toId } from '../utils/ids';

export type Heading = { level: 1 | 2 | 3 | 4 | 5 | 6; text: string; id: string; offset: number };

export function useOutline(markdown: string): Heading[] {
  return useMemo(() => extractHeadings(markdown), [markdown]);
}

export function extractHeadings(md: string): Heading[] {
  if (!md.trim()) return [];
  const lines = md.split(/\r?\n/);
  const raw: Omit<Heading, 'id'>[] = [];
  let offset = 0;

  const clean = (s: string) => s.replace(/[#*_`~[\]()]/g, '').trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = line.match(/^(#{1,6})\s+(.+)$/);
    const next = lines[i + 1] || '';

    if (atx) {
      const text = clean(atx[2]);
      if (text) {
        const rawLevel = atx[1].length;
        const level = Math.max(1, Math.min(6, rawLevel)) as 1|2|3|4|5|6;
        raw.push({ level, text, offset });
      }
      offset += line.length + 1;
      continue;
    }

    const text = clean(line);
    if (/^=+\s*$/.test(next) && text) {
      raw.push({ level: 1, text, offset });
      offset += line.length + 1; // title line
      i++;
      offset += (lines[i]?.length ?? 0) + 1; // underline
      continue;
    }
    if (/^-+\s*$/.test(next) && text) {
      raw.push({ level: 2, text, offset });
      offset += line.length + 1;
      i++;
      offset += (lines[i]?.length ?? 0) + 1;
      continue;
    }

    offset += line.length + 1;
  }

  // De-duplicate IDs to prevent collisions
  const seen = new Map<string, number>();
  const items: Heading[] = raw.map(h => {
    const base = toId(h.text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    return { ...h, id };
  });

  return items;
}


