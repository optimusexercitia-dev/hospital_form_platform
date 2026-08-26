---
branch: feat/aff4-org-affiliation
task: AFF4 — org affiliation, per-hospital staff data, the voided tense
adrs: [0151, 0154, 0079, 0098, 0133, 0148, 0153]
base_sha: 32e88b5d
created: 2026-08-26
updated: 2026-08-26
status: live
---

# Handoff — AFF4

## ▶ RESUME HERE

1. ~~`supabase db reset --local`~~ — ✅ done at `32e88b5d`, exit 0.
2. ~~AC-7~~ — ✅ **RESOLVED, passes on a fresh DB** (see § State).
3. ~~the owed pgTAP door-SQLSTATE half~~ — ✅ **DISCHARGED** (`b5e6f0f1`, `565234c2`). **B5 is
   released.** Verdict in § State.
4. **IN FLIGHT:** B5 (backfill) + B6 (widened, per ADR 0154) + ADR 0156. Then B7 → rest of
   B8 → B9. ⛔ **B5's evidence requires a FRESH reset** — the gate work above ran five mutation
   cycles against live function bodies (restored byte-exact, md5-verified), and *"a green
   baseline is not evidence the DB is fit to mutate"*.

⛔ Re-measure before relying on anything below — see § Trust.
Design detail, task text and the discovered-findings record: `docs/plans/aff4-org-affiliation.md`.

## Trust

Written at **low context usage**, compacted from `docs/plans/aff4-org-affiliation.md`, which was
maintained incrementally throughout — not reconstructed at a wall. Sections marked VERIFIED name
their witness **and who produced it**; the lead did not personally re-run the teammates' gate
commands, and that attribution is stated rather than smoothed over.

⚠ **TEN instruments in this build returned success while measuring nothing**, two of them
**constants** that returned `0` regardless of reality. No conclusion was wrong — the sound half of
each pair carried it — but **any figure quoted from this branch's history should be re-measured,
not inherited.** Full list and sound replacements: the plan's *Risks* section.

## Goal and scope boundary

Authority: **ADR 0151 D1–D17**, amended by **ADR 0154**. Discharges Critical FUP **C5**.

**Explicitly NOT in scope** — load-bearing, not filler:
- Migrating the **RLS legs or the tenant trigger** off `profiles.home_organization_id` (ADR 0151
  D10 defers to a named Phase 2). Only the *application query filters* move.
- The registro search leg, `department`, any `professional_profiles` change (0151 D17).
- `BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY`, the `claims_for` multi-role detector, and app-wide
  error-boundary motion — all found here, all filed, all deliberately out.

## State

### Done — VERIFIED

| What | Witness | Who / when |
| --- | --- | --- |
| 7 migrations `…3200`–`…3800`; 8 pgTAP suites (incl. `374` `375` `377` `378` `379`) | `git diff --name-only main..HEAD -- supabase/` | lead, 2026-08-26 |
| B1·B2·B3·B4(×3)·B8-partial · F0·F1·F2·F3·F5·F6-badge · T1 | `git log --oneline main..HEAD` | teammates |
| C5 keystone `374` observed **RED 2/15 pre-B3**, red **reproducible from the migration alone** | byte-for-byte revert of the migration delta → 2/15 red on tests 11–12 → byte-for-byte re-apply | backend |
| B3 changed **exactly three lines** across the three policies | `pg_policies` diff before/after | backend |
| `authenticated` holds EXECUTE on no `_for` twin | catalog ACL read after fresh reset | backend |
| Exactly one arity per door name after DROP+CREATE | `pg_proc` read after fresh reset | backend |
| `get_own_person_record` has **no `_for` and no `_impl`** | `379` §1.4 | backend |
| **AC-7 passes on a fresh DB** — the blocker was stale-DB state, **not** a regression | `supabase db reset --local` (exit 0) → `npx playwright test e2e/phase17-documents.spec.ts --project=chromium -g "AC-7"` → **1 passed, 18.7 s**, exit 0, at `32e88b5d` | **lead, own run**, 2026-08-26 |
| The backend track has **not** advanced since `192a95c3` | `git diff --name-only 192a95c3..HEAD -- supabase/` → empty | **lead, own run**, 2026-08-26 |

**✅ The door-SQLSTATE gate — DISCHARGED `565234c2`, verdict recorded.** The live door family raises
**18 codes over 31 bodies** (`23514,42501,HC0G0–HC0G4,HC0R0–HC0RA`); AFF4's five are
**`HC0R6`–`HC0RA`**. Both defects fixed, not one: `check_violation` has **11 live raise sites**, so
the named-condition half was load-bearing in the real assertion. The domain is now **structural,
keyed on no name** — owner-only VOLATILE DEFINER kernels behind client-callable wrappers — which
matters because deriving `app.<x>_impl` from `public.<x>` would have looked identical today and
**missed `public.appoint_technical_director`** (fronts two kernels, shares a base name with
neither). Mutation proof: 5 mutations applied *through the threat mechanism itself*
(`pg_get_functiondef`+`replace`+`execute`), each restored md5-exact, **`planned 44 / ran 44` in
every run** — the abort-before-the-arm failure mode did not recur. Lead-verified independently:
hand-list and 5-char regex survive only as comments (L207/210), plan 38→44.
⚠ **Known cross-file tension, stated so it is not later read as a conflict:**
`door-error-arms.test.ts` asserts its set does **NOT** contain `23514`; the live set **DOES**.
Different domains, both correct.

⭐ **The owed half was NOT a greenfield write — its shape already existed, carrying two defects with
the same symptom.** Measured at `32e88b5d` on the fresh DB:
`supabase/tests/304_affiliation_lifecycle.sql` **§6** ("THE LIVE HALF OF THE ERROR-ARM CONTRACT",
~L195–215) already asserts catalog-derived SQLSTATEs `==` a declared set — but
**(a)** its domain is a **hand-maintained list**
(`p.proname in ('affiliate_person_impl','end_affiliation_impl','update_affiliation_impl')`), which
excludes every AFF4 door, and **(b)** its matcher is `errcode = '([A-Z0-9]{5})'` — the **syntax**
boundary the TS half already had to abandon, blind to named conditions (`check_violation`). Its
expected set stops at `'42501,HC0R0…HC0R5'`, i.e. **pre-AFF4**. ⛔ Fixing only (a) — adding the new
names — goes green and stays blind to (b), **indistinguishable from a real fix**.
⚠ **And `door-error-arms.test.ts`'s own header asserts the opposite**, claiming §6 "asserts the
running kernels raise exactly this set". That claim is **false for AFF4's codes** — a comment
laundering a belief into a fact, in the file whose entire purpose is to stop that.

### Written but UNVERIFIED / BELIEVED

- **The five wired TS actions and `getOwnPersonRecord` reach real doors**, and **F2/F3/F5 render
  correctly against live data.** Typecheck, lint and Vitest pass; **no browser has exercised any of
  it end-to-end** — the frontend track ran under a no-DB constraint throughout. Settled by T2–T5.
- **`affiliate_person_to_org` is correctly absent from the door-error derived set**, because
  `actions.ts` does not call it yet (its caller is D13's `registerUser` via the `_for` twin).
  Settled when D13 lands and the derivation picks it up.

### UNKNOWN — named, not covered

- ~~Whether AC-7's failure is session-state accumulation or a real regression.~~ **SETTLED — see
  § State, it passes on a fresh DB.** Kept as a line rather than deleted because the *mechanism*
  is still unknown: fresh-vs-mutated DB is now the established discriminator, but nothing measured
  **which** residue does it.
- Whether the `${date}T00:00:00.000Z` construction in the suspension write path exists at all, and
  if so at which line. Two readings disagree; both may be true of *different* lines.
- The true denominator of the `claims_for` multi-role vacuity class. Three instances were found
  and fixed; the predicate that found them measured a **syntax**, not a domain (41 reported vs a
  real `claims_for(` count of 2449).
- Whether `00_setup.sql` overwrites migration-defined objects **other than** `claims_for`.

### Not started

B5 · B6 · B7 · B9 · the rest of B8 (D13 `registerUser` start date, D15 `updateUserProfile`
tightening) · F4 · F6's toggle · T2–T5 · `qa` · the §6 gate.

### Tree

`base_sha` **32e88b5d**, **59** commits ahead of `main` (was 42 at `192a95c3`; the 17 new commits
are the DatePicker merge, ADR 0155, and doc/record work — **no `supabase/` change**, verified by
`git diff --name-only 192a95c3..HEAD -- supabase/` returning empty, so the backend track has not
advanced and the gated resume order still stands). Working tree carries **no source changes** —
one untracked non-source path (`scripts/progress-cleanup-2026-08-26.mjs`, a one-shot from another
session whose §-State step 3 is still un-run and wants freshly measured **remote** figures);
`.claude/skills/handoff/` is now committed. Nothing is pushed.

## Gates

| Arm / suite | At | Result | Exit | Witness by |
| --- | --- | --- | --- | --- |
| `ARM=census` | post-`ac638174` | INVARIANT HOLDS, 564 gates / 599 verdicts | 0 | backend |
| `ARM=hat` | same | INVARIANT HOLDS | 0 | backend |
| `ARM=floor` | same | INVARIANT HOLDS **on re-run** | 0 | backend |
| `FROMFINDINGS=1 ARM=wrapper` | same | INVARIANT HOLDS | 0 | backend |
| Diff-scoped door sweep | B3 | CLEAN 4/4 COVERED **on re-run** | 0 | backend |
| pgTAP (full, fresh reset) | `d23b6c55`-era | 227 files / 7510 tests PASS | 0 | backend |
| `npm run lint` (ten gates) | `192a95c3` | pass | 0 | **lead, own run** |
| `npx tsc --noEmit` | `192a95c3` | pass | 0 | **lead, own run** |
| `npm run test` (Vitest) | `192a95c3` | 1842 passed | 0 | **lead, own run** |
| 11 date-touching e2e specs, serial | `192a95c3` | 10 clean, 1 failure (AC-7) | — | tester |

⚠ **`ARM=floor` and the door sweep both failed first and passed on re-run.** Floor named
`update_org_affiliation` as authenticated-reachable with **0 calls**; the sweep returned **1 BLIND**
on `organization_affiliations_select`. Both were closed with **keystones, never allowlist entries** —
allowlisting makes the floor arm and the door arm agree, and agreement reads as coverage.

**Did NOT run:** `npm run e2e:prod` (the full batched gate — §6 step 2, still owed) · the periodic
full ~5 h door sweep · `ARM=policy` · any remote/linked-project measurement.

⚠ **The merged-in DatePicker branch brought its own `e2e:prod` GREEN** (`GATE_EXIT=0`, 1239p/0f,
2 flaky **named** in the plan because `GATE_LOGDIR` is not run-scoped). ⛔ **It does NOT cover
`61e23659`** — the `case-access-panel` naming landed *after* that run, so **AFF4's gate is its first
execution**; `e2e/case-access.spec.ts` reaches it. That caveat was lost once already when the FUP
index line was compressed for cap headroom.

## Dead ends

- ⭐⭐ **A claim measured TRUE in a peer's UNCOMMITTED tree goes false the moment they commit —
  and the RELAY is where it becomes an instruction.** `backend` correctly observed a stale
  `listOrgAffiliatedPrincipalIds` reference in `usuarios/page.tsx` while `frontend` had that file
  modified; `frontend` rewrote the paragraph before committing `1cbaa1b7`. The lead then forwarded
  the observation as an action item **without re-measuring**. Refuted decisively by
  `git log -S "<symbol>" -- <file>` → **no commits**: the string never reached any commit of that
  file. ⛔ Neither agent was wrong and neither lied — **the claim went stale in transit**, which is
  "clean status is an INSTANT, not a lease" pointed at a peer's tree instead of your own.
  ⭐ The durable rule: **a lead verifies a claim before RELAYING it, not only before ruling on it.**
  Relaying is what launders an observation into an instruction, and it had already happened once
  this session (the F6 chip's *"appears on both"*, carried from the plan into a teammate brief).

- **`where pr.id = v_uid` → `where true` as a mutation proof.** Returns 36 rows, an earlier arm's
  scalar subquery raises, and the suite **aborts at test 35 of 39 — the arm under test never
  executes.** The run still reds, indistinguishable from a red that proves the arm. The working
  mutation returns a **fixed row**, preserving suite completion. **Mutation testing needs its own
  liveness check.** The pgTAP plan count (`planned 39, ran 35`) is what exposed it.
- **Hardening `test_helpers.claims_for` to raise on a multi-role persona.** Built, positive-control
  failed in the full suite, reverted. Two reasons: `00_setup.sql` `create or replace`s that function
  as DDL **outside** its rollback block, so it commits over any migration's version; and "2+ roles →
  no claim" deliberately mirrors production's `custom_access_token_hook` D11 break-glass logic —
  raising would diverge the harness from production and make the genuine multi-role-hatless-caller
  state permanently untestable. A **detector** is the right shape; not built.
- **Unifying the two roster predicates** by routing `listOrgUsers`/`listHospitalUsers` through
  `list_org_people`. Rejected on merits: that door carries **its own authorization gate** *and*
  **per-call `person.cpf_lookup` audit behaviour**, so the directory would emit lookup-audit rows on
  every page view (Rule 11), plus an org-vs-hospital scope mismatch. Three semantics conflated to
  remove one duplication.
- **Adding three filenames to `door-error-arms.test.ts`'s `DOOR_MIGRATIONS`.** Would have gone green
  and covered nothing: the splitter required `create OR REPLACE function` and every AFF4 door is
  bare `create function`. **Two defects with the same symptom** — fixing one and re-running looks
  exactly like fixing both.
- **Seeded-persona pre-fill as the accessible-name assertion site.** `suspendUntil` is an
  unconditional `useState("")` never passed the existing value, so the trigger always shows the
  placeholder. Replaced by a before/after differential, which needs no seed value and fails on a
  pre-F0 build by construction.

## Decisions made in flight

**Ruled:**
- **ADR 0154** — the roster predicate is the *application query filter*
  (`listOrgUsers`/`listHospitalUsers`), **not** `list_org_people`, which has one caller and backs the
  add-a-person CPF search. Both surfaces move; RLS legs stay. Amends 0151 D10.
- **B6 filter home** — at the **data-access boundary** in both layers, same name
  (`p_include_ended`/`includeEnded`), same default (active-only), `lookupOrgPeople` the single
  explicit widener. Parity is asserted **behaviourally in E2E (T2)**, because the property spans two
  runtimes and has no unit-level home; cross-referencing the two unit tests is a courtesy, not a gate.
- **`get_own_person_record` is deliberately not a triple** — a `_for(p_actor)` twin is definitionally
  "fetch any person's column-locked fields". Its absence is asserted in `379` §1.4, because prose
  cannot defend a deliberate absence. **CPF masking stays TypeScript-side**; `OwnPersonRecord` carries
  only `cpfMasked`, so masking is a type-level guarantee rather than a remembered step.
- **PO** — *"suspended until D"* = until `23:59:59` of D in `America/Sao_Paulo`.
- **Task order amended (lead, 2026-08-26): B5 → B7-seed → B6**, not the plan's B5 → B6 → B7.
  Measured on a fresh reset: `organization_affiliations` = **0** (the seed supplies none),
  `profiles` with `home_organization_id` = **35**, `hospital_affiliations` = **5**. So B6's
  predicate has no data to stand on until the seed carries org rows, and six live assertions
  (`302` §5.1/§5.2/§5.7/§5.12, `304`:186, `316`:70,77) would flip RED. ⭐ **The plan's own B7 text
  already stated the dependency** ("the containment backstop makes org rows a precondition … order
  the org inserts first") while numbering B6 ahead of it — a plan-order defect, not an ambiguity.
  ⛔ **REJECTED: a transitional `EXISTS(…) OR home_organization_id = org` fallback.** It greens both
  surfaces while hiding the migration — precisely what D10 exists to perform.
- **B6b's HOSPITAL half is deliberately NOT filtered on org affiliation (lead, 2026-08-26).**
  `listHospitalUsers` runs on the cookie client, and the live policy
  `organization_affiliations_select` = `principal_id = auth.uid() OR app.is_org_admin_of(org)`
  has **no hospital tier** (ADR 0151 D1; pinned by `375` §4.1). Measured as `hospitaladmin.a1`:
  **1** row readable (his own), **0** belonging to anyone else, vs **29** for `orgadmin.a`. Filtering
  there would blank the hospital directory for the only role it serves. ⭐ **Decisive fact:
  acceptance criterion 1 names an ORG admin**, so the org half satisfies it alone — nothing forces
  the hospital half into this increment. ⛔ **REJECTED: widening the policy with a hospital_admin
  leg** — it contradicts D1 (PO-ruled) and would require deleting the `375` §4.1 keystone that pins
  it; retiring a keystone to pass is the shape we have a rule about. Two obligations follow, and
  both are load-bearing: the *"incluir desligados"* toggle must be **ABSENT** on the hospital
  directory (an inert control asserts a filter is applied), and **T2's parity gate must be scoped
  to the ORG directory** or it reds on correct code — a parity test that reds on correct code gets
  weakened by whoever meets it next.
  ⚠ **Residual gap, filed not fixed:** `hospitalPeopleIds`' membership arm selects seats with **no
  `expires_at` filter** while D6 rules an expired membership does not block `end_org_affiliation`,
  so an expired-seat holder can be org-offboarded and still appear on the hospital directory.
  **Stale roster, NOT an authorization leak** — their data was already visible to that admin.
  Candidate fix is a narrow ids-only `SECURITY DEFINER` helper with **no audit emission** (so it
  does not repeat the mistake ADR 0154 rejected); **unscheduled, needs a PO go.**
- **D4 containment backstop lands after B7-seed, NOT after B5** — and `app.affiliate_person_impl`'s
  **live body says otherwise**, a stale comment sitting in `prosrc` where nothing greps and no gate
  reads. B5's backfill matches zero rows on a fresh local reset (migrations precede `seed.sql`), so
  it can never be what makes the seed's 5 parentless hospital affiliations safe: necessary, not
  sufficient. Installing the backstop *before* B6 makes `db reset` itself the test of the seed
  ordering.

- **Merge order — SUPERSEDED BY EVENTS 2026-08-26, and the hold is OVER.** The prior ruling
  ("AFF4 merges first; `claude/angry-stonebraker-c8e637` is **held**") described a two-branch world
  that no longer exists: that branch was **merged INTO this one** at `3d588673`, and
  `git branch --list` no longer shows it. **One tree, one gate.** Consequences that follow, and that
  the superseded text got backwards: `BUG-CASEPHASE-DUEDATE-001` (live data-loss on `main` — a label
  click clears an in-dialog date, dropping an existing deadline on save; recoverable, major)
  **ships WITH AFF4 instead of behind it**, and the whole rebase/byte-identity protocol
  (blob hashes, "a conflict means the assumption broke", the no-cherry-pick finding) is **moot** —
  ⛔ including the pin *"`date-picker.tsx` is byte-identical with the held branch, tell it before
  changing that file"*: **there is no branch to tell.** Corroborated independently by PROGRESS.md
  § Now. ⚠ What does **survive** is the gate consequence, and it is the load-bearing half:
  the merged branch's own `e2e:prod` GREEN **does not cover `61e23659`**, so AFF4's `e2e:prod`
  remains the **first** execution of the `case-access-panel` naming.

**Provisional:** none outstanding — both prior provisionals are ruled.

## Open questions / blockers

- ⛔ **AFF4's own regression, unfixed and needing a go before merge.** F0's
  `aria-labelledby="{labelId} {buttonId}"` self-reference re-admits the trigger button's contents,
  which include a **nested `role="button"` span** (`date-picker.tsx:193-197`, pre-existing) carrying
  `aria-label="Remover data"`. Measured differential: `clearable={true}` yields
  `"Suspenso até (opcional) 01/03/2023 Remover data"` — the trigger announces a *different action's*
  name. **10 call sites, 9 in F0's bucket.** The nested-interactive-content half is pre-existing; the
  **name contamination is AFF4's**, since nothing pointed the name at contents before F0.
  ⚠ The FUP's recorded worked example is wrong for the same value-dependent reason — measured empty,
  where the clear affordance does not render. ⚠ T1's guard does not catch it (label and date are both
  still present). Repair is a **layout** change — clear affordance as a real sibling button;
  ⛔ `aria-hidden` would remove a control from AT and is worse than the bug. ⛔ `date-picker.tsx` is
  pinned byte-identical with the held branch — tell it before changing that file.

- ~~**AC-7 blocker**~~ — ✅ **CLOSED 2026-08-26, not a regression.** Detail in § State. The
  pre-registered decision rule ("if it still fails on a freshly reset DB it is a real regression,
  file a bug") was written **before** the measurement and **not** met, so no bug is filed. Rule 6
  keeps its assertion; nothing was repaired because nothing was broken.
- **Who fixes `BUG-SUSPENSION-DATE-RENDERS-A-DAY-EARLY`.** Ruled and fully specified in
  PROGRESS.md § Bug Log; not scheduled.

## Next task

Resume step 1–2 above, then step 3. Step 3 is the one with history: it was agreed once inside a
design proposal by both parties and turned into an item by neither, and a coverage test then ran
green while covering none of the five new SQLSTATEs. It is gated on purpose — **B5 does not begin
until its verdict is reported.**

## Re-derivation appendix

```
git log --oneline main..HEAD                 # what this branch actually contains
git diff --name-only main..HEAD -- supabase/ # migrations + pgTAP added
npm run lint && npx tsc --noEmit && npm run test
supabase db reset --local && npm run test:db
bash scripts/door-sweep-cases.sh main        # exit 3 = no migrations in diff; exit 1 = a FINDING
tasklist 2>/dev/null | grep -c "^node.exe"   # NOT tasklist /FI — that form is a constant 0
netstat -ano | grep LISTENING | grep -E ":(3000|3001)\s"
```

⛔ For any schema / RLS / RPC / authorization claim the **live catalog** is the sole witness
(`pg_proc` incl. `prosecdef`, `pg_policies`, ACLs). Never a migration file, never graphify.
