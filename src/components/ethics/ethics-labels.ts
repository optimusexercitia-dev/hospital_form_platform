import type {
  AdmissibilityStatus,
  AllegationSeverity,
  AllegationStatus,
  AppealStatus,
  ComplaintChannel,
  DecisionStatus,
  ExternalReportingTarget,
  FindingValue,
  HearingType,
  NotificationDeliveryMethod,
  NotificationStatus,
  NotificationType,
  VoteValue,
} from "@/lib/queries/ethics";
import type {
  CaseConfidentialityLevel,
  ConflictType,
  VisibilityPolicy,
} from "@/lib/queries/cases";

/**
 * pt-BR label vocabulary for the ETH·E2 procedure surface (ADR 0073). The DB
 * stores ASCII enum keys; the UI resolves them to pt-BR here (Rule 10). This is a
 * PURE module (no `"use client"`, no server-only imports — only type-only imports
 * that erase at build) so both the server tab page and the client panels can share
 * it without dragging a query module into the client bundle.
 *
 * Each map is `Record<Union, string>`, so adding a value to the frozen union is a
 * compile error here until a label is supplied — the maps can never silently drift
 * behind the contract.
 */

export const ADMISSIBILITY_STATUS_LABELS: Record<AdmissibilityStatus, string> = {
  pending: "Pendente",
  admissible: "Admitida",
  inadmissible: "Inadmitida",
};

export const COMPLAINT_CHANNEL_LABELS: Record<ComplaintChannel, string> = {
  internal: "Interno",
  patient: "Paciente",
  external_body: "Órgão externo",
  anonymous: "Anônimo",
  other: "Outro",
};

export const ALLEGATION_STATUS_LABELS: Record<AllegationStatus, string> = {
  under_review: "Em análise",
  substantiated: "Comprovada",
  not_substantiated: "Não comprovada",
  partially_substantiated: "Parcialmente comprovada",
  dismissed: "Arquivada",
  referred_elsewhere: "Encaminhada",
};

export const ALLEGATION_SEVERITY_LABELS: Record<AllegationSeverity, string> = {
  low: "Baixa",
  moderate: "Moderada",
  high: "Alta",
  critical: "Crítica",
};

export const FINDING_LABELS: Record<FindingValue, string> = {
  substantiated: "Comprovada",
  not_substantiated: "Não comprovada",
  partially_substantiated: "Parcialmente comprovada",
  inconclusive: "Inconclusiva",
  dismissed: "Arquivada",
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  draft: "Rascunho",
  proposed: "Proposta",
  voted: "Votada",
  issued: "Emitida",
  appealed: "Em recurso",
  voided: "Anulada",
};

export const VOTE_LABELS: Record<VoteValue, string> = {
  approve: "A favor",
  reject: "Contra",
  abstain: "Abstenção",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  complaint_acknowledgement: "Acusação de recebimento",
  respondent_notification: "Notificação ao denunciado",
  request_for_response: "Pedido de manifestação",
  hearing_notice: "Notificação de audiência",
  decision_notice: "Notificação de decisão",
  appeal_notice: "Notificação de recurso",
  external_reporting_notice: "Comunicação a órgão externo",
  other: "Outra",
};

export const NOTIFICATION_METHOD_LABELS: Record<
  NotificationDeliveryMethod,
  string
> = {
  email: "E-mail",
  letter: "Ofício / carta",
  in_person: "Presencial",
  system: "Sistema",
  phone: "Telefone",
  other: "Outro",
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  pending: "Pendente",
  sent: "Enviada",
  acknowledged: "Confirmada",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export const HEARING_TYPE_LABELS: Record<HearingType, string> = {
  initial_hearing: "Audiência inicial",
  evidence_hearing: "Audiência de instrução",
  deliberation_hearing: "Audiência de deliberação",
  appeal_hearing: "Audiência de recurso",
  other: "Outra",
};

export const APPEAL_STATUS_LABELS: Record<AppealStatus, string> = {
  submitted: "Interposto",
  under_review: "Em análise",
  accepted: "Provido",
  rejected: "Não provido",
  withdrawn: "Retirado",
  closed: "Encerrado",
};

export const EXTERNAL_REPORTING_TARGET_LABELS: Record<
  ExternalReportingTarget,
  string
> = {
  crm: "CRM",
  cfm: "CFM",
  legal_department: "Departamento jurídico",
  police: "Autoridade policial",
  other: "Outro",
};

export const CONFIDENTIALITY_LEVEL_LABELS: Record<
  CaseConfidentialityLevel,
  string
> = {
  non_phi_internal: "Interno (sem dados de paciente)",
  phi_standard: "Dados de paciente — padrão",
  phi_restricted: "Dados de paciente — restrito",
  peer_review_confidential: "Sigilo de revisão por pares",
  legal_privileged: "Sigilo jurídico",
  ethics_investigation: "Investigação ética",
  credentialing_sensitive: "Credenciamento sensível",
};

export const VISIBILITY_POLICY_LABELS: Record<VisibilityPolicy, string> = {
  commission_default: "Padrão da comissão (todos os membros)",
  explicit_grants_only: "Somente por concessão explícita",
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  professional_relationship: "Relação profissional",
  personal_relationship: "Relação pessoal",
  financial_interest: "Interesse financeiro",
  prior_involvement: "Envolvimento anterior",
  other: "Outro",
};

// --- Ordered option lists for the pickers (stable presentation order) ---

export const ADMISSIBILITY_DECISION_OPTIONS: {
  value: Exclude<AdmissibilityStatus, "pending">;
  label: string;
}[] = [
  { value: "admissible", label: ADMISSIBILITY_STATUS_LABELS.admissible },
  { value: "inadmissible", label: ADMISSIBILITY_STATUS_LABELS.inadmissible },
];

export const ALLEGATION_STATUS_OPTIONS: {
  value: AllegationStatus;
  label: string;
}[] = (
  [
    "under_review",
    "substantiated",
    "partially_substantiated",
    "not_substantiated",
    "dismissed",
    "referred_elsewhere",
  ] as AllegationStatus[]
).map((value) => ({ value, label: ALLEGATION_STATUS_LABELS[value] }));

export const ALLEGATION_SEVERITY_OPTIONS: {
  value: AllegationSeverity;
  label: string;
}[] = (["low", "moderate", "high", "critical"] as AllegationSeverity[]).map(
  (value) => ({ value, label: ALLEGATION_SEVERITY_LABELS[value] }),
);

export const FINDING_OPTIONS: { value: FindingValue; label: string }[] = (
  [
    "substantiated",
    "partially_substantiated",
    "not_substantiated",
    "inconclusive",
    "dismissed",
  ] as FindingValue[]
).map((value) => ({ value, label: FINDING_LABELS[value] }));

export const VOTE_OPTIONS: { value: VoteValue; label: string }[] = (
  ["approve", "reject", "abstain"] as VoteValue[]
).map((value) => ({ value, label: VOTE_LABELS[value] }));

export const NOTIFICATION_TYPE_OPTIONS: {
  value: NotificationType;
  label: string;
}[] = (
  [
    "respondent_notification",
    "request_for_response",
    "complaint_acknowledgement",
    "hearing_notice",
    "decision_notice",
    "appeal_notice",
    "external_reporting_notice",
    "other",
  ] as NotificationType[]
).map((value) => ({ value, label: NOTIFICATION_TYPE_LABELS[value] }));

export const NOTIFICATION_METHOD_OPTIONS: {
  value: NotificationDeliveryMethod;
  label: string;
}[] = (
  ["letter", "email", "in_person", "system", "phone", "other"] as NotificationDeliveryMethod[]
).map((value) => ({ value, label: NOTIFICATION_METHOD_LABELS[value] }));

export const HEARING_TYPE_OPTIONS: { value: HearingType; label: string }[] = (
  [
    "initial_hearing",
    "evidence_hearing",
    "deliberation_hearing",
    "appeal_hearing",
    "other",
  ] as HearingType[]
).map((value) => ({ value, label: HEARING_TYPE_LABELS[value] }));

export const APPEAL_REVIEW_OPTIONS: {
  value: Exclude<AppealStatus, "submitted">;
  label: string;
}[] = (
  ["under_review", "accepted", "rejected", "withdrawn", "closed"] as Exclude<
    AppealStatus,
    "submitted"
  >[]
).map((value) => ({ value, label: APPEAL_STATUS_LABELS[value] }));

export const EXTERNAL_REPORTING_TARGET_OPTIONS: {
  value: ExternalReportingTarget;
  label: string;
}[] = (
  ["crm", "cfm", "legal_department", "police", "other"] as ExternalReportingTarget[]
).map((value) => ({ value, label: EXTERNAL_REPORTING_TARGET_LABELS[value] }));

export const CONFIDENTIALITY_LEVEL_OPTIONS: {
  value: CaseConfidentialityLevel;
  label: string;
}[] = (
  [
    "non_phi_internal",
    "phi_standard",
    "phi_restricted",
    "peer_review_confidential",
    "ethics_investigation",
    "legal_privileged",
    "credentialing_sensitive",
  ] as CaseConfidentialityLevel[]
).map((value) => ({ value, label: CONFIDENTIALITY_LEVEL_LABELS[value] }));

export const VISIBILITY_POLICY_OPTIONS: {
  value: VisibilityPolicy;
  label: string;
}[] = (
  ["commission_default", "explicit_grants_only"] as VisibilityPolicy[]
).map((value) => ({ value, label: VISIBILITY_POLICY_LABELS[value] }));

export const CONFLICT_TYPE_OPTIONS: { value: ConflictType; label: string }[] = (
  [
    "professional_relationship",
    "personal_relationship",
    "financial_interest",
    "prior_involvement",
    "other",
  ] as ConflictType[]
).map((value) => ({ value, label: CONFLICT_TYPE_LABELS[value] }));

// --- Status → palette token (reuses the shared CaseStatusBadge vocabulary) ---

import type { CaseStatusColorToken } from "@/lib/cases/case-status";

export const ADMISSIBILITY_STATUS_TOKENS: Record<
  AdmissibilityStatus,
  CaseStatusColorToken
> = {
  pending: "amber",
  admissible: "green",
  inadmissible: "red",
};

export const ALLEGATION_STATUS_TOKENS: Record<
  AllegationStatus,
  CaseStatusColorToken
> = {
  under_review: "amber",
  substantiated: "red",
  not_substantiated: "green",
  partially_substantiated: "amber",
  dismissed: "muted",
  referred_elsewhere: "blue",
};

export const FINDING_TOKENS: Record<FindingValue, CaseStatusColorToken> = {
  substantiated: "red",
  not_substantiated: "green",
  partially_substantiated: "amber",
  inconclusive: "slate",
  dismissed: "muted",
};

export const DECISION_STATUS_TOKENS: Record<
  DecisionStatus,
  CaseStatusColorToken
> = {
  draft: "muted",
  proposed: "slate",
  voted: "blue",
  issued: "green",
  appealed: "amber",
  voided: "red",
};

export const NOTIFICATION_STATUS_TOKENS: Record<
  NotificationStatus,
  CaseStatusColorToken
> = {
  pending: "amber",
  sent: "blue",
  acknowledged: "green",
  failed: "red",
  cancelled: "muted",
};

export const APPEAL_STATUS_TOKENS: Record<AppealStatus, CaseStatusColorToken> = {
  submitted: "blue",
  under_review: "amber",
  accepted: "green",
  rejected: "red",
  withdrawn: "muted",
  closed: "slate",
};

export const VOTE_TOKENS: Record<VoteValue, CaseStatusColorToken> = {
  approve: "green",
  reject: "red",
  abstain: "slate",
};

/** pt-BR date-time formatter shared across the ethics panels. */
export function formatEthicsDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** pt-BR date-only formatter (for deadlines rendered without a time). */
export function formatEthicsDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d);
}
