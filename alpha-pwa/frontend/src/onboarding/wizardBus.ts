// Tiny pub/sub used to advance the onboarding wizard from real app actions
// (button clicks / state transitions) without threading React context through
// the lazy-loaded CaseDetailView. No dependencies.

export type WizardEvent =
  | 'new-case-drawer-opened'
  | 'case-created'
  | 'upload-opened'
  | 'analyze-started';

type Handler = () => void;
const handlers: Partial<Record<WizardEvent, Set<Handler>>> = {};

function emit(event: WizardEvent): void {
  handlers[event]?.forEach(h => { try { h(); } catch { /* noop */ } });
}

function on(event: WizardEvent, cb: Handler): () => void {
  (handlers[event] ??= new Set()).add(cb);
  return () => { handlers[event]?.delete(cb); };
}

export const wizardBus = { emit, on };

// ── Persistence ──────────────────────────────────────────────────────────────
// Default-on at every launch until the tester opts out ("Non mostrare più").

const ONBOARDING_DISMISSED_KEY = 'plt:onboarding:dismissed';

export function isOnboardingDismissed(): boolean {
  try { return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1'; } catch { return false; }
}

export function dismissOnboarding(): void {
  try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1'); } catch { /* noop */ }
}

/** True while onboarding is active (not opted out) — drives the client-name
 *  framing of the NewCaseDrawer. */
export function isOnboardingActive(): boolean {
  return !isOnboardingDismissed();
}
