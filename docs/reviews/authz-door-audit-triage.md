# AUDIT-DOOR-BLINDNESS P0 — Sweep Triage & Fix Plan

**Status:** find + triage COMPLETE (2026-07-18) · fix phase in progress · **Owner:** lead
**Charter:** ADR 0078 §7.14 — a keystone that checks one authorization layer and infers the adjacent one is
blind by construction; it shipped green over 5 live leaks in one day. Close it with a **catalog-driven
neutralization oracle** + a standing invariant. Branch `fix/authz-audit-door-blindness`.

## Method (the oracle — proven)
Neutralize each authz gate (open it: positive predicate→`true`, deny predicate→`false`, void raise-guard→no-op,
policy→`using/with check (true)`), run the full pgTAP suite, read the result:
- `Result: FAIL` → a keystone asserts THROUGH the gate = **COVERED**.
- `Result: PASS` → nothing noticed = **BLIND** (finding).
- Run-shape drop (Files/Tests < baseline) → §7.15 guard fires = **ERROR** (undetermined; see FIX-A).

Harnesses: `supabase/tests/mutation/p0-authz-{door,writepath}-audit.sh`. Raw data: scratchpad `authz-audit/`
(`progress.tsv`, `blinds*.tsv`, `runlogs/`). Baseline captured at preflight; restore byte-compared per case.

## Results — 292 neutralization cases
| Arm | Cases | COVERED | BLIND | ERROR |
|---|---|---|---|---|
| Read/door | 252 | 135 | 93 (13 pred + 80 policy) | 24 |
| Write | 40 | 9 | 29 (3 guard + 26 policy) | 2 |

**No live leak surfaced.** The blinds are backstops + untested-but-correct gates — the exact regression vector
the known-3 rode.

## Triage

### FIX-A — the 26 ERROR cases → ALL COVERED (resolved via runlogs, no new work)
Every ERROR run was `Result: FAIL` with authz-keystone failures (from `has_role` 529 fails down to
`can_sign_meeting` **1**); the run-shape drop was a *collateral* fixture abort, not a coverage gap. The
load-bearing predicates (`is_commission_admin_of` [67 doors], `has_role`, `is_staff_admin_of`, `is_member_of`,
`is_org_admin_of`, `is_active`, `is_admin`, nsp/pqs variants) are all heavily asserted. **Zero blind core
predicates.** ⚠ Follow-up nit: `can_sign_meeting` has single-keystone coverage (thin).

### Reachability filter (Rule 1 — the RLS policy is the live boundary only if PostgREST can reach the table)
- **Door-only backstops** (grant revoked → PostgREST can't expose; audited DEFINER door protects): **`event_patient`,
  `patient_xref`** (SELECT), **`notifications`** (write). Blind base-table policy = defense-in-depth, **not a leak.** → allowlist.
- **Reachable (live boundary):** ~52 SELECT policies + 26 write policies (13/14 write tables direct-DML reachable).
  Every crown-jewel qual inspected is a correct-looking, **separately-COVERED** predicate
  (`can_read_professional_profile`, `can_read_capa`, `can_read_event`, `can_read_interview`, `can_reach_meeting`,
  `can_read_attachment`) → **untested-but-correct**. The write arm is higher-risk (subtler `with_check`;
  `case_referral` has a documented fail-closed staleness history — [[d11-anglicization-stranded-rls-policy-predicates]]).

### Non-vacuity (§7.10) — keystones must not read 0-from-empty
~23 blind tables have **0 seed rows** (answer_*, attachment_*, case_phase_*, case_tag_assignments,
capa_action_evidence, interview_summaries/topics/attendance, meeting_closed_sessions, meeting_signatures,
rca_evidence, referral_reply_attachment, notification_preferences). Their isolation keystones MUST insert a
row (as an authorized principal) before asserting a foreign principal reads/writes 0.

## Fix plan (PO-scoped 2026-07-18: invariant + high-risk + resolve unknowns; low-severity allowlisted)
- **FIX-A** ✅ 26 errors resolved COVERED.
- **FIX-B — standing invariant:** the mutation harness as a repeatable gate — `BLIND set ⊆ committed allowlist`
  (any NEW blind fails) + a never-called-door floor check. Provisional allowlist = today's low-severity blinds;
  tightened as FIX-C lands.
- **FIX-C — high-risk keystones (mutation-proven each: revert policy → keystone RED):**
  - 3 write guards: `assert_session_writable`, `assert_referral_draft_writable`, `assert_referral_target_acts`.
  - 26 direct-DML write policies (meeting family, `case_referral` insert/update/delete, `responses`/signoffs,
    `rca`, `capa_plan`, `case_interviews`, `profiles`, `notification_preferences`).
  - 5 read predicates: `can_read_document_object`, `can_read_document_of_version`, `can_read_referral`,
    `can_read_xref_row`, `can_sign_section`.
  - PHI-adjacent read representatives (one per predicate-group): `professional_profiles`,
    `professional_participants`, `capa_action`, `rca_evidence`, `event_custody`, `interview_sessions`,
    `meeting_closed_sessions`, `case_participant_roles`, `attachment_subjects`, `answer_matrix_cells`.
- **Allowlisted (invariant surfaces as tracked follow-up backlog, NOT silently dropped — §"no silent caps"):**
  the door-only backstops + the low-severity config/catalog SELECTs (form_*, process_template_*,
  case_type_terminology, commission_meeting_types/settings, referral_types, reply_outcomes,
  professional_categories, commission_administrativo_capabilities, indicator_measurements, document_approvals).
- **Gate:** full pgTAP green on fresh reset (incl. the invariant) · mutation proof per new keystone · qa APPROVED · human approval.

## Pre-req fixed en route
Clean `supabase db reset` was aborting on `20260801000000` (CRLF checkout broke a runtime `pg_get_functiondef`
guard-injection anchor). Fixed: `*.sql text eol=lf` (`a32be9c`) — also unblocks the pilot reset.
