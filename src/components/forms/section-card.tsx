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
 * title (or a neutral placeholder for the locked default section), reorder
 * up/down, the settings entry (condition + sign-off), rename/describe, and
 * delete; the body is the section's {@link BlockList}.
 *
 * Default-section lock (lead refinement #2): the default section can never carry
 * a title, condition, or sign-off (DB CHECK `form_sections_default_shape`). So
 * its card shows a fixed "Seção inicial" placeholder and DISABLES rename,
 * settings, and delete (it is the form's anchor section). Only non-default
 * sections expose the full controls.
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

  const isDefault = section.isDefault;
  const heading = isDefault
    ? "Seção inicial"
    : section.title || "Seção sem título";

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
            {isDefault && (
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
              isDefault || section.title
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

          {!isDefault && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setMetaOpen(true)}
                aria-label="Renomear seção"
              >
                <Pencil aria-hidden="true" />
              </Button>
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

      {!isDefault && (
        <>
          <SectionMetaDialog
            open={metaOpen}
            onOpenChange={setMetaOpen}
            section={section}
          />
          <SectionSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            section={section}
          />
        </>
      )}
    </section>
  );
}
