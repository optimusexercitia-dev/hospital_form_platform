import type { Item, Section } from "@/lib/queries/forms";
import {
  DATETIME_ORDER_OPS,
  MAX_REGEX_PATTERN_LENGTH,
  VALIDATION_RULE_COVERAGE,
  VALIDATION_RULE_TYPES,
  isValidationRuleAllowed,
  type ItemValidationRule,
  type ValidationConfig,
  type ValidationRuleInput,
  type ValidationRuleType,
  type ValidationSeverity,
} from "@/lib/forms/validation-rules";
import { isRepeatingGroup } from "@/lib/forms/item-tree";

/**
 * FF-3 (ADR 0090) — the PURE half of the validation-rule builder: the draft
 * shape the editor holds, its round trip to the `set_item_validations` payload,
 * and the client-side pre-flight.
 *
 * Plain TS, no React, no `'use client'`, no server-only imports — the same
 * boundary `condition-targets.ts` and `lib/forms/matrix.ts` keep, so the dialog
 * and the unit tests consume one implementation.
 *
 * The vocabulary + coverage come from `@/lib/forms/validation-rules`, which is
 * the pure module the server's `queries/validations.ts` re-exports. Importing
 * the values from there (rather than restating them) is what keeps the picker
 * and the server's coverage trigger from drifting — a pair the author only
 * discovers is out of sync when a save is refused.
 *
 * Every bound here is a MIRROR of a server check, never the authority: the
 * `rule_type` allowlist CHECK, the per-rule config validator, the coverage
 * TRIGGER and the non-blank `message` CHECK all still run. This exists so the
 * author is told at the keyboard instead of after a round trip.
 */

/** A rule being edited. Values are STRING BUFFERS — a half-typed "-" or "" is a
 *  legal intermediate state, so parsing happens at serialization, not on stroke. */
export interface RuleDraft {
  /** Client-only React key. Rules have no author-visible identity (ADR 0090). */
  key: string;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  message: string;
  /** number_range / text_length / date_range lower bound ("" = unbounded). */
  min: string;
  /** number_range / text_length / date_range upper bound ("" = unbounded). */
  max: string;
  /** regex pattern. */
  pattern: string;
  /** regex case-insensitivity (`~*` rather than `~`). */
  caseInsensitive: boolean;
  /** datetime_order comparison. */
  op: (typeof DATETIME_ORDER_OPS)[number];
  /** datetime_order sibling `question_key`. */
  questionKey: string;
}

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `rule-${draftCounter}`;
}

/** Which rule types may attach to this item, in the vocabulary's stable order. */
export function allowedRuleTypes(
  itemType: string,
  parentItemType: string | null,
): ValidationRuleType[] {
  return VALIDATION_RULE_TYPES.filter((t) =>
    isValidationRuleAllowed(t, itemType, parentItemType),
  );
}

/** Does this item accept any rule at all? Containers, display items, matrix,
 *  risk_matrix and reference carry none in v1 (ADR 0090 ruling 2). */
export function itemAcceptsValidations(
  itemType: string,
  parentItemType: string | null,
): boolean {
  return allowedRuleTypes(itemType, parentItemType).length > 0;
}

/** A blank draft of the first type this item allows. */
export function blankDraft(
  itemType: string,
  parentItemType: string | null,
): RuleDraft {
  const [first] = allowedRuleTypes(itemType, parentItemType);
  return {
    key: nextKey(),
    // `first` is defined for every item the editor is reachable from; the
    // fallback keeps this total rather than asserting.
    ruleType: first ?? "number_range",
    severity: "error",
    message: "",
    min: "",
    max: "",
    pattern: "",
    caseInsensitive: false,
    op: "before",
    questionKey: "",
  };
}

/** Persisted rows → drafts, in `position` order, for editing. */
export function toRuleDrafts(
  rules: ItemValidationRule[] | null | undefined,
): RuleDraft[] {
  if (!rules || rules.length === 0) return [];
  return [...rules]
    .sort((a, b) => a.position - b.position)
    .map((rule) => {
      // Each arm reads only the keys its own rule type defines; a config from a
      // different type can never leak across because the source rows are
      // CHECK-validated per type at the database.
      const config = rule.config as Record<string, unknown>;
      return {
        key: nextKey(),
        ruleType: rule.ruleType,
        severity: rule.severity,
        message: rule.message,
        min: scalarToBuffer(config.min),
        max: scalarToBuffer(config.max),
        pattern: typeof config.pattern === "string" ? config.pattern : "",
        caseInsensitive: config.caseInsensitive === true,
        op: DATETIME_ORDER_OPS.includes(
          config.op as (typeof DATETIME_ORDER_OPS)[number],
        )
          ? (config.op as (typeof DATETIME_ORDER_OPS)[number])
          : "before",
        questionKey:
          typeof config.question_key === "string" ? config.question_key : "",
      };
    });
}

function scalarToBuffer(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "";
}

/**
 * Serialize one draft to its `config`. The shape is keyed on `ruleType`, so a
 * buffer belonging to a type the author switched away from is never emitted —
 * switching `regex` → `text_length` must not smuggle a stale `pattern` through.
 */
export function toRuleConfig(draft: RuleDraft): ValidationConfig {
  switch (draft.ruleType) {
    case "number_range": {
      const config: { min?: number; max?: number } = {};
      if (draft.min.trim() !== "") config.min = Number(draft.min);
      if (draft.max.trim() !== "") config.max = Number(draft.max);
      return config;
    }
    case "text_length": {
      const config: { min?: number; max?: number } = {};
      // Character counts are integers; the control is step=1 but a paste can
      // still carry a decimal, so truncate rather than emit a rejected float.
      if (draft.min.trim() !== "") config.min = Math.trunc(Number(draft.min));
      if (draft.max.trim() !== "") config.max = Math.trunc(Number(draft.max));
      return config;
    }
    case "regex":
      return draft.caseInsensitive
        ? { pattern: draft.pattern, caseInsensitive: true }
        : { pattern: draft.pattern };
    case "date_range": {
      const config: { min?: string; max?: string } = {};
      if (draft.min.trim() !== "") config.min = draft.min;
      if (draft.max.trim() !== "") config.max = draft.max;
      return config;
    }
    case "datetime_order":
      return { op: draft.op, question_key: draft.questionKey };
    case "unique_within_group":
      return {};
  }
}

/** The COMPLETE desired rule list as `set_item_validations` expects it.
 *  `position` is the array index — the editor's order IS the stored order. */
export function toRulePayload(drafts: RuleDraft[]): ValidationRuleInput[] {
  return drafts.map((draft, index) => ({
    ruleType: draft.ruleType,
    config: toRuleConfig(draft),
    severity: draft.severity,
    message: draft.message.trim(),
    position: index,
  }));
}

/**
 * Client-side pre-flight over the whole list. Returns a pt-BR sentence naming
 * the offending rule by its 1-based position, or `null` when the list is
 * saveable. Mirrors the server's per-rule config validator + the non-blank
 * `message` CHECK; the server remains the authority.
 */
export function validateRuleDrafts(
  drafts: RuleDraft[],
): RuleDraftProblem | null {
  for (const [index, draft] of drafts.entries()) {
    const message = validateRuleDraft(draft, index + 1);
    if (message) return { index, message };
  }
  return null;
}

/**
 * The first problem found, with the 0-based index of the rule that caused it.
 *
 * m-5b — the index is the point: a banner that says "A regra 2 precisa de…" and
 * nothing else makes a screen-reader user hunt for rule 2. Carrying the index
 * lets the editor put the message INSIDE that rule's card, where anyone
 * navigating the list meets it in place.
 */
export interface RuleDraftProblem {
  /** 0-based position in the draft list. The message says the 1-based one. */
  index: number;
  message: string;
}

/**
 * Pre-flight ONE draft. Split out so the loop above cannot accidentally stop at
 * the first rule: every arm here returns a problem or `null` for this rule
 * alone, and only {@link validateRuleDrafts} decides whether to keep going.
 *
 * `n` is the rule's 1-based position, which is how the editor labels it.
 */
function validateRuleDraft(draft: RuleDraft, n: number): string | null {
  if (draft.message.trim() === "") {
    return `A regra ${n} precisa de uma mensagem: é o texto que a pessoa vê quando a resposta não passa.`;
  }

  switch (draft.ruleType) {
    case "number_range":
    case "text_length": {
      const hasMin = draft.min.trim() !== "";
      const hasMax = draft.max.trim() !== "";
      if (!hasMin && !hasMax) {
        return `A regra ${n} precisa de pelo menos um limite (mínimo ou máximo).`;
      }
      if (hasMin && !Number.isFinite(Number(draft.min))) {
        return `O mínimo da regra ${n} não é um número válido.`;
      }
      if (hasMax && !Number.isFinite(Number(draft.max))) {
        return `O máximo da regra ${n} não é um número válido.`;
      }
      if (draft.ruleType === "text_length") {
        if (hasMin && Number(draft.min) < 0) {
          return `O mínimo de caracteres da regra ${n} não pode ser negativo.`;
        }
        if (hasMax && Number(draft.max) < 0) {
          return `O máximo de caracteres da regra ${n} não pode ser negativo.`;
        }
      }
      if (hasMin && hasMax && Number(draft.min) > Number(draft.max)) {
        return `Na regra ${n}, o mínimo não pode ser maior que o máximo.`;
      }
      return null;
    }
    case "date_range": {
      const hasMin = draft.min.trim() !== "";
      const hasMax = draft.max.trim() !== "";
      if (!hasMin && !hasMax) {
        return `A regra ${n} precisa de pelo menos um limite (mínimo ou máximo).`;
      }
      // ISO date (`YYYY-MM-DD`) and 24h time (`HH:mm`) both sort lexically,
      // which is exactly how both evaluators compare them.
      if (hasMin && hasMax && draft.min > draft.max) {
        return `Na regra ${n}, o limite inicial não pode ser posterior ao final.`;
      }
      return null;
    }
    case "regex": {
      if (draft.pattern.trim() === "") {
        return `A regra ${n} precisa de um padrão.`;
      }
      if (draft.pattern.length > MAX_REGEX_PATTERN_LENGTH) {
        return `O padrão da regra ${n} passa de ${MAX_REGEX_PATTERN_LENGTH} caracteres.`;
      }
      // ⚠ JS-compilability is deliberately NOT a blocking check.
      //
      // It used to be, on the premise that "a pattern JS cannot compile is very
      // likely one Postgres cannot either". That premise is false, and FF-3's
      // Amendment 4 measured exactly how false: of 26 ARE/JS constructs only 13
      // agree. Measured here too, against the live engines — `***=literal` is a
      // valid ARE director (Postgres accepts it AND matches with it) and
      // `new RegExp` THROWS on it. Blocking the save on that refuses a correct
      // rule outright, which is the same dead end Amendment 4 removes at fill
      // time, just relocated to authoring.
      //
      // Since Amendment 4 the TS twin does not evaluate `regex` at all, so JS has
      // no standing to adjudicate a pattern. {@link regexCompilesInJs} lets the
      // editor ADVISE without refusing — see the note beside the pattern field.
      return null;
    }
    case "datetime_order": {
      if (draft.questionKey === "") {
        return `A regra ${n} precisa da pergunta com a qual comparar.`;
      }
      return null;
    }
    case "unique_within_group":
      return null;
  }
}

/**
 * Date/time questions a `datetime_order` rule on `itemId` may compare against.
 *
 * Scope, not document order: unlike a visibility condition, a comparison may
 * point FORWARD ("a data de início deve ser anterior à data de fim" is authored
 * on *início*). What it may NOT cross is an instance boundary — a child of a
 * repeating group compares only against a same-instance sibling, and nothing
 * outside a group may reference a child of one, because with N instances there
 * is no single value. That is the same rule `isConditionTargetInScope` applies
 * to conditions, restated here because the ordering constraint differs.
 */
export function datetimeOrderTargets(
  sections: Section[],
  itemId: string,
): { questionKey: string; label: string }[] {
  const entries: { item: Item; repeatingParentId: string | null }[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      entries.push({ item, repeatingParentId: null });
      const parentId = isRepeatingGroup(item.itemType) ? item.id : null;
      for (const child of item.children) {
        entries.push({ item: child, repeatingParentId: parentId });
      }
    }
  }

  const self = entries.find((entry) => entry.item.id === itemId);
  if (!self) return [];

  return entries
    .filter(
      (entry) =>
        entry.item.id !== itemId &&
        entry.item.questionKey != null &&
        (entry.item.itemType === "date" || entry.item.itemType === "time") &&
        entry.repeatingParentId === self.repeatingParentId,
    )
    .map((entry) => ({
      questionKey: entry.item.questionKey as string,
      label: entry.item.label ?? (entry.item.questionKey as string),
    }));
}

/**
 * The `item_type` of the container holding `itemId`, or `null` when it sits at
 * top level. This is the second half of `unique_within_group`'s coverage —
 * "unique across the instances of its group" is meaningless without a group —
 * and `BlockCard` only knows `isChild`, a boolean that cannot distinguish a
 * plain `group` from a `repeating_group`.
 */
export function parentItemTypeOf(
  sections: Section[],
  itemId: string,
): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children.some((child) => child.id === itemId)) {
        return item.itemType;
      }
    }
  }
  return null;
}

/** pt-BR label for a rule type, given the item it attaches to. */
export function ruleTypeLabel(ruleType: ValidationRuleType): string {
  return RULE_TYPE_LABELS[ruleType];
}

const RULE_TYPE_LABELS: Record<ValidationRuleType, string> = {
  number_range: "Faixa numérica",
  text_length: "Quantidade de caracteres",
  regex: "Formato (expressão regular)",
  date_range: "Intervalo permitido",
  datetime_order: "Ordem em relação a outra pergunta",
  unique_within_group: "Sem repetição entre as repetições",
};

/** One-line pt-BR explanation shown under the type picker. */
export function ruleTypeHint(ruleType: ValidationRuleType): string {
  return RULE_TYPE_HINTS[ruleType];
}

const RULE_TYPE_HINTS: Record<ValidationRuleType, string> = {
  number_range: "O número informado precisa estar entre os limites (inclusive).",
  text_length: "O texto precisa ter a quantidade de caracteres indicada.",
  regex: "O texto precisa casar com o padrão informado.",
  date_range: "O valor precisa estar dentro do intervalo (inclusive).",
  datetime_order:
    "Compara com outra pergunta de data ou hora — dentro de um bloco repetível, com a da mesma repetição.",
  unique_within_group:
    "O valor não pode se repetir entre as repetições preenchidas do bloco.",
};

/** pt-BR labels for the `datetime_order` comparisons. */
export const DATETIME_ORDER_OP_LABELS: Record<
  (typeof DATETIME_ORDER_OPS)[number],
  string
> = {
  before: "deve ser anterior a",
  after: "deve ser posterior a",
  not_before: "não pode ser anterior a",
  not_after: "não pode ser posterior a",
};

/**
 * Does this pattern compile under JavaScript's engine?
 *
 * ADVISORY ONLY. A `false` here does NOT mean the rule is invalid: Postgres ARE
 * accepts constructs JS rejects (`***=`, the literal-string director, is the
 * measured example — Postgres both accepts it and matches with it).
 *
 * It is worth surfacing because a pattern that compiles in NEITHER engine is
 * almost always an authoring typo, and this note reaches the author at the
 * keyboard rather than after a round trip.
 *
 * ⚠ It is NOT the only guard, and an earlier version of this comment said it was.
 * The server refuses a malformed pattern in TWO artifacts, not one:
 *   - `app.validation_config_valid` (the CHECK) validates the pattern's shape and
 *     length and does NOT compile it — which is the part that was known;
 *   - `app.guard_item_validation_row` (a BEFORE INSERT/UPDATE TRIGGER) DOES
 *     compile it, via `'x' ~ (new.config ->> 'pattern')` wrapped in
 *     `exception when others`, and raises `HC0Q2` with a pt-BR message.
 * So a both-engines-invalid pattern cannot store, and no raw `2201B` reaches a
 * filler. The two cases compose: JS throws while PG accepts → this note warns and
 * the save succeeds; both throw → this note warns and the write is refused with
 * `HC0Q2`. Knowing of one artifact where there were two is this phase's signature
 * failure, so the correction is recorded rather than quietly edited away.
 */
export function regexCompilesInJs(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** The bound control's input type for a `date_range` on this item. */
export function dateRangeInputType(itemType: string): "date" | "time" {
  return itemType === "time" ? "time" : "date";
}

/** Exposed so the editor can show the cap alongside the pattern field. */
export { MAX_REGEX_PATTERN_LENGTH, VALIDATION_RULE_COVERAGE };
