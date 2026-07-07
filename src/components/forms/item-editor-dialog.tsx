"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";

import type {
  FlaggedWhen,
} from "@/lib/queries/conditions";
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
  newQuestionConditionTargets,
  questionConditionTargets,
} from "@/components/forms/condition-targets";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { ImageItemEditor } from "@/components/forms/image-item-editor";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { FlaggedWhenEditor } from "@/components/forms/flagged-when-editor";
import {
  DefaultValueEditor,
  initialDefaultValue,
  supportsDefaultValue,
  type DefaultValue,
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
 * useActionState wiring, `effectiveDefaultValue`, the success effect, submit-label
 * states, and the a11y wiring are preserved exactly (design doc §0).
 */
export function ItemEditorDialog(props: Props) {
  const { open, onOpenChange, sectionId, sections, commissionId, imageUrl } =
    props;
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
  const isInput = INPUT_TYPES.includes(itemType);
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
  // The per-question conditional-appearance rule (null = always visible).
  const [visibleWhen, setVisibleWhen] = useState<Visibility | null>(
    existing?.visibleWhen ?? null,
  );
  // answer-model-v2 (FE-1): the per-input default value (null = none).
  const [defaultValue, setDefaultValue] = useState<DefaultValue>(
    initialDefaultValue(existing),
  );
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
  // with no cascading setState-in-effect render.
  const effectiveDefaultValue = useMemo<DefaultValue>(() => {
    if (!isChoice || defaultValue === null) return defaultValue;
    const codes = new Set(
      options.filter((o) => o.label.trim().length > 0).map((o) => o.code),
    );
    if (Array.isArray(defaultValue)) {
      const kept = defaultValue.filter((c) => codes.has(c));
      return kept.length === 0 ? null : kept;
    }
    if (typeof defaultValue === "string") {
      return codes.has(defaultValue) ? defaultValue : null;
    }
    return defaultValue;
  }, [isChoice, options, defaultValue]);

  const meta = ITEM_TYPE_META[itemType];

  // Eligible condition targets (input questions strictly earlier in document
  // order). In "edit" mode, earlier than the item; in "add" mode, the new item
  // appends at the section end so every existing input is earlier.
  const conditionTargets =
    props.mode === "edit"
      ? questionConditionTargets(sections, existing!.sectionId, existing!.id)
      : newQuestionConditionTargets(sections, sectionId);

  // A conditional question can never be required (decision #9).
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
  const descriptionText = isInput
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
  if (isConditional) summaryParts.push("condicional");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0",
          isInput ? "sm:max-w-4xl" : "sm:max-w-xl",
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
            <DialogDescription>{descriptionText}</DialogDescription>
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
              </>
            )}

            {/* Non-field error (success closes the dialog). */}
            {state &&
            !state.ok &&
            !state.fieldErrors?.label &&
            !state.fieldErrors?.alt ? (
              <FormBanner tone="error">{state.error}</FormBanner>
            ) : null}

            {isInput ? (
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
                      placeholder="Ex.: A higienização das mãos foi realizada?"
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

                  {/* answer-model-v2 (FE-1): the per-input default value, synced
                      into the hidden `defaultValue` field the addItem/updateItem
                      actions read (JSON: scalar, or option code / code[]). */}
                  {supportsDefaultValue(itemType) ? (
                    <div className="flex flex-col gap-4">
                      <input
                        type="hidden"
                        name="defaultValue"
                        value={
                          effectiveDefaultValue === null
                            ? ""
                            : JSON.stringify(effectiveDefaultValue)
                        }
                      />
                      <DefaultValueEditor
                        itemType={itemType}
                        options={cleanOptions}
                        value={effectiveDefaultValue}
                        onChange={setDefaultValue}
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
                        checked={isConditional ? false : undefined}
                        disabled={isConditional}
                      />
                      Resposta obrigatória
                    </label>
                    {isConditional ? (
                      <p className="text-xs text-muted-foreground">
                        Uma pergunta com aparência condicional não pode ser
                        obrigatória.
                      </p>
                    ) : null}
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
                disabled={isPending || imageUploading}
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
