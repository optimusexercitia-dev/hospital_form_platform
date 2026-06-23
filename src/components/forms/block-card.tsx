"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  MoveRight,
  Pencil,
  Trash2,
} from "lucide-react";

import type { Item, Section, ImageContent, SectionTextContent } from "@/lib/queries/forms";
import { deleteItem, moveItem, moveItemToSection } from "@/lib/forms/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ITEM_TYPE_META } from "@/components/forms/item-type-meta";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";
import { ItemEditorDialog } from "@/components/forms/item-editor-dialog";
import { ImagePreview } from "@/components/forms/image-preview";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { useBuilderAction } from "@/components/forms/use-builder-action";

/**
 * One block (input or display item) in a section: a compact preview plus its
 * controls — reorder up/down, edit (opens the type-specific editor),
 * "mover para seção" (only when the form has ≥2 sections), and delete. Every op
 * persists via its action and refreshes the view.
 */
export function BlockCard({
  item,
  index,
  isFirst,
  isLast,
  sections,
  currentSectionId,
  commissionId,
  imageUrl,
  onBeforeReorder,
}: {
  item: Item;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  sections: Section[];
  currentSectionId: string;
  commissionId: string;
  imageUrl: string | null;
  onBeforeReorder: () => void;
}) {
  const { run, isPending, error } = useBuilderAction();
  const [editOpen, setEditOpen] = useState(false);

  const meta = ITEM_TYPE_META[item.itemType];
  const otherSections = sections.filter((s) => s.id !== currentSectionId);

  function handleMove(direction: "up" | "down") {
    onBeforeReorder();
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("direction", direction);
    run(() => moveItem(undefined, fd));
  }

  function handleMoveToSection(targetSectionId: string) {
    const fd = new FormData();
    fd.set("itemId", item.id);
    fd.set("targetSectionId", targetSectionId);
    run(() => moveItemToSection(undefined, fd));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("itemId", item.id);
    run(() => deleteItem(undefined, fd));
  }

  return (
    <article
      data-flip-id={`item-${item.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <meta.Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              {meta.label}
            </span>
            <BlockHeadline item={item} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("up")}
            disabled={isFirst || isPending}
            aria-label={`Mover o bloco ${index + 1} para cima`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("down")}
            disabled={isLast || isPending}
            aria-label={`Mover o bloco ${index + 1} para baixo`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="Editar bloco"
          >
            <Pencil aria-hidden="true" />
          </Button>

          {otherSections.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label="Mover bloco para outra seção"
                >
                  <MoveRight aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Mover para a seção</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {otherSections.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => handleMoveToSection(s.id)}
                  >
                    {s.title || (s.isDefault ? "Seção inicial" : "Seção sem título")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label="Excluir bloco"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir este bloco?</AlertDialogTitle>
                <AlertDialogDescription>
                  O bloco será removido definitivamente desta seção. Esta ação
                  não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Excluir bloco
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <BlockPreview item={item} imageUrl={imageUrl} />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <ItemEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        item={item}
        sectionId={currentSectionId}
        sections={sections}
        commissionId={commissionId}
        imageUrl={imageUrl}
      />
    </article>
  );
}

/** The block's primary line — the question label, or the type for display
 *  blocks that have no label. */
function BlockHeadline({ item }: { item: Item }) {
  if (item.label) {
    return (
      <span className="flex items-center gap-1.5 truncate font-medium">
        {item.label}
        {item.required && (
          <span className="text-destructive" aria-label="obrigatória">
            *
          </span>
        )}
      </span>
    );
  }
  return null;
}

/** A compact, faithful preview of the block's content. */
function BlockPreview({
  item,
  imageUrl,
}: {
  item: Item;
  imageUrl: string | null;
}) {
  if (item.questionExplanation) {
    // help text shown muted; rendered as plain text here (it's a short hint).
  }

  if (
    (item.itemType === "multiple_choice" ||
      item.itemType === "dropdown" ||
      item.itemType === "checkbox") &&
    item.options
  ) {
    return (
      <div className="flex flex-col gap-1.5 pl-9">
        {item.questionExplanation && (
          <p className="text-sm text-muted-foreground">
            {item.questionExplanation}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5">
          {item.options.map((opt, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {opt.color && (
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: TOKEN_COLOR_VAR[opt.color] }}
                />
              )}
              {opt.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (item.itemType === "free_text") {
    return (
      <div className="flex flex-col gap-1.5 pl-9">
        {item.questionExplanation && (
          <p className="text-sm text-muted-foreground">
            {item.questionExplanation}
          </p>
        )}
        <div className="h-9 rounded-lg border border-dashed border-border bg-muted/30" />
      </div>
    );
  }

  if (item.itemType === "section_text" && item.content) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 pl-9">
        <MarkdownRenderer
          content={(item.content as SectionTextContent).markdown}
        />
      </div>
    );
  }

  if (item.itemType === "image" && item.content) {
    const content = item.content as ImageContent;
    return (
      <div className="pl-9">
        <ImagePreview
          url={imageUrl}
          alt={content.alt}
          caption={content.caption ?? null}
        />
      </div>
    );
  }

  return null;
}
