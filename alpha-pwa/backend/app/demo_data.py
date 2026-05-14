from __future__ import annotations

from .models import (
    CaseAnalysis,
    Contradiction,
    EvidenceItem,
    Material,
    MissingDocument,
    OpenQuestion,
    Person,
    ProceduralDeadline,
    SourceRef,
    TimelineEvent,
    UsageEstimate,
)


def ref(source_name: str, quote: str, confidence: float = 0.86, chunk: str | None = None) -> SourceRef:
    return SourceRef(source_name=source_name, page=1, chunk=chunk, quote=quote, confidence=confidence)


def build_demo_case() -> CaseAnalysis:
    verbale_uscita = ref(
        "verbale_arresto.txt",
        "Gli agenti intervenuti fermano Marco Bianchi nei pressi dell'uscita laterale.",
        0.91,
        "arresto-1",
    )
    contestazione = ref(
        "verbale_arresto.txt",
        "Viene contestato provvisoriamente il furto aggravato in concorso ex artt. 624, 625 e 110 c.p.",
        0.9,
        "contestazione-1",
    )
    testimone_volto = ref(
        "dichiarazione_testimone.txt",
        "precisa di non aver visto chiaramente il volto della seconda persona",
        0.88,
        "testimone-1",
    )
    cliente_farmacia = ref(
        "nota_cliente.txt",
        "Marco Bianchi sostiene che alle 21:15 era già uscito dal supermercato e si trovava davanti alla farmacia di via Roma",
        0.86,
        "cliente-1",
    )
    cliente_zaino = ref(
        "nota_cliente.txt",
        "Aggiunge che lo zaino nero non era suo",
        0.84,
        "cliente-2",
    )
    udienza = ref(
        "avviso_udienza.txt",
        "Udienza di convalida e discussione misura fissata per il 20/04/2026 ore 09:30 presso il Tribunale di Roma, aula 4.",
        0.95,
        "udienza-1",
    )
    termine_memoria = ref(
        "avviso_udienza.txt",
        "Eventuali note difensive e documentazione a supporto della misura dovranno essere depositate entro il 31/05/2026.",
        0.78,
        "termine-memoria-1",
    )

    return CaseAnalysis(
        case_id="demo-furto-aggravato-roma-2026",
        case_title="Caso demo — Furto aggravato in concorso",
        language="it",
        case_summary=(
            "Fascicolo demo per udienza di convalida: Marco Bianchi è stato fermato dopo un presunto furto "
            "aggravato in concorso presso un supermercato. I materiali indicano una possibile contraddizione "
            "sull'orario e sul luogo in cui si trovava l'indagato, oltre a incertezza sull'identificazione del secondo soggetto."
        ),
        materials=[
            Material(
                id="verbale_arresto",
                name="verbale_arresto.txt",
                kind="text",
                description="Narrazione sintetica del verbale di arresto e contestazione provvisoria.",
                excerpt="Fermo presso uscita laterale, zaino nero, secondo soggetto verso via Roma.",
            ),
            Material(
                id="dichiarazione_testimone",
                name="dichiarazione_testimone.txt",
                kind="text",
                description="Dichiarazione della commessa del supermercato.",
                excerpt="La testimone non vede chiaramente il volto della seconda persona.",
            ),
            Material(
                id="nota_cliente",
                name="nota_cliente.txt",
                kind="text",
                description="Nota cliente / trascrizione colloquio difensivo.",
                excerpt="Il cliente sostiene di essere stato davanti alla farmacia alle 21:15.",
            ),
            Material(
                id="avviso_udienza",
                name="avviso_udienza.txt",
                kind="text",
                description="Avviso di udienza di convalida e misura.",
                excerpt="Udienza 20/04/2026 ore 09:30, Tribunale di Roma, aula 4.",
            ),
        ],
        timeline=[
            TimelineEvent(
                date="2026-04-18",
                time="21:15",
                title="Versione cliente: presenza davanti alla farmacia",
                description="Bianchi riferisce di essere già uscito dal supermercato e di trovarsi davanti alla farmacia di via Roma.",
                source_refs=[cliente_farmacia],
                confidence=0.82,
            ),
            TimelineEvent(
                date="2026-04-18",
                time="21:18",
                title="Avvistamento presso scaffali elettronici",
                description="La testimone vede un uomo con giacca blu vicino agli scaffali elettronici e due persone verso l'uscita laterale.",
                source_refs=[
                    ref(
                        "dichiarazione_testimone.txt",
                        "intorno alle 21:18 ha visto un uomo con giacca blu passare vicino agli scaffali elettronici",
                        0.87,
                        "testimone-2",
                    )
                ],
                confidence=0.78,
            ),
            TimelineEvent(
                date="2026-04-18",
                time="21:20",
                title="Fermo presso uscita laterale",
                description="Secondo il verbale, gli agenti fermano Bianchi nei pressi dell'uscita laterale del supermercato.",
                source_refs=[verbale_uscita],
                confidence=0.91,
            ),
            TimelineEvent(
                date="2026-04-18",
                time="21:35",
                title="Contestazione provvisoria",
                description="Viene contestato il furto aggravato in concorso ai sensi degli artt. 624, 625 e 110 c.p.",
                source_refs=[contestazione],
                confidence=0.9,
            ),
            TimelineEvent(
                date="2026-04-20",
                time="09:30",
                title="Udienza di convalida e misura",
                description="Udienza fissata presso il Tribunale di Roma, aula 4; possibile deposito di documentazione difensiva urgente.",
                source_refs=[udienza],
                confidence=0.95,
            ),
        ],
        people=[
            Person(name="Marco Bianchi", role="indagato/assistito", notes="Contesta la disponibilità dello zaino nero e indica possibile alibi parziale.", source_refs=[cliente_farmacia, cliente_zaino]),
            Person(name="Anna Verdi", role="testimone", notes="Commessa; non identifica chiaramente la seconda persona.", source_refs=[testimone_volto]),
            Person(name="Luca", role="possibile testimone da identificare", notes="Conoscente occasionale indicato dal cliente come presente davanti alla farmacia.", source_refs=[cliente_farmacia]),
        ],
        evidence=[
            EvidenceItem(title="Immagini farmacia via Roma", status="da acquisire", notes="Potrebbero confermare o smentire la presenza alle 21:15.", source_refs=[cliente_farmacia]),
            EvidenceItem(title="Video supermercato / uscita laterale", status="da acquisire", notes="Necessario per verificare zaino, giacca blu e secondo soggetto.", source_refs=[verbale_uscita, testimone_volto]),
            EvidenceItem(title="Dati telefono / geolocalizzazione", status="da valutare", notes="Il cliente chiede di acquisire dati di localizzazione del telefono.", source_refs=[ref("nota_cliente.txt", "chiede di acquisire le immagini della farmacia e i dati di geolocalizzazione del telefono", 0.84, "cliente-3")]),
        ],
        open_questions=[
            OpenQuestion(question="Chi è il testimone 'Luca' e come può essere identificato/contattato?", why_it_matters="Potrebbe confermare la presenza davanti alla farmacia e ridurre il rischio cautelare.", source_refs=[cliente_farmacia]),
            OpenQuestion(question="Il testimone Anna Verdi può riconoscere Marco Bianchi o solo una giacca blu?", why_it_matters="L'identificazione appare incerta e va cristallizzata prima dell'udienza.", source_refs=[testimone_volto]),
            OpenQuestion(question="Lo zaino nero è stato sequestrato? Sono presenti impronte, scontrini o immagini?", why_it_matters="La disponibilità dello zaino è un punto fattuale centrale.", source_refs=[cliente_zaino, verbale_uscita]),
        ],
        missing_documents=[
            MissingDocument(title="Video farmacia", reason="Verifica alibi/parziale collocazione temporale alle 21:15.", priority="alta"),
            MissingDocument(title="Video interno supermercato", reason="Verifica condotta, zaino e identità del secondo soggetto.", priority="alta"),
            MissingDocument(title="Documenti su domicilio/lavoro", reason="Rilevanti per discussione misura cautelare.", priority="media"),
        ],
        contradictions=[
            Contradiction(title="Contraddizione oraria 21:15 / 21:20", description="La versione del cliente lo colloca davanti alla farmacia alle 21:15, mentre il verbale lo colloca presso l'uscita laterale alle 21:20.", source_refs=[cliente_farmacia, verbale_uscita]),
            Contradiction(title="Identificazione della seconda persona non chiara", description="Il verbale parla di concorso con secondo soggetto, ma la testimone non vede chiaramente il volto della seconda persona.", source_refs=[contestazione, testimone_volto]),
        ],
        procedural_deadlines=[
            ProceduralDeadline(
                title="Udienza di convalida e misura",
                deadline_type="hearing",
                due_date="2026-04-20",
                due_time="09:30",
                status="confirmed",
                urgency="alta",
                description="Udienza presso Tribunale di Roma, aula 4. Portare documentazione difensiva urgente e note sui punti critici.",
                start_work_date="2026-04-19",
                internal_target_date="2026-04-19",
                source_refs=[udienza],
                tasks=[
                    "Preparare scaletta su contraddizione oraria 21:15 / 21:20.",
                    "Portare documentazione su domicilio/lavoro ai fini della misura.",
                    "Verificare disponibilità immediata dei video farmacia/supermercato.",
                ],
            ),
            ProceduralDeadline(
                title="Memoria difensiva / note per la misura",
                deadline_type="defense_brief",
                due_date="2026-05-31",
                due_time=None,
                status="candidate",
                urgency="media",
                description="Termine candidato estratto dall'avviso: preparare note difensive e deposito documentale con anticipo, da confermare manualmente.",
                start_work_date="2026-05-15",
                internal_target_date="2026-05-29",
                source_refs=[termine_memoria],
                tasks=[
                    "Confermare il termine in cancelleria o sul fascicolo telematico.",
                    "Redigere sezione sulla contraddizione tra farmacia e uscita laterale.",
                    "Allegare richiesta/acquisizione video farmacia e supermercato.",
                    "Chiudere bozza almeno un giorno feriale prima della scadenza ufficiale.",
                ],
            ),
        ],
        brief_markdown=(
            "## Promemoria difensivo rapido\n\n"
            "**Udienza:** 20/04/2026 ore 09:30, Tribunale di Roma, aula 4.\n\n"
            "### Punti da verificare\n"
            "- Acquisire subito immagini farmacia via Roma per fascia 21:10–21:25.\n"
            "- Identificare e sentire 'Luca'.\n"
            "- Verificare se lo zaino nero sia stato sequestrato e a chi fosse riferibile.\n"
            "- Chiedere chiarimenti alla testimone sulla capacità di riconoscimento.\n\n"
            "### Linea iniziale\n"
            "Insistere su incertezza identificativa del secondo soggetto, contraddizione temporale da verificare con video esterni, e documentazione su domicilio/lavoro ai fini della misura."
        ),
        usage_estimate=UsageEstimate(
            pages=4,
            audio_minutes=0,
            flash_input_tokens=3200,
            flash_output_tokens=1400,
            pro_used=False,
            model_route="deepseek-v4-flash",
        ),
    )
