"use client";

import { useState } from "react";

import { updateBlockLibraryEntry } from "@/lib/forms/actions";
import type { BlockLibraryEntry } from "@/lib/queries/block-library";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";
import { useBuilderAction } from "@/components/forms/use-builder-action";

/**
 * FF-5 (ADR 0092 ruling 2, BE-7) — rename / re-describe a saved library
 * entry. METADATA ONLY: `updateBlockLibraryEntry` has no way to touch the
 * `snapshot` jsonb, and this dialog offers nothing that implies otherwise —
 * no content preview, no "edit contents" affordance. If what the block
 * CONTAINS needs to change, ruling 2's answer is a new entry
 * (save-to-library again), not an edit here.
 */
export function EditLibraryEntryDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BlockLibraryEntry;
  /** Called after a successful save, so the list can announce the result. */
  onSaved: (name: string) => void;
}) {
  const { run, isPending, error, clearError } = useBuilderAction();
  const [name, setName] = useState(entry.name);
  const [description, setDescription] = useState(entry.description ?? "");

  const nameField = useFieldIds("edit-library-name");
  const descriptionField = useFieldIds("edit-library-description");

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset to the entry's CURRENT saved values, not whatever was left
      // half-typed — reopening later (a different entry, or this one again)
      // must never show a stale draft as if it were saved.
      setName(entry.name);
      setDescription(entry.description ?? "");
      clearError();
    }
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName === "") return;
    run(
      () =>
        updateBlockLibraryEntry({
          libraryEntryId: entry.id,
          name: trimmedName,
          description: description.trim() === "" ? null : description.trim(),
        }),
      {
        onSuccess: () => {
          onSaved(trimmedName);
          handleOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar “{entry.name}”</DialogTitle>
          <DialogDescription>
            Apenas o nome e a descrição podem ser alterados aqui — o
            conteúdo deste bloco não muda. Para atualizar o conteúdo, salve
            uma nova entrada na biblioteca.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? <FormBanner tone="error">{error}</FormBanner> : null}

          <Field>
            <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
            <Input
              {...nameField.controlProps}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={descriptionField.controlProps.id}>
              Descrição{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </FieldLabel>
            <Textarea
              {...descriptionField.controlProps}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16"
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || name.trim() === ""}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
