import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  getEditableDraftTree,
  getVersionTree,
  listForms,
  listVersions,
  getSignedAssetUrl,
  flattenItem,
} from "@/lib/queries/forms";
import type { VersionTree } from "@/lib/queries/forms";
import {
  controlledDocsEnabled,
  featureEnabled,
  matrixFieldsEnabled,
  itemValidationsEnabled,
} from "@/lib/queries/feature-flags";
import type { FeatureFlagKey } from "@/lib/queries/feature-flags";
import { repeatingGroupsEnabled } from "@/lib/forms/repeating-groups-flag";
import { listApproverCandidates } from "@/lib/queries/documents";
import { listBlockLibraryEntries } from "@/lib/queries/block-library";
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
  params: Promise<{ org: string; commission: string; formId: string }>;
}) {
  const { org, commission, formId } = await params;
  const slug = commission;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || access.role !== "staff_admin") {
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

    // Phase 17, F7 — when controlled-documents is on, the publish dialog offers
    // optional document-control metadata (approver + effective date + review
    // cycle). Resolve the approver candidates only then (flag off → empty, and the
    // metadata section is hidden, so publishing behaves exactly as before).
    const containersEnabled = await repeatingGroupsEnabled();
    // FF-2 (ADR 0089) — `matrix_fields`. Resolved here and provided once at the
    // builder root; while OFF the picker does not offer the two matrix types,
    // because `upsert_matrix_axes` raises HC0P2 and the block could never be
    // configured. Rendering an ALREADY-AUTHORED matrix is deliberately not
    // gated, same as FF-1's containers: a form that holds one must render
    // truthfully rather than silently drop a question.
    const matrixEnabled = await matrixFieldsEnabled();
    // FF-3 (ADR 0090) — `item_validations`. Same fail-closed reasoning: while
    // OFF, `set_item_validations` raises HC0Q0, so the rules editor is not
    // offered rather than offered and guaranteed to fail on save. Rules that
    // are ALREADY authored still evaluate server-side; this gates authoring.
    const validationsEnabled = await itemValidationsEnabled();
    // FF-5 (ADR 0091) — `entity_refs`. Same fail-closed reasoning again: while
    // OFF, `save_section_answers` refuses the reference arm (HC0Q3) and
    // `reference_candidates` refuses to search, so the type is not offered
    // rather than offered with a picker that can never load. An ALREADY-AUTHORED
    // reference block still renders and still resolves its label — gating
    // authoring is not gating truth.
    const referencesEnabled = await featureEnabled("entity_refs");
    // FF-4 (ADR 0092) — `power_authoring`. Same fail-closed reasoning as the
    // flags above: while OFF, both `save_block_to_library` and
    // `insert_block_from_library` refuse the write, so neither the
    // save-to-library affordance nor the library picker is offered.
    //
    // ⚠ `power_authoring` is BE-2's flag key (`FeatureFlags`,
    // `src/lib/queries/feature-flags.ts`, backend-owned) and is not yet a
    // member of that hand-maintained interface as of this build — the cast is
    // a forward-compatible stopgap; `featureEnabled` already defaults an
    // absent key to `false`, so this fails closed either way and the cast
    // becomes a no-op once BE-2 lands the key.
    const powerAuthoringEnabled = await featureEnabled(
      "power_authoring" as FeatureFlagKey,
    );
    const libraryEntries = powerAuthoringEnabled
      ? await listBlockLibraryEntries(access.commission.id)
      : [];
    const controlledDocsOn = await controlledDocsEnabled();
    const approverCandidates = controlledDocsOn
      ? await listApproverCandidates(access.commission.id)
      : [];

    return (
      <BuilderShell
        org={org} slug={slug}
        formId={formId}
        formTitle={form.title}
        formDescription={form.description}
        commissionId={access.commission.id}
        commissionName={access.commission.name}
        tree={draft}
        imageUrls={imageUrls}
        controlledDocsEnabled={controlledDocsOn}
        approverCandidates={approverCandidates}
        containersEnabled={containersEnabled}
        matrixEnabled={matrixEnabled}
        validationsEnabled={validationsEnabled}
        referencesEnabled={referencesEnabled}
        powerAuthoringEnabled={powerAuthoringEnabled}
        libraryEntries={libraryEntries}
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
      org={org} slug={slug}
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
async function resolveImageUrls(tree: VersionTree): Promise<Record<string, string>> {
  const paths = new Set<string>();
  // FF-1: `Section.items` holds only TOP-LEVEL items now, so walk through
  // `flattenItem` — an image block authored inside a container would otherwise
  // resolve to no signed URL and render as a permanent placeholder.
  for (const item of tree.sections.flatMap((s) => s.items.flatMap(flattenItem))) {
    if (item.itemType === "image" && item.content) {
      const path = (item.content as { storage_path?: string }).storage_path;
      if (path) paths.add(path);
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
