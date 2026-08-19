"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AddAdHocPhaseDialog } from "@/components/cases/add-ad-hoc-phase-dialog";
import { AddAdHocNarrativeDialog } from "@/components/cases/add-ad-hoc-narrative-dialog";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";

/**
 * The two ad-hoc AUTHORING actions for a case's work zone — "Adicionar fase" and
 * "Adicionar narrativa" — extracted verbatim from {@link CaseLifecycleActions},
 * where they used to sit in the coordinator route's top bar beside the terminal
 * lifecycle verbs (Concluir / Cancelar).
 *
 * They live at the BOTTOM of the "Trabalho do caso" card now, because appending a
 * phase or a narrative acts on the work list itself, not on the case: it reads as
 * the continuation of the timeline it extends. Concluir / Cancelar stayed in the
 * top bar — those act on the case.
 *
 * The host passes this component in as a SLOT ({@link CasePhaseList}'s
 * `footerActions`), which is what keeps the staff route clean: that route never
 * constructs it, so it never loads `forms` / `narrativeTypes` either, and the
 * commission's form list + narrative vocabulary never reach its payload. Absent by
 * construction beats hidden by condition.
 *
 * Authority is the DATABASE, not this component (Rule 1): `add_ad_hoc_narrative`
 * gates on `app.is_staff_admin_of` in its DEFINER body and `add_ad_hoc_phase` runs
 * as INVOKER under `case_phases_staff_admin_write`. Both refuse anyone who is not a
 * `staff_admin` of the case's commission, so this only spares a round-trip into a
 * certain error.
 */
export function AddCaseWorkActions({
  caseId,
  forms,
  assignees,
  narrativeTypes = [],
  narrativesEnabled = false,
}: {
  caseId: string;
  /** The commission's PUBLISHED forms — the ad-hoc phase dialog's picker. */
  forms: SlotForm[];
  assignees: AssigneeOption[];
  /**
   * The commission's non-archived narrative-type vocabulary. `[]` is valid: the
   * dialog's inline "Criar novo tipo" covers an empty vocabulary, so the button is
   * NOT disabled on `[]` (only hidden when the feature is off).
   */
  narrativeTypes?: { id: string; label: string }[];
  /** Whether `case_narratives` is on — gates the "Adicionar narrativa" button. */
  narrativesEnabled?: boolean;
}) {
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPhaseOpen(true)}
        disabled={forms.length === 0}
      >
        <Plus aria-hidden="true" />
        Adicionar fase
      </Button>

      {narrativesEnabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setNarrativeOpen(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar narrativa
        </Button>
      )}

      <AddAdHocPhaseDialog
        open={phaseOpen}
        onOpenChange={setPhaseOpen}
        caseId={caseId}
        forms={forms}
        assignees={assignees}
      />

      {narrativesEnabled && (
        <AddAdHocNarrativeDialog
          open={narrativeOpen}
          onOpenChange={setNarrativeOpen}
          caseId={caseId}
          narrativeTypes={narrativeTypes}
          assignees={assignees}
        />
      )}
    </>
  );
}
