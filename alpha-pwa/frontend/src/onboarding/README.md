# Onboarding wizard — portable spotlight tour

A self-contained, first-run **spotlight tour**: it dims the page, highlights a
real element, and shows a tooltip explaining what to do — advancing as the user
performs the real action. Built for PLT but designed to drop into another app.

## Files (the whole folder is the unit to copy)

| File | Role |
|---|---|
| `OnboardingWizard.tsx` | The wizard. Mount once at the app root. Defines the `STEPS`. |
| `wizardBus.ts` | Tiny pub/sub for advancement events + opt-out persistence. No deps. |
| `onboarding.css` | Spotlight/tooltip styles. Uses design tokens (see below). |

Only dependency: **React**. No router, no state library.

## How it works

- Mounted once: `<OnboardingWizard view={currentScreen} />`. `view` is a string
  telling the wizard which "screen" is showing. Each step declares the screen it
  belongs to and is rendered only when `step.screen === view`.
- A step **advances** either on a `wizardBus` event the host app emits when the
  real action happens (`advanceOn`), or — for the first step — automatically
  when `view` changes (the auth → app transition; see the login-detection effect).
- The target is found via `document.querySelector(step.selector)` where
  `selector` is a `[data-tour="…"]` attribute you put on the real element.
- Behaviours: target is scrolled into view (synchronously, with retries); the
  tooltip is always kept inside the viewport (beside the target, or centered /
  top-pinned); the overlay is suppressed while a modal drawer is open
  (`inDrawer` steps are exempt); clicking outside a panel hides just that panel
  (advancement keeps listening); `×` closes for the session, the "Non mostrare
  più" checkbox opts out permanently (localStorage). Default-on until opted out.

## The Step model

```ts
interface Step {
  id: string;
  screen: Screen;            // which view this step belongs to
  selector?: string;         // [data-tour="…"] to spotlight; omit for an info panel
  title: string;
  body: string;
  advanceOn?: WizardEvent;   // bus event that advances this step (omit for auto/terminal)
  inDrawer?: boolean;        // show while a modal drawer is open (top-pinned, no spotlight)
}
```

## Integration contract (what the host app must provide)

1. **Mount** `<OnboardingWizard view={…} />` once, above everything, at the root.
   `view` must reflect the current screen and be one of the `Screen` union values.
2. **`data-tour` anchors** on the elements each step spotlights, matching
   `step.selector` (e.g. `<button data-tour="new-case">`).
3. **Emit `wizardBus` events** from the host's real actions so steps advance:
   `wizardBus.emit('material-added')`, etc. Current events (rename freely in
   `wizardBus.ts` + the `STEPS`):
   `new-case-drawer-opened`, `upload-opened`, `upload-closed`, `material-added`,
   `analyze-started`.
4. **Design tokens** used by `onboarding.css`: `--paper`, `--sigillo`, `--ink-1`,
   `--ink-2`, `--ink-3`, `--ink-4`, `--rule`, `--radius-1`, `--radius-3`,
   `--shadow-2`, `--dur-2`, `--ease`, `--font-display`. Define them or replace
   with literals.

## Porting to another app — checklist

1. Copy the `onboarding/` folder (3 files).
2. Ensure the design tokens above exist (or edit `onboarding.css` to hardcode).
3. Mount `<OnboardingWizard view={…} />` at the app root; map your screens to the
   `Screen` union (`'auth' | 'cases' | 'case'` in PLT — rename to your screens).
4. Rewrite `STEPS` for the new app: per step set `screen`, `selector`, copy, and
   `advanceOn`. Add the matching `data-tour="…"` attributes on real elements.
5. Update `WizardEvent` in `wizardBus.ts` to your action set, and `emit(...)`
   those events from the host's real handlers.
6. (Optional) change the opt-out key `plt:onboarding:dismissed` in `wizardBus.ts`.

That's it — no other wiring. Opt-out persists in `localStorage`.

## PLT-specific notes (remove when porting)

- Mounted in `main.tsx` as `<OnboardingWizard view={session ? view : 'auth'} />`.
- Tour: `login → crea → carica → [opzioni drawer] → analizza` (5 steps).
- Emits live in `main.tsx` (`new-case-drawer-opened`) and `CaseDetailView.tsx`
  (`upload-opened`/`upload-closed`/`material-added`/`analyze-started`).
- The upload drawer is raised above the GiulIA FAB (`.drawer-backdrop` z-index).
