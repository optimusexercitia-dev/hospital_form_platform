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
| 1 | global call-edge table | **2564 edges / 867 callers** — ⚠ the plan measured **2565**; the delta is exactly this migration (the door dropped `is_staff_admin_of(` + `is_tenancy_admin_of(` and gained `can_edit_commission_forms(`: −2 +1). ⭐ **The query, added 2026-09-07 (QA F-MINOR-3) and the figure RE-MEASURED with it at head `20261003007350`: 2564 / 867, reproduced exactly.** An "edge" is a **DISTINCT `(caller, callee)` pair** under `hard_deny_closure`'s own `edges` CTE — the raw match count is 2930, and excluding self-edges gives 2562 / 865, which is why the number is not re-derivable without the definition (QA reconstructed 2560/866 and 2584/872 from two other readings of "call-edge table"): `select count(*) from (select distinct (n.nspname||'.'||p.proname) collate "C" as caller, (m.g)[1] collate "C" as callee from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral regexp_matches(regexp_replace(p.prosrc,'--[^'||chr(10)||']*','','g'), '((?:app\|authz\|public)\.[a-z0-9_]+)[[:space:]]*\(', 'g') as m(g) where n.nspname in ('app','authz','public')) z;` and `count(distinct caller)` for the second figure |
| 2 | per-row reached-function closures | **10 / 21 / 59** — ⚠ the plan said 10 / **10** / 59 for `org.professionals.create`; **21** is what seeding from the three RPC site bodies *and* the authorizer gives, which is what §B.1.5 specifies. The plan's 10 looks authorizer-only. The derived CLASSES are identical either way |
| 3 | derived hard-deny classes | `commission.forms.edit: principal_inactive` · `org.professionals.create: principal_inactive` · `org.professionals.read: principal_inactive,respondent_exclusion` — exactly the plan's committed claim |
| 4 | `recusal_exclusion` | reached by **no** row at any depth — the honest zero, kept `[]` |
| 5 | DEFINER writers of the 9-table form family | **exactly 8**, `0 of 8` carrying a permission literal, and now **1 of 8 re-keyed** (`set_item_validations`: `is_staff_admin_of=false`, `can_edit=true`) |
| 6 | consumers of the three domain authorizers | **14** — 12 declared sites, `public.set_item_validations` (definerSurface), `app._audit_access_authorized` (nonEnforcementConsumers) |
| 7 | `_staff_admin_write` class | **30** by name / **49** over 37 tables by shape; 6 re-keyed, 22 legacy, 2 legacy+hard-deny; **1** wholly unreachable, **1** partial (`cases`, no DELETE grant), 28 reachable; `form_block_library` confirmed SELECT-only and **not a member** (no write policy to backstop) |
| 8 | runbook figures | six re-keyed policies; `is_staff_admin_of` in `pg_policies` = **57** (so 57 + 6 = **63**, and `EXPECT 63` was right all along); carrier census **4 rows** now / **2** after a full revert; md5 twins `3a86b023…`/`3a86b023…`/`f17a0c42…` unchanged; `commission_of_version` live twins = **0 rows** ⚠ **under the runbook's own predicate**, `coalesce(qual,'')||coalesce(with_check,'') like '%is_staff_admin_of(app.commission_of_version%'` — i.e. zero policies carry the **PRE-CUTOVER** shape. *(predicate added 2026-09-07, QA F-REC-1: the bare **shape** `app.commission_of_version(form_version_id)` is still carried by **4** live policies, so a reader who re-derives the shorthand without the predicate measures 4 and concludes the claim is false. The runbook line was always precise; this summary was not.)* |

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

### 2026-09-07 — QA fix loop, iteration 1 (backend)

QA returned **CHANGES REQUESTED** (`docs/reviews/enforcement-manifest-review.md`): F-BLOCK-1,
F-BLOCK-2, F-MAJOR-1, F-MINOR-1/2/3, F-REC-1/2. Iteration 1 addresses all eight, on the lead's
rulings. Six commits, `7f7e36af` · `f7835433` · `9467ffb0` · `26eb82d6` · `5a5c163b` · `bd289466`
(this entry), on `authz-enforcement-manifest` over `7b9b1eb7` — **16 over `main`**. All DB work ran **after** the lead's set-valued
re-run marker, on its fresh reset at head `20261003007350`.

#### F-BLOCK-1 — § 6.7 step 4, re-measured at the tip, and it was worse than the finding

**What changed.** § 6.7 step 4 rewritten; § 6.9's `387` cell gains a dated attribution correction;
the closure entry's clause 5 gains a dated note (**five** stale figures, not four).

**Observed.** At head `20261003007350`, `pg_temp.ae15_hot_subset()` re-typed from `387:98-135`:

```
c1_live = f2a0693be216cfe08eb6cf0283565e7c     c2_count = 99
hot-subset membership of the six re-keyed policies:
  form_items t · form_sections t · form_versions t | form_item_options f · form_item_validations f · forms f
professional_profiles_select: in the hot subset, and post_7320_shape = t
```

⛔ **The finding under the finding.** Step 4's `EXPECT after the revert:
a115005b6106573c70d98a6aceb8a4fe` is **not reachable by this revert** — `a115005b…` is the pre-D6
value of the whole 99-policy aggregate, and `20261003007320` (ADR 0182) has since moved a *different*
member of it. Derived by inversion in a **rolled-back transaction** (§ 6.2's six `alter policy`
statements applied verbatim):

```
### AFTER THE SIX-POLICY REVERT (derived by inversion, in a rolled-back transaction)
 c1_after_revert = c227d64eb11909e94400b7ba6bcaab0b | equals_pre_d6 = f | equals_post_7300 = f | c2 = 99
### AFTER ROLLBACK — verified restore
 c1_restored = f2a0693be216cfe08eb6cf0283565e7c | restored_ok = t
```

Step 4 now states **four** landing values with their readings (`c227d64e…` = the revert landed ·
`f2a0693…` = nothing applied · `a115005b…` = you also reverted `20261003007320` · `3901715…` = you
reverted `7320` and left D6 in place), the query, the `count(*) = 99` cardinality control, the
three-of-six reach bound, and the expiry warning. ⚠ **§ 6.9's attribution was also wrong** and is
corrected as a dated note: the value moved at `20261003007320`, **not** `20261003007340` —
`387`'s own re-capture note names `7320`, and `7340`'s two policies were measured today to be
*outside* the hot subset, so that migration could not have moved C1 at all.

#### F-BLOCK-2 — the deriver's FINDING (1) discharged with a real targeted mutation case

**The instrument search, measured, not assumed.** The C2 tier-1 command-door neutralizer was tried
first, in its own subset mode. `CASES="public.set_item_validations" bash
supabase/tests/mutation/c2-command-door-neutralizer.sh`, bare rc **2**:

```
=== DONE — swept 0 of 171 derived enforcer(s) ===
    COVERED=0  BLIND=0  ERROR=0   (skipped by CASES: 171)
*** ABORT: swept ZERO enforcers. This is NOT a pass.
    CASES matched no derived enforcer.
```

and the reason is a **property**, re-derivable from the schema the harness leaves behind:
`c2n.roots = 1 · c2n.gatefn = 1 · c2n.tier1 = 0 · reached from any Tier-1 root = 0` — C2's Tier 1
requires the closure to reach a **PHI-marked relation**, and `form_item_validations` holds none.
⚠ No sentinel refusal occurred; `RECOVER=1` was **not** needed. The two stale `$TMPDIR` sentinels
from the lead's killed sweep were inspected and left in place: their subjects are healthy on this
reset (`public.can_dispose_referral_phi` md5 `b68f37a84ea535cacb0c0c3069696c0b` = the sentinel's own
`.want`; `app.assert_accreditation_enabled` still raises).

**So the case was written**, in the smallest committed home consistent with ADR 0191's
targeted-home precedent: `supabase/tests/mutation/authz-command-door-targeted-cases.sh`. Bare rc
**0**, first run:

```
--- CASE 1: public.set_item_validations(uuid,jsonb) — the authority gate neutralized ---
    fingerprint before: 3c244fa6a08a510aa4708b87516e1be2
    fingerprint mutated: bdcccfe0aa7ddab5ac3c2e8ce98fb094
    409 under mutation: RED (good)
    fingerprint restored: 3c244fa6a08a510aa4708b87516e1be2  (matches before)
    409 after restore: GREEN
    CASE 1 VERDICT: COVERED
=== RESULT: 1 of 1 case(s) COVERED. ===
    DOMAIN: command doors outside BOTH p0-authz-door-audit.sh's PRED_DOMAIN (return
            type is not boolean) and c2-command-door-neutralizer.sh's worklist (the
            door is not Tier-1: its closure reaches no PHI-marked relation).
```

⛔ **`409` § 2.6f / § 2.10e is named beside it as a DIFFERENT instrument, never as this discharge.**
It is a two-polarity **behavioural GRANT differential** (delete the `staff_admin →
commission.forms.edit` row, the door raises `42501`; grant present, the same call succeeds), observed
red-first on the un-migrated catalog. This case is a **BODY mutation** of the gate line. Neither
implies the other, and the gate record must quote the deriver's `SCOPE:` **and** `RESULT: FINDING (1)`
lines rather than its exit code (ADR 0190).

#### F-MAJOR-1 — the merge helper is portable, and the equivalence is measured

`scripts/lib/merge-findings-baseline.sh:447` used GNU diffutils' `--unchanged-line-format` /
`--*-group-format` family; Apple's diff (FreeBSD) rejects them with rc 2, so **every** merge aborted
on this Mac (`gdiff` is not installed and there is no GNU diff on `PATH`). The lead preferred the
portable rewrite over detect-and-abort, and it is provable: the same tagged stream
(`U` / `\002DEL`+`O` / `\002INS`+`N` / `\002CHG`+`O`+`N`) is now built from `diff`'s **normal**
output, parsing only the hunk **headers** and reading the lines from the two files rather than from
diff's quoting.

**Observed**, on this Mac, `SELFTEST=1 bash scripts/door-sweep-cases.sh`, bare rc **0**:

```
SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0
```

(was `PASS 17 · FAIL 17`, every failure `MERGE-ABORT: diff failed with rc=2 while aligning …`). The
18 merge scenarios include the three **pre-fix discrimination** outputs at rc 2 and `merge(b,b) == b`
byte-for-byte on all five fixture baselines. Beyond the fixtures, `merge(b,b)` was run against all
four **real committed** findings baselines — `authz-door-audit-findings.md` (1065 lines),
`authz-invoker-audit-findings.md`, `authz-rowdoor-audit-findings.md`,
`authz-writepath-audit-findings.md` — each rc 0 and **byte-identical**; `git status` confirms no file
under `docs/reviews/authz-*-findings.md` changed.

#### F-MINOR-1 / F-MINOR-2 / F-MINOR-3

- **F-MINOR-1** — runbook `:235` read migration id `20261003007340`'s leading digits as a calendar
  date, dating an expiry four weeks into the future. Now *"EXPIRED AT HEAD `20261003007340`, MEASURED
  DEAD ON 2026-09-07"*, with the misreading kept as a dated note.
- **F-MINOR-2** — `410` § 8.8's caption now reads **12 OF THE 13** declared sites and states the
  two-populations rule (LEARN-079) the same file already states for 8-vs-22: the thirteenth,
  `app.current_professional_read_organizations`, composes `authz.authorized_scope_ids` and never calls
  the authorizer, so it is a site without being a consumer — 12 + 1 + 1 = 14.
- **F-MINOR-3** — **re-measured and it reproduces exactly**: `2564 edges / 867 callers`. The figure was
  not wrong, the *definition* was missing — an edge is a **DISTINCT `(caller, callee)` pair** under
  `hard_deny_closure`'s own `edges` CTE. Measured today: raw match rows **2930**, distinct pairs
  **2564**, distinct callers **867**, self-edges excluded **2562 / 865**. The query is now pasted
  beside the figure, so the row meets `backend-state.md`'s own standard.

#### F-REC-1 / F-REC-2

- **F-REC-1** — the record's row 8 and ADR 0193 D8 now carry the predicate the claim was measured
  under: zero policies carry the **pre-cutover** shape
  `…like '%is_staff_admin_of(app.commission_of_version%'`; the **bare** shape
  `app.commission_of_version(form_version_id)` is still carried by 4 live policies.
- **F-REC-2 — LESSON CANDIDATE for the lead to file** (recorded here, not in `LESSONS.md`):
  **a catalog read taken while a mutation sweep is running returns a MUTANT.** QA measured
  `app._audit_access_authorized` as `begin return true; end` at 07:5x and was one step from filing
  `410` § 8.8's reverse arm as vacuous; it was a live door-sweep mutation mid-flight, restored minutes
  later. This is the reviewer-side twin of ADR 0189's "verified restore" protocol, and the cheap rule
  is: **on a machine running a mutation harness, no catalog figure is a fact until it is stable across
  two reads taken after the sweep is done.** ⚠ Same family as this session's own discipline (all DB
  work waited on the lead's marker file), which is why it belongs in the register rather than in a
  review nobody re-reads.

#### Filed, not fixed

`FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` 🟠 (owner **lead**), measured by the lead the same day:
`CASES=""` — *set but empty*, which is exactly what `$(bash scripts/door-sweep-cases.sh main)` yields
when the deriver exits 1 FINDING — makes `p0-authz-door-audit.sh` run a **FULL sweep** instead of zero
cases. Confirmed in both harnesses' own lines: `want()` returns 0 for every gate when `CASES` is empty
(`p0-authz-door-audit.sh:1097`, `p0-authz-writepath-audit.sh:315`), and `if [ -n "$CASES" ]`
(`:128` / `:201`) is false, so the run is **not** a `SUBSET_RUN` and writes the committed baseline
through the merge — with no `PARTIAL RUN` line to show it. ⛔ Deliberately **not** fixed in this unit:
`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` **Part 2** is Batch 3's and edits the same two files.

#### Gate re-run at the end of iteration 1

`npm run lint` **0/0 across 13 gates**, exit 0 · `npm run typecheck` exit 0 · `npx supabase db reset
--local` exit 0 at head `20261003007350` · `npm run test:db` **Files=262, Tests=8882, Result: PASS**,
**0** `not ok`, exit 0 — the same shape as the build session's tip run, as expected: nothing in this
iteration adds or removes an assertion (`410` § 8.8's change is caption text only). The full-tip gate
(the four authz arms, the diff-scoped sweep both arms, the set-valued home) remains the **lead's**.

### 2026-09-07 — tip gate (lead, second machine) — run by someone other than the builder

Tip `e5796940` (16 commits over `main` @ `23ec1fa5`). Catalog head `20261003007350` on every run below;
the fix loop changed no migration, so the arms run on the build tip (`7b9b1eb7`) read the same catalog
as the fix-loop tip. Exit codes read bare from an `rc` file, never through a pipe.

| step | bare rc | observed |
|---|---|---|
| `npm run lint` (build tip, fix tip) | 0 · 0 | 13 gates, 0 errors / 0 warnings |
| `npm run typecheck` (both tips) | 0 · 0 | — |
| `npm run gen:types` (build tip) | 0 | empty diff |
| `npm run test:db` on a fresh reset (build tip, fix tip) | 0 · 0 | `Files=262, Tests=8882, Result: PASS` both times (8876 on `main`; `409` 73→75, `410` 40→44, no assertion deleted) |
| `ARM=census` | 0 | `live authz gates (catalog): 581` · `gates carrying a verdict: 604` · `extension-owned, excluded: 0` · `=== INVARIANT HOLDS ===`. Domain quoted: *prosecdef bool \| prosecdef set-returning+reachable \| public INVOKER plpgsql \| all RLS policies, LESS extension-owned; NOT in domain: prosecdef scalar non-bool command doors (427 reachable, DERIVED this run)* |
| `ARM=hat` | 0 | `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted`; self-test 7/7; anchors `app.has_role(4-arg) + app.has_role_any + authz.holds_role` |
| `ARM=floor` | 0 | every never-called door on the floor allowlist; every allowlist entry resolves to a live door |
| `FROMFINDINGS=1 ARM=wrapper` | 0 | `BLIND set size: 41`, all allowlisted |
| `SELFTEST=1 …p0-authz-door-audit.sh` | 0 | `classify 6/6 · resets_enabled 6/6 · TOTAL: 23/23 ok` |
| `SELFTEST=1 bash scripts/door-sweep-cases.sh` | **1 → 0** | build tip: `PASS 17 · FAIL 17` (QA F-MAJOR-1, Apple diff); fix tip: `SELF-TEST: PASS 34 · FAIL 0 · SKIPPED 0` |
| set-valued targeted home (solo, fresh reset) | 0 | `ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)` · 3/3 COVERED · `suite after restore: PASS (Files=262, Tests=8882)` · `RESULT: CLEAN` |
| diff-scoped deriver over `main` (both tips) | 1 · 1 | **`SCOPE: 1 file(s) — 1 committed (main..HEAD), 0 worktree, 0 untracked \| filter: none \| derivation: catalog`** · `RESULT: FINDING (1) — DOORS IDENTIFIED: 1. SWEEPABLE BY THIS ARM: 0.` (same under `ARM=read` and `ARM=write`). Exit 1 is a FINDING, ruled below |
| targeted command-door case (fix tip) | 0 | `public.set_item_validations`: `fingerprint before 3c244fa6… → mutated bdcccfe0… → restored 3c244fa6… (matches before)` · `CASE 1 VERDICT: COVERED` · `RESULT: 1 of 1 case(s) COVERED`. Domain: *DOMAIN: command doors outside BOTH p0-authz-door-audit.sh's PRED_DOMAIN (return type is not boolean) and c2-command-door-neutralizer.sh's worklist (the door is not Tier-1: its closure reaches no PHI-marked relation). * |
| `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` | — | exactly `20261003007350_batch4_rekey_set_item_validations.sql` |

**Ruling on the deriver's exit 1.** The one door in the diff is a `prosecdef` scalar non-bool command
door, outside `PRED_DOMAIN` on both arms — the deriver says so by property and lists it. ADR 0079's
obligation (b) is discharged by the **targeted mutation case** above (a different instrument from
`409` §2.6f/§2.10e, which is a grant differential); the C2 neutralizer was tried first and correctly
refused it (`swept ZERO enforcers`, rc 2 — not Tier 1, no PHI relation). **No gate in the read or
write arm's domain changed** — that is the `SCOPE:` line's claim and the FINDING names the only
exception. Tier 2's 190 doors stay deferred by ADR 0171 and are NOT cleared.

**Two lead errors, recorded.** (1) My gate chain substituted the deriver's stdout into `CASES=` without
reading its exit first; the deriver had exited 1 with an empty case list, and `CASES=""` made
`p0-authz-door-audit.sh` start a **FULL** run (it swept `app.can_create_professional`, not in the
diff) whose merge then aborted on Apple diff; killed after ~10 min; `git diff --stat` on both committed
findings files empty; DB restored by a fresh reset. Filed as `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP`
(owner lead). (2) The set-valued home's **first** run ABORTed (`suite after restore: FAIL, Tests=8869`)
while QA's catalog session and the deriver self-test's catalog scenarios shared the DB; the solo re-run
on a fresh reset was CLEAN at 8882. A mutation harness must own the stack — the ABORT was disturbance,
not an incomplete restore, and it is not allowlisted anywhere.

**Verdict at the tip:** gate complete on the fix-loop tip; QA re-review requested.
