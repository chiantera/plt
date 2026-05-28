# PLT AI Prompts Map

Date: 2026-05-26; refreshed 2026-05-27 Europe/Berlin
Project inspected: `/home/deckard/plt/alpha-pwa`
Primary app surfaces: FastAPI backend + React/Vite frontend

This is the living inventory of PLT prompt and prompt-like AI call surfaces. Update it whenever prompt behavior, model routing, Flash/Pro policy, GiulIA framing, legal drafting, anonymization, OCR/STT routing, or cost/confirmation behavior changes.

## Executive summary

The app currently has four AI pathways:

1. **Case analysis / triage**
   - Endpoint: `POST /api/analyze-text`.
   - Backend source: `backend/app/ai_service.py`.
   - Goal: transform uploaded/extracted materials into a structured `CaseAnalysis` JSON.
   - Current framing: GiulIA as an Italian criminal-defense triage assistant, not legal authority.
   - Modes:
     - `flash`: extraction/structure, concise fields, no deep strategy by default.
     - `pro`: deeper reasoning over contradictions, procedural risks, defensive hypotheses, missing evidence, and next actions.

2. **Pro recommendation / confirmation gate**
   - Generated after standard analysis by `_build_pro_recommendation()`.
   - Frontend displays `Approfondimento Pro con GiulIA` when triggers exist.
   - Requires explicit user click before a `mode: 'pro'` analysis request.
   - Contract: `requires_confirmation: true`, `auto_charge: false`, alternate path `Continua con analisi standard`.

3. **GiulIA chat + drafting + anonymization**
   - Endpoint: `POST /api/chat`.
   - Backend default system: `backend/app/ai_service.py` → `_DEFAULT_CHAT_SYSTEM`.
   - Frontend system override: `frontend/src/prompts/giulia.ts` → `SYSTEM_PROMPT_IT`.
   - Prompt modules: `frontend/src/prompts/documentDrafts.ts`, `frontend/src/prompts/redaction.ts`, `frontend/src/draftArtifacts.ts`.
   - Current guardrail: backend/default chat, frontend/system chat, document draft prompts, and the draft workspace wrapper now all ban invented Cassazione citations and require verified citations or `DA VERIFICARE` / “giurisprudenza da verificare in banca dati”.

4. **Document/audio extraction services without app-authored natural-language prompts**
   - OCR: Mistral OCR via `backend/app/ocr_adapter.py`.
   - Audio: Groq Whisper via `backend/app/main.py`.
   - These are still privacy/data-transfer surfaces even without a PLT-authored prompt.

## Provider/API routing reference

### Backend model selection

File: `alpha-pwa/backend/app/ai_service.py`

- If `DEEPSEEK_API_KEY` is set:
  - SDK: OpenAI-compatible client.
  - base URL: `https://api.deepseek.com`.
  - flash model: `DEEPSEEK_DEFAULT_MODEL` or `deepseek-v4-flash`.
  - pro model: `DEEPSEEK_PRO_MODEL` or `deepseek-v4-pro`.
- Otherwise:
  - SDK: Anthropic.
  - flash model: `claude-haiku-4-5-20251001`.
  - pro model: `claude-opus-4-7`.

### Analysis token budgets

File: `alpha-pwa/backend/app/ai_service.py`

- `PLT_FLASH_MAX_TOKENS`, default `128000` generated-output tokens.
- `PLT_PRO_MAX_TOKENS`, default `128000` generated-output tokens.
- `PLT_FLASH_MAX_ANALYSIS_CHARS`, default `1000000` (`PLT_MAX_ANALYSIS_CHARS` remains a backward-compatible Flash override).
- `PLT_PRO_MAX_ANALYSIS_CHARS`, default `1000000`.
- `_truncate_materials()` truncates longest materials first and inserts an explicit truncation marker.

### Chat token budget

File: `alpha-pwa/backend/app/ai_service.py`

- `/api/chat` streaming uses `max_tokens=4096` for both DeepSeek/OpenAI-compatible and Anthropic paths.
- This may be too shallow for long drafting outputs, especially memorie/ricorsi.

## Shared context builders and prompt modules

### `buildCaseContext(c)`

File: `alpha-pwa/frontend/src/domain/caseContext.ts`

Used by:

- chat `system_override`;
- chat quick actions;
- draft workspace generation;
- redaction detection;
- contextual “Chiedi a GiulIA” actions.

Includes title, summary, people, timeline, charges, risk, strategies, procedural issues, witnesses, evidence balance, contradictions, open questions, urgent deadlines, and current `brief_markdown`.

Token-economy note: this remains the central duplication hotspot. Quick actions can send the same case context once in the user message and once in `system_override`.

### `buildUserContextMaterial(c)`

File: `alpha-pwa/frontend/src/domain/caseContext.ts`

Used by incremental `POST /api/analyze-text` to pass prior structured case state as a synthetic material.

Hard cap: `MAX_CONTEXT_CHARS = 8000`.

Synthetic material labels:

- `Analisi esistente consolidata — integra i nuovi documenti che seguono, aggiorna il brief_markdown.`
- `Annotazioni esistenti (inserite dall'avvocato — integrare, non sovrascrivere)`

## Prompt inventory

## P01 — Analysis Flash policy

File: `alpha-pwa/backend/app/ai_service.py`
Section: `_FLASH_POLICY`, selected by `_analysis_prompt_policy('flash')`
Endpoint: `POST /api/analyze-text`

Prompt text:

```text
Extract, structure, do not over-reason. Prefer concise fields. If uncertain, mark as candidate. Do not infer legal strategy. Do not cite case law or Cassazione decisions not present in the source materials.
```

Purpose:

- Keep standard analysis as extraction/triage, not deep legal strategy.
- Support cost-aware default behavior.

Risk/optimization note:

- The policy is English while the product and output are Italian. This is acceptable for model instruction, but a future prompt cleanup could translate/standardize all policy text.

## P02 — Analysis Pro policy

File: `alpha-pwa/backend/app/ai_service.py`
Section: `_PRO_POLICY`, selected by `_analysis_prompt_policy('pro')`
Endpoint: `POST /api/analyze-text`

Prompt text:

```text
Reason deeply across the entire case state. Identify contradictions, procedural risks, defensive hypotheses, missing evidence, and next actions. Tie every factual claim to source references. Mark assumptions explicitly.
ABSOLUTE BAN: never cite Cassazione case numbers, sections, or years not present in the uploaded case file. If a precedent would strengthen the argument but is unverified: describe the legal principle and statutory hook without fabricating extremes; write "orientamento giurisprudenziale da ricercare in banca dati". Flag any Cassazione citation not sourced from the case file as DA VERIFICARE.
```

Purpose:

- Reserve deep reasoning for confirmed Pro mode.
- Strict ban on invented Cassazione citations with explicit productive alternative path.

Good current behavior:

- Strongest analysis-side anti-hallucination guardrail.
- Same DIVIETO ASSOLUTO pattern now applied consistently across all chat/draft prompts.

## P03 — Full case analysis system prompt

File: `alpha-pwa/backend/app/ai_service.py`
Section: `_SYSTEM_PROMPT`
Endpoint: `POST /api/analyze-text`
Backend function: `analyze_case(request)`
Trigger: `Analizza con AI` / `Incorpora N documenti`; Pro confirmation click also calls this with `mode: 'pro'`.

Current prompt text:

```text
Sei GiulIA, assistente di triage per avvocati penalisti italiani. Non sei l'autorità legale:
organizzi il fascicolo, estrai elementi verificabili e prepari materiale controllabile dal difensore.
Il tuo compito è analizzare i materiali di un fascicolo difensivo e produrre un'analisi
strutturata completa in formato JSON valido.

REGOLE FONDAMENTALI:
1. Ogni affermazione deve essere collegata alla fonte specifica (source_refs).
2. Non inventare fatti non presenti nei materiali.
3. Segnala incertezze con confidence bassa (< 0.7) e stato candidate/needs_review.
4. La struttura JSON deve essere completa e validabile.
5. Usa la lingua specificata nel campo "language" della richiesta.
6. Non trasformare l'analisi standard in consulenza strategica: la strategia profonda è Pro.
7. DIVIETO ASSOLUTO: non citare estremi, sezioni, numeri o anni di sentenze Cassazione non presenti nei materiali. Se un precedente è rilevante ma non verificato: descrivi il principio senza inventare estremi.

OUTPUT: Restituisci SOLO JSON valido, nessun testo aggiuntivo prima o dopo.
```

Important correction from older map:

- The stale wording “diritto penale italiano e statunitense” is gone from this analysis prompt.
- The current prompt is Italian criminal-defense triage / lawyer-control framed.

What gets sent with it:

- `system`: this prompt.
- `user`: P04 below, including Flash/Pro policy and schema.
- `model`: `_model(request.mode)`.
- `max_tokens`: `_max_tokens(request.mode)`.

## P04 — Full case analysis user prompt + schema + policy injection

File: `alpha-pwa/backend/app/ai_service.py`
Sections: `_ANALYSIS_SCHEMA`, `analyze_case()` user-message assembly
Endpoint: `POST /api/analyze-text`

Template shape:

```text
Titolo del caso: {request.case_title}
Lingua output: {request.language}
Modalità: {request.mode}

POLITICA MODALITÀ:
{_analysis_prompt_policy(request.mode)}

MATERIALI DEL FASCICOLO:
{materials_text}

Analizza i materiali e restituisci un JSON completo conforme a questo schema:
{_ANALYSIS_SCHEMA}

Istruzioni specifiche:
- Estrai tutti gli eventi con date e orari precisi dalla documentazione.
- Identifica TUTTE le contraddizioni tra le fonti.
- Per ogni accusa/capo d'imputazione, analizza gli elementi costitutivi e la loro robustezza; assegna un charge_code chiaro (es. "Capo A").
- Proponi strategie difensive ordinate per priorità e collega ogni strategia al relativo capo con target_charge_id quando applicabile.
- Calcola i termini processuali come candidati da verificare; se applichi la sospensione feriale dei termini processuali (1-31 agosto), imposta feriale_applied=true e spiega la fonte.
- Segnala qualsiasi problema procedurale o costituzionale.
- Per ogni affermazione, includi la source_ref con la citazione esatta dal testo.
- L'analisi legale deve essere pratica e orientata all'udienza.
```

Frontend payload:

- Standard analysis: `mode: 'flash'`, `language: 'it'`.
- Pro analysis: frontend calls the same handler with `mode: 'pro'` only after explicit user click.
- `materials`: uploaded raw documents and, for incremental analysis, possibly `buildUserContextMaterial(caseData)`.

Optimization targets:

- The schema is still injected as a large hand-written JSON prompt. Provider-native structured output could reduce prompt tokens and parsing failures.
- The instruction “L'analisi legale deve essere pratica...” can blur Flash vs Pro boundaries. Keep Flash concise and candidate-marked; use Pro for heavy synthesis.

## P05 — Pro recommendation builder

File: `alpha-pwa/backend/app/ai_service.py`
Function: `_build_pro_recommendation(case, mode)`
Response model: `backend/app/models.py` → `ProRecommendation`
Endpoint result field: `case.pro_recommendation`

This is not a natural-language LLM prompt, but it directly controls when the app asks the user to buy/trigger deeper AI reasoning.

Trigger reasons currently detected:

- `contradictions`
- `candidate_deadline`
- `urgent_deadline`
- `serious_charge`
- `custody_or_precautionary_measure`
- `missing_key_document`
- `evidence_conflicts`
- `strategy_or_drafting_needed`

Generated message shape:

```text
Ho rilevato elementi che meritano un approfondimento: {reason labels}. Puoi continuare con l’analisi standard oppure avviare un’Analisi Pro.
```

Response contract:

```json
{
  "recommended": true,
  "reasons": ["..."],
  "message": "...",
  "cta_label": "Avvia Analisi Pro",
  "alternate_label": "Continua con analisi standard",
  "requires_confirmation": true,
  "auto_charge": false
}
```

Guardrail:

- If `mode == 'pro'`, recommendation returns `recommended: false`.
- Pro is a recommendation; it is not silently run and not auto-charged.

## P06 — Pro recommendation frontend card and confirmation path

File: `alpha-pwa/frontend/src/main.tsx`
Surfaces: `handleAnalyze(mode)`, `pro_recommendation` card rendering
UI copy: `Approfondimento Pro con GiulIA`, `Avvia Analisi Pro`, `Continua con analisi standard`

Behavior:

- Standard analysis sends `mode: 'flash'`.
- If backend returns a recommendation, the UI displays a card.
- Clicking `Avvia Analisi Pro` calls `handleAnalyze('pro')`.
- Clicking `Continua con analisi standard` hides the recommendation.

Risk/verification note:

- This needs live/authenticated E2E verification against a fictional/demo case with contradictions + candidate deadlines.
- It must remain confirmation-gated; no background Pro request on card render.

## P07 — Backend default GiulIA chat system prompt

File: `alpha-pwa/backend/app/ai_service.py`
Section: `_DEFAULT_CHAT_SYSTEM`
Endpoint: `POST /api/chat`
Used when frontend does not provide `system_override`.

Triggered by:

- draft workspace generation via `fetchChatFull()`;
- redaction detection/application via `fetchChatFull()`;
- any direct `/api/chat` caller without `system_override`.

Current policy:

- It frames GiulIA as “avvocata penalista con 25 anni...”.
- It now uses this strict citation guardrail (DIVIETO ASSOLUTO pattern):

```text
FONTI E PRECEDENTI:
- Cita norme specifiche quando pertinenti (art. X c.p. / art. X c.p.p.).
- DIVIETO ASSOLUTO: non citare mai estremi, sezioni, numeri o anni di sentenze Cassazione che non siano presenti nel fascicolo o nei materiali caricati.
- Se un precedente è utile ma non verificato: descrivi il principio giuridico e la norma di riferimento senza estremi; scrivi "orientamento giurisprudenziale da ricercare in banca dati".
- Qualsiasi citazione con numero o anno non proveniente dal fascicolo: marca DA VERIFICARE.
```

Residual risk:

- Privacy tasks and generic direct chat calls still inherit the legal persona when no task-specific `system_override` is provided.

Optimization target:

- Use smaller task-specific system prompts for privacy/anonymization.

## P08 — Frontend GiulIA chat system prompt with app-help instructions

File: `alpha-pwa/frontend/src/prompts/giulia.ts`
Section: `SYSTEM_PROMPT_IT`
Endpoint: `POST /api/chat`
Trigger: normal floating chat / home prompt bar / case chat via `sendToApi()`.

Adds:

- GiulIA persona;
- app-usage help instructions;
- fallback support email text;
- legal drafting format hints.

Current Cassazione guardrail (DIVIETO ASSOLUTO pattern, synced with P07):

```text
DIVIETO ASSOLUTO: non citare mai estremi, sezioni, numeri o anni di sentenze Cassazione che non siano presenti nel fascicolo o nei materiali caricati.
Se un precedente è utile ma non verificato: descrivi il principio giuridico e la norma di riferimento senza estremi; scrivi "orientamento giurisprudenziale da ricercare in banca dati".
Qualsiasi citazione con numero o anno non proveniente dal fascicolo: marca DA VERIFICARE.
```

What gets sent with it:

- `system_override: SYSTEM_PROMPT_IT` plus, if a case is active, `buildCaseContext(activeCaseData)` appended under `---`.
- All current chat messages.
- `mode: 'flash'`.

Optimization targets:

- Split app-help into a separate optional module; do not send it for every legal drafting/chat request.
- Stop duplicating case context when quick action user prompts already include it.

## P09 — Freeform user chat prompt

File: `alpha-pwa/frontend/src/main.tsx`
Section: `sendMessage(text)` / `sendToApi()`
Endpoint: `POST /api/chat`

Prompt shape:

```text
{user-entered text}
```

Payload:

- all accumulated chat messages plus new user message;
- frontend `system_override` from P08;
- case context in system when a case is active;
- `mode: 'flash'`.

Note:

- Chat history is local-state/localStorage based and case-bound.

## P10 — Document prompt: `memoria`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.memoria`
Triggered by: chat quick action “Memoria difensiva” and draft workspace “Memoria difensiva”.

Prompt tail asks for a complete Italian defensive brief with `INTESTAZIONE`, `IN FATTO`, `IN DIRITTO`, `CONCLUSIONI`, including specific norms and verified-or-`DA VERIFICARE` Cassazione precedents.

Current guardrail:

- Includes `PRECEDENT_GUARDRAIL`: do not invent precedents, numbers, or years; cite only verified/source-supported sentenze; otherwise mark `DA VERIFICARE` or “giurisprudenza da verificare in banca dati”.

## P11 — Document prompt: `cassazione`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.cassazione`
Triggered by: chat quick action “Ricorso Cassazione” and draft workspace “Ricorso Cassazione”.

Current instruction:

- Develop appeal grounds under art. 606 c.p.p.
- Include favorable Cassazione precedents only if verified; otherwise indicate legal research to verify.

Residual production gap:

- Ideally connect to verified legal research/RAG before asking for specific precedents.

## P12 — Document prompt: `eccezione`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.eccezione`
Triggered by: chat quick action “Eccezione procedurale” and draft workspace “Eccezione procedurale”.

Current guardrail:

- Asks for verified Cassazione support or jurisprudence to verify in a legal database.
- Includes the same `PRECEDENT_GUARDRAIL` used by the other document prompts.

## P13 — Document prompt: `crossExam`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.crossExam`
Triggered by: chat quick action “Controesame testimoni”, draft workspace card, witness-specific `Prepara controesame con GiulIA`.

Lower precedent risk, higher factual-source risk:

- Preserves source-linked witness facts and marks unknowns.
- Now includes `STRICT_PRECEDENT_BAN` (was previously missing — fixed in this slice).

## P14 — Document prompt: `strategy`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.strategy`
Triggered by: chat quick action “Strategia del caso”, legal drafting card “Analisi strategica”, next-deadline “Prepara con GiulIA”, fallback draft type.

Current guardrail:

- Asks for verified favorable jurisprudence or `DA VERIFICARE` / legal research to perform.
- Includes the same `PRECEDENT_GUARDRAIL` used by the other document prompts.

## P15 — Document prompt: `clienteNote`

File: `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
Section: `DOC_PROMPTS.clienteNote`
Triggered by: chat quick action “Nota per il cliente”.

Purpose:

- Plain-language client explanation.

Risk/guardrail:

- Must avoid definitive legal promises or hidden uncertainty.
- Now explicitly instructs the model not to cite specific sentenze or use legal jargon; no invented jurisprudence even in plain-language context (note added in this slice).

## P16 — Fallback contextual chat prompt

File: `alpha-pwa/frontend/src/main.tsx`
Section: `openChat(initialKeyOrText)`
Trigger: any `onOpenChat(text)` that is not a `DOC_PROMPTS` key.

Prompt shape with active case:

```text
{buildCaseContext(case)}

---
{initialKeyOrText}
```

Payload also includes P08 as `system_override`, which may include the same case context again.

Token-economy note:

- Clear duplication hotspot.

## P17 — Chat drawer quick action keys

File: `alpha-pwa/frontend/src/main.tsx`
Trigger: quick chips in the chat drawer.

Keys:

- `strategy`
- `memoria`
- `cassazione`
- `eccezione`
- `crossExam`
- `clienteNote`

Behavior:

- Calls `openChat(key)`.
- If key is in `DOC_PROMPTS`, sends P10-P15 as a user message.
- Also sends P08 as system override and existing chat history.

Risk:

- Unlike draft workspace, chat quick actions may miss P18 precedent guardrail.

## P18 — Draft workspace precedent/source guardrail

File: `alpha-pwa/frontend/src/draftArtifacts.ts`
Section: `DRAFT_PRECEDENT_GUARDRAIL`
Used by: `buildDraftPrompt()`.
Trigger: any draft workspace generation.

Prompt text:

```text
GUARDRAIL FONTI E PRECEDENTI
DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali.
Cita una sentenza solo se sei ragionevolmente certa dell'esistenza e dei dati minimi: Corte, sezione, numero, anno/data, principio rilevante.
Se non sei certa, NON citare numero o anno inventati. Scrivi invece: "Orientamento da verificare in banca dati prima del deposito" oppure "Giurisprudenza da ricercare/verificare".
Qualsiasi citazione Cassazione-like non supportata da fonte del fascicolo o memoria affidabile va marcata esplicitamente: DA VERIFICARE.
Non creare mai citazioni verosimili ma non verificate.
Per ogni affermazione fattuale sostanziale, collega la fonte se presente nel fascicolo; se manca, segnala che il punto è da verificare.
La bozza è materiale di lavoro: l'avvocato deve verificare fatti, norme, fonti, scadenze e precedenti prima del deposito.
```

Good current behavior:

- This is exactly the guardrail PLT needs.

Gap:

- It is not universal. Reuse it in backend/chat system prompts and chat quick actions.

## P19 — Draft workspace wrapper prompt

File: `alpha-pwa/frontend/src/draftArtifacts.ts`
Section: `buildDraftPrompt()`
Trigger: legal drafting cards, witness cross-exam, next-deadline preparation.

Assembly order:

1. base prompt tail (`DOC_PROMPTS` or custom witness/deadline tail);
2. title-fidelity instruction;
3. optional extra instruction;
4. optional anonymized-context instruction;
5. P18 precedent/source guardrail;
6. final Markdown editable draft instruction with “Verifiche prima del deposito”.

Payload:

- Single user message to `/api/chat`.
- `mode: 'flash'`.
- No `system_override`, so backend P07 applies.

Optimization target:

- For long legal drafts, consider a dedicated `task_type: 'draft_legal_act'` system prompt and larger output cap.

## P20 — Witness-specific cross-examination draft prompt

File: `alpha-pwa/frontend/src/main.tsx`
Trigger: “Prepara controesame con GiulIA” on a witness card.

Extra instruction shape:

```text
Preparami una sequenza di controesame per {witness_name} ({role}, credibilità {score}%). Testimonianza chiave: "{key_testimony}". Vulnerabilità note: {vulnerabilities or 'da sviluppare'}. Usa domande chiuse sì/no per massimizzare l'impatto.
```

Wrapped by P19 and protected by P18.

## P21 — Next-deadline / next-priority preparation draft prompt

File: `alpha-pwa/frontend/src/main.tsx`
Trigger: “Prepara con GiulIA” on the `Prossima priorità` deadline card.

Extra instruction shape:

```text
Prepara una bozza operativa sulla prossima priorità "{nextDeadline.title}" ({date/time}). Indica priorità difensive, documenti da portare o acquisire, atti da predisporre, rischi, verifiche fattuali e fonti da controllare. Descrizione scadenza/priorità: {description}
```

Important behavior:

- Uses `strategy` as the base prompt but passes the exact deadline title into the workspace title instruction.
- P19 forces Markdown H1/title fidelity.

## P22 — Redaction detection prompt

File: `alpha-pwa/frontend/src/prompts/redaction.ts`
Section: `REDACT_DETECT_PROMPT(caseCtx)`
Trigger: `Anonimizza` drawer → “Rileva dati sensibili con AI”.

Purpose:

- Identify personal/sensitive data in the case context.
- Return deterministic mapping lines in `ORIGINALE → SOSTITUZIONE` format.

Payload:

- Single user message to `/api/chat`.
- `mode: 'flash'`.
- No `system_override`, so backend P07 GiulIA persona applies.

Optimization target:

- Use a privacy-specific system prompt, not legal-drafting GiulIA persona.
- Consider deterministic local detection/rules plus AI suggestion, because anonymization is safety-critical.

## P23 — Redaction/anonymization application prompt

File: `alpha-pwa/frontend/src/prompts/redaction.ts`
Section: `REDACT_APPLY_PROMPT(text)`
Triggers: brief `Anonimizza`, raw-document anonymize button.

Prompt shape:

```text
Anonimizza il seguente testo giuridico italiano. Regole:
- Nomi propri di persone → [NOME_N] ...
...
Restituisci SOLO il testo anonimizzato, senza spiegazioni né prefissi.

TESTO:
{text}
```

Payload:

- Single user message to `/api/chat`.
- `mode: 'flash'`.
- No `system_override`, so backend P07 applies.

Risk:

- Anonymized view/export must not leak original `caseData`.
- AI redaction should be reviewable and reversible.

## P24 — Legal drafting cards prompt set

File: `alpha-pwa/frontend/src/main.tsx`
Trigger: cards under `Analisi legale` / “Redazione atti con AI”.

Cards:

- `memoria` — “Memoria difensiva”
- `cassazione` — “Ricorso Cassazione”
- `eccezione` — “Eccezione procedurale”
- `crossExam` — “Controesame”
- `strategy` — “Analisi strategica”

Behavior:

- Calls draft workspace flow, not just chat, when using `onOpenDraft`.
- Ends in P19/P18 with a persisted `DraftArtifact`.

Product note:

- This is the right direction: drafting actions should create durable editable artifacts, not giant chat prompts.

## P25 — OCR call: no app-authored natural-language prompt

File: `alpha-pwa/backend/app/ocr_adapter.py`
Endpoint: indirectly by `POST /api/upload`
Trigger: scanned PDF or image-like unsupported file after text extraction fails or is not applicable.

Payload shape:

```python
client.ocr.process(
    model="mistral-ocr-latest",
    document={"type": doc_type, doc_type: data_url},
)
```

No PLT natural-language prompt is authored here.

Privacy note:

- File bytes leave the backend/device boundary to Mistral on this path.

## P26 — Audio transcription call: no app-authored natural-language prompt

File: `alpha-pwa/backend/app/main.py`
Endpoint: `POST /api/transcribe`
Trigger: audio upload/transcription flow.

Payload shape:

```python
client.audio.transcriptions.create(
    file=(filename, content),
    model="whisper-large-v3-turbo",
    language="it",
    response_format="text",
)
```

No PLT natural-language prompt is authored here.

Privacy note:

- Audio bytes leave the backend/device boundary to Groq on this path.

## Potential prompt duplication / token-economy hotspots

1. **Case context duplicated in chat quick actions**
   - `openChat(key)` puts `buildCaseContext(case)` inside the user message via `DOC_PROMPTS[key](ctx)`.
   - `sendToApi()` also puts `buildCaseContext(case)` inside `system_override`.

2. **`brief_markdown` included repeatedly**
   - `buildCaseContext()` includes the current brief.
   - `buildUserContextMaterial()` includes the current brief within its 8k cap.
   - Drafting and chat prompts may carry old generated material repeatedly.

3. **Legal persona applied to privacy tasks**
   - Redaction detection/application use `/api/chat` without `system_override`, so backend applies the GiulIA legal/drafting persona.

4. **Cassazione citation — DIVIETO ASSOLUTO now applied across all prompts**
   - All prompts (P01–P15) now use the strict ban pattern: DIVIETO ASSOLUTO + productive alternative path (descrivi il principio, scrivi "orientamento da ricercare").
   - `PRECEDENT_GUARDRAIL` renamed `STRICT_PRECEDENT_BAN` in `documentDrafts.ts`; crossExam and clienteNote now covered (were previously missing).
   - `DA VERIFICARE` and `flagUnverifiedCassationCitations()` in `draftArtifacts.ts` remain as post-processing safety net.
   - P18 (`DRAFT_PRECEDENT_GUARDRAIL`) remains the gold standard for draft artifacts.
   - Remaining production gap: no verified legal research/RAG source is connected. Lawyer/database verification still required for specific precedents. Model-generated Cassazione citations must be treated as fabricated unless the source is in the fascicolo.

5. **Analysis schema is very verbose**
   - P04 injects a large schema every time.
   - Provider-native JSON schema / structured output could reduce prompt tokens and parsing failures.

6. **Draft generation output cap**
   - `/api/chat` streaming max tokens remains `4096` regardless of draft type.

## Suggested optimization order

1. **Task-specific prompt routing**
   - `chat_general`
   - `draft_legal_act`
   - `redaction_detect`
   - `redaction_apply`
   - `case_analysis_flash`
   - `case_analysis_pro`

2. **Stop duplicating case context**
   - For quick actions, send context either in the system prompt or in the user prompt, not both.
   - Create compact context variants per task.

3. **Separate app-help from legal persona**
   - Do not send app usage docs for every legal response.

4. **Make privacy flows deterministic-first**
   - AI can suggest candidates; user should review and export anonymized copies explicitly.

5. **Structured output for analysis**
   - Replace or supplement prompt-injected schema with provider-native structured output where reliable.

6. **Dedicated output budget for drafting**
   - Long memorie/ricorsi may need a non-chat endpoint or larger completion budget.

## Files inspected for this map

- `alpha-pwa/backend/app/ai_service.py`
- `alpha-pwa/backend/app/models.py`
- `alpha-pwa/backend/app/main.py`
- `alpha-pwa/backend/app/ocr_adapter.py`
- `alpha-pwa/frontend/src/main.tsx`
- `alpha-pwa/frontend/src/domain/caseContext.ts`
- `alpha-pwa/frontend/src/prompts/giulia.ts`
- `alpha-pwa/frontend/src/prompts/documentDrafts.ts`
- `alpha-pwa/frontend/src/prompts/redaction.ts`
- `alpha-pwa/frontend/src/draftArtifacts.ts`

Generated/build artifacts under `frontend/dist/` are not source of truth.

## Stale historical prompt file

`07-prompts/extraction-prompts.md` remains a rough 2026-05-20 sketch file. It is useful background only and explicitly says not to treat it as final. This map and the source files above are the current prompt source-of-truth.
