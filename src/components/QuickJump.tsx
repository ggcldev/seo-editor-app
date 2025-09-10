import { useEffect, useMemo, useRef, useState } from 'react';
import { useBus } from '@/core/BusContext';
import type { Heading } from '@/core/outlineParser';

export function QuickJump() {
  const bus = useBus();
  const [open, setOpen] = useState(false);
  const [outline, setOutline] = useState<Heading[]>([]);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const offA = bus.on('outline:computed', ({ headings }) => setOutline(headings));
    bus.emit('outline:request', {});
    const onKey = (e: KeyboardEvent) => {
      const isMac = /mac/i.test(navigator.platform);
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (cmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { offA(); window.removeEventListener('keydown', onKey); };
  }, [bus]);

  useEffect(() => { 
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setQ(''); // Clear search when opening
    }
  }, [open]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return outline.slice(0, 30);
    return outline.filter(h => h.text.toLowerCase().includes(s)).slice(0, 50);
  }, [q, outline]);

  if (!open) return null;

  return (
    <div className="quick-jump-overlay" onClick={() => setOpen(false)}>
      <div className="quick-jump-modal" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Jump to heading… (Ctrl/Cmd+K)"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="quick-jump-input"
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'Enter' && items.length > 0) {
              bus.emit('nav:jump', { offset: items[0].offset, source: 'outline' });
              setOpen(false);
            }
          }}
        />
        <div className="quick-jump-results">
          {items.length === 0 && q.trim() && (
            <div className="quick-jump-no-results">No headings found</div>
          )}
          {items.map((h, index) => (
            <button
              key={h.id}
              className="quick-jump-item"
              onClick={() => {
                bus.emit('nav:jump', { offset: h.offset, source: 'outline' });
                setOpen(false);
              }}
              title={h.text}
            >
              <span className="quick-jump-level">H{h.level}</span>
              <span className="quick-jump-text">{h.text}</span>
              {index === 0 && <span className="quick-jump-hint">↵</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}