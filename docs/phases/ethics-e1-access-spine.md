# Build Plan — Ethics E1 · Access spine (m2 gate release)

**Status:** 📝 Design (S0 gate — DESIGN ONLY, no code) · **Date:** 2026-07-13
· **Track:** ETH·E1 of the [Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md)
(ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)), stage **S3**.
· **ADR:** [0072](../decisions/0072-ethics-access-spine.md) · **Owner:** `backend` (+ `frontend` for the
E2/E3 surfacing, not this phase) · **Flags:** flips `case_participants` + `case_types` ON (E1 does **not**
own `ethics` — E2 does, S0 §F.4).
· **SQLSTATE:** `HC0E0–HC0E9` (S0 §B). · **Migration window:** `20260720000000+` (latest shipped
`20260719000800`; reset-OK, forward-only, additive).

This clears the §6 gate bar — a **new RLS shape** (respondent/recusal deny-terms), a **`SECURITY DEFINER`
read-path change** (`can_read_case` + `can_read_attachment`), **new tables** (`case_recusals`,
`case_conflict_declarations`), and a **flag flip that releases the m2 hard gate** — so it runs the full
gate: contract-first plan → build → tester → qa → human → record. Every migration-touching task needs
**full lead plan-approval** (novel RLS + DEFINER read path + m2 release); the flag-flip + additive
satellite migrations that mirror an approved pattern need a **one-line plan + ack**.

Reading order for the implementer: **ADR 0072** (the model — binding), then this plan's §2 contract, then
the source anchors in §0. `case_participants`/`professional_profiles`/`can_read_case`/the attachment
reader already exist (F1 + F2) — E1 *extends* them.

---

## 0. Source anchors (what already exists — E1 extends, never re-creates)

| Surface | Where (source of truth) | E1 action |
|---|---|---|
| `app.can_read_case(p_case_id, p_uid)` (live) | `20260710000000_nsp_per_hospital.sql` L569 | **add** 2 hard-deny terms (respondent/recusal, first) + suppress the flag-OFF member fallback for `explicit_grants_only` + the doc ceiling (ADR 0072 D2/D5) |
| `app.can_read_case_patient` (live) | same, L618 | **add** the 2 deny-terms (respondent/recusal) |
| `app.can_write_case_content` | `20260708000000_case_access_expiry.sql` | **add** the 2 deny-terms |
| `case_participants` (SELECT-only RLS) | `20260716000100_patient_identifiers_rekey.sql` L73 | **add** DEFINER write RPCs (keep SELECT-only) |
| `professional_profiles` + `can_read_professional_profile` (R6-safe DEFINER exemplar) | `20260716000000_participants_registry.sql` L236/L268 | **add** writers; the R6 pattern to copy |
| `case_types.default_visibility_policy` (defined, unwired) | `20260716000000_participants_registry.sql` L41 | **wire** → `cases.visibility_policy` snapshot + **add** `default_confidentiality_level` |
| `attachments.confidentiality_label` (7-value; stored, non-enforcing) + `app.can_read_attachment` (pure owner-auth) | `20260717000000_attachments_core.sql` L59 / L230 | **add** the confidentiality-ceiling term |
| `case_access` (per-case ACL, `level ∈ read|write`, `expires_at`) | `20260708000000_case_access_expiry.sql` L39 | **add** `max_confidentiality` clearance column (O1) |
| `list_my_cases` WHERE-clause | `20260708000000_case_access_expiry.sql` L304 | respondent-exclusion propagates (via `can_read_case` + explicit deny in the SELECT) |
| `app.audit_write(action, entity_type, entity_id, commission, summary, metadata)` | `20260709000300_audit_hospital_tier.sql` L77 | emit the new mutation verbs |
| `log_audit_access` allow-list + `_audit_access_authorized` | `20260716000100_patient_identifiers_rekey.sql` L655/L686 | `professional_profile.read` already present — **unchanged** |
| `case_interviews` / `_subjects` / `_interviewers` + IV2 inert cols | baseline L7679 + **IV2 migration (lands before E1)** | **add** `participant_id` FK; make `confidentiality_level` enforcing + remap to 7-value |

> **graphify-first:** the implementer runs `graphify query`/`explain` before reading any of the above raw
> files (project rule; the graph is at `graphify-out/`).

---

## 1. Dependencies & serialization (S0 §E, plan §1/§5)

- **Hard deps (must be gated before E1 starts):** **F1** (done — participants/case_types/professional
  registry live, flags OFF), **IV2** (X-γ fold-in target — ships the inert interview cols; lands in S2),
  **MEM** (X-α — collapses the `is_*_of` family into `has_role()`; the `can_read_case` base E1 adds terms
  to; lands in S1, regens types **before** E1).
- **Soft dep:** **N** (grant/expiry reminders — E1 does not block on it).
- **Strict sequence:** **E1 → E2 → E3** (each consumes the prior's tables). E1 is **serialized against
  MEM** on `session.ts` / the membership predicate surface — MEM lands + regens `database.ts` first, then
  E1 references the new `has_role()`/shim names (S0 X-β: the ~30 old names survive as thin wrappers, so
  E1's arms compile whether they name the old or new predicate — but reference the post-MEM shape).
- **File ownership:** `backend` owns all E1 migrations + `src/lib/{queries,types,supabase}` + the new
  `src/lib/case-recusals/actions.ts` + `src/lib/participants/actions.ts`. No `frontend` in E1 (the
  ethics UI is E2/E3). E1 posts the §2 typed contract **first** so any FE that later builds on it (E2/E3)
  has real types.

---

## 2. Canonical contract (BACKEND posts these typed stubs FIRST)

Per CLAUDE.md contract-first: `backend` commits the **signatures** below as typed stubs in
`src/lib/queries/**` + the relevant `actions.ts` (bodies `throw new Error('not implemented')`) and
commits them early, before implementing.

### 2.1 Data model (migrations, additive — window `20260720…`)

```sql
-- cases: the resolved-at-create confidentiality + visibility snapshot (ADR 0072 D1).
alter table public.cases
  add column visibility_policy text not null default 'commission_default'
    check (visibility_policy in ('commission_default','explicit_grants_only')),
  add column confidentiality_level text not null default 'non_phi_internal'
    check (confidentiality_level in ('non_phi_internal','phi_standard','phi_restricted',
      'peer_review_confidential','legal_privileged','ethics_investigation','credentialing_sensitive'));

-- case_types: the default ceiling that create_case snapshots (D1). default_visibility_policy exists.
alter table public.case_types
  add column default_confidentiality_level text not null default 'non_phi_internal'
    check (default_confidentiality_level in (/* same 7-value set */));

-- case_access: the clearance grade (D5 / O1 — recommend the column over widening level).
alter table public.case_access
  add column max_confidentiality text
    check (max_confidentiality is null or max_confidentiality in (/* same 7-value set */));

-- case_conflict_declarations, case_recusals — ADR 0072 D4 (full shape there).
-- interview satellites — ADR 0072 D7 (participant_id FK; attendance; roles-M2M; topics; summaries).
```

### 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables)

- `app.can_read_case(p_case, p_uid)` — **modified**: + respondent-exclusion + recusal-exclusion (hard
  deny, evaluated first) + suppress the flag-OFF `is_member_of_for` fallback arm for cases whose
  `visibility_policy = 'explicit_grants_only'` (ADR 0072 D2 — the ON-path arms are otherwise untouched;
  the primary `explicit_grants_only` enforcement is in the reach surfaces, §Ripples).
- `app.can_read_case_patient(p_case, p_uid)` — **modified**: + the 2 deny-terms.
- `app.can_write_case_content(p_case, p_uid)` — **modified**: + the 2 deny-terms (D3).
- `app.can_read_attachment(p_owner_type, p_owner_id, p_uid)` — **modified**: + confidentiality-ceiling
  term gating `legal_privileged` + `credentialing_sensitive` against `case_access.max_confidentiality`
  (D5).
- `app.is_case_respondent(p_case, p_uid)` **(new)** — the base-table respondent traversal, factored out
  so `can_read_case`/`_patient`/`can_write_case_content` share one definition (DRY + one pgTAP target).
- `app.is_recused_from_case(p_case, p_uid)` **(new)** — live-recusal existence over base tables.

### 2.3 RPCs (all: assert flag · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0E·`)

**Participant write authority (D6):**
- `public.add_case_participant(p_case_id, p_participant_id, p_role_id, p_is_primary_subject default false, p_involvement_summary default null) returns uuid`
- `public.remove_case_participant(p_case_participant_id) returns void` (soft-remove)
- `public.set_primary_subject(p_case_participant_id) returns void`
- `public.set_case_participant_role(p_case_participant_id, p_role_id) returns void`
- `public.create_professional_profile(p_org, p_full_name, p_professional_type, p_license_number, p_license_region, p_specialty, p_affiliation_status, p_user_id default null) returns uuid`
- `public.update_professional_profile(p_profile_id, …fields…) returns void` (audited `professional_profile.updated`; **no** `dispose_*` — M2 §7)

**Confidentiality / recusal / COI (D8):**
- `public.set_case_confidentiality(p_case_id, p_level) returns void` (coordinator; audited `case.confidentiality_changed`; `HC0E5`)
- `public.declare_conflict(p_case_id, p_conflict_type, p_description_md) returns uuid` (self-service; `HC0E2`)
- `public.record_recusal(p_case_id, p_user_id, p_reason_md, p_conflict_declaration_id default null) returns uuid` (coordinator or self; `HC0E0`)
- `public.lift_recusal(p_recusal_id, p_reason_md) returns void` (coordinator; `HC0E1`)

**Interview fold-in RPCs (D7 — extend IV2's surface):**
- `public.set_interview_participant(p_interview_id, p_participant_id) returns void` (+ subject/interviewer variants — wire the `participant_id` FK)
- `public.set_interview_confidentiality(p_interview_id, p_level) returns void` (now enforcing; audited `interview.confidentiality_changed`)
- session-attendance writers `record_session_attendance(...)` (attendance table)

**Modified reads (projection only — auth unchanged except via the predicates above):**
- `public.get_case_detail(p_case)` — surface `confidentiality_level`, `visibility_policy`, the case's
  participants (via `case_participants` SELECT, already `can_read_case`-gated), and the caller's
  recusal/COI state. **Must preserve** every existing field + the submitted-only answer rule (ADR 0033).
- `public.list_my_cases(p_commission)` — add an explicit respondent/recusal exclusion to the WHERE
  (belt-and-suspenders atop `can_read_case`, since arm-order matters for the personal list too — a
  respondent who is also a phase-assignee must still be excluded).

### 2.4 RLS

- `case_conflict_declarations` — SELECT `can_read_case(case_id, auth.uid())`; **no** write policy
  (DEFINER-RPC-only). Grant SELECT to `authenticated` (F1 MAJOR-1 lesson: RLS narrows an existing grant).
- `case_recusals` — SELECT `can_read_case(case_id, auth.uid()) OR user_id = auth.uid() OR
  app.is_staff_admin_of_for(app.commission_of_case(case_id), auth.uid())` (the self+coordinator asymmetry,
  ADR 0072 D4 note); no write policy; grant SELECT.
- Interview satellites (attendance/roles/topics/summaries) — SELECT mirrors the **interview-child**
  pattern (`can_read_case` via the interview, per `20260713001200_case_interviews_case_scope_read`); no
  broad write; grant SELECT.
- `case_participants` — **unchanged** (SELECT-only, `can_read_case`); writes via the D6 RPCs.

### 2.5 TS layer (`backend`-owned)

- `src/lib/types/database.ts` — **regenerate after every migration** (Rule 8).
- `src/lib/queries/feature-flags.ts` — **add `case_participants: boolean` + `case_types: boolean`** to
  the `FeatureFlags` interface (S0 A5), at the flag-flip step.
- `src/lib/queries/cases.ts` — `getCaseDetail` return type gains `confidentialityLevel`,
  `visibilityPolicy`, `participants: CaseParticipant[]`, `myRecusal`/`myConflict`; new types
  `CaseParticipant`, `CaseConfidentialityLevel` (7-value union), `VisibilityPolicy`, `CaseRecusal`,
  `CaseConflictDeclaration`.
- `src/lib/participants/actions.ts` **(new)** — `addCaseParticipant`, `removeCaseParticipant`,
  `setPrimarySubject`, `setCaseParticipantRole`, `createProfessionalProfile`, `updateProfessionalProfile`.
- `src/lib/case-recusals/actions.ts` **(new)** — `declareConflict`, `recordRecusal`, `liftRecusal`,
  `setCaseConfidentiality`.
- `src/lib/interviews/actions.ts` — extend with `setInterviewParticipant`, `setInterviewConfidentiality`,
  `recordSessionAttendance` (E1's IV2 fold-in — the file is IV2's; **serialize** the edit window with any
  concurrent IV2 follow-up, though IV2 has gated by S3).

---

## 3. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
|---|------|---------|-------------|
| BE-1 | **Post the §2 contract** as typed stubs (queries + 2 new actions files + types) and commit. | MEM, IV2 gated | one-line ack |
| BE-2 | Migration: `cases.visibility_policy`+`confidentiality_level`; `case_types.default_confidentiality_level`; `case_access.max_confidentiality`; wire `create_case` to snapshot type→case. + `HC0E5`/`HC0E7`. | BE-1 | **full** (schema + snapshot wiring) |
| BE-3 | Migration: `case_conflict_declarations` + `case_recusals` (tables, partial-uniques, RLS §2.4, grants). + `HC0E0`/`HC0E2`. | BE-2 | **full** (new tables + RLS shape) |
| BE-4 | Predicates: factor `is_case_respondent` / `is_recused_from_case`; **modify** `can_read_case` / `can_read_case_patient` / `can_write_case_content` (hard-deny terms first + suppress the flag-OFF member fallback for `explicit_grants_only`) + **the reach-surface gating** in `list_my_cases`/board (§Ripples); **modify** `can_read_attachment` (ceiling). All R6-safe over base tables; `commission_default` byte-for-byte. | BE-3 | **full** (novel RLS + DEFINER read path — the m2 core) |
| BE-5 | RPCs: participant write authority (`add/remove/set_primary/set_role` + professional writers); `set_case_confidentiality`; `declare_conflict`/`record_recusal`/`lift_recusal`. t19 REVOKE→GRANT each. + `HC0E3`/`HC0E4`/`HC0E6`. | BE-4 | **full** (DEFINER write authority) |
| BE-6 | **IV2 fold-in** migration: `participant_id` FK on interview/subjects/interviewers; `confidentiality_level` → enforcing + remap to 7-value (O3); attendance table; roles-M2M; `interview_topics`; `interview_summaries`. + fold-in RPCs (§2.3). | BE-4 | **full** (X-γ enforcement + FK) |
| BE-7 | Modified reads: `get_case_detail` (new fields, submitted-only + every existing field preserved), `list_my_cases` (explicit respondent/recusal exclusion). Audit verbs on `audit_write` + curated PHI-free mutation triggers/paths (§ADR D9). | BE-5, BE-6 | one-line ack (projection + Rule-11 mirror) |
| BE-8 | **m2-flip checklist green → flip** `case_participants`+`case_types` ON (one-line migration) + add both to the `FeatureFlags` interface; regen `database.ts`; pgTAP (§4) on a fresh reset; seed personas (ethics case type + a respondent-doctor-who-is-a-user + a recused member + a privileged doc). | BE-7 | **one-line ack** (flag-flip mirrors the approved pattern — but gated on the checklist) |

**Serialization within the phase:** BE-2→BE-5 serial (schema → tables → predicates → RPCs); BE-6 can run
after BE-4 (shares only `can_read_case`, already modified). BE-4 is the **highest-risk** task — the
`can_read_case` edit — and gets the fullest review + the most pgTAP.

---

## 4. Tester — acceptance criteria (E2E `chromium` + pgTAP; the m2-flip gate keystones)

**Isolation negatives (the m2 keystones — plan §4 ETH·E1):**
1. **Respondent-exclusion:** a respondent doctor who **is** a platform user, added `respondent_doctor` on
   their own case → the case detail returns `notFound()` **and** the case is **absent from "Meus Casos"**,
   even though the user is a commission member (and even if also a phase-assignee). pgTAP: `can_read_case`
   / `can_read_case_patient` / `can_write_case_content` all return `false` for that (case, uid).
2. **Explicit-grants-only:** a commission member of an `explicit_grants_only` (ethics-typed) case with
   **no** grant/attribution sees **nothing** (`notFound()`, absent from Meus Casos); after a coordinator
   grant, they see it. A `commission_default` case is unchanged (member reads as today).
3. **Recusal:** a member who could read a case **loses read via RLS** the moment `record_recusal` runs
   (case detail → `notFound()`; case drops from Meus Casos); `lift_recusal` restores it. pgTAP:
   `is_recused_from_case` true → `can_read_case` false.
4. **Document confidentiality ceiling:** a `legal_privileged` attachment on a case is **invisible** to an
   ordinary case reader (absent from the attachment list / `open_attachment` → `HC0E6`), **visible** to a
   reader whose `case_access.max_confidentiality` clears it. An `ethics_investigation` doc stays visible to
   ordinary case readers (O2).
5. **Participant write authority:** a coordinator writes a participant via `add_case_participant`; a case
   **reader** (non-coordinator) calling it → `42501`/`HC0E4`. `case_participants` stays SELECT-only (a
   direct client `INSERT` → `permission denied`).
6. **Interview fold-in:** an interview subject resolves the **same** `participant_id` across two sessions;
   setting `confidentiality_level` on the interview now **restricts** (enforcing — a below-clearance reader
   no longer sees the interview detail); per-session attendance records; the registry stays **one** event
   per interview (IV2 invariant preserved).
7. **Flag-OFF byte-for-byte:** with `case_participants`/`case_types` OFF and no ethics case types seeded,
   `can_read_case` reproduces today's arms exactly (deny-terms inert on empty tables; every case
   `commission_default`). pgTAP flag-OFF fallback keystone.
8. **Audit:** participant-add, recusal-record, confidentiality-change each emit **one** `audit_log` row
   (PHI-free metadata); `professional_profile.read` still audits on the Class-2 door (E0 behaviour
   unchanged). No payload/PHI in any row (Rule 11).
9. **Keyboard-only** path through one ethics flow (a coordinator declaring+recording a recusal, or opening
   a confidential document) — §8 a11y.
10. **Full regression** suite green (`npm run e2e:prod`) to declare done (§6 gate).

**pgTAP file** (new, e.g. `supabase/tests/2xx_ethics_e1.sql`, on a **fresh reset** — memory
`pgtap-needs-fresh-reset-vs-e2e-leftovers`): the predicate truth-tables (respondent/recusal/grants/ceiling
NEG+POS), the two new tables' RLS boundary + the recusal self/coordinator asymmetry, participant-write
authority (reader denied), the IV2 fold-in enforcement, the **flag-OFF fallback**, t19 REVOKE guards on
**every** new RPC, and the audit allow-list unchanged. This file is the m2-flip gate.

---

## 5. QA scope

Requirements audit vs ADR 0072 + this plan; **RLS review** of the modified `can_read_case` /
`can_read_case_patient` / `can_write_case_content` / `can_read_attachment` (truth-table coverage,
**deny-terms precede grants**, no anon/PUBLIC leak, **R6 base-table traversal** confirmed — no
`case_participants` RLS read inside the DEFINER, flag-OFF fallback byte-for-byte); confirm the new tables'
write-lockdown (DEFINER-only) and grant/RLS pairing (F1 MAJOR-1 class of bug); confirm the M2 posture (§7)
matches what ships (no `dispose_professional_profile`); verify the m2-flip checklist is genuinely green
before the flip. Verdict → `docs/reviews/`.

---

## 6. Risks & ripples

- **`can_read_case` is the platform's most-consumed predicate.** The edit ripples to every
  `can_read_case`-gated SELECT (all case children) + `can_read_attachment` + `can_read_professional_profile`
  (which calls it) + `list_my_cases` + `get_case_detail`. Mitigation: deny-terms are **pure additions
  before** the existing arms (no existing arm reordered/removed for `commission_default`); the conditional
  member arm keys on a new `cases` column defaulting to today's behaviour; the full E2E re-run + the
  flag-OFF pgTAP keystone catch a regression. The **highest-risk task (BE-4) gets the fullest review**.
- **Member-wide-arm subtlety (ADR 0072 D2·8).** Enumerate during BE-4 exactly which member-facing surface
  each `commission_default` case relies on (board, Meus Casos, meeting case-labels, timeline case refs) so
  no `commission_default` case loses reach when the `explicit_grants_only` conditional lands — the arm
  change must be a **no-op** for `commission_default`. (Same D2 ripple discipline as ADR 0033 §7.)
- **Recusal self-read asymmetry (D4 note).** A recused user must see *that* they are recused (banner)
  without gaining case read — the `case_recusals` SELECT self-arm handles it; QA verifies the recused user
  cannot pivot from the recusal row to case content.
- **IV2 serialization.** BE-6 edits interview tables + `interviews/actions.ts` that IV2 owns; IV2 must be
  **fully gated** (S2) before E1 BE-6 starts — the plan sequences it so. Do **not** start BE-6 concurrently
  with any IV2 follow-up.
- **MEM predicate-name churn.** E1's arms reference the membership predicates; MEM (S1) collapses them to
  `has_role()` + thin wrappers. E1 references the **post-MEM** shape; MEM regens `database.ts` before E1.
- **Performance.** The respondent/recusal deny-terms add two `exists` sub-queries per `can_read_case`
  call. Keep index-friendly: `case_participants(case_id)` + `case_participants(participant_id)` exist;
  `professional_participants(participant_id)` PK covers the join; add `case_recusals(case_id, user_id)
  where lifted_at is null` (partial) + `professional_profiles(user_id) where user_id is not null`. Verify
  with the `supabase-postgres-best-practices` skill during BE-4.

---

## 7. Sequencing & gate

Contract-first: **BE-1 first** (posts §2 types). Then BE-2→BE-8 as tabled (schema → tables → predicates →
RPCs → IV2 fold-in → reads/audit → **checklist-gated flag flip**). `backend` owns all files (no `frontend`
in E1). Tester spawned when the phase builds green locally + pgTAP passes on a fresh reset; QA after tester
green. Then human approval (**including M2-posture sign-off**, §ADR 7), then §6 Record: PROGRESS → ✅,
`docs/backend-state.md` updated (new tables/RPCs/predicate terms + the flag flip), ADR 0072 gains an
**As-built** section (deltas/Q-rulings), rotate task detail, `graphify update .`, commit
`phase(E1): complete — Ethics access spine + m2 gate release`.

**The m2 gate is the keystone:** `case_participants` + `case_types` flip ON **only** at BE-8, **only** when
the m2-flip checklist (ADR 0072) is green. Until then the flags stay OFF and no environment holds real
ethics data (0064 §m2).
