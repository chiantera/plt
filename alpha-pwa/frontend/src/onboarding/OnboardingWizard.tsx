import React, { useCallback, useEffect, useRef, useState } from 'react';
import { wizardBus, isOnboardingDismissed, dismissOnboarding, type WizardEvent } from './wizardBus';

type Screen = 'auth' | 'cases' | 'case';

interface Step {
  id: string;
  screen: Screen;
  selector: string;
  title: string;
  body: string;
  /** Bus event that advances this step. Omitted for the auth step, which
   *  advances automatically once the user leaves the login screen. */
  advanceOn?: WizardEvent;
  /** When false, highlight the target with just a ring (no page dimming).
   *  Used for targets inside a modal/drawer that already dims the page. */
  dim?: boolean;
}

// Spotlight-guided first-run tour: login → crea → carica → analizza.
const STEPS: Step[] = [
  {
    id: 'auth',
    screen: 'auth',
    selector: '[data-tour="auth-card"]',
    title: 'Benvenuto in Pocket Legal Triage',
    body: 'Accedi o registrati per iniziare: bastano email e password. Poi ti guido a creare il tuo primo fascicolo.',
    // advances via the login-detection effect below (no bus event)
  },
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
  // Step the user dismissed by clicking outside its panel. The panel is hidden,
  // but advancement keeps listening so the NEXT step still appears when triggered.
  const [hiddenStep, setHiddenStep] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastKeyRef = useRef('');
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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
    if (!active || !step || !step.advanceOn) return;
    return wizardBus.on(step.advanceOn, advance);
  }, [active, step, advance]);

  // Auth step advances once the user is past the login screen (logged in),
  // whether via the form or a restored session.
  useEffect(() => {
    if (active && step && step.screen === 'auth' && view !== 'auth') advance();
  }, [active, step, view, advance]);

  // Hide the overlay while the upload drawer is open; restore when it closes.
  useEffect(() => {
    if (!active) return;
    const offOpen = wizardBus.on('upload-opened', () => setSuppressed(true));
    const offClose = wizardBus.on('upload-closed', () => setSuppressed(false));
    return () => { offOpen(); offClose(); };
  }, [active]);

  // Click outside the panel hides just this step (advancement keeps listening,
  // so the next panel still opens when its trigger fires).
  useEffect(() => {
    if (!active) return;
    const onDown = (e: Event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setHiddenStep(stepIndex);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active, stepIndex]);

  // Track the target element rect via rAF (handles async/lazy mount, scroll,
  // resize and drawer animations). Only re-renders when the rect changes.
  useEffect(() => {
    if (!active || !step || !onCurrentScreen || suppressed || hiddenStep === stepIndex) return;
    // Bring the target into view as soon as the step is active. Done synchronously
    // (plus a few timed retries for late layout shifts) rather than inside the rAF
    // loop, whose callback can be cancelled by a re-render before it ever fires.
    const scrollTargetIntoView = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && (r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth)) {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      }
    };
    scrollTargetIntoView();
    const timers = [350, 900, 1800].map(ms => window.setTimeout(scrollTargetIntoView, ms));

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
    // Cleanup (on step/screen change or unmount): stop the loop and drop stale geometry.
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      timers.forEach(clearTimeout);
      lastKeyRef.current = '';
      setRect(null);
    };
  }, [active, step, onCurrentScreen, suppressed, hiddenStep, stepIndex]);

  // Close just for this session (no opt-out): the wizard returns next launch.
  const closeForSession = useCallback(() => setActive(false), []);
  // Permanent opt-out: don't show again in future sessions.
  const dontShow = useCallback(() => { dismissOnboarding(); setActive(false); }, []);

  if (!active || !step || !onCurrentScreen || suppressed || hiddenStep === stepIndex) return null;

  const PAD = 8;
  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  const TT_WIDTH = 300;
  const TT_H = 200; // height estimate for placement; maxHeight keeps it bounded
  const maxHeight = Math.max(140, window.innerHeight - 24);
  // Centered fallback — always fully inside the viewport.
  const centered: React.CSSProperties = { top: '50%', left: '50%', width: TT_WIDTH, transform: 'translate(-50%, -50%)', maxHeight, overflowY: 'auto' };
  let ttStyle: React.CSSProperties;
  if (hole) {
    let left = hole.left + hole.width / 2 - TT_WIDTH / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - TT_WIDTH - 12));
    const belowTop = hole.top + hole.height + 12;
    const aboveTop = hole.top - 12 - TT_H;
    if (belowTop + TT_H <= window.innerHeight) {
      ttStyle = { top: belowTop, left, width: TT_WIDTH, maxHeight, overflowY: 'auto' };   // fits below
    } else if (aboveTop >= 12 && hole.top - 12 <= window.innerHeight) {
      ttStyle = { top: aboveTop, left, width: TT_WIDTH, maxHeight, overflowY: 'auto' };    // fits above
    } else {
      ttStyle = centered;  // target too tall to sit a tooltip beside it
    }
  } else {
    ttStyle = centered;
  }

  return (
    <div className="onboarding-overlay">
      {hole && <div className={`onboarding-spotlight${step.dim === false ? ' onboarding-spotlight--nodim' : ''}`} style={{ position: 'fixed', ...hole }} aria-hidden="true" />}
      <div ref={tooltipRef} className="onboarding-tooltip" aria-live="polite" aria-label="Tutorial guidato" style={{ position: 'fixed', ...ttStyle }}>
        <button type="button" className="onboarding-close" aria-label="Chiudi il tutorial per ora" onClick={closeForSession}>✕</button>
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
