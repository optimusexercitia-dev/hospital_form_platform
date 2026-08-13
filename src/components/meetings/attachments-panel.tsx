import { DocumentsPanel } from "@/components/documents/documents-panel";

/**
 * Meeting ATTACHMENTS panel — RE-POINTED to the core document model (DM2·S3
 * Wave A; ADR 0114). Thin adapter over the shared {@link DocumentsPanel}.
 *
 * History: F4 introduced meeting attachments; F2 rewired them onto the
 * centralized-attachments substrate (ADR 0063); DM1 dropped that substrate
 * (migration `20260923000100`), which is why this panel has been dark in
 * production since 2026-08-11. Wave A rebuilds it on `documents` homed on the
 * meeting's `securable_resources` row.
 *
 * Meetings are NOT a patient-data module (Rule 12), which the shared upload
 * dialog reflects: its copy for this home tells the author not to attach files
 * containing patient data at all — unlike the case and interview homes, whose
 * files may. The title rule is the same everywhere.
 *
 * Enforcing confidentiality labels are NOT offered here: the database refuses
 * them on a meeting home (SQLSTATE `HC0D6`, the DM2·S1 seam guard), so the
 * picker omits them rather than presenting an option that cannot succeed.
 *
 * The panel no longer takes an `attachments` prop — it fetches its own list.
 */
export function AttachmentsPanel({
  meetingId,
  canEdit,
}: {
  meetingId: string;
  /** Whether the viewer may upload/remove (the meeting coordinator). */
  canEdit: boolean;
}) {
  return (
    <DocumentsPanel
      home={{ type: "meeting", id: meetingId }}
      access={{ canWrite: canEdit, canDownload: true }}
    />
  );
}
