import { useMemo } from 'react';
import { toId } from '../utils/ids';

export type Heading = { level: 1 | 2 | 3; text: string; id: string };

export function useOutline(markdown: string): Heading[] {
  return useMemo(() => extractHeadings(markdown), [markdown]);
}

export function extractHeadings(md: string): Heading[] {
  if (!md.trim()) return [];
  const lines = md.split(/\r?\n/);
  const items: Heading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atx = line.match(/^(#{1,3})\s+(.+)$/);
    if (atx) {
      const level = atx[1].length as 1 | 2 | 3;
      const text = atx[2].replace(/[#*_`~]/g, '').trim();
      if (text) items.push({ level, text, id: toId(text) });
      continue;
    }
    const next = lines[i + 1] || '';
    if (/^=+\s*$/.test(next)) {
      const text = line.replace(/[#*_`~]/g, '').trim();
      if (text) items.push({ level: 1, text, id: toId(text) });
      i++;
      continue;
    }
    if (/^-+\s*$/.test(next)) {
      const text = line.replace(/[#*_`~]/g, '').trim();
      if (text) items.push({ level: 2, text, id: toId(text) });
      i++;
      continue;
    }
  }
  return items;
}


