"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  CircleSlash,
  Inbox,
  Microscope,
  RotateCcw,
  Undo2,
} from "lucide-react";

import {
  acceptReferral,
  declineReferral,
  receiveReferral,
  reopenReferral,
  resolveReferral,
  startReferralReview,
  withdrawReferral,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import {
  REFERRAL_DECLINE_REASON_LABELS,
  type ReferralDeclineReasonCode,
  type ReferralStatus,
  type ReplyOutcome,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import { canSetReferralDeadline } from "./deadline-gate";
import { ReferralDeadlineButton } from "./referral-deadline-button";
import {
  ReferralReplyButton,
  type ReferralReplyAttachmentAccess,
} from "./referral-reply-dialog";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The referral action panel (Decisions 1, 4, 10): the lifecycle transitions an
 * entitled coordinator drives. A `"use client"` component fed plain props by the
 * Server detail page; the page computes who-may-do-what from RLS-backed access (NOT
 * this component — it's a convenience gate; the RPC re-checks authority and raises
 * HC071/HC072).
 *
 * Which controls render:
 *  - TARGET coordinator (incoming, `canManageTarget`): receive (`enviada`),
 *    accept/decline (`recebida`), start review (`aceita`), reply (`em_analise`).
 *  - SOURCE coordinator (outgoing, `canManageSource`): withdraw while in flight,
 *    resolve once answered, reopen once resolved.
 *
 * ⚠ TWO controls that used to live here have MOVED to the card that shows what they
 * change, and are NOT rendered here on the commission-side detail:
 *  - "Vincular caso" → the "Caso em análise" card (`ReferralCaseCard`);
 *  - "Definir/Alterar prazo" → the "Detalhes" card, beside the deadline itself.
 * The technical-direction page has no such cards — it renders this panel as its only
 * control surface — so the deadline control stays here behind `showDeadlineControl`.
 * The reply form is no longer inline either: it is a dialog behind "Responder e
 * concluir", so the transitions above are not buried under a form.
 */
export function ReferralActions({
  referralId,
  status,
  responseExpected,
  responseDueAt,
  canManageTarget,
  canManageSource,
  replyOutcomes,
  replyAttachments,
  showDeadlineControl = true,
}: {
  referralId: string;
  status: ReferralStatus;
  responseExpected: boolean;
  /** RV2 R2: the current SLA deadline (ISO), or `null`. Drives the deadline
   * dialog's initial value + the "Definir"/"Alterar" button label. */
  responseDueAt: string | null;
  /** Viewer is a coordinator of the TARGET commission (or an admin). */
  canManageTarget: boolean;
  /** Viewer is a coordinator of the SOURCE commission (or an admin). */
  canManageSource: boolean;
  replyOutcomes: ReplyOutcome[];
  /**
   * DM4 (ADR 0114 Wave C): the reply-attachment surface, passed through to the
   * reply dialog. ONE grouped prop rather than a `documentsWaveCEnabled`
   * boolean beside a `replyDocuments` array — the two are meaningless apart
   * (the array is always `[]` when the flag is off, because the host does not
   * query it), and this panel already carries eight props.
   *
   * Omitted leaves the dialog pre-Wave-C: no upload control, no `begin`.
   */
  replyAttachments?: ReferralReplyAttachmentAccess;
  /**
   * Whether to render the deadline control HERE. `false` on any page whose "Detalhes"
   * card already carries it — rendering it in both places would give one referral two
   * "Alterar prazo" buttons.
   */
  showDeadlineControl?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  /** Run a no-arg transition action, surfacing its mapped pt-BR error. */
  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  // Nothing actionable for this viewer/status → render nothing (the page shows the
  // read-only snapshot/reply). Keeps the surface calm for plain members.
  const targetCanAct =
    canManageTarget &&
    ["sent", "received", "accepted", "in_review"].includes(status);
  const sourceCanWithdraw =
    canManageSource &&
    ["sent", "received", "accepted", "in_review"].includes(status);
  // RV2 R3: the SOURCE coordinator formally confirms closure (`answered → resolved`)
  // or reopens a resolved referral (`resolved → in_review`). The RPC re-checks
  // authority (42501) and state (HC0A5); this gating is a convenience.
  const sourceCanResolve = canManageSource && status === "answered";
  const sourceCanReopen = canManageSource && status === "resolved";
  // RV2 R2: either coordinator may set/update the SLA deadline while the referral is
  // in flight. The status set lives with the control (one list, two call sites).
  const canSetDeadline =
    showDeadlineControl &&
    canSetReferralDeadline({ status, canManageTarget, canManageSource });

  if (
    !targetCanAct &&
    !sourceCanWithdraw &&
    !sourceCanResolve &&
    !sourceCanReopen &&
    !canSetDeadline
  )
    return null;

  return (
    <section
      aria-labelledby="referral-actions-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <h2 id="referral-actions-heading" className="text-base font-semibold">
        Ações
      </h2>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      <div className="flex flex-wrap gap-2">
        {/* TARGET transitions */}
        {canManageTarget && status === "sent" && (
          <Button
            type="button"
            size="sm"
            onClick={() => run(() => receiveReferral(referralId))}
            disabled={isPending}
          >
            <Inbox aria-hidden="true" />
            Receber
          </Button>
        )}

        {canManageTarget && status === "received" && (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => run(() => acceptReferral(referralId))}
              disabled={isPending}
            >
              <CheckCircle2 aria-hidden="true" />
              Aceitar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDeclineOpen(true)}
              disabled={isPending}
            >
              <CircleSlash aria-hidden="true" />
              Recusar
            </Button>
          </>
        )}

        {canManageTarget && status === "accepted" && (
          <Button
            type="button"
            size="sm"
            onClick={() => run(() => startReferralReview(referralId))}
            disabled={isPending}
          >
            <Microscope aria-hidden="true" />
            Iniciar análise
          </Button>
        )}

        {/* Reply + conclude — target coordinator, in review. The form itself is a
            dialog (it used to sit inline below and dominate the card). */}
        {canManageTarget && status === "in_review" && (
          <ReferralReplyButton
            referralId={referralId}
            responseExpected={responseExpected}
            replyOutcomes={replyOutcomes}
            attachments={replyAttachments}
          />
        )}

        {/* SOURCE resolve — confirm closure once the target has answered (RV2 R3). */}
        {sourceCanResolve && (
          <Button
            type="button"
            size="sm"
            onClick={() => setResolveOpen(true)}
            disabled={isPending}
          >
            <BadgeCheck aria-hidden="true" />
            Resolver
          </Button>
        )}

        {/* SOURCE reopen — reopen a resolved referral for a new cycle (RV2 R3). */}
        {sourceCanReopen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReopenOpen(true)}
            disabled={isPending}
          >
            <RotateCcw aria-hidden="true" />
            Reabrir
          </Button>
        )}

        {/* SLA deadline — either coordinator, while in flight (RV2 R2). Only on a page
            with no "Detalhes" card to host it (see `showDeadlineControl`). */}
        {canSetDeadline && (
          <ReferralDeadlineButton
            referralId={referralId}
            responseDueAt={responseDueAt}
          />
        )}

        {/* SOURCE withdraw — while the referral is still in flight. */}
        {sourceCanWithdraw && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => run(() => withdrawReferral(referralId))}
            disabled={isPending}
          >
            <Undo2 aria-hidden="true" />
            Retirar encaminhamento
          </Button>
        )}
      </div>

      {/* Decline-with-note dialog. */}
      {canManageTarget && (
        <DeclineDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          referralId={referralId}
        />
      )}

      {/* RV2 R3: source resolve / reopen dialogs. */}
      {canManageSource && (
        <ResolveDialog
          open={resolveOpen}
          onOpenChange={setResolveOpen}
          referralId={referralId}
        />
      )}
      {canManageSource && (
        <ReopenDialog
          open={reopenOpen}
          onOpenChange={setReopenOpen}
          referralId={referralId}
        />
      )}
    </section>
  );
}

/** Decline-with-optional-note dialog (`recebida → recusada`). */
function DeclineDialog({
  open,
  onOpenChange,
  referralId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reasonCode, setReasonCode] = useState<ReferralDeclineReasonCode | "">(
    "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReasonCode("");
      setNote("");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await declineReferral({
        referralId,
        note: note.trim() || null,
        declineReasonCode: reasonCode || null,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar encaminhamento</DialogTitle>
          <DialogDescription>
            A comissão de origem será notificada da recusa. O caso de origem
            poderá ser encerrado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          {/* RV2 R2: a PHI-free structured reason (visible to metadata-tier
              readers), distinct from the optional PHI-bearing note below. */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Motivo da recusa{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <NativeSelect
              value={reasonCode}
              onChange={(e) =>
                setReasonCode(e.target.value as ReferralDeclineReasonCode | "")
              }
              className="py-2"
            >
              <option value="">Não especificar</option>
              {(
                Object.entries(REFERRAL_DECLINE_REASON_LABELS) as [
                  ReferralDeclineReasonCode,
                  string,
                ][]
              ).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Observação{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
              placeholder="Detalhe para a comissão de origem, se necessário…"
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Recusando…" : "Recusar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Resolve dialog (RV2 R3): the SOURCE coordinator confirms closure
 * (`answered → resolved`) with an OPTIONAL resolution summary (PHI-bearing) + a
 * follow-up flag. Appends a resolution row (append-only history).
 */
function ResolveDialog({
  open,
  onOpenChange,
  referralId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSummary("");
      setFollowUp(false);
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveReferral({
        referralId,
        summaryMd: summary.trim() || null,
        followUpRequired: followUp,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver encaminhamento</DialogTitle>
          <DialogDescription>
            Confirme o encerramento após a resposta da comissão de destino. Você
            pode registrar um resumo da resolução e indicar se há acompanhamento
            pendente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Resumo da resolução{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              className={FIELD_CLASS}
              placeholder="Como o encaminhamento foi encerrado. Aceita Markdown."
            />
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="mt-0.5 size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Requer acompanhamento</span>
              <span className="text-xs text-muted-foreground text-pretty">
                Marque se ainda há uma pendência a acompanhar após a resolução.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              <BadgeCheck aria-hidden="true" />
              {isPending ? "Resolvendo…" : "Resolver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reopen dialog (RV2 R3): the SOURCE coordinator reopens a resolved referral
 * (`resolved → in_review`) with a REQUIRED reason. The next resolve appends a new
 * resolution number (append-only history).
 */
function ReopenDialog({
  open,
  onOpenChange,
  referralId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setFieldError(null);
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!reason.trim()) {
      setFieldError(REFERRAL_MESSAGES.reopenReasonRequired);
      return;
    }
    startTransition(async () => {
      const result = await reopenReferral({ referralId, reason: reason.trim() });
      if (!result.ok) {
        if (result.fieldErrors?.reason) setFieldError(result.fieldErrors.reason);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir encaminhamento</DialogTitle>
          <DialogDescription>
            A análise volta ao estado &ldquo;Em análise&rdquo; para um novo ciclo.
            Informe o motivo da reabertura.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Motivo da reabertura</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              className={FIELD_CLASS}
              placeholder="Por que o encaminhamento está sendo reaberto…"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "referral-reopen-error" : undefined}
            />
            {fieldError && (
              <span
                id="referral-reopen-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </span>
            )}
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              <RotateCcw aria-hidden="true" />
              {isPending ? "Reabrindo…" : "Reabrir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

