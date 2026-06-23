"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Ban, Check, Plus, Trash2 } from "lucide-react";

import type { ColorToken, ItemOption } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  TOKEN_COLOR_VAR,
} from "@/components/cases/case-status-badge";

/**
 * Controlled editor for the discrete option list of a choice-type input
 * (`multiple_choice` / `dropdown` / `checkbox`). Add, edit, remove, and reorder
 * (up/down — no drag-and-drop in v1) the options.
 *
 * form-builder-enhancements (decision #4): each option is now an
 * {@link ItemOption} (`{ label, color }`). When `colorable` is true
 * (multiple_choice + checkbox only — a native `<select>` can't render colour) a
 * per-row colour picker is shown, defaulting to "sem cor" (`color: null`). The
 * answer still STORES the option label string; the colour is presentation only.
 *
 * Presentational + controlled: owns no persistence. The parent supplies
 * `options`/`onChange`; persistence happens when the parent item editor calls
 * its server action.
 */

/** The selectable palette tokens, in a stable display order (mirrors the
 *  shared `ColorTokenPicker`); `null` (sem cor) is offered first. */
const COLOR_TOKENS: ColorToken[] = [
  "slate",
  "blue",
  "amber",
  "green",
  "red",
  "violet",
  "muted",
];

const TOKEN_NAME: Record<ColorToken, string> = {
  slate: "Ardósia",
  blue: "Azul",
  amber: "Âmbar",
  green: "Verde",
  red: "Vermelho",
  violet: "Violeta",
  muted: "Neutro",
};

export function OptionsEditor({
  options,
  onChange,
  disabled = false,
  legend = "Opções",
  colorable = false,
}: {
  options: ItemOption[];
  onChange: (next: ItemOption[]) => void;
  disabled?: boolean;
  legend?: string;
  /** When true, show the per-row colour picker (multiple_choice + checkbox). */
  colorable?: boolean;
}) {
  const groupId = useId();

  function updateLabelAt(index: number, label: string) {
    const next = options.slice();
    next[index] = { ...next[index], label };
    onChange(next);
  }

  function updateColorAt(index: number, color: ColorToken | null) {
    const next = options.slice();
    next[index] = { ...next[index], color };
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = options.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...options, { label: "", color: null }]);
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-foreground">
        {legend}
      </legend>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma opção ainda. Adicione pelo menos uma.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {options.map((option, index) => {
            const inputId = `${groupId}-option-${index}`;
            const position = index + 1;
            return (
              <li key={index} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor={inputId} className="sr-only">
                    Opção {position}
                  </Label>
                  <Input
                    id={inputId}
                    value={option.label}
                    onChange={(e) => updateLabelAt(index, e.target.value)}
                    placeholder={`Opção ${position}`}
                    className="h-9 flex-1"
                  />
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover a opção ${position} para cima`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, 1)}
                      disabled={index === options.length - 1}
                      aria-label={`Mover a opção ${position} para baixo`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAt(index)}
                      aria-label={`Remover a opção ${position}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {colorable && (
                  <OptionColorPicker
                    position={position}
                    value={option.color}
                    onChange={(color) => updateColorAt(index, color)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="mt-1 w-fit"
      >
        <Plus aria-hidden="true" />
        Adicionar opção
      </Button>
    </fieldset>
  );
}

/**
 * Inline per-option colour swatches over the constrained palette, with a leading
 * "sem cor" (null) default. Keyboard-operable: each swatch is a button with
 * `aria-pressed`; the selected one shows a check. Colour alone never carries
 * meaning — the accessible name includes the colour's pt-BR name.
 */
function OptionColorPicker({
  position,
  value,
  onChange,
}: {
  position: number;
  value: ColorToken | null;
  onChange: (token: ColorToken | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Cor da opção ${position}`}
      className="flex flex-wrap items-center gap-1.5 pl-0.5"
    >
      <button
        type="button"
        aria-pressed={value === null}
        aria-label="Sem cor"
        title="Sem cor"
        onClick={() => onChange(null)}
        className={cn(
          "grid size-6 place-items-center rounded-full border border-input bg-card ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          value === null && "ring-2 ring-ring",
        )}
      >
        <Ban aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </button>
      {COLOR_TOKENS.map((token) => {
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
              "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              selected && "ring-2 ring-ring",
            )}
            style={{ backgroundColor: TOKEN_COLOR_VAR[token] }}
          >
            {selected && (
              <Check
                aria-hidden="true"
                className="size-3 text-white drop-shadow"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
