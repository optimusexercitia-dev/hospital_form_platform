# QA Review — Form-Builder Enhancements batch (ad-hoc, out-of-phase)

- **Reviewer:** `qa`
- **Date:** 2026-07-07
- **Scope:** 10-task grouped batch (Departments, Flagged + aggregate result
  criteria, form-builder dialog cluster, "Others" open option, wizard UX + masked
  time-field, views/labels, meeting participants, openNarrativeCount) + 4 gate-bug
  fixes (FBE-005/006/007/008). Migrations `20260713000500…001000`.
- **Gate state entering review:** batch E2E 29/29 green on prod-standalone;
  tsc 0 · ESLint 0 · Vitest 306/306 · pgTAP 72 files/1787 · `next build` EXIT 0.
- **Verdict:** **APPROVED**

Read-only audit against CLAUDE.md, ARCHITECTURE.md (Rules 1–12), the locked batch
plan, and the handoff. No application code modified.

---

## Findings

Severity legend: BLOCKER (gate-blocking) · MAJOR · MINOR · INFO.

### BLOCKER — none.

### MAJOR — none.

### MINOR — none.

### INFO / observations (no action required to pass the gate)

- **INFO-1 — `hospital_departments` is not audit-instrumented (Rule 11), and that
  is consistent with precedent.** The audit model is per-table opt-in AFTER-triggers
  on high-value governance/clinical tables (`cases`, `meetings`, `indicators`,
  `controlled_documents`, CAPA, PHI tables). Peer *configuration-vocabulary* tables
  — `case_outcomes`, `phase_results` — carry no audit trigger either.
  `hospital_departments` is the same class of low-sensitivity, admin-managed lookup
  vocabulary, so leaving it uninstrumented does not violate Rule 11's "high-value
  tables" intent. If the team later wants create/rename/archive traceability for
  accreditation, a `trg_audit_hospital_departments` mirroring `trg_audit_indicators`
  is the drop-in — a follow-up, not a gate blocker.
- **INFO-2 — the case's department rides the existing `case.created` audit row with
  no free-text leak.** `trg_audit_cases` diffs an allow-list of `['status','outcome_id']`
  only; the new free-text `cases.department_other` is correctly excluded from the
  diff (Rule 11 — never copy free-text into the log). Case creation still emits its
  audit row with actor attribution. Correct.
- **INFO-3 — `getLatestSnapshot` ref-mirror: KEEP (see recommendation below).**

---

## Requirements audit (CLAUDE.md + locked plan)

- **Departments** — table + member-read/admin-write RLS + `is_hospital_member_of`
  helper + hardened `reorder_departments` DEFINER RPC + `cases.department_id/
  department_other` + create-case wiring: all present, all shape-constrained
  (`cases_department_shape` CHECK: mutually exclusive; `on delete set null` so
  archiving a dept never orphans a case). NON-PHI, case-level (never on
  `case_patient`) — matches the module boundary. ✔
- **Flagged + aggregate result criteria** — `form_item_options.flagged`,
  `config.flaggedWhen`, aggregates `__total_score__`/`__flagged_count__` injected
  into `compute_case_phase_result` before the rule-walk. Rides the
  synthetic-reserved-key precedent. ✔ (Rule 3 — see below.)
- **"Others" open option** — reserved `__other__` row minted/dropped entirely by
  `reconcile_item_options` (author payload defensively rejects the reserved code,
  HC013); `answers.other_text` written only when the item's `__other__` option is
  among the current selections, else forced NULL; `config.minLength/maxLength`
  enforced at submit inside `assert_item_bounds` (which `submit_response` calls for
  every visible input item). ✔
- **Meeting participants** — `seed_selected_meeting_attendees` RPC (subset filter)
  + dialog. ✔
- **openNarrativeCount**, wizard UX, masked time-field, views/labels — implemented;
  covered by the 29/29 batch E2E. ✔
- **pt-BR user-facing strings / accessibility** — spot-checked `time-field.tsx`:
  pt-BR error copy, `aria-label`/`aria-invalid`/`aria-describedby` wired,
  `role="alert"` on the error, keyboard-native text input. ✔

## RLS / security

- **`hospital_departments` policies.** SELECT = admin / org_admin-of-org /
  hospital_admin / PQS operator / hospital member — correctly hospital-scoped via
  `org_of_hospital` and `is_hospital_member_of`; no cross-tenant path (every arm
  resolves through the row's `hospital_id`). WRITE (`FOR ALL`) = org_admin OR
  hospital_admin, with matching `using`/`with check` (no asymmetry that would let a
  row be inserted into a hospital the writer can't also read/update). Archive-only
  (no DELETE policy, no DELETE grant). ✔
- **`is_hospital_member_of(uuid)`** — STABLE SECURITY DEFINER, `search_path` pinned
  to `app, public, pg_catalog`, `is_active`-gated, `REVOKE ALL FROM public` then
  `GRANT ... authenticated, service_role`. ✔
- **`reorder_departments(uuid, uuid[])`** — SECURITY DEFINER, search_path pinned,
  `REVOKE FROM public` + `GRANT`. Re-enforces the WRITE predicate in-body (DEFINER
  bypasses RLS) AND validates that **every** id in the array is a non-archived
  department of `p_hospital_id`, raising HC030 on any foreign/archived/nonexistent
  id — so the call can neither scramble nor probe another hospital's departments.
  Correct hardening. ✔
- **`seed_selected_meeting_attendees(uuid, uuid[])`** — plain `plpgsql` **invoker**
  (byte-for-byte matches the sibling `seed_expected_meeting_attendees`'s security
  posture), search_path pinned, `REVOKE FROM public` + `GRANT`. Re-checks authority
  via `assert_meeting_staff_admin` (raises 42501 otherwise) and the insert is still
  RLS-gated (invoker). A non-member `user_id` matches no `commission_members` row
  and is silently ignored — no injection of non-members, no validation gap. ✔
- **`answers.other_text`** — a plain column on `answers`; existing `answers` RLS +
  the submitted-immutability guard govern it (resolved via `answer_id → answers`).
  No new door, no new grant surface. ✔
- **`create_case` / `create_case_from_template`** — old signatures dropped; new
  ones re-check `is_staff_admin_of`/`is_admin`, validate department shape + hospital
  ownership via `department_belongs_to_commission` (HC030), search_path pinned,
  REVOKE/GRANT correct. ✔
- **No service-role key reachable client-side** introduced; FBE-005 specifically
  removed a client→server-only module leak (see code quality). ✔

## Rule 3 — evaluator invariance

- `app.eval_condition` / `app.eval_visibility` and the shared SQL↔TS vector
  fixtures are **untouched** by the batch. The flagged/aggregate work is purely
  additive at compute time: `compute_case_phase_result` computes the two aggregates
  and injects them into the normalized answer map (`v_answers ||
  {__total_score__, __flagged_count__}`) *before* the unchanged rule-walk, then
  reuses `eval_condition` for both the rule-walk and the `flaggedWhen` tally —
  evaluated against the SAME normalized map value (`v_answers -> question_key`), so
  a `flaggedWhen` can never disagree with a result rule reading the same key.
- Reserved-namespace safety holds: `__…__` keys can never be author question_keys
  (slugifyLabel strips leading/trailing `_`), the same guarantee `__phase_result__`
  already relies on.
- `answers.other_text` is never a code/scalar answer, never enters the answer map,
  never fed to `eval_condition`. ✔

## Rule 11 — audit

- No answer/PHI/free-text payloads copied into the log by any batch mutation (see
  INFO-1/INFO-2). The `case.created` audit allow-list excludes `department_other`.
  `hospital_departments` uninstrumented is consistent with peer vocabulary tables. ✔

## Code quality

- **FBE-005 (option-constants split)** — `src/lib/forms/option-constants.ts` is a
  pure, zero-import module; `queries/forms.ts` re-exports it. Verified: **no**
  remaining client *value*-import of `OTHER_OPTION_CODE`/`OTHER_OPTION_LABEL` from
  the server-only module; the only `queries/forms` imports left in `src/components/`
  are `import type` (type-only, erased at build). Correct, and the new "next build
  standalone required" green-bar rule is the right guard. ✔
- **FBE-008 (wizard-runner adapter)** — the true fix: `saveSection`/`saveAndExit`
  now spread-forward the whole `input` (`{ responseId: data.responseId, ...input }`),
  so every current AND future `WizardActions` field flows through automatically. The
  rewritten comment correctly names the blind spot (`Parameters<...>` types the
  input arg, not the forwarded literal; optional fields make omission tsc-invisible).
  A `wizard-runner.test.tsx` asserts the adapter forwards `otherTextByItemId`. This
  is the right, recurrence-proof fix. ✔
- **Validator migration (`…001000`)** — the whitelist is **narrow**: only
  `__total_score__`/`__flagged_count__` bypass the input-key + option-code checks;
  the `result_id` existence/vocabulary check still runs for them; a genuinely
  unknown key still throws HC016; the `default_result_id` check is unchanged. Mirrors
  the `__phase_result__` recommendation-validator bypass. ✔
- Migrations are additive and reset-safe: `add column if not exists`, `create or
  replace function`, `drop function if exists` for superseded signatures only; all
  `delete from` statements are inside RPC bodies (runtime reconcile/save), not
  migration-time data wipes. New public RPCs all `REVOKE ALL FROM public` before
  `GRANT` (satisfies the dashboard t19 pgTAP guard). ✔
- No `any` introduced in the touched FE files (`wizard-runner.tsx`, `use-wizard.ts`,
  `time-field.tsx`, `option-constants.ts`). ✔

---

## Keep-vs-simplify: the `use-wizard.ts` `getLatestSnapshot` ref-mirror

**Recommendation: KEEP.** (Do not churn it out pre-gate.)

Context: iter-2 (`setOtherText` upsert) and iter-3 (`answersRef` + `getLatestSnapshot`)
were added while chasing FBE-008; the *true* root cause turned out to be the
`wizard-runner.tsx` adapter dropping `otherTextByItemId` (iter-4). The question is
whether the ref-mirror is now dead defensive weight.

It is not, on the merits:

1. **It fixes a real, independent latent class, not just the FBE-008 symptom.** The
   three save-time collectors (`collectSection`, `observationsForSection`,
   `otherTextForSection` in `wizard-client.tsx`) are `useCallback`s. Reading a
   closed-over render `answers` snapshot is a genuine stale-closure hazard for the
   *last keystroke before a save* — the exact "selection present, text absent" shape
   the tester wire-proved. The adapter fix (iter-4) made the value that *does* reach
   the collector flow to the wire; it does **not** guarantee the collector reads the
   latest committed state. These are two different links in the chain; both were
   worth hardening. Reverting the ref would re-expose the collector-read hazard for
   selections/observations/otherText alike.
2. **The cost is small and well-contained.** ~20 lines: one `useRef` + a commit-phase
   `useEffect` sync + one memoized accessor that recomputes visibility from the
   latest map. It is used *only* on the save path; render still uses the memoized
   `answers`/`visibleItemIds`. There is a dedicated mechanism test
   (`use-wizard.test.ts` "a captured getLatestSnapshot reference reflects a LATER
   commit") pinning the behavior, so it will not silently rot.
3. **It is idiomatic and correct.** The ref is synced in an effect (post-commit),
   not read during render, so it does not trip `react-hooks/refs` and does not risk
   a tearing read.

The only piece I would flag as *possibly* redundant now is the iter-2 `setOtherText`
UPSERT branch (the "no record yet → mint a minimal `__other__` record" path): with
the adapter fixed and the ref reading the latest state, the upsert is belt-and-braces.
But it is a small, well-tested, correctly-guarded branch (non-empty only; never
resurrects on clear) and removing it would be a behavior change worth its own tested
diff — **not** something to do reactively at the gate. Leave both in; if the team
wants to slim `use-wizard.ts` later, do it as a separate, tested cleanup with the
E2E persistence spec as the backstop.

---

## Verdict

**APPROVED** — 0 BLOCKER · 0 MAJOR · 0 MINOR · 3 INFO. The batch meets the locked
plan and the binding rules: RLS is the boundary and correctly hospital-scoped, both
new DEFINER/invoker RPCs are locked down (REVOKE→GRANT, pinned search_path, in-body
authorization), the condition evaluator (Rule 3) is byte-for-byte unchanged with the
aggregates additive at compute time, no free-text/PHI reaches the audit log, and the
four gate bugs are fixed at their true root cause with recurrence-proof forwarding.
Keep the `getLatestSnapshot` ref.
