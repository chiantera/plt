import React from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function GiuliaPromptBar({ onOpenChat }: { onOpenChat: (msg?: string) => void }) {
  const [val, setVal] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    onOpenChat(val.trim() || undefined);
    setVal('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setVal(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className="giulia-prompt-bar" style={{ alignItems: 'flex-end' }}>
      <div className="giulia-prompt-icon" style={{ paddingBottom: 6 }}><Sparkles size={16} /></div>
      <textarea
        ref={textareaRef}
        className="giulia-prompt-input"
        placeholder="Sono GiulIA e sono qui per rispondere alle tue domande. Chiedimi qualcosa..."
        value={val}
        onChange={handleInput}
        rows={2}
        style={{ overflowY: 'auto', minHeight: '40px' }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button title="Invia domanda a GiulIA" className="giulia-prompt-send" onClick={submit} tabIndex={-1} aria-label="Invia" style={{ marginBottom: 2 }}>
        <Send size={14} />
      </button>
    </div>
  );
}
