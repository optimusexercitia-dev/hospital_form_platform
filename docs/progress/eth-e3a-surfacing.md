# ETH·E3a — Terminology/UX surfacing — backend design note (BE-1)

**Author:** `backend` · **Date:** 2026-07-26 · **For:** lead ratification before BE-2.
**Scope:** the two decisions the lead asked BE-1 to spec — the **O-1** migration shape
(`cases.case_type_id`) and the **O-3** auto-derive mapping (each E2 procedure RPC →
`case_events`). Contract stubs are committed separately (§"Landed" below). Nothing in
this note is built yet; migrations wait on ratification.

Plan of record: [`docs/phases/ethics-e3-surfacing.md`](../phases/ethics-e3-surfacing.md).
Binding model: ADR 0064 Decision 4. As-built surfaces: `docs/backend-state.md` §E1
(ADR 0072 access spine) / §E2 (ADR 0073 procedure).

---

## Catalog re-verification (LIVE catalog, local stack, 2026-07-26)

Confirmed against `pg_proc` / `information_schema` / `pg_constraint` (NOT migration
files — stale-by-design per CLAUDE.md §graphify):

- **`cases` has NO `case_type_id`** — columns are id, commission_id, template_id,
  case_number, label, status, created_by, created_at, closed_at, closed_by,
  outcome_id, has_patient, patient_enabled, phi_disposed_{at,by,reason}, department_id,
  department_other, organization_id, updated_at, **visibility_policy**,
  **confidentiality_level** (the last two added by E1). **O-1 is real.**
- **`create_case_from_template` ALREADY accepts `p_case_type_id uuid default null`** and
  validates it against `case_types` **with an org-consistency guard**
  (`where id = p_case_type_id and organization_id = app.org_of_commission(v_commission_id)`,
  raising `no_data_found` when absent), using it to derive
  `default_visibility_policy`/`default_confidentiality_level` — **but it does NOT persist
  it** (no column). The processless `create_case(p_commission_id, …)` has **no**
  `p_case_type_id` param at all. This is the load-bearing find for O-1 wiring below.
- **`case_decisions.status`** CHECK = `draft | proposed | voted | issued | appealed |
  voided` — matches the dashboard `byCaseDecisionStatus` contract exactly.
- **`ethics_case_details.admissibility_status`** CHECK = `pending | admissible |
  inadmissible` — matches `byAdmissibilityStatus`.
- **`ethics_sanction_types`** = (id, organization_id, key, display_name, is_active,
  position); **`ethics_decision_details.sanction_type_id`** is a uuid FK to it. The
  plan §2.3 free-text `sanction_type` **never shipped** — dashboard `sanctionOutcomeCounts`
  is reconciled to key off `sanction_type_id` + join `ethics_sanction_types.display_name`.
- **`case_events`** columns = id, case_id, kind, title, body, occurred_at, created_by,
  created_at, updated_at, occurred_time. **No `visibility` column** (BE-3 adds it). `kind`
  CHECK = `note | meeting | decision | interview | safety_event | other` (6). Also a
  `case_events_body_not_blank` CHECK — **auto-derived bodies must be non-blank** (O-3).
- **`case_type_terminology` has ZERO TS consumers** — `grep src/` finds the table name
  only in generated `database.ts`; `getCaseTypeTerminology` has zero hits. BE-1's
  `case-types.ts` is the first-ever reader.

E2 procedure RPC roster (all `SECURITY DEFINER`) verified; the milestone writers used by
O-3 are named in the mapping table below.

---

## O-1 — `cases.case_type_id` (E1-surface amendment)

**Home: E1 (concur with the PO default).** The org-consistency guard and the
`case_types` → default-visibility snapshot already live on the E1 surface — literally in
`create_case_from_template`, which already validates `p_case_type_id` against `case_types`
with the org guard. Adding the column co-locates it with the code that already resolves
the type. Amends **ADR 0072 / backend-state §E1**; window `20260720000000+`
(forward-only, additive, reset-OK; latest shipped is well before this).

**DDL (additive, nullable):**

```sql
alter table public.cases
  add column case_type_id uuid references public.case_types(id) on delete set null;
```

Nullable, default `null` — every existing case stays type-less ("processless"-compatible),
so behavior is byte-for-byte unchanged; only case-type-aware flows (Ethics) set it going
forward. `on delete set null` mirrors the tolerant lineage of `template_id`.

**RPC wiring (mirrors an already-shipped pattern → BE-2 = one-line ack per plan §3):**

1. **`create_case_from_template`** — it already validates `p_case_type_id`; extend only
   the `insert into public.cases (…)` column list to persist `case_type_id => p_case_type_id`.
   No new guard (the org-consistency check is already there).
2. **`create_case`** (processless) — add optional `p_case_type_id uuid default null`; when
   supplied **and** `app.feature_enabled('case_types')`, run the SAME org-consistency guard
   copied from `create_case_from_template`
   (`where id = p_case_type_id and organization_id = app.org_of_commission(v_commission_id)`,
   raise `no_data_found` if not found), then persist it. `NULL` stays legal (the pre-Ethics
   default). Optionally derive `visibility_policy`/`confidentiality_level` from the type to
   match the template path — flag for the lead whether the processless path should also
   inherit those defaults, or only snapshot the id.

**After BE-2: regenerate `src/lib/types/database.ts` (Rule 8).** Then BE-5 flips the four
`caseTypeId: null` placeholders (board / detail / phase-fill mappers) to project the real
column, and resolves `CaseDetail.terminology` from `case_type_terminology`.

**RLS:** none — a plain column read on an already-`can_read_case`/board-scoped table.

---

## O-3 — auto-derive: E2 procedure RPCs → `case_events`

PO-locked: **auto-derive** (each matching E2 RPC ALSO inserts a `case_events` row on the
new procedural `kind`). This touches E2's frozen RPC bodies (a BE task to be enumerated —
proposed BE-3b/BE-7, after the kind-widen + visibility column land in BE-3) and is a
**Rule 12** surface: every auto-derived `body` is a **structured, PHI-free, deliberation-
safe pt-BR summary** — never free-text complaint/finding/vote detail — and deliberation-
sensitive kinds are written `coordinator_only` so individual votes/findings are invisible
to ordinary `case_readers`.

### Mapping table (the 8 new kinds)

| `kind` | E2 RPC (writer) | `case_id` source | Default `visibility` | Deliberation-sensitive? | PHI-free pt-BR body template |
|---|---|---|---|---|---|
| `admissibility_decided` | `decide_admissibility(p_case_id, p_status, p_rationale_md)` | arg | `case_readers` | no | `"Admissibilidade decidida: {status}"` — status ∈ {admissível, inadmissível}; **`rationale_md` excluded** |
| `allegation_added` | `add_ethics_allegation(p_case_id, p_category_id, p_description_md, …)` | arg | `case_readers` | no (category is controlled vocab) | `"Nova alegação registrada (categoria: {category_display_name})"` — **`description_md` excluded** |
| `finding_recorded` | `record_ethics_finding(p_allegation_id, p_finding, …)` | via `ethics_allegations` | **`coordinator_only`** | **YES** (deliberative conclusion) | `"Parecer de alegação registrado"` — **finding value / rationale / evidence excluded** |
| `notification_issued` | `issue_ethics_notification(p_case_id, p_notification_type, p_delivery_method, …)` | arg | `case_readers` | no | `"Notificação emitida: {notification_type} ({delivery_method})"` — **recipient identity excluded** (recipient may be PHI) |
| `hearing_scheduled` | `schedule_ethics_hearing(p_case_id, p_hearing_type, p_scheduled_at, …)` | arg | `case_readers` | no | `"Audiência agendada: {hearing_type}"` (+ date when set) |
| `vote_cast` | `cast_case_vote(p_decision_id, p_vote, p_rationale_md)` | via `case_decisions` | **`coordinator_only`** | **YES** (individual vote) | `"Voto registrado"` — **vote value / voter / rationale excluded** |
| `decision_issued` | `issue_decision(p_decision_id)` | via `case_decisions` | `case_readers` | no | `"Decisão emitida: {decision_type}"` — **sanction details excluded** (those live in `ethics_decision_details`, coordinator surface) |
| `appeal_submitted` | `submit_ethics_appeal(p_case_id, p_decision_id, p_appeal_reason_md, …)` | arg | `case_readers` | no | `"Recurso interposto"` — **`appeal_reason_md` excluded** |

**Deliberation-sensitive kinds = `finding_recorded`, `vote_cast`** → written
`coordinator_only`, and their bodies carry NO finding/vote value, rationale, evidence,
voter, or count. Every other kind is a procedural milestone visible to legitimate case
readers (`can_read_case` remains the floor — a respondent/recused reader sees none of them
regardless of visibility). **Confirmation: none of the eight bodies carry PHI or free-text
deliberation** — each is a fixed template over a controlled value (enum/status/type) or a
catalog `display_name`; all free-text `*_md` args are deliberately excluded. Bodies are
non-blank (satisfies `case_events_body_not_blank`).

### Explicitly NOT auto-logged in E3a (with reason)

- **`create_case_decision`** (draft) — only `issue_decision` emits `decision_issued`;
  drafts churn and are not milestones.
- **`declare_conflict` / `record_recusal` / `lift_recusal`** — E1 access-spine, and who
  recused/conflicted from a case is deliberation/identity-sensitive; surfacing it on the
  shared timeline would leak to `case_readers`. Left off deliberately.
- **`set_ethics_decision_details` / `update_ethics_allegation` /
  `upsert_ethics_case_details`** — edits/detail, not milestones; `decision_issued` /
  `allegation_added` already mark the milestone.
- **`complete_ethics_hearing`, `void_decision`, `review_ethics_appeal`,
  `open_ethics_external_referral`, notification ack/cancel/read** — real events with **no
  kind in the plan's 8-value set**. Flagged as **fast-follow candidates** (a future kind
  widen), NOT invented here — E3a ships exactly the 8 the plan froze.

---

## Landed in BE-1 (committed contract stubs, typecheck + lint clean 0/0)

- **`src/lib/queries/case-types.ts`** (new) — `CaseTypeTerminology` + `CaseTypeTerm`,
  `DEFAULT_CASE_TERMINOLOGY` (platform-default pt-BR bundle), `getCaseTypeTerminology`
  stub. Deviation flagged: `CaseTypeTerminology.caseTypeId` is `string | null` (the
  default bundle owns no type), vs the plan sketch's `string`.
- **`src/lib/queries/ethics-dashboard.ts`** (new) — `EthicsDashboardSummary` +
  `SanctionOutcomeCount` + `getEthicsDashboard` stub, with the RLS-scoped-read invariant
  documented. Reconciled to the as-built: enum-typed status Records, and
  `sanctionOutcomeCounts` is a catalog-joined array (was free-text `Record<string,number>`).
- **`src/lib/queries/case-documents.ts`** — added `ProceduralCaseEventKind`,
  `AnyCaseEventKind`, `CaseEventVisibility`; added `CaseEvent.visibility` (mapper defaults
  `case_readers` until BE-3). **`CaseEvent.kind` stays `CaseEventKind`** — see the drift
  note below.
- **`src/lib/queries/cases.ts`** — `Case.caseTypeId: string | null`;
  `CaseDetail.terminology: CaseTypeTerminology`; four construct sites default to
  `null` / `DEFAULT_CASE_TERMINOLOGY` until BE-5.
- **`src/lib/queries/case-narratives.test.ts`** — fixture updated for the new required
  fields (backend-owned test).

### Coordination flag for the lead — the `CaseEventKind` in-place widen

The plan §2.3 widens `CaseEventKind` itself to 14 values. **In place, that breaks the
whole-project `typecheck`**: `EVENT_KIND_LABEL` (frontend-owned,
`src/components/cases/case-extras-labels.ts`) is an exhaustive `Record<CaseEventKind,
string>`, and `case-events-timeline.tsx` indexes it with `ev.kind`. Under **O-3 =
auto-derive**, the 8 procedural kinds are **system-emitted, never manually selectable** —
so keeping `CaseEventKind` = the 4 manual kinds (form select + label map) and exposing the
procedural set as `ProceduralCaseEventKind` / `AnyCaseEventKind` is the correct as-built
shape, not a compromise. **Sequencing:** frontend grows `EVENT_KIND_LABEL` to
`Record<AnyCaseEventKind, string>` (O-4, their file) → **BE-5** widens `CaseEvent.kind` to
`AnyCaseEventKind` when wiring the read. Each step is independently green; no two teammates
edit the same file. This also preserves the existing intentional manual-vs-echo-kind
distinction documented in `case-documents.ts` (the plan called it "drift"; it is a design
choice — `interview`/`safety_event` are deduped echoes).

---

## Post-QA fix — P0-1 (case_events reader-non-writer split, ADR 0079)

QA found a `coordinator_only` read leak: `case_events_writer_write` was `FOR ALL` with a
bare `USING (can_write_case_content)`. A `cmd=ALL` policy's `USING` participates in SELECT
(SELECT = OR of every permissive policy's USING), so a content-**write** grantee read
`coordinator_only` rows — bypassing `case_events_select`'s narrowing. BE-6's `WITH CHECK`
gate only constrained writes, never reads (the classic ADR-0079 reader-non-writer blind
spot). Fix (migration `20260827000400`): both `FOR ALL` write policies → command-specific
`FOR INSERT`/`UPDATE`/`DELETE` (USING/WITH CHECK preserved, incl. the coordinator_only
insert-gate), leaving `case_events_select` as the sole SELECT authority. Keystone +
mutation-proof in `267` (#14–17). Full suite 135 files / 3852 tests PASS.

---

## Completion record (human-approved 2026-07-27)

**Phase Gate PASSED, all four steps.** S5·ETH·E3a is the last *build* track of the pre-pilot-release
plan (ADR 0071); E3b (accreditation link) stays deferred behind Phase 16.

**Commit chain (15, local-first on `main`, unpushed):** `e61fa3c` (BE-1 contract + O-1/O-3 note) ·
`fb1abbf` (BE-2–4: `case_type_id` + create-path inheritance · `case_events` +8 kinds + `visibility` +
narrowing RLS · Ethics seed) · `79acbfa` (BE-5: 8-RPC auto-derive, PHI-free, mutation-proven) ·
`bec5f45` (BE-6: terminology resolver + projections + 3 FE follow-ups; client-safe `terminology.ts`) ·
`91e7881` (BE-7: `getEthicsDashboard`, RLS-scoped) · `355bd06`+`1366777` (FE terminology screens +
dashboard route) · `2956aaf` (tester spec) · `1ce0876` (BUG-E3A-002 visibility projection) · `1173900`
(BE-8 pgTAP renumber 260-263→266-269) · `ef5c38b` (BUG-E3A-001 terminology render + primary-subject
card) · `70fd5ed` (tester re-verify 21/21) · `8d80783` (QA r1 CHANGES REQUESTED) · `a64e61a` (P0-1
reader-non-writer split) · `38db4c9` (QA r2 APPROVED).

**Gate evidence:** build tsc/lint/`next build` green · tester `ethics-e3a-surfacing.spec.ts` **21/21**
(deterministic, fresh resets) · pgTAP **266–269 = 63**, full suite **3852/3852** (independently
re-confirmed by tester + QA) · QA **APPROVED r2** (dashboard RLS-scoping neutralization-proven
load-bearing; keystone-vacuity re-audit clean; QA self-caught + closed the write-grantee P0) ·
**e2e:prod triaged GREEN, 0 deterministic regression** — run 1 was infra-invalidated (`supabase_vector`
502 crash-loop → 8/12 batches `reset FAILED`; recovered by `[analytics] enabled=false`); run 2 = 731
passing, 44 infra-only reds (mid-batch server-death cascades in *stable* specs + the `notifications`
whole-file baseline flake); isolation re-runs confirmed the ethics batch 54/54 (E3a 21/21) + bulk 8/8
on healthy servers. Evidence composition per the E1 precedent (QA-endorsed): clean batches + isolated
re-confirmation of every affected spec + independent full pgTAP.

**PO decisions (2026-07-26), both non-recommended, both implemented:** O-1 = reopen E1/E2 →
`cases.case_type_id` on the **E1 surface** + processless `create_case` **inherits** the type's
`explicit_grants_only`/`ethics_investigation` (Rule-12). O-3 = **auto-derive** the 8 procedural
`case_events`. O-2 (dashboard route) + O-4 (kind labels) → frontend.

**Open follow-ups (non-blocking):** QA INFO-1/-2 (2 stale code comments — INFO-1's is true post-P0-fix) ·
participants **management** UI (add/remove/set-primary/COI via `participants/actions.ts`) unbuilt — E3a
ships read-only primary-subject display only · ethics dashboard has no nav link (URL-reachable) ·
`decision_issued` body omits the uncontrolled `decision_type` (optional fast-follow = a controlled
decision-type vocabulary) · `[analytics] enabled=false` committed separately as a dev-infra gate-stability
fix.

**Deploy posture:** local-first, **unpushed** (16 commits ahead of origin incl. the case-corrections
INFO-1 tail). Origin push + remote `db push` + Coolify stay batched for the pilot — that deploy is when
the m2 flag flip (`case_participants`/`case_types`) + the entire S-track land in production. Only Phases
18–19 remain post-pilot; **S5 was the last pre-pilot build track.**
