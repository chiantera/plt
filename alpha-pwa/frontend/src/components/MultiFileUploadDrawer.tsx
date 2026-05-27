import React, { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, FileText, Globe, Loader2,
  Mic, Scale, ShieldCheck, Sparkles, Upload, X,
} from 'lucide-react';
import { API } from '../config';
import type { UploadQueueItem } from '../domain/types';

export default function MultiFileUploadDrawer({
  queue,
  onClose,
  onAddFiles,
  onRemoveItem,
  onRetryItem,
  onAddTextItem,
  processing,
  onAnalyze,
}: {
  queue: UploadQueueItem[];
  onClose: () => void;
  onAddFiles: (files: File[], category: 'fascicolo' | 'giurisprudenza') => void;
  onRemoveItem: (id: string) => void;
  onRetryItem: (id: string) => void;
  onAddTextItem: (text: string, name?: string, category?: 'fascicolo' | 'giurisprudenza') => void;
  processing: boolean;
  onAnalyze?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'fascicolo' | 'giurisprudenza'>('fascicolo');
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pendingItemName, setPendingItemName] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlName, setUrlName] = useState('');
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('file', blob, 'nota_vocale.webm');
          const res = await fetch(`${API}/api/transcribe`, { method: 'POST', body: fd });
          const data = await res.json();
          if (data.text) {
            setPasteText(prev => prev ? prev + '\n\n' + data.text : data.text);
            setPendingItemName('Nota vocale');
          }
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      alert('Microfono non disponibile o accesso negato.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onAddFiles(files, activeTab);
  }, [onAddFiles, activeTab]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onAddFiles(files, activeTab);
    e.target.value = '';
  }, [onAddFiles, activeTab]);

  const handleUrlImport = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlFetching(true);
    setUrlError('');
    try {
      const res = await fetch(`${API}/api/fetch-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name: urlName.trim() }),
      });
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();
      const extracted: string = data.extracted_text ?? '';
      setPasteText(prev => prev ? prev + '\n\n' + extracted : extracted);
      setPendingItemName(urlName.trim() || url);
      setUrlInput('');
      setUrlName('');
    } catch (e) {
      setUrlError((e as Error).message);
    } finally {
      setUrlFetching(false);
    }
  }, [urlInput, urlName]);

  const doneCount = queue.filter(i => i.status === 'done' && i.text).length;
  const errorCount = queue.filter(i => i.status === 'error').length;
  const isUploading = queue.some(i => i.status === 'uploading' || i.status === 'pending');
  const isGiur = activeTab === 'giurisprudenza';

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="source-drawer upload-drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-handle" />

        <div className="drawer-header">
          <div>
            <p className="eyebrow">Elaborazione locale</p>
            <h2>Aggiungi al fascicolo</h2>
          </div>
          <button title="Chiudi" onClick={onClose} className="ghost-button"><X size={18} /></button>
        </div>

        <div className="upload-tab-strip">
          <button className={`upload-tab${!isGiur ? ' active' : ''}`} onClick={() => setActiveTab('fascicolo')}>
            <FileText size={14} /> Documenti
          </button>
          <button className={`upload-tab${isGiur ? ' active giur' : ''}`} onClick={() => setActiveTab('giurisprudenza')}>
            <Scale size={14} /> Giurisprudenza
          </button>
        </div>

        {isGiur && (
          <div className="upload-url-section">
            <label className="upload-url-label">Importa da URL (sentenza, banca dati, testo web)</label>
            <div className="upload-url-row">
              <input
                className="upload-url-input"
                type="url"
                placeholder="https://www.example.com/sentenza…"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) handleUrlImport(); }}
              />
            </div>
            <div className="upload-url-row" style={{ marginTop: 6 }}>
              <input
                className="upload-url-input"
                type="text"
                placeholder="Etichetta (es. Cass. Pen. sez. I n. 1234/2023)"
                value={urlName}
                onChange={e => setUrlName(e.target.value)}
              />
              <button
                className="primary-button upload-url-btn"
                disabled={!urlInput.trim() || urlFetching}
                onClick={handleUrlImport}
              >
                {urlFetching ? <Loader2 size={13} className="spin" /> : <Globe size={13} />}
                {urlFetching ? 'Importo…' : 'Importa'}
              </button>
            </div>
            {urlError && (
              <p className="upload-url-hint" style={{ color: 'var(--critical)', marginTop: 6 }}>
                Errore: {urlError}
              </p>
            )}
            <p className="upload-url-hint">
              Il testo estratto apparirà nel box qui sotto — controlla che ci sia tutto prima di cliccare Aggiungi. Se il sito usa JavaScript dinamico, incolla il testo manualmente.
            </p>
          </div>
        )}

        <label
          className={`drop-zone${dragging ? ' dragging' : ''}${isGiur ? ' drop-zone--giur' : ''}`}
          style={{ cursor: 'pointer' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="drop-zone-icon-container">
            {isGiur ? <Scale size={28} /> : <Upload size={32} />}
          </div>
          <p>{isGiur ? 'Trascina la sentenza o il provvedimento' : 'Trascina i file qui o tocca per selezionarli'}</p>
          <small>{isGiur ? "PDF, TXT — il precedente sarà etichettato come verificato dall'avvocato" : 'PDF, DOCX, TXT, immagini — più file alla volta'}</small>
          <input ref={fileRef} type="file" style={{ display: 'none' }} multiple accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv,.rtf,image/*,audio/*" onChange={onFileChange} />
        </label>

        {queue.length === 0 && (
          <div className="upload-privacy-notice">
            <ShieldCheck size={13} />
            <span>
              {isGiur
                ? 'I precedenti caricati restano in locale. GiulIA li può citare con source_ref esplicita distinguendoli dai documenti del caso.'
                : "I file originali restano sul dispositivo. Solo il testo estratto viene inviato all'AI al momento dell'analisi."}
            </span>
          </div>
        )}

        {queue.length > 0 && (
          <div className="upload-queue">
            {queue.map(item => (
              <div key={item.id} className={`upload-queue-item ${item.status}`}>
                <div className="upload-queue-icon">
                  {item.status === 'uploading' ? (
                    <Loader2 size={18} className="spin text-sky" />
                  ) : item.status === 'error' ? (
                    <AlertTriangle size={18} className="text-red" />
                  ) : item.status === 'done' ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                  ) : (
                    <FileText size={18} />
                  )}
                </div>
                <div className="upload-queue-info">
                  <div className="upload-queue-name">
                    {item.description || item.name}
                    {item.category === 'giurisprudenza'
                      ? <span className="upload-cat-badge upload-cat-badge--giur">Precedente</span>
                      : <span className="upload-cat-badge upload-cat-badge--doc">Fascicolo</span>
                    }
                  </div>
                  <div className="upload-queue-size">
                    {item.name !== (item.description || item.name) && item.name}
                    {item.size > 0 && ` · ${(item.size / 1024).toFixed(0)} KB`}
                  </div>
                </div>
                <div className="upload-queue-status">
                  {item.status === 'pending' && <span className="status-badge pending">In coda…</span>}
                  {item.status === 'uploading' && <span className="status-badge uploading">Elaboro…</span>}
                  {item.status === 'done' && <span className="status-badge done">Aggiunto ✓</span>}
                  {item.status === 'error' && (
                    <span className="status-badge error" onClick={() => onRetryItem(item.id)} title={item.error} style={{ cursor: 'pointer' }}>
                      Riprova ↻
                    </span>
                  )}
                </div>
                {(item.status === 'pending' || item.status === 'done' || item.status === 'error') && (
                  <button className="upload-queue-action" onClick={() => onRemoveItem(item.id)} title="Rimuovi">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="upload-field">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label className={`upload-text-label${pasteText ? ' upload-text-label--ready' : ''}`}>
              {pasteText
                ? (pendingItemName ? `Testo pronto — "${pendingItemName}"` : 'Controlla il testo e clicca Aggiungi')
                : (isGiur ? 'Testo della sentenza' : 'Testo o nota vocale')}
            </label>
            {!isGiur && (
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`mic-btn${recording ? ' mic-btn--recording' : ''}`}
              >
                {transcribing
                  ? <><Loader2 size={12} className="spin" /> Trascrivo…</>
                  : recording
                    ? <><span className="mic-btn-dot" /> Stop</>
                    : <><Mic size={12} /> Nota vocale</>
                }
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              className={`upload-textarea${pasteText ? ' upload-textarea--has-content' : ''}`}
              placeholder="Il testo del tuo upload apparirà qui — controlla che ci sia tutto. Puoi anche incollare o scrivere direttamente."
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); if (!e.target.value) setPendingItemName(''); }}
              rows={4}
              style={{ flex: 1, minHeight: 80 }}
            />
            <button
              className="primary-button"
              disabled={!pasteText.trim()}
              onClick={() => {
                onAddTextItem(pasteText.trim(), pendingItemName || undefined, activeTab);
                setPasteText('');
                setPendingItemName('');
              }}
              style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', padding: '8px 12px', fontSize: '0.78rem' }}
            >
              Aggiungi
            </button>
          </div>
        </div>

        <div className="upload-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div>
            {isUploading && (
              <div className="upload-status-processing">
                <Loader2 size={14} className="spin" />
                <span>Elaborazione in corso…</span>
              </div>
            )}
            {!isUploading && doneCount > 0 && (
              <div className="upload-status-done">✓ {doneCount} elemento/i pronto/i</div>
            )}
            {errorCount > 0 && <span className="upload-status-error">{errorCount} errore/i</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="ghost-button" onClick={onClose}>Chiudi</button>
            {doneCount > 0 && onAnalyze && (
              <button className="primary-button upload-analyze-btn" onClick={onAnalyze}>
                <Sparkles size={15} /> Avvia Analisi AI
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
