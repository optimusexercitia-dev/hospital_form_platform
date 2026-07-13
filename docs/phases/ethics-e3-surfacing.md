# Build Plan — Ethics E3 · Terminology/UX surfacing (+ deferred accreditation link)

**Status:** 📝 Design (S0 gate — DESIGN ONLY, no code) · **Date:** 2026-07-13
· **Track:** ETH·E3 of the [Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md)
(ADR [0071](../decisions/0071-pre-pilot-release-scope-expansion.md)), stage **S5**.
· **ADR:** none — [ADR 0064](../decisions/0064-case-subject-generalization-participants.md) Decision 4
already covers the `case_type_terminology` model this track wires up; no new ADR is opened.
· **Owner:** `backend` (thin DB + seed) + `frontend` (terminology-aware components, dashboards) — this
document is `backend`'s S0 design deliverable; the frontend split is called out per task.
· **Flag:** reuses **`ethics`** (E2 owns it, S0 §F.4) + the already-flipped `case_participants` /
`case_types` (E1). E3 creates **no new flag**.
· **SQLSTATE:** none/minimal — reuse `HC0E·`/`HC0F·` codes if any RPC needs one; this track is mostly
FE + a `case_events` kind widen + seed. · **Migration window:** `20260720000000+` (latest shipped
`20260719000800`; reset-OK, forward-only, additive).

**Split (S0 §F.3, locked):** **E3a ships pre-pilot** (terminology wiring, seed, `case_events` kind
widen, ethics dashboards — no external dependency). **E3b is DEFERRED** to when Phase 16
(Standards Crosswalk) is re-planned and shipped (plan §7 risk #1 / §4 ETH·E3). This document specs
E3b as a **contract sketch only** — it is explicitly **not built** in this track.

Reading order for the implementer: **ADR 0064 Decision 4** (the terminology model — binding), then
this plan's §2 contract, then the source anchors in §0. `case_types` / `case_type_terminology` /
`case_participant_roles` already exist (F1); **E1's `can_read_case`** (respondent-exclusion, recusal,
confidentiality) and **E2's procedure tables** (`case_decisions`, `ethics_allegations`,
`ethics_findings`, `case_votes`, …) already exist and are flag-ON by the time E3 starts (E1 → E2 → E3
strict sequence). E3 extends/consumes, never re-creates.

---

## 0. Source anchors (what already exists — E3 extends, never re-creates)

| Surface | Where (source of truth) | E3 action |
|---|---|---|
| `public.case_types` (org-scoped config catalog; `key`, `display_name`, `primary_subject_kind`, `default_visibility_policy`, `default_case_label`) | `20260716000000_participants_registry.sql` L32 | **seed** the Ethics row; **read** (no schema change) |
| `public.case_type_terminology` (`case_type_id, term_key ∈ {case, primary_subject, timeline, document, decision}, singular_label, plural_label, help_text`) | same file, L77 | **seed** the Ethics bundle (5 `term_key` rows); **build the first-ever TS reader** (zero consumers exist today — verified, §1) |
| `public.case_participant_roles` (case-type-scoped role vocabulary; `allowed_participant_types[]`, `is_primary_subject_candidate`) | same file, L177 (schema) / seed pattern at `supabase/seed.sql` L717 | **seed** the Ethics role bundle (`respondent_doctor`, `complainant`, `affected_patient`, `witness`, …) |
| `public.case_events` (`kind` CHECK ∈ `{note, meeting, decision, interview, safety_event, other}`; **no visibility column**; `body` is **PHI-bearing free text** per its own column comment) | `20260620000000_baseline.sql` L18012 | **widen** the `kind` CHECK with procedural categories; **add** a per-event visibility column |
| `CaseEventKind` TS union (`'note' \| 'meeting' \| 'decision' \| 'other'` — **narrower than the DB CHECK today**, missing `interview`/`safety_event`) + `EVENT_KIND_LABEL` | `src/components/cases/case-extras-labels.ts` L22 (type at L77 in `case-documents.ts`) | **widen in lockstep** with the DB CHECK (close the pre-existing TS/DB drift **and** add the new kinds in the same edit) |
| `CaseEventsTimeline` (client component; add/edit/delete via `CaseEventForm`; `canWrite` prop) | `src/components/cases/case-events-timeline.tsx` | **frontend**: render the visibility affordance/badge per event |
| **`public.cases` has NO `case_type_id` column** (verified — grep of generated types finds `case_type_id` only on `case_participant_roles` and `case_type_terminology`, never on `cases` itself, despite the `case_types` table comment's aspirational "a case snapshots case_type_id") | `src/lib/types/database.ts` (cases Row block, L2611) | **⚠ Open decision O-1 — see §"Open decisions"; this is the load-bearing gap E3a's entire terminology-selection premise depends on.** |
| `Case` / `CaseDetail` / `CaseBoardRow` TS interfaces — **zero `caseType`/`caseTypeId` field today** | `src/lib/queries/cases.ts` L56/298/253 | **add** `caseTypeId` (once O-1 resolves) + a resolved `terminology` shape |
| `app.can_read_case` (E1, with respondent/recusal/confidentiality/explicit-grants-only terms) | E1 migration (ADR 0072) | **consumed verbatim** by every E3a dashboard aggregate — **no new predicate** |
| `case_decisions` / `ethics_decision_details` / `case_votes` / `ethics_allegations` / `ethics_findings` / `ethics_case_details` (E2) | E2 migration (ADR 0073) | **read-only aggregation source** for the ethics dashboard (counts, cycle-time, sanction outcomes) |
| `dashboard.ts` (`isDashboardCountable`, `getCommissionOverview`, `getFormDashboard`) — the platform's existing dashboard-query idiom (RLS-scoped reads, no service-role fan-out) | `src/lib/queries/dashboard.ts` | **pattern to mirror** for the new `getEthicsDashboard` read — same idiom, new source tables |
| `commission_meeting_types` catalog (X-η, referenced by E2 for hearings) | `20260716000000...` baseline L7194 / L3996 | **not E3's concern** (E2 seeds "Audiência"); noted for completeness only |
| Phase 16 (Standards Crosswalk) — **deferred, needs replanning** | plan §7 risk #1 | **E3b's hard blocker** — sketch only, §5 below |

> **graphify-first:** the implementer runs `graphify query`/`explain` before reading any of the above
> raw files (project rule; the graph is at `graphify-out/`).

---

## 1. Dependencies & serialization (S0 §E, plan §1/§5)

- **Hard deps (must be gated before E3a starts):** **ETH·E1** (S3 — `can_read_case` respondent/recusal/
  confidentiality terms the dashboard must respect) and **ETH·E2** (S4 — the procedure tables the
  dashboard aggregates: `case_decisions`, `ethics_allegations`, `ethics_findings`, `case_votes`,
  `ethics_hearings`). **E1 → E2 → E3 strictly sequential** (plan §5, S0 §E X-α/§D). E3 posts no new
  case-read predicate of its own — it is a pure consumer.
- **E3a has NO external dependency** beyond E1+E2 (already satisfied by the time E3 starts in-sequence).
  **E3b hard-depends on Phase 16** (Standards Crosswalk — currently deferred, needs replanning; plan §7
  risk #1). E3b is **not scheduled** in this track; it is a contract sketch only (§5).
- **File ownership:** `backend` owns the E3a migration (case_types/terminology/roles seed + the
  `case_events` kind-widen + visibility column + RLS/grant touch) + `src/lib/queries/case-types.ts`
  (new) + `src/lib/queries/case-documents.ts` (CaseEvent type widen) + `src/lib/queries/dashboard.ts`
  extension (or a new `src/lib/queries/ethics-dashboard.ts`) + regenerated types. `frontend` owns every
  terminology-aware UI component + the dashboard page/charts, built against the frozen §2 contract —
  disjoint files, same discipline as E1/E2's backend/frontend split.
- **Verified gap carried forward from source-anchor research (§0):** `cases` has no `case_type_id`
  column despite `case_types`' own migration comment describing the intended snapshot. Neither E1's nor
  E2's contract (ADR 0072 §2.1 / ADR 0073 §2.1) adds it either — both migrate `cases` (visibility_policy
  + confidentiality_level) and `case_decisions`/etc. without touching `case_type_id`. **E3a cannot wire
  terminology without this column existing somewhere in the chain before E3a's read-plumbing lands.**
  This is **Open decision O-1** (§"Open decisions") — flagged for a lead call on which track adds it.

---

## 2. E3a canonical contract (BACKEND posts these typed stubs FIRST)

Per CLAUDE.md contract-first: `backend` commits the **signatures** below as typed stubs in
`src/lib/queries/**` (bodies `throw new Error('not implemented')` where a body is needed) and commits
them early, before implementing, so `frontend` builds the terminology-aware components and the
dashboard page against real types.

### 2.1 Data model (migrations, additive — window `20260720…`)

```sql
-- ========== O-1 resolution — cases.case_type_id (see Open decisions; assumed here as (a)) ==========
-- (a) RECOMMENDED: backfill on cases directly, nullable (existing cases stay untyped/"processless"-
--     compatible; only case-type-aware flows, i.e. Ethics, set it going forward).
alter table public.cases
  add column case_type_id uuid references public.case_types(id) on delete set null;
-- create_case (baseline/ADR-0044 processless-cases RPC) gains an optional p_case_type_id param that,
-- when supplied, snapshots case_type_id AND cross-checks case_types.organization_id against the
-- case's resolved org (mirrors the existing template/org consistency guard). NULL stays legal — a
-- case created from a case_type-less template (the overwhelming majority pre-Ethics) is unaffected.

-- ========== case_events kind widen — procedural categories (E3a) ==========
alter table public.case_events drop constraint case_events_kind_check;
alter table public.case_events add constraint case_events_kind_check check (kind = any (array[
  'note', 'meeting', 'decision', 'interview', 'safety_event', 'other',              -- existing (unchanged)
  'admissibility_decided', 'allegation_added', 'finding_recorded', 'notification_issued',
  'hearing_scheduled', 'vote_cast', 'decision_issued', 'appeal_submitted'           -- NEW procedural kinds
]));
-- Existing values are UNCHANGED — additive CHECK widen only, no data migration, no default change.

-- ========== case_events per-event visibility (E3a) ==========
alter table public.case_events
  add column visibility text not null default 'case_readers'
    check (visibility in ('case_readers', 'coordinator_only'));
-- 'case_readers' (default) = today's behavior byte-for-byte (anyone can_read_case-gated sees it).
-- 'coordinator_only' = an ADDITIONAL narrowing on top of can_read_case (RLS AND-condition, §2.4) —
-- NEVER a widening. A procedural event auto-derived from an E2 write (e.g. finding_recorded) that
-- touches PHI-adjacent deliberation detail may be flagged coordinator_only by the writer; a plain
-- manual 'note'/'meeting' stays 'case_readers' as today. See §"Open decisions" O-3 for the exact
-- auto-derivation policy (which E2 events get logged as case_events at all, and at what visibility).
```

**Why additive-only, no new table.** `case_events` already has the shape (case_id, kind, body,
occurred_at/time, created_by) and the RLS pattern (`can_read_case` SELECT + writer/staff_admin write) a
procedural timeline needs. Widening `kind` + adding one visibility column reuses the existing timeline
UI (`CaseEventsTimeline`) instead of forking a parallel "ethics timeline" — the same anti-fork
discipline ADR 0064 D0 established for `cases` itself.

**`case_events.body` is PHI-bearing (verified — the column's own migration comment).** The visibility
column does **not** loosen this: `coordinator_only` narrows who among `can_read_case`-eligible readers
sees the row; it never grants access to someone `can_read_case` already excludes (a respondent or a
recused member is denied by RLS regardless of `visibility`). This keeps E1's deny-terms as the true
floor and `visibility` as an E3a-only *narrowing* refinement — never a parallel grant path (X-δ-style
"one boundary" discipline, applied to the timeline).

### 2.2 Seed (E3a — backend, `supabase/seed.sql`)

```sql
-- Ethics case_type (org A) — the first-ever case_types row in the system (verified: none seeded today).
insert into public.case_types
  (id, organization_id, key, display_name, primary_subject_kind, default_visibility_policy, default_case_label)
values
  (v_case_type_ethics, v_org_of_a, 'ethics_complaint', 'Processo Ético',
   'professional', 'explicit_grants_only', 'Denúncia');

-- case_type_terminology bundle (5 term_key rows; ADR 0064 Decision 4's exact example labels).
insert into public.case_type_terminology (case_type_id, term_key, singular_label, plural_label, help_text)
values
  (v_case_type_ethics, 'case',            'Denúncia',            'Denúncias',              null),
  (v_case_type_ethics, 'primary_subject', 'Médico denunciado',   'Médicos denunciados',    null),
  (v_case_type_ethics, 'timeline',        'Cronologia processual', null,                    null),
  (v_case_type_ethics, 'document',        'Documento',           'Documentos',             null),
  (v_case_type_ethics, 'decision',        'Decisão',             'Decisões',                null);

-- Role bundle (case_participant_roles, case_type_id = v_case_type_ethics — type-scoped, not org-wide):
--   respondent_doctor    (allowed_participant_types = {professional}, is_primary_subject_candidate = true)
--   complainant           ({external_person, professional})
--   affected_patient       ({patient})           -- reuses the E0 'patient' participant_type
--   witness                 ({external_person, professional})
--   investigator            ({professional})      -- committee-side
--   legal_representative     ({external_person})
--   external_regulatory_body  ({regulatory_body})  -- CRM/CFM, per E2 §D7
-- Mirrors the seed.sql L717 pattern (fixed test UUIDs, `on conflict (organization_id, key) where
-- case_type_id = <ethics type> do nothing` — the partial-unique already distinguishes type-scoped
-- from org-wide roles per the L208/L212 indexes).
```

**M&M is NOT seeded in E3a.** The plan's terminology example cites both Ethics (*Denúncia / Médico
denunciado / Cronologia processual*) and M&M (*Caso / Paciente / Linha do tempo*) to prove the
mechanism is type-driven, not ethics-specific — but M&M's own `case_type` row is **out of scope** here
(no M&M procedure track exists in this program). E3a's default-terminology fallback (§2.3) is what
makes every non-Ethics case render exactly today's hardcoded labels without a seeded row — this **is**
the M&M-equivalent behavior, achieved by absence rather than a seeded bundle.

### 2.3 TS layer (`backend`-owned) — the terminology read (first-ever consumer)

```ts
// src/lib/queries/case-types.ts (NEW FILE — no prior consumer of case_type_terminology exists,
// verified by a repo-wide grep: only src/lib/types/database.ts references the table name today).

export interface CaseTypeTerminology {
  caseTypeId: string
  /** Falls back to the platform default ('Caso') when no case_type_id or no override row exists. */
  case: { singular: string; plural: string | null; helpText: string | null }
  primarySubject: { singular: string; plural: string | null; helpText: string | null }
  timeline: { singular: string; plural: string | null; helpText: string | null }
  document: { singular: string; plural: string | null; helpText: string | null }
  decision: { singular: string; plural: string | null; helpText: string | null }
}

/**
 * Resolves a case type's terminology bundle, or the PLATFORM DEFAULT (today's hardcoded pt-BR
 * labels — 'Caso' / 'Paciente' / 'Linha do tempo' / 'Documento' / 'Decisão') when `caseTypeId` is
 * null or the type has no override rows. This default-fallback is what keeps every EXISTING case
 * (case_type_id null, the overwhelming majority) rendering BYTE-FOR-BYTE unchanged — the same
 * flag-OFF-fallback discipline E1/E2 apply to RLS, applied here to a UI-label resolver.
 */
export async function getCaseTypeTerminology(
  caseTypeId: string | null
): Promise<CaseTypeTerminology> { throw new Error('not implemented') }
```

```ts
// src/lib/queries/cases.ts — additive fields on existing interfaces (no removal, no rename).
export interface Case {
  // …existing fields unchanged…
  /** NEW (O-1): the case's type, or `null` for a type-less case (the pre-Ethics default). */
  caseTypeId: string | null
}
export interface CaseDetail {
  // …existing fields unchanged, including every E1/E2-added field…
  caseTypeId: string | null
  /** Resolved terminology bundle (falls back to platform defaults — see getCaseTypeTerminology). */
  terminology: CaseTypeTerminology
}
```

```ts
// src/lib/queries/case-documents.ts — CaseEventKind widened in lockstep with the DB CHECK (§2.1),
// closing the pre-existing TS/DB drift (interview/safety_event were DB-valid, TS-invisible) in the
// SAME edit that adds the new procedural kinds.
export type CaseEventKind =
  | 'note' | 'meeting' | 'decision' | 'interview' | 'safety_event' | 'other'   // existing, now complete
  | 'admissibility_decided' | 'allegation_added' | 'finding_recorded'
  | 'notification_issued' | 'hearing_scheduled' | 'vote_cast'
  | 'decision_issued' | 'appeal_submitted'                                     // NEW (E3a)

export type CaseEventVisibility = 'case_readers' | 'coordinator_only'

export interface CaseEvent {
  // …existing fields unchanged…
  /** NEW: default 'case_readers' (today's behavior). 'coordinator_only' NARROWS, never widens. */
  visibility: CaseEventVisibility
}
```

```ts
// src/lib/queries/dashboard.ts (extension) OR src/lib/queries/ethics-dashboard.ts (NEW — recommend
// new file: keeps dashboard.ts's existing form-response-centric shape untouched, mirrors how E2 chose
// a companion get_ethics_case_procedure over extending get_case_detail for the same blast-radius
// reason).

export interface EthicsDashboardSummary {
  commissionId: string
  /** Case counts by ethics_case_details.admissibility_status + case status — RLS-scoped, see below. */
  totalCases: number
  byAdmissibilityStatus: Record<'pending' | 'admissible' | 'inadmissible', number>
  byCaseDecisionStatus: Record<'draft' | 'proposed' | 'voted' | 'issued' | 'appealed' | 'voided', number>
  /** Median days from ethics_case_details.complaint_received_at to case_decisions.decided_at, issued only. */
  medianCycleTimeDays: number | null
  /** Sanction-type distribution over ISSUED decisions only (ethics_decision_details.sanction_type). */
  sanctionOutcomeCounts: Record<string, number>
}

/**
 * CRITICAL INVARIANT (the E3a acceptance keystone): every row this aggregates is FIRST filtered
 * through `can_read_case(case_id, auth.uid())` — via an ordinary RLS-scoped select against
 * `cases`/`ethics_case_details`/`case_decisions` (NOT a service-role/DEFINER bypass). A viewer who
 * cannot read a given ethics case (respondent, recused, non-granted member of an explicit_grants_only
 * case) contributes ZERO to every count/aggregate below — no leakage via a count that reveals "a case
 * exists" even when its detail is hidden. See §4 acceptance A-4 for the exact pgTAP/E2E assertion.
 */
export async function getEthicsDashboard(commissionId: string): Promise<EthicsDashboardSummary> {
  throw new Error('not implemented')
}
```

### 2.4 RLS

- **`cases.case_type_id`** — no RLS change (a plain column read on an already-`can_read_case`/board-
  scoped table).
- **`case_events`** — the existing three policies (`case_events_select` / `_staff_admin_write` /
  `_writer_write`) are **extended, not replaced**: `case_events_select` becomes
  `(app.can_read_case(case_id, auth.uid()) OR app.is_org_admin_of_commission(...)) AND (visibility =
  'case_readers' OR app.is_staff_admin_of(app.commission_of_case(case_id)) OR
  app.is_org_admin_of_commission(app.commission_of_case(case_id)))` — i.e. `can_read_case` stays the
  **floor** (unchanged), and `visibility='coordinator_only'` **additionally requires** coordinator/org-
  admin. An ordinary case reader still sees every `case_readers` event exactly as today (byte-for-byte
  when `visibility` is always its default) and loses only the coordinator-flagged subset. **No RLS
  change to the write policies** (`_staff_admin_write` / `_writer_write` already gate who may set
  `visibility` on insert — no new write path).
- **`getEthicsDashboard`** — no new RLS shape: the read is an ordinary `can_read_case`-scoped select
  (RLS enforces it automatically since the underlying tables are RLS-protected E2 tables plus `cases`
  itself); the query function does **not** use a service-role/admin client. This is the single most
  important design constraint in this document (§4 A-4).

### 2.5 Terminology-wiring touch-list (frontend, off the frozen §2 contract)

| Component | Current hardcode | E3a change |
|---|---|---|
| `src/app/o/[org]/c/[commission]/manage/cases/page.tsx` (board) | "Casos" heading, generic case cards | Render `terminology.case.plural` for the page heading; per-card label stays `case.label`/`caseNumber` (non-identifying, unaffected) |
| `src/components/cases/case-tabs.tsx` L25 | `"Linha do tempo"` hardcoded tab label | Render `terminology.timeline.singular` |
| `src/components/cases/case-detail-view.tsx` | Section headings that assume a case/patient framing (via `CasePatientPanel`, outcome selector copy) | Thread `terminology` prop down from the page-level `getCaseTypeTerminology(caseTypeId)` call; swap `primary_subject`-framed copy |
| `src/components/cases/case-patient-panel.tsx` | "Paciente" framing (ADR 0038 patient-centric UI) | For an Ethics case (`primary_subject_kind = 'professional'`), this panel does not apply — the primary subject is a `professional_profiles` row via `case_participants`, a **different** panel (E2's UI, not E3a's). No component change here; E3a's job is only to ensure the panel is **absent/replaced** when `primary_subject_kind !== 'patient'`, which is a `case-detail-view.tsx` conditional, not a `case-patient-panel.tsx` edit |
| `src/components/cases/case-events-timeline.tsx` | No visibility affordance | Add a small `coordinator_only` badge/icon per event row (visible to everyone who can see the row, since a non-coordinator never receives a `coordinator_only` row per RLS — the badge is informational, not a second gate) |
| `src/components/cases/case-event-form.tsx` | `kind` select limited to today's 4 TS-visible values | Widen the select to the new `CaseEventKind` union; add a `visibility` toggle (coordinator-only field — a non-coordinator writer's form omits it, defaulting server-side to `case_readers`) |
| New: ethics dashboard page (route TBD by `frontend`, e.g. `/o/[org]/c/[commission]/dashboard/ethics` or a tab on the existing dashboard) | N/A (new surface) | `getEthicsDashboard` → counts/cycle-time/sanction-distribution cards, mirroring `dashboard-charts.tsx`'s Recharts idiom |

---

## 3. Backend tasks (`backend`)

| # | Task | Depends | Plan review |
|---|------|---------|-------------|
| BE-1 | **Post the §2 contract** as typed stubs (`case-types.ts`, `cases.ts` additive fields, `case-documents.ts` widen, `ethics-dashboard.ts`) and commit, unblocking `frontend`. | E1, E2 gated; **O-1 resolved** | one-line ack |
| BE-2 | Migration: `cases.case_type_id` (nullable FK) + `create_case` optional param + org-consistency guard (if O-1 = (a)). | BE-1 | **one-line ack** if O-1=(a) (additive nullable column mirroring an established pattern); **full** if O-1=(b)/(c) (see Open decisions) |
| BE-3 | Migration: `case_events` kind-CHECK widen (additive array) + `visibility` column + default + RLS policy extension (§2.4). | BE-2 | **one-line ack** (additive CHECK widen + a narrowing-only RLS AND-condition mirroring an approved shape — no new table, no new predicate) |
| BE-4 | Seed: Ethics `case_type` + `case_type_terminology` bundle + role bundle (§2.2). | BE-3 | one-line ack (seed-only, mirrors the `seed.sql` L717 pattern) |
| BE-5 | `getCaseTypeTerminology` + wire `getCaseDetail`/`listCasesBoard` to project `caseTypeId` + resolved `terminology`; regenerate `database.ts`. | BE-4 | one-line ack (read-only projection) |
| BE-6 | `getEthicsDashboard` — the RLS-scoped aggregation read (§2.3/§2.4); **the highest-scrutiny task in E3a** because a leakage bug here is a confidentiality regression, not a cosmetic one. | BE-5 | **full** (novel read shape even though it introduces no new RLS policy — the review is about *proving* the RLS-scoping claim, not the DDL) |

**Serialization within the phase:** BE-2 → BE-3 → BE-4 → BE-5 → BE-6 serial (each depends on the prior's
schema/seed). BE-6 gets the fullest review despite being "just a read" — see §6 Risks.

---

## 4. Tester — acceptance criteria (E2E `chromium` + pgTAP; E3a keystones)

**Terminology wiring:**
1. Opening the seeded Ethics case's detail page renders **"Denúncia"** (not "Caso") in the page
   heading/breadcrumb, **"Médico denunciado"** where the primary-subject label appears, and
   **"Cronologia processual"** as the timeline tab label. Opening any **non-Ethics** case (no
   `case_type_id`, or a case_type with no terminology override) renders **exactly today's** hardcoded
   labels ("Caso" / "Linha do tempo" / …) — byte-for-byte, the default-fallback keystone.
2. `getCaseTypeTerminology(null)` and `getCaseTypeTerminology(<a case_type with zero override rows>)`
   both return the platform-default bundle (pgTAP/unit: the fallback is deterministic, not a null/throw).

**`case_events` kind widen + visibility:**
3. A `case_events` row with `kind = 'finding_recorded'` inserts successfully (CHECK widen live); an
   invalid kind still rejects (CHECK still enforces a closed set). An **existing** `kind = 'note'` row
   is unaffected by the migration (no data touched).
4. A `visibility = 'coordinator_only'` event is **invisible** to an ordinary case reader (present in
   the timeline for a coordinator, absent for a granted-but-non-coordinator reader) — pgTAP: the SELECT
   returns the row for a staff_admin uid and omits it for a `can_read_case`-true-but-non-coordinator
   uid. A **respondent** or **recused** user sees **neither** kind of event regardless of `visibility`
   (E1's deny-terms are the floor — `visibility` never overrides them). A `visibility = 'case_readers'`
   (default) event is visible to every `can_read_case`-true reader exactly as today.
5. **Flag-OFF-adjacent regression guard:** with no `case_type_id` ever set on any case (a fresh
   environment where E1/E2 exist but no Ethics case has been created), the `case_events` timeline and
   the case board render **identically** to pre-E3a behavior — the kind-widen and visibility-default
   are inert until exercised.

**Ethics dashboard — the confidentiality-respecting keystone:**
6. **The core assertion:** as a coordinator with full ethics-case access, `getEthicsDashboard` counts
   **N** ethics cases (matching a seeded fixture: some `pending`, some `admissible` with issued
   decisions). As a commission member who is the **respondent** on one of those cases (E1
   respondent-exclusion) or **recused** from another, or a **non-granted member** of an
   `explicit_grants_only` case with no attribution, the **same dashboard call returns a strictly lower
   count** — the excluded case(s) contribute to **none** of `totalCases` /
   `byAdmissibilityStatus` / `byCaseDecisionStatus` / `sanctionOutcomeCounts`. This is asserted **both**
   in pgTAP (the underlying RLS-scoped query, run as different test roles, returns different row sets)
   **and** in E2E (the rendered dashboard cards show different numbers for a coordinator vs. a
   respondent-viewer in the same commission).
7. `medianCycleTimeDays` and `sanctionOutcomeCounts` compute only over decisions the viewer can read
   (same exclusion as #6) — a respondent's own case's cycle-time/sanction never enters *anyone's*
   dashboard number if that case is otherwise inaccessible to the viewer (i.e., the aggregate is
   per-viewer-scoped, not a single global number leaking through a service-role read). **This is the
   single highest-risk assertion in E3a** — a naive `count(*)` over a service-role connection would
   silently defeat E1's entire access spine at the dashboard layer.
8. A **foreign-commission** user's `getEthicsDashboard(otherCommissionId)` call is denied/empty (the
   existing commission-boundary discipline, unchanged).
9. **Audit:** opening the ethics dashboard does **not** itself require a new audit verb (it is an
   aggregate read over already-`can_read_case`-audited-where-applicable surfaces, not a new PHI/
   cross-member door) — confirm no new `log_audit_access` entry is needed (mirrors E2's own D11
   conclusion that its ordinary case reads need no new allow-list verb); flag at build if a reviewer
   disagrees.
10. **Keyboard-only** path through one terminology-aware flow (opening an Ethics case via the board,
    tabbing through the terminology-labeled tabs) — §8 a11y.
11. **Full regression** suite green (`npm run e2e:prod`) to declare done (§6 gate).

**pgTAP file** (new, e.g. `supabase/tests/2xx_ethics_e3a.sql`, on a **fresh reset** — memory
`pgtap-needs-fresh-reset-vs-e2e-leftovers`): the terminology default-fallback (null + no-override
cases), the `case_events` kind-CHECK widen (valid new kinds accepted, invalid still rejected, existing
rows untouched), the `visibility` RLS narrowing (coordinator sees both, ordinary reader sees only
`case_readers`, respondent/recused sees neither — **the deny-terms-are-the-floor assertion**), and the
**dashboard RLS-scoping keystone** (#6/#7 above, run as coordinator/respondent/recused/non-granted/
foreign-commission roles, asserting strictly-decreasing or zero counts, never a leaked aggregate). This
file is the E3a gate.

---

## 5. E3b — DEFERRED accreditation-link contract sketch (NOT built in this track)

**Status: design-only sketch for a future track, explicitly excluded from the pre-pilot build.** Gated
on Phase 16 (Standards Crosswalk) being re-planned and shipped (plan §7 risk #1, S0 §F.3). Recorded here
so a future implementer has the intended shape without re-deriving it, and so E3a's schema choices do
not accidentally foreclose it.

**Intended shape (sketch, not frozen):**

- An **evidence-link join table**, e.g. `accreditation_evidence_links(id, standard_id →
  <Phase-16 standard table>, evidence_type text check in ('ethics_decision', 'capa', …), evidence_id
  uuid, linked_by, linked_at, notes_md)` — a generic polymorphic-by-`evidence_type` link, **not** a
  column bolted onto `case_decisions` (keeps E2's engine-level table free of a forward dependency on a
  phase that does not yet exist, and keeps the link reusable for CAPA / controlled-document evidence
  too, matching the readiness-report's need for multiple evidence kinds per standard).
- **Why a decision/CAPA row, not the whole case:** the evidence a surveyor cross-references is a
  **specific defensible artifact** (an issued `case_decisions` row, or a CAPA closure) — never the raw
  case content (which may be `explicit_grants_only`/confidential per E1). The evidence link therefore
  points at `case_decisions.id` (already `can_read_case`-gated) or an `action_items`/CAPA id, projecting
  only what the readiness report needs (decision type + date + outcome summary), never the underlying
  allegation/finding detail.
- **RLS:** SELECT gated by **both** `can_read_case` (for the evidence's originating case) **and**
  whatever Phase 16's own standard-visibility model turns out to be (unknown until that phase is
  re-planned) — an AND, following the same "narrowing never widens" discipline as E3a's `case_events`
  visibility column.
- **Read surface:** a `getReadinessGapReport(standard_id)` (Phase 16's own read, extended) would join
  through this table to show "N pieces of evidence linked, of which M are ethics decisions" — E3b adds
  the ethics-side link and its RLS; Phase 16 owns the report itself.
- **Explicitly NOT decided here (deferred to the future E3b design, once Phase 16 exists):** the exact
  Phase-16 standard/framework table shape, whether the link is coordinator-only or any case-reader can
  propose one (subject to Phase 16 review), and the SQLSTATE block (Phase 16 will need its own S0-style
  allocation at that point).

**Acceptance (spec'd, NOT built now):** an ethics decision links as evidence against a standard and
appears in the readiness report; a viewer who cannot read the originating ethics case does not see the
evidence link surfaced in the report (RLS AND-condition holds). No E2E/pgTAP exists for this yet — it is
written when E3b is actually scheduled.

---

## 6. Risks & ripples

- **The dashboard aggregation is the confidentiality tripwire, not a cosmetic feature.** A naive
  implementation (`select count(*) from ethics_case_details` over a service-role/admin client, or a
  `SECURITY DEFINER` read that forgets to re-check `can_read_case` per row) would silently leak "N
  ethics cases exist" or worse, a sanction-outcome distribution, to a viewer E1 explicitly excludes —
  defeating the entire m2 gate at the reporting layer instead of the access layer. **Mitigation:**
  `getEthicsDashboard` MUST be implemented as an ordinary RLS-scoped `authenticated`-role query (no
  service-role client), so Postgres RLS itself does the per-row filtering before aggregation — the same
  discipline `dashboard.ts`'s existing `getCommissionOverview`/`getFormDashboard` already follow for
  form responses. BE-6 gets full review specifically to verify this, and the pgTAP file's multi-role
  count-comparison (§4 #6/#7) is the enforcement mechanism, not just documentation.
- **`cases.case_type_id` absence (O-1) is a genuine, verified gap** neither E1 nor E2's contract closes.
  If the lead resolves O-1 differently than this doc's assumption (§2.1 option (a)), the BE-2 review
  level and the seed/RPC wiring in §2.2/§2.3 need re-deriving — flagged explicitly so this isn't
  discovered mid-build.
- **`case_events.body` is PHI-bearing (verified via its own migration comment).** The new `visibility`
  column must be reviewed as a **narrowing-only** mechanism — any implementation that could be misread
  as a grant (e.g. a bug that makes `coordinator_only` visible to a *broader* audience than
  `case_readers` under some code path) is a Rule-12 regression. Mitigation: the RLS policy is a single
  `AND` clause appended to the existing `can_read_case`-gated policy, never a new `OR` arm — a pgTAP
  keystone (§4 #4) proves the floor holds for respondent/recused viewers regardless of visibility value.
- **`CaseEventKind` TS/DB drift (pre-existing, unrelated to E3a but touched by the same edit).** The TS
  union was already narrower than the DB CHECK before this track (`interview`/`safety_event` were
  DB-valid, TS-invisible) — §2.3 closes this in the same widen that adds the new procedural kinds, so
  the fix rides an already-scheduled edit rather than becoming a separate, easy-to-defer cleanup.
- **Terminology default-fallback is the byte-for-byte guarantee for every non-Ethics case.**
  `getCaseTypeTerminology` must never throw or return `null` for a `caseTypeId = null` case — every
  existing M&M/generic case (the overwhelming majority) depends on the fallback resolving deterministically
  to today's hardcoded strings. This is the E3a analogue of E1/E2's flag-OFF-byte-for-byte invariant,
  applied to a UI-label resolver instead of an RLS predicate — same discipline, different layer.
- **`case-patient-panel.tsx` is NOT an E3a edit.** It stays exactly as-is; E3a's job is only to ensure
  `case-detail-view.tsx` conditionally omits it for a non-`patient`-primary-subject-kind case type
  (Ethics). Do not touch the patient-panel component itself — that would risk regressing the ADR-0038
  single-door patient-PHI UI for the M&M/existing case types that still use it.
- **Performance.** `getEthicsDashboard`'s RLS-scoped aggregation runs `can_read_case` per row across
  potentially every ethics case in a commission — acceptable at pilot scale (a handful of ethics cases
  per commission), but verify with the `supabase-postgres-best-practices` skill during BE-6 that the
  existing `case_participants`/`case_recusals` partial indexes (E1) keep the per-row predicate cheap at
  the aggregation's expected row count.

---

## 7. Sequencing & gate

Contract-first: **BE-1 first** (posts §2 types). Then BE-2 → BE-6 as tabled (case_type_id → case_events
widen → seed → terminology read → dashboard read). `backend` owns all migrations +
`lib/queries/{case-types,cases,case-documents,ethics-dashboard}.ts`; `frontend` owns every terminology-
aware component + the new dashboard page, built off the frozen §2 contract (disjoint files). Tester
spawned when the phase builds green locally + pgTAP passes on a fresh reset; QA after tester green
(with **explicit RLS-scoping verification of `getEthicsDashboard`** as the QA focus item — the same
weight E1's `can_read_case` edit and E2's `case_votes` recusal-exclusion got). Then human approval, then
§6 Record: PROGRESS → ✅, `docs/backend-state.md` updated (the terminology reader, the `case_events`
widen + visibility column, the ethics dashboard read), rotate task detail, `graphify update .`, commit
`phase(E3a): complete — Ethics terminology/UX surfacing`.

**E3b stays unscheduled** — no gate, no build, until Phase 16 is re-planned and this document's §5
sketch is promoted to a real ADR + build plan at that time.

---

## Open decisions (flagged for lead / PO)

- **★ O-1 — `cases.case_type_id` does not exist anywhere in the chain (verified gap).** Neither `cases`
  nor `process_templates` carries it despite `case_types`' own migration comment describing the
  intended snapshot ("a process_template references a case_type; a case snapshots case_type_id"). Three
  options: **(a) [assumed/recommended in this doc]** add a nullable `cases.case_type_id` directly in
  E3a's own migration (BE-2), scoped to this track since E3a is the first consumer that actually needs
  it; **(b)** treat it as an E1/E2 omission and request a follow-on migration in one of those already-
  approved tracks before E3a starts (cleaner sequencing logically, but reopens a track the S0 gate
  already froze); **(c)** resolve it via `process_templates.case_type_id` instead (a case inherits its
  type from its template at creation, no column on `cases` itself) — cheaper but means a `case_type_id`
  is unavailable for the (currently supported, ADR 0044) **processless** cases that have no template.
  **Recommend (a)**: it is additive, low-risk (nullable, default-null preserves every existing case),
  and keeps the column's introduction co-located with its first real consumer. Confirm before BE-2.
- **O-2 — dashboard route/placement.** Whether `getEthicsDashboard` renders as a new top-level route
  (`/dashboard/ethics`) or a conditional tab on the existing commission dashboard when `ethics` is
  flag-ON. **Frontend's call** (no backend schema implication either way); flagged here only because it
  affects whether `frontend`'s task list in this doc's §2.5 needs a route-file addition. Recommend a new
  route (mirrors how NSP/PQS already gets its own dashboard area rather than overloading the generic
  one) — confirm with `frontend`/lead at kickoff.
- **O-3 — which E2 procedure writes auto-log a `case_events` row, and at what visibility.** This
  document widens the `kind` CHECK and adds `visibility`, but does **not** mandate that every E2 RPC
  (`decide_admissibility`, `add_ethics_allegation`, `cast_case_vote`, …) *automatically* inserts a
  matching `case_events` row — that wiring belongs either to E2 (if retrofitted) or to a small E3a task
  not yet enumerated in §3. Two shapes: **auto-derive** (each E2 RPC also writes a `case_events` row,
  giving a unified procedural timeline "for free") vs. **manual-only** (coordinators optionally add a
  `case_events` note referencing the procedural milestone, same as today's `note`/`meeting` kinds; the
  new kinds exist for when they choose to). **Recommend manual-only for E3a's pre-pilot scope** (lower
  risk — no new write path threaded through nine E2 RPCs under this track's thin-DB budget) with
  auto-derivation as a documented fast-follow if the pilot commission asks for it. Confirm — this
  materially changes whether §3 needs a BE-7 task touching E2's RPC bodies.
- **O-4 (cosmetic, low-stakes) — `EVENT_KIND_LABEL` pt-BR strings for the 8 new procedural kinds.** Not
  specified in this doc (a `frontend` copywriting task, not a schema decision) — e.g.
  `admissibility_decided → "Admissibilidade decidida"`, `vote_cast → "Voto registrado"`. No blocker;
  noted so `frontend` knows the map needs 8 new entries alongside the type widen.
