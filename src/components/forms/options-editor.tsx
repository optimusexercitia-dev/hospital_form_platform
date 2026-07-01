"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Ban, Check, Plus, Trash2 } from "lucide-react";

import type { ColorToken, ItemOption } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * form-model-normalization: each option is now a NORMALIZED {@link ItemOption}
 * row (`{ id, code, label, color, score, analyticsCode, position }`). The author
 * edits only `label`, `color`, `score` (a stored-only numeric weight) and
 * `analyticsCode` (a free-text cross-form tagging hook); `id`/`code`/`position`
 * are managed by the platform and never shown — `code` is the stable analytics /
 * condition identity, so renaming a `label` never breaks analytics. New rows are
 * created with an empty `id`/`code` (the backend assigns them on insert).
 *
 * When `colorable` is true (multiple_choice + checkbox only — a native
 * `<select>` can't render colour) a per-row colour picker is shown, defaulting to
 * "sem cor" (`color: null`).
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

/**
 * A blank option row for a freshly-added option. `id`/`code` are empty — the
 * backend `addItem`/`updateItem` action assigns the stable code (slug+suffix) and
 * the row id on insert; `position` is by index and is recomputed by the parent on
 * reorder/serialize, so the value held here is only a placeholder.
 */
export function blankOption(position: number): ItemOption {
  return {
    id: "",
    code: "",
    label: "",
    color: null,
    score: null,
    analyticsCode: null,
    position,
  };
}

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

  /** Parse the score buffer to a number, or null when blank/invalid. The buffer
   *  itself is held in the DOM; the canonical value is the parsed number. */
  function updateScoreAt(index: number, raw: string) {
    const next = options.slice();
    const trimmed = raw.trim().replace(",", ".");
    const parsed = trimmed === "" ? null : Number(trimmed);
    next[index] = {
      ...next[index],
      score: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    };
    onChange(next);
  }

  function updateAnalyticsCodeAt(index: number, raw: string) {
    const next = options.slice();
    const trimmed = raw.trim();
    next[index] = { ...next[index], analyticsCode: trimmed === "" ? null : trimmed };
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
    onChange([...options, blankOption(options.length)]);
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
        <ul className="flex flex-col gap-3">
          {options.map((option, index) => {
            const inputId = `${groupId}-option-${index}`;
            const scoreId = `${groupId}-option-${index}-score`;
            const analyticsId = `${groupId}-option-${index}-analytics`;
            const position = index + 1;
            return (
              <li
                key={index}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-2.5"
              >
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
                    {colorable && (
                      <OptionColorDropdown
                        position={position}
                        value={option.color}
                        onChange={(color) => updateColorAt(index, color)}
                      />
                    )}
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

                {/* Score + analytics-code: optional analytics metadata, paired in
                    one compact row beneath the label. Both default to "no value"
                    so the common (label-only) option stays uncluttered. */}
                <div className="grid grid-cols-2 gap-2 pl-0.5">
                  <label
                    htmlFor={scoreId}
                    className="flex flex-col gap-1 text-xs text-muted-foreground"
                  >
                    <span>
                      Pontuação{" "}
                      <span className="font-normal">(opcional)</span>
                    </span>
                    <Input
                      id={scoreId}
                      type="text"
                      inputMode="decimal"
                      defaultValue={option.score === null ? "" : String(option.score)}
                      onChange={(e) => updateScoreAt(index, e.target.value)}
                      placeholder="Ex.: 2"
                      className="h-8"
                    />
                  </label>
                  <label
                    htmlFor={analyticsId}
                    className="flex flex-col gap-1 text-xs text-muted-foreground"
                  >
                    <span>
                      Código de análise{" "}
                      <span className="font-normal">(opcional)</span>
                    </span>
                    <Input
                      id={analyticsId}
                      type="text"
                      defaultValue={option.analyticsCode ?? ""}
                      onChange={(e) => updateAnalyticsCodeAt(index, e.target.value)}
                      placeholder="Ex.: conforme"
                      className="h-8"
                    />
                  </label>
                </div>
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
 * A single trigger button showing the current colour (or a Ban icon for "sem
 * cor"). Clicking opens a dropdown with the full palette so the option row stays
 * compact — one line regardless of whether colours are enabled.
 */
function OptionColorDropdown({
  position,
  value,
  onChange,
}: {
  position: number;
  value: ColorToken | null;
  onChange: (token: ColorToken | null) => void;
}) {
  const [open, setOpen] = useState(false);

  function select(token: ColorToken | null) {
    onChange(token);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            value
              ? `Cor da opção ${position}: ${TOKEN_NAME[value]}. Clique para alterar`
              : `Cor da opção ${position}: sem cor. Clique para alterar`
          }
          title={value ? TOKEN_NAME[value] : "Sem cor"}
          className={cn(
            "grid size-7 place-items-center rounded-full border border-input ring-offset-2 ring-offset-card transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
            value === null && "bg-card",
          )}
          style={value ? { backgroundColor: TOKEN_COLOR_VAR[value] } : undefined}
        >
          {value === null ? (
            <Ban aria-hidden="true" className="size-3.5 text-muted-foreground" />
          ) : (
            <span className="sr-only">{TOKEN_NAME[value]}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="flex items-center gap-1.5 p-2"
      >
        <button
          type="button"
          aria-pressed={value === null}
          aria-label="Sem cor"
          title="Sem cor"
          onClick={() => select(null)}
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
              onClick={() => select(token)}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
