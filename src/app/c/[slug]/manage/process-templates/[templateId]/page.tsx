import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCommissionAccess } from "@/lib/queries/session";
import {
  getProcessTemplate,
  phaseConditionTargets,
  type PhaseConditionTarget,
} from "@/lib/queries/process-templates";
import { listCaseOutcomes } from "@/lib/queries/case-outcomes";
import { listForms } from "@/lib/queries/forms";
import { listNarrativeTypes } from "@/lib/queries/case-narratives";
import { narrativesEnabled } from "@/lib/case-narratives/actions";
import { TemplateBuilderShell } from "@/components/process-templates/template-builder-shell";

export const metadata: Metadata = {
  title: "Construtor de processo",
};

/**
 * Single process-template builder: the ordered list of phase-slots, each bound to
 * a whole form, with an optional cross-phase `recommend_when`. Mirrors the form
 * builder page's gating and load shape.
 *
 * Coordinator-gated (mirrors the form builder/members pages): only a staff_admin
 * of this commission OR a global admin may reach it; everyone else gets
 * `notFound()`. The template must belong to this commission (defends a tampered
 * id across commissions).
 *
 * The slot picker offers the commission's PUBLISHED forms only — a phase pins a
 * published version at case creation, so binding a never-published form would
 * fail at that point (P0017). We pass the publishable forms to the shell.
 */
export default async function ProcessTemplateBuilderPage({
  params,
}: {
  params: Promise<{ slug: string; templateId: string }>;
}) {
  const { slug, templateId } = await params;
  const access = await getCommissionAccess(slug);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const template = await getProcessTemplate(templateId);
  if (!template || template.commissionId !== access.commission.id) {
    notFound();
  }

  // The form picker offers forms that have a published version (a phase pins one
  // at case creation). A form with only a draft can't back a phase yet. The
  // offered-outcomes picker offers the commission's non-archived outcomes; the
  // narrative-slot picker the non-archived narrative types (when the feature is on).
  const [forms, outcomes, narrativesOn] = await Promise.all([
    listForms(access.commission.id),
    listCaseOutcomes(access.commission.id),
    narrativesEnabled(),
  ]);
  const narrativeTypes = narrativesOn
    ? await listNarrativeTypes(access.commission.id)
    : [];
  const publishableForms = forms
    .filter((f) => f.publishedVersionNumber != null)
    .map((f) => ({ id: f.id, title: f.title }));

  // Pre-resolve the choice-question targets for every form already bound by a
  // phase-slot, so the client `recommend_when` editor can offer a question +
  // value picker for an earlier phase WITHOUT a server round trip per keystroke.
  // `phaseConditionTargets` is server-only (RLS-scoped); resolving it here keeps
  // the editor a pure client component. Keyed by formId (a form may back several
  // phases; we resolve each distinct form once).
  const boundFormIds = [...new Set(template.phases.map((p) => p.formId))];
  const targetEntries = await Promise.all(
    boundFormIds.map(
      async (formId) =>
        [formId, await phaseConditionTargets(formId)] as const,
    ),
  );
  const conditionTargetsByForm: Record<string, PhaseConditionTarget[]> =
    Object.fromEntries(targetEntries);

  return (
    <TemplateBuilderShell
      slug={slug}
      template={template}
      forms={publishableForms}
      conditionTargetsByForm={conditionTargetsByForm}
      outcomes={outcomes}
      narrativeTypes={narrativeTypes}
      narrativesEnabled={narrativesOn}
    />
  );
}
