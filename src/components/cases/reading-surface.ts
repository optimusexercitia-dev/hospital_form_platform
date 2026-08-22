import type { CaseViewerCapabilities } from "@/lib/queries/cases";

/**
 * THE reading-surface narrowing (ADR 0134 D1/D2) — one definition, every `/casos`
 * route.
 *
 * ⛔ **This module exists because the rule was written per-file and the hand-list
 * was short.** Increment 1 converted `casos/[caseId]/page.tsx` and left
 * `casos/[caseId]/narrativa/[narrativeId]/page.tsx` on the raw envelope, which
 * falsified D1's own acceptance bullet: a coordinator and a write-grantee kept
 * case-wide narrative authorship on a `/casos` URL. The defect was not that
 * someone forgot a file — it is that "narrow the reading surface" had no single
 * place to live, so every new route under `/casos` had to re-derive it correctly
 * from memory. The bound is the PROPERTY — *every `/casos` route that renders a
 * case-wide write affordance* — and a property needs a function, not a checklist.
 *
 * ⚠ A NEW ROUTE UNDER `/casos` MUST CALL THIS. If you are reading raw
 * `detail.viewerCapabilities` in a route whose path contains `/casos/`, that is
 * the bug this module was written for.
 */

/**
 * Does the reading-surface narrowing APPLY to this viewer?
 *
 * True when the viewer holds any CASE-WIDE claim — lifecycle (coordinator) or
 * content-write (a per-case `write` grant). Both relocate to
 * `/manage/cases/[caseId]`, which since ADR 0134 D3 admits both classes, so
 * narrowing moves the work rather than deleting it.
 *
 * False for a plain member, a pure read-grantee and a quality reviewer: `/casos`
 * is their ONLY surface and they must keep working on it. Narrowing a viewer who
 * holds nothing case-wide is a no-op anyway — this predicate exists so callers can
 * also decide whether to OFFER the escape hatch.
 */
export function isReadingAsMember(
  caps: Pick<CaseViewerCapabilities, "canManageLifecycle" | "canWriteContent">,
): boolean {
  return caps.canManageLifecycle || caps.canWriteContent;
}

/**
 * Zero every CASE-WIDE capability, leaving identity-attributed work untouched.
 *
 * ⭐ The narrowing is deliberately expressed as a transform on the CAPABILITY
 * OBJECT rather than as a set of per-affordance conditions, because every
 * downstream card already gates off this object: phase activate/reassign,
 * narrative assign/conclude, Encaminhar caso, Nova entrevista, patient +
 * custom-field edit, event visibility, the offered-outcomes editor, Reabrir caso
 * and ad-hoc delete all follow from `canManageLifecycle: false`; Novo item,
 * Adicionar registro, Anexar documento and the tag editor from
 * `canWriteContent: false`. One decision, not one per card.
 *
 * ⚠ WHAT SURVIVES, AND WHY IT MUST: name-attributed work. The assignee tests run
 * BEFORE the capability tests (ADR 0033 Q14 / CA-002 — see the ordering comment in
 * `narrative-access.ts`), so my phase, my narrative and my action item stay
 * writable on `/casos`. That is not an exception to D1, it is the second half of
 * its sentence. A caller that "simplifies" this by hiding affordances directly
 * instead of narrowing the caps will take the attributed work with it.
 *
 * ⚠ NOT a security control (Rule 1). The same viewer keeps the same DB rights and
 * every door still decides for itself; this only stops a reading surface from
 * OFFERING two different jobs at once.
 */
export function narrowToReadingSurface(
  caps: CaseViewerCapabilities,
): CaseViewerCapabilities {
  if (!isReadingAsMember(caps)) return caps;
  return { ...caps, canManageLifecycle: false, canWriteContent: false };
}
