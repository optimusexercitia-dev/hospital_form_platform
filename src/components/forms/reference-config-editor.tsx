"use client";

import { Info } from "lucide-react";

import {
  PARTICIPANT_TYPES,
  REFERENCE_KINDS,
  type ParticipantType,
  type ReferenceKind,
} from "@/lib/forms/reference-constants";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import {
  PARTICIPANT_TYPE_LABELS,
  REFERENCE_LANE_COPY,
  reachesCaseScopedLane,
  referenceKindLabel,
} from "./reference-vocabulary";

/**
 * FF-5 (ADR 0091) — the authoring surface for a `reference` block: WHICH LANE
 * this field points at, and (participant lane only) which participant types are
 * offered to the filler.
 *
 * Two controls, one rule each:
 *
 *  - **Lane** is a radio group, not a `<select>`. Three mutually exclusive
 *    options each needing a line of explanation is exactly what radios are for,
 *    and the choice is structural — it decides which table the answer points at
 *    and therefore what the dashboards can group by.
 *  - **Tipos de participante** is a checkbox group that NARROWS the participant
 *    lane. Nothing checked means every type, which is what both an absent key
 *    and an empty array mean to the server — so the "all" state has no separate
 *    control that could disagree with it.
 *
 * The patient warning is the point of the whole panel. `participant_type =
 * 'patient'` is CASE-SCOPED (ruling 2): its candidates come from the case
 * owning the response, so on a standalone checklist the patient half of this
 * field is legitimately, permanently empty. An author who does not know that
 * files a bug against a working feature — hence a persistent note rather than a
 * one-off toast, shown whenever the selection can reach the patient lane
 * (including the "all types" default).
 *
 * This component owns NO persistence: the parent dialog mirrors the state into
 * the hidden `configReferenceKind` / `configParticipantTypes` fields that
 * `addItem`/`updateItem` parse, exactly as the bounds, "Outros" and risk-band
 * editors do.
 */
export function ReferenceConfigEditor({
  kind,
  participantTypes,
  onKindChange,
  onParticipantTypesChange,
}: {
  kind: ReferenceKind;
  /** The allowed types; an EMPTY array is the "all types" state. */
  participantTypes: ParticipantType[];
  onKindChange: (next: ReferenceKind) => void;
  onParticipantTypesChange: (next: ParticipantType[]) => void;
}) {
  const isParticipant = kind === "participant";
  const showPatientNote =
    isParticipant && reachesCaseScopedLane(participantTypes);

  function toggleType(type: ParticipantType, checked: boolean) {
    const set = new Set(participantTypes);
    if (checked) set.add(type);
    else set.delete(type);
    // Preserve the canonical order so the stored array is stable across edits
    // and two authors who tick the same boxes produce the same config.
    onParticipantTypesChange(PARTICIPANT_TYPES.filter((t) => set.has(t)));
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          O que esta pergunta referencia
        </legend>
        <div className="flex flex-col gap-1.5">
          {REFERENCE_KINDS.map((option) => {
            const copy = REFERENCE_LANE_COPY[option];
            const selected = option === kind;
            return (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm",
                  "transition-colors duration-(--dur-fast) ease-(--ease-out-soft)",
                  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                  selected
                    ? "border-primary bg-accent/40"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="reference-kind-choice"
                  value={option}
                  checked={selected}
                  onChange={() => onKindChange(option)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {referenceKindLabel(option)}
                  </span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    {copy.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {isParticipant ? (
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            Tipos de participante{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </legend>
          <p className="text-xs text-muted-foreground text-pretty">
            Deixe tudo desmarcado para permitir qualquer tipo. Marcar restringe o
            que quem responde pode escolher.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PARTICIPANT_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm"
              >
                <Checkbox
                  checked={participantTypes.includes(type)}
                  onCheckedChange={(c) => toggleType(type, c === true)}
                />
                {PARTICIPANT_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {showPatientNote ? (
        // Not an error and not a warning about a mistake — a fact about scope
        // the author needs before publishing. Icon + text, never colour alone.
        <p className="flex items-start gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2.5 text-xs text-pretty">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong className="font-medium">Pacientes só aparecem em casos.</strong>{" "}
            A lista de pacientes vem dos participantes do caso a que a resposta
            pertence. Em um formulário avulso, sem caso vinculado, nenhum paciente
            será oferecido — os demais tipos continuam funcionando normalmente.
          </span>
        </p>
      ) : null}
    </div>
  );
}
