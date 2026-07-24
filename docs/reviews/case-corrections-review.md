# QA Review — Case Correction Lifecycle (ADR 0085, branch `case-corrections`)

**Reviewer:** `qa` · **Date:** 2026-07-24 · **Round:** r1
**Verdict:** ✅ **APPROVED** — 0 P0 / 0 MAJOR / 2 MINOR (both non-blocking) / 5 INFO

Audit baseline: `~/.claude/plans/agreed-tender-pixel.md`, ADR 0085 (10 locked decisions),
ARCHITECTURE.md Rules 1/3/5/9/11/12. All schema/RLS/RPC facts below were read from the
**live local catalog** (`supabase_db_azkbbhskturikxpgmafq`, port 54322), never from migration
text (CLAUDE.md binding rule / ADR 0078 A28). Registered migrations == files (178 == 178);
the five `20260825*` correction migrations are the tail. Flag `case_corrections` = ON locally.

---

## Verdict rationale

The write-path for the two new workflow tables is **triple-locked and live-proven**: (1) no
table-level write GRANT to `authenticated`, (2) no RLS write policy, (3) a `SECURITY DEFINER`
guard trigger requiring an RPC-set GUC. Every one of the 9 new doors carries the full gate stack
(flag assert → authority → `assert_not_case_excluded` → `is_active` → open-case → state machine →
audit, pt-BR errors). No PHI/free-text reaches the hash-chained `audit_log`. The
`current_response_id` pointer sweep eliminates the two-submitted-rows double-count. No door offers
a recused/excluded party a side entrance. Every ADR-0085 locked decision is delivered.

---

## What I neutralization-tested LIVE (not taken on faith)

Executed as the table owner (RLS-bypassing) and as `set local role authenticated`, all in
rolled-back transactions on the local DB:

| Test | Expected | Result |
|------|----------|--------|
| Owner INSERT `case_narrative_revisions` w/o `app.in_correction_rpc` | guard raises | ✅ `check_violation` "revisões … só podem ser criadas pelas rotinas de correção" |
| Owner INSERT `case_correction_requests` w/o GUC | guard raises | ✅ raised (line 19) |
| Owner UPDATE `case_correction_requests` w/o GUC | guard raises | ✅ raised (line 19) |
| Owner INSERT `case_reopenings` w/o `app.in_reopen_rpc` | guard raises | ✅ raised (line 18) |
| `authenticated` direct INSERT `case_correction_requests` **with spoofed** `app.in_correction_rpc='on'` | RLS/grant denies regardless | ✅ `permission denied for table` (no INSERT grant — stronger than a policy deny) |
| `authenticated` SELECT `case_correction_requests` (member) | allowed via `can_read_case` | ✅ returns rows, no perm error |

The GUC-spoofing test is the important one: a hostile authenticated caller **cannot** forge the
`in_correction_rpc`/`in_reopen_rpc` flags into a write, because RLS + the missing GRANT sit in
front of the guard. The two layers are independent and both present — a genuine mutation-provable
defense, not a vacuous twin.

## What I verified by reading the live catalog bodies (structurally proven non-vacuous)

- **`approve_correction`** — authority (`is_staff_admin_of ∨ is_commission_admin_of`, **42501**)
  checked **before** exclusion (`HC0F1`) → the two raise **distinct SQLSTATEs**, so an
  "excluded admin cannot approve" keystone is unfalsifiable-by-construction *impossible* (the
  ADR-0079 vacuity trap is avoided). Phase arm verifies `draft.status='submitted'` **and**
  `draft.supersedes_id = current_response_id` (chain-tip) before re-pointing under `in_case_rpc`
  and recomputing; `HC061` mapped to pt-BR. Narrative arm snapshots the OLD body into
  `case_narrative_revisions` (under `in_correction_rpc`) then swaps body (under `in_narrative_rpc`)
  with **`concluded_at/by` untouched** — the anti-reopen keystone. `self_approved := auth.uid() ∈
  (requested_by, permitted_corrector)` recorded + audit-flagged.
- **`guard_supersession_coherent`** case arm — same-phase only, chain-tip (`supersedes_id =
  current_response_id`), and a real authenticated writer must hold the **open request's
  `permitted_corrector` slot** else `42501` (BUG-SUP-002 defense-in-depth preserved;
  `auth.uid() is null` service-role/DEFINER path trusted per ADR 0075). Standalone arm
  byte-identical. Trigger confirmed attached + enabled on `responses` (BEFORE INS/UPD).
- **`sync_case_phase_on_submit`** — early-returns when `supersedes_id is not null` (an unapproved
  successor takes **zero** phase effect; approval owns effect-taking) and when
  `target_case_participant_id is not null`; first-submit arm sets `current_response_id`.
- **Reader sweep (double-count elimination):** `app.case_phase_answer_map` (pointer +
  `status='completed'` so voided→`{}`), `app.case_phase_option_aggregates` (pointer),
  `get_case_detail` lateral (`r.id = cp.current_response_id`, replacing the nondeterministic
  `limit 1`), `start_or_resume_phase` (root `supersedes_id is null`). Swept every function
  referencing `public.responses` + `case_phase_id`: the aggregating readers all resolve the
  pointer. `app.submitted_form_responses` is correctly **standalone-only** (`case_phase_id is
  null`) and keeps its SUP latest-in-chain exclusion — untouched, no regression.
- **New tables' RLS** — `case_correction_requests`, `case_narrative_revisions`, `case_reopenings`
  each have RLS enabled, exactly ONE **SELECT** policy (via `can_read_case`, resolving the case_id
  for revisions through `case_narratives`), **no** write policy, and `authenticated` holds `r`
  (SELECT) only. `anon` absent from every ACL. Append-only guards block UPDATE/DELETE (cascade-only
  exception when the parent is gone).
- **All 9 doors** are `prosecdef = t`, owner `postgres`, `search_path` pinned, EXECUTE granted to
  `authenticated` + `service_role` only (**anon absent**). `prosecdef`-beside-`pg_policies`
  confirmed: the DEFINER doors are the sole write path; the policy-only view is not blind because
  I checked both.
- **Rule 12 / PHI** — every `audit_write` payload across file/start/save-body/resubmit/review/
  approve/reject/withdraw/reopen carries **only structured jsonb** (`kind`, `classification`,
  `case_phase_id`, `case_narrative_id`, `permitted_corrector`, `self_approved`, `previous_status`).
  No `reason`, `draft_body_md`, `last_rejected_reason`, or answer payload is ever logged. Free-text
  reasons live on RLS-scoped rows (`reason`, `last_rejected_reason`, `case_reopenings.reason`).
  `save_correction_draft_body` explicitly never audits the body. `can_read_correction_response` is
  scoped to `permitted_corrector` on an open request — a non-corrector member does **not** gain the
  predecessor read (no over-grant). Targeted-response phase corrections **refused at filing**
  (`HC0M5`).
- **Exclusion perimeter (weakest-mutator sweep)** — `assert_not_case_excluded` (raising the
  distinct `HC0F1`) precedes the mutation in **every** door, including the two "side-entrance"
  candidates: `withdraw_correction` (which DELETEs the in_progress draft) and `reject_correction`
  (which flips the successor `submitted→in_progress` under `in_submit_rpc`). No excluded/recused
  party can reach either mutation.
- **Requirements / schema** — CHECK constraints match the ADR verbatim: `target_xor`,
  `void_no_draft` (void ⇒ no draft of either kind), `draft_body_narrative_only`,
  `draft_response_phase_only`, `reason_not_blank`, `kind ∈ {correction,addendum,void}`,
  `classification` 5-value, `status` 7-value. Index swap correct: old
  `responses_one_per_case_phase_idx` dropped; `responses_one_root_per_case_phase_idx`
  (`supersedes_id is null`) + `responses_one_open_draft_per_phase_idx` (`in_progress`) added;
  `responses_one_draft_per_user_idx` correctly re-scoped to `case_phase_id is null`. Open-slot
  partial uniques present per phase and per narrative over the 5 open statuses.
  `guard_case_phase_status` allows `completed→voided` (under `in_case_rpc`) and adds `voided` to
  the terminal-DELETE block; **no** transition originates from `voided` (un-void impossible).
  Blocks sweep: `activate_phase` treats `voided` as settled (`status not in
  ('completed','not_required','voided')`); `close_case`/`cancel_case` gate on remaining
  `pending`/`active` (voided is neither → settled). `reopen_narrative` fully dropped (0 in
  `pg_proc`).
- **Code quality** — no inline supabase-js in correction/narrative components (Rule 9 respected;
  data access via `src/lib/queries/corrections.ts` + `src/lib/corrections/actions.ts`).
  `mapCorrectionError` covers every `HC0M*` + shared gate code with pt-BR strings; raw
  Postgres errors do not reach the UI. `reopenCase` in `src/lib/cases/actions.ts` maps `HC0M8`.

---

## Findings

### MINOR-1 (non-blocking) — void approvals do not stamp `impact_snapshot`
`public.approve_correction` computes `v_impact` (downstream active/completed phases) only in the
phase correction/addendum arm; the **void** arm and narrative arms leave it null, so approved
**void** requests carry no `impact_snapshot`. This matches the *plan's* door spec (which scopes
the snapshot to correction/addendum) but is in tension with ADR-0085 decision 7's general wording
("an `impact_snapshot` … is stamped on the request **at approval** for the accreditor's
question"). A void has arguably larger downstream impact (it clears a result feeding
`recompute_recommendations`), so the accreditor's "what was active downstream when this phase was
voided" question is unanswered. Not a security/data-integrity issue and voids are recoverable via
`add_ad_hoc_phase`. Recommend either capturing `v_impact` in the void arm too, or reconciling the
ADR text to state the snapshot is correction/addendum-only. *Verified by reading
`approve_correction` live.*

### MINOR-2 (non-blocking, cosmetic) — `mapCorrectionError` collapses all `23514` to "feature unavailable"
`src/lib/corrections/actions.ts:117-119` maps `PG_CHECK_VIOLATION ('23514')` →
`MESSAGES.unavailable` ("O recurso de correção de casos não está disponível."). But `check_violation`
is also raised by the doors for invalid-state transitions (e.g. two coordinators racing an approve,
or a stale review), where "recurso não disponível" misdescribes the situation ("the request already
changed state" would be truthful). These states are largely UI-guarded so the path is rare;
purely a UX-copy imperfection, no functional impact. *Verified by reading the TS map + the doors'
`check_violation` raises.*

> **✅ Resolved 2026-07-24 (BE-8).** `app.assert_case_corrections_enabled()` now raises `HC000`
> (the codebase's shared feature-off sentinel — mirrors `assert_ethics_enabled` / `assert_charters_enabled`
> and the `HC000` handlers in `src/lib/ethics`, `case-recusals`, `action-items`) instead of bare
> `check_violation`. `mapCorrectionError` maps `HC000` → "não disponível" and bare `23514` →
> a new truthful "a solicitação mudou de estado…" message; `mapCaseError` gets the same `HC000` arm for
> `reopen_case`. Migration `20260826000100` (rewritten from the live catalog per the CLAUDE.md rule).
> pgTAP `264`/`265` flag-off keystones flipped to `HC000` + a new **K8b distinctness keystone** pins
> flag-off (`HC000`) ≠ invalid-state (`23514`); full suite `3783/3783`, typecheck·lint 0/0.

### INFO-1 — `case_phase_option_aggregates` lacks the `status='completed'` filter its sibling has
`app.case_phase_answer_map` filters `cp.status='completed'` (voided→`{}`); `app.case_phase_option_aggregates`
resolves `current_response_id` but has **no** status filter, so on a voided phase it would still
return the old score/flagged from the retained pointer. **Latent only:** its sole caller,
`app.compute_case_phase_result`, is never invoked on a voided phase (approve-void does not call it;
`sync_case_phase_on_submit` only fires on active phases). No live double-count or leak. Adding the
`status='completed'` guard would make it defensively consistent with `answer_map` and future-proof
against a new caller. *Verified: swept callers via `pg_get_functiondef` ILIKE.*

### INFO-2 — stale doc-comment mentions `reopen_narrative`
`src/lib/case-narratives/actions.ts:698` — a contract-first doc-comment still lists
`reopen_narrative` among the RPCs a stub wires to. The RPC is dropped, the stub is gone (BE-6), no
live export/caller exists. Known nit (PROGRESS BE-6 row). Comment-only.

### INFO-3 — `save_correction_draft_body` audits with action verb `case_correction.draft_started`
The narrative-body save emits `case_correction.draft_started` ("Rascunho de narrativa salvo")
rather than a distinct `*.draft_saved` verb. Payload is structured + PHI-free; purely a
taxonomy nicety.

### INFO-4 (positive) — free-text reasons deliberately excluded from `audit_log`
The doors keep `reason`/`last_rejected_reason`/reopen reason **off** the hash-chained log (Rule 11
+ LGPD-erasure), storing them on RLS-scoped rows instead. This diverges from the live
`supersede_response` precedent (which logs its reason) — but the divergence is in the **correct**
direction. The lead has already flagged a follow-up chip to bring `supersede_response` into line;
no action needed in this feature.

### INFO-5 — test gate taken on faith (tester/lead-owned)
Per PROGRESS the feature is 7/7 green in the full `e2e:prod` suite (batches 2/3), with full-run
reds triaged to infra (`ERR_CONNECTION`/`supabase_vector` crash-loop) + notifications/nsp baseline
flake + one stale spec (`case-access.spec.ts` AC-6) since reconciled (T-2, 76/76 clean-stack),
and typecheck/lint 0/0 · vitest 390 · real `next build` OK. I did not re-run the suite (out of QA
scope) and rely on the tester+lead gate closure.

---

## Conclusion

Every ADR-0085 locked decision is delivered and enforced at the database boundary (RLS is the
security boundary, not the UI). The two MINORs are non-blocking (one governance-completeness gap
that matches the build plan, one UX-copy imperfection). **APPROVED.**
