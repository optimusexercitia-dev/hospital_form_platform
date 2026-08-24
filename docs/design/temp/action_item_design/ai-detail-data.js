// Seed data — Action Item detail prototype (pt-BR). Mirrors ActionItemDetail +
// satellites from src/lib/queries/action-items.ts, plus prototype extensions
// (code, priority, watchers, linked items, unified activity).
window.AID = {
  today: "2026-08-23",
  members: ["Enf. Beatriz Santoro", "Enf. Carlos Nishimura", "Dra. Paula Freire", "Farm. Diego Antunes"],
  users: { member: { name: "Enf. Beatriz Santoro", role: "Membro" }, coord: { name: "Dr. Ricardo Meireles", role: "Coordenador" } },
  item: {
    code: "AI-2026-0114",
    title: "Revisar protocolo de higienização das mãos na UTI Adulto",
    description: "Atualizar o POP-CCIH-014 conforme os achados da auditoria de adesão de junho (62% de adesão média; 48% no turno noturno) e reapresentar a versão 4 para aprovação da comissão.",
    status: "in_progress",
    priority: "alta",
    visibility: "case_restricted",
    assignee: "Enf. Beatriz Santoro",
    dueDate: "2026-08-19",
    createdAt: "28/07/2026, 10:02",
    createdBy: "Dr. Ricardo Meireles",
    openedAt: "28/07/2026",
    startedAt: "30/07/2026",
    completedAt: null,
    source: { kind: "case", label: "Caso 0008 — Surto de Klebsiella pneumoniae na UTI Adulto" },
  },
  checklist: [
    { id: "c1", title: "Levantar dados de adesão por turno", done: true, by: "Beatriz", at: "01/08" },
    { id: "c2", title: "Revisar POP-CCIH-014 (versão 3) e literatura de referência", done: true, by: "Beatriz", at: "06/08" },
    { id: "c3", title: "Alinhar mudanças com a chefia de enfermagem da UTI", done: true, by: "Beatriz", at: "14/08" },
    { id: "c4", title: "Redigir a versão 4 do protocolo", done: false },
    { id: "c5", title: "Agendar apresentação na próxima reunião da comissão", done: false },
  ],
  reminders: [
    { id: "r1", text: "7 dias antes do prazo" },
    { id: "r2", text: "No dia do prazo" },
    { id: "r3", text: "2 dias após o prazo" },
  ],
  watchers: ["Dr. Ricardo Meireles", "Dra. Paula Freire", "Enf. Carlos Nishimura"],
  linked: [
    { id: "l1", title: "Treinamento de higienização — equipe noturna", status: "open", meta: "Prazo 04/09/2026" },
    { id: "l2", title: "Atualizar cartazes de técnica de fricção alcoólica", status: "done", meta: "Concluído em 11/08" },
  ],
  activity: [
    { id: "a9", kind: "system", icon: "bell", at: "19/08/2026, 08:00", html: ["Lembrete enviado ", { b: "no dia do prazo" }, " ao responsável"] },
    { id: "a8", kind: "update", type: "progress", author: "Enf. Beatriz Santoro", at: "18/08/2026, 16:41", text: "Versão 4 em rascunho — cerca de 60% concluída. Faltam as seções de insumos e monitoramento de adesão." },
    { id: "a7", kind: "system", icon: "check", at: "14/08/2026, 11:20", html: ["Subtarefa concluída: ", { b: "Alinhar mudanças com a chefia de enfermagem da UTI" }] },
    { id: "a6", kind: "update", type: "blocker", author: "Enf. Beatriz Santoro", at: "12/08/2026, 09:15", text: "Aguardando parecer da farmácia sobre a troca do insumo de solução alcoólica — impacta a seção 5 do protocolo." },
    { id: "a5", kind: "update", type: "progress", author: "Enf. Beatriz Santoro", at: "05/08/2026, 09:14", text: "Dados de adesão consolidados por turno: 62% média geral, 48% no noturno. Planilha anexada ao caso." },
    { id: "a4", kind: "system", icon: "play", at: "30/07/2026, 08:47", html: [{ b: "Enf. Beatriz Santoro" }, " iniciou o item — status alterado para ", { b: "Em andamento" }] },
    { id: "a3", kind: "system", icon: "user", at: "28/07/2026, 10:04", html: ["Atribuído a ", { b: "Enf. Beatriz Santoro" }, " por Dr. Ricardo Meireles"] },
    { id: "a2", kind: "system", icon: "flag", at: "28/07/2026, 10:03", html: ["Prioridade definida como ", { b: "Alta" }] },
    { id: "a1", kind: "system", icon: "plus", at: "28/07/2026, 10:02", html: ["Item criado por ", { b: "Dr. Ricardo Meireles" }, " a partir do Caso 0008"] },
  ],
};
