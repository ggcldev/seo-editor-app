import { useMemo } from 'react';
import { toId } from '../utils/ids';

export type Heading = { level: 1 | 2 | 3; text: string; id: string; offset: number };

export function useOutline(markdown: string): Heading[] {
  return useMemo(() => extractHeadings(markdown), [markdown]);
}

export function extractHeadings(md: string): Heading[] {
  if (!md.trim()) return [];
  const lines = md.split(/\r?\n/);
  const items: Heading[] = [];
  let offset = 0;

  const clean = (s: string) => s.replace(/[#*_`~[\]()]/g, '').trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = line.match(/^(#{1,3})\s+(.+)$/);
    const next = lines[i + 1] || '';

    if (atx) {
      const text = clean(atx[2]);
      if (text) items.push({ level: atx[1].length as 1|2|3, text, id: toId(text), offset });
      offset += line.length + 1;
      continue;
    }

    const text = clean(line);
    if (/^=+\s*$/.test(next) && text) {
      items.push({ level: 1, text, id: toId(text), offset });
      offset += line.length + 1; // title line
      i++;
      offset += (lines[i]?.length ?? 0) + 1; // underline
      continue;
    }
    if (/^-+\s*$/.test(next) && text) {
      items.push({ level: 2, text, id: toId(text), offset });
      offset += line.length + 1;
      i++;
      offset += (lines[i]?.length ?? 0) + 1;
      continue;
    }

    offset += line.length + 1;
  }

  return items;
}


