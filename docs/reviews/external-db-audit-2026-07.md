# External Database Audit — Hospital Commission Forms Platform

**Prepared for:** Platform owner / engineering lead
**Date:** 2026-07-04
**Scope:** Full data layer — schema & data model, permission model (RLS), stored procedures / RPCs / triggers, TypeScript data-access layer, and PHI handling + audit trail.
**Sources reviewed:** `supabase/migrations/20260620000000_baseline.sql` (25,132 lines) + 19 follow-up migrations; `ARCHITECTURE.md`; `src/lib/queries/**` (~37 modules), `src/lib/supabase/**`, middleware; ADRs 0029–0052; pgTAP suites.
**Engagement note:** The client requested an *unforgiving* review. This document is written to that brief. The platform is pre-launch with no production data, so schema resets are cheap now and expensive after the first pilot hospital — that framing drives the prioritization.

---

## 1. Executive summary

This is, bluntly, **well-built engineering sitting on a few structural fault lines that will not survive contact with a real hospital.** The team clearly understands the failure modes of Postgres/Supabase: RLS is enforced as the security boundary (not UI hiding), `search_path` is pinned on 449 of 450 functions, every `set_config` uses `is_local=true` (the property that makes the session-variable trigger-gating non-spoofable), PHI tables have direct DML revoked and are served through audited `SECURITY DEFINER` doors, the audit trail is hash-chained, and the data-access layer genuinely routes everything through `src/lib/queries` with minimal, fenced service-role use. The ADR trail is candid and thorough. For a platform at this stage, the *ceiling* of the work is high.

The problems cluster into five themes:

1. **The PHI perimeter is larger than the PHI controls.** The isolated identifier tables are guarded well, but the *free text and uploaded documents that contain the same patient identity* — form answers, interview transcripts, meeting minutes, and above all Storage objects (scanned discharge summaries live in a member-readable, unaudited, non-disposable bucket) — sit inside the perimeter and outside the posture. "We erased the patient" (LGPD Art. 18) is a statement the platform's own disposal functions cannot truthfully make.

2. **The permission model's PHI gate is a set of directly-writable membership tables.** Because roster membership *is* PHI access, and those tables are writable under permissive RLS, an `org_admin` can self-appoint as `nsp_coordinator` and an `nsp_org_admin` (documented as "ZERO PHI") can self-enroll into any hospital's PQS roster — each a single `INSERT` to full patient-data access, and none of those grants are audited.

3. **The audit trail — the headline accreditation feature — has three holes that undermine its "tamper-evident" claim:** `audit_log` carries `GRANT ALL TO authenticated` (a raw SQL channel can `TRUNCATE` it; the immutability trigger doesn't fire on TRUNCATE), `log_audit_access` is callable by any user with fully caller-controlled arguments (forgeable read-audit rows), and chain-tail truncation is undetectable with no external anchor.

4. **Several integrity invariants are convention, not mechanism.** `answers` accepts arbitrary `item_id`/`question_key` (the analytics backbone is not FK-protected), FK-bearing data is stored inside jsonb/`integer[]` columns (result-rulesets, phase-dependency graphs), and `ON DELETE SET NULL` collides with NOT-NULL shape CHECKs to create delete paths that abort non-deterministically.

5. **The runtime economics assume a small pilot forever.** No request-level memoization of the session bundle, no pagination on anything that grows, full-table scans to build filter dropdowns, and ~15–20 DB round-trips per commission-page navigation.

**Verdict on the three questions posed:**

- **Inefficiencies:** Real and numerous, but nearly all are cheap to fix and none are architectural dead-ends. The data-access layer is the worst offender (per-navigation round-trip explosion); the SQL layer's inefficiencies are mostly latent (unpaginated RPCs, O(n) chain verification) rather than acute.
- **Are permissions adequate?** **The read path is strong; the write/grant path is not.** For a platform whose entire PHI posture rests on "roster enrollment = PHI access," self-enrollment and unaudited enrollment must be impossible, and today neither is. This is the single most important area to fix before pilot.
- **Flexibility for future expansion:** The form builder and action-item hub are well-modeled and extensible. But four different "polymorphic association" dialects coexist, patient identity has no master record, and adding a new form question-type requires coordinated edits in six hardwired places. These are addressable now and will calcify after launch.

A count of the consolidated findings: **6 Critical, 14 High, ~20 Medium, ~15 Low.** Several were independently identified by two or three of the five audit workstreams — those are flagged `[convergent]` and should be treated as high-confidence.

---

## 2. Must-fix before pilot (the critical set)

These are ordered by a blend of severity and how much cheaper they are to fix pre-launch.

### C-1 · `audit_log` is destructible by any authenticated SQL channel `[convergent: RPC, PHI]`
`GRANT ALL ON public.audit_log TO authenticated` (baseline:24779) includes `TRUNCATE`, which RLS does not restrict and the `BEFORE DELETE OR UPDATE` immutability trigger (baseline:19923) does not fire on. A single `TRUNCATE public.audit_log` erases the entire hash-chained tamper-evidence backbone. Not reachable through PostgREST today (it doesn't expose TRUNCATE), but reachable by anything holding a raw `authenticated` connection, and it is the wrong default under a DROP+recreate RPC strategy.
**Fix:** `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated` (INSERT flows through the DEFINER `audit_write`, so `authenticated` needs no direct DML); add a `BEFORE TRUNCATE … FOR EACH STATEMENT` guard. Then fix the systemic root (C-2).

### C-2 · Default privileges grant `ALL` on every new table/function to `authenticated` `[convergent: RLS, RPC]`
The hardening block revokes anon and PUBLIC but leaves Supabase's default `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES/FUNCTIONS TO authenticated` in force (baseline:24944–24946). Any table a future migration creates is **SELECT-able by every logged-in user until someone remembers `ENABLE ROW LEVEL SECURITY`** — this is the systemic root of the `case_referral` 42501 incidents and of C-1. One forgotten line on a future PHI table = full exposure.
**Fix:** `ALTER DEFAULT PRIVILEGES … REVOKE ALL ON TABLES FROM authenticated` and `REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/authenticated`; grant explicitly per object. This also removes the grant-reset hazard from the DROP+recreate RPC versioning pattern (recreated functions become private-by-default instead of silently PUBLIC-executable).

### C-3 · Privilege self-escalation into PHI via directly-writable membership tables `[convergent: RLS]`
Two one-`INSERT` paths to full patient data, both defeating explicitly documented guarantees:
- `organization_members_write` is `FOR ALL USING/CHECK (is_admin() OR is_org_admin_of(org))` (baseline:21839). `nsp_coordinator` has **no appointment RPC** — it's created by writing the table. An `org_admin` can `INSERT (org, auth.uid(), 'nsp_coordinator', hospital_id)`, and `is_nsp_coordinator_of → is_pqs_operator_of` grants PHI read on every event/referral/CAPA in that hospital. Defeats the documented "org_admin is NOT a clinical actor" duty separation.
- `pqs_members_curator_all WITH CHECK (is_nsp_org_admin_of(...) OR is_nsp_coordinator_of(...))` (20260710:1175) has no self-exclusion. An `nsp_org_admin` — asserted and pgTAP-"proven" to grant ZERO PHI — can `INSERT (hospital, auth.uid())` into `pqs_members` and become a PHI operator.
**Fix:** Remove direct `INSERT/UPDATE` on `organization_members` and `pqs_members` from `authenticated`; route every grant through `SECURITY DEFINER` RPCs with a no-self-delegation guard (the pattern already exists in `assign_hospital_admin`). See the structural recommendation in §6.1.

### C-4 · `log_audit_access` lets any user forge read-audit rows `[convergent: RLS, RPC, PHI]`
`GRANT … log_audit_access … TO authenticated` (baseline:23952); the function validates only that the *action* is allow-listed, then writes `audit_write` with caller-supplied entity id, commission, summary, and metadata. Any authenticated user can append chain-valid but fictitious "who read what" rows into another commission's append-only chain — rows that pass `verify_audit_chain`, land in surveyor exports and `patient_access_audit`, and are unremovable by design (audit-noise DoS + evidentiary pollution).
**Fix:** Emit read-audit only from inside the DEFINER doors (which already do this for the RPC path); either revoke the public wrapper from `authenticated` or make it derive `commission`/`entity_id` from a verified lookup and gate on the caller's entitlement to the referenced entity.

### C-5 · `answers` has no referential integrity to its form — the analytics backbone is poisonable `[convergent: schema]`
`answers.question_key` is denormalized text (baseline:17892); the write policy gates only on response ownership; nothing verifies `item_id` belongs to the response's `form_version_id` or that `question_key` matches `form_items.question_key` (the FK is bare `NO ACTION`). Any draft owner can insert answers referencing another commission's form item with an arbitrary `question_key`. Dashboards aggregate by `question_key` — this is a cross-tenant reference hole and an ALCOA+ accuracy defect (a buggy client silently forks a metric).
**Fix (cheap now):** add `form_version_id` to `answers`; `UNIQUE(id, form_version_id)` on `form_items` + composite FK `(item_id, form_version_id)`; trigger tying it to `responses.form_version_id`; derive `question_key` server-side instead of trusting the writer.

### C-6 · PHI disposal is materially incomplete — erasure is a false claim `[convergent: PHI, schema]`
`dispose_case_phi` touches only `case_patient`, `case_narratives.body_md`, `case_events.body`. It does **not** touch: (1) **form answers** — case phases link responses whose `answers.value` free-text routinely narrates the patient, and `answers` is not even PHI-classified (`confidentiality_level` is "RESERVED + unenforced"); (2) **case interview** `summary_md`/subject `note` (COMMENT-classified PHI, no dispose reference); (3) **meeting minutes** (no disposal path exists for meetings at all); (4) **`cases.label`** (the field users are warned not to put names in — `dispose_referral_phi` redacts the analogous `subject`, but the case path doesn't); (5) **Storage objects** (see H-1). An LGPD Art. 18 request answered with `dispose_*` leaves the patient's narrative fully recoverable.
**Fix:** Extend each dispose function to the full classified-PHI closure of its entity graph (case → interviews, phase-response answers, documents, label; event → nsp-evidence objects), or formally and visibly scope the erasure claim. Pairs with the patient-master recommendation (§6.2) which gives erasure a single entry point.

---

## 3. Permission model — adequacy assessment

**Architecture (as built).** A clean conceptual layering — platform admin ⊃ org ⊃ hospital ⊃ commission, with an *orthogonal* NSP/PHI plane (per-hospital `pqs_members` + `nsp_coordinator`) and a *per-case involvement* plane (`case_access` + phase/narrative assignment). ~30 `app.*` `SECURITY DEFINER STABLE` predicates express it. PHI reads funnel through revoked-SELECT tables + audited DEFINER doors + per-column grants on `case_referral`. This is a sound design and, on the **read path**, adequate for the stated goals (strict minimum-necessary except the PSQ macro-view; involvement-based case access; platform admin explicitly non-clinical).

**Where it is inadequate:**

- **The write/grant path defeats the read path (C-3, C-4).** The whole PHI posture rests on roster membership, but roster tables are directly writable and self-enrollment is possible. Must-fix.
- **Role-grant changes are largely unaudited (H-6).** `trg_audit_hospital_admin_grant` fires only for `role='hospital_admin'` and only on INSERT/DELETE — no UPDATE arm, and no audit for `org_admin`/`nsp_org_admin`/`nsp_coordinator` grants or `pqs_members` roster changes. Forensic reconstruction of "who granted PHI access, when" is impossible — the exact question an accreditation body or a breach investigation asks.
- **`FOR ALL` policies over-govern (H-7).** `organization_members_write` and `commission_members_staff_admin_update` let a privileged writer UPDATE `role`/`hospital_id`/`user_id` with no column pinning and no self-delegation guard.
- **Cross-hospital write leak (H-8).** `can_write_capa`'s non-event branch returns `is_pqs_member_of_any`, so a PQS member of hospital A can write a non-event CAPA belonging to hospital B.
- **Platform admin has no kill-switch (M).** `is_active()` is deliberately not folded into `is_admin()`, and `is_admin()` trusts the JWT claim first — a deactivated or demoted admin keeps full power until token expiry.
- **PHI erasure authority is inconsistent and includes the vendor (H).** The three `dispose_*` functions use three different authorization models; `dispose_referral_phi` reintroduces `is_admin()` (the platform vendor) as a unilateral eraser of a tenant's clinical PHI — precisely the tenant-boundary violation other paths are careful to exclude.

**Complexity verdict.** The model is **over-complex for its size**: seven role concepts across three membership tables, reconciled by ~30 predicates (with drifted duplicates — `is_pqs_writer_of` is a bare alias, `is_pqs_member_of_any` silently changed meaning at the per-hospital re-key) and a migration that rewrites ~145 policies/functions via live-catalog string `replace()`. It is conceptually clean but operationally fragile, and the fragility has already produced incidents (the `case_referral` column-grant 42501s). The structural recommendation in §6.1 (a single `memberships` table + one audited `grant_role()` door + one `has_role()` predicate family) would make C-3, C-4, H-6, and H-7 *structurally impossible* rather than individually patched, and collapse the predicate sprawl.

---

## 4. Efficiency & performance

**Data-access layer (the acute problems, all cheap):**
- **H — No request memoization of the session bundle.** `getSessionContext()` (5 DB queries) is not wrapped in `React.cache()` and runs 12–18 times per navigation across layout resolvers, query helpers, and actions. Wrapping it is a ~10× cut on the hottest path; the two access resolvers already set the precedent.
- **H — Unbounded full-table pulls to compute DISTINCT filter options in JS.** `listAuditFilterActors` selects every audit-log row in scope (append-only, 20-yr retention) to dedupe actor names in a Map; same for submission filter dropdowns. These are `SELECT DISTINCT` jobs that should be views/RPCs.
- **H — No pagination on growth-unbounded reads** `[convergent: query, RPC]`: `listSubmissions`, `listCasesBoard`, `listMeetings`, `listCommissionReferrals`, `pqsInbox` return every row forever. Add keyset pagination now, before contracts freeze.
- **M — Commission layout burns ~15–20 round-trips per page** fetching full datasets to render count badges (`listCasesBoard(...).filter().length`) and firing 7 uncached feature-flag RPCs. Replace with `count: 'exact', head: true` or a single `sidebar_counts()` RPC, and consolidate flags into one cached `get_feature_flags()`.
- **M — Client-side work the DB should do:** `listSubmissions` filters by form in JS after fetching everything (the "not filterable inline" comment is incorrect — `.eq('form_versions.form_id', …)` works with the existing `!inner` embed); count aggregations done by shipping row-per-unit payloads.

**SQL layer (mostly latent):**
- **M — `verify_audit_chain` is O(n) per chain** with a per-row SHA-256 recompute, unpaginated, single-transaction. Fine at demo scale; minutes of CPU holding a snapshot on a mature chain. Needs incremental/checkpointed verification.
- **M — `audit_log` has no partitioning or archival plan** against a per-read-row × 20-year horizon; the guard trigger will make late re-partitioning painful. Declaratively range-partition by month **now**.
- **M — Number/code minting is `MAX+1` under advisory locks** `[convergent: schema, RPC]`: serializes per scope, rescans an aggregate, parses ints out of text with regexes (one malformed code breaks minting for the whole hospital), reuses numbers after deletes, and `mint_capa_code` serializes **every tenant** on one global lock. Move to per-scope counter rows or sequences.
- **RLS perf:** policies invoke non-inlinable `SECURITY DEFINER` helpers with row-column arguments (once per candidate row, each 1–4 subqueries), the `is_active` fold adds a second `profiles` lookup to every membership check, and Supabase's `(select auth.uid())` InitPlan-caching optimization is applied nowhere. Add composite indexes for the hot membership predicates (`commission_members(commission_id, user_id)`, `organization_members(user_id, role, hospital_id)`) and an `audit_log(hospital_id, occurred_at DESC)` index (the hospital-tier rollup currently has no usable index).
- **L — Unindexed FK columns on cascade/lookup paths** (`answers.group_instance_id`, `responses.last_section_id`, `case_phases.result_id`, `commission_members.title_id`, `profiles.home_*`, several more): every DELETE/SET NULL on the parent seq-scans the child.

---

## 5. Data model & extensibility

**Strengths worth preserving:** deferrable position uniques, immutability/guard triggers, deliberate PHI isolation, the append-only action-item hub (`action_items` + status lookup with `category`/`is_terminal` + multi-role assignments + append-only history — the best-modeled lifecycle in the schema), and the normalized form-option/answer model.

**Structural defects (cheap now, expensive post-launch):**

- **H — `ON DELETE SET NULL` × NOT-NULL shape CHECK = booby-trapped deletes (C-adjacent).** `capa_plan_source_shape` requires `source_rca_id NOT NULL` while the FK is `SET NULL`; deleting a `patient_safety_event` cascades to `rca` → SET NULL → CHECK violation → the whole delete aborts with an opaque error. Same for `rca_evidence` citations. In a module with retention-driven disposal, non-deterministic hard-delete failures are a compliance defect. Fix: `RESTRICT`, or add a "detached" state to the CHECK; add pgTAP that actually deletes.
- **H — Tenant hierarchy desyncs silently `[convergent: schema, PHI]`.** `commissions` carries both `hospital_id` and derived `organization_id`, but the derive trigger fires only on `commissions` — there is no trigger on `hospitals` and no composite FK. `UPDATE hospitals SET organization_id = …` (M&A, restructuring) leaves every child commission's `organization_id`, every stamped `audit_log.organization_id`, and every org-scoped RLS predicate pointing at the old org. Fix: `UNIQUE(id, organization_id)` on `hospitals` + composite FK on `commissions` + a guard trigger; same treatment for `profiles.home_*`.
- **H — FK-bearing data inside jsonb/arrays.** `case_phases.allowed_result_ids jsonb`, `result_ruleset` result-ids, and `blocks integer[]` (a phase-dependency graph keyed on *mutable sort positions*) hold what should be foreign keys. Deleting a `phase_results` row leaves dangling UUIDs the DB can't see; a phase reorder silently rewires the dependency graph. Fix: junction tables (you already built `case_phase_offered_results` — use the same pattern).
- **H — `capa_plan` has no tenant anchor + a platform-global code sequence `[convergent: schema, RPC]`.** Tenancy is derivable only by walking a 3–4 join polymorphic chain (and a `source='manual'` CAPA has *no* derivable tenant); every hospital serializes on one lock; `CAPA-####` numbering leaks cross-tenant volume. Add a NOT NULL `hospital_id`, scope the code + lock per hospital.
- **H — Patient identity is triplicated with no patient dimension `[convergent: schema, PHI]`.** `event_patient`, `referral_patient`, `case_patient` are byte-identical; the join key is a trigger-derived `patient_key` in an FK-less `patient_xref` with no hospital scoping (two hospitals' MRN "12345" collide) and no MRN merge/alias model (a hospital chart merge silently and permanently splits the trajectory — a clinical-risk defect for a patient-safety tool). See §6.2.
- **H — Adding a form `item_type` requires coordinated edits in ≥6 hardwired places**, and the input-vs-display CASE returns `NULL` (i.e., *passes*) for any unlisted type — a silent validation hole. Roadmap block types (grid/matrix, file-upload answers, calculated fields, labeled scales) have no landing zone; `answers` has no attachment satellite; `config jsonb` is an unconstrained catch-all. See §6.3.
- **M — Global vocab is cross-tenant-editable `[convergent: schema, RPC]`.** `pqs_event_types`, `pqs_sentinel_criteria`, `referral_types`, `reply_outcomes` are platform-global with globally-unique positions, yet CRUD gates on `is_pqs_member_of_any` — a PQS member of one hospital renames the sentinel-criteria every tenant sees. Adopt the `action_item_statuses` dual-scope pattern (nullable `hospital_id` + partial uniques) before pilot data accumulates.
- **M — Forward-compat UUID columns with no FK** (`capa_measure.indicator_id`, `capa_plan.source_indicator_id/source_audit_finding_id`) accept random bytes today and can't be retro-constrained after Phases 15/18 land with garbage present. Drop them until the target tables exist, or exclude those source kinds from the CHECK.
- **M — Lifecycle-state invariants are unenforced.** `responses` can be `status='submitted', submitted_at NULL`; `cases.closed_at` floats free of status; `case_referral` has seven such `*_at`/`*_by` pairs with none paired to state. A dozen one-line CHECKs buys real ALCOA+ credibility.
- **M — `updated_at` is convention, not mechanism**, and `cases` has none at all — "when was this last modified" is unreliable on most tables and unanswerable on the central case entity. Apply one generic touch trigger uniformly.
- **M — Status enums mix Portuguese and English arbitrarily** across modules (`concluida` vs `completed` vs `done`), defeating cross-module rollups and violating the project's own "code in English" rule.

**Four polymorphism dialects coexist** — shape-CHECKed column-per-target (`capa_plan`, `rca_evidence`), text-discriminator with no FK (`patient_xref`, `audit_log`, and `case_events` whose `kind='safety_event'` carries no FK, making the case timeline unenforced prose), frozen-snapshot (`referral_shared_item`), and kind+nullable-FK. Phase 16's standards-crosswalk evidence links will be a *fifth*. Standardize on the shape-CHECKed column-per-target dialect (the only one the DB can police) before then.

---

## 6. Strategic recommendations (structural)

These are the higher-effort changes that pay off most as the platform matures beyond hospital committees. All are far cheaper under the current "reset OK, no live data" posture.

### 6.1 Collapse the role stack into one audited `memberships` table
Replace `organization_members` + `commission_members` + `pqs_members` (+ the ad-hoc `case_access`) role-carrying rows with a single `memberships(id, principal_id, scope_type, scope_id, role, granted_by, granted_at, expires_at)`. Make it writable **only** through one `SECURITY DEFINER grant_role()` / `revoke_role()` RPC that (a) checks the grantor's authority, (b) forbids self-delegation, and (c) emits an audit row — every time, in one place. Expose one `has_role(scope_type, scope_id, role)` predicate family. This makes C-3, C-4, H-6, H-7 structurally impossible, collapses ~30 drifted predicates, and gives the RLS planner one indexable shape instead of five. The PHI doors and per-case involvement plane sit unchanged on top. *If a full refactor is too much pre-pilot, the minimum viable version is: revoke direct INSERT/UPDATE on the two membership tables, funnel grants through guarded DEFINER RPCs, and add a blanket membership-audit trigger.*

### 6.2 Introduce a hospital-scoped patient master
Add `patients(id, hospital_id, canonical demographics)` + `patient_mrn_alias(patient_id, mrn, active)` + a merge-lineage table. Keep the three PHI satellites as the *access boundary*, but have them optionally FK the master. This fixes, in one structure: demographics correction propagation (today a wrong DOB must be re-entered per entity by different role sets, producing contradictory records a surveyor will find), MRN-merge trajectory splits, cross-hospital `patient_key` collisions (namespace the HMAC by `hospital_id`), and — critically — it gives LGPD Art. 18 erasure a **single patient-level entry point** instead of three per-entity dispose functions behind three different authorization gates. Matching should be deterministic-first with a *human-confirmed* review queue (never auto-link — preserve the existing false-join aversion, but replace "permanent silent split" with "reconciliation surface").

### 6.3 Metadata-drive the form builder
Move the item-type list out of six hardwired CHECK/CASE/trigger/evaluator sites into a `form_item_types(key, is_input, has_options, value_kind)` lookup that constraints and triggers consult; make the input-vs-display CASE `ELSE false` (close the silent hole). Design the `answer_attachments` satellite now (Storage immutability, Rule 6, will shape it) so file-upload questions have a home. This is what makes "add a new question block when a committee requests it" a data change instead of a six-file migration — a core stated requirement.

### 6.4 Storage parity for PHI
The richest PHI in the system (scanned discharge summaries, audio recordings) has the *weakest* controls: `case-documents`/`interview-attachments` are member-readable, no download is audited (the DEFINER doors return only the path; bucket RLS authorizes the actual GET, and `get_referral_detail` hands `frozen_storage_path` even to metadata-only readers), and disposal never deletes an object. Route PHI-bucket downloads through short-lived signed URLs minted by an audited door; tighten bucket SELECT to the PHI predicates; add object deletion to every dispose function; stop returning storage paths to non-PHI readers.

### 6.5 Harden the audit trail into real evidence
Beyond C-1/C-4: add off-platform WORM checkpointing of each chain head (defeats tail-truncation, which is currently undetectable), a scheduled `verify_audit_chain` with alerting, monthly partitioning, and — as the Phase 19 anchor — a signed, chain-verified **surveyor export bundle** (`audit.exported` is an allow-listed verb with no implementation behind it today). A chain only verifiable by calling a Postgres function is not evidence a surveyor can hold.

---

## 7. Feature opportunities (healthcare-domain value-add)

Offered as an EHR-adjacent practitioner, not as defects:

1. **Break-the-glass + purpose-of-use.** Mature health-data systems pair tight defaults with an *audited, reason-captured* override. Today denial is a silent NULL and there is no override path, so a clinician who legitimately needs identifiers after a custody hand-off will work around it off-platform (phone, screenshot) — unaudited. Add an optional `p_purpose` to the PHI doors (stored in audit metadata) and a break-the-glass door (wider predicate + mandatory free-text reason + high-visibility audit verb + automatic QPS notification).
2. **Periodic access-review program.** The audit data exists but nothing produces "PHI reads by user this month," "reads outside the reader's commissions," or "top readers per patient." HIPAA §164.308(a)(1)(ii)(D) and LGPD accountability expect *routine* review, not just forensic capability. A monthly QPS/hospital-admin report with sign-off (itself audited) closes this — and `patient_access_audit` is itself currently unaudited, an asymmetry a workplace-privacy review will flag.
3. **Legal-hold + consent/legal-basis registry.** No hold flag blocks disposal (an event under active RCA can have its root-cause text redacted mid-analysis), and the `retention_expired` enum value has no clock computing it. Record the LGPD legal basis per PHI module (tutela da saúde), a hold flag, and a retention sweep.
4. **De-identification as an alternative to redaction.** `dispose_event_phi` destroys RCA analytic content (`'[PHI removido]'` in root-cause text). A de-identify option (strip identifiers, keep the clinical lesson) serves both LGPD minimization *and* the ONA/JCI organizational-learning expectation better than sentinel-string erasure.
5. **Calendar/scheduling substrate for Phases 10/11/21.** `meetings`/`case_interviews` have start/end timestamps only — no recurrence rule, no room/resource entity, no double-booking exclusion (`btree_gist` unused). Meeting-cadence (Phase 21) has zero substrate. Budget a `schedules`/`occurrences` pair rather than columns on `meetings`.
6. **Converge CAPA actions onto the action-item hub.** `capa_action` uses a hardcoded pt-BR status CHECK and a single assignee while the hub has a proper status lookup + multi-role assignments + append-only history. Two lifecycle models for the same concept "action" is avoidable duplication.
7. **Honest trajectory labeling.** The PSQ macro-view indexes only the three satellites where an MRN was typed correctly — interviews, minutes, form answers, uploaded documents, and all name-only rows are invisible. Label the UI "registros indexados por prontuário" and, longer-term, let a case's interviews/documents inherit the case's xref membership.

---

## 8. Prioritized remediation roadmap

**Before pilot (blocking the accreditation/PHI story):**
1. C-1, C-2 — lock down `audit_log` DML + fix the default-privilege posture (also removes the RPC grant-reset hazard).
2. C-3 — funnel all role grants through guarded DEFINER RPCs; revoke direct membership-table writes; blanket membership audit (H-6).
3. C-4 — de-fang `log_audit_access`.
4. C-6 + §6.4 — complete PHI disposal across free-text, answers, and Storage; tighten PHI bucket policies.
5. C-5 — FK-protect `answers`/`question_key`.

**Before pilot (cheap correctness/integrity, one migration each):**
6. Delete-path booby traps (SET NULL × shape CHECK); tenant-hierarchy composite FKs + guard triggers; jsonb/array → junction tables; `capa_plan` tenancy + per-scope code; global-vocab scoping; lifecycle CHECK invariants; unordered `row_number() OVER ()` reorders → `WITH ORDINALITY`; unlocked double-clone race.

**Before pilot (performance, contracts freeze after launch):**
7. `React.cache()` the session bundle; pagination on all growth-unbounded reads; sidebar counts as `head:true`/one RPC; consolidated cached feature-flags; composite indexes for RLS predicates + FK columns; `audit_log` partitioning.

**Structural (schedule deliberately; do the ones that touch schema pre-pilot):**
8. §6.1 unified memberships table; §6.2 patient master; §6.3 metadata-driven form types; §6.5 audit-as-evidence (checkpointing + surveyor export).

**Post-pilot / roadmap-aligned:**
9. Break-the-glass, access-review program, legal-hold/consent registry, scheduling substrate, CAPA/hub convergence, uniform observable error convention in the data-access layer, and remove the `AIF_BISECT_NO_SUPABASE` auth-bypass hook from the middleware hot path (never merge it).

---

## Appendix — cross-workstream convergence

Findings independently surfaced by more than one of the five audit workstreams (schema, RLS, RPC, data-access, PHI) — treated as high-confidence:

| Theme | Workstreams |
|---|---|
| `log_audit_access` forgeable read-audit rows | RLS, RPC, PHI |
| Default privileges `GRANT ALL TO authenticated` / `audit_log` destructible | RLS, RPC |
| Patient identity triplicated, no master, key collisions | Schema, PHI |
| PHI disposal incomplete (answers/interviews/minutes/storage/label) | PHI, Schema |
| Global vocab cross-tenant editable | Schema, RPC |
| `capa_plan` no tenancy + global code sequence | Schema, RPC |
| Tenant-hierarchy desync (hospital moves org) | Schema, PHI |
| No pagination on growth-unbounded reads | Data-access, RPC |
| `MAX+1` minting under advisory locks | Schema, RPC |
| `sync_answer_typed_values` swallows cast errors | Schema, RPC |
| `eval_condition` lexicographic fallback on ordered ops | Data-access, RPC |
| `verify_audit_chain` O(n), unpartitioned `audit_log` | RPC, PHI |

---

*End of report.*
