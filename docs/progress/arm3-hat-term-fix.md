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
