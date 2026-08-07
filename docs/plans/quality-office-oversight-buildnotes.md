# QO·A Build Notes — catalog re-verification (Task A.0)

**Author:** `backend` · **Date:** 2026-08-06 · **Branch:** `feat/quality-office-oversight`
(302 migration files == 302 registered, top `20260910000400` — clean at verification time).
Every claim below was re-proven against the **live catalog**
(`docker exec supabase_db_azkbbhskturikxpgmafq psql`), comment-stripped where regex was
involved (authz-handoff §7.2 idiom). Plan under audit:
[quality-office-oversight.md](./quality-office-oversight.md) §A.1/§A.2/§A.4/§A.5.

## 1. Discrepancy table

| # | Plan claim | Verdict | Live truth |
|---|-----------|---------|------------|
| 1 | `memberships_role_check` = 9-role ANY array | **CONFIRMED** | `org_admin, nsp_org_admin, hospital_admin, nsp_coordinator, staff_admin, staff, pqs_member, technical_director, technical_director_deputy` |
| 2 | `memberships_scope_shape` CASE-per-role; `nsp_coordinator` arm org+hosp NOT NULL, commission NULL | **CONFIRMED** | Plus `ELSE false` (fails closed — the new role NEEDS its own arm) and a third CHECK `memberships_title_scope` (untouched by M1) |
| 3 | `is_nsp_coordinator_of/_of_for` template = `is_active(u) AND has_role('hospital', h, role, u)` | **CONFIRMED** | Both STABLE SECURITY DEFINER, `SET search_path app,public,pg_catalog`. ⚠ ACL nuance: the NSP pair rides **default (NULL) ACLs**; the admin helpers carry explicit `{postgres,authenticated,service_role}` grants. New helpers get the **explicit** shape (REVOKE PUBLIC → GRANT authenticated, service_role) |
| 4 | `has_role`/`has_role_any` already filter `expires_at` | **CONFIRMED** | `(m.expires_at is null or m.expires_at > now())` in both |
| 5 | `commissions` has no `quality_oversight` | **CONFIRMED** | 8 columns; no collision |
| 6 | `set_case_visibility` discipline to copy | **CONFIRMED** | P0002 not-found → **authority FIRST** (HC0F5, with the M1·4 ordering comment) → exclusion (`assert_not_case_excluded`, **no commission-level analogue — omitted in M2** by design) → validation (HC0F6) → txn-local GUC bracket `set_config(...,true)` → explicit `app.audit_write` incl. previous value. ACL `{postgres, service_role, authenticated}` = REVOKE-PUBLIC-then-GRANT |
| 7 | `guard_case_visibility` discipline | **CONFIRMED** | `coalesce(current_setting('app.in_case_rpc', true),'off')='on'` + **`IS DISTINCT FROM` mandatory** (in-body comment explains the `BEFORE UPDATE OF` fires-on-mention trap) + `check_violation` |
| 8 | `quality_reviewer` rejected TODAY, fail-closed | **CONFIRMED — RED-PROVEN BY EXECUTION** | Called both impls with a real org_admin actor (`orgadmin.a`): grant → `SQLSTATE=HC0G0`, revoke → `SQLSTATE=HC0G0` |
| 9 | TD authority shape to mirror | **CONFIRMED** | `is_org_admin_of_for(v_org, p_actor) OR is_hospital_admin_of_for(p_scope_id, p_actor)`, no `is_admin_for`; revoke arm identical. ⚠ TD's grant arm ALSO opens with `perform app.assert_technical_director_enabled()` — **this program ships NO flag** (verified: no quality-oversight key among the 35 `app.feature_flags`), so the new arm has no flag-assert line. Deliberate delta — flagged for lead ack (§6c) |
| 10 | No door sets `expires_at` today; only the 2 impls + `assign_member_title` write `memberships` | **CONFIRMED** | Comment-stripped sweep over `app`+`public` prosrc: exactly those 3 writers; zero mention `expires_at` |
| 11 | `grant_role → grant_role_for → grant_role_impl` chain | **CONFIRMED** (shape is `grant_role`→impl and `grant_role_for`→impl, both thin) | ACLs (must be re-established after re-signature): `grant_role` `{postgres, service_role, authenticated}` · `grant_role_for` `{postgres, service_role}` (NO authenticated — service path) · `app.grant_role_impl` `{postgres}` only. Third SQL caller of both impls: **`public.appoint_technical_director`** (positional call; a defaulted trailing param keeps it resolving) |
| 12 | `_case_caps`: STEP-2 `is_active`, STEP-4 respondent→recused hard-denies, `v_eg`, arm order S6/S1/S2/S5/S3/S4 | **CONFIRMED** | `is_case_excluded` = exactly the respondent∨recused disjunction. S7 goes after the S5 block, before the S3 grant loop |
| 13 | Stale S3 comment to update | **CONFIRMED, quoted** | `-- Faithful to the pre-cut grant arm: it conferred content + deliberation (NOT` / `-- view_case_overview — that RESERVED bit stays coordinator-only), so the mechanism` / `-- swap keeps GAINED=0 on the raw bitmask, not only on consumed reach.` |
| 14 | *(not in plan)* | **NEW FINDING** | `app._cap_bit` carries a SECOND stale-comment site: `when 'view_case_overview' then 1 -- RESERVED + UNCONSUMED (A16). Deliberate.` After S7 the bit is conferred by two arms by design (D3). M4 updates BOTH comments |
| 15 | `app.hospital_of_commission` exists `[INF]` | **CONFIRMED** | STABLE DEFINER PK read of `commissions.hospital_id`; authenticated EXECUTE |
| 16 | NINE `dashboard_*` doors, six-aggregate / three-row-level | **CONFIRMED** | Aggregates: `distributions, entity_references, form_totals, matrix_cells, risk_scores, submissions_over_time` · Row-level: `export_rows, free_text(+p_limit int), completion_by_member`. All `(uuid,date,date)` except noted; `form_totals` takes `p_commission_id`, the other 8 derive commission via `forms.id = p_form_id`. Gate uniform: `is_staff_admin_of OR is_commission_admin_of` |
| 17 | Plan §A.5 "three still-**42501**" | ⛔ **CHANGED** | **All nine doors deny by silent empty `return;` — none raises.** Deny keystones must be zero-rows PAIRED with a permitted-caller non-vacuity assertion (270's own in-file discipline). No `throws_ok` on these doors |
| 18 | pgTAP 270 "goes red by design" if not rewritten with M5 | ⛔ **CHANGED** | **False — 270 stays GREEN under the planned M5 shape.** t7 asserts absence of `is_admin()` (M5 adds none); t8 asserts all nine carry `is_commission_admin_of(` (M5 keeps it, OR-ing the reviewer helper in); t1–t6 personas unaffected. The rewrite is still done in the SAME wave, but as a **strengthening** (two-class catalog invariant + reviewer behavioral pairs), not an appeasement |
| 19 | `commissions_select_member_or_admin` arms | **CONFIRMED** | member / org_admin / hospital_admin / pqs_operator / nsp_org_admin — reviewer invisible |
| 20 | `hospitals_select` admin arms only | **CONFIRMED** | `is_admin OR is_org_admin_of OR is_hospital_admin_of OR is_nsp_org_admin_of` — reviewer invisible |
| 21 | `organizations_select` relies on commission-join `is_org_member` | **CONFIRMED (understated)** | Six arms: `is_admin, is_org_admin_of, is_org_member, is_pqs_operator_in_org, is_nsp_org_admin_of, is_org_level_admin_within`. `is_org_member` requires `m.commission_id IS NOT NULL` + commission join → a reviewer row (commission NULL) does NOT pass ANY arm. New `is_quality_reviewer_in_org(id)` arm is required, as planned |
| 22 | `is_org_level_admin_within` explicit role list — must NOT widen | **CONFIRMED** | `m.role in ('hospital_admin','nsp_org_admin')` — left untouched |
| 23 | `eligible_voters` commission-scoped | **CONFIRMED** | `m.commission_id = app.commission_of_case(...)` — reviewer rows structurally excluded, zero change |
| 24 | `memberships_select` hospital arm exposes reviewer rows to admins | **CONFIRMED** | `hospital_id IS NOT NULL AND (is_org_admin_of(org_of_hospital(h)) OR is_hospital_admin_of(h))`; own-row arm gives the reviewer their session row. authenticated table ACL = `r` only (ADR 0075 intact) |
| 25 | `session_context()` role-generic | **CONFIRMED** | `m.role` flows as data; org+hospital objects joined; expiry filter "verbatim from has_role_any". Zero SQL change |
| 26 | `trg_audit_memberships` role-generic `[INF]` | **CONFIRMED** | Role is data; hospital-scope rows take the explicit org/hospital chain. **Bonus:** already audits `membership.expiry_changed` (ADR 0094 W2/T2.3) — M3's expiry writes are audit-covered for free |
| 27 | `list_cases_board(p_commission_id, p_limit)` per-row `can_read_case` + never-short-circuit contract + ~44 ms baseline note | **CONFIRMED** | In-body ⛔ comment intact; `p_limit DEFAULT 200`; baseline "~44 ms @ p_limit=100 / 205 cases" quoted in-body |
| 28 | Propagation: `cases_select` → `can_read_case` → `read_case_content` bit | **CONFIRMED** | Both projections thin; `can_read_case_patient` projects `read_standard_phi` (S7 confers no PHI bit → PHI stays closed, keystone-pinned) |
| 29 | Migration window > `20260910000400`; pgTAP 306+; 302==302 | **CONFIRMED** | Top suite `305_audio_minutes.sql` |
| 30 | TS unions must stay `'staff' \| 'staff_admin'` | **CONFIRMED** | `session.ts:33`, `members.ts:16` — both exactly that today |
| 31 | *(not in plan)* | **NEW (support)** | `memberships_grant_uq` UNIQUE `(principal_id, role, organization_id, hospital_id, commission_id) NULLS NOT DISTINCT` = the impl's **targeted** ON CONFLICT target; enforces D1's one-row-per-(user,hospital). `memberships_hospital_idx (hospital_id, principal_id, role)` backs the S7 probe |
| 32 | GUC `app.in_commission_rpc` is new | **CONFIRMED** | 0 references in any prosrc |
| 33 | Name collisions for the 7 new SQL objects | **NONE** | Also zero `quality_reviewer`/`quality_oversight` tokens anywhere in prosrc/policies today |
| 34 | Seed substrate for `quality.a2` (second hospital, Rede A) | **CONFIRMED** | Rede A has Hospital Central A + Hospital Secundário A (2 commissions each). Note: a third org (Rede C / Hospital Unico C, 0 commissions, AFF fixture) exists in the live seed — fixtures must not assume 2 orgs |

## 2. Migration filenames + versions (window above `20260910000400`)

| Mig | File |
|-----|------|
| M1 | `20260911000000_quality_reviewer_role.sql` — role CHECK + scope arm + `app.is_quality_reviewer_of(uuid)` / `_of_for(uuid,uuid)` |
| M2 | `20260911000100_commission_quality_oversight.sql` — column + CHECK + `set_commission_oversight` door + `app.guard_commission_oversight` trigger + GUC `app.in_commission_rpc` |
| M3 | `20260911000200_role_doors_quality_arm.sql` — grant/revoke arms + `p_expires_at` plumbed `grant_role` → `grant_role_for` → `grant_role_impl` |
| M4 | `20260911000300_case_caps_quality_arm.sql` — `_case_caps` S7 + both stale comments |
| M5 | `20260911000400_dashboard_quality_arm.sql` — `app.can_read_quality_dashboards(uuid)` + the six aggregate doors |
| M6 | `20260911000500_tenancy_policies_quality_arm.sql` — 3 policy arms + `app.is_quality_reviewer_in_org(uuid)` |
| M7 | `20260911000600_quality_board_door.sql` — `public.quality_board_summary(uuid)` |

Then `npm run gen:types` (Rule 8). M1 constraint rebuild keeps the exact constraint
names (`memberships_role_check`, `memberships_scope_shape`) — pgTAP/mutation tooling
(w4 `widen_dt_scope_shape`) references them by name.

## 3. Old-vs-new diff strategy — what a rebuild can silently lose (M3/M4/M5)

Every re-emitted body starts from **live `pg_get_functiondef` at authoring time** (not
this file, not the plan, not a migration file). After apply, a per-function catalog diff
proves only-intended edits over ALL of: body text · `prosecdef` · `provolatile` ·
`proconfig` (search_path) · `proacl` · `proargnames` · `pg_get_function_arguments`
(defaults). Recipe: snapshot the property tuple before/after in the migration's own
verification query + eyeball the functiondef diff.

**M3 — signature CHANGES (the dangerous class).** `app.grant_role_impl`,
`public.grant_role`, `public.grant_role_for` each gain `p_expires_at timestamptz
DEFAULT NULL` → new arg-type signature → `CREATE OR REPLACE` would create a SECOND
overload. Therefore **DROP old signature + CREATE new**, which RESETS:
- **ACL → default (PUBLIC EXECUTE!)** — must `REVOKE ALL ... FROM PUBLIC` then GRANT
  exactly the captured sets: `grant_role` → authenticated + service_role ·
  `grant_role_for` → service_role only · `grant_role_impl` → nothing beyond owner.
  An omitted revoke here is a phase-blocking over-grant.
- Param NAMES are the PostgREST named-call API (12 `.rpc()` sites in `src/lib/**`) — a
  rename is both an API break and the documented privilege-reset trap. Names stay
  byte-identical; the new param is appended LAST with a default so every existing
  positional SQL caller (`appoint_technical_director`, the 10 assign/revoke
  convenience wrappers) and named-arg client caller keeps resolving.
- Re-state `SECURITY DEFINER` + `SET search_path TO 'app','public','pg_catalog'`
  (volatility: impls are VOLATILE-default — unchanged).

`app.revoke_role_impl` (no new param) keeps its signature → `CREATE OR REPLACE`
preserves owner/ACL; still diffed property-by-property.

**M4 — same-signature `CREATE OR REPLACE` of `_case_caps`.** ACL preserved; diff must
show exactly: +S7 block (after S5, before S3), the two comment edits, nothing else.
STABLE + search_path re-stated identically.

**M5 — same-signature `CREATE OR REPLACE` of six doors.** Diff per door = ONE gate-line
hunk: `... or app.can_read_quality_dashboards(v_commission_id))` (form_totals:
`p_commission_id`). The three row-level doors appear in the verification query with
**zero** diff (the must-NOT-change proof). New helper gets the explicit ACL shape
(REVOKE PUBLIC → GRANT authenticated, service_role).

**M6 — `ALTER POLICY ... USING`** (never DROP+CREATE — preserves cmd/roles/permissive),
qual re-emitted from live `pg_policies` text + the new arm; diffed.

**M1 — constraint rebuild:** `ALTER TABLE ... DROP CONSTRAINT` + `ADD CONSTRAINT` under
the SAME names; the re-add must carry every existing arm verbatim (the live text above)
+ the new arm — the w4 `widen_dt_scope_shape` mutation case proves the suite notices a
loosened rebuild. `memberships_title_scope` untouched.

## 4. S7 (exact shape, from the live body)

```sql
  -- ── S7 · quality_reviewer (ADR 0100 D1/D3) — read_case_content + view_case_overview.
  --         DELIBERATE ABSENCES: no read_case_deliberation (D4), no PHI bits (D5),
  --         no write bits (D7). Locked cases (v_eg) are invisible to the arm (D6);
  --         exceptions ride case_access_grants (S3). Inherits STEP-2 is_active,
  --         STEP-3 fail-closed-unknown-case and the STEP-4 hard denies by position.
  if not v_eg
     and app.is_quality_reviewer_of_for(app.hospital_of_commission(v_commission), p_uid)
     and (select quality_oversight from public.commissions where id = v_commission) = 'visible' then
    v_caps := v_caps | app._cap_bit('read_case_content')
                     | app._cap_bit('view_case_overview');
  end if;
```

Cost: `not v_eg` short-circuits first; then one `memberships_hospital_idx` probe + one
`commissions` PK read. A5-style before/after measurement of `list_cases_board`
(baseline ~44 ms @ 100/205) + a `cases_select` scan is a gate item.

## 5. Verification plan

### pgTAP (306–310 + the 270 rewrite; ~140 assertions planned)

| Suite | Pins | ~n |
|-------|------|----|
| `306_quality_reviewer_role.sql` | Scope-shape arms (valid reviewer row via door; wrong-shape direct inserts refused); grant/revoke positives (org_admin, hospital_admin) and negatives (nsp_org_admin, staff_admin, foreign-org admin, platform_admin `is_admin_for`, self-grant) all still-42501; HC0G0 preserved for unknown combos; `p_expires_at` honored (INSERT lands it; expired row fails `has_role`; expiry-change audit row) | ~32 |
| `307_commission_oversight.sql` | Door authority (hospital_admin ✓, org_admin ✓, foreign admins ✗, staff_admin ✗, platform_admin ✗ — noun rule); validation code; guard blocks raw UPDATE (incl. via `commissions_admin_write` principals); unchanged-value UPDATE non-trap ⭐; audit row emitted with previous value; M6 arms (reviewer SELECTs visible commission + its hospital + org; NOT the excluded commission... paired with admin-visibility non-vacuity) | ~30 |
| `308_case_caps_s7.sql` | **Exact-bitmask keystone**: reviewer `_case_caps` = `_cap_bit('read_case_content') \| _cap_bit('view_case_overview')` = 5, asserted as the FULL mask; ZERO on: excluded commission / locked case / expired membership / deactivated profile / respondent / recused / cross-org; `can_read_case_patient` = false; row-level `cases` read under `set local role authenticated` (permissive-sibling audit done per §7.1·6); `list_cases_board` rows appear for the reviewer | ~32 |
| `309_dashboard_quality_arm.sql` | Six aggregate doors return rows for the reviewer on a visible commission (positives); the three row-level doors return **EMPTY** for the reviewer paired with staff_admin non-vacuity (deny = `return;`, NOT 42501 — table row 17); excluded commission → all nine EMPTY for the reviewer; cross-org reviewer EMPTY | ~26 |
| `310_quality_board_door.sql` | Gate: non-reviewer / cross-org → 42501; deactivated → denied; summary correctness incl. the locked count (counts `explicit_grants_only` rows the reviewer CANNOT read — DEFINER-only fact); PHI-free return shape (column-name assertion); excluded commissions absent | ~18 |
| `270` rewrite | Keep t1–t8; ADD: catalog invariant — exactly the six aggregate doors match `can_read_quality_dashboards` and the three row-level match ZERO (counts 6 and 0, non-vacuity paired); reviewer behavioral pair (distributions >0, export_rows = 0) | +8 |

**Red-first:** each suite is written before its migration. For brand-new surface a
first-run green is impossible-to-interpret (the surface doesn't exist — the file
ABORTS, which is `abort`, not `red`, per §7.1). So the discipline here is: (a) the
negatives that CAN run pre-migration (HC0G0 rejection, reviewer-invisible policy reads)
are run and observed red/denying **before** M1; (b) every keystone's falsifiability is
then proven by the six mutation cases below (revert-the-fix direction); (c) any
keystone green on its first meaningful run is treated as a finding, not a pass.

### Mutation audit `supabase/tests/mutation/q1-quality-mutation-audit.sh`

Mirrors the w4 harness verbatim (needle-substitution over `pg_get_functiondef`,
`MUTATION NO-OP` tri-state on a missed needle, restore + byte-compare, control
all-green). Six cases → expected REDs:

1. **strip S7** (replace the arm with `if false then`) → 308 positives red (bitmask 0, board empty).
2. **force `is_quality_reviewer_of_for` → true** → 308/306 negatives red (cross-org + expired + non-reviewer reach appears). The excluded-commission keystone rides `quality_oversight` and stays green — expected-red list names exactly which flip.
3. **neutralize `set_commission_oversight` authority** (`if not (...)` → `if false`) → 307 authority negatives red.
4. **no-op `guard_commission_oversight`** (unconditional `return new`) → 307 raw-write keystone red.
5. **force `can_read_quality_dashboards` → true** → 309 negatives red (cross-org/excluded-commission dashboards open).
6. **neutralize the grant arm's authority** (admit `is_admin_for` — the w4 `admit_platform_admin` analogue) → 306 negatives red.

### ARM gates + door sweep

- `ARM=census` + `ARM=floor` of `p0-authz-invariant.sh` (census is the arm that sees a
  brand-new gate). The new doors are never added to the authz allowlists.
- Per Amendment 5 the write-path sweep is a frozen list — `set_commission_oversight`
  is scoped IN explicitly.
- **Diff-scoped door sweep** over exactly: `set_commission_oversight` ·
  `is_quality_reviewer_of(_for)` · `is_quality_reviewer_in_org` ·
  `can_read_quality_dashboards` · `quality_board_summary` · `grant_role_impl` ·
  `revoke_role_impl` · `_case_caps` · the six dashboard doors · the three M6 policies
  (list derived from the migration diff at run time, not from this paragraph). After
  any subset run: `git checkout -- docs/reviews/authz-door-audit-findings.md`.

## 6. Open items for lead ack (plan deltas found by this pass)

- **(a) Dashboard deny mode.** Plan §A.5 said "three still-42501"; the live doors deny
  by empty `return;`. Keystones use zero-rows + non-vacuity pairs (270's documented
  discipline). No door gains a raise (changing deny mode would be beyond the brief).
- **(b) 270 does not go red** under the planned M5 shape (table row 18). Still rewritten
  in the M5 wave as a strengthening; recording so nobody expects/waits for a red.
- **(c) No feature flag** exists or is added for this program (ADR 0100 defines none),
  so the new grant arm carries no `assert_*_enabled` line — a visible template delta
  from the TD arm it mirrors. Confirm intentional.
- **(d) `p_expires_at` semantics (M3):** honored on the INSERT for ALL grant paths
  (D9's universal setter); propose door validation `p_expires_at IS NULL OR
  p_expires_at > now()` (mirrors the `grant_case_access` precedent). Two noted seam
  limits, both deferred (Phase C rides this seam): re-granting an identical existing
  membership hits the **targeted DO NOTHING** and will NOT extend/shorten an existing
  expiry; the commission-tier atomic-replace UPDATE path is left NOT setting
  `expires_at` (minimal diff).
- **(e) Second stale comment** (`_cap_bit`'s "RESERVED + UNCONSUMED") — updated in M4
  alongside the plan's S3 comment (table row 14).
- **(f) M2 error codes:** authority → `42501` (role-door family convention), invalid
  value → a distinct code (**`HC0L0`** as built — this line proposed `HC0Q0`, which the
  lead REJECTED at plan approval because `HC0Q*` is occupied through `HC0QE` by the
  forms-validation/accreditation work; reusing it would let a validation keystone pass
  on an unrelated error. Corrected here per QA m2 — the door raises `HC0L0`) so authority and validation stay
  distinct-SQLSTATE per §7.1's structural defence. P0002 for unknown commission.
- **(g) M7 return shape (proposal, pinned at A.6 contract time):** per visible
  commission of hospitals the caller reviews — `(commission_id, commission_name,
  commission_slug, hospital_id, hospital_name, total_cases, open_cases,
  locked_cases)`; counts PHI-free; gate `is_active(uid) AND ≥1 unexpired
  quality_reviewer membership in p_organization_id` else 42501.
