import React, { useCallback, useEffect, useRef, useState } from 'react';
import { wizardBus, isOnboardingDismissed, dismissOnboarding, type WizardEvent } from './wizardBus';

type Screen = 'cases' | 'case';

interface Step {
  id: string;
  screen: Screen;
  selector: string;
  title: string;
  body: string;
  advanceOn: WizardEvent;
  /** When false, highlight the target with just a ring (no page dimming).
   *  Used for targets inside a modal/drawer that already dims the page. */
  dim?: boolean;
}

// Spotlight-guided first-run tour: crea → carica → analizza.
const STEPS: Step[] = [
  {
    id: 'create',
    screen: 'cases',
    selector: '[data-tour="new-case"]',
    title: 'Crea un nuovo fascicolo',
    body: 'Tocca «Nuovo fascicolo» qui evidenziato. Ti chiederò il nome del cliente (anche uno pseudonimo) e creerò il fascicolo «Caso <nome>».',
    advanceOn: 'new-case-drawer-opened',
  },
  {
    id: 'add-doc',
    screen: 'case',
    selector: '[data-tour="add-document"]',
    title: 'Aggiungi il materiale del caso',
    body: 'Apri «Aggiungi documento» e inserisci qualcosa: carica gli atti (PDF o foto), oppure scrivi o detta una breve descrizione del caso. Basta un solo elemento — senza materiale il fascicolo non viene salvato.',
    advanceOn: 'material-added',
  },
  {
    id: 'analyze',
    screen: 'case',
    selector: '[data-tour="analyze"]',
    title: 'Analizza con AI',
    body: 'Ora avvia l’analisi: GiulIA legge il materiale e costruisce fatti, timeline e questioni in un fascicolo ordinato. L’analisi consuma crediti.',
    advanceOn: 'analyze-started',
  },
];

export default function OnboardingWizard({ view }: { view: Screen }) {
  const [active, setActive] = useState(() => !isOnboardingDismissed());
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Hide the overlay while the upload drawer is open (it dims the page itself).
  const [suppressed, setSuppressed] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastKeyRef = useRef('');

  const step = STEPS[stepIndex];
  const onCurrentScreen = !!step && step.screen === view;

  const advance = useCallback(() => {
    setStepIndex(i => {
      const next = i + 1;
      if (next >= STEPS.length) { setActive(false); return i; }
      return next;
    });
  }, []);

  // Advance when the matching real action fires.
  useEffect(() => {
    if (!active || !step) return;
    return wizardBus.on(step.advanceOn, advance);
  }, [active, step, advance]);

  // Hide the overlay while the upload drawer is open; restore when it closes.
  useEffect(() => {
    if (!active) return;
    const offOpen = wizardBus.on('upload-opened', () => setSuppressed(true));
    const offClose = wizardBus.on('upload-closed', () => setSuppressed(false));
    return () => { offOpen(); offClose(); };
  }, [active]);

  // Track the target element rect via rAF (handles async/lazy mount, scroll,
  // resize and drawer animations). Only re-renders when the rect changes.
  useEffect(() => {
    if (!active || !step || !onCurrentScreen || suppressed) return;
    let mounted = true;
    let scrolled = false; // scroll an off-screen target into view once per step
    lastKeyRef.current = '';
    const tick = () => {
      if (!mounted) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (!scrolled && r.width > 0 && r.height > 0) {
          scrolled = true;
          if (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth) {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          }
        }
        if (r.width > 0 && r.height > 0) {
          const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
          if (key !== lastKeyRef.current) { lastKeyRef.current = key; setRect(r); }
        }
      } else if (lastKeyRef.current !== 'none') {
        lastKeyRef.current = 'none';
        setRect(null);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // Cleanup (on step/screen change or unmount): stop the loop and drop stale geometry.
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastKeyRef.current = '';
      setRect(null);
    };
  }, [active, step, onCurrentScreen, suppressed]);

  // Close just for this session (no opt-out): the wizard returns next launch.
  const closeForSession = useCallback(() => setActive(false), []);
  // Permanent opt-out: don't show again in future sessions.
  const dontShow = useCallback(() => { dismissOnboarding(); setActive(false); }, []);

  if (!active || !step || !onCurrentScreen || suppressed) return null;

  const PAD = 8;
  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  const TT_WIDTH = 300;
  let ttStyle: React.CSSProperties;
  if (hole) {
    const belowTop = hole.top + hole.height + 12;
    const placeBelow = belowTop + 170 < window.innerHeight || hole.top < 180;
    let left = hole.left + hole.width / 2 - TT_WIDTH / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - TT_WIDTH - 12));
    ttStyle = placeBelow
      ? { top: belowTop, left, width: TT_WIDTH }
      : { top: Math.max(12, hole.top - 12), left, width: TT_WIDTH, transform: 'translateY(-100%)' };
  } else {
    ttStyle = { top: '50%', left: '50%', width: TT_WIDTH, transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="onboarding-overlay">
      {hole && <div className={`onboarding-spotlight${step.dim === false ? ' onboarding-spotlight--nodim' : ''}`} style={{ position: 'fixed', ...hole }} aria-hidden="true" />}
      <div className="onboarding-tooltip" aria-live="polite" aria-label="Tutorial guidato" style={{ position: 'fixed', ...ttStyle }}>
        <button type="button" className="onboarding-close" aria-label="Chiudi il tutorial per ora" onClick={closeForSession}>✕</button>
        <div className="onboarding-step-count">Passo {stepIndex + 1} di {STEPS.length}</div>
        <h3 className="onboarding-title">{step.title}</h3>
        <p className="onboarding-body">{step.body}</p>
        <label className="onboarding-dontshow">
          <input type="checkbox" onChange={e => { if (e.target.checked) dontShow(); }} />
          Non mostrare più
        </label>
      </div>
    </div>
  );
}
