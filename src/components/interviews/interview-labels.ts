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
  InterviewModality,
  InterviewStatus,
  InterviewerRole,
} from "@/lib/queries/interviews";

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

/** Badge styling per lifecycle status (semantic tokens; paired with the label text). */
export const INTERVIEW_STATUS_STYLE: Record<InterviewStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-secondary text-secondary-foreground",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** Lifecycle order for the status filter (plus an "all" sentinel handled by the UI). */
export const INTERVIEW_STATUS_ORDER: InterviewStatus[] = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

/**
 * Whether the interview content (summary / subjects / interviewers / attachments)
 * is still editable. Locked once `concluida`/`cancelada` (the server also enforces
 * the content-freeze). A reopen returns it to `em_andamento` (editable again).
 */
export function isEditableInterviewStatus(status: InterviewStatus): boolean {
  return (
    status === "draft" ||
    status === "scheduled" ||
    status === "in_progress"
  );
}

/** Whether the interview is in a terminal lifecycle state. Only `cancelada` is terminal. */
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
