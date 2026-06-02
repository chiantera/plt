# CURRENT TASK — PLT alpha handoff and backlog

_Last updated: 2026-06-01 by Claude_

---

## ✅ DONE — SchedaPRO login/account/AI UX fully ported to PLT (2026-06-01)

The login/account port handoff is **complete and merged to `main`**. Codex did the UI-only
half on `port/login-account-ux`; the rest was added in the same session.

**Codex (merged `0c8b3dcc`):** §1 disclaimer + mandatory gating checkbox · §3 two-column
top-aligned login · §4 dev-bypass logout fix · §5 `AccountControls` (Profilo + quick Logout
with confirm) on home **and** case `.case-topbar` + `supabaseClient.ts` · §8b non-destructive
"Ri-analizza". Copy correctly adapted to PLT/GiulIA (avvocato/fascicolo, no medical disclaimer);
overlay a11y improved (onMouseDown + role/aria-modal). Build + 12 auth-onboarding checks green.

**Then added (the deferred pieces):**
- **§2 AuthTour** (`b6ccd44e`): first-run welcome panel on login, `.tour-*` look, key
  `plt:auth-tour:dismissed`, "Benvenuto in PLT 👋".
- **§6 pre-flight "istruzioni per GiulIA" modal** (`32dd3bf6`): before Analizza / Pro /
  Ri-analizza / Crea bozza, an optional steering box (`AiInstructionsModal`). Backend
  `AnalyzeRequest.user_instructions` woven as `ISTRUZIONI DELL'AVVOCATO` above materials,
  below the no-inventing rules. Pro `confirm()` dropped (the modal is the confirmation;
  `auto_charge:false`). Excludes inline GiulIA bar + FAB.
- **§8 resilient background analysis** (`64dfc399`): analysis runs as a server-side job
  (`POST/GET /api/analyze-jobs`, ThreadPool, 1h TTL) driven by
  `frontend/src/analysis/analysisManager.ts` (POST once, persist job_id, poll 2s, re-poke on
  `visibilitychange`, resume on app start, merge into IndexedDB on done). Survives navigating
  away / opening another case / phone-lock / refresh. Case list shows "Analisi in corso…" pill
  + auto-refreshes on finish.

**Verified:** frontend `npm run build` green · all `test:*` checks green · backend `pytest`
**32 passed** (added `test_user_instructions.py`, `test_analysis_jobs.py`). Prompt map P04
updated; `alpha-pwa/README.md` notes the new endpoints.
⚠️ Render free-tier caveat: a cold-start mid-job → client gets 404 → "Analisi interrotta sul
server. Riprova." (bulletproof = persist jobs to Supabase, out of scope).
**Not yet done:** live browser e2e of the background flow on PLT (the port mirrors SchedaPRO's
e2e-verified system; a browser QA pass is still worth doing).

---

## Current status

Nine slices complete and pushed to `main`. Slice 9 aggiunge un wizard di onboarding (spotlight) che guida il tester dal login al primo fascicolo: `login → crea → carica → analizza`. Slice 8 aggiunge epistemic stance (difesa vs. accusa) a tutti i prompt AI e un toggle `defense_position` per-evento nella timeline.

Target verified:

- Repo: `/home/deckard/projects/plt`
- Branch: `main`
- Remote: `origin https://github.com/chiantera/plt.git`

Latest commits:

```text
[Slice 8 — vedi sotto]
4a0a0b5d fix: double Pro analysis token budget to 256K
66b6d083 feat: draft model toggle + non-blocking analysis banner + 422 fix for large Pro cases
8fbe0484 docs: prompts map update — 2026-05-28 session changes
00b5c0d4 fix: stop bozza truncation — SSE keepalive during DeepSeek reasoning phase
```

---

## Completed in this slice

### Slice 9 — Wizard di onboarding (spotlight) per i tester

**Problema:** un tester al primo avvio non sa da dove partire. Invece di un ennesimo caso demo, un wizard guida la creazione del **primo fascicolo reale** con spotlight sui pulsanti veri. Tour (5 pannelli): **login → crea → carica → opzioni drawer → analizza**.

**Modulo portabile (`alpha-pwa/frontend/src/onboarding/`)** — pensato per essere copiato in un'altra app (vedi `onboarding/README.md`):
- `wizardBus.ts` — micro pub/sub disaccoppiato dai componenti (eventi: `new-case-drawer-opened`, `upload-opened`, `upload-closed`, `material-added`, `analyze-started`) + persistenza opt-out `localStorage['plt:onboarding:dismissed']`.
- `OnboardingWizard.tsx` — overlay spotlight montato **una sola volta** in `App` (sopra sia il ramo auth che quello autenticato). Step (screen → target → avanza su):
  1. `auth` → `[data-tour="auth-card"]` → avanza quando si lascia la login (effetto su `view`).
  2. `create` (cases) → `[data-tour="new-case"]` → `new-case-drawer-opened`.
  3. `add-doc` (case) → `[data-tour="add-document"]` → `material-added` (non al semplice apertura del drawer).
  4. `drawer-actions` (case, `inDrawer`) → nessuno spotlight, pannello ancorato in alto mentre il drawer è aperto; spiega le 3 opzioni (aggiungi altro / chiudi / analizza da qui) + crediti + scelta Flash/Pro → `upload-closed`.
  5. `analyze` (case) → `[data-tour="analyze"]` → termina via listener globale `analyze-started`.
- `onboarding.css` — stili spotlight/tooltip co-locati (dipende dai design token, elencati nel file/README).
- `README.md` — guida al port (contratto d'integrazione + checklist).

**Comportamenti chiave:**
- **Tooltip** sempre dentro il viewport: sotto/sopra il target se c'è spazio, altrimenti **centrato**; per i pannelli `inDrawer` senza target è **ancorato in alto** (libera i pulsanti del drawer).
- **scrollIntoView** del target **sincrono** all'attivazione (+ retry) — non nel loop rAF (il cui callback poteva essere cancellato da un re-render). Il rAF traccia solo il rect.
- **Soppressione** mentre il drawer di upload è aperto (`upload-opened`/`upload-closed`); i pannelli `inDrawer` sono esenti.
- **`analyze-started` termina il tour globalmente** (copre l'analisi lanciata da dentro il drawer).
- **Niente contatore** "Passo n di N" allo user. **× = chiudi per la sessione**; **"Non mostrare più"** = opt-out permanente.
- **Click fuori dal pannello** = nasconde solo quel pannello (`hiddenStep`); i listener di avanzamento restano attivi → il successivo si apre comunque. Il pannello `drawer-actions` riappare a ogni `material-added`.

**Modifiche ai file esistenti:**
- `main.tsx`: mount singolo `<OnboardingWizard view={session ? view : 'auth'} />`; `data-tour="new-case"` sui pulsanti crea + `openNewCase`; `NewCaseDrawer` con `clientNameMode` (titolo → `Caso <nome>`) durante l'onboarding; `data-tour="auth-card"` sulla card login.
- `CaseDetailView.tsx`: `data-tour` su "Aggiungi documento"/"Analizza"; emit `upload-opened`/`upload-closed`/`material-added`/`analyze-started`; passa `analyzeMode`/`onModeChange` al drawer.
- `MultiFileUploadDrawer.tsx`: **toggle Flash/Pro** accanto a "Avvia Analisi" + nota crediti; label del bottone in base al mode.
- `styles.css`: **fix layout auth mobile** (override `@media (max-width:540px)` spostati **dopo** le regole base `.auth-*`: prima la colonna intro collassava a ~0px → testo illeggibile su telefono); **`.drawer-backdrop` z-index 20 → 500** (il drawer copre il FAB GiulIA, prima lo nascondeva); **`.mic-btn`** ("Nota vocale") contrasto migliorato (navy + bordo). Il blocco `.onboarding-*` è stato **spostato** in `onboarding/onboarding.css`.

**Verifica:** ✓ build TypeScript pulito; i 5 test script invariati passano; QA browser end-to-end sul deploy Netlify (login sloggato → crea → carica testo → opzioni → analizza), incluso il caso finestra bassa e il layout auth mobile.

**Nota:** il wizard verrà **portato in un'altra app** — vedi `onboarding/README.md` per il contratto d'integrazione e la checklist di port.

---

### Slice 8 — Epistemic stance (prospettiva difensiva) · defense_position per-evento

**Problema:** GiulIA trattava le ricostruzioni accusatorie come fatti accertati. "L'imputato ha acquistato X" invece di "secondo la prospettazione accusatoria l'imputato avrebbe acquistato X". Cruciale per ricorsi Cassazione dove i fatti della sentenza impugnata sono _oggetto di contestazione_.

**Fix 1 — Prompts (backend + frontend):**

- `ai_service.py` — `_SYSTEM_PROMPT`: aggiunta regola 8 — PROSPETTIVA DIFENSIVA con distinzione `fatto pacifico` / `prospettazione accusatoria` / `sentenza ritiene che`.
- `ai_service.py` — `_PRO_POLICY`: aggiunta clausola PROSPETTIVA DIFENSIVA per analisi Pro.
- `ai_service.py` — `_DEFAULT_CHAT_SYSTEM`: aggiunta regola di comportamento PROSPETTIVA DIFENSIVA.
- `prompts/giulia.ts` — `SYSTEM_PROMPT_IT`: stesso blocco difensivo.
- `prompts/documentDrafts.ts`: nuova costante `DEFENSE_PERSPECTIVE` iniettata in `memoria`, `cassazione`, `eccezione`, `strategy`. La Cassazione ora dice esplicitamente che la sentenza impugnata è oggetto di contestazione e richiede "la sentenza impugnata ritiene che..." non "l'imputato ha fatto X".

**Fix 2 — Schema + UI:**

- `domain/types.ts`: nuovo tipo `DefensePosition = 'admitted' | 'contested' | 'denied'`; campo `defense_position?: DefensePosition` su `TimelineEvent`.
- `ai_service.py` — `_ANALYSIS_SCHEMA`: campo `defense_position` aggiunto alla timeline; la regola 8 del sistema prompt spiega i valori.
- `domain/caseContext.ts` — `buildCaseContext()`: ogni evento timeline ora include `[PACIFICO]` / `[CONTESTATO]` / `[NEGATO DALLA DIFESA]` — il modello vede la posizione difensiva nel contesto.
- `domain/caseMerge.ts` — `buildUserContextMaterial()`: stessa logica.
- `screens/CaseDetailView.tsx`: badge colorato cliccabile per ogni evento timeline — verde per pacifico, giallo per contestato, rosso per negato. Click cicla admitted → denied → contested. Default AI: `contested`.
- `styles.css`: `.defense-position-badge` + varianti `.dp-admitted`, `.dp-contested`, `.dp-denied`.

**Build:** ✓ zero errori TypeScript.

---

### Slice 7 — Bozza truncation fix · Draft mode toggle · Non-blocking analysis · 422 repair · Pro 256K

**Backend (`alpha-pwa/backend/app/ai_service.py`):**

- **SSE keepalive for reasoning models:** DeepSeek V4 Pro (and Flash) emit `reasoning_content` tokens silently before producing `content`. During that silence (~80-100K tokens for Pro) the Vite proxy would drop the connection, causing mid-word bozza cutoff. Fix: `_deepseek_stream` now yields `": ping\n\n"` SSE comments for each `reasoning_content` chunk. SSE comments are invisible to browser EventSource/ReadableStream readers but keep the TCP socket alive through proxy inactivity timeouts.
- **`_repair_truncated_json()`:** New function that walks the raw JSON string char-by-char (tracking `{}` and `[]` depth, handling string escapes) to collect safe truncation candidates at `depth_brace == 1`. Tries `raw[:pos].rstrip().rstrip(",") + "}"` for each candidate in reverse order. Returns the first valid parse, or `None` if all fail.
- **`analyze_case()` — graceful 422 degradation:** Previously, `finish_reason == "length"` raised 422 before attempting JSON parse. Now: try JSON parse first; if that fails, try `_repair_truncated_json()`; only raise 422 if repair also fails. This recovers all fields except those that were mid-write at truncation (typically the end of `legal_analysis`).
- **`_PRO_MAX_TOKENS` doubled:** Changed default from `"128000"` to `"256000"`. Pro uses ~80-100K reasoning tokens internally before producing output; the old 128K budget left only ~20-30K for output JSON. 256K gives ~150K+ for output.

**Frontend (`alpha-pwa/frontend/`):**

- **`vite.config.ts` — proxy timeout 600s:** Changed proxy from simple string target to object `{ target, timeout: 600000, proxyTimeout: 600000 }`. The Vite http-proxy default has no timeout configured, which caused connection drops during the reasoning silence.
- **`src/screens/CaseDetailView.tsx` — Flash/Pro toggle for bozze:** Added `draftMode: 'flash' | 'pro'` state (localStorage-persisted, independent of `analyzeMode`). Toggle rendered inside "Redazione atti con AI" header in `LegalAnalysisTab`. Cassazione bozze use `draftMode` but always override `maxTokens: 131072` regardless of mode.
- **`src/screens/CaseDetailView.tsx` — non-blocking analysis banner:** Replaced `position:fixed` full-screen overlay (blocking for 5-10 min) with compact `position:sticky` `.analysis-banner`. The `handleAnalyze` fetch now continues if the user navigates away from the fascicolo; `dbSave(localOwnerId, updated)` fires on completion and the result is available in IndexedDB when the user returns. Banner has: spinner, progress bar, "Rinuncia" button (asks for confirmation before abort).
- **`src/screens/CaseDetailView.tsx` — `AnimatedDots` removed:** Replaced with the existing CSS-animated `analysis-overlay-bar` (already using `progress-slide` keyframes).
- **Cassazione prompt reverted:** Removed "LUNGHEZZA: minimo 4000 parole" injection added in a prior commit (cannot override a connection timeout via prompt; reverted to original cassazioneGuide-based prompt).
- **`src/styles.css`:** Added `.analysis-banner` block (sticky, flex, spinner, bar, button variants `--danger`); added `.draft-generating-bar` with `max-width: 320px`.

**Docs:**
- `07-prompts/2026-05-26-plt-ai-prompts-map.md`: updated date to 2026-05-28; SSE keepalive section; P11 major update with CASSAZIONE_GUIDE details; P27 new entry; P19 Cassazione exception documented; hotspot #6 marked RESOLVED; chat token budget 32768 documented.

**All tests pass:**
- `npm run test:plt-export` ✓
- `npm run test:local-case-scope` ✓
- `npm run test:draft-workspace` ✓
- `npm run test:draft-workspace-ui` ✓

---

## Completed in previous slices

### Slice 6 — Design polish: fonts, favicon, layout, color sweep

Visual inspection of the full live UI on `localhost:5173` revealed 13 hardcoded dark-era colors that were invisible or illegible on the new light `--paper` background. All fixed.

**`src/styles.css`:**
- `.row-delete-btn`: replaced `opacity: 0.55` (made circles near-invisible on light bg) with "danger on hover" pattern — neutral gray at rest (`--ink-4` / `--rule-strong`), red only on hover.
- `.aula-trigger-btn`: `#c4b5fd` lavender text (invisible on paper) → `#5b21b6` dark violet; background/border opacities increased to be readable on light surface.
- Added `.profile-btn` class (token-based) for the homepage profile button.
- Added `.empty-state-placeholder` and `.empty-state-placeholder.lg` classes for empty-state containers.

**`src/screens/CaseDetailView.tsx`:**
- Material drawer delete button: `#ef4444` → `var(--critical)`.
- Witness credibility score: `#ef4444`/`#f97316`/`#22c55e` → `var(--critical)`/`var(--warning)`/`var(--success)`.
- Redaction arrow: `#64748b` → `var(--ink-3)`.
- Timeline empty state (×2): `rgba(255,255,255,0.02)` + faint dashed border → `.empty-state-placeholder` with `--paper-sunken`.

**`src/main.tsx`:**
- Home stats (alto rischio, scadenze, contraddizioni): all hardcoded hex → `var(--critical)` / `var(--warning)` / `var(--success)` / `var(--ink-4)`.
- Profile button: dark-era glass inline style → `.profile-btn` class.
- Cases empty state: near-invisible dark glass → `.empty-state-placeholder.lg` with `var(--ink-1)` text.
- Auth/Suspense loading spinners: `#020617` dark bg + `#7c3aed` purple → `var(--paper)` + `var(--giulia-ink)`.

**`src/tokens.css` — typography upgrade:**
- `--font-display`: Newsreader (editorial serif, Google Fonts) — display titles and case headers.
- `--font-ui`: Satoshi (geometric sans, Fontshare CDN) — all UI labels, buttons, navigation.
- `--font-mono`: JetBrains Mono — code and metadata fields.
- `index.html`: preconnect hints for both CDNs.

**Favicon + PWA icons (NEW):**
- `public/favicon.svg`: hand-crafted SVG "P" glyph — bordeaux rounded square + carta letterform.
- `public/favicon.ico`: 16 + 32 px ICO generated via ImageMagick from SVG master.
- `public/icon-192.png`, `icon-512.png`: regenerated from SVG (was generic placeholder).
- `public/manifest.json`: `background_color` → `#FAF6EE` (carta), `theme_color` → `#7A1F2B` (sigillo).
- `index.html`: SVG + ICO favicon links, `theme-color` → `#FAF6EE`, `status-bar-style` → `default`.

**Layout and copy fixes:**
- `.row-delete-btn`: removed circle/oval (border + padding that made it look like a badge); now flat trash icon identical to other delete buttons throughout the app.
- Home banner (`.warming-banner`, `.analyzing-banner`, `.error-banner`) in `.home-shell`: `margin-left/right: 20px` — was stretching edge-to-edge.
- `GiuliaPromptBar`: `rows={2}` + `minHeight: 40px` — was too short (1 row).
- `h1`: `font-size: clamp(1.4rem, 4.5vw, 2rem)` — was wrapping onto 2 lines on small viewports.
- `.home-headline`: `clamp(2rem, 7vw, 3rem)` + `white-space: nowrap` — title no longer breaks.
- "I tuoi fascicoli" → **"I miei fascicoli"** in `main.tsx`.

**`src/components/MultiFileUploadDrawer.tsx` (follow-up — b84b0fd3):**
- Privacy notice box: `rgba(56,189,248,0.05)` sky-tinted → `.upload-privacy-notice` (green `--success` tone).
- Drop zone giurisprudenza icon: `#a78bfa` lavender → `--giulia-ink` navy via `.drop-zone--giur .drop-zone-icon-container`.
- Mic button: hardcoded rgba/hex inline style → `.mic-btn` / `.mic-btn--recording` CSS classes.
- Recording dot: `#ef4444` → `var(--critical)` via `.mic-btn-dot`.
- Queue done icon: `#4ade80` → `var(--success)`.
- Text label: `#a78bfa`/`#94a3b8` → `.upload-text-label` / `.upload-text-label--ready`.
- Status bar: `#38bdf8`/`#4ade80`/`#f87171` → `.upload-status-processing/done/error` classes.
- URL error: `#f87171` → `var(--critical)`.
- `MultiFileUploadDrawer` chunk: 9.89 KB → 9.22 KB (less inline style payload).
- Zero hardcoded rgba/hex colors remain across all frontend TSX/TS files (verified with grep).

**Documentation:**
- `README.md` (root): screenshots from live Carta & Inchiostro UI, ASCII app file tree, updated feature list.
- `alpha-pwa/README.md`: updated Key Files section to reflect extracted screens/components/domain structure and new public/ assets.
- `CURRENT-TASK.md`: this update.

**All tests pass:**
- `npm run test:plt-export` ✓
- `npm run test:local-case-scope` ✓
- `npm run test:draft-workspace` ✓
- `npm run test:draft-workspace-ui` ✓

---

## Completed in previous slices

### Slice 5 — Design system "Carta & Inchiostro"

**Frontend:**

- `src/tokens.css` (NEW): design token completi — palette carta/inchiostro, tipografia Newsreader+Geist+JetBrains Mono, spacing 8pt, radii, shadow, motion. Google Fonts import. Dark mode `[data-theme="night"]`.
- `src/main.tsx`: aggiunto `import './tokens.css'` prima di `import './styles.css'`.
- `src/styles.css`: riscrittura completa (628 righe inserite, 1008 rimosse):
  - Superfici: `var(--paper*)` al posto di tutti i blu navy/hex
  - Tipografia: `var(--ink-*)` al posto di `#f8fafc`, `#cbd5e1`, `#94a3b8`
  - Accento: `var(--sigillo)` bordeaux al posto di cyan `#38bdf8`
  - GiulIA: `var(--giulia-ink)` navy `#25527A` al posto di purple `#8b5cf6`
  - Rimossi tutti `backdrop-filter: blur()`, `transform: translateY()` su hover, `linear-gradient` sulle superfici
  - Tab bar: underline-only con barra bordeaux 2px sull'active (no pill/capsule)
  - Border-radius: `var(--radius-*)` su tutti i componenti; `999px` solo su pills/chips
  - Aula mode overlay: mantiene tema scuro intenzionale (corte)

**Build:** chunk invariati rispetto a Slice 4 — design-only, zero JS.

### Slice 4 — Bundle splitting + main.tsx extraction

**Frontend:**

- `src/config.ts` (NEW): costante `API` condivisa estratta da `main.tsx`.
- `src/domain/helpers.tsx` (NEW): `riskColor`, `riskLabel`, `riskIcon` — helper condivisi tra `CaseListView` (in `main.tsx`) e `CaseDetailView`.
- `src/components/MultiFileUploadDrawer.tsx` (NEW): drawer upload estratto e lazy-loaded.
- `src/components/ChatPanel.tsx` (NEW): `ChatDrawer`, `FloatingChatButton`, `FabRestoreButton` estratti (importati staticamente — il FAB deve essere sempre visibile).
- `src/components/GiuliaPromptBar.tsx` (NEW): barra GiulIA estratta (usata sia in `CaseListView` che in `CaseDetailView`).
- `src/screens/CaseDetailView.tsx` (NEW): tutto il sottoalbero di `CaseDetailView` estratto (~2870 righe): include `LegalAnalysisTab`, `RedactionDrawer`, `DraftingWorkspace`, `ExportCaseDrawer`, `AulaModeOverlay`, tutti gli helper UI (`Editable`, `StrengthBar`, ecc.).
- `vite.config.ts`: `manualChunks` per `vendor-react` e `vendor-supabase`.
- `scripts/check-draft-workspace-ui.mjs`: aggiornato per cercare i pattern in `CaseDetailView.tsx` invece di `main.tsx`.

**Risultati build:**

| Chunk | Prima | Dopo |
|---|---|---|
| `index.js` (main) | 564 KB / 161 KB gzip | 235 KB / 75 KB gzip |
| `CaseDetailView.js` | — | 97.9 KB / 27.9 KB gzip |
| `vendor-supabase.js` | — | 210.5 KB / 54.6 KB gzip |
| `MultiFileUploadDrawer.js` | — | 9.9 KB / 3.9 KB gzip |

Prima visita senza aprire un fascicolo: ~147 KB gzip (era 161 KB solo per il JS principale).
Il chunk CaseDetailView (97.9 KB) si carica solo al primo click su un fascicolo.

**Tutti i test passano:**
- `npm run test:plt-export` ✓
- `npm run test:local-case-scope` ✓
- `npm run test:draft-workspace` ✓
- `npm run test:draft-workspace-ui` ✓

### Slice 3 — Giurisprudenza di supporto + drawer redesign + URL fetch

**Backend:**

- `requirements.txt`: aggiunti `trafilatura`, `beautifulsoup4`.
- `models.py`: nuovo `FetchUrlRequest`; `AnalyzeMaterialInput` ha ora `category: Literal["fascicolo","giurisprudenza"] = "fascicolo"`.
- `main.py`: nuova route `POST /api/fetch-url` — scarica URL con httpx (timeout 15s, User-Agent browser), estrae testo con trafilatura (fallback beautifulsoup4), ritorna stesso shape di `/api/upload`.
- `ai_service.py`: `analyze_case()` separa materiali in sezioni distinte: `── DOCUMENTI FASCICOLO ──` e `── PRECEDENTI CARICATI DALL'AVVOCATO ──` (con nota: citabili con source_ref esplicita).

**Frontend:**

- `types.ts`: `category?: 'fascicolo' | 'giurisprudenza'` su `RawDocument`; `category: 'fascicolo' | 'giurisprudenza'` obbligatorio e `file: File | null` su `UploadQueueItem`.
- `caseContext.ts`: `buildCaseContext()` include sezione `PRECEDENTI CARICATI DALL'AVVOCATO` in chat context se presenti materiali giurisprudenziali.
- `main.tsx`: 
  - `handleAddFiles`: accetta secondo parametro `category` (default `'fascicolo'`).
  - `handleAddTextItem`: accetta terzo parametro `category`; `file` diventa `null` per testi incollati.
  - nuovo `handleAddUrlItem`: crea item in coda → chiama `POST /api/fetch-url` → salva in IndexedDB come `category: 'giurisprudenza'`.
  - `processItems`: gestisce `file: null` (item con testo già pronto, es. URL); porta `category` nel `RawDocument`.
  - Payload `/api/analyze-text`: passa `category` per ogni materiale.
  - `MultiFileUploadDrawer`: redesign completo con tab strip Documenti/Giurisprudenza, sezione URL import (con etichetta opzionale) nel tab Giurisprudenza, category badges (`[Fascicolo]` grigio / `[Precedente]` viola) sugli item in coda.
- `styles.css`: nuovi stili per tab strip, URL section, drop-zone viola variante, category badges.

### Slice 1 — FAB usability fix

- Raised FAB z-index from 200 to 350: il FAB è ora cliccabile anche quando la chat è aperta (era coperto dall'overlay a z-index 300).
- Aumentata soglia drag da 5px a 8px: meno falsi "drag" su touch che sopprimevano il click.
- Aggiunto dismiss zone su mobile: durante il drag su touch compare una zona ✕ in basso al centro; rilasciare il FAB sopra lo nasconde.
- Aggiunto menu contestuale desktop: right-click → "Nascondi".
- Aggiunto `FabRestoreButton`: quando il FAB è nascosto appare un pill "GiulIA" in basso a destra.
- Persistenza hidden state in `sessionStorage`.
- Fix `title` attribute placeholder ("Esegui azione" → "Apri GiulIA").
- Rimosso calcolo cursor errato basato su ref non-reattiva.

### Slice 2 — Strict Cassazione precedent ban + markdown refresh

**Prompt AI:**

- `PRECEDENT_GUARDRAIL` in `documentDrafts.ts` rinominato `STRICT_PRECEDENT_BAN` e riformulato con pattern "DIVIETO ASSOLUTO + percorso alternativo produttivo".
- Guardrail aggiunta a `DOC_PROMPTS.crossExam` (mancante) e a `DOC_PROMPTS.clienteNote` (mancante).
- Sezione `FONTI E PRECEDENTI` in `giulia.ts` e `ai_service.py` (`_DEFAULT_CHAT_SYSTEM`) aggiornata allo stesso pattern DIVIETO ASSOLUTO.
- `_PRO_POLICY` rafforzata con ABSOLUTE BAN + percorso alternativo esplicito.
- `_SYSTEM_PROMPT` (analisi backend): aggiunta regola 7 — DIVIETO ASSOLUTO su estremi Cassazione.
- `draftArtifacts.ts` invariato: `DRAFT_PRECEDENT_GUARDRAIL` era già il gold standard (P18).

**Markdowns:**

- `07-prompts/2026-05-26-plt-ai-prompts-map.md` aggiornato: P01, P02, P03, P07, P08, P13, P15, sezione hotspot Cassazione.
- `AGENTS.md` e `AGENT.md`: bullet Cassazione rafforzato; aggiunto reminder esplicito per aggiornare prompt map + CURRENT-TASK + READMEs a fine slice.
- `CLAUDE.md`: Verification discipline esteso con passi 7-10 (prompt map, CURRENT-TASK, READMEs, guardrail Cassazione check).
- `README.md` e `alpha-pwa/README.md`: aggiornati da "warns" a "strict ban".

---

## Verification already run

```text
cd alpha-pwa/frontend && npm run build
→ build succeeded, zero errori TypeScript

cd alpha-pwa/backend && python3 -m pytest tests/ -q
→ 23 passed (Slice 3)

git diff --check
→ clean
```

---

## Is anything left to do?

### Backlog attivo

0. **Pro routing/merge/hero/long-doc fix** — backend DeepSeek defaults previously routed both Flash and Pro to `deepseek-chat`, which means `mode: "pro"` could still hit the Flash-compatible model unless Render had `DEEPSEEK_PRO_MODEL` configured. This slice changes defaults to `deepseek-v4-flash` / `deepseek-v4-pro` and adds a regression test. It also changes the frontend Pro merge path so accepted Pro analysis replaces AI-derived Flash fields while preserving local-only data (`raw_documents`, redaction rules, drafts). The Flash/Pro selector now stays visible after an existing analysis, so the user can run `Rianalizza con Pro` even when no new documents were added. Flash and Pro now both use a 1M-character input budget (`PLT_FLASH_MAX_ANALYSIS_CHARS` / `PLT_PRO_MAX_ANALYSIS_CHARS`) and 128k generated-output-token defaults. `max_tokens` is generated output, not total context; total input+output still must fit the model context window. The frontend now surfaces backend 422 details instead of showing only the status code. The Pro recommendation card is hidden immediately after accept or refusal. If Render has an explicit `DEEPSEEK_PRO_MODEL=deepseek-chat`, update that environment variable to `deepseek-v4-pro`.
1. **E2E autenticato** — test manuale del flusso Pro sul live Netlify con caso demo/fittizio con contraddizioni.
4. **Lawyer validation** — validare con avvocati penalisti il copy del Pro recommendation flow e le aspettative sul flusso paid. Validare anche il flusso Giurisprudenza di supporto: il labeling `[Precedente]` è chiaro? I precedenti URL sono abbastanza affidabili? Serve disclaimer aggiuntivo?
5. **URL fetch per siti JS-heavy** — `trafilatura`/BeautifulSoup non funzionano su SPA/banche dati con rendering client-side (es. DeJure, Pluris). Gap noto; percorso produttivo futuro: copia-incolla manuale o integrazione banca dati ufficiale.
6. **Web search premium** — valutare se dare a GiulIA accesso a web search per i membri premium. Discussione aperta: vedi sezione sotto.

### Cassazione: stato attuale e gap residuo — aggiornato dopo Slice 3

Il pattern DIVIETO ASSOLUTO è ora applicato a tutti i prompt. Livelli di protezione attivi:

- **Livello 1 (verbale):** DIVIETO ASSOLUTO + percorso alternativo in ogni prompt AI.
- **Livello 2 (post-processing):** `flagUnverifiedCassationCitations()` in `draftArtifacts.ts` — regex detection + auto-marking DA VERIFICARE per gli artifact.
- **Livello 3 (metadata):** `claim_refs` con `status: 'da_verificare'` e `confidence: 0.2`.

Gap residuo produttivo: Le direzioni prodotto possibili:

1. GiulIA descrive il tipo di precedente utile e cosa cercare, senza inventare numeri — **implementato con DIVIETO + percorso alternativo**.
2. Upload sentenze come categoria fascicolo separata — **implementato in Slice 3**: tab Giurisprudenza nel drawer, category `giurisprudenza` propagata fino al prompt AI come sezione distinta `── PRECEDENTI CARICATI DALL'AVVOCATO ──`.
3. URL import sentenze da web — **implementato in Slice 3**: `POST /api/fetch-url` con trafilatura/BS4. Limite noto: banche dati giuridiche commerciali usano SPA con rendering JS, non accessibili con semplice HTTP fetch.
4. RAG su 500k sentenze Cassazione Penale — progetto separato di indexing/cleaning, non un prompt fix.

---

## Discussioni aperte (post-implementazione)

### Precedenti come categoria fascicolo separata

**Problema:** se GiulIA può fare riferimento solo ai materiali del fascicolo, l'avvocato deve poter caricare sentenze rilevanti come materiale di supporto — senza che l'AI le confonda con le prove del caso (verbali, atti giudiziari, etc.).

**Direzioni:**

- Aggiungere un tipo di materiale `precedente` / `giurisprudenza` distinto da `documento_caso`.
- GiulIA può citare i precedenti caricati con source_ref esplicita ("come da Cass. Pen. sez. I n. 1234/2023 caricata dall'avvocato").
- UI: sezione "Giurisprudenza di supporto" separata dalla sezione documenti fascicolo.
- Rischio: il modello potrebbe comunque confondere i due tipi. Serve labeling esplicito nel context builder e nel prompt.

### Web search premium per GiulIA

**Pro:**
- Risolverebbe parzialmente il gap Cassazione senza RAG proprietario.
- Differenziatore di valore per piano premium.
- Implementazione: tool use / function calling verso un search provider (Brave, Perplexity, Serper).

**Contro:**
- Risultati di ricerca non sono banche dati giuridiche ufficiali — rischio di citare fonti errate o secondarie.
- Latenza e costo aggiuntivi per ogni query.
- Aumenta la superficie di privacy (query legali escono verso search provider).
- Richiede disclaimer espliciti su affidabilità dei risultati.

**Raccomandazione provvisoria:** da validare con avvocati prima di implementare. Se si fa, il search deve essere trasparente (mostrare le fonti usate) e il risultato sempre labellato "da verificare".

---

## Guardrails for next PLT session

- Do not frame PLT as an "AI lawyer."
- Keep lawyer control explicit; outputs are drafts, not decisions.
- Keep source-linked factual claims and confidence language.
- Keep **Anonimizza** for privacy/redaction and reserve **Redigi** for legal drafting.
- Do not expose provider/model plumbing in ordinary lawyer-facing UI copy.
- Do not commit generated artifacts (`dist`, Android build outputs, `.gradle`, `.netlify`, Python `.venv`).
- Redact secrets from summaries and docs; `netlify.toml` contains deploy/env values.
- Ogni nuovo prompt AI deve includere il pattern DIVIETO ASSOLUTO per citazioni Cassazione.
- Aggiorna prompt map, CURRENT-TASK e READMEs a ogni slice significativo.
