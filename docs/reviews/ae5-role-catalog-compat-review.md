# QA review — unit `AE5-ROLE-CATALOG-COMPAT`

**Subject:** branch `ae5-role-catalog-compat` (10 commits, `main @ 975fb4dd` → `477303e3`),
ADR [0207](../decisions/0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md)
D5 steps 1–5 + ADR [0208](../decisions/0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
D4. Contract: the hub's **AC-1…AC-9**.
**Reviewer:** `qa`, 2026-09-12. Read-only on application code, migrations, specs and queries.

## **Verdict: APPROVED**

0 BLOCK · 0 MAJOR · 4 MINOR (**all four fixed and re-verified by QA — see § Round 2**) · 4 NOTE
(one fixed, three recorded by design). Reviewed at `477303e3`; re-verified at `a0f16fc3`.

⛔ **Every catalog fact below was re-measured by this review** against
`supabase_db_azkbbhskturikxpgmafq` (`pg_proc`, `pg_constraint`, `pg_policies`, `pg_attribute`,
`aclexplode`) — never read off the migration text, never quoted from the record (ADR 0078; LESSONS
*"text is not truth"*). Where a figure agrees with the record, that is a reproduction, not a copy.

---

## 1. Requirements audit — AC-1…AC-8, cell by cell

| AC | Discharged by | Re-measured here |
| --- | --- | --- |
| **AC-1** column + FK + 23503 | migration `20261003007430` step 1; `422 §1.1–1.4` | `ARS_ROLE_TYPE=text`; `active_role_selections_role_fkey :: FOREIGN KEY (role) REFERENCES authz.roles(code)` (NO ACTION both directions — `confupdtype='a'`/`confdeltype='a'`, asserted by `422 §1.2`). `§1.3` pins **23503** specifically and `§1.4` is its discrimination half (a catalog code still inserts). ✅ |
| **AC-2** ONE `assume_role(text)` | step 2; `422 §2.1–2.11`, `408 §3`/`§5`, `418 §3`, `315` | `ASSUME_ROLE_COUNT=1`; `assume_role(text) · prosecdef=true · proconfig=search_path="" · acl={postgres=X,service_role=X,authenticated=X} · lang=plpgsql · ret=void`. PUBLIC absent **and** `proacl IS NOT NULL` (`422 §2.4` asserts the pair — the LESSONS *"NULL proacl includes PUBLIC"* trap is closed). Both gate halves carry a mutation **and** a discrimination twin (below, §2). Unknown code → `42501` + selectability message, not `23503` (`422 §2.11`). ✅ |
| **AC-3** enum retired | step 3 (DO block asserts 0 non-internal `pg_depend` dependents before the drop); `422 §3.1` + instrument control `§3.2` | `to_regtype('public.platform_role')` → **NULL**. `422 §3`'s header states the bound honestly: the "zero dependents BEFORE the drop" claim is **not** assertable post-hoc (the probe goes vacuous), so it is enforced in the migration's own DO block. That is the correct home; I agree with the stated bound. ✅ |
| **AC-4** row + domain | step 4 (ordered: delete row → memberships proof → `ALTER DOMAIN`); `422 §4.1–4.8`, `411 §1.1/§4.1/§4.2`, `401 §3.1/§3.4/§3.5/§3.6` | `ROLES_COUNT=11 · administrativo=0`; `scope_kind_check = CHECK ((VALUE = ANY (ARRAY['organization'::text,'hospital'::text,'commission'::text,'none'::text])))`; `authz.role_permissions` = 42 rows, `RP_ROLES=staff_admin` only. The memberships proof **precedes** the `ALTER DOMAIN` in the migration and is keystoned red-first at `422 §4.3` + `§4.4`. ✅ |
| **AC-5** TS collapse | `f767308f`; `role-catalog.ts`, `role-selection/actions.ts`, regenerated `database.ts` | See §5 below. `npx tsc --noEmit` → **0**; `npx vitest run role-catalog.test.ts landing-route.test.ts` → **36 passed**. ✅ |
| **AC-6** generated pin, both halves | `scripts/gen-role-manifest.mjs` + `vectors/role_manifest.psql`; gate 19; `411 §0a/§0b/§2.1–2.3` | See §4 below — I drove three live drift mutations through `--check`. ✅ |
| **AC-7** step 6 NOT taken | `422 §5.1/§5.2` | `md5(pg_get_functiondef)` re-measured: `app.member_can(uuid,text)` = `25c6747df0c01a34a6783f8a25c8dbd4`, `app.member_can_for(uuid,text,uuid)` = `da9b5b9bdac1a45cb4deed23ef4a3d27` — **both identical** to the unit's opening values. `to_regclass('authz.capability_permissions')` → NULL. `bulk_create_cases`'s live body still carries `app.member_can(v_commission_id,'create_cases') and app.member_can(v_commission_id,'assign_case_phases')` (line-wrapped in `pg_get_functiondef` — a single-line `position()` probe returns false; measured by splitting the definition on newlines). **Nothing maps the three capabilities to a permission code**: the only relation naming a capability is `public.commission_administrativo_capabilities (commission_id,user_id,capability,granted_by,granted_at)` — no permission column; `authz.permissions` still 43 rows; `authz.role_permissions` still `staff_admin`-only. ✅ |
| **AC-8** name-keyed sites | `5f72c11b` + `ac55a1ce` | See §3 below — swept independently. ✅ |

**AC-9** is the lead's gate, not mine to re-run; I audited what it recorded and re-measured every
figure it quotes that a read can reach (`npm run lint` → **0**, all 19 gates, eslint 0/0; the
419/421 partition; the RPC digest row). The E2E half is pending the second full run.

---

## 2. Red-first integrity (`422`, and the `408` edit)

- **Plan vs emitted reconciles.** `422` declares `plan(28)` and the file contains exactly **28**
  top-level assertions (0.1 · 1.1–1.4 · 2.1–2.11 · 3.1–3.2 · 4.1–4.8 · 5.1–5.2). `408`:
  `plan(21)` / 21 assertions. `411`: `plan(9)` / 9. `401` keeps `plan(121)` — its six re-cast
  cells changed predicates, never the count.
- **The eleven first-run greens are each a control, a pin or an already-clean precondition** —
  verified against the file's own labels, not the record's summary: 0.1 (fixture control), 1.4
  (discrimination), 2.7 (the mutation landed), 3.2 (instrument control for 3.1), 4.3 (already
  clean, keystoned by 4.4), 4.4/4.5/4.7 (discrimination + restore), 4.8 (invariance), 5.1/5.2
  (md5 invariance pins, whose claim *is* "green in both states"). **None is a keystone green
  because its subject was missing.** The 17 reds the record lists (1.1–1.3 · 2.1–2.6 · 2.8–2.11 ·
  3.1 · 4.1 · 4.2 · 4.6) sum with them to 28.
  ⚠ **NOTE-1**: the record's prose names ten of those greens and says *"eleven"* — the unnamed
  eleventh is `0.1`. The arithmetic reconciles; the sentence is one name short.
- **The planted-row proof (`§4`) emits its TAP line OUTSIDE the savepoint, and its counter is
  `value + 1`.** `422:62-63` creates the temp sequence *before* the savepoint; the `do $$` block
  writes `setval(…, count + 1)` (`:325-326`, non-transactional, the one channel `rollback to
  savepoint` cannot reach); the assertion is `422:331-340`, after `rollback to savepoint`, and
  expects **2** — so `0` still reads as *"the block never ran"* rather than *"found nothing"*.
  This is the correct construction of the pgTAP-savepoint trap, and `§4.5` proves the plant and
  all three dropped constraints came back. ⭐ The record's account of the defect this cell
  exposed (the plant block had to drop the **domain** constraint too, or every later section's
  verdict would have been taken with it) is a genuine red-first dividend: it is only findable by
  running the cell in **both** states.
- **The real-assignment half has a mutation AND a discrimination twin, in two files.**
  `422 §2.6` (holder of A refused B) → `§2.7` (the mutation landed — expiry, not delete) →
  `§2.8` (the identical call that lived at `§2.5` now dies) → `§2.9` (an untouched sibling
  **still seats**) → `§2.10` (the restore is proven). `408 §5.1–5.4` repeats the same four-part
  shape on the pre-existing suite. Both assert the **pt-BR message**, not the bare SQLSTATE —
  necessary, because the selectability denial and the assignment denial share `42501`.
- **The unknown-code path is `42501`, not `23503`** — `422 §2.11` asserts the selectability
  message specifically, with the reasoning written into the cell: a `23503` there would mean the
  catalog check was skipped and an unauthorized seating attempt reached a write.
- **`408 §4`'s new `delete from app.active_role_selections where role='platform_admin'`** is
  correct and correctly declared as fixture cleanup: the NO-ACTION FK step 1 added makes the
  catalog-row delete fail `23503` on rows `§2.3`/`§3.3` seated seconds earlier. It removes only
  rows this suite wrote, inside a rolled-back transaction. Not a weakening.

## 3. Name-keyed and value-keyed sites (AC-8)

I swept independently rather than reading the record's list back.

- `grep -rn "platform_role" src supabase scripts e2e` — every remaining hit is a **comment** or a
  historical migration (stale by design). No live code, no live assertion, keys on the retired
  type. Two comment hits are findings, below.
- `grep -rn "capability_plane" src supabase scripts e2e` — only the re-cast cells (`401 §14.5`
  on the *independent* `authz.resolution_scope_kind` domain, `411 §4.1/§4.2`, `422 §4`), the new
  migration, and historical migrations.
- `grep -rn "administrativo" supabase/tests` in the **role-row** sense — zero. Every hit is the
  capability plane (`commission_administrativos`, `commission_administrativo_capabilities`, the
  `administrativo` feature flag), which is step 6 territory and correctly untouched.
- `grep -rn "assume_role" src e2e supabase/tests scripts` — no site still keys the enum
  signature; every pgTAP call is `'x'::text` (`315`, `408`, `418`, `422`), and the `::text` is
  load-bearing exactly as the files say: an untyped literal would have resolved to the old enum
  door and read identically before and after.
- **The `419` artifact diff is a PURE DELETION**: `git diff main...HEAD -- supabase/tests/vectors/definer_search_path_freeze.psql`
  removes one row (`('public.assume_role(p_role platform_role)')`) and adds none; only the anchor
  line moves (`rows=861 → 860`). Gate 18 confirms live: `baseline 861 -> 860 (removed 1, added 0);
  converged: public.assume_role(p_role platform_role)`. The new door never entered the non-empty
  population — which is the catalog confirming its `search_path` really is empty.
- **The 421 partition re-pin is correct against the live catalog.** Measured:
  `total=890 empty=30 nonempty=860 undeclared=0`, `empty_plpgsql=19 empty_sql=11`. `421 §0c`
  (`890 = 860 non-empty (419) + 30 empty (421) | 0 undeclared`), `§0d`, `§1a`, `§5` all re-pinned
  to those figures. One stale description line — **MINOR-2**, below.
- **Three value-keyed mirrors found at build** (`authz-enforcement-manifest.json` `roles`,
  `authz-matrix-axes.json` `catalogRoles`, `400 §2`'s RPC digest) are all correctly re-derived
  through their own generators; the matrix cell counts are **unchanged** (2002 / 1728), which is
  the measurement proving `catalogRoles` is a roster and not a grid dimension. `authz-matrix-coverage.json`
  `snapshotRoles: 12 → 11`.

## 4. The generated pin (AC-6) — both halves, independently exercised

- **`--check` never opens a database.** `execFileSync` is imported at `scripts/gen-role-manifest.mjs:72`
  but is reachable only from `dbContainer()`/`readCatalog()`, which only `--write` calls
  (`:504-521`). The `--check` branch (`:523-552`) reads three committed files and exits. Its
  success line **prints the declared bound** verbatim: *"this gate never opened a database …
  `system_managed`/`state` have no TypeScript twin to disagree with here."*
- **The self-test is live**: `node scripts/gen-role-manifest.mjs --self-test` → `OK (22 cases;
  every checker red on its own mutation)`, rc 0. Gate 19 chains it **before** `--check` with
  `&&` (`package.json`), so a dead self-test blocks.
- ⭐ **I did not take the self-test's word for it.** I copied the four files into an isolated
  tree and ran three real drifts through `--check`:
  - TS drift (`staff.scopeKind` commission→hospital) → **rc 1**, 1 finding naming the role and
    both sides;
  - artifact-row drift → **rc 1**, 3 findings (sha256 anchor, md5 anchor, the role disagreement);
  - `411` mirror md5-literal drift → **rc 1**, 1 finding naming both literals;
  - restored control → **rc 0**.
  The gate discriminates in all three directions and is not a detector that finds nothing.
- **`411` consumes the artifact via `\ir vectors/role_manifest.psql` (`411:89`)** and pins it
  against `authz.roles` on all five columns (`§2.1`), with `§2.2` (the SAME fingerprint
  expression over a **temp copy** with one `scope_kind` changed must report a difference) and
  `§2.3` (the mutation landed on exactly one row) as its discrimination. The pinned side is read
  from committed bytes, never re-derived in the same instant — LEARN-084 explicitly cited in the
  header.
- **Neither half is claimed as the verdict** — asserted in the artifact header, `411`'s header,
  gate 19's output and the seam slice.
- **`role-catalog.test.ts`'s text-only hop is re-pointed at the artifact** (`:74` `role_manifest.psql`,
  `:89` `readFileSync`), so the vitest side still has no DB/Docker dependency.
- ⚠ **NOTE-2**: `411`'s header states the bound as *"`label`, `branch`, `branchEmptyFallback` and
  the manifest's ORDER … `src/lib/role/role-catalog.test.ts` does [assert them]."* Measured, the
  vitest side gates **branch** (`landing-route.test.ts:146` — `partitionGrants` routes every role
  into exactly the branch `ROLE_BRANCH` declares — plus the per-role landing table at `:70-131`)
  and **branchEmptyFallback** (`role-catalog.test.ts:166`), but **no cell pins the pt-BR `label`
  text, and none pins the manifest ORDER as a sequence** (`ROLE_ORDER`'s test at `:126` proves
  coverage, not order). ⛔ This is **not a regression** — `ROLE_LABELS`/`ROLE_ORDER` were
  hand-written literals with the same coverage before the collapse — so it is a NOTE about an
  over-claimed bound, not a coverage loss.

## 5. TS collapse (AC-5)

- **One declaration site.** `ROLE_MANIFEST` (`role-catalog.ts:136-236`, between the
  `ROLE-MANIFEST-BEGIN`/`END` markers, `as const satisfies readonly RoleManifestShape[]`) is the
  only place a role is declared; `ROLE_LABELS`/`ROLE_SCOPE_KIND`/`ROLE_BRANCH` derive through one
  `fromManifest` helper (`:264-278`), `ROLE_ORDER` through `map` (`:301`), `PlatformRole` through
  `RoleManifestEntry["code"]` (`:252`).
- **No export was removed.** Diffing `export` lines `main` → `HEAD`: every previous name survives
  (`ROLE_MANIFEST`, `RoleManifestEntry`, `PlatformRole`, `RoleScopeKind`, `ROLE_LABELS`,
  `ROLE_SCOPE_KIND`, `ROLE_ORDER`, `ROLE_BRANCH`, `LandingBranchKey`, `LANDING_BRANCHES`,
  `LandingLists`, `resolveLanding`, `landingRouteForRole`, `scopeSummary`, `isPlatformRole`,
  `platformRoleLabel`); one is added (`ScopeSummaryStrategy`). `RoleManifestEntry` moved
  `interface` → `type` (inferred from the tuple) — structurally compatible for every consumer, and
  `tsc --noEmit` → **0** over the whole tree is the proof that every importer still compiles.
- **The double cast is justified and is the narrowest option.** `role-catalog.ts:295-303`:
  `CodesOf<T>` is a homomorphic mapped type over the tuple; `Array.map` returns `T[]`, which
  TypeScript will not narrow to an 11-element tuple, so `as unknown as CodesOf<typeof ROLE_MANIFEST>`
  is required to keep the published type a **tuple** rather than widening to `readonly PlatformRole[]`
  — a widening ~10 call sites would inherit. The comment states the alternative it rejected and
  why. No `any`. ✅ The record's dead end (the non-generic mapped form does not typecheck over a
  concrete tuple, because `K` ranges over `length`/`map`) is accurate.
- **`PlatformRole` no longer reads the generated enum**; `src/lib/role-selection/actions.ts` is the
  only file that did and now imports from `role-catalog`. `npm run gen:types` was re-run —
  `database.ts` loses `Enums.platform_role`, its `Constants` array, and re-types
  `assume_role: { Args: { p_role: string } }`. Rule 8 satisfied. The wire shape is unchanged
  (`.rpc('assume_role', { p_role })` sent a JSON string before and now).
- **`role-catalog.test.ts` / `landing-route.test.ts` still assert what they asserted** (36 tests
  green); `landing-route.test.ts:126` keeps `['administrativo', [], '/']` as the not-a-role
  fallthrough, which is still the right case now that `administrativo` is a provider.

## 6. Security

- **The DEFINER body is fully schema-qualified under `search_path = ''`.** Every non-`pg_catalog`
  reference is qualified: `auth.uid()`, `authz.roles`, `app.is_active`, `public.profiles`,
  `public.memberships`, `app.active_role_selections`, `app.audit_write`. The unqualified names
  (`current_setting`, `nullif`, `coalesce`, `now`, `gen_random_uuid`, `jsonb_build_object`, the
  `->>` operator) are `pg_catalog`, which Postgres always searches. Independently confirmed by the
  catalog: the door is in the **empty-path** population (`empty=30`), so `421`'s plpgsql arm
  resolves its body under the declared path — the body clause is gated by a machine, not by my
  reading.
- **Three gates, in the declared order, fail-closed.** `session_selectable` via
  `coalesce((select … from authz.roles where code = p_role), false)` → `app.is_active(v_uid)`
  (door-wide, ADR 0201 D4/R1) → the real assignment (`profiles.is_admin` for `platform_admin`, a
  **live** `memberships` row — `expires_at is null or expires_at > now()` — otherwise). Two
  `28000` pre-gates (no `auth.uid()`, no `session_id` claim) precede all three. An unknown code
  dies at gate 1 with `42501`, never reaching the insert.
- **ACL is re-issued, not inherited.** `revoke all … from public` + `grant execute … to
  authenticated, service_role`; measured `proacl` is non-NULL and contains no grantee 0. The
  migration's comment states the exact trap (a fresh function's NULL `proacl` includes PUBLIC) and
  `422 §2.4` asserts non-NULL **first**, which is what makes the "no PUBLIC entry" part readable.
- **The audit stamp is role-only** (`jsonb_build_object('role', p_role)`, three tenant columns
  deliberately still selected and deliberately not stamped — R10), and the row is still written,
  so `315`'s "exactly one `active_role.assumed` row per session" and `418 §3.7` keep their subject.
- **No RLS policy changed.** The migration contains no policy DDL. `pg_policies` on
  `app.active_role_selections` returns exactly one row, unchanged:
  `active_role_selections_select_own | SELECT | qual=(user_id = (SELECT auth.uid()))`. The
  pre-migration `%platform_role%` policy count was 0 and the retype touched no `qual`/`with_check`.
- **`prosecdef` was read beside `pg_policies`** for the one door this phase touched — the DEFINER's
  gate replaces RLS here, and it is the body above, gated by `422`/`408`/`418`/`315`, not by any
  policy. No new DEFINER besides `assume_role`; the DEFINER census is unchanged at 890.
- **No service-role key reachable client-side**; the diff touches no Supabase client construction.
- **The FK is NO ACTION and its operational consequence is recorded** — in the migration
  (`:57-60`), in `422 §1.2`'s message, in `408 §4`'s cleanup comment, and in the seam slice. ✅

### The door-sweep parity question — RULED ACCEPTABLE

The gate record's exit-1 ruling is correct on its own terms (the deriver resolved exactly one
door; it returns `void`, so it is outside the predicate arm's domain; **no sweep ran and none is
claimed** — the *"no gate changed"* obligation is provably false for this diff and was not
written). The lead asked me to rule on the residual: the targeted case `CASE 2` mutates the
**body** at the `app.is_active` line only, while the other two gates are covered by **DATA-level**
mutations.

**I rule that acceptable parity, and here is the measurement that makes it so rather than an
assumption.** A body mutation and a data mutation answer the same question when the gate's
denying state is constructible at data level — and for both remaining gates it is:

- `session_selectable`: `408 §3` flips one catalog row false and requires the mutated role to be
  refused with the selectability message, with two untouched siblings still seating (`§3.2/§3.3`)
  and the flip restored (`§3.4`). Deleting the `if not coalesce(…)` block outright makes `§3.1`
  live → red. `408 §4` adds the fail-closed branch (no catalog row at all).
- the real assignment: `408 §5` / `422 §2.6–2.10` expire the caller's membership and require the
  refusal, with a sibling still seating and the restore proven. Deleting `if not v_holds then
  raise` makes `§5.2`/`§2.8` live → red.

Each therefore *constructs the state in which the gate must fire and asserts it fires*, with a
discrimination half against a door that refuses everyone and a restore half against a one-way
latch. That is the same evidential shape a body neutralisation buys. The one thing a data
mutation cannot reach — a gate whose denying state is unconstructible — does not apply here.

⚠ **What is genuinely ungated, stated so it is not over-read (NOTE-3).** The migration's own
rationale says *"re-ordering them changes which pt-BR message a caller sees"*, and no cell
constructs the state that would discriminate the order (a **deactivated** caller asking for a
**non-selectable** code: `418 §3.1/§3.2` assert `('42501', null)` — the SQLSTATE only). A reorder
of `session_selectable` and `app.is_active` would therefore pass every arm. It changes which
correct refusal message a denied caller sees and grants nothing — cosmetic, not a security
property — so this is recorded as a stated-but-ungated rationale, not a gap to close.

## 7. Docs & hygiene

- **Hub AC list vs what landed**: every AC-1…AC-8 deliverable is present and discharged (§1). The
  hub's checkboxes are still `[ ]` and `reviews: []` — both are the lead's Record-step edits, not
  findings.
- **Record witnesses carry figures WITH queries** (the build entry's table has a query column;
  the ⚠ on `search_path=""` vs `search_path=` is exactly the kind of probe-shape note that keeps a
  figure reproducible). The md5s, the `scope_kind_check` text, the door's `proconfig`/ACL, the
  `861→860` / `29→30` movements and the RPC-registry figures all reproduce against the live
  catalog.
- **Authz seam**: the `## Current state` block is re-stamped (`**Updated:** 2026-09-12`) and the
  unit's slice is appended last; `lint:backend-state` (gate 16) passes and reports
  `authorization-and-audit.md` at 97/100 current-state lines. The **Open edges** bullet correctly
  flips 0207 from *"RULED, NOT BUILT"* to *"D5 steps 1–5 are BUILT"* while keeping step 6's ⛔
  prohibitions intact. One factual error — **MINOR-1**, below.
- **`docs/lint-gates.md`** carries the gate 19 row (`lint:role-manifest`, ADR 0207 D4 + 0197 D4)
  and the gate 18 row's `861 → 860` re-base. `package.json` chains gate 19 last in `lint`. ✅
- **No `PROGRESS.md` edit is owed** — the unit's state lives in its hub (ADR 0186); the branch
  touches no tracker row, correctly.
- **ADR hygiene**: this unit writes no ADR (it *builds* 0207/0208), so the `**Supersedes:**` /
  `**Amends:**` check has no subject. Nothing in the diff edits an ADR header.
- **Secrets**: no `.env`, no key, no `NEXT_PUBLIC_` change in the diff.
- **pt-BR / a11y**: the door's three denial messages are unchanged pt-BR strings, transcribed from
  the live catalog; `role-selection/actions.ts`'s `MESSAGES` map already maps `42501` to a pt-BR
  string, so no raw Postgres error reaches the UI on the new fail-closed path. No UI shape changed,
  so no new a11y surface.

---

## Findings

⚠ Written at round 1 (`477303e3`) and **kept verbatim** — every MINOR below, and NOTE-1, was fixed
in round 2 (§ Round 2 carries the per-site verification). They are not rewritten, because a finding
edited into its own resolution leaves no record of what was wrong.

### BLOCK — none
### MAJOR — none

### MINOR — all four FIXED and re-verified (§ Round 2)

**MINOR-1 — the seam slice states the opposite of the mechanism `408 §5` deliberately chose.**
`docs/backend-state/authorization-and-audit.md:1470-1471` reads:

> Both halves of the seating gate now carry a mutation: `408 § 3` (catalog row flipped) and
> `408 § 5` (the caller's membership **deleted**; a sibling still seats)

`408 §5` **expires** the membership (`update public.memberships set expires_at = now() - interval
'1 day'`, `408:241-242`), and the file's own header calls the choice load-bearing:
*"⚠ EXPIRY, NOT DELETE. `memberships` rows are referenced by other tables; a delete would cascade,
and the denial would then be attributable to collateral damage rather than to the assignment
gate."* (`408:244-247`; `422:189-191` says the same). The surface map now records, as the current
description of this gate, the very mechanism the test rejected — and a posted seam section is
frozen, so a future reader gets the wrong mechanism from the authoritative summary. Requirement:
CLAUDE.md §7 / ADR 0198 (the seam states the surface correctly); LESSONS *"a paraphrase can INVERT
the sentence it summarizes"*. **Fix:** correct the parenthetical to *"the caller's membership
EXPIRED"*.

**MINOR-2 — `421 §0d`'s TAP description contradicts the assertion it labels.**
`supabase/tests/421_definer_qualified_body.sql:231-232`: the expected value was re-pinned to
`'19 plpgsql | 11 sql | app authz public'` (correct — I measured `empty_plpgsql=19 empty_sql=11`),
but the description still reads *"§ 0d THE SPLIT AND THE SCHEMAS, NAMED: **18** members go to the
plpgsql arm, 11 to the sql arm…"*. The cell passes; its TAP line reports a figure that
contradicts the value it just asserted, which is the failure mode LESSONS calls *"a comment is an
assertion that goes stale silently"* — and `§1a`'s twin was updated to 19 in the same commit, so
this is a missed site, not a deliberate bound. **Fix:** `18 → 19` in the description string.

**MINOR-3 — an edited snapshot kept its unedited provenance labels.**
`supabase/tests/vectors/authz-enforcement-manifest.json` had `administrativo` removed from its
`roles` roster (`:153`), but the enclosing block still declares
`"measuredOn": "2026-09-02"` (`:93`) and `"migrationHead": "20261003007260"` (`:94`), under a
`_comment` that reads *"MEASURED 2026-09-02 on the local stack at migration head 20261003007260 …
RE-DERIVE, NEVER QUOTE."* The content is now the post-`20261003007430` state, so the provenance
describes a measurement the content is no longer. `authz-matrix-coverage.json:29` echoes the stale
head into a generated artifact. pgTAP `410` still proves the snapshot current against the catalog,
so there is **no functional hole** — the defect is a record that went stale silently, which no gate
can contradict (the head field is not asserted anywhere). **Fix:** move `measuredOn`/`migrationHead`
to `2026-09-12` / `20261003007430` and re-run `gen-authz-matrix-cells.mjs`.

**MINOR-4 — a live doc comment still names the dropped enum as a runtime type.**
`src/lib/queries/session.ts:200` describes `activeRole` as *"a `public.platform_role` value, or
`null`"*. ADR 0207 D3 dropped that type; the claim is now a catalog-validated **text** role code.
The field is typed `string | null`, so nothing breaks — but the comment is the only description of
what the JWT claim carries, and it names a type that no longer exists. **Fix:** *"a role code from
`authz.roles`"*. (Companion: `src/lib/auth/actions.ts:84` — *"4 of the 11 `platform_role` values"* —
is past-tense narration of a **deleted** implementation's rationale and reads correctly as history;
listed for completeness, no change requested.)

### NOTE

- **NOTE-1** — `docs/progress/ae5-role-catalog-compat.md` (build entry) says *"The eleven greens on
  the first run …"* and then names ten; the unnamed eleventh is `422 §0.1`, the fixture control.
  17 red + 11 green = 28 = `plan(28)` reconciles.
- **NOTE-2** — `411`'s header over-claims the bound it hands to vitest: `branch` and
  `branchEmptyFallback` are gated (`landing-route.test.ts:146`, `role-catalog.test.ts:166`), but the
  pt-BR `label` text and the manifest ORDER-as-sequence are gated nowhere. Not a regression (the
  same was true of the hand-written literals), so no change is requested — but the sentence should
  not be quoted later as evidence that those two are covered.
- **NOTE-3** — the migration's gate-ORDER rationale (`20261003007430:22-26`) is stated but
  ungated: no cell constructs a deactivated caller asking for a non-selectable code, so a reorder
  of gates 1 and 2 passes every arm. It changes only which correct refusal message is shown and
  grants nothing. Recorded, not requested.
- **NOTE-4 — for the lead, not the engineers.** At review time `e2e/act-role-assumption.spec.ts`
  is **modified but uncommitted** in the working tree (the tester's new AE5 step-2 REST cell:
  unknown code refused with the selectability message, unheld `staff_admin` refused with the
  assignment message, and `chefe.ccih` seating `staff_admin` as the non-vacuity control — a
  correctly-shaped three-way with a positive control, and `multi@test.local` is used only
  **within** Rede A, never across orgs). It must be committed before the Record step or the
  E2E evidence for AC-2 does not exist in the tree the gate ran against.

---

## Round 2 — the fixes, re-verified (2026-09-12, at `a0f16fc3`)

Three commits landed after round 1: `e3db1892` (lead), `ea00da10` + `a0f16fc3` (backend). ⛔ I
re-read each site rather than accepting the report (LESSONS *"verify, don't comply"*).

| Finding | Fix | Verified |
| --- | --- | --- |
| **MINOR-1** | `e3db1892` | `docs/backend-state/authorization-and-audit.md:1470-1472` now reads *"`408 § 5` (the caller's membership **EXPIRED** — ⚠ expiry, never delete: a delete cascades and the refusal would then be attributable to collateral damage, not the assignment gate; a sibling still seats)"*. The mechanism is not merely corrected, it now carries **the reason**, so the slice can no longer be paraphrased back into the wrong one. ✅ |
| **MINOR-2** | `ea00da10` | `supabase/tests/421_definer_qualified_body.sql:232` — *"**19** members go to the plpgsql arm, 11 to the sql arm"*, matching its own expected value and the live catalog (`empty_plpgsql=19`). ✅ |
| **MINOR-3** | `ea00da10` | `authz-enforcement-manifest.json:101-102` → `"measuredOn": "2026-09-12"`, `"migrationHead": "20261003007430"`; `authz-matrix-coverage.json:29` → `20261003007430`. The generated chain was **re-derived, not hand-patched**: `manifestSha256` moved `4d76dcb6…` → `8d971cfe…` and `authz_enforcement_manifest.psql`'s header sha matches it; `npm run lint:authz-vectors` → **rc 0** (`in sync (1728 cells … sha 20a4bd6f0b99)`, self-test arms firing). ✅ |
| **MINOR-4** | `ea00da10` | `src/lib/queries/session.ts:200-201` — *"a role code from `authz.roles` — catalog-validated text — or `null`"*. ✅ |
| **NOTE-1** | `a0f16fc3` | The build entry now enumerates **eleven** greens, `0.1` named with its role, and the record states the discrepancy rather than silently correcting it (`:94`, and a NOTE-1 line at `:265-267`). ✅ |

**⭐ The fix commits cannot move `npm run test:db`, and that is measured rather than assumed.**
`git diff 477303e3..HEAD -- supabase/` is **four files, 1 changed line each** in the two that pgTAP
reads: `421`'s TAP **description string** (not its expected value) and
`authz_enforcement_manifest.psql`'s **header comment sha**. No expected value, no fixture row, no
plan count moved. I further confirmed that **no pgTAP cell pins `sourceSha256`, `manifestSha256`
or `migrationHead`** (`grep` over `supabase/tests/*.sql` — the only `20261003007260` hits are
prose in `408`/`409`), so the JSON provenance edit has no assertion downstream of it. The
`Files=271, Tests=9099, Result: PASS` in the gate record therefore still holds over these commits.
⚠ Backend's fresh `db reset` + `test:db` over them is **lead-reported as in flight and not
witnessed by QA**; on the reasoning above its exit code is expected 0, and a non-zero would be a
surprise this review does not account for — the lead should re-open if it reds.

**E2E (AC-9), lead-reported, not witnessed by QA** (the stack is the tester's; I ran no Playwright):
second full `npm run e2e:prod` → `1264 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run ·
21 batches`, `GATE GREEN`, `GATE_EXIT=0`. First run `1253 passed · 1 failed · 0 infra · 4 flaky ·
8 did-not-run`, the single failure `ethics-e2-procedure.spec.ts:847 FLOW-4` — **unrelated to this
unit by subject** (ethics procedure flow; it touches no role catalog, no `assume_role`, no
`authz.roles`), and its scoped re-run was `21 passed · 0 failed`. The second run reproduces green
with **0 did-not-run**, which is the stronger reading: the first run's 8 did-not-run are gone, so
no cell was silently unexercised.

⛔ **One item remains OPEN at the Record step, and it is the lead's, not the engineers'**:
`e2e/act-role-assumption.spec.ts` is still `M` (uncommitted) in the working tree as I close this
review (NOTE-4). It must be committed before `phase(N): complete`, or AC-2's E2E evidence is
absent from the tree the gate ran against. This does not change the verdict — the DB-level proof
of both gate halves is complete without it — but an uncommitted spec is not coverage.

---

## Re-measurement appendix (what I ran)

```
pg_proc          assume_role count=1 · assume_role(text) · prosecdef=t · proconfig=search_path=""
                 · acl={postgres=X,service_role=X,authenticated=X} (no grantee 0) · plpgsql · void
to_regtype       public.platform_role -> NULL        to_regclass authz.capability_permissions -> NULL
authz.roles      11 rows · administrativo 0          authz.permissions 43 · role_permissions 42 (staff_admin only)
pg_constraint    scope_kind_check = CHECK ((VALUE = ANY (ARRAY['organization'::text,'hospital'::text,'commission'::text,'none'::text])))
                 active_role_selections_role_fkey :: FOREIGN KEY (role) REFERENCES authz.roles(code)
pg_attribute     app.active_role_selections.role :: text
md5(functiondef) app.member_can(uuid,text)            25c6747df0c01a34a6783f8a25c8dbd4  (unchanged)
                 app.member_can_for(uuid,text,uuid)   da9b5b9bdac1a45cb4deed23ef4a3d27  (unchanged)
bulk_create_cases  live body still carries `member_can(…,'create_cases') and member_can(…,'assign_case_phases')`
pg_policies      app.active_role_selections -> 1 policy, active_role_selections_select_own, unchanged
DEFINER census   total=890 empty=30 nonempty=860 undeclared=0 · empty_plpgsql=19 empty_sql=11
npm run lint                                  rc 0   (19 gates, eslint 0/0; gate 18 "removed 1, added 0"; gate 19 "in sync (11 roles)")
npx tsc --noEmit                              rc 0
npx vitest run role-catalog.test.ts landing-route.test.ts   36 passed
node scripts/gen-role-manifest.mjs --self-test rc 0   OK (22 cases)
node scripts/gen-role-manifest.mjs --check     rc 0   in sync, bound printed
gen-role-manifest --check, 3 LIVE drifts on an isolated copy:
   TS scopeKind drift            rc 1  (1 finding)
   artifact row drift            rc 1  (3 findings: sha256, md5, role)
   411 mirror md5-literal drift  rc 1  (1 finding)
   restored control              rc 0
assertion counts vs plan()   422: 28/28 · 408: 21/21 · 411: 9/9 · 401: plan(121) unchanged
```

⛔ Not run, by instruction (the stack is owned by `tester`): `supabase db reset`, `npm run test:db`,
the mutation harnesses, `npm run e2e:prod`.
