import { FileText, Paperclip } from "lucide-react";

import type { DocumentHomeResourceType } from "@/lib/documents/types";
import { documentsWaveAEnabled } from "@/lib/documents/actions";
import { listDocumentsForResource } from "@/lib/queries/documents";
import { cn } from "@/lib/utils";
import { DOCUMENT_HOME_CONFIG } from "./document-labels";
import { DocumentRow } from "./document-row";
import { DocumentUpload } from "./document-upload-dialog";

/**
 * The Wave-A documents panel (DM2·S3) — ONE shell for all three homes
 * (case / meeting / interview), parameterized by `homeResourceType`.
 *
 * Everything that differs between homes (heading, upload copy, D12 file
 * guidance, empty states, the confidentiality options) is resolved from
 * `DOCUMENT_HOME_CONFIG`, not passed as a dozen copy props. Adding a home is a
 * row in that table; it is not a new prop on every component in this tree.
 * Three copies of a byte-corridor client would also be three places for the next
 * authorization fix to miss one.
 *
 * The action-item home deliberately has NO panel: no product flow exists for it
 * and none is invented here (plan §DM2 item 3 — "stays substrate-only until a
 * product flow exists, matching today").
 *
 * ## Data
 *
 * The panel fetches its OWN list (`listDocumentsForResource`) rather than
 * receiving rows as a prop, which keeps the retired attachment projections out
 * of the host pages' prop chains entirely. Ordering is the QUERY's guarantee
 * (documents `createdAt` DESC, versions `versionNumber` DESC, `soft_deleted`
 * excluded) — deliberately not re-sorted here, so there is one authority for it.
 * Disposal-state documents DO remain listed, with redacted titles and
 * availability `disposed`: that is D12's governance record, not a leak.
 *
 * ## Flag governance (`documents_wave_a`) — stated per affordance
 *
 * | Affordance                | Flag OFF |
 * |---------------------------|----------|
 * | section / heading / count | rendered |
 * | existing rows             | rendered read-only |
 * | upload trigger            | ABSENT   |
 * | audited open              | ABSENT (not disabled) |
 * | delete                    | ABSENT   |
 *
 * Deliberately NOT one `canEditNow = canWrite && flagOn`: collapsing several
 * affordances behind a single boolean is how this program last mispredicted its
 * own flag-off behaviour, and the prediction was only corrected by someone
 * RUNNING it. Each affordance names the gate it answers to.
 *
 * The audited open is ABSENT rather than disabled with the flag off (a change
 * from the F2 panels): post-DM1 no rows can exist while the flag is off, so a
 * disabled control would have nothing to attach to, and offering a control whose
 * action is guaranteed to fail is worse than offering none.
 */
export async function DocumentsPanel({
  home,
  access,
  variant = "default",
}: {
  /** Which resource these documents are homed on. */
  home: { type: DocumentHomeResourceType; id: string };
  /** The two independent authorization axes the host resolves. */
  access: {
    /** May upload / remove (`canWriteContent`; ADR 0033). */
    canWrite: boolean;
    /**
     * May obtain document BYTES at all (ADR 0100 D3/D7 — the quality reviewer
     * reads case metadata but never downloads).
     */
    canDownload: boolean;
  };
  /** "rail" = compact, flatter treatment for a detail side rail. */
  variant?: "default" | "rail";
}) {
  const config = DOCUMENT_HOME_CONFIG[home.type];
  const [flagOn, documents] = await Promise.all([
    documentsWaveAEnabled(),
    listDocumentsForResource(home.type, home.id),
  ]);

  const headingId = `${config.domId}-heading`;
  const Icon = home.type === "case" ? FileText : Paperclip;
  const canWriteNow = access.canWrite && flagOn;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card",
        variant === "rail"
          ? "border-border/70 p-4 shadow-none"
          : "border-border p-5 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id={headingId}
            className={cn(
              "font-semibold",
              variant === "rail" ? "text-sm" : "text-base",
            )}
          >
            {config.heading}
          </h2>
          {/* Every sibling panel on these pages carries a count — and hides it
              at zero (Itens de ação, Etiquetas), because an empty section already
              says "empty" in its own copy and a `0` badge only repeats it. */}
          {documents.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
              {documents.length}
            </span>
          )}
        </div>
        {/* Upload trigger: gated on write capability AND the Wave-A flag. */}
        {canWriteNow && <DocumentUpload homeType={home.type} homeId={home.id} />}
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canWriteNow ? config.emptyWritable : config.emptyReadOnly}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {documents.map((doc, i) => (
            <DocumentRow
              key={doc.id}
              document={doc}
              canWrite={canWriteNow}
              canDownload={access.canDownload && flagOn}
              index={i}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
