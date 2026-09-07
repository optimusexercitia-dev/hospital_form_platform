# ENFORCEMENT-MANIFEST — progress record

Enforcement manifest: pre-AE5 remediation Batch 4 (Batch 5, the rollback runbook, rides along).
The unit's **summary** is its hub, [docs/features/enforcement-manifest.md](../features/enforcement-manifest.md)
§ Current state; this file is its **log** (ADR 0186 D3): one dated subsection per session, appended.

Subjects: the enforcement manifest (the AE4 per-role template's oracle — its `hardDenyClasses`
column, its `enforcementSites` rows and their qualifiers), the manifest lint arm (M7) and its §6.2
search, pgTAP `410` (§8.5's by-name pin), `public.set_item_validations` and every other DEFINER
writer behind a `_staff_admin_write` policy (a migration if re-keyed), `docs/backend-state.md`'s
authz section, and `docs/deployment/authz-rollback-runbook.md` §6.1–6.2.
Decisions: ADR [0162](../decisions/0162-authz-evolution-plan-audit-corrections.md) (AE5 is
post-pilot; the runbook's shape), [0176](../decisions/0176-authz-permission-layer-made-real.md)
(the permission layer; D8's bundle stays AE5's), [0079](../decisions/0079-authz-door-blindness-standing-invariant.md)
(a green arm bounds its own domain), [0190](../decisions/0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md)
+ [0191](../decisions/0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
(the diff-scoped sweep this unit owes, both arms). This unit's own ADR: **0193**, reserved
2026-09-07 (0192 → Batch 3).

## Session log

### 2026-09-07 — unit opened (lead, second machine)

**Why now.** Batch 4 of the pre-AE5 batches ruled 2026-09-04; ruled 2026-09-07 to run on a
separate machine in parallel with Batch 3 (whose ~13 h `RESET_EVERY` write-path sweep owns the dev
machine's stack for a day). This machine: macOS, own clone, own Docker stack
(`supabase_db_azkbbhskturikxpgmafq`, up and healthy at open), `.env.local` present. `main` @
`23ec1fa5`, clean, no `in_progress` hub anywhere in `docs/features/INDEX.md` — Batch 3's hub is not
in this clone (it opens on the other machine).

**Scope.** Four follow-ups (hub § Acceptance criteria) plus Batch 5's runbook re-measure, riding
along because a class-wide re-key here moves the very count §6.2 must assert — measuring it at this
unit's tip is the only measurement that stays true. Explicitly NOT: the write-arm re-baseline and
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Parts 2–4 (Batch 3, other machine); the D8 bundle and
anything ADR 0176 D8 reserves for AE5's opening ADR (Batch 9); the privilege budget (Batch 7);
`app.can_manage_professional`'s self-check arm (Batch 8); Tier 2's 190 doors (deferred by ADR
0171, **not** cleared — every gate record citing the sweep says so).

**Facts at open** (from the follow-up bodies and the plan; every figure to be re-measured by the
builder on a fresh reset):
- `hardDenyClasses` is `[]` on 43/43 manifest rows; M7 iterates zero times; §6.2 searches depth 1
  only, no discrimination control. Remediation (a) — the `measured-depth1-at-sites-and-authorizer`
  label and the caption — is on `main` since 2026-09-03; (b) is owed as ONE change.
- `form_item_validations`' re-keyed policy is unreachable (`authenticated` holds SELECT only);
  `public.set_item_validations` gates on `is_staff_admin_of`. The `_staff_admin_write` class is
  **unswept** — its size is unknown at open; the builder enumerates it from `pg_policies` +
  `pg_proc`, never from migration text.
- `app.current_professional_read_organizations` carries the literal `org.professionals.read`, is
  in no `enforcementSites` row, and is held green by a by-name pin in `410 §8.5`. PO ruling owed
  **before** the build (it changes the manifest diff).
- `app._audit_access_authorized` is the fourth consumer of `can_read_professional_profile`; owed a
  note, ⛔ not a site.
- Runbook §6.2 says `EXPECT 4 rows`; the AE4 re-key made it six; an interim banner has sat beside
  it since 2026-09-03.

**Parallel-run obligations (plan §3 Batch 4, items 1–6):** merge Batch 3 first; rebase onto it and
**re-run the diff-scoped sweep, both arms**, `SCOPE:` re-quoted, `npm run lint` mid-merge; until
Batch 3 lands, check by hand that the write-arm case list is non-empty before reading its exit as
a pass; ADR 0193 reserved; `follow-ups-open.md` + the two indexes will conflict — regenerate the
indexes, never hand-merge.

**Next.** `backend` returns a full plan (the subjects decide what the site-axis arm measures and a
re-key is a migration); the lead rules into one scratch file; the read-organizations question goes
to the PO before the build.

**Gate 13 on macOS (found at open, fixed on the branch).** `check-docs-registers.mjs:1179` passed
`--format=%(refname:short)` unquoted to `/bin/sh`; on macOS the shell rejects the parentheses, the
helper's silenced stderr turns that into an empty branch list, and every `in_progress` hub reds as
"branch does not exist" — a dead census that reads as a finding (plan §5's `grep -rniF` shape,
inverted). Quoted the format; gate 13 and the full `npm run lint` chain green after. Windows Git
Bash never saw it. Filed nowhere else: fixed in one line on this branch, noted here.

**Plan received and ruled (lead, same day).** `backend`'s plan (871 lines, scratch) measured the
class the follow-up conflated: 30 `_staff_admin_write` policies by name (49 by shape), all `FOR ALL`
to `authenticated`, **6 re-keyed** onto `app.can_edit_commission_forms`; **8** DEFINER writers behind
them, **0 of 8** on the permission (the manifest's own "D 8 form fns"; the matrix's 22 is read+write,
a different population); the split touches **4 of the 6** re-keyed tables but only
`form_item_validations`' policy is wholly unreachable — so **one** re-key (`set_item_validations`) and
seven recorded splits. Depths re-measured 2/3/3, 5, and 4 (authorizer-rooted; +1 policy-rooted);
4 of 7 hard-deny classes have `gate: null` and are unfindable by any call search. Three findings the
bodies do not carry: §6.1's `commission_of_version` live-twin has **already expired** (0 live rows);
`409` §2.10c's prescribed fix (`moved/carries-the-code`) is wrong for the correct implementation
(`moved/no-code`); runbook `:512` `EXPECT 63 / measured 59` is a third stale figure. Predicted
`test:db` shape 8876 → 8881; **no `410` pin is deleted** — §8.5's element flips to `[declared site]`.

**PO rulings (AskUserQuestion, 2026-09-07):** Q1 **(A)** — `current_professional_read_organizations`
declared a site; Q2+Q3 **(A)** — structured `definerSurface` + `nonEnforcementConsumers` with lint
arm M13 and `410` closure arms, one design; Q6 — the matrix row-1 edit **delegated** to the unit,
before/after quoted here for review. **Lead rulings:** Q4 (A) one provenance value per real state;
Q5 (A) + a filed follow-up for the gate-less classes; B.1 (iii); B.2 one migration from live
`pg_get_functiondef`, red-first §2.10d; B.5 all eight items at the tip; ADR 0193 per §F. Rulings
file: scratch `batch4-rulings.md`. The lead runs the tip gate, not the builder.

### 2026-09-07 — build (backend)

**Preconditions, re-asserted before anything was touched**, and every one matched the plan's figures
exactly: `npx supabase db reset --local` exit **0** at head `20261003007340`; `current_database()` =
`postgres`; `app` / `authz` / `public` all present (the `authz` schema is how this stack is told from
`escalume`); `npm run test:db` **Files=262, Tests=8876, PASS**, exit 0; `node
scripts/gen-authz-matrix-cells.mjs --check` exit **0** — *"in sync (2002 cells, 114998 skipped, sha
`2ddda77978bb`; manifest 43 rows, {"pending-rekey":40,"re-keyed":3}, sha `7831929128e7`)"*.

**Commits (7):** `ba7c70f1` 409 red-first · `ca4b9070` the migration · `eea8f48a` manifest +
generator + 410 · `bea1eda2` ADR 0193 + the Q5 follow-up + backend-state + the matrix cell ·
`c00eda8a` the runbook · `966d69d3` the five closures · and the hub/record commit carrying this entry.

#### Red-first, observed before the migration file existed (D7 + D8)

`409` was written first — §2.10c re-aimed to `moved/no-code`, §2.6f/§2.10e added — and run against
the **un-migrated** catalog. Bare exit **1**, `Failed tests: 30, 32`:

```
# Failed test 30: "2.10c ⭐⭐ REPRESENTATIVE 1's DEFINER DOOR — RE-AIMED at 20261003007350 …"
#         have: layer1/no-code
#         want: moved/no-code
# Failed test 32: "2.10e ⭐⭐ THE GATE LINE AT THE DEFINER DOOR …"
#       caught: no exception
#       wanted: 42501
# Looks like you failed 2 tests of 75
```

⭐ Test 32's *"caught: no exception"* **is the defect `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` names**,
measured behaviourally: with the `staff_admin → commission.forms.edit` grant deleted, the door still
let the write through. Its twin §2.6f (grant present) was **green in the same run** — 73 of 75 passed
— so the differential had both polarities before the SQL was written. After the migration + a fresh
reset: `409` **ok, 75/75**, bare exit 0.

**⚠ Two things moved that the plan did not predict, both attributed:**
1. **`2.10d` was already taken** by the permissive-sibling control, so the new behavioural assertion
   is **§2.10e** and its baseline twin is **§2.6f** (`2.6e` was taken too).
2. **`409` §5.2 red at 179 → 178** after the migration. Its caption said *"its FUNCTION-body surface
   did not move at all … This increment touched no function that calls the wrapper"* — true of
   `…7300` and `…7340`, which moved POLICIES only. `20261003007350` is the **first increment in this
   program to re-key a FUNCTION**. Corrected to 178 with the original kept as a dated note; the delta
   is fully attributed (one body replaced, it matched the pattern before and does not now).
   ⚠ **So `409` is `plan(75)`, not the predicted `plan(74)`: +2, not +1.** The extra is §2.6f, and it
   is not optional — this file's own header says *"a `door = false` that was already false proves
   nothing about the grant"*, so a `throws_ok` under the mutation with no baseline half is exactly the
   vacuity it warns about.

#### The migration

`supabase/migrations/20261003007350_batch4_rekey_set_item_validations.sql`. Body regenerated from
`pg_get_functiondef('public.set_item_validations(uuid,jsonb)'::regprocedure)` at head `…7340`;
`diff` against the live dump shows **exactly one line**:

```
<   if not (app.is_staff_admin_of(v_commission) or app.is_tenancy_admin_of(v_commission)) then
> if not app.can_edit_commission_forms(v_commission, (select auth.uid())) then
```

`SECURITY DEFINER`, `search_path = app, public, pg_catalog` and the signature unchanged ⇒
`create or replace`, no DROP, no dependent policy, no new public RPC (so no `REVOKE ALL FROM PUBLIC`
owed), no `citext`. Verified post-reset: `prosecdef = t`, `search_path=app, public, pg_catalog`.

#### Measurements at the tip (post-migration, fresh reset)

| # | fact | measured |
| --- | --- | --- |
| 1 | global call-edge table | **2564 edges / 867 callers** — ⚠ the plan measured **2565**; the delta is exactly this migration (the door dropped `is_staff_admin_of(` + `is_tenancy_admin_of(` and gained `can_edit_commission_forms(`: −2 +1) |
| 2 | per-row reached-function closures | **10 / 21 / 59** — ⚠ the plan said 10 / **10** / 59 for `org.professionals.create`; **21** is what seeding from the three RPC site bodies *and* the authorizer gives, which is what §B.1.5 specifies. The plan's 10 looks authorizer-only. The derived CLASSES are identical either way |
| 3 | derived hard-deny classes | `commission.forms.edit: principal_inactive` · `org.professionals.create: principal_inactive` · `org.professionals.read: principal_inactive,respondent_exclusion` — exactly the plan's committed claim |
| 4 | `recusal_exclusion` | reached by **no** row at any depth — the honest zero, kept `[]` |
| 5 | DEFINER writers of the 9-table form family | **exactly 8**, `0 of 8` carrying a permission literal, and now **1 of 8 re-keyed** (`set_item_validations`: `is_staff_admin_of=false`, `can_edit=true`) |
| 6 | consumers of the three domain authorizers | **14** — 12 declared sites, `public.set_item_validations` (definerSurface), `app._audit_access_authorized` (nonEnforcementConsumers) |
| 7 | `_staff_admin_write` class | **30** by name / **49** over 37 tables by shape; 6 re-keyed, 22 legacy, 2 legacy+hard-deny; **1** wholly unreachable, **1** partial (`cases`, no DELETE grant), 28 reachable; `form_block_library` confirmed SELECT-only and **not a member** (no write policy to backstop) |
| 8 | runbook figures | six re-keyed policies; `is_staff_admin_of` in `pg_policies` = **57** (so 57 + 6 = **63**, and `EXPECT 63` was right all along); carrier census **4 rows** now / **2** after a full revert; md5 twins `3a86b023…`/`3a86b023…`/`f17a0c42…` unchanged; `commission_of_version` live twins = **0 rows** |

#### The ten fire-proofs, observed

⛔ Every plant lived in a **container-side copy** (`/tmp/plant410`, run through a `plantpgtap` schema
created and dropped for the purpose) or in a **fake tree** outside the repo. The real tree's md5s were
recorded **before** any plant and were byte-identical after: fixture `f868fc65…`, manifest JSON
`d68e227b…`, `410` `adafe625…`; and `--check` exit **0** at manifest sha `493370f994a5`.
**Harness baseline (the clean negative control for every row below): the unplanted copy ran `ok=44
notok=0`.**

| # | plant | observed |
| --- | --- | --- |
| D1 | a `measured-*` row with `hardDenyClasses: []` and no reason, on a fake-tree clone | `--check` bare exit **1**: *"claims a MEASURED hard-deny provenance … with an EMPTY hardDenyClasses and no hardDenyClassesEmptyReason"*. Clean fake tree first: exit **0**. ⚠ **Its discrimination half is NOT provable at `--check` level**: adding the reason changes the JSON, so `--check` then reds on **DRIFT** (the .psql no longer matches) — a different arm. The arm-level half is in `--self-test`, where the validator is fed the mutated manifest directly: *"not caught, as required — a measured row with an empty hardDenyClasses AND a hardDenyClassesEmptyReason is NOT caught"* |
| D2 | `hardDenyClasses: ["record_immutable_published"]` (vocabulary `gate: null`) | *"caught — a hard-deny class whose vocabulary gate is null is caught (M7 arm 3 …)"*; discrimination half *"not caught, as required — a hard-deny class with a NON-null vocabulary gate"* |
| D3 | `["not_a_class"]` | *"caught — a hard-deny class outside the vocabulary is caught (M7 arm 1, retained)"* |
| D4 | ⭐ **both directions.** (a) drop `respondent_exclusion` from the committed claim; (b) **mirror**: add `recusal_exclusion` to `commission.forms.edit` | both `ok=43 notok=1`, `not ok 28 — 6.2`, and the diff NAMES both sides: `have: … org.professionals.read: principal_inactive,respondent_exclusion` / `want: … org.professionals.read: principal_inactive` (and the mirror's `want: commission.forms.edit: principal_inactive,recusal_exclusion`) |
| D5 | §6.2b planted: the synthetic root `'select app.is_case_excluded(v_case, v_uid)'` | green, and the value is `planted=recusal_exclusion,respondent_exclusion \| bare=(none)`. ⭐ **`respondent_exclusion` is 2 hops from the plant** (`is_case_excluded → is_recused_from_case → is_case_respondent`), so the same assertion proves the walk is transitive; a depth-1 search would return only `recusal_exclusion` and red. The bare-root negative half is inside the same assertion |
| D6 | §6.2c natural | green: `read has respondent_exclusion=true / create has respondent_exclusion=false` |
| D7 | `409` §2.10c on the un-migrated catalog | **RED**, `have: layer1/no-code` (above) |
| D8 | `409` §2.10e on the un-migrated catalog | **RED**, `caught: no exception` (above); baseline §2.6f green in the same run |
| D9 | ⭐ **both directions.** (a) manifest declares the site, §8.5/§8.6 expected not updated; (b) §8.6 says `13 / 8 / 4` with the manifest **not** edited | (a) `ok=42 notok=2` — §8.5 on the element text and §8.6 `have: 13 / 8 / 4 / want: 12 / 8 / 4`; (b) `ok=40 notok=4` — §8.6 still red (`have: 12 / 8 / 4`), which is what proves it is not a free-floating constant. §1.4 and §3.6 red too, correctly, because the site really is gone |
| D10 | ⭐ **both directions on §8.7**, plus **both on §8.8**: (a) remove `set_item_validations` from `definerSurface`; (b) add `public.does_not_exist_at_all`; (c) remove the declared non-enforcement consumer; (d) point it at `app.is_active` | (a) `notok=2` — §8.7 *"UNDECLARED DEFINER writer public.set_item_validations writes form_item_validations"* **and** §8.8 *"UNCLASSIFIED consumer FN public.set_item_validations"*, the same object seen from two axes; (b) §8.7 *"public.does_not_exist_at_all is NOT a SECURITY DEFINER function in the catalog"*; (c) §8.8 *"UNCLASSIFIED consumer FN app._audit_access_authorized"*; (d) §8.8 *"declared nonEnforcementConsumer app.is_active does not call the authorizer"* |

Plus **12 new `--self-test` scenarios** in the generator (5 for M7, 7 for M13), each observed
`caught —`, and **2 discrimination halves** observed `not caught, as required`, beside the pre-existing
*"caught nothing on the real spec"* control. `npm run lint:authz-vectors` runs both.

#### `test:db` shape delta

| file | before | after | why |
| --- | --- | --- | --- |
| `409_ae49_d6_rekey_differential.sql` | `plan(73)` | **`plan(75)`** | §2.6f + §2.10e (the two halves of one differential). §2.10c and §5.2 changed **expected values only** |
| `410_ae49_d5_enforcement_manifest.sql` | `plan(40)` | **`plan(44)`** | §6.2b + §6.2c (§6 → 6) and §8.7 + §8.8 (§8 → 8). ⛔ **No assertion was deleted** — §8.5's element text flips `[UNDECLARED]` → `[declared site]` and the `is()` stays. A reader looking for a `−1` on the "delete the pin" account will not find one |
| everything else | — | unchanged | — |
| **suite** | **8876** | **8882** | plan predicted **8881**; the +1 is §2.6f, explained above |

Final run, on a **fresh `npx supabase db reset --local` (exit 0)**: `npm run test:db` bare exit **0**,
**Files=262, Tests=8882, PASS**, 54 s.

#### The other green figures

`npm run lint` bare exit **0** (13 gates, eslint `--max-warnings=0`) · `npm run gen:types` → **empty
`git diff`** on `src/lib/types/database.ts`, as predicted for a `create or replace` with an unchanged
signature · `npm run typecheck` bare exit **0** ⚠ **but only after `npm install`**: this clone was
missing `rehype-stringify` from `node_modules` (it is in `package.json` at `^10.0.1`), which produced
three `TS2307` errors in files this unit never touched. A local install gap, not a code fact;
`package.json` and `package-lock.json` are unchanged.
⛔ The four authz arms, the deriver and the diff-scoped sweeps were **not** run — the lead runs the
tip gate.

#### Q6 — the matrix cell, before and after, for PO review

`docs/design/authz-ae43-staff-admin-permission-matrix.md`, row 1. **Before:**

> · **D** form fns — ⛔ **0 carry a permission literal**; 22 DEFINER functions gate form-family tables
> on `is_staff_admin_of` and none is re-keyed, so "the production door" for this row means the
> **policy** door.

**After** (the dated correction keeps the original text inside it): *"· **D** form fns — ⛔ **0 of 8
carry a permission literal**, and **1 of 8 is RE-KEYED**. ⚠ **CORRECTED 2026-09-07** (Q6, delegated by
the PO): this cell read \[the text above\]. Carrying the literal and being re-keyed are **different
questions** … ⛔ **8 and 22 are DIFFERENT POPULATIONS and both are correct — neither is a correction of
the other** (LEARN-079): **8** = SECURITY DEFINER functions that **write** a form-family table …;
**22** = DEFINER functions that **gate** form-family tables on `is_staff_admin_of`, i.e. the wider
**read-and-write** population. The remaining **7 of 8** are AE5's and are declared as data in the
manifest row's `definerSurface` …"*. The same cell's *"the real write path is the DEFINER
`public.set_item_validations`, still layer-1"* gained its own dated correction.

#### Decisions taken alone (each is a deviation to be ruled on)

1. **`set_item_validations` is declared on the `definerSurface` axis, NOT added to
   `enforcementSites`.** After the re-key it composes the authorizer exactly as the six policies and
   the three `org.professionals.create` RPC sites do, so it would qualify as a site — and declaring it
   one would move §8.6's triple to `14 / 8 / 4`, against the ruled `13 / 8 / 4`. Kept off the site
   axis because §8.4's closure is **policy-only and says so**, one door has one home (ADR 0186), and
   its `definerSurface` entry already records the re-key (`gate: app.can_edit_commission_forms`). Its
   behavioural proof is `409` §2.6f/§2.10e. ⚠ **`410` §8.8 therefore partitions consumers three ways**
   (site / definerSurface / nonEnforcementConsumer), not two.
2. **§8.7's forward arm is bounded to WRITE-capable policy sites** (`cmd in ('ALL','INSERT','UPDATE',
   'DELETE')`, read from `pg_policies`, never hand-listed). Without the bound it reported every DEFINER
   writer of `professional_profiles` as an undeclared writer behind `professional_profiles_select` — a
   category error (a DEFINER *writer* cannot backstop a SELECT policy), observed as a red on the first
   run and fixed by deriving the bound from the catalog rather than by shrinking a list.
3. **`definerSurface` and `nonEnforcementConsumers` are REQUIRED on all 43 rows** (`[]` on the 40
   pending), mirroring `residualLegacyAuthority`, so neither list can be acquired by silence; a pending
   row declaring either is refused.
4. **`hardDenyClassesEmptyReason` is OPTIONAL**, not in `requiredPermissionKeys` — making it required
   would put an empty string on 43 rows and turn the escape hatch into the default it exists to prevent.
5. **`409` §5.2 and `410` §1.4 / §3.6 were re-aimed** (179→178, 12→13, 20→21). None was predicted;
   each is a cardinality control doing its job, each carries a dated note, and each delta is attributed
   to one object.

#### What is NOT proven, stated

The tip gate (the four arms, the two `SELFTEST=1` harnesses, the set-valued targeted home, and the
diff-scoped sweep **both arms** — owed because this batch ships a migration) is the lead's, and until
it runs this unit's authz-domain claims are unproven. ⚠ The write arm's **empty-set trap is open**
until Batch 3 lands: its case list must be printed and checked **by hand** to be non-empty before its
exit code is read as a pass. Tier 2's 190 doors stay **deferred by ADR 0171 and NOT cleared**. The
runbook's post-revert numbers remain **derived expectations** — the revert has still never been
executed. And the seven un-re-keyed form DEFINER doors are **recorded, not fixed**; each owes its own
behavioural differential in AE5.
