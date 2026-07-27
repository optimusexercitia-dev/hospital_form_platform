"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { type AxisDraft, blankAxisEntry, mintAxisCode } from "@/lib/forms/matrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * FF-2 (ADR 0089) — the controlled editor for ONE matrix axis: the rows
 * (criteria / severity) or the columns (the shared scale / likelihood).
 *
 * Add, relabel, reweigh, reorder and remove. Deliberately NOT here: any way to
 * change an entry's `code`. A code is the cross-version aggregation key and a
 * BEFORE UPDATE trigger refuses to change it on draft AND published alike
 * (ruling 4), so offering a re-key would be offering an action the database
 * rejects. The code is SHOWN — muted, monospace, read-only — because an author
 * who can see the identity understands why relabelling is free and removal is
 * not; the fix for a typo'd code is remove + add, which the REPLACE semantics of
 * `upsertMatrixAxes` handle in the same call.
 *
 * A code is minted CLIENT-SIDE the moment an entry's label first becomes
 * non-empty (mirroring `OptionsEditor`, BUG-AMV2-002) and then never changes,
 * so the payload the dialog sends is stable from the first keystroke.
 *
 * Presentational + controlled: owns no persistence. The parent
 * ({@link MatrixConfigDialog}) holds both axes and calls the action.
 */
export function MatrixAxesEditor({
  legend,
  description,
  entries,
  onChange,
  weighted = false,
  weightLabel = "Peso",
  addLabel,
  singular,
  placeholder,
  disabled = false,
}: {
  legend: string;
  description?: string;
  entries: AxisDraft[];
  onChange: (next: AxisDraft[]) => void;
  /** `risk_matrix` only — reveals the per-entry numeric weight (ruling 2). */
  weighted?: boolean;
  weightLabel?: string;
  addLabel: string;
  /** pt-BR singular of the axis unit ("linha" / "coluna"), for a11y names. */
  singular: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const groupId = useId();

  /**
   * Mint the entry's stable code as soon as its label becomes non-empty; keep it
   * verbatim on every later rename. An entry loaded from the server already has
   * one and is never re-keyed.
   */
  function updateLabelAt(index: number, label: string) {
    const next = entries.slice();
    const current = next[index];
    const code =
      current.code === "" && label.trim().length > 0
        ? mintAxisCode(
            label,
            entries.filter((_, i) => i !== index).map((e) => e.code).filter(Boolean),
          )
        : current.code;
    next[index] = { ...current, label, code };
    onChange(next);
  }

  function updateWeightAt(index: number, raw: string) {
    const next = entries.slice();
    const trimmed = raw.trim().replace(",", ".");
    const parsed = trimmed === "" ? null : Number(trimmed);
    next[index] = {
      ...next[index],
      weight: parsed !== null && Number.isFinite(parsed) ? parsed : null,
    };
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = entries.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...entries, blankAxisEntry()]);
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {description ? (
        <p className="text-xs text-muted-foreground text-pretty">{description}</p>
      ) : null}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-sm text-muted-foreground">
          Nenhuma {singular} ainda. Adicione ao menos uma.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, index) => {
            const position = index + 1;
            const labelId = `${groupId}-${entry.key}-label`;
            const weightId = `${groupId}-${entry.key}-weight`;
            return (
              <li
                key={entry.key}
                className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-background/40 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Label htmlFor={labelId} className="sr-only">
                    {`Rótulo da ${singular} ${position}`}
                  </Label>
                  <Input
                    id={labelId}
                    value={entry.label}
                    onChange={(e) => updateLabelAt(index, e.target.value)}
                    placeholder={placeholder ?? `${legend} ${position}`}
                    className="h-9 flex-1"
                  />
                  {weighted ? (
                    <>
                      <Label htmlFor={weightId} className="sr-only">
                        {`${weightLabel} da ${singular} ${position}`}
                      </Label>
                      <Input
                        id={weightId}
                        type="text"
                        inputMode="decimal"
                        value={entry.weight === null ? "" : String(entry.weight)}
                        onChange={(e) => updateWeightAt(index, e.target.value)}
                        placeholder={weightLabel}
                        className="h-9 w-20 shrink-0 text-center"
                        aria-invalid={entry.weight === null ? true : undefined}
                      />
                    </>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover a ${singular} ${position} para cima`}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => move(index, 1)}
                      disabled={index === entries.length - 1}
                      aria-label={`Mover a ${singular} ${position} para baixo`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAt(index)}
                      aria-label={`Remover a ${singular} ${position}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {/* The immutable identity, shown read-only. Never an input:
                    changing a code is refused by the database (ruling 4). */}
                {entry.code ? (
                  <p className="pl-0.5 font-mono text-[0.7rem] text-muted-foreground">
                    <span className="sr-only">Código fixo desta {singular}: </span>
                    <span aria-hidden="true">código: </span>
                    {entry.code}
                  </p>
                ) : null}
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
        {addLabel}
      </Button>
    </fieldset>
  );
}
