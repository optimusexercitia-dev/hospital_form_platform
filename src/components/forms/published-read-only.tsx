"use client";

import { commissionHref } from "@/lib/routing";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, PencilLine } from "lucide-react";

import type { VersionTree } from "@/lib/queries/forms";
import { startEditFromPublished } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { StatusBadge } from "@/components/forms/status-badge";
import { ReadOnlyTree } from "@/components/forms/read-only-tree";

/**
 * Shown when a form has NO editable draft (the normal state after publishing):
 * the current published version rendered read-only, with an "Editar publicado"
 * CTA. Editing clones the published version into a new draft (or reuses an
 * existing one — ADR 0012) via {@link startEditFromPublished}, then refreshes so
 * the page swaps to the interactive builder. Never a 404 — a published form is
 * always viewable and re-editable (F2 refinement).
 */
export function PublishedReadOnly({
  org,
  slug,
  formId,
  formTitle,
  formDescription,
  commissionName,
  tree,
  imageUrls,
}: {
  /** Org slug for hrefs. */
  org: string;
  slug: string;
  formId: string;
  formTitle: string;
  formDescription: string | null;
  commissionName: string;
  tree: VersionTree | null;
  imageUrls: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleEdit() {
    if (!tree) return;
    setError(null);
    startTransition(async () => {
      const result = await startEditFromPublished(tree.id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível iniciar a edição.");
        return;
      }
      // A draft now exists → the builder page re-renders the interactive shell.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <Link
                href={commissionHref(org, slug, "manage", "forms")}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                ← Formulários
              </Link>
              {tree && <StatusBadge status={tree.status} />}
              {tree && (
                <span className="text-xs text-muted-foreground">
                  v{tree.versionNumber}
                </span>
              )}
            </div>
            <h1 className="text-3xl text-balance">{formTitle}</h1>
            {formDescription && (
              <p className="max-w-prose text-muted-foreground text-pretty">
                {formDescription}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{commissionName}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href={commissionHref(org, slug, "manage", "forms", formId, "versions")}>
                <History aria-hidden="true" />
                Versões
              </Link>
            </Button>
            {tree && (
              <Button
                type="button"
                size="lg"
                onClick={handleEdit}
                disabled={isPending}
              >
                <PencilLine aria-hidden="true" />
                {isPending ? "Abrindo…" : "Editar publicado"}
              </Button>
            )}
          </div>
        </div>

        {error && <FormBanner tone="error">{error}</FormBanner>}
      </header>

      {tree ? (
        <ReadOnlyTree tree={tree} imageUrls={imageUrls} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-muted-foreground">
          Este formulário ainda não tem uma versão publicada.
        </p>
      )}
    </div>
  );
}
