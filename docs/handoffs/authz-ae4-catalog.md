---
branch: authz-ae4-catalog
task: AE4 — the authz catalog, and staff_admin substituted end-to-end (ADR 0155 D7)
adrs: [0155, 0162, 0169, 0170, 0172, 0173, 0174, 0175, 0176, 0177, 0079, 0106]
base_sha: 0412bef7e59476635ddb024c63fdce182a7a6466
created: 2026-09-01
updated: 2026-09-02
status: live   # AE4.1–4.9 INCL. THE D6 RE-KEY built; ⛔ the re-key work is UNCOMMITTED and UNVERIFIED as one suite — no canonical `test:db` has run across all of it. Gate AE4 NOT declarable.
---

# Handoff — AE4, with the permission layer made real and every spec passing, but the gate not yet earned

## ▶ RESUME HERE

1. `git log --oneline 0412bef7..HEAD` and `git status`.
2. `supabase db reset --local` — **mandatory, and not a formality: see § Dead ends "a bisect
   poisons every later catalog read". Every figure below assumes a fresh reset at THIS tree.**
3. `npm run test:db` — expect **256 files / 8579 tests, GREEN** (⚠ was 254/8504 before AE4.9;
   407 `+54`, 408 `+17`, 401 `+3`, 403 `+1`). No expected-red baseline exists on this branch,
   so a red is drift.
4. `npm run test` (vitest) — expect **151 files / 2058 tests**. `npm run lint` (12 gates) and
   `npm run typecheck` — expect 0. ⚠ vitest currently **requires Docker** (`role-catalog.test.ts`
   shells out to it) — that is item (d) below, not a local misconfiguration.
5. Read **PROGRESS.md § Now**, § Bug Log and § Decisions. This file is not status truth.
6. Read ADR [0176](../decisions/0176-authz-permission-layer-made-real.md) (`Amends:` 0155 D7 +
   0174) and [0177](../decisions/0177-ae49-resolver-contract-implementation-choices.md), then
   plan **§ AE4.9**. ⛔ **The direction changed on 2026-09-02 and the FIRST HALF IS NOW BUILT:**
   the permission layer had zero production callers; the PO adopted **Option A — make
   permissions real**, and D4+D7 landed (the resolver quartet, the state gate, scope-kind
   validation, `assume_role` enforcing `session_selectable`). ⛔ **What is NOT yet true: no
   enforcement site has been re-keyed**, so deleting a grant still does not move a production
   door. That is 0176 D6 and it is the next build.

⛔ Re-measure before relying on anything below — see § Trust.

---

## ⭐ 2026-09-02 (later) — THE D6 RE-KEY IS BUILT. Read this before § State; it supersedes the
## "next build" framing above, and NOTHING here has been verified as one suite.

**Built, all UNCOMMITTED at the time of writing** (`git status` is the truth, not this list):
migration `20261003007300` + pgTAP **409** (the re-key: `app.can_edit_commission_forms` new;
`can_create_professional` / `can_read_professional_profile` re-keyed in place) · the D5
**enforcement manifest** `supabase/tests/vectors/authz-enforcement-manifest.json` + pgTAP **410** +
401 §19 re-sourced · a **fourth** differential representative in **403** · pgTAP **411** + the
vitest Docker dependency removed · ADR **0178** · the **rollback runbook + out-of-chain template**
in `docs/deployment/`.

⛔ **THE ONE THING A SUCCESSOR MUST NOT ASSUME: no canonical `npm run test:db` has run across all
of this.** Individual agents measured their own files at different trees; 410's last green
predates its own §4.6 and residual columns, and **403 has never been run with four
representatives** (864 driver invocations, up from 648). Plan counts to expect: 401 **121**,
403 **23**, 410 **34** (new), 409 **63**. Treat every count above as *intended*, not observed.

⛔ **Two `test:db` runs were VOIDED** by a second agent running `create/drop extension pgtap
cascade` (AccessExclusiveLocks catalog-wide) against the shared DB. **One owner for the DB at a
time** — that is why the counts above are unverified rather than wrong.

▶ **RESUME = re-run the canonical gate**: fresh `supabase db reset --local` → `npm run test:db` →
`npm run lint` / `typecheck` / `npx vitest run` → the four authz ARMs → the diff-scoped door sweep
**both arms**, then `e2e:prod`.

⛔ **THE DOOR SWEEP HAS VERDICTED NOTHING ON THIS CHANGE, and that is a §6 finding, not a pass.**
Read arm exited 1 (baseline not green); **write arm exited 3, UNPROVEN, 0 gates selected** — the
four `FOR ALL` policies are absent from that harness's embedded 33-policy snapshot
(`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 3). The four altered policies additionally carry
**stale COVERED verdicts** inherited from five other suites, which must be **re-measured, not
inherited**.

⛔ **PROGRESS.md is at ~100.8 KB against a 102,400 B HARD cap.** The Record step needs room it
does not have. PO decision, unresolved.

---

⚠ **Two documents carry what this file deliberately does not:**
[`authz-ae4.md`](../progress/authz-ae4.md) — the increment record, per increment, each with its
own gate table and its own "what this did NOT do"; and
[`authz-ae4-review.md`](../reviews/authz-ae4-review.md) — the mid-phase QA review whose findings
F1–F9 drove AE4.7a/b/c.

⛔ Nothing may cite this file — promote it to one of those two instead, and leave a pointer.

## Trust

**Mixed.** AE4.1–AE4.6 was written cold at session end — the least reliable mode. AE4.7 onward
was written incrementally. § State was re-measured wholesale at `43684b16`, spot-checked at
`b37a2a5b`, the AE4.8 rows at `d56a5065`, and the **AE4.9 rows after the two new migrations
landed** — by the lead directly on the live catalog, not copied from the builder's report.

⛔ **Eight rows of an earlier VERIFIED table had gone false by AE4.7c**, and **one diagnosis in
this session was retracted outright** (§ Dead ends). Every one had been true when written, and
every one still read as careful. Treat BELIEVED rows accordingly and re-measure before acting.

⛔ **The phase's catalog figures are NOT restated here any more** — they are in the increment
record, and the § Re-derivation appendix regenerates them. A second copy is a second thing to
drift.

## Goal and scope boundary

AE4 makes the `authz` catalog exist, migration-managed, with **exactly one role —
`staff_admin`** running on it, proven by a differential oracle.

⚠ **This paragraph was rewritten 2026-09-02 — the audit-F1 text it replaced is now WRONG in its
nouns**, because it named `authz.has_direct_permission`, a function that **no longer exists**
(renamed by D4). Keeping it would have read as a careful, current warning.

**Where D7 actually stands:** AE4.6 delivered **layer 1 only** (both wrappers → `authz.holds_role`
→ `assignment_facts` + `roles.state`). AE4.9 D4+D7 then built **layer 2** — the runtime/candidate
split, the `authoritative` gate, scope-kind validation, `assume_role` enforcing
`session_selectable`. ⛔ **Layer 3 does not exist: NO enforcement site is re-keyed**, so grant
deletion still moves the resolver and not a production door. That is the conformance defect ADR
0176 D6 closes, and it is the phase's remaining build — not an exposure, but the approved matrix
is not yet the oracle of what ships.

**Explicitly NOT in scope, each ruled rather than overlooked:**
- Other roles. Eleven remain `legacy`; AE5 substitutes them one at a time.
- Retiring `memberships_role_check` / `memberships_scope_shape` — both stand until AE5-complete.
  ⛔ *"The catalog is the authority"* may not appear in a gate record before then: it is
  **authority-elect**.
- Widening `PRED_DOMAIN` (the door-sweep harness's `bool` bound). Routed to C2.
- `seed.sql`. Untouched by ruling — a contract with ~900 tests.

## State

### Done — VERIFIED

⚠ **Rows are dated and the tree MOVED under them within 09-02.** Earlier rows were taken at
`d56a5065`; the AE4.9 rows were taken after `…7250`/`…7260` landed. Two rows naming
`has_direct_permission` were **corrected, not deleted** — that function no longer exists.

| What | Witness | When |
| --- | --- | --- |
| AE4.1–4.7 catalog state (5 tables / **8** fns after AE4.9, was 6 / 0 policies; 43 perms / 42 grants; 1 authoritative + 11 legacy; the one revoked code `org.professionals.manage`) | § Re-derivation appendix regenerates each | 09-02 |
| Both wrappers are one-liners over `authz.holds_role`; `has_role`/`assignment_facts`/`active_role` all false on both | appendix § wrapper delegation | 09-01 |
| **No client role holds USAGE on `authz`** — anon, authenticated **and service_role** all false, and `authz` is absent from `config.toml`'s exposed schemas | `has_schema_privilege(r,'authz','USAGE')`; `grep -n "^schemas" supabase/config.toml` | 09-02 |
| AE4.8: `ROLE_MANIFEST` **is** `authz.roles`' session-selectable half, scope kinds matching | `npx vitest run src/lib/role/role-catalog.test.ts` → 6/6 | 09-02 |
| AE4.8: `landingRouteForRole` reproduces its pre-refactor behaviour on 31 pinned cases | `npx vitest run src/lib/role/landing-route.test.ts` → 31/31 | 09-02 |
| `set_professional_link_state` **DOES** carry AE4.7c's `link_state='unknown'` bound | `prosrc ~ 'v_current_link'` → **true**, after a fresh reset | 09-02 |
| ⭐ **AE4.9 D4/D7 re-measured by the LEAD, post-migration, fresh reset** — scope kind `hospital` **and** `banana` now **deny** (both granted before); `test_validation` → runtime `f` / candidate `t` (the ONLY divergent state, so the split is a split and not a rename); deleted grant → **`permission_not_granted`** (was `scope_unreachable`); `assume_role` `prosrc ~ session_selectable` → **true** (was false) | `BEGIN … ROLLBACK` probes on `authz.has_permission` / `candidate_has_permission` / `explain_permission`; `pg_proc` for `assume_role` | 09-02 |
| ⚠ **Census, POST-rename** — the old names `has_direct_permission` / `explain_direct_permission` are **GONE**; the new quartet has **zero callers outside `authz`**; **no** client role holds EXECUTE on any of the 8 `authz` functions. `is_staff_admin_of` still sits in 63 policies + 151 fn bodies, `_for` in 2 + 28, and the 16 other role wrappers still call `app.has_role` — that is the re-key surface | appendix § audit census (⛔ swap the regex to the NEW names) | 09-02 |

### Written but UNVERIFIED (BELIEVED)

- ⛔ **BUG-PROF-INACTIVE-001's behavioural proof MOVED and was not re-run by hand.** Verified
  against `app.can_manage_professional`; AE4.7c moved that arm to `can_create_professional` →
  `is_org_commission_staff_admin`. pgTAP **404** asserts both polarities and is green — but the
  witness is a suite, not a hand probe. Settled by reading 404's run.
- Six driver defects found and fixed inside 403's harness (AE4.5's own report).

### Not started

⛔ **`docs/backend-state.md` has NO `authz` section** — deliberate: a Record-step artifact, owed
at Gate AE4, not here. ⚠ AE4.9 changed the surface it must describe, so write it after the
re-key, not before. ✅ The increment record's **AE4.8 and AE4.9 sections now exist** (that gap
is closed).

⛔ **NO ENFORCEMENT SITE IS RE-KEYED.** Layers 1 and 2 are real; layer 3 does not exist yet, so
deleting a grant still moves the resolver and **not** a production door. This is the gap 0176 D6
closes and it is the phase's remaining build.

### Tree

⚠ `base_sha` (`0412bef7`) is where this handoff was FIRST written and is deliberately unchanged —
it is what a successor diffs from to see the whole phase.

⛔ **NO COMMIT COUNT AND NO HEAD SHA IS RECORDED HERE, deliberately** — a count or sha written
inside the commit that contains it is off by one **by construction**
([rule](../../.claude/rules/live-facts-measure-dont-quote.md); this file previously said
*"71 commits ahead"* and was stale within the day). **Measure both:**
`git rev-list --count main..HEAD` · `git rev-parse --short HEAD` · `git status --short`.

**Working tree was CLEAN as of 2026-09-02** — everything below is committed, including the two
formerly-untracked strays (`docs/learning/`, `scripts/progress-cleanup-2026-08-26.mjs`), which
went into their **own isolated `chore:` commit** so it can be dropped without touching AE4
history — the PDF is a 469 KB binary, cheap to drop before a merge and expensive to purge after.

⛔ **Nothing merged, nothing pushed.** PO ruled the whole phase merges once, at Gate AE4. The
schema-first rule (`.claude/rules/push-schema-before-code.md`) is **armed but not owed** — it
fires at that merge.

**16 migrations**, `20261003007100` … `20261003007260`. Suites **401–408** added.
AE4.8 touched `src/lib/role/` + `src/app/page.tsx`; AE4.9 touched only `supabase/` + docs;
the two `e2e/` files are ✅ tester-signed-off (§ Open questions).

## Gates

`test:db` **254f/8504**, `lint` 12/12, `typecheck` 0, vitest **151f/2058** — all exit 0 at
`d56a5065`. Six ARMs (`census`/`hat`/`floor`/`wrapper`/`catalog`/`sites`) HOLD, exits read
directly. Per-arm figures: increment record.
⭐ **RE-MEASURED 2026-09-02 at `00edfc34` + the two uncommitted fixes** (no SQL changed):
`test:db` **254f/8504 PASS**, `lint` 12/12, `typecheck` 0 — each exit read from the log, not from
a task notification. ⛔ pgTAP TRUNCATES as it runs, so its green leaves the DB **unfit to
mutate**; the four phase-gate arms were therefore re-run after **another** fresh reset, not on
that tree: `census` / `hat` / `FROMFINDINGS=1 wrapper` / `floor` all **exit 0, INVARIANT HOLDS**
(census 618 gates verdicted · hat 4 reasoned-allowlisted findings, 7/7 self-test · wrapper BLIND
set 41 ⊆ allowlist · floor both directions). ⚠ `catalog` and `sites` were **NOT** re-run —
absence of a verdict is not absence of coverage, so do not write "six arms" for this measurement.

### ⚠ E2E: every spec passes, but as a COMPOSITE — the §6 artifact is NOT earned

**Measured 2026-09-02 AFTER the AE4.9 SQL. All 122 spec files hold a PASSING verdict and NO test
failed an assertion anywhere at this tree.** ⛔ **But that green is the union of THREE runs, and
`e2e:prod` has never exited 0 over the whole suite here.** §6 step 2 says the full suite runs
**once** to declare green, so *"e2e:prod green"* may **not** be written. Composition, recorded so
a successor can audit rather than trust it — run A batches 1–17 = the first **100** specs,
`0 failed` each (lead aborted at b19 deliberately) · run C = the other **22** at `BATCH_TESTS=22`,
200 passed, **zero assertion failures** · run D = the 3 run C left unproven, `GATE_EXIT=0`,
**27/27**. ▶ **Owed: ONE full `e2e:prod` to exit 0 in a SINGLE run, on a quiet machine.**

⭐ **THE 62 "infra" ARE RESOLVED — batch 7 measured `70 passed · 0 failed · accounted 70/70 ·
pw_exit 0`.** ⛔ **And the reading that the FF family was somehow special is RETRACTED.** The
prior text here said the batch *"was already auto-re-run once and got WORSE (56→62), so this is
not a one-off blip"*, which invited exactly that inference. The deaths land wherever the machine
is loaded: this run they hit batches 14/18/19, and `FUP-E2E-SERVER-DEAD-1`'s own history has
5·6·9·12·16·17.

⛔ **EVERY red in these runs was CONNECTION-LEVEL, never an assertion.** The mechanism — a server
that binds :3000 and answers 404 in 13 ms after logging `✓ Ready in 0ms`, plus the two
operational traps that cost a `GATE_EXIT=4` abort — is now written into
**`FUP-E2E-SERVER-DEAD-1`**, which is its permanent home. ⛔ Read it before re-running the gate;
it is not restated here. ⚠ Its companion: the INFRA classifier does not recognise `ERR_ABORTED`,
so it books a navigation abort as a *real failure* (addendum on the classifier follow-up).

**The "1 failure" of the AE4.8-era run was NOT a count — it was a serial-abort artifact.**
`BUG-AE47C-LINKAGE-001` (✅ CLOSED, both casualties; PROGRESS.md § Bug Log) was **two** failures:
the file is `test.describe.configure({ mode: 'serial' })`, so `:765` aborted it and
`UNKNOWN-RESOLVE` (`:1068`) sat unmeasured in the 13 did-not-run. ⛔ Every run must give every
test a verdict; a serial abort is unmeasured, never passing.

**Did NOT run at all:** the periodic full door sweep (~5 h) and `ARM=wrapper`'s own full sweep
(~100 min) — both are periodic audits, not phase steps. ⚠ **C2's reachable command doors remain
outside every ARM's domain**, and so do three of the six `authz` functions (`assignment_facts`,
`explain_direct_permission`, `rebuild_implication_closure`). State both qualifiers beside any
"all arms green" claim.

⛔ **Two qualifiers owed to the gate record** (PO batch, ADR 0175): 401 §20 is **ONE HOP**, not
the transitive closure; and `can_read_professional_profile`'s arms 1 and 3 are **EXERCISED BUT
NOT ORACLED** (403 §7.2/§7.3 assert they cannot grant in this fixture). *"The differential is
green"* may not be written without both.

## Dead ends

⛔ **A BISECT POISONS EVERY LATER CATALOG READ, AND THAT COST A FALSE BUG DIAGNOSIS.**
`e2e-prod-gate.sh` runs `supabase db reset --local` from the **checked-out tree**. After bisecting
at `0807cfda` (pre-AE4.7c) the local DB was left at the **pre-AE4.7c schema**; every catalog query
afterwards described a database without AE4.7c in it. On that basis `BUG-AE47C-LINKAGE-001` was
diagnosed as *"the `link_state='unknown'` bound was never built"*, a PO ruling was obtained to
build it, and the migration written to do so **no-opped against its own idempotence guard** —
the bound was already there (`20261003007230` emits it). The migration was deleted, not committed;
the bug entry's mechanism is retracted in place. **The bisect's own result still stands** (both
sides ran through the gate, so each was schema-coherent). ⛔ After ANY checkout, reset before
reading the catalog.

- **Re-coding an expectation whose error code drifted.** AE4.7c put a `42501` authority refusal
  in front of older guards, so `HC0J7`/`HC0F2` assertions began failing with the new code.
  ⛔ Re-coding greens the test and leaves the guard it was written for asserted by NOTHING. Change
  the **caller** to one who passes the new guard and reaches the old one; the assertion splits in
  two. ⚠ AE4.7c applied this to pgTAP 229/257 and **missed the only E2E twin** — fixed at
  `a1ac073c`. A sweep that stops at one layer reads as complete.
- **Trusting a background task's "exit code 0".** It is the exit of the **compound** command; a
  trailing `echo`/`tail` erases the real one. Both `e2e:prod` runs were reported 0 and were 1.
- **Assuming a batch failure is an assertion failure.** Two "failures" in run 1 were
  `ERR_CONNECTION_REFUSED` — the server died mid-batch — while the gate printed `0 infra`. Its
  classifier does not catch every case. Isolate before diagnosing.
- **Assuming a retry failure is the same defect.** `ethics-e2-procedure:486` failed only as
  `(retry #1)`: attempt 1 had run FLOW-1, which decides admissibility, so the retry found the
  button enabled. One root cause (FLOW-8) produced three reported symptoms.
- **Delegating the wrappers to the permission resolver.** A sentinel permission couples a role
  check to one arbitrary grant; *"holds any staff_admin-granted permission"* returns **true for a
  plain staff member** the moment AE5 grants `staff` an overlapping permission. Resolution:
  `authz.assignment_facts`, then the `authz.holds_role` chokepoint. ⛔ **2026-09-02: the argument
  stands, the conclusion was HALF.** `holds_role` is the assignment-projection layer, not the D7
  cutover — routing a ROLE question through a permission resolver is wrong, so D7 is satisfied by
  **re-keying the enforcement sites** to ask permission questions (plan § AE4.9), not by
  re-pointing wrappers. The ruling lived only in `20261003007200`'s comment; ADR 0174 says
  `Relates:` 0155; and the mid-phase review measured "callers = 0" on the resolver and filed it
  as a rename nit. A designated authority with zero callers is a conformance finding.
- **Reading G4's "typed query" as a client-side query.** The "not implementable" ruling measured
  that no client role holds USAGE on `authz` — true, and beside the point: `public.assume_role`
  is `SECURITY DEFINER` and reads the sealed table server-side with no new grant. The gate-time
  key-set comparison that replaced it measures **drift**, not enforcement; `session_selectable`
  has zero readers, and flipping it changes nothing. Superseded (plan § AE4.8 / § AE4.9 "do now").
- **A text-based door-sweep deriver.** It matches `create function` in migration text; the house
  `pg_get_functiondef`+`replace`+`execute` pattern contains none. 33 migrations invisible;
  amending reaches **8 of 33**, the other 25 unrecoverable without a historical snapshot.
- **Giving `ARM=sites` a negative control only.** `psql` does not interpolate `-v` inside `-c`;
  both lookups died, every set difference was empty, and the arm printed `OK — 0 site(s)` beside
  `vacuity control: OK`. ⛔ A dead instrument satisfies an "X − Y is empty" check AND its
  synthetic-input control at once. A control needs a DISCRIMINATION half.
- **Expecting a UNION observable to show a mutation.** Re-pointing 319's A5 twin expecting
  `111 → 175` measured **111**: S1's mask already contained S2's bit. Read where NO arm is
  legitimately open.

## Decisions made in flight

**Ruled by the PO** — matrix approved at **42 rows** (⛔ recorded as *what was approved*, never a
current count); deny-class table approved (9 rows); `staff_admin` **loses
`org.professionals.manage`**, split by OPERATION, keeping new row 43 `org.professionals.create`
(⛔ **no ADR by PO ruling** — matrix § 12.8.5 is its home); whole phase merges once at Gate AE4.

**ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md), the PO batch, one
sitting:** `offboarded` is not a deny class — ⭐ **re-ruled before any code**, from 91 cells to a
structural proof, because the cells measured UNCONSTRUCTIBLE; the nine `unauthenticated` cells
deleted rather than relabelled; 403 calls the real door with arm 3's divergence deferred to AE5;
both FUPs documented/downgraded.

**AE4.8, ruled during the build** — rotated 2026-09-02 to
[authz-ae4.md § AE4.8](../progress/authz-ae4.md), which now carries both rulings and the
G4 correction. ⛔ Read it there; this file no longer restates it.

**2026-09-02, on the [implementation audit](../reviews/authz-evolution-implementation-audit-2026-09-02.md)
(CHANGES REQUESTED, F1–F10; its facts reproduced on the live catalog the same day):** PO adopted
**Option A — make permissions real**, recorded in ADR
[0176](../decisions/0176-authz-permission-layer-made-real.md) (`Amends:` 0155 D7 + 0174) —
⛔ **read the ADR, not a paraphrase of it.** Only the two things the ADR does *not* carry
belong here: *"catalog cutover"* still may not appear in a gate record for what AE4.6 built, and
the earlier G4 *"not implementable"* ruling is **superseded** (§ Dead ends). ⚠ **NOT decided,
bundled into the AE5 plan:** F6 exact-assignment context · F8 `administrativo` out of
`authz.roles` · `platform_role` retirement · F7 single manifest entry — all pre-users design
choices, none blocks the merge, one compatibility migration instead of four (plan § AE5).

**2026-09-02, later the same day:** PO **confirmed the Gate AE4 minimum re-key scope = the three
differential representatives** (`commission.forms.edit`, `org.professionals.create`,
`org.professionals.read`), each end-to-end with the grant-deletion mutation flipping its
production door; everything else `pending-rekey` (0176 D6, recorded in place).

## Open questions / blockers

| Item | Who/what answers it |
| --- | --- |
| ✅ **THREE ROWS RESOLVED 2026-09-02 and REMOVED rather than left ticked** — `BUG-AE47C-LINKAGE-001` (both casualties), the two E2E spec sign-offs, and the 62 infra-unproven. ⛔ Their records are PROGRESS.md § Bug Log and § Gates above, **not here**; a resolved row in an open-questions table is what makes such a table stop being read. ⚠ One residue did NOT resolve: the `ae48` spec's **red polarity was never executed** (structural-plausibility verdict only). | lead/frontend, if the gate wants it live |
| ⛔ **PROGRESS.md — the 81,920 B target is NOT met and NOT reachable by rotation.** Every sanctioned category is empty; the OPEN follow-up index alone is ~50% of the file and the contract forbids rotating it. Options are a PO decision — raise the target, or give the register its own file — filed as `FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT`. | PO |
| ⛔ **Performance evidence does not exist** — no AE4.4 scaled-fixture artifact anywhere (audit F9). Measure the FINAL path after AE4.9's seam, never `holds_role` alone. | backend, after the ADR |
| ⛔ **Rollback runbook + out-of-chain SQL template do not exist** (audit F10; zero `*rollback*` files in the tree). | backend, before Gate AE4 |
| **UNKNOWN:** whether the 25 unreachable rewrite migrations' doors hold periodic-sweep verdicts. The 8 measurable ones gave 16 COVERED / 10 ERROR / **0 BLIND** / 29 absent, every absent one outside `PRED_DOMAIN` by shape — converging on the known C2 population, not a new one. | a historical-snapshot audit, if authorised |

## Next task

**First command:** `supabase db reset --local && npm run test:db` (expect **256f/8579 GREEN**).

⛔ **THE NEXT BUILD IS ITEM 2 — the re-key.** ⚠ **Numbering CORRECTED 2026-09-02:** this said
*"item 3 … items 0–2 and 5 are done"*, which contradicted the list directly below it — item 1 is
OPEN (do-now (c)+(d), both re-measured live that day) and item 2 is the re-key, not item 3. Only
items 0 and 5 are done. A header that disagrees with its own list sends a successor to the wrong
build. Item 2 is what Gate AE4's
minimum actually requires (0176 D6), and until it lands *deleting a grant still moves nothing a
user can observe*. Items 4, 6 and 7 are gate paperwork that follow it.

0. ✅ **DONE 2026-09-02, all recorded elsewhere — no PO item is open on this phase's authority
   record:** ADRs [0176](../decisions/0176-authz-permission-layer-made-real.md) +
   [0177](../decisions/0177-ae49-resolver-contract-implementation-choices.md) · the 0176 D6
   re-key scope confirmed · `BUG-AE47C-LINKAGE-001` closed (both casualties) · tester sign-offs
   discharged · AE4.9 do-now **(a)+(b)** built (migrations `…7250`/`…7260`) and independently
   re-measured by the lead on the live catalog.
   ⭐ **One technique worth carrying, recorded nowhere else:** to debug a prod-gate spec failure,
   run the spec **solo against a plain `npm run dev`** (Playwright's config has
   `reuseExistingServer`) and read the real SQLSTATE from **`docker logs <db container>`** — the
   DB container's log is outside everything `e2e-prod-gate.sh` truncates, and this replaced a
   ~2 h gate cycle with a ~2 min one. ⛔ Re-measure the catalog only after a fresh reset.
1. ⛔ **STILL OPEN — do-now (c) and (d), and (c) has a constraint the plan does not state:**
   (c) populate `catalogPermissions` / `nonLegacyRoles` from the catalog in
   `gen-authz-matrix-cells.mjs` (both still range over `?? []`, so both pass having checked
   nothing) and prove each arm can red — ⚠ **that generator is pure JSON→psql today and
   `lint:authz-vectors` runs it inside `npm run lint`, so a DB query there would make the lint
   chain require Docker.** Measured, not assumed: no `docker`/`psql`/`execSync` in the script.
   (d) move `role-catalog.test.ts`'s Docker shell-out (line 73) to a post-reset DB gate — the
   same constraint, one layer up: it currently makes **vitest** require Docker.
2. ⭐ **THE PHASE'S REMAINING BUILD — the enforcement manifest, then the re-key (0176 D6).**
   The generated manifest with **no default arm**, replacing 401 §19's `ELSE` (today its `ELSE`
   sends 38 of 43 codes to `is_staff_admin_of_for`, so a 44th permission inherits a default
   instead of forcing a decision); then the three representatives — `commission.forms.edit`,
   `org.professionals.create`, `org.professionals.read` — re-keyed end-to-end with a domain
   authorizer **at the site**, each proven by the grant-deletion mutation flipping the
   **production door**, not the resolver. Everything else enters the gate as `pending-rekey`.
3. **ONE full `e2e:prod` exiting 0 in a SINGLE run — LAST, and it is the only E2E item left.**
   Every spec already passes, but only as a 3-run composite (§ Gates), which is not the §6
   artifact. ⛔ Run it *after* item 3, on a **quiet machine**: a second Supabase stack or any
   competing workload reliably produces the connection-level class that made three runs
   necessary. ⛔ Read `GATE_EXIT` from `/tmp/e2e-prod-gate/gate-exit`, never from a task
   notification. ⚠ If batches start dying, `BATCH_TESTS=22` is the recorded rescue
   (`FUP-E2E-SERVER-DEAD-1`) — smaller batches, more frequent restarts.
   ⛔ Two traps that cost a `GATE_EXIT=4` abort and another project's test run are recorded in
   `FUP-E2E-SERVER-DEAD-1` — read them before killing or cleaning up a gate run.
   ⛔ **And do NOT re-run a spec file against an un-reset DB to "confirm" it** — measured
   2026-09-02: `ethics-e4-participants` is 13/13 on a fresh reset and RED on the very next
   invocation against the same DB (`EXT-REUSE` asserts an absolute seat count). That is
   `FUP-RETRY-CHANGES-THE-FAILURE-MODE-ON-NON-IDEMPOTENT-TESTS`, now generalized beyond retries.
4. **Performance evidence on the final path** (scaled ANALYZEd fixture, nested plans — plan
   AE4.4) and the **rollback runbook + out-of-chain template** (plan AE4.6). ⛔ Measure the
   re-keyed site's policy body through layers 3→2→1, **never `holds_role` alone** — optimizing
   before the seam exists makes the wrong thing faster (0176 Consequences).
5. **Record step:** ✅ the AE4.8 **and** AE4.9 sections exist in the increment record.
   ⛔ **Still owed: `docs/backend-state.md` has NO `authz` section** — and AE4.9 just changed the
   surface it must describe, so write it *after* item 3, stating plainly how far the permission
   layer is authority (0162 §2: authority-**elect** until AE5-complete). Then Gate AE4 = full §6
   + QA review + PO approval.

## Re-derivation appendix

`DB=supabase_db_azkbbhskturikxpgmafq`; **no `psql` on PATH** — use
`docker exec "$DB" psql -U postgres -d postgres -At -c "…"`. ⛔ Reset first (§ Dead ends).

- Catalog state: `select state, count(*) from authz.roles group by state;`
- The code `staff_admin` does NOT hold: `select code from authz.permissions pm where not exists (select 1 from authz.role_permissions rp where rp.role_code='staff_admin' and rp.permission_code=pm.code);`
- Wrapper delegation — ⚠ the terms changed in AE4.7b; asking the old ones returns false and reads
  as a broken cutover: `select proname, prosrc ~ '\mholds_role\M', prosrc ~ '\mhas_role\M', prosrc ~ 'assignment_facts' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname like 'is_staff_admin_of%';`
- ACL by EFFECTIVE PRIVILEGE, never `proacl` text (a NULL `proacl` includes PUBLIC):
  `select proname, has_function_privilege('anon',p.oid,'EXECUTE'), has_function_privilege('authenticated',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and proname like 'is_staff_admin_of%';`
- `authz` reachability: `select r, has_schema_privilege(r,'authz','USAGE') from unnest(array['anon','authenticated','service_role']) r;`
- Arms: `ARM=census|hat|floor|catalog|sites bash supabase/tests/mutation/p0-authz-invariant.sh`
  and `FROMFINDINGS=1 ARM=wrapper …`. ⛔ Read each exit code DIRECTLY.
- Sweep derivation: `BASE=<sha>~1 TIP=<sha> bash scripts/door-sweep-cases.sh` — ⛔ it prints **TWO**
  commands (read arm + write arm); running one leaves the other half unmeasured, and **exit 1
  (migrations touched, zero gates derived) is a finding to rule on, never a pass**.
- Audit census (2026-09-02) — callers of the resolver:
  `select coalesce(string_agg(n.nspname||'.'||p.proname, ','),'<none>') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosrc ~ 'has_direct_permission' and p.proname <> 'has_direct_permission';`
  — readers of `session_selectable` / `role_permissions`: same shape, swap the regex. Expect
  `<none>` / `authz.has_direct_permission,authz.explain_direct_permission` until AE4.9 lands.
- Audit probe, rollback-contained:
  `begin; delete from authz.role_permissions where role_code='staff_admin' and permission_code='commission.forms.edit'; select app.is_staff_admin_of_for('a0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000002'), authz.has_direct_permission('00000000-0000-0000-0000-000000000002','commission','a0000000-0000-0000-0000-0000000000a1','commission.forms.edit'); rollback;`
  — `t|f` is the F1 defect; after AE4.9 the production door for that code must read `f`.
- One spec through the prod gate: `SPECS="e2e/<f>.spec.ts" bash scripts/e2e-prod-gate.sh`.
- ⛔ For any SQL/RLS/RPC/authz claim the **live catalog is the sole truth** — never a migration
  file, never graphify (CLAUDE.md's binding exception).
