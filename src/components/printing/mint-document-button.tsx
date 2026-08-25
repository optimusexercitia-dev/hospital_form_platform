"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileText, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import {
  documentSourcePhrase,
  mintDialogDescriptionCopy,
  PHI_BAND_NOTICE,
  PHI_CHOICE_HINT,
  PHI_CHOICE_LABEL,
  watermarkReasonCopy,
} from "@/components/printing/labels";
import type {
  MintPrintedDocumentInput,
  MintPrintedDocumentState,
} from "@/lib/pdf-mint/actions";
import type { PrintedDocumentSummary } from "@/lib/queries/printed-documents";
import type { PrintedDocumentSourceKind, WatermarkFlag } from "@/lib/pdf/types";

/** The mint server action, passed down from the page (the house pattern — a
 * client island never value-imports the server module itself). */
export type MintDocumentAction = (
  input: MintPrintedDocumentInput,
) => Promise<MintPrintedDocumentState>;

/** The mark this mint will stamp (ADR 0104 D7). Both marks are stated outright:
 * every document declares its state, and an unwatermarked page is evidence of
 * tampering rather than the normal case — so the user is told which mark they
 * are about to put on paper BEFORE it exists. The RATIONALE beside it is
 * kind-aware (`watermarkReasonCopy`), because what makes a document final
 * differs per kind. */
const WATERMARK_MARK: Record<WatermarkFlag, string> = {
  final: "FINAL",
  draft: "RASCUNHO",
};

/**
 * "Emitir documento" — the mint entry point (PDF·P1; ADR 0104 D1/D5/D7).
 *
 * The dialog exists because minting is not a view: it creates a permanent,
 * hash-pinned RECORD that supersedes the previous print of the same source, and
 * nothing here is deletable afterwards. So the confirm step states the scope,
 * names the watermark that will be stamped, and says plainly that a previous
 * emission becomes "substituído" — all before the user commits.
 *
 * Mint is synchronous and can take a few seconds (D5), and on timeout NOTHING is
 * minted, so the pending state is honest about waiting and the dialog stays put
 * rather than optimistically closing.
 *
 * Keyboard path (the tester runs this end to end): trigger → dialog opens with
 * focus on the confirm button → confirm → on success the dialog stays open and
 * focus moves to the download link, so mint→download completes without a mouse
 * and without hunting for what changed.
 *
 * ⚠ **`phiCapable` moves the opening focus onto the PHI choice instead.** With a
 * consequential choice on screen, landing on the confirm button would put the
 * commit ahead of the decision in the tab order: a keyboard user pressing Enter
 * on the focused control would mint without the choice ever entering their path.
 * mint→download still completes keyboard-only — it just traverses the choice
 * first, which is the correct ordering for a decision that cannot be undone.
 *
 * ---
 *
 * ⛔ **The PHI choice renders because the PROVIDER declares the capability, never
 * because of the kind** (ADR 0104 D9 v2-readiness). A `sourceKind === "case"`
 * test in this component is a phase-blocking review finding: it would mean a
 * second kind gaining PHI capability ships a working backend with no control on
 * screen, and the mismatch is invisible to every gate.
 */
export function MintDocumentButton({
  sourceKind,
  sourceId,
  watermark,
  scopeLabel,
  phiCapable,
  action,
}: {
  sourceKind: PrintedDocumentSourceKind;
  sourceId: string;
  /** Which mark this mint will stamp, derived from the source's lifecycle. */
  watermark: WatermarkFlag;
  /** Human-readable statement of WHAT is being printed (e.g. the form title and
   * version) — the dialog's scope confirmation. PHI-free by construction for
   * the P1 kinds. */
  scopeLabel: string;
  /** Whether this kind's provider declares it can print patient identifiers
   * (`PdfDataProvider.phiCapable`). DERIVED from `PDF_PROVIDERS` by the server
   * page — never from the kind, here or anywhere upstream. */
  phiCapable: boolean;
  action: MintDocumentAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<PrintedDocumentSummary | null>(null);
  // ADR 0104 D9 — per-mint, explicit, DEFAULT OFF, and with no memory between
  // mints. That last clause is why this is component state reset on close
  // rather than anything persisted: a remembered "yes" would silently identify
  // a later print that nobody chose to identify.
  const [includePhi, setIncludePhi] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmRef = useRef<HTMLButtonElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const phiChoiceRef = useRef<HTMLButtonElement>(null);

  const phiFieldId = useId();
  const phiHintId = `${phiFieldId}-hint`;
  const phiNoticeId = `${phiFieldId}-notice`;

  // Move focus onto the download link the moment a mint succeeds. Without this
  // the keyboard user is left on a button that no longer exists and has to
  // re-traverse the dialog to find the thing they just created.
  useEffect(() => {
    if (minted) downloadRef.current?.focus();
  }, [minted]);

  function handleMint() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action({
          sourceKind,
          sourceId,
          // A PHI-incapable kind carries no field at all rather than an explicit
          // `false`: there is no control on its screen, so there is no choice to
          // report, and the action already fails closed on `includePhi` for a
          // provider that does not declare the capability.
          ...(phiCapable ? { includePhi } : {}),
        });
        if (!result.ok || !result.document) {
          setError(result.error ?? "Não foi possível emitir o documento.");
          return;
        }
        setMinted(result.document);
        // Refresh the server tree so the "Documentos emitidos" list picks up the
        // new row and the previous one flips to "substituído".
        router.refresh();
      } catch {
        // A thrown action (network, or the not-yet-implemented backend stub)
        // must surface as readable pt-BR — never a raw error (Rule 10).
        setError(
          "Não foi possível emitir o documento agora. Tente novamente em alguns instantes.",
        );
      }
    });
  }

  const mark = WATERMARK_MARK[watermark];
  const watermarkWhy = watermarkReasonCopy(sourceKind, watermark);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setMinted(null);
          // ADR 0104 D9's "no memory of the choice" — the box is unticked again
          // for the next mint, whatever was chosen for this one.
          setIncludePhi(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText aria-hidden="true" className="size-4" />
          Emitir documento
        </Button>
      </DialogTrigger>

      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // Land on the CHOICE when there is one, on the commit when there is
          // not — see the `phiCapable` note in the component docblock.
          if (phiCapable) phiChoiceRef.current?.focus();
          else confirmRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Emitir documento</DialogTitle>
          <DialogDescription>
            {mintDialogDescriptionCopy(sourceKind)}
          </DialogDescription>
        </DialogHeader>

        {minted ? (
          <MintSuccess
            summary={minted}
            identified={phiCapable && includePhi}
            downloadRef={downloadRef}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {error ? <FormBanner tone="error">{error}</FormBanner> : null}

            <dl className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <dt className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Será emitido
              </dt>
              <dd className="mt-1 text-sm text-foreground">{scopeLabel}</dd>
            </dl>

            <div className="rounded-xl border border-primary/25 bg-accent/50 px-4 py-3">
              <p className="text-sm font-medium text-accent-foreground">
                Marca d&rsquo;água:{" "}
                <span className="font-mono tracking-wide">{mark}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">
                {watermarkWhy}
              </p>
            </div>

            {/* ADR 0104 D9 / ADR 0144 D5 — the per-mint patient-identifier
                choice. Sits ABOVE the permanence notice on purpose: "this is
                permanent" is the sentence that should be read LAST, with the
                choice it makes permanent already in view. */}
            {phiCapable ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    ref={phiChoiceRef}
                    checked={includePhi}
                    onCheckedChange={(checked) =>
                      setIncludePhi(checked === true)
                    }
                    disabled={isPending}
                    aria-describedby={`${phiHintId} ${phiNoticeId}`}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">
                      {PHI_CHOICE_LABEL}
                    </span>
                    <span
                      id={phiHintId}
                      className="text-sm leading-relaxed text-pretty text-muted-foreground"
                    >
                      {PHI_CHOICE_HINT}
                    </span>
                  </span>
                </label>

                {/* ⭐ ADR 0144 D6. NOT collapsible, NOT conditional on the box
                    above, and NOT smaller than the hint: the band appears on
                    BOTH variants, so a reader who only ever sees this when the
                    box is ticked learns the opposite of the truth. Icon + text
                    + border, never colour alone (design system §2). */}
                <p
                  id={phiNoticeId}
                  className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-sm leading-relaxed text-pretty text-foreground"
                >
                  <ShieldAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  <span>{PHI_BAND_NOTICE}</span>
                </p>
              </div>
            ) : null}

            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              O documento emitido é permanente e não pode ser apagado. Se já
              houver uma emissão anterior {documentSourcePhrase(sourceKind)},
              ela passa a constar como{" "}
              <strong className="font-medium">substituída</strong> — a via
              impressa continua autêntica, apenas deixa de ser a mais recente.
            </p>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                ref={confirmRef}
                type="button"
                size="lg"
                onClick={handleMint}
                disabled={isPending}
              >
                {isPending ? "Emitindo…" : "Emitir documento"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Post-mint state. Announced assertively — the user pressed a button and waited
 * several seconds, so the outcome must reach a screen reader without them going
 * looking for it.
 *
 * The download goes through the serving route the registry itself hands us
 * (`downloadPath`), never a Storage URL: that route re-checks authority at
 * download time and audits the read (ADR 0104 D8/D11/D12).
 *
 * ⚠ `identified` is stated ONLY when true, and this asymmetry is the point. The
 * de-identified variant gets NO reassuring counterpart line, because every
 * available wording of one ("sem dados do paciente", "versão anônima") would be
 * a false statement: the free-text clinical content in the document may name a
 * patient regardless of the choice (ADR 0144 D6). The user who ticked the box
 * needs confirmation it took effect; the user who did not must not be handed a
 * guarantee the artifact cannot honour.
 */
function MintSuccess({
  summary,
  identified,
  downloadRef,
}: {
  // Not named `document`: that would shadow the DOM global inside a client
  // component, which is exactly the kind of thing that reads fine and bites later.
  summary: PrintedDocumentSummary;
  /** Whether this mint carried the patient identifiers (ADR 0144 D5). */
  identified: boolean;
  downloadRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <div className="animate-rise-in flex flex-col gap-4" role="alert">
      <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/12 px-4 py-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Documento emitido
          </p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">
            Código de verificação:{" "}
            <span className="font-mono">{summary.verificationShortCode}</span>
          </p>
          {identified ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-pretty text-foreground">
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <span>Emitido com a identificação do paciente.</span>
            </p>
          ) : null}
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Fechar
          </Button>
        </DialogClose>
        <a
          ref={downloadRef}
          href={summary.downloadPath}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Download aria-hidden="true" className="size-4" />
          Baixar PDF
        </a>
      </DialogFooter>
    </div>
  );
}
