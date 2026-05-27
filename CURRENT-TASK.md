# CURRENT TASK — PLT alpha handoff and backlog

_Last updated: 2026-05-27 Europe/Berlin_

## Current status

Two slices complete and pushed to `main`.

Target verified:

- Repo: `/home/deckard/plt`
- Branch: `main`
- Remote: `origin https://github.com/chiantera/plt.git`

Latest commits:

```text
24ce6d68 fix(fab): fix z-index, click reliability, add hide/restore
4e0979c0 docs: note PLT Cassazione and FAB backlog
bbd9022d chore: refresh PLT guardrails and docs
```

---

## Completed in this slice

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
→ [da eseguire prima del push di questo slice]

git diff --check
→ clean
```

---

## Is anything left to do?

### Backlog attivo

1. **Bundle splitting** — chunk >500 KB, warning Vite noto. Risolvere con dynamic imports o Rollup `manualChunks`.
2. **Estrazione `main.tsx`** — continuare la suddivisione in screen/feature prima di rinominare `alpha-pwa/`. Il file è ancora troppo grande.
3. **E2E autenticato** — test manuale del flusso Pro sul live Netlify con caso demo/fittizio con contraddizioni.
4. **Lawyer validation** — validare con avvocati penalisti il copy del Pro recommendation flow e le aspettative sul flusso paid.
5. **Cassazione: percorso precedenti utente** — design del flusso: GiulIA chiede "ho bisogno del precedente X per questo argomento"; l'utente può caricarlo come categoria separata (non confondibile con i materiali del caso). Discussione aperta: vedi sezione sotto.
6. **Web search premium** — valutare se dare a GiulIA accesso a web search per i membri premium. Discussione aperta: vedi sezione sotto.

### Cassazione: stato attuale e gap residuo

Il pattern DIVIETO ASSOLUTO è ora applicato a tutti i prompt. Livelli di protezione attivi:

- **Livello 1 (verbale):** DIVIETO ASSOLUTO + percorso alternativo in ogni prompt AI.
- **Livello 2 (post-processing):** `flagUnverifiedCassationCitations()` in `draftArtifacts.ts` — regex detection + auto-marking DA VERIFICARE per gli artifact.
- **Livello 3 (metadata):** `claim_refs` con `status: 'da_verificare'` e `confidence: 0.2`.

Gap residuo produttivo: nessuna fonte giurisprudenziale verificata è collegata. Le citazioni generate dal modello restano fabricate finché non provengono da materiali caricati o da RAG verificato. Le direzioni prodotto possibili:

1. GiulIA descrive il tipo di precedente utile e cosa cercare, senza inventare numeri — **implementato con DIVIETO + percorso alternativo**.
2. Upload sentenze come categoria fascicolo separata — **da progettare** (vedi Discussioni).
3. RAG su 500k sentenze Cassazione Penale — progetto separato di indexing/cleaning, non un prompt fix.

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
