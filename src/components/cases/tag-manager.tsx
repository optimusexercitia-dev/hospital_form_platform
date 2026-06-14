"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import type { CaseTag } from "@/lib/queries/case-tags";
import { archiveCaseTag } from "@/lib/cases/tags-actions";
import { cn } from "@/lib/utils";
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
import { TagDefDialog } from "./tag-def-dialog";
import { TOKEN_STYLES } from "./case-status-badge";
import { useCaseAction } from "./use-case-action";

/**
 * Tag-vocabulary manager (Cases-Extras R3, staff_admin): create / rename /
 * recolour / archive a commission's case tags. Shows the NON-archived set (what
 * `listCaseTags` returns); archiving hides a tag from the picker while existing
 * cases keep showing it.
 */
export function TagManager({
  commissionId,
  tags,
}: {
  commissionId: string;
  tags: CaseTag[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Mantenha um vocabulário controlado de etiquetas para que a agregação
          anual permaneça consistente.
        </p>
        <Button type="button" size="lg" onClick={() => setAddOpen(true)}>
          <Plus aria-hidden="true" />
          Nova etiqueta
        </Button>
      </div>

      {tags.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhuma etiqueta ainda. Crie a primeira etiqueta deste vocabulário.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs"
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  TOKEN_STYLES[tag.colorToken] ?? TOKEN_STYLES.muted,
                )}
              >
                {tag.name}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                <TagEditButton commissionId={commissionId} tag={tag} />
                <ArchiveTagButton tag={tag} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <TagDefDialog
        mode="create"
        open={addOpen}
        onOpenChange={setAddOpen}
        commissionId={commissionId}
      />
    </div>
  );
}

function TagEditButton({
  commissionId,
  tag,
}: {
  commissionId: string;
  tag: CaseTag;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Editar a etiqueta ${tag.name}`}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <TagDefDialog
        mode="edit"
        open={open}
        onOpenChange={setOpen}
        commissionId={commissionId}
        tag={tag}
      />
    </>
  );
}

function ArchiveTagButton({ tag }: { tag: CaseTag }) {
  const { run, isPending, error } = useCaseAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-label={`Arquivar a etiqueta ${tag.name}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar a etiqueta “{tag.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            A etiqueta deixará de aparecer no seletor. Casos que já a possuem
            continuam exibindo-a.
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
            onClick={() => run(() => archiveCaseTag(tag.id))}
          >
            Arquivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
