"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { setProcessOutcomes } from "@/lib/cases/outcomes-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OutcomeDefDialog } from "@/components/cases/outcome-def-dialog";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

/**
 * The process OUTCOMES multiselect (D15 — draft-only). Selects which of the
 * commission's outcomes a process OFFERS; each case minted from the process is
 * later assigned one of them (or none, if the process offers none). Toggling a
 * row persists the FULL offered set via `setProcessOutcomes` (delete-then-insert
 * server-side). An inline "Criar novo desfecho" opens the outcome dialog so the
 * author can extend the vocabulary without leaving the builder.
 *
 * Read-only once the template is no longer a draft (a published process is frozen,
 * like its phases) — the shell only mounts this for drafts.
 */
export function ProcessOutcomesPicker({
  commissionId,
  templateId,
  outcomes,
  offeredOutcomeIds,
}: {
  commissionId: string;
  templateId: string;
  /** The commission's non-archived outcome vocabulary. */
  outcomes: CaseOutcome[];
  /** Ids currently offered by this template (pre-checked). */
  offeredOutcomeIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(offeredOutcomeIds);
  const [createOpen, setCreateOpen] = useState(false);

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((o) => o !== id)
      : [...selected, id];
    const prev = selected;
    setSelected(next);
    setError(null);
    startTransition(async () => {
      const res = await setProcessOutcomes(templateId, next);
      if (!res.ok) {
        setSelected(prev);
        setError(res.error ?? "Não foi possível salvar os desfechos.");
        return;
      }
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
            Escolha quais desfechos os casos deste processo poderão receber. Se
            nenhum for selecionado, os casos serão concluídos sem desfecho.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" />
          Criar novo desfecho
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {outcomes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          Esta comissão ainda não tem desfechos. Crie o primeiro desfecho para
          oferecê-lo neste processo.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {outcomes.map((o) => (
            <li key={o.id}>
              <label
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-accent/40",
                  isPending && "opacity-70",
                )}
              >
                <Checkbox
                  checked={selected.includes(o.id)}
                  onCheckedChange={() => toggle(o.id)}
                  disabled={isPending}
                />
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    TOKEN_STYLES[o.colorToken] ?? TOKEN_STYLES.muted,
                  )}
                >
                  {o.label}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {o.requiresActionPlan && (
                    <span className="text-[0.68rem] font-medium text-warning">
                      Plano de ação
                    </span>
                  )}
                  {o.isAdverse && (
                    <span className="text-[0.68rem] font-medium text-destructive">
                      Adverso
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <OutcomeDefDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        commissionId={commissionId}
      />
    </section>
  );
}
