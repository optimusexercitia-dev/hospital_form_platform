# Focused Analysis — Audit §4 (Efficiency & Performance) and §5 (Data Model & Extensibility)

**Date:** 2026-07-04 · **Author:** platform lead · **Scope:** *only* sections **4** and **5**
of the external DB audit (`external-db-audit-2026-07.md`), re-verified against live code this
session. Companion to the full-audit triage (`external-db-audit-2026-07-evaluation.md`) and the
membership-lockdown plan (`../plans/membership-write-path-lockdown.md`). The comparison table the
request asked for is **§4 below**.

Lens applied to every item: **reachability** (can the app trigger it?), **scale** (does it bite at
demo size or only under years of data?), and **fix cost** (one line vs. a phase).

---

## 0. Headline

- **§4 (performance) is accurate and almost entirely cheap — but none of it is a security or
  correctness bug.** It is latency and scale. Two items are genuinely *future-dangerous* because
  their cost grows with an append-only, 20-year-retention table (the unbounded audit-actor `DISTINCT`
  scan; the missing pagination on growth-unbounded reads). The rest are calibration: real, worth
  doing, not blockers. Every perf multiplier the audit quotes ("12–18×/nav", "15–20 round-trips") is a
  reasoned estimate, not a measurement, and the feature-flag RPCs it counts run **concurrently**, so
  the latency framing is directionally right but overstated.
- **§5 (data model) is the higher-value section.** It contains the two real
  correctness/compliance defects in the whole audit — the `SET NULL` × `NOT NULL` CHECK booby-trapped
  delete, and the silent tenant-hierarchy desync — plus the integrity gap the audit escalated to
  Critical (`answers` has no FK to its form, C-5), which is structurally a data-model concern. Its
  strategic fixes (§6.2 patient master, §6.3 metadata-driven item types) are sound and are **cheapest
  now**, under the pre-launch "reset OK" posture, before real MRNs are hashed and real answers
  accumulate.
- **Overstatements to correct before acting** (detail in §3): the "phase reorder silently rewires the
  dependency graph" sub-claim is wrong for the shipped path; `profiles.home_*` is not the same class
  of desync as `hospitals`; the "global vocab cross-tenant-editable" finding folds in two
  super-admin-gated tables that don't belong; the forward-compat UUID-no-FK columns are a deliberate,
  self-documented convention, not an oversight.

**Net:** do the handful of §5 correctness/anchor items and the two dangerous §4 scale items **now**
(all cheap pre-launch); schedule the §5 strategic refactors (patient master, metadata item types) as
the next structural track after the membership lockdown; treat the remaining §4 perf work as a
pilot-window sweep.

---

## 1. §4 · Efficiency & Performance — per-finding

### Data-access layer (all confirmed, all cheap)

**P1 — `getSessionContext()` not `React.cache()`-wrapped.** *Confirmed, first-hand.*
`getSessionContext` (`src/lib/queries/session.ts:123`) fires `getSession()` + `getClaims()` + a
5-way `Promise.all` of RLS-scoped reads (profiles + `commission_members` + `organization_members`×3),
and is **not** memoized — while its two siblings in the very same file, `getCommissionAccessByOrg`
(:345) and `getNspAccessByOrg` (:444), **are** `cache()`-wrapped and both call `getSessionContext`
internally. So the precedent, and the fix, are one line: `export const getSessionContext = cache(async …)`.
The reads are concurrent (one wall-clock round trip), so the real cost is the *repeated invocation*
across a single render tree, not five serial hops — which is exactly what `cache()` dedupes.
**→ Do now (one line, own precedent).**

**P2 — `DISTINCT` filter options computed in JS over an unbounded scan.** *Confirmed, first-hand.*
`listAuditFilterActors` (`audit.ts:596`) selects **every** `audit_log` row in scope (only a
`commission_id` filter, no limit) and dedupes `actor_id` into a `Map`. `audit_log` is append-only with
20-year retention (Rule 11), so this scan set only ever grows. This is the most future-dangerous perf
item in the audit: a `SELECT DISTINCT actor_id …` (or a small `audit_log_actors` view / RPC) is O(distinct
actors), not O(all rows ever). Same shape on the submission-filter dropdown.
**→ Do soon (before the audit table has volume; it degrades silently).**

**P3 — No pagination on growth-unbounded reads.** *Confirmed, first-hand + prior trace.*
`listSubmissions` (`submissions.ts:201`) has no `.range()`/`.limit()` — it returns every matching
response forever; the same holds for `listCasesBoard`, `listMeetings`, `listCommissionReferrals`,
`pqsInbox`. **Nuance the audit didn't state:** every one of these is commission- or hospital-scoped, so
growth is bounded by that unit, not global — this is perf-at-scale, not a correctness bug. Worth noting
the audit's *own* list read is already keyset-paginated (`audit.ts` `.range` at :433/:477/:522), so the
pattern exists in-repo. Add it to `listSubmissions` first (highest row velocity).
**→ Do soon (add keyset now, before the query contracts freeze; low urgency at demo scale).**

**P4 — Commission layout round-trips for count badges + feature flags.** *Confirmed (prior trace).*
The layout materializes full datasets only to render a count (`listCasesBoard(...).filter().length`)
and fires several feature-flag RPCs. Two cheap wins: `count: 'exact', head: true` (or one
`sidebar_counts()` RPC) instead of shipping rows to `.length` them; and one cached
`get_feature_flags()` instead of N. **Calibration:** the flag RPCs already run under `Promise.all`
(≈1 round trip wall-clock), so the "15–20 round-trips" figure overstates the latency — the real win is
payload size (rows→counts), not round-trip count.
**→ Optional / Do soon (payload trim; consolidate flags when convenient).**

**P5 — Client-side filtering the DB could do.** *Confirmed, first-hand.*
`listSubmissions` filters by form **in JS** (`submissions.ts:253`) with a comment claiming the embedded
`form_id` is "not filterable inline via PostgREST `.eq`" — the audit is right that this is **incorrect**:
with the existing `form_versions!inner` embed, `.eq('form_versions.form_id', filters.formId)` pushes the
predicate to the DB. Minor, but it removes a fetch-everything-then-filter step.
**→ Optional (correct the comment + push the predicate down; tiny).**

### SQL layer (mostly latent; confirmed via prior line-level trace)

**P6 — `verify_audit_chain` is O(n) per chain**, per-row SHA-256 recompute, unpaginated, single
transaction. Fine at demo scale; on a mature chain it is minutes of CPU holding one snapshot. Needs
incremental / checkpointed verification (verify only since the last verified head). Pairs with §6.5.
**→ Defer (fine now; redesign before the chain is long — pre-Phase-19 evidence work).**

**P7 — `audit_log` has no partitioning / archival plan** against a per-read-row × 20-year horizon,
and the immutability guard trigger makes *late* re-partitioning painful. The one moment this is nearly
free is **now, while the table is empty**. Declaratively range-partition by month.
**→ Do now (cheap only while empty; calcifies hard once data + the guard trigger coexist).**

**P8 — `MAX+1` code/number minting under advisory locks.** Confirmed; `mint_capa_code` is the one true
global-lock offender — it serializes **every** tenant on the literal lock key `'pqs:capa_code'` with an
unfiltered `MAX` scan, parses ints out of text codes (one malformed code wedges minting for a whole
hospital), and reuses numbers after deletes. Move to per-scope counter rows or sequences. This overlaps
**D4/H-8** (the `capa_plan` tenant anchor), so fix them together.
**→ Do soon (with D4; `mint_capa_code` first — it's the cross-tenant one).**

**P9 — RLS execution cost.** *Confirmed, first-hand — accurate on all three sub-claims:*
- **`(select auth.uid())` InitPlan caching is applied nowhere** — **0** occurrences across every
  migration. Policies call bare `auth.uid()`, which re-executes per candidate row instead of once per
  query. Wrapping the hot predicates is a documented Supabase win and mechanical.
- **Composite membership indexes are missing.** `commission_members` has *separate* single-column
  indexes on `commission_id` (baseline:19503) and `user_id` (:19507), not the composite
  `(commission_id, user_id)` a membership lookup wants; same for `organization_members` (single-column
  `user_id`/`organization_id`, no `(user_id, role, hospital_id)`) and `pqs_members` (`user_id` only).
- **`audit_log(hospital_id, occurred_at)` is missing** — there is a `(commission_id, occurred_at DESC)`
  index (:19291) but none on `hospital_id`, so the *new* hospital-tier audit rollup (NSP-per-hospital)
  has no usable index. The bigger structural point — RLS invokes non-inlinable `SECURITY DEFINER`
  helpers with per-row column arguments, and the `is_active` fold adds a second `profiles` lookup to
  every membership check — is real but a larger lift than the indexes.
**→ Do now (indexes + `(select auth.uid())` wrap — cheap, high-leverage); Defer the helper-inlining.**

**P10 — Unindexed FK columns on cascade/lookup paths** (`answers.group_instance_id`,
`responses.last_section_id`, `case_phases.result_id`, `commission_members.title_id`, `profiles.home_*`,
several more). Every `DELETE`/`SET NULL` on the parent seq-scans the child. All spot-checked columns
confirmed unindexed. Trivial `CREATE INDEX`es.
**→ Do now (cheap; pairs naturally with the P9 index pass).**

---

## 2. §5 · Data Model & Extensibility — per-finding

The audit's "strengths worth preserving" list (deferrable position uniques, immutability triggers, PHI
isolation, the `action_items` hub, the normalized option/answer model) is fair and matches the code.
The defects:

**C-5 (folded in here — it is structurally a §5 item) — `answers` has no referential integrity to its
form.** Confirmed. `answers` gates only on ownership via RLS; there is no composite FK tying
`(form_version_id, question_key)` to a real item in that version. `save_section_answers` defends
*procedurally*, but **RLS is the boundary** (Rule 1), and the analytics backbone aggregates on
`question_key` across versions — a poisoned or orphaned key silently corrupts every dashboard that
trusts it. Fix: add `form_version_id` to `answers` + a composite unique/FK; keep deriving
`question_key` server-side.
**→ Do now (real integrity gap on the analytics path; the audit rightly rates it Critical).**

**D1 — `ON DELETE SET NULL` × `NOT NULL` shape CHECK = booby-trapped delete.** Confirmed chain:
`capa_plan_source_shape` requires `source_rca_id NOT NULL` while the FK is `SET NULL`, so deleting a
`patient_safety_event` cascades to `rca` → `SET NULL` → CHECK violation → the whole delete aborts with
an opaque error (same for `rca_evidence`). In a module with retention-driven disposal, a
non-deterministic hard-delete failure is a compliance defect. **Mitigation the audit missed:**
`guard_event_status_trg` already blocks raw deletes of triaged/closed/cancelled events — exactly the
ones that have an RCA — so the trap is reachable only through a sanctioned deletion RPC, narrower than
"any delete." Still real. Fix: `RESTRICT`, or add a "detached" state to the CHECK; add a pgTAP test
that *actually deletes*.
**→ Do now (correctness/compliance; cheap; add the deleting test).**

**D2 — Tenant hierarchy desyncs silently.** Confirmed for `commissions`/`hospitals`.
`commissions.organization_id` is derived by a trigger that fires only on `commissions`; there is no
trigger on `hospitals` and no composite FK. `UPDATE hospitals SET organization_id = …` (M&A,
restructuring) via PostgREST — `hospitals_write` has no column lock — leaves every child commission's
`organization_id`, every stamped `audit_log.organization_id`, and every org-scoped RLS predicate
pointing at the *old* org. Fix: `UNIQUE(id, organization_id)` on `hospitals` + composite FK on
`commissions` + a guard trigger. **Reject the `profiles.home_*` extension:** those columns have no
derive trigger, are set once from invite metadata, and are documented "hospital is NOT an access
boundary here" — a different, lesser issue, not "the same treatment."
**→ Do now for commissions/hospitals (composite FK + guard); ✋ skip the `profiles.home_*` part.**

**D3 — FK-bearing data inside jsonb/arrays.** Confirmed all three FK-less: `case_phases.allowed_result_ids
jsonb`, `result_ruleset` result-ids, `blocks integer[]` (a phase-dependency graph keyed on *mutable
sort positions*). Deleting a `phase_results` row leaves dangling UUIDs the DB can't see. Fix: junction
tables — the pattern already exists in-repo (`case_phase_offered_results`). **Correct one sub-claim:**
"a phase reorder silently rewires the dependency graph" is **wrong for the shipped path** —
`reorder_template_phase` atomically remaps `blocks` during the swap and re-validates. The residual risk
is *future other* mutation paths, not the existing reorder.
**→ Do now (normalize to junction tables while the data is disposable); the reorder itself is safe.**

**D4 — `capa_plan` has no tenant anchor + a platform-global code sequence.** Confirmed; this **is** H-8.
Tenancy is derivable only by walking a 3–4-join polymorphic chain, and a `source='manual'` CAPA has
*no* derivable tenant at all; `can_write_capa`'s non-event branch falls back to `is_pqs_member_of_any`
(nsp_per_hospital:673), so a PQS member of hospital A can `PATCH` hospital B's manual CAPA — the blast
radius is the whole non-event CAPA action tree. Add a `NOT NULL hospital_id`; scope both the RLS
predicate and the code/lock (P8) to it.
**→ Do now (this is the one §5 item that is also a live cross-tenant *write* hole — treat as security).**

**D5 — Patient identity triplicated, no patient dimension (→ §6.2).** Confirmed. `event_patient`,
`referral_patient`, `case_patient` are byte-identical; the join key is a trigger-derived `patient_key`
in an FK-less `patient_xref` with no hospital scoping — two hospitals' MRN "12345" collide — and no
MRN merge/alias model. **Corrections that lower the urgency but not the value:** it was a *documented*
decision under a since-stale single-tenant assumption (ADR 0039), and today's shipped RPCs re-filter by
hospital downstream, so it is a **landmine for any future join on `patient_key` alone, not a live
leak**. The §6.2 fix (a hospital-scoped `patients` master + `patient_mrn_alias` + merge lineage, with
the three satellites kept as the access boundary) also hands LGPD Art. 18 erasure a **single**
patient-level entry point instead of three per-entity `dispose_*` functions behind three gates —
pairing directly with C-6. Cheap now (`backfill_patient_keys` exists), expensive after real MRNs are
hashed.
**→ Defer as a scoped structural track (like §6.1) — but schedule it pre-launch; the cost only rises.**

**D6 — Adding an `item_type` needs ≥6 coordinated edits; the input-vs-display CASE returns `NULL`
(→ §6.3).** Confirmed, and the cleanest finding in the audit. `form_items_input_vs_display` ends
`ELSE NULL::boolean` (baseline:18268) and Postgres treats a NULL CHECK result as **satisfied** — so the
day a future migration adds an 11th type to one list and not the other, it passes with *zero* shape
enforcement. Not live today (a twin `item_type_check` whitelists the same 10 values), but the taxonomy
is duplicated across 10–15 SQL sites. §6.3's fix — a `form_item_types(key, is_input, has_options,
value_kind)` lookup that constraints/triggers consult, plus flipping the CASE to `ELSE false` — closes
the silent hole and makes "add a question block on request" a data change, not a six-file migration.
**→ Do now: flip `ELSE NULL` → `ELSE false` (one line, closes the footgun). Defer the full
metadata-driven refactor to a §6.3 track (sequence after D5).**

**D7 — Global vocab is cross-tenant-editable.** Confirmed **only** for `pqs_event_types` /
`pqs_sentinel_criteria`: they are platform-global with globally-unique positions yet CRUD gates on
`is_pqs_member_of_any`, so a PQS member of one hospital renames the sentinel criteria every tenant sees.
**Split off the audit's error:** it folds in `referral_types` / `reply_outcomes`, which are
`is_admin()`-gated (super-admin only) — a much smaller, different concern, not cross-tenant-editable by
a member. Adopt the `action_item_statuses` dual-scope pattern (nullable `hospital_id` + partial uniques)
for the two truly-shared tables before pilot data accumulates.
**→ Do now for the two PQS vocab tables (cheap, pre-data); ✋ the referral vocab is not this bug.**

**D8 — Forward-compat UUID columns with no FK** (`capa_measure.indicator_id`,
`capa_plan.source_indicator_id`/`source_audit_finding_id`). Confirmed they accept arbitrary bytes and
can't be retro-constrained after Phases 15/18 land with garbage present — **but** they are a
*deliberate, self-documented* convention ("FK-LESS forward hook (Phase 15/18)"), not an oversight. The
mitigation is either to drop them until the target tables exist or to exclude those source kinds from
the shape CHECK; low priority given they're inert and labeled.
<br>**→ Optional (deliberate hook; add a guard when Phases 15/18 land, or exclude from the CHECK now).**

**D9 — Lifecycle-state invariants unenforced.** Confirmed: `responses` can be `status='submitted',
submitted_at NULL`; `cases.closed_at` floats free of status; `case_referral` has ~5–7 unconstrained
`*_at`/`*_by` pairs. A dozen one-line CHECKs buy real ALCOA+ "Consistent" credibility.
**→ Do now (a dozen cheap CHECKs; pure upside).**

**D10 — `updated_at` is convention, not mechanism.** Confirmed *worse* than stated: only ~5 tables have
a trigger-maintained `updated_at`, and `cases`, `commissions`, `forms` lack the column entirely — "when
was this last modified" is unanswerable on the central case entity. One generic touch trigger applied
uniformly. Style/quality, not correctness.
**→ Optional (nice-to-have; do it if a touch-trigger sweep is already happening).**

**D11 — Status enums mix Portuguese and English** (`concluida` vs `completed` vs `done`). Confirmed —
but these are **internal keys**, not user-facing text, so it is a naming-consistency nit, **not** the
Rule-10 ("user-facing text pt-BR") violation the audit implies. It does mildly defeat cross-module
rollups.
**→ Optional (harmonize opportunistically; not a Rule-10 breach).**

**D12 — Four polymorphism dialects coexist.** Confirmed, including `case_events.kind='safety_event'`
carrying no FK (so the case timeline is unenforced prose). Phase 16's standards-crosswalk evidence
links would add a fifth. Standardize on the shape-CHECKed column-per-target dialect (the only one the
DB can police) **before** Phase 16 introduces the fifth.
**→ Defer (decide the standard before Phase 16 builds on top of the mess; not urgent pre-pilot).**

---

## 3. Where §4 / §5 overstate or misattribute (correct before acting)

1. **Perf multipliers are estimates, not measurements** — "12–18 session reads/nav", "15–20
   round-trips". Directionally right; but the counted feature-flag RPCs run **concurrently**
   (`Promise.all`, ≈1 round trip), so the latency framing overstates. The *payload* and *repeated
   invocation* costs are the real targets.
2. **"Phase reorder silently rewires the dependency graph" (D3) — wrong for the shipped path.**
   `reorder_template_phase` remaps `blocks` atomically and re-validates. The FK-less array is still a
   footgun for future mutation paths; the existing reorder is not.
3. **`profiles.home_*` "same treatment" as the tenant desync (D2) — reject.** Descriptive-only columns,
   no derive trigger, explicitly "NOT an access boundary." Different, lesser issue.
4. **"Global vocab cross-tenant-editable" (D7) folds in super-admin-gated tables.** `referral_types` /
   `reply_outcomes` are `is_admin()`-gated; only `pqs_event_types` / `pqs_sentinel_criteria` are
   member-editable-cross-tenant. Split them.
5. **Forward-compat UUID-no-FK columns (D8) are deliberate + self-documented**, not an oversight — the
   remediation is a guard when the target tables land, not "someone forgot a FK."
6. **Status-enum pt/en mixing (D11) is not a Rule-10 violation** — internal keys, not user-facing text.

None of these voids §4/§5's thesis. But a reader who treats every High as an equal, live,
correctly-described emergency will misallocate effort — reachability, scale, and accuracy vary
item-to-item.

---

## 4. Comparison table — suggestion vs. current platform vs. recommendation

Recommendation vocabulary: **Do now** = cheap *and* (correctness OR calcifies-under-data); pre-pilot.
**Do soon** = real at scale, pilot-window, not a blocker. **Defer** = sound, phase-sized, post-pilot.
**Optional** = style / low-urgency nicety. **✋ Nuance** = the claim as stated is wrong or over-broad —
do only the true part.

### §4 · Efficiency & Performance

| # | Audit suggestion | What the platform has today | Recommend? |
|---|---|---|---|
| P1 | `React.cache()` the session bundle | `getSessionContext` uncached (`session.ts:123`); its 2 siblings already cached (:345/:444) | **Do now** — one line, own precedent |
| P2 | Filter dropdowns via view/RPC, not full-scan `DISTINCT` in JS | `listAuditFilterActors` pulls every in-scope `audit_log` row into a `Map` (`audit.ts:596`) | **Do soon** — scan grows with a 20-yr append-only table |
| P3 | Keyset pagination on unbounded reads | `listSubmissions`/`listCasesBoard`/`listMeetings`/`listCommissionReferrals`/`pqsInbox` unpaginated (audit list *is* paginated) | **Do soon** — bounded per commission/hospital; `listSubmissions` first |
| P4 | `count/head` badges + one cached `get_feature_flags()` | Layout ships full rows to `.length`; flags via N RPCs (but concurrent) | **Optional** — real payload win; round-trip claim overstated |
| P5 | Push form filter to the DB | `listSubmissions` filters `form_id` in JS on a wrong "not filterable" comment (`:253`) | **Optional** — `.eq('form_versions.form_id',…)` works with the `!inner` embed |
| P6 | Incremental/checkpointed `verify_audit_chain` | O(n) per-row SHA-256, unpaginated, single-txn | **Defer** — fine at demo scale; redesign pre-Phase-19 |
| P7 | Range-partition `audit_log` by month | No partitioning; guard trigger makes late re-partition painful | **Do now** — nearly free *only* while the table is empty |
| P8 | Per-scope counters/sequences for code minting | `mint_capa_code` serializes every tenant on one global lock; `MAX+1` regex int-parse | **Do soon** — with D4; `mint_capa_code` is the cross-tenant offender |
| P9 | `(select auth.uid())` + composite membership indexes + `audit_log(hospital_id,…)` | 0 `(select auth.uid())` anywhere; only single-column membership indexes; no hospital-tier audit index | **Do now** — indexes + wrap are cheap/high-leverage; defer helper-inlining |
| P10 | Index FK columns on cascade/lookup paths | `answers.group_instance_id`, `responses.last_section_id`, `case_phases.result_id`, `commission_members.title_id`, … unindexed | **Do now** — trivial; pair with the P9 index pass |

### §5 · Data Model & Extensibility

| # | Audit suggestion | What the platform has today | Recommend? |
|---|---|---|---|
| C-5 | `form_version_id` + composite FK on `answers` | RLS gates only on ownership; no FK tying `(version, question_key)` to a real item | **Do now** — integrity gap on the analytics backbone (rightly Critical) |
| D1 | `RESTRICT`/detached-state for `SET NULL` × `NOT NULL` CHECK | `capa_plan_source_shape`/`rca_evidence` abort deletes opaquely (mitigated: `guard_event_status_trg` blocks raw event deletes) | **Do now** — correctness/compliance; add a *deleting* pgTAP test |
| D2 | Composite FK + guard on the tenant hierarchy | Derive trigger on `commissions` only; none on `hospitals`; `UPDATE hospitals.organization_id` desyncs children | **Do now** for commissions/hospitals · **✋** skip `profiles.home_*` |
| D3 | Junction tables for FK data in jsonb/arrays | `allowed_result_ids jsonb`, `result_ruleset`, `blocks integer[]` FK-less (pattern `case_phase_offered_results` exists) | **Do now** · **✋** "reorder rewires graph" is wrong (`reorder_template_phase` remaps atomically) |
| D4 | `hospital_id` on `capa_plan` + scoped code/lock | No tenant anchor; `can_write_capa` non-event = `is_pqs_member_of_any` → cross-hospital manual-CAPA write (= H-8) | **Do now** — this one is a live cross-tenant *write* hole; treat as security |
| D5 | Hospital-scoped patient master (§6.2) | `event/referral/case_patient` byte-identical; `patient_key` unscoped → MRN collisions; no merge model (landmine, not live leak; ADR 0039) | **Defer** as a scoped track — but schedule pre-launch; also fixes LGPD single-door (C-6) |
| D6 | Metadata-driven item types + `ELSE false` (§6.3) | `form_items_input_vs_display` ends `ELSE NULL` (passes) (baseline:18268); taxonomy duplicated 10–15 sites | **Do now** the `ELSE false` flip · **Defer** the full lookup refactor |
| D7 | Dual-scope (nullable `hospital_id` + partial unique) for global vocab | `pqs_event_types`/`pqs_sentinel_criteria` member-editable cross-tenant | **Do now** for those two · **✋** `referral_types`/`reply_outcomes` are super-admin-gated, not this bug |
| D8 | Drop/guard forward-compat UUID-no-FK columns | `capa_measure.indicator_id`, `capa_plan.source_*` accept arbitrary bytes — but deliberate, self-documented | **Optional** — guard when Phases 15/18 land, or exclude from the CHECK |
| D9 | Lifecycle-state CHECKs | `submitted`+`submitted_at NULL` possible; `cases.closed_at` free; `case_referral` `_at`/`_by` unpaired | **Do now** — a dozen one-line CHECKs, pure upside |
| D10 | Uniform `updated_at` touch trigger | Only ~5 tables have one; `cases`/`commissions`/`forms` lack the column | **Optional** — quality nicety, not correctness |
| D11 | Harmonize status enums to English | `concluida`/`completed`/`done` mixed — but internal keys, not UI text | **Optional** — **✋** not the Rule-10 breach implied |
| D12 | Standardize on one (shape-CHECKed) polymorphism dialect | Four dialects; `case_events.kind='safety_event'` no FK; Phase 16 would add a fifth | **Defer** — settle the standard *before* Phase 16 builds on it |

---

## 5. Sequenced recommendation (what to actually do, in order)

1. **Fold into the pre-pilot hardening pass (all cheap, mostly one-liners):** C-5 (`answers` FK), D1
   (delete `RESTRICT` + deleting test), D2 (commissions/hospitals composite FK + guard), D4/H-8
   (`capa_plan.hospital_id` + scoped `can_write_capa` + scoped code/lock — this is the one with a live
   write hole), D6 (`ELSE NULL`→`ELSE false`), D7 (dual-scope the two PQS vocab tables), D9 (lifecycle
   CHECKs), P1 (`React.cache`), P7 (range-partition `audit_log` **while empty**), P9+P10 (composite +
   FK indexes and `(select auth.uid())` wrap). Do these alongside the **membership write-path
   lockdown** already planned (`../plans/membership-write-path-lockdown.md`) — same migration window,
   same gate.
2. **Pilot-window perf sweep (real at scale, not blockers):** P2 (audit-actor `DISTINCT` → view/RPC),
   P3 (keyset pagination, `listSubmissions` first), P8 (per-scope CAPA counter with D4), plus the P4/P5
   payload trims if convenient.
3. **Next structural track after the membership lockdown:** D5/§6.2 (hospital-scoped patient master —
   scope it a like the §6.1 plan; it also gives C-6 a single LGPD erasure door) and D6/§6.3 (the full
   metadata-driven item-type lookup). Both are cheapest now and only get more expensive with real data.
4. **Before Phase 16:** D12 (pick the polymorphism standard) and P6 (checkpointed `verify_audit_chain`,
   with the §6.5 evidence work).
5. **Opportunistic / optional:** D8, D10, D11, P4, P5 — do them when an adjacent sweep is already open;
   none are worth a dedicated migration.

**Bottom line:** §4 buys latency and headroom, not safety — take the cheap correctness-adjacent wins
now (P1, P7, P9, P10) and schedule the rest. §5 is where the real structural debt is; its two
correctness defects (D1, D2), its one live write hole (D4/H-8), and the integrity Critical (C-5) all
belong in the pre-pilot pass, and its two strategic refactors (patient master, metadata item types) are
the natural successors to the membership lockdown — all four cheapest under today's reset-OK posture.
