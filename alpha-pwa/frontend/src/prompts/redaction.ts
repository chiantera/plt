export const REDACT_DETECT_PROMPT = (caseCtx: string) =>
  `${caseCtx}\n\n---\nSei un assistente per la privacy legale. Analizza il fascicolo sopra e identifica TUTTI i dati personali che potrebbero identificare le parti private.

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
Giuseppe Conti → [NOME_2]`;

export const REDACT_APPLY_PROMPT = (text: string) =>
  `Anonimizza il seguente testo giuridico italiano. Regole:\n- Nomi propri di persone → [NOME_N] (progressivo per persona, coerente)\n- Indirizzi specifici → [INDIRIZZO]\n- Date specifiche identificative → [DATA]\n- Numeri procedimento → [N.PROC.]\n- Dati di contatto → [CONTATTO]\nRestituisci SOLO il testo anonimizzato, senza spiegazioni né prefissi.\n\nTESTO:\n${text}`;
