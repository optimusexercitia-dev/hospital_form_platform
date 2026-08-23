// Casos board — sample data + derivations mirroring src/lib/cases/case-status.ts and case-derive.ts
window.TODAY = new Date(2026, 7, 23);

window.CASE_STATUSES = ["not_started", "in_review", "pending", "completed", "cancelled"];
window.STATUS_META = {
  not_started: { label: "Não iniciado", tk: "slate", color: "var(--st-todo)" },
  in_review: { label: "Em revisão", tk: "blue", color: "var(--primary)" },
  pending: { label: "Pendente", tk: "amber", color: "var(--warning)" },
  completed: { label: "Concluído", tk: "green", color: "var(--success)" },
  cancelled: { label: "Cancelado", tk: "red", color: "var(--destructive)" },
};
window.isTerminal = (s) => s === "completed" || s === "cancelled";

window.OUTCOMES = [
  { id: "o1", label: "Evento adverso evitável", tk: "red", isAdverse: true },
  { id: "o2", label: "Evento adverso inevitável", tk: "amber", isAdverse: true },
  { id: "o3", label: "Sem evento adverso", tk: "green", isAdverse: false },
  { id: "o4", label: "Óbito esperado", tk: "slate", isAdverse: false },
  { id: "o5", label: "Inconclusivo", tk: "muted", isAdverse: false },
];
window.MEMBERS = ["Dra. Ana Beltrão", "Dr. Carlos Nunes", "Enf. Márcia Duarte", "Dr. Paulo Sérgio", "Farm. Rita Lopes"];
window.TAGS = ["Sentinela", "Óbito", "Medicação", "Queda", "Cirúrgico", "Lesão por pressão"];
window.CASE_TYPES = ["Óbito", "Evento adverso", "Denúncia", "Revisão de prontuário"];
window.DEPTS = ["UTI Adulto", "Centro Cirúrgico", "Pronto-Socorro", "Clínica Médica", "Maternidade", "Pediatria"];

// phases: [position, status, title, assignee|null, dueDate|null]
const P = (pos, st, title, who, due) => ({ position: pos, status: st, title, assigneeName: who || null, dueDate: due || null });
window.CASES = [
  { id: "c31", n: 31, label: "Óbito em pós-operatório de colectomia eletiva", status: "in_review", createdAt: "2026-08-18", closedAt: null, outcome: null, type: "Óbito", dept: "Centro Cirúrgico", tags: ["Sentinela", "Óbito", "Cirúrgico"], openNarrativeCount: 1,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "active", "Análise do prontuário", "Dr. Carlos Nunes", "2026-08-28"), P(3, "pending", "Parecer do relator", null, null)] },
  { id: "c30", n: 30, label: "Erro de dose de insulina — hipoglicemia transitória", status: "in_review", createdAt: "2026-08-14", closedAt: null, outcome: null, type: "Evento adverso", dept: "Clínica Médica", tags: ["Medicação"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "active", "Análise farmacêutica", "Farm. Rita Lopes", "2026-08-20"), P(3, "pending", "Plano de ação", null)] },
  { id: "c29", n: 29, label: "Queda com fratura de fêmur em enfermaria", status: "pending", createdAt: "2026-08-11", closedAt: null, outcome: "o1", type: "Evento adverso", dept: "Clínica Médica", tags: ["Queda"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Enf. Márcia Duarte"), P(2, "completed", "Análise do prontuário", "Dr. Paulo Sérgio"), P(3, "pending", "Deliberação em reunião", null)] },
  { id: "c28", n: 28, label: "TEP não reconhecida na admissão do PS", status: "in_review", createdAt: "2026-08-06", closedAt: null, outcome: null, type: "Óbito", dept: "Pronto-Socorro", tags: ["Óbito"], openNarrativeCount: 2,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "active", "Entrevistas com a equipe", "Dr. Carlos Nunes", "2026-08-15"), P(3, "active", "Análise de causa raiz", "Dr. Paulo Sérgio", "2026-09-04"), P(4, "pending", "Parecer final", null)] },
  { id: "c27", n: 27, label: null, status: "not_started", createdAt: "2026-08-21", closedAt: null, outcome: null, type: "Revisão de prontuário", dept: "Pediatria", tags: [], openNarrativeCount: 0,
    phases: [P(1, "pending", "Triagem inicial", null, "2026-08-26"), P(2, "pending", "Análise do prontuário", null)] },
  { id: "c26", n: 26, label: "Lesão por pressão estágio 3 adquirida na UTI", status: "in_review", createdAt: "2026-07-30", closedAt: null, outcome: null, type: "Evento adverso", dept: "UTI Adulto", tags: ["Lesão por pressão"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Enf. Márcia Duarte"), P(2, "active", "Avaliação de enfermagem", "Enf. Márcia Duarte", "2026-08-30"), P(3, "not_required", "Parecer externo", null), P(4, "pending", "Plano de ação", null)] },
  { id: "c25", n: 25, label: "Bloqueio regional em sítio errado — interceptado", status: "pending", createdAt: "2026-07-24", closedAt: null, outcome: "o3", type: "Evento adverso", dept: "Centro Cirúrgico", tags: ["Sentinela", "Cirúrgico"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "completed", "Análise de barreira", "Dr. Carlos Nunes"), P(3, "pending", "Deliberação em reunião", null, "2026-08-19")] },
  { id: "c24", n: 24, label: "Óbito materno — hemorragia pós-parto", status: "in_review", createdAt: "2026-07-18", closedAt: null, outcome: null, type: "Óbito", dept: "Maternidade", tags: ["Sentinela", "Óbito"], openNarrativeCount: 1,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "completed", "Análise do prontuário", "Dr. Paulo Sérgio"), P(3, "active", "Análise de causa raiz", "Dra. Ana Beltrão", "2026-08-21"), P(4, "pending", "Parecer final", null)] },
  { id: "c23", n: 23, label: "Denúncia de conduta em plantão noturno", status: "not_started", createdAt: "2026-07-15", closedAt: null, outcome: null, type: "Denúncia", dept: "Pronto-Socorro", tags: [], openNarrativeCount: 0,
    phases: [P(1, "pending", "Admissibilidade", null, "2026-08-10"), P(2, "pending", "Instrução", null), P(3, "pending", "Parecer", null)] },
  { id: "c22", n: 22, label: "Reinternação em 30 dias por IC descompensada", status: "pending", createdAt: "2026-07-08", closedAt: null, outcome: "o5", type: "Revisão de prontuário", dept: "Clínica Médica", tags: [], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dr. Carlos Nunes"), P(2, "completed", "Análise do prontuário", "Dr. Carlos Nunes"), P(3, "pending", "Deliberação em reunião", null)] },
  { id: "c21", n: 21, label: "Pneumonia associada à ventilação mecânica", status: "completed", createdAt: "2026-06-30", closedAt: "2026-08-12", outcome: "o2", type: "Evento adverso", dept: "UTI Adulto", tags: [], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Enf. Márcia Duarte"), P(2, "completed", "Análise do prontuário", "Dr. Paulo Sérgio"), P(3, "completed", "Plano de ação", "Enf. Márcia Duarte")] },
  { id: "c20", n: 20, label: "Compressa retida identificada no pós-parto", status: "completed", createdAt: "2026-06-22", closedAt: "2026-08-05", outcome: "o1", type: "Evento adverso", dept: "Maternidade", tags: ["Sentinela", "Cirúrgico"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "completed", "Análise de causa raiz", "Dr. Paulo Sérgio"), P(3, "completed", "Plano de ação", "Dra. Ana Beltrão")] },
  { id: "c19", n: 19, label: "Extravasamento de quimioterápico em acesso periférico", status: "completed", createdAt: "2026-06-15", closedAt: "2026-07-28", outcome: "o2", type: "Evento adverso", dept: "Clínica Médica", tags: ["Medicação"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Farm. Rita Lopes"), P(2, "completed", "Análise farmacêutica", "Farm. Rita Lopes"), P(3, "completed", "Plano de ação", "Enf. Márcia Duarte")] },
  { id: "c18", n: 18, label: "Sepse com reconhecimento tardio na triagem", status: "completed", createdAt: "2026-06-08", closedAt: "2026-07-14", outcome: "o1", type: "Óbito", dept: "Pronto-Socorro", tags: ["Óbito"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dra. Ana Beltrão"), P(2, "completed", "Análise de causa raiz", "Dr. Carlos Nunes"), P(3, "completed", "Plano de ação", "Dr. Carlos Nunes")] },
  { id: "c17", n: 17, label: "Notificação duplicada — evento já em análise", status: "cancelled", createdAt: "2026-06-04", closedAt: "2026-06-10", outcome: null, type: "Evento adverso", dept: "UTI Adulto", tags: [], openNarrativeCount: 0,
    phases: [P(1, "voided", "Triagem inicial", null), P(2, "not_required", "Análise do prontuário", null)] },
  { id: "c16", n: 16, label: "Óbito esperado em cuidados paliativos — revisão de rotina", status: "completed", createdAt: "2026-05-27", closedAt: "2026-06-25", outcome: "o4", type: "Óbito", dept: "Clínica Médica", tags: ["Óbito"], openNarrativeCount: 0,
    phases: [P(1, "completed", "Triagem inicial", "Dr. Paulo Sérgio"), P(2, "completed", "Revisão de prontuário", "Dr. Paulo Sérgio")] },
];

// ---- derivations (twins of case-derive.ts) ----
window.fmtCaseNumber = (n) => "Caso " + String(n).padStart(4, "0");
window.outcomeOf = (row) => row.outcome ? OUTCOMES.find((o) => o.id === row.outcome) : null;
window.phaseProgress = (row) => {
  const c = row.phases.filter((p) => p.status !== "not_required" && p.status !== "voided");
  return { done: c.filter((p) => p.status === "completed").length, total: c.length };
};
window.activePhases = (row) => row.phases.filter((p) => p.status === "active").sort((a, b) => a.position - b.position);
window.currentPhase = (row) => {
  const o = [...row.phases].sort((a, b) => a.position - b.position);
  return o.find((p) => p.status === "active") || o.find((p) => p.status === "pending") || null;
};
window.hasUnassignedWork = (row) => !isTerminal(row.status) && row.phases.some((p) => (p.status === "active" || p.status === "pending") && !p.assigneeName);
window.isOverduePhase = (p) => p.dueDate && (p.status === "active" || p.status === "pending") && new Date(p.dueDate + "T23:59") < TODAY;
window.hasOverdueWork = (row) => !isTerminal(row.status) && row.phases.some(isOverduePhase);
window.overduePhaseCount = (rows) => rows.reduce((s, r) => s + (isTerminal(r.status) ? 0 : r.phases.filter(isOverduePhase).length), 0);
window.ACTION_ITEMS = { open: 9, overdue: 3 };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
window.fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T12:00"); return String(d.getDate()).padStart(2, "0") + " " + MESES[d.getMonth()] + (d.getFullYear() !== TODAY.getFullYear() ? " " + d.getFullYear() : ""); };
window.ageLabel = (iso) => { const days = Math.max(0, Math.round((TODAY - new Date(iso + "T12:00")) / 864e5)); return days === 0 ? "hoje" : days + "d"; };
window.initials = (name) => name ? name.replace(/^(Dra?\.|Enf\.|Farm\.)\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : null;

window.computeKpis = (rows) => {
  const now = TODAY, sameMonth = (iso) => iso && new Date(iso).getFullYear() === now.getFullYear() && new Date(iso).getMonth() === now.getMonth();
  let fasesAtivas = 0, fasesPendentes = 0, casosComFaseAtiva = 0;
  for (const r of rows) {
    let has = false;
    for (const p of r.phases) { if (p.status === "active") { fasesAtivas++; has = true; } if (p.status === "pending") fasesPendentes++; }
    fasesPendentes += r.openNarrativeCount;
    if (has) casosComFaseAtiva++;
  }
  const abertos = rows.filter((r) => !isTerminal(r.status)), concl = rows.filter((r) => isTerminal(r.status));
  return {
    abertos: abertos.length, abertosMes: abertos.filter((r) => sameMonth(r.createdAt)).length,
    fasesAtivas, casosComFaseAtiva, fasesPendentes,
    atrasadas: overduePhaseCount(rows), casosAtrasados: rows.filter(hasOverdueWork).length,
    concluidos: concl.length, concluidosMes: concl.filter((r) => sameMonth(r.closedAt)).length,
  };
};
window.computeBreakdown = (rows) => {
  const by = new Map(); let total = 0, adverse = 0;
  for (const r of rows) { const o = outcomeOf(r); if (!o) continue; total++; if (o.isAdverse) adverse++; by.set(o.id, (by.get(o.id) || 0) + 1); }
  const list = [...by.entries()].map(([id, count]) => ({ ...OUTCOMES.find((o) => o.id === id), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  return { list, total, adverse, pct: total ? Math.round((adverse / total) * 100) : null };
};
