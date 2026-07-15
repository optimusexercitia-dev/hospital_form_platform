# Session Handoff — Pre-Pilot Release Scope Expansion (ADR 0071)

**Last updated:** 2026-07-14 · **Branch:** `pre-pilot-release-s0` (**local is ahead of origin — unpushed**) · **Author:** lead session.
**Read this first when resuming.** It's the current-state pointer; the authoritative status is
[PROGRESS.md](../../PROGRESS.md), the settled spine is
[pre-pilot-release-s0-ratification.md](../plans/pre-pilot-release-s0-ratification.md), and the sequenced plan is
[pre-pilot-release-scope-expansion.md](../plans/pre-pilot-release-scope-expansion.md).

## Where we are

Building the 12-initiative pre-pilot release (ADR 0071) in stages **S0→S5**. All work is **local-first, reset-OK,
dark behind flags**; **remote deploy + the pilot DB reset are deferred to the end** (user-authorized).

- **S0** design gate — ✅ signed off.
- **S1 substrate** (MEM · SUP · N) — ✅ complete → [s1-substrate.md](s1-substrate.md).
- **S2 pilot cores** — ✅ **ALL COMPLETE 2026-07-14** (PO order IV2 → RV2 → AI).
  → [iv2-interviews.md](iv2-interviews.md) · [rv2-r1-referrals.md](rv2-r1-referrals.md) · [ai-satellites.md](ai-satellites.md).
- **S3 · ETH·E1** (access spine) — ✅ **COMPLETE + human-approved 2026-07-14** (`phase(E1)` `a9d1abb`).
  **The m2 gate is RELEASED** — `case_participants` + `case_types` are **ON** (local only; prod stays OFF until the
  pilot reset). QA APPROVED after **3 rounds**. Full record → **[eth-e1-access-spine.md](eth-e1-access-spine.md)**;
  ADR [0072](../decisions/0072-ethics-access-spine.md) carries an **As-built** section.
- **S4 🔜 NEXT** — ETH·E2 + RV2·R2–R5 + CH · **S5** ETH·E3a (E3b needs the deferred Phase 16). Phases 18–19 stay post-pilot.
- **Pre-pilot follow-up (PO-directed):** **BUG-AIF-001 / FUP-AI-1** — the platform-wide
  `router.refresh()`-in-`startTransition` deferred-flush stall — is scheduled **before pilot** as its own workstream.

## ▶ Resume here: open S4 — ETH·E2 (procedure) · RV2 R2–R5 · CH

**E1 → E2 is strictly sequential and E1's prerequisites are now satisfied.** Spec: ADR
[0073](../decisions/0073-ethics-procedure-model.md) + build plan `docs/phases/ethics-e2-procedure.md`; SQLSTATE
block `HC0F0–HC0F9` is **fully allocated** (any further ethics code needs a new S0-ratified block). Migration
high-water = **`20260720001070`** (next = `…001080+`).

**Three things to do before writing E2 code:**

1. ⚠ **Reconcile ADR 0073's uncommitted edits.** The working tree carries a **§D13/§D14 amendment** (respondent
   targeted-submission door + case-restricted hearings) authored **outside** the E1 session, plus two untracked
   `docs/design/temp/*handoff.md` files. E1 deliberately left them untouched. Decide/commit them first — §D14
   re-opens the X-η CH↔E2 meetings-file serialization.
2. **Read [eth-e1-access-spine.md](eth-e1-access-spine.md) §3 (the three RLS leak shapes).** E2 adds nine
   case-scoped tables; **every one of them is a candidate for the same class of bug**. The catalog-driven sweep in
   `supabase/tests/228_ethics_e1.sql` will catch a badly-shaped new table automatically — **don't weaken it**, and
   fix its two known limits (MINOR-A vacuous-pass, MINOR-B `action_items` fixture accident).
3. **Pick up E1's inheritance** — 3 known gaps + 2 sweep Minors, listed under PROGRESS → Follow-ups →
   *"ETH·E1 → ETH·E2 inheritance"*.

## How to run the track (the pattern that's worked all of S1–S3)

The lead is the orchestrator — **does not write feature code**; spawns teammates (warm across the session):
1. **backend** (`backend-engineer`): contract-first. For a migration/RLS/novel track, have it **orient via graphify,
   post a concrete migration+RLS+RPC plan, and STOP for lead ack** before applying. Then build → post the **frozen
   typed contract** + a **frontend punch list**. Local-first only (`supabase migration up`, regen types `--local`);
   **never `db push`**.
2. **frontend** (`frontend-engineer`): build UI against the frozen contract; **invoke the `frontend-design` skill**
   before new screens; verify whole-project `tsc`/`lint`/`next build` + a dev-server smoke test.
3. **tester** (`qa-tester`): extend the phase spec, run chromium (prod-standalone recipe), file bugs. Never edits app code.
4. **Lead runs the full `e2e:prod`** gate (subagents can't — 18-40min). Triage reds against the flaky baseline.
5. **qa** (`qa-reviewer`): writes `docs/reviews/…`; APPROVED/CHANGES.
6. **Human approval** → **Record** (rotate detail to `docs/progress/`, update PROGRESS + `docs/backend-state.md` +
   the ADR's As-built section, commit `phase(...): complete`, `graphify update .`).

**What E1 proved about this loop:** the QA step is load-bearing — it found two security holes a green
2537-assertion suite and a full E2E gate both missed. Budget for **multiple QA rounds** on RLS-shaped phases;
E1 took three, and round 3 found the worst one.

## ⚠ Caveats / gotchas for the resuming session

- **One owner for the local stack** — [[shared-local-stack-single-owner]]. `TaskStop` on the `e2e:prod` task does
  **NOT** reap its process tree (cmd→bash→npx→playwright→chromium); it ran ~30 min after being "stopped", its
  per-batch `db reset` corrupting a working agent's DB (empty `gen types`, "planned N, ran 0") and vice-versa.
  **Kill by PID and verify**, then `supabase stop && supabase start`. Never let a gate and an agent share the DB.
- **Verify `git branch --show-current` before every commit** — the tree was silently checked out onto a stale
  unrelated branch twice mid-phase (reverting 8 migrations off disk; 2 commits landed on the wrong branch).
  Nothing was lost (reflog + cherry-pick recovered it), but **check `git reflog` for a stray checkout before
  assuming files were deleted**. Don't `git add -A` — other sessions have work in this tree.
- **`e2e:prod` on Windows** always has a stochastic per-run **flaky/batch-collapse baseline** (~18–31 reds; a
  standalone-server death cascades a whole batch into `ERR_CONNECTION_REFUSED`). **Triage vs isolation**
  (`SPECS="..." RETRIES=0 npm run e2e:prod`), don't gate on zero — [[e2e-prod-build-flaky-baseline]].
  **E1 precedent:** a 2nd full run after a narrow fix was PO-skipped and **QA endorsed** the evidence composition
  (original full run + isolated re-confirmation of the touched specs + an independently-run full pgTAP).
- **Assert rows, not predicates** — pgTAP that checks `is(app.can_read_case(...), false)` **never exercises the
  policy layer**. That's how E1's MAJOR-1 passed 2523 green assertions. Use `set local role authenticated` + a real
  `select`, and **vary the persona class** (plain staff AND admin — they're different reach paths).
- **[[case-referral-column-grants]]** — `case_referral` has NO table-level authenticated SELECT; every new column
  needs its own `GRANT SELECT (col) … TO authenticated` or the hub 42501s.
- **Audit convention** — mutations via `app.audit_write`; the `log_audit_access` allow-list is for **reads** only.
- **RLS helper** — use `is_commission_admin_of` (ADR 0051); the old `is_org_admin_of_commission` was dropped.
- **`graphify-first`** is mandatory before grepping source (hook-enforced), for lead + every teammate.
- **PROGRESS.md is ~141 KB**, far over the <60 KB target (every spawn reads it). Pre-existing rotation debt; a
  partial test-run-archive rotation is **half-done and uncommitted** in the tree (rows currently duplicated between
  PROGRESS and the archive — finish or discard it).

## Remaining to the pilot (after S3)
S4 (ETH·E2 · RV2·R2–R5 · CH) → S5 (ETH·E3a; E3b needs deferred Phase 16) → BUG-AIF-001 workstream → then the
**Coolify app deploy** + **`git push` origin** (local is many commits ahead) + a final **pilot DB reset** (folds all
local migrations to remote — **this is when the m2 flip reaches production**) + Phase 9. Phases 18–19 stay post-pilot.
