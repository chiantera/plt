// Offline mock API for the Android demo build.
// Intercepts window.fetch and serves bundled demo data for /api/* endpoints,
// so the app runs as a self-contained APK with no backend.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import demoDataRaw from './demo.json';

type CaseSummary = Record<string, any>;
type CaseAnalysis = Record<string, any>;

const demoData = demoDataRaw as unknown as {
  summaries: CaseSummary[];
  cases: Record<string, CaseAnalysis>;
};

const ALL_SUMMARIES = demoData.summaries;
const ALL_CASES = demoData.cases;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function sseStream(text: string): Response {
  const encoder = new TextEncoder();
  // Split text into reasonably sized chunks for a typing effect.
  const chunks: string[] = [];
  const tokens = text.split(/(\s+)/);
  let buf = '';
  for (const t of tokens) {
    buf += t;
    if (buf.length > 12) { chunks.push(buf); buf = ''; }
  }
  if (buf) chunks.push(buf);

  const stream = new ReadableStream({
    async start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: c })}\n\n`));
        await new Promise(r => setTimeout(r, 18));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

function pickFirstCase(): CaseAnalysis {
  return ALL_CASES[Object.keys(ALL_CASES)[0]];
}

function makeAnalyzedCase(title: string, materialName: string, text: string): CaseAnalysis {
  // Use the first demo case as a template, but personalize the user-visible
  // bits so it feels responsive to the user's input.
  const template = pickFirstCase();
  const cloned: CaseAnalysis = JSON.parse(JSON.stringify(template));
  cloned.case_id = `demo-uploaded-${Date.now()}`;
  cloned.case_title = title || 'Nuovo fascicolo';
  cloned.case_summary = text.length > 240
    ? `${text.slice(0, 240).trim()}…`
    : (text.trim() || cloned.case_summary);
  cloned.materials = [
    {
      id: 'uploaded-1',
      name: materialName || 'documento.txt',
      kind: 'text',
      description: 'Materiale caricato dall\'utente nella demo offline.',
      excerpt: text.slice(0, 180).trim(),
      content: text,
    },
    ...cloned.materials.slice(0, 2),
  ];
  return cloned;
}

const DEMO_REPLY = `**Modalità demo offline**

Questa build Android è autonoma e non si collega al backend Claude. La struttura del fascicolo, le accuse, le strategie difensive, le contraddizioni e i testimoni mostrati nell'app sono dati di esempio precaricati per dimostrare l'esperienza utente.

**Cosa funziona già:**
- Navigazione completa fra i 3 fascicoli demo
- Cronologia, agenda, persone, prove, contraddizioni
- Analisi legale: accuse, elementi costitutivi, strategie, equilibrio probatorio
- Aula Mode con swipe fra le 5 slide
- Marcatura task come completati (persistenti in localStorage)
- Copia / condivisione del promemoria

**Cosa è simulato:**
- La redazione di memorie, ricorsi, eccezioni e analisi strategica nella chat richiede una connessione al backend con API key Anthropic.
- L'analisi di un nuovo documento riusa il primo fascicolo demo come template.

Per attivare l'AI reale, esegui il backend FastAPI con \`ANTHROPIC_API_KEY\` impostata e punta l'app al suo URL.`;

export function installMockApi(): void {
  const realFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL ? input.toString() : input.url;

    // Only intercept relative /api/* paths; let everything else through.
    if (!url.startsWith('/api/')) {
      return realFetch(input as RequestInfo, init);
    }

    const path = url.split('?')[0];

    if (path === '/api/cases') {
      return json(ALL_SUMMARIES);
    }

    if (path.startsWith('/api/cases/')) {
      const id = decodeURIComponent(path.slice('/api/cases/'.length));
      const found = ALL_CASES[id];
      if (!found) return json({ detail: `Case '${id}' not found` }, { status: 404 });
      return json(found);
    }

    if (path === '/api/demo-case') {
      return json(pickFirstCase());
    }

    if (path === '/api/analyze-text') {
      let body: any = {};
      try { body = init?.body ? JSON.parse(String(init.body)) : {}; } catch {}
      const title = body.case_title ?? 'Nuovo fascicolo';
      const material = body.materials?.[0];
      // Add a small artificial delay so the "Analisi in corso" UI is visible.
      await new Promise(r => setTimeout(r, 900));
      return json(makeAnalyzedCase(title, material?.name ?? 'documento.txt', material?.text ?? ''));
    }

    if (path === '/api/upload') {
      return json({
        upload_id: `upload-${Date.now()}`,
        filename: 'documento',
        mime_type: 'application/octet-stream',
        size_bytes: 0,
        extracted_text: '[Estrazione automatica non disponibile nella demo offline. Incolla il testo manualmente.]',
        status: 'needs_ocr',
      });
    }

    if (path === '/api/chat') {
      return sseStream(DEMO_REPLY);
    }

    if (path === '/api/health') {
      return json({ status: 'ok', service: 'plt-alpha-demo', version: 'android-demo' });
    }

    return json({ detail: `Mock endpoint not implemented: ${path}` }, { status: 404 });
  }) as typeof window.fetch;
}
