# Pocket Legal Triage

**[Open the live showcase](https://plt-phi.vercel.app/)** · No account required.

Explore Caso Bianchi, a fictional Italian criminal-defense case. Follow the timeline, inspect source excerpts, review the legal analysis, try Aula mode, and download the sample brief.

[Open the signed-in workspace](https://plt-phi.vercel.app/?view=workspace) to create cases, upload documents, and work with GiulIA.

## What PLT does

Pocket Legal Triage organizes case materials into a source-linked timeline, evidence map, agenda, and draft work products. Lawyers verify facts, deadlines, and citations before relying on them. Case files are stored locally in the browser.

## Repository guide

| Area | Contents |
| --- | --- |
| [Application](alpha-pwa/README.md) | React frontend, FastAPI backend, Android wrapper, setup and tests |
| [Sample materials](alpha-pwa/sample-data/README.md) | Fictional documents for Caso Bianchi |
| [Product](docs/01-product/) and [technical notes](docs/04-technical/) | Product scope, architecture, data, and implementation decisions |
| [Research](docs/02-research/), [business](docs/03-business/), and [validation](docs/05-validation/) | Market research, operating assumptions, and tester feedback |
| [Brand](docs/06-brand/) and [prompts](docs/07-prompts/) | Design direction and AI prompt inventory |
| [Context](docs/00-context/) and [handoff](CURRENT-TASK.md) | Project history and active work |
| [Vercel](vercel.json), [Netlify](netlify.toml), and [Render](render.yaml) | Deployment configuration |

Vercel serves the showcase and the stateless FastAPI routes. Render handles document processing and background AI jobs. Supabase provides workspace sign-in.
