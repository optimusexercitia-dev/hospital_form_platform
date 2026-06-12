import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getCommissionAccess } from "@/lib/queries/session";
import {
  getSignedAssetUrl,
  getVersionTree,
  listForms,
  listVersions,
  type VersionTree,
} from "@/lib/queries/forms";
import { StatusBadge } from "@/components/forms/status-badge";
import { ReadOnlyTree } from "@/components/forms/read-only-tree";

export const metadata: Metadata = {
  title: "Histórico de versões",
};

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Version history for one form (F6). Coordinator-gated like the rest of the
 * builder. Lists every version (newest first) with its lifecycle state; selecting
 * one (`?v=<id>`) renders it READ-ONLY and version-faithful via {@link ReadOnlyTree}
 * — the way to inspect an archived v1 after v2 is published.
 */
export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; formId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug, formId } = await params;
  const { v } = await searchParams;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const forms = await listForms(access.commission.id);
  const form = forms.find((f) => f.id === formId);
  if (!form) notFound();

  const versions = await listVersions(formId);
  const selectedId =
    v && versions.some((ver) => ver.id === v) ? v : null;
  const tree = selectedId ? await getVersionTree(selectedId) : null;
  const imageUrls = tree ? await resolveImageUrls(tree) : {};

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/c/${slug}/manage/forms/${formId}`}
          className="w-fit text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          ← {form.title}
        </Link>
        <h1 className="text-3xl text-balance">Histórico de versões</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Todas as versões deste formulário. Selecione uma para visualizá-la
          exatamente como foi publicada.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Versões do formulário">
          <ul className="flex flex-col gap-2">
            {versions.map((ver) => {
              const isSelected = ver.id === selectedId;
              return (
                <li key={ver.id}>
                  <Link
                    href={`/c/${slug}/manage/forms/${formId}/versions?v=${ver.id}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none ${
                      isSelected
                        ? "border-primary/50 bg-accent/40"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">
                        Versão {ver.versionNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ver.publishedAt
                          ? `Publicada em ${DATE_FMT.format(new Date(ver.publishedAt))}`
                          : "Não publicada"}
                      </span>
                    </span>
                    <StatusBadge status={ver.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-label="Visualização da versão" className="min-w-0">
          {tree ? (
            <ReadOnlyTree tree={tree} imageUrls={imageUrls} />
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center text-muted-foreground">
              Selecione uma versão à esquerda para visualizá-la.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

/** Resolve a `{ storage_path → signed URL }` map for the version's image blocks. */
async function resolveImageUrls(
  tree: VersionTree,
): Promise<Record<string, string>> {
  const paths = new Set<string>();
  for (const section of tree.sections) {
    for (const item of section.items) {
      if (item.itemType === "image" && item.content) {
        const path = (item.content as { storage_path?: string }).storage_path;
        if (path) paths.add(path);
      }
    }
  }
  const entries = await Promise.all(
    [...paths].map(
      async (path) => [path, await getSignedAssetUrl(path)] as const,
    ),
  );
  const map: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) map[path] = url;
  }
  return map;
}
