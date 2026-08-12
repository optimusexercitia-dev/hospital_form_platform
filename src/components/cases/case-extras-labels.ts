/**
 * pt-BR display labels for the Cases-Extras (R1/R3/R4) enums. The DB stores ASCII
 * slugs (Architecture Rule 10 — labels resolved in the UI); this is the single
 * place those slugs become human copy, so every panel agrees.
 */

import type {
  CaseDocumentType,
  AnyCaseEventKind,
} from "@/lib/queries/case-documents";
import type { ActionItemStatus } from "@/lib/queries/case-action-items";
import { CASE_EVENT_KIND_LABELS } from "@/lib/cases/registro-kinds";

/** File-backed document kinds (R1). */
export const DOC_TYPE_LABEL: Record<CaseDocumentType, string> = {
  ata: "Ata",
  digitalizacao: "Digitalização",
  registro: "Registro",
  other: "Outro",
};

/**
 * Every case-event kind the DB `case_events_kind_check` allows (R1 + ETH·E3a).
 * Exhaustive over {@link AnyCaseEventKind}, so the timeline can label an
 * auto-derived procedural event once BE-5 widens `CaseEvent.kind`. The manual
 * create-select (`case-event-form.tsx`) still offers only the four manual kinds;
 * the rest are system-emitted and read-only.
 */
export const EVENT_KIND_LABEL: Record<AnyCaseEventKind, string> = {
  // Manually authored via CaseEventForm. Spread from the shared vocabulary the
  // referral "Registros internos" panel files under too — one list, two surfaces.
  ...CASE_EVENT_KIND_LABELS,
  // System "registry echo" kinds (deduped off the timeline; labeled for completeness).
  interview: "Entrevista",
  safety_event: "Evento de segurança",
  // Ethics procedural kinds (E3a) — auto-derived by the E2 procedure RPCs.
  admissibility_decided: "Admissibilidade decidida",
  allegation_added: "Alegação registrada",
  finding_recorded: "Parecer registrado",
  notification_issued: "Notificação emitida",
  hearing_scheduled: "Audiência agendada",
  vote_cast: "Voto registrado",
  decision_issued: "Decisão emitida",
  appeal_submitted: "Recurso interposto",
};

/** Action-item lifecycle statuses (R4). */
export const ACTION_ITEM_STATUS_LABEL: Record<ActionItemStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  done: "Concluído",
  cancelled: "Cancelado",
};

/**
 * Badge styling per action-item status (reuses the semantic colour tokens; no
 * raw CSS). Mirrors the convey-status-by-shape-and-text rule — paired with the
 * label text, never colour alone.
 */
export const ACTION_ITEM_STATUS_STYLE: Record<ActionItemStatus, string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-accent-foreground",
  done: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
};
