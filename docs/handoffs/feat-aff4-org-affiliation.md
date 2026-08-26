---
branch: feat/aff4-org-affiliation
task: AFF4 — org affiliation, per-hospital staff data, the voided tense
adrs: [0151, 0154, 0079, 0098, 0133, 0148, 0153]
base_sha: 192a95c3
created: 2026-08-26
updated: 2026-08-26
status: live
---

# Handoff — AFF4

## ▶ RESUME HERE

1. `supabase db reset --local`
2. `npx playwright test e2e/phase17-documents.spec.ts --project=chromium -g "AC-7"` — settles
   the one open blocker (§ Open questions). Do this **before** anything else consumes the fresh DB.
3. Write + run the **owed pgTAP door-SQLSTATE half** (catalog `==` declared set). **Report its
   verdict before starting B5** — its absence is the agreed signal that B5 has not started.
4. B5 (backfill) → B6 (widened, per ADR 0154) → B7 → rest of B8 → B9.

⛔ Re-measure before relying on anything below — see § Trust.
Design detail, task text and the discovered-findings record: `docs/plans/aff4-org-affiliation.md`.

## Trust

Written at **low context usage**, compacted from `docs/plans/aff4-org-affiliation.md`, which was
maintained incrementally throughout — not reconstructed at a wall. Sections marked VERIFIED name
their witness **and who produced it**; the lead did not personally re-run the teammates' gate
commands, and that attribution is stated rather than smoothed over.

⚠ **Eight instruments in this build returned success while measuring nothing**, two of them
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

### Written but UNVERIFIED / BELIEVED

- **The five wired TS actions and `getOwnPersonRecord` reach real doors**, and **F2/F3/F5 render
  correctly against live data.** Typecheck, lint and Vitest pass; **no browser has exercised any of
  it end-to-end** — the frontend track ran under a no-DB constraint throughout. Settled by T2–T5.
- **`affiliate_person_to_org` is correctly absent from the door-error derived set**, because
  `actions.ts` does not call it yet (its caller is D13's `registerUser` via the `_for` twin).
  Settled when D13 lands and the derivation picks it up.

### UNKNOWN — named, not covered

- Whether AC-7's failure is session-state accumulation or a real regression (§ Open questions).
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

`base_sha` **192a95c3**, 42 commits ahead of `main`. Working tree carries **no source changes** —
two untracked non-source paths only (`.claude/skills/handoff/`, and
`scripts/progress-cleanup-2026-08-26.mjs`, a one-shot from another session whose §-State step 3 is
still un-run and wants freshly measured **remote** figures). Nothing is pushed.

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

## Dead ends

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

- **Merge order (PO, 2026-08-26)** — **AFF4 merges FIRST**; `claude/angry-stonebraker-c8e637` (the
  DatePicker wrapping-`<label>` bucket) is **held** and has been told so. Its 8 call-site changes have
  had no E2E pass, so landing it first would have put unexercised accessible-name changes under
  AFF4's `e2e:prod` and attributed any flake to AFF4. ⚠ At merge: that branch rebases onto post-AFF4
  `main`; the two shared control files are **byte-identical** (blob hashes `cd337073…` / `0950c364…`)
  and the call-site sets are disjoint, so a conflict in either control file means **the byte-identity
  assumption broke** — stop, don't resolve. ⚠ `BUG-CASEPHASE-DUEDATE-001` (live data-loss on `main`:
  a label click clears an in-dialog date, dropping an existing deadline on save — recoverable, major,
  not a blocker) rides on the held branch. ⛔ **No cherry-pick fallback exists** — the data-loss and
  a11y fixes are the *same edit* (un-wrapping the `<label>` does both), so cherry-picking puts one
  file's changed names into the gate, not zero. ⭐ **The hold's premise dissolves once that branch runs
  its own tester pass**; the local DB was released to it during AFF4's pause for that reason.

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

- ⚠ **AC-7 — `phase17-documents.spec.ts`, "each version upload lands at a NEW storage path (Rule 6)".**
  Verdict: **unresolved as to cause, confirmed unrelated to F0.** Mechanism: `waitForVersionFile`
  times out at 30 s waiting for `file_objects.upload_state` to reach `unscanned_accepted`, receives
  `null` (`e2e/helpers/documents.ts:243`). Fails **standalone**, so within-session ordering is ruled
  out. Two non-conclusive corroborations: the 2026-08-25 merged-tree gate recorded this document
  group at 0 failures, and `dm3-wave-b-documents` DM3B-8 exercises the same "new path per upload"
  mechanism and passed the same day. **Cannot be distinguished without a fresh reset** — hence
  resume step 2. ⛔ **If it still fails on a freshly reset DB, it is a real regression: file a bug and
  stop treating it as flake.** Not repaired: Rule 6 is architecture, and a spec that stops asserting
  it is worse than one that fails.
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
