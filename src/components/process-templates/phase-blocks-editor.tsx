"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PhaseWithTargets } from "@/components/process-templates/phase-with-targets";

/**
 * The phase BLOCKERS editor (D1/D4 — the "Bloqueios" multiselect). A phase can
 * declare EARLIER phases that must be settled (concluída or não-necessária) before
 * it can be activated in a case. This is a checkbox list of every strictly-earlier
 * phase (mirrors {@link RecommendWhenEditor}'s "earlier phases only" rule); the
 * selected 1-based positions are reported up via `onChange` and persisted by
 * {@link PhaseSlotDialog} through `setTemplatePhaseBlocks`.
 *
 * The first phase (and any phase with no earlier phases) can have no blockers, so
 * an informative empty state renders instead of the list. The backend re-validates
 * earlier-only + exists (HC016).
 */
export function PhaseBlocksEditor({
  phasePosition,
  phases,
  value,
  onChange,
}: {
  /** 1-based position of the phase being edited (only earlier phases qualify). */
  phasePosition: number;
  phases: PhaseWithTargets[];
  /** Currently-selected blocker positions (1-based). */
  value: number[];
  onChange: (next: number[]) => void;
}) {
  // Earlier phases only (strictly lower position), in order.
  const earlierPhases = phases
    .filter((p) => p.position < phasePosition)
    .sort((a, b) => a.position - b.position);

  function toggle(position: number) {
    onChange(
      value.includes(position)
        ? value.filter((p) => p !== position)
        : [...value, position].sort((a, b) => a - b),
    );
  }

  if (earlierPhases.length === 0) {
    return (
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Bloqueios</legend>
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          A primeira fase não pode ser bloqueada. Adicione fases anteriores para
          definir quais devem ser concluídas antes desta.
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold">Bloqueios</legend>
      <p className="text-sm text-muted-foreground text-pretty">
        Selecione as fases anteriores que devem estar concluídas (ou marcadas como
        não necessárias) antes que esta fase possa ser ativada em um caso.
      </p>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        {earlierPhases.map((p) => (
          <label key={p.id} className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={value.includes(p.position)}
              onCheckedChange={() => toggle(p.position)}
            />
            <span>
              Fase {p.position}
              {p.title ? ` — ${p.title}` : p.formTitle ? ` — ${p.formTitle}` : ""}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
