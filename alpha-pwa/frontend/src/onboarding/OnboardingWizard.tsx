import React, { useCallback, useEffect, useRef, useState } from 'react';
import { on, isOnboardingDismissed, dismissOnboarding, type WizardEvent } from './wizardBus';

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
    title: 'Crea il tuo primo fascicolo',
    body: 'Tocca «Nuovo fascicolo» per iniziare. Ti accompagno passo dopo passo.',
    advanceOn: 'new-case-drawer-opened',
  },
  {
    id: 'client-name',
    screen: 'cases',
    selector: '[data-tour="client-name"]',
    title: 'Come si chiama il tuo cliente?',
    body: 'Va bene anche uno pseudonimo o un soprannome. Chiamerò il fascicolo «Caso <nome>».',
    advanceOn: 'case-created',
    dim: false, // input is inside the drawer, which already dims the page
  },
  {
    id: 'add-doc',
    screen: 'case',
    selector: '[data-tour="add-document"]',
    title: 'Aggiungi un documento',
    body: 'Carica un atto, un verbale o la foto di un documento del caso.',
    advanceOn: 'upload-opened',
  },
  {
    id: 'analyze',
    screen: 'case',
    selector: '[data-tour="analyze"]',
    title: 'Analizza il caso',
    body: 'Avvia l’analisi: GiulIA organizza fatti, timeline e questioni in un fascicolo pulito.',
    advanceOn: 'analyze-started',
  },
];

export default function OnboardingWizard({ view }: { view: Screen }) {
  const [active, setActive] = useState(() => !isOnboardingDismissed());
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
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
    lastKeyRef.current = '';
    setRect(null);
  }, []);

  // Advance when the matching real action fires.
  useEffect(() => {
    if (!active || !step) return;
    return on(step.advanceOn, advance);
  }, [active, step, advance]);

  // Track the target element rect via rAF (handles async/lazy mount, scroll,
  // resize and drawer animations). Only re-renders when the rect changes.
  useEffect(() => {
    if (!active || !step || !onCurrentScreen) { lastKeyRef.current = ''; setRect(null); return; }
    let mounted = true;
    lastKeyRef.current = '';
    const tick = () => {
      if (!mounted) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
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
    return () => { mounted = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, step, onCurrentScreen]);

  const skip = useCallback(() => setActive(false), []);
  const dontShow = useCallback(() => { dismissOnboarding(); setActive(false); }, []);

  if (!active || !step || !onCurrentScreen) return null;

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
    <div className="onboarding-overlay" role="dialog" aria-live="polite" aria-label="Tutorial guidato">
      {hole && <div className={`onboarding-spotlight${step.dim === false ? ' onboarding-spotlight--nodim' : ''}`} style={{ position: 'fixed', ...hole }} />}
      <div className="onboarding-tooltip" style={{ position: 'fixed', ...ttStyle }}>
        <div className="onboarding-step-count">Passo {stepIndex + 1} di {STEPS.length}</div>
        <h3 className="onboarding-title">{step.title}</h3>
        <p className="onboarding-body">{step.body}</p>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-skip" onClick={skip}>Salta</button>
          <button type="button" className="onboarding-next" onClick={advance}>Avanti</button>
        </div>
        <label className="onboarding-dontshow">
          <input type="checkbox" onChange={e => { if (e.target.checked) dontShow(); }} />
          Non mostrare più
        </label>
      </div>
    </div>
  );
}
