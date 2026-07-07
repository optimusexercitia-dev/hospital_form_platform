"use client";

import { useId, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  Flag,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import type { ColorToken, ItemOption } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { generateOptionCode } from "@/lib/forms/option-code";

/**
 * Controlled editor for the discrete option list of a choice-type input
 * (`multiple_choice` / `dropdown` / `checkbox`). Add, edit, remove, and reorder
 * (up/down — no drag-and-drop in v1) the options.
 *
 * form-model-normalization: each option is a NORMALIZED {@link ItemOption} row
 * (`{ id, code, label, color, score, analyticsCode, flagged, isOther, position }`).
 * The author edits `label`, `color`, `score`, `analyticsCode` and (task #4) the
 * `flagged` toggle; `id`/`code`/`position` are platform-managed and never shown —
 * `code` is the stable analytics / condition identity, so renaming a `label`
 * never breaks analytics. New rows are created with an empty `id`/`code` (the
 * backend assigns them on insert).
 *
 * task #4 — the score + analytics-code + **Flagged** metadata are PROGRESSIVELY
 * DISCLOSED behind a per-row "Opções" toggle (the user's deliberate divergence
 * from the doc's section-level table): the common label-only row stays clean, and
 * the per-option scoring/analytics/flag reveals only when that row's toggle is on.
 * A row whose metadata is ALREADY set (score/analyticsCode/flagged) opens expanded
 * so editing a configured option reveals it. Hiding the metadata NEVER drops it —
 * it stays in `options` state and the parent keeps emitting the hidden fields.
 *
 * The reserved "Outros" row (`isOther`) is HIDDEN from this editable list — it is
 * managed entirely by the backend's `reconcile_item_options`; the author only
 * toggles `config.allowOther` (in the dialog), never authors the `__other__` row.
 *
 * When `colorable` is true (multiple_choice + checkbox only — a native `<select>`
 * can't render colour) a per-row colour picker is shown, defaulting to "sem cor".
 *
 * Presentational + controlled: owns no persistence. The parent supplies
 * `options`/`onChange`; persistence happens when the parent item editor calls its
 * server action.
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
 * A blank option row for a freshly-added option. `id` is empty — the backend
 * `addItem`/`updateItem` action assigns the row id on insert; `position` is by
 * index and is recomputed by the parent on reorder/serialize, so the value
 * held here is only a placeholder. `code` is ALSO empty at creation, but is
 * minted client-side (see {@link OptionsEditor}'s `updateLabelAt`) as soon as
 * the author types a non-empty label — BUG-AMV2-002: a choice-type "Valor
 * padrão" set while adding a brand-new item needs a real code to reference
 * (the code minted only server-side, on insert, arrived too late for the
 * in-dialog default-value picker). The server still falls back to minting its
 * own code if a row somehow arrives with `code === ""`.
 */
export function blankOption(position: number): ItemOption {
  return {
    id: "",
    code: "",
    label: "",
    color: null,
    score: null,
    analyticsCode: null,
    // task #4 owns the REAL per-row Flagged toggle; a new row starts un-flagged.
    // isOther is NEVER authored via blankOption — the reserved __other__ row is
    // backend-managed and hidden from this editor.
    flagged: false,
    isOther: false,
    position,
  };
}

/** Whether a row already carries metadata worth revealing on open (task #4). */
function hasMetadata(option: ItemOption): boolean {
  return (
    option.score !== null ||
    (option.analyticsCode ?? "") !== "" ||
    option.flagged === true
  );
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

  // The reserved "Outros" row is backend-managed and never author-editable — hide
  // it entirely so it is never rendered, reordered, deleted, or emitted. All edit
  // handlers below operate on the FULL `options` array by the ORIGINAL index, so
  // hiding is a render-time filter only (indices stay stable for onChange).
  const rows = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.isOther);

  // Per-row "Opções" (metadata) disclosure. Keyed by the row's original index;
  // a row whose metadata is already set opens expanded. Seeded lazily once.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    options.forEach((option, index) => {
      if (!option.isOther && hasMetadata(option)) initial.add(index);
    });
    return initial;
  });

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // BUG-AMV2-002: mint a real, stable `code` for a brand-new row (code === "")
  // as soon as its label becomes non-empty, so a choice-type default picked in
  // the SAME add-item session references a real code — not the empty-string
  // placeholder. Rows loaded from the server (code already set) are left
  // untouched, and once minted here a row's code stays stable across a later
  // label rename.
  function updateLabelAt(index: number, label: string) {
    const next = options.slice();
    const current = next[index];
    const needsCode = current.code === "" && label.trim().length > 0;
    const code = needsCode
      ? generateOptionCode(
          label,
          new Set(
            options
              .filter((_, i) => i !== index)
              .map((o) => o.code)
              .filter((c) => c !== ""),
          ),
        )
      : current.code;
    next[index] = { ...current, label, code };
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

  function updateFlaggedAt(index: number, flagged: boolean) {
    const next = options.slice();
    next[index] = { ...next[index], flagged };
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  /** Move a row up/down among the NON-reserved rows. `visibleIndex` is the
   *  position within `rows`; we translate to the real `options` indices so the
   *  hidden `isOther` row (always last) is never disturbed. */
  function move(visibleIndex: number, direction: -1 | 1) {
    const target = visibleIndex + direction;
    if (target < 0 || target >= rows.length) return;
    const a = rows[visibleIndex].index;
    const b = rows[target].index;
    const next = options.slice();
    [next[a], next[b]] = [next[b], next[a]];
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma opção ainda. Adicione pelo menos uma.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ option, index }, visibleIndex) => {
            const inputId = `${groupId}-option-${index}`;
            const scoreId = `${groupId}-option-${index}-score`;
            const analyticsId = `${groupId}-option-${index}-analytics`;
            const flaggedId = `${groupId}-option-${index}-flagged`;
            const position = visibleIndex + 1;
            const isOpen = expanded.has(index);
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
                    {/* Per-row "Opções" (metadata) toggle — BETWEEN the colour
                        button and the up-arrow, per the user's spec. Reveals
                        Pontuação + Código + Flagged for this row. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleExpanded(index)}
                      aria-expanded={isOpen}
                      aria-controls={`${inputId}-options`}
                      aria-label={
                        isOpen
                          ? `Ocultar opções da opção ${position}`
                          : `Mostrar opções da opção ${position}`
                      }
                      className={cn(
                        option.flagged && "text-primary",
                        isOpen && "bg-accent text-accent-foreground",
                      )}
                    >
                      <Settings2 aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(visibleIndex, -1)}
                      disabled={visibleIndex === 0}
                      aria-label={`Mover a opção ${position} para cima`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(visibleIndex, 1)}
                      disabled={visibleIndex === rows.length - 1}
                      aria-label={`Mover a opção ${position} para baixo`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAt(index)}
                      disabled={rows.length === 1}
                      aria-label={`Remover a opção ${position}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* Progressive disclosure: Pontuação + Código + Flagged. Hidden
                    by default (label-only stays clean); the values persist in
                    `options` state + still emit even while collapsed. */}
                {isOpen && (
                  <div
                    id={`${inputId}-options`}
                    className="flex flex-col gap-2.5 border-t border-border/60 pt-2.5 pl-0.5"
                  >
                    <div className="grid grid-cols-2 gap-2">
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
                          defaultValue={
                            option.score === null ? "" : String(option.score)
                          }
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
                          onChange={(e) =>
                            updateAnalyticsCodeAt(index, e.target.value)
                          }
                          placeholder="Ex.: conforme"
                          className="h-8"
                        />
                      </label>
                    </div>

                    {/* Flagged toggle (task #4) — drives opt.flagged; a selected
                        flagged option contributes +1 to __flagged_count__. */}
                    <label
                      htmlFor={flaggedId}
                      className="flex items-center gap-2.5 text-xs text-muted-foreground"
                    >
                      <Checkbox
                        id={flaggedId}
                        checked={option.flagged}
                        onCheckedChange={(c) => updateFlaggedAt(index, c === true)}
                      />
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <Flag
                          aria-hidden="true"
                          className={cn(
                            "size-3.5",
                            option.flagged
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        Marcar como sinalizado
                      </span>
                    </label>
                  </div>
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
