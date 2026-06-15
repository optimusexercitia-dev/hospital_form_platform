/**
 * pt-BR display labels + badge styling for the Meetings (Phase 10) enums.
 *
 * The DB stores stable ASCII slugs (Architecture Rule 10 — labels resolved in
 * the UI); this is the single place those slugs become human copy + concrete
 * styling, so every meetings screen agrees. Badge styles reuse the semantic
 * colour tokens already in `globals.css` (no raw CSS) and pair colour with text
 * + shape — never colour alone (design-system a11y rule).
 */

import type {
  AttendanceStatus,
  AttendeeRole,
  MeetingAttachmentKind,
  MeetingModality,
  MeetingStatus,
  QuorumRuleType,
  SignatureStatus,
} from "@/lib/queries/meetings";
import type { MeetingActionItemStatus } from "@/lib/queries/meeting-action-items";

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  em_assinatura: "Em assinatura",
  assinada: "Assinada",
  distribuida: "Distribuída",
  cancelada: "Cancelada",
};

/** Badge styling per lifecycle status (semantic tokens; paired with the label text). */
export const MEETING_STATUS_STYLE: Record<MeetingStatus, string> = {
  agendada: "bg-secondary text-secondary-foreground",
  realizada: "bg-accent text-accent-foreground",
  em_assinatura: "bg-warning/15 text-warning",
  assinada: "bg-success/12 text-success dark:bg-success/15",
  distribuida: "bg-primary/12 text-primary",
  cancelada: "bg-muted text-muted-foreground line-through",
};

/**
 * Statuses that count as "past" in the list split. `agendada` is the only
 * upcoming state; everything from `realizada` onward (incl. `cancelada`) is past.
 */
export function isUpcomingStatus(status: MeetingStatus): boolean {
  return status === "agendada";
}

/** Whether the meeting content (minutes/agenda/attendees/case-links) is still editable. */
export function isEditableStatus(status: MeetingStatus): boolean {
  return status === "agendada" || status === "realizada";
}

/** Whether the meeting is in a terminal lifecycle state (no further transitions). */
export function isTerminalMeetingStatus(status: MeetingStatus): boolean {
  return status === "distribuida" || status === "cancelada";
}

// ---------------------------------------------------------------------------
// Modality
// ---------------------------------------------------------------------------

export const MODALITY_LABEL: Record<MeetingModality, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

export const MODALITY_ORDER: MeetingModality[] = [
  "presencial",
  "remoto",
  "hibrido",
];

// ---------------------------------------------------------------------------
// Attendee role + attendance
// ---------------------------------------------------------------------------

export const ATTENDEE_ROLE_LABEL: Record<AttendeeRole, string> = {
  presidente: "Presidente",
  secretario: "Secretário",
  membro: "Membro",
  convidado: "Convidado",
};

export const ATTENDEE_ROLE_ORDER: AttendeeRole[] = [
  "presidente",
  "secretario",
  "membro",
  "convidado",
];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  convocado: "Convocado",
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

export const ATTENDANCE_ORDER: AttendanceStatus[] = [
  "convocado",
  "presente",
  "ausente",
  "justificado",
];

/** Badge styling per attendance state (semantic tokens; paired with the label). */
export const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  convocado: "bg-muted text-muted-foreground",
  presente: "bg-success/12 text-success dark:bg-success/15",
  ausente: "bg-destructive/10 text-destructive",
  justificado: "bg-warning/15 text-warning",
};

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

export const SIGNATURE_STATUS_LABEL: Record<SignatureStatus, string> = {
  signed: "Assinada",
  declined: "Recusada",
  revoked: "Revogada",
};

export const SIGNATURE_STATUS_STYLE: Record<SignatureStatus, string> = {
  signed: "bg-success/12 text-success dark:bg-success/15",
  declined: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/10 text-destructive line-through",
};

// ---------------------------------------------------------------------------
// Attachment kinds
// ---------------------------------------------------------------------------

export const ATTACHMENT_KIND_LABEL: Record<MeetingAttachmentKind, string> = {
  pauta: "Pauta",
  apresentacao: "Apresentação",
  literatura: "Literatura",
  lista_presenca: "Lista de presença",
  ata_assinada: "Ata assinada",
  outro: "Outro",
};

export const ATTACHMENT_KIND_ORDER: MeetingAttachmentKind[] = [
  "pauta",
  "apresentacao",
  "literatura",
  "lista_presenca",
  "ata_assinada",
  "outro",
];

// ---------------------------------------------------------------------------
// Quorum rule
// ---------------------------------------------------------------------------

export const QUORUM_RULE_LABEL: Record<QuorumRuleType, string> = {
  maioria_simples: "Maioria simples",
  fixed_count: "Número fixo",
  percentage: "Percentual",
};

export const QUORUM_RULE_ORDER: QuorumRuleType[] = [
  "maioria_simples",
  "fixed_count",
  "percentage",
];

/**
 * A human-readable description of a quorum rule + its value, for the quorum panel
 * and the settings screen. `value` interpretation depends on the rule.
 */
export function describeQuorumRule(
  rule: QuorumRuleType,
  value: number | null,
): string {
  switch (rule) {
    case "maioria_simples":
      return "Maioria simples dos membros da comissão.";
    case "fixed_count":
      return value != null
        ? `Pelo menos ${value} ${value === 1 ? "presente" : "presentes"}.`
        : "Número fixo de presentes.";
    case "percentage":
      return value != null
        ? `Pelo menos ${value}% dos membros da comissão presentes.`
        : "Percentual dos membros presentes.";
    default:
      return "Regra de quórum.";
  }
}

// ---------------------------------------------------------------------------
// Action items (mirror the cases enum)
// ---------------------------------------------------------------------------

export const ACTION_ITEM_STATUS_LABEL: Record<
  MeetingActionItemStatus,
  string
> = {
  open: "Aberto",
  in_progress: "Em andamento",
  done: "Concluído",
  cancelled: "Cancelado",
};

export const ACTION_ITEM_STATUS_STYLE: Record<
  MeetingActionItemStatus,
  string
> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-accent-foreground",
  done: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
};
