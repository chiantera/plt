# Environment variables — PLT

Reference for every environment variable the app reads, grouped by where you set
it. Values come from the codebase (`backend/app/*.py`, `frontend/src/*`); defaults
are what the code falls back to when the var is unset.

> Secrets here are test-account keys. Never commit real values. The backend reads
> these from the process env (Render); the frontend bakes `VITE_*` at build time
> (Netlify).

## Backend — Render (`plt-backend`)

### AI / external providers
| Var | Required | Default | Purpose |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | **yes** | — | Primary AI (extraction, analysis, chat, drafts). If missing, AI features fail / fall back to Anthropic if configured. |
| `ANTHROPIC_API_KEY` | optional | — | Fallback provider (Claude) when DeepSeek isn't available. |
| `GROQ_API_KEY` | for voice | — | Speech-to-text (Whisper) for "Nota vocale". Missing → `/api/transcribe` returns 503; invalid → 502. |
| `MISTRAL_API_KEY` | for OCR | `""` | OCR of scanned PDFs / images (`ocr_adapter.py`). |

### Getting the provider keys

- **Groq** (`GROQ_API_KEY`) — voice-note transcription. Go to
  [console.groq.com](https://console.groq.com) → sign in → **API Keys** →
  **Create API Key** → copy it (starts with `gsk_`; it's shown only once). Has a
  free tier — no billing needed for testing. Paste into `GROQ_API_KEY` on Render.
  An expired/revoked key gives Groq `401` (→ transcription fails); just create a
  new one and replace it.
- **DeepSeek** (`DEEPSEEK_API_KEY`) — [platform.deepseek.com](https://platform.deepseek.com)
  → API keys → create (`sk-…`). Requires a funded account (pay-as-you-go).
- **Mistral** (`MISTRAL_API_KEY`) — [console.mistral.ai](https://console.mistral.ai)
  → API Keys. Used for OCR.
- **Anthropic** (`ANTHROPIC_API_KEY`, optional fallback) —
  [console.anthropic.com](https://console.anthropic.com) → API Keys (`sk-ant-…`).

Each key is created in the provider's web console and pasted into the matching
Render env var; the app never stores them in code.

### Model routing & budgets
| Var | Default | Purpose |
|---|---|---|
| `DEEPSEEK_DEFAULT_MODEL` | `deepseek-v4-flash` | Flash model id (extraction/ordinary). |
| `DEEPSEEK_PRO_MODEL` | `deepseek-v4-pro` | Pro model id (deep reasoning). |
| `PLT_FLASH_MAX_TOKENS` | `128000` | Generated-output tokens, Flash analysis. |
| `PLT_PRO_MAX_TOKENS` | `256000` | Generated-output tokens, Pro analysis. |
| `PLT_CHAT_MAX_TOKENS` | `32768` | Generated-output tokens, chat/streaming. |
| `PLT_FLASH_MAX_ANALYSIS_CHARS` | `1000000` | Max input chars, Flash (falls back to `PLT_MAX_ANALYSIS_CHARS`). |
| `PLT_PRO_MAX_ANALYSIS_CHARS` | `1000000` | Max input chars, Pro. |
| `PLT_MAX_ANALYSIS_CHARS` | `1000000` | Legacy fallback for the Flash char budget. |

> Token budgets are **generated output**, not total context; input+output must still fit the model window.

### Server
| Var | Default | Purpose |
|---|---|---|
| `PLT_MAX_UPLOAD_BYTES` | `52428800` (50 MB) | Max upload size per file. |
| `ALLOWED_ORIGINS` | `""` | Comma-separated **extra** CORS origins, appended to the built-in defaults (Netlify + localhost). |
| `PLT_PROMPT_LOG` | `1` (on) | Set `0` to disable prompt logging. Never commit the log file. |

## Frontend — Netlify (build-time, `VITE_*`)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | **yes** | — | Supabase project URL (auth). App shows "Configurazione mancante" if unset. |
| `VITE_SUPABASE_ANON_KEY` | **yes** | — | Supabase anon/public key. |
| `VITE_API_URL` | **yes** (deploy) | `""` | Backend base URL, e.g. `https://plt-backend.onrender.com`. Empty = same-origin (dev uses the Vite proxy to `:8000`). |
| `VITE_BYPASS_AUTH` | optional | — | `true` **only on localhost** to skip Supabase auth in dev. Ignored on deployed builds. |
| `VITE_MOCK_DATA` | optional | — | `true` installs a mock API for offline testing. |

## Supabase (what the app needs from the project)

Supabase is used **only for auth + user profile**, not for case data (fascicoli
live locally in IndexedDB).

- **Keys:** Project → Settings → API → copy the **Project URL** into `VITE_SUPABASE_URL`
  and the **anon public** key into `VITE_SUPABASE_ANON_KEY`.
- **Auth:** email/password sign-in & sign-up (`supabase.auth.signInWithPassword` /
  `signUp`). Enable the Email provider.
- **Table `profiles`** (read/written by the Profile drawer). Schema + RLS below
  mirror the live `plt-alpha` project (verified via the Supabase connector).
  Paste into the SQL editor of a new project:

```sql
-- Profile rows are 1:1 with auth users.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  studio     text,
  phone      text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- A user can read and write only their own profile row.
create policy "users can read/write own profile"
  on public.profiles
  for all
  to public
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

  > For a different domain (e.g. personal trainers) keep `id`/`created_at` and the
  > policy; rename/extend the profile fields (`studio` → e.g. `gym`, etc.).

## Quick setup (new environment)

1. **Render** (backend): set `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`
   (+ `ANTHROPIC_API_KEY` if you want fallback). Defaults cover the rest.
2. **Supabase**: create the project, enable Email auth, create the `profiles` table
   (+ RLS), grab URL + anon key.
3. **Netlify** (frontend): set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_API_URL` (the Render URL). Redeploy.
