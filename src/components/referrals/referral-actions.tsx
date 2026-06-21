"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleSlash,
  Inbox,
  Link2,
  Microscope,
  Paperclip,
  Send,
  Undo2,
} from "lucide-react";

import {
  acceptReferral,
  concludeReferral,
  declineReferral,
  linkReferralCase,
  receiveReferral,
  startReferralReview,
  withdrawReferral,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type {
  ReferralStatus,
  ReplyOutcome,
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
  canManageTarget,
  canManageSource,
  replyOutcomes,
  linkableCases,
  linkedCaseNumber,
}: {
  referralId: string;
  status: ReferralStatus;
  responseExpected: boolean;
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
    ["enviada", "recebida", "aceita", "em_analise"].includes(status);
  const sourceCanWithdraw =
    canManageSource &&
    ["enviada", "recebida", "aceita", "em_analise"].includes(status);

  if (!targetCanAct && !sourceCanWithdraw) return null;

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
        {canManageTarget && status === "enviada" && (
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

        {canManageTarget && status === "recebida" && (
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

        {canManageTarget && status === "aceita" && (
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
        {canManageTarget && ["aceita", "em_analise"].includes(status) && (
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
      {canManageTarget && status === "em_analise" && (
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
            <select
              value={outcomeId}
              onChange={(e) => setOutcomeId(e.target.value)}
              required
              className={FIELD_CLASS}
            >
              <option value="" disabled>
                Selecione o desfecho…
              </option>
              {replyOutcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
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
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
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
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Motivo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
              placeholder="Por que o encaminhamento está sendo recusado…"
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
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              required
              className={FIELD_CLASS}
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
            </select>
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
