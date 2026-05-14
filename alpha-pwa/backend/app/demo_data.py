from __future__ import annotations

from .models import (
    CaseAnalysis,
    CaseSummary,
    ChargeAnalysis,
    ChargeElement,
    Contradiction,
    ConstitutionalIssue,
    DefenseStrategy,
    EvidenceBalance,
    EvidenceItem,
    LegalAnalysis,
    Material,
    MissingDocument,
    OpenQuestion,
    Person,
    ProceduralDeadline,
    SourceRef,
    TimelineEvent,
    UsageEstimate,
    WitnessAssessment,
)


def ref(source_name: str, quote: str, confidence: float = 0.86, chunk: str | None = None) -> SourceRef:
    return SourceRef(source_name=source_name, page=1, chunk=chunk, quote=quote, confidence=confidence)


# ─────────────────────────────────────────────────────────────────────────────
# DEMO CASE 1 — Furto aggravato in concorso (Rome)
# ─────────────────────────────────────────────────────────────────────────────

def build_demo_case() -> CaseAnalysis:
    verbale_uscita = ref(
        "verbale_arresto.txt",
        "Gli agenti intervenuti fermano Marco Bianchi nei pressi dell'uscita laterale.",
        0.91, "arresto-1",
    )
    contestazione = ref(
        "verbale_arresto.txt",
        "Viene contestato provvisoriamente il furto aggravato in concorso ex artt. 624, 625 e 110 c.p.",
        0.9, "contestazione-1",
    )
    testimone_volto = ref(
        "dichiarazione_testimone.txt",
        "precisa di non aver visto chiaramente il volto della seconda persona",
        0.88, "testimone-1",
    )
    cliente_farmacia = ref(
        "nota_cliente.txt",
        "Marco Bianchi sostiene che alle 21:15 era già uscito dal supermercato e si trovava davanti alla farmacia di via Roma",
        0.86, "cliente-1",
    )
    cliente_zaino = ref(
        "nota_cliente.txt",
        "Aggiunge che lo zaino nero non era suo",
        0.84, "cliente-2",
    )
    udienza = ref(
        "avviso_udienza.txt",
        "Udienza di convalida e discussione misura fissata per il 20/04/2026 ore 09:30 presso il Tribunale di Roma, aula 4.",
        0.95, "udienza-1",
    )
    termine_memoria = ref(
        "avviso_udienza.txt",
        "Eventuali note difensive e documentazione a supporto della misura dovranno essere depositate entro il 31/05/2026.",
        0.78, "termine-memoria-1",
    )

    legal_analysis = LegalAnalysis(
        risk_level="medium",
        risk_summary=(
            "Rischio medio: l'accusa di furto aggravato in concorso si basa su prove fisiche contestate "
            "(zaino) e su un'identificazione testimoniale debole. Il concorso ex art. 110 c.p. è la parte "
            "più vulnerabile dell'impianto accusatorio. Un alibi verificabile potrebbe capovolgere il quadro."
        ),
        immediate_actions=[
            "URGENTE: Richiedere oggi stesso le immagini CCTV della farmacia di via Roma per la fascia 21:10–21:25.",
            "Identificare e contattare il testimone 'Luca' (cognome da verificare) prima dell'udienza del 20/04.",
            "Richiedere in cancelleria il verbale completo di sequestro: elenco merce, impronte digitali sullo zaino, fotografie.",
            "Acquisire tabulati telefonici e dati GPS del cliente per la fascia oraria 21:00–21:30.",
            "Preparare documentazione su lavoro, domicilio e incensuratezza per la discussione della misura cautelare.",
        ],
        charges=[
            ChargeAnalysis(
                charge_code="Art. 624 c.p.",
                charge_name="Furto",
                max_sentence="reclusione da 6 mesi a 3 anni",
                elements_required=[
                    ChargeElement(
                        element="Impossessamento della cosa mobile altrui",
                        description="Il PM deve provare che l'imputato si è impossessato fisicamente della merce",
                        status="disputed",
                        notes="Lo zaino è stato trovato nelle vicinanze di Bianchi, ma il cliente nega la disponibilità. Nessuna prova biometrica confermata.",
                        source_refs=[verbale_uscita, cliente_zaino],
                    ),
                    ChargeElement(
                        element="Sottrazione alla disponibilità del detentore",
                        description="La merce era esposta nel supermercato e non risulta pagata",
                        status="proven",
                        notes="Non contestato: la merce non è stata pagata e il valore è di circa €340.",
                        source_refs=[verbale_uscita],
                    ),
                    ChargeElement(
                        element="Dolo specifico di profitto",
                        description="L'imputato deve aver agito con intenzione di trarne un vantaggio patrimoniale",
                        status="weak",
                        notes="Nessuna dichiarazione o elemento specifico sull'intento di profitto è stato acquisito.",
                        source_refs=[],
                    ),
                ],
                available_defenses=[
                    "Lo zaino non appartiene all'imputato: nessuna prova biometrica (impronte, DNA) lo collega direttamente.",
                    "La semplice vicinanza a un oggetto non equivale a impossessamento.",
                    "Alibi parziale verificabile: se Bianchi era alla farmacia alle 21:15, non poteva essere all'uscita laterale alle 21:20.",
                ],
                prosecution_strength=0.58,
                notes="Il punto critico è il nesso tra Bianchi e lo zaino. Se le impronte non corrispondono o il verbale di sequestro è impreciso, l'accusa si indebolisce significativamente.",
                source_refs=[verbale_uscita, cliente_zaino],
            ),
            ChargeAnalysis(
                charge_code="Art. 625 c.p.",
                charge_name="Furto aggravato (luogo aperto al pubblico + due persone)",
                max_sentence="reclusione da 1 a 6 anni",
                elements_required=[
                    ChargeElement(
                        element="Fatto commesso in luogo aperto al pubblico",
                        description="Il supermercato rientra pacificamente nella categoria",
                        status="proven",
                        notes="Non contestabile.",
                        source_refs=[verbale_uscita],
                    ),
                    ChargeElement(
                        element="Fatto commesso da due o più persone (n. 5 art. 625)",
                        description="L'aggravante richiede la partecipazione materiale di almeno due persone",
                        status="disputed",
                        notes="Il secondo soggetto non è stato identificato. Anna Verdi non ha visto il volto della seconda persona. La mera fuga di un secondo soggetto non integra l'aggravante.",
                        source_refs=[testimone_volto, contestazione],
                    ),
                ],
                available_defenses=[
                    "Impossibile provare il concorso senza identificazione del secondo soggetto.",
                    "La presenza di una seconda persona nell'area non integra automaticamente l'aggravante.",
                    "Giurisprudenza: l'aggravante richiede un effettivo contributo materiale del complice al furto.",
                ],
                prosecution_strength=0.45,
                notes="L'aggravante del concorso (n. 5 art. 625) è la componente più vulnerabile. Senza identificazione del secondo soggetto o prove di coordinamento, cade con alta probabilità.",
                source_refs=[contestazione, testimone_volto],
            ),
            ChargeAnalysis(
                charge_code="Art. 110 c.p.",
                charge_name="Concorso di persone nel reato",
                max_sentence="(la stessa pena prevista per il reato principale)",
                elements_required=[
                    ChargeElement(
                        element="Partecipazione materiale di almeno due persone",
                        description="Ogni concorrente deve aver dato un contributo causale alla realizzazione del fatto",
                        status="weak",
                        notes="Il secondo soggetto non è stato identificato. Non è chiaro quale contributo avrebbe apportato.",
                        source_refs=[testimone_volto],
                    ),
                    ChargeElement(
                        element="Dolo di concorso: consapevolezza del contributo altrui",
                        description="Ogni concorrente deve essere consapevole dell'apporto degli altri",
                        status="missing",
                        notes="Nessun elemento acquisito prova la consapevolezza condivisa tra Bianchi e il secondo soggetto.",
                        source_refs=[],
                    ),
                ],
                available_defenses=[
                    "Mancata identificazione del presunto complice — impossibile provare il concorso.",
                    "Assenza di prove di accordo preventivo o coordinamento.",
                    "La mera presenza di due persone in un luogo non integra il dolo di concorso (Cass. pen., sez. V).",
                ],
                prosecution_strength=0.28,
                notes="Questa è l'accusa più fragile. Senza il secondo soggetto e senza prove di accordo, il concorso è difficilmente sostenibile in dibattimento.",
                source_refs=[contestazione],
            ),
        ],
        strategies=[
            DefenseStrategy(
                title="Alibi parziale — presenza alla farmacia di via Roma alle 21:15",
                strategy_type="alibi",
                priority="primary",
                description=(
                    "Il cliente sostiene di essere già uscito dal supermercato alle 21:15 e di trovarsi davanti "
                    "alla farmacia di via Roma quando sono intervenuti gli agenti. Se i video CCTV confermano "
                    "la sua presenza alla farmacia, diventa molto difficile collocarlo all'uscita laterale del "
                    "supermercato alle 21:20. Il gap temporale di 5 minuti e la distanza fisica sono centrali."
                ),
                strengths=[
                    "Il cliente ha indicato una location specifica e verificabile (farmacia via Roma).",
                    "Esiste un testimone potenziale (Luca) che può confermare la presenza.",
                    "La contraddizione temporale di 5 minuti è concreta e verificabile con video.",
                    "I dati GPS del telefono possono confermare la posizione indipendentemente.",
                ],
                risks=[
                    "I video potrebbero non coprire la fascia oraria necessaria o essere già stati sovrascritti.",
                    "Luca potrebbe non essere raggiungibile o potrebbe ritrattare.",
                    "5 minuti potrebbero essere ritenuti compatibili con il percorso se la distanza è breve.",
                ],
                required_evidence=[
                    "Video CCTV della farmacia di via Roma per le 21:10–21:25 (da richiedere oggi).",
                    "Dichiarazione scritta del testimone Luca.",
                    "Tabulati telefonici / dati GPS del cliente per la fascia 21:00–21:30.",
                    "Perizia planimetrica con tempi di percorrenza farmacia–uscita laterale supermercato.",
                ],
                source_refs=[cliente_farmacia, verbale_uscita],
            ),
            DefenseStrategy(
                title="Disconoscimento dello zaino — assenza di nesso biometrico",
                strategy_type="lack_of_intent",
                priority="secondary",
                description=(
                    "Il cliente nega di avere la disponibilità dello zaino nero. Il verbale dice che Bianchi "
                    "'risultava in possesso' dello zaino, ma non specifica se lo portava indosso o si trovava "
                    "semplicemente nelle vicinanze. Senza impronte, DNA o video che mostrino Bianchi con lo zaino, "
                    "il nesso fisico è tutto da provare."
                ),
                strengths=[
                    "La mera prossimità a un oggetto non equivale alla disponibilità penalmente rilevante.",
                    "Senza prove biometriche (impronte, DNA), il collegamento è presuntivo.",
                    "Il verbale di arresto non specifica la posizione esatta dello zaino rispetto a Bianchi.",
                ],
                risks=[
                    "Il verbale afferma esplicitamente che Bianchi 'risultava in possesso': è difficile da ribaltare senza prove contrarie.",
                    "Gli agenti potrebbero testimoniare di averlo visto portare lo zaino.",
                ],
                required_evidence=[
                    "Verbale completo di sequestro (non solo l'estratto disponibile).",
                    "Risultato esame impronte digitali sullo zaino (richiesta formale urgente).",
                    "Fotografie del sequestro che mostrino la posizione dello zaino rispetto a Bianchi.",
                    "Relazione degli agenti con dettagli sul momento del fermo.",
                ],
                source_refs=[cliente_zaino, verbale_uscita],
            ),
            DefenseStrategy(
                title="Attacco all'accusa di concorso — secondo soggetto mai identificato",
                strategy_type="misidentification",
                priority="secondary",
                description=(
                    "Il secondo soggetto non è stato mai identificato e la testimone Anna Verdi dichiara "
                    "esplicitamente di non aver visto il volto della seconda persona. Senza identificazione "
                    "e senza prove di coordinamento, l'accusa di concorso (art. 110 c.p.) e l'aggravante "
                    "del fatto commesso da due persone (art. 625 n. 5 c.p.) non reggono in dibattimento."
                ),
                strengths=[
                    "La testimone ammette esplicitamente di non aver visto il volto della seconda persona.",
                    "Il verbale riconosce che il secondo soggetto è fuggito senza essere identificato.",
                    "La giurisprudenza richiede la prova concreta del dolo di concorso, non solo la presenza.",
                ],
                risks=[
                    "Il PM potrebbe sostenere che l'accordo era implicito nella condotta coordinata.",
                    "La fuga del secondo soggetto potrebbe essere interpretata come indice di colpevolezza condivisa.",
                ],
                required_evidence=[
                    "Trascrizione integrale della dichiarazione di Anna Verdi.",
                    "Accertamento se siano state avviate indagini per identificare il secondo soggetto.",
                    "Giurisprudenza Cassazione penale sez. V sul dolo di concorso nel furto.",
                ],
                source_refs=[testimone_volto, contestazione],
            ),
            DefenseStrategy(
                title="Misura cautelare — strategia di contenimento",
                strategy_type="negotiation",
                priority="fallback",
                description=(
                    "Indipendentemente dall'esito sul merito, l'obiettivo primario per l'udienza del 20/04 "
                    "è evitare la custodia cautelare in carcere. Documentare solidità del domicilio, "
                    "occupazione lavorativa e assenza di precedenti per sostenere la non necessità della misura."
                ),
                strengths=[
                    "Il furto aggravato non rientra nei reati ostativi alla misura non custodiale.",
                    "Se parte dell'alibi è confermata, il rischio di reiterazione appare limitato.",
                    "Un domicilio stabile e un lavoro documentato sono elementi forti per la misura.",
                ],
                risks=[
                    "Il presunto concorso con soggetto ignoto potrebbe essere letto come indice di pericolosità sociale.",
                    "Se l'alibi non è confermato, il quadro cautelare si complica.",
                ],
                required_evidence=[
                    "Contratto di lavoro o altra attestazione occupazionale recente.",
                    "Contratto d'affitto o certificato di residenza.",
                    "Certificato del casellario giudiziale (incensuratezza o precedenti).",
                    "Eventuale documentazione familiare (figli a carico, ecc.).",
                ],
                source_refs=[udienza],
            ),
        ],
        constitutional_issues=[
            ConstitutionalIssue(
                title="Legittimità del fermo: cause specifiche non documentate",
                issue_type="procedural_violation",
                severity="significant",
                description=(
                    "Il verbale di arresto non specifica i motivi concreti e specifici che hanno determinato "
                    "il fermo di Bianchi. Gli agenti devono avere 'fondato motivo' (art. 349 c.p.p.) o "
                    "indicazioni concrete di un reato in atto. La sola vicinanza all'uscita laterale di un "
                    "supermercato potrebbe non essere sufficiente a giustificare il fermo."
                ),
                legal_basis="Art. 349, 347 c.p.p.; Art. 13 Cost.",
                remedy=(
                    "Richiedere in udienza la produzione del rapporto dettagliato degli agenti con i motivi "
                    "specifici del fermo. Se i motivi non sono documentati o non sono sufficienti, si può "
                    "eccepire l'inutilizzabilità delle prove acquisite (art. 191 c.p.p.)."
                ),
                source_refs=[verbale_uscita],
            ),
        ],
        witness_assessments=[
            WitnessAssessment(
                witness_name="Anna Verdi",
                role="prosecution",
                credibility_score=0.61,
                key_testimony=(
                    "Ha visto due persone dirigersi verso l'uscita laterale intorno alle 21:18, "
                    "ma non ha visto chiaramente il volto della seconda persona. Identifica una giacca blu."
                ),
                strengths=[
                    "Dipendente del supermercato, presenza sul posto motivata e plausibile.",
                    "Riconosce i propri limiti percettivi (ammette di non aver visto il volto).",
                    "Testimonianza spontanea, non suggerita dagli agenti.",
                ],
                vulnerabilities=[
                    "Non ha visto chiaramente il volto della seconda persona.",
                    "L'area dell'uscita laterale è 'meno illuminata' (sua stessa ammissione).",
                    "Identifica un capo d'abbigliamento (giacca blu), non una persona.",
                    "La memoria può essere stata contaminata dal successivo interrogatorio.",
                    "Non specifica se abbia visto qualcuno prelevare merce dagli scaffali.",
                ],
                cross_examination_angles=[
                    "Chiedere le condizioni esatte di illuminazione dell'uscita laterale.",
                    "Chiedere quante persone con giacche simili transitavano in quella fascia oraria.",
                    "Chiedere se abbia visto direttamente Bianchi o solo una sagoma con lo zaino.",
                    "Chiedere se avesse già visto Bianchi nel negozio in occasioni precedenti.",
                    "Chiedere se abbia assistito all'effettiva sottrazione della merce dagli scaffali.",
                ],
                source_refs=[testimone_volto],
            ),
            WitnessAssessment(
                witness_name="Luca (cognome da identificare)",
                role="defense",
                credibility_score=0.72,
                key_testimony=(
                    "Conoscente del cliente, indicato come presente davanti alla farmacia di via Roma "
                    "alle 21:15 circa. Potenzialmente conferma l'alibi parziale."
                ),
                strengths=[
                    "Se confermato, è il testimone chiave per l'alibi.",
                    "Nessun interesse diretto nel procedimento (non coinvolto nella vicenda).",
                    "La sua presenza è verificabile con altri elementi (video, tabulati).",
                ],
                vulnerabilities=[
                    "Non ancora identificato né contattato.",
                    "Potrebbe rifiutarsi di testimoniare o non ricordare con precisione.",
                    "La credibilità dipenderà dalla storia personale e dalla coerenza delle dichiarazioni.",
                ],
                cross_examination_angles=[],
                source_refs=[cliente_farmacia],
            ),
            WitnessAssessment(
                witness_name="Maresciallo Rossi / Agente De Luca",
                role="prosecution",
                credibility_score=0.79,
                key_testimony=(
                    "Agenti intervenuti sul posto dopo la segnalazione: hanno fermato Bianchi nei pressi "
                    "dell'uscita laterale e redatto il verbale di arresto."
                ),
                strengths=[
                    "Testimoni istituzionali, presunzione di attendibilità.",
                    "Presenza diretta sul luogo del fermo.",
                    "Verbale redatto contestualmente ai fatti (21:35).",
                ],
                vulnerabilities=[
                    "Non specificano i motivi precisi del fermo nel verbale disponibile.",
                    "Non hanno assistito alla sottrazione della merce dagli scaffali.",
                    "Il verbale non indica la posizione esatta dello zaino rispetto a Bianchi.",
                ],
                cross_examination_angles=[
                    "Chiedere i motivi specifici che li hanno indotti a fermare Bianchi e non altri.",
                    "Chiedere se Bianchi portasse lo zaino indosso o si trovasse semplicemente nelle vicinanze.",
                    "Chiedere se avessero già ricevuto una descrizione specifica del soggetto da cercare.",
                ],
                source_refs=[verbale_uscita],
            ),
        ],
        evidence_balance=EvidenceBalance(
            prosecution_strength=0.56,
            defense_strength=0.44,
            key_prosecution_evidence=[
                "Zaino con merce non pagata (€340) trovato in prossimità di Bianchi.",
                "Presenza documentata nei pressi dell'uscita laterale alle 21:20.",
                "Avvistamento da parte della commessa di due persone verso l'uscita.",
                "Verbale di arresto redatto contestualmente dai carabinieri.",
            ],
            key_defense_evidence=[
                "Alibi parziale verificabile: cliente sostiene di essere alla farmacia alle 21:15.",
                "Testimone non riconosce il volto di nessuno dei due soggetti.",
                "Zaino contestato: nessuna prova biometrica di possesso.",
                "Secondo soggetto mai identificato → accusa di concorso molto debole.",
                "Potenziale testimone Luca che può confermare l'alibi.",
            ],
            critical_gaps=[
                "Video CCTV farmacia via Roma (alibi confermato o smentito — decide il caso).",
                "Risultato esame impronte digitali sullo zaino (nesso fisico con Bianchi).",
                "Identità e dichiarazione del testimone Luca.",
                "Verbale completo di sequestro con posizione esatta dello zaino.",
                "Dati GPS / tabulati telefonici del cliente per la fascia 21:00–21:30.",
            ],
            overall_assessment=(
                "Il caso è attualmente in equilibrio con leggero vantaggio accusatorio. Le prove fisiche "
                "(zaino) sono il punto di forza dell'accusa, ma la mancata identificazione del secondo "
                "soggetto e la debolezza dell'identificazione testimoniale rendono l'impianto fragile. "
                "L'alibi parziale, se confermato da video e dal testimone Luca, potrebbe capovolgere "
                "il quadro. Obiettivo prioritario: acquisire i video della farmacia entro oggi."
            ),
        ),
        client_summary=(
            "Marco, l'accusa si basa sul fatto che sei stato trovato vicino a uno zaino con merce "
            "non pagata. Ci sono però elementi importanti a tuo favore: la testimone non ha riconosciuto "
            "il tuo volto, il presunto complice non è mai stato identificato, e se il video della farmacia "
            "conferma che eri lì alle 21:15 come dici tu, cambia tutto. Dobbiamo recuperare quei video "
            "oggi stesso e trovare Luca prima dell'udienza."
        ),
    )

    return CaseAnalysis(
        case_id="demo-furto-aggravato-roma-2026",
        case_title="Caso Bianchi — Furto aggravato in concorso",
        language="it",
        case_summary=(
            "Fascicolo demo: Marco Bianchi fermato dopo presunto furto aggravato in concorso "
            "presso un supermercato. Contraddizione critica sull'orario (21:15 vs 21:20), "
            "identificazione testimoniale incerta, secondo soggetto mai identificato."
        ),
        materials=[
            Material(
                id="verbale_arresto", name="verbale_arresto.txt", kind="text",
                description="Verbale di arresto e contestazione provvisoria — Commissariato Roma Centro.",
                excerpt="Fermo presso uscita laterale, zaino nero, secondo soggetto verso via Roma.",
                content=(
                    "VERBALE DI ARRESTO — Commissariato Roma Centro\n\n"
                    "Agenti: Maresciallo Rossi, Agente De Luca\n\n"
                    "Il giorno 18/04/2026, alle ore 21:20 circa, gli agenti sopraindicati intervenivano "
                    "presso il supermercato Conad di via Nazionale 85 a seguito di segnalazione di furto in atto.\n\n"
                    "Sul posto veniva fermato il signor Marco Bianchi (nato a Roma il 12/03/1998) nei pressi dell'uscita "
                    "laterale del supermercato. Il soggetto risultava in possesso di uno zaino di colore nero contenente "
                    "merce non pagata per un valore stimato di circa € 340.\n\n"
                    "Un secondo soggetto veniva visto allontanarsi in direzione via Roma, non identificato.\n\n"
                    "Al signor Bianchi veniva contestato il furto aggravato in concorso ai sensi degli "
                    "artt. 624, 625 e 110 c.p.\n\n"
                    "Verbale redatto alle 21:35 del 18/04/2026."
                ),
            ),
            Material(
                id="dichiarazione_testimone", name="dichiarazione_testimone.txt", kind="text",
                description="Dichiarazione della commessa Anna Verdi.",
                excerpt="La testimone non vede chiaramente il volto della seconda persona.",
                content=(
                    "DICHIARAZIONE TESTIMONE — Anna Verdi\n\n"
                    "La sottoscritta Anna Verdi (nata a Roma il 05/09/1995), dipendente del supermercato Conad "
                    "di via Nazionale 85, dichiara quanto segue.\n\n"
                    "Mi trovavo nei pressi degli scaffali elettronici intorno alle 21:18 quando ho notato "
                    "un uomo con una giacca blu che passava rapidamente. Ho visto due persone dirigersi "
                    "verso l'uscita laterale ma non ho visto chiaramente i loro volti.\n\n"
                    "In particolare, preciso di non aver visto chiaramente il volto della seconda persona "
                    "che si allontanava. La zona dell'uscita laterale è meno illuminata.\n\n"
                    "Letto, confermato e sottoscritto."
                ),
            ),
            Material(
                id="nota_cliente", name="nota_cliente.txt", kind="text",
                description="Nota colloquio difensivo — Marco Bianchi.",
                excerpt="Il cliente sostiene di essere stato davanti alla farmacia alle 21:15.",
                content=(
                    "NOTA COLLOQUIO DIFENSIVO — 20/04/2026\n\n"
                    "Cliente: Marco Bianchi\n\n"
                    "Il cliente sostiene di essere già uscito dal supermercato intorno alle 21:15 e di "
                    "trovarsi davanti alla farmacia di via Roma quando sono intervenuti gli agenti. Aggiunge "
                    "che lo zaino nero non era suo.\n\n"
                    "Dichiara di essere accompagnato in quel momento da un conoscente di nome Luca (cognome "
                    "da verificare) che potrebbe confermare la presenza davanti alla farmacia.\n\n"
                    "Chiede di acquisire le immagini della farmacia e i dati di geolocalizzazione del telefono "
                    "per confermare la posizione alle 21:15."
                ),
            ),
            Material(
                id="avviso_udienza", name="avviso_udienza.txt", kind="text",
                description="Avviso di udienza di convalida e misura — GIP Roma.",
                excerpt="Udienza 20/04/2026 ore 09:30, Tribunale di Roma, aula 4.",
                content=(
                    "AVVISO DI UDIENZA — Ufficio GIP Roma\n\n"
                    "Udienza di convalida e discussione misura fissata per il giorno\n\n"
                    "20 aprile 2026, ore 09:30\n\n"
                    "presso il Tribunale di Roma, aula 4.\n\n"
                    "Eventuali note difensive e documentazione a supporto della misura dovranno essere "
                    "depositate entro il 31 maggio 2026.\n\n"
                    "Si raccomanda la comparizione personale del difensore."
                ),
            ),
        ],
        timeline=[
            TimelineEvent(
                date="2026-04-18", time="21:15",
                title="Versione cliente: presenza davanti alla farmacia",
                description="Bianchi riferisce di essere già uscito dal supermercato e di trovarsi davanti alla farmacia di via Roma.",
                source_refs=[cliente_farmacia], confidence=0.82,
            ),
            TimelineEvent(
                date="2026-04-18", time="21:18",
                title="Avvistamento presso scaffali elettronici",
                description="La testimone vede un uomo con giacca blu vicino agli scaffali e due persone verso l'uscita laterale.",
                source_refs=[ref("dichiarazione_testimone.txt", "intorno alle 21:18 ha visto un uomo con giacca blu passare vicino agli scaffali elettronici", 0.87, "testimone-2")],
                confidence=0.78,
            ),
            TimelineEvent(
                date="2026-04-18", time="21:20",
                title="Fermo presso uscita laterale",
                description="Secondo il verbale, gli agenti fermano Bianchi nei pressi dell'uscita laterale del supermercato.",
                source_refs=[verbale_uscita], confidence=0.91,
            ),
            TimelineEvent(
                date="2026-04-18", time="21:35",
                title="Contestazione provvisoria",
                description="Viene contestato il furto aggravato in concorso ai sensi degli artt. 624, 625 e 110 c.p.",
                source_refs=[contestazione], confidence=0.9,
            ),
            TimelineEvent(
                date="2026-04-20", time="09:30",
                title="Udienza di convalida e misura",
                description="Udienza presso il Tribunale di Roma, aula 4. Necessaria documentazione difensiva urgente.",
                source_refs=[udienza], confidence=0.95,
            ),
        ],
        people=[
            Person(name="Marco Bianchi", role="indagato/assistito", notes="Contesta la disponibilità dello zaino nero e indica possibile alibi parziale (farmacia ore 21:15).", source_refs=[cliente_farmacia, cliente_zaino]),
            Person(name="Anna Verdi", role="testimone dell'accusa", notes="Commessa; identifica una giacca blu ma non il volto della seconda persona.", source_refs=[testimone_volto]),
            Person(name="Luca (cognome ignoto)", role="possibile testimone della difesa", notes="Conoscente indicato dal cliente come presente davanti alla farmacia. Da identificare urgentemente.", source_refs=[cliente_farmacia]),
            Person(name="Maresciallo Rossi / Agente De Luca", role="agenti intervenuti", notes="Hanno redatto il verbale di arresto. Testimoni chiave sulla dinamica del fermo.", source_refs=[verbale_uscita]),
        ],
        evidence=[
            EvidenceItem(title="Immagini CCTV farmacia via Roma", status="da acquisire — URGENTE", notes="Fondamentali per confermare o smentire l'alibi del cliente (21:10–21:25).", source_refs=[cliente_farmacia]),
            EvidenceItem(title="Video supermercato / uscita laterale", status="da acquisire", notes="Necessario per verificare zaino, giacca blu, secondo soggetto e dinamica del fermo.", source_refs=[verbale_uscita, testimone_volto]),
            EvidenceItem(title="Tabulati telefonici / GPS cliente", status="da valutare", notes="Il cliente chiede l'acquisizione dei dati di localizzazione per la fascia 21:00–21:30.", source_refs=[ref("nota_cliente.txt", "chiede di acquisire le immagini della farmacia e i dati di geolocalizzazione del telefono", 0.84, "cliente-3")]),
            EvidenceItem(title="Zaino nero + impronte digitali", status="in sequestro — esito impronte da richiedere", notes="Prova centrale: se le impronte non corrispondono a Bianchi, il nesso fisico crolla.", source_refs=[verbale_uscita, cliente_zaino]),
        ],
        open_questions=[
            OpenQuestion(question="Chi è il testimone 'Luca' e come può essere identificato e contattato?", why_it_matters="Potrebbe confermare l'alibi parziale e ridurre significativamente il rischio cautelare.", source_refs=[cliente_farmacia]),
            OpenQuestion(question="La testimone Anna Verdi può riconoscere Marco Bianchi o solo una giacca blu?", why_it_matters="L'identificazione appare incerta: va cristallizzata prima dell'udienza.", source_refs=[testimone_volto]),
            OpenQuestion(question="Lo zaino è stato sequestrato? Sono presenti impronte, DNA o scontrini all'interno?", why_it_matters="La disponibilità dello zaino è il punto fattuale centrale dell'accusa.", source_refs=[cliente_zaino, verbale_uscita]),
            OpenQuestion(question="Quali erano i motivi specifici del fermo indicati dagli agenti?", why_it_matters="La legittimità del fermo determina l'utilizzabilità delle prove raccolte (art. 191 c.p.p.).", source_refs=[verbale_uscita]),
        ],
        missing_documents=[
            MissingDocument(title="Video CCTV farmacia via Roma", reason="Verifica alibi parziale del cliente per la fascia 21:10–21:25.", priority="alta"),
            MissingDocument(title="Verbale completo di sequestro", reason="Posizione esatta zaino, elenco merce, esito impronte digitali.", priority="alta"),
            MissingDocument(title="Tabulati telefonici e GPS", reason="Conferma indipendente della posizione del cliente alle 21:15.", priority="alta"),
            MissingDocument(title="Video interno supermercato", reason="Verifica condotta, zaino e identità del secondo soggetto.", priority="alta"),
            MissingDocument(title="Documentazione lavoro e domicilio", reason="Rilevante per discussione misura cautelare all'udienza.", priority="media"),
        ],
        contradictions=[
            Contradiction(
                title="Contraddizione oraria: farmacia 21:15 vs. uscita laterale 21:20",
                description="Il cliente colloca se stesso davanti alla farmacia di via Roma alle 21:15. Il verbale lo colloca presso l'uscita laterale del supermercato alle 21:20. Gap di 5 minuti e locations diverse: da verificare con video e planimetria.",
                source_refs=[cliente_farmacia, verbale_uscita],
            ),
            Contradiction(
                title="Disponibilità zaino: 'in possesso' vs. 'non era mio'",
                description="Il verbale afferma che Bianchi 'risultava in possesso' dello zaino. Il cliente dichiara che lo zaino non era suo. Nessuna prova biometrica ancora disponibile.",
                source_refs=[verbale_uscita, cliente_zaino],
            ),
            Contradiction(
                title="Identificazione della seconda persona: concorso vs. testimone incerta",
                description="Il verbale parla di concorso con secondo soggetto. La testimone dichiara esplicitamente di non aver visto chiaramente il volto della seconda persona.",
                source_refs=[contestazione, testimone_volto],
            ),
        ],
        procedural_deadlines=[
            ProceduralDeadline(
                title="Udienza di convalida e misura",
                deadline_type="hearing", due_date="2026-04-20", due_time="09:30",
                status="confirmed", urgency="alta",
                description="Udienza presso Tribunale di Roma, aula 4. Portare documentazione difensiva e scaletta sui punti critici.",
                start_work_date="2026-04-19", internal_target_date="2026-04-19",
                source_refs=[udienza],
                tasks=[
                    "Preparare scaletta: contraddizione oraria 21:15/21:20, zaino, identificazione.",
                    "Portare documentazione su domicilio/lavoro per la misura cautelare.",
                    "Verificare disponibilità immediata dei video farmacia/supermercato.",
                    "Contattare e, se possibile, sentire il testimone Luca.",
                ],
            ),
            ProceduralDeadline(
                title="Deposito memoria difensiva",
                deadline_type="defense_brief", due_date="2026-05-31",
                status="candidate", urgency="media",
                description="Termine candidato: note difensive e documentale. Confermare manualmente con la cancelleria.",
                start_work_date="2026-05-15", internal_target_date="2026-05-29",
                source_refs=[termine_memoria],
                tasks=[
                    "Confermare il termine in cancelleria o sul fascicolo telematico.",
                    "Redigere sezione sulla contraddizione oraria e sull'alibi parziale.",
                    "Allegare video farmacia (se acquisito), dichiarazione Luca, esito impronte.",
                    "Chiudere bozza entro il 29/05/2026 (2 giorni feriali di buffer).",
                ],
            ),
        ],
        brief_markdown=(
            "## Promemoria difensivo — Udienza 20/04/2026\n\n"
            "**Cliente:** Marco Bianchi · **Accuse:** artt. 624, 625, 110 c.p.\n\n"
            "### Punti critici da portare in udienza\n"
            "- **Alibi parziale**: il cliente era alla farmacia alle 21:15. Video da acquisire urgentemente.\n"
            "- **Zaino**: disponibilità contestata. Nessuna prova biometrica confermata.\n"
            "- **Concorso**: secondo soggetto mai identificato — aggravante vulnerabile.\n"
            "- **Testimone**: Anna Verdi non ha visto il volto. Identificazione incerta.\n\n"
            "### Linea difensiva principale\n"
            "Insistere sull'alibi parziale (farmacia 21:15), sull'incertezza identificativa del "
            "secondo soggetto, e sul mancato nesso biometrico tra Bianchi e lo zaino. "
            "Contestare la legittimità del fermo se i motivi non sono documentati.\n\n"
            "### Per la misura cautelare\n"
            "Presentare documentazione su lavoro stabile e domicilio. "
            "Reato non di particolare allarme sociale; rischio di reiterazione limitato."
        ),
        usage_estimate=UsageEstimate(
            pages=4, audio_minutes=0,
            flash_input_tokens=3200, flash_output_tokens=1400,
            pro_used=False, model_route="claude-haiku-4-5",
        ),
        legal_analysis=legal_analysis,
    )


# ─────────────────────────────────────────────────────────────────────────────
# DEMO CASE 2 — Truffa informatica (Milano)
# ─────────────────────────────────────────────────────────────────────────────

def build_demo_case_2() -> CaseAnalysis:
    r_email = ref("email_utente.txt", "Ho effettuato un ordine il 12/03/2026 ma non ho mai ricevuto la merce", 0.90, "email-1")
    r_bonifico = ref("estratto_conto.txt", "Bonifico di €890 in data 12/03/2026 intestato a 'Elettronica Express SRL'", 0.94, "conto-1")
    r_registrazione = ref("visura_camerale.txt", "La società risulta regolarmente iscritta al Registro Imprese dal 2024-01-15", 0.91, "visura-1")
    r_chat = ref("chat_cliente.txt", "Il venditore ha risposto: 'Il ritardo è dovuto a problemi logistici del fornitore. La spedizione avverrà entro 7 giorni'", 0.88, "chat-1")
    r_indagine = ref("notifica_indagini.txt", "Ai sensi dell'art. 335 c.p.p. si comunica l'iscrizione nel registro indagati per il reato di cui all'art. 640 c.p.", 0.96, "notifica-1")
    r_merce = ref("perizia_merce.txt", "La merce consegnata risulta non conforme alle specifiche pubblicizzate; valore di mercato stimato: €120 vs. €890 dichiarati", 0.89, "perizia-1")

    legal_analysis_2 = LegalAnalysis(
        risk_level="high",
        risk_summary=(
            "Rischio alto: l'accusa di truffa aggravata si fonda su prove documentali solide "
            "(bonifico, perizia sulla merce non conforme). Il principale punto difensivo è l'elemento "
            "soggettivo: dimostrare l'assenza del dolo iniziale di ingannare i clienti. "
            "La presenza di una società regolarmente costituita è un fattore favorevole."
        ),
        immediate_actions=[
            "Acquisire tutta la documentazione societaria: statuto, bilanci, contratti con fornitori.",
            "Raccogliere prove di spedizioni regolari ad altri clienti per lo stesso periodo.",
            "Documentare le comunicazioni con il fornitore per dimostrare che i ritardi erano reali.",
            "Predisporre un elenco completo degli ordini evasi e non evasi con relativi stati.",
            "Valutare se proporre un risarcimento volontario ai danneggiati prima dell'udienza.",
        ],
        charges=[
            ChargeAnalysis(
                charge_code="Art. 640 c.p.",
                charge_name="Truffa aggravata",
                max_sentence="reclusione da 1 a 5 anni (aggravata: fino a 6 anni)",
                elements_required=[
                    ChargeElement(
                        element="Artifizi o raggiri",
                        description="Il PM deve provare che l'indagato ha usato mezzi ingannevoli per indurre in errore",
                        status="disputed",
                        notes="La descrizione della merce sul sito potrebbe essere considerata artifizio. La difesa sostiene che le descrizioni erano quelle fornite dal produttore.",
                        source_refs=[r_merce],
                    ),
                    ChargeElement(
                        element="Induzione in errore della vittima",
                        description="Il cliente deve essere stato indotto in errore sulle caratteristiche della merce",
                        status="proven",
                        notes="La perizia conferma la non conformità della merce rispetto alle specifiche pubblicate.",
                        source_refs=[r_merce, r_bonifico],
                    ),
                    ChargeElement(
                        element="Profitto ingiusto con danno altrui",
                        description="L'indagato ha ricevuto un pagamento per merce non conforme",
                        status="proven",
                        notes="Bonifico di €890 per merce di valore reale stimato €120.",
                        source_refs=[r_bonifico, r_merce],
                    ),
                    ChargeElement(
                        element="Dolo iniziale: intenzione fraudolenta al momento della vendita",
                        description="Il PM deve provare che l'intenzione di ingannare esisteva già al momento della vendita",
                        status="disputed",
                        notes="Elemento più difficile da provare. Se il cliente aveva intenzione di consegnare merce conforme, manca il dolo iniziale.",
                        source_refs=[r_chat],
                    ),
                ],
                available_defenses=[
                    "Assenza di dolo iniziale: il cliente intendeva consegnare la merce promessa ma ha avuto problemi con il fornitore.",
                    "La descrizione della merce era quella fornita dal produttore (errore, non raggiro).",
                    "Presenza di spedizioni regolari ad altri clienti nello stesso periodo (non è un pattern fraudolento).",
                    "La società è regolarmente registrata — non è una struttura creata appositamente per frodare.",
                ],
                prosecution_strength=0.68,
                notes="La prova del dolo iniziale è il punto debole dell'accusa. Se la difesa può dimostrare che i ritardi erano reali e comunicati in buona fede, l'accusa si indebolisce.",
                source_refs=[r_merce, r_bonifico],
            ),
        ],
        strategies=[
            DefenseStrategy(
                title="Assenza di dolo iniziale — errore del fornitore",
                strategy_type="lack_of_intent",
                priority="primary",
                description=(
                    "La strategia principale è dimostrare che al momento della vendita l'indagato aveva "
                    "la piena intenzione di consegnare la merce promessa. I problemi di conformità sono "
                    "emersi successivamente a causa di un fornitore inaffidabile. Questo esclude il dolo "
                    "iniziale richiesto dalla truffa."
                ),
                strengths=[
                    "La società è regolarmente costituita e operativa da oltre un anno.",
                    "Le comunicazioni col cliente mostrano tentativi di risolvere il problema.",
                    "Se esistono altre spedizioni regolari nello stesso periodo, si esclude il pattern fraudolento.",
                ],
                risks=[
                    "La differenza di valore (€890 vs €120) è molto significativa e difficile da giustificare.",
                    "Il PM potrebbe sostenere che la non conformità era nota al momento della vendita.",
                ],
                required_evidence=[
                    "Contratti e comunicazioni con il fornitore che attestino la fornitura di merce non conforme.",
                    "Elenco ordini evasi regolarmente nello stesso periodo.",
                    "Comunicazioni interne che dimostrino la buona fede al momento delle vendite.",
                ],
                source_refs=[r_chat, r_registrazione],
            ),
            DefenseStrategy(
                title="Risarcimento volontario — riduzione del danno",
                strategy_type="negotiation",
                priority="secondary",
                description=(
                    "Proporre un risarcimento integrale ai danneggiati prima dell'udienza. "
                    "Questo riduce significativamente il rischio di condanna e può portare "
                    "all'applicazione di attenuanti o all'estinzione del reato per riparazione del danno."
                ),
                strengths=[
                    "Dimostra la buona fede dell'indagato.",
                    "Può portare all'estinzione del procedimento o a pene sospese.",
                    "Riduce il rischio di misure cautelari.",
                ],
                risks=[
                    "Il risarcimento potrebbe essere interpretato come ammissione di responsabilità.",
                    "Costo finanziario significativo.",
                ],
                required_evidence=[
                    "Elenco completo dei clienti danneggiati con importi.",
                    "Capacità finanziaria dell'indagato di far fronte al risarcimento.",
                ],
                source_refs=[r_bonifico],
            ),
        ],
        constitutional_issues=[
            ConstitutionalIssue(
                title="Acquisizione dati aziendali: perquisizione e sequestro",
                issue_type="illegal_search",
                severity="minor",
                description=(
                    "Verificare se la perquisizione dei sistemi informatici aziendali sia avvenuta "
                    "con regolare decreto motivato. L'acquisizione di dati elettronici richiede "
                    "procedure specifiche ex artt. 247, 254-bis c.p.p."
                ),
                legal_basis="Art. 247, 254-bis c.p.p.; D.Lgs. 196/2003 (Codice Privacy)",
                remedy="Verificare la regolarità del decreto di perquisizione. Se i dati sono stati acquisiti senza le garanzie previste, chiedere l'inutilizzabilità.",
                source_refs=[r_indagine],
            ),
        ],
        witness_assessments=[
            WitnessAssessment(
                witness_name="Cliente danneggiato (nome da acquisire)",
                role="prosecution",
                credibility_score=0.75,
                key_testimony="Ha ordinato e pagato €890, ricevuto merce non conforme del valore di €120.",
                strengths=["Danno economico documentabile e verificabile.", "Comunicazioni con il venditore agli atti."],
                vulnerabilities=[
                    "Potrebbe non essere in grado di dimostrare che la non conformità era intenzionale.",
                    "La sua valutazione del valore della merce potrebbe non coincidere con la perizia.",
                ],
                cross_examination_angles=[
                    "Chiedere se abbia ricevuto comunicazioni sui ritardi e come abbia risposto.",
                    "Chiedere se fosse chiaro nelle specifiche tecniche dell'ordine.",
                    "Chiedere se abbia precedentemente acquistato da questa piattaforma.",
                ],
                source_refs=[r_email, r_bonifico],
            ),
        ],
        evidence_balance=EvidenceBalance(
            prosecution_strength=0.68,
            defense_strength=0.32,
            key_prosecution_evidence=[
                "Bonifico documentato di €890 per merce di valore reale stimato €120.",
                "Perizia tecnica che attesta la non conformità della merce.",
                "Mancata consegna della merce promessa per oltre 3 mesi.",
                "Iscrizione nel registro indagati ex art. 335 c.p.p.",
            ],
            key_defense_evidence=[
                "Società regolarmente iscritta al Registro Imprese.",
                "Comunicazioni col cliente che mostrano tentativo di risolvere il problema.",
                "Possibile assenza di dolo iniziale se il fornitore ha fornito merce non conforme.",
            ],
            critical_gaps=[
                "Contratti con il fornitore: dimostrano l'intenzione di consegnare merce conforme?",
                "Elenco ordini evasi regolarmente: esclude il pattern fraudolento sistematico?",
                "Bilanci societari: la società era in difficoltà finanziaria al momento delle vendite?",
            ],
            overall_assessment=(
                "Il caso pende a favore dell'accusa per le prove documentali solide (perizia, bonifico). "
                "L'unica via difensiva efficace è dimostrare l'assenza del dolo iniziale attraverso "
                "la documentazione del rapporto col fornitore e il pattern di spedizioni regolari. "
                "Il risarcimento volontario è fortemente raccomandato."
            ),
        ),
        client_summary=(
            "Giacomo, la situazione è seria perché le prove documentali (pagamento ricevuto, merce non "
            "conforme) sono chiare. La nostra difesa si basa sul dimostrare che non avevi l'intenzione "
            "di frodare nessuno: i problemi sono venuti dal fornitore, non dalla tua volontà. "
            "Abbiamo bisogno di tutti i contratti e le comunicazioni con il fornitore, e dobbiamo "
            "valutare seriamente un risarcimento volontario ai clienti danneggiati."
        ),
    )

    return CaseAnalysis(
        case_id="demo-truffa-informatica-milano-2026",
        case_title="Caso Conti — Truffa informatica (e-commerce)",
        language="it",
        case_summary=(
            "Fascicolo demo: Giacomo Conti indagato per truffa aggravata ex art. 640 c.p. "
            "in relazione a vendite online di prodotti elettronici non conformi alle specifiche. "
            "Prove documentali solide per l'accusa; difesa basata sull'assenza del dolo iniziale."
        ),
        materials=[
            Material(
                id="email_utente", name="email_utente.txt", kind="text",
                description="Email di reclamo del cliente danneggiato.",
                excerpt="Ordine del 12/03/2026, merce mai ricevuta o non conforme.",
                content=(
                    "Da: cliente@email.it\nA: info@elettronicaexpress.it\nData: 15/04/2026\n\n"
                    "Buongiorno,\nHo effettuato un ordine il 12/03/2026 (ordine #4521) per un notebook "
                    "con le specifiche indicate sul vostro sito (RAM 16GB, SSD 512GB, processore i7) "
                    "al prezzo di €890. Ho ricevuto un pacco il 28/03/2026 ma la merce non era quella "
                    "descritta: ho trovato un notebook con RAM 4GB, SSD 128GB e processore i3.\n\n"
                    "Ho contattato più volte il vostro servizio clienti ma non ho ricevuto risposte soddisfacenti.\n\n"
                    "Chiedo rimborso immediato o sostituzione della merce con quella originariamente ordinata.\n\n"
                    "Distinti saluti"
                ),
            ),
            Material(
                id="estratto_conto", name="estratto_conto.txt", kind="text",
                description="Estratto conto bancario del cliente con bonifico documentato.",
                excerpt="Bonifico €890 del 12/03/2026 a 'Elettronica Express SRL'.",
                content=(
                    "ESTRATTO CONTO — Banca Generica SpA\n\n"
                    "Periodo: 01/03/2026 – 30/04/2026\n\n"
                    "12/03/2026 — BONIFICO BANCARIO — Elettronica Express SRL — € 890,00 —\n"
                    "Causale: Ordine #4521 notebook specifiche premium\n\n"
                    "Saldo al 30/04/2026: [omissis]"
                ),
            ),
            Material(
                id="visura_camerale", name="visura_camerale.txt", kind="text",
                description="Visura camerale di Elettronica Express SRL.",
                excerpt="Società regolarmente iscritta al Registro Imprese dal 15/01/2024.",
                content=(
                    "VISURA CAMERALE — Camera di Commercio di Milano\n\n"
                    "Denominazione: Elettronica Express SRL\n"
                    "Codice fiscale / P.IVA: [omissis]\n"
                    "Data iscrizione: 15/01/2024\n"
                    "Stato: ATTIVA\n"
                    "Sede: Via Montenapoleone 22, Milano\n"
                    "Attività: Commercio al dettaglio di apparecchiature informatiche (ATECO 47.41)\n"
                    "Capitale sociale: €10.000 i.v.\n"
                    "Rappresentante legale: Conti Giacomo (nato a Milano il 04/07/1990)"
                ),
            ),
            Material(
                id="notifica_indagini", name="notifica_indagini.txt", kind="text",
                description="Notifica di iscrizione nel registro indagati — Procura di Milano.",
                excerpt="Iscrizione per art. 640 c.p. — truffa aggravata.",
                content=(
                    "NOTIFICA EX ART. 335 C.P.P. — Procura della Repubblica di Milano\n\n"
                    "Ai sensi dell'art. 335 c.p.p. si comunica al sig. Conti Giacomo "
                    "l'iscrizione nel registro degli indagati per il reato di cui all'art. 640 c.p. "
                    "(truffa aggravata) in relazione a vendite online di prodotti informatici.\n\n"
                    "Il difensore potrà prendere visione degli atti a partire dalla data della presente."
                ),
            ),
        ],
        timeline=[
            TimelineEvent(date="2026-01-15", time=None, title="Avvio attività e-commerce", description="Elettronica Express SRL inizia le vendite online di prodotti elettronici.", source_refs=[r_registrazione], confidence=0.91),
            TimelineEvent(date="2026-03-12", time=None, title="Ordine e pagamento del cliente", description="Il cliente effettua l'ordine #4521 e paga €890 tramite bonifico.", source_refs=[r_bonifico], confidence=0.94),
            TimelineEvent(date="2026-03-28", time=None, title="Consegna merce non conforme", description="Il cliente riceve un prodotto con specifiche inferiori a quelle acquistate.", source_refs=[r_merce], confidence=0.89),
            TimelineEvent(date="2026-04-15", time=None, title="Email di reclamo del cliente", description="Il cliente contatta la società per richiedere rimborso o sostituzione.", source_refs=[r_email], confidence=0.90),
            TimelineEvent(date="2026-05-10", time=None, title="Notifica iscrizione registro indagati", description="La Procura di Milano notifica l'iscrizione per art. 640 c.p.", source_refs=[r_indagine], confidence=0.96),
        ],
        people=[
            Person(name="Giacomo Conti", role="indagato/assistito", notes="Rappresentante legale di Elettronica Express SRL. Sostiene di non aver avuto intenzione fraudolenta.", source_refs=[r_registrazione]),
            Person(name="Cliente danneggiato", role="parte offesa", notes="Ha acquistato un notebook per €890, ricevuto merce non conforme del valore di ~€120.", source_refs=[r_email, r_bonifico]),
        ],
        evidence=[
            EvidenceItem(title="Perizia tecnica sulla merce consegnata", status="disponibile", notes="Conferma la non conformità: valore reale ~€120 vs. €890 pagati.", source_refs=[r_merce]),
            EvidenceItem(title="Estratto conto con bonifico", status="disponibile", notes="Bonifico documentato: €890 in data 12/03/2026.", source_refs=[r_bonifico]),
            EvidenceItem(title="Contratti con fornitori", status="da acquisire — urgente", notes="Fondamentali per provare l'assenza del dolo iniziale.", source_refs=[r_chat]),
            EvidenceItem(title="Elenco ordini evasi regolarmente", status="da produrre", notes="Dimostra che non è un pattern fraudolento sistematico.", source_refs=[r_registrazione]),
        ],
        open_questions=[
            OpenQuestion(question="Esistono altri clienti danneggiati nello stesso periodo?", why_it_matters="Determina se si tratta di un episodio isolato o di un pattern sistematico (rileva sulla pena).", source_refs=[r_indagine]),
            OpenQuestion(question="I contratti con il fornitore dimostrano che le specifiche erano diverse da quelle promesse?", why_it_matters="È il punto centrale della difesa sull'assenza del dolo iniziale.", source_refs=[r_chat]),
            OpenQuestion(question="La società aveva difficoltà finanziarie al momento delle vendite?", why_it_matters="Potrebbe spiegare i ritardi ma anche essere usato dall'accusa per sostenere il dolo.", source_refs=[r_bonifico]),
        ],
        missing_documents=[
            MissingDocument(title="Contratti con i fornitori", reason="Prova dell'assenza di dolo iniziale: intenzione di consegnare merce conforme.", priority="alta"),
            MissingDocument(title="Comunicazioni interne aziendali", reason="Dimostrano la buona fede al momento delle vendite.", priority="alta"),
            MissingDocument(title="Bilanci societari 2024-2026", reason="Situazione finanziaria rilevante per la strategia difensiva.", priority="media"),
            MissingDocument(title="Elenco completo ordini evasi", reason="Esclude il pattern sistematico di frode.", priority="media"),
        ],
        contradictions=[
            Contradiction(
                title="Specifiche pubblicizzate vs. merce consegnata",
                description="Il sito pubblicizzava un notebook con RAM 16GB, SSD 512GB, i7. Il cliente ha ricevuto RAM 4GB, SSD 128GB, i3. Differenza di valore: €890 vs. ~€120 stimati dalla perizia.",
                source_refs=[r_merce, r_bonifico],
            ),
            Contradiction(
                title="Promessa di spedizione vs. merce non conforme consegnata",
                description="La chat mostra che il venditore prometteva la spedizione 'entro 7 giorni'. La merce consegnata non era quella ordinata.",
                source_refs=[r_chat, r_merce],
            ),
        ],
        procedural_deadlines=[
            ProceduralDeadline(
                title="Termine per nomina difensore e presa visione atti",
                deadline_type="filing", due_date="2026-06-01",
                status="candidate", urgency="alta",
                description="Dopo la notifica ex art. 335 c.p.p., il difensore deve prendere visione degli atti per valutare la strategia.",
                start_work_date="2026-05-15", internal_target_date="2026-05-25",
                source_refs=[r_indagine],
                tasks=[
                    "Prendere visione del fascicolo del PM presso la Procura di Milano.",
                    "Acquisire tutta la documentazione societaria e i contratti con i fornitori.",
                    "Valutare se proporre risarcimento volontario ai danneggiati.",
                    "Preparare memoria difensiva sull'assenza di dolo iniziale.",
                ],
            ),
        ],
        brief_markdown=(
            "## Promemoria difensivo — Caso Conti\n\n"
            "**Cliente:** Giacomo Conti · **Accusa:** Art. 640 c.p. (Truffa aggravata)\n\n"
            "### Punti critici\n"
            "- **Dolo iniziale**: questo è il punto su cui si vince o si perde. Raccogliere tutto ciò che dimostra l'intenzione di consegnare merce conforme.\n"
            "- **Fornitore**: i contratti con il fornitore sono la prova chiave.\n"
            "- **Pattern**: se altri clienti hanno ricevuto merce regolare, si esclude la sistematicità.\n\n"
            "### Linea difensiva\n"
            "Dimostrare che al momento della vendita l'intenzione era legittima. "
            "I problemi di conformità sono emersi dopo, per causa del fornitore. "
            "Valutare seriamente il risarcimento volontario.\n\n"
            "### Rischio\n"
            "Alto. La differenza di valore (€890 vs. €120) è molto significativa. "
            "Agire rapidamente sulla documentazione del fornitore."
        ),
        usage_estimate=UsageEstimate(
            pages=4, audio_minutes=0,
            flash_input_tokens=2800, flash_output_tokens=1200,
            pro_used=False, model_route="claude-haiku-4-5",
        ),
        legal_analysis=legal_analysis_2,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Registry of all demo cases
# ─────────────────────────────────────────────────────────────────────────────

ALL_DEMO_CASES: dict[str, CaseAnalysis] = {}


def _build_all() -> dict[str, CaseAnalysis]:
    cases = [build_demo_case(), build_demo_case_2()]
    return {c.case_id: c for c in cases}


def get_all_cases() -> dict[str, CaseAnalysis]:
    global ALL_DEMO_CASES
    if not ALL_DEMO_CASES:
        ALL_DEMO_CASES = _build_all()
    return ALL_DEMO_CASES


def get_case_summaries() -> list[CaseSummary]:
    cases = get_all_cases()
    summaries = []
    for case in cases.values():
        next_dl = sorted(case.procedural_deadlines, key=lambda d: d.due_date)[0] if case.procedural_deadlines else None
        summaries.append(CaseSummary(
            case_id=case.case_id,
            case_title=case.case_title,
            client_name=case.case_title.split("—")[0].replace("Caso", "").strip(),
            case_summary=case.case_summary,
            charge_summary=", ".join(c.charge_code for c in (case.legal_analysis.charges if case.legal_analysis else [])) or "Vedere fascicolo",
            next_deadline_date=next_dl.due_date if next_dl else None,
            next_deadline_title=next_dl.title if next_dl else None,
            contradiction_count=len(case.contradictions),
            material_count=len(case.materials),
            risk_level=case.legal_analysis.risk_level if case.legal_analysis else None,
            status="active",
            created_at="2026-04-18",
        ))
    return summaries
