---
id: DEFINER-SEARCH-PATH-NARROW-FIX
title: "The 419 ratchet freezes the non-empty DEFINER search_path population, and the narrow ALTER FUNCTION migrations converge the two named members"
status: in_progress
kind: fup-fix
program: AUTHZ
phase: "pre-AE5 remediation — ADR 0208 D5 + D6; ordered BEFORE AE5-ROLE-CATALOG-COMPAT (ruled 2026-09-11)"
branch: definer-search-path-narrow-fix   # cut from main @ 6d7dd589
plan: ../plans/authz-evolution.md
progress: ../progress/definer-search-path-narrow-fix.md
reviews: []
adrs: ["0195", "0208", "0209"]
handoff: ~
fup: FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH
---

# DEFINER-SEARCH-PATH-NARROW-FIX — the prospective gate and the narrow convergence

Owed by ADR [0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D5 + D6 (its scope sentence: *"the one `ALTER FUNCTION`, the 419 ratchet, the `.claude/rules/`
hint, and the four targeted tests"*), widened by one door under
`FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` § *Scope added* (ADR
[0209](../decisions/0209-the-act-hat-is-a-door-level-term-on-the-professional-profile-read-door.md)
§ *Considered and held*). Closes the follow-up's re-claused *Closes when* (both deliverables).

## Acceptance criteria

- [ ] **AC-1 — the 419 ratchet.** `supabase/tests/419_*.sql` holds the `prosecdef` functions in
      `app`/`public`/`authz` carrying a NON-empty `search_path` as a **frozen name set that may only
      shrink**: a function not in the set carrying a non-empty path reds; a member converging to `''`
      is a shrink and stays green. The set is a **generated, committed artifact** with a `--check`
      (ADR 0197's pattern), never a hand-typed list. Red-first: a planted new non-empty DEFINER is
      seen; a dead-instrument control distinguishes VOID from PASS. `414` is kept unchanged.
- [ ] **AC-2 — the narrow migration, two members.** `ALTER FUNCTION public.tenant_orphan_profiles()
      SET search_path = ''` (0208 D6) and `ALTER FUNCTION app.can_read_professional_profile(uuid,
      uuid) SET search_path = ''` (FUP § Scope added), no body re-emission; the `413` pin on the
      second moves in the SAME change. `app.tenant_orphan_profiles` is NOT touched.
- [ ] **AC-3 — the four temp-table DEFINERs measured, not assumed.** Targeted pgTAP for
      `app.copy_response_answers` · `app.copy_template_version_children` · `app.copy_version_children`
      · `public.clone_framework`: each proves its behaviour today AND measures, in a rolled-back
      savepoint, whether it still works under `search_path = ''` — so "not a free change" becomes a
      per-function verdict. ⛔ No catalog-wide sweep.
- [ ] **AC-4 — the `.claude/rules/` hint**, path-scoped to `supabase/migrations/**`, naming the
      419 ratchet as the enforcer (CLAUDE.md §8: a rule is a hint, never a substitute).
- [ ] **AC-5 — open half 1 ruled**: what happens when `414 § 0b`'s 890/890 moves (a DEFINER with no
      `search_path` at all) — stated in the record and the FUP, not left pinned.
- [ ] **AC-6 — gates**: fresh `db reset` + `test:db`, `npm run lint`, diff-scoped door sweep both
      arms, backend-state seam slice appended + `## Current state` replaced.

## Current state

### Objective
Land ADR 0208 D5 + D6 so the follow-up closes, before `AE5-ROLE-CATALOG-COMPAT` writes a new DEFINER.

### Done since start
- Branch cut from `main @ 6d7dd589`; ordering ruled in the handoff and ADR 0207 (2026-09-11).
- AC-1..AC-4, AC-6 BUILT red-first (`backend`): migration `20261003007410` (two `ALTER FUNCTION`),
  pgTAP `419` + generated freeze artifact (867 → 865, pure deletion) + gate 18 `lint:definer-freeze`,
  pgTAP `420` (four temp-table DEFINERs all measured **free**), the `413` pin flipped, `409 § 6.1`
  reshaped (an unenumerated third reader of the constant), one-line D5 hint (rules dir at 12/12).
- Gates on the built tree: fresh `test:db` 269/9048 rc 0 · `lint` rc 0 · typecheck rc 0 · vitest rc 0 · `gen:types` no diff.
- Two follow-ups filed (four-DEFINER convergence unruled; D5 rule file deferred on the cap); AC-5
  disposition PROPOSED in the FUP body, PO to rule.

### In progress
- Door sweep both arms on `app.can_read_professional_profile` (exit 1 ruled: option (a), by hand); then the build commit.

### Next
- QA review (`qa`) → PO approval (AC-5 ruling + the two follow-ups + the door-sweep ruling presented together) → Record step → merge → then `AE5-ROLE-CATALOG-COMPAT`.

### Blockers
- None.

**Updated:** 2026-09-11
