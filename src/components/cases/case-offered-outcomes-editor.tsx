"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import type { OfferedCaseOutcome } from "@/lib/queries/cases";
import { setCaseOfferedOutcomes } from "@/lib/cases/outcomes-actions";
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
import { OutcomeMultiselect } from "@/components/cases/outcome-multiselect";

/**
 * The PROCESS-LESS case offered-outcome editor (processless_cases). A
 * coordinator-only dialog that edits which outcomes a NON-TERMINAL process-less
 * case offers — DELIBERATELY breaking the offered-set "freeze" that templated
 * cases keep by design (v1 mounts this for process-less cases only; the caller
 * gates on `templateId === null`).
 *
 * Seeded from the case's current resolved offered set; reuses the create dialog's
 * {@link OutcomeMultiselect} (checkbox list + inline "Criar novo desfecho"). On
 * save it calls {@link setCaseOfferedOutcomes} then refreshes the route. Server
 * errors are surfaced inline (HC029 — "altere o desfecho do caso antes…" when the
 * currently-assigned outcome would be dropped; HC025 terminal; HC030 mismatch).
 */
export function CaseOfferedOutcomesEditor({
  caseId,
  commissionId,
  outcomes,
  offeredOutcomes,
}: {
  caseId: string;
  commissionId: string;
  /** The commission's non-archived outcome vocabulary. */
  outcomes: CaseOutcome[];
  /** The case's current resolved offered set (pre-checked when the dialog opens). */
  offeredOutcomes: OfferedCaseOutcome[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(
    offeredOutcomes.map((o) => o.id),
  );

  // Re-seed the selection from the live offered set each time the dialog opens, so
  // a cancelled edit or a post-save refresh starts from the persisted truth.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(offeredOutcomes.map((o) => o.id));
      setError(null);
    }
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    );
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setCaseOfferedOutcomes(caseId, selected);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar os desfechos.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" />
        Editar desfechos disponíveis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Desfechos disponíveis</DialogTitle>
            <DialogDescription>
              Escolha quais desfechos este caso poderá receber. Com ao menos um
              desfecho, será obrigatório registrá-lo ao concluir o caso.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {error && <FormBanner tone="error">{error}</FormBanner>}

            <OutcomeMultiselect
              commissionId={commissionId}
              outcomes={outcomes}
              selected={selected}
              onToggle={toggle}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" size="lg" onClick={save} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
