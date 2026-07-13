# S1·SUP — Supersession correction — QA review

**Verdict: APPROVED** (re-review 2026-07-13 — BLOCKER B1 / BUG-SUP-002 closed; see the
Re-review section below. Original verdict `CHANGES REQUESTED` is retained beneath for the
record.)

**Reviewer:** `qa` · **Date:** 2026-07-13 · **Changeset:** S1·SUP (ADR 0074, plan
`docs/plans/supersession-correction.md`) · **Gate:** CLAUDE.md §6 step 3.

---

## Re-review (2026-07-13) — B1 / BUG-SUP-002 fix

**Verdict: APPROVED.** The BLOCKER is closed; no new issue introduced.

**The fix** (`20260720000600_supersession_core.sql`, `app.guard_supersession_coherent()`
L86–109): after the existing HC0H4/HC0H1 checks, when `new.supersedes_id IS NOT NULL` AND
`auth.uid() IS NOT NULL`, the guard now enforces (1) the flag via
`app.assert_response_correction_enabled()` (→ `check_violation`) then (2) authority via
`app.is_staff_admin_of(new.commission_id) OR app.is_commission_admin_of(new.commission_id)`
(→ `42501`). The trigger fires `BEFORE INSERT OR UPDATE OF supersedes_id`, so both the
direct-INSERT and the INSERT-then-UPDATE write paths are covered.

**Confirmed against the three re-confirm criteria:**

1. **Both write paths closed; RPC unbroken; exemption safe.**
   - The exact B1 exploit (non-admin direct INSERT of a coherent successor) now hits the
     `42501` authority arm — closed. The INSERT-then-UPDATE variant is covered by the same
     trigger's `UPDATE OF supersedes_id` clause — closed. `supersedes_id` cannot be set
     non-null without appearing in the write's column list, which always fires the trigger;
     there is no evasion path.
   - **`auth.uid() IS NULL` exemption is not a PostgREST hole:** `auth.uid()` reads the
     request JWT subject. Every authenticated PostgREST request carries a JWT ⇒ `auth.uid()`
     non-null ⇒ the enforcement arm runs for any real member. NULL occurs only for a
     service-role / no-JWT session (migrations, seed, trusted service ops per ADR 0075) —
     not reachable by an ordinary member over PostgREST. The exemption does not reopen B1.
   - **Legitimate RPC still passes:** `supersede_response` is `SECURITY DEFINER`, but
     `auth.uid()` inside the trigger still resolves to the real request caller (not
     `current_user`) — whom the RPC already verified as staff_admin/commission-admin with the
     flag ON — so the guard's arm passes. Empirically confirmed by pgTAP 14e/14f (RPC succeeds
     + emits exactly one `response.superseded`).

2. **pgTAP #14 is a real lock, not a vacuous pass.** 14a runs under a genuine non-admin member
   JWT context (`claims_for(st_x2)` + `set local role authenticated`) and asserts the exploit
   INSERT raises `42501`; 14b asserts the row count is 0 (blocked, not partially written); 14c
   asserts the INSERT-then-UPDATE variant raises `42501`; 14d (flag OFF) asserts a direct write
   raises `23514` (check_violation). Each would **fail if the corresponding guard arm were
   reverted** (`responses_insert_own` would otherwise permit the row), so they lock the fix.
   14e/14f lock the no-regression of the legitimate path. `plan(41)` matches the 35→41 bump
   (six new assertions). Backend reports fresh-reset pgTAP 2203/2203 (0 not_ok); the logic
   review is conclusive and consistent with that.

3. **M3 (stale `.next/types`) confirmed benign** — backend reports typecheck clean after
   `rm -rf .next`; no SUP file was ever implicated. Informational only, as originally noted.

**No new findings.** The MINOR items (M1/M2 — aggregation retrofit, RPC preconditions, audit,
t19 grants, TS twin, server-gated UI) remain correct and are unaffected by the fix. Rule 12
(PHI) unaffected. The changeset is gate-ready.

---

## Original review (2026-07-13) — verdict CHANGES REQUESTED (retained for the record)

**Verdict: CHANGES REQUESTED**

**Scope reviewed (only the SUP changeset):** migrations `20260720000600_supersession_core.sql`
+ `20260720000610_flag_response_correction_on.sql`; pgTAP `225_supersession.sql`; TS
`submissions.ts` / `dashboard.ts` / `feature-flags.ts` / `responses/actions.ts` /
`types/database.ts`; unit tests `dashboard.test.ts` / `submissions.test.ts`; UI
`correct-submission-button.tsx` / `supersession-badge.tsx` / `submission-row.tsx` /
`dashboard/submissions/[responseId]/page.tsx`; E2E `sup-supersession.spec.ts`; `seed.sql`.

The build is overwhelmingly conformant to ADR 0074 + the plan — the aggregation retrofit,
the RPC preconditions, the audit verb, the flag convention, the pt-BR mapping, and the UX
are all correct and well-tested. **However, there is one BLOCKER: an authority/RLS hole
that lets a non-admin forge a supersession chain by bypassing the RPC.** A single unmet
RLS/authority invariant is `CHANGES REQUESTED` regardless of the rest (per the QA posture
and Architecture Rule 1). Fix the BLOCKER and re-gate.

---

## BLOCKER

### B1 — The `supersede_response` authority gate is bypassable via a direct `responses` INSERT (Rule 1 / ADR 0074 §2 authority model)

**Where:** `20260720000600_supersession_core.sql` — `app.guard_supersession_coherent()`
(L65–94) is the *only* guard on a direct `supersedes_id` write, and it checks coherence +
shape only, **never authority and never the feature flag**. Combined with the pre-existing,
unchanged RLS INSERT policy `responses_insert_own`
(`20260711000800_perf_indexes.sql` L117–119: `with check (created_by = auth.uid() and
app.is_member_of(commission_id))`) and `GRANT ALL ON TABLE public.responses TO authenticated`
(baseline L22889, no column-level restriction on `supersedes_id`).

**The plan's "no new RLS policy needed" note (§2.1) is the root cause.** It reasons that the
successor INSERT is safe because the *DEFINER RPC* creates it. But nothing forces creation to
go **through** the RPC — the table's own INSERT grant + `responses_insert_own` let any
ordinary commission **member** (`staff`, not `staff_admin`/commission-admin) INSERT a row with
`supersedes_id` set directly (PostgREST `from('responses').insert(...)`).

**Exploit chain (confirmed against the migrations):**
1. Attacker = ordinary `staff` of commission X (fails the RPC's `42501` gate).
2. Victim has a submitted standalone response `R` in X.
3. Attacker directly INSERTs `{ created_by: attacker, commission_id: X, form_version_id:
   R.form_version_id, status: 'in_progress', case_phase_id: null, supersedes_id: R.id }`.
   - `responses_insert_own` RLS: **passes** (member + self-owned).
   - `guard_supersession_coherent`: **passes** (same fv + commission; `R` is submitted +
     standalone; successor standalone). It does not read `auth.uid()` or the flag.
   - `responses_one_successor_per_superseded`: passes (no successor yet).
   - **Flag OFF does not stop this** — the trigger never calls
     `assert_response_correction_enabled()`.
4. Attacker fills the draft with arbitrary answers and submits it via `submit_response`
   (baseline L15981 — INVOKER, only checks the row exists + is `in_progress`; the attacker
   owns the draft so `responses_update_own_draft` permits the flip). No `supersedes_id` /
   authority re-check at submit.
5. The retrofit `NOT EXISTS (… succ.status='submitted')` now **excludes the victim's genuine
   `R`** from every dashboard RPC + every derived indicator, and counts the attacker's forged
   answers as "latest in chain."

**Impact:**
- Privilege escalation: a non-admin performs a correction the ADR restricts to
  `staff_admin`/commission-admin (`42501` gate defeated).
- Data-integrity / metric corruption: a member can silently suppress another member's
  submission from all statistics and substitute arbitrary values — the exact "wrong figure
  counts" failure SUP exists to prevent, weaponized.
- Audit gap (Rule 11): the direct path writes **no** `response.superseded` row, so the
  governed correction happens with no attributed reason/actor trail.
- Works with the flag OFF, so it is not even contained by the feature gate.

**Why the tests miss it:** pgTAP check #8 (authority `42501`) exercises the **RPC** only; the
coherence-trigger check #7 asserts a mismatched fv is refused but uses an
`sa_x`-authored insert and never asserts that a *non-admin*, *authority-valid-shape* direct
insert is refused. So the suite is green while the hole is open.

**Suggested remediation (backend — not prescriptive):** enforce authority on the write path,
not only in the RPC. Options, in rough order of preference:
- Add the authority + flag check into `guard_supersession_coherent()` itself: when
  `NEW.supersedes_id IS NOT NULL`, require `app.feature_enabled('response_correction')` AND
  (`is_staff_admin_of(NEW.commission_id) OR is_commission_admin_of(NEW.commission_id)`), raising
  `42501` / the flag error otherwise. This closes both the direct-INSERT and the direct-UPDATE
  paths in one place (the trigger already fires `BEFORE INSERT OR UPDATE OF supersedes_id`).
  Note the RPC is DEFINER (runs as `postgres`) — ensure the guard resolves authority via
  `auth.uid()` (which is preserved under DEFINER) so the RPC's own legitimate insert still
  passes.
- OR tighten the RLS so a member INSERT cannot set `supersedes_id` (e.g. a `WITH CHECK` that
  requires `supersedes_id IS NULL` on the member-facing policy, forcing all supersession
  inserts through the DEFINER RPC).
- Either way, add a pgTAP check: a non-admin **direct** `INSERT` with `supersedes_id` set
  (valid coherence shape) is refused, and a direct insert with the flag OFF is refused.

---

## MAJOR

_None._

---

## MINOR

### M1 — Aggregation retrofit, RPC, and audit are correct and well-covered (informational, no action)

Recorded for the gate summary: the load-bearing items are conformant.
- `app.submitted_form_responses` (L272–289) adds exactly the specified `NOT EXISTS
  (… succ.supersedes_id = r.id AND succ.status='submitted')`; the `in_progress`-successor case
  is correctly *non-excluding* (pgTAP #2 + #1g).
- `commission_overview` (L303–335) is rebuilt on the **post-MEM** memberships-scoped body
  (`from public.memberships … role='org_admin'`, L329–332) — no reintroduced
  `organization_members`/`commission_members`; the same `NOT EXISTS` is added to **both**
  sub-selects (L317–320, L324–327). pgTAP #3 proves parity.
- TS twin `isDashboardCountable` (`dashboard.ts` L191–200) mirrors the SQL predicate exactly
  (`status==='submitted' && casePhaseId==null && !hasSubmittedSuccessor`); Vitest truth table
  passes (4 cases).
- RPC preconditions HC0H0–HC0H5 all fire with authority checked **before** state (no leakage);
  answer + `answer_selected_options` copy is scoped to the new `v_new.id` and joins the
  predecessor via `(response_id,item_id,group_instance_id)` — no cross-contamination
  (pgTAP #1f). `response.superseded` emitted via `app.audit_write` (mutation path, not the
  read allow-list) with reason + successor_id, no payload (pgTAP #10).
- t19 grant hygiene present on all five new/changed functions (`revoke all … from public`
  then grant to `authenticated, service_role`; L96–97, 122–123, 261–262, 295–296, 341–342);
  pgTAP #12 guards it.

### M2 — `canCorrect` and the UI affordance are correctly server-gated (informational)

`getSubmissionDetail` (`submissions.ts` L520–547) computes `canCorrect` server-side, mirroring
the RPC's authority gate exactly (staff_admin membership OR `isCommissionAdmin`, **no**
`is_admin` platform-admin fallback — correct per ADR 0041) plus flag ON + standalone +
submitted + no successor. The detail page (`[responseId]/page.tsx` L85–95) renders
`CorrectSubmissionButton` only when `detail.canCorrect`. The badge (`supersession-badge.tsx`)
conveys state by icon + text + shape, never color alone. The reason field is `required`, has a
`FieldLabel htmlFor="supersede-reason"` + `aria-describedby`, and the dialog focuses it on open
(keyboard-first). pt-BR error mapping in `actions.ts` covers all six SQLSTATEs + flag-off +
no_data_found + RLS; no raw Postgres reaches the UI (Rule 10). **This UI gating is correct —
but note it is UI-only; the server-side write authority is what B1 breaks.**

### M3 — `npm run typecheck` reports errors in generated route validators — NOT a SUP regression (informational)

`npm run typecheck` fails, but every error is in `.next/types/validator.ts` for the `cases`,
`documentos`, and `indicadores` layouts (stale generated route-type artifacts; `.next` is
gitignored/regenerated). No SUP file appears in any error (verified by grep). `npm run lint`
passes clean (exit 0); the two SUP Vitest files pass (8/8). This is a stale-`.next` artifact
from the working tree, not introduced by SUP — the lead's oracle ran on a rebuilt tree. Flag
only so the lead confirms a clean `next build` before recording; do not treat as a SUP defect.

---

## Requirements traceability (plan §8 acceptance)

| Item | Status |
|---|---|
| Aggregation parity keystone (§8 pgTAP #1) | ✅ correct (M1) |
| in_progress successor non-excluding (#2) | ✅ |
| commission_overview parity, post-MEM body (#3) | ✅ (M1) |
| Standalone-only / not-submitted / one-chain / coherence refusals (#4–7) | ✅ RPC path |
| **Authority (#8)** | ⚠️ RPC path ✅ but **direct-write path unguarded — B1** |
| Original immutable (#9) | ✅ guards unchanged |
| Audit / reason-required / t19 (#10–12) | ✅ (M1) |
| One-draft-per-user HC0H5 (#12b) | ✅ |
| Flag OFF (#13) — RPC | ✅ (but B1: direct write ignores the flag) |
| Rule 12 (PHI) | ✅ unaffected — standalone non-PHI responses only |

---

## Bottom line

**Original:** close **B1** (enforce supersession authority + flag on the `responses` write
path, not only in the DEFINER RPC) and add the corresponding pgTAP coverage.

**Re-review outcome:** B1 / BUG-SUP-002 is **closed** — the write-door authority + flag are now
enforced in `app.guard_supersession_coherent()` (both INSERT and UPDATE paths), the RPC path is
unbroken, the `auth.uid() IS NULL` exemption is not PostgREST-reachable, and pgTAP #14 (14a–14f)
locks it as a real regression guard. **Verdict: APPROVED.**
