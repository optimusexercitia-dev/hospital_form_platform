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
// Confidentiality (IV2 — NON-ENFORCING tag; the UI must say it does not gate access)
// ---------------------------------------------------------------------------

export const CONFIDENTIALITY_LABEL: Record<InterviewConfidentiality, string> = {
  standard: "Padrão",
  restricted: "Restrita",
  highly_restricted: "Altamente restrita",
};

/** Muted (NOT alarming) badge styling — the tag is informational, not a control. */
export const CONFIDENTIALITY_STYLE: Record<InterviewConfidentiality, string> = {
  standard: "bg-muted text-muted-foreground",
  restricted: "bg-secondary text-secondary-foreground",
  highly_restricted: "bg-accent text-accent-foreground",
};

export const CONFIDENTIALITY_ORDER: InterviewConfidentiality[] = [
  "standard",
  "restricted",
  "highly_restricted",
];

/**
 * MANDATORY helper copy for the confidentiality picker/badge. The tag is a
 * classification only — it does NOT restrict access yet (enforcement lands with
 * E1). This text must accompany the control so it never reads as access control.
 */
export const CONFIDENTIALITY_HELPER_TEXT =
  "Classificação informativa. Ainda não restringe o acesso — serve apenas para sinalizar a sensibilidade.";

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
