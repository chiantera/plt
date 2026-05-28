/**
 * Guida al ricorso per Cassazione penale — istruzioni per GiulIA.
 *
 * Fonte: documento di lavoro del difensore (v. /plt/Ricorso per Cassazione - Processo Penale.md).
 * Aggiornare qui quando cambiano le istruzioni operative.
 */

export const CASSAZIONE_GUIDE = `
════════════════════════════════════════════════════════════════════
  RICORSO PER CASSAZIONE PENALE — ATTO DI MASSIMA IMPORTANZA
════════════════════════════════════════════════════════════════════

La Corte di Cassazione è il vertice della giurisprudenza penale italiana,
l'equivalente funzionale della Suprema Corte statunitense (SCOTUS) per il
diritto penale. Un ricorso per Cassazione è l'ultima possibilità di tutela
del diritto per l'imputato. OGNI ERRORE FORMALE equivale all'INAMMISSIBILITÀ
immediata, che chiude definitivamente il caso. Redigi con la massima cura,
precisione e rigore tecnico che questa responsabilità richiede.

───────────────────────────────────────────────────────────────────
PRESUPPOSTI ESSENZIALI — verifica nel fascicolo prima di procedere:
───────────────────────────────────────────────────────────────────
• Avvocato cassazionista (albo speciale) — indicare nel fascicolo se noto
• Termine: 45 giorni dal deposito motivazioni (60 se imputato all'estero;
  15 giorni per sentenza immediata; 30 giorni per rescissione giudicato)
• Motivi SOLO ex art. 606 c.p.p. — nessun motivo di merito
• AUTOSUFFICIENZA ASSOLUTA: il ricorso deve contenere tutto il necessario,
  citare i passi esatti della sentenza impugnata, non rinviare ad atti del
  fascicolo. Una sola mancanza → inammissibilità.
• Limite tendenziale di 50 pagine (salvo complessità documentata)

───────────────────────────────────────────────────────────────────
MOTIVI RICORRIBILI — art. 606 c.p.p. (tassativi):
───────────────────────────────────────────────────────────────────
  lett. a)  Violazione di legge penale o altra norma giuridica
  lett. b)  Inosservanza norme processuali stabilite a pena di nullità,
            inutilizzabilità, inammissibilità o decadenza
  lett. c)  Erronea applicazione della legge penale (qualificazione,
            circostanze, criteri art. 133 c.p., calcolo pena)
  lett. d)  Vizi di motivazione: mancanza assoluta, manifesta illogicità,
            contraddittorietà intrinseca o con atti del fascicolo,
            travisamento della prova
  lett. e)  Mancata assunzione di prova decisiva ritualmente richiesta
  lett. e-bis)  [2025] Violazione del diritto dell'Unione Europea rilevante
  lett. e-ter)  [2025] Violazione della CEDU come interpretata dalla Corte EDU

Per ogni motivo: indica la lettera esatta, norma violata, passo della
sentenza che contiene il vizio, e sviluppa l'argomentazione giuridica
con specificità assoluta. Motivi generici = inammissibilità.

───────────────────────────────────────────────────────────────────
ERRORI FATALI DA EVITARE (causano inammissibilità immediata):
───────────────────────────────────────────────────────────────────
✗  Motivi generici o di puro merito (rivalutazione del fatto)
✗  Violazione del principio di autosufficienza (rinvio ad atti)
✗  Censure non dedotte in appello (novità inammissibile)
✗  Superamento limite 50 pagine senza documentata necessità
✗  Mancata notifica alle parti prima del deposito
✗  Citazioni Cassazione inventate — devono essere DA VERIFICARE o assenti

───────────────────────────────────────────────────────────────────
STRUTTURA OBBLIGATORIA DEL RICORSO:
───────────────────────────────────────────────────────────────────

ECC.MA CORTE DI CASSAZIONE — SEZIONE _____ PENALE
Proc. Pen. n. _____/_____ R.G. | Sent. n. _____/_____ | R.G.N.R. n. _____/_____

## RICORSO PER CASSAZIONE CON CONTESTUALI MOTIVI
ai sensi degli artt. 606 e seguenti c.p.p.

nell'interesse di [IMPUTATO], nato/a a [luogo] il [data], residente in [indirizzo],
rappresentato/a e difeso/a dall'Avv. [NOME] iscritto all'Albo Speciale dei
Cassazionisti del Foro di [FORO], con studio in [INDIRIZZO], ivi elettivamente
domiciliato/a, giusta nomina a difensore di fiducia [depositata in atti / in calce]

                              — RICORRENTE —

AVVERSO la sentenza n. [N.] pronunciata in data [DATA] dalla Corte d'Appello
di [CORTE], depositata il [DATA], con la quale [SINTESI DISPOSITIVO].

## FATTO
[Esposizione sintetica ma completa dei fatti processuali rilevanti per i motivi:
data sentenza primo grado, capo d'accusa, esito, motivi d'appello, esito d'appello,
elementi rilevanti per i motivi di Cassazione.]

## MOTIVI DI RICORSO

### PRIMO MOTIVO
#### [Art. 606 comma 1 lett. ?) c.p.p. — TITOLO DEL VIZIO]
[Formulazione tecnica precisa. Norma violata. Passaggio esatto della sentenza
impugnata citato integralmente. Argomentazione giuridica sviluppata.
Giurisprudenza: solo se verificata nel fascicolo; altrimenti "orientamento
giurisprudenziale da verificare in banca dati" — mai inventare estremi.]

[Ripetere per ogni motivo fondato sui fatti del fascicolo.]

## CONCLUSIONI
Per i motivi esposti, chiede che l'Ecc.ma Corte voglia:
— ANNULLARE la sentenza impugnata [senza rinvio / con rinvio] per i suesposti motivi.
— In subordine: [formulazione alternativa se applicabile].

Si depositano: copia sentenza impugnata, copia sentenza primo grado, [altri atti].
Il presente ricorso consta di n. _____ pagine.

[Luogo], lì [Data]         Avv. _________________ (Cassazionista)

## NOTIFICAZIONE
Il sottoscritto Avv. __________ dichiara di aver notificato copia del presente
ricorso al Procuratore Generale presso la Corte d'Appello di __________ in data __________.
════════════════════════════════════════════════════════════════════
`;
