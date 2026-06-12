"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Controlled editor for the discrete option list of a choice-type input
 * (`multiple_choice` / `dropdown` / `checkbox`). Add, edit, remove, and reorder
 * (up/down — no drag-and-drop in v1) the option labels.
 *
 * Presentational + controlled: owns no persistence. The parent supplies
 * `options`/`onChange`; persistence happens when the parent item editor calls
 * its server action. Options are plain strings here (the stored value); the
 * backend owns any normalization.
 */
export function OptionsEditor({
  options,
  onChange,
  disabled = false,
  legend = "Opções",
}: {
  options: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  legend?: string;
}) {
  const groupId = useId();

  function updateAt(index: number, value: string) {
    const next = options.slice();
    next[index] = value;
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
    onChange([...options, ""]);
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
              <li key={index} className="flex items-center gap-2">
                <Label htmlFor={inputId} className="sr-only">
                  Opção {position}
                </Label>
                <Input
                  id={inputId}
                  value={option}
                  onChange={(e) => updateAt(index, e.target.value)}
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
