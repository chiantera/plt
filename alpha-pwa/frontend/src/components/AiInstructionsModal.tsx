/**
 * AiInstructionsModal — a reusable "pre-flight" step shown before a non-chat AI
 * action (Analizza, Crea bozza, …). It collects OPTIONAL free-text instructions
 * that steer GiulIA's response, then runs the pending action with them.
 *
 * One-shot: the textarea is empty every time. The inline GiulIA bar and the FAB
 * chat do NOT use this — they're conversational already.
 *
 * Drive it with a single piece of state in the host screen:
 *   const [pendingAi, setPendingAi] = useState<AiInstructionsRequest | null>(null);
 *   ...open it...  setPendingAi({ title, actionLabel, run: (instr) => doTheThing(instr) });
 *   <AiInstructionsModal request={pendingAi} onClose={() => setPendingAi(null)} />
 */
import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface AiInstructionsRequest {
  /** Heading, e.g. "Analizza con GiulIA" or "Bozza: Memoria difensiva". */
  title: string;
  /** Confirm-button label, e.g. "Analizza" / "Crea bozza" / "Avvia Pro". */
  actionLabel: string;
  /** Runs the real action with the (possibly empty) instructions. */
  run: (instructions: string) => void | Promise<void>;
}

export default function AiInstructionsModal({ request, onClose }: { request: AiInstructionsRequest | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (request) {
      setText('');
      const t = setTimeout(() => ref.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [request]);

  if (!request) return null;

  const proceed = () => {
    const run = request.run;
    onClose();
    run(text.trim());
  };

  return (
    <div className="ai-instr-backdrop" onClick={onClose}>
      <div className="ai-instr-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={request.title}>
        <div className="ai-instr-head">
          <span className="ai-instr-icon"><Sparkles size={16} /></span>
          <h3 className="ai-instr-title">{request.title}</h3>
        </div>
        <p className="ai-instr-sub">
          Istruzioni per GiulIA <strong>(facoltative)</strong> — orientano la risposta. GiulIA resta vincolata ai materiali del fascicolo e non inventa fatti, termini né precedenti.
        </p>
        <textarea
          ref={ref}
          className="ai-instr-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Es: concentrati sui vizi di notifica, ignora il merito…"
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); proceed(); }
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          }}
        />
        <div className="ai-instr-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Annulla</button>
          <button type="button" className="primary-button" onClick={proceed} title="Procedi (⌘/Ctrl+Invio)">{request.actionLabel}</button>
        </div>
      </div>
    </div>
  );
}
