import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import {
  getEditableDraftTree,
  getVersionTree,
  listForms,
  listVersions,
  getSignedAssetUrl,
} from "@/lib/queries/forms";
import { BuilderShell } from "@/components/forms/builder-shell";
import { PublishedReadOnly } from "@/components/forms/published-read-only";

export const metadata: Metadata = {
  title: "Construtor de formulários",
};

/**
 * Two-level form builder for one form's editable draft.
 *
 * Coordinator-gated (mirrors the list/members pages): only a staff_admin of this
 * commission OR a global admin may reach it; everyone else gets `notFound()`.
 *
 * Draft vs no-draft (lead refinement #1): if an editable draft exists we render
 * the interactive {@link BuilderShell}. If not — the normal state after
 * publishing — we DON'T 404; we render the current published version read-only
 * with an "Editar publicado" CTA (the clone entry point), so a published form is
 * always viewable and re-editable.
 */
export default async function BuilderPage({
  params,
}: {
  params: Promise<{ slug: string; formId: string }>;
}) {
  const { slug, formId } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  // Confirm the form belongs to this commission (and is visible to the caller).
  const forms = await listForms(access.commission.id);
  const form = forms.find((f) => f.id === formId);
  if (!form) {
    notFound();
  }

  const draft = await getEditableDraftTree(formId);

  if (draft) {
    // Pre-resolve signed URLs for any image blocks so the builder can show
    // previews without a client round trip per image.
    const imageUrls = await resolveImageUrls(draft);
    return (
      <BuilderShell
        slug={slug}
        formId={formId}
        formTitle={form.title}
        formDescription={form.description}
        commissionId={access.commission.id}
        commissionName={access.commission.name}
        tree={draft}
        imageUrls={imageUrls}
      />
    );
  }

  // No draft: show the current published version read-only + the clone CTA.
  const versions = await listVersions(formId);
  const published =
    versions.find((v) => v.status === "published") ?? versions[0] ?? null;
  const tree = published ? await getVersionTree(published.id) : null;
  const imageUrls = tree ? await resolveImageUrls(tree) : {};

  return (
    <PublishedReadOnly
      slug={slug}
      formId={formId}
      formTitle={form.title}
      formDescription={form.description}
      commissionName={access.commission.name}
      tree={tree}
      imageUrls={imageUrls}
    />
  );
}

/**
 * Resolve a `{ storage_path → signed URL }` map for every image block in a tree.
 * Done on the server so previews render immediately; a null URL falls back to a
 * placeholder in the UI.
 */
async function resolveImageUrls(tree: {
  sections: { items: { itemType: string; content: unknown }[] }[];
}): Promise<Record<string, string>> {
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
    [...paths].map(async (path) => [path, await getSignedAssetUrl(path)] as const),
  );
  const map: Record<string, string> = {};
  for (const [path, url] of entries) {
    if (url) map[path] = url;
  }
  return map;
}
