import { useCallback, useRef } from 'react';

interface Props {
  markdown: string;
  setMarkdown: (value: string) => void;
  onReset: () => void;
}

export function DocumentIO({ markdown, setMarkdown, onReset }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setMarkdown(content);
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setMarkdown]);

  const handleExport = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown]);

  return (
    <div className="document-io">
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      
      <button 
        onClick={handleImport}
        className="document-io-button"
        title="Import markdown file"
      >
        Import
      </button>
      
      <button 
        onClick={handleExport}
        className="document-io-button"
        title="Export as markdown file"
      >
        Export
      </button>
      
      <button 
        onClick={onReset}
        className="document-io-button document-io-button--danger"
        title="Reset document (cannot be undone)"
      >
        Reset
      </button>
    </div>
  );
}