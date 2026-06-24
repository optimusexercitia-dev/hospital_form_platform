"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Settings2, Trash2 } from "lucide-react";

import type { Section } from "@/lib/queries/forms";
import { deleteSection, moveSection } from "@/lib/forms/actions";
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
import { BlockList } from "@/components/forms/block-list";
import { SectionConditionBadge } from "@/components/forms/section-condition-badge";
import { SectionMetaDialog } from "@/components/forms/section-meta-dialog";
import { SectionSettingsDialog } from "@/components/forms/section-settings-dialog";
import { useBuilderAction } from "@/components/forms/use-builder-action";

/**
 * One section in the sectioned (≥2 sections) builder view. Header carries the
 * title (or a neutral placeholder), reorder up/down, rename/describe, the
 * settings entry (condition + sign-off), and delete; the body is the section's
 * {@link BlockList}.
 *
 * Anchor rule: the anchor treatment follows POSITION — the FIRST section
 * (`isFirst`) is the anchor regardless of which section was auto-created. It
 * shows the "inicial" badge, falls back to "Seção inicial" when it has no title,
 * has NO condition and NO sign-off (nothing precedes it to reference) and is
 * never deletable (the form must keep ≥1 section), so the settings and delete
 * controls stay hidden for it. Reordering transfers this: the DB keeps the
 * stored `is_default` flag in sync with position 0 (see migration
 * `20260624120000_default_section_tracks_position`), so the server's
 * default-shape CHECK and the position-driven UI always agree.
 */
export function SectionCard({
  section,
  sections,
  index,
  isFirst,
  isLast,
  commissionId,
  imageUrls,
  onBeforeReorder,
}: {
  section: Section;
  sections: Section[];
  index: number;
  isFirst: boolean;
  isLast: boolean;
  commissionId: string;
  imageUrls: Record<string, string>;
  onBeforeReorder: () => void;
}) {
  const { run, isPending, error } = useBuilderAction();
  const [metaOpen, setMetaOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const heading =
    section.title || (isFirst ? "Seção inicial" : "Seção sem título");

  function handleMove(direction: "up" | "down") {
    onBeforeReorder();
    const fd = new FormData();
    fd.set("sectionId", section.id);
    fd.set("direction", direction);
    run(() => moveSection(undefined, fd));
  }

  function handleDelete() {
    const fd = new FormData();
    fd.set("sectionId", section.id);
    run(() => deleteSection(undefined, fd));
  }

  return (
    <section
      data-flip-id={`section-${section.id}`}
      aria-label={heading}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Seção {index + 1}
            </span>
            {isFirst && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                inicial
              </span>
            )}
            <SectionConditionBadge section={section} />
            {section.requiresSignoff && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
                assinatura
              </span>
            )}
          </div>
          <h2
            className={
              section.title
                ? "text-lg font-semibold"
                : "text-lg font-semibold text-muted-foreground italic"
            }
          >
            {heading}
          </h2>
          {section.description && (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              {section.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("up")}
            disabled={isFirst || isPending}
            aria-label={`Mover a seção ${index + 1} para cima`}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleMove("down")}
            disabled={isLast || isPending}
            aria-label={`Mover a seção ${index + 1} para baixo`}
          >
            <ArrowDown aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMetaOpen(true)}
            aria-label="Renomear seção"
          >
            <Pencil aria-hidden="true" />
          </Button>

          {!isFirst && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSettingsOpen(true)}
                aria-label="Configurações da seção (condição e assinatura)"
              >
                <Settings2 aria-hidden="true" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    aria-label="Excluir seção"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir esta seção?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A seção “{heading}” e todos os seus blocos serão removidos
                      definitivamente. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Excluir seção
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <BlockList
        section={section}
        sections={sections}
        commissionId={commissionId}
        imageUrls={imageUrls}
      />

      <SectionMetaDialog
        open={metaOpen}
        onOpenChange={setMetaOpen}
        section={section}
      />

      {!isFirst && (
        <SectionSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          section={section}
          sections={sections}
        />
      )}
    </section>
  );
}
