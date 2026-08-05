"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { setProcessOutcomes } from "@/lib/cases/outcomes-actions";
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
import { OfferedOutcomeBadges } from "@/components/process-templates/offered-outcome-badges";

/**
 * The process OUTCOMES editor (D15 — draft-only). Selects which of the
 * commission's outcomes a process OFFERS; each case minted from the process is
 * later assigned one of them (or none, if the process offers none).
 *
 * The CARD shows only what the process already offers (the same badges as its
 * frozen twin {@link PublishedOutcomesCard}, via {@link OfferedOutcomeBadges}) —
 * listing the commission's whole vocabulary with checkboxes inline read as if
 * every outcome were already in play. Choosing happens in a dialog behind
 * "Selecionar desfechos", which reuses the {@link OutcomeMultiselect} the
 * process-less case editor uses (checkbox list + inline "Criar novo desfecho", so
 * the author can extend the vocabulary without leaving the builder).
 *
 * Selection is a LOCAL draft while the dialog is open and persists once, on Save,
 * via `setProcessOutcomes` (delete-then-insert server-side) — mirroring
 * {@link import('@/components/cases/case-offered-outcomes-editor').CaseOfferedOutcomesEditor}.
 * The card itself renders from the server-owned `offeredOutcomeIds`, so it follows
 * the post-save `router.refresh()`.
 *
 * Read-only once the template is no longer a draft (a published process is frozen,
 * like its phases) — the shell only mounts this for drafts.
 */
export function ProcessOutcomesPicker({
  commissionId,
  templateVersionId,
  outcomes,
  offeredOutcomeIds,
}: {
  commissionId: string;
  templateVersionId: string;
  /** The commission's non-archived outcome vocabulary. */
  outcomes: CaseOutcome[];
  /** Ids currently offered by this template (pre-checked when the dialog opens). */
  offeredOutcomeIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(offeredOutcomeIds);

  // Re-seed the draft selection from the persisted set each time the dialog opens,
  // so a cancelled edit or a post-save refresh starts from the truth.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(offeredOutcomeIds);
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
      const res = await setProcessOutcomes(templateVersionId, selected);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar os desfechos.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="process-outcomes-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="process-outcomes-heading" className="text-lg font-semibold">
            Desfechos oferecidos
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Os desfechos que os casos deste processo poderão receber. Se nenhum
            for selecionado, os casos serão concluídos sem desfecho.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <ListChecks aria-hidden="true" />
          Selecionar desfechos
        </Button>
      </div>

      <OfferedOutcomeBadges
        outcomes={outcomes}
        offeredOutcomeIds={offeredOutcomeIds}
        emptyMessage="Nenhum desfecho selecionado. Os casos deste processo serão concluídos sem desfecho."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar desfechos</DialogTitle>
            <DialogDescription>
              Escolha quais desfechos os casos deste processo poderão receber. Se
              nenhum for selecionado, os casos serão concluídos sem desfecho.
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
              emptyMessage="Esta comissão ainda não tem desfechos. Crie o primeiro desfecho para oferecê-lo neste processo."
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
    </section>
  );
}
