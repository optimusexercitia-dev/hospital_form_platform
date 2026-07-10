# Backend review — ADR 0064 (Case subject generalization: participants, professional registry, case types)

**Reviewer:** `backend` · **Date:** 2026-07-09 · **Scope:** design-only review (nothing
implemented). Reviewed against the CURRENT backend surface (`docs/backend-state.md` as of
`feat/administrativo-role`), ADR 0038 (`case_patient`), 0033 (`case_access`), 0054
(composite-FK tenancy), 0042/0041/0629 (NSP-per-org + multi-org PHI guard), 0039
(`patient_index`), ARCHITECTURE.md Rules 1/11/12.

**Verdict: SOUND WITH CHANGES.** The four decisions are directionally correct and fit our
idiom (isolated satellites, audited doors, RLS boundary, dark-launch). But three concrete
gaps between the ADR's picture and the *shipped* backend must be closed in the ADR text
before E0 implementation, and two more should be decided now rather than deferred. None is
fatal; all are cheap to fix on paper and expensive to discover mid-build.

---

## Soundness (what is right)

- **One `cases` root, three pluggable layers, no fork.** Correct and matches the evaluation.
  Rejecting `patient_cases`/`ethics_cases` roots is the right call — forking audit/ACL/docs/
  referrals per committee would be a disaster.
- **Generic layer carries link + role only; sensitive payload routes to subtype tables.**
  This is the correct application of the ADR-0038/0031 isolation discipline and directly
  fixes the source doc's `email_encrypted`/`notes_encrypted` anti-pattern (ADR 0035 declined
  column encryption; the ADR correctly refuses to reintroduce it).
- **Professional identity as its own audited-but-not-single-door class** is defensible and
  enforceable: normal case-scoped RLS SELECT + a DEFINER reader that calls `log_audit_access`
  with a new `professional_profile.read` verb (PHI-free metadata) is exactly the shape we
  already run for `case.opened` (ADR 0033 §8). No REVOKE-all isolation needed. Sound.
- **Re-key while the flag is OFF.** Doing the N-per-case rework before `case_patient` is ever
  flipped ON is genuinely the right sequencing — there is no production PHI, so it is
  reset/seed churn only. That claim holds.
- **Deferring the E1 access spine** (confidentiality, respondent-exclusion, recusal/COI,
  `default_visibility_policy` → `can_read_case`) and E2 procedure is the right cut line. E0
  builds the substrate without changing `can_read_case` behavior.

---

## Risks / gaps (ordered by severity)

### R1 — MAJOR: the multi-org PHI guard silently disables the participant-keyed patient door
The ADR's Decision 3 describes the re-keyed patient door as if it behaves like today's
`get_case_patient`. It does not mention that migration `…629000000` wired a hard
`AND NOT app.is_multi_org()` term into `can_read_case_patient` **and** into
`patient_safety_enabled()`/`referrals_enabled()`, so the **entire** case-PHI door is
**inert in any deployment with >1 organization** (the global-PQS surface is a single-org-only
posture today; see ADR 0041 amd-11 / 0042). Consequences the ADR must confront:
- `get_participant_patient` inherits `is_multi_org()`-gated `can_read_case_patient`, so on a
  multi-org platform an `affected_patient` participant's identifiers are **unreadable**, and
  by extension the Ethics affected-patient story does not work multi-org. That may be
  acceptable (patient PHI is single-org today), but it must be **stated**, not discovered.
- The pgTAP keystone "patient-identifier door still NULL-out-of-scope with N patients" must
  be paired with the existing `173_multi_org_phi_guard` assertion, re-expressed for the
  participant key. The ADR's pgTAP list omits the multi-org guard entirely.
**Change:** add an explicit sentence that the participant-keyed patient door remains
`is_multi_org()`-gated and inert in multi-org, and that professional identity (Decision 2) is
NOT so gated (it is LGPD-personal, not the global-PQS PHI surface) — decide and record whether
that asymmetry is intended (it probably is, but it is a new cross-tenant question).

### R2 — MAJOR: tenancy-key mismatch — participants anchor to `organization_id`, but `cases`/`case_patient` anchor to *commission*
The ADR anchors `participants`/`case_participants`/`case_types` to `organization_id`
(consistent with ADR 0054's *stated* pattern). But the existing case spine does **not** carry
`organization_id` on `cases` — it resolves org via `app.commission_of_case` /
`app.org_of_case`, and `case_patient` is keyed on `case_id` (→ commission). So the composite-FK
tenancy guard cannot be a simple `(x, organization_id)` chain end-to-end:
- `case_participants(case_id, participant_id)` links a **commission-scoped** case to an
  **org-scoped** participant. The integrity we actually need is "the participant's org == the
  case's org" — but `cases` has no org column to compose an FK against. ADR 0054's composite-FK
  shape (`UNIQUE(id, organization_id)` + composite FK) **cannot be applied directly** here
  without either (a) denormalizing `organization_id` onto `cases` (a schema change the ADR
  doesn't mention), or (b) enforcing the cross-tenant check with a trigger (like 0054's
  `guard_hospital_org_repoint`) instead of a declarative FK.
**Change:** the ADR must state the actual integrity mechanism for `case_participants`
(trigger vs. denormalize-org-onto-cases-then-composite-FK) rather than gesture at "consistent
with ADR 0054." As written it is not implementable as a pure composite FK. Recommend
denormalizing `organization_id` onto `cases` in this migration (cheap, reset-OK, and it also
simplifies R1's guard) OR an `app.assert_participant_same_org_as_case` BEFORE-INSERT trigger.

### R3 — MAJOR: the re-key breaks `patient_index` (ADR 0039, the 4th PHI surface) — unaddressed
The ADR calls `case_patient` "the third PHI module" and re-keys it, but it is silent on
`patient_index` / `patient_xref` (ADR 0039, the **4th** PHI surface). That HMAC cross-committee
linkage derives `patient_key`/`encounter_key` **from the `case_patient` identifier fields** and
is wired per-org in `…630000000` (`can_read_xref_row`, `patient_trajectory_bundle`,
`get_patient_trajectory_for_entity`). If `case_patient` moves from `PK=case_id` to
`PK=participant_id`, then:
- the linkage's `entity`→identifier resolution (`get_patient_trajectory_for_entity`,
  `patient_xref` rows keyed by case) must be re-pointed to the participant, and a case with
  **N** patients now produces **N** xref contributions per case, not one.
- `dispose_case_phi` generalized to "dispose all patient satellites of a case" must also purge
  the corresponding `patient_xref` rows for **each** participant, or disposal leaves dangling
  linkage keys (a real ADR-0056 disposal-completeness regression).
**Change:** the ADR must either (a) explicitly scope `patient_index` re-pointing into E0's
migration and its pgTAP disposal keystone, or (b) state that `patient_index` is deferred/OFF
and the re-key leaves it untouched because it is not yet live. Right now it is an
unacknowledged coupling.

### R4 — MEDIUM: "N-per-case" collides with the `patient_enabled` snapshot + write-tight invariant
ADR 0038's `case_patient` is upsert-by-`case_id` with a per-case immutable `patient_enabled`
snapshot and a name-or-MRN floor enforced in the action layer. Re-keying to
`patient_identifiers(participant_id)` changes the write door from "upsert the one patient" to
"add/edit/remove one of N patient participants," which the ADR under-specifies:
- The write gate stays "coordinators only" (0038 Decision 4) — but who creates the
  `participant` + `patient_participants` rows, and is that the same DEFINER writer, atomically?
  (Memory: PHI write must be atomic with create, never a racy post-create round-trip.) The ADR
  should say the participant + patient_participants + patient_identifiers rows are written in a
  **single DEFINER writer**, coordinator-gated, or it will regress the atomicity guarantee.
- The partial-unique "one `is_primary_subject` per case" is on `case_participants`, but the
  patient-vs-professional primary-subject-kind consistency (a `professional` primary subject
  vs `case_types.primary_subject_kind`) has no stated constraint. Flag as a deferred check or
  add it.

### R5 — MEDIUM: integrity gap — nothing prevents a `professional` participant from getting a patient satellite (or vice-versa)
The subtype tables use `participant_id PK → participants` with no guard that the participant's
`participant_type` matches the subtype. Without a check, a `professional` participant could get
a `patient_identifiers` row (PHI leaking into the wrong sensitivity class) or an
`affected_patient` could get a `professional_participants` row (PHI in the audited-but-not-
isolated class). The 0054-style composite-FK fix works here and IS clean:
`participants` gets `UNIQUE(id, participant_type)`, and each subtype table FKs
`(participant_id, <literal type>) → participants(id, participant_type)` with a CHECK pinning
the literal. **Change:** the ADR should name this guard explicitly — it is the single most
important integrity invariant of the whole design (it is what keeps the two sensitivity
classes from cross-contaminating) and "no polymorphic FKs" alone does not provide it.

### R6 — MEDIUM: `can_read_case` recursion risk when participants become a read input (E1), not E0
E0 does not change `can_read_case` (good). But Decision 2 says professional reads are "confined
to the case's readers" — i.e. `professional_participants` SELECT RLS will call `can_read_case`.
`case_participants` itself will also be `can_read_case`-gated. Since `can_read_case` is a
uid-pure DEFINER predicate that does NOT read `case_participants`, there is no recursion **today**.
But E1 wires `default_visibility_policy` and respondent-exclusion INTO `can_read_case`, and a
respondent-exclusion rule is naturally expressed as "uid is not a `respondent_doctor`
participant of this case" — which makes `can_read_case` read `case_participants`, whose own RLS
calls `can_read_case`. **Change:** the ADR should pre-commit that any participant-derived term
folded into `can_read_case` in E1 must be computed inside the DEFINER predicate over base tables
(SECURITY DEFINER bypasses RLS, breaking the cycle), never via an RLS-gated read — same
discipline as 0033's "attribution-derived read computed inside the predicate." Cheap to note
now; a nasty infinite-recursion bug to hit in E1.

---

## Lower-severity / omissions

- **O1 — `default_visibility_policy` home before participants are safe.** The ADR says E0
  *defines the column* and E1 *wires it*. That ordering is fine — E0 is buildable before E1
  because a defined-but-unread column changes no behavior. No hidden ordering dependency here;
  confirmed E0-before-E1 is sound. (One caveat: seed `case_types` rows must carry a sane default
  so E1 doesn't retrofit every row.)
- **O2 — `case_interview_subjects` reconciliation (Open item 5) should not be fully deferred.**
  Leaving the interview-scoped person model parallel to `case_participants` risks two
  divergent identity models and double-entry. At minimum decide *now* whether new
  interview subjects can reference a `case_participant` (nullable FK added later) so the E0
  schema doesn't foreclose it.
- **O3 — `professional_profiles.license_number` uniqueness.** A reusable professional registry
  invites "same CRM entered twice." Decide whether `(organization_id, license_number,
  license_region)` is unique (dedupe) or free (tolerate dupes, merge later). Cheap now,
  migration-y later.
- **O4 — audit verb allow-list.** New `professional_profile.read` must be appended to the
  `log_audit_access` positive allow-list (the same REPLACE-carry-forward discipline 0038 used
  for `case_patient.read`; every verb must be carried forward or reads silently fail). Worth
  naming as a pgTAP keystone. Also note the project rule: any new `public.*` RPC (e.g.
  `get_participant_patient`, professional reader) must `REVOKE ALL ... FROM PUBLIC` before
  `GRANT`, or the dashboard t19 guard fails.
- **O5 — SQLSTATE allocation.** New guard codes (participant-type mismatch, professional gate)
  should be allocated from the current `HC0xx` high-water mark in the ADR's "as-built" section,
  per the ADR-0018 distinct-code convention (0054 used HC082).

---

## Recommended changes (checklist for the ADR before E0 build)

1. **State the multi-org posture of the re-keyed patient door** (R1) — it stays
   `is_multi_org()`-inert; professional identity is not; record the intended asymmetry.
2. **Specify the real `case_participants` cross-tenant integrity mechanism** (R2) —
   denormalize `organization_id` onto `cases` (recommended) or a same-org trigger; do not
   claim a pure composite FK that the current `cases` schema can't support.
3. **Address `patient_index`/`patient_xref` (ADR 0039) under the re-key** (R3) — re-point or
   explicitly declare out-of-scope/OFF, and extend disposal + its pgTAP keystone to purge
   per-participant xref rows.
4. **Name the subtype↔type integrity guard** (R5) — `UNIQUE(id, participant_type)` on
   `participants` + composite-FK+CHECK on every subtype table. Make it a pgTAP keystone.
5. **Specify the patient participant writer is a single atomic coordinator-gated DEFINER**
   (R4) — participant + patient_participants + patient_identifiers in one call; keep the
   name-or-MRN floor; keep the write-tight/read-broad asymmetry.
6. **Pre-commit the E1 anti-recursion rule** (R6) — participant terms fold into `can_read_case`
   only via DEFINER-computed base-table reads.
7. Resolve O2 (interview reconciliation seam), O3 (license uniqueness), O4 (audit allow-list +
   REVOKE/GRANT), O5 (SQLSTATE allocation) in the ADR text.

---

## Verdict

**SOUND WITH CHANGES.** The architecture is right and idiomatic; E0 is genuinely buildable
before E1/E2. The gating fixes are R1–R3 (multi-org guard, tenancy-key mismatch,
`patient_index` coupling) and R5 (the type↔subtype guard) — all are ADR-text/spec omissions,
not design flaws, and all are cheap on paper and costly to hit mid-migration. With those seven
changes recorded, this is safe to implement dark behind the `case_participants`/`case_types`
flags.
