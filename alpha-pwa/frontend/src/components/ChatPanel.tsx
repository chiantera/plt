import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Loader2, MessageSquare, Scale, Send, ShieldAlert,
  Sparkles, Trash2, Users, X,
} from 'lucide-react';
import type { ChatState } from '../domain/types';

function renderChatMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, s => `<ul>${s}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, (_, p) => p ? p : '')
    .replace(/\n/g, '<br>');
}

export function ChatDrawer({
  state, onClose, onSend, onQuickAction, onClear, streaming,
}: {
  state: ChatState;
  onClose: () => void;
  onSend: (msg: string) => void;
  onQuickAction: (key: string) => void;
  onClear: () => void;
  streaming: boolean;
}) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [state.messages, streaming]);

  useEffect(() => {
    if (state.open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [state.open]);

  const submit = () => {
    const t = input.trim();
    if (!t || streaming) return;
    setInput('');
    onSend(t);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const QUICK_ACTIONS = [
    { key: 'strategy',    label: 'Strategia del caso',    icon: Sparkles },
    { key: 'memoria',     label: 'Memoria difensiva',     icon: FileText },
    { key: 'cassazione',  label: 'Ricorso Cassazione',    icon: Scale },
    { key: 'eccezione',   label: 'Eccezione procedurale', icon: ShieldAlert },
    { key: 'crossExam',   label: 'Controesame testimoni', icon: Users },
    { key: 'clienteNote', label: 'Nota per il cliente',   icon: MessageSquare },
  ] as const;

  const isEmpty = state.messages.length === 0;

  return (
    <div className={`chat-overlay ${state.open ? 'chat-overlay--open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chat-drawer">
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="chat-header-icon"><Sparkles size={16} /></div>
            <div>
              <div className="chat-header-name">GiulIA</div>
              {state.caseContext && <div className="chat-header-sub">Conosce il fascicolo</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {state.messages.length > 0 && (
              <button className="chat-close-btn" onClick={onClear} title="Pulisci cronologia" style={{ opacity: 0.5 }}>
                <Trash2 size={16} />
              </button>
            )}
            <button className="chat-close-btn" onClick={onClose} title="Chiudi pannello"><X size={20} /></button>
          </div>
        </div>

        {state.caseContext && (
          <div className="chat-quick-bar">
            {QUICK_ACTIONS.map(({ key, label, icon: Icon }) => (
              <button key={key} className="chat-quick-chip" title="Esegui prompt rapido" onClick={() => onQuickAction(key)} disabled={streaming}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}

        <div className="chat-messages" ref={listRef}>
          {isEmpty && (
            <div className="chat-empty">
              <div className="chat-empty-icon"><Sparkles size={32} /></div>
              <h3>GiulIA</h3>
              {state.caseContext
                ? <p>Buongiorno, Collega. Ho letto il fascicolo. Posso redigere memorie, ricorsi, eccezioni, prepararti al controesame — o semplicemente ragionare insieme sulla strategia. Come posso aiutarti?</p>
                : <p>Buongiorno, Collega. Sono GiulIA, avvocata penalista. Conosco il Codice Penale, il c.p.p. e la giurisprudenza della Cassazione. Apri un fascicolo per lavorare su un caso specifico.</p>
              }
            </div>
          )}
          {state.messages.map(m => (
            <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
              {m.role === 'assistant'
                ? <div className="chat-md" dangerouslySetInnerHTML={{ __html: renderChatMarkdown(m.content) }} />
                : <span>{m.content}</span>
              }
            </div>
          ))}
          {streaming && state.messages[state.messages.length - 1]?.role === 'user' && (
            <div className="chat-bubble chat-bubble--assistant chat-bubble--loading">
              <span className="chat-dots"><span /><span /><span /></span>
            </div>
          )}
        </div>

        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            placeholder={state.caseContext ? 'Chiedi qualcosa sul fascicolo, o richiedi un atto…' : 'Domanda di diritto penale italiano…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="chat-send-btn" title="Invia messaggio" onClick={submit} disabled={!input.trim() || streaming}>
            {streaming ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FloatingChatButton({
  onClick,
  hasContext,
  onHide,
}: {
  onClick: () => void;
  hasContext: boolean;
  onHide: () => void;
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [showDismissZone, setShowDismissZone] = React.useState(false);
  const [nearDismiss, setNearDismiss] = React.useState(false);
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
  const dragging = React.useRef(false);
  const moved = React.useRef(false);
  const origin = React.useRef({ px: 0, py: 0, bx: 0, by: 0 });
  const fabRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [ctxMenu]);

  const checkNearDismiss = (x: number, y: number): boolean => {
    const fw = fabRef.current?.offsetWidth ?? 44;
    const fh = fabRef.current?.offsetHeight ?? 44;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight - 68;
    const dx = (x + fw / 2) - cx;
    const dy = (y + fh / 2) - cy;
    return Math.sqrt(dx * dx + dy * dy) < 64;
  };

  const onDown = (e: React.PointerEvent) => {
    moved.current = false;
    dragging.current = true;
    const el = fabRef.current!;
    const rect = el.getBoundingClientRect();
    const bx = pos ? pos.x : window.innerWidth - rect.width - 24;
    const by = pos ? pos.y : window.innerHeight - rect.height - 110;
    origin.current = { px: e.clientX, py: e.clientY, bx, by };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - origin.current.px;
    const dy = e.clientY - origin.current.py;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved.current = true;
    if (!moved.current) return;
    const el = fabRef.current!;
    const nx = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, origin.current.bx + dx));
    const ny = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, origin.current.by + dy));
    setPos({ x: nx, y: ny });
    if (e.pointerType === 'touch') {
      setShowDismissZone(true);
      setNearDismiss(checkNearDismiss(nx, ny));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (fabRef.current) fabRef.current.releasePointerCapture(e.pointerId);
    dragging.current = false;
    setShowDismissZone(false);
    setNearDismiss(false);
    if (!moved.current) { onClick(); return; }
    moved.current = false;
    if (pos && checkNearDismiss(pos.x, pos.y)) onHide();
  };

  const onCancel = (e: React.PointerEvent) => {
    if (fabRef.current) fabRef.current.releasePointerCapture(e.pointerId);
    dragging.current = false;
    moved.current = false;
    setShowDismissZone(false);
    setNearDismiss(false);
  };

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <>
      {showDismissZone && (
        <div className={`fab-dismiss-zone${nearDismiss ? ' fab-dismiss-zone--near' : ''}`}>
          <X size={22} />
        </div>
      )}
      <button
        ref={fabRef}
        className={`chat-fab${hasContext ? ' chat-fab--context' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
        aria-label="Apri GiulIA"
        title="Apri GiulIA"
        style={style}
      >
        <MessageSquare size={26} />
        <span className="chat-fab-label">GiulIA</span>
        {hasContext && <span className="chat-fab-dot" />}
      </button>
      {ctxMenu && (
        <div className="fab-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onPointerDown={e => e.stopPropagation()}>
          <button className="fab-ctx-item" onClick={() => { setCtxMenu(null); onHide(); }}>
            Nascondi
          </button>
        </div>
      )}
    </>
  );
}

export function FabRestoreButton({ onRestore }: { onRestore: () => void }) {
  return (
    <button className="fab-restore" onClick={onRestore} aria-label="Mostra GiulIA">
      <MessageSquare size={14} />
      <span>GiulIA</span>
    </button>
  );
}
