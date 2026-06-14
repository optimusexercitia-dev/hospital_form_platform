"use client";

import { Check } from "lucide-react";

import type { CaseStatusColorToken } from "@/lib/queries/case-statuses";
import { cn } from "@/lib/utils";
import { TOKEN_COLOR_VAR } from "./case-status-badge";

/** The selectable palette tokens, in a stable display order. */
const TOKENS: CaseStatusColorToken[] = [
  "slate",
  "blue",
  "amber",
  "green",
  "red",
  "violet",
  "muted",
];

const TOKEN_NAME: Record<CaseStatusColorToken, string> = {
  slate: "Ardósia",
  blue: "Azul",
  amber: "Âmbar",
  green: "Verde",
  red: "Vermelho",
  violet: "Violeta",
  muted: "Neutro",
};

/**
 * A small swatch picker over the constrained colour palette (shared by the status
 * and tag dialogs). Keyboard-operable radio group: each swatch is a button with
 * `aria-pressed`; the selected one shows a check. Colour alone never carries
 * meaning — the accessible name includes the colour's pt-BR name.
 */
export function ColorTokenPicker({
  value,
  onChange,
}: {
  value: CaseStatusColorToken;
  onChange: (token: CaseStatusColorToken) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Cor"
      className="flex flex-wrap items-center gap-2"
    >
      {TOKENS.map((token) => {
        const selected = token === value;
        return (
          <button
            key={token}
            type="button"
            aria-pressed={selected}
            aria-label={TOKEN_NAME[token]}
            title={TOKEN_NAME[token]}
            onClick={() => onChange(token)}
            className={cn(
              "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              selected && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: TOKEN_COLOR_VAR[token] }}
          >
            {selected && (
              <Check
                aria-hidden="true"
                className="size-3.5 text-white drop-shadow"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
