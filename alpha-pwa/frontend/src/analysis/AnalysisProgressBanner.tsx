/**
 * AnalysisProgressBanner — non-blocking sticky banner shown while an AI analysis
 * runs: a spinner + indeterminate progress bar + an abort button that asks for
 * confirmation before stopping. Portable (see src/analysis/README.md).
 *
 * The host owns the analysis lifecycle: keep an AbortController, set `analyzing`,
 * and pass `onAbort` (which calls controller.abort()). This component only owns
 * the confirm UI. Copy is overridable via props (defaults: Italian / PLT).
 */
import React, { useEffect, useState } from 'react';
import './analysis-progress.css';

interface Props {
  analyzing: boolean;
  onAbort: () => void;
  label?: string;
  abortLabel?: string;
  confirmText?: string;
  keepLabel?: string;
  confirmAbortLabel?: string;
}

export default function AnalysisProgressBanner({
  analyzing,
  onAbort,
  label = 'Analisi AI in corso',
  abortLabel = 'Rinuncia',
  confirmText = 'Abbandonare l’analisi?',
  keepLabel = 'Continua',
  confirmAbortLabel = 'Abbandona',
}: Props) {
  const [confirm, setConfirm] = useState(false);

  // Reset the confirm state whenever an analysis ends/starts.
  useEffect(() => { if (!analyzing) setConfirm(false); }, [analyzing]);

  if (!analyzing) return null;

  return (
    <div className="analysis-banner">
      {confirm ? (
        <>
          <div className="analysis-banner-spinner" />
          <span className="analysis-banner-text">{confirmText}</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            <button type="button" className="analysis-banner-btn" onClick={() => setConfirm(false)}>{keepLabel}</button>
            <button type="button" className="analysis-banner-btn analysis-banner-btn--danger"
              onClick={() => { onAbort(); setConfirm(false); }}>{confirmAbortLabel}</button>
          </div>
        </>
      ) : (
        <>
          <div className="analysis-banner-spinner" />
          <span className="analysis-banner-text">{label}</span>
          <div className="analysis-overlay-bar analysis-banner-bar"><div className="analysis-overlay-bar-fill" /></div>
          <button type="button" className="analysis-banner-btn" onClick={() => setConfirm(true)}>{abortLabel}</button>
        </>
      )}
    </div>
  );
}
