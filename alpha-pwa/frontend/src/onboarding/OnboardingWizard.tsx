/**
 * OnboardingWizard — first-run spotlight tour for new testers.
 *
 * Mounted ONCE in `App` (above both the auth and authenticated branches) with
 * `view = session ? appView : 'auth'`. A single instance persists across login,
 * so the per-session close (×) and step progress survive the auth → app switch.
 *
 * Tour (one panel per step): login → crea → carica → analizza.
 * Each STEP declares the screen it belongs to, the `[data-tour="…"]` element to
 * spotlight, and how it advances:
 *   - `auth`     → advances via an effect when `view` leaves 'auth' (logged in).
 *   - the others → advance on a `wizardBus` event emitted by the real UI action
 *     (open new-case drawer, add material, start analysis). The bus decouples
 *     advancement from the components (incl. the lazy CaseDetailView).
 *
 * Behaviours:
 *   - The target rect is tracked via rAF (spotlight follows layout/scroll).
 *   - The target is scrolled into view SYNCHRONOUSLY when a step activates (the
 *     rAF callback can be cancelled by a re-render before it fires).
 *   - The tooltip is always kept inside the viewport (see tooltipStyle).
 *   - The overlay is suppressed while the upload drawer is open.
 *   - Clicking outside a panel hides just that panel (`hiddenStep`); advancement
 *     keeps listening, so the next panel still opens when triggered.
 *   - × closes for the session only; "Non mostrare più" opts out permanently
 *     (localStorage). Default-on every launch until opted out.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { wizardBus, isOnboardingDismissed, dismissOnboarding, type WizardEvent } from './wizardBus';
import './onboarding.css';

type Screen = 'auth' | 'cases' | 'case';

interface Step {
  id: string;
  screen: Screen;
  /** Element to spotlight. Omitted for informational panels (no spotlight). */
  selector?: string;
  title: string;
  body: string;
  /** Bus event that advances this step. Omitted for the auth step, which
   *  advances automatically once the user leaves the login screen. */
  advanceOn?: WizardEvent;
  /** Shown while the upload drawer is open (exempt from drawer suppression);
   *  rendered as a top-pinned informational panel, not a spotlight. */
  inDrawer?: boolean;
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
    id: 'drawer-actions',
    screen: 'case',
    inDrawer: true,
    title: 'Materiale aggiunto!',
    body: 'Da qui puoi: aggiungere altri documenti, chiudere il drawer per tornare al fascicolo, oppure avviare subito l’analisi. Prima di avviarla scegli Flash (veloce) o Pro (più approfondita) col toggle accanto al pulsante — l’analisi consuma crediti.',
    advanceOn: 'upload-closed',
  },
  {
    id: 'analyze',
    screen: 'case',
    selector: '[data-tour="analyze"]',
    title: 'Analizza con AI',
    body: 'Ora avvia l’analisi: GiulIA legge il materiale e costruisce fatti, timeline e questioni in un fascicolo ordinato. L’analisi consuma crediti.',
    // ends via the global 'analyze-started' listener (works from here or the drawer)
  },
];

type Hole = { top: number; left: number; width: number; height: number };

// Position the tooltip beside the spotlight when there's room, otherwise center
// it — always fully inside the viewport (maxHeight + scroll as a safety net).
function tooltipStyle(hole: Hole | null, pinTop = false): React.CSSProperties {
  const TT_WIDTH = 300;
  const TT_H = 200; // height estimate for placement; maxHeight keeps it bounded
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const base = { width: TT_WIDTH, maxHeight: Math.max(140, vh - 24), overflowY: 'auto' as const };
  const centered: React.CSSProperties = { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  // No target: informational panel — pin near the top (so it clears the drawer's
  // action buttons) when requested, otherwise center it.
  if (!hole) return pinTop ? { ...base, top: 16, left: '50%', transform: 'translateX(-50%)' } : centered;
  const left = Math.max(12, Math.min(hole.left + hole.width / 2 - TT_WIDTH / 2, vw - TT_WIDTH - 12));
  const belowTop = hole.top + hole.height + 12;
  const aboveTop = hole.top - 12 - TT_H;
  if (belowTop + TT_H <= vh) return { ...base, top: belowTop, left };                  // fits below
  if (aboveTop >= 12 && hole.top - 12 <= vh) return { ...base, top: aboveTop, left };  // fits above
  return centered;                                                                     // target too tall
}

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

  // Analysis started (from the main button or inside the drawer) ends the tour.
  useEffect(() => {
    if (!active) return;
    return wizardBus.on('analyze-started', () => setActive(false));
  }, [active]);

  // The "drawer-actions" panel re-appears after each material is added, even if
  // the user dismissed it by clicking outside.
  useEffect(() => {
    if (!active || step?.id !== 'drawer-actions') return;
    return wizardBus.on('material-added', () => setHiddenStep(null));
  }, [active, step]);

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
    if (!active || !step || !onCurrentScreen || (suppressed && !step.inDrawer) || hiddenStep === stepIndex) return;
    const selector = step.selector;
    if (!selector) return; // informational panel (no spotlight / no target tracking)
    // Bring the target into view as soon as the step is active. Done synchronously
    // (plus a few timed retries for late layout shifts) rather than inside the rAF
    // loop, whose callback can be cancelled by a re-render before it ever fires.
    const scrollTargetIntoView = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
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
      const el = document.querySelector(selector) as HTMLElement | null;
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

  if (!active || !step || !onCurrentScreen || (suppressed && !step.inDrawer) || hiddenStep === stepIndex) return null;

  const PAD = 8;
  const hole = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;
  const ttStyle = tooltipStyle(hole, step.inDrawer);

  return (
    <div className="tour-overlay">
      {hole && <div className="tour-spotlight" style={{ position: 'fixed', ...hole }} aria-hidden="true" />}
      <div ref={tooltipRef} className="tour-tooltip" aria-live="polite" aria-label="Tutorial guidato" style={{ position: 'fixed', ...ttStyle }}>
        <button type="button" className="tour-close" aria-label="Chiudi il tutorial per ora" onClick={closeForSession}>✕</button>
        <h3 className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <label className="tour-dontshow">
          <input type="checkbox" onChange={e => { if (e.target.checked) dontShow(); }} />
          Non mostrare più
        </label>
      </div>
    </div>
  );
}
