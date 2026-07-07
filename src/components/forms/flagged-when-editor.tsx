"use client";

import type { FlaggedWhen } from "@/lib/queries/conditions";
import type { Json } from "@/lib/types/database";
import type { ItemType } from "@/lib/queries/forms";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TimeField } from "@/components/ui/time-field";

/** The ops a `flaggedWhen` may use (number/date/time; NO `in`). Mirrors the
 *  {@link FlaggedWhen} type + the backend `is_valid_flagged_when` shape. */
const FLAGGED_OPS: FlaggedWhen["op"][] = [
  "gt",
  "gte",
  "lt",
  "lte",
  "equals",
  "not_equals",
];

const OP_LABELS: Record<FlaggedWhen["op"], string> = {
  gt: "for maior que",
  gte: "for maior ou igual a",
  lt: "for menor que",
  lte: "for menor ou igual a",
  equals: "for igual a",
  not_equals: "for diferente de",
};

/**
 * The "Marcar como sinalizado quando" (Flagged If) editor for number/date/time
 * items (task #4). A single self-referential `{ op, value }` condition compared
 * against the item's OWN answer; a satisfied `flaggedWhen` contributes +1 to the
 * phase's `__flagged_count__` aggregate. Controlled — the parent
 * ({@link ItemEditorDialog}) owns `value: FlaggedWhen | null` and serializes it
 * into the hidden `configFlaggedWhen` field the `parseConfig` layer reads
 * (`JSON.stringify({op,value})`, blank = none).
 *
 * The value input is typed to the item: number → numeric text; date → native
 * date; time → the 24h masked {@link TimeField}. Only rendered for
 * number/date/time (the parent gates it).
 */
export function FlaggedWhenEditor({
  itemType,
  value,
  onChange,
}: {
  itemType: Extract<ItemType, "number" | "date" | "time">;
  value: FlaggedWhen | null;
  onChange: (next: FlaggedWhen | null) => void;
}) {
  const enabled = value !== null;
  const op: FlaggedWhen["op"] = value?.op ?? "gt";
  const rawValue = value?.value;
  const stringValue =
    typeof rawValue === "string"
      ? rawValue
      : typeof rawValue === "number"
        ? String(rawValue)
        : "";

  function toggle(on: boolean) {
    onChange(on ? { op, value: coerceValue(itemType, stringValue) } : null);
  }

  function setOp(nextOp: FlaggedWhen["op"]) {
    onChange({ op: nextOp, value: coerceValue(itemType, stringValue) });
  }

  function setValue(next: string) {
    onChange({ op, value: coerceValue(itemType, next) });
  }

  return (
    <fieldset className="flex flex-col gap-2.5">
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(c) => toggle(c === true)}
          className="mt-0.5"
        />
        <span className="flex flex-col">
          <span className="font-medium">Marcar como sinalizado quando…</span>
          <span className="text-xs text-muted-foreground text-pretty">
            Conta +1 no total de itens marcados da fase quando a resposta atende
            à condição.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">A resposta</span>
            <NativeSelect
              className="h-10"
              value={op}
              onChange={(e) => setOp(e.target.value as FlaggedWhen["op"])}
            >
              {FLAGGED_OPS.map((o) => (
                <option key={o} value={o}>
                  {OP_LABELS[o]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">Valor</span>
            {itemType === "time" ? (
              <TimeField
                value={stringValue}
                onChange={(v) => setValue(v)}
                aria-label="Valor da condição de sinalização"
              />
            ) : (
              <Input
                type={itemType === "number" ? "number" : "date"}
                step={itemType === "number" ? "any" : undefined}
                value={stringValue}
                onChange={(e) => setValue(e.target.value)}
                className="h-10"
              />
            )}
          </label>
        </div>
      )}
    </fieldset>
  );
}

/**
 * Coerce the raw text value to the JSON shape the item type stores: number →
 * a JSON number (or the raw string if not yet a finite number, so a partial
 * entry isn't lost); date → ISO string; time → `HH:mm` string. The backend
 * `is_valid_flagged_when` re-validates the shape at publish.
 */
function coerceValue(
  itemType: Extract<ItemType, "number" | "date" | "time">,
  raw: string,
): Json {
  if (itemType === "number") {
    const trimmed = raw.trim().replace(",", ".");
    if (trimmed === "") return "";
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}
