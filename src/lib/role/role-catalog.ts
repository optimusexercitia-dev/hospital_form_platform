import type { Database } from "@/lib/types/database";
import type { OrganizationRef } from "@/lib/queries/session";
import {
  partitionGrants,
  type SessionGrant,
  type SessionRoleLists,
} from "@/lib/queries/session-grants";
import { commissionHref, nspHref, orgHref, qualidadeHref } from "@/lib/routing";

/**
 * ACT (ADR 0106) — the shared role catalog: pt-BR labels and the role →
 * landing-route table, in ONE place so the picker (`/selecionar-perfil`), the
 * `UserMenu` "Trocar papel" switch, the D9 `RoleSwitchHint` and the person-history
 * timeline (`listPersonAccountHistory`) never hand-copy divergent implementations of
 * the same mapping (`docs/design/act-role-picker.md` §1 — extracted from
 * `src/app/page.tsx`'s own precedence chain, not invented here).
 *
 * Pure, no I/O, safe to import from Server AND Client Components alike
 * (mirrors `src/lib/routing.ts`'s own convention).
 *
 * ⚠ LIVES IN `src/lib/role/`, NOT `src/components/role/` — moved 2026-08-25. Its
 * consumers now include a `src/lib/queries` module, and a query module importing from
 * `src/components` inverts the layering; being the first such import in the repo, it
 * would have become the precedent later query modules copied. Nothing about the module
 * changed: it was always pure and always imported only from `src/lib`. Do not move it
 * back to sit beside the components that happen to render it.
 */

export type PlatformRole = Database["public"]["Enums"]["platform_role"];

/** pt-BR labels for every `platform_role` value (docs/design/act-role-picker.md §1). */
export const ROLE_LABELS: Record<PlatformRole, string> = {
  platform_admin: "Administrador(a) da plataforma",
  org_admin: "Administrador(a) da organização",
  hospital_admin: "Administrador(a) do hospital",
  nsp_org_admin: "Administração do NSP (organização)",
  nsp_coordinator: "Coordenador(a) do NSP",
  pqs_member: "Membro do NSP",
  technical_director: "Diretor(a) técnico(a)",
  technical_director_deputy: "Diretor(a) técnico(a) substituto(a)",
  quality_reviewer: "Revisor(a) da qualidade",
  staff_admin: "Coordenador(a) de comissão",
  staff: "Membro de comissão",
};

/**
 * The scope a role's assignment is keyed to. ⚠ MIRRORS `authz.roles.allowed_scope_kind`
 * and is BOUND to it by `role-catalog.test.ts`, which reads the live catalog — this is
 * not a hand-maintained parallel list, and it must not become one (AE4.8 [PA-F1]).
 */
export type RoleScopeKind = "none" | "organization" | "hospital" | "commission";

/**
 * Which scope each role is assigned at. Exhaustive over `PlatformRole` BY TYPE — adding
 * an enum value fails to compile here before it can fail silently anywhere else.
 */
export const ROLE_SCOPE_KIND: Record<PlatformRole, RoleScopeKind> = {
  platform_admin: "none",
  org_admin: "organization",
  hospital_admin: "hospital",
  nsp_org_admin: "organization",
  nsp_coordinator: "hospital",
  pqs_member: "hospital",
  technical_director: "hospital",
  technical_director_deputy: "hospital",
  quality_reviewer: "hospital",
  staff_admin: "commission",
  staff: "commission",
};

/**
 * ⭐ THE ONE ORDERED MANIFEST (AE4.8). The order IS `src/app/page.tsx`'s precedence
 * chain, read top-to-bottom, and it is the whole point of this array: `page.tsx` and
 * {@link landingRouteForRole} were hand-mirrored copies of the same ordering, so a new
 * role had to cross TWO seams and three times crossed neither (BUG-HAT-001, the Diretor
 * Técnico, `quality_reviewer` — `session-grants.test.ts` carries that history).
 *
 * ⛔ REORDERING THIS ARRAY CHANGES WHERE USERS LAND. It is not a display order and must
 * not be sorted for tidiness. The two commission roles sit AFTER the org/hospital
 * administrators and BEFORE the three "office" hats (NSP operator, Diretor Técnico,
 * quality reviewer) — each of those is worn alongside a day job, so it may only change
 * the outcome for someone who would otherwise dead-end. `page.tsx` states the reasoning
 * per branch; this array states the resulting order in one place.
 *
 * ⚠ NOT exhaustive by type (a short array still satisfies `readonly PlatformRole[]`).
 * `role-catalog.test.ts` asserts coverage instead, in the same test that binds it to
 * the catalog — a missing role here is exactly the defect this manifest exists to stop.
 */
export const ROLE_ORDER = [
  "platform_admin",
  "org_admin",
  "hospital_admin",
  "nsp_org_admin",
  "staff_admin",
  "staff",
  "nsp_coordinator",
  "pqs_member",
  "technical_director",
  "technical_director_deputy",
  "quality_reviewer",
] as const satisfies readonly PlatformRole[];

export interface RoleManifestEntry {
  readonly code: PlatformRole;
  readonly label: string;
  readonly scopeKind: RoleScopeKind;
}

/** The manifest itself — order + label + scope, assembled from the three sources above
 * so that none of them can be edited without the others staying in view. */
export const ROLE_MANIFEST: readonly RoleManifestEntry[] = ROLE_ORDER.map((code) => ({
  code,
  label: ROLE_LABELS[code],
  scopeKind: ROLE_SCOPE_KIND[code],
}));

const PLATFORM_ROLES = new Set<string>(ROLE_MANIFEST.map((r) => r.code));

/** Whether `value` is a real `platform_role` enum value — the picker/hint's
 * own boundary check on untrusted `FormData`/string input (the RPC re-
 * validates regardless; this only decides what the UI renders/submits).
 *
 * ⭐ G4 (ADR 0155) ASKED FOR A TYPED QUERY AGAINST `authz.roles.session_selectable`
 * INSTEAD OF THIS SET. That is not implementable, and the reason is a deliberate design
 * choice one increment earlier, not an oversight: AE4.1 keeps `authz` OUT of
 * `config.toml`'s exposed schemas, and no client role holds USAGE on it — measured,
 * `anon`/`authenticated`/`service_role` are all false for both `has_schema_privilege`
 * and `has_table_privilege('authz.roles','SELECT')`. A runtime query would need a NEW
 * `public` door into the schema AE4 deliberately sealed, bought for a UI pre-filter.
 *
 * ⛔ So the binding is enforced at GATE TIME instead of query time: `role-catalog.test.ts`
 * reads `authz.roles` from the live catalog and fails if this manifest and the catalog
 * disagree. Same "cannot drift silently" property, no new runtime surface. The AUTHORITY
 * was never this Set in any case — `public.assume_role` re-validates against live
 * memberships and is the only thing that can actually grant a hat.
 */
export function isPlatformRole(value: string): value is PlatformRole {
  return PLATFORM_ROLES.has(value);
}

/** pt-BR label for a role, falling back to the raw value for anything outside
 * the known 11 (defensive — never crash the UI on an unexpected string). */
export function platformRoleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

// ⛔ `sortByName` was REMOVED in AE4.8, and the sorting it did was NOT lost — it MOVED.
// The old landingRouteForRole sorted a role's grants by hospital (or organization) name
// before taking [0]. `partitionGrants` already sorts every one of those lists by exactly
// the same key, so routing through it preserves the pick: nspOperatorOf /
// technicalDirectionOf / qualityReviewerOf / hospitalAdminOf by hospital name,
// orgAdminOf / nspOrgAdminOf by organization name, memberships by commission name.
// ⚠ If a future edit removes a sort THERE, the stable pick disappears HERE with no local
// sign of it — that coupling is the price of having one implementation instead of two.

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of list) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

/**
 * ⭐ AE4.8 — THE LANDING BRANCHES, ONE ORDERED LIST WITH TWO CONSUMERS.
 *
 * A role does not get its own branch: several roles share one. `staff` and `staff_admin`
 * both land through `memberships`; `nsp_coordinator` and `pqs_member` through
 * `nspOperatorOf`; the Diretor Técnico and its deputy through `technicalDirectionOf`
 * (ADR 0094 W4 D1 makes them one authority). So the precedence chain is over BRANCHES,
 * derived from {@link ROLE_ORDER} — which is why that array's order is load-bearing.
 */
export type LandingBranchKey =
  | "isAdmin"
  | "orgAdminOf"
  | "hospitalAdminOf"
  | "nspOrgAdminOf"
  | "memberships"
  | "nspOperatorOf"
  | "technicalDirectionOf"
  | "qualityReviewerOf";

/** Which `SessionContext` field each role partitions into. Exhaustive by type. */
export const ROLE_BRANCH: Record<PlatformRole, LandingBranchKey> = {
  platform_admin: "isAdmin",
  org_admin: "orgAdminOf",
  hospital_admin: "hospitalAdminOf",
  nsp_org_admin: "nspOrgAdminOf",
  staff_admin: "memberships",
  staff: "memberships",
  nsp_coordinator: "nspOperatorOf",
  pqs_member: "nspOperatorOf",
  technical_director: "technicalDirectionOf",
  technical_director_deputy: "technicalDirectionOf",
  quality_reviewer: "qualityReviewerOf",
};

/**
 * The precedence chain `src/app/page.tsx` walks, DERIVED from {@link ROLE_ORDER} rather
 * than written twice. First-wins; a branch that resolves to `null` is empty and the walk
 * continues.
 */
export const LANDING_BRANCHES: readonly LandingBranchKey[] = [
  ...new Set(ROLE_ORDER.map((code) => ROLE_BRANCH[code])),
];

/** What {@link landingRouteForRole} answers when a role's own branch is EMPTY.
 *
 * ⚠ These are not "/" everywhere, and the differences are PRESERVED BEHAVIOUR, not
 * design: the three branches that own a picker fall back to it (an org_admin with no
 * orgs got `/o`, a staff member with no commissions got `/c`), and the rest returned
 * `/`. Every one of these paths is unreachable through the picker, which only offers
 * roles the caller actually holds — they are kept identical anyway, because "unreachable"
 * is a claim about today's callers and this file is imported by four of them. */
const BRANCH_EMPTY_FALLBACK: Record<LandingBranchKey, string> = {
  isAdmin: "/",
  orgAdminOf: "/o",
  hospitalAdminOf: "/o",
  nspOrgAdminOf: "/",
  memberships: "/c",
  nspOperatorOf: "/",
  technicalDirectionOf: "/",
  qualityReviewerOf: "/",
};

/** The role-derived half of a `SessionContext`, plus the one flag that is not a list. */
export type LandingLists = SessionRoleLists & { isAdmin: boolean };

const distinctOrgs = (orgs: OrganizationRef[]): OrganizationRef[] =>
  uniqueById(orgs);

/**
 * Resolve ONE branch against a partition. `null` means "this branch is empty" — which is
 * what lets `page.tsx` fall through to the next one, and is why this cannot simply return
 * the fallback itself.
 *
 * ⚠ ONE RECONCILED DIVERGENCE, recorded because it was real and silent. `page.tsx`
 * counted `orgAdminOf.length`; `landingRouteForRole` counted DISTINCT organizations. For a
 * caller holding two `org_admin` grants on the SAME org the two disagreed — page.tsx sent
 * them to the picker, the role switcher straight to the org. Reconciled on DISTINCT, which
 * is what the neighbouring `hospital_admin` branch already did in BOTH files. ⛔ Unreachable
 * either way — `session_context()` emits one grant per (role, scope), and an org-scoped
 * role has one scope per org — so this changes no live landing; it removes a disagreement
 * that would have decided a future one.
 */
export function resolveLanding(
  branch: LandingBranchKey,
  lists: LandingLists,
): string | null {
  switch (branch) {
    case "isAdmin":
      return lists.isAdmin ? "/admin" : null;

    case "orgAdminOf": {
      const orgs = distinctOrgs(lists.orgAdminOf.map((o) => o.organization));
      if (orgs.length === 0) return null;
      return orgs.length === 1 ? orgHref(orgs[0].slug, "manage") : "/o";
    }

    case "hospitalAdminOf": {
      // Disambiguate on DISTINCT ORGS, not hospitals: a caller may admin several
      // hospitals within one org (→ that org's manage area, which scopes to their
      // hospitals) or hospitals across orgs (→ the org picker).
      const orgs = distinctOrgs(lists.hospitalAdminOf.map((h) => h.organization));
      if (orgs.length === 0) return null;
      return orgs.length === 1 ? orgHref(orgs[0].slug, "manage") : "/o";
    }

    case "nspOrgAdminOf": {
      const first = lists.nspOrgAdminOf[0];
      return first ? orgHref(first.organization.slug, "nsp-org") : null;
    }

    case "memberships": {
      // ⚠ Counts GRANTS, not distinct commissions — both consumers already did, and a
      // membership is one row per (principal, commission).
      if (lists.memberships.length === 0) return null;
      if (lists.memberships.length > 1) return "/c";
      const { commission } = lists.memberships[0];
      return commissionHref(commission.organization.slug, commission.slug);
    }

    case "nspOperatorOf": {
      const first = lists.nspOperatorOf[0];
      return first ? nspHref(first.organization.slug) : null;
    }

    case "technicalDirectionOf": {
      const first = lists.technicalDirectionOf[0];
      return first ? orgHref(first.organization.slug, "direcao-tecnica") : null;
    }

    case "qualityReviewerOf": {
      const first = lists.qualityReviewerOf[0];
      return first ? qualidadeHref(first.organization.slug) : null;
    }
  }
}

/**
 * The role → landing-route resolution for ONE EXACT role (`docs/design/act-role-picker.md`
 * §1), against the grants that carry it — rather than the whole hat-blind partition
 * `page.tsx` walks. This is what lets a caller holding BOTH `staff_admin` and `staff`
 * (different commissions) land correctly whichever hat they pick: `page.tsx`'s
 * `memberships` list merges the two roles, but the hat picked here is the exact
 * `active_role` claim that will be minted, so the route must follow that exact role.
 *
 * ⭐ AE4.8: it no longer HAND-MIRRORS `page.tsx`. It narrows the grants to the one role,
 * runs them through the REAL {@link partitionGrants}, and applies the SAME
 * {@link resolveLanding} branch `page.tsx` applies. Both seams a new role must cross are
 * now one seam — which is the regression class `session-grants.test.ts` exists for
 * (BUG-HAT-001, the Diretor Técnico, `quality_reviewer`: three roles that crossed the
 * partition and not the branch chain, or neither).
 *
 * `platform_admin` is answered before the partition because its branch is not a grant
 * list at all: it lives in `profiles.is_admin` and never holds a `memberships` row (D11),
 * so `getSelectableRoles` never emits it and the picker never offers it.
 */
export function landingRouteForRole(role: string, grants: SessionGrant[]): string {
  if (role === "platform_admin") return "/admin";
  if (!isPlatformRole(role)) return "/";

  const branch = ROLE_BRANCH[role];
  const lists = partitionGrants(grants.filter((g) => g.role === role));
  return (
    resolveLanding(branch, { ...lists, isAdmin: false }) ??
    BRANCH_EMPTY_FALLBACK[branch]
  );
}

/**
 * A short pt-BR "which scope(s)" summary for a role option — the specific
 * name when the role spans exactly one org/hospital/commission (naming it
 * removes a pointless extra click), else a count phrase. Never names MULTIPLE
 * scopes (D2: scope stays with the switchers that already exist, not this
 * screen).
 */
export function scopeSummary(role: string, grants: SessionGrant[]): string | null {
  const roleGrants = grants.filter((g) => g.role === role);

  switch (role) {
    case "org_admin":
    case "nsp_org_admin": {
      const orgs = uniqueById(
        roleGrants.flatMap((g) => (g.organization ? [g.organization] : [])),
      );
      if (orgs.length === 1) return orgs[0].name;
      return `${orgs.length} organizações`;
    }

    case "hospital_admin":
    case "nsp_coordinator":
    case "pqs_member":
    case "technical_director":
    case "technical_director_deputy":
    case "quality_reviewer": {
      const hospitals = uniqueById(
        roleGrants.flatMap((g) => (g.hospital ? [g.hospital] : [])),
      );
      if (hospitals.length === 1) return hospitals[0].name;
      return `${hospitals.length} hospitais`;
    }

    case "staff_admin":
    case "staff": {
      const commissions = uniqueById(
        roleGrants.flatMap((g) => (g.commission ? [g.commission] : [])),
      );
      if (commissions.length === 1) return commissions[0].name;
      return `${commissions.length} comissões`;
    }

    default:
      return null;
  }
}
