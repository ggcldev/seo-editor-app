import { useCallback, useEffect, useRef, useState } from 'react';
import type { Heading } from './useOutline';

export function useScrollSpy(markdown: string, outline: Heading[]) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const findActiveHeadingFromCaret = useCallback((textarea: HTMLTextAreaElement): string | null => {
    const caretPos = textarea.selectionStart;
    const lines = markdown.split('\n');
    let charCount = 0;
    let currentLine = 0;

    // Find current line from caret position
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1;
      if (charCount + lineLength > caretPos) {
        currentLine = i;
        break;
      }
      charCount += lineLength;
    }

    // Find the most recent heading before or at current line
    for (let i = currentLine; i >= 0; i--) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      // ATX headings (### text)
      const atxMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (atxMatch) {
        const text = atxMatch[2].replace(/[#*_`~]/g, '').trim();
        const heading = outline.find(h => h.text === text);
        if (heading) return heading.id;
      }
      
      // Setext headings (text followed by === or ---)
      if (nextLine) {
        const text = line.replace(/[#*_`~]/g, '').trim();
        if ((/^=+\s*$/.test(nextLine) || /^-+\s*$/.test(nextLine)) && text) {
          const heading = outline.find(h => h.text === text);
          if (heading) return heading.id;
        }
      }
    }

    return outline[0]?.id || null;
  }, [markdown, outline]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLTextAreaElement>) => {
    textareaRef.current = event.currentTarget;
    
    // Use scroll position when scrolling
    const scrollPercent = event.currentTarget.scrollTop / (event.currentTarget.scrollHeight - event.currentTarget.clientHeight);
    const index = Math.min(Math.max(Math.floor(scrollPercent * outline.length), 0), outline.length - 1);
    if (outline[index]) setActiveHeadingId(outline[index].id);
  }, [outline]);

  const handleCaretChange = useCallback((textarea: HTMLTextAreaElement) => {
    textareaRef.current = textarea;
    const activeId = findActiveHeadingFromCaret(textarea);
    if (activeId) setActiveHeadingId(activeId);
  }, [findActiveHeadingFromCaret]);

  useEffect(() => {
    // Only reset to first heading if we don't have an active heading yet
    // or if the current active heading no longer exists in the outline
    if (outline.length > 0) {
      if (!activeHeadingId || !outline.find(h => h.id === activeHeadingId)) {
        // Try to preserve based on caret position if we have a textarea reference
        if (textareaRef.current) {
          const activeId = findActiveHeadingFromCaret(textareaRef.current);
          setActiveHeadingId(activeId);
        } else {
          setActiveHeadingId(outline[0].id);
        }
      }
    }
  }, [outline, activeHeadingId, findActiveHeadingFromCaret]);

  return { activeHeadingId, handleScroll, handleCaretChange };
}