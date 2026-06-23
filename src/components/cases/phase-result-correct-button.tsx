"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";
import { Button } from "@/components/ui/button";
import { PhaseResultOverrideDialog } from "./phase-result-override-dialog";

/**
 * The staff-admin "Corrigir resultado" affordance (phase-results feature; task
 * #10) — a client island that owns the {@link PhaseResultOverrideDialog} open
 * state, rendered on a `concluida` phase row. The host ({@link CasePhaseArticle})
 * decides WHETHER to render this (gated on `phaseResultsEnabled` + staff_admin +
 * concluded phase + non-terminal case); this only opens the dialog.
 */
export function PhaseResultCorrectButton({
  casePhaseId,
  options,
  currentResultId,
  phaseLabel,
}: {
  casePhaseId: string;
  options: ResolvedPhaseResult[];
  currentResultId: string | null;
  phaseLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" />
        Corrigir resultado
      </Button>
      <PhaseResultOverrideDialog
        open={open}
        onOpenChange={setOpen}
        casePhaseId={casePhaseId}
        options={options}
        currentResultId={currentResultId}
        phaseLabel={phaseLabel}
      />
    </>
  );
}
