import type { OrganizationRef } from "@/lib/queries/session";
// ⚠ VALUE import from `@/lib/queries` — and this module is imported by three
// `"use client"` components, so the "Pure, no I/O" note below is about THIS file's
// body, not about its import graph. Safe today only because `session-grants.ts`
// carries no `server-only` marker and its own `session.ts` import is `import type`,
// which is why `lint:client-server-imports` stays green. ⛔ Adding `server-only` to
// `session-grants.ts` would break `next build` in those three client components, and
// no gate warns first — the green is a property of that file, not of this one.
// Gate AE4 review F-REC-5, caveat placed at the import site as the finding asked.
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
 * Pure, no I/O **in this file's own body**, safe to import from Server AND Client
 * Components alike (mirrors `src/lib/routing.ts`'s own convention). ⛔ The claim is
 * about this body, NOT the import graph — see the caveat on the `session-grants`
 * value import above, which is what makes the client-side safety conditional.
 *
 * ⚠ LIVES IN `src/lib/role/`, NOT `src/components/role/` — moved 2026-08-25. Its
 * consumers now include a `src/lib/queries` module, and a query module importing from
 * `src/components` inverts the layering; being the first such import in the repo, it
 * would have become the precedent later query modules copied. Nothing about the module
 * changed: it was always pure and always imported only from `src/lib`. Do not move it
 * back to sit beside the components that happen to render it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ ONE MANIFEST ENTRY PER ROLE (ADR 0207 D4, closing audit finding IA-F7 / F7).
 *
 * This file used to carry FIVE parallel declarations of the same eleven roles —
 * `ROLE_LABELS`, `ROLE_SCOPE_KIND`, `ROLE_ORDER`, `ROLE_BRANCH` and `scopeSummary`'s
 * switch — of which type exhaustiveness covered three and not the other two. Adding a
 * role meant editing five places and the compiler would tell you about three. The
 * audit's words: *"they do not provide one local extension seam."*
 *
 * Now {@link ROLE_MANIFEST} is the ONLY place a role is declared, and all five are
 * DERIVED from it as compatibility exports — same names, same types, same values, so
 * no caller changed. ⛔ Do not re-introduce a hand-written parallel map: the next role
 * must cross exactly one seam.
 *
 * ⚠ `PlatformRole` IS INFERRED FROM THE MANIFEST, NOT FROM THE GENERATED ENUM. It read
 * `Database["public"]["Enums"]["platform_role"]` until ADR 0207 D3 retired that enum
 * (migration `20261003007430`), so `database.ts` no longer carries it at all.
 */

/**
 * The scope a role's assignment is keyed to. ⚠ MIRRORS `authz.roles.allowed_scope_kind`
 * and is BOUND to it through the generated artifact — this is not a hand-maintained
 * parallel list, and it must not become one (AE4.8 [PA-F1]).
 */
export type RoleScopeKind = "none" | "organization" | "hospital" | "commission";

/**
 * ⭐ AE4.8 — THE LANDING BRANCHES, ONE ORDERED LIST WITH TWO CONSUMERS.
 *
 * A role does not get its own branch: several roles share one. `staff` and `staff_admin`
 * both land through `memberships`; `nsp_coordinator` and `pqs_member` through
 * `nspOperatorOf`; the Diretor Técnico and its deputy through `technicalDirectionOf`
 * (ADR 0094 W4 D1 makes them one authority). So the precedence chain is over BRANCHES,
 * derived from the manifest's order — which is why that order is load-bearing.
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

/**
 * Which grant field {@link scopeSummary} counts for a role, and therefore which pt-BR
 * plural it uses. `"none"` means the role has no scope summary at all (`platform_admin`
 * lives in `profiles.is_admin` and holds no grant rows), and {@link scopeSummary}
 * returns `null` for it — the behaviour the old `default:` arm had.
 */
export type ScopeSummaryStrategy = RoleScopeKind;

/** The shape every manifest row must satisfy. ⚠ `code` is `string` HERE on purpose:
 * {@link PlatformRole} is inferred FROM the manifest, so constraining `code` to it
 * would be circular. The exported {@link RoleManifestEntry} below is the narrowed,
 * literal-typed entry callers see. */
interface RoleManifestShape {
  readonly code: string;
  readonly label: string;
  readonly scopeKind: RoleScopeKind;
  readonly sessionSelectable: boolean;
  readonly branch: LandingBranchKey;
  readonly branchEmptyFallback: string;
  readonly scopeSummary: ScopeSummaryStrategy;
}

/**
 * ⭐⭐ THE ONE ORDERED MANIFEST. Every fact about a role is declared here exactly once:
 * code, pt-BR label, assignment scope kind, session-selectable status, landing branch,
 * that branch's empty fallback, and the scope-summary strategy. **Precedence is the
 * array index** — position 0 wins first.
 *
 * ⛔ REORDERING THIS ARRAY CHANGES WHERE USERS LAND. The order IS `src/app/page.tsx`'s
 * precedence chain read top-to-bottom. It is not a display order and must not be sorted
 * for tidiness. The two commission roles sit AFTER the org/hospital administrators and
 * BEFORE the three "office" hats (NSP operator, Diretor Técnico, quality reviewer) —
 * each of those is worn alongside a day job, so it may only change the outcome for
 * someone who would otherwise dead-end. `page.tsx` states the reasoning per branch;
 * this array states the resulting order in one place. `page.tsx` and
 * {@link landingRouteForRole} were hand-mirrored copies of this ordering, and a new
 * role had to cross TWO seams — three times it crossed neither (BUG-HAT-001, the Diretor
 * Técnico, `quality_reviewer`; `session-grants.test.ts` carries that history).
 *
 * ⚠ `branchEmptyFallback` IS DECLARED PER ROLE BUT CONSUMED PER BRANCH, and roles that
 * share a branch must agree. Nothing in the type system says so, so
 * `role-catalog.test.ts` asserts it — a disagreement would make the derived
 * `BRANCH_EMPTY_FALLBACK` depend on which role happened to be declared first.
 *
 * ⛔⛔ KEEP THE `ROLE-MANIFEST-BEGIN` / `ROLE-MANIFEST-END` MARKERS AND THE
 * `field: value` SHAPE. `scripts/gen-role-manifest.mjs --check` parses this block as
 * PLAIN TEXT (no TypeScript loader, no database — every gate in `npm run lint` is a
 * text comparison over committed files) and compares it to the committed artifact
 * `supabase/tests/vectors/role_manifest.psql`, which pgTAP 411 compares to the live
 * `authz.roles`. Chained, the two hops bind this array to the catalog; neither hop
 * alone is the verdict (ADR 0197 D4). Reformatting the block breaks the parser — and
 * the parser throws rather than silently reading zero rows.
 */
// ROLE-MANIFEST-BEGIN
export const ROLE_MANIFEST = [
  {
    code: "platform_admin",
    label: "Administrador(a) da plataforma",
    scopeKind: "none",
    sessionSelectable: true,
    branch: "isAdmin",
    branchEmptyFallback: "/",
    scopeSummary: "none",
  },
  {
    code: "org_admin",
    label: "Administrador(a) da organização",
    scopeKind: "organization",
    sessionSelectable: true,
    branch: "orgAdminOf",
    branchEmptyFallback: "/o",
    scopeSummary: "organization",
  },
  {
    code: "hospital_admin",
    label: "Administrador(a) do hospital",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "hospitalAdminOf",
    branchEmptyFallback: "/o",
    scopeSummary: "hospital",
  },
  {
    code: "nsp_org_admin",
    label: "Administração do NSP (organização)",
    scopeKind: "organization",
    sessionSelectable: true,
    branch: "nspOrgAdminOf",
    branchEmptyFallback: "/",
    scopeSummary: "organization",
  },
  {
    code: "staff_admin",
    label: "Coordenador(a) de comissão",
    scopeKind: "commission",
    sessionSelectable: true,
    branch: "memberships",
    branchEmptyFallback: "/c",
    scopeSummary: "commission",
  },
  {
    code: "staff",
    label: "Membro de comissão",
    scopeKind: "commission",
    sessionSelectable: true,
    branch: "memberships",
    branchEmptyFallback: "/c",
    scopeSummary: "commission",
  },
  {
    code: "nsp_coordinator",
    label: "Coordenador(a) do NSP",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "nspOperatorOf",
    branchEmptyFallback: "/",
    scopeSummary: "hospital",
  },
  {
    code: "pqs_member",
    label: "Membro do NSP",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "nspOperatorOf",
    branchEmptyFallback: "/",
    scopeSummary: "hospital",
  },
  {
    code: "technical_director",
    label: "Diretor(a) técnico(a)",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "technicalDirectionOf",
    branchEmptyFallback: "/",
    scopeSummary: "hospital",
  },
  {
    code: "technical_director_deputy",
    label: "Diretor(a) técnico(a) substituto(a)",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "technicalDirectionOf",
    branchEmptyFallback: "/",
    scopeSummary: "hospital",
  },
  {
    code: "quality_reviewer",
    label: "Revisor(a) da qualidade",
    scopeKind: "hospital",
    sessionSelectable: true,
    branch: "qualityReviewerOf",
    branchEmptyFallback: "/",
    scopeSummary: "hospital",
  },
] as const satisfies readonly RoleManifestShape[];
// ROLE-MANIFEST-END

/** One role's declaration, with its literal `code`. */
export type RoleManifestEntry = (typeof ROLE_MANIFEST)[number];

/**
 * Every role code the platform knows, inferred from {@link ROLE_MANIFEST}.
 *
 * ⚠ THE NAME IS KEPT FOR ITS ~40 CALLERS; ITS SOURCE IS NOT WHAT IT WAS. Until ADR 0207
 * D3 this was the Postgres enum `public.platform_role`, read out of the generated
 * `database.ts`. That enum is dropped, and `app.active_role_selections.role` is now
 * catalog-validated text with an FK to `authz.roles(code)`. The authority is the
 * catalog; this union is the TypeScript projection of it, bound by the generated
 * artifact and pgTAP 411.
 */
export type PlatformRole = RoleManifestEntry["code"];

/**
 * ⛔ ONE CAST, AND WHY IT IS NOT A HOLE. `Object.fromEntries` is typed to return
 * `{ [k: string]: T }` — it cannot know the key set is exhaustive, so every derivation
 * below needs the annotation. The exhaustiveness that the old hand-written
 * `Record<PlatformRole, …>` object literals got from the compiler is not lost: the key
 * set IS `PlatformRole` by construction, because both are projections of the same
 * array. A role missing from the manifest is missing from the union too, so there is no
 * state in which these records are short of their own key type.
 */
const fromManifest = <T>(pick: (entry: RoleManifestEntry) => T): Record<PlatformRole, T> =>
  Object.fromEntries(ROLE_MANIFEST.map((e) => [e.code, pick(e)])) as Record<
    PlatformRole,
    T
  >;

/** pt-BR labels for every role (docs/design/act-role-picker.md §1). DERIVED. */
export const ROLE_LABELS: Record<PlatformRole, string> = fromManifest((e) => e.label);

/** Which scope each role is assigned at. DERIVED. */
export const ROLE_SCOPE_KIND: Record<PlatformRole, RoleScopeKind> = fromManifest(
  (e) => e.scopeKind,
);

/** Which `SessionContext` field each role partitions into. DERIVED. */
export const ROLE_BRANCH: Record<PlatformRole, LandingBranchKey> = fromManifest(
  (e) => e.branch,
);

/**
 * The precedence chain, DERIVED from the manifest's order.
 *
 * ⚠ The mapped type preserves the TUPLE, not just `readonly PlatformRole[]`: callers
 * that relied on the old `as const satisfies readonly PlatformRole[]` literal tuple —
 * indexing, narrowing, `length` — keep exactly what they had.
 */
type CodesOf<T extends readonly RoleManifestShape[]> = {
  readonly [K in keyof T]: T[K]["code"];
};

// ⛔ THE DOUBLE CAST IS DELIBERATE AND IS THE NARROWEST OPTION, not laziness. `Array.map`
// is typed to return `T[]`, which TypeScript will not narrow to an 11-element TUPLE —
// "target requires 11 element(s), source may have fewer" — so a single `as` is rejected.
// The alternative was to publish `readonly PlatformRole[]`, which WIDENS a type ~10 call
// sites already see as a literal tuple; widening a published type to avoid a cast trades a
// local annotation for a change every consumer inherits. The value is provably the tuple:
// it is `map` over the very array the type is computed from, so the element count and order
// cannot disagree. ⛔ Never `any`.
export const ROLE_ORDER = ROLE_MANIFEST.map((e) => e.code) as unknown as CodesOf<
  typeof ROLE_MANIFEST
>;

const PLATFORM_ROLES = new Set<string>(ROLE_MANIFEST.map((r) => r.code));

/** Whether `value` is a real role code — the picker/hint's own boundary check on
 * untrusted `FormData`/string input (the RPC re-validates regardless; this only decides
 * what the UI renders/submits).
 *
 * ⭐ G4 (ADR 0155) ASKED FOR A TYPED QUERY AGAINST `authz.roles.session_selectable`
 * INSTEAD OF THIS SET. That is not implementable, and the reason is a deliberate design
 * choice one increment earlier, not an oversight: AE4.1 keeps `authz` OUT of
 * `config.toml`'s exposed schemas, and no client role holds USAGE on it — measured,
 * `anon`/`authenticated`/`service_role` are all false for both `has_schema_privilege`
 * and `has_table_privilege('authz.roles','SELECT')`. A runtime query would need a NEW
 * `public` door into the schema AE4 deliberately sealed, bought for a UI pre-filter.
 *
 * ⛔ So the binding is enforced at GATE TIME instead of query time: the committed
 * artifact `supabase/tests/vectors/role_manifest.psql` is compared to THIS manifest by
 * `npm run lint` and to the live `authz.roles` by pgTAP 411. Same "cannot drift
 * silently" property, no new runtime surface. The AUTHORITY was never this Set in any
 * case — `public.assume_role(text)` re-validates `session_selectable`, the caller's
 * account state AND the caller's real assignment, and is the only thing that can
 * actually grant a hat. ⚠ Since ADR 0207 D3 its parameter is `text`, so the enum no
 * longer rejects an unknown string at the call boundary — the door's catalog lookup
 * does, and pgTAP 422 §2.11 is what holds it there.
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
 * The precedence chain `src/app/page.tsx` walks, DERIVED from {@link ROLE_ORDER} rather
 * than written twice. First-wins; a branch that resolves to `null` is empty and the walk
 * continues.
 */
export const LANDING_BRANCHES: readonly LandingBranchKey[] = [
  ...new Set(ROLE_MANIFEST.map((e) => e.branch)),
];

/** What {@link landingRouteForRole} answers when a role's own branch is EMPTY.
 *
 * ⚠ These are not "/" everywhere, and the differences are PRESERVED BEHAVIOUR, not
 * design: the three branches that own a picker fall back to it (an org_admin with no
 * orgs got `/o`, a staff member with no commissions got `/c`), and the rest returned
 * `/`. Every one of these paths is unreachable through the picker, which only offers
 * roles the caller actually holds — they are kept identical anyway, because "unreachable"
 * is a claim about today's callers and this file is imported by four of them.
 *
 * DERIVED per branch from the manifest's per-role `branchEmptyFallback`. ⚠ Roles sharing
 * a branch must declare the same value; `role-catalog.test.ts` asserts that, because
 * nothing here would notice a disagreement — the last writer would simply win. */
const BRANCH_EMPTY_FALLBACK: Record<LandingBranchKey, string> = Object.fromEntries(
  ROLE_MANIFEST.map((e) => [e.branch, e.branchEmptyFallback]),
) as Record<LandingBranchKey, string>;

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

/** Which grant field each scope-summary strategy counts, and its pt-BR plural.
 * ⚠ `none` is absent on purpose: {@link scopeSummary} answers `null` before reaching
 * this table, which is what the old `default:` arm did for `platform_admin` and for any
 * string that is not a role at all. */
const SCOPE_SUMMARY_SOURCE: Record<
  Exclude<ScopeSummaryStrategy, "none">,
  { pick: (g: SessionGrant) => { id: string; name: string } | null; plural: string }
> = {
  organization: { pick: (g) => g.organization ?? null, plural: "organizações" },
  hospital: { pick: (g) => g.hospital ?? null, plural: "hospitais" },
  commission: { pick: (g) => g.commission ?? null, plural: "comissões" },
};

/**
 * A short pt-BR "which scope(s)" summary for a role option — the specific
 * name when the role spans exactly one org/hospital/commission (naming it
 * removes a pointless extra click), else a count phrase. Never names MULTIPLE
 * scopes (D2: scope stays with the switchers that already exist, not this
 * screen).
 *
 * ⭐ DERIVED from the manifest's `scopeSummary` strategy rather than from a switch with
 * three hand-listed role groups — the fifth and last of F7's parallel declarations. The
 * groups are unchanged: organization for `org_admin`/`nsp_org_admin`, hospital for the
 * six hospital-scoped hats, commission for `staff_admin`/`staff`, and `null` for
 * `platform_admin` and for anything that is not a role.
 */
export function scopeSummary(role: string, grants: SessionGrant[]): string | null {
  if (!isPlatformRole(role)) return null;
  const strategy = ROLE_MANIFEST.find((e) => e.code === role)?.scopeSummary;
  if (!strategy || strategy === "none") return null;

  const { pick, plural } = SCOPE_SUMMARY_SOURCE[strategy];
  const scopes = uniqueById(
    grants.filter((g) => g.role === role).flatMap((g) => {
      const scope = pick(g);
      return scope ? [scope] : [];
    }),
  );
  if (scopes.length === 1) return scopes[0].name;
  return `${scopes.length} ${plural}`;
}
