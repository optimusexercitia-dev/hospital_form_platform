"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Inbox,
  Link2,
  Microscope,
  Paperclip,
  RotateCcw,
  Send,
  Undo2,
} from "lucide-react";

import {
  acceptReferral,
  concludeReferral,
  declineReferral,
  linkReferralCase,
  receiveReferral,
  reopenReferral,
  resolveReferral,
  setReferralDeadline,
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
import { formatCaseNumber } from "./format";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A case in B's commission the target coordinator may link (id + number + label). */
export interface LinkableTargetCase {
  id: string;
  caseNumber: number;
  label: string | null;
}

/**
 * The B-side referral action panel (Decisions 1, 4, 10): the lifecycle controls
 * the entitled coordinator drives, the link-case picker, and the structured reply
 * form. A `"use client"` component fed plain props by the Server detail page; the
 * page computes who-may-do-what from RLS-backed access (NOT this component — it's
 * a convenience gate; the RPC re-checks authority and raises HC071/HC072).
 *
 * Which controls render:
 *  - TARGET coordinator (incoming, `canManageTarget`): receive (`enviada`),
 *    accept/decline (`recebida`), start review (`aceita`), link case + reply
 *    (`em_analise`).
 *  - SOURCE coordinator (outgoing, `canManageSource`): withdraw while in flight.
 *
 * The reply form requires `result_md` + a `reply_outcomes` selection when the
 * referral expects a reply; a no-reply-expected referral may conclude with an
 * acknowledgment only. Attachments upload to a fresh immutable path first (Rule 6)
 * — wired when backend posts the upload action; the optional field is present now.
 */
export function ReferralActions({
  referralId,
  status,
  responseExpected,
  responseDueAt,
  canManageTarget,
  canManageSource,
  replyOutcomes,
  linkableCases,
  linkedCaseNumber,
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
  /** Cases in B's commission available to link (already excludes the linked one). */
  linkableCases: LinkableTargetCase[];
  /** The currently linked target-case number, if any (for the read-back). */
  linkedCaseNumber: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);

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
  // in flight (non-terminal, post-draft). `answered` still counts — A owes the move.
  const canSetDeadline =
    (canManageTarget || canManageSource) &&
    [
      "sent",
      "received",
      "accepted",
      "in_review",
      "awaiting_information",
      "answered",
    ].includes(status);

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

        {/* Link case — available to the target coordinator once accepted/in review. */}
        {canManageTarget && ["accepted", "in_review"].includes(status) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLinkOpen(true)}
            disabled={isPending}
          >
            <Link2 aria-hidden="true" />
            {linkedCaseNumber != null ? "Alterar caso vinculado" : "Vincular caso"}
          </Button>
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

        {/* SLA deadline — either coordinator, while in flight (RV2 R2). */}
        {canSetDeadline && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeadlineOpen(true)}
            disabled={isPending}
          >
            <CalendarClock aria-hidden="true" />
            {responseDueAt ? "Alterar prazo" : "Definir prazo"}
          </Button>
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

      {linkedCaseNumber != null && (
        <p className="text-xs text-muted-foreground">
          Caso vinculado nesta comissão:{" "}
          <span className="font-mono text-foreground">
            {formatCaseNumber(linkedCaseNumber)}
          </span>
        </p>
      )}

      {/* The reply / conclusion form — only the target coordinator, only in review. */}
      {canManageTarget && status === "in_review" && (
        <ReplyForm
          referralId={referralId}
          responseExpected={responseExpected}
          replyOutcomes={replyOutcomes}
        />
      )}

      {/* Decline-with-note dialog. */}
      {canManageTarget && (
        <DeclineDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          referralId={referralId}
        />
      )}

      {/* Link-case dialog. */}
      {canManageTarget && (
        <LinkCaseDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          referralId={referralId}
          cases={linkableCases}
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

      {/* RV2 R2: set/update the SLA deadline (either coordinator). */}
      <DeadlineDialog
        open={deadlineOpen}
        onOpenChange={setDeadlineOpen}
        referralId={referralId}
        current={responseDueAt}
      />
    </section>
  );
}

/** The structured reply form (Decision 10): required `result_md` + a
 * `reply_outcomes` selection when a reply is expected; an acknowledgment-only
 * conclusion otherwise. The optional attachment field is present; the upload
 * action is wired when backend posts it. */
function ReplyForm({
  referralId,
  responseExpected,
  replyOutcomes,
}: {
  referralId: string;
  responseExpected: boolean;
  replyOutcomes: ReplyOutcome[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [outcomeId, setOutcomeId] = useState("");
  const [resultMd, setResultMd] = useState("");
  // A no-reply-expected referral may conclude with an acknowledgment only.
  const [acknowledgedOnly, setAcknowledgedOnly] = useState(!responseExpected);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acknowledgedOnly) {
      if (!resultMd.trim())
        return setError(REFERRAL_MESSAGES.replyResultRequired);
      if (!outcomeId) return setError(REFERRAL_MESSAGES.replyOutcomeRequired);
    }
    startTransition(async () => {
      const result = await concludeReferral({
        referralId,
        replyOutcomeId: acknowledgedOnly ? null : outcomeId,
        resultMd: acknowledgedOnly ? null : resultMd.trim(),
        acknowledgedOnly,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4"
      noValidate
    >
      <h3 className="text-sm font-semibold">Responder e concluir</h3>

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {!responseExpected && (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={acknowledgedOnly}
            onChange={(e) => setAcknowledgedOnly(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Concluir apenas com ciência</span>
            <span className="text-xs text-muted-foreground text-pretty">
              Este encaminhamento não exige resposta. Conclua sem registrar
              resultado.
            </span>
          </span>
        </label>
      )}

      {!acknowledgedOnly && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Desfecho da análise</span>
            <NativeSelect
              value={outcomeId}
              onChange={(e) => setOutcomeId(e.target.value)}
              required
              className="py-2"
            >
              <option value="" disabled>
                Selecione o desfecho…
              </option>
              {replyOutcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Resultado</span>
            <textarea
              value={resultMd}
              onChange={(e) => setResultMd(e.target.value)}
              rows={5}
              required
              className={FIELD_CLASS}
              placeholder="Descreva o resultado da análise para a comissão de origem. Aceita Markdown."
            />
          </label>

          {/* Optional attachment — the upload action lands with backend's storage
              bucket; the field is present now so the layout is final. */}
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-3 py-2.5 text-xs text-muted-foreground">
            <Paperclip aria-hidden="true" className="size-4" />
            Anexos da resposta poderão ser adicionados após concluir.
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          <Send aria-hidden="true" />
          {isPending
            ? "Concluindo…"
            : acknowledgedOnly
              ? "Concluir com ciência"
              : "Enviar resposta e concluir"}
        </Button>
      </div>
    </form>
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

/** Link a case B created in its own commission (Decision 1). Mirrors the meetings
 * case-linker: a Dialog with a case `<select>`. The RPC validates the case is in
 * the target commission (HC079). */
function LinkCaseDialog({
  open,
  onOpenChange,
  referralId,
  cases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  cases: LinkableTargetCase[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [caseId, setCaseId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCaseId("");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!caseId) return setError(REFERRAL_MESSAGES.targetCaseRequired);
    startTransition(async () => {
      const result = await linkReferralCase({ referralId, targetCaseId: caseId });
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
          <DialogTitle>Vincular caso da comissão</DialogTitle>
          <DialogDescription>
            Vincule um caso desta comissão para conduzir a análise. O responsável
            pelo caso vinculado passa a ter acesso à identificação do paciente
            deste encaminhamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Caso</span>
            <NativeSelect
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className="py-2"
            >
              <option value="" disabled>
                Selecione um caso…
              </option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCaseNumber(c.caseNumber)}
                  {c.label ? ` — ${c.label}` : ""}
                </option>
              ))}
            </NativeSelect>
            {cases.length === 0 && (
              <span className="text-xs text-muted-foreground">
                Nenhum caso disponível nesta comissão para vincular.
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
            <Button type="submit" size="lg" disabled={isPending || cases.length === 0}>
              {isPending ? "Vinculando…" : "Vincular"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** ISO timestamp → a `datetime-local` value (`YYYY-MM-DDTHH:mm`, local wall-clock);
 * `null`/unparseable → `""` (empty input). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** The current local wall-clock as a `datetime-local` value, for the input's `min`. */
function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
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

/**
 * Deadline dialog (RV2 R2): either coordinator sets/updates/clears the SLA response
 * deadline while the referral is in flight. A past date is rejected by the RPC
 * (HC0A4); an empty value clears the deadline.
 */
function DeadlineDialog({
  open,
  onOpenChange,
  referralId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(isoToLocalInput(current));
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const iso = value.trim() ? new Date(value).toISOString() : null;
    startTransition(async () => {
      const result = await setReferralDeadline({
        referralId,
        responseDueAt: iso,
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
          <DialogTitle>Prazo de resposta</DialogTitle>
          <DialogDescription>
            Defina a data-limite para a comissão de destino responder. Deixe em
            branco para remover o prazo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Prazo</span>
            <input
              type="datetime-local"
              value={value}
              min={nowLocalInput()}
              onChange={(e) => setValue(e.target.value)}
              className={FIELD_CLASS}
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
            <Button type="submit" size="lg" disabled={isPending}>
              <CalendarClock aria-hidden="true" />
              {isPending ? "Salvando…" : "Salvar prazo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
