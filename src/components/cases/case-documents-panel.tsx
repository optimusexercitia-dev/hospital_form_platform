import { DocumentsPanel } from "@/components/documents/documents-panel";

/**
 * Case DOCUMENTS panel — RE-POINTED to the core document model (DM2·S3 Wave A;
 * ADR 0114). Thin adapter over the shared {@link DocumentsPanel} so the case
 * detail view keeps its own vocabulary at the call site while the rendering,
 * availability semantics and the single audited byte corridor live in one place.
 *
 * History: R1 introduced a `case_documents` table; F2 folded it onto the
 * centralized-attachments substrate (ADR 0063); DM1 dropped that substrate
 * entirely (migration `20260923000100`), which is why this panel has been dark
 * in production since 2026-08-11. Wave A rebuilds it on `documents` homed on the
 * case's `securable_resources` row.
 *
 * The panel no longer takes a `documents` prop: it fetches its own list through
 * `listDocumentsForResource`, which keeps the retired attachment projections out
 * of the case-detail prop chain entirely.
 *
 * ## Both authorization props are REQUIRED (QA r1 MINOR-5)
 *
 * They defaulted to `true`. Nothing was wrong at the time — the one call site
 * passes both — but an authorization prop that defaults to ALLOW is a trap that
 * springs on whoever adds the second call site, and DM2's own P0-1 is what that
 * looks like when it matters: the only shipped control over PHI bytes was a
 * React prop, which is Architecture Rule 1 inverted. Required (not `= false`)
 * because a silent deny is still a guess about a question the caller alone can
 * answer; `tsc` now makes the next caller answer it. This also matches the
 * sibling meeting/interview adapters, whose `canEdit` was always required.
 *
 * The server remains the boundary either way: these props hide controls, they
 * do not enforce anything.
 */
export function CaseDocumentsPanel({
  caseId,
  variant = "default",
  canWrite,
  canDownload,
}: {
  caseId: string;
  /** "rail" = compact treatment for the case-detail side rail. */
  variant?: "default" | "rail";
  /** Whether the viewer may upload/remove documents (`canWriteContent`; ADR 0033). */
  canWrite: boolean;
  /**
   * Whether this viewer may obtain document BYTES at all (ADR 0100 D3/D7 — the
   * quality reviewer reads case metadata but never downloads).
   *
   * Under the document model there is exactly ONE byte path (the audited
   * `open_document_version` door), so this suppresses one control rather than
   * the two the F2 panel had to remember. The `signedUrl: null` overloading that
   * made the old version hazardous is gone: projections carry no storage
   * coordinates at all, so there is no second path to leave open.
   */
  canDownload: boolean;
}) {
  return (
    <DocumentsPanel
      home={{ type: "case", id: caseId }}
      access={{ canWrite, canDownload }}
      variant={variant}
    />
  );
}
