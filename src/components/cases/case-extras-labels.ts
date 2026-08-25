/**
 * pt-BR display labels for the Cases-Extras (R1/R3/R4) enums. The DB stores ASCII
 * slugs (Architecture Rule 10 — labels resolved in the UI); this is the single
 * place those slugs become human copy, so every panel agrees.
 */

import type { CaseDocumentType } from "@/lib/queries/case-documents";
import type { ActionItemStatus } from "@/lib/queries/case-action-items";

/**
 * ⭐ `EVENT_KIND_LABEL` and `ACTION_ITEM_STATUS_LABEL` MOVED to
 * `@/lib/cases/labels` (PDF·P3) and are re-exported here so existing importers
 * keep working. They are re-exported, NOT re-declared: `src/lib/cases/pdf-payload.ts`
 * prints the same enums onto the dossier, `src/lib` cannot import upward from
 * `src/components`, and a second copy would let the printed record carry a label
 * the UI had already renamed.
 *
 * ⛔ Do not "restore" either map here. This file is now a compatibility surface
 * for them, and the only reason it is not just deleted is that the map that
 * remains below is presentational.
 */
export {
  EVENT_KIND_LABEL,
  ACTION_ITEM_STATUS_LABEL,
} from "@/lib/cases/labels";

/** File-backed document kinds (R1). */
export const DOC_TYPE_LABEL: Record<CaseDocumentType, string> = {
  ata: "Ata",
  digitalizacao: "Digitalização",
  registro: "Registro",
  other: "Outro",
};

/**
 * Badge styling per action-item status (reuses the semantic colour tokens; no
 * raw CSS). Mirrors the convey-status-by-shape-and-text rule — paired with the
 * label text, never colour alone.
 *
 * ⚠ Paired with `ACTION_ITEM_STATUS_LABEL`, which now lives in
 * `@/lib/cases/labels`. Navigation pointer only — what ENFORCES the pairing is
 * that both carry an explicit `Record<ActionItemStatus, string>`, so adding a
 * status is a compile error in both files in the same `tsc` run. ⛔ Do not
 * replace the annotation below with an inferred object literal: it looks like a
 * simplification, passes every gate, and silently removes the only check that
 * these two halves still describe the same union.
 */
export const ACTION_ITEM_STATUS_STYLE: Record<ActionItemStatus, string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-accent-foreground",
  done: "bg-success/12 text-success dark:bg-success/15",
  cancelled: "bg-muted text-muted-foreground line-through",
};
