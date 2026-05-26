# PLT AI Prompts Map

Date: 2026-05-26
Project inspected: `/home/deckard/plt/alpha-pwa`
Primary app surfaces: FastAPI backend + React/Vite frontend

This map inventories the prompts and prompt-like AI calls currently present in the alpha app. It records where each prompt lives, what user action triggers it, what the prompt tries to achieve, and what is sent to the provider/API together with the prompt.

## Executive summary

The app currently has three main AI pathways:

1. **Case analysis / triage**
   - Endpoint: `POST /api/analyze-text`
   - Backend prompt: `backend/app/ai_service.py`
   - Goal: turn uploaded/extracted materials into a full structured `CaseAnalysis` JSON.
   - Provider: DeepSeek if `DEEPSEEK_API_KEY` exists; otherwise Anthropic.

2. **GiulIA chat + drafting + anonymization**
   - Endpoint: `POST /api/chat`
   - Backend system default: `backend/app/ai_service.py`
   - Frontend often passes `system_override`: `frontend/src/main.tsx`
   - Goal: free chat, quick actions, redazione atti, draft workspace generation, privacy detection, anonymization.

3. **Document/audio extraction services without app-authored natural-language prompts**
   - OCR: `Mistral OCR` via `client.ocr.process(model="mistral-ocr-latest", document=...)`.
   - Audio: Groq Whisper via `client.audio.transcriptions.create(model="whisper-large-v3-turbo", language="it", response_format="text")`.
   - These send files/audio to external APIs, but the app does **not** author a natural-language prompt for them.

Important architectural note: several high-value legal drafting prompts are duplicated/reused in different ways:

- `DOC_PROMPTS` is used by both chat quick actions and the new draft workspace.
- Draft workspace wraps `DOC_PROMPTS` with `buildDraftPrompt()` guardrails.
- Some drafting calls use `/api/chat` without `system_override`, so the backend default GiulIA system prompt applies instead of the richer frontend `SYSTEM_PROMPT_IT`.

---

## Provider/API routing reference

### Backend model selection

File: `alpha-pwa/backend/app/ai_service.py:23-53`

- If `DEEPSEEK_API_KEY` is set:
  - client: OpenAI-compatible SDK
  - base URL: `https://api.deepseek.com`
  - flash model: `DEEPSEEK_DEFAULT_MODEL` or `deepseek-chat`
  - pro model: `DEEPSEEK_PRO_MODEL` or `deepseek-chat`
- Otherwise:
  - client: Anthropic SDK
  - flash model: `claude-haiku-4-5-20251001`
  - pro model: `claude-opus-4-7`

### DeepSeek/OpenAI-compatible chat completion payloads

File: `alpha-pwa/backend/app/ai_service.py:261-267`

```python
client.chat.completions.create(
    model=model,
    max_tokens=max_tokens,
    messages=[
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ],
)
```

Streaming chat payload:

File: `alpha-pwa/backend/app/ai_service.py:300-307`

```python
client.chat.completions.create(
    model=model,
    max_tokens=4096,
    messages=[{"role": "system", "content": system}, *messages],
    stream=True,
)
```

### Anthropic message payloads

File: `alpha-pwa/backend/app/ai_service.py:274-279`

```python
client.messages.create(
    model=model,
    max_tokens=max_tokens,
    system=system,
    messages=[{"role": "user", "content": user}],
)
```

Streaming chat payload:

File: `alpha-pwa/backend/app/ai_service.py:315-320`

```python
client.messages.stream(
    model=model,
    max_tokens=4096,
    system=system,
    messages=messages,
)
```

---

## Shared context builders

These are not prompts by themselves, but they are injected into many prompts and dominate token cost.

### `buildCaseContext(c)`

File: `alpha-pwa/frontend/src/main.tsx:125-172`

Used by:

- chat system override;
- chat quick actions;
- draft workspace generation;
- redaction detection;
- some contextual “Chiedi a GiulIA” actions.

What it includes:

- case title;
- summary;
- people/parties;
- timeline;
- charges;
- risk level and risk summary;
- defense strategies;
- constitutional/procedural issues;
- witness assessments;
- evidence balance;
- contradictions;
- open questions;
- urgent deadlines only;
- current `brief_markdown`.

Template shape:

```text
FASCICOLO: {case_title}

SINTESI: {case_summary}

PARTI:
• {name} ({role}): {notes}

CRONOLOGIA:
• [{date} {time}] {title}: {description}

ACCUSE:
• {charge_code} — {charge_name} (max: {max_sentence})

RISCHIO: {risk_level} — {risk_summary}

STRATEGIE DIFENSIVE:
• [{priority}] {title}: {description}

QUESTIONI PROCEDURALI:
• {title} ({severity})
  Base legale: {legal_basis}
  Rimedio: {remedy}

TESTIMONI:
• {witness_name} ({role}, credibilità {score}%): {key_testimony}

BILANCIAMENTO PROVE:
  Accusa: {score}% — {items}
  Difesa: {score}% — {items}
  Lacune critiche: {items}

CONTRADDIZIONI:
• {title}: {description}

DOMANDE APERTE:
• {question} — perché conta: {why_it_matters}

SCADENZE URGENTI:
• {date} {time} — {title} ({deadline_type}): {description}

PROMEMORIA DIFENSIVO CORRENTE:
{brief_markdown}
```

Token-economy note: this is unbounded except by whatever data is present in the case. It includes full current `brief_markdown`, which can become expensive when used in every chat/drafting call.

### `buildUserContextMaterial(c)`

File: `alpha-pwa/frontend/src/main.tsx:265-290`

Used by incremental `POST /api/analyze-text` to pass prior structured case state as a synthetic material.

What it includes:

- existing case summary;
- people;
- timeline;
- evidence;
- contradictions;
- open questions;
- missing documents;
- procedural deadlines;
- current brief markdown.

Hard cap:

```ts
const MAX_CONTEXT_CHARS = 8000;
```

If longer, it appends:

```text
[...contesto troncato per limite di lunghezza — i nuovi documenti sono prioritari...]
```

Synthetic material names:

- Incremental existing analysis: `Analisi esistente consolidata — integra i nuovi documenti che seguono, aggiorna il brief_markdown.`
- Lawyer-entered annotations / pre-analysis context: `Annotazioni esistenti (inserite dall'avvocato — integrare, non sovrascrivere)`

---

# Prompt inventory

## P01 — Full case analysis system prompt

File: `alpha-pwa/backend/app/ai_service.py:58-71`
Section: `_SYSTEM_PROMPT`
Endpoint: `POST /api/analyze-text`
Backend function: `analyze_case(request)`
Trigger in UI: click `Analizza con AI` / `Incorpora N documenti` in a case.

What it tries to achieve:

- Force the model to behave as a legal case-analysis extractor.
- Require valid JSON only.
- Require source references and uncertainty handling.

Prompt text:

```text
Sei un assistente legale AI specializzato in diritto penale italiano e statunitense.
Il tuo compito è analizzare i materiali di un fascicolo difensivo e produrre un'analisi
strutturata completa in formato JSON valido.

REGOLE FONDAMENTALI:
1. Ogni affermazione deve essere collegata alla fonte specifica (source_refs).
2. Non inventare fatti non presenti nei materiali.
3. Segnala incertezze con confidence bassa (< 0.7).
4. La struttura JSON deve essere completa e validabile.
5. Usa la lingua specificata nel campo "language" della richiesta.

OUTPUT: Restituisci SOLO JSON valido, nessun testo aggiuntivo prima o dopo.
```

What gets sent with it:

- `system`: this prompt.
- `user`: P02 below.
- `model`: `_model(request.mode)`.
- `max_tokens`: `PLT_FLASH_MAX_TOKENS` default `32000` or `PLT_PRO_MAX_TOKENS` default `64000`.
- If DeepSeek: OpenAI-style messages.
- If Anthropic: Anthropic `system` + user message.

Notes:

- The prompt says Italian and US criminal law. For PLT’s current Italian-first criminal-defense product, the US-law reference is probably noise.
- It asks for JSON only, but JSON mode / schema-constrained output is not used.

---

## P02 — Full case analysis user prompt + schema

File: `alpha-pwa/backend/app/ai_service.py:73-101` and `194-214`
Sections: `_ANALYSIS_SCHEMA`, `user_message`
Endpoint: `POST /api/analyze-text`
Trigger in UI: click `Analizza con AI` / `Incorpora N documenti`.

What it tries to achieve:

- Feed uploaded/extracted materials to the model.
- Force a comprehensive `CaseAnalysis` JSON structure.
- Extract timeline, people, evidence, questions, contradictions, deadlines, brief, and legal analysis.

Frontend payload that triggers it:

File: `alpha-pwa/frontend/src/main.tsx:3233-3237`

```ts
fetch(`${API}/api/analyze-text`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    case_title: caseData.case_title,
    materials,
    mode: 'flash',
    language: 'it',
  }),
});
```

`materials` are built as:

- fresh analysis: every `raw_documents[]` item as `{ name, kind: 'text', text }`;
- incremental analysis: only new documents, plus the synthetic `buildUserContextMaterial(caseData)` if available.

Backend input handling:

- File: `alpha-pwa/backend/app/ai_service.py:181-193`
- Materials are truncated by `_truncate_materials()` to `PLT_MAX_ANALYSIS_CHARS`, default `60000`.
- Each material becomes:

```text
=== {m.name} ({m.kind}) ===
{m.text}
```

Prompt template:

```text
Titolo del caso: {request.case_title}
Lingua output: {request.language}
Modalità: {request.mode}

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

Schema injected into the prompt:

```json
{
  "case_id": "string (slug from title)",
  "case_title": "string",
  "language": "it|en",
  "case_summary": "string (2-3 sentences)",
  "materials": [{"id":"str","name":"str","kind":"text|pdf|image|audio","description":"str","excerpt":"str","content":"str"}],
  "timeline": [{"date":"YYYY-MM-DD|null","time":"HH:MM|null","title":"str","description":"str","source_refs":[{"source_name":"str","page":1,"chunk":"str|null","quote":"str","confidence":0.0-1.0}],"confidence":0.0-1.0}],
  "people": [{"name":"str","role":"str","notes":"str","source_refs":[...]}],
  "evidence": [{"title":"str","status":"str","notes":"str","source_refs":[...]}],
  "open_questions": [{"question":"str","why_it_matters":"str","source_refs":[...]}],
  "missing_documents": [{"title":"str","reason":"str","priority":"alta|media|bassa"}],
  "contradictions": [{"title":"str","description":"str","source_refs":[...]}],
  "procedural_deadlines": [{"title":"str","deadline_type":"hearing|defense_brief|filing|investigation|other","due_date":"YYYY-MM-DD","due_time":"HH:MM|null","status":"confirmed|candidate|needs_review","urgency":"alta|media|bassa","description":"str","feriale_applied":false,"start_work_date":"YYYY-MM-DD|null","internal_target_date":"YYYY-MM-DD|null","source_refs":[...],"tasks":["str"]}],
  "brief_markdown": "string (markdown)",
  "usage_estimate": {"pages":0,"audio_minutes":0,"flash_input_tokens":0,"flash_output_tokens":0,"pro_used":false,"model_route":"str"},
  "legal_analysis": {
    "risk_level": "low|medium|high|critical",
    "risk_summary": "str",
    "immediate_actions": ["str"],
    "charges": [{"charge_code":"str","charge_name":"str","max_sentence":"str","elements_required":[{"element":"str","description":"str","status":"proven|disputed|weak|missing","notes":"str","source_refs":[...]}],"available_defenses":["str"],"prosecution_strength":0.0-1.0,"notes":"str","source_refs":[...]}],
    "strategies": [{"title":"str","target_charge_id":"str|null","strategy_type":"alibi|misidentification|lack_of_intent|procedural|constitutional|affirmative|negotiation","priority":"primary|secondary|fallback","description":"str","strengths":["str"],"risks":["str"],"required_evidence":["str"],"source_refs":[...]}],
    "constitutional_issues": [{"title":"str","issue_type":"illegal_search|coerced_confession|right_to_counsel|due_process|speedy_trial|procedural_violation|evidence_tampering","severity":"critical|significant|minor","description":"str","legal_basis":"str","remedy":"str","source_refs":[...]}],
    "witness_assessments": [{"witness_name":"str","role":"prosecution|defense|neutral|expert","credibility_score":0.0-1.0,"key_testimony":"str","strengths":["str"],"vulnerabilities":["str"],"cross_examination_angles":["str"],"source_refs":[...]}],
    "evidence_balance": {"prosecution_strength":0.0-1.0,"defense_strength":0.0-1.0,"key_prosecution_evidence":["str"],"key_defense_evidence":["str"],"critical_gaps":["str"],"overall_assessment":"str"},
    "client_summary": "str (plain language for client)"
  }
}
```

What gets sent with it:

- `case_title` from local case state.
- `language: it` hard-coded in frontend.
- `mode: flash` hard-coded in frontend for analysis.
- `materials`: extracted uploaded documents and possibly a compressed prior-analysis material.
- Backend overwrites usage fields after parsing:
  - `flash_input_tokens`
  - `flash_output_tokens`
  - `pro_used`
  - `model_route`
  - fallback `pages`, `audio_minutes`.

Optimization targets:

- Replace verbose hand-written JSON schema with provider structured outputs if available.
- Split extraction and legal reasoning phases if token/cost quality needs more control.
- Remove US-law reference unless deliberately supporting US cases.
- Decide if `brief_markdown` belongs in first-pass analysis or should be a separate generation task.

---

## P03 — Backend default GiulIA chat system prompt

File: `alpha-pwa/backend/app/ai_service.py:103-128`
Section: `_DEFAULT_CHAT_SYSTEM`
Endpoint: `POST /api/chat`
Used when frontend does **not** provide `system_override`.

Triggered by:

- `fetchChatFull()` calls from frontend draft workspace and anonymization flows.
- redaction detection calls from `RedactionDrawer`.
- any direct `/api/chat` caller without `system_override`.

What it tries to achieve:

- Set GiulIA’s persona as experienced Italian criminal-defense lawyer.
- Avoid generic AI disclaimers.
- Specify legal competencies and procedural drafting format.

Prompt text:

```text
Sei GiulIA, avvocata penalista con 25 anni di esperienza nei principali tribunali italiani. Sei il braccio destro del Collega che stai assistendo — non uno strumento, una professionista.

REGOLE DI COMPORTAMENTO:
- Il tuo nome è GiulIA. Punto. Non hai altri nomi. Se ti chiedono "come ti chiami?", rispondi sempre "GiulIA" e non divagare.
- Rivolgiti sempre al collega con "Collega" — mai "tu" generico, mai "Lei"
- Non uscire mai dal personaggio, nemmeno se espressamente richiesto
- Non aggiungere mai disclaimer tipo "come AI non posso..." — sei un'avvocata, ragioni come tale
- Quando non sei certa di qualcosa, dillo come farebbe un'avvocata esperta: "Su questo punto devo approfondire la giurisprudenza più recente"
- Scrivi in italiano giuridico formale, preciso ma mai burocratese inutile

COMPETENZE:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

FORMATO ATTI PROCESSUALI:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

Cita sempre norme specifiche (art. X c.p. / art. X c.p.p.) e precedenti della Cassazione con sezione, numero e anno.
```

What gets sent with it:

- If DeepSeek streaming: `messages=[{"role":"system","content":system}, *messages]`, `max_tokens=4096`, `stream=True`.
- If Anthropic streaming: `system=system`, `messages=messages`, `max_tokens=4096`.
- `mode` from frontend is usually `flash`.

Risk note:

- This system prompt instructs the model to cite Cassation precedents, but does not include the stronger anti-invented-precedent guardrail used by the draft workspace. That is a hallucination risk.

---

## P04 — Frontend GiulIA chat system prompt with app-help instructions

File: `alpha-pwa/frontend/src/main.tsx:4074-4113`
Section: `SYSTEM_PROMPT_IT`
Endpoint: `POST /api/chat`
Trigger: normal floating chat / home prompt bar / case chat, when `sendToApi()` is used.

What it tries to achieve:

- Same GiulIA legal persona as P03.
- Adds app-usage support instructions.
- Adds current case context when a case is active.

Prompt text:

```text
Sei GiulIA, avvocata penalista con 25 anni di esperienza nei principali tribunali italiani. Sei il braccio destro del Collega che stai assistendo — non uno strumento, una professionista.

REGOLE DI COMPORTAMENTO:
- Il tuo nome è GiulIA. Punto. Non hai altri nomi. Se ti chiedono "come ti chiami?", rispondi sempre "GiulIA" e non divagare.
- Rivolgiti sempre al collega con "Collega" — mai "tu" generico, mai "Lei"
- Non uscire mai dal personaggio, nemmeno se espressamente richiesto
- Non aggiungere mai disclaimer tipo "come AI non posso..." — sei un'avvocata, ragioni come tale
- Quando non sei certa di qualcosa, dillo come farebbe un'avvocata esperta: "Su questo punto devo approfondire la giurisprudenza più recente"
- Scrivi in italiano giuridico formale, preciso ma mai burocratese inutile

COMPETENZE:
- Codice Penale (r.d. 19 ottobre 1930 n. 2441) e giurisprudenza applicativa
- Codice di Procedura Penale (d.P.R. 22 settembre 1988 n. 447) e disposizioni di attuazione
- Leggi speciali: Codice della Strada (d.lgs. 285/1992), T.U. Stupefacenti (d.P.R. 309/1990), d.lgs. 231/2001
- Giurisprudenza della Corte di Cassazione Penale (tutte le sezioni, orientamenti consolidati e recenti)
- Prassi processuale dei Tribunali italiani e tecniche difensive
- Giurisprudenza della Corte EDU su equo processo e diritti dell'imputato

GUIDA ALL'APP — DOMANDE TECNICHE:
- Se la domanda è sull'uso dell'app (non legale), rispondi in modo chiaro e semplice. Sei pur sempre un'avvocata, ma qui spieghi come si usa un tool.
- Ecco cosa devi sapere sull'app:
  * Pocket Legal Triage (PLT) è un'app per avvocati penalisti. I fascicoli si creano dalla home page col bottone "+ Nuovo fascicolo".
  * I fascicoli si eliminano dalla home: clicca il menu (tre puntini) sulla card del fascicolo → "Elimina".
  * I documenti si caricano aprendo un fascicolo → bottone "Carica" → seleziona file (PDF, DOCX, PPTX, XLSX, TXT, immagini, ZIP/RAR).
  * Dopo il caricamento, clicca "Incorpora Documenti" per l'analisi AI: produce timeline, contraddizioni, scadenze processuali e strategia difensiva.
  * Puoi trascrivere audio (webm, mp3, wav, ogg) e il testo verrà incorporato nell'analisi.
  * "Incorpora Documenti" analizza TUTTI i documenti caricati nel fascicolo in un colpo solo.
  * La chat GiulIA è sempre disponibile: clicca "Chatta" nella card in home page o l'icona fluttuante in basso a destra.
  * I messaggi della chat sono legati al fascicolo aperto. Cambiando fascicolo la cronologia si resetta.
  * Quick actions disponibili in chat: "Analisi", "Memoria", "Ricorso Cassazione", "Scadenze", "Imposta".
- Se un utente chiede qualcosa che non sai o che esula dalle tue competenze (app o legali), rispondi:
  "Non ho una risposta pronta su questo punto. Ti invito a scrivere a studiolegale.ai@gmail.com per ricevere assistenza."

FORMATO ATTI PROCESSUALI:
- Memorie: INTESTAZIONE, IN FATTO, IN DIRITTO, CONCLUSIONI
- Ricorsi Cassazione: motivi ex art. 606 c.p.p. con sezione e numero
- Eccezioni: norma violata, tipo di vizio (nullità/inutilizzabilità/inammissibilità), rimedio

Cita sempre norme specifiche (art. X c.p. / art. X c.p.p.) e precedenti della Cassazione con sezione, numero e anno.
```

What gets sent with it:

File: `alpha-pwa/frontend/src/main.tsx:4190-4203`

```ts
const caseCtx = activeCaseData ? buildCaseContext(activeCaseData) : null;
const systemWithCtx = caseCtx
  ? `${SYSTEM_PROMPT_IT}\n\n---\n${caseCtx}`
  : SYSTEM_PROMPT_IT;

fetch(`${API}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    system_override: systemWithCtx,
    mode: 'flash',
  }),
});
```

Message payload:

- all current chat messages from local state as `{ role, content }`;
- if a case is active, case context is duplicated into the system prompt;
- `mode: flash`.

Optimization targets:

- The app-help text may be useful in general chat but is irrelevant for legal drafting and consumes tokens.
- The prompt still asks to cite Cassation precedents with exact section/number/year but lacks “do not invent” guardrails.
- If a quick action already includes full case context in the user message, the same case context may also appear in `system_override`, causing duplication.

---

## P05 — Freeform user chat prompt

File: `alpha-pwa/frontend/src/main.tsx:4175-4179`
Section: `sendMessage(text)`
Endpoint: `POST /api/chat`
Trigger: user types in chat drawer and sends.

Prompt shape:

```text
{user-entered text}
```

What gets sent with it:

- frontend sends all accumulated `chat.messages` plus the new user message;
- frontend adds `system_override` from P04;
- if a case is active, P04 includes `buildCaseContext(activeCaseData)`;
- `mode: flash`.

Useful note:

- Chat history is persisted in `localStorage` under `plt_chat_messages`.
- The app resets chat messages when switching fascicolo, but history persists within the same active case.

---

## P06 — Chat quick action / document prompt: `memoria`

File: `alpha-pwa/frontend/src/main.tsx:200-202`
Section: `DOC_PROMPTS.memoria`
Triggered by:

- Chat quick action “Memoria difensiva” in `ChatDrawer`.
- Legal drafting card “Memoria difensiva”.
- Any call to `openChat('memoria')` or `handleOpenDraftWorkspace('memoria', ...)`.

Prompt text:

```text
{buildCaseContext(case)}

---
Redigi una memoria difensiva completa per questo caso. Struttura l'atto secondo il formato italiano standard:

**INTESTAZIONE** (Tribunale competente, numero procedimento, imputato, difensore)
**IN FATTO** — narrazione precisa dei fatti rilevanti per la difesa
**IN DIRITTO** — motivi giuridici articolati, con:
  - Citazioni normative specifiche (art. X c.p. / art. X c.p.p.)
  - Precedenti della Cassazione Penale (sezione, numero, anno)
  - Interpretazioni dottrinali rilevanti
**CONCLUSIONI** — richieste formali al giudice

Scrivi in italiano giuridico formale. Sii specifico e approfondito, non generico.
```

What gets sent with it:

- In chat quick action path: this full text becomes a user message; `/api/chat` also receives P04 as `system_override` plus chat history.
- In draft workspace path: this is passed as `promptTail(ctx)` into P14, then `/api/chat` receives a single user message and backend default P03 system.

Optimization target:

- “Precedenti Cassazione” request should be paired with an explicit no-invented-precedents rule in both chat and draft paths.

---

## P07 — Chat quick action / document prompt: `cassazione`

File: `alpha-pwa/frontend/src/main.tsx:203-204`
Section: `DOC_PROMPTS.cassazione`
Triggered by:

- Chat quick action “Ricorso Cassazione”.
- Legal drafting card “Ricorso Cassazione”.

Prompt text:

```text
{buildCaseContext(case)}

---
Predisponi un ricorso per Cassazione avverso eventuale sentenza di condanna. Sviluppa i motivi di ricorso ex art. 606 c.p.p. più solidi per questo caso. Per ogni motivo:

**MOTIVO N. X — [tipo ex lett. a/b/c/d/e art. 606 c.p.p.]**
  - Formulazione tecnica del motivo
  - Norma o principio violato
  - Argomentazione sviluppata
  - Precedenti della Cassazione favorevoli (cita sezione e numero)

Concentrati sui vizi di legittimità più fondati: violazione di legge (lett. b), vizio di motivazione (lett. e), inutilizzabilità prove (lett. c).
```

What gets sent with it:

- Same payload patterns as P06.

Optimization target:

- This is high-risk because it requests specific precedents. It needs guardrails or retrieval/source constraints before any production use.

---

## P08 — Chat quick action / document prompt: `eccezione`

File: `alpha-pwa/frontend/src/main.tsx:205-206`
Section: `DOC_PROMPTS.eccezione`
Triggered by:

- Chat quick action “Eccezione procedurale”.
- Legal drafting card “Eccezione procedurale”.

Prompt text:

```text
{buildCaseContext(case)}

---
Redigi un'eccezione procedurale formale da depositare in udienza, focalizzata sul vizio processuale più solido del fascicolo. Struttura:

**TITOLO ECCEZIONE**
**NORMA VIOLATA** (articolo preciso del c.p.p. o legge speciale)
**IN FATTO** — descrizione della violazione procedurale concreta
**IN DIRITTO** — argomentazione giuridica con:
  - Interpretazione della norma violata
  - Conseguenza processuale (nullità / inutilizzabilità / inammissibilità)
  - Giurisprudenza della Cassazione che supporta l'eccezione
**RICHIESTA** — provvedimento chiesto al giudice

Sii preciso: indica se si tratta di nullità assoluta, relativa, o inutilizzabilità patologica/fisiologica.
```

What gets sent with it:

- Same payload patterns as P06.

---

## P09 — Chat quick action / document prompt: `crossExam`

File: `alpha-pwa/frontend/src/main.tsx:207-208`
Section: `DOC_PROMPTS.crossExam`
Triggered by:

- Chat quick action “Controesame testimoni”.
- Legal drafting card “Controesame”.

Prompt text:

```text
{buildCaseContext(case)}

---
Preparazione per il controesame dei testimoni dell'accusa. Per ciascun testimone nel fascicolo, sviluppa:

**[NOME TESTIMONE — ruolo]**
Credibilità: [score]

*Obiettivo del controesame*: [minare la credibilità / estrarre ammissioni favorevoli / limitare il danno]

*Sequenza di domande*:
1. [domanda di apertura — fatto non contestabile]
2-5. [sviluppo logico verso la contraddizione o l'ammissione]
X. [domanda finale incisiva]

*Trappole da evitare*:
*Documenti da usare come confronto*:

Usa la tecnica del controesame a domande chiuse (sì/no).
```

What gets sent with it:

- Same payload patterns as P06.

---

## P10 — Chat quick action / document prompt: `strategy`

File: `alpha-pwa/frontend/src/main.tsx:209-210`
Section: `DOC_PROMPTS.strategy`
Triggered by:

- Chat quick action “Strategia del caso”.
- Legal drafting card “Analisi strategica”.
- Next-deadline “Prepara con GiulIA” prompt uses `strategy` plus additional title-specific instruction.
- Fallback if a draft type does not match a `DOC_PROMPTS` key.

Prompt text:

```text
{buildCaseContext(case)}

---
Analisi strategica approfondita del caso. Valuta ogni linea difensiva con occhio critico da avvocato esperto:

Per ogni strategia:
- **Probabilità di successo** (realistica, non ottimistica)
- **Prove necessarie ancora da acquisire**
- **Rischi e controindicazioni**
- **Giurisprudenza favorevole** (Cass. pen., sezione, numero)
- **Tempistica tattica** — quando e come giocare questa carta

Concludi con una **raccomandazione tattica generale**: quale combinazione di strategie adottare, in quale ordine, e quale eventuale piano B prepararsi.
```

What gets sent with it:

- Same payload patterns as P06.
- In next-deadline workspace, P14 adds the next deadline title instruction and P16 extra instruction.

---

## P11 — Chat quick action / document prompt: `clienteNote`

File: `alpha-pwa/frontend/src/main.tsx:211-212`
Section: `DOC_PROMPTS.clienteNote`
Triggered by:

- Chat quick action “Nota per il cliente”.
- `openChat('clienteNote')`.

Prompt text:

```text
{buildCaseContext(case)}

---
Il cliente vuole capire la sua situazione. Prepara una spiegazione in linguaggio semplice e chiaro — senza tecnicismi legali — che risponda a queste domande:

1. **Di cosa è accusato, in parole semplici?**
2. **Quali sono i rischi concreti (pena, misure cautelari)?**
3. **Cosa stiamo facendo per difenderlo?**
4. **Cosa deve fare lui nei prossimi giorni?**
5. **Cosa NON deve assolutamente fare o dire?**

Tono: diretto, rassicurante ma onesto. Evita ogni burocratese. Il cliente deve uscire dal colloquio capendo la situazione senza farsi prendere dal panico.
```

What gets sent with it:

- User message through chat quick action.
- P04 as `system_override` plus case context, so context may be duplicated.

---

## P12 — Fallback contextual chat prompt

File: `alpha-pwa/frontend/src/main.tsx:4160-4169`
Section: `openChat(initialKeyOrText)`
Trigger:

- Any call to `onOpenChat(text)` where `text` is not a key in `DOC_PROMPTS`.
- Examples: questions about an open question or contradiction.

Prompt template if a case is active:

```text
{buildCaseContext(case)}

---
{initialKeyOrText}
```

Prompt template if no case is active:

```text
{initialKeyOrText}
```

What gets sent with it:

- Full prompt becomes a user message.
- `sendToApi([...chat.messages, userMsg])` sends all chat messages.
- P04 is sent as `system_override`; if active case exists, P04 already includes `buildCaseContext(case)`, so context is duplicated.
- `mode: flash`.

---

## P13 — Draft workspace precedent/source guardrail

File: `alpha-pwa/frontend/src/draftArtifacts.ts:47-58`
Section: `DRAFT_PRECEDENT_GUARDRAIL`
Used by: P14 `buildDraftPrompt()`.
Trigger: any draft workspace generation.

What it tries to achieve:

- Prevent invented case-law citations.
- Force “DA VERIFICARE” labeling for uncertain Cassation-like citations.
- Remind the lawyer that drafts are working material.

Prompt text:

```text
---
GUARDRAIL FONTI E PRECEDENTI
DIVIETO ASSOLUTO: non inventare precedenti giurisprudenziali.
Cita una sentenza solo se sei ragionevolmente certa dell'esistenza e dei dati minimi: Corte, sezione, numero, anno/data, principio rilevante.
Se non sei certa, NON citare numero o anno inventati. Scrivi invece: "Orientamento da verificare in banca dati prima del deposito" oppure "Giurisprudenza da ricercare/verificare".
Qualsiasi citazione Cassazione-like non supportata da fonte del fascicolo o memoria affidabile va marcata esplicitamente: DA VERIFICARE.
Non creare mai citazioni verosimili ma non verificate.
Per ogni affermazione fattuale sostanziale, collega la fonte se presente nel fascicolo; se manca, segnala che il punto è da verificare.
La bozza è materiale di lavoro: l'avvocato deve verificare fatti, norme, fonti, scadenze e precedenti prima del deposito.
```

What gets sent with it:

- Appended to the user prompt generated by P14.
- Backend still also sends P03 as system prompt unless frontend changes `fetchChatFull()` to pass `system_override`.

---

## P14 — Draft workspace wrapper prompt

File: `alpha-pwa/frontend/src/draftArtifacts.ts:123-152`
Section: `buildDraftPrompt()`
Trigger:

- Legal drafting cards.
- Witness “Prepara controesame con GiulIA”.
- Next-deadline “Prepara con GiulIA”.

What it tries to achieve:

- Turn a base prompt tail into a durable editable Markdown draft.
- Force title fidelity for workspace/action title.
- Add privacy context if anonymized mode is active.
- Add precedent/source guardrails.
- Require final pre-filing verification section.

Prompt assembly order:

```ts
return [
  promptTail(ctx),
  titleInstruction,
  extraInstruction.trim(),
  anonymized ? 'CONTESTO PRIVACY: usa esclusivamente la versione anonimizzata del fascicolo.' : '',
  DRAFT_PRECEDENT_GUARDRAIL.trim(),
  `TIPO BOZZA: ${draftTypeLabel(type)}. Restituisci una bozza in Markdown editabile, con una sezione finale "Verifiche prima del deposito".`,
].filter(Boolean).join('\n\n');
```

Title instruction when `workspaceTitle` is non-empty:

```text
TITOLO WORKSPACE / PROSSIMA PRIORITÀ: "{trimmedTitle}". La bozza deve riguardare precisamente questo titolo e usarlo come H1 Markdown iniziale: "# {trimmedTitle}". Non sostituirlo con un'etichetta interna come "Analisi strategica" se il titolo utente è più specifico. Se il titolo non è sufficientemente chiaro o non capisci con sicurezza quale attività richieda, dillo esplicitamente all'inizio: "Non sono pienamente certa di cosa significhi la prossima priorità '{trimmedTitle}'; ecco la mia lettura operativa e, in subordine, un'analisi strategica da verificare." Poi procedi con la migliore interpretazione possibile senza inventare fatti.
```

Privacy instruction when active:

```text
CONTESTO PRIVACY: usa esclusivamente la versione anonimizzata del fascicolo.
```

Final instruction:

```text
TIPO BOZZA: {draftTypeLabel(type)}. Restituisci una bozza in Markdown editabile, con una sezione finale "Verifiche prima del deposito".
```

What gets sent with it:

File: `alpha-pwa/frontend/src/main.tsx:3058-3062`, `3088-3121`

```ts
fetch(`${API}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: userMessage }],
    mode: 'flash',
  }),
});
```

Notably:

- no `system_override` is sent;
- backend uses P03 default system;
- only one user message is sent;
- the generated Markdown is saved into a local `DraftArtifact`.

Draft metadata saved with prompt:

File: `alpha-pwa/frontend/src/draftArtifacts.ts:155-194`

- `prompt`: full prompt text;
- `generation_notes.model_mode`: currently hard-coded `flash`;
- `generation_notes.used_redacted_context`: anonymized flag;
- `generation_notes.precedent_policy`: `no_invented_precedents`.

---

## P15 — Witness-specific cross-examination draft prompt

File: `alpha-pwa/frontend/src/main.tsx:2250-2259` and `3091-3093`
Trigger: button “Prepara controesame con GiulIA” on a witness card.

What it tries to achieve:

- Generate a focused cross-examination sequence for one witness.

Extra instruction text:

```text
Preparami una sequenza di controesame per {witness_name} ({role}, credibilità {score}%). Testimonianza chiave: "{key_testimony}". Vulnerabilità note: {vulnerabilities joined by '; ' or 'da sviluppare'}. Usa domande chiuse sì/no per massimizzare l'impatto.
```

How it is wrapped:

For `witnessCrossExam`, `handleOpenDraftWorkspace()` sets:

```ts
const promptTail = (ctx: string) => `${ctx}\n\n---\n${extraInstruction}`;
extraInstruction passed into buildDraftPrompt = '';
workspaceTitle = `Controesame — ${witness_name || 'testimone'}`;
```

So final prompt includes:

- `buildCaseContext(case)`;
- witness extra instruction;
- P14 title instruction;
- optional privacy instruction;
- P13 guardrail;
- final `TIPO BOZZA: Controesame testimone...` instruction.

What gets sent with it:

- Single user message to `/api/chat`, `mode: flash`, no `system_override`.

---

## P16 — Next-deadline / next-priority preparation draft prompt

File: `alpha-pwa/frontend/src/main.tsx:3469-3481`
Trigger: “Prepara con GiulIA” on the `Prossima priorità` deadline card.

What it tries to achieve:

- Generate an operational preparation draft for the next deadline/priority.
- Preserve the exact deadline title as the draft title/H1.

Extra instruction text:

```text
Prepara una bozza operativa sulla prossima priorità "{nextDeadline.title}" ({nextDeadline.due_date}{optional time}). Indica priorità difensive, documenti da portare o acquisire, atti da predisporre, rischi, verifiche fattuali e fonti da controllare. Descrizione scadenza/priorità: {nextDeadline.description}
```

How it is wrapped:

```ts
handleOpenDraftWorkspace(
  'strategy',
  nextDeadline.title,
  extraInstruction
)
```

So final prompt includes:

- P10 strategy prompt;
- P14 title instruction with the deadline title;
- this extra instruction;
- optional privacy instruction;
- P13 guardrail;
- final `TIPO BOZZA: Analisi strategica...` instruction.

What gets sent with it:

- Single user message to `/api/chat`, `mode: flash`, no `system_override`.

---

## P17 — Open-question contextual chat prompt

File: `alpha-pwa/frontend/src/main.tsx:3832-3835`
Trigger: “Chiedi a GiulIA” on an open question card.

What it tries to achieve:

- Ask GiulIA for concrete investigative/defense moves for one unresolved question.

Raw initial text:

```text
Come indago questa questione: "{q.question}"? Perché conta: {q.why_it_matters}. Suggerisci le mosse concrete per rispondere a questa domanda difensiva.
```

Final user message if a case is active:

```text
{buildCaseContext(case)}

---
Come indago questa questione: "{q.question}"? Perché conta: {q.why_it_matters}. Suggerisci le mosse concrete per rispondere a questa domanda difensiva.
```

What gets sent with it:

- Full prompt above as a user message.
- P04 as `system_override`, including `buildCaseContext(case)` again.
- All existing chat history.
- `mode: flash`.

Optimization note:

- This is a clear context duplication hotspot.

---

## P18 — Contradiction contextual chat prompt

File: `alpha-pwa/frontend/src/main.tsx:3907-3911`
Trigger: “Chiedi a GiulIA” on a contradiction card.

What it tries to achieve:

- Ask GiulIA how to use a contradiction in hearing strategy and witness questioning.

Raw initial text:

```text
Come possiamo sfruttare in udienza la contraddizione "{ct.title}"? {ct.description} Suggerisci come usarla nella strategia difensiva e quali domande fare ai testimoni.
```

Final user message if a case is active:

```text
{buildCaseContext(case)}

---
Come possiamo sfruttare in udienza la contraddizione "{ct.title}"? {ct.description} Suggerisci come usarla nella strategia difensiva e quali domande fare ai testimoni.
```

What gets sent with it:

- Full prompt above as a user message.
- P04 as `system_override`, including `buildCaseContext(case)` again.
- All existing chat history.
- `mode: flash`.

---

## P19 — Redaction detection prompt

File: `alpha-pwa/frontend/src/main.tsx:365-397`
Section: `REDACT_DETECT_PROMPT(caseCtx)`
Trigger: `Anonimizza` drawer → “Rileva dati sensibili con AI”.

What it tries to achieve:

- Identify personal/sensitive data in the case context.
- Return deterministic mapping lines in `ORIGINALE → SOSTITUZIONE` format.

Prompt text:

```text
{buildCaseContext(case)}

---
Sei un assistente per la privacy legale. Analizza il fascicolo sopra e identifica TUTTI i dati personali che potrebbero identificare le parti private.

CATEGORIE DA RILEVARE:
- Nomi propri di persone fisiche (imputati, vittime, testimoni, familiari) — incluse varianti cognome-solo o iniziali
- Indirizzi specifici (via, numero civico, città, CAP)
- Numeri di telefono, email, username
- Codici fiscali, numeri di carta d'identità/passaporto
- Targhe veicoli, numeri di conto/IBAN
- Numeri di procedimento/fascicolo penale
- Nomi di aziende private o studi legali delle parti
- Luoghi molto specifici che identificano le parti (es. abitazione, posto di lavoro)

NON REDARRE:
- Nomi di magistrati, PM, GIP/GUP (sono pubblici ufficiali nell'esercizio delle funzioni)
- Nomi di enti pubblici (Tribunale, Procura, Questura, CC)
- Riferimenti normativi (art. 624 c.p., leggi, decreti)
- Date di udienza o scadenze processuali (non identificano persone)
- Termini giuridici generici

REGOLE DI OUTPUT:
- Ogni persona riceve un token progressivo coerente: NOME_1, NOME_2, … (persona diversa = numero diverso)
- Se lo stesso soggetto appare in più varianti (es. "Mario Rossi", "Rossi", "M. Rossi"), elencale TUTTE mappate allo stesso token
- Formato ESATTO per ogni riga: ORIGINALE → SOSTITUZIONE
- Nessuna riga vuota, nessun commento, nessun prefisso
- Se non trovi dati sensibili, scrivi solo: NESSUN_DATO_SENSIBILE

Esempio output corretto:
Mario Rossi → [NOME_1]
Rossi → [NOME_1]
Via Tiburtina 42, Roma → [INDIRIZZO_1]
333-4521789 → [TELEFONO_1]
Giuseppe Conti → [NOME_2]
```

What gets sent with it:

File: `alpha-pwa/frontend/src/main.tsx:2394-2400`

```ts
fetch(`${apiBase}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: REDACT_DETECT_PROMPT(caseCtx) }],
    mode: 'flash',
  }),
});
```

Backend system:

- No `system_override`, so P03 backend GiulIA persona is used.

Response parsing:

- The frontend parses each line with regex:

```ts
/^(.+?)\s*→\s*(.+)$/
```

- Each match becomes a `RedactionRule`.

Optimization targets:

- The backend GiulIA legal persona is irrelevant here and may interfere; a privacy-specific system prompt would be cleaner.
- `buildCaseContext()` may omit raw document text, so redaction detection may miss sensitive data present only in `raw_documents`.

---

## P20 — Redaction/anonymization application prompt

File: `alpha-pwa/frontend/src/main.tsx:399-400`
Section: `REDACT_APPLY_PROMPT(text)`
Triggered by:

- Brief tab → `Anonimizza` button.
- Raw document row → anonymize document button.

What it tries to achieve:

- Return only anonymized legal text.
- Replace names, addresses, identifying dates, procedure numbers, contact data.

Prompt text:

```text
Anonimizza il seguente testo giuridico italiano. Regole:
- Nomi propri di persone → [NOME_N] (progressivo per persona, coerente)
- Indirizzi specifici → [INDIRIZZO]
- Date specifiche identificative → [DATA]
- Numeri procedimento → [N.PROC.]
- Dati di contatto → [CONTATTO]
Restituisci SOLO il testo anonimizzato, senza spiegazioni né prefissi.

TESTO:
{text}
```

What gets sent with it:

File: `alpha-pwa/frontend/src/main.tsx:3183-3193`, `3195-3211`, `3058-3062`

```ts
fetch(`${API}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: REDACT_APPLY_PROMPT(text) }],
    mode: 'flash',
  }),
});
```

Backend system:

- No `system_override`, so P03 backend GiulIA persona is used.

Targets:

- `caseData.brief_markdown` for brief anonymization.
- `doc.text` for raw document anonymization.

Important behavior:

- Raw document anonymization overwrites the document text in local case state and prefixes document name with `[ANONIMIZZATO]`.
- Brief anonymization displays result in modal; it does not overwrite `brief_markdown` automatically.

Optimization target:

- This should probably use deterministic local rules where possible, with AI as a suggestion/review layer, because privacy redaction is safety-critical.

---

## P21 — Legal drafting cards prompt set

File: `alpha-pwa/frontend/src/main.tsx:2338-2364`
Trigger: cards under `Analisi legale` → “Redazione atti con AI”.

Cards:

- `memoria` — “Memoria difensiva”
- `cassazione` — “Ricorso Cassazione”
- `eccezione` — “Eccezione procedurale”
- `crossExam` — “Controesame”
- `strategy` — “Analisi strategica”

What it sends:

```ts
onOpenDraft(key, label)
```

This resolves to:

- base prompt from P06-P10;
- wrapper from P14;
- guardrail from P13;
- single `/api/chat` request with `messages: [{ role:'user', content: fullDraftPrompt }]`, `mode:'flash'`.

This is not a separate text prompt beyond the prompts already listed, but it is an important trigger surface.

---

## P22 — Chat drawer quick action keys

File: `alpha-pwa/frontend/src/main.tsx:1216-1223`, `1248-1254`
Trigger: quick chips in the chat drawer when case context exists.

Quick actions:

```ts
[
  { key: 'strategy',    label: 'Strategia del caso' },
  { key: 'memoria',     label: 'Memoria difensiva' },
  { key: 'cassazione',  label: 'Ricorso Cassazione' },
  { key: 'eccezione',   label: 'Eccezione procedurale' },
  { key: 'crossExam',   label: 'Controesame testimoni' },
  { key: 'clienteNote', label: 'Nota per il cliente' },
]
```

What it sends:

- Calls `openChat(key)`.
- If `key` is found in `DOC_PROMPTS`, sends the corresponding P06-P11 prompt as a user message.
- Also sends P04 as `system_override`.
- Also sends existing chat history.

This is not a separate prompt text beyond P06-P11, but it is a distinct trigger path with different surrounding payload than draft workspace.

---

## P23 — OCR call: no app-authored natural-language prompt

File: `alpha-pwa/backend/app/ocr_adapter.py:230-283`
Endpoint: called indirectly by `POST /api/upload`
Trigger:

- Upload scanned PDF or image-like unsupported file after `pypdf` fails or when non-text/non-docx/non-pptx/non-xlsx.

What it tries to achieve:

- Extract markdown text per page using Mistral OCR.

Payload:

```python
client.ocr.process(
    model="mistral-ocr-latest",
    document={"type": doc_type, doc_type: data_url},
)
```

Where:

- `doc_type = "document_url"` for PDFs;
- `doc_type = "image_url"` for images;
- `data_url = "data:{mime_type};base64,{file_bytes}"`.

No natural-language prompt is authored by PLT here.

Privacy note:

- File bytes leave the device/backend to Mistral when this path is used.

---

## P24 — Audio transcription call: no app-authored natural-language prompt

File: `alpha-pwa/backend/app/main.py:301-322`
Endpoint: `POST /api/transcribe`
Trigger: audio upload/transcription flow.

What it tries to achieve:

- Transcribe audio into Italian text.

Payload:

```python
client.audio.transcriptions.create(
    file=(filename, content),
    model="whisper-large-v3-turbo",
    language="it",
    response_format="text",
)
```

No natural-language prompt is authored by PLT here.

Privacy note:

- Audio bytes leave the backend to Groq when this path is used.

---

## Potential prompt duplication / token-economy hotspots

1. **Case context duplicated in chat quick actions**
   - `openChat(key)` puts `buildCaseContext(case)` inside the user message via `DOC_PROMPTS[key](ctx)`.
   - `sendToApi()` also puts `buildCaseContext(case)` inside `system_override`.
   - A quick action can therefore send the same case facts twice.

2. **`brief_markdown` included in many contexts**
   - `buildCaseContext()` includes full current brief.
   - `buildUserContextMaterial()` includes full current brief, capped only as part of 8k total context.
   - Drafting and chat prompts may carry old generated material repeatedly.

3. **Legal persona applied to privacy tasks**
   - Redaction detection and application use `/api/chat` without `system_override`, so backend applies P03 GiulIA persona.
   - A smaller privacy-only system prompt would be cheaper and less likely to add unwanted prose.

4. **Cassation citation pressure**
   - P03/P04/P06/P07/P08/P10 ask for Cassation citations.
   - Only draft workspace P13 explicitly bans invented precedents.
   - Normal chat quick actions do not get P13 unless routed through draft workspace.

5. **Analysis schema is very verbose**
   - P02 injects a large schema every time.
   - Provider-native JSON schema / structured output could reduce prompt tokens and parsing failures.

6. **Draft generation max output hard cap**
   - `/api/chat` streaming max tokens is `4096` regardless of draft type.
   - Long memorie/ricorsi may truncate or become shallow.

---

## Suggested optimization order

1. **Unify chat and draft system prompts**
   - One small base GiulIA persona.
   - One optional app-help module only for app-help questions.
   - One legal-drafting guardrail module reused everywhere.

2. **Create separate task-specific endpoints or `task_type` routing**
   - `chat_general`
   - `draft_legal_act`
   - `redaction_detect`
   - `redaction_apply`
   - `case_analysis`

3. **Stop duplicating case context**
   - For quick actions, send context either in system or user message, not both.
   - Prefer a compact structured `case_context` object or summarized context builder per task.

4. **Add retrieval/source discipline for legal precedents**
   - If no legal database/RAG is connected, require “giurisprudenza da verificare” rather than invented section/number/year.

5. **Split analysis into passes if quality/cost requires it**
   - Pass A: extract facts/entities/timeline/source refs.
   - Pass B: legal analysis over extracted facts.
   - Pass C: deadlines.
   - Pass D: brief/promemoria.

6. **Make privacy flows deterministic-first**
   - Use rules/UI for replacements.
   - Use AI only to suggest candidates.
   - Never silently overwrite original raw document text without clear reversible copy/versioning.

---

## Files inspected for this map

- `alpha-pwa/backend/app/ai_service.py`
- `alpha-pwa/backend/app/main.py`
- `alpha-pwa/backend/app/ocr_adapter.py`
- `alpha-pwa/frontend/src/main.tsx`
- `alpha-pwa/frontend/src/draftArtifacts.ts`

Generated/build artifacts under `frontend/dist/` were not treated as source of truth because they are compiled from the source files above.
