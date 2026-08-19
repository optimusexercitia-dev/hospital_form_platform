import { Suspense } from "react";
import { Download, FileWarning, Printer } from "lucide-react";

import { RiseInGroup } from "@/components/motion/rise-in-group";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintedDocumentStatusChip } from "@/components/printing/printed-document-status-chip";
import {
  MintDocumentButton,
  type MintDocumentAction,
} from "@/components/printing/mint-document-button";
import { PreviaLink } from "@/components/printing/previa-link";
import { PrintedDocumentCurrencyChip } from "@/components/printing/printed-document-currency-chip";
import { printCurrencyFrom } from "@/components/printing/currency";
import {
  RevokeDocumentDialog,
  type RevokeDocumentAction,
} from "@/components/printing/revoke-document-dialog";
import {
  formatDateTimePtBr,
  noPrintedDocumentsCopy,
  printedDocumentsIntroCopy,
  printedDocumentsLoadErrorCopy,
  revokeReasonClassLabel,
} from "@/components/printing/labels";
import { listPrintedDocuments } from "@/lib/queries/printed-documents";
import type { PrintedDocumentSourceKind, WatermarkFlag } from "@/lib/pdf/types";

interface PrintedDocumentsProps {
  sourceKind: PrintedDocumentSourceKind;
  sourceId: string;
  /** Mark this source would stamp if printed right now (ADR 0104 D7). */
  watermark: WatermarkFlag;
  /**
   * Whether printing this source yields a REGISTERED emission (ADR 0125 D1).
   * DERIVED by the caller from `printSourceRegisters` — never a user choice, and
   * never re-derived here: this panel renders whichever affordance the source
   * state dictates, and the two are mutually exclusive by construction.
   */
  registers: boolean;
  /** What a mint would cover, in words — shown in the confirm dialog. */
  scopeLabel: string;
  /**
   * Whether this viewer may revoke. Decided by the CALLER from the gate its
   * screen already enforces (ADR 0104 D11: `staff_admin` of the owning
   * commission), never re-derived here — and the server action re-checks it
   * regardless, since a hidden button is not a control (Rule 1).
   */
  canRevoke: boolean;
  mintAction: MintDocumentAction;
  revokeAction: RevokeDocumentAction;
}

/**
 * "Documentos emitidos" — the printed-document registry for one source artifact
 * (PDF·P1; ADR 0104 D3/D6).
 *
 * The header and the mint affordance render immediately; only the LIST suspends.
 * The registry read is a second round trip and this panel sits beneath the
 * response the user actually came to read, so blocking the page on it would
 * trade the primary content for secondary metadata.
 */
export function PrintedDocumentsSection(props: PrintedDocumentsProps) {
  return (
    <section
      aria-labelledby="printed-documents-heading"
      className="flex flex-col gap-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="printed-documents-heading"
            className="flex items-center gap-2 text-xl"
          >
            <Printer aria-hidden="true" className="size-5 text-primary" />
            Documentos emitidos
          </h2>
          <p className="text-sm text-muted-foreground">
            {printedDocumentsIntroCopy(props.registers)}
          </p>
        </div>
        {/* ADR 0125 D1 — ONE print action, DERIVED from source state. A locked
            source yields a registered emission; a still-editable one yields an
            ephemeral prévia, and the user never chooses which. The rejected
            alternative was both buttons side by side, which would have made
            "is this a record?" a user decision — ADR 0104 D7's "no free text,
            no user-composed stamps" defeated by another route. */}
        {props.registers ? (
          <MintDocumentButton
            sourceKind={props.sourceKind}
            sourceId={props.sourceId}
            watermark={props.watermark}
            scopeLabel={props.scopeLabel}
            action={props.mintAction}
          />
        ) : (
          <PreviaLink sourceKind={props.sourceKind} sourceId={props.sourceId} />
        )}
      </header>

      <Suspense fallback={<PrintedDocumentsSkeleton />}>
        <PrintedDocumentsList
          sourceKind={props.sourceKind}
          sourceId={props.sourceId}
          canRevoke={props.canRevoke}
          revokeAction={props.revokeAction}
        />
      </Suspense>
    </section>
  );
}

/**
 * The registry rows. Reads under the caller's session — RLS delegates to source
 * visibility, so a caller who cannot see the source gets an empty list rather
 * than a denial (ADR 0104 D11).
 *
 * A failed read renders a calm pt-BR notice, never a raw Supabase/Postgres error
 * (Rule 10) and never an empty list: "nothing was emitted" and "we could not
 * check" are different facts, and showing the first when the second is true
 * would invite someone to mint a duplicate.
 */
async function PrintedDocumentsList({
  sourceKind,
  sourceId,
  canRevoke,
  revokeAction,
}: {
  sourceKind: PrintedDocumentSourceKind;
  sourceId: string;
  canRevoke: boolean;
  revokeAction: RevokeDocumentAction;
}) {
  let documents;
  try {
    documents = await listPrintedDocuments(sourceKind, sourceId);
  } catch (error) {
    console.error("[printed-documents] list failed", error);
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm leading-relaxed text-pretty text-muted-foreground shadow-xs"
      >
        <FileWarning
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-warning"
        />
        <span>{printedDocumentsLoadErrorCopy(sourceKind)}</span>
      </p>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-6 text-sm text-muted-foreground">
        {noPrintedDocumentsCopy(sourceKind)}
      </p>
    );
  }

  return (
    <RiseInGroup className="flex flex-col gap-3">
      {documents.map((doc) => (
        <article
          key={doc.id}
          data-rise
          className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <PrintedDocumentStatusChip status={doc.status} />
              {/* ADR 0126 D2/D3 — CURRENCY is a SEPARATE fact from registry
                  status, so it gets its own chip rather than being folded into
                  the one above. `active` + NOT current is a new legal
                  combination, and a merged chip would have to hide one of the
                  two facts in exactly the row that needs attention. Renders
                  nothing when the print is current (the ordinary case) or
                  revoked (currency deliberately not evaluated). */}
              <PrintedDocumentCurrencyChip
                currency={printCurrencyFrom(doc.status, doc.isCurrent)}
              />
              <span className="text-sm text-foreground">
                Emitido em {formatDateTimePtBr(doc.mintedAt)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              por {doc.mintedByDisplay} · modelo v{doc.templateVersion} · código{" "}
              <span className="font-mono">{doc.verificationShortCode}</span>
            </p>
            {doc.status === "revoked" ? (
              <p className="text-sm text-destructive">
                Anulado
                {doc.revokedAt ? ` em ${formatDateTimePtBr(doc.revokedAt)}` : ""}
                {doc.revokedReasonClass
                  ? ` · ${revokeReasonClassLabel(doc.revokedReasonClass)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <a
              href={doc.downloadPath}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Download aria-hidden="true" className="size-3.5" />
              Baixar
              <span className="sr-only">
                {" "}
                o documento de código {doc.verificationShortCode}
              </span>
            </a>
            {canRevoke && doc.status !== "revoked" ? (
              <RevokeDocumentDialog
                documentId={doc.id}
                shortCode={doc.verificationShortCode}
                action={revokeAction}
              />
            ) : null}
          </div>
        </article>
      ))}
    </RiseInGroup>
  );
}

/** Streaming placeholder mirroring one registry row. */
function PrintedDocumentsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col gap-3"
      aria-label="Carregando documentos emitidos"
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
