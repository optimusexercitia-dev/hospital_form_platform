# ARM3-HAT-TERM-FIX — progress record

> Hub: [arm3-hat-term-fix.md](../features/arm3-hat-term-fix.md) · fixes
> `BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE` on the PO-ratified
> shape (bug body § PO ruling on the fix shape and its second duty, 2026-09-11) and carries
> `FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`. Branch:
> `claude/distracted-kapitsa-0d82de` (worktree), cut from `main` at `adbde005`.

Subjects: `app.can_read_professional_profile(uuid, uuid)` (one forward migration re-emitting the
body), `supabase/tests/403_ae45_differential_oracle.sql` (§7.4 retired by its own route; §4.1/§4.1b
carve-out dropped), the differential-cell generator and its vector (the 10-cell label),
`docs/backend-state/authorization-and-audit.md` (slice + block). ⛔ No `src/` change expected; the
signature does not move.

## Session log

### 2026-09-11 — unit opened; the subject measured from the catalog (lead)

**Tree.** Clean at `adbde005` (`main` and the worktree branch coincide). Local stack up
(`npx supabase status`), head migration `20261003007390`.

**Live body read from `pg_proc`, not migration text.** Four arms in order: arm 1
`app.is_admin_for(p_uid)`; arm 2a `app.can_manage_professional(v_org, p_uid)` **or** 2b
`authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')`; arm 3 the
`professional_participants → case_participants(live) → app.can_read_case_committee(cp.case_id, p_uid)`
traversal. The arm-3 comment still carries `exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3)` —
the follow-up's subject, confirmed live.

**The hat term as it exists today** (`app.has_role`, live): `p_user_id is distinct from auth.uid()
or p_role is not distinct from app.active_role()` — role-keyed by construction, so it has no
meaning inside a role-free arm. `app.active_role()` reads the `active_role` JWT claim.

**The vector's coordinates, derived (not quoted) from `authz_differential_cells.psql`.** `403`
binds `active_context` as `matching → staff_admin`, `other_role → quality_reviewer`, else NULL.
Class 5 (`arm3:divergent-defective:hat-unenforceable`, 10 cells): personas `subject_holder` (4),
`other_commission_holder` (4), `cross_org_actor` (2) — every one `other_role` · `self` ·
`grant_keyed` · state `active|pending`. Class 3 (`arm3:divergent-approved:not-a-holder`, 36 cells):
persona `unprivileged` = `f.nobody`, **no membership at all**, 12 cells each at `absent`,
`matching` and `other_role` — all GRANT. ⇒ the only property separating a class-5 DENY from a
class-3 GRANT at the same hat is **whether the caller holds any role**, which is why a hat check
keyed on the *hat alone* (mutant C) reds §4.1b. ⚠ **No holder cell exists at `absent` · `self` ·
`grant_keyed`** — that coordinate is unpinned and the plan must state its value.

**Homes written:** hub (`in_progress`), this record, `docs/features/INDEX.md` regenerated. CLAUDE.md
review queue: no entry newer than the 2026-09-11 processed marker.

### 2026-09-11 — the fix built: the ACT hat becomes a door-level term; §7.4 deleted, §7.4b written; six mutations (backend)

**Tree.** Worktree `claude/distracted-kapitsa-0d82de`, branch point `adbde005`, tip at open `ab54d339`,
clean. Local stack up; head migration at open `20261003007390`. ⛔ Nothing committed by this session —
the lead stages by path.

**Baseline BEFORE touching anything** (mutation step 1). Fresh `npx supabase db reset --local` rc **0**;
`npm run test:db` rc **0** — `Files=267, Tests=9023, Result: PASS`.

**The subject, measured from the catalog** (⛔ never from migration text), comment-stripped with
`regexp_replace(regexp_replace(prosrc, '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g')`, with two
DISCRIMINATING CONTROLS in the same query so the five negatives are findings rather than a dead needle:

| function | `active_role` | `auth.uid` |
| --- | --- | --- |
| `app.can_read_professional_profile` | ABSENT | ABSENT |
| `app._case_caps` | ABSENT | ABSENT |
| `app.can_read_case` | ABSENT | ABSENT |
| `app.can_read_case_committee` | ABSENT | ABSENT |
| `app.can_manage_professional` | ABSENT | ABSENT |
| `app.has_role` **(control)** | **PRESENT** | **PRESENT** |
| `app.is_admin_for` **(control)** | **PRESENT** | **PRESENT** |

**The 8-cell finding, re-measured before building.** At `other_role · self · holder persona ·
grant_keyed` the vector carried 18 cells: 10 `arm3:divergent-defective:hat-unenforceable`
(`expected_legacy_granted` false) and **8** `arm3:divergent-approved:cross-org` (**true**) —
`subject_holder` and `other_commission_holder` at `foreign_org_commission`, `cross_org_actor` at
`own_commission` and `sibling_commission`, each at `active` and `pending`. A door-level hat term denies
all 18, so the 8 needed a re-ruling (ADR 0209 D5, ⛔ **PO to ratify at approval**) or §4.1b would red on
them. ⚠ `absent · self · holder` carries NO cell — `build()` skips it by name
(`absent_unreachable_for_single_role_principal`), and `test_helpers.claims_for(uid, false, null)`
DERIVES the single live role, so that coordinate is pinned by 403 directly, never by a cell.

**The mutation table — every reading BARE, real files restored byte-identical (md5 verified).**

| # | state | measured |
| --- | --- | --- |
| 1 | head, untouched | `test:db` rc **0** — Files=267, Tests=9023 |
| 2 | 403 + vector edits applied, **migration held aside** | 403 rc **1** — §4.1 red on **18** cells, §4.1b red on **18**, §7.4b `have` = `door=true \| door=true \| door=true`. ⛔ Green on first run would have been a finding; it was not green |
| 3 | migration applied | 403 rc **0** (Files=2, Tests=28); `test:db` rc **0** — Files=267, Tests=9023 |
| 4 | **mutant A** — an org check inside arm 3 (caller must hold in the case's org), planted live, rolled back by reset | 403 rc **1** — **§7.5 REDS** (failed tests 14, 25, 26, 27). The PO's caveat still catches the shape it was written for |
| 5 | **mutant C′** — the "holds at least one live role" conjunct DROPPED from the door term | 403 rc **1** — **§4.1b reds on 36 cells, every one labelled `arm3:divergent-approved:not-a-holder`**; §7.4b line 2 flips to `door=false`; **§7.5 stays GREEN**. D3 is load-bearing and measured |
| 6 | **mutant D** — branch (5b) reverted in the generator, vector regenerated, migration KEPT | 403 rc **1** — §7.3's partition string red **and §4.1b red on 8** cells |

⚠ **Mutant D measured 8 where the approved plan predicted 18 — the plan's prediction was wrong, and it
is corrected here rather than the measurement being bent to it.** Reverting the label leaves the 10
ex-defect cells with `expected_legacy_granted = false` under BOTH labels, so §4.1b has nothing to
disagree about on them; only the 8 re-ruled cross-org cells regain a legacy GRANT that the fixed door
now denies. The 10 are caught by §7.3's partition string instead. ⇒ the relabel is guarded by two
sections rather than one.

**§7.3's partition string was RE-DERIVED by running its own query** against the regenerated vector
(loaded into a transaction, then `rollback`), never hand-edited:

```
arm3:blocked:principal-state=108/DENY arm3:divergent-approved:cross-org=24/GRANT arm3:divergent-approved:not-a-holder=36/GRANT arm3:masking=30/GRANT arm3:pre-empted:door-hat-term=18/DENY
```

Label census after regeneration: `not-in-gate` 864 · `blocked:principal-state` 432 · `masking` 60 ·
`silent:no-participation` 108 · `silent:caps-deny` 108 · `silent:reach-needs-a-role` 36 ·
`silent:reach-follows-the-hat` 18 · `divergent-approved:cross-org` 48 ·
`divergent-approved:not-a-holder` 36 · `pre-empted:door-hat-term` 18 — every count except the two that
moved is unchanged. Flip census **92 → 84**. `plan(27)` unmoved (one assertion deleted, one added).

**⭐ A GATE CAUGHT A REAL DEFECT IN THE FIRST DRAFT OF THE BODY, and the remedy was the code, never an
allowlist.** `ARM=hat` rc **1**: *"⛔ NEW HAT-BLIND GATE(S) — caller-bound raw memberships read, no
active-role condition: fn: app.can_read_professional_profile"*. `act-hat-blind-sweep.sh` splits a body
into statement CHUNKS on `;` and requires the hat evidence (`active_role(` / `has_role(` /
`has_role_any(`) to sit in the SAME chunk as the caller-bound `memberships` read. The draft hoisted
`v_hat := app.active_role();`, which put the evidence in the PRECEDING chunk. Fixed by calling
`app.active_role()` INLINE in both halves — which is what `app.has_role` itself does — and the reason
is written into the body so the next hand does not re-hoist it. Re-run rc **0**, and the door is
⛔ **not** on the allowlist: it passes on merit.

**Gate readings, every rc BARE.**

```
npx supabase db reset --local                      rc 0
npm run test:db                                    rc 0   (Files=267, Tests=9023, Result: PASS)
npm run lint                                       rc 0
npm run typecheck                                  rc 0   (see dead end 3)
npm run gen:types ; git diff --stat …database.ts   EMPTY
ARM=census                                         rc 0   (live 581 / verdicts 608)
ARM=hat                                            rc 0   (4 findings, all reasoned-allowlisted; this door not among them)
ARM=floor                                          rc 0   (63 never-called doors, all allowlisted)
FROMFINDINGS=1 ARM=wrapper                         rc 0   (BLIND set 41, all allowlisted)
SELFTEST=1 bash scripts/door-sweep-cases.sh        rc 0   PASS 46 · FAIL 0 · SKIPPED 0
bash --version                                     GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)
bash scripts/door-sweep-cases.sh adbde005          rc 0   1 case
door sweep arm 1 (CASES=…)                         rc 0   CLEAN — 1 COVERED, 0 BLIND, 0 ERROR
door sweep arm 2 (FROMFINDINGS=1 CASES=…)          rc 0   CLEAN — 1 COVERED, 0 BLIND, 0 ERROR
git diff --stat -- docs/reviews/authz-door-audit-findings.md   EMPTY (after both arms)
authz-setvalued-targeted-cases.sh                  rc 0
```

The deriver's three self-test GROUP lines: `deriver: scenarios 20 (pass 20 · fail 0 · skipped 0)` ·
`merge helper: scenarios 18 (pass 18 · fail 0 · skipped 0)` ·
`audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)`.

`SCOPE:` line, quoted verbatim:

```
SCOPE: 1 file(s) — 0 committed (adbde005..HEAD), 0 worktree, 1 untracked | filter: none | derivation: catalog
```

Both sweep arms printed `ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35`. The
set-valued targeted home printed `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with
dispositions)` and `RESULT: CLEAN — 3 resolver(s) measured, all COVERED`.

**Fixtures changed to seat a hat: NONE.** `test:db` runs `Files=267, Tests=9023` before and after —
identical. ⚠ Stated as a BOUND in both directions: it also means no suite other than `403` exercises a
holder self-checking this door under a non-held hat. Six seed principals hold 2 role TYPES
(`admin@`, `dualhat.a@`, `orgadmin.b@`, `pqsdual.a@`, `solo.c@`, `staff1.qual.b@test.local`), so the
token hook mints them NO hat at all — and none of them reaches this door under a self-check in any
committed suite.

**One fixture change INSIDE 403, and it is not an expectation edit.** `pg_temp.arm3_probe_at_hat`
resets the account state of all four f403 principals before probing. Without it §7.4b's GRANT half is a
dead half: the LAST cell of the sweep is `unprivileged | … | deactivated | third_party | none` (read off
the generated vector's tail), so §§3/6 leave `f.nobody` DEACTIVATED and `_case_caps` STEP 2 would shut
arm 3 — a keystone satisfied by a deactivation, the §6.0/F1 shape one section over. Proven live: in the
fix-ABSENT run line 2 read `door=true`, so the GRANT half is genuinely reachable.

**Dead ends and self-inflicted damage, recorded because they cost time and produced two FALSE
readings.**

1. ⛔ **`bash supabase/tests/mutation/p0-authz-invariant.sh` with no `ARM=` is `ARM=all`**, which starts
   with the **full 127-door policy arm** (~1 min per door) — not the census/hat/floor trio the plan's
   testing note describes. It also MERGES into the committed findings baseline as it goes. The four
   gate arms must be named one at a time: `ARM=census`, `ARM=hat`, `ARM=floor`,
   `FROMFINDINGS=1 ARM=wrapper`.
2. ⛔⛔ **`TaskStop` killed the shell but NOT the harness's `psql` child.** The orphan kept running for
   minutes: it (a) held locks that DEADLOCKED a `supabase db reset` (`SQLSTATE 40P01`, reset rc **1**),
   (b) kept half-merging `docs/reviews/authz-door-audit-findings.md` AFTER I had restored it, and
   (c) left `app.can_amend_referral_phi_snapshot` degenerate on the stack plus an
   `/tmp/authz-door-INFLIGHT.sql` sentinel. ⇒ **two census readings were void**: the first printed
   *"DEGENERATE GATE(S) LIVE ON THIS STACK — every arm below is UNTRUSTWORTHY"* in its own preflight,
   and a second run at the branch base read `verdicts 368 / live 581` **only because the orphan had
   mangled the committed baseline underneath it**. I briefly concluded `ARM=census` was a pre-existing
   red at `adbde005`; ⛔ **that conclusion was WRONG and is retracted here** — on a clean stack with the
   baseline at HEAD the arm reads `verdicts 608 / live 581` and exits **0**. The lesson is the harness's
   own: *pg_proc carries no mtime, so any result produced since the last known-good run must be RE-RUN,
   not re-read.* Recovery, in order: `pg_terminate_backend` the orphan · `git checkout --` the baseline
   (verified by an empty `git diff --stat`) · `RECOVER=1 bash …/p0-authz-door-audit.sh` (rc **2** by
   design) to clear the sentinel · `supabase db reset`.
3. ⚠ **`npm run typecheck` reds rc 2 in a FRESH WORKTREE for an ENVIRONMENT reason**, not a code one:
   `error TS2304: Cannot find name 'RouteContext'` at two route handlers. `tsconfig.json` includes
   `.next/types/**/*.ts`, and this worktree has neither its own `node_modules` nor `.next`. `npx next
   typegen` rc **0** generates them; `npm run typecheck` then rc **0**. ⛔ Nothing in this unit touches
   TypeScript — `git status` lists no `src/` file, and `gen:types` diffs empty.

**Out of this unit's scope, REPORTED rather than silently edited — two gate-input narratives the fix
made stale.** ⛔ Neither is changed by this session; both are a lead/PO call:

- `supabase/tests/vectors/authz-matrix-axes.json:117` — `caseReach.grant_keyed`'s description says the
  reach is *"hat-independent … which is why an explicit case grant survives a wrong or absent
  `active_role` (BUG-…-HAT-TERM-UNENFORCEABLE)"*. Still true of the REACH; ⛔ no longer true of the
  DOOR, and it cites a bug that is now fixed. Editing it re-shas the vector header.
- `supabase/tests/vectors/authz-enforcement-manifest.json:1240` — `org.professionals.read`'s
  `qualifier` narrates *"§ 7.4 pins the filed defect … the hat-substitution class a BUG"*. §7.4 is now
  deleted. That field carries its own append-with-history-quoted-in-full discipline, so a correction
  there is a separate, ruled edit.

### 2026-09-11 — the three blinded pins re-aimed at their own subjects; two stale narratives corrected (backend, follow-on)

**Tree.** Same worktree `claude/distracted-kapitsa-0d82de`, committed tip `ab54d339`, the previous
session's build UNCOMMITTED in the tree and left untouched. ⛔ Nothing committed, stashed or reverted by
this session. Local stack owned by this session; head migration `20261003007400`.

**What this session was for.** A read-only audit of every pgTAP caller of
`app.can_read_professional_profile` reported THREE existing assertions that the new door-level hat term
now answers FIRST — "an earlier guard firing leaves the LATER one untested". ⭐ The audit's list was
taken as a HYPOTHESIS and each item MEASURED, not accepted: **one of the three was not confirmed**, and
that is recorded below rather than quietly "fixed".

**The blinding measurement — two mutants, run as a 2×2 so each cell attributes the denial.** M1 =
the §6A hat conjunct in `authz.entailed_grants` replaced by `true` (the LAYER broken). M2 = the door's
`if p_uid is not distinct from (select auth.uid()) then` header replaced by `if false then` (the DOOR
TERM neutralized). Both planted live with `pg_get_functiondef` + `replace` + `execute`, each asserting
its own landing (⛔ a mutation that did not fully apply reports GREEN), both restored from a captured
`pg_get_functiondef` and proven **byte-identical by `diff`**, then re-derived again by `db reset`.

| state | `409 §4.14` (door probe) | `413 §4c` (policy) | `252` prof-profiles DENY |
| --- | --- | --- | --- |
| head, untouched | GREEN | GREEN | GREEN |
| **M1** (layer broken, door term LIVE) | **GREEN — BLINDED** | **RED** (`have: 1`, with §3b/§3c) | GREEN (not its subject) |
| **M1 + M2** (door term off too) | **RED** (1 of 75) | RED (same 3) | — |

⇒ **409 §4.14 is blinded and 413 §4c is NOT.** The reason 413 survives is the POLICY'S SHAPE, read off
`pg_policies` rather than assumed: `professional_profiles_select` is
`CASE WHEN organization_id IN (SELECT app.current_professional_read_organizations()) THEN true ELSE
app.can_read_professional_profile(id, (SELECT auth.uid())) END` — the short-circuit is the **WHEN** arm
and the door is only the **ELSE**, so a WHEN arm that answered `true` is visible whatever the door
concludes. A zero at §4c therefore still requires the short-circuit itself to deny, and M1 proves it.
⛔ **No change was made to §4c's caller**; seating a held hat there would have destroyed its subject.
A dated measurement note was added above it so the next hand does not "repair" it.

**Pin 1 — `252_authz_p0_isolation.sql`, `professional_profiles_select DENY` (CALLER changed).**
`foreign_uid` ..b3 holds TWO live codes (`staff` @ Qualidade B, `staff_admin` @ Farmácia B, read from
`memberships` live), so `claims_for(uid, false)` DERIVES nothing and the session carried **no
`active_role` at all** — the guard's D4 arm. Fixed by seating `'staff'`, a hat ..b3 genuinely holds and
which entails no `org.professionals.read`, so the short-circuit stays empty and the ELSE arm answers.
Discrimination by NEUTRALIZING THE NAMED SUBJECT (a `case_access_grants` read/deliberation row for ..b3
on `ca…e1`, the case seating the professional — `app.can_read_case_committee` verified `t` after the
insert), applied live and deleted afterwards:

| 252 with the isolation NEUTRALIZED | reading (bare) |
| --- | --- |
| OLD caller, hatless | rc **0** — GREEN. ⛔ The isolation predicate was never consulted |
| NEW caller, `'staff'` seated | rc **1** — RED on **exactly** test 41, the target line |
| neutralizer deleted, NEW caller | rc **0** — GREEN restored |

⚠ The registered harness mutation for this keystone (`p0b-isolation-mutation-audit.sh`,
`alter policy … using(true)`) is INSENSITIVE to this blinding — it removes the whole CASE, so it reds at
any hat. That is why the blinding survived a mutation-proven keystone. `plan(48)` unmoved.

**Pin 2 — `409_ae49_d6_rekey_differential.sql` §4.14 (option (c): the door line KEPT, the named layer
added head-on).** §4.14's stated subject is `authz.entailed_grants` carrying the §6A asymmetry, and the
door can no longer fail on it. ⛔ The expectation was NOT re-coded (LEARN-023): the `ok(not door(…))`
predicate is byte-unchanged and only its caption is dated-corrected. Added beside it:

- **`4.13b`** — `authz.has_permission(sa,'organization',oid,'org.professionals.read')` is TRUE under the
  MATCHING hat. The discrimination half: without it `4.14a`'s FALSE is indistinguishable from a wrong
  org, a missing grant or a broken fixture.
- **`4.14a`** — the same call under `'staff'` is FALSE. `has_permission` → `entailed_grants` carries its
  own hat conjunct and **no door shields it**.

| 409 state | reading (bare) |
| --- | --- |
| patched file, clean stack | rc **0** — Tests=77 |
| patched file + **M1** | rc **1** — RED on **exactly** test 66 = `4.14a`; `4.13b` GREEN, `4.14` GREEN |

⇒ the suite can fail on the re-key again. `plan(75)` → `plan(77)`; the RUN SHAPE line and its movement
notes updated in the same edit.

**Pin 3 — `413_ae4_authorized_scope_ids.sql` §4c: NO CALLER CHANGE, and that is the finding.** Measured
live to still red on its own subject (above). A ⚠ dated block quoting the live policy CASE and the M1
reading was added above the assertion. `plan(29)` unmoved.

**Completeness bound on the audit's list of three.** A read-only sweep of every `*.sql` under
`supabase/tests/` for `professional_profiles` / `can_read_professional_profile` traced the
claims-in-effect for each hit: 43 further files, **no additional blinded assertion**. Everything that
self-checks does so under a hat it holds — `415 §2.4` uses the 2-code principal ..b3 but passes
`'staff_admin'` EXPLICITLY, and every `bootstrap()` persona holds exactly one membership so its derived
hat matches. ⚠ **THE BOUND, stated rather than implied:** the sweep is keyed on those two strings, so a
test reaching the door through a DISPATCHER whose own text names neither (the `p_entity_id` routers in
the document / attachment / audio-minutes / referral-note migrations), or reading
`public.professional_participants` — whose `_select` policy calls the same door — without textually
mentioning `professional_profiles`, could not be seen by it. The `professional_participants` reads that
DO exist under RLS (`311`, `321`) were checked by hand and are single-role derived hats.

**Narrative 1 — `supabase/tests/vectors/authz-matrix-axes.json`, `caseReach.grant_keyed` (corrected in
place, house style).** The clause *"which is why an explicit case grant survives a wrong or absent
`active_role` (BUG-…-HAT-TERM-UNENFORCEABLE)"* is false OF THE DOOR since ADR 0209 and cited a fixed bug.
Corrected to separate the two: **hat-independent REACH, hat-gated DOOR** — S3/S4 still carry no role
lookup, nothing was added inside arm 3, and a caller holding NO live role is exempt. The superseded
clause is quoted in the replacement; the fix's own constraints (an org term reds §7.5, a role-keyed hat
check reds §4.1b) are written beside it.

⭐ **The edit's effect on the generated vectors was MEASURED, not asserted.** The axes edit was reverted
in place, both generators re-run, the outputs snapshotted, the edit re-applied and both re-run — the
revert round-trip reproduced the original sha `c3cbbdbd…` exactly, and the `diff` between the two
generations is **one line in each file**, the `-- sourceSha256` provenance stamp
(`c3cbbdbd…` → `c83883ef…`). Nothing about the oracle moved. `authz-matrix-coverage.json` moved its two
sha fields; `authz_enforcement_manifest.psql` moved its one (`15748c51…`-lineage → `41098e64…`).

**Narrative 2 — `supabase/tests/vectors/authz-enforcement-manifest.json`, `org.professionals.read`
(APPENDED per the field's own discipline, never rewritten).** The `legacyEquivalence.qualifier` says
*"§ 7.4 pins the filed defect …"* and §7.4 is deleted. The field's rule is "NOT closed by deleting the
sentence — HISTORY, THE SUPERSEDED TEXT QUOTED IN FULL", so a dated `⚠ CORRECTED 2026-09-11` segment was
APPENDED after the existing history quote, quoting the false clause in full, naming §7.4b as its
successor, and stating that the retirement itself is UNAFFECTED (it rested on §7.3 / §7.3b / §7.5 and
§4.1b, none renumbered). ⚠ **A SECOND COPY of the same stale citation was found in the same row** —
`residualArms[app.can_read_case_committee].population` also reads "§ 7.3/§ 7.3b/§ 7.4/§ 7.5" — and was
corrected the same way, on the same date, and cross-referenced from the qualifier. ⛔ Both fields are
NARRATIVE-ONLY, re-verified here rather than taken from the file's own claim about itself: `qualifier`,
`population`, `openArms`, `legacyEquivalence` and `residualArms` each appear **0** times in
`authz_enforcement_manifest.psql`, so no pgTAP expectation moved — only the provenance sha.

**Gate readings, every rc BARE (never through a pipe).**

```
npx supabase db reset --local                      rc 0
npm run test:db                                    rc 0   Files=267, Tests=9025, Result: PASS
npm run lint                                       rc 0   gate 12: matrix in sync (sha c83883ef9fea; manifest 41098e64a388),
                                                          differential in sync (1728 cells, 10272 skipped)
npm run typecheck                                  rc 0   ⚠ no `next typegen` needed — this worktree already carries
                                                          .next/types from the previous session's dead end 3
ARM=census                                         rc 0   live 581 / verdicts 608
ARM=hat                                            rc 0   4 findings, all reasoned-allowlisted; this door NOT among them
ARM=floor                                          rc 0   63 never-called doors, all allowlisted
FROMFINDINGS=1 ARM=wrapper                         rc 0   BLIND set 41, all allowlisted
git diff --stat -- docs/reviews/authz-door-audit-findings.md   EMPTY
```

⚠ **`Tests=9023 → 9025` is EXPLAINED, not absorbed:** exactly the two assertions added to 409
(`4.13b`, `4.14a`). No other file's count moved; 252 stays `plan(48)` and 413 stays `plan(29)`.

**Dead ends and traps, recorded.**

1. ⚠ **The audit's third item did not survive measurement.** `413 §4c` was reported blinded "the same
   way"; it is not, because the policy is a `CASE` whose short-circuit is the WHEN arm, not an arm the
   door can pre-empt. ⛔ Had the caller been "fixed" on the strength of the report, a live and
   discriminating cell would have been converted into one that cannot see its subject — the exact defect
   the unit exists to remove, applied in reverse.
2. ⚠ **A heredoc carrying the patch text died in the Bash tool** (`unexpected EOF while looking for
   matching '` on a `<<'EOF'` block whose content is plain Python). Rewritten via the Write tool into the
   scratchpad and run with `python <file>` — same family as the standing PowerShell here-string trap.
   ⛔ No shell round-trip touched a repository file: every edit is an exact, asserted,
   count-checked string replacement with `newline=''` preserved, and all five target files are LF
   (verified before the first edit).
3. ⚠ **`p0b-isolation-mutation-audit.sh`'s registered mutation cannot see this class of blinding** (it
   opens the POLICY, which reds the DENY at any hat). Stated as a bound on 252's keystone, not as a
   defect in the harness: a policy-level mutation is the right instrument for a policy claim and simply
   answers a different question than "which layer denied".

### 2026-09-11 — ADR renumbered 0207 → 0209 before the rebase: `main` had moved 11 commits and landed a DIFFERENT 0207 (lead)

**Why.** A read-only conflict check against `main` (tip `dd3629be`, unit `AE5-SUCCESSOR-ADRS`) found that
main now carries `docs/decisions/0207-the-role-catalog-holds-roles-…md` and `0208-…md`. Our ADR was
numbered 0207 at creation from *highest on any live branch + 1* measured against `main` at `adbde005` —
correct when measured, stale by the time the build finished. ⛔ Same filename-differs / ordinal-collides
shape as `parallel-branches-collide-in-sequential-numbering`: git never flags it. Re-measured across every
ref (`git ls-tree` per `refs/heads` + `refs/remotes`): highest is `0208` on `main`, `0205` on every
`origin/*` ⇒ **0209**. Migration numbering does not collide (main's highest `20261003007390`; main touched
no `supabase/` file).

**What moved.** The ADR file renamed; every citation rewritten by three exact patterns (`ADR 0207`,
`0207-the-act-hat`, `[0207](`) across the hub, this record, the seam file, the ADR, the migration, `403`,
`252`, `409`, `413`, the generator and the two vector JSON narratives — residue grep for `0207` over that
set: **0**; all twelve files still LF. `npm run adr:index` regenerated `docs/decisions/INDEX.md` (203 ADRs,
next free 0210) and the back-pointer banner in 0201. Both vector generators re-run (the JSON narratives are
sha-stamped provenance): `flips 84 · pre-empted by the door hat term 18 · defective-family 0`, unchanged.

**Gates, bare:** `lint:adr-index` rc 0 · `lint:authz-vectors` rc 0 · `check-docs-registers` rc 0 ·
`check-backend-state` rc 0 · `check-progress-doc` rc 0. The full chain and `test:db` are re-run at the
rebased tip, not here.

**Expected at the rebase, from the conflict check:** `docs/features/INDEX.md` (hub-counter line, both
sides), `docs/decisions/INDEX.md` (count line + table tail, both sides), and
`docs/backend-state/authorization-and-audit.md` (the same *Where the detail lives* bullet edited on both
sides; both append a new `##` on the same trailing line). The two indexes are regenerated, the seam file is
hand-merged keeping both sides. Main's new open-edge bullet says its 0207/0208 are *RULED, NOT BUILT*;
after the renumber that sentence and our *built, migration 20261003007400* slice name different ADRs.

### 2026-09-11 — rebased onto `main` (`dd3629be`); lead gate at the rebased tip `9057829a`, every rc bare (lead)

**Rebase.** Two commits replayed onto `main` `dd3629be` (unit `AE5-SUCCESSOR-ADRS` landed between our
branch point and now). Stops exactly as the conflict check predicted: (1) `docs/features/INDEX.md` —
resolved by taking main's copy and regenerating (`build-features-index --check` rc **0**, 26 hubs);
(2) `docs/decisions/INDEX.md` — regenerated over both sides (`adr:index`: 205 ADRs, next free 0210,
back-pointers current) and `docs/backend-state/authorization-and-audit.md` — hand-merged keeping BOTH
sides: the *Where the detail lives* bullet now names main's `§ The two pre-AE5 successor decisions
taken (ADR 0207 + 0208)` AND our `§ The ACT hat becomes a door-level term (ADR 0209)`; main's frozen
slice precedes ours at the tail. Gate 16 rc **0** after the merge. `main` is an ancestor of the tip;
`git status` clean.

**Gate at `9057829a`, base `dd3629be` — readings bare, never through a pipe.**

```
npx supabase db reset --local                      rc 0   (fresh)
npm run test:db                                    rc 0   Files=267, Tests=9025, Result: PASS, 0 not ok
npm run lint                                       rc 0   (0 errors, 0 warnings; gates 12/13/16 inside)
npm run typecheck                                  rc 0
ARM=census                                         rc 0
ARM=hat                                            rc 0   (this door not on the allowlist — passes on merit)
ARM=floor                                          rc 0   every never-called door on the floor allowlist
FROMFINDINGS=1 ARM=wrapper                         rc 0   BLIND set size: 41 (all allowlisted, unchanged)
bash --version                                     GNU bash, version 5.2.37(1)-release (x86_64-pc-msys)
SELFTEST=1 bash scripts/door-sweep-cases.sh        rc 0   SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0
   --- GROUP deriver:               scenarios 20 (pass 20 · fail 0 · skipped 0)
   --- GROUP merge helper:          scenarios 18 (pass 18 · fail 0 · skipped 0)
   --- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)
bash scripts/door-sweep-cases.sh dd3629be          rc 0   (read bare, then CASES set in a second step)
   SCOPE: 1 file(s) — 1 committed (dd3629be..HEAD), 0 worktree, 0 untracked | filter: none | derivation: catalog
   case list: can_read_professional_profile
door sweep arm 1 (CASES=…)                         rc 0   SWEPT 1 · COVERED 1 · BLIND 0 · NOTICED 0 · ERROR 0 — RESULT: CLEAN
door sweep arm 2 (FROMFINDINGS=1 CASES=…)          rc 0   SWEPT 1 · COVERED 1 · BLIND 0 · NOTICED 0 · ERROR 0 — RESULT: CLEAN
   ARM-DOMAIN predicate=1/127 policy=0/226 out-of-domain-bool=35   (both arms)
git diff --stat -- docs/reviews/authz-door-audit-findings.md      0 bytes (subset run, baseline untouched)
authz-setvalued-targeted-cases.sh                  rc 0   ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)
npm run gen:types ; git diff --stat database.ts    rc 0 · 0 bytes (signature unchanged; app schema not exposed)
```

⚠ The deriver's `SCOPE:` says **1 committed, 0 worktree, 0 untracked** because the migration is now
committed; the build session's line read `0 committed … 1 untracked` for the same one file. Same
increment, two provenances — quoted rather than reconciled.

**Not yet run at this tip:** `npm run e2e:prod` (started after this entry, result in the next entry) and
the QA review.

### 2026-09-11 — QA fix pass: B1 narrowed in three homes, M1 disposition declared, m2 fourth line, two follow-ups (backend)

**Tree.** Same worktree `claude/distracted-kapitsa-0d82de`, committed tip `3d85c403`, clean at start.
⛔ Nothing committed, staged or stashed by this session; ⛔ the local stack was NOT touched — the
lead's `npm run e2e:prod` owns it, and every catalog reading below is a read-only `SELECT` through
`docker exec … psql -Atc`, several of them inside `begin; set transaction read only; … rollback;`.

**⚠ A BOUND ON EVERY LIVE READING TAKEN HERE, STATED RATHER THAN IMPLIED.** The e2e gate resets the
stack repeatedly, so the catalog MOVED UNDER ME during this session — measured, not suspected: one
query returned only `app.is_admin_for` out of ten expected functions, a later one returned all ten,
and a still later read of `app.can_read_professional_profile`'s `prosrc` returned the PRE-ADR-0200
body (`app.is_admin()`, `app.can_read_case(`). ⇒ the readings below are corroborated internally
rather than trusted: each one that mattered was paired with a discriminating control, and the arm
values in § 7.4b's new line were validated by REPRODUCING an already-committed expected value (see
"the fourth line" below). ⛔ None of them substitutes for the lead's `npm run test:db`.

**R-Q1 (B1) — the absolute dropped in all three homes.** QA measured the claim *"exactly the set
`custom_access_token_hook` can mint from … the door can never refuse a hat the hook is able to
issue"* FALSE, and the lead ruled the sentence narrowed rather than defended.

| home | anchor BEFORE (QA's) | anchor AFTER | what it now says |
| --- | --- | --- | --- |
| migration header | `sed -n '73,85p'` | `sed -n '114,143p'` | the set the hook derives `active_role` from **implicitly** (its no-selection branch); a stale selection can present a hat the set no longer contains and is DENIED, deliberately |
| migration body | `sed -n '162p'` | `sed -n '220,225p'` | same, in six comment lines — this one lands in `pg_proc.prosrc` |
| ADR 0209 D2 | `sed -n '66,81p'` | `sed -n '66,94p'` | D2's title itself re-worded to "… derives `active_role` from IMPLICITLY", plus a measured ⚠ paragraph |
| seam slice | `:1278` | `:1278` | bullet re-headed "defined by what its MINTER derives from IMPLICITLY", absolute gone |

⛔ The `## Current state` block did **not** repeat the absolute — checked before editing, not assumed:
its ⭐ clause at `:51` says only that the door no longer survives an absent or wrong hat. So the block
is untouched and gate 16 still reports `authorization-and-audit.md (97, 3 left)`.
⚠ Two further true-but-now-stale numerals were corrected in the same pass rather than left to rot:
§ 7.4b is a **four**-line pin, not three (`403:108`, `403:945`, ADR `:166`, seam `:1281` and `:1286`).

**⛔ THE MIGRATION EDIT IS COMMENT-ONLY, AND THAT IS ASSERTED, NOT ASSERTED-ABOUT.**
`git diff --unified=0 -- supabase/migrations/20261003007400_…sql | grep -vE '^[+-]\s*--'` over the
changed lines returns **0** non-comment lines (63 insertions, 8 deletions, all `--`). The file carries
a dated header block saying the edit was made in place, why (applied to exactly ONE database — this
worktree's, which `db reset` rebuilds from the file), that the alternative was a forward comment-only
migration which `.claude/rules/migrations-forward-only.md` prices as *not free*, that it is ⛔ NOT a
precedent, and that it is disclosed **PO to ratify**.
⚠ Two traps avoided deliberately in the in-body comment, both of them this file's own recorded
lessons: **no `;`** (the `ARM=hat` sweep splits a body into statement CHUNKS on `;`, and a semicolon
would have separated the caller-bound `memberships` read from its `active_role` evidence), and **no
`(`-terminated needle** (`app.active_role(`, `app.is_admin_for(` … — the AFTER landing block asserts
those are PRESENT, so a comment quoting one would satisfy it vacuously; the header already records
the mirror-image abort that found this class).

**R-Q2 — the stale-selection window filed, with its mechanism read from the catalog.**
`FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP` (owner backend,
🟡 medium): entry at `docs/followups/follow-ups-open.md:1952`, body file beside it. Readings,
each with the query in the body file:

- `select prosrc from pg_proc … proname='custom_access_token_hook'` → **two** branches. The FIRST
  reads `app.active_role_selections` for `session_id` and *"an explicit selection for THIS session
  wins"*; the SECOND (implicit) is the union query the door copies — and it mints **only when the
  live role-type set has cardinality 1**, so the hook's implicit branch is also NARROWER than the
  door's set. ⇒ *"exactly"* was wrong in both directions.
- `select … from pg_proc where prosrc like '%active_role_selections%'` → exactly `public.assume_role`
  and the hook. `assume_role` gates on `authz.roles.session_selectable`, `app.is_active`, and a LIVE
  membership — **at selection time only** — then `insert … on conflict (session_id) do update`.
  There is **no deleter**. ⚠ Bound: that sweep is keyed on the table name in `prosrc`, so a dynamic-SQL
  writer would be invisible to it.
- `pg_trigger` on `public.memberships`, non-internal → **`trg_audit_memberships` only**.
- `pg_constraint` on `app.active_role_selections` → PK `(session_id)` and ONE FK
  `user_id → profiles(id) ON DELETE CASCADE`. Columns: `session_id, user_id, role, chosen_at` — **no
  `session_id` FK, no expiry column**; no non-internal trigger on the table either.

⇒ a revoked or expired membership leaves the selection row standing and the hook keeps minting that
hat. **Fail-closed today** (`app.has_role`, `app.is_admin_for` and this door all re-derive from live
memberships and deny), which is why it is medium. `Closes when` names a MECHANISM — an invalidation
trigger on `memberships` **or** a liveness re-check in the hook's first branch, plus a pgTAP cell that
constructs the transition — ⛔ explicitly not a doc edit, ⛔ not a cell asserting the door denies (it
already denies: green on first run), and ⛔ not "read the selection table in the door", which would
re-open the bug this unit fixed.

**R-Q3 (M1) — the `search_path` disposition declared in three places, and one of its reasons REFUSED
after measurement.** The non-empty path is HELD this unit. Written as a dated block in the migration
header (`sed -n '26,52p'`) and as § *Considered and held* in ADR 0209 (`:193`). The holding reasons
are the lead's two: `413` pins this door's `proconfig` INDEPENDENTLY (its own message quoted verbatim
in both homes — *"… it is §5's subset oracle and the policy's fallback arm, so its resolution order
is load-bearing for this suite"*), and ADR 0208 D6 prefers a narrow `alter function` over a re-emit
(D5 also orders the four temp-table DEFINERs tested first).
⭐ **The obvious THIRD reason was drafted, then measured, then REFUSED** — *"the empty form would
force `pg_catalog.now()` into the body"* is **false here**: every relation and function the body names
is already schema-qualified, and its only unqualified references are the pg_catalog builtins
`coalesce`/`now`, which resolve under an empty path because pg_catalog is searched implicitly.
Measured in a rolled-back read-only transaction: `set local search_path = ''` then `select now()`
resolves. ⛔ Recorded as a refused reason rather than deleted, because it makes the convergence CHEAP,
not optional — the opposite of what an unexamined "it would be invasive" would have implied.
**(c)** the follow-up 0208 already ordered **exists** — `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH`
(`follow-ups-open.md:1283`, re-claused at `AE5-SUCCESSOR-ADRS`). ⇒ no new FUP was filed; this door was
added to its scope by a dated `**Scope added:**` line in the entry (`:1288`) AND a dated
`## ⚠ SCOPE ADDED` section in its body file, both naming the door, its measured `proconfig`, the
disposition, and ⚠ that converging it while `413`'s pin expects the three-schema string would RED
that suite — the pin and the migration move together or not at all.

**R-Q4 (m2) — § 7.4b gains a fourth line, and a probe that can seat a caller ≠ `p_uid`.**
`pg_temp.arm3_probe_third_party(p_caller_persona, p_subject_persona, p_scope, p_reach, p_hat)` is a
**separate** function (`403:1023`), for the reason the file already gives for `arm3_probe_at_hat`:
the three existing call sites stay byte-identical, so no guard can be said to have moved with the fix
it constrains. `plan(27)` is unmoved — same assertion, longer string. Two refusals are built into the
probe rather than assumed: it RAISES if caller and subject resolve to the same principal (a collapsed
self-check would read `door=false` and be indistinguishable from a correct deny), and it RAISES on a
NULL hat (line 3's absent-hat value is built with `set_config`; routing it through `claims_for` would
silently seat a derived hat). It builds the reach for the **subject**, never the caller.

The fourth call and the expected fourth line:

```
pg_temp.arm3_probe_third_party('other_commission_holder', 'subject_holder',
                               'own_commission', 'grant_keyed', 'quality_reviewer')
```
```
caller=other_commission_holder@quality_reviewer subject=subject_holder: arm1=false arm2a=false arm2b=true door=true
```

⭐ **It is a ONE-VARIABLE DIFFERENTIAL AGAINST LINE 1**: same subject, same profile, same org, same
reach, same hat string — only the CALLER changes, to another role-HOLDER who does not hold
`quality_reviewer` either. Line 1 DENIES, line 4 GRANTS ⇒ the answer turns on WHO IS ASKING. The
mutation it refuses is the one QA named: a body asking *"does the CALLER's hat match one of the
CALLER's roles"* for EVERY question would over-deny here and pass everything else, because
`pg_temp.cell_answers` seats the role-LESS `f.nobody` for every third-party cell and 409 § 4.15's
caller wears a hat it holds.

⚠ **`arm2b=true` — the grant on line 4 is OVER-DETERMINED, and the string says so instead of hiding
it.** `authz.has_permission` carries the same § 6A asymmetry: its hat conjunct binds on a self-check
and passes vacuously for a third party, so the subject's own commission `staff_admin` answers the
org-scoped permission question. ⇒ line 4 pins the DOOR-LEVEL caller-keyed term, ⛔ **not** arm 3;
arm 3's attribution stays in § 7.3b, where the four reaches are one `case_access_grants` row apart.
That is written into the message so a later reader cannot mistake it for a second arm-3 pin.

**How the four expected values were derived without running the suite** (the DB is the lead's):

| value | how |
| --- | --- |
| `arm1=false` | `app.is_admin_for(chefe.ccih)` — not `is_admin`; the hat conjunct is vacuous for a third party either way. Measured false. |
| `arm2a=false` | live `prosrc`: `can_manage_professional(p_org,p_uid)` = `p_uid is not null and app.is_org_admin_of_for(p_org,p_uid)` = `is_active and has_role('organization',…,'org_admin',…)`. `chefe.ccih` holds exactly ONE membership — commission `staff_admin` — so the org_admin arm is false at any hat. Measured false. |
| `arm2b=**true**` | ⭐ the one that had to be measured. `authz.role_permissions` gives `org.professionals.read` to `staff_admin` (`allowed_scope_kind = commission`), and the org-scoped question resolves TRUE for `chefe.ccih` once the hat conjunct goes vacuous. **Three controls in the same window:** SELF@`quality_reviewer` → **false** (this REPRODUCES § 7.4b line 1's already-committed expected value — the instrument is not dead), SELF@`staff_admin` → true, and the same third-party question at the other two organizations → **false**, so it is not answering "true for everything". |
| `door=true` | the guard is skipped (`p_uid` ≠ `auth.uid()`), and both arm 2b and arm 3 then answer — arm 3 because `set_case_reach('subject_holder','own_commission','grant_keyed')` grants `f.uid` on `f.case_xorg`, which is the reach lines 1 and 3 already use. |

**Gate readings, every rc BARE (never through a pipe).**

```
npm run lint                          rc 0   (eslint 0/0; vacuous 277 spec files / 0 findings;
                                              adr-index 205 ADRs, next free 0210; mojibake 3487 files clean;
                                              authz-vectors in sync, sha ac475f3d65d3)
node scripts/check-docs-registers.mjs rc 0   26 hubs, 229 follow-ups, 157 follow-up bodies, index in sync
node scripts/check-backend-state.mjs  rc 0   authorization-and-audit.md (97, 3 left), 12 seams
```

⛔ **NOT RUN, AND NOT IMPLIED:** `npm run test:db` — so **§ 7.4b's fourth line has never executed**.
Its expected string is derived and control-checked above, not observed. Also unrun here: `typecheck`
(no TS file moved), the four authz arms, the door sweep, and `e2e:prod`. ⚠ The `ARM=hat` sweep in
particular has NOT re-read the new `prosrc` — the in-body comment grew by five lines inside the chunk
that carries the hat evidence, and although no `;` was introduced (checked in the edit script's own
assertion), *"no semicolon"* is an argument, not a run. Both are the lead's to re-run after e2e.

### 2026-09-11 — QA round 1 CHANGES REQUESTED (B1 · M1 · m1–m3 · n1–n5); lead rulings; two E2E false starts disclosed (lead)

**Disclosed first, because only a commit subject said it so far (QA m1).** Commit `8a9eeb39` landed with
**gate 13 RED**: the hub's `## Current state` refresh was applied by a script anchored on the FIRST
occurrence of the phrase, which was the backticked mention inside the *Homes* acceptance bullet, so the
hub was truncated from that bullet onward and the heading destroyed. `check-docs-registers` printed
rc **1** in the same command chain and I committed past it — the "reading a gate is not gating on it"
shape. Found one command later; `3d85c403` restored the hub from `9057829a` and re-applied the block
anchored on the heading line, registers rc **0**. ⛔ Not amended — corrected forward, here and in that
commit's subject.

**Two `e2e:prod` false starts, both the nested-worktree trap, neither a product red.** (1) `FATAL:
.env.local not found` — gitignored, absent from the worktree; copied from the primary checkout after
confirming its `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (local stack, not Cloud). (2)
`FATAL: node_modules/next () != package.json's declared next (16.3.2) — toolchain drift`: the worktree
had **no** `node_modules`, so every earlier gate here (lint, typecheck, the generators) resolved UP into
the primary checkout's install. ⚠ Those readings stand because `package.json` and `package-lock.json`
are **byte-identical** to the primary's (`cmp`, both) — stated as the reason they stand, not assumed.
`npm ci` rc **0** (local `next` 16.3.2); third launch building at 13:41, batches running.

**QA round 1** (`docs/reviews/arm3-hat-term-fix-review.md`, at `3d85c403`): **CHANGES REQUESTED** —
BLOCKING B1, MAJOR M1, MINOR m1–m3, NOTE n1–n5; the door's behaviour, the vector and every assertion
verified clean (partition re-derived independently `108+24+36+30+18 = 216`, flip census 84, mutant D's
8-vs-18 explanation re-derived and sound, LEARN-023 holding in all four suites).

**Lead rulings, each with its landing artefact (playbook §4 step 8):**

| finding | ruling | landed in |
|---|---|---|
| **B1** the held set is not "exactly what the hook can mint" — `active_role_selections` (written by `assume_role`, never revalidated) can outlive a revoked membership | TRUE; narrow the sentence in all three homes, drop every absolute; ⛔ never read the selections table in the door. **The migration's comment edit pre-merge is RULED allowed and marked PO to ratify:** the file has never left this worktree and the only DB that ran it is rebuilt by `db reset`; the alternative (a forward comment-only migration) is what `migrations-forward-only` and this unit's own follow-up call not free. `git diff` on the migration filtered to non-`--` lines: **0** — comment-only | migration header + body, ADR 0209 D2, seam slice; `FUP-ARM3-HAT-TERM-FIX-STALE-ACTIVE-ROLE-SELECTION-OUTLIVES-ITS-MEMBERSHIP` filed (entry + body) |
| **M1** re-emitted DEFINER kept `app, public, pg_catalog` against ADR 0208 D4 | path HELD this unit: `413` §1 pins this door's `proconfig` independently, 0208 D6 prefers a narrow `ALTER FUNCTION` convergence; the "would need `pg_catalog.now()`" reason was MEASURED FALSE by backend and refused — convergence is cheap, owed under 0208 | migration header (dated block), ADR 0209 § Considered and held, `FUP-NO-GATE-CATCHES-A-COLLAPSED-SEARCH-PATH` scope line (entry + body) |
| **m2** no role-HOLDING caller in a third-party seat | fourth line added to `403` §7.4b (`caller=other_commission_holder@quality_reviewer subject=subject_holder … arm2b=true door=true`); ⚠ `arm2b` TRUE is measured, so line 4 pins the caller-keyed door term and is over-determined for arm 3 — said in its message. `plan(27)` unmoved. **Unrun at this writing** (DB held by e2e) | `403` §7.4b |
| **m3** hub `adrs:` omits 0209 | added now, not at Record | hub frontmatter |
| **n1** "only" dropped from the block bullet | restored (one word, no new line; block 97/100) | seam `## Current state` |
| n2–n5 | notes, no change owed; n5 (guard skipped when `auth.uid()` is NULL) is the existing null-guard's semantics — service-role callers pass `p_uid` and are third-party by construction | — |

**Backend's fix-pass gate, DB-free (bare):** `npm run lint` rc 0 · `check-docs-registers` rc 0 ·
`check-backend-state` rc 0. ⚠ Backend also corrected five "three-line pin" sites to "four-line"
(`403` header ×2, ADR, seam ×2) — a fresh false clause of B1's family had they stayed.

**Owed before QA round 2:** `e2e:prod` result; then a fresh reset + `test:db` (§7.4b line 4 has never
executed) + `ARM=hat` (the in-body comment grew inside the chunk carrying the hat evidence; no `;`
introduced — an argument, not a run) + `lint` at the new tip; then commit by path.

### 2026-09-11 — `e2e:prod` GREEN at `3d85c403`; the QA fix pass re-gated on a fresh reset (lead)

**`npm run e2e:prod`** (third launch, own toolchain, local `.env.local`): rc **0** — `GATE SUMMARY: 1261
passed · 0 failed · 0 infra · 4 flaky · 0 did-not-run · 21 batches` — `GATE GREEN`. ⚠ It ran against
tip `3d85c403`, BEFORE the QA fix pass; the fix pass changes no SQL statement (the migration diff
filtered to non-`--` lines is 0) and no `src/`, so the reading stands for the tip below — stated as a
bound, not re-run.

**Re-gate over the fix pass (working tree, then committed as the next sha), bare:**

```
npx supabase db reset --local        rc 0   (fresh)
npm run test:db                      rc 0   Files=267, Tests=9025, Result: PASS, 0 not ok
                                            — §7.4b's FOURTH line executed for the first time and matched its predicted string
ARM=hat                              rc 0   this door not reported; the grown in-body comment stayed inside its chunk
npm run lint                         rc 0
```

Committed by path (the review file included as QA's deliverable); QA round 2 requested at that tip.
