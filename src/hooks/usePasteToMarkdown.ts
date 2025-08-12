import { useMemo } from 'react';
import TurndownService from 'turndown';

export function usePasteToMarkdown() {
  const turndown = useMemo(() => {
    const td = new TurndownService({ headingStyle: 'atx' });
    td.addRule('fontSizeHeadingsPxPt', {
      filter: (node: Node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.nodeName !== 'P') return false;
        const style = (node as HTMLElement).getAttribute('style') || '';
        return /font-size\s*:\s*\d+(?:\.\d+)?(px|pt)/i.test(style);
      },
      replacement: (content: string, node: Node) => {
        const style = (node as HTMLElement).getAttribute('style') || '';
        const m = style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt)/i);
        const value = m ? parseFloat(m[1]) : 0;
        const unit = m ? m[2].toLowerCase() : 'px';
        const px = unit === 'pt' ? value * (96 / 72) : value;
        let hashes = '';
        if (px >= 28) hashes = '#';
        else if (px >= 20) hashes = '##';
        else if (px >= 16) hashes = '###';
        if (hashes) return `\n${hashes} ${content.trim()}\n\n`;
        return `\n\n${content}\n\n`;
      },
    });
    td.addRule('dropStrong', {
      filter: (node: Node) => node && (node.nodeName === 'STRONG' || node.nodeName === 'B'),
      replacement: (content: string) => content,
    });
    td.addRule('dropEmphasis', {
      filter: (node: Node) => node && (node.nodeName === 'EM' || node.nodeName === 'I'),
      replacement: (content: string) => content,
    });
    td.addRule('dropBoldStyleSpans', {
      filter: (node: Node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = (node as HTMLElement).getAttribute('style') || '';
        return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
      },
      replacement: (content: string) => content,
    });
    return td;
  }, []);

  const htmlToMarkdown = (html: string): string => {
    return turndown
      .turndown(html)
      .replace(/^\*\*(.+)\*\*$/gm, '$1')
      .replace(/^\*(.+)\*$/gm, '$1');
  };

  return { htmlToMarkdown };
}

