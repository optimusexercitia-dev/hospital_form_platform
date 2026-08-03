"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";

import type {
  FlaggedWhen,
} from "@/lib/queries/conditions";
import type { RequiredIf } from "@/lib/forms/validation-rules";
import type {
  Item,
  ItemOption,
  ItemType,
  ImageContent,
  Section,
  SectionTextContent,
  Visibility,
} from "@/lib/queries/forms";
import { OTHER_OPTION_LABEL } from "@/lib/forms/option-constants";
import { addItem, updateItem, type ActionState } from "@/lib/forms/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormBanner } from "@/components/auth/form-banner";
import { OptionsEditor, blankOption } from "@/components/forms/options-editor";
import { ConditionBuilder } from "@/components/forms/condition-builder";
import {
  newChildConditionTargets,
  newQuestionConditionTargets,
  questionConditionTargets,
} from "@/components/forms/condition-targets";
import { isContainerItem, isMatrixItem, isRepeatingGroup } from "@/lib/forms/item-tree";
import type {
  ParticipantType,
  ReferenceKind,
} from "@/lib/forms/reference-constants";
import { ReferenceConfigEditor } from "@/components/forms/reference-config-editor";
import { describeReferenceConfig } from "@/components/forms/reference-vocabulary";
import {
  type BandDraft,
  toBandDrafts,
  toBandPayload,
  validateBands,
} from "@/lib/forms/matrix";
import { RiskBandsEditor } from "@/components/forms/risk-bands-editor";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { ImageItemEditor } from "@/components/forms/image-item-editor";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { FlaggedWhenEditor } from "@/components/forms/flagged-when-editor";
import {
  DefaultValueEditor,
  initialDefaultConfig,
  supportsDefaultValue,
  type DefaultConfig,
} from "@/components/forms/default-value-editor";

const CHOICE_TYPES: ItemType[] = ["multiple_choice", "dropdown", "checkbox"];
/** Choice types whose options can carry a colour (native `<select>` excluded). */
const COLOR_OPTION_TYPES: ItemType[] = ["multiple_choice", "checkbox"];
const INPUT_TYPES: ItemType[] = [
  ...CHOICE_TYPES,
  "free_text",
  "short_text",
  "number",
  "date",
  "time",
];
/** Types that accept optional min/max bounds (→ `config`). */
const BOUNDED_TYPES: ItemType[] = ["number", "date"];
/** Choice types that may offer the "Outros" open option (→ `config.allowOther`). */
const ALLOW_OTHER_TYPES: ItemType[] = ["multiple_choice", "checkbox"];
/** Free-text types that accept optional min/max CHARACTER limits (→ `config`). */
const TEXT_LENGTH_TYPES: ItemType[] = ["free_text", "short_text"];
/** Types that accept a self-referential "Flagged If" (→ `config.flaggedWhen`). */
const FLAGGED_WHEN_TYPES: ItemType[] = ["number", "date", "time"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  /** The full ordered section tree, for computing condition targets. */
  sections: Section[];
  commissionId: string;
  imageUrl: string | null;
  /**
   * FF-1 — the CONTAINER this block is being added into (add mode only). Drives
   * the hidden `parentItemId` routing field and narrows the condition-target
   * list to what ADR 0087 ruling 2 permits from inside that container.
   */
  parentItem?: { id: string; label: string | null };
} & (
  | { mode: "add"; itemType: ItemType; item?: undefined }
  | { mode: "edit"; item: Item; itemType?: undefined }
);

/**
 * Type-specific editor for a block, in "add" or "edit" mode (the add/edit-a-block
 * dialog). Dispatches by item type; the interactive parts (options, min/max,
 * length limits, "Outros" toggle, "Flagged If", condition, Markdown, image) are
 * controlled state synced into hidden form fields, so the whole thing submits as
 * one `addItem`/`updateItem` call. On success it closes and refreshes the builder.
 *
 * Layout (task #4, per docs/design/form_question_dialog_design.md): a two-column
 * shell for INPUT types — LEFT "Conteúdo" (what the question is: enunciado,
 * opções, limites, "Flagged If", texto de apoio) and RIGHT "Comportamento" (how it
 * behaves: valor padrão, obrigatória, aparência condicional) — inside a `max-w-4xl`
 * dialog with a sticky header (+ type-icon chip), a scrollable body, and a sticky
 * footer. Display types (`section_text`/`image`) stay single-column in a `max-w-xl`
 * dialog. The redesign is LAYOUT-ONLY: every hidden-field contract, the
 * useActionState wiring, `effectiveDefaultConfig`, the success effect, submit-label
 * states, and the a11y wiring are preserved exactly (design doc §0).
 */
export function ItemEditorDialog(props: Props) {
  const {
    open,
    onOpenChange,
    sectionId,
    sections,
    commissionId,
    imageUrl,
    parentItem,
  } = props;
  const itemType: ItemType =
    props.mode === "edit" ? props.item.itemType : props.itemType;
  const existing = props.mode === "edit" ? props.item : null;

  const action = props.mode === "edit" ? updateItem : addItem;
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  const isChoice = CHOICE_TYPES.includes(itemType);
  // FF-2 (ADR 0089) — the two MATRIX types are QUESTIONS: they carry a label, a
  // question_key, help text, a visibility condition and (ruling 3) a `required`
  // flag, so they share the two-column question shell. What they do NOT share is
  // everything that presumes a scalar `answers.value`: no options, no bounds, no
  // default value, no "Flagged If". Their grid is authored in the separate
  // `MatrixConfigDialog` (a different write — `upsert_matrix_axes`), so the only
  // matrix-specific control HERE is the risk band list, which is plain `config`
  // exactly like `flaggedWhen` and `minInstances`.
  const isMatrix = isMatrixItem(itemType);
  const isRisk = itemType === "risk_matrix";
  const isInput = INPUT_TYPES.includes(itemType);
  // FF-5 (ADR 0091) — `reference` is a QUESTION in exactly the sense this shell
  // means: label, question_key, help text, a visibility condition, and — as of
  // this phase — `required` + `required_if` (the `form_items_input_vs_display`
  // arm was relaxed to be byte-identical to the matrix arm, ADR 0086 ruling 4).
  //
  // ⚠ This inclusion is load-bearing, not cosmetic. `isQuestion` gates the WHOLE
  // two-column body: the enunciado field, the "Resposta obrigatória" checkbox,
  // the `required_if` builder and the `visibleWhen` builder all live inside it.
  // Leaving `reference` out would render a dialog with a routing field, a footer
  // and nothing else — a block that cannot be labelled, cannot be made required,
  // and would fail the DB's own `label is not null` arm on save. That is FF-3's
  // walk-skip bug in its authoring form, so it is asserted here rather than
  // assumed: what a type shares with the shell is the shell's question-ness, not
  // its scalar-ness.
  const isReference = itemType === "reference";
  /** Types rendered in the two-column "Conteúdo / Comportamento" shell. */
  const isQuestion = isInput || isMatrix || isReference;
  // FF-1 — CONTAINER editing. A container collects no answer, so it has no
  // options, no default value and no `required` flag: a repeating group's
  // required-ness IS `config.minInstances` (BE-0 contract). It keeps a label
  // (the DB arm requires one), optional support text, and its own condition.
  const isContainer = isContainerItem(itemType);
  const isRepeating = isRepeatingGroup(itemType);
  const colorable = COLOR_OPTION_TYPES.includes(itemType);
  const isBounded = BOUNDED_TYPES.includes(itemType);
  const allowsOther = ALLOW_OTHER_TYPES.includes(itemType);
  const hasLengthLimits = TEXT_LENGTH_TYPES.includes(itemType);
  const hasFlaggedWhen = FLAGGED_WHEN_TYPES.includes(itemType);

  // Controlled state for the non-native fields.
  const [options, setOptions] = useState<ItemOption[]>(
    existing?.options ?? [blankOption(0)],
  );
  const [minBound, setMinBound] = useState<string>(
    boundToString(existing?.config?.min),
  );
  const [maxBound, setMaxBound] = useState<string>(
    boundToString(existing?.config?.max),
  );
  // free_text/short_text character-length limits (→ config.minLength/maxLength).
  const [minLength, setMinLength] = useState<string>(
    lengthToString(existing?.config?.minLength),
  );
  const [maxLength, setMaxLength] = useState<string>(
    lengthToString(existing?.config?.maxLength),
  );
  // "Incluir opção 'Outros'" (multiple_choice/checkbox → config.allowOther).
  const [allowOther, setAllowOther] = useState<boolean>(
    existing?.config?.allowOther === true,
  );
  // "Flagged If" (number/date/time → config.flaggedWhen).
  const [flaggedWhen, setFlaggedWhen] = useState<FlaggedWhen | null>(
    existing?.config?.flaggedWhen ?? null,
  );
  // FF-5 — the reference LANE (→ config.referenceKind). Defaults to
  // `participant`, matching the column default the server applies, so a block
  // saved without touching this control behaves identically either way.
  const [referenceKind, setReferenceKind] = useState<ReferenceKind>(
    existing?.config?.referenceKind ?? "participant",
  );
  // FF-5 — the allowed participant types (→ config.participantTypes). An EMPTY
  // array is the "all types" state: both an absent key and an empty array mean
  // the same thing server-side, so there is no third state to keep consistent.
  const [participantTypes, setParticipantTypes] = useState<ParticipantType[]>(
    existing?.config?.participantTypes ?? [],
  );
  // FF-1 — repeating-group cardinality (→ config.minInstances/maxInstances).
  const [minInstances, setMinInstances] = useState<string>(
    lengthToString(existing?.config?.minInstances),
  );
  const [maxInstances, setMaxInstances] = useState<string>(
    lengthToString(existing?.config?.maxInstances),
  );
  // The per-question conditional-appearance rule (null = always visible).
  const [visibleWhen, setVisibleWhen] = useState<Visibility | null>(
    existing?.visibleWhen ?? null,
  );
  // FF-3 (ADR 0090 ruling 4) — `required_if`: required only when this condition
  // holds. A SINGLE bare condition, never a group (the column's CHECK runs
  // `app.is_valid_condition`, which reads `question_key`/`op` at the top level),
  // which is what the builder's `required` context emits.
  const [requiredIf, setRequiredIf] = useState<RequiredIf | null>(
    existing?.requiredIf ?? null,
  );
  // answer-model-v2 (FE-1) + FF-4 (ADR 0092 rulings 5/6): the per-input
  // default — literal, dynamic, or none. A discriminated union rather than a
  // `DefaultValue` + `DefaultSource | null` pair so the two can never both be
  // set in this component's own state (see `DefaultConfig`'s doc comment).
  const [defaultConfig, setDefaultConfig] = useState<DefaultConfig>(
    initialDefaultConfig(existing),
  );
  // FF-2 — `risk_matrix` score→band mapping (→ config.riskBands). Held as
  // drafts (string `minScore` buffers) and serialized sorted on submit.
  const [riskBands, setRiskBands] = useState<BandDraft[]>(() =>
    toBandDrafts(existing?.config?.riskBands),
  );
  // Derived during render, never an effect: the hidden field and the submit gate
  // must agree with the CURRENT band list on the same frame the author edits it.
  const bandError = isRisk && riskBands.length > 0 ? validateBands(riskBands) : null;
  const [markdown, setMarkdown] = useState<string>(
    existing?.content && itemType === "section_text"
      ? (existing.content as SectionTextContent).markdown
      : "",
  );
  // True while an image upload is in flight — blocks submit so we never persist
  // a stale/previous storage path.
  const [imageUploading, setImageUploading] = useState(false);
  const imageContent =
    existing?.content && itemType === "image"
      ? (existing.content as ImageContent)
      : null;
  const [imageState, setImageState] = useState<{
    storagePath: string;
    alt: string;
    caption: string;
    previewUrl: string | null;
  }>({
    storagePath: imageContent?.storage_path ?? "",
    alt: imageContent?.alt ?? "",
    caption: imageContent?.caption ?? "",
    previewUrl: imageUrl,
  });

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // Derive (not effect-prune) a default value stripped of any option code no
  // longer present once the author renames/removes options in this same editing
  // session (a code only changes identity by removal — renaming a label keeps the
  // code). Choice types only; scalar defaults are unaffected by option edits.
  // Computed during render so it's always in sync with the live `options` state,
  // with no cascading setState-in-effect render. A DYNAMIC config passes through
  // untouched — a token is never an option code, so option edits never affect it.
  const effectiveDefaultConfig = useMemo<DefaultConfig>(() => {
    if (defaultConfig.kind !== "literal" || !isChoice) return defaultConfig;
    const value = defaultConfig.value;
    if (value === null) return defaultConfig;
    const codes = new Set(
      options.filter((o) => o.label.trim().length > 0).map((o) => o.code),
    );
    if (Array.isArray(value)) {
      const kept = value.filter((c) => codes.has(c));
      return { kind: "literal", value: kept.length === 0 ? null : kept };
    }
    if (typeof value === "string") {
      return { kind: "literal", value: codes.has(value) ? value : null };
    }
    return defaultConfig;
  }, [isChoice, options, defaultConfig]);

  const meta = ITEM_TYPE_META[itemType];

  // Eligible condition targets (input questions strictly earlier in document
  // order). In "edit" mode, earlier than the item; in "add" mode, the new block
  // appends at the end of its scope so every existing input there is earlier.
  //
  // FF-1 (ADR 0087 ruling 2): the list is a function of the ITEM being edited,
  // not of its section alone — a child of a repeating group may reference an
  // earlier SAME-INSTANCE sibling (inside-out), while nothing outside a repeating
  // group may reference its children at all (outside-in is rejected at publish by
  // `validate_visible_when`). The picker simply never offers what the validator
  // would refuse.
  const conditionTargets =
    props.mode === "edit"
      ? questionConditionTargets(sections, existing!.sectionId, existing!.id)
      : parentItem
        ? newChildConditionTargets(sections, parentItem.id)
        : newQuestionConditionTargets(sections, sectionId);

  // FF-1 (ADR 0087 ruling 4) — `form_items_conditional_not_required` is DROPPED
  // platform-wide, so "obrigatória" is now offered BESIDE a visibility condition.
  // The semantics the un-deadened `app.response_required_complete` branch
  // implements: visibility wins — a required item hidden by its own condition
  // does not block submit. Authoring "se tipo = medicação, o nome é obrigatório"
  // is the ordinary case FF-1 exists to support.
  const isConditional = visibleWhen !== null;

  const labelField = useFieldIds("label", {
    hasError: Boolean(state?.fieldErrors?.label),
  });
  const explanationField = useFieldIds("questionExplanation", {
    hasDescription: true,
  });
  const altField = useFieldIds("alt", {
    hasError: Boolean(state?.fieldErrors?.alt),
  });

  const titleText =
    props.mode === "edit" ? `Editar ${meta.label.toLowerCase()}` : meta.label;
  const descriptionText = isContainer
    ? isRepeating
      ? "Defina o título, quantas repetições são permitidas e quando o grupo aparece."
      : "Defina o título do grupo e quando ele aparece. As perguntas são adicionadas dentro dele."
    : isReference
      ? "Defina o enunciado e o que esta pergunta referencia. A resposta é um vínculo com um registro, não um texto digitado."
      : isRisk
      ? "Defina o enunciado e as faixas de pontuação. A severidade, a probabilidade e os pesos são definidos em “Severidade e probabilidade”."
      : isMatrix
        ? "Defina o enunciado desta matriz. As linhas e as colunas são definidas em “Linhas e colunas”, no bloco."
        : isInput
          ? "Defina o enunciado, as opções de resposta e quando esta pergunta aparece."
          : "Configure o conteúdo deste bloco do formulário.";

  // Non-empty option labels (with their metadata) → repeated hidden fields. The
  // reserved "Outros" row is never in `options` (OptionsEditor hides it; the
  // author never authors it), so it is never emitted here either.
  const cleanOptions = options.filter((o) => o.label.trim().length > 0);

  // Live footer summary (design doc §5).
  const summaryParts: string[] = [];
  if (isChoice) {
    summaryParts.push(
      `${cleanOptions.length} ${cleanOptions.length === 1 ? "opção" : "opções"}`,
    );
  }
  if (isRepeating) {
    const min = minInstances.trim();
    const max = maxInstances.trim();
    if (min || max) {
      summaryParts.push(
        max ? `${min || 0}–${max} repetições` : `mínimo ${min} repetições`,
      );
    }
  }
  if (isMatrix && props.mode === "edit") {
    const rowCount = (existing?.matrixRows ?? []).length;
    const colCount = (existing?.matrixColumns ?? []).length;
    summaryParts.push(`${rowCount} × ${colCount}`);
  }
  if (isRisk && riskBands.length > 0) {
    summaryParts.push(
      `${riskBands.length} ${riskBands.length === 1 ? "faixa" : "faixas"}`,
    );
  }
  if (isReference) {
    summaryParts.push(describeReferenceConfig(referenceKind, participantTypes));
  }
  if (isConditional) summaryParts.push("condicional");
  if (requiredIf !== null) summaryParts.push("obrigatória condicional");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0",
          isQuestion ? "sm:max-w-4xl" : "sm:max-w-xl",
        )}
      >
        {/* HEADER (sticky) — type-icon chip + title/description. */}
        <DialogHeader className="flex-row items-start gap-3 border-b border-border px-6 py-5">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"
          >
            <meta.Icon className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
              {meta.label}
            </span>
            <DialogTitle>{titleText}</DialogTitle>
            <DialogDescription>
              {parentItem
                ? `Dentro do grupo “${parentItem.label ?? "sem título"}”. ${descriptionText}`
                : descriptionText}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          {/* BODY (scrolls). */}
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* Routing fields. */}
            {props.mode === "edit" ? (
              <input type="hidden" name="itemId" value={existing!.id} />
            ) : (
              <>
                <input type="hidden" name="sectionId" value={sectionId} />
                <input type="hidden" name="itemType" value={itemType} />
                {/* FF-1: routes the new block INSIDE a container. Absent for a
                    top-level block. The item's own type can never be a container
                    here — AddBlockMenu does not offer one in child mode, and
                    `addItem` refuses it (depth cap, ruling 1). */}
                {parentItem ? (
                  <input
                    type="hidden"
                    name="parentItemId"
                    value={parentItem.id}
                  />
                ) : null}
              </>
            )}

            {/* Non-field error (success closes the dialog). */}
            {state &&
            !state.ok &&
            !state.fieldErrors?.label &&
            !state.fieldErrors?.alt ? (
              <FormBanner tone="error">{state.error}</FormBanner>
            ) : null}

            {isQuestion ? (
              <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
                {/* ── LEFT: Conteúdo ─────────────────────────────── */}
                <section
                  aria-label="Conteúdo"
                  className="flex flex-col gap-4"
                >
                  <GroupEyebrow label="Conteúdo" />

                  <Field>
                    <FieldLabel htmlFor={labelField.controlProps.id}>
                      Enunciado da pergunta
                    </FieldLabel>
                    <Input
                      {...labelField.controlProps}
                      type="text"
                      defaultValue={existing?.label ?? ""}
                      placeholder={
                        isReference
                          ? "Ex.: Profissional responsável pela conduta"
                          : isRisk
                            ? "Ex.: Classifique o risco do achado"
                            : isMatrix
                              ? "Ex.: Avalie cada critério de conformidade"
                              : "Ex.: A higienização das mãos foi realizada?"
                      }
                      required
                      autoFocus
                      className="h-11 text-base"
                    />
                    <FieldError id={labelField.errorId}>
                      {state?.fieldErrors?.label}
                    </FieldError>
                  </Field>

                  {isChoice ? (
                    <>
                      {/* Sync the options array into parallel hidden fields at the
                          SAME index (optionCode / option / optionColor /
                          optionScore / optionAnalyticsCode / optionFlagged). The
                          author never EDITS `code`; an EXISTING option carries its
                          stable `code` back so `updateItem` matches the submitted
                          row to its existing row BY CODE and PRESERVES it — keeping
                          analytics + any condition referencing the code stable
                          across a label rename. A NEW row starts with `code === ""`,
                          but OptionsEditor mints a real code (BUG-AMV2-002) as soon
                          as the author types a label; the server still backfills an
                          empty code. Score = raw number string ("" = none);
                          analytics-code = free-text tag ("" = none); optionFlagged =
                          '1' when flagged, '' otherwise (task #4). */}
                      {cleanOptions.map((opt, i) => (
                        <span key={i} className="contents">
                          <input
                            type="hidden"
                            name="optionCode"
                            value={opt.code ?? ""}
                          />
                          <input
                            type="hidden"
                            name="option"
                            value={opt.label.trim()}
                          />
                          <input
                            type="hidden"
                            name="optionColor"
                            value={colorable ? (opt.color ?? "") : ""}
                          />
                          <input
                            type="hidden"
                            name="optionScore"
                            value={opt.score === null ? "" : String(opt.score)}
                          />
                          <input
                            type="hidden"
                            name="optionAnalyticsCode"
                            value={opt.analyticsCode ?? ""}
                          />
                          <input
                            type="hidden"
                            name="optionFlagged"
                            value={opt.flagged ? "1" : ""}
                          />
                        </span>
                      ))}
                      <OptionsEditor
                        options={options}
                        onChange={setOptions}
                        colorable={colorable}
                      />

                      {/* "Incluir opção 'Outros'" (multiple_choice + checkbox).
                          Only sets config.allowOther — never emits the reserved
                          __other__ code (the backend reconcile manages that row). */}
                      {allowsOther ? (
                        <>
                          <input
                            type="hidden"
                            name="configAllowOther"
                            value={allowOther ? "1" : ""}
                          />
                          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                            <label className="flex items-start gap-2.5 text-sm">
                              <Checkbox
                                checked={allowOther}
                                onCheckedChange={(c) => setAllowOther(c === true)}
                                className="mt-0.5"
                              />
                              <span className="flex flex-col">
                                <span className="font-medium">
                                  Incluir opção “{OTHER_OPTION_LABEL}”
                                </span>
                                <span className="text-xs text-muted-foreground text-pretty">
                                  Acrescenta uma opção aberta ao final; quem
                                  responde pode digitar um valor próprio.
                                </span>
                              </span>
                            </label>
                            {allowOther ? (
                              <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                                <ListPlus
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                                {OTHER_OPTION_LABEL}: ______
                              </p>
                            ) : null}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}

                  {isBounded ? (
                    <fieldset className="grid grid-cols-2 gap-3">
                      <legend className="mb-1 text-sm font-medium text-foreground">
                        Limites{" "}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </legend>
                      {/* Sync into the config fields the action reads. */}
                      <input type="hidden" name="configMin" value={minBound} />
                      <input type="hidden" name="configMax" value={maxBound} />
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">Mínimo</span>
                        <Input
                          type={itemType === "number" ? "number" : "date"}
                          step={itemType === "number" ? "any" : undefined}
                          value={minBound}
                          onChange={(e) => setMinBound(e.target.value)}
                          className="h-10"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">Máximo</span>
                        <Input
                          type={itemType === "number" ? "number" : "date"}
                          step={itemType === "number" ? "any" : undefined}
                          value={maxBound}
                          onChange={(e) => setMaxBound(e.target.value)}
                          className="h-10"
                        />
                      </label>
                    </fieldset>
                  ) : null}

                  {hasLengthLimits ? (
                    <fieldset className="grid grid-cols-2 gap-3">
                      <legend className="mb-1 text-sm font-medium text-foreground">
                        Limites de caracteres{" "}
                        <span className="font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </legend>
                      <input
                        type="hidden"
                        name="configMinLength"
                        value={minLength}
                      />
                      <input
                        type="hidden"
                        name="configMaxLength"
                        value={maxLength}
                      />
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">Mínimo</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={minLength}
                          onChange={(e) => setMinLength(e.target.value)}
                          className="h-10"
                          placeholder="Ex.: 10"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">Máximo</span>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={maxLength}
                          onChange={(e) => setMaxLength(e.target.value)}
                          className="h-10"
                          placeholder="Ex.: 280"
                        />
                      </label>
                    </fieldset>
                  ) : null}

                  {/* FF-2 — the grid itself is NOT authored here. `upsert_matrix_axes`
                      is a separate write with REPLACE semantics keyed on an
                      existing item id, so in "add" mode there is nothing yet to
                      address; the author lands on the block card and opens the
                      axes dialog from there. Saying so beats a disabled control
                      that looks broken. */}
                  {isMatrix ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground text-pretty">
                        {isRisk
                          ? "Os níveis de severidade e de probabilidade e seus pesos são definidos em “Severidade e probabilidade”, no botão de grade do bloco."
                          : "As linhas (critérios) e as colunas (escala) são definidas em “Linhas e colunas”, no botão de grade do bloco."}
                        {props.mode === "add"
                          ? " Adicione o bloco primeiro; a grade é o passo seguinte."
                          : null}
                      </p>
                      {props.mode === "edit" ? (
                        <p className="text-xs text-muted-foreground">
                          Grade atual:{" "}
                          <strong className="text-foreground">
                            {(existing?.matrixRows ?? []).length}
                          </strong>{" "}
                          {(existing?.matrixRows ?? []).length === 1
                            ? "linha"
                            : "linhas"}{" "}
                          ×{" "}
                          <strong className="text-foreground">
                            {(existing?.matrixColumns ?? []).length}
                          </strong>{" "}
                          {(existing?.matrixColumns ?? []).length === 1
                            ? "coluna"
                            : "colunas"}
                          .
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {isRisk ? (
                    <>
                      {/* → config.riskBands, parsed server-side alongside every
                          other config key. Serialized SORTED ascending, which is
                          the order the query layer and every consumer assume. */}
                      <input
                        type="hidden"
                        name="configRiskBands"
                        value={
                          riskBands.length > 0 && bandError === null
                            ? JSON.stringify(toBandPayload(riskBands))
                            : ""
                        }
                      />
                      <RiskBandsEditor bands={riskBands} onChange={setRiskBands} />
                      {bandError ? (
                        <p role="alert" className="text-sm font-medium text-destructive">
                          {bandError}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {isReference ? (
                    <>
                      {/* → config.referenceKind / config.participantTypes,
                          parsed server-side alongside every other config key.
                          The types array is emitted as JSON, and BLANK for the
                          "all types" state — absent and empty mean the same
                          thing to the server, so there is only one way to spell
                          it on the wire. */}
                      <input
                        type="hidden"
                        name="configReferenceKind"
                        value={referenceKind}
                      />
                      <input
                        type="hidden"
                        name="configParticipantTypes"
                        value={
                          referenceKind === "participant" &&
                          participantTypes.length > 0
                            ? JSON.stringify(participantTypes)
                            : ""
                        }
                      />
                      <ReferenceConfigEditor
                        kind={referenceKind}
                        participantTypes={participantTypes}
                        onKindChange={setReferenceKind}
                        onParticipantTypesChange={setParticipantTypes}
                      />
                    </>
                  ) : null}

                  {hasFlaggedWhen ? (
                    <>
                      {/* Serialize config.flaggedWhen into the hidden field the
                          parseConfig layer reads (JSON, blank = none). */}
                      <input
                        type="hidden"
                        name="configFlaggedWhen"
                        value={flaggedWhen ? JSON.stringify(flaggedWhen) : ""}
                      />
                      <FlaggedWhenEditor
                        itemType={
                          itemType as "number" | "date" | "time"
                        }
                        value={flaggedWhen}
                        onChange={setFlaggedWhen}
                      />
                    </>
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor={explanationField.controlProps.id}>
                      Texto de apoio{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </FieldLabel>
                    <Textarea
                      {...explanationField.controlProps}
                      defaultValue={existing?.questionExplanation ?? ""}
                      placeholder="Ajuda exibida abaixo da pergunta enquanto a pessoa responde."
                      className="min-h-16"
                    />
                    <FieldDescription id={explanationField.descriptionId}>
                      Mostrado como texto de ajuda associado à pergunta.
                    </FieldDescription>
                  </Field>
                </section>

                {/* ── RIGHT: Comportamento ───────────────────────── */}
                <section
                  aria-label="Comportamento"
                  className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-5 md:p-6"
                >
                  <GroupEyebrow label="Comportamento" />

                  {/* answer-model-v2 (FE-1) + FF-4 (ADR 0092 rulings 5/6): the
                      per-input default, synced into the hidden `defaultValue`
                      (literal — JSON: scalar, or option code / code[]) and
                      `defaultSource` (dynamic — the bare token string) fields
                      the addItem/updateItem actions read. Exactly one of the
                      two is ever non-blank — `effectiveDefaultConfig`'s union
                      shape makes that true by construction, not by convention. */}
                  {supportsDefaultValue(itemType) ? (
                    <div className="flex flex-col gap-4">
                      <input
                        type="hidden"
                        name="defaultValue"
                        value={
                          effectiveDefaultConfig.kind === "literal" &&
                          effectiveDefaultConfig.value !== null
                            ? JSON.stringify(effectiveDefaultConfig.value)
                            : ""
                        }
                      />
                      <input
                        type="hidden"
                        name="defaultSource"
                        value={
                          effectiveDefaultConfig.kind === "dynamic"
                            ? effectiveDefaultConfig.source
                            : ""
                        }
                      />
                      <DefaultValueEditor
                        itemType={itemType}
                        options={cleanOptions}
                        config={effectiveDefaultConfig}
                        onChange={setDefaultConfig}
                      />
                      <div className="h-px bg-border" />
                    </div>
                  ) : null}

                  {/* Resposta obrigatória. Keep the Checkbox (name="required"
                      value="on") so submission is unchanged — a controlled
                      `checked` forces FALSE (and disables) whenever the question is
                      conditional, so the field never submits `on` for a conditional
                      item (client + wire stay consistent; the server clears it too).
                      When NOT conditional, an undefined `checked` lets it behave as
                      an uncontrolled checkbox seeded by defaultChecked. */}
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2.5 text-sm">
                      <Checkbox
                        name="required"
                        value="on"
                        defaultChecked={existing?.required ?? false}
                      />
                      Resposta obrigatória
                    </label>
                    {isConditional ? (
                      <p className="text-xs text-muted-foreground text-pretty">
                        Obrigatória <strong>apenas quando aparecer</strong>:
                        enquanto a condição acima não for satisfeita, a pergunta
                        fica oculta e não impede o envio.
                      </p>
                    ) : null}
                  </div>

                  <div className="h-px bg-border" />

                  {/* FF-3 — conditional REQUIREDNESS. Distinct from conditional
                      appearance below: this item is always visible, but only
                      mandatory when the condition holds. Visibility still wins
                      unconditionally — a hidden item is never required, whatever
                      this says (ADR 0090 ruling 4). */}
                  <div className="flex flex-col gap-2">
                    {requiredIf !== null ? (
                      <input
                        type="hidden"
                        name="requiredIf"
                        value={JSON.stringify(requiredIf)}
                      />
                    ) : null}
                    <ConditionBuilder
                      context="required"
                      targets={conditionTargets}
                      value={requiredIf}
                      onChange={(next) =>
                        // The `required` context always emits a bare condition
                        // (or null), never the group arm of `Visibility`.
                        setRequiredIf(next as RequiredIf | null)
                      }
                    />
                    <p className="text-xs text-muted-foreground text-pretty">
                      Se “Resposta obrigatória” estiver marcada, a pergunta já é
                      sempre obrigatória e esta condição não muda nada. Uma
                      pergunta oculta nunca é exigida.
                    </p>
                  </div>

                  <div className="h-px bg-border" />

                  {/* Conditional appearance (decision #8 — the shared builder).
                      The serialized rule is sent in the `visibleWhen` field. */}
                  <div className="flex flex-col gap-2">
                    {visibleWhen !== null ? (
                      <input
                        type="hidden"
                        name="visibleWhen"
                        value={JSON.stringify(visibleWhen)}
                      />
                    ) : null}
                    <ConditionBuilder
                      context="question"
                      targets={conditionTargets}
                      value={visibleWhen}
                      onChange={setVisibleWhen}
                    />
                  </div>
                </section>
              </div>
            ) : null}

            {/* ── FF-1: CONTAINER (`group` / `repeating_group`) ───────────── */}
            {isContainer ? (
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor={labelField.controlProps.id}>
                    Título do grupo
                  </FieldLabel>
                  <Input
                    {...labelField.controlProps}
                    type="text"
                    defaultValue={existing?.label ?? ""}
                    placeholder={
                      isRepeating
                        ? "Ex.: Medicamento administrado"
                        : "Ex.: Dados da internação"
                    }
                    required
                    autoFocus
                    className="h-11 text-base"
                  />
                  <FieldError id={labelField.errorId}>
                    {state?.fieldErrors?.label}
                  </FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor={explanationField.controlProps.id}>
                    Texto de apoio{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </FieldLabel>
                  <Textarea
                    {...explanationField.controlProps}
                    defaultValue={existing?.questionExplanation ?? ""}
                    placeholder="Orientação exibida no topo do grupo enquanto a pessoa responde."
                    className="min-h-16"
                  />
                  <FieldDescription id={explanationField.descriptionId}>
                    Mostrado como texto de ajuda associado ao grupo.
                  </FieldDescription>
                </Field>

                {isRepeating ? (
                  <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-4">
                    <legend className="px-1 text-sm font-medium text-foreground">
                      Repetições{" "}
                      <span className="font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    </legend>
                    {/* → config.minInstances / config.maxInstances. */}
                    <input
                      type="hidden"
                      name="configMinInstances"
                      value={minInstances}
                    />
                    <input
                      type="hidden"
                      name="configMaxInstances"
                      value={maxInstances}
                    />
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">Mínimo</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={minInstances}
                        onChange={(e) => setMinInstances(e.target.value)}
                        className="h-10"
                        placeholder="Ex.: 1"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">Máximo</span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={maxInstances}
                        onChange={(e) => setMaxInstances(e.target.value)}
                        className="h-10"
                        placeholder="Sem limite"
                      />
                    </label>
                    <p className="col-span-2 text-xs text-muted-foreground text-pretty">
                      O mínimo é verificado no envio, depois que repetições
                      totalmente vazias são descartadas — é assim que um grupo
                      repetível se torna obrigatório. Deixe em branco para não
                      exigir nem limitar.
                    </p>
                  </fieldset>
                ) : null}

                <div className="h-px bg-border" />

                {/* A container's own conditional appearance: ocultar o grupo
                    oculta todas as perguntas dentro dele. */}
                <div className="flex flex-col gap-2">
                  {visibleWhen !== null ? (
                    <input
                      type="hidden"
                      name="visibleWhen"
                      value={JSON.stringify(visibleWhen)}
                    />
                  ) : null}
                  <ConditionBuilder
                    context="question"
                    targets={conditionTargets}
                    value={visibleWhen}
                    onChange={setVisibleWhen}
                  />
                  {isConditional ? (
                    <p className="text-xs text-muted-foreground text-pretty">
                      Quando o grupo estiver oculto, nenhuma pergunta dentro dele
                      é exigida.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {itemType === "section_text" ? (
              <Field>
                <FieldLabel htmlFor="markdown-editor">
                  Texto (Markdown)
                </FieldLabel>
                {/* Sync markdown into the hidden field the action reads. */}
                <input type="hidden" name="markdown" value={markdown} />
                <SectionTextEditor
                  value={markdown}
                  onChange={setMarkdown}
                  textareaId="markdown-editor"
                />
              </Field>
            ) : null}

            {itemType === "image" ? (
              <>
                <input
                  type="hidden"
                  name="storagePath"
                  value={imageState.storagePath}
                />
                <input type="hidden" name="caption" value={imageState.caption} />
                <ImageItemEditor
                  commissionId={commissionId}
                  storagePath={imageState.storagePath}
                  previewUrl={imageState.previewUrl}
                  onUploaded={(storagePath, previewUrl) =>
                    setImageState((s) => ({ ...s, storagePath, previewUrl }))
                  }
                  onUploadingChange={setImageUploading}
                />
                <Field>
                  <FieldLabel htmlFor={altField.controlProps.id}>
                    Texto alternativo
                  </FieldLabel>
                  <Input
                    {...altField.controlProps}
                    type="text"
                    name="alt"
                    value={imageState.alt}
                    onChange={(e) =>
                      setImageState((s) => ({ ...s, alt: e.target.value }))
                    }
                    placeholder="Descreva a imagem para quem usa leitor de tela."
                    required
                  />
                  <FieldError id={altField.errorId}>
                    {state?.fieldErrors?.alt}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="caption">
                    Legenda{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </FieldLabel>
                  <Input
                    id="caption"
                    type="text"
                    value={imageState.caption}
                    onChange={(e) =>
                      setImageState((s) => ({ ...s, caption: e.target.value }))
                    }
                    placeholder="Texto exibido abaixo da imagem."
                  />
                </Field>
              </>
            ) : null}
          </div>

          {/* FOOTER (sticky) — live summary + actions. */}
          <DialogFooter className="items-center gap-3 border-t border-border px-6 py-4 sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {summaryParts.join(" · ")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={isPending || imageUploading || bandError !== null}
              >
                {isPending
                  ? "Salvando…"
                  : imageUploading
                    ? "Enviando imagem…"
                    : props.mode === "edit"
                      ? "Salvar"
                      : "Adicionar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A group eyebrow: a small uppercase label + a hairline (design doc §2). */
function GroupEyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

/** A `config` bound (number → JSON number; date → ISO string) to a text input
 *  value. `null`/absent → empty string. */
function boundToString(bound: number | string | null | undefined): string {
  if (bound === null || bound === undefined) return "";
  return String(bound);
}

/** A `config` length limit (integer) to a text input value; null/absent → "". */
function lengthToString(len: number | null | undefined): string {
  if (len === null || len === undefined) return "";
  return String(len);
}
