# ADR 0101 — The role→landing guard is catalog-derived, not remembered

- **Status:** Accepted (2026-08-07) · **Scope:** QO·FUP F4 · closes **FUP-QO-2**
- **Relates to:** ADR 0079 (standing-invariant discipline), ADR 0094 W4, ADR 0100 D1

## Context

Three times a non-commission-scoped membership role (hospital-/org-scoped,
`commission_id NULL`) shipped with no landing route and its holder saw
"Você ainda não tem acesso" while being fully provisioned: `hospital_admin`
(BUG-HAT-001), the Diretor Técnico (patched after the fact), and `quality_reviewer`
(caught during QO·A planning only because a teammate read the routing chain
unprompted). The Diretor Técnico patch left a comment in `src/app/page.tsx` naming
the mechanism exactly; the class recurred three months later anyway.

A role must cross **two** seams to land: `getSessionContext` must partition the grant
into a `SessionContext` field, and `src/app/page.tsx` must branch on that field.

## Decision

1. **The enumeration boundary is `memberships_role_check`, read from `pg_constraint`
   at test time** — the same derivation pgTAP `292` §3 uses for the grant/revoke-arm
   grid. No remembered list of roles or of routes exists anywhere in the guard.
2. **Both seams run for real.** The role partition was extracted, behaviour-identical,
   into a pure `src/lib/queries/session-grants.ts` (`partitionGrants`) so the guard can
   load it without `next/headers` or the Supabase server client; the guard then invokes
   the **unmodified default export of `src/app/page.tsx`** with only `getSessionContext`,
   `signOut` and `next/navigation.redirect` stubbed. Re-implementing either seam in the
   test would produce a test that passes while the product fails.
3. **Fail loud, never skip.** The guard reads the live catalog through the DB container
   (the idiom every `supabase/tests/mutation/` harness already uses) and **fails** when
   the stack is down. A guard that quietly turns itself off is the "defensive branching
   converts not-implemented into passing" trap.
4. **`KNOWN_UNROUTED` is a ledger, not a mute button.** It is asserted in **both**
   directions — an unlisted unrouted role reds, and a listed role that starts landing
   also reds — so it cannot be satisfied by leaving it alone.
5. Two vacuity controls ship with it: a synthetic role the catalog does not admit must
   report NoAccess (the detector can find something), and the routed roles must not all
   collapse onto one landing URL (no catch-all branch is answering for everyone).

## Consequences

- Adding a role to the CHECK now reds **two** independent grids: `292` §3 (it has a
  grant/revoke arm) and this guard (it has a home). Neither knows about the other.
- `npm run test` gains a dependency on the local Supabase stack for this one file.
  Accepted: `npm run test` already runs in the same Phase-Gate step as `npm run test:db`.
- **The guard fired on its first run.** `nsp_coordinator` and `pqs_member` are
  hospital-scoped with `commission_id NULL`, have no `partitionGrants` filter, and are
  stepped over by every branch — instances **four and five** of the same class, recorded
  in `KNOWN_UNROUTED` and reported. The fix spans `src/app/page.tsx` (frontend-owned).
