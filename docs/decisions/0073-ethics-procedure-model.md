# 0073 — Ethics procedure model: admissibility → notice → allegations/findings → hearing → vote → decision → appeal

**Date:** 2026-07-13 · **Status:** ✅ **BUILT + gate-passed + human-approved 2026-07-18** (As-built below); ff-merged to `main`. *(Originally: proposed S0 design gate.)*
**Owner:** platform lead → `backend`. **Gate unit:** ETH·E2 of the
[Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR
[0071](./0071-pre-pilot-release-scope-expansion.md)); ratified against the
[S0 spine](../plans/pre-pilot-release-s0-ratification.md).
**Build plan:** [`docs/phases/ethics-e2-procedure.md`](../phases/ethics-e2-procedure.md).

**As-built (Record 2026-07-18).** ETH·E2 shipped through the full Phase Gate (build → E2E 20/20 + full-suite
green → QA APPROVED 0 P0/0 MAJOR → PO approval) and ff-merged to `main`. Commits `ada4c97`…`2adb169`;
migrations `20260817000000`–`…000700`; SQLSTATE `HC0J·`; pgTAP `253`–`259`; E2E `e2e/ethics-e2-procedure.spec.ts`;
QA report [`docs/reviews/eth-e2-review.md`](../reviews/eth-e2-review.md).
- **O-3 quorum — RESOLVED (was left open).** `issue_decision` issues only when `votes_cast >= required`, where
  **`required = greatest(coalesce(commission_meeting_settings.quorum_value, ceil(eligible/2)), 1)`** — i.e. the
  commission's configured `quorum_value` if set, else a simple majority of `app.eligible_voters(case)`, floored at 1.
  `eligible_voters` = active commission members − recused − respondent. Under-quorum → `HC0J8`. (Catalog-verified.)
- **Follow-ups (QA info, non-blocking):** **INFO-1** — a respondent can `PATCH` their *own* targeted-response
  `status` directly via PostgREST, bypassing the `submit_targeted_case_response` audit row (self-scoped +
  non-escalating, but an audit-completeness gap worth closing). **INFO-2** — org_admin sees case-phase responses
  via the pre-existing `responses` admin arm, not a D13 widening.

**Amended (2026-07-14):** adds **§D13** (respondent targeted-submission door) and **§D14** (case-restricted
hearings) — two capability additions the PO approved after the 0072/0073-vs-handoff evaluation. Both are
**column + predicate + RPC** additions with **zero new tables**; the data model is otherwise unchanged. §D13
closes a functional hole (a respondent could not submit a defense without gaining case read); §D14 closes a
confidentiality leak (a recused/non-granted member could read hearing minutes via ordinary meeting
membership). §D14 **re-opens** the X-η CH↔E2 meetings-file serialization (see §D14). The nine-table set,
naming, and every other decision are unchanged.

**Amended (2026-07-18) — reconciled to ADR [0078](./0078-authorization-capability-model.md) (authorization
capability model; ACCEPTED 2026-07-17, live on `main`; the AUDIT-DOOR-BLINDNESS P0 that followed it closed
2026-07-18).** ADR 0073 and its build plan were authored 2026-07-13/14, **before** 0078 replaced the
case-authorization spine (the `app._case_caps` bitmask resolver + the `case_access` → `case_access_grants`
hard cut + the Stage-C meeting-confidentiality model). E2 builds on the **post-0078** surface. **No table is
added or removed — the nine-table set is unchanged.** The seven reconciliation deltas (each catalog-verified
against `main`, 146/146 migrations):

1. **SQLSTATE `HC0F0–HC0F9` → `HC0J0–HC0J9`.** 0078 took `HC0F0–HC0F6` (live). E2's block is relocated to
   `HC0J·` (catalog-verified free); §D11's table and every `HC0J·` reference in this ADR are the remapped
   values. RV2 keeps `HC0A·`; CH moves to `HC0K·` (scope-expansion plan §3.1).
2. **§D14 reconciled onto Stage C — the parallel `can_read_meeting` + meeting-child-policy rewrite is
   WITHDRAWN (PO-approved 2026-07-18).** D14 predates 0078 Stage C, which **already** rewrote every
   meeting-child SELECT policy (`meetings.visibility_policy ∈ {commission_default, participants_only}`,
   `app.can_reach_meeting`, the `meeting_closed_sessions` reserved-session tiers,
   `meeting_cases_select = can_reach_meeting AND NOT is_case_respondent`). Building D14's *"every meeting-child
   policy delegates to `can_read_meeting`"* would **replace/regress** that shipped model. **Superseded design:**
   `schedule_ethics_hearing` creates the hearing as a **`participants_only` meeting** whose attendee roster is
   the eligible panel (which excludes the recused + the respondent by construction — they are not eligible
   voters). Stage C then delivers D14's isolation: a non-attendee (recused / non-granted / respondent) fails
   `can_reach_meeting` and reads **nothing** of the meeting record, agenda, attendees, signatures, or minutes;
   the case-linked `meeting_cases` substance is already `NOT is_case_respondent` + `read_case_deliberation`-
   gated. **Dropped:** `meetings.restricted_to_case_id`, `app.can_read_meeting`, the meeting-child policy
   rewrite, `create_case_restricted_meeting`, the single-case invariant. **Kept:** the requirement + the O-7a
   "Audiência" seed. **Mechanism (catalog-verified):** no product RPC creates a `participants_only` meeting
   today (`create_meeting` always inserts `commission_default`), so E2's own `schedule_ethics_hearing` DEFINER
   door inserts the meeting with `visibility_policy='participants_only'` + the panel roster (the
   `app.trg_meetings_roster` non-empty-roster guard applies). **E2 does not edit `create_meeting`, so the X-η
   CH↔E2 collision shrinks back to seed-only** (the D14-reopened serialization is retired). **Residual, accepted
   pre-pilot:** a member recused *after* being rostered still reads the meeting *shell* (not the case
   substance, which stays exclusion-gated); a post-pilot hardening may add `restricted_to_case_id` as an
   **additive** conjunct, never a rewrite. §D8's `create_case_restricted_meeting` reference is superseded by
   this door.
3. **§D3 decision-letter confidentiality — `legal_privileged`/`credentialing_sensitive` defer to Stage E
   (post-pilot).** 0078 A19/B3 **fenced** those two labels (`reclassify_attachment` rejects them) and made the
   `max_confidentiality` clearance a RESERVED column whose write-path ships in Stage E, post-pilot. So
   pre-pilot E2 **cannot** create a `legal_privileged` decision letter and there is no clearance to gate it
   below. Pre-pilot, `ethics_decision_details.decision_letter_document_id` rides the **ordinary case-
   confidentiality gate** (`can_read_case` + the case's `confidentiality_level`), like every case attachment;
   the *"legal_privileged decision letter invisible below clearance"* acceptance criterion **moves to Stage E**.
4. **E2 gains the ethics coordinator app-actions + UI (AUTHZ handoff PO decision 8).** The five DEFINER doors
   `set_case_visibility` / `set_case_confidentiality` / `declare_conflict` / `record_recusal` / `lift_recusal`
   are **live** (E1 + M6), but their app actions throw `notImplemented` with **no UI bound** (verified:
   `src/lib/case-recusals/actions.ts`). PO decision 8 routed *"the `setCaseVisibility` app action + coordinator
   control, with its four siblings"* to **E2**. E2 wires the five server actions to their live doors + builds
   the **coordinator controls** (declare-conflict / record-recusal / lift-recusal / set-visibility / set-
   confidentiality). Terminology/dashboards stay E3a.
5. **§D0 mapping fix.** D0 mapped the design's `case_access_grants` → *"our shipped `case_access`."* 0078's hard
   cut **inverted** this — our table **is** `case_access_grants` now; `case_access` is dropped. (Doc only.)
6. **The inherited E1 gaps are lighter post-0078.** (a) the `action_items` `assignees_only` leak
   (respondent-who-is-org_admin) is **substantially closed** — `can_read_action_item` now carries the
   `is_active` outer gate + an `is_case_excluded(anchor_case)` deny and C7/A11 removed the org-admin arm
   (E2 confirms + keystones); (b) the privileged-doc coordinator-clearance affordance **defers with Stage E**
   (fenced labels, no such doc pre-pilot); (c) the `patient_safety_event` link-inference residual stays
   **post-pilot** (Stage D). The two test-only sweep Minors overlap the **AUDIT-DOOR-BLINDNESS P0 standing
   invariant** (ADR 0079) — E2 verifies subsumption rather than re-implementing.
7. **`can_read_case` is now a thin projection of `_case_caps`'s `read_case_content` bit (0078 A24·2).** It
   **still exists** as a function, so *"every E2 table is `can_read_case`-gated SELECT"* remains **correct and
   unchanged**. Conformance: an E2 isolation keystone is validated by asserting **rows read under `set local
   role`** (the 0072/0079 discipline), **not** by "reverting `can_read_case`." Ethics tables are **case
   content** (`read_case_content`), the correct tier — not `read_case_deliberation` (the minuted discussion).

Everything else — the nine tables, D1–D13, the graduation test, the M2 retention-pin/redaction (§D9), the
recusal-excluding vote (§D4), the referral hand-off (§D7), hub consumption (§D6) — stands, now expressed over
the 0078 surface. ⚠ **§D9 note:** `professional_profiles` shipped 0078's **`link_state`** column (B7:
`linked`/`no_account`/`unknown`; `add_case_participant` rejects an `unknown` profile as `respondent_doctor`).
E2's `redact_professional_profile` sets `link_state` (a redacted profile → `no_account`, `user_id` nulled) on
top of the retention columns, and the pin trigger must not fight B7.

**Continues / depends on:**
- **Continues ADR [0064](./0064-case-subject-generalization-participants.md)** (the E0 participant
  foundation) §"Open items" 2 — the ethics *procedure* table set it defers. E2 builds the
  disciplinary lifecycle **on top of** the generalized-subject engine (`cases` + `case_participants`
  + `case_types`), never a forked `ethics_cases` root (the anti-pattern 0064 rejects).
- **Hard-depends on ADR [0072](./0072-ethics-access-spine.md)** (ETH·E1 — the access spine): E2's
  read/write authority rides E1's `can_read_case` (respondent-exclusion + recusal + explicit-grants
  + confidentiality ceiling) and E1's participant-write RPCs. **E2 introduces no new case-read RLS
  shape** — every E2 child table is `can_read_case`-gated for SELECT and DEFINER-RPC-only for
  writes, exactly as E1 established (D4). E2's `case_votes` gate **consumes** E1's
  `app.is_recused_from_case` and `app.is_case_respondent`. **E1 → E2 is strictly sequential.**

**Amends:**
- **ARCHITECTURE.md Rule 12** — settles the **M2 professional-identity redaction mechanics** E1's
  ADR-0072 §7 recommendation deferred to E2: the retention-pin trigger and the
  `redact_professional_profile` minimise-not-destroy path live here (§D9), because E2 is where the
  *decision* that triggers the pin exists.

**Relates:** ADR [0035](./0035-lgpd-anvisa-regulatory-posture.md) (LGPD Art. 18 vs
CFM-1821/2007 20-yr retention — the M2 basis), ADR [0037](./0037-inter-committee-referrals.md) (the
inter-committee referral channel E2 **reuses** for the CRM/CFM/legal hand-off — §D7, not a new
primitive), ADR [0050](./0050-action-items-fold-visibility-scope-case-access-expiry.md) +
[action-items-satellites](../plans/action-items-satellites.md) (the `action_items` hub E2 **consumes**
for sanctions/remediation — X-ε, §D6), Phase 20 Notifications (the `compute_due_notifications` engine
E2 **registers a scan arm on** for notice deadlines — X-ζ, §D5), the external design
[`case_generalization_chatgpt.md`](../design/temp/case_generalization_chatgpt.md) §11.4/§12/§17 (the
candidate schemas we adopt **in our idiom**).
**Binding rules:** Rule 1 (RLS is the boundary), Rule 2 (canonical schema — extend, never contradict),
Rule 6 (**R6 anti-recursion**, ADR 0064), Rule 7 (sanitized Markdown, never raw HTML), Rule 10 (pt-BR
UI / English code), Rule 11 (audit), Rule 12 (PHI + the Class-2 professional class).

---

## Context

ADR 0064 built the generalized-subject **E0 foundation** and ADR 0072 (ETH·E1) made it **safe to hold
real complaint data** — respondent-exclusion, recusal/COI, explicit-grants-only, a confidentiality
ceiling, and the participant-write RPCs, releasing the m2 gate (`case_participants` + `case_types` ON).
What E1 does **not** build is the **procedure itself**: the disciplinary lifecycle a Comissão de Ética
Médica actually runs — receive a *denúncia*, judge admissibility, notify the *médico denunciado* with a
**deadline** to respond, enumerate **allegations** and reach a **finding** on each, hold a **hearing**,
take a **formal vote** (from which a recused member is excluded), issue a **decision** carrying a
sanction and — where the matter exceeds the committee's authority — a **referral to the CRM/CFM or the
legal department**, and handle an **appeal**.

Today a committee can only approximate this with free-text narratives, generic `case_events`, and manual
`action_items`. That is insufficient for three reasons the ADR-0064 "graduate to a table where
deadlines/querying/defensibility demand" test names directly:

1. **Deadlines.** A *prazo de defesa* (statutory response window) and an *external-reporting deadline*
   must be **queryable and remindable** — they feed the Phase-20 notification engine. A deadline buried
   in a narrative cannot.
2. **Defensibility.** A disciplinary record is a CFM-1821/2007 20-year artifact whose **structure is the
   evidence** — which allegations, what finding on each, who voted how, what sanction, when the
   respondent was notified. A flat text field forecloses the audit a regulator (or a court) expects.
3. **Querying.** Ethics **dashboards** (E3a) — case counts by outcome, cycle-time, sanction
   distribution — require the finding/decision/vote to be structured columns, not prose.

E2 therefore **graduates** the procedure into tables. This ADR records which objects become tables
(and which deliberately stay narrative/form), the CRM/CFM decision model, the recusal-excluding vote,
and the M2 redaction mechanics — all **inside** our idiom (RLS boundary, DEFINER doors, hash-chained
audit, feature-flag dark-launch), not the external design's plaintext-column version.

**Non-goals.** E2 does **not** re-model access (E1 owns `can_read_case`), does **not** build ethics
terminology/UX or dashboards (E3a), does **not** build the accreditation-standard evidence link (E3b,
gated on Phase 16), and does **not** re-implement notification delivery (N owns the engine; E2 adds one
scan arm) or the action-items hub (AI owns it; E2 creates rows through it).

---

## The graduation test (ADR 0064) — table vs narrative/form, decided per object

ADR 0064 §"Open items" 2 says some procedure sub-objects "may debut as narrative/form phases and
graduate to tables where deadlines/querying/defensibility demand." We apply that test to every
candidate object. **Decision rule:** a table is justified when the object (a) carries a **deadline** the
notification engine must scan, (b) is **queried structurally** by a dashboard or a lifecycle gate, or
(c) is a **defensibility unit** whose individual identity/status must survive as an auditable row.
Objects that are merely *descriptive prose about the case* stay narrative/form.

| Object | Verdict | Which test triggers it | Rationale |
|---|---|---|---|
| **`ethics_case_details`** (1:1) | **TABLE** | (b) querying · (c) defensibility | Admissibility status, complaint intake date, complaint channel, the *prazo* clock origin — all queried by lifecycle gates + dashboards; a 1:1 extension keyed by `case_id` (the 0064 `mm_case_details` shape). |
| **`ethics_allegations`** (N) | **TABLE** | (b) querying · (c) defensibility | A complaint has *N* allegations, each with its **own** status/finding — flattening to one text field destroys the per-allegation finding a disciplinary record needs (0064 D-guidance; design §17.2). |
| **`ethics_findings`** (1 per allegation) | **TABLE** | (c) defensibility | The formal conclusion on each allegation is the evidentiary core; must be an addressable row, not prose. Modeled 1:1-with-allegation (a `unique(allegation_id)`), not a free N. |
| **`ethics_notifications`** (formal notices, N) | **TABLE** | (a) **deadline** · (c) defensibility | *The* deadline object — `due_at` feeds the N scan arm (X-ζ, §D5). Each formal notice (respondent notification, request-for-response, hearing notice, decision notice) is a procedural event with acknowledgement state (design §17.5). |
| **`case_decisions`** + **`ethics_decision_details`** (1:1) | **TABLE (both)** | (a) deadline · (b) querying · (c) defensibility | The generic decision (status/decided_at/decided_by) is engine-shared (M&M reuses it); the ethics extension carries sanction + external-reporting + appeal deadlines (design §12/§17.4). **Modeled CRM/CFM explicitly** (§D3), not a generic board. |
| **`case_votes`** (N) | **TABLE** | (c) defensibility | A formal deliberation record — who voted how, one vote per member per decision. **A recused member cannot vote** (§D4). Design §11.4. |
| **`ethics_hearings`** (N) | **TABLE** | (a) scheduled_at · (c) defensibility | Hearing-specific metadata (type, presence flags, outcome) that a generic meeting does not carry; **rides a `meetings` row** via `meeting_id`. The X-η "meeting-type" label reuses the existing `commission_meeting_types` catalog rather than a new column (§D8, Open decision O-7). Design §17.6. |
| **`ethics_appeals`** (N) | **TABLE** | (a) deadline · (c) defensibility | Affects case finality + carries its own review deadline; explicit lifecycle (design §17.7). |
| **Respondent's written defense / statement** | **NARRATIVE/FORM** (not a new table) | — fails all three | This is *content authored about the case*, not a deadline/queried/defensibility-unit. It attaches as a **`responses` row targeted at the respondent participant** via `target_case_participant_id` (§D10) or as a `case_narratives`/`attachments` row — the existing content surfaces. The **deadline** to submit it is the `ethics_notifications` row (a table); the defense *itself* is form/narrative. |
| **Allegation-level evidence bundle** | **NARRATIVE/FORM** (attachments) | fails all three | Evidence is `attachments` (F2) with `owner_type='case'` + a confidentiality label (E1 D5), referenced from a finding's `evidence_summary` text — not a new evidence table. |
| **Deliberation discussion** | **NARRATIVE/FORM** (existing) | fails all three | The design's generic `case_discussions` (§11) is *descriptive prose*; we already have `case_events` + meeting minutes + `case_narratives`. The **vote** graduates (a table); the discussion does not. |

Net: **nine tables** (`ethics_case_details`, `ethics_allegations`, `ethics_findings`,
`ethics_notifications`, `case_decisions`, `ethics_decision_details`, `case_votes`, `ethics_hearings`,
`ethics_appeals`) + additive **columns on existing tables** (`responses.target_case_participant_id` — now
the **respondent targeted-submission seam**, §D13; `meetings.restricted_to_case_id` — the
**case-restricted-hearing access root**, §D14; `professional_profiles.retention_pinned_at`/`_reason`/
`redacted_at`/`_by` for §D9; the hearing **type label** still reuses the `commission_meeting_types` catalog
with **no** `meeting_type` column, §D8/O-7) + **two catalogs** (`ethics_allegation_categories`;
`case_assignment_roles`) + a nullable `case_phases.assignment_role_id`. **§D13 and §D14 add zero tables**
(predicates, RPCs, and two columns only). Everything else is form/narrative on surfaces that already exist.

---

## Decision

### D0 — One generalized engine, ethics as an extension layer (never a fork)

Every E2 table is a **child of `cases`** keyed by `case_id` (with the one 1:1 decision-extension keyed
by `decision_id`), annotating the shared engine exactly as ADR 0064 D0 mandates. There is **no
`ethics_cases` root, no `committee_cases` rename** (the external design's generic names —
`committee_cases`, `users`, `case_access_grants`, `committee_meetings` — map to our shipped
`cases`, `profiles`, `case_access_grants`, `meetings`). *(Amended 2026-07-18: our per-case ACL table **is**
`case_access_grants` now — ADR 0078's `case_access` → `case_access_grants` hard cut adopted the design's name;
the pre-0078 `case_access` this line originally cited is dropped.)* The generic `case_decisions` + `case_votes` are
**engine-level** (M&M and credentialing will reuse them); only the `ethics_*` extension tables are
ethics-specific. This keeps audit, ACL, documents, timeline, dashboards, and referrals **unforked**.

**Naming.** We adopt the design's `ethics_case_details` / `ethics_decision_details` / `ethics_hearings` /
`ethics_appeals` and the engine-level `case_decisions` / `case_votes` as-is, but **drop the design's
`_case_` infix** on the three tables where it is redundant on an already `case_id`-keyed table: the design's
`ethics_case_allegations` / `ethics_case_findings` / `ethics_case_notifications` become
`ethics_allegations` / `ethics_findings` / `ethics_notifications`. This is a naming preference (brevity),
frozen at the build-plan contract — Open decision **O-1**.

### D1 — Admissibility & intake: `ethics_case_details` (1:1)

A 1:1 extension keyed by `case_id`, the ethics annotation of the shared case (0064 `mm_case_details`
shape):

```
ethics_case_details
  case_id uuid PRIMARY KEY references cases(id) on delete cascade,
  admissibility_status text not null default 'pending'
    check in ('pending','admissible','inadmissible'),
  admissibility_decided_at timestamptz, admissibility_decided_by uuid → profiles,
  admissibility_rationale_md text,          -- sanitized Markdown (Rule 7)
  complaint_channel text check in ('internal','patient','external_body','anonymous','other'),
  complaint_received_at timestamptz,         -- the prazo-clock origin
  summary_md text,                           -- sanitized Markdown
  created_at, updated_at
  -- RLS SELECT: can_read_case(case_id, auth.uid())  (E1 predicate — respondent excluded)
  -- writes: DEFINER RPC only (upsert_ethics_case_details / decide_admissibility)
```

Admissibility is the lifecycle entry gate: a **`inadmissible`** case can be `close_case`-d without a
decision/vote; an **`admissible`** case proceeds. `decide_admissibility` is coordinator-gated, audited
`ethics.admissibility_decided`.

### D2 — Allegations & findings: `ethics_allegations` (N) + `ethics_findings` (1 per allegation)

```
ethics_allegations
  id uuid PK, case_id uuid not null references cases(id) on delete cascade,
  allegation_category text not null,        -- catalog value (see below)
  description_md text not null,             -- sanitized Markdown (Rule 7)
  alleged_event_date date,
  severity text check in ('low','moderate','high','critical'),
  status text not null default 'under_review'
    check in ('under_review','substantiated','not_substantiated',
              'partially_substantiated','dismissed','referred_elsewhere'),
  created_by uuid → profiles, created_at, updated_at
  -- RLS SELECT: can_read_case; writes: DEFINER (add/update_ethics_allegation)

ethics_findings
  id uuid PK, allegation_id uuid not null references ethics_allegations(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,   -- denormalized for the RLS predicate
  finding text not null
    check in ('substantiated','not_substantiated','partially_substantiated',
              'inconclusive','dismissed'),
  rationale_md text, evidence_summary_md text,   -- sanitized Markdown
  decided_by uuid → profiles, decided_at timestamptz not null default now(),
  unique(allegation_id),                     -- ONE current finding per allegation
  created_at, updated_at
  -- RLS SELECT: can_read_case(case_id, ...) ; writes: DEFINER (record_ethics_finding)
```

**`case_id` is denormalized onto `ethics_findings`** so its SELECT policy is a **base-table**
`can_read_case(case_id, auth.uid())` with no join to `ethics_allegations` — the R6/performance
discipline E1 uses for `case_recusals`. `allegation_category` is a **catalog** (dialect-2, ADR 0065:
`ethics_allegation_categories` seeded per the design's list — `professional_misconduct`, `negligence`,
`breach_of_confidentiality`, `conflict_of_interest`, `documentation_falsification`, … — extensible
without a migration), **not** a bare enum, since committees add categories. **Open decision O-2:**
catalog-vs-enum for `allegation_category` (recommend catalog); confirm.

### D3 — Decision model: `case_decisions` (engine) + `ethics_decision_details` (1:1) — CRM/CFM explicit

The generic decision is **engine-level** (reused by M&M/credentialing), the ethics extension is 1:1:

```
case_decisions                              -- ENGINE-LEVEL (not ethics-specific)
  id uuid PK, case_id uuid not null references cases(id) on delete cascade,
  decision_type text not null,              -- catalog (case-type-scoped)
  summary_md text not null,                 -- sanitized Markdown
  rationale_md text,
  status text not null default 'draft'
    check in ('draft','proposed','voted','issued','appealed','voided'),
  decided_at timestamptz, decided_by uuid → profiles,
  created_at, updated_at
  -- RLS SELECT: can_read_case; writes: DEFINER

ethics_decision_details                     -- 1:1 ethics extension
  decision_id uuid PRIMARY KEY references case_decisions(id) on delete cascade,
  sanction_type text,                       -- catalog: none/advertência/censura/suspensão/…
  sanction_start_date date, sanction_end_date date,
  remediation_required boolean not null default false, remediation_description_md text,
  -- CRM/CFM / legal external reporting — modeled EXPLICITLY (not a generic 'board' string):
  external_reporting_required boolean not null default false,
  external_reporting_target text check in ('crm','cfm','legal_department','police','other'),
  external_reporting_referral_id uuid references case_referral(id),  -- the ADR-0037 hand-off (§D7)
  external_reporting_deadline timestamptz, external_reporting_completed_at timestamptz,
  appeal_allowed boolean not null default true, appeal_deadline timestamptz,
  decision_letter_document_id uuid references attachments(id),       -- F2 attachment
  created_at, updated_at
  -- RLS SELECT: can_read_case(via the parent decision's case) ; writes: DEFINER
```

**CRM/CFM is modeled as a first-class, typed hand-off, not a free string.** `external_reporting_target`
is a constrained vocabulary (`crm` = Conselho Regional de Medicina, `cfm` = Conselho Federal,
`legal_department`, `police`, `other`), and when the target is an external regulatory body the actual
**hand-off reuses the ADR-0037 referral channel** (§D7) via `external_reporting_referral_id` — so the
CRM/CFM report travels over the platform's existing frozen-snapshot + audited-PHI-door machinery, not a
new bespoke path. `sanction_type` is a **catalog** (Brazilian CEM vocabulary: *advertência confidencial*,
*censura confidencial*, *censura pública*, *suspensão do exercício profissional*, *cassação* — CFM
resolutions), extensible. The decision **carries the appeal deadline** (feeds N, §D5).

### D4 — `case_votes` (N) — a recused member cannot vote

```
case_votes                                  -- ENGINE-LEVEL, ethics is the primary consumer
  id uuid PK,
  case_id uuid not null references cases(id) on delete cascade,
  decision_id uuid not null references case_decisions(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete set null,   -- the hearing/meeting where cast
  voter_id uuid not null references profiles(id) on delete restrict,
  vote text not null check in ('approve','reject','abstain'),   -- NOTE: NO 'recused' value — see below
  rationale_md text,
  voted_at timestamptz not null default now(),
  unique(decision_id, voter_id),            -- one vote per member per decision
  created_at
  -- RLS SELECT: can_read_case(case_id, auth.uid())  (a recused member is already can_read_case-denied)
  -- writes: DEFINER RPC cast_case_vote ONLY
```

**Recusal exclusion — the E1 consumption keystone.** The design's schema puts `'recused'` in the vote
enum; **we do not**. Recusal is an **access fact enforced by E1**, not a ballot option:

- `cast_case_vote(p_decision_id, p_vote, p_rationale_md)` is a **`SECURITY DEFINER`** RPC that, before
  inserting, **hard-checks** `app.is_recused_from_case(v_case_id, auth.uid())` (E1 D-note) and
  `app.is_case_respondent(v_case_id, auth.uid())` — either true ⇒ `raise … HC0J5` (*membro impedido não
  pode votar*). A recused/respondent user **cannot even reach** the vote (E1 already denies their
  `can_read_case`, so they cannot open the deliberation), and the RPC is the belt: even if some future
  arm surfaced the decision, the vote is refused at the door.
- Because `can_read_case` **hard-denies** a recused member (E1 D2, deny-terms first), a recused member
  is **structurally absent** from the eligible-voter set — there is no "recused" ballot to record;
  their absence *is* the recusal, and the `case_recusals` row (E1) is the auditable record of *why*.
  This is cleaner than a `'recused'` vote value (which would imply the recused member acted on the
  decision) and it is **R6-safe** (the check is over base tables inside a DEFINER).
- The eligible-voter roster a hearing surfaces = commission members **minus** recused **minus** the
  respondent — computed by a DEFINER helper `app.eligible_voters(p_case_id)` used by the read
  projection (not RLS), so the UI can show "5 de 7 membros aptos a votar" without leaking who is
  recused to a non-coordinator (the coordinator sees the recusal roster via E1's `case_recusals`
  self+coordinator SELECT arm).

A `close_case` / decision-issuance gate MAY require a quorum of `approve`+`reject`+`abstain` votes
against the eligible roster (reusing `commission_meeting_settings` quorum, X-η) — deferred as a
build-plan refinement (Open decision O-3: enforce vote quorum before `issue_decision`, or leave
advisory).

### D5 — `ethics_notifications` (N) — formal notices with deadlines → the N scan arm (X-ζ)

```
ethics_notifications
  id uuid PK, case_id uuid not null references cases(id) on delete cascade,
  recipient_participant_id uuid references case_participants(id) on delete set null,
  recipient_user_id uuid references profiles(id) on delete set null,   -- when the recipient is a platform user
  notification_type text not null check in
    ('complaint_acknowledgement','respondent_notification','request_for_response',
     'hearing_notice','decision_notice','appeal_notice','external_reporting_notice','other'),
  delivery_method text not null check in ('email','letter','in_person','system','phone','other'),
  status text not null default 'pending' check in ('pending','sent','acknowledged','failed','cancelled'),
  sent_at timestamptz, acknowledged_at timestamptz,
  due_at timestamptz,                        -- THE DEADLINE — the prazo de defesa / response window
  related_document_id uuid references attachments(id),   -- the notice letter (F2)
  notes_md text,                             -- sanitized Markdown (PHI-free per Rule 12 posture)
  created_by uuid → profiles, created_at, updated_at
  -- RLS SELECT: can_read_case ; writes: DEFINER (issue_ethics_notification / acknowledge / cancel)
```

**The X-ζ scan arm (E2 owns the arm; N owns the engine).** When N is live,
`compute_due_notifications()` gains one additive, idempotent `union all` branch — the **same contract
shape** the AI·sat reminder arm uses (`action-items-satellites.md` §3):

```sql
-- ETH·E2 arm: due/overdue ethics notice response deadlines.
select
  n.case_id                         as entity_id,     -- click-through resolves to the case
  'ethics_notification'             as entity_type,   -- NEW value in N's entity_type domain
  coalesce(
    n.recipient_user_id,                               -- a platform-user recipient (rare)
    app.commission_staff_admin_of_case(n.case_id)      -- else the coordinator chasing the prazo
  )                                 as user_id,
  'ethics_notice_due'               as kind,          -- NEW value in N's notifications.kind domain
  app.commission_of_case(n.case_id) as commission_id,
  n.notification_type               as entity_title   -- PHI-free label (Rule 12); NOT the respondent name
from public.ethics_notifications n
where n.due_at is not null
  and n.status in ('sent','pending')                  -- an acknowledged/cancelled notice never re-fires
  and n.acknowledged_at is null
  and n.due_at::date = current_date                    -- date-equality → naturally one-shot per day
  and coalesce(n.recipient_user_id, app.commission_staff_admin_of_case(n.case_id)) is not null
```

**Contract terms (binding on both N and E2, mirroring X-ζ):**
- **Recipient resolves to a single user** — the platform-user recipient if any, else the case's
  coordinator (who is the party responsible for chasing an unacknowledged *prazo*). Never a fan-out;
  N's `notifications` RLS is own-row. External-only recipients (a *médico denunciado* with no account,
  notified by letter) route the reminder to the **coordinator**, not a null-user row.
- **`kind = 'ethics_notice_due'`**, **`entity_type = 'ethics_notification'`** — new values E2's arm
  introduces to N's domains (N owns the CHECK; E2 names the values it needs). An **escalation** variant
  (`ethics_notice_overdue` past `due_at`) MAY be a second date-comparison arm — deferred to the E2 build
  as an additive refinement.
- **PHI-free (Rule 12).** `entity_title` is the notice **type** (*"Notificação ao denunciado"*), never
  the respondent's name or the allegation text. The notification body N composes is PHI-free by the same
  discipline as every other scan source.
- **Idempotency** is N's engine's job — de-dup by `(user_id, kind, entity_id, created_at::date)` (the
  X-ζ contract); this table stores **no send-state** (no `last_notified_at`), exactly as AI·sat's
  reminders store none.
- **Inert until N ships.** The `union all` branch does not exist in `compute_due_notifications()` until
  E2's migration adds it; E2's tables are fully usable (notices issued/acknowledged) with **zero**
  reminder delivery until N lands. E2 hard-depends on N (plan §1), so in the sequenced build N is
  already live when E2 adds the arm.

The **appeal deadline** (`ethics_decision_details.appeal_deadline`) and the
**external-reporting deadline** (`external_reporting_deadline`) are **additional scan sources** the same
arm covers (each a date-equality branch), so a coordinator is reminded when an appeal window is about to
lapse or a CRM/CFM report is overdue.

### D6 — Sanctions & remediation ride the `action_items` hub (X-ε — E2 is a pure consumer)

A decision's **sanctions and remediation tasks become `action_items`**, created through the **existing**
`create_committee_action_item` RPC (source_type `case`, hard-forced `case_restricted` visibility — ADR
0050), **never** a new ethics-task table. E2 adds **no** hub schema and reuses `can_read_action_item`
verbatim (X-ε §E, the plan's locked contract). Concretely: `issue_decision` (or a follow-on
`assign_remediation`) calls the hub RPC to spin up *"Acompanhar cumprimento de suspensão"* /
*"Concluir treinamento de remediação"* items linked to the ethics case; their reminders ride the AI·sat
reminder satellite → the AI·sat N arm (not E2's own arm). CAPA stays isolated (bridge is escalation, not
a shared table — ADR 0050). This keeps **one hub** (X-ε) and avoids a parallel task surface.

### D7 — Ethics → CRM/CFM/legal hand-off reuses the ADR-0037 referral channel

When a decision's `external_reporting_target ∈ {crm, cfm, legal_department}` and the destination is a
committee/body represented on-platform, the hand-off **reuses the Phase-22 / ADR-0037 referral**: a
`case_referral` is opened from the ethics case (`create_referral_draft` → the frozen-snapshot channel),
carrying the curated decision letter + findings as the snapshot, and `ethics_decision_details.external_reporting_referral_id`
pins it. This gives the CRM/CFM report the referral module's **already-audited PHI single-door + frozen
disclosure boundary + QPS macro-visibility + close-gate** for free — no bespoke external-reporting path.
For a genuinely **off-platform** body (a CRM that is not a platform tenant), the referral is not
applicable: the report is recorded as an `ethics_notifications` row (`notification_type =
'external_reporting_notice'`, `delivery_method = 'letter'`) + the decision-letter attachment, and
`external_reporting_referral_id` stays null. **We do not reinvent** an external-reporting subsystem; we
reuse referrals where the target is on-platform and the notice+attachment record where it is not.
**Open decision O-4:** confirm the pilot's CRM/CFM targets are modeled as on-platform tenants (referral
path) vs off-platform (notice path) — a seeding/config call, not a schema fork.

### D8 — `ethics_hearings` (N) — rides a `meetings` row; the X-η `meeting_type` (reconciled with the existing catalog)

```
ethics_hearings
  id uuid PK, case_id uuid not null references cases(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete set null,   -- the generic meeting it rides
  hearing_type text not null check in
    ('initial_hearing','evidence_hearing','deliberation_hearing','appeal_hearing','other'),
  scheduled_at timestamptz, completed_at timestamptz,
  respondent_present boolean, complainant_present boolean, legal_representative_present boolean,
  summary_md text, outcome_md text,          -- sanitized Markdown
  created_by uuid → profiles, created_at, updated_at
  -- RLS SELECT: can_read_case ; writes: DEFINER (schedule/complete_ethics_hearing)
```

A hearing is **hearing-specific metadata on top of a generic `meetings` row** (the design §17.6 shape):
the meeting carries occurrence/quorum/attendance (Meetings module), the hearing carries the
ethics-specific presence flags + type + outcome. `case_votes.meeting_id` may point at the hearing's
meeting so a vote records where it was cast. E2 does **not** re-model quorum
(`commission_meeting_settings` stays authoritative).

**★ (D14) The hearing's `meetings` row is now case-restricted.** `schedule_ethics_hearing` creates it via
`create_case_restricted_meeting` (`restricted_to_case_id` = the case), so a recused/non-granted member
cannot read the hearing or its minutes/attachments — the isolation guarantee D8 previously lacked. See §D14
(and the X-η re-open it flags). `ethics_hearings`'s own columns are unchanged.

> **★ X-η reconciliation — the S0 "add `meeting_type` column" contract is now a live question (Open
> decision O-7).** S0 §E X-η says *"ETH·E2 adds a `meeting_type` column"* to Meetings. On verification
> the meetings module **already carries a first-class, per-commission, user-managed meeting-type
> catalog** — `public.commission_meeting_types` (`name`, `color_token`, `position`; seeded per
> commission) — that `meetings.meeting_type_id` FKs to (baseline L7194 / L7746). Adding a **second**
> `meeting_type` text column would create exactly the "two schemas for one concept" duplication our
> conventions forbid. Two viable reconciliations, **recommend (a):**
> - **(a) Seed an "Audiência" `commission_meeting_types` row; do NOT add a column.** `ethics_hearings`
>   already discriminates a hearing (its existence + `hearing_type`); the *cosmetic* meeting label rides
>   the existing catalog (a seeded "Audiência" type). **Zero new meetings columns**, no fork — the
>   `ethics_hearings.meeting_id` link IS the semantic "this meeting is a hearing" fact.
> - **(b) Add a narrow orthogonal discriminator** (`meetings.is_hearing boolean` or a nullable
>   `meeting_kind` enum) **only if** a query needs to find hearings without joining `ethics_hearings` —
>   not established as needed.
>
> This is a genuine cross-track contract question because **CH also edits the meetings surface** (X-η):
> if E2 adds no column (option a), the X-η "serialize the meetings-file edits" concern **shrinks to
> seed-only** (E2 touches `seed_default_meeting_types` / a seed migration, not the meetings table DDL),
> materially reducing the CH↔E2 collision. **Flag at the S0 sign-off** so the lead re-ratifies X-η with
> the catalog now in view. The build plan assumes (a) unless overridden.

### D9 — M2 retention-pin + `redact_professional_profile` (the Rule-12 keystone E1 deferred here)

ADR 0072 §7 recommended (for human sign-off) the ADR-0035 **"minimise, do not destroy"** posture for
Class-2 professional identity, and explicitly deferred the **redaction mechanism** to E2 "where the
decision model that triggers the retention pin actually exists." E2 builds it:

**The retention pin (a trigger on the decision lifecycle).** When a `case_decisions` row for an ethics
case transitions to **`status = 'issued'`** (`decided_at` stamped), an `AFTER UPDATE` trigger
`app.trg_pin_respondent_retention` marks **every `respondent_doctor` professional_profile of that case
as retention-pinned**:

```
professional_profiles  += retention_pinned_at timestamptz,       -- NULL = not pinned
                          retention_pin_reason text               -- e.g. 'ethics_decision_issued'
-- the trigger resolves the case's respondent_doctor participants (base-table traversal, R6-safe:
--   case_participants → case_participant_roles(key='respondent_doctor') → professional_participants
--   → professional_profiles) and sets retention_pinned_at = now() where currently null.
```

Once pinned, a profile is **un-erasable**: the disciplinary record's CFM-1821/2007 20-year
defensibility overrides LGPD Art. 18 erasure (ADR 0035's reconciliation). The pin is **idempotent** (sets
only where `retention_pinned_at is null`) and **audited** `professional_profile.retention_pinned`.

**Redaction — the erasure *shape* (minimise, not destroy).** LGPD Art. 18 *correction* is already served
by E1's `update_professional_profile`. Art. 18 *erasure*, **when eligible** (a profile that is a
respondent in **no** pinned/decided case), is served by a new DEFINER RPC — the **same minimise-not-destroy
shape as `dispose_case_phi`**:

```
public.redact_professional_profile(p_profile_id uuid, p_reason text) returns void
  -- 1. GUARD: raise HC0J7 if retention_pinned_at is not null (a pinned profile cannot be redacted).
  -- 2. GUARD: raise HC0J7 if the profile is a respondent in ANY case with an issued decision
  --    (belt: base-table check even if the pin column were somehow clear).
  -- 3. REDACT (not delete): null the identity fields (full_name → 'Profissional (dados removidos)',
  --    license_number/license_region/specialty → null, user_id → null), PRESERVE the row + its id +
  --    every case_participants linkage + audit history.  Set redacted_at / redacted_by.
  -- 4. audited 'professional_profile.redacted' (PHI-free metadata: that + who, never the old identity).
  -- coordinator/org-admin gated; REVOKE ALL FROM PUBLIC → GRANT authenticated, service_role (t19).
```

This is the **erasure path E1 deliberately did not build** (no decided cases existed pre-pilot). It
**never row-deletes** a professional (the governance skeleton + audit survive, mirroring PHI disposal),
and it is **structurally barred** for a pinned profile — so a disciplinary respondent's identity cannot
be erased out from under a defensible record. **Rule 12 amendment (at E2 Record):** the Class-2 bullet's
erasure clause is finalized — *"professional-identity erasure is `redact_professional_profile` (null
identity, preserve row + audit — never deletion), barred while the profile is retention-pinned by an
issued ethics decision (CFM-1821/2007); correction via `update_professional_profile` is always
available."* This closes the ADR-0064 §M2 / ADR-0072 §7 loop.

> **Depends on human sign-off of ADR-0072 §7** at the S0 gate: E2 *implements* the recommendation E1
> *proposed*. If the PO instead wants an active pre-decision erasure path or a different retention
> trigger, that is a scope change to flag before BE build.

### D10 — `responses.target_case_participant_id` + assignment-role vocabulary

Two additive extensions ADR 0064 §"Open items" 3/4 named:

- **`responses.target_case_participant_id uuid null references case_participants(id)`** — so a
  *"Declaração do denunciado"* (Respondent Statement) or a *"Depoimento de testemunha"* (Witness
  Statement) form attaches to a **specific participant**, not just a phase. Nullable (most forms target
  a phase, not a participant); when set, the form's read stays `can_read_case`-gated (no new RLS — the
  column is a projection/filter, not an access term). This is the mechanism by which the respondent's
  **written defense** (a form/narrative, per the graduation table) is bound to the respondent. **§D13
  upgrades this column from a projection into a narrow access door** (`can_access_targeted_response`) so the
  respondent can actually *submit* that defense **without** gaining case read — the projection alone left
  them unable to reach the form (0072 D3 hard-denies them).
  > **Naming note:** the case-phase form-response table is **`public.responses`** (columns
  > `form_version_id`, `commission_id`, `created_by`, `status`, `case_phase_id`, `submitted_at` —
  > baseline L4063), **not** `form_responses` (that is the *external design's* generic name, which the
  > S0 spine / plan §4 quote verbatim from the design doc). The column lands on our real `responses`
  > table; the mapping `form_responses → responses` is the same idiom-translation as
  > `committee_cases → cases` (§D0). The read gate is the response's existing `case_phase_id →
  > case_phases → cases` chain, already `can_read_case`-covered.
- **Case-phase assignment-role vocabulary** — a catalog `case_assignment_roles`
  (`investigator`/`reviewer`/`chair`/`rapporteur`/…) + a nullable
  `case_phases.assignment_role_id` (or an assignment-role column on the phase-assignment surface, exact
  placement in the build plan) so a phase can carry *who plays what role* (relator vs revisor vs
  presidente) in the procedure. Catalog, not enum (committees differ). **Open decision O-5:** whether
  the assignment-role lands on `case_phases` directly or on a separate phase-assignment table — a
  placement call for the build plan (recommend a nullable `case_phases.assignment_role_id` FK, minimal).

### D11 — SQLSTATE block `HC0J0–HC0J9` (S0 §B) + audit verbs

> **⚠ SQLSTATE block relocated `HC0J0–HC0J9` → `HC0J0–HC0J9` (Amendment 2026-07-18).** ADR 0078 took
> `HC0J0–HC0J6` (live in the catalog). E2's block is `HC0J·`; every code below and every `HC0J·` reference
> throughout this ADR is the remapped value (`HC0J0`→`HC0J0` … one-for-one).

| Code | Meaning (pt-BR message) |
|---|---|
| `HC0J0` | ação inválida para o status atual do processo ético (lifecycle guard — admissibility/decision/appeal state) |
| `HC0J1` | apenas a coordenação pode gerenciar este processo ético (write-authority gate where a distinct code aids UX vs 42501) |
| `HC0J2` | categoria de alegação inválida (`ethics_allegations.allegation_category` catalog check) |
| `HC0J3` | já existe uma conclusão para esta alegação (`ethics_findings unique(allegation_id)`) |
| `HC0J4` | já existe um voto deste membro para esta decisão (`case_votes unique(decision_id, voter_id)`) |
| `HC0J5` | membro impedido (recusado ou denunciado) não pode votar (recusal/respondent vote-exclusion — consumes E1) |
| `HC0J6` | prazo/notificação inválido ou já reconhecido (`ethics_notifications` acknowledge/cancel guard) |
| `HC0J7` | perfil profissional protegido por retenção não pode ser eliminado (`redact_professional_profile` pin guard — CFM 20-yr) |
| `HC0J8` | decisão não pode ser emitida sem quórum de votos (reserved — the D4 vote-quorum gate, if O-3 enforces it) |
| `HC0J9` | usuário não autorizado a esta submissão dirigida (`submit_targeted_case_response` — caller is not the targeted participant, §D13) |

> **Block note:** with `HC0J9` assigned to §D13, the `HC0J0–HC0J9` block is **fully allocated**. §D13's
> `target_case_response` and §D14's restricted-meeting guards reuse `HC0J0` (invalid state / cross-case
> link) and `HC0J1` (coordinator authority) — no further code needed. Any *future* ethics SQLSTATE requires
> a new S0-ratified block.

**New audit verbs** (mutation, via `app.audit_write`; PHI-free metadata — Rule 11; new verbs join the
`log_audit_access` allow-list + `_audit_access_authorized` dispatch **only** for the read-doors, per §D):
`ethics.admissibility_decided`, `ethics.allegation_added`, `ethics.allegation_updated`,
`ethics.finding_recorded`, `ethics.notification_issued`, `ethics.notification_acknowledged`,
`ethics.hearing_scheduled`, `ethics.hearing_completed`, `case.vote_cast`, `case.decision_created`,
`case.decision_issued`, `case.appeal_submitted`, `case.appeal_reviewed`,
`case.response_targeted`, `case.targeted_response_submitted` (§D13), `case.restricted_meeting_created` (§D14),
`professional_profile.retention_pinned`, `professional_profile.redacted`. All mutation verbs go through
`app.audit_write` (not the read allow-list — the precedent is AI·sat's non-PHI mutation verbs); the
allow-list gains only genuine cross-member/PHI **read** verbs if any E2 door reads across members (none
identified — E2's reads are all `can_read_case`-gated ordinary case reads, so **no** new `log_audit_access`
entry is expected; confirm at build).

### D12 — E2 owns the `ethics` feature flag

Per S0 §F.4 / §C, **E2 owns `ethics`**: it **creates the flag OFF** in an early E2 migration, gates every
E2 RPC + the E2 table reads behind it (`app.feature_enabled('ethics')`), and **flips it ON via a
separate one-line migration at phase completion**. E2 **adds `ethics: boolean` to the hand-maintained
`FeatureFlags` interface** (`src/lib/queries/feature-flags.ts`) when the first typed caller consumes it.
`seed.sql` may force `ethics` ON for local/E2E. E1 flipped only `case_participants` + `case_types`; E2's
flag gates the **procedure surface** on top of E1's now-live participant/case-type substrate.

**Flag-OFF fallback (byte-for-byte).** With `ethics` OFF: every E2 RPC raises the feature-unavailable
code (`HC000`, reused) exactly like every flagged RPC family; the E2 tables are empty/dark (their RLS is
`can_read_case`, but with no ethics case type seeded and no rows, they are unreachable); the N scan arm's
`union all` branch selects zero rows (no `ethics_notifications` exist); `meetings.meeting_type` defaults
null so the meetings surface is unchanged; `case_decisions`/`case_votes` are engine-level but only E2
writes them, so they too stay empty. No pre-E2 behavior changes. This is a pgTAP keystone.

### D13 — Respondent targeted-submission door: `can_access_targeted_response` (a respondent files a defense without case read)

D10 added `responses.target_case_participant_id` as a **projection/filter**. But ADR 0072 D3 **hard-denies**
a respondent on both `can_read_case` **and** `can_write_case_content`. For the m2 keystone scenario — an
internal doctor who is a platform user, complained about by a peer (0072 D1·1) — that leaves the respondent
with **no path to submit their own defense**: the targeted form is `can_read_case`-gated, and they are
denied. E1 correctly excludes them from the **investigation**; it left them unable to **respond**. D13 adds
the **one narrow exception** — a targeted-submission door that authorizes a targeted participant to reach
**only** their own response, **never** the case.

**A separate predicate — never `can_read_case`, never a re-opening of the respondent hard-deny:**

```
app.can_access_targeted_response(p_response_id uuid, p_uid uuid) returns boolean
  -- SECURITY DEFINER, base-table traversal (R6-safe). True iff ALL hold:
  --   1. responses.target_case_participant_id is not null                 (the response IS targeted)
  --   2. the targeted case_participants row is LIVE (removed_at is null) and resolves to p_uid via
  --        professional_participants.professional_profile_id → professional_profiles.user_id = p_uid
  --      (the only participant→user link that exists — a patient participant has no user, so only a
  --       professional target is reachable; a respondent_doctor or a professional witness qualifies)
  --   3. responses.status is in the op's allowed set   (in_progress → read+write ; submitted → read-only)
```

This predicate **never calls `app.can_read_case`** and **never weakens** the 0072 D2·0 respondent
hard-deny. It is referenced by **exactly three RLS surfaces and nothing else**:

- **`responses`** SELECT / UPDATE — an OR arm: `… OR app.can_access_targeted_response(id, auth.uid())`
  (the UPDATE arm additionally requires `status = 'in_progress'`).
- **`answers`** SELECT / INSERT / UPDATE — the same arm resolved through the parent response:
  `… OR app.can_access_targeted_response(response_id, auth.uid())` (writes require the parent `in_progress`).
- the **form definition** the wizard renders (`form_versions` / `form_sections` / `form_items`) — read via
  the **existing published-form-version read** (form definitions are commission-scoped published artifacts,
  not case PHI). If a build-plan ripple finds the respondent cannot reach the published version, a narrow
  targeted arm is added **there and nowhere else**.

It authorizes **only** that response, its answers, and the form definition. It does **not** authorize
`cases`, `case_participants`, `ethics_allegations`, `ethics_findings`, `case_decisions`, `case_votes`,
`ethics_notifications`, `ethics_hearings`, `meetings`, `case_narratives`, or `attachments` — a respondent
who selects any of those still hits the 0072 hard-deny (zero rows).

**RPCs (DEFINER, t19-guarded):**

- `target_case_response(p_response_id, p_case_participant_id)` — **coordinator-gated**. Validates the
  participant belongs to the **same** case as the response's `case_phase_id → case_phases → cases` chain and
  that the case is ethics-typed; sets `target_case_participant_id`; audited `case.response_targeted`.
  `HC0J1` (authority) / `HC0J0` (invalid state or cross-case participant).
- `submit_targeted_case_response(p_response_id)` — **the targeted user** submits their own defense. Asserts
  `can_access_targeted_response` (else **`HC0J9`** — *usuário não autorizado a esta submissão dirigida*) and
  `status = 'in_progress'`, transitions to `submitted`, freezing answers via the existing
  submitted-immutability guards. It does **not** call `submit_response` (that path checks
  authorship / `can_write_case_content`, which the respondent fails by design). Audited
  `case.targeted_response_submitted`.

The **coordinator** creates the empty `in_progress` targeted response (ordinary phase-response creation +
`target_case_response`), so the respondent never creates a case row; answer writes during `in_progress`
ride the wizard's existing upsert path, now admitted by the `answers` targeted arm.

**State machine + invariants (pgTAP keystones):**

- created `in_progress` (coordinator, targeted at the respondent) → respondent reads + writes answers →
  `submit_targeted_case_response` → `submitted` (read-only to the respondent; immutable).
- The respondent reads/writes **only** the targeted response; every other case table returns zero rows.
- **Another participant cannot open the respondent's draft** — the predicate resolves to a single `user_id`.
- **Soft-removing/replacing the respondent participant** (`removed_at`) revokes future targeted access
  (term 2 checks `removed_at is null`); already-submitted answers persist (immutable).
- A **witness statement** (*Depoimento de testemunha*) reuses the identical door for a professional witness
  who is a platform user — same predicate, same RPCs, no new mechanism.

**Notice delivery stays out-of-band.** The respondent learns *what* to defend against via the
`ethics_notifications` delivery channel (`delivery_method ∈ {email, letter, in_person, …}`) — an external
send, **not** an in-app `can_read_case`-gated read. So D13 needs **no** notice-read door: the deadline object
(D5) is delivered outside the platform; only the defense **form** is reachable in-app, through this door.

**Zero new tables.** D13 is a predicate + two RPCs + three RLS arms over the **existing**
`responses.target_case_participant_id` (D10). The data model is unchanged.

### D14 — Case-restricted hearings: `meetings.restricted_to_case_id` + `can_read_meeting` (a recused/non-granted member cannot read the hearing)

> ⛔ **SUPERSEDED 2026-07-18 (see the top Amendment §2). The mechanism below — `meetings.restricted_to_case_id`
> + `app.can_read_meeting` + "every meeting-child policy delegates to `can_read_meeting`" — is WITHDRAWN.**
> It predates ADR 0078 Stage C, which already rewrote every meeting-child policy (`visibility_policy`,
> `can_reach_meeting`, `meeting_closed_sessions` tiers); building D14 literally would regress that shipped
> model. **Replacement (PO-approved):** `schedule_ethics_hearing` creates the hearing as a **`participants_only`
> meeting** (Stage C) whose attendee roster is the eligible panel — which excludes the recused + respondent by
> construction — so Stage C's `can_reach_meeting` makes the hearing, its agenda, attendees, signatures, and
> minutes invisible to every non-attendee, and the case-linked `meeting_cases` substance stays
> `read_case_deliberation`/`NOT is_case_respondent`-gated. E2 keeps its own `schedule_ethics_hearing` DEFINER
> door (it inserts `visibility_policy='participants_only'` + the roster; `create_meeting` is untouched, so the
> X-η CH↔E2 collision returns to seed-only). The detailed design in the rest of §D14 is retained for history
> only — **do not build it.**

D8 rides a hearing on a `meetings` row, but a plain meeting's access is **ordinary meeting participation**,
which is **not** `can_read_case`-gated. So a **recused** member (0072 denies their `can_read_case`) or a
**non-granted** member of an `explicit_grants_only` ethics case could still read the hearing's **minutes,
agenda, attendance, and attachments** through meeting membership — a confidentiality leak in exactly the
population E1 exists to exclude. D14 closes it: a hearing meeting becomes **case-restricted**, and every
meeting child inherits the `can_read_case` decision.

**One additive column (the access root):**

```sql
alter table public.meetings
  add column restricted_to_case_id uuid null references public.cases(id) on delete restrict;
-- NULL  = ordinary meeting — access UNCHANGED (byte-for-byte today's rule).
-- SET   = a case-restricted hearing — access delegates to can_read_case.
```

**One predicate (R6-safe, DEFINER over base tables):**

```
app.can_read_meeting(p_meeting_id uuid, p_uid uuid) returns boolean
  -- if meetings.restricted_to_case_id is not null
  --      → return app.can_read_case(restricted_to_case_id, p_uid);   -- respondent/recused/grant-gated
  -- else → <the existing ordinary meeting-participation rule, verbatim>;   -- NO regression
```

**Every meeting-child SELECT policy delegates to `can_read_meeting`** — the meeting row,
`meeting_agenda_items`, `meeting_attendees`, `meeting_cases`, minutes, `meeting_signatures`, meeting-owned
`attachments`, and `meeting_action_items`. For an **ordinary** meeting the else-branch reproduces today's
rule **exactly**, so **no non-ethics meeting loses or gains reach** (the flag-OFF / non-ethics invariant — a
pgTAP keystone). For a **restricted** hearing, a recused or non-granted member reads **nothing** — the
meeting, its minutes, and its attachments all vanish together.

**Write authority + the D8 tie-in:**

- `create_case_restricted_meeting(p_case_id, p_meeting_type_id, p_scheduled_at, p_title, …)` —
  **coordinator-gated** DEFINER; creates a `meetings` row with `restricted_to_case_id = p_case_id` and
  `meeting_type_id` = the seeded **`Audiência`** `commission_meeting_types` row (O-7 — still **no**
  `meeting_type` column). `HC0J1` authority. Audited `case.restricted_meeting_created`.
- **D8 amended:** `schedule_ethics_hearing` creates/attaches its `meetings` row **via**
  `create_case_restricted_meeting`, so `ethics_hearings.meeting_id` always points at a meeting whose
  `restricted_to_case_id` = the hearing's case. The ordinary `create_meeting` path is untouched (creates
  unrestricted meetings only).
- **Single-case invariant:** a restricted meeting links **only** its authorizing case — `link_meeting_case`
  rejects (`HC0J0`) a `meeting_cases` insert whose `case_id ≠ restricted_to_case_id`. (Multi-case restricted
  meetings are out of scope — Open decision **O-9**.)

**`ethics_hearings` is unchanged.** Its presence flags (`respondent_present`, `complainant_present`,
`legal_representative_present`), `hearing_type`, and `outcome_md` stay exactly as D8 defines them; D14 adds
**no** `meeting_attendees` column — attendance semantics remain on `ethics_hearings`, and the isolation
guarantee rides `restricted_to_case_id` alone. `case_votes.meeting_id` may still point at the hearing's (now
restricted) meeting.

> **★ X-η re-opens (flag for the lead).** O-7 had resolved E2 to touch **no** meetings DDL (reuse the
> `commission_meeting_types` catalog), which shrank the CH↔E2 collision to seed-only. D14 **adds
> `meetings.restricted_to_case_id`** — a genuine meetings-surface DDL edit — so the **original X-η
> serialization is back on**: E2's `restricted_to_case_id` migration + the meeting-child policy rewrite must
> **serialize against CH** (which reads `meetings.held_at` and edits the meetings-module files). There is no
> *semantic* conflict (different columns; CH's cadence is unaffected by restriction), but the file-edit
> serialization the plan §5 mandates now applies. Re-ratify at the lead sign-off.

**Zero new tables.** D14 is one column + one predicate + one RPC + a meeting-child policy rewrite. The data
model's table set is unchanged.

---

## The E2 lifecycle (how the tables compose)

```
denúncia recebida
  → ethics_case_details (admissibility_status='pending', complaint_received_at)
  → decide_admissibility → 'admissible'                         [ethics.admissibility_decided]
  → issue_ethics_notification('respondent_notification', due_at = prazo de defesa)
       → N scan arm reminds the coordinator as due_at approaches (X-ζ)   [ethics.notification_issued]
  → respondent files a defense           → responses(target_case_participant_id = respondent)
       (via the D13 targeted door — submits WITHOUT case read; 0072 hard-deny intact)  [case.targeted_response_submitted]
  → add_ethics_allegation × N            (each: category, description, severity)   [ethics.allegation_added]
  → schedule_ethics_hearing → rides a CASE-RESTRICTED meetings row (D14: restricted_to_case_id;
       type='Audiência' via the catalog) — recused/non-granted members cannot read it  [ethics.hearing_scheduled]
  → record_ethics_finding per allegation (substantiated / not / partial)     [ethics.finding_recorded]
  → create case_decisions (draft) → cast_case_vote × eligible members
       (recused/respondent REFUSED at the door — HC0J5, consumes E1)         [case.vote_cast]
  → issue_decision → status='issued'
       → ethics_decision_details (sanction, appeal_deadline, external_reporting_target)
       → trg_pin_respondent_retention fires → professional_profiles.retention_pinned_at  [.retention_pinned]
       → sanctions/remediation → action_items via the hub (X-ε, §D6)
       → CRM/CFM report → case_referral via ADR-0037 (§D7) OR external_reporting_notice
       → issue_ethics_notification('decision_notice')                        [case.decision_issued]
  → (optional) ethics_appeals → appeal_notice → review → outcome             [case.appeal_submitted]
  → close_case   (blocked while a response_expected referral is in flight — ADR 0037 HC076)
```

Every read on this trajectory is **`can_read_case`-gated (E1)** — the respondent never sees their own
case, a recused member loses read the moment `record_recusal` runs, a non-granted member of an
`explicit_grants_only` ethics case sees nothing, and the decision letter is invisible per the case's
`confidentiality_level`. Every mutation emits **one** PHI-free audit row. A **foreign-commission** user reads
**nothing** (the tenant boundary + `can_read_case`). *(Amended 2026-07-18: the original "a `legal_privileged`
decision letter is invisible below clearance" is deferred to Stage E — 0078 A19/B3 fenced that label + reserved
the clearance ceiling post-pilot; pre-pilot the decision letter rides the ordinary case-confidentiality gate.)*

---

## Consequences

- **The disciplinary lifecycle is structured & defensible.** Allegations, per-allegation findings,
  formal votes, the CRM/CFM-aware decision, notices-with-deadlines, hearings, and appeals are addressable
  rows — queryable by dashboards (E3a), remindable by N (X-ζ), and auditable as a CFM-1821/2007 record.
- **Recusal is enforced at the ballot, not offered as one.** `case_votes` has no `'recused'` value;
  `cast_case_vote` refuses a recused/respondent voter (HC0J5) on top of E1 already denying their case
  read — the m2 exclusion extends cleanly into deliberation.
- **The M2 loop closes.** The retention-pin trigger + `redact_professional_profile` implement exactly the
  ADR-0072 §7 recommendation (minimise-not-destroy, pin-on-decision, no deletion) — the erasure shape E1
  deferred, built where the triggering decision exists. Rule 12's Class-2 erasure clause is finalized.
- **One hub, one engine, one referral channel — no forks.** Sanctions ride the `action_items` hub (X-ε);
  notice deadlines ride N (X-ζ); CRM/CFM reporting rides ADR-0037 referrals (§D7); hearings ride
  `meetings` (X-η). E2 adds ethics-*specific* tables + two columns + one catalog, and **consumes**
  everything else — the ADR-0064 "never a forked model" principle held end-to-end.
- **The respondent can defend without reading the case (D13).** `can_access_targeted_response` is a door
  that authorizes **only** the targeted response + its answers + the form definition — it never calls
  `can_read_case` and never weakens the 0072 respondent hard-deny. This closes the functional hole where a
  hard-denied respondent had no in-app path to submit a defense. Zero new tables.
- **Hearings are confidential to the panel (D14).** `meetings.restricted_to_case_id` + `can_read_meeting`
  make a hearing meeting **and all its children** (agenda, attendees, minutes, signatures, attachments)
  inherit `can_read_case`, so a recused or non-granted member reads **nothing** of the hearing — closing the
  leak where hearing minutes were reachable via ordinary meeting membership. Ordinary meetings are
  byte-for-byte unchanged. Zero new tables.
- **Case-read RLS shape unchanged; two narrow additive predicates.** Every E2 table stays
  `can_read_case`-gated SELECT + DEFINER-RPC write — the E1 pattern, verbatim. The RLS novelties beyond that
  are all narrow and conformance-checkable: the **denormalized `case_id`** on `ethics_findings`; the
  **retention-pin trigger** (a mutation trigger); and two **additive access predicates** —
  `can_access_targeted_response` (D13, a door that **never touches** `can_read_case`) and `can_read_meeting`
  (D14, which **delegates to** `can_read_case` for restricted meetings and is a no-op for ordinary ones).
  **Neither adds an administrator/membership `OR`-arm to `can_read_case` itself.** QA's RLS review remains a
  conformance check, not a re-litigation.
- **Flag-OFF byte-for-byte.** `ethics` OFF ⇒ empty dark tables, feature-unavailable RPCs, a zero-row scan
  arm, an unchanged meetings surface. A pgTAP keystone.
- **Strict serialization.** E2 needs **E1** (recusal + confidentiality + participant-write), **N**
  (notice-deadline engine), **AI** hub (sanctions/remediation). **E1 → E2 → E3** is strictly sequential;
  the **meetings-file edits are serialized with CH** (X-η).

---

## Open decisions (flagged for lead / PO)

- **O-1 — table naming.** Drop the design's `_case_` infix (`ethics_allegations`/`ethics_findings`/
  `ethics_notifications`) vs keep it (`ethics_case_allegations`/…). **Recommend drop** (the tables are
  already `case_id`-keyed; brevity). Freeze at the build-plan contract.
- **O-2 — `allegation_category` + `sanction_type` + `decision_type` catalog-vs-enum.** **Recommend
  catalog** (dialect-2, ADR 0065) — committees add categories/sanctions without a migration, and the CEM
  sanction vocabulary is Brazil-specific + versioned by CFM resolution. Confirm.
- **★ O-3 — vote quorum gate.** Enforce a quorum of eligible-member votes before `issue_decision`
  (reusing `commission_meeting_settings` quorum, X-η) — **HC0J8** — or leave vote-tallying advisory and
  let the coordinator issue on judgment. **Security/correctness-adjacent** (a decision issued without
  quorum is a defensibility hole). Recommend **enforce**; confirm the quorum source.
- **★ O-4 — CRM/CFM on-platform vs off-platform (D7).** Confirm whether the pilot's CRM/CFM/legal targets
  are modeled as on-platform tenants (→ the ADR-0037 referral hand-off path) or off-platform (→ the
  notice + decision-letter-attachment record). **A seeding/config call**, not a schema fork — but it
  determines whether the referral wiring is exercised pre-pilot. Recommend: model the internal legal
  department as on-platform (referral path); CRM/CFM as off-platform notice path for the pilot.
- **★ O-5 — assignment-role placement (D10).** Nullable `case_phases.assignment_role_id` FK vs a separate
  phase-assignment-role table. **Recommend the nullable FK** (minimal, matches the single-assignee
  `case_phases.assigned_to`). Confirm; a mild schema-shape call.
- **★ O-7 — X-η `meeting_type`: column vs existing catalog (D8).** S0 X-η pre-committed E2 to *"add a
  `meeting_type` column"* to Meetings, but the module **already** has the per-commission
  `commission_meeting_types` catalog (`meetings.meeting_type_id`). Adding a column duplicates it.
  **Recommend seed an "Audiência" catalog row + add NO column** (option a) — which also **shrinks the
  X-η CH↔E2 collision to seed-only** (E2 stops touching the meetings DDL). Re-ratify X-η at S0 with the
  catalog in view. **Downstream cost:** if the lead insists on a literal column, that is a genuine
  meetings-surface DDL edit that must serialize with CH per the original X-η.
- **O-6 (settled here, listed for visibility) — M2 redaction mechanics.** §D9 — retention-pin on
  issued-decision + `redact_professional_profile` (null identity, preserve row, barred while pinned).
  **Implements the ADR-0072 §7 recommendation that requires human sign-off at S0.** If the PO wants a
  different retention trigger or an active pre-decision erasure path, flag before BE build.
- **O-8 — targeted-response creation authority (D13).** The **coordinator** creates the empty `in_progress`
  targeted response, then `target_case_response` binds the respondent (**recommend** — keeps case-row
  creation off the respondent, who is hard-denied). Alternative: a single `create_targeted_case_response`
  that creates+targets in one call. Recommend the two-step (reuses ordinary phase-response creation).
  Confirm at the build-plan contract.
- **★ O-9 — multi-case restricted meetings (D14).** A restricted hearing links **only** its one authorizing
  case (single-case invariant, `HC0J0`). A joint hearing over two related cases is out of scope; if a real
  need appears it requires a multi-case restricted-meeting access rule (a `meeting_cases`-set predicate).
  **Recommend defer** (no pilot need). Confirm.
