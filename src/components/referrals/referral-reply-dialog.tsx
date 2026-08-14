"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { concludeReferral } from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type { ReferralReplyDocument, ReplyOutcome } from "@/lib/referrals/types";
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
import { ReferralReplyAttachmentUpload } from "./referral-reply-attachments";

/**
 * Everything the reply dialog needs to offer attachments, as ONE prop rather
 * than a boolean plus an array plus whatever the next slice adds. `enabled` is
 * the `documents_wave_c` flag as the SERVER resolved it — a client component
 * cannot read a flag, and must never be handed a server function that could.
 *
 * `enabled: false` means the control is not rendered at all, which is the whole
 * flag gate on this side: with no control there is no `begin`, so the corridor
 * is cut at its first residue-producing step rather than at its last.
 */
export interface ReferralReplyAttachmentAccess {
  enabled: boolean;
  /** Attachments already on the referral; `[]` whenever `enabled` is false
   * (the host never queried them). */
  documents: ReferralReplyDocument[];
}

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The "Responder e concluir" control — a button in "Ações" that opens the structured
 * reply form as a DIALOG (it used to sit inline in the action card, which made the
 * rail tall enough to bury every control under it).
 *
 * Only the TARGET coordinator, only while `in_review`; the caller decides that. The
 * `conclude_referral` RPC re-checks authority and state — this is a convenience gate.
 */
export function ReferralReplyButton({
  referralId,
  responseExpected,
  replyOutcomes,
  attachments,
}: {
  referralId: string;
  responseExpected: boolean;
  replyOutcomes: ReplyOutcome[];
  /** DM4: the reply-attachment surface. Omitted (or `enabled: false`) leaves the
   * dialog exactly as it was before Wave C — no upload control, no `begin`. */
  attachments?: ReferralReplyAttachmentAccess;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Send aria-hidden="true" />
        Responder e concluir
      </Button>
      <ReplyDialog
        open={open}
        onOpenChange={setOpen}
        referralId={referralId}
        responseExpected={responseExpected}
        replyOutcomes={replyOutcomes}
        attachments={attachments}
      />
    </>
  );
}

/**
 * The structured reply form (Decision 10): required `result_md` + a
 * `reply_outcomes` selection when a reply is expected; an acknowledgment-only
 * conclusion otherwise.
 *
 * ## DM4 — the attachment lane is real here now (PO ruling R1)
 *
 * The dialog used to end with a disabled strip reading "Anexos da resposta
 * poderão ser adicionados após concluir". It is replaced, not decorated: the
 * sentence was false in both halves. Nothing could add attachments after
 * concluding (the legacy RPC had zero UI callers for its entire life), and the
 * write authority is `accepted`/`in_review` — so "após concluir" named the one
 * window where the database refuses.
 *
 * Attachments therefore upload IN THIS DIALOG, before the conclusion, each one
 * committing on its own "Anexar arquivo" rather than riding the submit. That is
 * deliberate: an upload is a three-step transport with its own failure and
 * retry semantics, and folding it into the conclude submit would mean a failed
 * PUT either blocks a reply that is otherwise ready, or silently drops a file
 * the coordinator believes they sent.
 *
 * A consequence worth stating plainly: a file attached and then "Cancelar"-ed
 * still exists. It is a real referral-homed document from the moment finalize
 * returns, and it appears in "Anexos" once the reply is delivered. Re-opening
 * the dialog shows it in the list, so the coordinator sees what is already
 * attached instead of uploading it twice.
 */
function ReplyDialog({
  open,
  onOpenChange,
  referralId,
  responseExpected,
  replyOutcomes,
  attachments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  responseExpected: boolean;
  replyOutcomes: ReplyOutcome[];
  attachments?: ReferralReplyAttachmentAccess;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [outcomeId, setOutcomeId] = useState("");
  const [resultMd, setResultMd] = useState("");
  // A no-reply-expected referral may conclude with an acknowledgment only.
  const [acknowledgedOnly, setAcknowledgedOnly] = useState(!responseExpected);

  // Reset every field each time the dialog opens, so an abandoned draft never
  // reappears in the next attempt (the sibling dialogs' `wasOpen` pattern).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOutcomeId("");
      setResultMd("");
      setAcknowledgedOnly(!responseExpected);
      setError(null);
    }
  }

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
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responder e concluir</DialogTitle>
          <DialogDescription>
            Registre o resultado da análise para a comissão de origem. Ao concluir,
            o encaminhamento passa a &ldquo;respondido&rdquo; e a resposta fica
            visível na trajetória.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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

              {/* DM4 (R1): the real upload control. ABSENT — not disabled —
                  while `documents_wave_c` is off, so no `begin` can be issued
                  and no bytes can land behind a dark flag. */}
              {attachments?.enabled && (
                <ReferralReplyAttachmentUpload
                  referralId={referralId}
                  initialDocuments={attachments.documents}
                />
              )}
            </>
          )}

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
              <Send aria-hidden="true" />
              {isPending
                ? "Concluindo…"
                : acknowledgedOnly
                  ? "Concluir com ciência"
                  : "Enviar resposta e concluir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
