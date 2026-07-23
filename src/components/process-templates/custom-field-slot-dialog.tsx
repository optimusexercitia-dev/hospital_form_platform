"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  CustomFieldDef,
  CustomFieldType,
} from "@/lib/queries/process-templates";
import type { ItemOption } from "@/lib/queries/forms";
import {
  createCustomFieldDef,
  updateCustomFieldDef,
  type ActionState,
  type CustomFieldDefState,
} from "@/lib/process-templates/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { OptionsEditor, blankOption } from "@/components/forms/options-editor";

/** The D3 field-type subset, with pt-BR labels (mirrors `item-type-meta`). */
const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: "short_text", label: "Resposta curta" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "dropdown", label: "Lista suspensa" },
  { value: "multiple_choice", label: "Múltipla escolha" },
];

function isChoiceType(t: CustomFieldType): boolean {
  return t === "dropdown" || t === "multiple_choice";
}

/** Seed the OptionsEditor rows from a def's frozen `{ code, label }` options. */
function seedOptions(def?: CustomFieldDef): ItemOption[] {
  const opts = def?.options ?? [];
  if (opts.length === 0) return [blankOption(0)];
  return opts.map((o, i) => ({
    id: "",
    code: o.code,
    label: o.label,
    color: null,
    score: null,
    analyticsCode: null,
    flagged: false,
    isOther: false,
    position: i,
  }));
}

/**
 * Create / edit a custom-field DEFINITION in the process builder (ADR 0083),
 * mirroring {@link NarrativeSlotDialog} / {@link PhaseSlotDialog}. A field carries a
 * pt-BR label, a type from the D3 subset, an options list for the two single-select
 * types (reusing the form builder's {@link OptionsEditor}), and the `required` +
 * `show_in_list` toggles.
 *
 * The create/update actions are `useActionState`-shaped (FormData), so we assemble
 * the FormData on submit (serializing the controlled options to the `[{code,label}]`
 * JSON the action parses) and run it inside a transition. Draft-only: the shell only
 * mounts this for a draft template, and the action re-enforces draft-only server-side.
 */
export function CustomFieldSlotDialog({
  mode,
  open,
  onOpenChange,
  templateId,
  field,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  /** Required for `edit`; ignored for `create`. */
  field?: CustomFieldDef;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (CustomFieldDefState & ActionState) | null
  >(null);

  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldType, setFieldType] = useState<CustomFieldType>(
    field?.fieldType ?? "short_text",
  );
  const [options, setOptions] = useState<ItemOption[]>(() => seedOptions(field));
  const [required, setRequired] = useState(field?.required ?? false);
  const [showInList, setShowInList] = useState(field?.showInList ?? false);

  // Reset local state each time the dialog opens (render-phase open transition,
  // mirroring the sibling slot dialogs).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setLabel(field?.label ?? "");
      setFieldType(field?.fieldType ?? "short_text");
      setOptions(seedOptions(field));
      setRequired(field?.required ?? false);
      setShowInList(field?.showInList ?? false);
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function changeType(next: CustomFieldType) {
    setFieldType(next);
    // Switching TO a choice type with no rows yet → seed one blank so the editor
    // shows an option to fill (the action requires ≥1 for choice types).
    if (isChoiceType(next) && options.length === 0) {
      setOptions([blankOption(0)]);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    if (mode === "create") formData.set("templateId", templateId);
    else formData.set("fieldId", field?.id ?? "");
    formData.set("label", label.trim());
    formData.set("fieldType", fieldType);
    if (required) formData.set("required", "true");
    if (showInList) formData.set("showInList", "true");
    // Serialize only the two choice types' options as `[{ code, label }]`, dropping
    // blank-label rows; a non-choice type sends no options (the action forbids them).
    if (isChoiceType(fieldType)) {
      const rows = options
        .filter((o) => o.label.trim() !== "")
        .map((o) => ({ code: o.code, label: o.label.trim() }));
      formData.set("options", JSON.stringify(rows));
    }

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCustomFieldDef(undefined, formData)
          : await updateCustomFieldDef(undefined, formData);
      setState(result);
    });
  }

  const showOptions = isChoiceType(fieldType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo campo personalizado" : "Editar campo"}
          </DialogTitle>
          <DialogDescription>
            Descritores administrativos preenchidos ao criar cada caso deste
            processo. Não use para dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {state &&
            !state.ok &&
            !state.fieldErrors?.label &&
            !state.fieldErrors?.fieldType &&
            !state.fieldErrors?.options && (
              <FormBanner tone="error">{state.error}</FormBanner>
            )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Rótulo</span>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={120}
              placeholder="Ex.: Número da Declaração de Óbito"
              aria-invalid={state?.fieldErrors?.label ? true : undefined}
            />
            {state?.fieldErrors?.label && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.label}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <NativeSelect
              className="h-10"
              value={fieldType}
              onChange={(e) => changeType(e.target.value as CustomFieldType)}
              aria-invalid={state?.fieldErrors?.fieldType ? true : undefined}
            >
              {FIELD_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
            {state?.fieldErrors?.fieldType && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.fieldType}
              </span>
            )}
          </label>

          {showOptions && (
            <div className="flex flex-col gap-1.5">
              <OptionsEditor
                options={options}
                onChange={setOptions}
                disabled={isPending}
                legend="Opções"
              />
              {state?.fieldErrors?.options && (
                <span role="alert" className="text-sm font-medium text-destructive">
                  {state.fieldErrors.options}
                </span>
              )}
            </div>
          )}

          <fieldset className="flex flex-col gap-2.5 text-sm">
            <legend className="mb-1 font-medium">Comportamento</legend>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={required}
                onCheckedChange={(c) => setRequired(c === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span>Obrigatório</span>
                <span className="text-xs text-muted-foreground text-pretty">
                  Impede a criação de um caso enquanto o campo estiver em branco.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={showInList}
                onCheckedChange={(c) => setShowInList(c === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col">
                <span>Mostrar na lista de casos</span>
                <span className="text-xs text-muted-foreground text-pretty">
                  Exibe o valor como coluna na lista de casos e permite buscá-lo.
                </span>
              </span>
            </label>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Adicionar campo"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
