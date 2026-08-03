"use client";

import type { Item, ItemOption, ItemType } from "@/lib/queries/forms";
import {
  DEFAULT_SOURCE_LABELS,
  DEFAULT_SOURCE_TOKENS,
  isDefaultSourceEligible,
  toDefaultSource,
  type DefaultSource,
} from "@/lib/forms/item-tree";
import { Field, FieldDescription, FieldLabel, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeField } from "@/components/ui/time-field";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

/**
 * answer-model-v2 (FE-1, ADR 0046 / P2.4): the builder's per-input "Valor
 * padrão" control. Presentational + controlled — the parent
 * ({@link ItemEditorDialog}) owns the value and syncs it into the hidden
 * `defaultValue`/`defaultSource` fields the `addItem`/`updateItem` actions
 * read (a JSON string: a scalar for text/number/date/time, or an option
 * `code` / `code[]` for choice types — literal mode only; a bare token string
 * for dynamic mode).
 *
 * The literal control shape mirrors the wizard's own input for the same item
 * type, so authoring a default feels identical to filling the question:
 *   - free_text / short_text → text input;
 *   - number → decimal text input (pt-BR comma accepted, stored as JSON number);
 *   - date / time → native date/time input;
 *   - multiple_choice / dropdown → a single-select of the item's options (by
 *     code), plus a "Nenhum" (no default) choice;
 *   - checkbox → a set of checkboxes, one per option (by code).
 *
 * FF-4 (ADR 0092 rulings 5/6): a second, DYNAMIC mode resolves one of five
 * PHI-free tokens (today's/draft-start date, draft-start time, the filling
 * user's name/e-mail, the commission's name) instead of a stored literal — see
 * {@link DefaultConfig}.
 */

export type DefaultValue = string | number | boolean | string[] | null;

const NONE_VALUE = "__none__";

/**
 * FF-4 (ADR 0092 rulings 5/6) — the exclusive default-config union: an item
 * carries a literal default, a dynamic one, or neither, NEVER a combination
 * (a DB CHECK enforces this at write time). Modeled as a discriminated union
 * rather than two sibling nullable props (`defaultValue` + `defaultSource`)
 * so the exclusivity ruling 6 requires is a TYPE INVARIANT this component
 * cannot violate — the caller cannot construct a state that holds both, which
 * is the `vercel-composition-patterns` guidance against paired-nullable props
 * whose mutual exclusivity would otherwise be a convention someone forgets.
 */
export type DefaultConfig =
  | { kind: "none" }
  | { kind: "literal"; value: DefaultValue }
  | { kind: "dynamic"; source: DefaultSource };

const MODE_OPTIONS: SegmentedOption<"none" | "literal" | "dynamic">[] = [
  { value: "none", label: "Nenhum" },
  { value: "literal", label: "Valor fixo" },
  { value: "dynamic", label: "Valor dinâmico" },
];

export function DefaultValueEditor({
  itemType,
  options,
  config,
  onChange,
}: {
  itemType: ItemType;
  /** The item's current option rows (choice types only). */
  options: ItemOption[];
  config: DefaultConfig;
  onChange: (config: DefaultConfig) => void;
}) {
  // FF-4 — the tokens THIS item type can honour (ruling 6's type gate,
  // `isDefaultSourceEligible`). Every choice type and `number` admits none:
  // no token in the closed vocabulary resolves to an option code or a
  // number, so for those types the mode selector would offer a "Dinâmico"
  // choice that leads nowhere — never rendered, and the control degrades to
  // exactly the literal-only editor this component has always been.
  const eligibleSources = DEFAULT_SOURCE_TOKENS.filter((source) =>
    isDefaultSourceEligible(source, itemType),
  );

  if (eligibleSources.length === 0) {
    return (
      <LiteralValueEditor
        itemType={itemType}
        options={options}
        value={config.kind === "literal" ? config.value : null}
        onChange={(value) =>
          onChange(value === null ? { kind: "none" } : { kind: "literal", value })
        }
        showLabel
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          Valor padrão{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <Segmented
          value={config.kind}
          options={MODE_OPTIONS}
          ariaLabel="Origem do valor padrão"
          onChange={(mode) => {
            // Switching mode REPLACES the config wholesale — this is what
            // makes ruling 6's exclusivity legible rather than merely
            // enforced: picking "Valor fixo" cannot leave a stale dynamic
            // token behind, and vice versa, because there is only ever one
            // `config` to hold either.
            if (mode === "none") onChange({ kind: "none" });
            else if (mode === "literal") onChange({ kind: "literal", value: null });
            else onChange({ kind: "dynamic", source: eligibleSources[0] });
          }}
        />
        <FieldDescription id="default-value-mode-description">
          Um valor fixo é o mesmo para todo mundo; um valor dinâmico é
          calculado na hora em que cada pessoa começa a preencher.
        </FieldDescription>
      </div>

      {config.kind === "literal" ? (
        <LiteralValueEditor
          itemType={itemType}
          options={options}
          value={config.value}
          onChange={(value) => onChange({ kind: "literal", value })}
          showLabel={false}
        />
      ) : null}

      {config.kind === "dynamic" ? (
        <DynamicSourcePicker
          eligibleSources={eligibleSources}
          source={config.source}
          onChange={(source) => onChange({ kind: "dynamic", source })}
        />
      ) : null}
    </div>
  );
}

/** FF-4 — the dynamic-source control: a single token when the type admits
 *  only one (date → `today`, time → `now`), else a select over the eligible
 *  set (the three text tokens share `short_text`/`free_text`). */
function DynamicSourcePicker({
  eligibleSources,
  source,
  onChange,
}: {
  eligibleSources: DefaultSource[];
  source: DefaultSource;
  onChange: (source: DefaultSource) => void;
}) {
  const field = useFieldIds("default-source", { hasDescription: true });

  if (eligibleSources.length === 1) {
    // No real choice to offer — a single-option select would be a dead
    // control. State plainly what it resolves to instead.
    return (
      <p
        id={field.descriptionId}
        className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        Preenchido com <strong className="text-foreground">{DEFAULT_SOURCE_LABELS[eligibleSources[0]]}</strong>{" "}
        no momento em que o preenchimento começa.
      </p>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={field.controlProps.id}>Origem do valor</FieldLabel>
      <NativeSelect
        {...field.controlProps}
        value={source}
        onChange={(e) => onChange(e.target.value as DefaultSource)}
      >
        {eligibleSources.map((token) => (
          <option key={token} value={token}>
            {DEFAULT_SOURCE_LABELS[token]}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription id={field.descriptionId}>
        Preenchido automaticamente no momento em que o preenchimento começa; a
        pessoa pode alterar ou apagar livremente.
      </FieldDescription>
    </Field>
  );
}

/** The literal-value editor, one branch per item type — the ORIGINAL
 *  `DefaultValueEditor` body, parameterized so the FF-4 dynamic-mode wrapper
 *  can nest it without a duplicate "Valor padrão" heading (`showLabel`). */
function LiteralValueEditor({
  itemType,
  options,
  value,
  onChange,
  showLabel,
}: {
  itemType: ItemType;
  options: ItemOption[];
  value: DefaultValue;
  onChange: (value: DefaultValue) => void;
  showLabel: boolean;
}) {
  const ids = useFieldIds("default-value", { hasDescription: true });
  // The control's own `name` attribute is intentionally dropped: its value is
  // submitted via the parent's single `defaultValue` hidden field
  // (JSON-encoded), not as a native form field, so a stray
  // `name="default-value"` would only add confusing, unused FormData.
  const field = {
    controlProps: {
      id: ids.controlProps.id,
      "aria-describedby": ids.controlProps["aria-describedby"],
      "aria-invalid": ids.controlProps["aria-invalid"],
    },
    descriptionId: ids.descriptionId,
  };
  const label = showLabel ? (
    <FieldLabel htmlFor={field.controlProps.id}>
      Valor padrão{" "}
      <span className="font-normal text-muted-foreground">(opcional)</span>
    </FieldLabel>
  ) : null;

  switch (itemType) {
    case "free_text":
      return (
        <Field>
          {label}
          <Textarea
            {...field.controlProps}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
            placeholder="Texto pré-preenchido ao abrir o formulário."
            className="min-h-16"
          />
          <FieldDescription id={field.descriptionId}>
            Preenchido automaticamente enquanto a pergunta não for respondida; a
            pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "short_text":
      return (
        <Field>
          {label}
          <Input
            {...field.controlProps}
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
            placeholder="Texto pré-preenchido ao abrir o formulário."
          />
          <FieldDescription id={field.descriptionId}>
            Preenchido automaticamente enquanto a pergunta não for respondida; a
            pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "number":
      return (
        <Field>
          {label}
          <Input
            {...field.controlProps}
            type="text"
            inputMode="decimal"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                onChange(null);
                return;
              }
              const normalized = raw.replace(",", ".");
              const n = Number(normalized);
              onChange(Number.isFinite(n) ? n : null);
            }}
            placeholder="Ex.: 2 ou 2,5"
          />
          <FieldDescription id={field.descriptionId}>
            Preenchido automaticamente enquanto a pergunta não for respondida; a
            pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "date":
      return (
        <Field>
          {label}
          <Input
            {...field.controlProps}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
            className="w-fit"
          />
          <FieldDescription id={field.descriptionId}>
            Preenchido automaticamente enquanto a pergunta não for respondida; a
            pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "time":
      return (
        <Field>
          {label}
          {/* 24h masked numeric field (type `930` → `09:30`), matching the wizard. */}
          <div className="w-40">
            <TimeField
              id={field.controlProps.id}
              aria-describedby={field.controlProps["aria-describedby"]}
              aria-invalid={field.controlProps["aria-invalid"]}
              value={typeof value === "string" ? value : ""}
              onChange={(next) => onChange(next === "" ? null : next)}
            />
          </div>
          <FieldDescription id={field.descriptionId}>
            Preenchido automaticamente enquanto a pergunta não for respondida; a
            pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "multiple_choice":
    case "dropdown":
      return (
        <Field>
          {label}
          <NativeSelect
            {...field.controlProps}
            value={typeof value === "string" ? value : NONE_VALUE}
            onChange={(e) =>
              onChange(e.target.value === NONE_VALUE ? null : e.target.value)
            }
          >
            <option value={NONE_VALUE}>Nenhum</option>
            {options
              .filter((o) => o.label.trim().length > 0)
              .map((o, i) => (
                <option key={o.code || i} value={o.code}>
                  {o.label}
                </option>
              ))}
          </NativeSelect>
          <FieldDescription id={field.descriptionId}>
            A opção marcada automaticamente enquanto a pergunta não for
            respondida; a pessoa pode alterar livremente.
          </FieldDescription>
        </Field>
      );

    case "checkbox": {
      const selected = Array.isArray(value) ? value : [];
      const cleanOptions = options.filter((o) => o.label.trim().length > 0);
      return (
        <DefaultCheckboxSet
          options={cleanOptions}
          selected={selected}
          onChange={onChange}
          showLabel={showLabel}
        />
      );
    }

    default:
      // Display items (section_text / image) never carry a default.
      return null;
  }
}

function DefaultCheckboxSet({
  options,
  selected,
  onChange,
  showLabel,
}: {
  options: ItemOption[];
  selected: string[];
  onChange: (value: DefaultValue) => void;
  showLabel: boolean;
}) {
  const ids = useFieldIds("default-value-checkbox-set", { hasDescription: true });
  const descriptionId = ids.descriptionId;

  function toggle(code: string, checked: boolean) {
    const set = new Set(selected);
    if (checked) set.add(code);
    else set.delete(code);
    const next = options.map((o) => o.code).filter((c) => set.has(c));
    onChange(next.length === 0 ? null : next);
  }

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={descriptionId}>
      {showLabel ? (
        <legend className="mb-1 text-sm font-medium text-foreground">
          Valor padrão{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </legend>
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Adicione opções para definir um valor padrão.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {options.map((opt, i) => {
            const id = `${ids.controlProps.id}-${i}`;
            const checked = selected.includes(opt.code);
            return (
              <label
                key={opt.code || i}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm transition-colors",
                  "hover:border-primary/40",
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(state) => toggle(opt.code, state === true)}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}
      <FieldDescription id={descriptionId}>
        As opções marcadas automaticamente enquanto a pergunta não for
        respondida; a pessoa pode alterar livremente.
      </FieldDescription>
    </fieldset>
  );
}

/** Present item type for the default-value control (never display items). */
export function supportsDefaultValue(itemType: ItemType): boolean {
  // Display blocks collect nothing; containers collect nothing of their own; and
  // FF-2's matrix types answer in `answer_matrix_cells` / `answer_risk_matrix`
  // rather than in `answers.value`, so `form_items.default_value` — which is a
  // seed for `value` — has nothing to seed. Stated as an explicit exclusion list
  // rather than left to the caller's branch, so the next type that widens the
  // caller does not silently acquire a default-value editor it cannot honour.
  //
  // FF-5 (ADR 0091) adds `reference` to the same list, and this IS the "next
  // type" that comment anticipated: a reference answers in `answer_references`
  // with `answers.value` NULL, so a default would seed a column the type never
  // reads. It also could not be authored coherently — a default target id would
  // be a specific participant/commission/profile frozen into the version, which
  // ruling 4's live-join stance rejects for a stored LABEL and rejects at least
  // as firmly for a stored TARGET.
  return (
    itemType !== "section_text" &&
    itemType !== "image" &&
    itemType !== "group" &&
    itemType !== "repeating_group" &&
    itemType !== "matrix" &&
    itemType !== "risk_matrix" &&
    itemType !== "reference"
  );
}

/** Derive the initial controlled {@link DefaultConfig} from an existing item's
 *  stored `default_value` / `default_source` (ADR 0092 ruling 6 XOR — at most
 *  one is ever populated; `defaultSource` wins if somehow both are, since a
 *  dynamic token is the newer, more specific authoring intent). */
export function initialDefaultConfig(item: Item | null): DefaultConfig {
  if (!item) return { kind: "none" };
  const source = toDefaultSource(item.defaultSource ?? null);
  if (source) return { kind: "dynamic", source };
  const literal = initialDefaultValue(item);
  return literal === null ? { kind: "none" } : { kind: "literal", value: literal };
}

/** Derive the initial literal {@link DefaultValue} from an existing item's
 *  stored `default_value` jsonb (already narrowed to `Json | null` on
 *  {@link Item}). Exported for the zero-eligible-token path, which never
 *  wraps in {@link DefaultConfig}'s dynamic arm. */
export function initialDefaultValue(item: Item | null): DefaultValue {
  if (!item) return null;
  const raw = item.defaultValue;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) {
    return raw as string[];
  }
  return null;
}
