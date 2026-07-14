/**
 * pt-BR display labels + badge styling for the Interviews (Phase 11) enums.
 *
 * The DB stores stable ASCII slugs (Architecture Rule 10 — labels resolved in the
 * UI); this is the single place those slugs become human copy + concrete styling,
 * so every interviews screen agrees. Badge styles reuse the semantic colour tokens
 * already in `globals.css` (no raw CSS) and pair colour with text + shape — never
 * colour alone (design-system a11y rule). Mirrors `meeting-labels.ts`.
 */

import type {
  InterviewAttachmentKind,
  InterviewCategory,
  InterviewConfidentiality,
  InterviewModality,
  InterviewStatus,
  InterviewerRole,
  RelationshipToCase,
  SessionStatus,
  SessionType,
} from "@/lib/queries/interviews";

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  in_progress: "Em andamento",
  awaiting_follow_up: "Aguardando follow-up",
  completed: "Concluída",
  cancelled: "Cancelada",
};

/** Badge styling per lifecycle status (semantic tokens; paired with the label text). */
export const INTERVIEW_STATUS_STYLE: Record<InterviewStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning/15 text-warning",
  awaiting_follow_up: "bg-accent text-accent-foreground",
  completed: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** Lifecycle order for the status filter (plus an "all" sentinel handled by the UI). */
export const INTERVIEW_STATUS_ORDER: InterviewStatus[] = [
  "draft",
  "scheduled",
  "in_progress",
  "awaiting_follow_up",
  "completed",
  "cancelled",
];

/**
 * Whether the interview content (summary / subjects / interviewers / sessions /
 * attachments) is still editable. Locked once `completed`/`cancelled` (the server
 * also enforces the content-freeze). A reopen returns it to `in_progress`
 * (editable again).
 */
export function isEditableInterviewStatus(status: InterviewStatus): boolean {
  return (
    status === "draft" ||
    status === "scheduled" ||
    status === "in_progress" ||
    status === "awaiting_follow_up"
  );
}

/** Whether the interview is in a terminal lifecycle state. Only `cancelled` is terminal. */
export function isTerminalInterviewStatus(status: InterviewStatus): boolean {
  return status === "cancelled";
}

// ---------------------------------------------------------------------------
// Modality
// ---------------------------------------------------------------------------

export const MODALITY_LABEL: Record<InterviewModality, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

export const MODALITY_ORDER: InterviewModality[] = [
  "presencial",
  "remoto",
  "hibrido",
];

// ---------------------------------------------------------------------------
// Interviewer role (fixed enum — distinct from a SUBJECT's free-text clinical role)
// ---------------------------------------------------------------------------

export const INTERVIEWER_ROLE_LABEL: Record<InterviewerRole, string> = {
  entrevistador_principal: "Entrevistador principal",
  entrevistador: "Entrevistador",
  observador: "Observador",
  anotador: "Anotador",
};

export const INTERVIEWER_ROLE_ORDER: InterviewerRole[] = [
  "entrevistador_principal",
  "entrevistador",
  "observador",
  "anotador",
];

// ---------------------------------------------------------------------------
// Attachment kinds
// ---------------------------------------------------------------------------

export const ATTACHMENT_KIND_LABEL: Record<InterviewAttachmentKind, string> = {
  gravacao_audio: "Gravação de áudio",
  transcricao_assinada: "Transcrição assinada",
  evidencia: "Evidência",
  outro: "Outro",
};

export const ATTACHMENT_KIND_ORDER: InterviewAttachmentKind[] = [
  "gravacao_audio",
  "transcricao_assinada",
  "evidencia",
  "outro",
];

/** The kinds offered as the default when ADDING a link vs uploading a file. */
export const LINK_ATTACHMENT_DEFAULT_KIND: InterviewAttachmentKind =
  "gravacao_audio";
export const FILE_ATTACHMENT_DEFAULT_KIND: InterviewAttachmentKind =
  "transcricao_assinada";

// ---------------------------------------------------------------------------
// Interview category (IV2 — dashboard classification; required at create)
// ---------------------------------------------------------------------------

export const INTERVIEW_CATEGORY_LABEL: Record<InterviewCategory, string> = {
  witness: "Testemunha",
  subject: "Envolvido(a)",
  clinical_team: "Equipe clínica",
  expert: "Especialista",
  complainant: "Denunciante",
  respondent: "Denunciado(a)",
  administrative: "Administrativo",
  other: "Outro",
};

export const INTERVIEW_CATEGORY_ORDER: InterviewCategory[] = [
  "clinical_team",
  "witness",
  "subject",
  "expert",
  "complainant",
  "respondent",
  "administrative",
  "other",
];

// ---------------------------------------------------------------------------
// Confidentiality (E1 — access-regime taxonomy; ADR 0072). Remapped from IV2's
// inert 3-value tag to the shared 7-value `ConfidentialityLabel` set (BE-6, O3:
// standard→non_phi_internal, restricted→peer_review_confidential,
// highly_restricted→ethics_investigation). MOSTLY informational, but
// `legal_privileged` + `credentialing_sensitive` now ENFORCE (gate above ordinary
// case-read) — the styling + helper copy below reflect that.
// ---------------------------------------------------------------------------

export const CONFIDENTIALITY_LABEL: Record<InterviewConfidentiality, string> = {
  non_phi_internal: "Padrão",
  phi_standard: "Dados de paciente",
  phi_restricted: "Dados sensíveis",
  peer_review_confidential: "Revisão por pares",
  legal_privileged: "Sigilo jurídico",
  ethics_investigation: "Investigação ética",
  credentialing_sensitive: "Credenciamento",
};

/**
 * Badge styling per confidentiality level (semantic tokens; always paired with the
 * label text — never colour alone). Four visual tiers of increasing prominence:
 * neutral (`muted`) → noted (`secondary`) → elevated (`accent`) → gated
 * (`warning`, reserved for the two ENFORCING levels that require extra clearance —
 * amber signals "attention/clearance", not an error).
 */
export const CONFIDENTIALITY_STYLE: Record<InterviewConfidentiality, string> = {
  non_phi_internal: "bg-muted text-muted-foreground",
  phi_standard: "bg-secondary text-secondary-foreground",
  phi_restricted: "bg-accent text-accent-foreground",
  peer_review_confidential: "bg-secondary text-secondary-foreground",
  legal_privileged: "bg-warning/15 text-warning",
  ethics_investigation: "bg-accent text-accent-foreground",
  credentialing_sensitive: "bg-warning/15 text-warning",
};

/** Ascending-sensitivity order (mirrors the canonical `ConfidentialityLabel` union). */
export const CONFIDENTIALITY_ORDER: InterviewConfidentiality[] = [
  "non_phi_internal",
  "phi_standard",
  "phi_restricted",
  "peer_review_confidential",
  "legal_privileged",
  "ethics_investigation",
  "credentialing_sensitive",
];

/**
 * Helper copy for the confidentiality picker/badge. Most levels are informational
 * (they signal sensitivity only), but `legal_privileged` + `credentialing_sensitive`
 * became ENFORCING at E1 (ADR 0072) — opening that content needs extra clearance.
 * The copy must neither oversell (it is NOT a blanket access control) nor understate
 * (it must not claim it never restricts access). Full confidentiality-management UX
 * is deferred to E2/E3.
 */
export const CONFIDENTIALITY_HELPER_TEXT =
  "Classificação de sensibilidade. A maioria dos níveis é apenas informativa; conteúdo de sigilo jurídico ou de credenciamento exige autorização adicional para ser aberto.";

// ---------------------------------------------------------------------------
// Subject relationship to the case (IV2 — required at add; staff-only)
// ---------------------------------------------------------------------------

export const RELATIONSHIP_TO_CASE_LABEL: Record<RelationshipToCase, string> = {
  attending_physician: "Médico(a) assistente",
  consulting_physician: "Médico(a) consultor(a)",
  nurse: "Enfermeiro(a)",
  other_professional: "Outro(a) profissional",
  witness: "Testemunha",
  complainant: "Denunciante",
  respondent: "Denunciado(a)",
  subject: "Envolvido(a)",
  expert: "Especialista",
  committee_member: "Membro da comissão",
  other: "Outro",
};

export const RELATIONSHIP_TO_CASE_ORDER: RelationshipToCase[] = [
  "attending_physician",
  "consulting_physician",
  "nurse",
  "other_professional",
  "committee_member",
  "witness",
  "subject",
  "complainant",
  "respondent",
  "expert",
  "other",
];

// ---------------------------------------------------------------------------
// Session type (IV2)
// ---------------------------------------------------------------------------

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  initial: "Inicial",
  follow_up: "Follow-up",
  clarification: "Esclarecimento",
  written_response: "Resposta escrita",
  supplementary: "Complementar",
  closing: "Encerramento",
};

export const SESSION_TYPE_ORDER: SessionType[] = [
  "initial",
  "follow_up",
  "clarification",
  "written_response",
  "supplementary",
  "closing",
];

// ---------------------------------------------------------------------------
// Session status (IV2)
// ---------------------------------------------------------------------------

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};

/** Badge styling per session status (semantic tokens; paired with the label text). */
export const SESSION_STATUS_STYLE: Record<SessionStatus, string> = {
  scheduled: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
  no_show: "bg-destructive/12 text-destructive dark:bg-destructive/15",
};

export const SESSION_STATUS_ORDER: SessionStatus[] = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
];
