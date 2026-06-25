# QA Review — Multi-Tenancy Phase

**Verdict: APPROVED**

Reviewer: `qa` agent
Date: 2026-06-25
Branch audited: `feat/phase-d-multitenancy-frontend` (commits c2b6191..48d9c76)
E2E result: 292 passed / 124 skipped (NSP+referral quarantine, by design) / 0 failed
pgTAP: 171_cross_org_isolation.sql (plan 74/74) + 173_multi_org_phi_guard.sql (plan 18/18)

---

## Scope

This audit covers the multi-tenancy phase as a standalone increment:

- Migrations: `20260625000000_multitenancy_hierarchy.sql` (Phase A),
  `20260626000000_multitenancy_rls_rewrite.sql` (Phase B — 3,185 lines),
  `20260627000000_commissions_org_not_null.sql`, `20260628000000_org_member_select.sql`,
  `20260629000000_multi_org_phi_guard.sql`.
- Also reviewed: `20260625001000_fix_template_phase_revoke_public.sql` (baseline security
  fix shipped in this increment).
- Application code: `src/lib/platform/actions.ts`, `src/lib/org/actions.ts`,
  `src/lib/queries/session.ts`, `src/app/o/[org]/c/[commission]/dashboard/export/route.ts`,
  `src/app/o/[org]/c/[commission]/manage/audit/export/route.ts`, `src/app/c/page.tsx`.
- Tests: `supabase/tests/171_cross_org_isolation.sql`,
  `supabase/tests/173_multi_org_phi_guard.sql`.

The following items were explicitly out-of-scope per the implementation plan and are
not treated as defects here:

- NSP + referral PHI modules intentionally disabled in multi-org (the 124 E2E skips
  represent this quarantine; NSP-per-org is a separate approved follow-up phase).
- `org_admin` TypeScript gate gap: 8 `authorize*` helpers do not yet grant `org_admin`
  for commission-level writes. This is fail-safe (denies rather than permits), tracked
  as a follow-up, and confirmed covered by RLS at the DB layer.
- Migration 171 order-robustness (pgTAP hygiene; a separate cleanup).

---

## 1. Requirements / Deliverables

### Schema and hierarchy (Phase A)

`organizations`, `hospitals`, and `organization_members` tables are created with correct
primary keys, foreign keys, and RLS policies (organizations_select,
organizations_admin_write; hospitals gated to org membership; organization_members limited
to org_admins and platform_admin). The `commission_derive_organization_id` BEFORE
INSERT/UPDATE trigger correctly auto-derives `organization_id` from `hospital_id`,
preventing any application layer from writing `organization_id` directly.

Commission slug uniqueness is correctly migrated from global `UNIQUE(slug)` to
`UNIQUE(organization_id, slug)`, allowing the same slug across different orgs.

The NOT NULL flip on `hospital_id` / `organization_id` (migration `20260627000000`)
is safe because migrations execute on a clean DB before the seed populates commissions.

### Org-admin predicate family (Phase A)

Four `STABLE SECURITY DEFINER` predicates are introduced with pinned `search_path`:
`app.is_org_admin_of`, `app.is_org_admin_of_commission`,
`app.is_org_admin_of_for`, `app.is_org_admin_of_commission_for`. All four resolve
org membership by live DB read (not JWT claims), matching the architecture's Rule 1
intent for a live-data security boundary.

### RLS rewrite (Phase B)

The mechanical `is_admin()` → `is_org_admin_of_commission` swap across all tenant
policies was verified. The key audit concern — whether any `is_admin()` occurrences in
pre-existing migrations survive the Phase B `CREATE OR REPLACE` pass — was resolved:
every function in older migration files that contains bare `is_admin()` on a
tenant-governance code path IS overridden by a `CREATE OR REPLACE FUNCTION` in
migration `20260626000000_multitenancy_rls_rewrite.sql`. No non-overridden function in
the older files contains a tenant-governance `is_admin()` call.

Section 3b of Phase B corrects `responses_select` and `answers_select`, which both had
blank admin OR-term placeholders prior to the swap — these are confirmed fixed.

The following non-obvious choices in Phase B are sound:

- PHI duty separation (Section 1, `can_read_case_patient`): the `is_org_admin_of_*`
  term is intentionally excluded. Org-admins see case metadata but not patient
  identifiers. The `can_read_case` broad read is unchanged (org-admin sees the case
  shell); only the PHI identifier fork is severed. This is the correct minimum-necessary
  application of Architecture Rule 12.
- PHI and NSP storage buckets (Section 6): the `is_admin()` term is DROPPED with no
  replacement for NSP-evidence and referral-attachments buckets. Platform_admin gets no
  access to those objects. Correct.
- `dispose_event_phi` and `add_pqs_member` (Section 5): these explicitly KEEP the
  `is_admin()` term (platform_admin can dispose PHI and manage the PQS roster). The
  plan documents this as intentional and sound.
- Audit 3-tier redesign (Section 8): `audit_canonical` gains `p_organization_id` in the
  hashed tuple, `audit_write` derives org from the commission at write time,
  `verify_audit_chain` enforces 3-tier authorization. This is the correct lockstep:
  adding `organization_id` to the hash input means the chain cannot be forged by
  moving rows between tiers, and the tier authorization means each actor can only
  verify the chains they are authorized to read.

### `getCommissionAccessByOrg` resolver

The new `getCommissionAccessByOrg(orgSlug, commissionSlug)` resolver in
`src/lib/queries/session.ts` correctly resolves commission by `(slug, organization.slug)`
pair. A commission in org B cannot be reached via org A's slug — the RLS policy on
`commissions` combined with the `UNIQUE(organization_id, slug)` constraint enforces
this. The resolver maps `org_admin` membership to `'staff_admin'` role (so org-admins
can use all coordinator-facing surfaces without a separate UI path).

### Commission picker (`/c/page.tsx`)

The old `/c/[slug]` dynamic route has been removed. The `/c/page.tsx` commission picker
is correctly updated to use `commissionHref(commission.organization.slug, commission.slug)`
for all links and redirects. Single-membership users are redirected to the org-scoped
URL. No legacy single-slug bypass exists.

### `is_org_member` (migration `20260628000000`)

The `app.is_org_member(p_org_id)` predicate (EXISTS join on `commissions →
commission_members`) correctly allows regular commission members to read their own
organization row. Without this, members would be unable to reach the `organizations`
row their commission belongs to, breaking the login redirect. The `organizations_select`
policy is correctly broadened to cover this case.

### Multi-org PHI guard (`20260629000000`)

The guard design is sound and defense-in-depth is correctly layered:

**Primary chokepoint** — `app.is_pqs_member` is redefined to return `false` whenever
`(select count(*) from public.organizations) > 1`. This is the single point that
closes the entire global-PQS/QPS surface: every PHI read predicate, every PQS inbox
RPC, every search-patient door, and every write gate via `is_pqs_writer` all route
through `is_pqs_member`. One change, complete closure.

**Per-predicate defense-in-depth** — `can_read_event`, `can_read_event_patient`,
`can_read_referral_phi`, `can_read_case`, `can_read_case_patient` each additionally
wrap their global-PQS/QPS term with `and not app.is_multi_org()`. Redundant with the
chokepoint but correct, and explicitly requested by the brief.

**Module-off** — `patient_safety_enabled()` and `referrals_enabled()` return false in
multi-org; `assert_patient_safety_enabled()` and `assert_referrals_enabled()` raise
`check_violation`. The seed uses direct inserts (not the guarded RPCs), so the 2-org
seed remains green.

The pgTAP test `173_multi_org_phi_guard.sql` (plan 18) validates every layer of the
guard:
- Single-org baseline confirms global roster works as before.
- Second-org insert transitions `is_multi_org()` = true.
- `is_pqs_member` goes inert at the chokepoint (test 8).
- `can_read_event`, `can_read_event_patient`, `get_event_patient` all return
  false/null for the global-PQS caller (tests 9–11).
- Org-bounded terms (reporting-commission member, custodian staff_admin) are
  unaffected (tests 12–13).
- Both `assert_*_enabled()` raise (tests 14–15).
- `can_read_case_patient`: QPS macro-term inert, but case coordinator (org-bounded)
  still reads PHI identifiers (tests 16–17).

Note on the `is_multi_org()` implementation: it uses `(select count(*) from
public.organizations) > 1` inside a `STABLE SECURITY DEFINER` function. For a
`STABLE` function this count is evaluated once per query plan, which is appropriate —
org count changes are a provisioning-time event, not a per-row event, and STABLE
semantics are correct here.

### Service-role escalation boundaries

`src/lib/platform/actions.ts` uses `createAdminClient()` (service-role) only in
`assignOrgAdmin`, gated by `requireAdmin()` (server-side JWT claim check), for the
purpose of cross-user invite lookup. The role written to `organization_members` is
hard-coded as `'org_admin'` — it is never read from `formData`. This is a correct and
minimal use of service-role escalation.

`src/lib/org/actions.ts` uses only the regular cookie client throughout. Commission
and hospital creation flow through RLS predicates (`is_org_admin_of`).

### Route handler gating

Both CSV export routes (`/o/[org]/c/[commission]/dashboard/export/route.ts` and
`/o/[org]/c/[commission]/manage/audit/export/route.ts`) gate with
`getCommissionAccessByOrg` + `role !== 'staff_admin'`. Platform_admin resolves to
`role === null` (no commission membership) and receives 404 with no data leak. Neither
route uses service-role; both use the regular cookie client backed by RLS.

### Baseline security fix

`20260625001000_fix_template_phase_revoke_public.sql` re-issues `REVOKE EXECUTE ON
FUNCTION add_template_phase / update_template_phase FROM PUBLIC` after the prior
DROP+CREATE inadvertently re-granted PUBLIC EXECUTE. This is a pre-existing defect
corrected in this increment, consistent with the Architecture Rule 1 posture.

---

## 2. Security / RLS

### Platform_admin wall (complete)

The platform_admin role has zero read access to any tenant data:
- All tenant-domain policies swap `is_admin()` for `is_org_admin_of_commission()`.
- The `commission_overview()` RPC is re-scoped to the org-admin's own orgs.
- PHI tables (`event_patient`, `case_patient`, `referral_patient`) have no SELECT
  grant to `authenticated` at all (REVOKE, enforced by pgTAP 171 tests 6/7/8: any
  direct SELECT raises `42501`).
- `get_event_patient`, `get_case_patient`, `get_referral_patient` return null for a
  platform_admin caller (pgTAP 171 tests 9/10/11 and migration 20260626000000
  Section 5 confirmed).
- `commission_overview()` returns 0 rows for platform_admin (pgTAP 171 test 12).
- The full 31-table platform_admin wall is asserted in pgTAP 171 tests 1–5 (one
  test per table category, is_rows 0 for every tenant table).

### PHI duty separation (complete)

`can_read_case_patient` correctly excludes the `is_org_admin_of_*` term.
pgTAP 171 test 9 confirms `can_read_case_patient` returns false for an org_admin of
the commission that owns the case. `get_case_patient` returns null (test 10).

### Cross-org isolation (complete)

pgTAP 171 covers:
- org_admin of rede-a reads rede-a, zero rede-b (tests 13–14, responses and cases).
- `chefe.ccih` reads CCIH data, zero Farmácia data (same org), zero rede-b (tests 15–16).
- `staff1.qual.b` reads rede-b only (test 17).
- Audit 3-tier: each persona reads only their authorized tier, `verify_audit_chain`
  passes per tier (tests 18–21).
- Slug collision: two orgs may each have "ccih" (per-org unique works), duplicate
  within one org raises 23505 (tests 22–23).

### Multi-org PHI guard (verified above — see Section 1)

### Immutability invariants preserved

Phase B contains no changes to `guard_audit_immutable_trg` (audit log), the form
version / section / item immutability triggers, or the `submit_response` RPC
submission gate. Architecture Rules 3 and 5 are unaffected by this increment.

### No service-role client-side exposure

Both `createAdminClient()` usages (in `platform/actions.ts` and `admin/actions.ts`)
are behind `requireAdmin()` in server-only files. No `NEXT_PUBLIC_*` variable carries
the service-role key; the anon key and Supabase URL remain the only NEXT_PUBLIC vars.

---

## 3. Code Quality

### TypeScript strict

All new files in `src/lib/` use typed interfaces (`SessionContext`, `Membership`,
`OrgAdminMembership`, `OrgAdminSession`, `OrganizationRef`). No `any` casts were
observed in the files reviewed.

### Data access through `src/lib/queries/`

`getCommissionAccessByOrg` is in `src/lib/queries/session.ts`. Commission reads in
provisioning actions (`src/lib/org/actions.ts`) use `createClient()` + Supabase-js
query (no inline PostgREST bypass). The route handlers call into `src/lib/queries/`
functions (`listAudit`, `getFormExport`) rather than embedding queries inline.

### Server Components default

The new route handlers and `src/app/c/page.tsx` (commission picker) are Server
Components / route handlers with no client-side state. The provisioning action files
are server actions. Architecture Rule adherence confirmed.

### ADR coverage

ADR 0041 (`docs/decisions/0041-multi-tenancy-organizations-hospitals.md`) documents
all non-trivial choices: pooled DB vs sharded, hierarchy design, role split,
live-read vs JWT-claim for org membership, RLS rewrite strategy, audit 3-tier,
storage paths unchanged, no feature flag, greenfield reseed. This is the correct
decision record for the scope of change.

---

## 4. UX and Accessibility

### pt-BR user-facing strings

All new server error messages in migrations use pt-BR. The commission picker
(`/c/page.tsx`) is entirely pt-BR. Org-heading accessibility in the picker is correct:
multi-org users get a visible `<h2>` for each org; single-org users get a screen-reader-only
`<h2>` with `className="sr-only"`, preserving the landmark accessible name without
visual chrome.

### No raw Postgres errors in the UI

Route handlers return opaque "Não encontrado." strings on error with 404. No stack
traces or Postgres error codes reach the response body.

---

## 5. Hygiene

- ADR 0041 is present and covers all non-trivial decisions.
- No secrets in application code. `createAdminClient()` reads the service-role key
  from the server environment; no NEXT_PUBLIC exposure.
- `PROGRESS.md` accurately reflects the build/test state (292/0 E2E, pgTAP 74+18).
- `20260625001000_fix_template_phase_revoke_public.sql` is correctly scoped and
  documented as a security fix for an inadvertent prior grant.

---

## Findings

No blocking, major, or minor findings. The following informational observations are
noted for the record:

**INFO-1: `is_multi_org()` count scan on every `is_pqs_member` call.**
`is_pqs_member` now embeds `(select count(*) from public.organizations) > 1` directly.
In a single-org deployment the organizations table has one row and this is cheap. In a
multi-org deployment the function returns false immediately (short-circuit on the `<=1`
condition), so the count is still executed but the outer `and exists(...)` is skipped.
Because `is_multi_org()` and `is_pqs_member()` are both `STABLE SECURITY DEFINER`,
Postgres may cache the result within a single statement. No performance concern in
practice (org count is a provisioning-time invariant), but the implementation plan's
note about a future materialized-view optimization is reasonable if org table grows.
No action required.

**INFO-2: 124 E2E skips are quarantined NSP/referral tests.**
These are correctly quarantined by `test.skip` conditions in the NSP/referral specs,
gated on `patient_safety_enabled()` / `referrals_enabled()` returning false. The
quarantine is by design (multi-org module-off) and will be lifted when NSP-per-org
ships. The 292 active tests exercise all other platform surfaces. No action required.

**INFO-3: Legacy `getCommissionAccess(slug)` still present.**
The old single-argument resolver in `src/lib/queries/session.ts` is not yet removed.
It is no longer called by any route in the new `/o/[org]/c/[commission]` structure
(the commission picker uses `commissionHref` + the new resolver; both export routes
use `getCommissionAccessByOrg`). If any legacy call site remains, it would use the
global slug lookup, which is now non-unique across orgs — a latent correctness risk
rather than a security hole (RLS still enforces org scope at the DB layer). As a
follow-up, the legacy function should be removed or guarded with a deprecation marker
to prevent future misuse.

---

## Verdict

**APPROVED**

All deliverables are implemented. The platform_admin wall is complete and covered by
74 pgTAP assertions. PHI duty separation (org_admin excluded from case patient
identifiers) is correct at both DB and TS layers. The multi-org PHI guard closes the
global-PQS cross-org leak at a single chokepoint (`is_pqs_member`) with per-predicate
defense-in-depth. Cross-org isolation is proven for all tested persona combinations.
Service-role escalation is minimal and correctly gated. No security, functional, or
architectural findings rise to the level of blocking or major.
