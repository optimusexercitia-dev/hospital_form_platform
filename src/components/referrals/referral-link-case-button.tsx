"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

import { linkReferralCase } from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
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

/** A case in B's commission the target coordinator may link (id + number + label). */
export interface LinkableTargetCase {
  id: string;
  caseNumber: number;
  label: string | null;
}

/**
 * The "Vincular caso" control — button AND dialog — for the TARGET coordinator to
 * attach a case of its own commission to the referral under analysis (Decision 1).
 *
 * It lives in the "Caso em análise" card rather than in "Ações": the card is where the
 * linked case is *read*, and it mirrors how "Casos relacionados" carries its own
 * "Relacionar caso" button in the header. The RPC re-checks authority and validates the
 * case belongs to the target commission (HC079) — this gating is a convenience.
 */
export function ReferralLinkCaseButton({
  referralId,
  cases,
  linked,
}: {
  referralId: string;
  /** Cases in B's commission available to link (already excludes the linked one). */
  cases: LinkableTargetCase[];
  /** Whether a case is already linked — switches the label to "Alterar caso". */
  linked: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={cases.length === 0}
      >
        <Link2 aria-hidden="true" />
        {linked ? "Alterar caso" : "Vincular caso"}
      </Button>
      <LinkCaseDialog
        open={open}
        onOpenChange={setOpen}
        referralId={referralId}
        cases={cases}
      />
    </>
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
