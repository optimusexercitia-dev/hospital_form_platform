import { canInCommission } from "@/lib/queries/session";
import type { CommissionAccess } from "@/lib/queries/session";

/**
 * The TS mirror of `public.bulk_create_cases`' authority gate (ADR 0134 Amendment 7,
 * PO-ruled 2026-08-22). ⛔ ONE PREDICATE, TWO SITES — the `multiplos` route's own gate
 * and the board's "Múltiplos casos" link. They were two hand-written copies of the
 * same sentence before, which is how one surface came to offer what the other 404s;
 * they must change together, so they are the same function.
 *
 * ⛔ TWO KEYS, NOT ONE. Verified against the live catalog (`pg_get_functiondef`, not a
 * migration file — Rule: migration text is stale by design):
 *
 *     app.is_staff_admin_of(commission)
 *     OR (app.member_can(commission,'create_cases')
 *         AND app.member_can(commission,'assign_case_phases'))
 *
 * The second key is not bureaucratic padding: bulk creation is a COMPOSITION that
 * calls `public.activate_phase` per row, whose own gate is
 * `is_staff_admin_of OR member_can(…,'assign_case_phases')`. A `create_cases`-only
 * delegate passes the outer gate and is then refused inside the per-row loop, rolling
 * the whole batch back with `linha N: sem permissão`. A one-key mirror here would walk
 * that person into a 200-row wizard the DB always refuses.
 *
 * `canInCommission` already folds in the `staff_admin` arm and the membership
 * requirement, so this is the door's shape and not a hand-set narrowing. The one
 * predicate it does NOT mirror is `app.is_active`: the shell routes deactivated users
 * to `/conta-inativa` before any commission route runs, so it is covered elsewhere —
 * do not "improve" this by re-adding a check that already ran.
 *
 * ⛔ Rule 1: this is an AFFORDANCE gate. `bulk_create_cases` is the authority.
 */
export function canBulkCreateCases(
  access: Pick<CommissionAccess, "role" | "capabilities">,
): boolean {
  return (
    canInCommission(access, "create_cases") &&
    canInCommission(access, "assign_case_phases")
  );
}

/**
 * Whether the caller may choose the `all_phases` bulk scope — coordinator only.
 *
 * ⛔ NOT a second opinion about authority; a mirror of a refusal that already exists.
 * `bulk_create_cases` refuses `all_phases` from a non-coordinator AT THE GATE, before
 * a single row is minted, because step (c) of its per-row loop calls
 * `public.assign_narrative`, whose gate is `app.is_staff_admin_of` ALONE — no
 * combination of ADR-0061 capability keys can satisfy it. The UI's job is not to
 * enforce that; it is to not invite a choice guaranteed to be refused.
 *
 * ⚠ A refusal that does reach the UI arrives as `42501`, which `bulk-actions.ts` maps
 * to the GENERIC forbidden message — the door's specific "escopo … exclusivo da
 * coordenação" text does not survive that mapping. One more reason not to offer it.
 */
export function canUseAllPhasesScope(
  access: Pick<CommissionAccess, "role">,
): boolean {
  return access.role === "staff_admin";
}
