/**
 * pt-BR display labels for the Cases-Extras (R1/R3/R4) enums. The DB stores ASCII
 * slugs (Architecture Rule 10 — labels resolved in the UI); this is the single
 * place those slugs become human copy, so every panel agrees.
 */

import type {
  CaseDocumentType,
  CaseEventKind,
} from "@/lib/queries/case-documents";
import type { ActionItemStatus } from "@/lib/queries/case-action-items";

/** File-backed document kinds (R1). */
export const DOC_TYPE_LABEL: Record<CaseDocumentType, string> = {
  ata: "Ata",
  digitalizacao: "Digitalização",
  registro: "Registro",
  other: "Outro",
};

/** Manual event kinds (R1). */
export const EVENT_KIND_LABEL: Record<CaseEventKind, string> = {
  note: "Nota",
  meeting: "Reunião",
  decision: "Decisão",
  other: "Outro",
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
