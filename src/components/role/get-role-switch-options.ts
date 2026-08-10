import { getRawGrants, getSessionContext } from "@/lib/queries/session";
import { getSelectableRoles, type SelectableRoleOption, type SessionGrant } from "@/lib/queries/session-grants";

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
 * Two round trips (`getSessionContext()` for `activeRole`, `getRawGrants()`
 * for the raw list `getSelectableRoles` needs) — acceptable here: a
 * `not-found.tsx` render is rare, never a hot path.
 */
export async function getRoleSwitchOptions(): Promise<{
  options: SelectableRoleOption[];
  grants: SessionGrant[];
}> {
  const [context, grants] = await Promise.all([getSessionContext(), getRawGrants()]);
  const activeRole = context?.activeRole ?? null;
  const options = getSelectableRoles(grants).filter((o) => o.role !== activeRole);
  return { options, grants };
}
