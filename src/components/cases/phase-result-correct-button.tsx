"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import type { PhaseResultAffordance } from "@/components/cases/phase-result-access";
import { Button } from "@/components/ui/button";
import { PhaseResultOverrideDialog } from "./phase-result-override-dialog";

/** The two acts, in the viewer's language. Never rendered for `none`. */
const MODE_LABEL: Record<Exclude<PhaseResultAffordance, "none">, string> = {
  set: "Definir resultado",
  correct: "Corrigir resultado",
};

/**
 * The phase-result affordance (phase-results feature; task #10) — a client island
 * that owns the {@link PhaseResultOverrideDialog} open state. The host
 * ({@link CasePhaseArticle}) decides WHETHER to render it, from the per-phase
 * `phaseResultAffordance` mirror of the door; this only opens the dialog.
 *
 * Two modes, because the door has two branches: `set` on an ACTIVE phase (its own
 * assignee ∨ coordinator — the result is stashed and applies on conclusion) and
 * `correct` on a COMPLETED one (coordinator, non-terminal case — the server
 * recomputes immediately).
 */
export function PhaseResultCorrectButton({
  casePhaseId,
  options,
  currentResultId,
  phaseLabel,
  allowClear = true,
  mode = "correct",
}: {
  casePhaseId: string;
  options: ResolvedPhaseResult[];
  currentResultId: string | null;
  phaseLabel: string;
  /**
   * Whether the dialog may CLEAR the result (automatic phases). `false` for a
   * MANUAL phase — its result is mandatory, so the "use the computed result"
   * option is hidden and a selection is required. Default `true`.
   */
  allowClear?: boolean;
  /**
   * Which act this is — drives the button + dialog copy. `"none"` is never passed
   * (the host does not render at all); it is accepted only so callers can thread
   * the affordance type through unchanged. Default `"correct"`.
   */
  mode?: PhaseResultAffordance;
}) {
  const [open, setOpen] = useState(false);
  const label = mode === "set" ? MODE_LABEL.set : MODE_LABEL.correct;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" />
        {label}
      </Button>
      <PhaseResultOverrideDialog
        open={open}
        onOpenChange={setOpen}
        casePhaseId={casePhaseId}
        options={options}
        currentResultId={currentResultId}
        phaseLabel={phaseLabel}
        allowClear={allowClear}
        mode={mode === "set" ? "set" : "correct"}
      />
    </>
  );
}
