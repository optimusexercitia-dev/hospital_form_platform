"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Plus, Settings2 } from "lucide-react";

import type { VersionTree } from "@/lib/queries/forms";
import { addSection } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { SectionCard } from "@/components/forms/section-card";
import { BlockList } from "@/components/forms/block-list";
import { FormMetaDialog } from "@/components/forms/form-meta-dialog";
import { PublishButton } from "@/components/forms/publish-button";
import { DeleteDraftButton } from "@/components/forms/delete-draft-button";
import { useBuilderAction } from "@/components/forms/use-builder-action";
import { useFlipReorder } from "@/components/forms/use-flip-reorder";

/**
 * The interactive two-level builder over a form's editable draft. Orchestrates
 * the section/block tree; every mutation persists immediately via its own server
 * action and the view refreshes from the server (no client-side draft buffer).
 *
 * Default-section rule (CLAUDE.md §1): a version whose ONLY section is the
 * default renders as a flat list of blocks with NO section chrome. Once a second
 * section is added (≥2 sections), full section chrome appears — and the default
 * section may now be RENAMED (lead refinement #2), but still has NO condition and
 * NO sign-off and is never deletable, so only those controls stay hidden on its
 * card.
 */
export function BuilderShell({
  slug,
  formId,
  formTitle,
  formDescription,
  commissionId,
  commissionName,
  tree,
  imageUrls,
}: {
  slug: string;
  formId: string;
  formTitle: string;
  formDescription: string | null;
  commissionId: string;
  commissionName: string;
  tree: VersionTree;
  imageUrls: Record<string, string>;
}) {
  const { run, isPending, error } = useBuilderAction();
  const { containerRef, captureBeforeReorder } =
    useFlipReorder<HTMLDivElement>();

  const sections = tree.sections;
  const isFlat = sections.length === 1 && sections[0].isDefault;

  function handleAddSection() {
    captureBeforeReorder();
    const fd = new FormData();
    fd.set("versionId", tree.id);
    run(() => addSection(undefined, fd));
  }

  return (
    <div className="flex flex-col gap-8">
      <BuilderHeader
        slug={slug}
        formId={formId}
        formTitle={formTitle}
        formDescription={formDescription}
        commissionName={commissionName}
        versionNumber={tree.versionNumber}
        versionId={tree.id}
      />

      {error && <FormBanner tone="error">{error}</FormBanner>}

      {isFlat ? (
        // Flat (unsectioned) render — the default section's blocks only, no
        // section chrome. "Adicionar seção" promotes the form to a sectioned one.
        <div className="flex flex-col gap-6">
          <BlockList
            section={sections[0]}
            sections={sections}
            commissionId={commissionId}
            imageUrls={imageUrls}
          />
          <AddSectionButton onClick={handleAddSection} disabled={isPending} />
        </div>
      ) : (
        <div ref={containerRef} className="flex flex-col gap-5">
          {sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              sections={sections}
              index={index}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              commissionId={commissionId}
              imageUrls={imageUrls}
              onBeforeReorder={captureBeforeReorder}
            />
          ))}
          <AddSectionButton onClick={handleAddSection} disabled={isPending} />
        </div>
      )}
    </div>
  );
}

function BuilderHeader({
  slug,
  formId,
  formTitle,
  formDescription,
  commissionName,
  versionNumber,
  versionId,
}: {
  slug: string;
  formId: string;
  formTitle: string;
  formDescription: string | null;
  commissionName: string;
  versionNumber: number;
  versionId: string;
}) {
  const [metaOpen, setMetaOpen] = useState(false);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link
              href={`/c/${slug}/manage/forms`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:rounded focus-visible:outline-none"
            >
              ← Formulários
            </Link>
            <StatusBadge status="draft" />
            <span className="text-xs text-muted-foreground">v{versionNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl text-balance">{formTitle}</h1>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setMetaOpen(true)}
              aria-label="Editar título e descrição"
            >
              <Settings2 aria-hidden="true" />
            </Button>
          </div>
          {formDescription && (
            <p className="max-w-prose text-muted-foreground text-pretty">
              {formDescription}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{commissionName}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href={`/c/${slug}/manage/forms/${formId}/versions`}>
              <History aria-hidden="true" />
              Versões
            </Link>
          </Button>
          <DeleteDraftButton versionId={versionId} slug={slug} formId={formId} />
          <PublishButton versionId={versionId} />
        </div>
      </div>

      <FormMetaDialog
        open={metaOpen}
        onOpenChange={setMetaOpen}
        formId={formId}
        title={formTitle}
        description={formDescription}
      />
    </header>
  );
}

function AddSectionButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="w-fit"
    >
      <Plus aria-hidden="true" />
      Adicionar seção
    </Button>
  );
}
