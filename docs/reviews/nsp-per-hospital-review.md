# QA Review — Phase B: NSP-per-hospital + `nsp_org_admin`

**Branch:** `feat/nsp-per-hospital` · **Reviewer:** `qa` · **Date:** 2026-07-03
**ADR:** [0052](../decisions/0052-nsp-per-hospital.md) · **Design:**
[nsp-per-hospital-design.md](../progress/nsp-per-hospital-design.md)
**Migrations audited:** `20260710000000_nsp_per_hospital.sql`,
`20260710000100_nsp_per_hospital_fixups.sql`

## Verdict: **APPROVED** (2026-07-03; was CHANGES REQUESTED, cleared same day)

The sole blocker (QA-B-1) is **RESOLVED** and independently re-verified. All six
ADR-0052 deliverables are met, the security design is sound (findings below), and
the full pgTAP suite is green. Approved.

---

## BLOCKER — RESOLVED

### QA-B-1 — pgTAP `189` disposal keystone (was 2 red; now green) — RESOLVED (`693ea60`)
**Original severity: BLOCKING** · Phase Gate §6.2 (full suite green), ADR-0052
§D.8 (disposal keystone) + §6 (dual-hospital dispose).

**Original finding:** a clean `supabase test db` yielded **1443/1445**, not the
handed-off **1445/1445**. `189_nsp_per_hospital_isolation` tests 38-39 died on
`23514` (`o recurso de encaminhamentos não está disponível`): the suite enabled
`patient_index` but **not** `case_referrals`, so `dispose_referral_phi` hit its
`assert_referrals_enabled()` guard (migration line 2287) *before* its gate — the
ADR-0052 §D.8 disposal keystone had zero passing coverage, and the gate was
declared green on a false count. (The door logic itself was already correct; the
`case_referrals` flag defaults ON in the seed, so app/E2E context was unaffected —
this was always a test-context defect, not a security hole.)

**Fix (verified):** backend added
`update app.feature_flags set enabled = true where key = 'case_referrals';` after
the `patient_index` enable (matching `150_referrals.sql:27`), so the disposal path
reaches its real gate; plan bumped 42→43, suite total 1445→1446.

**Independent re-verification (this reviewer, not self-report):** fresh
`supabase db reset --local` then the full ordered `supabase test db`:

- **Observed: Files=56, Tests=1446, Result: PASS** — `189` reports `ok`.
- `189` (plan `1..43`) — dispose keystone now genuinely exercised:
  - **t38** cross-org `pqs.b` dispose denied `42501` — `ok`
  - **t39** target-hospital-operator dispose (`lives_ok`) — `ok`
  - **t40** `get_referral_patient` = NULL after disposal — `ok`
  - **t41** (my N-2) governance skeleton survives: `case_referral` row + code
    present, `has_patient=false`, `phi_disposed_at` set — `ok`

The ADR-0052 §D.8 disposal keystone + §6 dual-hospital-dispose amendment now have
full passing SQL coverage. Blocker closed.

---

## Requirements coverage — ADR 0052 deliverables

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 | Re-key roster + config org→hospital; `is_pqs_member_of(hospital)`; `hospital_of_*` resolution; A-member gets false on B PHI same-org | ✓ | Migration §1–§4; `hospital_of_commission/event/referral/capa_action`; pgTAP §4 cross-hospital isolation (passing) |
| 2 | `nsp_coordinator` = full local operator (implicit PHI read + write) via `is_pqs_operator_of` | ✓ | `is_pqs_operator_of` (line 240) threaded through every read predicate + write gate; pgTAP §4 coordinator-arm (unenrolled) passing |
| 3 | `nsp_org_admin` = org-level, **ZERO PHI**, curation + PHI-free aggregates | ✓ | `is_nsp_org_admin_of` appears in **no** `can_read_*`/`get_*_patient` door (grep-verified); only nav SELECT policies, curator gates, aggregate-door gates, appointment RPCs; pgTAP §5 zero-PHI keystone + §9 PHI-free-key assertion passing |
| 4 | Dual-hospital same-org referral reads; cross-org forbidden | ✓ | `can_read_referral`/`_phi` resolve both endpoints (lines 509–546); `create_referral_draft` same-org guard unchanged; pgTAP §8 passing |
| 5 | Non-event CAPA fallback → `is_pqs_member_of_any` (any hospital roster) | ✓ | `can_write_capa` (line 664) branch; `is_pqs_member_of_any` re-reads "any hospital roster" for free after the PK re-key |
| 6 | `dispose_referral_phi` — dual-hospital gate, PHI-graph-only erasure, hospital-tier audit | ✓ | Door logic correct (lines 2277–2372: gate = admin OR source-commission-admin OR operator of either endpoint; nulls PHI graph, preserves ENC/skeleton; audits at hospital tier); now covered by pgTAP `189` t38–t41 (QA-B-1 RESOLVED) |
| — | `can_dispose_referral_phi` read-only probe mirrors the gate (BUG-NPH-002) | ✓ | Fixups migration lines 40–61; mirrors gate exactly; FE gates affordance on it (page.tsx:171) |

**pgTAP keystones (a)–(e):** (a) cross-hospital same-org PHI isolation ✓;
(b) `nsp_org_admin` zero-PHI + PHI-free aggregates ✓; (c) org-tier duty
separation ✓; (d) per-hospital EV independence ✓; (e) dual-hospital referral
read ✓, cross-org dispose denial + disposal-success + post-disposal-NULL ✓
(t38–t40, QA-B-1 RESOLVED). All green — full suite 1446/1446.

## Security / RLS findings

- **`nsp_org_admin` is provably PHI-free (load-bearing claim): CONFIRMED.**
  `is_nsp_org_admin_of` is grep-verified absent from every PHI read door. The
  three aggregate doors (`nsp_org_event_rollup`, `nsp_org_capa_rollup`,
  `nsp_org_roster`) gate on `is_nsp_org_admin_of(p_org_id)`, scope their result
  set to the org's hospitals (ADR-0042 M3), and their SELECT lists carry only
  hospital identity + integer counts + status buckets + **staff** roster identity
  — never a patient column, event code/title, or narrative. pgTAP §9 asserts the
  JSON exposes no `name`/`mrn`/`patient`/`code`/`title`/`description`/`attending`
  key. FE (`org-admin.ts`, `nsp-org-rollups.tsx`, `nsp-org-hospital-manager.tsx`)
  routes exclusively through these gated RPCs and renders only counts/labels/staff
  identity.
- **Hospital-scoped isolation / scope-tamper: CONFIRMED SAFE.**
  `resolveNspHospital` (nsp-hospital-scope.ts) can only *collapse* an
  unknown/foreign `?hospital=` to a grant the caller already holds; it never
  widens. Every PHI door re-gates per hospital server-side regardless, and the
  result-set-scoped doors (`pqs_inbox`, `capa_kpis`, `patient_trajectory_bundle`,
  `patient_access_audit`) scope to the caller's operator hospitals / passed
  hospital, not just the gate (M3 respected).
- **`dispose_referral_phi` gate + probe mirror exactly: CONFIRMED.** Door gate
  (migration 2294–2297) and probe `can_dispose_referral_phi` (fixups 46–56) are
  byte-consistent: `is_admin() OR is_commission_admin_of(source) OR
  is_pqs_operator_of(hospital_of_commission(source|target))`. REVOKE-FROM-PUBLIC
  + GRANT present on both. FE affordance gated on the probe + `hasPatient`
  (page.tsx:171–173, dispose-dialog holds no gate of its own). *Logic sound; only
  the SQL exercise is red (QA-B-1).*
- **RLS keystones:** every re-keyed table/RPC carries explicit policies; the
  `pqs_members` RLS swap (drop per-org `_coordinator_all` → per-hospital
  `_curator_all`) is correct; nav SELECT policies recreated per-hospital. No
  SECURITY DEFINER read path over-grants (all REVOKE PUBLIC + GRANT
  authenticated/service_role; `patient_trajectory_bundle` kept service_role-only).
  The **catalog-sweep assertion** (migration 2395–2414) enforces zero residual
  per-org resolution symbols — a strong M2 safeguard.
- **BUG-NPH-001 fix quality: BETTER than the initial plan.** PROGRESS.md/tester
  proposed adding `is_org_level_admin_within(org)` to `hospitals_select`; the
  landed fixup uses the narrower `is_nsp_org_admin_of(organization_id)` arm
  instead, explicitly to avoid leaking **sibling** hospitals to a `hospital_admin`
  (fixups header 11–15). Minimum-necessary — correct call.
- **BUG-NPH-003 fix quality: CONFIRMED.** `org-users.ts:29` `PROFILE_SELECT` uses
  the disambiguated hint `hospital:hospitals!profiles_home_hospital_id_fkey(name)`;
  a repo grep finds **no** other un-hinted `profiles↔hospitals` embed. The
  associated audit-leak in the full-regression triage is a genuine **E2E
  test-isolation defect** (a hospital-admin-tier spec appoints `staff1.ccih`
  without cleanup) that Phase B merely *exposed*; seed verified correct — not a
  Phase-B RLS hole.

## Code quality / hygiene

- TypeScript `strict` respected; data access flows through `src/lib/queries/**` +
  `src/lib/pqs/**` (Rule 9); Server Components by default, `"use client"` only on
  the interactive curation/dispose dialogs. File ownership boundaries respected.
- `target_commission_id` NOT NULL confirmed in baseline (line 856), so the
  dual-hospital read's both-endpoint resolution needs no draft-stage null guard —
  matches the migration's stated assumption (design confirm-item (b) satisfied).
- UX/a11y: all strings pt-BR; disposal dialog is keyboard-operable with a typed
  confirm phrase + `aria-describedby`; markdown rendered through the sanitizing
  renderer (Rule 7); no raw Postgres errors surfaced.
- ADR 0052 documents the non-trivial choices incl. the §6 dual-hospital-dispose
  amendment.

## Non-blocking observations (address opportunistically)

- **N-1 (docs):** PROGRESS.md still records the NPH-001 fix as the
  `is_org_level_admin_within` arm; the landed migration used the narrower
  `is_nsp_org_admin_of` arm. Update the note so the record matches reality.
- **N-2 (test hygiene): DELIVERED.** The requested post-dispose
  governance-skeleton-survives assertion landed as `189` t41 (`case_referral` row
  + code present, `has_patient=false`, `phi_disposed_at` set) — verified green.

---

**Re-review (2026-07-03):** re-verified on a fresh `supabase db reset --local` +
full ordered `supabase test db` → **Files=56, Tests=1446, Result: PASS**; `189`
t38–t41 green. QA-B-1 RESOLVED, N-2 delivered. Verdict flipped **CHANGES
REQUESTED → APPROVED**. N-1 remains as a docs-hygiene note (non-blocking). No
application-code change was needed; the security design was sound throughout.
