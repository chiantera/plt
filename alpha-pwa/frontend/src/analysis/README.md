# Analysis progress banner — portable

A non-blocking, sticky-top banner shown while an AI analysis runs: spinner +
indeterminate progress bar + an abort button that confirms before stopping.

## Files

| File | Role |
|---|---|
| `AnalysisProgressBanner.tsx` | The banner. Owns only the confirm UI. |
| `analysis-progress.css` | Spinner / progress-bar / banner styles (design tokens). |

Only dependency: **React**.

## How it works (host vs component)

The **host** owns the analysis lifecycle; the **component** owns the confirm UI.

```tsx
const abortRef = useRef<AbortController | null>(null);
const [analyzing, setAnalyzing] = useState(false);

// in your analyze handler:
const controller = new AbortController();
abortRef.current = controller;
setAnalyzing(true);
try {
  await fetch(url, { signal: controller.signal, ... });
} finally {
  setAnalyzing(false);
  abortRef.current = null;
}

// render once, near the top of the screen:
<AnalysisProgressBanner analyzing={analyzing} onAbort={() => abortRef.current?.abort()} />
```

The progress bar is **indeterminate** (CSS `progress-slide` animation) — it shows
activity, not real percentage.

## Props

| Prop | | |
|---|---|---|
| `analyzing` | required | show/hide the banner |
| `onAbort` | required | called on confirmed abort (call `controller.abort()`) |
| `label` | opt | "Analisi AI in corso" |
| `abortLabel` | opt | "Rinuncia" |
| `confirmText` | opt | "Abbandonare l’analisi?" |
| `keepLabel` | opt | "Continua" |
| `confirmAbortLabel` | opt | "Abbandona" |

## Porting checklist

1. Copy the `analysis/` folder (2 files).
2. Provide the design tokens listed atop `analysis-progress.css` (or hardcode).
3. Render `<AnalysisProgressBanner .../>` once near the top of the analysis screen.
4. Wire an `AbortController` + `signal` into your analysis fetch; pass `onAbort`.
5. Override the copy props for the target domain.

## PLT notes (remove when porting)

- Used in `screens/CaseDetailView.tsx`; the host keeps `analyzing` + `analyzeAbortRef`.
- The `.analysis-overlay-bar` + `progress-slide` primitive is also reused by the
  draft-generating bar in the same screen.
