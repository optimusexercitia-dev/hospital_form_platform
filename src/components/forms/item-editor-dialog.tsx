"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  Item,
  ItemType,
  ImageContent,
  SectionTextContent,
} from "@/lib/queries/forms";
import { addItem, updateItem, type ActionState } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { OptionsEditor } from "@/components/forms/options-editor";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { ImageItemEditor } from "@/components/forms/image-item-editor";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";

const CHOICE_TYPES: ItemType[] = ["multiple_choice", "dropdown", "checkbox"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  commissionId: string;
  imageUrl: string | null;
} & (
  | { mode: "add"; itemType: ItemType; item?: undefined }
  | { mode: "edit"; item: Item; itemType?: undefined }
);

/**
 * Type-specific editor for a block, in "add" or "edit" mode. Dispatches by item
 * type: input items get label + (for choice types) the options editor + required
 * toggle + the optional "Texto de apoio" (`question_explanation`); `section_text`
 * gets the Markdown editor + live sanitized preview; `image` gets the upload UI
 * (alt required, optional caption).
 *
 * The interactive parts (options, Markdown, image) are controlled state synced
 * into hidden form fields, so the whole thing submits as one `addItem`/
 * `updateItem` call. On success it closes and refreshes the builder.
 */
export function ItemEditorDialog(props: Props) {
  const { open, onOpenChange, sectionId, commissionId, imageUrl } = props;
  const itemType: ItemType =
    props.mode === "edit" ? props.item.itemType : props.itemType;
  const existing = props.mode === "edit" ? props.item : null;

  const action = props.mode === "edit" ? updateItem : addItem;
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  // Controlled state for the non-native fields.
  const [options, setOptions] = useState<string[]>(
    existing?.options ?? [""],
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

  const meta = ITEM_TYPE_META[itemType];
  const isChoice = CHOICE_TYPES.includes(itemType);
  const isInput = isChoice || itemType === "free_text";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
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
            !state.fieldErrors?.alt && (
              <FormBanner tone="error">{state.error}</FormBanner>
            )}

          {isInput && (
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
              />
              <FieldError id={labelField.errorId}>
                {state?.fieldErrors?.label}
              </FieldError>
            </Field>
          )}

          {isChoice && (
            <>
              {/* Sync the options array into repeated hidden `option` fields. */}
              {options
                .map((o) => o.trim())
                .filter((o) => o.length > 0)
                .map((opt, i) => (
                  <input key={i} type="hidden" name="option" value={opt} />
                ))}
              <OptionsEditor options={options} onChange={setOptions} />
            </>
          )}

          {isInput && (
            <>
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

              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  name="required"
                  value="on"
                  defaultChecked={existing?.required ?? false}
                />
                Resposta obrigatória
              </label>
            </>
          )}

          {itemType === "section_text" && (
            <Field>
              <FieldLabel htmlFor="markdown-editor">Texto (Markdown)</FieldLabel>
              {/* Sync markdown into the hidden field the action reads. */}
              <input type="hidden" name="markdown" value={markdown} />
              <SectionTextEditor
                value={markdown}
                onChange={setMarkdown}
                textareaId="markdown-editor"
              />
            </Field>
          )}

          {itemType === "image" && (
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
          )}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
