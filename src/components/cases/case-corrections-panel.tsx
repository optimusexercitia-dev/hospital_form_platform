"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";

import type { CorrectionRequest } from "@/lib/queries/corrections";
import {
  approveCorrection,
  rejectCorrection,
  reviewCorrection,
  withdrawCorrection,
} from "@/lib/corrections/actions";
import {
  CORRECTION_CLASSIFICATION_META,
  canDecideCorrection,
  canWithdrawCorrection,
  describeImpactSnapshot,
  impactPhaseStatusLabel,
  type CorrectionCaps,
} from "@/components/cases/correction-labels";
import {
  CorrectionKindChip,
  CorrectionStatusChip,
  SelfApprovedBadge,
} from "@/components/cases/correction-chips";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";
import { formatDate } from "@/components/cases/format";

/**
 * "Solicitações de correção" — the Correction Lifecycle request list for ONE target
 * (ADR 0085), rendered at the BOTTOM of that target's own card (the phase article or
 * the narrative card) rather than in a case-wide cockpit card of its own, which
 * cluttered the case-detail page. Lists every request against this target
 * (newest-first, RLS-scoped to case readers) with its kind/classification/status,
 * requester + corrector, reason, any rejection note, the `self_approved` badge, and —
 * once approved — the `impact_snapshot` of downstream phases that were already
 * active/completed at approval.
 *
 * Decisions (approve / reject / withdraw / move-to-review) live HERE, beside the
 * content they touch; the "Corrigir…" and "Continuar correção" affordances sit in the
 * card's top-right header cluster. Approve + reject are staff_admin-only
 * (`caps.canApprove`); withdraw is the requester/corrector/approver. Self-approval is
 * permitted but the confirm warns and the result is badged.
 */
export function CaseCorrectionsList({
  requests,
  caps,
  targetLabel,
  memberNames,
}: {
  /** This target's requests, newest-first. Empty → renders nothing. */
  requests: CorrectionRequest[];
  caps: CorrectionCaps;
  /**
   * The host card's heading (e.g. "Fase 2 — Revisão"). The list sits INSIDE that
   * card, so items never repeat it; it names the region and fills the confirm-dialog
   * copy ("… substituirá o conteúdo registrado de X").
   */
  targetLabel: string;
  /** userId → display name (requester / corrector). */
  memberNames: Record<string, string>;
}) {
  const headingId = useId();

  if (requests.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2.5 border-t border-border pt-3"
    >
      <div className="flex items-center gap-2">
        <ClipboardList
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
        <h3
          id={headingId}
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Solicitações de correção
        </h3>
        <span className="text-xs text-muted-foreground">({requests.length})</span>
      </div>

      <ul className="flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.id}>
            <CorrectionRequestItem
              request={request}
              caps={caps}
              targetLabel={targetLabel}
              memberNames={memberNames}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CorrectionRequestItem({
  request,
  caps,
  targetLabel,
  memberNames,
}: {
  request: CorrectionRequest;
  caps: CorrectionCaps;
  targetLabel: string;
  memberNames: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const requesterName = memberNames[request.requestedBy] ?? "Membro";
  const correctorName = request.permittedCorrector
    ? memberNames[request.permittedCorrector] ?? "Membro"
    : null;

  const classification = CORRECTION_CLASSIFICATION_META[request.classification];
  const impact =
    request.status === "approved"
      ? describeImpactSnapshot(request.impactSnapshot)
      : [];

  const canDecide = caps.canApprove && canDecideCorrection(request);
  const showReview = caps.canApprove && request.status === "resubmitted";
  const canWithdraw = canWithdrawCorrection(request, caps.viewerId, caps.canApprove);
  const willSelfApprove =
    caps.viewerId != null &&
    (request.requestedBy === caps.viewerId ||
      request.permittedCorrector === caps.viewerId);

  function runAction(thunk: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await thunk();
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CorrectionKindChip kind={request.kind} />
        <CorrectionStatusChip status={request.status} />
        {request.status === "approved" && request.selfApproved && (
          <SelfApprovedBadge />
        )}
      </div>

      <p className="text-sm text-foreground text-pretty">{request.reason}</p>

      <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="font-medium">Classificação:</dt>
          <dd>{classification.label}</dd>
        </div>
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="font-medium">Solicitada por:</dt>
          <dd>
            {requesterName} · {formatDate(request.requestedAt)}
          </dd>
        </div>
        {correctorName && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium">Corretor:</dt>
            <dd>{correctorName}</dd>
          </div>
        )}
        {request.status === "approved" && request.resolvedAt && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="font-medium">Aprovada em:</dt>
            <dd>{formatDate(request.resolvedAt)}</dd>
          </div>
        )}
      </dl>

      {request.status === "rejected" && request.lastRejectedReason && (
        <div
          role="status"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <span className="font-medium">Reprovada:</span>{" "}
          {request.lastRejectedReason}
        </div>
      )}

      {impact.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/12 px-3 py-2 text-xs text-foreground">
          <p className="font-medium text-warning">
            Fases posteriores já ativas/concluídas na aprovação:
          </p>
          <ul className="mt-1 ml-4 list-disc text-muted-foreground">
            {impact.map((p, i) => (
              <li key={i}>
                {p.position != null ? `Fase ${p.position}` : "Fase"}
                {p.title ? ` — ${p.title}` : ""} (
                {impactPhaseStatusLabel(p.status)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {(canDecide || showReview || canWithdraw) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showReview && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => runAction(() => reviewCorrection(request.id))}
            >
              Colocar em revisão
            </Button>
          )}

          {canWithdraw && (
            <WithdrawButton
              disabled={isPending}
              targetLabel={targetLabel}
              onConfirm={() => runAction(() => withdrawCorrection(request.id))}
            />
          )}

          {canDecide && (
            <>
              <RejectButton
                disabled={isPending}
                onReject={(reason) =>
                  runAction(() => rejectCorrection(request.id, reason))
                }
              />
              <ApproveButton
                disabled={isPending}
                kind={request.kind}
                targetLabel={targetLabel}
                willSelfApprove={willSelfApprove}
                onConfirm={() => runAction(() => approveCorrection(request.id))}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ApproveButton({
  disabled,
  kind,
  targetLabel,
  willSelfApprove,
  onConfirm,
}: {
  disabled: boolean;
  kind: CorrectionRequest["kind"];
  targetLabel: string;
  willSelfApprove: boolean;
  onConfirm: () => void;
}) {
  const isVoid = kind === "void";
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" disabled={disabled}>
          {isVoid ? "Aprovar anulação" : "Aprovar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isVoid ? "Aprovar a anulação?" : "Aprovar a correção?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isVoid
              ? `${targetLabel} será marcada como anulada e o resultado será removido. Esta ação não pode ser desfeita.`
              : `A correção substituirá o conteúdo registrado de ${targetLabel} e o resultado será recalculado. Esta ação não pode ser desfeita.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {willSelfApprove && (
          <p
            role="status"
            className="rounded-lg border border-warning/30 bg-warning/12 px-3 py-2 text-sm text-warning"
          >
            Você está aprovando uma correção que você mesmo solicitou ou vai
            corrigir. Isso é permitido, mas fica registrado.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={onConfirm}>
            {isVoid ? "Aprovar anulação" : "Aprovar correção"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function WithdrawButton({
  disabled,
  targetLabel,
  onConfirm,
}: {
  disabled: boolean;
  targetLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          Retirar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retirar a solicitação?</AlertDialogTitle>
          <AlertDialogDescription>
            A solicitação de correção de {targetLabel} será encerrada e qualquer
            rascunho será descartado. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={disabled} onClick={onConfirm}>
            Retirar solicitação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectButton({
  disabled,
  onReject,
}: {
  disabled: boolean;
  onReject: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    if (!reason) {
      setLocalError("Informe o motivo da reprovação.");
      reasonRef.current?.focus();
      return;
    }
    setLocalError(null);
    setOpen(false);
    onReject(reason);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setLocalError(null);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        Reprovar
      </Button>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          reasonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Reprovar a correção?</DialogTitle>
          <DialogDescription>
            O corretor volta a editar o rascunho. Explique o que precisa mudar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {localError && <FormBanner tone="error">{localError}</FormBanner>}
          <Field>
            <FieldLabel htmlFor="reject-reason">Motivo da reprovação</FieldLabel>
            <Textarea
              ref={reasonRef}
              id="reject-reason"
              name="reason"
              required
              rows={3}
              placeholder="Explique o que precisa ser ajustado…"
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg">
              Reprovar correção
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
