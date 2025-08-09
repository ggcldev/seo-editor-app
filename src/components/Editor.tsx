type Props = {
  markdown: string;
  setMarkdown: (v: string) => void;
  onPasteMarkdown: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  narrow: boolean;
  toggleNarrow: () => void;
};

export function Editor({ markdown, setMarkdown, onPasteMarkdown, narrow, toggleNarrow }: Props) {
  return (
    <main style={{ padding: 0, background: '#f6f6f6', height: '100vh' }}>
      <div style={{ height: '100%', padding: 24, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: narrow ? 760 : '100%' }}>
          <button
            type="button"
            onClick={toggleNarrow}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 1,
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: '#374151',
              cursor: 'pointer',
            }}
            aria-label={narrow ? 'Switch to full width' : 'Switch to narrow width'}
          >
            {narrow ? 'Full width' : 'Squeeze'}
          </button>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            onPaste={onPasteMarkdown}
            placeholder=""
            style={{
              width: '100%',
              height: 'calc(100vh - 48px)',
              resize: 'none',
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 14,
              lineHeight: 1.6,
              color: '#111827',
              background: '#f6f6f6',
              border: 'none',
              padding: 0,
              paddingTop: 32,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    </main>
  );
}