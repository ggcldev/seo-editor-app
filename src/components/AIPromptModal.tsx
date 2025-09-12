import { useEffect, useState, useRef } from 'react';
import { useBus } from '@/core/BusContext';

export function AIPromptModal() {
  const bus = useBus();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const off = bus.on('ai:prompt:open', ({ initial }) => {
      setPrompt(initial ?? '');
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    });
    return () => off();
  }, [bus]);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim()) return;
    bus.emit('ai:prompt:submit', { prompt: prompt.trim() });
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div className="quick-jump-overlay" onClick={() => setOpen(false)}>
      <div className="quick-jump-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="AI Prompt">
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="quick-jump-input"
            placeholder="Ask AI… (Enter to submit)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </form>
        <div className="quick-jump-results" style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: 12 }}>
          Tip: Press Esc to close. Your prompt will be sent to the configured provider.
        </div>
      </div>
    </div>
  );
}