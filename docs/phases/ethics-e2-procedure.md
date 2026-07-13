# Build Plan — Ethics E2 · Procedure (admissibility → decision → appeal)

**Status:** 📝 Design (S0 gate — DESIGN ONLY, no code) · **Date:** 2026-07-13
· **Track:** ETH·E2 of the [Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md)
(ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)), stage **S4**.
· **ADR:** [0073](../decisions/0073-ethics-procedure-model.md) · **Owner:** `backend` (+ `frontend` for
the ethics procedure UI — E3a surfaces terminology/dashboards; E2 ships the backend + minimal FE per the
lead's call) · **Flag:** **E2 owns `ethics`** (create OFF, flip ON at gate; S0 §F.4). E1 already flipped
`case_participants` + `case_types`.
· **SQLSTATE:** `HC0F0–HC0F9` (S0 §B). · **Migration window:** `20260720000000+` (latest shipped
`20260719000800`; reset-OK, forward-only, additive).

This clears the §6 gate bar — **new tables** (the ethics procedure set), **new DEFINER write RPCs**, a
**mutation trigger** (the M2 retention-pin), and a **flag flip** — but introduces **no new case-read RLS
shape** (every table is `can_read_case`-gated SELECT + DEFINER-RPC write, the E1 pattern verbatim). It
runs the full gate: contract-first plan → build → tester → qa → human → record. Per the S0 right-sizing:
the **first schema migration** (new tables + the retention-pin trigger + the `case_votes` recusal gate)
needs **full lead plan-approval** (novel trigger + the vote-exclusion that consumes E1 + the M2 redaction
path); the **additive follow-ons that mirror an approved pattern** (a further table in the same shape, the
`ethics` flag flip, the N scan-arm addition) need only a **one-line plan + ack**.

Reading order for the implementer: **ADR 0073** (the model — binding), then **ADR 0072** (E1 — the access
spine E2 rides), then this plan's §2 contract, then the source anchors in §0. All of `cases` /
`case_participants` / `can_read_case` / `meetings` / `responses` / `action_items` / `case_referral` /
`professional_profiles` already exist (baseline + F1 + F2) — E2 *extends* them.

---

## 0. Source anchors (what already exists — E2 extends/consumes, never re-creates)

| Surface | Where (source of truth) | E2 action |
|---|---|---|
| `public.cases` (root; `case_type_id`, `commission_id`, `organization_id`, `confidentiality_level`/`visibility_policy` from E1) | baseline; E1 migration | **parent** of every E2 table (`case_id` FK) |
| `app.can_read_case(p_case_id, p_uid)` (live, w/ E1 deny-terms) | `20260710000000_nsp_per_hospital.sql` L569 | **SELECT gate** for every E2 table (no change to the predicate) |
| `app.is_recused_from_case` / `app.is_case_respondent` (**new in E1**) | E1 migration (ADR 0072 §2.2) | **consumed** by `cast_case_vote` (HC0F5 vote-exclusion — §D4) |
| `app.commission_of_case(p_case_id)` | baseline L1629 | RPC authority + `audit_write` `p_commission` |
| `app.is_staff_admin_of_for(p_commission, p_uid)` | baseline L3318 | coordinator authority gate in every write RPC |
| `public.responses` (case-phase form responses; `case_phase_id`, `commission_id`, `status`, `submitted_at`) | baseline L4063 | **add** `target_case_participant_id` FK (§D10) |
| `public.case_phases` (`assigned_to`, `status`, `form_version_id`) | baseline L5559 | **add** nullable `assignment_role_id` FK → `case_assignment_roles` (§D10) |
| `public.meetings` (`meeting_type_id` FK, `held_at`, `status` pt-BR, `quorum_*`) | baseline L7746 (+ `held_at` `20260715000100` L23) | `ethics_hearings.meeting_id` points here; **X-η/O-7:** reuse `commission_meeting_types` catalog, NO new column (§D8) |
| `public.commission_meeting_types` (per-commission catalog: `name`, `color_token`, `position`) + `app.seed_default_meeting_types` | baseline L7194 / L3996 | **seed** an "Audiência" row (O-7 option a) instead of a `meeting_type` column |
| `public.commission_meeting_settings` (quorum: `quorum_rule_type`, `quorum_value`) | baseline L17095 | **read** for the optional vote-quorum gate (O-3), NOT restated |
| `public.action_items` + `create_committee_action_item` (hub; `source_type='case'` → `case_restricted`) | `20260706000000` / `20260707000000` (ADR 0050) | **consume** for sanctions/remediation (X-ε, §D6) — no hub change |
| `public.case_referral` + `create_referral_draft(p_source_case_id, p_target_commission_id, p_referral_type_id, p_subject, p_response_expected, p_description_md)` | baseline L851 / L9616 | **consume** for the CRM/CFM hand-off (§D7) — no referral change |
| `public.professional_profiles` (Class-2; `user_id?`, `full_name`, `license_number`, …) + E1 writers | `20260716000000_participants_registry.sql` L236; E1 writers | **add** `retention_pinned_at`/`_reason`/`redacted_at`/`_by` + the pin trigger + `redact_professional_profile` (§D9) |
| `app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata, p_organization)` | baseline L1015 | **emit** the new mutation verbs (§D11) |
| `log_audit_access` allow-list + `_audit_access_authorized` dispatch | `20260711000100_grant_hardening.sql` L217 / L111 | **unchanged** — E2 reads are ordinary `can_read_case` reads; **no** new allow-list verb expected (confirm at build) |
| `compute_due_notifications()` (**N — lands in S1, before E2**) | N migration (Phase 20) | **add** the ethics-notice `union all` scan arm (§D5, X-ζ) |
| `FeatureFlags` interface (19 keys; no `ethics`) | `src/lib/queries/feature-flags.ts` L20 | **add** `ethics: boolean` at the flag-flip step |
| SQLSTATE + REVOKE/GRANT precedent | `20260701000000_ad_hoc_narratives.sql` L7 (`raise … using errcode='HC020'`); `20260711000100` L212 (`revoke all … from public; grant execute … to authenticated, service_role;`) | mirror the pattern on every new RPC (t19) |

> **graphify-first:** the implementer runs `graphify query`/`explain` before reading any of the above raw
> files (project rule; the graph is at `graphify-out/`).

---

## 1. Dependencies & serialization (S0 §E, plan §1/§5)

- **Hard deps (must be gated before E2 starts):**
  - **ETH·E1** (S3) — respondent-exclusion + recusal (`is_recused_from_case`/`is_case_respondent`) +
    confidentiality + participant-write RPCs. **E1 → E2 strictly sequential** (E2 consumes E1's tables +
    predicates). E1 regens `database.ts` before E2 starts.
  - **N** (S1) — the `compute_due_notifications()` engine E2 registers its notice-deadline scan arm on
    (X-ζ). N ships the engine + own-row `notifications`; E2 adds the arm additively.
  - **AI hub** (S2) — `action_items` + `create_committee_action_item` for sanctions/remediation (X-ε).
- **Soft dep:** none beyond the above (Meetings/referrals/professional-profiles are shipped).
- **Strict sequence:** **E1 → E2 → E3** (E3a surfaces E2's tables). E2 posts the §2 typed contract
  **first** so any FE built on it (E2's own minimal UI + E3a) has real types.
- **Serialization — the meetings surface (X-η).** If O-7 resolves to **option (a)** (recommended — seed
  an "Audiência" catalog row, **no** `meetings` column), E2's meetings touch is **seed-only**, so the
  CH↔E2 meetings-file collision shrinks to the seed migration — still **serialize** the seed edit with any
  concurrent CH seed work, but E2 does **not** edit the meetings-table DDL. If O-7 resolves to option (b)
  (a literal column), E2 edits `meetings` DDL and **must not run concurrently with CH** (which reads
  `held_at`); MEM-style file serialization applies.
- **File ownership:** `backend` owns all E2 migrations + `src/lib/{queries,types,supabase}` + the new
  `src/lib/ethics/actions.ts` (+ `src/lib/case-decisions/actions.ts` / `src/lib/case-votes/actions.ts` if
  split). `frontend` owns any E2 UI (procedure panels), built against the §2 contract — disjoint files.

---

## 2. Canonical contract (BACKEND posts these typed stubs FIRST)

Per CLAUDE.md contract-first: `backend` commits the **signatures** below as typed stubs in
`src/lib/queries/**` + `src/lib/ethics/actions.ts` (bodies `throw new Error('not implemented')`) and
commits them early, before implementing.

### 2.1 Data model (migrations, additive — window `20260720…`)

```sql
-- ========== the ethics feature flag (E2 owns it; seed OFF) ==========
insert into app.feature_flags (key, enabled) values ('ethics', false) on conflict do nothing;

-- ========== admissibility / intake (ADR 0073 D1) ==========
create table public.ethics_case_details (
  case_id uuid primary key references public.cases(id) on delete cascade,
  admissibility_status text not null default 'pending'
    check (admissibility_status in ('pending','admissible','inadmissible')),
  admissibility_decided_at timestamptz,
  admissibility_decided_by uuid references public.profiles(id),
  admissibility_rationale_md text,
  complaint_channel text
    check (complaint_channel in ('internal','patient','external_body','anonymous','other')),
  complaint_received_at timestamptz,
  summary_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== allegations + findings (D2) ==========
create table public.ethics_allegation_categories (          -- catalog (dialect-2), org-scoped
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null, display_name text not null, is_active boolean not null default true,
  position int not null default 0,
  unique (organization_id, key)
);
create table public.ethics_allegations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  allegation_category_id uuid not null references public.ethics_allegation_categories(id),
  description_md text not null,
  alleged_event_date date,
  severity text check (severity in ('low','moderate','high','critical')),
  status text not null default 'under_review'
    check (status in ('under_review','substantiated','not_substantiated',
                      'partially_substantiated','dismissed','referred_elsewhere')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ethics_findings (
  id uuid primary key default gen_random_uuid(),
  allegation_id uuid not null references public.ethics_allegations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,   -- denormalized for base-table RLS
  finding text not null
    check (finding in ('substantiated','not_substantiated','partially_substantiated',
                       'inconclusive','dismissed')),
  rationale_md text, evidence_summary_md text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique (allegation_id),                                   -- one current finding per allegation
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ========== decisions (engine) + ethics extension + votes (D3/D4) ==========
create table public.case_decisions (                        -- ENGINE-LEVEL
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_type text not null,
  summary_md text not null, rationale_md text,
  status text not null default 'draft'
    check (status in ('draft','proposed','voted','issued','appealed','voided')),
  decided_at timestamptz, decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ethics_decision_details (               -- 1:1 ethics extension
  decision_id uuid primary key references public.case_decisions(id) on delete cascade,
  sanction_type text, sanction_start_date date, sanction_end_date date,
  remediation_required boolean not null default false, remediation_description_md text,
  external_reporting_required boolean not null default false,
  external_reporting_target text
    check (external_reporting_target in ('crm','cfm','legal_department','police','other')),
  external_reporting_referral_id uuid references public.case_referral(id),   -- ADR-0037 hand-off (§D7)
  external_reporting_deadline timestamptz, external_reporting_completed_at timestamptz,
  appeal_allowed boolean not null default true, appeal_deadline timestamptz,
  decision_letter_document_id uuid references public.attachments(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.case_votes (                            -- ENGINE-LEVEL; ethics is primary consumer
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_id uuid not null references public.case_decisions(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  voter_id uuid not null references public.profiles(id) on delete restrict,
  vote text not null check (vote in ('approve','reject','abstain')),   -- NO 'recused' — §D4
  rationale_md text,
  voted_at timestamptz not null default now(),
  unique (decision_id, voter_id),
  created_at timestamptz not null default now()
);

-- ========== notifications with deadlines (D5) ==========
create table public.ethics_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  recipient_participant_id uuid references public.case_participants(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in
    ('complaint_acknowledgement','respondent_notification','request_for_response',
     'hearing_notice','decision_notice','appeal_notice','external_reporting_notice','other')),
  delivery_method text not null
    check (delivery_method in ('email','letter','in_person','system','phone','other')),
  status text not null default 'pending'
    check (status in ('pending','sent','acknowledged','failed','cancelled')),
  sent_at timestamptz, acknowledged_at timestamptz,
  due_at timestamptz,                                        -- the prazo — feeds the N scan arm
  related_document_id uuid references public.attachments(id),
  notes_md text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ========== hearings (D8) ==========
create table public.ethics_hearings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  hearing_type text not null check (hearing_type in
    ('initial_hearing','evidence_hearing','deliberation_hearing','appeal_hearing','other')),
  scheduled_at timestamptz, completed_at timestamptz,
  respondent_present boolean, complainant_present boolean, legal_representative_present boolean,
  summary_md text, outcome_md text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ========== appeals (D-appeals) ==========
create table public.ethics_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_id uuid not null references public.case_decisions(id) on delete cascade,
  submitted_by_participant_id uuid references public.case_participants(id) on delete set null,
  submitted_at timestamptz not null default now(),
  appeal_reason_md text not null,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','accepted','rejected','withdrawn','closed')),
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  outcome text, outcome_rationale_md text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ========== assignment-role vocabulary (D10) ==========
create table public.case_assignment_roles (                 -- catalog, org-scoped
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null, display_name text not null, is_active boolean not null default true,
  unique (organization_id, key)
);
alter table public.case_phases  add column assignment_role_id uuid references public.case_assignment_roles(id);
alter table public.responses    add column target_case_participant_id uuid references public.case_participants(id);

-- ========== M2 retention-pin + redaction columns (D9) ==========
alter table public.professional_profiles
  add column retention_pinned_at timestamptz,
  add column retention_pin_reason text,
  add column redacted_at timestamptz,
  add column redacted_by uuid references public.profiles(id);
-- + trigger app.trg_pin_respondent_retention on case_decisions AFTER UPDATE (status→'issued')  [§D9]
```

**Indexes (perf — verify with `supabase-postgres-best-practices`):** every child gets
`(case_id)`; `ethics_findings(allegation_id)` (the unique already covers it); `case_votes(decision_id)`;
`ethics_notifications(due_at) where due_at is not null and acknowledged_at is null` (partial — the N scan
arm's hot path); `professional_profiles(id) where retention_pinned_at is not null` (the pin lookup).

### 2.2 Predicates / helpers (`app` schema, DEFINER, R6-safe over base tables)

- `app.eligible_voters(p_case_id uuid) returns setof uuid` **(new)** — commission members minus recused
  (`is_recused_from_case`) minus respondent (`is_case_respondent`), computed over base tables (R6). Used
  by the read projection + the optional quorum gate — **not** an RLS term.
- `app.commission_staff_admin_of_case(p_case_id uuid) returns uuid` **(new, if not already present)** — a
  DEFINER helper returning *a* `staff_admin` of the case's commission, for the N scan arm's coordinator
  fallback recipient. (If a suitable helper exists, reuse it.)
- **No change** to `can_read_case` / `can_read_case_patient` / `can_write_case_content` — E2 adds no
  case-read term (E1 owns them). E2's `cast_case_vote` **consumes** `is_recused_from_case` /
  `is_case_respondent` inside the RPC body (not RLS).

### 2.3 RPCs (all: `assert ethics flag` · `REVOKE ALL FROM PUBLIC` → `GRANT authenticated, service_role` · pt-BR errors · `HC0F·`)

**Admissibility / intake (D1):**
- `public.upsert_ethics_case_details(p_case_id uuid, p_complaint_channel text default null, p_complaint_received_at timestamptz default null, p_summary_md text default null) returns public.ethics_case_details`
- `public.decide_admissibility(p_case_id uuid, p_status text, p_rationale_md text) returns void` (coordinator; `HC0F0` bad status)

**Allegations / findings (D2):**
- `public.add_ethics_allegation(p_case_id uuid, p_category_id uuid, p_description_md text, p_severity text default null, p_alleged_event_date date default null) returns uuid` (`HC0F2` bad category)
- `public.update_ethics_allegation(p_allegation_id uuid, …fields…, p_status text default null) returns void`
- `public.record_ethics_finding(p_allegation_id uuid, p_finding text, p_rationale_md text default null, p_evidence_summary_md text default null) returns uuid` (`HC0F3` finding-exists)
- allegation-category catalog CRUD: `public.create_ethics_allegation_category(...)` / `archive_ethics_allegation_category(...)` (org/staff_admin)

**Decision / votes (D3/D4):**
- `public.create_case_decision(p_case_id uuid, p_decision_type text, p_summary_md text, p_rationale_md text default null) returns uuid` (coordinator; case admissible — `HC0F0`)
- `public.set_ethics_decision_details(p_decision_id uuid, …sanction/remediation/external_reporting/appeal fields…) returns void`
- `public.cast_case_vote(p_decision_id uuid, p_vote text, p_rationale_md text default null) returns uuid`
  — **hard-checks `is_recused_from_case` / `is_case_respondent` → `HC0F5`**; `unique(decision_id,voter_id)` → `HC0F4`; caller must be an eligible member of the case's commission.
- `public.issue_decision(p_decision_id uuid) returns void` — coordinator; `draft/voted → 'issued'`, stamps `decided_*`; **fires the retention-pin trigger** (§D9); (optional O-3) requires vote quorum → `HC0F8`.
- `public.void_decision(p_decision_id uuid, p_reason text) returns void`

**Notifications (D5):**
- `public.issue_ethics_notification(p_case_id uuid, p_notification_type text, p_delivery_method text, p_recipient_participant_id uuid default null, p_recipient_user_id uuid default null, p_due_at timestamptz default null, p_related_document_id uuid default null, p_notes_md text default null) returns uuid`
- `public.acknowledge_ethics_notification(p_notification_id uuid) returns void` (`HC0F6`)
- `public.cancel_ethics_notification(p_notification_id uuid) returns void` (`HC0F6`)

**Hearings (D8):**
- `public.schedule_ethics_hearing(p_case_id uuid, p_hearing_type text, p_meeting_id uuid default null, p_scheduled_at timestamptz default null) returns uuid`
- `public.complete_ethics_hearing(p_hearing_id uuid, p_summary_md text, p_outcome_md text, p_respondent_present boolean default null, p_complainant_present boolean default null, p_legal_representative_present boolean default null) returns void`

**Appeals (D-appeals):**
- `public.submit_ethics_appeal(p_case_id uuid, p_decision_id uuid, p_appeal_reason_md text, p_submitted_by_participant_id uuid default null) returns uuid` (decision `issued`/`appealed`; sets `case_decisions.status='appealed'`)
- `public.review_ethics_appeal(p_appeal_id uuid, p_status text, p_outcome text default null, p_outcome_rationale_md text default null) returns void` (coordinator)

**M2 redaction (D9) — the E1-deferred erasure path:**
- `public.redact_professional_profile(p_profile_id uuid, p_reason text) returns void` — coordinator/org-admin; **`HC0F7`** if `retention_pinned_at is not null` OR the profile is a respondent in any case with an `issued` decision; nulls identity fields, preserves row + linkages + audit; audited `professional_profile.redacted`.

**Assignment-role catalog (D10):** `public.create_case_assignment_role(...)` / `archive_case_assignment_role(...)`; `public.set_case_phase_assignment_role(p_phase_id uuid, p_role_id uuid) returns void`.

**Respondent-statement targeting (D10):** `public.set_response_target_participant(p_response_id uuid, p_case_participant_id uuid) returns void` (coordinator or the response's writer; both `can_write_case_content`).

**Modified reads (projection only — auth unchanged, all `can_read_case`-gated):**
- `public.get_case_detail(p_case)` — **extend** (do not fork) to surface the ethics procedure state when
  the case is ethics-typed: `ethics_case_details`, `allegations[]`+`findings`, `decisions[]`+details,
  `hearings[]`, `notifications[]` (with `due_at`), `appeals[]`, the eligible-voter count, and the caller's
  vote. **Must preserve** every existing `get_case_detail` field + the submitted-only answer rule (ADR
  0033) + E1's added fields (confidentiality/visibility/participants/recusal). *(If `get_case_detail` is
  already large, a companion `get_ethics_case_procedure(p_case)` DEFINER read is acceptable — a
  build-plan call; either way `can_read_case`-gated.)*

### 2.4 RLS

Every E2 child table: `enable row level security`; **one SELECT policy** `for select to authenticated
using (app.can_read_case(case_id, auth.uid()))` — **verbatim reuse of E1's predicate, no new shape**; and
**no** authenticated INSERT/UPDATE/DELETE policy (all writes via the DEFINER RPCs above — the
meetings/interviews/case-access door pattern). Grant SELECT to `authenticated` (F1 MAJOR-1 lesson: RLS
narrows an existing grant). Specifics:

- `ethics_case_details`, `ethics_allegations`, `case_decisions`, `ethics_decision_details` (via the
  parent decision's `case_id` — either denormalize `case_id` onto `ethics_decision_details` **or** gate
  through a `can_read_case((select case_id from case_decisions where id = decision_id), …)` subquery;
  **recommend denormalize `case_id`** for a base-table predicate, matching `ethics_findings`), `case_votes`,
  `ethics_notifications`, `ethics_hearings`, `ethics_appeals` — all SELECT `can_read_case(case_id, …)`.
- `ethics_findings` — SELECT `can_read_case(case_id, …)` (the **denormalized** `case_id`, not a join).
- Catalogs (`ethics_allegation_categories`, `case_assignment_roles`) — SELECT to `authenticated`
  org-scoped (mirror `case_participant_roles` / `referral_types` catalog RLS); write via DEFINER CRUD.
- `professional_profiles` new columns — **no RLS change** (E1 owns its read `can_read_professional_profile`
  + audited door); the pin columns ride the existing row.

### 2.5 TS layer (`backend`-owned)

- `src/lib/types/database.ts` — **regenerate after every migration** (Rule 8).
- `src/lib/queries/feature-flags.ts` — **add `ethics: boolean`** to the `FeatureFlags` interface at the
  flag-flip step (S0 §C).
- `src/lib/queries/cases.ts` — `getCaseDetail` (or a new `getEthicsCaseProcedure`) return type gains the
  ethics procedure shapes; new types `EthicsCaseDetails`, `EthicsAllegation`, `EthicsFinding`,
  `CaseDecision`, `EthicsDecisionDetails`, `CaseVote`, `EthicsNotification`, `EthicsHearing`,
  `EthicsAppeal`, `AllegationCategory`, `CaseAssignmentRole`, and the enum unions
  (`AdmissibilityStatus`, `AllegationStatus`, `FindingValue`, `DecisionStatus`, `VoteValue`,
  `SanctionType`, `NotificationType`, `HearingType`, `AppealStatus`, `ExternalReportingTarget`).
- `src/lib/ethics/actions.ts` **(new)** — server actions wrapping every §2.3 RPC
  (`decideAdmissibility`, `addEthicsAllegation`, `recordEthicsFinding`, `createCaseDecision`,
  `setEthicsDecisionDetails`, `castCaseVote`, `issueDecision`, `issueEthicsNotification`,
  `acknowledgeEthicsNotification`, `scheduleEthicsHearing`, `completeEthicsHearing`, `submitEthicsAppeal`,
  `reviewEthicsAppeal`, `redactProfessionalProfile`, `setResponseTargetParticipant`, …). pt-BR error
  mapping from `HC0F·` (Rule 8/10; raw Postgres never reaches the UI).

---

## 3. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
|---|------|---------|-------------|
| BE-1 | **Post the §2 contract** as typed stubs (queries + `ethics/actions.ts` + types) and commit, unblocking any FE (E2 UI / E3a). | E1, N, AI gated | one-line ack |
| BE-2 | Migration: create the `ethics` flag (OFF); `ethics_case_details`, `ethics_allegations`(+category catalog), `ethics_findings` — tables, CHECKs, `unique(allegation_id)`, denormalized `case_id`, RLS §2.4, grants. + `HC0F0`/`HC0F2`/`HC0F3`. | BE-1 | **full** (new tables + RLS shape confirm) |
| BE-3 | Migration: `case_decisions` + `ethics_decision_details` + `case_votes` (tables, CHECKs, `unique(decision_id,voter_id)`, RLS §2.4). RPC `cast_case_vote` with the **recusal/respondent hard-check** (consumes E1) + `HC0F4`/`HC0F5`. | BE-2 | **full** (the vote-exclusion — the E1-consumption keystone) |
| BE-4 | Migration: `ethics_notifications` + `ethics_hearings` + `ethics_appeals` (tables, RLS). Hearing↔meeting: **O-7** — seed an "Audiência" `commission_meeting_types` row (option a) or the `meetings` column (option b, serialized with CH). + `HC0F6`. | BE-3 | **full** if O-7=column (meetings DDL); else **one-line ack** (additive tables mirroring BE-2/3) |
| BE-5 | **M2 retention-pin + redaction** (§D9): `professional_profiles` pin/redaction columns; `app.trg_pin_respondent_retention` on `case_decisions` (AFTER UPDATE → 'issued', base-table respondent traversal, idempotent); `redact_professional_profile` RPC with the pin guard `HC0F7`. Audit `professional_profile.retention_pinned`/`.redacted`. | BE-3 | **full** (novel trigger + the M2 erasure path — the ADR-0072 §7 sign-off item) |
| BE-6 | RPCs: admissibility, allegations/findings, decision/issue (+ optional O-3 quorum `HC0F8`), notifications, hearings, appeals, assignment-role, `set_response_target_participant`. `responses.target_case_participant_id` + `case_phases.assignment_role_id` + `case_assignment_roles` columns/catalog. t19 REVOKE→GRANT each. + `HC0F1`. | BE-2..5 | **full** (DEFINER write authority breadth) |
| BE-7 | **N scan arm** (§D5, X-ζ): add the ethics-notice `union all` branch (+ appeal-deadline + external-reporting-deadline date-equality branches) to `compute_due_notifications()`; name the `kind='ethics_notice_due'` + `entity_type='ethics_notification'` values in N's domains. Idempotent, additive. | BE-6, N live | **one-line ack** (additive arm onto an existing engine, X-ζ) |
| BE-8 | Modified read: `get_case_detail` (or `get_ethics_case_procedure`) — ethics procedure fields, submitted-only + every existing field + E1 fields preserved. Sanctions/remediation → `create_committee_action_item` (X-ε consumption); CRM/CFM → `create_referral_draft` wiring (§D7). Audit verbs on `audit_write`. | BE-6 | one-line ack (projection + hub/referral consumption + Rule-11 mirror) |
| BE-9 | **Flag flip** `ethics` → ON (one-line migration) + add `ethics` to the `FeatureFlags` interface; regen `database.ts`; pgTAP (§4) on a fresh reset; seed personas (an ethics case type from E1's seed + an admissible ethics case + allegations/findings + a recused member + an issued decision that pins a respondent-doctor profile + a due notice). | BE-8 | **one-line ack** (flag-flip mirrors the approved pattern) |

**Serialization within the phase:** BE-2→BE-6 serial (tables → decision/vote → notices/hearings/appeals →
retention-pin → RPCs); BE-5 can run after BE-3 (needs `case_decisions`). **BE-3 (vote-exclusion) and BE-5
(retention-pin) are the highest-risk tasks** — they consume E1 and add the M2 mechanics — and get the
fullest review + the most pgTAP. BE-7 (N arm) runs after N is live (S1, so already available).

---

## 4. Tester — acceptance criteria (E2E `chromium` + pgTAP; the E2 keystones)

**Lifecycle happy path (E2E, ethics-typed case, confidentiality-gated per E1):**
1. **Admissibility → notice:** a coordinator opens an ethics case, `decide_admissibility('admissible')`,
   then `issue_ethics_notification('respondent_notification', due_at = +15d)`. The notice persists with
   `due_at`; **the N scan arm** enqueues a reminder to the coordinator as `due_at` approaches (Mailpit-
   intercepted + in-app), **idempotent** (no dup for the same due date). pgTAP: the arm selects exactly
   the due `ethics_notifications` set; idempotency by `(user_id, kind, entity_id, created_at::date)`.
2. **Allegations/findings:** `add_ethics_allegation` × N (distinct categories); `record_ethics_finding`
   per allegation; a **second** finding on the same allegation → `HC0F3` (`unique(allegation_id)`).
3. **Hearing:** `schedule_ethics_hearing` rides a `meetings` row (type "Audiência" via the catalog, O-7a);
   `complete_ethics_hearing` records presence flags + outcome.
4. **Vote (the recusal keystone):** eligible members `cast_case_vote`. A **recused** member (E1
   `record_recusal`) calling `cast_case_vote` → **`HC0F5`** (and their case detail already `notFound()`
   via E1). The **respondent** (if somehow reachable) → `HC0F5`. A **second** vote by the same member →
   `HC0F4`. pgTAP: `is_recused_from_case` true ⇒ `cast_case_vote` raises; `eligible_voters` excludes
   recused + respondent.
5. **Decision → retention-pin:** `create_case_decision` + `set_ethics_decision_details`
   (sanction + `external_reporting_target='cfm'` + `appeal_deadline`); `issue_decision` → status `issued`.
   pgTAP: the `respondent_doctor`'s `professional_profiles.retention_pinned_at` **is now set** (the
   trigger fired); the pin is **idempotent** (issuing a second decision does not error / re-pin); audit
   emits `professional_profile.retention_pinned` (PHI-free).
6. **Redaction bar (M2):** `redact_professional_profile` on the **pinned** respondent → **`HC0F7`**
   (barred). `redact_professional_profile` on a **non-respondent, unpinned** profile → succeeds: identity
   nulled, **row + `case_participants` linkage + audit preserved** (pgTAP: the row still exists, `id`
   unchanged, `full_name` redacted, audit `professional_profile.redacted` present, **no** raw identity in
   the audit metadata).
7. **Sanctions ride the hub (X-ε):** a sanction/remediation task created by the decision flow is an
   `action_items` row (`source_type='case'`, `case_restricted`) — **not** a new ethics-task table; a
   non-case-reader cannot see it (rides `can_read_action_item`, unchanged).
8. **CRM/CFM hand-off (§D7):** where `external_reporting_target ∈ {crm,cfm,legal_department}` and the
   target is on-platform, a `case_referral` is opened (`create_referral_draft`) and
   `ethics_decision_details.external_reporting_referral_id` pins it; the referral rides ADR-0037's
   audited PHI door + close-gate (no bespoke path). Off-platform → an `external_reporting_notice` +
   decision-letter attachment (per O-4).
9. **Appeal:** `submit_ethics_appeal` sets `case_decisions.status='appealed'`; `review_ethics_appeal`
   records the outcome.
10. **Confidentiality-gated throughout (E1):** a `legal_privileged` decision letter is invisible to an
    ordinary case reader (E1 D5); a non-granted member of the `explicit_grants_only` ethics case sees the
    whole procedure as `notFound()`; a **foreign-commission** user reads **nothing** on any E2 table.
    pgTAP: each E2 table's SELECT denies a foreign-commission uid + a non-granted member + the respondent.
11. **Audit:** admissibility/allegation/finding/notification/hearing/vote/decision/appeal/pin/redaction
    each emit **one** `audit_log` row (PHI-free metadata — Rule 11). No payload/allegation-text/identity in
    any row.
12. **Flag-OFF byte-for-byte:** with `ethics` OFF (and no ethics case type seeded), every E2 RPC raises
    the feature-unavailable code; E2 tables are empty/dark; the N arm selects zero rows; the meetings
    surface is unchanged (O-7a: the "Audiência" seed exists but is inert). pgTAP flag-OFF keystone.
13. **Keyboard-only** path through one ethics flow (a coordinator recording admissibility → issuing a
    notice, or casting a vote) — §8 a11y.
14. **Full regression** suite green (`npm run e2e:prod`) to declare done (§6 gate).

**pgTAP file** (new, e.g. `supabase/tests/2xx_ethics_e2.sql`, on a **fresh reset** — memory
`pgtap-needs-fresh-reset-vs-e2e-leftovers`): every E2 table's `can_read_case` SELECT boundary
(NEG: foreign-commission / non-granted member / respondent; POS: granted member / coordinator); the
`case_votes` recusal+respondent exclusion (HC0F5) + `unique(decision_id,voter_id)` (HC0F4); the
`ethics_findings unique(allegation_id)` (HC0F3); the **retention-pin trigger** (fires on issue, idempotent,
respondent-scoped) + the **redaction bar** (HC0F7 on pinned, success-with-preservation on eligible); the
**N scan-arm** selection + idempotency; **t19 REVOKE guards on every new RPC**; the **flag-OFF fallback**;
and the audit-verb emission (one row, PHI-free). This file is the E2 gate.

---

## 5. QA scope

Requirements audit vs ADR 0073 + this plan; **RLS review confirming verbatim `can_read_case` reuse** on
every E2 table (no new shape, no per-table special-casing, denormalized `case_id` predicates are
base-table — R6, no `case_participants` RLS read); **the `case_votes` recusal/respondent exclusion**
(deny at the RPC door AND structurally via E1's `can_read_case`); **the M2 retention-pin + redaction**
(pin fires on issued decision, idempotent, respondent-scoped; redaction is minimise-not-destroy — row +
linkage + audit preserved, never a delete — and **barred** while pinned, matching the ADR-0072 §7
posture the human signed off); confirm sanctions ride the hub (X-ε, no new task table) and CRM/CFM rides
referrals (§D7, no bespoke path); confirm the N arm is additive + idempotent + PHI-free (X-ζ); confirm
the flag-OFF fallback is byte-for-byte; grant/RLS pairing on every table (F1 MAJOR-1 class); t19 REVOKE
on every RPC. Verdict → `docs/reviews/`.

---

## 6. Risks & ripples

- **`case_votes` recusal exclusion is the E1-consumption seam.** It leans on E1's `is_recused_from_case`
  / `is_case_respondent` existing and being correct. Mitigation: E1 → E2 strict sequence (E1 gated + its
  pgTAP green first); BE-3 gets the fullest review; the vote-exclusion is enforced **twice** (E1's
  `can_read_case` denies the recused member the whole case; the RPC re-checks at the door) so a single-
  point regression cannot open the ballot.
- **The retention-pin trigger touches Class-2 identity (Rule 12).** A trigger that writes
  `professional_profiles` on decision-issue must be **idempotent** (pin only where null) and **PHI-free in
  its audit** (records that + who, never the identity). Mitigation: base-table respondent traversal (R6),
  a partial-condition guard, pgTAP for the idempotency + the audit-metadata emptiness. **The redaction RPC
  is the platform's first professional-erasure path** — QA verifies it never deletes and is barred while
  pinned, exactly the human-signed-off ADR-0072 §7 posture.
- **`get_case_detail` regression surface.** It already carries E1's additions (confidentiality/visibility/
  participants/recusal) + the ADR-0033/0024/0032 fields + submitted-only. Extending it (or adding a
  companion read) must preserve **every** existing field. Mitigation: prefer a **companion**
  `get_ethics_case_procedure` read to limit the blast radius on the platform's most-consumed case read;
  full E2E re-run catches a regression.
- **X-η meetings serialization (O-7).** If O-7 resolves to a literal `meetings` column, E2 edits the
  meetings DDL and **must serialize with CH** (which reads `held_at`). **Recommended O-7a (seed-only)**
  eliminates this — E2 touches only a seed row, not the meetings table. Resolve O-7 at S0 sign-off so the
  build knows whether BE-4 is a full-review meetings-DDL edit or a one-line seed.
- **N arm ordering.** The scan arm (BE-7) needs `compute_due_notifications()` to exist. N is S1 (before
  E2's S4), so the engine is live when E2 lands the arm — but the arm is **inert code** until then
  regardless (E2's tables work with zero reminder delivery), matching the X-ζ contract.
- **Performance.** The N scan arm hits `ethics_notifications` every batch; the partial index
  `(due_at) where due_at is not null and acknowledged_at is null` keeps it cheap. `cast_case_vote`'s
  recusal/respondent checks are two `exists` over indexed `case_participants(case_id)` /
  `case_recusals(case_id,user_id) where lifted_at is null` (E1's indexes). Verify with the
  `supabase-postgres-best-practices` skill during BE-3/BE-7.
- **Catalog seeding.** `ethics_allegation_categories` + `case_assignment_roles` are org-scoped catalogs;
  the seed must populate them for the E2E org (CEM allegation categories; relator/revisor/presidente
  roles) so the happy-path specs have valid FK targets.

---

## 7. Sequencing & gate

Contract-first: **BE-1 first** (posts §2 types). Then BE-2→BE-9 as tabled (tables → decision/vote →
notices/hearings/appeals → retention-pin → RPCs → N arm → reads/consumption → **flag flip + seed**).
`backend` owns all migrations + `lib/{queries,types,supabase}` + `lib/ethics/actions.ts`; any E2 UI is
`frontend` off the frozen §2 contract (disjoint files). Tester spawned when the phase builds green locally
+ pgTAP passes on a fresh reset; QA after tester green. Then human approval (**the M2 redaction mechanics
ship exactly as the ADR-0072 §7 posture the human signed off at S0**), then §6 Record: PROGRESS → ✅,
`docs/backend-state.md` updated (new tables/RPCs/the retention-pin trigger + the N arm + the `ethics`
flag), ADR 0073 gains an **As-built** section (deltas/Q-rulings, esp. the O-1…O-7 resolutions), rotate
task detail, `graphify update .`, commit `phase(E2): complete — Ethics procedure model`.

**Strict order:** **E1 → E2 → E3** (E3a surfaces E2's tables). The **`ethics` flag flips ON only at BE-9**,
after the pgTAP gate (esp. the recusal-vote exclusion + the retention-pin + the flag-OFF fallback) is
green on a fresh reset. Until then the flag stays OFF and no environment renders the ethics procedure.
