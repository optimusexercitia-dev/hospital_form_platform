---
id: AE4-D-SHAPE-ASSERTION
title: "The candidate fan-out D gets its six-clause shape assertion — every clause of ADR 0208 D2 asserted on the live catalog through the P2 instrument, red-first in pgTAP, with D3's five re-measurement triggers named where a reader will find them"
status: in_progress
kind: fup-fix
fup: FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED
program: AUTHZ
phase: "post-AE5-ROLE-CATALOG-COMPAT — ADR 0208 D2 (the D1 invariant's assertion) + D3 (the triggers); the only ADR 0208 unit still owed (its § Consequences dated note, 2026-09-13)"
branch: ae4-d-shape-assertion   # cut from main @ c71e7c33
plan: ~
progress: ../progress/ae4-d-shape-assertion.md
reviews: []
adrs: ["0183", "0208"]
handoff: ~
---

# AE4-D-SHAPE-ASSERTION — the six-clause shape assertion on the candidate fan-out

Owed by ADR [0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D2, which orders it to this unit by name; D1 is the invariant it asserts (`D ≤ F` and
`Dₖ ≤ min(F, |scopesₖ|)` over a provider-neutral fact set — a **parametric structural invariant plus
accepted operational risk**, ⛔ never *"large `D` is unreachable"*, ⛔ no numeric ceiling), and D3
names the five re-measurement triggers this unit writes down where its own artifacts point. The
instrument is the existing one — `scripts/authz-ae4-p2-invocation-count.sql` (ADR
[0183](../decisions/0183-p2-invocation-count-respecification.md) D4), `pg_stat_get_function_calls`
keyed by OID under a per-session `track_functions='all'`, ⚠ NULL not 0 cold. ⛔ AE5 itself stays
post-pilot (ADR 0155 G1); ADR 0207 D5 step 6 (the capability-plane mapping) is NOT this unit.

## Acceptance criteria

Every cell is **RED-first**: written before its subject, observed red against a mutated or planted
state on the live catalog, and green only once the real surface satisfies it; a keystone green on
its first run is a finding, never a pass. ⛔ No cell may hand-copy the production candidate `CASE`
(ADR 0183 `:114-115`); ⛔ no cell may merely restate a clause in its own words (LEARN-024).

- [x] **AC-1 — clause 1, provenance.** Every candidate the producer emits originates from an
      entitlement-provider fact: for every seeded principal and each resolution kind, the candidate
      set is contained in the scopes derivable from that principal's provider facts. A candidate
      with no fact behind it reds the cell (planted red).
- [x] **AC-2 — clause 2, one fact ⇒ at most one candidate per kind.** For a fixed principal and
      kind, the pre-deduplication candidate count is ≤ `F` (the producer's fact count); a fact that
      yields two candidates for one kind reds the cell (planted red).
- [x] **AC-3 — clause 3, dedup before confirmation.** Measured on a principal whose facts overlap on
      one scope (two commission facts, one org) the confirmer runs once per DISTINCT candidate, not
      once per fact — `U = D < raw`. Discrimination half: a principal with no overlap gives
      `U = D = raw`.
- [x] **AC-4 — clause 4, `U = D ≤ F`, split across the two files by a MEASURED limit.** `U` is
      counted as `authz.has_permission` invocations on the P2 instrument's method (counter delta,
      `coalesce(...,0)`, snapshot cleared, liveness calibration first) in
      `scripts/authz-ae4-p2-invocation-count.sql § 5`, at top level on the loaded AE4 perf fixture,
      against a `D` derived relationally (never off the counter), with a dedup-removed
      discrimination half; the pgTAP file asserts the half a transaction CAN measure, `D ≤ F`, and
      its header states why `U` is not there. ⚠ Re-worded 2026-09-13 from *"for each seeded
      principal × kind"* in pgTAP: the counter publishes nothing inside a transaction (Δ = 0 with
      and without `pg_stat_force_next_flush()`, Δ = 1 at top level) and the `dblink` side-session
      escape is closed on this stack (`postgres` is `rolsuper = f`; `dblink_connect_u` is
      `supabase_admin`-only) — record entry *measurement on the live catalog*. ⛔ `U` is therefore
      measured on ONE principal × ONE kind at the fixture's `D`, never on the seed, and never in
      `npm run test:db`.
- [x] **AC-5 — clause 5, one producer, two confirmers, asserted on the LIVE bodies.** The candidate
      CTEs of `authz.authorized_scope_ids(uuid,text,text)` and
      `authz.candidate_authorized_scope_ids(uuid,text,text)` are extracted from `pg_get_functiondef`,
      normalised (comments and whitespace stripped), and required equal; the two bodies differ only
      in their confirmer (`authz.has_permission` vs `authz.candidate_has_permission`). ⛔ A raw-text
      equality is forbidden (it reds on three comment lines and proves nothing). Discrimination half:
      a one-token change to one body inside a savepoint reds the comparator, measured on a channel the
      rollback cannot reach.
- [x] **AC-6 — clause 6, a new provider adapter fails the assertion until included.** The provider
      set is DERIVED from the catalog (not hand-listed) and every derived provider must be consumed by
      BOTH candidate CTEs; a planted provider adapter (a stub in the provider family, created inside
      the test transaction) reds the cell. This is the one D3 trigger that fires automatically.
- [x] **AC-7 — the instrument extended, not duplicated.** `scripts/authz-ae4-p2-invocation-count.sql`
      gains the clause-4 section on the loaded AE4 perf fixture (`U = D ≤ F` at the fixture's `D`);
      the pgTAP file (next free number after `422`) carries the six cells over the seed so they run in
      `npm run test:db` on a fresh reset. Both state what they do NOT prove.
- [x] **AC-8 — the record names D3's five triggers**, with what each invalidates, the ADR 0195
      statement (*"the next Phase Gate noticed"*, never *"the next commit noticed"*), and which trigger
      has a gate (clause 6) vs `prose only`.
- [ ] **AC-9 — gates.** Fresh `supabase db reset --local` + `npm run test:db`; `npm run lint` (0/0) +
      `typecheck` + `test`; the four authz arms + `SELFTEST` with `bash --version`; the diff-scoped door
      sweep (deriver exit code read BARE, `SCOPE:` quoted; exit 3 expected — no migration); the
      set-valued arm; `npm run e2e:prod` only if `src/` or a migration changes; the authz seam slice
      appended + its `## Current state` block REPLACED (the *"RULED NOT BUILT"* bullet retired); QA
      `APPROVED`; PO approval; `FUP-AE4-CANDIDATE-SCOPE-FANOUT-IS-UNBOUNDED` closed in BOTH homes.

## Current state

**Updated:** 2026-09-13

### Objective
Land ADR 0208 D2's six-clause shape assertion on the P2 instrument, red-first in pgTAP, and name
D3's five triggers in the record; retire the seam's *"RULED NOT BUILT"* bullet.

### Done since start
- pgTAP `423` (`plan(33)`, all 33 cells with an observed red — six catalog plants by anchored
  surgery on the live bodies, seven harness plants) and P2 `§ 5` (`U = D = 2 ≤ F = 20` on the
  fixture, dedup-removed control `U = 20`) committed at `7e655461`; backend's fresh reset +
  `test:db` PASS, `lint` 0/0, `typecheck`, `test` green. AC-4 re-worded (measured limit, above).
- Record: D3's five triggers tabled; triggers 1–3 now have a gate (`423 § 6` · `§ 6` · `§ 2`),
  4–5 stay `prose only`.

### In progress
- Lead's gate step 1 first pass: fresh reset + `test:db` PASS (272/9132), `lint` 0/0, `typecheck`,
  `test` green; deriver rc 3 NOT-APPLICABLE (no migration); four authz arms + SELFTEST (46/46,
  bash 5.2.37) hold. **Set-valued arm rc 1 DIRTY**: both resolver cases NOTICED — under the arm's
  mutation `423`'s extractor raises and the file aborts (run shape 9099 = 9132 − 33). Attributed
  to this unit; `backend` is making `423` capture-then-assert so no mutation can abort it; the arm
  is re-run by the lead afterwards (record entry *gate step 1, first pass*).
### Next
- QA review → PO approval → Record step (seam block re-stamped, FUP closed in both homes).

### Blockers
- The set-valued arm must return CLEAN with `423` in both cases' `reddened:` list before QA.
