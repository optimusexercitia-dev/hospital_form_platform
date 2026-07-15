"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import { deleteReferralDraft } from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
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

/**
 * Discard an UNSENT referral draft, from the referral detail page. Rendered only
 * for a SOURCE-commission coordinator on a `draft` referral — the same authority
 * that sends/withdraws it (`canManageSource`). The RPC re-checks and the delete is
 * pinned to `status = 'draft'` server-side, so this gating is convenience only.
 *
 * It deliberately does NOT reuse the cases' `ConfirmDeleteButton`: that one
 * refreshes the current route, and THIS page ceases to exist the moment the row
 * is gone (`getReferralDetail` → null → `notFound()`), so a refresh would land the
 * coordinator on a 404 of the thing they just deleted. Instead we navigate back to
 * the authoring case — where the outbound-referrals card is, and where the draft
 * came from — and then refresh so that card no longer lists it.
 *
 * The slugs arrive as plain STRINGS and the href is built here (never a closure
 * or a prebuilt-URL prop crossing the RSC boundary; BUG-QI-001).
 */
export function ReferralDraftDelete({
  referralId,
  org,
  commission,
  sourceCaseId,
  referralCode,
}: {
  referralId: string;
  /** Org slug. */
  org: string;
  /** Commission slug — always the SOURCE commission here (gated by the caller). */
  commission: string;
  /** The authoring case — where we return after a successful discard. */
  sourceCaseId: string;
  /** The referral's code (`ENC-0042`), for the accessible label + copy. */
  referralCode: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteReferralDraft(referralId);
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      // Back to the authoring case — this route 404s now. `refresh()` after the
      // push so the case's outbound-referrals card drops the discarded draft.
      router.push(commissionHref(org, commission, "manage", "cases", sourceCaseId));
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="referral-draft-delete-heading"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-card p-5 shadow-xs"
    >
      <h2 id="referral-draft-delete-heading" className="text-base font-semibold">
        Descartar rascunho
      </h2>
      <p className="text-sm text-muted-foreground text-pretty">
        Este encaminhamento ainda não foi enviado. Descartá-lo o remove
        definitivamente — a comissão de destino nunca chegou a vê-lo.
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            aria-label={`Descartar o rascunho ${referralCode}`}
            className="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            Descartar rascunho
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              O rascunho “{referralCode}” será removido definitivamente, junto com
              os itens já selecionados para compartilhamento. Como nunca foi
              enviado, a comissão de destino não é notificada. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={handleDelete}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
