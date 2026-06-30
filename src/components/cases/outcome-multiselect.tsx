"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import type { CaseOutcome } from "@/lib/queries/case-outcomes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OutcomeDefDialog } from "@/components/cases/outcome-def-dialog";
import { TOKEN_STYLES } from "@/components/cases/case-status-badge";

/**
 * A PURELY-LOCAL outcome multiselect (no server write) over a commission's
 * non-archived outcome vocabulary, reusing the affordances of
 * {@link import('@/components/process-templates/process-outcomes-picker').ProcessOutcomesPicker}
 * — the per-row badge (`TOKEN_STYLES`), the "Plano de ação" / "Adverso" markers,
 * and the inline "Criar novo desfecho" button ({@link OutcomeDefDialog} `mode="create"`).
 *
 * Unlike the process picker, selection is held by the PARENT (`selected` /
 * `onToggle`), so callers can submit it however they need (repeated hidden inputs
 * in the create dialog; a single server action in the detail editor) — this
 * component never calls a server action of its own. After an inline outcome
 * create, {@link OutcomeDefDialog} closes itself and calls `router.refresh()` in
 * its own success effect, so the new outcome appears in this list without any
 * extra refresh here (a redundant refresh raced its close — see BUG-PL-002).
 */
export function OutcomeMultiselect({
  commissionId,
  outcomes,
  selected,
  onToggle,
  disabled = false,
}: {
  commissionId: string;
  /** The commission's non-archived outcome vocabulary. */
  outcomes: CaseOutcome[];
  /** The currently-selected ids (parent-owned). */
  selected: string[];
  /** Toggle a single id in the parent's selection. */
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Desfechos disponíveis</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          <Plus aria-hidden="true" />
          Criar novo desfecho
        </Button>
      </div>

      {outcomes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground text-pretty">
          Esta comissão ainda não tem desfechos. Crie o primeiro desfecho para
          oferecê-lo neste caso.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {outcomes.map((o) => (
            <li key={o.id}>
              <label
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-accent/40",
                  disabled && "opacity-70",
                )}
              >
                <Checkbox
                  checked={selected.includes(o.id)}
                  onCheckedChange={() => onToggle(o.id)}
                  disabled={disabled}
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

      {/* OutcomeDefDialog OWNS its own success close + `router.refresh()` (it calls
          both in its success effect). We only mirror the open state here — an extra
          `router.refresh()` on close raced the inner dialog's own close+refresh and
          interrupted Radix's close transition, leaving the nested dialog open
          (BUG-PL-002). The vocabulary still refreshes via the dialog's own refresh. */}
      <OutcomeDefDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        commissionId={commissionId}
      />
    </div>
  );
}
