"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type CommitteeRole = "staff" | "staff_admin";

/** pt-BR labels + what each seat actually lets the person do. */
const ROLE_COPY: Record<CommitteeRole, { label: string; description: string }> = {
  staff: {
    label: "Membro",
    description: "Participa das reuniões e responde formulários da comissão.",
  },
  staff_admin: {
    label: "Coordenador(a)",
    description: "Gerencia membros, pautas e publicações da comissão.",
  },
};

/**
 * The two-card role picker (redesign 3d), shared by "Adicionar a uma comissão" and
 * "Alterar papel" so the same seat is described the same way in both.
 *
 * ⚠ REAL RADIOS UNDER THE CARDS, never divs with click handlers. A native radio group
 * is what gives arrow-key navigation between the options, a single tab stop for the
 * group, and the "Membro, opção 1 de 2, selecionado" announcement. The cards are the
 * radios' own `<label>`s, so clicking anywhere on a card selects it, and the visible
 * focus ring is driven off the real input's `:focus-visible` rather than painted on a
 * div that never receives focus.
 *
 * ⚠ The group is a `<fieldset>` with a `<legend>`: "Papel" has to label the SET, and a
 * plain heading beside two radios labels neither of them.
 *
 * ⚠ `name` is hand-written here rather than taken from `useFieldIds`, because a radio
 * group is one of the three cases that genuinely requires a DOM name — strip it and the
 * two radios stop being one group and both become independently selectable. It is
 * derived from `useId()` so two pickers on one page (add + alterar papel) can never
 * share a group, and the value it would expose on a pre-hydration native submit is a
 * role name, not a person's data.
 */
export function RoleChoiceCards({
  value,
  onChange,
  disabled,
}: {
  value: CommitteeRole;
  onChange: (next: CommitteeRole) => void;
  disabled?: boolean;
}) {
  const groupName = `committee-role-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-[0.72rem] font-semibold">Papel</legend>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {(Object.keys(ROLE_COPY) as CommitteeRole[]).map((role) => {
          const selected = value === role;
          return (
            <label
              key={role}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-xl p-3 transition-colors",
                "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                selected
                  ? "border-2 border-primary bg-accent/40 p-[calc(0.75rem-1px)]"
                  : "border border-border hover:border-primary/45",
              )}
            >
              <span className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={groupName}
                  value={role}
                  checked={selected}
                  onChange={() => onChange(role)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 rounded-full bg-card",
                    selected
                      ? "border-[4.5px] border-primary"
                      : "border-[1.5px] border-border",
                  )}
                />
                <span className="text-[0.78rem] font-semibold">
                  {ROLE_COPY[role].label}
                </span>
              </span>
              <span className="text-[0.7rem] text-muted-foreground text-pretty">
                {ROLE_COPY[role].description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The short pt-BR label for a seat, for pills and confirm copy. */
export function committeeRoleLabel(role: CommitteeRole): string {
  return ROLE_COPY[role].label;
}
