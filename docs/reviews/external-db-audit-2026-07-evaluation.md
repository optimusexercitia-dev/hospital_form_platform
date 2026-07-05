# Evaluation of the External DB Audit (2026-07)

**Evaluates:** [`docs/reviews/external-db-audit-2026-07.md`](./external-db-audit-2026-07.md)
**Date:** 2026-07-04
**Method:** Every claim in the audit was traced to the **live** definition in `supabase/migrations/`
(latest-migration-wins), the data-access layer (`src/lib/queries/**`, `src/lib/supabase/**`), and the
ADR trail. Verification was split across five workstreams mirroring the audit's own (schema, RLS, RPC,
data-access, PHI); the six Critical findings and the two load-bearing "the audit is wrong here"
corrections were additionally spot-checked by hand. Reachability is judged against the real access
model: **PostgREST exposes only the `public` and `graphql_public` schemas** (`supabase/config.toml:13`),
running as the `authenticated` role after JWT verification, plus `public` RPCs granted to `authenticated`;
the service-role key is server-only. So "an attacker can do X" = X is an RLS-permitted table DML or a
callable `public` RPC. TRUNCATE and `app.*` functions are **not** reachable that way.

---

## 1. Headline verdict

**The audit is high-quality and, on the facts, overwhelmingly accurate.** Every line-number citation I
checked was correct, and the substance of all six Critical findings is real code, not hallucination. The
team should take it seriously: the core thesis — *"strong read path, weak write/grant path; the PHI
perimeter is larger than the PHI controls"* — holds up under direct tracing.

**But it was written to an explicitly "unforgiving" brief, and that shows in the calibration.** Two of the
six Criticals are *latent / defense-in-depth* (a wrong default that is **not reachable** through the app's
actual access model), not live exploits. And there is a specific cluster of **overstatements and outright
errors** — including the audit's own flagship "operationally fragile" evidence — that a reader must
correct before acting. Those are collected in §5.

Net: **act on it, but triage by real reachability, not by the label.** The genuinely-must-fix-before-pilot
set is smaller than "6 Critical + 14 High" and every item in it is cheap under the current
pre-launch/reset-OK posture.

Answering the audit's own three questions, with my verdict:

| Question | Audit's answer | My verdict |
|---|---|---|
| Inefficiencies? | Real, numerous, cheap | **Agree**, but nearly all are perf-at-scale, not correctness; all commission/hospital-scoped so they degrade gracefully at pilot size. Two are worth doing now (see §4). |
| Permissions adequate? | Read path strong, write/grant path not | **Agree** — this is the single most important true finding. The write/grant path has real, PostgREST-reachable self-escalation into PHI (C-3, C-4, H-8). |
| Flexibility for expansion? | Form builder good; polymorphism sprawl + no patient master will calcify | **Agree**, with the `item_type` footgun (H) the sharpest concrete instance. |

---

## 2. The six Criticals — per-finding verdict

### C-1 · `audit_log` destructible by TRUNCATE — **AGREE, but latent (not reachable via the app)**
Factually correct: `GRANT ALL ON audit_log TO authenticated` (baseline:24779) includes TRUNCATE;
`guard_audit_immutable` (baseline:2079) unconditionally raises but is wired `BEFORE DELETE OR UPDATE`
(baseline:19923), and row triggers never fire on TRUNCATE. **However**, I confirmed there is *no exposed
arbitrary-SQL RPC* anywhere, and `app.*` isn't PostgREST-exposed, so TRUNCATE is **not reachable** by an
`authenticated` client — it needs a raw Postgres credential the platform never hands out. The audit says as
much. So this is a *wrong default on a tamper-evidence table*, worth the one-line `REVOKE` + a
`BEFORE TRUNCATE … FOR EACH STATEMENT` guard as cheap insurance, but **not a live hole** and not really
"Critical" by reachability. Fix it with C-2, don't lose sleep over it.

### C-2 · Default privileges grant `ALL` to `authenticated` — **AGREE (systemic-latent; harden pre-launch)**
Correct and systemic: `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES/FUNCTIONS TO authenticated`
(baseline:24935–24946); 75 tables carry the blanket `GRANT ALL`. This is Supabase's **stock default**, and
the real risk is conditional: a *future* table created without `ENABLE ROW LEVEL SECURITY` would be
world-readable/writable by every logged-in user. That the DROP+recreate-RPC pattern silently resets a
function's ACL to PUBLIC-executable is **demonstrated in this very repo** — `20260709000300_audit_hospital_tier.sql`
had to manually re-`revoke`/`grant` after recreating `verify_audit_chain` — and the team *forgot* to for
`log_audit_access` (that's C-4). So the hardening (revoke defaults, grant per-object) is sound and
proportionate. Severity is "systemic root," not "active breach."

### C-3 · Self-escalation into PHI via directly-writable membership tables — **AGREE (real, reachable), but the stated mechanism is partly wrong**
The vulnerability is **real and reachable by an ordinary authenticated INSERT**, and it breaks guarantees
the codebase's own comments and pgTAP tests assert:
- `organization_members_write` is `FOR ALL USING/CHECK (is_admin() OR is_org_admin_of(org))` (baseline:21839)
  over a table with `GRANT ALL` never revoked. `organization_members.role` accepts `'nsp_coordinator'`
  (CHECK baseline:18347); `is_nsp_coordinator_of_for` reads that row → `is_pqs_operator_of_for` → grants
  PHI read.
- `pqs_members_curator_all` (nsp_per_hospital:1175) has **no self-exclusion**, and even the sanctioned
  `add_pqs_member` RPC (nsp_per_hospital:1938) has **no `p_user_id <> auth.uid()` guard** — so an
  `nsp_org_admin` (pgTAP-asserted "ZERO-PHI KEYSTONE") can enroll itself into a hospital's PHI roster.

**Correction to the audit:** it claims `nsp_coordinator` "has no appointment RPC — it's created by writing
the table." That is **wrong** — `assign_nsp_coordinator` (nsp_per_hospital:2184) exists and is well-built
(gated on the tighter `is_nsp_org_admin_of`, with a self-appointment guard at :2203). The defect is not a
*missing* RPC; it's that the **raw table RLS doesn't mirror the RPC's restrictions**, so a plain `org_admin`
can bypass the guarded door via direct `INSERT`. This makes the fix obvious and cheap (see §6.1-min): the
pattern to copy already exists twice in-repo (`case_access` has **no** write policy at all — writes only via
`grant_case_access`/`revoke_case_access` DEFINER RPCs; `assign_hospital_admin` already does authority-check →
self-delegation-guard → guarded insert). **This is the #1 pre-pilot fix.**

### C-4 · `log_audit_access` lets any user forge read-audit rows — **AGREE (real, reachable via PostgREST alone)**
Verified the body (baseline:11985–12002): it validates **only** that `p_action` is in an 11-verb allow-list,
then passes caller-supplied `entity_id`, `commission`, `summary`, `metadata` straight to `audit_write` with
**no entitlement check**. It's `public`, granted to `authenticated` (baseline:23952), so any user can mint
chain-valid but fictitious "who-read-what" rows into **any** commission's append-only chain — rows that pass
`verify_audit_chain`, land in the audit UI/exports, and are unremovable by design. This is the most
*operationally* exploitable audit-trail finding (needs only PostgREST, no elevated credential). Fix is clean
and I confirmed it breaks nothing: the legitimate PHI doors already call `log_audit_access` **internally**
after their own gate, so revoking the public grant is safe.

### C-5 · `answers` has no referential integrity to its form — **AGREE (real integrity gap on the analytics path)**
Correct: `answers.question_key` is denormalized `text` (baseline:17896); `answers_item_id_fkey` is bare
single-column `NO ACTION` (baseline:20255); a composite FK is *currently impossible* (no `UNIQUE(id,
form_version_id)` on `form_items`); the write policy `answers_write_own_draft` gates purely on response
ownership, never on `item_id`/`question_key`. **Nuance that matters:** the one shipped write path,
`save_section_answers`, *does* defend procedurally (checks `form_version_id`, derives `question_key`
server-side) — so this is not exploitable through today's UI. But per Rule 1 the DB boundary is RLS, and RLS
doesn't enforce it, so a raw `POST /answers` or a future forgetful RPC could poison a `question_key` that
dashboards aggregate on. Genuine defense-in-depth/ALCOA+ bug on the accreditation-critical path; fix is cheap
and pre-launch-only (`form_version_id` column + composite unique + composite FK).

### C-6 · PHI disposal is materially incomplete — erasure is a false claim — **AGREE (the headline, and it's true)**
Independently confirmed twice. `dispose_case_phi` (baseline:10282) touches only `case_patient`,
`case_narratives.body_md`, `case_events.body`. It leaves untouched — each **self-labeled "PHI-BEARING" in the
schema's own comments** — form `answers` (case-phase responses), `case_interviews.summary_md` /
`case_interview_subjects.note`, `meetings.minutes_md` (which has **no disposal path of any kind**),
`cases.label`, and `case_documents` metadata. `answers.confidentiality_level` is self-documented as
"RESERVED + UNENFORCED." **The platform cannot today truthfully answer an LGPD Art. 18 request with
`dispose_case_phi`.** Two fair calibrations: (a) Storage-object non-deletion is a *deliberate, documented*
Rule-6 immutability choice, not an oversight — but the outcome (recoverable PHI survives) is identical, so
either the dispose functions delete/redact the objects or the erasure claim must be narrowed in writing;
(b) `cases.label` is untouched *and* the UI actively warns users not to put PHI there — but the asymmetry is
real because `dispose_referral_phi` **does** redact the identically-warned `subject` field. Fix: extend each
dispose function to the full classified-PHI closure of its entity graph (this is what §6.2's patient-master
recommendation would give a single entry point for).

**Critical scorecard:** C-3, C-4, C-5, C-6 are real must-fix-before-pilot. C-1, C-2 are real *wrong defaults*
worth hardening but latent (not reachable through the app). None is fictional.

---

## 3. The Highs — per-finding verdict

| # | Finding | Verdict | Why |
|---|---|---|---|
| H · session not `React.cache`'d | `getSessionContext` (5 DB reads) re-runs per Server Component | **AGREE, calibrate** | Real, one-line fix, precedent already in the same file (`getCommissionAccessByOrg`/`getNspAccessByOrg` are cached). But it's 60 call sites (many indirect); "12–18×/nav" and "~10×" are estimates, not measured. Pure perf. |
| H · DISTINCT filters in JS | `listAuditFilterActors` scans all audit rows to dedupe in a Map | **AGREE** | Confirmed; `audit_log` is append-only + 20-yr retention, so this one's scan set grows unbounded — the most future-dangerous of the perf items. |
| H · no pagination | `listSubmissions/listCasesBoard/listMeetings/listCommissionReferrals/pqsInbox` | **AGREE, calibrate** | All confirmed unpaginated — but every one is commission/hospital-scoped, so growth is bounded by that unit. Perf-at-scale, not correctness; do `listSubmissions` first. |
| H-6 · role grants unaudited | `trg_audit_hospital_admin_grant` only `role='hospital_admin'`, INSERT/DELETE | **AGREE, overstated** | Real gap for `organization_members` (3 of 4 roles) + `pqs_members` (zero triggers). **But `commission_members` IS fully audited** (`audit_commission_members_trg` fires on INSERT/DELETE/UPDATE, emits `role_changed`). "Largely unaudited" overreaches. |
| H-7 · `FOR ALL` over-govern | `organization_members_write` + `commission_members_staff_admin_update` | **PARTIALLY AGREE** | True for `organization_members_write` (restates C-3). **Wrong for `commission_members_staff_admin_update`**: it's `FOR UPDATE` (not `FOR ALL`) and pins `role='staff'` in both USING and WITH CHECK, structurally blocking the described escalation. Audit named the wrong policy. |
| H-8 · cross-hospital CAPA write | `can_write_capa` non-event branch = `is_pqs_member_of_any` | **AGREE** | Confirmed (nsp_per_hospital:673). `capa_plan` has no `hospital_id`; a PQS member of hospital A can `PATCH` hospital B's manual CAPA. Blast radius = the whole non-event CAPA action tree (same predicate gates `capa_action`/`capa_action_task`). |
| H · dispose auth inconsistent + vendor | 3 different auth models; `dispose_referral_phi` allows `is_admin()` | **AGREE (nuance)** | Confirmed — three genuinely different gates. `dispose_referral_phi` alone lets the platform vendor unilaterally erase tenant PHI, while case/event paths deliberately exclude it. The codebase's own comments admit this ("documented erasure exception") — a *known* choice, not an accident, but a real unreconciled trust-boundary asymmetry. |
| H-1/§6.4 · Storage parity for PHI | member-readable, unaudited, non-disposable buckets | **AGREE, overstated for 1 of 5** | `case-documents`/`interview-attachments`/`meeting-attachments`/`nsp-evidence` use loose predicates broader than their PHI tables' doors; downloads are unaudited; disposal never deletes objects — all confirmed. **But `referral-attachments` is the counter-example done right** (gated on the tight `can_read_referral_phi`). And `get_referral_detail` (baseline:10991) returns `frozen_storage_path` unconditionally next to a correctly-redacted `frozen_body_md` — a real minimization leak (path disclosure; the bucket RLS still blocks the actual download). |
| H · delete booby-traps (SET NULL × NOT-NULL CHECK) | `capa_plan_source_shape`, `rca_evidence_shape` | **AGREE, calibrate** | Chain confirmed (deleting an event → cascade to `rca` → SET NULL → CHECK violation → opaque abort). **Mitigation the audit missed:** `guard_event_status_trg` already blocks raw deletes of triaged/closed/cancelled events — exactly the ones that have an RCA — so the trap is reachable only via a sanctioned deletion RPC, narrower than "any delete." Still a real correctness/compliance defect; fix with `RESTRICT` or a detached-state CHECK. |
| H · tenant hierarchy desyncs | `commissions.organization_id` derived, no trigger on `hospitals` | **AGREE for commissions/hospitals; REJECT the `profiles.home_*` analogy** | `UPDATE hospitals SET organization_id=…` via PostgREST (no column lock on `hospitals_write`) leaves child commissions + stamped `audit_log.organization_id` + org-scoped RLS stale — real. **But `profiles.home_*` is not "the same treatment":** those columns have no derive trigger, are set once from invite metadata, and are documented "hospital is NOT an access boundary here." Different, lesser issue. |
| H · FK data in jsonb/arrays | `case_phases.allowed_result_ids`, `result_ruleset`, `blocks integer[]` | **AGREE, one sub-claim wrong** | All three confirmed FK-less; `blocks` keyed on mutable `position` is a real footgun. **But "a phase reorder silently rewires the graph" is wrong for the shipped path** — `reorder_template_phase` atomically remaps `blocks` during the swap and re-validates. Residual risk is future *other* mutation paths, not the existing reorder. `case_phase_offered_results` exists but is a coarse cache, not the phase-scoped normalization needed. |
| H · `capa_plan` no tenant + global code | no `hospital_id`; `CAPA-####` from one global lock | **AGREE** | Confirmed in full; `mint_capa_code` serializes *every* hospital on the literal lock key `'pqs:capa_code'` with an unfiltered `MAX` scan. Already flagged as tracked debt in the schema's own comment. |
| H · patient identity triplicated, no master | `event/referral/case_patient` byte-identical; `patient_key` collides | **AGREE (landmine, not active leak)** | Byte-identical shapes + `patient_key = HMAC(MRN, platform-pepper)` with hospital nowhere in the hash — two hospitals' MRN "12345" collide. **Corrections:** it was a documented decision under a since-stale single-tenant assumption (ADR 0039), and today's shipped RPCs re-filter by hospital downstream, so it's not currently exploitable — a landmine for any future join on `patient_key` alone, not a live leak. §6.2 is the right fix and is cheap pre-launch (`backfill_patient_keys` already exists). |
| H · `item_type` needs ≥6 edits; CASE returns NULL | `form_items_input_vs_display` `ELSE NULL` | **AGREE (cleanest confirmation in the audit)** | `ELSE NULL::boolean` is explicit (baseline:18268); Postgres treats a NULL CHECK as satisfied. Not live today (a twin `item_type_check` whitelists the same 10 values), but the moment a future migration adds an 11th type to one list and not the other, it passes with **zero shape enforcement**. The taxonomy is repeated in 10–15 SQL sites; "≥6" is a conservative floor. §6.3 is the right structural fix. |

---

## 4. Mediums / Lows — condensed

**Confirmed, worth a cheap pre-pilot migration:** lifecycle-state CHECKs (`responses` can be
`submitted`+`submitted_at NULL`; `cases.closed_at` free of status; `case_referral` has 5 unconstrained
`_at`/`_by` pairs) — all confirmed; a dozen one-line CHECKs. Unindexed FK columns (all 5 spot-checked
confirmed) — cheap indexes. `verify_audit_chain` O(n) and `audit_log` unpartitioned — both confirmed;
declaratively range-partition **now** while the table is empty and the immutability trigger makes later
re-partitioning painful. `MAX+1` minting under advisory locks — confirmed; `mint_capa_code` is the one true
global-lock offender.

**Confirmed but style/nice-to-have:** `updated_at` is convention not mechanism (confirmed *worse* — `cases`,
`commissions`, `forms` lack the column entirely; only 5 tables have a trigger-maintained one). Status enums
mix pt/en (`capa_action` = `pendente/…` vs `case_action_items` = `open/…`) — confirmed, but these are
internal keys, **not** user-facing text, so it's a naming-consistency nit, not the Rule-10 violation the
audit implies. Four polymorphism dialects — confirmed (`case_events.kind='safety_event'` carries no FK).

**Overstated / needs splitting:** "Global vocab cross-tenant-editable" is real for `pqs_event_types` /
`pqs_sentinel_criteria` (any single-hospital PQS member can edit vocab all tenants see) but **wrong-as-stated
for `referral_types` / `reply_outcomes`**, which are `is_admin()`-gated (super-admin only) — a much smaller,
different defect. Forward-compat UUID-no-FK columns are confirmed but are a **deliberate, self-documented**
convention ("FK-LESS forward hook (Phase 15/18)"), not an oversight.

**`sync_answer_typed_values` swallows cast errors** (appendix) — confirmed: three `EXCEPTION WHEN others
THEN … := null` blocks silently NULL a bad numeric/date/time in the *denormalized* typed columns. The
canonical `value jsonb` is untouched (so the evaluator's source of truth is safe), but any dashboard reading
`value_number` diverges silently from what the user entered — a real ALCOA+ "Accurate" nit.

**`eval_condition` lexicographic fallback** (appendix) — confirmed and genuinely a **latent correctness
bug**, not perf: ordered comparisons (`>`,`<`,`>=`,`<=`) compare numerically only when *both* operands are
JS numbers, else fall back to string compare (`"10" < "9"` → true). It's intentional (documented,
SQL-mirrored) for ISO date/time sorting, but a numeric `free_text` answer that reaches the evaluator as a
JSON string would misorder a visibility condition. **Worth a targeted check** of whether the answer-write
path guarantees numeric typing before trusting this is dormant.

---

## 5. Where the audit is wrong or overstated (correct these before acting)

1. **§6.5 "`audit.exported` is an allow-listed verb with no implementation behind it" — FALSE.** A working
   audit-CSV export route exists (`src/app/o/[org]/c/[commission]/manage/audit/export/route.ts`) that gates
   on staff_admin/admin and calls `logAuditAccess({action:'audit.exported'})`, with a passing E2E test. The
   *deeper* recommendation (a **signed, chain-verified** surveyor bundle, vs. a plain CSV) is a fair Phase-19
   goal — but the literal "no implementation" claim is wrong.
2. **C-3 "`nsp_coordinator` has no appointment RPC" — FALSE.** `assign_nsp_coordinator` exists and is
   well-guarded (§2, C-3). The vulnerability is a direct-INSERT bypass of an existing RPC, not a missing one.
3. **§3 "a migration rewrites ~145 policies/functions via live-catalog string `replace()`" — FALSE, and this
   is the audit's flagship evidence for "operationally fragile."** The only `DO` block in
   `20260710000000_nsp_per_hospital.sql` (:2404) is a **read-only verification sweep** — it queries
   `pg_get_functiondef`/`pg_policies` via regex and raises if stale symbols survive. No `replace()`, no
   `EXECUTE`, no loop. Actual object churn is hand-written `drop/create` statements. The "operationally
   fragile" characterization rests substantially on a misread of a *defensive* safety net.
4. **H-7 `commission_members_staff_admin_update` — misattributed.** It's `FOR UPDATE` (not `FOR ALL`) and
   pins `role='staff'` on both sides, structurally blocking the escalation it's cited for.
5. **H-6 "role-grant changes largely unaudited" — overstated.** `commission_members` IS fully audited; the
   gap is scoped to `organization_members` (3 roles) + `pqs_members`.
6. **H (tenant desync) `profiles.home_*` "same treatment" — rejected.** Descriptive-only columns, explicitly
   "NOT an access boundary"; a different, lesser issue.
7. **H (jsonb) "phase reorder silently rewires the graph" — wrong for the shipped path** (`reorder_template_phase`
   remaps atomically).
8. **M (global vocab)** folds `referral_types`/`reply_outcomes` (super-admin-gated) in with the
   any-PQS-member-editable tables — split them.
9. **§7 "`patient_access_audit` is itself unaudited"** — imprecise: it's a report *function*, not a table;
   the substance (reads of `audit_log` aren't audited) holds, but the object named doesn't exist as
   described.
10. **Perf multipliers are estimates** ("12–18 session reads/nav," "15–20 round-trips") — directionally
    right, but the 7 feature-flag RPCs run **concurrently** (`Promise.all`, ~1 round-trip wall-clock), so the
    latency framing overstates.

None of these voids the audit's core thesis — but a reader who treats every Critical/High as an equal, live,
correctly-described emergency will misallocate effort. Reachability and accuracy vary.

---

## 6. Strategic recommendations (§6) & opportunities (§7)

- **§6.1 unified `memberships` table — sound; the minimum-viable version is the real pre-pilot action.** The
  full collapse is a legitimate, phase-sized project (blast radius smaller than implied — ~2 policies name
  the tables directly; most logic routes through ~20 predicates). But the **minimum-viable** version —
  revoke direct `INSERT/UPDATE` on `organization_members`/`pqs_members`, funnel grants through guarded DEFINER
  RPCs with self-exclusion + audit — closes C-3, C-4-adjacent, H-6, H-7 structurally, is cheap, and is
  **already precedented twice in-repo** (`case_access`; `assign_hospital_admin`). Do this before pilot.
- **§6.2 hospital-scoped patient master — sound and proportionate.** Directly fixes the confirmed
  triplication + `patient_key` collision + gives LGPD erasure a single entry point (pairs with C-6). Cheap
  now (pre-launch, `backfill_patient_keys` exists), expensive after real MRNs are hashed.
- **§6.3 metadata-driven form types — sound, larger refactor.** Closes the `ELSE NULL` footgun and collapses
  the 10–15 hardcoded sites; the "add a question block on request" requirement is real, not speculative.
  Sequence after §6.2.
- **§6.4 storage parity for PHI — agree** (with the referral-bucket credit from §3). Audited signed-URL
  downloads + tightened bucket SELECT + object deletion in dispose + stop returning `frozen_storage_path` to
  non-PHI readers.
- **§6.5 audit-as-evidence — agree on the real gaps** (no external WORM anchor for chain heads → tail
  rewrite/TRUNCATE undetectable; no scheduled `verify_audit_chain`), **minus the false "no export exists"**
  premise (correction #1).
- **§7 opportunities — all sound as roadmap, none are defects.** Break-the-glass + purpose-of-use (denials
  are currently silent — a PHI-probing pattern leaves zero trace), periodic access-review, legal-hold +
  consent/legal-basis registry (`retention_expired` is a manual reason label with no clock; no hold flag),
  de-identify-vs-redact (disposal writes `'[PHI removido]'` over RCA analytic content — a real
  quality-vs-compliance tension). Good, correctly framed as value-add.

---

## 7. Recommended pre-pilot action list (my triage, not the audit's)

**Must fix before pilot (real, reachable, cheap):**
1. **C-3 / §6.1-min** — revoke direct writes on `organization_members` + `pqs_members`; route grants through
   guarded DEFINER RPCs with self-exclusion; add the missing self-check to `add_pqs_member`; blanket
   membership-audit (also closes H-6, H-7). *The single most important item.*
2. **C-4** — revoke the public `log_audit_access` grant from `authenticated` (legit doors call it internally).
3. **C-6 + §6.4** — extend the three `dispose_*` to the full PHI closure (answers, interviews, minutes,
   `label`, `case_documents`) and either delete/redact Storage objects or narrow the erasure claim in
   writing; stop leaking `frozen_storage_path` from `get_referral_detail`.
4. **C-5** — `form_version_id` on `answers` + composite unique/FK; keep deriving `question_key` server-side.
5. **H-8** — give `capa_plan` a `hospital_id` and scope `can_write_capa` (+ code/lock) to it.

**Do now because it's free pre-launch (latent, but cheap and calcifies later):**
6. **C-1 + C-2** — `REVOKE` DML/TRUNCATE on `audit_log` + `BEFORE TRUNCATE` guard; flip default privileges to
   revoke-and-grant-per-object.
7. Delete-path `RESTRICT`/detached-CHECK; tenant-hierarchy composite FK + `hospitals` guard trigger; jsonb/array
   → junction tables; `item_type` metadata lookup with `ELSE false`; lifecycle CHECKs; range-partition
   `audit_log`; RLS/FK composite indexes.

**Cleanup (do immediately — unrelated to the audit but surfaced during it):**
8. **Delete the uncommitted `AIF_BISECT_NO_SUPABASE` auth-bypass hook** in `src/lib/supabase/middleware.ts`
   and the untracked `e2e/_aif-diag.spec.ts` — it fabricates a fake authenticated identity when an env var is
   set; it's uncommitted, unreferenced in any config, and its bisection purpose is already served
   (BUG-AIF-001 root cause found elsewhere). Must never merge.

**Deferrable to post-pilot / scale:** session `React.cache()`, pagination, DISTINCT-filter RPCs, sidebar
counts, the full §6.1 collapse, kill-switch (`is_active` fold — a documented accepted risk, ADR 0009),
`eval_condition` numeric-typing check, `updated_at` trigger, enum-language cleanup.
