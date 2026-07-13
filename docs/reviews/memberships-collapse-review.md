# QA Review — S1·MEM Single `memberships` Collapse

**Reviewer:** `qa` · **Date:** 2026-07-13 · **Verdict:** ✅ **APPROVED**
**Scope:** `docs/plans/memberships-collapse-s6-1.md` §6/§7 · S0 §I (MEM O-1..O-6) + §F.2 ·
ADR 0075 · migrations `20260720000000..000500` · `supabase/tests/224_memberships_collapse.sql`
+ repointed fixtures · the write-path/actions + `src/lib/queries/*` repoints + `audit.ts` +
`audit-icon.tsx`.
**Gate inputs (as reported):** pgTAP 2158/0 (incl. new `224` 61/61) · Vitest 356 · lint/typecheck 0 ·
full `e2e:prod` 586p/0f/8flaky.

**Method:** graphify orient (TS only — SQL bodies are not indexed) → direct migration reads →
**live catalog + runtime probes** against the running local stack
(`supabase_db_azkbbhskturikxpgmafq`) → incumbent-authority cross-check (verified against the
pre-MEM migration definitions) → pgTAP/E2E fixture read. This is a 145-site RLS collapse; every
security-critical claim below was checked against the live catalog, not just the migration text.

---

## Verdict rationale

The collapse meets its acceptance contract and its ratified decisions. Every WS-1 invariant is
carried verbatim and holds at the catalog level; the door authority arms are incumbent-verbatim
with **no privilege widening**; the predicate family resolves entirely through `has_role`; the
missed-predicate risk (the headline risk) was caught by the backend and is covered by a
positive+negative pgTAP pair; the unified audit is PHI-free and hard-cuts the legacy verbs; and
the CASCADE collateral was correctly bounded to the two `profiles` policies and restored
byte-for-byte. No Blocker or Major finding. Three cheap **minor** items are noted for the lead's
pre-Record discretion; none blocks.

---

## Checklist findings (per the §7 QA scope)

### 1. No direct write path on `memberships` — ✅ VERIFIED (catalog + runtime)
- `pg_policies` for `memberships`: exactly **one** policy, `memberships_select` (SELECT,
  `{authenticated}`). No INSERT/UPDATE/DELETE/ALL policy.
- `role_table_grants`: `authenticated` holds **SELECT only**; no anon/PUBLIC DML grant.
- pgTAP `224` §1/§2 prove it at runtime: a direct INSERT/UPDATE/DELETE as a seeded `org_admin`,
  `staff_admin` (the newly-locked commission path, readiness 2b), and `nsp_org_admin` each throws
  `42501`. E2E asserts the crafted `/rest/v1/memberships` POST/PATCH/DELETE → 401/403.
- The SELECT policy (`20260720000000` L125-141) is a sound union of the three retired SELECT
  policies (self-read + commission member/admin + org-admin + hospital org/hospital-admin), no
  wider than the incumbents.

### 2. Door authority = incumbent verbatim; no privilege widening — ✅ VERIFIED
Cross-checked every `grant_role`/`revoke_role` arm against the last pre-MEM definition of each
`assign_*`/`revoke_*`/`add_pqs_member` RPC and the `commission_members_admin_all` /
`commission_members_staff_admin_update` policies:
- org_admin (`is_admin() OR is_org_admin_of`), nsp_org_admin (`is_org_admin_of`), hospital_admin
  (`is_org_admin_of(org_of_hospital)`), nsp_coordinator (`is_nsp_org_admin_of(org_of_hospital)`
  only — ADR 0052 D3, hospital_admin has no NSP power), pqs_member
  (`is_nsp_org_admin_of OR is_nsp_coordinator_of`), staff/staff_admin
  (`is_commission_admin_of` ± `is_staff_admin_of`) — all match verbatim.
- `_deny_self_grant` stays **`42501`** (grant path only, correct — revoke is not a self-grant).
- **HC0G1 anti-lockout** (last org_admin) present and correctly guarded (counts org_admins,
  only blocks when the target is the last one); pgTAP §4 proves both the non-last success and the
  last-admin `HC0G1` rejection.
- Staff **cannot** self-escalate to staff_admin: the `staff_admin` arm requires
  `is_commission_admin_of` (a plain `staff_admin` is not sufficient), stays `42501`; pgTAP §3.3
  (plain staff) and §3.4 (clean staff_admin) both lock it.

### 3. Shape CHECK exhaustive — ✅ VERIFIED (runtime)
`memberships_scope_shape` closes with `else false`; `memberships_role_check` belts the vocabulary;
`memberships_title_scope` pins `title_id` to commission rows. Runtime probes and pgTAP §10 confirm
rejection of: `staff`+org_id, `org_admin`+commission_id, `pqs_member`+null hospital, `hospital_admin`
+null org, and `title_id` on a non-commission row (all `23514`), with a passing control row.

### 4. Predicate wrappers behavior-preserving; no missed predicate — ✅ VERIFIED
- Live catalog closure: **every** `app.is_*` predicate that touches membership resolves via
  `has_role`/`has_role_any` or delegates to a wrapper that does (18 membership-reading predicates
  enumerated); the only non-delegating `is_*` are the category-C non-membership validators
  (`is_active`, `is_admin`, `is_document_version_approver`, `is_valid_*`).
- `has_role`/`has_role_any` are `stable security definer`, **owner=postgres**, `search_path`-pinned
  (`app, public, pg_catalog`), with t19 grants (`revoke all from public; grant execute to
  authenticated, service_role`); no PUBLIC/anon EXECUTE on the family or the door.
- `is_active(uid)` is retained inside every wrapper (never folded into `has_role`).
- **Missed-predicate risk resolved:** the spec's "27-name" wrapper list was inaccurate
  (`is_org_admin_of_commission/_for` do not exist; the real combined predicate is
  `is_commission_admin_of`). The backend caught this AND caught `is_entitled_document_approver`,
  which read `commission_members` and was **absent from the spec's list**; it was repointed
  (`20260720000100` L280) and is covered by pgTAP §7.10 (positive) + §7.11 (negative). No membership
  predicate still references a legacy table (catalog scan: 0 function bodies, 0 policies).
- pgTAP §7 covers the composed wrappers meaningfully (`is_pqs_operator_of` for coordinator-only and
  member-only; `is_commission_admin_of` positive/negative; `is_pqs_operator_in_org`;
  `is_pqs_member_of_any` positive/negative in §8). The tier wrappers not asserted in `224`
  (`is_org_admin_of`, `is_hospital_admin_of`, `is_pqs_writer_of`) are exercised by the existing
  tier pgTAP (170/184/176/175) on the post-MEM schema and by the full-suite parity oracle.

### 5. Unified `membership.*` audit; PHI-free; legacy hard-cut — ✅ VERIFIED
- `trg_audit_memberships` emits `membership.granted`/`.role_changed`/`.revoked`; UPDATE only audits a
  real role change (title-only update is intentionally unaudited display metadata).
- Metadata is `role + user_id + org/hospital/commission ids` only; summary carries the role name.
  A catalog scan for `full_name|email|title|payload|answer` in the trigger body matched **comments
  only** — the emitted payload is genuinely PHI-free (Rule 11). pgTAP §6.4 locks the no-PHI invariant.
- The three legacy verb families are fully retired (no emitter remains; the only residue is comment
  text in `20260720000400`); pgTAP §6.3 asserts their absence. `verify_audit_chain` is verb-agnostic,
  so chain integrity is untouched.

### 6. ADR 0075 write-path split — ✅ SOUND
The service-role writers (`addStaff`, `assignStaffAdmin`, `assignOrgAdmin`, `registerUser`,
`assignMemberCommittee`) keep a **direct** service-role insert into `memberships` (RLS-exempt,
already TS-authorized; the door would fail on their NULL `auth.uid()`); the RLS-scoped removers
(`removeStaff`, `removeStaffAdmin`) route through the `revoke_role` door. Both paths are audited by
the blanket trigger (triggers are role-agnostic), and neither widens privilege. The boundary holds:
`authenticated` has no direct DML grant, so an ordinary PostgREST client cannot write. Truthful, safe
split — not a hole. The on-conflict key in every service-role upsert matches `memberships_grant_uq`
(`principal_id, role, organization_id, hospital_id, commission_id`) exactly.

### 7. CASCADE fix (`20260720000500`) — ✅ VERIFIED
Both `profiles` SELECT policies are present and restored byte-for-byte with only the raw
`commission_members` join repointed to `memberships` (commission-scope rows), preserving the exact
authorization arms. A `pg_policies` scan confirms these were the **only** two CASCADE victims — no
other policy carries a raw membership-table reference. Correct diagnosis and minimal fix.

### 8. `case_access` kept separate — ✅ VERIFIED
`case_access` still exists with no `role` column and retains `level`; no role/`memberships` coupling.
pgTAP §12 locks this. (Case reads continue to resolve via `can_read_case`/`can_write_case_content`,
untouched by the collapse.)

### 9. BUG-MEM-001 fix quality — ✅ VERIFIED
The second `memberships→profiles` FK (`granted_by`) made bare `profiles(...)` embeds ambiguous
(PGRST201). `members.ts` and `commissions.ts` correctly pin `profiles!memberships_principal_id_fkey`
(and `memberships!memberships_commission_id_fkey`) and add `{ error }` checks that distinguish an
RLS-empty result from a genuine failure (no silent empty-masquerade). Spot-check of every other
`memberships` read: the remaining profile embeds (`pqs.ts`, `org.ts`) use the equivalent
`profiles:principal_id(...)` FK-column disambiguation — no other ambiguous embed exists.

### 10. Frontend-owned `audit-icon.tsx` touch — ✅ CORRECT / MINIMAL
Single entity-key rename `commission_member` → `membership` with an explanatory comment; consistent
with `audit.ts`'s `AuditEntityType`/`AuditAction` union and pt-BR label updates
(`Membro`→`Função`; unified verb labels). Note for the frontend record: this is the one FE-visible
string movement (audit-viewer labels), a deliberate D1 hard-cut with no legacy aliases.

---

## Minor findings (non-blocking; cheap-to-clear — lead's discretion before Record)

- **m1 · grant/revoke `is_admin()` asymmetry on the commission arms.** `grant_role` admits
  `is_admin()` on the `staff`/`staff_admin` arms; `revoke_role` does **not** (its commission arms are
  `is_staff_admin_of`/`is_commission_admin_of` only). Versus the incumbent `commission_members_admin_all`
  (an ALL policy = `is_admin() OR is_org_admin_of_commission`), this is a **narrowing** on revoke
  (safe direction) — a platform_admin who could delete a commission_member via RLS now cannot revoke
  via the door. No live caller exercises it (`removeStaff`/`removeStaffAdmin` are org-admin-gated in
  TS, and `platform_admin` is "walled off from all tenant data" per CLAUDE.md §1), so there is no
  functional regression. Still, the grant-vs-revoke inconsistency should be **intentional and
  commented** in the door (one line), or `is_admin()` added to the two revoke arms for symmetry.
  `docs/decisions/0075` L46-47 asserts "no door authority is widened" but is silent on this
  deliberate narrowing — worth a sentence.

- **m2 · `is_pqs_operator_of` (bare) uses `auth.uid()`, not `(select auth.uid())`.** Every other
  rewritten wrapper carries the WS-5 InitPlan wrap `(select auth.uid())` (plan §8). The bare
  `is_pqs_operator_of` (`20260720000100`, delegating form) uses a bare `auth.uid()`. Correctness is
  unaffected; it is a per-row InitPlan micro-inconsistency in a predicate used in tightened SELECTs.
  Trivial to align.

- **m3 · pgTAP `224` §7.7/7.8/7.9 assert `is not null` (resolves without error) rather than a
  true/false truth pair** for `is_org_level_admin_within`, `is_hospital_member_of`, `is_org_member`.
  These are membership-reading predicates and deserve the same positive+negative pair the rest of §7
  uses; today their behavior parity leans on the full-suite oracle rather than a self-contained lock.
  A cheap hardening, not a gap (the predicates are exercised true-path elsewhere).

---

## Documentation / hygiene
- ADR 0075 exists and correctly records the write-path split + the CASCADE addendum (subject to m1's
  one-sentence gap on the deliberate revoke narrowing).
- `seed.sql` is re-expressed to `memberships` (0 legacy-table inserts); the live table carries all
  seven roles incl. the synthetic `pqs_member`, matching the E2E persona roster (the parity oracle).
- Types regenerated (`database.ts` in the change set); `pqs`/`org`/`session`/`org-users`/`meetings`
  reads repointed behind frozen signatures — the "no frontend change" promise holds for every
  exported signature.

**Final verdict: APPROVED.** The three minor items are cheap and optional; recommend clearing m1
(a one-line comment or the symmetric `is_admin()` add) and m2 during Record per the standing
"clear cheap MINORs before phase record" preference, and filing m3 as a test-hardening follow-up.
