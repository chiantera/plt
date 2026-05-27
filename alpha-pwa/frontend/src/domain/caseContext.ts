import type { CaseAnalysis, CaseSummary } from './types';

export function buildCaseContext(c: CaseAnalysis): string {
  const la = c.legal_analysis;
  let ctx = `FASCICOLO: ${c.case_title}\n\nSINTESI: ${c.case_summary}\n\n`;

  const giurisprudenza = (c.raw_documents ?? []).filter(d => d.category === 'giurisprudenza');
  if (giurisprudenza.length) {
    ctx += `PRECEDENTI CARICATI DALL'AVVOCATO (citabili con source_ref):\n`;
    ctx += giurisprudenza.map(d => `• [${d.name}]: ${d.text.slice(0, 400).replace(/\n+/g, ' ')}…`).join('\n');
    ctx += '\n\n';
  }

  if (c.people.length) {
    ctx += `PARTI:\n${c.people.map(p => `• ${p.name} (${p.role})${p.notes ? ': ' + p.notes : ''}`).join('\n')}\n\n`;
  }

  if (c.timeline.length) {
    ctx += `CRONOLOGIA:\n${c.timeline.map(e => `• [${e.date ?? '?'}${e.time ? ' ' + e.time : ''}] ${e.title}: ${e.description}`).join('\n')}\n\n`;
  }

  if (la) {
    ctx += `ACCUSE:\n${la.charges.map(ch => `• ${ch.charge_code} — ${ch.charge_name} (max: ${ch.max_sentence})`).join('\n')}\n\n`;
    ctx += `RISCHIO: ${la.risk_level.toUpperCase()} — ${la.risk_summary}\n\n`;
    if (la.strategies.length) {
      ctx += `STRATEGIE DIFENSIVE:\n${la.strategies.map(s => `• [${s.priority}] ${s.title}: ${s.description}`).join('\n')}\n\n`;
    }
    if (la.constitutional_issues.length > 0) {
      ctx += `QUESTIONI PROCEDURALI:\n${la.constitutional_issues.map(i => `• ${i.title} (${i.severity})\n  Base legale: ${i.legal_basis}\n  Rimedio: ${i.remedy}`).join('\n')}\n\n`;
    }
    if (la.witness_assessments.length) {
      ctx += `TESTIMONI:\n${la.witness_assessments.map(w => `• ${w.witness_name} (${w.role}, credibilità ${Math.round(w.credibility_score * 100)}%): ${w.key_testimony}`).join('\n')}\n\n`;
    }
    if (la.evidence_balance) {
      ctx += `BILANCIAMENTO PROVE:\n  Accusa: ${Math.round(la.evidence_balance.prosecution_strength * 100)}% — ${la.evidence_balance.key_prosecution_evidence.join('; ')}\n  Difesa: ${Math.round(la.evidence_balance.defense_strength * 100)}% — ${la.evidence_balance.key_defense_evidence.join('; ')}\n  Lacune critiche: ${la.evidence_balance.critical_gaps.join('; ')}\n\n`;
    }
  }

  if (c.contradictions.length) {
    ctx += `CONTRADDIZIONI:\n${c.contradictions.map(ct => `• ${ct.title}: ${ct.description}`).join('\n')}\n\n`;
  }

  if (c.open_questions.length) {
    ctx += `DOMANDE APERTE:\n${c.open_questions.map(q => `• ${q.question} — perché conta: ${q.why_it_matters}`).join('\n')}\n\n`;
  }

  const urgentDeadlines = c.procedural_deadlines.filter(d => d.urgency === 'alta');
  if (urgentDeadlines.length) {
    ctx += `SCADENZE URGENTI:\n${urgentDeadlines.map(d => `• ${d.due_date}${d.due_time ? ' ' + d.due_time : ''} — ${d.title} (${d.deadline_type}): ${d.description}`).join('\n')}\n\n`;
  }

  if (c.brief_markdown?.trim()) {
    ctx += `PROMEMORIA DIFENSIVO CORRENTE:\n${c.brief_markdown.trim()}\n\n`;
  }

  return ctx.trim();
}

export function caseAnalysisToSummary(c: CaseAnalysis): CaseSummary {
  if (c.is_pending) {
    const n = c.raw_documents?.length ?? 0;
    return {
      case_id: c.case_id, case_title: c.case_title, client_name: '—',
      case_summary: n === 0 ? 'Fascicolo vuoto — aggiungi documenti' : `${n} documento${n !== 1 ? 'i' : ''} caricato${n !== 1 ? 'i' : ''}, analisi non avviata`,
      charge_summary: '— da analizzare —', next_deadline_date: null, next_deadline_title: null,
      contradiction_count: 0, material_count: n, risk_level: null, status: 'pending',
      created_at: new Date().toISOString(), is_pending: true,
    };
  }
  const la = c.legal_analysis;
  const nextDeadline = [...c.procedural_deadlines].sort((a, b) =>
    `${a.due_date}T${a.due_time ?? '23:59'}`.localeCompare(`${b.due_date}T${b.due_time ?? '23:59'}`)
  )[0];
  const client = c.people.find(p => /imputat|accusat|defendant|client/i.test(p.role));
  return {
    case_id: c.case_id, case_title: c.case_title, client_name: client?.name ?? '—',
    case_summary: c.case_summary,
    charge_summary: la?.charges.map(ch => ch.charge_name).join(', ') || 'Accuse da determinare',
    next_deadline_date: nextDeadline?.due_date ?? null, next_deadline_title: nextDeadline?.title ?? null,
    contradiction_count: c.contradictions.length, material_count: c.materials.length,
    risk_level: la?.risk_level ?? null, status: 'active', created_at: new Date().toISOString(),
  };
}
