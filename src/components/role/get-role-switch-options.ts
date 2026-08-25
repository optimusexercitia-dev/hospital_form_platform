import { getRawGrants, getSessionContext } from "@/lib/queries/session";
import { getSelectableRoles } from "@/lib/queries/session-grants";
import { landingRouteForRole } from "@/lib/role/role-catalog";

/**
 * ACT (ADR 0106 D9) — resolves the `RoleSwitchHint` props for a `not-found.tsx`
 * boundary: the caller's hat-blind role options, MINUS whichever hat is
 * currently active (suggesting "switch to the hat you already have" is
 * meaningless — and was confirmed live during this build: a single-role
 * `org_admin` hitting an unrelated invalid-id 404 inside their OWN manage
 * area saw "your org_admin role has broader access here, switch?", which is
 * exactly this bug). Computed purely from the caller's own session (D9); the
 * boundary calling this is the "caller" — `RoleSwitchHint` itself still does
 * no I/O of its own.
 *
 * ⚠ Each option carries its PRE-COMPUTED `landing` route, and the raw grants
 * are deliberately NOT returned: `RoleSwitchHint` is a client component, so
 * every prop it receives serializes into the page's RSC payload — passing the
 * grant list shipped the caller's own commission ids/names/slugs in the SOURCE
 * of every signed-in 404, which `phase2-auth-shell.spec.ts`'s "404 body names
 * no commission" security assertion caught on the full gate (2026-08-10).
 * Only `{role, count, landing}` strings cross the client boundary now.
 *
 * Two round trips (`getSessionContext()` for `activeRole`, `getRawGrants()`
 * for the raw list `getSelectableRoles` needs) — acceptable here: a
 * `not-found.tsx` render is rare, never a hot path.
 */
export interface RoleSwitchHintOption {
  role: string;
  count: number;
  /** Where "Trocar agora" lands — resolved server-side from the grants so the
   * grants themselves never serialize to the client. */
  landing: string;
}

export async function getRoleSwitchOptions(): Promise<{
  options: RoleSwitchHintOption[];
}> {
  const [context, grants] = await Promise.all([getSessionContext(), getRawGrants()]);
  const activeRole = context?.activeRole ?? null;
  const options = getSelectableRoles(grants)
    .filter((o) => o.role !== activeRole)
    .map((o) => ({ ...o, landing: landingRouteForRole(o.role, grants) }));
  return { options };
}
