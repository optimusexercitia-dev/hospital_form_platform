# AE4-D-SHAPE-ASSERTION — progress record

> Hub: [ae4-d-shape-assertion.md](../features/ae4-d-shape-assertion.md) · branch
> `ae4-d-shape-assertion`, cut from `main @ c71e7c33` · owed by ADR 0208 D2 (assertion) + D3
> (triggers); D1 is the invariant asserted. ⛔ ADR 0207 D5 step 6 is NOT this unit; AE5 stays
> post-pilot (ADR 0155 G1).

## The five re-measurement triggers (ADR 0208 D3) — what each invalidates, and what watches it

Verbatim from the PO's ruling, each with the premise it breaks. ⚠ **What this unit buys is *"the
next Phase Gate noticed"*, never *"the next commit noticed"*** (ADR 0195): the assertion lives in
`npm run test:db` because `npm run lint` cannot host a live-catalog count (no Docker).

| # | trigger (PO, verbatim) | what it invalidates | watched by |
| --- | --- | --- | --- |
| 1 | *administrativo is added as a permission provider* | `F = M` (the role provider is no longer the only provider); the provider set the candidate CTE consumes | **clause 6** — the derived provider set reds the moment a new provider exists and is not consumed by both candidate CTEs (fires at ADR 0207 proposed-order item 6 **by construction**) |
| 2 | *another provider adapter is introduced* | same as 1, for any provider | **clause 6**, same cell |
| 3 | *`scope_reaches` gains one-to-many or descendant expansion* | *"one fact yields at most one candidate for a fixed resolution kind"* — clause 2's `D ≤ F` derivation | **`423 § 2`** — `2.5` is the red-first plant of exactly this expansion (a one-to-many commission→organization arm) and `2.2` reds under it, at seed scale; ⚠ blind to an expansion applied identically to BOTH artifacts (the CTE's `CASE` and `scope_reaches`) — that half stays re-measure. (Read *"prose only"* here until the build landed, 2026-09-13.) |
| 4 | *membership uniqueness constraints are relaxed* | the coefficient `C = 1` per commission (`memberships_one_commission_role_uq`); `M ≤ C + 6H + 2O + 1` | `prose only` — no cell pins the constraint's existence (a pin here would be a hand-list of a catalog fact; the coefficient is re-derivable) |
| 5 | *production data exceeds the tested `M=20, D=5` performance envelope* | the envelope the residual risk was accepted under (the AE4 perf fixture: 12,036 principals over 13 orgs) | `prose only` — a production census, not a test |

## Session log

### 2026-09-13 — unit opened; peers cleared; hub + record written; branch cut (lead)

**Tree at open.** `main @ c71e7c33`, clean; four merged `definer-*` branches still exist locally
(not deleted here, not this unit's); no worktree; no `in_progress` hub before this one. Two live
peer sessions on this checkout at open, both asked and both answered before any branch was cut:
`hospital-form-platform-c1` — read-only, on `main`, nothing uncommitted, no reset/pgTAP planned;
`hospital-form-platform-09` — idle on `main @ c71e7c33`, its unit `AE5-ROLE-CATALOG-COMPAT` merged
and its branch deleted, nothing planned, will message first if that changes; it flagged a possible
later test-only session (`FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT`) briefed to coordinate or use a
worktree. `pg_stat_activity` on `supabase_db_azkbbhskturikxpgmafq`: only the stack's own service
backends (realtime · PostgREST · storage), no client `psql`. ⇒ the shared-HEAD / shared-DB hazard
(`docs/worktrees.md`) does not apply at open; re-checked before the reset at gate step 1.

**Review queue (per-clone, gitignored):** one entry after the 2026-09-13 processing marker
(`89aa778b`, `rules`, 12:35Z — the user's ordering prompt for the three DEFINER items, a repeat
of the entry the marker already triaged as hook finding (ii)). Triaged at this unit's Record step.

**Scope fixed from ADR 0208 as read today** (the ADR, not a summary of it): D2's six clauses
verbatim in the hub's AC-1..AC-6; the instrument is `scripts/authz-ae4-p2-invocation-count.sql`
(eleven `::regprocedure` counters, `:176-186`; ⚠ precondition `ae4perf.fixture_meta`, so the
script section runs on the loaded perf fixture while the pgTAP cells run on the seed); clause 5
is true today by DUPLICATION — the ADR measured a raw `diff` of the two `pg_get_functiondef`
outputs exiting 1 on the signature, three `--` comment lines and the confirmer, and 0 after
stripping comments and blank lines — so the cell compares normalised live bodies, or the producer
is factored out first (the unit's call, per the ADR). ⛔ Decided at open: **no factoring** —
this unit changes no catalog; a producer function would be a migration, a new DEFINER under D4,
and a door the sweep must inherit, all of which are more surface than an assertion needs. If the
comparator proves unworkable that decision is reopened here, with the reason.

**Numbering.** Next free pgTAP number after `422` is **423** — `ls supabase/tests` shows none
above 422 on `main`, and the four local `definer-*` branches are merged.

**Delegation.** `backend` (Opus — authz semantics) measures first and plans before writing: the
two resolver bodies, the provider family, the seed's per-principal `F` / candidate counts, the
overlap principal for clause 3. Plan-approval is the full form (a novel assertion shape over
`SECURITY DEFINER` resolvers); the lead acks by message.

### 2026-09-13 — measurement on the live catalog + the six-clause plan, before any test code (backend)

⛔ Nothing was written this turn. Every figure below is `docker exec supabase_db_azkbbhskturikxpgmafq
psql -U postgres -d postgres` against the LIVE catalog (ADR 0078); no migration file was read for a
schema fact. **DB state at measurement:** product seed — 43 `memberships`, 36 `profiles`, 3 orgs,
4 hospitals, 6 commissions; `to_regclass('ae4perf.fixture_meta') is null` ⇒ **the AE4 perf fixture is
NOT loaded** (so the P2 script could not be run this turn, and was not).

**(a) The two resolver bodies.** `pg_get_functiondef` of both, diffed:

| diff | exit | differing lines |
| --- | --- | --- |
| raw | **1** | the signature line; **three `--` comment lines** present only in the runtime resolver (2 inside the CTE, 1 before the confirm `select`); the confirmer line |
| `sed -e 's/--.*$//' -e 's/[[:space:]]\+/ /g'` + drop blank lines | **1**, and **only two lines** | the signature line and the confirmer line |

⇒ ADR 0208 D2's ⚠ correction **reproduces exactly**: identical in every non-comment token but the
signature and the confirmer (`authz.has_permission` vs `authz.candidate_has_permission`). ⛔ A raw
equality would red on the comments and prove nothing, as the ADR says.

**The candidate CTE's boundaries, cut mechanically.** Both bodies open the CTE with the literal
`with candidate as materialized (` and close it with the `)` that precedes the confirm select. One
anchored regex cuts both:

```sql
substring(pg_get_functiondef(sig) from 'with candidate as materialized \((.*)\)[^)]*select c\.scope_id')
```

Greedy `.*` is safe because the only `select c.scope_id` in either body is the confirm select and the
text between the CTE's `)` and it contains no `)`. Measured: length **873** (runtime) / **714**
(candidate); both contain `assignment_facts`; **neither extraction contains either confirmer**
(`leaks_confirmer = f`, both) — so the cut really is the producer and the comparator is not
trivially comparing whole bodies. md5 of each extraction after `regexp_replace(…,'--[^\n]*','','g')`
then `'\s+'→' '`: **`e1d6843b447d882dd8a5733bf3bc7e3f` for BOTH**.

**⭐ The candidate CTE does NOT call `authz.scope_reaches`.** It carries its own inline `CASE`; the
four arms (`same kind` · commission→org · hospital→org · commission→hospital) are the *projection*
form of the *predicate* `authz.scope_reaches(text,uuid,text,uuid)`, which lives on the CONFIRM side
(`prosrc like '%scope_reaches%'` ⇒ exactly `authz.entailed_grants` and `authz.explain_permission`).
So the catalog holds the ascent **three** times, not two, and the two copies on opposite sides of the
resolver are what makes an independent derivation possible without a hand copy.

**Catalog attributes.** All **ten** functions in schema `authz` are `prosecdef = t`,
`provolatile = s`, `proconfig = {search_path=""}`, `proacl = postgres=X/postgres` (no client role
reaches `authz`). `authz.assignment_facts(uuid)` returns `TABLE(role_code text, scope_kind text,
scope_id uuid)` and is gated on `app.is_active(p_principal)` in BOTH its legs (the `memberships`
leg and the `profiles.is_admin ⇒ ('platform_admin','none',null)` leg); `app.is_active` reads
`profiles.is_active and (suspended_until is null or now() >= suspended_until)`, `coalesce(...,false)`.
`authz.has_permission` and `authz.candidate_has_permission` differ in ONE token: `role_state =
'authoritative'` vs `role_state in ('test_validation','authoritative')`.

**(b) The provider family, defined as a PROPERTY.** Proposed definition, both halves read live from
the catalog in the same statement:

> a `pg_proc` row in schema **`authz`** with `prokind = 'f'` whose
> `pg_get_function_identity_arguments(oid)` equals `authz.assignment_facts(uuid)`'s (**`uuid`**) and
> whose `pg_get_function_result(oid)` equals its (**`TABLE(role_code text, scope_kind text, scope_id
> uuid)`**).

Measured: the family is **exactly `{authz.assignment_facts}`**, size 1, and it is referenced by
**2 of 2** extracted candidate CTEs. Planted in a savepoint,
`authz.administrativo_facts(p_principal uuid) returns table(role_code text, scope_kind text, scope_id
uuid)` moves the family to **2** and `unconsumed_providers` from 0 to **1**; `rollback to savepoint`
returns it to 1. ⇒ **a planted `authz.<x>_facts` in the provider row type IS caught.**
⛔ **Missed, stated honestly:** a provider in another schema (`app.*`), one taking a different
argument list, one whose return shape differs by a column name/type or is spelled `setof <composite>`
rather than `TABLE(...)` (different `pg_get_function_result` text), one the CTE consumes through a
wrapper, and one plumbed in as a VIEW rather than a function. The property is deliberately narrow so
a false RED cannot come from an unrelated function; the price is that widening the family is a manual
re-derivation, which is what D3 trigger 2 asks for anyway.

**(c) Per seeded principal × kind on the seed** (33 principals with ≥1 fact × 3 kinds = **99 cells**).
`F = count(*) from authz.assignment_facts(p)`. Two INDEPENDENT derivations of the candidate counts,
neither a copy of the production `CASE`:

- **I2, fact × reach:** `… from authz.assignment_facts(p) af join <all scopes of kind k> s on
  authz.scope_reaches(af.scope_kind, af.scope_id, k, s.id)` — `raw = count(*)`, `D = count(distinct
  s.id)`. Uses the LIVE `scope_reaches`, whose own correctness is gated by pgTAP `412`.
- **I1, producer-extracted:** the CTE cut above, with `\mp_principal\M → $1` and
  `\mp_resolution_kind\M → $2`, executed via `execute format('with candidate as materialized (%s)
  select count(*) from candidate where scope_id is not null', …) using p, k`; the **pre-dedup**
  variant is the same text with `'select\s+distinct' → 'select'` (the helper RAISES if that
  replacement is a no-op, so a re-spelled dedup reds loudly instead of reading as "no overlap").

| kind | cells | max F | max raw | max D | overlap cells (raw > D) | cells with raw > F | I1 vs I2 disagreements |
| --- | --- | --- | --- | --- | --- | --- | --- |
| commission | 33 | 3 | 2 | **2** | 0 | 0 | **0** |
| hospital | 33 | 3 | 3 | **2** | 3 | 0 | **0** |
| organization | 33 | 3 | 3 | **1** | 9 | 0 | **0** |

⭐ The maxima `D_organization = 1`, `D_hospital = 2`, `D_commission = 2` **independently reproduce
ADR 0208 D1's measured figures** by a derivation the ADR did not use. `raw ≤ F` holds in all 99
cells. I1 and I2 agree in all 99 cells.

- **Overlap principal (raw > D), derived not hand-listed:** `multi@test.local` at
  `kind = organization` — `F = 2`, `raw = 2`, `D = 1` (**the expected one**); also at
  `kind = hospital` (2/2/1). Twelve overlap cells exist in all: 9 organization, 3 hospital, 0
  commission (`pqsdual.a` is the widest: organization `F=3, raw=3, D=1`; hospital `3/3/2`).
- **No-overlap principal:** `chefe.ccih@test.local`, `raw = D = 1` at all three kinds; so is
  `multi@test.local` at `kind = commission` (`raw = D = 2`), which makes the same principal carry
  both polarities.
- **A natural zero:** `platform@test.local` has `F = 1` and `raw = D = 0` at all three kinds — the
  `('platform_admin','none',null)` fact proposes nothing, in BOTH derivations.
- **Resolver output counts** (`count(*) from authz.authorized_scope_ids(p,k,code)`) are ≤ D
  everywhere; e.g. `chefe.ccih` organization/`org.professionals.read` = 1 of D = 1,
  `multi@test.local` organization = 0 of D = 1. ⚠ **`authz.permissions` has only TWO
  `resolution_scope_kind` values — `commission` (38 codes) and `organization` (5). There is NO
  hospital-scoped permission**, so `authorized_scope_ids(p,'hospital',…)` is ALWAYS empty while its
  candidate set is not; the hospital arm of the fan-out is real and invisible in the output. ⇒ an
  assertion on the OUTPUT would be blind at `kind = hospital`; the cells are written on D/raw.

**(d) ⛔ THE P2 COUNTER METHOD DOES NOT WORK INSIDE A TRANSACTION — MEASURED, not assumed.**
Under `set track_functions = 'all'`, one direct `authz.assignment_facts(p)` call over M = 2 rows:

| arm | before | after | Δ |
| --- | --- | --- | --- |
| inside `begin … rollback`, `pg_stat_clear_snapshot()` only | 0 | 0 | **0** |
| inside `begin … rollback`, **plus `pg_stat_force_next_flush()` before each read** | 0 | 0 | **0** |
| **top level**, force flush + clear snapshot (the P2 §0 recipe) | 2 | 3 | **1** ✅ |

The top-level baseline reading **2** is itself the proof that the two in-transaction calls were
counted and only became VISIBLE after their transactions ended: pending function stats accumulate
but are not published to the snapshot until transaction end, and `pg_stat_force_next_flush()` does
not change that. ⚠ Cold reads are NULL, so `coalesce(…,0)` stays load-bearing.
⇒ **`U` is NOT measurable inside a pgTAP file** (every pgTAP file is one transaction). The §0
calibration `Δ = 1` holds at top level exactly as ADR 0183 records.

**Mutation levers, all three proven RED on the live catalog, each measured onto a temp sequence
outside its savepoint (the 421/422 channel) and each restored by `rollback to savepoint`:**

| lever | baseline | under mutation | restored |
| --- | --- | --- | --- |
| **A** producer `create or replace` with a fact-independent `union all select 'ffff…'::uuid` | `pd = 1` (`multi`, organization), `praw = 2`, `F = 2` | `pd = 2 > D_derived = 1`; **and with the principal ablated (`is_active = false` ⇒ `F = 0`) `pd = 1`, not 0** | `pd = 1` |
| **B** `scope_reaches` given one-to-many reach (commission→organization `then true`) | `raw = 2 ≤ F = 2` | `raw = 6 > F = 2` | — |
| **C** one-token change in `candidate_authorized_scope_ids`' CTE (third `WHEN` re-keyed) | CTE md5s equal | **not equal** | equal again |

The ablation lever itself is one row: `update public.profiles set is_active = false where id = p`
⇒ `F = 0` and `authorized_scope_ids` empty; `rollback to savepoint` restores `F = 2`.

**What already exists, so no cell restates it** (checked before designing): `413` holds the subset
invariant, the candidate twin and an over-broad-body vacuity control; `412` holds `scope_reaches`'
ascent against `commissions_hospital_org_fkey`; `407` holds scope-kind validation with a
deliberately FROZEN pre-change body as its defect anchor. **None of them asserts `D ≤ F`,
one-fact-one-candidate, dedup-before-confirmation, the two CTEs' equality, or the provider family.**

#### The plan for the six clauses (one page)

Two files. `supabase/tests/423_ae4_d_shape_assertion.sql` (**423 confirmed free** — `ls
supabase/tests` shows nothing above `422`) carries clauses 1·2·3·5·6 and the U-free half of 4 over
the seed; `scripts/authz-ae4-p2-invocation-count.sql` gains **§5**, the `U = D ≤ F` measurement, on
the loaded perf fixture at top level. Three instruments, defined once in the file: **I1** the
producer-extracted CTE (executed, never copied), **I2** the fact × `scope_reaches` derivation,
**I3** the P2 counter (script only). Every extraction/replacement helper RAISES when its anchor is
absent, so a moved boundary reds instead of reading as a clean zero.

| § | clause | predicate (relational) | red-first plant / mutation | discrimination half | channel |
| --- | --- | --- | --- | --- | --- |
| 1 | provenance | `I1.pd(p,k) ≤ I2.D(p,k)` over the swept cells, **and** with the principal ablated (`F = 0`) `I1.pd = 0` | **A** — measured `pd 1→2` and `pd_ablated = 1` | a cell with `I2.D > 0` must exist (else the `≤` is an all-zero pass); plus the md5 restore control | temp sequence, asserted outside the savepoint |
| 2 | one fact ⇒ ≤ 1 candidate per kind | `I1.praw ≤ F` **and** `I2.raw ≤ F` **and** `I1.praw = I2.raw` | **B** — measured `raw 6 > F 2` | ≥ 1 cell with `praw = F > 0`, else VACUOUS-red | sequence |
| 3 | dedup before confirmation | on the **derived** overlap row (max `I2.raw − I2.D`): `I1.pd = I2.D < I1.praw`; on a non-overlap row `I1.pd = I2.D = I1.praw` | producer `create or replace` with the `distinct` REMOVED ⇒ `pd = praw = 2 ≠ D = 1` | the sweep must hold ≥ 1 overlap and ≥ 1 non-overlap row, else VACUOUS-red (seed: 12 / 87) | sequence |
| 4 | `U = D ≤ F` | **pgTAP (U-free):** `I1.pd = I2.D ≤ F` per cell, with the counter's in-transaction impossibility stated as a non-proof. **Script §5:** `ΔU = I2.D` and `ΔU ≤ F` around ONE direct `authorized_scope_ids` call, after §0's `Δ = 1`, `coalesce(…,0)`, snapshot cleared, and `d_asi = 1` so `ΔU` is attributable | script: the dedup-removed producer in a rolled-back transaction must push `ΔU > I2.D`; inherits P2's VOID-outranks-FAIL precedence | script inherits §1 arm B (`ΔU = 0` when a fact is absorbed) | script: top level, counters survive rollback |
| 5 | one producer, two confirmers | `cte_md5(asi) = cte_md5(casi)` on the NORMALISED extractions, **plus** each body's remainder names a different confirmer (so "equal" cannot be satisfied by two identical functions), **plus** neither extraction contains a confirmer | **C** — measured, equality → false | the extraction controls above; ⛔ raw-text equality explicitly not used (measured: exit 1 on 3 comment lines) | sequence |
| 6 | a new provider fails until included | family non-empty **and** contains `authz.assignment_facts` **and** every member referenced by BOTH extracted CTEs | the planted `authz.administrativo_facts(uuid)` — measured, family 1→2, unconsumed 0→1 | the non-empty + contains-`assignment_facts` pair IS the vacuity control (an empty family makes "every member is consumed" vacuously true) | sequence |

**Sweep bound, for both scale regimes.** The swept population is deterministic — principals with
≥ 1 fact, `order by id limit 40`, × the three kinds — so the file stays 120 cells with the 12 036-principal
perf fixture loaded (413's requirement) instead of 36 108. The non-vacuity cells above RED if that
slice happens to contain no overlap row, no `praw = F > 0` row or no `D > 0` row, so a bound that
starts hiding the property is a failure, not a quiet pass.

**⛔ What each file does NOT prove.**
`423`: it asserts the SHAPE of the candidate producer at the seed's tenancy. It does not measure
`U` (impossible in a transaction — see (d)), nor execution ORDER (that dedup runs *before* the
confirmer is the script's job), nor any cost. Clause 1 is scoped to the candidate CTE: a
fact-independent term in the *confirm* select would not be seen, and OUTPUT-level containment is
deliberately NOT used because the CONFIRMER enforces it regardless of the producer, which would be a
cell masked by a legitimately-closed arm. Clause 2's blind spot is an identical one-to-many
expansion made in BOTH the `CASE` and `scope_reaches` (each alone reds, via `praw = raw` or
`raw ≤ F`). Clause 5 compares normalised TEXT: an equivalent re-spelling reds (a true signal under
D2's "one producer" reading) and a divergence hidden inside a called function's body is invisible.
Clause 6's family is narrow by design — the misses are enumerated in (b). I1 runs production text,
so I1 alone proves nothing; it is only evidence against I2, whose own correctness rests on `412` and
on `commissions_hospital_org_fkey`.
`scripts/…-p2-…sql` §5: one statement shape, one principal, at the loaded fixture's `D`; an
invocation count, never a cost; it says nothing about the seed population.

**Open, for the lead** (carried to the report): AC-4 as worded puts the counter-based `U` in the
pgTAP file, which measurement (d) shows is impossible — the split above is the proposal, not a
scope cut; the script section needs the perf fixture, which `ANALYZE`s the database, so the gate
order must be **load fixture → run P2 (exit read bare) → `supabase db reset --local` → `npm run
test:db`**; and executing the *mechanically extracted live* CTE is read here as the opposite of ADR
0183 `:114-115`'s forbidden hand-copy (it is re-read from the catalog every run and its extractor
raises when the anchors move), but it is the novel move in this plan and is put to the lead
explicitly. ⛔ The open decision **not to factor the producer stands**: the comparator is workable
(measured — one md5 equality on the normalised extractions, red under a one-token change), so no
migration, no new DEFINER and no new door are needed.

### 2026-09-13 — the six clauses BUILT: pgTAP `423` + P2 `§5`, with a red witness for every cell (backend)

**Plan ACKED by the lead with four rulings.** Built to them; the AC-4 ruling ordered one more
measurement first, and it is below with the branch it selected.

#### AC-4: the ordered `dblink` option was MEASURED and is CLOSED — branch 2 taken

`dblink` **1.2 is available and not installed**, and there is **no `dblink` precedent anywhere in
`supabase/` or `scripts/`** (grep, 0 hits). The mechanism never got as far as a Δ, because the
connection itself is refused — `postgres` on this stack is **`rolsuper = f`** (`rolbypassrls = t`),
so `dblink_connect` demands credentials the server actually consumed:

| arm | result |
| --- | --- |
| `dblink_connect('s1','dbname=postgres user=postgres host=/var/run/postgresql')` | `ERROR: password or GSSAPI delegated credentials required` — *"Non-superusers must provide a password…"* |
| same over TCP **with** `password=postgres` | `ERROR: … Non-superusers may only connect using credentials they PROVIDE … Ensure provided credentials match target server's authentication method` — `pg_hba` is trust, so the password is never consumed and `PQconnectionUsedPassword()` is false. ⇒ **supplying the local password does not help**; only an `hba` change would, and that is stack configuration the runner cannot guarantee |
| `dblink_connect_u` | `ERROR: permission denied for function dblink_connect_u`; its ACL is **`supabase_admin=X/supabase_admin`** (measured) — granting it is a migration, which this unit forbids |

⇒ **Branch 2, the proposal.** `423 § 4` asserts `pd = D_derived ≤ F` and states the non-proof in its
header with these figures; **`U`'s only home is `scripts/authz-ae4-p2-invocation-count.sql § 5`**.
No side-session Δ exists to report; the in-transaction Δ figures from the previous entry stand
(0 · 0 · **1** at top level).

#### The files

`supabase/tests/423_ae4_d_shape_assertion.sql` — **`plan(33)`**, `RUN SHAPE: Files=2, Tests=34`.
Three instruments as planned (I1 the mechanically-extracted-and-executed live CTE, I2 the
`assignment_facts × scope_reaches` derivation, I3 the counter — **not used here**). ⭐ Every mutant
is built by **ANCHORED SURGERY on the live definition** (`pg_temp.surgery`, which RAISES when its
anchor is absent) — nothing in the file hand-writes a producer body, so no plant can rot away from
the thing it mutates. Nine temp sequences carry every probe out of its savepoint, each written as
`value + 1` so **0 reads as THE PLANT NEVER RAN**.

⚠ **One cell changed during the build, and the reason is a finding.** The planned `5.3` was
`isnt(raw_def(asi), raw_def(casi))` — and that cell **CANNOT FAIL**: the two definitions differ on
the signature line by construction, so it is green for a reason that has nothing to do with its
subject (LEARN-001). It was replaced with a cell that can: inside a savepoint the candidate
resolver's confirmer is swapped to `authz.has_permission`, and `5.3` requires the extracted CTE's
normalised md5 to be **UNCHANGED** (the cut really is the producer — a boundary that crept into the
confirm select would make `5.1` red for the wrong reason) **while `5.2`'s predicate goes FALSE**, so
the same block is `5.2`'s red witness.

`scripts/authz-ae4-p2-invocation-count.sql` — new **`§ 5`**, two arms, placed after `§ 4` and inside
the existing VOID-outranks-FAIL precedence and postflight. ⛔ `D` is **not** read off the counter
(that would make `U = D` a tautology): it is derived relationally from `assignment_facts ×
scope_reaches`, and the section carries its own discrimination arm.

#### Red-first witnesses — every one of the 33 cells has an observed red

Each arm applies ONE mutation and runs the suite; the suite's own `rollback` undoes it.
**Catalog mutations** (the subject changed):

| arm | mutation (anchored surgery on the live body) | cells that went RED |
| --- | --- | --- |
| W1 | a fact-independent candidate unioned into `authorized_scope_ids`' CTE | **1.1 · 1.3 · 1.4** · 2.1 · 2.3 · 3.1 · 3.2 · **4.1 · 4.2** · 5.1 (23 green / 10 red) |
| W2 | `scope_reaches` given a one-to-many commission→organization arm | **2.2 · 2.3 · 2.5** · 1.4 · 3.1 · 3.2 · **4.1** (26 / 7) |
| W3 | the deduplication removed from the producer | ⚠ **the file ABORTS** — `DEDUP TOKEN NOT FOUND in the extracted CTE…`. The instrument **REFUSES**; it cannot be green with the dedup re-spelled. `0.3` is the cell that catches that raise, and `3.4` demonstrates the in-file discrimination on the real catalog |
| W4 | provider rows filtered so hospital-rooted facts propose nothing | **4.4 · 4.1** · 2.3 · 3.1 · 3.4 · 5.1 (27 / 6). ⭐ `4.4`'s own plant then double-applies and RAISES; the savepoint recovers it, the probe stays 0, and `4.4` reds reading *"THE PLANT NEVER RAN"* — the VOID-not-pass channel working, observed |
| W5 | one token changed in the candidate CTE of `candidate_authorized_scope_ids` | **5.1** — and ONLY 5.1 (32 / 1) |
| W6 | a provider adapter planted in the family, consumed by nothing | **6.2 · 6.3 · 6.4** (30 / 3) |

**Harness mutations** — the only way to red a control, a non-vacuity guard or a restore cell, since
no change to the subject can impoverish a population or disable a rollback. Run on SCRATCH COPIES;
⛔ the committed file is untouched:

| arm | mutation | cells that went RED |
| --- | --- | --- |
| H1 | the sweep narrowed to a principal with no candidate at any kind | **1.2 · 2.4 · 3.3 · 4.3** (+ 1.4 · 2.5 · 3.1 · 3.2 · 3.4 · 4.4) |
| H2 | the extraction boundary made greedy past the CTE | ⚠ **the file ABORTS** (`syntax error at or near "select"`) — the malformed dynamic SQL refuses; this is `0.2`'s failure mode |
| H3 | `rollback to savepoint s423_plant1` disabled | **1.5 · 3.5 · 4.5** |
| H6 | `rollback to savepoint s423_plant2` disabled | **2.6** |
| H7 | `rollback to savepoint s423_plant5` disabled | **5.5** |
| H4 | the provider property pointed at a schema with no provider | **6.1 · 6.3 · 6.4** |
| H5 | the swept population emptied (`limit 0`) | **0.1** (+ every non-vacuity guard) |

After both batches the live catalog is byte-identical (`authorized_scope_ids` ·
`candidate_authorized_scope_ids` · `scope_reaches` md5s unchanged, `providers = 1`), and the one
inactive profile is the seed's own `desativado.conta@test.local`, not an ablation left behind.

#### P2 `§ 5` on the loaded fixture

Gate order as acked — **load fixture → run P2 → teardown → fresh reset → `test:db`** — and ⛔ the
`supabase db reset --local` was run **by `backend`, announced here**: peers were re-checked
immediately before it (`ListAgents`: `hospital-form-platform-c1` and `-09` present; `pg_stat_activity`
on the stack: **only the service backends** — PostgREST, realtime, storage, pg_net, pg_cron — no
client `psql`).

Fixture loaded (exit 0), P2 run with its **exit code read BARE: `0`**. The new section:

```
 5 clause 4       | U against the fact-derived distinct candidate count
                  | U=2  D=2  raw=20  F=20  authorized_scope_ids=1  granted=2
                  | CLEAR — U = D = 2 ≤ F = 20 (ADR 0208 D1), measured, not predicted.
 5 discrimination | U must rise above D when the producer stops deduplicating
                  | U(dedup removed)=20  vs  D=2  raw=20
                  | CLEAR — U rose to 20 once the producer stopped deduplicating, so U = 2 above is
                  |         the DISTINCT count and not the fact count.
```

⭐ `U = 2` reproduces ADR 0183's own recorded fixture baseline (`A = 3, U = 2`) from a derivation
0183 did not use, and `A = 3 = 1 + U` holds on this arm too. ⚠ `D = 2` here is the
**organization-kind** distinct candidate count for the fixture principal; it is **not** the
`M = 20, D = 5` envelope figure, which is a different quantity on a different population and stays
labelled that way. The discrimination arm is decisive — **20 vs 2** — so `U = D` on this fixture is
not `U = raw` wearing a different name. Postflight OK; teardown exit 0.

#### Gates

`supabase db reset --local` exit 0 → **`npm run test:db`: `Files=272, Tests=9132, Result: PASS`,
exit 0** (`423_ae4_d_shape_assertion.sql … ok`). `npm run lint` exit 0 (every gate, 0 errors /
0 warnings) · `npm run typecheck` exit 0 · `npm run test`: **154 files, 2092 tests, all passed**.
⚠ The remaining AC-9 arms — the four authz arms + `SELFTEST`, the diff-scoped door sweep (exit **3**
expected: no migration), the set-valued arm — are the lead's gate step; `npm run e2e:prod` is **not
required**, as no `src/` file and no migration changed.

#### ⛔ What is still NOT proved, after the build

- **`U` is not measured on the SEED.** It is measured once, on the fixture, for one principal at one
  kind. `423` says so in its header.
- **`W3`'s and `H2`'s reds are ABORTS, not `not ok` lines.** `0.2` and `0.3` are proven able to
  REFUSE, which is the behaviour they were written for, but neither has ever emitted a failing TAP
  line — the instrument stops the file instead. That is the stronger failure mode and the weaker
  witness, and it is recorded as such rather than counted as a `not ok`.
- The bounds from the plan stand unchanged: §1 is scoped to the candidate CTE; §2 is blind to an
  identical expansion made in BOTH artifacts; §5 compares normalised TEXT; §6's family is narrow by
  design and misses a provider in another schema, of another arity or row-type spelling, reached
  through a wrapper, or plumbed in as a view. I1 alone proves nothing — it runs production text and
  is only evidence against I2, whose own correctness rests on pgTAP `412` and
  `commissions_hospital_org_fkey`.
- ⭐ ADR 0208 **D3 trigger 3 is now better than `prose only`**: `423 § 2.5` is a GATE for the half of
  *"`scope_reaches` gains one-to-many or descendant expansion"* that a seeded principal's facts can
  see. Triggers 1 and 2 are gated by `§ 6`. Triggers 4 and 5 remain `prose only`, as the trigger
  table above records.

### 2026-09-13 — gate step 1, first pass by the lead: suite, lint, four arms, SELFTEST green; the set-valued arm DIRTY on 423's own abort (lead)

**Re-run by the lead, not read off the backend's report.** Peers re-checked (`pg_stat_activity`: only the
stack's service backends). Fresh `supabase db reset --local` (rc 0) → `npm run test:db`:
`Files=272, Tests=9132, Result: PASS` (rc 0; `423_ae4_d_shape_assertion.sql .. ok`). `npm run lint` rc 0
(0 errors / 0 warnings — the single `warning` hit in the log is the `--max-warnings=0` flag on the script
line); `npm run typecheck` rc 0; `npm run test` `154 files / 2092 tests` passed.

**Door sweep — RULED NOT-APPLICABLE.** `CASELIST="$(bash scripts/door-sweep-cases.sh c71e7c33)"; rc=$?` →
**rc 3**, `=== RESULT: NOT-APPLICABLE (3) — no migration file in the diff. ===`, quoting
`SCOPE: 0 file(s) — 0 committed (c71e7c33..HEAD), 0 worktree, 0 untracked | filter: none | derivation: NOT REACHED (this run ended before the catalog was probed)`.
`git diff --stat -- docs/reviews/authz-door-audit-findings.md` empty. No predicate/policy sweep ran and none is
owed: `git diff --stat c71e7c33..HEAD -- supabase/migrations` is empty.

**The four authz arms, rc read bare from `p0-authz-invariant.sh`, run after the suite (which rolls back):**

| arm | knob | rc | line quoted |
| --- | --- | --- | --- |
| census | `ARM=census` | 0 | `=== INVARIANT HOLDS ===` |
| hat | `ARM=hat` | 0 | `self-test: 7/7 OK` · `HAT-BLIND SWEEP HOLDS: 4 finding(s), all reasoned-allowlisted` |
| floor | `ARM=floor` | 0 | `=== INVARIANT HOLDS ===` |
| wrapper | `FROMFINDINGS=1 ARM=wrapper` | 0 | `=== ARM 5: invoker-wrapper BLIND ⊆ allowlist ===` · `BLIND set size: 41` · `=== INVARIANT HOLDS ===` |

**SELFTEST** (`SELFTEST=1 bash scripts/door-sweep-cases.sh`, rc 0, `GNU bash, version 5.2.37(1)-release
(x86_64-pc-msys)`): `SELF-TEST: PASS 46 · FAIL 0 · SKIPPED 0` —
`--- GROUP deriver: scenarios 20 (pass 20 · fail 0 · skipped 0)` ·
`--- GROUP merge helper: scenarios 18 (pass 18 · fail 0 · skipped 0)` ·
`--- GROUP audit startup capture: scenarios 8 (pass 8 · fail 0 · skipped 0)`.

**Set-valued arm — rc 1, `=== RESULT: DIRTY — at least one case is not COVERED. This BLOCKS the phase. ===`**,
`ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)`. Per case:
`authz.authorized_scope_ids(uuid,text,text)` → **NOTICED** (`suite FAIL but run-shape!=baseline (Files=272
Tests=9099); aborting file(s): <none>; reddened: 252, 311, 321, 40x…, 413`);
`authz.candidate_authorized_scope_ids(uuid,text,text)` → **NOTICED** (same shape message; `reddened:
413_ae4_authorized_scope_ids.sql` only); `app.current_professional_read_organizations()` → COVERED. The
previous gate (`AE5-ROLE-CATALOG-COMPAT`, record `:223`) had this arm `CLEAN`.

**Attributed to THIS unit, not to the catalog.** `9132 − 9099 = 33 = 423's plan()`. Under the arm's
open→universal-set mutation the resolver body no longer carries the `with candidate as materialized (`
anchor; `423`'s extractor RAISES by design, the file dies after `plan(33)` with zero TAP lines, and the run
shape moves — which the harness reads as *"something noticed, cannot say what"* (NOTICED), never COVERED.
The backend's own report already named this failure mode for `0.2`/`0.3`: *"red by REFUSING, never by a
`not ok` line"*. ⇒ This is the LEARN-083 class the playbook names for NOTICED, and its remedy is the
playbook's — **capture-then-assert in the aborting file**, ⛔ never a relabel of the arm's verdict, never an
allowlist. Sent to `backend` as a fix: no path in `423` may abort the file; an instrument refusal becomes a
red TAP line and every dependent cell reds rather than raises, so the run shape stays 9132 under any
mutation and `423` appears in the arm's `reddened:` list. Re-earned afterwards: the plants whose witness
was an abort (W3, H2), fresh reset + `test:db`, then this arm re-run by the lead.

### 2026-09-13 — the fix: `423` never aborts; every instrument refusal is a RED TAP LINE (backend)

**The defect, in one sentence.** `423`'s helpers RAISED on refusal, so a mutation that removed an
anchor killed the file after `plan(33)` with **zero TAP lines**; the set-valued arm scores by RUN
SHAPE, saw `Tests=9099` against the `9132` baseline (the difference is exactly this plan) and could
only rule both resolver cases **NOTICED** — which blocks the phase. ⛔ Fixed the playbook's way —
**capture-then-assert in the aborting file**; the arm was not touched, no verdict was relabelled and
nothing was allowlisted.

**What changed in `423`** (no cell added, no cell removed — still `plan(33)`):
- A new temp table **`s423_refusal(source, detail)`**. `pg_temp.cte`, `cte_norm`, `pcount` and
  `surgery` now RECORD their refusal there and return **NULL**; `pcount`'s dynamic `execute` is
  wrapped so a malformed cut is captured, not raised. A new `pg_temp.plant()` applies a mutant or
  reports that it could not, and §6's stub creation carries its own handler — so a plant that fails
  leaves its probe at 0, which the cells already read as **THE PLANT NEVER RAN**.
- Every predicate that can read a refusal is NULL-safe *toward RED*: `is null or …`,
  `is distinct from`, `coalesce(…, false)`.
- **`0.2` and `0.3` are now ordinary assertions** whose messages carry the recorded reason
  (`REFUSALS RECORDED: …`), replacing `lives_ok` and a bare `like` chain.
- ⚠ **A second latent vacuity was found while doing this and fixed.** `5.1` was
  `is(cte_norm(a), cte_norm(b))` — and **`is(NULL, NULL)` PASSES in pgTAP**, so the moment the
  extractor stopped raising, a mutation defeating BOTH extractions would have scored `5.1` GREEN on
  two refusals. It is now `ok(cte_norm(a) is not null and cte_norm(a) = cte_norm(b), …)`. ⭐ The
  fix for one gate created the hole; the cell was re-read because of it.
- The header states the **RUN-SHAPE INVARIANT** — *this file emits exactly 33 TAP lines under any
  mutation of its subject* — with the arm's mechanism, the `9132 → 9099` figures, and why a
  `coalesce` or an `is distinct from` below may not be "simplified" away.

**Before → after, verbatim.** The two cells whose only witness was an abort now emit reds:

| arm | before | after |
| --- | --- | --- |
| **W3** — deduplication removed before the suite runs | `ERROR: DEDUP TOKEN NOT FOUND in the extracted CTE of authz.authorized_scope_ids(uuid,text,text)…` · **0 TAP lines** | **`not ok 3 - 0.3 DEDUP TOKEN CONTROL: … pcount RECORDS AND RETURNS NULL instead, and this cell is where that refusal becomes a red TAP line. REFUSALS RECORDED: DEDUP TOKEN NOT FOUND in the extracted CTE of authz.authorized_scope_ids(uuid,text,text) — the pre-deduplication variant is not constructible…`** · 23 ok / **10 red** (0.3 · 1.1 · 2.1 · 2.3 · 2.4 · 3.1 · 3.2 · 3.4 · 4.1 · 5.1) |
| **H2** — the extraction boundary made greedy | `ERROR: syntax error at or near "select"` · **0 TAP lines** | **`not ok 2 - 0.2 EXTRACTION CONTROL: … ⛔ coalesce(…, false) is load-bearing too: a refused extraction returns NULL, and ok(NULL) must read as a FAIL with a reason, never as an aborted file. REFUSALS RECORDED: THE EXTRACTED CTE OF … DID NOT EXECUTE: syntax error at or near "select"…`** · 18 ok / **15 red** (0.2 · 0.3 · 1.1 · 1.4 · 2.1 · 2.3 · 2.4 · 3.1 · 3.2 · 3.4 · 4.1 · 4.2 · 4.3 · 5.1 · 5.3) |

⭐ **And the arm's OWN mutation shape, reproduced directly** (`W8`: `authz.authorized_scope_ids`
replaced by `select o.id from public.organizations o`, the open universal set): **33 TAP lines, 15
ok / 18 red** — `0.2 · 0.3 · 1.1 · 1.4 · 2.1 · 2.3 · 2.4 · 3.1 · 3.2 · 3.4 · 4.1 · 4.2 · 4.3 · 4.4 ·
5.1 · 5.2 · 6.2 · 6.3`. That is the case the arm ruled NOTICED; the run shape is now the baseline
and `423` names itself in the reds. ⛔ The arm itself was NOT run here (~13 min; the lead re-runs it).

**Nothing regressed — every earlier witness re-run against the rewritten file.** Catalog arms:
W1 **23/10, the same ten cells as before** (1.1 · 1.3 · 1.4 · 2.1 · 2.3 · 3.1 · 3.2 · 4.1 · 4.2 ·
5.1); W2 26/7; W4 27/6 — ⭐ and W4 **no longer prints an ERROR at all**: its double-applied surgery
is now captured by `pg_temp.plant`, and `4.4` still reds reading *"THE PLANT NEVER RAN"*; W5 32/1
(`5.1` alone); W6 30/3. Harness arms: H1 23/10, H3 28/5, H4 30/3, H5 22/11, H6 → `2.6`, H7 → `5.5`.
**Every one of the 33 cells still has an observed red, and no arm aborts.** Live catalog
byte-identical afterwards (`providers = 1`).

**Gates.** Peers re-checked (0 client backends on the stack) → `supabase db reset --local` rc 0 →
**`npm run test:db`: `Files=272, Tests=9132, Result: PASS`**, rc 0, `423_ae4_d_shape_assertion.sql …
ok`. ⚠ `scripts/authz-ae4-p2-invocation-count.sql` is **unchanged** by this fix and its `§ 5` run
stands from the previous entry.

**⛔ What is still not proved, corrected from the previous entry.** The line *"`0.2` and `0.3` red by
REFUSING, never by a `not ok` line"* is **retired — that was the defect, not a bound**. Both now emit
failing TAP lines carrying their reason. The remaining bounds are unchanged: `U` on the fixture only;
§1 scoped to the candidate CTE; §2 blind to an identical expansion in both artifacts; §5 compares
normalised text; §6's family narrow by design; I1 only evidence against I2.

### 2026-09-13 — gate step 1 closed by the lead on the second pass: the set-valued arm CLEAN with 423 in its reddened set (lead)

**Re-run after the fix commit `d921e8be`, by the lead.** Peers unchanged (idle). Fresh
`supabase db reset --local` (rc 0) → `npm run test:db`: `Files=272, Tests=9132, Result: PASS` (rc 0).
`npm run lint` rc 0, every gate OK (⚠ one earlier invocation returned rc 1 with NO log file written — the
output redirect failed while the background reset ran; the immediate re-run is the verdict). `typecheck` and
`test` were not re-run: the fix touched one pgTAP file and the record, neither of which those gates read.

**Set-valued arm — rc 0, `=== RESULT: CLEAN — 3 resolver(s) measured, all COVERED. ===`**,
`ARM-DOMAIN setvalued=3/3 (in scope) out-of-scope=2 (named, with dispositions)`:
`authz.authorized_scope_ids(uuid,text,text)` → COVERED (`252, 311, 321, 409, 413, 423_ae4_d_shape_assertion.sql`);
`authz.candidate_authorized_scope_ids(uuid,text,text)` → COVERED (`413, 423_ae4_d_shape_assertion.sql`);
`app.current_professional_read_organizations()` → COVERED (unchanged). ⭐ Both formerly-NOTICED cases now
name `423` in their reddened set: the run shape held at 9132 under the mutation, so the harness could say
WHICH file noticed. `git diff --stat -- docs/reviews` empty (the arm writes its verdicts to stdout for hand
filing; nothing was filed, since the committed baseline carries no set-valued rows and the previous unit
filed none either).

**The four authz arms and SELFTEST are NOT re-run** and their first-pass verdicts stand: they measure the
catalog, and the fix changed no catalog object (`git diff c71e7c33..HEAD -- supabase/migrations` is empty;
`423` rolls back).

**Step 2 (tester) — RULED N/A by the lead, put to the PO at step 4.** No `src/`, no migration, no policy
changed; `npm run e2e:prod` is owed only when either changes (the unit brief and AC-9 say so). The precedent
is `DEFINER-QUALIFIED-BODY-GATE`, where the PO ruled step 2 N/A for the same shape.

**Lesson candidate, filed at the Record step:** a test file that RAISES on a defeated anchor is correct for
its own reader and WRONG for every mutation harness that reads run shape — the abort converts a would-be
COVERED into NOTICED across the whole arm. This is LEARN-083's class from the other side (the file
introduced, not the file inherited).

### 2026-09-13 — QA r1 `CHANGES REQUESTED`: two doc-staleness MAJORs corrected, two MINORs answered (lead)

Review: `docs/reviews/ae4-d-shape-assertion-review.md`. The test engineering (all 33 cells, the P2 `§ 5`, the
abort fix, the `5.1` vacuity fix, the ADR 0183 argument, trigger 3's `§ 2.5` citation) was verified clean by
reading the file.

- **MAJOR 1 — the hub's `## Current state` predated the fix and the closed gate** (last touched `a6d52b82`,
  still claiming the set-valued arm "must return CLEAN"). Replaced — the block is the last edit of the round
  (playbook §4 step 11), and it had not been re-cut after `13e871f9`.
- **MAJOR 2 — the seam slice (`:1537-1538`) still said `0.2`/`0.3` "red by REFUSING (the instrument aborts)"**,
  the sentence the abort fix retired. Per the seam's own rule a posted sentence is corrected by an APPENDED
  dated `⚠ Superseded` marker, never in place — appended directly under the bullet, naming `d921e8be` and the
  two record entries.
- **MINOR — clause 2 is asserted as the aggregate bound `raw ≤ F` per principal × kind, not per fact.** Accepted
  as the assertion's grain and recorded here: attributing each candidate to the fact that produced it would
  require the producer to expose the fact → candidate edge, which the live CTE does not, and reconstructing it
  would be the hand copy ADR 0183 forbids; the aggregate bound is exactly `D ≤ F`'s premise (ADR 0208 D1), and
  `2.5` proves the bound reds under a one-to-many expansion. A compensating mutation (one fact yielding two,
  another yielding none) is a blind spot of the aggregate — now stated in the record; D3 does not name it.
- **MINOR — the `U`-on-the-fixture and triggers-4–5 qualifiers sat only in the block's Open edges.** Added to the
  Invariants bullet as well (one bullet, no new line; the block stays under the 100-line ratchet).

QA r2 spawned on the corrected documents.

### 2026-09-13 — QA r2 `APPROVED`; step 4 presented to the PO (lead)

Round 2 verified by `git show dd505dfd`: both MAJORs closed (the hub block re-cut; the seam sentence
superseded by an appended dated marker, ruled the correct form under the seam's own rule), both MINORs
closed or accepted (clause 2's aggregate grain is ADR 0208 D1's own statement of `D ≤ F`). Nothing
outstanding. Presented to the PO with: built · gate step 1 (all arms, quoted above) · step 2 ruled N/A
by the lead and put to the PO · QA verdict · open risks (`U` measured once on the fixture only; clause
6's family property blind to another schema/arity/spelling/wrapper/view; clause 2's aggregate blind to
a compensating mutation; triggers 4–5 `prose only`). Waiting.

### 2026-09-13 — step 4 human approval; step 5 Record (lead)

**PO approval:** *"Approved"* (2026-09-13), on the presentation recorded in the previous entry — which put step 2
(`e2e:prod`) to the PO as N/A; the approval was given with that ruling in the presentation, so **step 2 is
RULED N/A by the PO's approval** (the non-log artefacts carrying it: the hub's AC-9 tick and the ledger row's
Tests cell). No other ruling was taken in this unit — the AC-4 re-wording was a lead decision on a measured
limit, disclosed in the presentation and accepted with it.

**Rulings reconciled against artefacts (playbook §4 step 8):** approval → ledger row + hub `complete`; step 2
N/A → hub AC-9 + ledger Tests cell; the D3 trigger table → the record's own top section (a register clause, not a
log line); the follow-up's re-claused close condition → its archive entry AND its body's new RESOLVED section
(step 9: both homes). This unit wrote no ADR; ADR 0208's `§ Consequences` dated note is updated in this commit
to say the last owed unit is built.

**Record step mechanics:** the hub's `## Current state` block (below, verbatim) cut into this entry; the
follow-up entry moved verbatim (`cmp` against the extracted bytes) with the `— ✅ RESOLVED` heading suffix and a
resolution blockquote; the body gained a `## ✅ RESOLVED` section; LESSONS gains `LEARN-105` (the abort ↔ NOTICED
class from the introducing side); the review queue's one post-marker entry (`89aa778b`, the user's own ordering
prompt, hook finding (ii)) marked processed — not a doc problem, 0 doc fixes, no CLAUDE.md edit. ⛔ `main` is
NOT pushed (standing instruction); the branch is merged locally, and the graphify refresh follows the merge in
its own `chore(graphify):` commit. The phase commit's sha is filled into the ledger row by the commit that
follows it (a row cannot name its own sha).

**The hub's final `## Current state` block, moved here verbatim:**

## Current state

**Updated:** 2026-09-13

### Objective
Land ADR 0208 D2's six-clause shape assertion on the P2 instrument, red-first in pgTAP, and name
D3's five triggers in the record; retire the seam's *"RULED NOT BUILT"* bullet.

### Done since start
- pgTAP `423` (`plan(33)`, every cell with an observed red) + P2 `§ 5` (`U = D = 2 ≤ F = 20` on the
  fixture) at `7e655461`; AC-4 re-worded to the measured limit (no `U` inside a transaction).
- Gate step 1 CLOSED by the lead on the second pass: fresh reset + `test:db` 272/9132 PASS; `lint`
  0/0, `typecheck`, `test` green; deriver rc 3 NOT-APPLICABLE; four authz arms + SELFTEST 46/46
  (bash 5.2.37) hold; set-valued arm **CLEAN** with `423` in both resolver cases' reddened set —
  after the first pass found it DIRTY because `423` aborted under the arm's mutation, fixed at
  `d921e8be` (capture-then-assert; a `5.1` `is(NULL,NULL)` vacuity closed on the way).
- Step 2 ruled N/A by the lead (no `src/`, no migration), put to the PO.
- QA r1 `CHANGES REQUESTED` — two MAJORs, both documentation stale against the fix (this block;
  one seam sentence), corrected; two MINORs answered in the record. **QA r2 `APPROVED`**, nothing
  outstanding (`docs/reviews/ae4-d-shape-assertion-review.md`).

### In progress
- Step 4: presented to the PO; waiting. Step 2 (`e2e:prod`) is put to the PO as N/A.

### Next
- On approval → Record step (ledger row, hub `complete`, FUP closed in both homes, seam re-stamp).

### Blockers
- None.
