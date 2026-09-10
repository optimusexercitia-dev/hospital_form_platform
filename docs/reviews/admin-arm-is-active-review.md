# QA Review — ADMIN-ARM-IS-ACTIVE (pre-AE5 remediation Batch 10)

**Reviewed:** branch `authz-admin-arm-is-active`, tip `c5a52efb` (tip-gate ruled at `a74f2409`,
one commit added after it for the two targeted mutation cases). Base `main` @ `b87eac1e`.
**Reviewer:** qa. **Date:** 2026-09-10.

## Scope and method

Read: the hub (`docs/features/admin-arm-is-active.md`) and the full progress record
(`docs/progress/admin-arm-is-active.md`, all seven dated entries); `batch10-rulings.md`,
`batch10-backend-plan.md` (measurements only, where a ruling rests on them),
`batch10-targeted-brief.md`; ADR 0201 (D4, D5, both 2026-09-10 dated notes), the migration
`20261003007390_admin_arm_follows_account_state.sql`; `git log`/`git diff --stat main...HEAD`;
the lead's tip-gate driver output (`tipgate-a74f2409/*.rc`, `*.log`, `derive-*.err`).

Independently queried the **live catalog** (`docker exec supabase_db_azkbbhskturikxpgmafq psql`),
never migration text, per ADR 0078 — the stack was left running throughout, no `supabase db
reset` issued, all catalog mutations done inside rolled-back transactions:

- `pg_get_functiondef` on `app.is_admin()`, `app.is_admin_for(uuid)`, `public.assume_role`,
  `app.is_active(uuid)`, `app.can_manage_professional`, `app.can_manage_case_vocabulary`,
  `app.can_manage_external_participant`, `app.audit_write(...)` — every body matches the record's
  quotes verbatim, including the keying (caller-keyed at site 1 and 3, subject-keyed at site 2),
  the door-wide placement of the R1 gate after `session_selectable`, the R10 triple `null::uuid`
  in the `audit_write` call, and D5's arm present only on `can_manage_case_vocabulary`.
- `md5(pg_get_functiondef('public.assume_role'))` = `c721f45a459cc73c1e3c0db97f00ff8f` — matches
  the fingerprint pinned in the record and in the targeted-cases script exactly.
- **An independent plant, not copied from the harness**: took the actual seed persona
  `suspenso.temp@test.local` (`00000000-…-d3`, `suspended_until` in the future, holding a live
  `staff` membership on commission `a0000000-…-a1`), set `request.jwt.claims` to impersonate it in
  a transaction, called `public.assume_role('staff')` — denied `42501 papel não disponível para
  este usuário` (BEFORE). Replaced `if not app.is_active(v_uid) then` with `if false then` on the
  **live** body inside the same transaction, confirmed the substitution applied, called
  `assume_role('staff')` again — **succeeded** (AFTER, gate neutralized). Rolled back; re-read
  `md5(pg_get_functiondef(...))` = same `c721f45a…` — restore proven. This reproduces R1's
  door-wide claim end-to-end against a real account, not a synthetic fixture.
- Re-ran `CASES="public.assume_role" bash supabase/tests/mutation/authz-command-door-targeted-cases.sh`
  and `CASES="app.audit_write" bash …` (both rc 0) — output matches the record's quoted RESULT
  lines and exact cell counts verbatim (2a: 418 red on exactly 5 pinned §3 cells, 408 green; 2b:
  315 red on exactly 2 cells, 418 green; CASE 3: 315 red on exactly 8 cells, 408 green; all
  fingerprints restored).
- `python scripts/gen-authz-differential-cells.py --check` → `in sync (1080 cells, 1920 skipped,
  sha 2ddda77978bb)` — matches the record exactly; row 31's representative
  (`org.participants.external.manage`, `can_manage_external_participant`, `organization`) present
  in the generator's `REPS` list at line 102.
- `npx supabase test db supabase/tests/418_admin_arm_is_active.sql` (self-contained, file ends in
  `rollback;`, confirmed by reading) → `Files=1, Tests=30`, PASS — reproduces the builder's own
  "Observed, NOT fixed" discrepancy against the file's header comment (see MINOR below).
- `git diff --name-only main...HEAD -- src` = exactly `session.ts` + `session-is-admin-mirror.test.ts`
  (R3). `src/lib/queries/session.ts`'s `deriveIsAdmin` mirrors the three conjuncts caller-keyed,
  matching `app.is_admin()`'s live body term-for-term; `session-is-admin-mirror.test.ts`'s own
  docblock states rows 2/3/5 were RED before the third conjunct.
- `docs/decisions/0201-…` diff: exactly two dated notes appended (R1's widening, L1's 111/338
  re-measurement) — no line of the original decision text edited, no new ADR file created.
- `git log origin/main..HEAD` / `git branch -r`: branch not pushed. `docs/followups/follow-ups-open.md`:
  0 hits for this unit's follow-up drafts — correctly unfiled pending the Record step.
- Tip-gate directory: every `*.rc` read bare — all `0` except `door-write.rc = 3` (the designed
  loud stop for `CASES` empty-by-derivation, matching `door-write.log`'s
  `SELECTION-SOURCE: CASES set and EMPTY -> selects NOTHING (UNPROVEN, exit 3)`); `hat.log` shows
  `4 finding(s), all reasoned-allowlisted` with `public.assume_role` among them; both
  `derive-*.err` carry the identical `SCOPE: 1 file(s) — 1 committed (main..HEAD)…` line;
  `testdb.log` tail shows `Files=267, Tests=9019 … Result: PASS`.
- 401 §19.2b/§19.2c and 403 §2.3b read in full: the re-ruled text is substantive (keyed on
  representative existence, not re-coded to whatever number the new state produces) and its own
  prose explicitly forbids raising the count to match reality without a representative backing it
  — consistent with "never silence a red."

**Not independently re-run**: the full pre-migration RED-first derivation for pgTAP 418 (would
require reverting three live bodies to the pre-migration state and re-running all 30 cells — the
record's own re-measured figures, `13 of 30 red`, are taken as reported, with one direct plant
reproducing the mechanism above); all 20 landing-needle plants individually (one independently
reproduced end-to-end); the 26-policy/13-function and 14-door/12-behaviourally-affected blast
radius counts (not recomputed from `pg_policies`/`pg_proc` by hand); `npm run test`, `npm run
lint`, the four authz arms and `e2e:prod` themselves (taken from the tip-gate log files, which
show bare `rc 0` throughout, consistent with everything this review did independently query).

## Findings

No BLOCK findings.

**MINOR — `418`'s header `RUN SHAPE` comment is stale, and the staleness is real, not narrated.**
`supabase/tests/418_admin_arm_is_active.sql:40` reads `Files=2, Tests=31` (30 + `00_setup.sql`'s
one). Independently measured: `npx supabase test db supabase/tests/418_admin_arm_is_active.sql`
gives `Files=1, Tests=30` on this CLI (v2.115.0) — the file runs standalone without
`00_setup.sql` needing to be passed alongside. The record already surfaces this ("Observed, NOT
fixed… For the lead to rule") rather than silently leaving it. Not blocking — it is a comment
about diagnostic bookkeeping, not a gate or a security predicate — but the comment's own stated
purpose ("a stale RUN SHAPE is read as the expected shape by the next person diagnosing a count
mismatch") means it should be corrected to `Files=1, Tests=30` at or before the Record step.

**MINOR — the `CASES=` empty-selects-all vs empty-selects-nothing divergence is disclosed, not
introduced, and should get a follow-up rather than stand as tribal knowledge in one file's
header.** `supabase/tests/mutation/authz-command-door-targeted-cases.sh:69-72` documents, for the
first time, that an empty/unset `CASES` here selects **every** case, while
`scripts/door-sweep-cases.sh`'s consumers (the `p0-authz-*.sh` family) treat an explicitly-empty
`CASES` as a third state that selects **nothing** and exits 3 — precisely the shape a prior batch
was burned by (`docs/learning/LESSONS.md`'s "empty is the third state" lesson). The `CASES=`
convention in `authz-command-door-targeted-cases.sh` pre-dates this batch (CASE 1 already used it);
Batch 10 only added CASE 2/3 to the same file and is the one that surfaced and documented the
divergence — a genuine improvement, not a regression, and correctly left unfixed as out of this
unit's ruled scope. Recommend a follow-up to either unify the semantics across the two script
families or add a runtime guard that treats explicit-empty `CASES` the same way in both, so the
next engineer who reflexively writes `CASES=` (having learned the deriver's lesson) does not get
the opposite of what they expect from this home.

**NOTE (could-not-verify, work item for the lead) — the 26-policy/13-function and
14-door/12-behaviourally-affected blast-radius counts were not recomputed by this review from
`pg_policies`/`pg_proc` directly**; they were taken from the plan's/record's stated re-measurement,
which the record itself frames as reproducing Batch 9's own prior figures. Nothing in this review
contradicts them, but a from-scratch recount would close the gap between "reproduces the plan's
number" and "independently derived."

**NOTE (could-not-verify) — 17 of the 20 landing-needle plants and the full pre-migration
RED-first run for pgTAP 418 were not independently re-executed.** One plant (site-3 door-wide
gate, on a real suspended persona) was reproduced end-to-end by this review, matching the
record's mechanism exactly; the remainder rest on the record's own bracketed-transaction
methodology, which is sound and consistent with everything else independently spot-checked.

## Verified-facts list

- `app.is_admin()` — `… and (app.active_role() is not distinct from 'platform_admin') and
  app.is_active(auth.uid());` — caller-keyed, JWT-claim fast path still present, as declared.
- `app.is_admin_for(uuid)` — `… and app.is_active(p_user_id) and (p_user_id is distinct from
  (select auth.uid()) or app.active_role() is not distinct from 'platform_admin');` —
  subject-keyed.
- `public.assume_role` — `if not app.is_active(v_uid) then raise … '42501'` sits immediately after
  the `session_selectable` check and before both the `platform_admin` and tenant-tier seating
  branches; the `active_role_selections` upsert and `app.audit_write(...)` call both still fire,
  with `p_commission`, `p_organization`, `p_hospital` all `null::uuid` for every tier.
- `app.is_active(uuid)` fails closed: `coalesce(is_active and (suspended_until is null or now() >=
  suspended_until), false)` — absent profile / null uid → `false`.
- `app.can_manage_professional` — the `is_admin_for` disjunct is gone, `select p_uid is not null
  and app.is_org_admin_of_for(p_org, p_uid);` only. `app.can_manage_case_vocabulary` — explicit
  `app.is_admin_for(p_uid) or app.can_manage_professional(p_org, p_uid) or
  app.is_org_commission_staff_admin(p_org, p_uid)`. `app.can_manage_external_participant` —
  unchanged, no platform arm (option (b) correctly rejected).
- Live plant (this review, independent of the builder's harness): suspended seed persona `d3`
  denied `assume_role('staff')` before, seated after `is_active` gate neutralized, restore proven
  by md5 equality after rollback.
- Targeted mutation cases 2 and 3 (`CASES="public.assume_role"`, `CASES="app.audit_write"`)
  re-run: both rc 0, `1 of 1 case(s) COVERED`, exact cell counts (5, 2, 8) match the record.
- `gen-authz-differential-cells.py --check`: in sync, 1080 cells / 1920 skipped / sha
  `2ddda77978bb`; row 31's representative is a fifth, dedicated `REPS` entry, not a repurposed one.
- `src/lib/queries/session.ts`'s `deriveIsAdmin` — extracted, three conjuncts, caller-keyed,
  fails closed on a missing profile; `git diff --name-only main...HEAD -- src` is exactly the two
  files R3 names.
- Migration header's declared-tightening paragraph is present verbatim and is not folded into any
  no-regression claim (L3); ADR 0201 carries exactly two dated notes (R1, L1), no rewritten
  figures, no new ADR number; branch not pushed; the three follow-up drafts are absent from
  `docs/followups/follow-ups-open.md`.
- Tip-gate `*.rc` files all bare `0` except `door-write.rc=3`, which matches the documented
  designed-loud-stop for an empty `CASES` derivation, not a failure.

## Overall assessment

Every claim in the record this review chose to spot-check against the live catalog reproduced
exactly — function bodies, fingerprints, cell counts, gate sync state, and rc values — including
one plant reproduced independently end-to-end against a real (not synthetic) suspended account,
and both targeted mutation cases re-run from scratch. The three `is_active` sites are keyed
correctly and consistently with the surrounding predicates (ADR 0193 D5); the door-wide `assume_role`
gate sits after `session_selectable` as declared; the R10 audit stamp nulls exactly the three scope
columns while still writing the row; the Class-2 arm is relocated, not duplicated, with the
rejected option (b) correctly absent from the live catalog. The re-ruled 401/403 assertions are
substantive rewrites keyed on representation, not numbers quietly bent to match a new reality, and
row 31's own representative closes the coverage gap the record found (and that the plan had wrongly
ruled out) rather than papering over it. The unit's own self-auditing already caught and fixed two
assertion defects (a comment-quoted needle, a vacuous `p_uid is not null` check) and two builder
errors in the targeted cases (an undercounted pin, an unfireable residue check) before this review
ever ran — the discipline visible in the record held up under independent re-measurement. Scope
discipline is clean: no ADR beyond two dated notes, no hub edit by the builder, no push, follow-ups
correctly unfiled. The two MINOR findings are both already-disclosed, non-blocking loose ends
(a stale diagnostic comment; a documented-not-introduced `CASES=` semantic divergence worth a
follow-up) rather than defects in what was built.

---

**Verdict: APPROVED**
