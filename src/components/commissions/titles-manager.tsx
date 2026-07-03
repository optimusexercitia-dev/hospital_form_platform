"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";

import type { MemberTitle } from "@/lib/commissions/titles";
// Value-import from the `'use server'` actions module directly, not the
// `titles.ts` re-export path — see the note in `title-assign-control.tsx`.
import { deleteMemberTitle, reorderMemberTitles } from "@/lib/commissions/titles-actions";
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
import { useTitleAction } from "./use-title-action";
import { TitleDefDialog } from "./title-def-dialog";
import { TitleBadge } from "./title-badge";

/**
 * Per-commission member-title vocabulary manager (ADR 0051 Decision 6): create /
 * rename / reorder / delete the commission's title list ("Presidente",
 * "Vice-Presidente", "Secretário(a)"…). DISPLAY-ONLY vocabulary — deleting a
 * title clears it from any member (`ON DELETE SET NULL`), never blocking the
 * delete on usage. Mirrors {@link ResultVocabManager}'s up/down reorder + FLIP
 * motion.
 */
export function TitlesManager({
  commissionId,
  titles,
}: {
  commissionId: string;
  titles: MemberTitle[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const { run, isPending, error } = useTitleAction();
  const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLUListElement>();

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= titles.length) return;
    const next = [...titles];
    [next[index], next[target]] = [next[target], next[index]];
    captureBeforeReorder();
    run(() =>
      reorderMemberTitles(
        commissionId,
        next.map((t) => t.id),
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Defina os títulos que podem ser atribuídos aos membros desta comissão
          (ex.: Presidente, Secretário(a)). Títulos são apenas exibidos e não
          concedem permissões.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Novo título
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {titles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum título ainda. Crie o primeiro título desta comissão.
        </p>
      ) : (
        <ul ref={containerRef} className="flex flex-col gap-2">
          {titles.map((title, index) => (
            <li
              key={title.id}
              data-flip-id={`title-${title.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "up")}
                  disabled={index === 0 || isPending}
                  aria-label={`Mover ${title.name} para cima`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => move(index, "down")}
                  disabled={index === titles.length - 1 || isPending}
                  aria-label={`Mover ${title.name} para baixo`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>

              <TitleBadge name={title.name} />

              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <TitleEditButton commissionId={commissionId} title={title} />
                <DeleteTitleButton title={title} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <TitleDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function TitleEditButton({
  commissionId,
  title,
}: {
  commissionId: string;
  title: MemberTitle;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar o título ${title.name}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <TitleDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        title={title}
      />
    </>
  );
}

function DeleteTitleButton({ title }: { title: MemberTitle }) {
  const { run, isPending, error } = useTitleAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Excluir o título ${title.name}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o título &ldquo;{title.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Membros que têm este título deixarão de exibi-lo. Esta ação não
            pode ser desfeita.
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
            onClick={() => run(() => deleteMemberTitle(title.id))}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
