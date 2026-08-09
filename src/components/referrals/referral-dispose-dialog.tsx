"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import type { PhiDisposeReason } from "@/lib/safety/types";
import { disposeReferralPhi } from "@/lib/referrals/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * pt-BR labels for the LGPD-erasure reason (UI copy; the enum is the frozen
 * {@link PhiDisposeReason}). Covers all five categories the `dispose_referral_phi`
 * door accepts. Ordered most-common first.
 */
const REASON_LABELS: Record<PhiDisposeReason, string> = {
  retention_expired: "Prazo de retenção expirado",
  subject_request: "Solicitação do titular (LGPD Art. 18)",
  entered_in_error: "Registrado por engano",
  duplicate: "Registro duplicado",
  other: "Outro motivo",
};

const REASON_ORDER: PhiDisposeReason[] = [
  "retention_expired",
  "subject_request",
  "entered_in_error",
  "duplicate",
  "other",
];

/** The exact phrase the operator must type to arm the irreversible erasure. */
const CONFIRM_PHRASE = "APAGAR";

/**
 * The destructive LGPD-erasure control for a referral's PHI (NSP-per-hospital, ADR
 * 0052 §6; decision 5). Wired to the `disposeReferralPhi(referralId, reason)`
 * server action, which routes through the audited `dispose_referral_phi` DEFINER
 * door — gated on the NSP arm of either side, `is_pqs_operator_of(source hospital) OR
 * is_pqs_operator_of(target hospital)` (the SERVER is authoritative; this UI gate
 * is defense-in-depth so an unentitled viewer never sees a dangling control).
 *
 * The action PERMANENTLY deletes the isolated patient record and redacts every PHI
 * free-text field across the referral, its reply, and shared items — the governance
 * skeleton (code, status, provenance, audit chain) is preserved. It is IRREVERSIBLE,
 * so the dialog requires (1) a constrained reason category and (2) typing a
 * confirmation phrase before the destructive button arms. Copy is unambiguous that
 * the erasure cannot be undone. Fully keyboard-operable; pt-BR throughout.
 *
 * The PAGE decides whether to render this at all — it mounts the component only
 * when the authoritative `canDisposeReferralPhi` probe returns true (a PHI record
 * exists AND the viewer passes the exact RPC gate: PQS operator of either endpoint
 * hospital; BUG-NPH-002). So this component assumes it is entitled and holds no gate
 * of its own.
 *
 * ⚠ The gate narrowed twice and this docblock was stale for both — ADR 0078 A35/M2
 * dropped the platform-admin bypass, BUG-QOB-004 (`20260917000000`) dropped the tenancy
 * tier. Read `pg_get_functiondef`, not this comment.
 */
export function ReferralDisposeDialog({
  referralId,
}: {
  referralId: string;
}) {
  const router = useRouter();
  const reasonId = useId();
  const confirmId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<PhiDisposeReason | "">("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;
  const armed = reason !== "" && confirmed;

  function reset() {
    setReason("");
    setConfirmText("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleDispose() {
    // Re-narrow `reason` to a concrete category (never `""`) before the call.
    if (reason === "" || !confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await disposeReferralPhi(referralId, reason);
      if (!result.ok) {
        setError(
          result.error ??
            "Não foi possível apagar os dados do paciente. Tente novamente.",
        );
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="referral-dispose-heading"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
    >
      <div className="flex items-center gap-2">
        <Trash2 aria-hidden="true" className="size-4 text-destructive" />
        <h2 id="referral-dispose-heading" className="text-base font-semibold">
          Apagar dados do paciente
        </h2>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">
        Remove permanentemente a identificação do paciente e todos os campos com
        dados sensíveis deste encaminhamento (LGPD Art. 18). O histórico de
        governança — código, situação e trilha de auditoria — é preservado. Esta
        ação é irreversível.
      </p>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            Apagar dados do paciente
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar os dados do paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação apaga <strong>permanentemente</strong> a identificação do
              paciente e todos os campos com dados sensíveis deste encaminhamento,
              da resposta e dos itens compartilhados. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={reasonId} className="text-sm font-medium">
                Motivo da exclusão
              </label>
              <NativeSelect
                id={reasonId}
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as PhiDisposeReason | "")
                }
                disabled={isPending}
              >
                <option value="">Selecione o motivo…</option>
                {REASON_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={confirmId} className="text-sm font-medium">
                Digite <span className="font-mono">{CONFIRM_PHRASE}</span> para
                confirmar
              </label>
              <input
                id={confirmId}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isPending}
                autoComplete="off"
                aria-describedby={`${confirmId}-help`}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p
                id={`${confirmId}-help`}
                className="text-xs text-muted-foreground text-pretty"
              >
                Confirmação exigida por se tratar de exclusão definitiva de dados
                pessoais.
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !armed}
              onClick={handleDispose}
            >
              {isPending ? "Apagando…" : "Apagar definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
