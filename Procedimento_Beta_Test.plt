{
  "version": "1.0",
  "case_id": "test-beta-001",
  "case_title": "Procedimento Penale N. 1234/26 RGNR - Rossi c. Bianchi",
  "created_at": "2026-05-26T10:00:00.000Z",
  "updated_at": "2026-05-26T10:05:00.000Z",
  "raw_documents": [
    {
      "doc_id": "doc-001",
      "filename": "querela_rossi.txt",
      "text": "Io sottoscritto Mario Rossi, nato a Roma il 01/01/1980, residente in Via delle Viole 10, presento formale querela contro il Sig. Luigi Bianchi. In data 15 maggio 2026, alle ore 18:30, mentre mi trovavo in Piazza Navona, il Sig. Bianchi mi ha aggredito verbalmente e fisicamente, colpendomi con un pugno al volto, procurandomi lesioni giudicate guaribili in 15 giorni come da referto medico allegato.",
      "uploaded_at": "2026-05-26T10:01:00.000Z"
    },
    {
      "doc_id": "doc-002",
      "filename": "referto_pronto_soccorso.txt",
      "text": "Ospedale Fatebenefratelli. Paziente: Mario Rossi. Diagnosi: Trauma contusivo facciale con ecchimosi zigomatica destra. Prognosi: 15 giorni s.c. Data visita: 15/05/2026 ore 19:15. Medico di turno: Dott.ssa Verdi.",
      "uploaded_at": "2026-05-26T10:02:00.000Z"
    }
  ],
  "analyzed_doc_ids": ["doc-001", "doc-002"],
  "redaction_rules": [
    {
      "id": "rule-1",
      "original": "Mario Rossi",
      "replacement": "[QUERELANTE]",
      "enabled": true
    },
    {
      "id": "rule-2",
      "original": "Luigi Bianchi",
      "replacement": "[INDAGATO]",
      "enabled": true
    }
  ],
  "materials": [
    {
      "id": "mat-1",
      "doc_id": "doc-001",
      "type": "claim",
      "content": "Il Sig. Bianchi mi ha aggredito verbalmente e fisicamente, colpendomi con un pugno al volto.",
      "source_quote": "il Sig. Bianchi mi ha aggredito verbalmente e fisicamente, colpendomi con un pugno al volto",
      "confidence": 0.95
    },
    {
      "id": "mat-2",
      "doc_id": "doc-002",
      "type": "medical",
      "content": "Referto medico attesta trauma contusivo facciale con ecchimosi zigomatica destra. Prognosi 15 giorni.",
      "source_quote": "Diagnosi: Trauma contusivo facciale con ecchimosi zigomatica destra. Prognosi: 15 giorni",
      "confidence": 0.99
    }
  ],
  "timeline": [
    {
      "date": "15 maggio 2026",
      "time": "18:30",
      "event": "Aggressione in Piazza Navona",
      "description": "Mario Rossi dichiara di essere stato colpito con un pugno al volto da Luigi Bianchi.",
      "source_ids": ["mat-1"]
    },
    {
      "date": "15 maggio 2026",
      "time": "19:15",
      "event": "Referto medico",
      "description": "Mario Rossi si reca al Pronto Soccorso. Il medico diagnostica un trauma contusivo e assegna 15 giorni di prognosi.",
      "source_ids": ["mat-2"]
    }
  ],
  "people": [
    {
      "name": "Mario Rossi",
      "role": "Persona Offesa / Querelante",
      "mentions": ["doc-001", "doc-002"]
    },
    {
      "name": "Luigi Bianchi",
      "role": "Indagato",
      "mentions": ["doc-001"]
    },
    {
      "name": "Dott.ssa Verdi",
      "role": "Medico curante",
      "mentions": ["doc-002"]
    }
  ],
  "evidence": [
    {
      "id": "ev-1",
      "title": "Referto Medico Fatebenefratelli",
      "type": "Documentale",
      "description": "Certifica lesioni guaribili in 15 giorni.",
      "strength": "strong",
      "source_ids": ["mat-2"]
    }
  ],
  "open_questions": [
    {
      "question": "Ci sono testimoni oculari dell'aggressione in Piazza Navona?",
      "why_it_matters": "L'aggressione in una piazza pubblica alle 18:30 suggerisce la probabile presenza di testimoni terzi o telecamere di videosorveglianza.",
      "status": "pending"
    }
  ],
  "missing_documents": [
    {
      "title": "Immagini videosorveglianza Piazza Navona",
      "reason": "Potrebbero aver ripreso la presunta aggressione e confermare o smentire la dinamica riferita dal querelante.",
      "priority": "high"
    }
  ],
  "contradictions": [],
  "procedural_deadlines": [
    {
      "title": "Termine indagini preliminari",
      "due_date": "2026-11-15",
      "description": "Scadenza dei sei mesi dalla presunta iscrizione nel registro degli indagati (data stimata).",
      "status": "unconfirmed"
    }
  ],
  "legal_analysis": {
    "risk_level": "medium",
    "charges": [
      {
        "title": "Lesioni personali (Art. 582 c.p.)",
        "description": "Cagionata una lesione personale da cui è derivata una malattia nel corpo guaribile in 15 giorni.",
        "statute": "Art. 582 c.p.",
        "severity": "medium",
        "elements": [
          "Condotta: percossa (pugno al volto)",
          "Evento: lesione (trauma contusivo con ecchimosi)",
          "Nesso causale: da verificare"
        ]
      }
    ],
    "defense_strategy": "La strategia si baserà sulla verifica dell'effettiva dinamica dell'evento. Essendo un luogo pubblico affollato, l'assenza di testimoni o riprese a supporto del querelante potrebbe sollevare il ragionevole dubbio. Valutare inoltre possibili cause di giustificazione (legittima difesa) o attenuanti (provocazione) in base ai pregressi rapporti tra le parti.",
    "strengths": [
      "Il referto medico è oggettivo ma prova solo il trauma, non chi l'abbia causato."
    ],
    "weaknesses": [
      "La querela fornisce una dinamica univoca dei fatti che, se non smentita, costituisce fonte di prova."
    ]
  },
  "case_summary": "Il procedimento ha ad oggetto un presunto episodio di lesioni personali ex art. 582 c.p. verificatosi in data 15/05/2026 in Roma, Piazza Navona. Mario Rossi accusa Luigi Bianchi di averlo colpito con un pugno. Agli atti risulta il referto medico del pronto soccorso con prognosi di 15 giorni.",
  "usage_estimate": {
    "pages": 2,
    "audio_minutes": 0,
    "flash_input_tokens": 1500,
    "flash_output_tokens": 800,
    "pro_used": false,
    "model_route": "flash"
  }
}
