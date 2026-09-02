import type { Database } from "@/lib/types/database";
import type { SessionGrant } from "@/lib/queries/session-grants";
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

function sortByName<T>(list: T[], name: (item: T) => string): T[] {
  return [...list].sort((a, b) => name(a).localeCompare(name(b), "pt-BR"));
}

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of list) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

/**
 * The role → landing-route table (`docs/design/act-role-picker.md` §1),
 * mirroring `src/app/page.tsx`'s own precedence branches — but resolved for
 * ONE exact role value against the grants that carry it, rather than the
 * whole hat-blind partition. This is what lets a caller holding BOTH
 * `staff_admin` and `staff` (different commissions) land correctly regardless
 * of which of the two hats they pick — `page.tsx`'s `memberships` list merges
 * the two roles, but the hat picked here is the exact `active_role` claim
 * that will be minted, so the route must be derived from that same exact role.
 *
 * `platform_admin` is included for completeness (`page.tsx`'s row 1) even
 * though it can never appear in a real `grants` array (D11 — it lives in
 * `profiles.is_admin`, never a `memberships` row, so `getSelectableRoles`
 * never emits it and the picker never offers it).
 */
export function landingRouteForRole(role: string, grants: SessionGrant[]): string {
  const roleGrants = grants.filter((g) => g.role === role);

  switch (role) {
    case "platform_admin":
      return "/admin";

    case "org_admin": {
      const orgs = uniqueById(
        roleGrants.flatMap((g) => (g.organization ? [g.organization] : [])),
      );
      return orgs.length === 1 ? orgHref(orgs[0].slug, "manage") : "/o";
    }

    case "hospital_admin": {
      const orgs = roleGrants.flatMap((g) => (g.organization ? [g.organization] : []));
      const orgSlugs = new Set(orgs.map((o) => o.slug));
      return orgSlugs.size === 1 && orgs[0] ? orgHref(orgs[0].slug, "manage") : "/o";
    }

    case "nsp_org_admin": {
      const orgs = sortByName(
        uniqueById(roleGrants.flatMap((g) => (g.organization ? [g.organization] : []))),
        (o) => o.name,
      );
      return orgs[0] ? orgHref(orgs[0].slug, "nsp-org") : "/";
    }

    case "nsp_coordinator":
    case "pqs_member": {
      const withHospital = sortByName(
        roleGrants.filter((g) => g.organization && g.hospital),
        (g) => g.hospital!.name,
      );
      const first = withHospital[0];
      return first?.organization ? nspHref(first.organization.slug) : "/";
    }

    case "technical_director":
    case "technical_director_deputy": {
      const withHospital = sortByName(
        roleGrants.filter((g) => g.organization && g.hospital),
        (g) => g.hospital!.name,
      );
      const first = withHospital[0];
      return first?.organization ? orgHref(first.organization.slug, "direcao-tecnica") : "/";
    }

    case "quality_reviewer": {
      const withHospital = sortByName(
        roleGrants.filter((g) => g.organization && g.hospital),
        (g) => g.hospital!.name,
      );
      const first = withHospital[0];
      return first?.organization ? qualidadeHref(first.organization.slug) : "/";
    }

    case "staff_admin":
    case "staff": {
      const commissionGrants = roleGrants.filter((g) => g.commission);
      if (commissionGrants.length === 1) {
        const c = commissionGrants[0]!.commission!;
        return commissionHref(c.organization.slug, c.slug);
      }
      return "/c";
    }

    default:
      return "/";
  }
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
