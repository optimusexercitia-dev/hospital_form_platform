"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, SlidersHorizontal } from "lucide-react";

import type { CustomFieldDef } from "@/lib/queries/process-templates";
import {
  deleteCustomFieldDef,
  reorderCustomFieldDefs,
} from "@/lib/process-templates/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";
import { useNarrativeAction } from "@/components/cases/use-narrative-action";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { CustomFieldSlotDialog } from "./custom-field-slot-dialog";

/** pt-BR label for a custom-field type (reuses the shared builder vocabulary). */
function typeLabel(field: CustomFieldDef): string {
  return ITEM_TYPE_META[field.fieldType].label;
}

/**
 * The template builder's custom-fields section (ADR 0083), placed beside the
 * outcomes / collects-patient controls. Lists the template's `customFields` with
 * add / edit / delete / reorder while the template is a DRAFT (`editable`);
 * once published it renders read-only static rows — mirroring how
 * {@link ProcessOutcomesPicker} yields to {@link PublishedOutcomesCard}.
 *
 * Every mutation persists via its own server action and the route refreshes from
 * the server (no client draft buffer), like the phase/narrative slot controls.
 * Reorder animates via the shared GSAP Flip hook (reduced-motion-safe).
 */
export function CustomFieldsCard({
  templateId,
  fields,
  editable,
}: {
  templateId: string;
  fields: CustomFieldDef[];
  /** Draft → the full editing affordances; otherwise read-only static rows. */
  editable: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useNarrativeAction();
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLUListElement>();

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderCustomFieldDefs(
        templateId,
        next.map((f) => f.id),
      ),
    );
  }

  return (
    <section
      aria-labelledby="custom-fields-heading"
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id="custom-fields-heading"
            className="inline-flex items-center gap-2 text-lg font-semibold"
          >
            <SlidersHorizontal
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Campos personalizados
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Descritores administrativos preenchidos ao criar cada caso deste
            processo (por exemplo, o número da declaração de óbito). Não use para
            dados de paciente.
          </p>
        </div>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden="true" />
            Adicionar campo
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          {editable
            ? "Nenhum campo personalizado ainda. Adicione o primeiro descritor deste processo."
            : "Este processo não coleta campos personalizados."}
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li
              key={field.id}
              data-flip-id={`custom-field-${field.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
            >
              {editable && (
                <div className="flex shrink-0 flex-col">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, "up")}
                    disabled={index === 0 || isPending}
                    aria-label={`Mover ${field.label} para cima`}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => move(index, "down")}
                    disabled={index === fields.length - 1 || isPending}
                    aria-label={`Mover ${field.label} para baixo`}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              )}

              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {field.label}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{typeLabel(field)}</span>
                  {field.required && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-foreground">
                      Obrigatório
                    </span>
                  )}
                  {field.showInList && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-foreground">
                      Na lista
                    </span>
                  )}
                </span>
              </div>

              {editable && (
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                  <EditFieldButton templateId={templateId} field={field} />
                  <DeleteFieldButton field={field} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <CustomFieldSlotDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          templateId={templateId}
        />
      )}
    </section>
  );
}

function EditFieldButton({
  templateId,
  field,
}: {
  templateId: string;
  field: CustomFieldDef;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar o campo ${field.label}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <CustomFieldSlotDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        templateId={templateId}
        field={field}
      />
    </>
  );
}

function DeleteFieldButton({ field }: { field: CustomFieldDef }) {
  const { run, isPending, error } = useNarrativeAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Remover o campo ${field.label}`}
          className="text-muted-foreground hover:text-destructive"
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover o campo “{field.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O campo deixará de ser coletado em novos casos. Casos já criados
            mantêm o valor registrado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => deleteCustomFieldDef(field.id))}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
