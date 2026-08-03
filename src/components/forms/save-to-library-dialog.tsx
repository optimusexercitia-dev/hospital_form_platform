"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveBlockToLibrary } from "@/lib/forms/actions";
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

/**
 * FF-4 (ADR 0092 ruling 8) — snapshot ONE item subtree (a top-level input
 * item, or a container with its children — never a section, never a child of
 * a container) into the commission's block library. `saveBlockToLibrary` is
 * a DEFINER door (ruling 7): it enforces the ruling-1 write perimeter and the
 * ruling-3 closure check itself, so this dialog does no authorization of its
 * own — it renders whatever pt-BR the door returns.
 *
 * Two failure shapes, rendered differently:
 *   - an ordinary refusal (`result.error` only) → the generic banner;
 *   - the ruling-3 closure refusal (`HC0Q6`, `result.offendingKeys` present)
 *     → the banner PLUS the specific keys, so the author can see exactly
 *     which internal question(s) reach outside the block instead of guessing.
 */
export function SaveToLibraryDialog({
  open,
  onOpenChange,
  itemId,
  itemLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  /** Display-only context for the dialog title ("Salvar “Peso” na biblioteca"). */
  itemLabel: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offendingKeys, setOffendingKeys] = useState<string[] | null>(null);
  const router = useRouter();

  const nameField = useFieldIds("library-name");
  const descriptionField = useFieldIds("library-description");

  function reset() {
    setName("");
    setDescription("");
    setError(null);
    setOffendingKeys(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName === "") return;
    setError(null);
    setOffendingKeys(null);
    startTransition(async () => {
      const result = await saveBlockToLibrary({
        itemId,
        name: trimmedName,
        description: description.trim() === "" ? null : description.trim(),
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar. Tente novamente.");
        setOffendingKeys(result.offendingKeys ?? null);
        return;
      }
      router.refresh();
      handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {itemLabel ? `Salvar “${itemLabel}” na biblioteca` : "Salvar na biblioteca"}
          </DialogTitle>
          <DialogDescription>
            Este bloco fica disponível para reutilizar em qualquer formulário
            desta comissão. Opções, condições internas, matrizes e regras de
            validação são salvas junto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <FormBanner tone="error">
              {error}
              {offendingKeys && offendingKeys.length > 0 ? (
                <>
                  {" "}
                  Perguntas com condição apontando para fora do bloco:{" "}
                  <strong>{offendingKeys.join(", ")}</strong>.
                </>
              ) : null}
            </FormBanner>
          ) : null}

          <Field>
            <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
            <Input
              {...nameField.controlProps}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Dados do paciente"
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
              placeholder="Ajuda quem for reutilizar este bloco a reconhecê-lo."
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
              {isPending ? "Salvando…" : "Salvar na biblioteca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
