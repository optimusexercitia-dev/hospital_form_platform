# AE1.2 step 1 — the DEFINER classification

- **Task:** AE1.2 step 1 of [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md)
  (authority: ADR [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D9;
  measured-figure corrections: ADR [0160](../decisions/0160-ae0-corrections-to-adr-0155-measured-figures.md)).
- **Scope:** CLASSIFICATION ONLY. No migration was written and **no `REVOKE` was issued**. §7's
  revoke set is a **proposal** awaiting lead authorization, to be executed in batches with a full
  pgTAP + `e2e:prod` run per batch.
- **Measured:** 2026-08-27, by `backend`, on the local stack.
- **Stack:** PostgreSQL 17.6, head `20261003004300`, `auth.users` = 36. (Same head as
  [AE0.1's census](authz-evolution-census-ae0.md), which this file extends rather than re-derives.)
- **Instrument:** §4's SQL + §5's app-side sweep. **This artifact is AE4's wrapper-inventory input
  and must stay re-derivable — never hand-maintained.** Every cell below is generated; nothing is typed.

> **⛔ The catalog is the sole truth here.** `pg_proc` (including `prosecdef`), `pg_policies` /
> `pg_policy`, `pg_depend`, `pg_trigger`, and the `has_*_privilege` family. No migration file was
> read and no figure was taken from one — migration bodies in this repo are rewritten at runtime via
> `pg_get_functiondef()` + `replace()` + `execute`, so their text can never be trusted.

---

## 1. The enumerated population

AE0.1 measured the totals; this task's population is the `authenticated`-executable DEFINER subset,
reproduced here exactly:

| schema | DEFINER | …`authenticated` may EXECUTE | INVOKER | …`authenticated` may EXECUTE | all |
| --- | ---: | ---: | ---: | ---: | ---: |
| `app` | 389 | **320** | 111 | 98 | 500 |
| `public` | 454 | **432** | 90 | 90 | 544 |
| **total** | **843** | **752** | 201 | 188 | 1044 |

**Enumerated population = 432 + 320 = 752.** Matches ADR 0155 / AE0.1 exactly (454 + 389 = 843
DEFINER; ADR 0160 D3 stands — quote 843, never the audit's 842).

Four catalog facts the whole classification rests on, each measured, none assumed:

| fact | value | why it decides classes |
| --- | --- | --- |
| every `app`/`public` function is owned by **`postgres`** | 0 exceptions | a `SECURITY DEFINER` runs as its **owner**, and the owner holds EXECUTE on everything it owns, so **its callees need no `authenticated` EXECUTE** — a DEFINER terminates the privilege chain. ⛔ **CORRECTED 2026-08-27** ([tier-1 threat review](./authz-ae1-tier1-threat-review.md) F-T1-4): this read *"runs as a superuser"*. Measured: `postgres` is **`rolsuper = false`** here (Supabase de-superusers it) and `rolbypassrls = true`. Every verdict in this file survives — the chain terminates by **ownership** — but the mechanism was misnamed, and `BYPASSRLS`, not superuser, is the half that matters for authorization |
| PostgREST exposed schemas | `["public", "graphql_public"]` (`supabase/config.toml`) | **no `app` function is client-invocable.** An `app` DEFINER's `authenticated` EXECUTE can only be needed by a policy, a catalog expression, or an INVOKER-context caller |
| overloaded names inside the population | **0** | a name-keyed join is unambiguous; there is exactly **one** cross-schema collision, `draft_version_of_template` (`app` + `public`), named so it is not silently over-joined |
| functions with an empty `prosrc` (SQL-standard `BEGIN ATOMIC`) | **0** | the `prosrc` regex is a **complete** instrument for function→function edges; nothing hides in a parse-tree-only body |

---

## 2. How a class is decided — and why "who calls it" is the only input

⛔ **Class is decided by who CALLS a function, never by its name.** Four caller populations were
derived from the catalog and one from the source tree:

| caller population | instrument | verdict contribution |
| --- | --- | --- |
| RLS policies | `pg_depend` (exact, parse-tree) **and** a regex over `pg_get_expr` (independent) | **policy predicate → EXECUTE NEEDED.** RLS predicates are evaluated as the **querying role** |
| triggers | `pg_trigger.tgfoid` | **trigger body → none.** EXECUTE on a trigger function is checked at `CREATE TRIGGER`, not at fire time |
| CHECK constraints / defaults / index expressions / views | `pg_depend` by `classid` | see §9 F5 — **not resolved to a verdict here** |
| other functions | comment-stripped `prosrc`, probed **unanchored**, qualified *and* bare | **internal helper → none**, *unless* a caller itself runs with the invoker's privileges |
| the app | `src/**` sweep, four tiers (§5) | **command door → EXECUTE NEEDED** |

**The propagation rule.** A function's body runs with `authenticated`'s privileges iff it is
`SECURITY INVOKER` **and** it was entered from a caller-privileged context (a client call, a policy
predicate, a trigger body, a stored expression). Everything such a function calls therefore also
needs `authenticated` EXECUTE. A `SECURITY DEFINER` in the chain **stops** the propagation, because
every one of them here is owned by `postgres`. The closure has **139** members; **42** of the 752
acquire their `y` verdict through it and through nothing else.

**A function can be in TWO classes and the verdict is the UNION — most permissive wins.**
64 functions are multi-class (§6.1). Collapsing one of those to its "cheaper" class would revoke
something a policy needs and break RLS for every user, so the union is enforced mechanically in the
generator, not by review.

⛔ **UNRESOLVED is a required third bucket and is never a synonym for "needs none".** An undecidable
function that defaults to "needs none" generates a breaking revoke. 34 functions land there (§8),
each with its reason printed on its row.

---

## 3. Class definitions as applied

| class | definition applied | EXECUTE |
| --- | --- | :---: |
| **command door** | `public` (PostgREST-exposed) **and** return type ≠ `trigger` **and** reached from `src/` at tier `rpc` or `code-literal` | **y** |
| **policy predicate** | referenced by ≥1 RLS policy expression (`pg_depend` ∪ regex), on **any** schema's table — four of them are on `storage.objects` | **y** |
| **trigger body** | referenced by ≥1 `pg_trigger.tgfoid` | n |
| **internal helper** | called by ≥1 other `app`/`public` function, none of which runs as the invoker | n |
| **UNRESOLVED** | everything else, plus every case whose evidence is weak or whose mechanism is unestablished | **?** |

---

## 4. The deriving SQL (catalog side)

Run as `docker exec -i supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -f -`, preceded
by the generated `app_called` prelude from §5. Block numbers are cited by every figure below.

```sql
set search_path to pg_catalog, public;

-- BLOCK 1 -- the population. prosrc is comment-stripped ('--' AND block
-- comments); the strip's effect is MEASURED in BLOCK 9, never assumed.
create temp table pop as
select p.oid, n.nspname as sch, p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)             as rettype,
       p.prosecdef, p.provolatile, p.proretset,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc_exec,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_exec,
       regexp_replace(regexp_replace(p.prosrc, '/\*.*?\*/', ' ', 'gs'),
                      '--[^\n]*', ' ', 'g')      as src,
       p.prosrc                                  as raw_src
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app', 'public');

create temp table target as select oid from pop where prosecdef and auth_exec;   -- 752

-- BLOCK 2 -- policy -> function edges. TWO INDEPENDENT INSTRUMENTS, deliberately
-- different in KIND: agreement between two probes with the same blind spot is
-- worth nothing.
create temp table pol_dep as                       -- (a) parse-tree exact
select distinct d.objid as polid, d.refobjid as fnoid
from pg_depend d
where d.classid = 'pg_policy'::regclass
  and d.refclassid = 'pg_proc'::regclass
  and d.refobjid in (select oid from pop);

create temp table pol_txt as                       -- (b) deparse + unanchored regex
with e as (
  select pol.oid as polid,
         coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
         coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') as expr
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  -- ⚠ ALL schemas, not just app/public: four `storage.objects` policies call
  --   `app.*` helpers. Scoping this to `public` is exactly what made this
  --   instrument disagree with pg_depend by those four functions.
)
select distinct e.polid, f.oid as fnoid
from e
join lateral regexp_matches(e.expr, '([a-z_][a-z0-9_]*)[[:space:]]*\(', 'g') m on true
join pop f on f.proname = m[1];

-- BLOCK 3 -- trigger -> function edges (exact)
create temp table trg_edge as
select distinct t.tgfoid as fnoid, n.nspname || '.' || c.relname as on_table
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where t.tgfoid in (select oid from pop);

-- BLOCK 4 -- other catalog references (defaults / CHECK / index exprs / views)
create temp table cat_ref as
select distinct d.refobjid as fnoid,
       case d.classid
         when 'pg_attrdef'::regclass    then 'column-default'
         when 'pg_constraint'::regclass then 'check-constraint'
         when 'pg_index'::regclass      then 'index-expression'
         when 'pg_rewrite'::regclass    then 'view-or-rule'
         else d.classid::regclass::text end as kind,
       d.objid
from pg_depend d
where d.refclassid = 'pg_proc'::regclass
  and d.refobjid in (select oid from pop)
  and d.classid not in ('pg_proc'::regclass, 'pg_policy'::regclass, 'pg_trigger'::regclass,
                        'pg_namespace'::regclass, 'pg_extension'::regclass,
                        'pg_language'::regclass, 'pg_type'::regclass);

-- BLOCK 5 -- function -> function edges. Names probed UNANCHORED and in BOTH
-- forms, because policies call the bare `is_x_of` and functions call `is_x_of_for`
-- and no single anchored regex finds both. Bare matches join on proname only, so
-- the edge set OVER-includes across schemas -- the safe direction, since
-- over-inclusion can only make a verdict MORE permissive.
create temp table fn_edge as
with q as (
  select c.oid as caller, m[1] as csch, m[2] as cname
  from pop c
  join lateral regexp_matches(c.src, '(app|public)[[:space:]]*\.[[:space:]]*([a-z_][a-z0-9_]*)[[:space:]]*\(', 'g') m on true
), b as (
  select c.oid as caller, m[1] as cname
  from pop c
  join lateral regexp_matches(c.src, '(?:^|[^a-zA-Z0-9_."$])([a-z_][a-z0-9_]*)[[:space:]]*\(', 'g') m on true
)
select distinct caller, callee from (
  select q.caller, f.oid from q join pop f on f.sch = q.csch and f.proname = q.cname
  union all
  select b.caller, f.oid from b join pop f on f.proname = b.cname
) e (caller, callee)
where caller <> callee;

-- BLOCK 6 -- the propagation closure: functions whose body executes with the
-- INVOKING role's privileges. A DEFINER callee terminates the chain.
create temp table runs_as_caller as
with recursive seed as (
  select f.oid from pop f
  where not f.prosecdef
    and (f.oid in (select fnoid from pol_dep)
      or f.oid in (select fnoid from pol_txt)
      or f.oid in (select fnoid from trg_edge)
      or f.oid in (select fnoid from cat_ref)
      or (f.sch = 'public' and f.auth_exec
          and f.proname in (select proname from app_called)))
), cl as (
  select oid from seed
  union
  select e.callee from cl join fn_edge e on e.caller = cl.oid
  join pop p on p.oid = e.callee where not p.prosecdef
)
select distinct oid from cl;                        -- 139

-- BLOCK 7 -- per-function evidence for the 752 targets (this file's table)
create temp table ev as
select f.oid, f.sch, f.proname, f.args, f.rettype, f.provolatile, f.proretset,
       f.auth_exec, f.svc_exec, f.anon_exec,
       (select count(*) from pol_dep pd where pd.fnoid = f.oid)                            as n_pol_dep,
       (select count(*) from pol_txt pt where pt.fnoid = f.oid)                            as n_pol_txt,
       (select count(*) from trg_edge t where t.fnoid = f.oid)                             as n_trg,
       (select string_agg(distinct t.on_table, ',') from trg_edge t where t.fnoid = f.oid) as trg_tables,
       (select string_agg(distinct cr.kind, ',') from cat_ref cr where cr.fnoid = f.oid)   as cat_kinds,
       (select count(*) from fn_edge e where e.callee = f.oid)                             as n_callers,
       (select count(*) from fn_edge e join pop c on c.oid = e.caller
          where e.callee = f.oid and c.prosecdef)                                          as n_callers_definer,
       (select count(*) from fn_edge e where e.callee = f.oid
          and e.caller in (select oid from runs_as_caller))                                as n_callers_asuser,
       (f.proname in (select proname from app_called))                                     as app_ref
from pop f where f.oid in (select oid from target);
```

---

## 5. The app-side sweep — four tiers, and why the comment tier exists

`src/**` is swept for every one of the 1043 catalog function names. `src/lib/types/database.ts` is
**excluded**: it is generated and lists every `public` function by name, so including it would make
every function look called.

| tier | predicate | treated as |
| --- | --- | --- |
| `rpc` | `x.rpc('<name>'` in **code** | command door (strongest) |
| `code-literal` | a string literal exactly equal to `<name>`, in **code** | command door — this is what catches this repo's `rpc: 'conclude_interview' \| 'reopen_interview' \| …` union-typed indirection and the `const FN = '<door>'; admin.rpc(FN)` shape |
| `code-word` | `<name>` as a whole word in code, not as a literal | **weak** → UNRESOLVED (may be a PostgREST computed field, e.g. `.select('id,_case_caps')`) |
| `comment-only` | every occurrence is inside a `//` or `/* */` comment | **weak** → UNRESOLVED |

⚠ **The comment tier exists because the `prosrc` comment trap has an exact TypeScript twin, and it
fired.** `meetingsEnabled()`'s JSDoc still reads *"Calls the SECURITY DEFINER
`public.meetings_enabled()`"* while the body delegates to `featureEnabled('meetings')` →
`get_feature_flags()`. Counting that comment as a caller hides a dead door; **silently discarding
comments proposes a revoke on nothing but an over-strip.** So it is its own tier, and it resolves to
UNRESOLVED — never to "needs none".

⛔ **The stripper had to be a scanner, not a regex — and the control is what proved it.** The first
version blanked block comments with `/\/\*[\s\S]*?\*\//g`. A `/*` inside a string literal opened a
phantom comment that swallowed real code, and `src/lib/safety/capa-actions.ts:144` — a live
`.rpc('add_capa_action', {` — came back `comment-only`. **Sixteen CAPA doors were one step from
being reported as dead.** What caught it is a standing control kept in the sweep: the RAW
`.rpc('<name>'` probe is run beside the comment-aware one and **every disagreement is printed**.
Post-fix: raw = 475 names, comment-aware = 475, **disagreements = 0**.

**The sweep, specified so it is reconstructible** (it feeds `app_called`, the `\copy`-free prelude
that BLOCK 6 consumes; the catalog side of the join is `select proname from pg_proc … where nspname
in ('app','public')`, all 1043 names, never a hand list):

```js
// 1. blank every comment byte with a single-pass scanner that tracks
//    normal / line-comment / block-comment / '…' / "…" / `…` state,
//    preserving offsets. Regex literals are NOT tracked: a `/` that opens a
//    regex is read as division, which leaves the scanner in NORMAL state —
//    i.e. the scanner can only UNDER-strip, never over-strip.
// 2. run these three probes over the BLANKED text, in priority order:
/\.rpc\(\s*(['"`])([A-Za-z0-9_]+)\1/g      // tier `rpc`
/(['"`])([A-Za-z_][A-Za-z0-9_]*)\1/g       // tier `code-literal`
/[A-Za-z_][A-Za-z0-9_]*/g                  // tier `code-word`
// 3. run probe 3 over the RAW text; a name present there and absent from the
//    blanked text is tier `comment-only`.
// 4. CONTROL: run probe 1 over the RAW text too and print every name the raw
//    probe calls an RPC while the blanked probe calls comment-only.
```

The suite sweep (`supabase/tests`, `e2e`, `scripts`, `seed.sql`) runs the same four tiers and is
recorded on each row as `suite-referenced`. A suite reference is **not** a production path and never
produces a `y`; it is printed so that a revoke which reds pgTAP or E2E is a *predicted* finding
rather than a surprise. **145 of the 233 revoke candidates are suite-referenced.**

---

## 6. The arithmetic

### 6.1 By class — the parts sum

| class | functions |
| --- | ---: |
| command door | 372 |
| trigger body | 134 |
| internal helper | 133 |
| policy predicate + internal helper | 52 |
| UNRESOLVED | 34 |
| policy predicate | 15 |
| command door + internal helper | 12 |

**372 + 134 + 133 + 52 + 34 + 15 + 12 = 752** ✓ (the enumerated population).

**64 functions are multi-class** (52 `policy predicate + internal helper`, 12
`command door + internal helper`). In **all 64** the union changes nothing that the stricter member
did not already decide — every one is `y` on its policy/command-door leg, and `internal helper`
alone would have said `n`. **So the union rule flips 64 verdicts from `n` to `y`.** Had class been
taken as single-valued and "internal helper" won, 52 RLS predicates and 12 live doors would have
been revoked.

### 6.2 By verdict — the parts sum

| EXECUTE needed | functions |
| :---: | ---: |
| **y** | 485 |
| **n** | **233** ← the proposed revoke set |
| **?** (UNRESOLVED) | 34 |

**485 + 233 + 34 = 752** ✓

---

## 7. The proposed revoke set — 233 functions

⛔ **PROPOSAL ONLY. Nothing was revoked.** Composition:

| slice | count |
| --- | ---: |
| schema `app` | 213 |
| schema `public` | 20 |
| class `trigger body` (all 134 return `trigger`) | 134 |
| class `internal helper` | 99 |
| also hold `service_role` EXECUTE (untouched by an `authenticated` revoke) | 231 |
| also hold `anon` EXECUTE (⛔ **out of scope** — `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`, a PO decision) | 138 |
| suite-referenced (a red is predicted, not a surprise) | 145 |

### 7.1 Proposed batching

| batch | contents | count | why it is this order |
| :---: | --- | ---: | --- |
| 1 | **trigger bodies** — every one returns `trigger` | 134 | PostgREST cannot call a `trigger`-returning function, and EXECUTE on a trigger function is checked at `CREATE TRIGGER`, not at fire time. The lowest-consequence slice in the set. ⚠ **That second half is the plan's own class definition, not something this task measured** — batch 1 is ordered first *because* its pgTAP + `e2e:prod` run is the empirical control for it. If batch 1 reds on a trigger path, the class definition is wrong and batches 2–4 do not proceed |
| 2 | `app` **boolean** helpers (the `_for` layer: `has_role`, `is_*_of_for`, `can_*`) | 43 | they stay inside `ARM=census` clause 1 and `ARM=policy`'s `PRED_DOMAIN` — both key on `rettype = 'bool'` with **no** EXECUTE requirement — so **no arm coverage is lost** |
| 3 | remaining `app` helpers (non-boolean, non-setof) | 52 | `app` is not PostgREST-exposed; each has only DEFINER callers |
| 4 | ⛔ **HOLD — lead/PO ruling required** (§7.2) | 4 | each one either evicts an object from an ARM domain or is a Rule 12 PHI door |

**134 + 43 + 52 + 4 = 233** ✓

### 7.2 Batch 4 — the four that must not go in a routine batch

| function | why it is held |
| --- | --- |
| `public.set_participant_patient(…)` → `uuid` | **Rule 12 PHI (case module).** Sole caller is `public.set_case_patient` (DEFINER), so the verdict is mechanically `n` — **but revoking `authenticated` while `service_role` remains puts it in exactly F-F's blind shape** (`public`, DEFINER, returns `uuid`, `service_role`-only ⇒ in **no** ARM's domain). §9 F1 |
| `app.eligible_voters(p_case_id uuid)` → `SETOF uuid` | leaves `ARM=census` clause 1 and `ARM=policy`'s rowdoor arm, both of which require `proretset` **AND** `authenticated` EXECUTE |
| `app.submitted_form_responses(p_form_id uuid)` → `SETOF responses` | same |
| `app.case_phase_option_aggregates(p_case_phase_id uuid)` → `TABLE(…)` | same |

### 7.3 Top 10 by risk, with the reason

| # | function | why it is the risky end |
| ---: | --- | --- |
| 1 | `public.set_participant_patient(…)` | Rule 12 PHI door; the only non-`trigger` `public` function in the set; **manufactures the F-F blind shape** |
| 2 | `app.can_read_case_patient(p_case_id, p_uid)` | the Rule 12 case-PHI read predicate. Verdict `n` rests entirely on **0 policies calling it**, which `authz-handoff.md` §7.2 independently measured too. ⚠ **The two readings agree on the deciding half and DISAGREE on the other:** the handoff counted **3** DEFINER consumers, this file counts **5** — this instrument matches bare names and over-includes by design (§4 BLOCK 5), so 5 is an upper bound and 3 may well be right. The disagreement does not move the verdict (all 5 are DEFINER either way) but it is recorded rather than smoothed over. If the 0-policy half is wrong, the failure is a PHI read-path 42501 |
| 3 | `app.has_role(p_scope_type, p_scope_id, p_role, p_user_id)` | the single `memberships` reader every role helper bottoms out in; a wrong verdict here breaks **every** scoped-role check at once |
| 4 | `app.has_role_any(p_scope_type, p_scope_id, p_user_id)` | same layer |
| 5 | `app.is_tenancy_admin_of_for(p_commission_id, p_user_id)` | AE0.1 §3.4: called by **77** function bodies; its bare twin `is_tenancy_admin_of` is called by **53 policies**. This is the `X` / `X_for` pair — the twin that policies call is correctly `y`, this one is not, and **confusing the two is the recorded trap** |
| 6 | `app.member_can_for(p_commission_id, p_capability, p_user_id)` | same pair shape; `app.member_can` is called by 3 policies |
| 7 | `app.is_admin_for(p_user_id)` | the platform-admin predicate behind `app.is_admin` (26 policies) |
| 8 | `public.guard_profile_privileged_columns()` | the guard AE1.3 F-E pins as load-bearing for the person-door design; revoking is safe (trigger body) but any behaviour change here is phase-blocking |
| 9 | `public.handle_new_user()` | trigger on **`auth.users`** — the invite/registration path; a break is a signup outage, and it is the only revoke candidate whose trigger sits outside `public` |
| 10 | the 3 `SETOF`/`TABLE` returners (§7.2) | the only members of the set whose revoke **shrinks ARM coverage** |

### 7.4 What the revoke costs in ARM coverage — measured, not assumed

| arm | domain predicate | effect of the 233 |
| --- | --- | --- |
| `ARM=floor` | `public` + `prosecdef` + `authenticated` EXECUTE | **432 → 412.** 20 objects leave (19 `trigger`-returning + `set_participant_patient`) |
| `ARM=census` clause 1 | `prosecdef` + (`rettype='bool'` **or** (`proretset` **and** `authenticated` EXECUTE)) | **3 leave** (the setof trio). The **43 boolean** candidates **stay** — that clause has no EXECUTE requirement |
| `ARM=policy` | `prosecdef` + `PRED_DOMAIN` (`rettype='bool'` + name/body probe); rowdoor arm needs `proretset` + EXECUTE | **3 leave** (same trio). The 43 boolean predicates stay |
| `ARM=wrapper` | `public`, **`not prosecdef`** | **structurally unaffected** — it is the `prosecdef = f` half by construction (ADR 0079 Amdt 7) |
| `ARM=hat` | `nspname in ('app','public')` + `prokind='f'` | **unaffected** — no privilege term in the domain |

⛔ **This is the finding the batching exists for: a revoke can push an object OUT of every arm's
domain, which is the F-F shape.** Absence of a verdict is absence of coverage; an object that leaves
a domain does not become safe, it becomes unswept.

---

## 8. UNRESOLVED — 34, in three named buckets

⛔ **None of these may be revoked, and none may be recorded as "needs none".**

### A — no reference found by ANY instrument (3)

Not a policy, not a trigger, not a constraint, no function caller, nothing in `src/`, nothing in the
suites. These are the *"a correct door that nothing can reach"* shape and are a **dead-surface
finding for the lead**, not a revoke candidate:

- `app.case_capabilities(p_case_id uuid, p_uid uuid)`
- `app.commission_of_session(p_session_id uuid)`
- `app.hospital_of_referral(p_referral_id uuid)`

### B — referenced ONLY by the suites (16)

pgTAP/E2E/`scripts` name them; no production path does. **11 of the 16 are `public` DEFINER doors an
`authenticated` client can call today and nothing in `src/` invokes** — this is the report's
"`authenticated`-reachable command door that nothing in `src/` calls" answer:

`public.affiliate_person_to_org` · `public.appoint_hospital_dpo` · `public.archive_ethics_sanction_type` ·
`public.assign_ethics_remediation` · `public.assign_org_admin` · `public.create_ethics_sanction_type` ·
`public.open_ethics_external_referral` · `public.revoke_hospital_dpo` ·
`public.set_case_narrative_assignment_role` · `public.set_interview_interviewer_participant` ·
`public.set_interview_subject_participant`

plus 5 `app` predicates with the same shape: `app.assert_session_writable` ·
`app.can_reach_case_on_member_surface` · `app.can_write_referral_response` ·
`app.hospital_of_capa_action` · `app.is_pqs_writer_of`.

⚠ Several of these are **tenancy/identity administration doors** (`assign_org_admin`,
`revoke_hospital_dpo`, `affiliate_person_to_org`). A door that is live to `authenticated` and called
by nothing is not automatically over-granted — its own gate may be correct — but it is exactly the
surface AE4/AE5 must account for, and it is unreachable from the product today.

### C — every `src/` occurrence is inside a COMMENT (15)

`public.action_items_enabled` · `public.audit_trail_enabled` · `public.case_narratives_enabled` ·
`public.case_patient_enabled` · `public.get_case_professional` · `public.interviews_enabled` ·
`public.meetings_enabled` · `public.patient_index_enabled` · `public.patient_safety_enabled` ·
`public.processless_cases_enabled` · `public.record_session_attendance` · `public.referrals_enabled` ·
`public.revoke_org_admin` · `public.set_interview_confidentiality` · `public.set_interview_participant`

**Ten of the fifteen are the per-flag `*_enabled()` readers**, and §9 F3 shows why: the app moved to
a single consolidated `public.get_feature_flags()` read and **the JSDoc that still claims otherwise
was not updated**. They are very likely dead, but "very likely" is not a verdict — resolving them is
a source-reading task, not a catalog one, and it is listed in §11.

---

## 9. Findings

**F1 — a revoke can MANUFACTURE the F-F blind shape, and one candidate does it.**
`docs/plans/authz-ae1-person-doors.md` §10 F-F establishes that a `public` `SECURITY DEFINER`
returning `void`/`uuid` and granted to `service_role` only is in **no** arm's domain. **No function
in the enumerated 752 is in that shape today** — by construction, they all hold `authenticated`
EXECUTE, which is what puts them in `ARM=floor`'s domain. But **`public.set_participant_patient(…)`
→ `uuid` is one `REVOKE` away from it**, and it is a Rule 12 PHI door. More broadly, **132 of the
384 `public` command doors return `void` or `uuid`**; any future revoke on one of those moves it from
`ARM=floor`'s domain into F-F's gap. The batching in §7.1 exists for this and nothing else.

**F2 — the union rule is load-bearing, and it is worth 64 verdicts.** 52 functions are
`policy predicate + internal helper` and 12 are `command door + internal helper`. Every one of them
has a DEFINER caller *and* a caller-privileged one. A single-valued classification that let
"internal helper" win would have revoked **52 live RLS predicates and 12 live doors**.

**F3 — a stale JSDoc almost bought a dead door a reprieve, and a bad stripper almost killed 16 live
ones.** `src/lib/meetings/actions.ts:147` documents a call to `public.meetings_enabled()` that the
body no longer makes (`featureEnabled('meetings')` → `get_feature_flags()`). That is the §7.2
"text is not truth" trap in TypeScript. The *fix* for it — stripping comments — then over-stripped
via `/*` inside a string literal and reported 16 live CAPA `.rpc()` doors as comment-only. **Both
errors point the same way: a comment probe must be a scanner, and it must be run beside a raw probe
whose disagreements are printed.** See §5.

**F4 — the two policy instruments disagreed, and the disagreement was the finding.** `pg_depend`
found 480 policy→function edges; the deparse-regex found 474. The six missing edges were all
policies on **`storage.objects`** calling `app.is_tenancy_admin_of`, `app.is_member_of`,
`app.is_staff_admin_of` and `app.storage_upload_reserved` — excluded because the regex instrument
had been scoped to `public`/`app` *tables*. Widened: **480 = 480, zero disagreement in both
directions.** Had only the regex been run, four `app` helpers would have been classed
`internal helper` and proposed for revoke, breaking Storage RLS.

**F5 — five CHECK-constraint functions are UNRESOLVED on MECHANISM, not on evidence.**
`app.is_valid_condition`, `app.is_valid_visibility`, `app.is_valid_validation_config`,
`app.is_valid_cpf`, `app.is_valid_recommend_when` appear in 8 CHECK constraints on `form_items`,
`form_sections`, `form_item_validations`, `case_phases`, `process_template_phases`,
`professional_profiles` and `profiles`. **Whether PostgreSQL re-checks EXECUTE on a function inside
a stored CHECK expression at write time was not established here** — establishing it requires
constructing a role that lacks the grant and attempting the write, which is a mutation this task is
not authorized to make. All five happen to carry other `y` evidence, so **the question does not
change any verdict in this file** — but it must be answered before any future revoke touches a
constraint-referenced function. Recorded so it is not silently assumed either way.

**F6 — a malformed control manufactured a catastrophic-looking instrument failure.** The
comment-strip control first compared *bare-only* edges over `raw_src` (22) against *qualified ∪ bare*
edges over `src` (2241) and read as a 99% instrument collapse. Same-predicate on both sides:
**stripped 2241, unstripped 2262, comment-only 21, lost-by-stripping 0.** The control must be the
same predicate as the thing it controls, or it is a false alarm generator.

**F7 — `app` holds no client surface at all, which is what makes the budget large.** PostgREST
exposes `["public","graphql_public"]`. **320 `app` DEFINER functions hold `authenticated` EXECUTE
and not one of them is client-invocable**; the grant is needed only where a policy, a stored
expression or an INVOKER-context caller reaches them. **213 of the 233 proposed revokes are `app`
functions** — i.e. 67% of `app`'s authenticated-executable DEFINER surface is grant residue.

---

## 10. Controls — every zero, every instrument

| control | result | what it proves |
| --- | --- | --- |
| all `app`/`public` functions owned by `postgres` | **0 exceptions** (843 DEFINER + 201 INVOKER) | the "a DEFINER terminates the privilege chain" premise, on which 133 `internal helper` verdicts rest |
| comment-strip effect on fn→fn edges | stripped **2241**, unstripped **2262**, comment-only **21**, lost-by-stripping **0** | stripping removes 21 phantom edges and loses nothing. Measured, per §7.2's non-negotiable idiom — and the *control itself* had to be repaired first (F6) |
| `pg_depend` vs deparse-regex, policy edges | **480 = 480**, in-dep-not-txt **0**, in-txt-not-dep **0** | two instruments differing in *kind* now agree; the disagreement before widening was F4 |
| views in `app`/`public` referencing a population function | **0** | a measured absence, not an untested branch: `views_in_app_or_public = 0`, while the same `pg_depend` scan returns **34** `pg_rewrite`→`pg_proc` edges elsewhere in the DB — the instrument returns non-zero when the object exists |
| index-expression references | **0** | same scan returns **2** for `pg_attrdef` and **8** for `pg_constraint`→population — the classid filter is proven able to match |
| overloaded names in the population | **0** | name-keyed joins are unambiguous; the one cross-schema collision (`draft_version_of_template`) is named, not assumed away |
| empty `prosrc` (`BEGIN ATOMIC`) | **0** | the `prosrc` instrument is complete for function→function edges |
| raw vs comment-aware `.rpc()` probe | raw **475**, code-aware **475**, **disagreements 0** | the comment scanner neither over- nor under-strips (F3) |
| `app_called` names that match a catalog proname | **568 / 568** | the app-side sweep is joined to the catalog, not to a hand list |
| classes sum to the population | **372+134+133+52+34+15+12 = 752** | no function is double-counted or dropped |
| verdicts sum to the population | **485+233+34 = 752** | same |

Every figure in this file is reproducible by re-running §4's SQL with §5's generated prelude against
head `20261003004300`.

---

## 11. Not resolved by this task — named, not approximated

| item | why, and who owns it |
| --- | --- |
| the 15 bucket-C UNRESOLVED (§8) | requires reading `src/` call chains (`featureEnabled` / `get_feature_flags`, the interview/session action paths), not the catalog. A follow-up source task, not a catalog one |
| the 16 bucket-B suite-only doors (§8) | needs a product ruling: is `assign_org_admin` / `revoke_hospital_dpo` / `affiliate_person_to_org` an intended surface with no UI yet, or dead? AE4/AE5 input |
| F5's CHECK-constraint EXECUTE mechanism | needs a constructed negative test (a role without the grant attempting the write); a mutation, outside this task's authority |
| the `anon` residue (237 `app` functions, 167 of them DEFINER) | ⛔ **untouched by design** — `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` is a PO decision, and ADR 0160 already refuted the "167 → 237 growth" framing (two predicates at one instant; `anon` holds no USAGE on `app`) |
| whether each revoke actually lands on the remote | grants drift independently of migrations; AE1.2 step 2's own rule. A revoke you are not entitled to make is a **silent no-op** |
| `ALTER DEFAULT PRIVILEGES` (AE1.2 step 3) | separate step; this file is step 1 only |

---

## 12. The classification — one row per function

**752 rows.** `class` and `EXECUTE needed` are generated by §2's rules from §4's evidence; `evidence`
prints the deciding edges. `?` means UNRESOLVED — **never revoke on a `?`**.


| # | function | class | EXECUTE needed | evidence |
| ---: | --- | --- | :---: | --- |
| 1 | `app._audit_access_authorized(p_action text, p_entity_id uuid, p_commission uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/191_grant_hardening.sql:239) |
| 2 | `app._case_caps(p_case_id uuid, p_uid uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/230_authz_m3_assignment_phi.sql:164) |
| 3 | `app._insert_block_child_rows(p_item_id uuid, p_version_id uuid, p_snapshot_item jsonb)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/277_ff4_power_authoring.sql:489) |
| 4 | `app.action_item_initial_status(p_commission_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/305_audio_minutes.sql:39) |
| 5 | `app.action_item_status_by_key(p_commission_id uuid, p_key text)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/226_notifications.sql:680) |
| 6 | `app.advance_capa_action_core(p_action_id uuid, p_status text)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/226_notifications.sql:16) |
| 7 | `app.answer_map(p_response_id uuid)` | internal helper | **y** | 6 fn caller(s), 4 DEFINER; 2 caller runs as the INVOKER |
| 8 | `app.answer_map_by_item(p_response_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/21_answer_map.sql:160) |
| 9 | `app.answer_map_by_item_scoped(p_response_id uuid, p_group_instance_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/270_ff1_repeating_groups.sql:814) |
| 10 | `app.answer_map_scoped(p_response_id uuid, p_group_instance_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/270_ff1_repeating_groups.sql:361) |
| 11 | `app.artifact_belongs_to_commission(p_kind text, p_artifact uuid, p_commission uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/278_accreditation_schema.sql:10) |
| 12 | `app.assert_capa_writable(p_capa_id uuid)` | internal helper | **n** | 17 fn caller(s), 17 DEFINER; suite-referenced (supabase/tests/mutation/p0-authz-writepath-audit.sh:210) |
| 13 | `app.assert_condition_value_codes(p_version_id uuid, p_question_key text, p_target_type text, p_value jsonb, p_context text, p_op text)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/274_ff3_validations.sql:1513) |
| 14 | `app.assert_ethics_coordinator(p_case_id uuid)` | internal helper | **n** | 19 fn caller(s), 19 DEFINER; suite-referenced (supabase/tests/362_patient_mode_and_narrative_rename.sql:462) |
| 15 | `app.assert_ethics_typed(p_case_id uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/258_ethics_e2_rpcs.sql:89) |
| 16 | `app.assert_interview_writable(p_interview_id uuid)` | internal helper | **n** | 18 fn caller(s), 18 DEFINER; suite-referenced (supabase/tests/250_authz_p0_isolation.sql:127) |
| 17 | `app.assert_matrix_answer_writable(p_response_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/272_ff2_door_parity.sql:135) |
| 18 | `app.assert_not_case_excluded(p_case_id uuid)` | internal helper | **n** | 30 fn caller(s), 30 DEFINER; suite-referenced (supabase/tests/314_qob_org_admin_content_wall.sql:394) |
| 19 | `app.assert_phase_result_ready(p_case_phase_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:588) |
| 20 | `app.assert_rca_writable(p_rca_id uuid)` | internal helper | **n** | 21 fn caller(s), 21 DEFINER; suite-referenced (supabase/tests/mutation/p0-authz-writepath-audit.sh:210) |
| 21 | `app.assert_reference_answer_writable(p_response_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER |
| 22 | `app.assert_referral_draft_writable(p_referral_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/250_authz_p0_isolation.sql:67) |
| 23 | `app.assert_referral_target_acts(p_referral_id uuid, p_expected text[])` | internal helper | **n** | 6 fn caller(s), 6 DEFINER; suite-referenced (supabase/tests/250_authz_p0_isolation.sql:107) |
| 24 | `app.assert_respondent_linkage_resolved(p_participant_id uuid, p_role_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/321_eth_e4_participant_seating.sql:511) |
| 25 | `app.assert_session_writable(p_session_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/121_interviews.sql:390) |
| 26 | `app.audit_case_participant_role()` | trigger body | **n** | trigger on public.case_participant_roles |
| 27 | `app.audit_case_type_terminology()` | trigger body | **n** | trigger on public.case_type_terminology |
| 28 | `app.audit_write(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb, p_organization uuid, p_hospital uuid)` | internal helper | **y** | 179 fn caller(s), 175 DEFINER; 4 caller runs as the INVOKER |
| 29 | `app.can_access_targeted_response(p_response_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x8; 3 fn caller(s), 3 DEFINER |
| 30 | `app.can_access_targeted_version(p_form_version_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x7 |
| 31 | `app.can_amend_referral_phi_snapshot(p_referral_id uuid, p_uid uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/365_referral_mrn_persistence_floor.sql:133) |
| 32 | `app.can_curate_pqs_vocab(p_hospital_id uuid)` | internal helper | **n** | 8 fn caller(s), 8 DEFINER; suite-referenced (supabase/tests/195_pqs_vocab_dual_scope.sql:55) |
| 33 | `app.can_edit_referral_internal_note(p_note_id uuid, p_uid uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/mutation/p0b-isolation-mutation-audit.sh:245) |
| 34 | `app.can_execute_dsr_task(p_hospital_id uuid, p_commission_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 5 fn caller(s), 5 DEFINER |
| 35 | `app.can_manage_professional(p_org uuid, p_uid uuid)` | internal helper | **n** | 13 fn caller(s), 13 DEFINER; suite-referenced (supabase/tests/320_act_expiry_and_acl_hardening.sql:104) |
| 36 | `app.can_manage_referral_internal_note(p_note_id uuid, p_uid uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 37 | `app.can_manage_referral_phi_disclosure(p_referral_id uuid, p_uid uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/246_authz_f1_referral_split.sql:136) |
| 38 | `app.can_manage_referral_source(p_referral_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 15 fn caller(s), 15 DEFINER |
| 39 | `app.can_manage_referral_target(p_referral_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 11 fn caller(s), 11 DEFINER |
| 40 | `app.can_reach_case_on_member_surface(p_case_id uuid, p_uid uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/231_authz_m5_is_active_gate.sql:474) |
| 41 | `app.can_reach_meeting(p_meeting_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x5; 6 fn caller(s), 6 DEFINER |
| 42 | `app.can_read_action_item(p_action_item_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x5; 4 fn caller(s), 4 DEFINER |
| 43 | `app.can_read_capa(p_capa_id uuid, p_user_id uuid)` | policy predicate + internal helper | **y** | RLS policy x7; 5 fn caller(s), 5 DEFINER |
| 44 | `app.can_read_case(p_case_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x18; 20 fn caller(s), 20 DEFINER |
| 45 | `app.can_read_case_committee(p_case_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x11; 4 fn caller(s), 4 DEFINER |
| 46 | `app.can_read_case_patient(p_case_id uuid, p_uid uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/230_authz_m3_assignment_phi.sql:160) |
| 47 | `app.can_read_correction_response(p_response_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x6; 1 fn caller(s), 1 DEFINER |
| 48 | `app.can_read_document(p_document_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x3; 6 fn caller(s), 6 DEFINER |
| 49 | `app.can_read_document_hold(p_document_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 2 fn caller(s), 2 DEFINER |
| 50 | `app.can_read_document_of_version(p_version_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x1 |
| 51 | `app.can_read_document_version(p_version_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x1 |
| 52 | `app.can_read_event(p_event_id uuid, p_user_id uuid)` | policy predicate + internal helper | **y** | RLS policy x11; 12 fn caller(s), 12 DEFINER |
| 53 | `app.can_read_event_patient(p_event_id uuid, p_user_id uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 2 fn caller(s), 2 DEFINER |
| 54 | `app.can_read_file_object(p_file_object_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x1 |
| 55 | `app.can_read_full_meeting_content(p_meeting_id uuid, p_uid uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/313_printed_documents_meetings.sql:408) |
| 56 | `app.can_read_interview(p_interview_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x7; 2 fn caller(s), 2 DEFINER |
| 57 | `app.can_read_minutes_transcript(p_job_id uuid, p_uid uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/305_audio_minutes.sql:116) |
| 58 | `app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 2 fn caller(s), 2 DEFINER |
| 59 | `app.can_read_quality_dashboards(p_commission_id uuid)` | internal helper | **n** | 6 fn caller(s), 6 DEFINER; suite-referenced (supabase/tests/270_authz_dashboard_gate_uniformity.sql:218) |
| 60 | `app.can_read_referral(p_referral_id uuid, p_uid uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/150_referrals.sql:198) |
| 61 | `app.can_read_referral_internal_note(p_note_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 3 fn caller(s), 3 DEFINER |
| 62 | `app.can_read_referral_internal_notes(p_referral_id uuid, p_uid uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/295_technical_director_referrals.sql:559) |
| 63 | `app.can_read_referral_metadata(p_referral_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x5; 5 fn caller(s), 5 DEFINER |
| 64 | `app.can_read_referral_phi(p_referral_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x3; 8 fn caller(s), 8 DEFINER |
| 65 | `app.can_read_signoff(p_response_id uuid)` | policy predicate | **y** | RLS policy x1 |
| 66 | `app.can_read_xref_row(p_commission_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x1 |
| 67 | `app.can_sign_meeting(p_attendee_id uuid, p_signer uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 1 fn caller(s), 1 DEFINER |
| 68 | `app.can_sign_section(p_response_id uuid, p_section_id uuid, p_signer uuid)` | policy predicate | **y** | RLS policy x1 |
| 69 | `app.can_view_printed_document(p_source_kind text, p_source_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 8 fn caller(s), 8 DEFINER |
| 70 | `app.can_write_action_item_stake(p_action_item_id uuid, p_uid uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/231_authz_m5_is_active_gate.sql:330) |
| 71 | `app.can_write_capa(p_capa_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x8; 5 fn caller(s), 5 DEFINER |
| 72 | `app.can_write_case_content(p_case_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x3; 8 fn caller(s), 8 DEFINER |
| 73 | `app.can_write_case_narrative(p_narrative_id uuid, p_uid uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/231_authz_m5_is_active_gate.sql:446) |
| 74 | `app.can_write_document(p_document_id uuid, p_uid uuid)` | internal helper | **n** | 6 fn caller(s), 6 DEFINER; suite-referenced (supabase/tests/142_rca.sql:347) |
| 75 | `app.can_write_interview(p_interview_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x6; 8 fn caller(s), 8 DEFINER |
| 76 | `app.can_write_rca(p_rca_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x8; 5 fn caller(s), 5 DEFINER |
| 77 | `app.can_write_referral_response(p_referral_id uuid, p_uid uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/246_authz_f1_referral_split.sql:183) |
| 78 | `app.can_write_targeted_response(p_response_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x5; 3 fn caller(s), 2 DEFINER; 1 caller runs as the INVOKER |
| 79 | `app.case_capabilities(p_case_id uuid, p_uid uuid)` | UNRESOLVED | **?** | NO reference found by any instrument — policy, trigger, constraint, fn-caller, `src/` or suite |
| 80 | `app.case_of_action_item(p_action_item_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/229_authz_m1_exclusion_durability.sql:734) |
| 81 | `app.case_of_case_phase(p_phase_id uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 2 fn caller(s), 2 DEFINER |
| 82 | `app.case_of_interview(p_interview_id uuid)` | policy predicate + internal helper | **y** | RLS policy x4; 6 fn caller(s), 6 DEFINER |
| 83 | `app.case_of_patient_participant(p_participant_id uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/349_dsr_request_workflow.sql:108) |
| 84 | `app.case_phase_answer_map(p_case_phase_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/263_correction_readers.sql:204) |
| 85 | `app.case_phase_option_aggregates(p_case_phase_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/202_flagged_aggregates.sql:210) |
| 86 | `app.commission_of_action_item(p_action_item_id uuid)` | internal helper | **n** | 10 fn caller(s), 10 DEFINER |
| 87 | `app.commission_of_case(p_case_id uuid)` | policy predicate + internal helper | **y** | RLS policy x14; 30 fn caller(s), 28 DEFINER; 2 caller runs as the INVOKER |
| 88 | `app.commission_of_document(p_document_id uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 1 fn caller(s), 1 DEFINER |
| 89 | `app.commission_of_document_version(p_version_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/mutation/b1-org-admin-wall-mutation-audit.sh:134) |
| 90 | `app.commission_of_event(p_event_id uuid)` | internal helper | **n** | 8 fn caller(s), 8 DEFINER; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:31) |
| 91 | `app.commission_of_interview(p_interview_id uuid)` | internal helper | **n** | 7 fn caller(s), 7 DEFINER |
| 92 | `app.commission_of_meeting(p_meeting_id uuid)` | policy predicate + internal helper | **y** | RLS policy x10; 22 fn caller(s), 21 DEFINER; 1 caller runs as the INVOKER |
| 93 | `app.commission_of_referral(p_referral_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 94 | `app.commission_of_session(p_session_id uuid)` | UNRESOLVED | **?** | NO reference found by any instrument — policy, trigger, constraint, fn-caller, `src/` or suite |
| 95 | `app.commission_of_template(p_template_id uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 2 fn caller(s), 2 DEFINER |
| 96 | `app.commission_of_template_phase(p_phase_id uuid)` | policy predicate | **y** | RLS policy x4 |
| 97 | `app.commission_of_template_version(p_version_id uuid)` | policy predicate + internal helper | **y** | RLS policy x8; 6 fn caller(s), 6 DEFINER |
| 98 | `app.commission_of_version(p_form_version_id uuid)` | policy predicate + internal helper | **y** | RLS policy x11; 9 fn caller(s), 9 DEFINER |
| 99 | `app.commission_staff_admin_of_case(p_case_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER |
| 100 | `app.compute_case_phase_result(p_case_phase_id uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:590) |
| 101 | `app.compute_due_charter_notifications()` | internal helper | **n** | 1 fn caller(s), 1 DEFINER |
| 102 | `app.compute_due_document_review_notifications()` | internal helper | **n** | 1 fn caller(s), 1 DEFINER |
| 103 | `app.compute_due_ethics_notifications()` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/259_ethics_e2_scan_projection.sql:29) |
| 104 | `app.confidentiality_clearance_ok(p_case_id uuid, p_label text, p_uid uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/328_dm1_document_substrate.sql:921) |
| 105 | `app.controlled_version_source_path(p_version_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/00_setup.sql:472) |
| 106 | `app.copy_response_answers(p_src_response_id uuid, p_dst_response_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/276_ff5_references.sql:941) |
| 107 | `app.copy_template_version_children(p_source_version_id uuid, p_target_version_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 108 | `app.copy_version_children(p_source_version_id uuid, p_target_version_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 109 | `app.decide_document_approval_core(p_version_id uuid, p_decision text, p_note text)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 110 | `app.department_belongs_to_commission(p_department_id uuid, p_commission_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER |
| 111 | `app.derive_capa_hospital()` | trigger body | **n** | trigger on public.capa_plan; suite-referenced (supabase/seed.sql:1700) |
| 112 | `app.draft_version_of_template(p_template_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 113 | `app.eligible_voters(p_case_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/254_ethics_e2_votes.sql:223) |
| 114 | `app.enqueue_notification(p_user_id uuid, p_commission_id uuid, p_kind text, p_milestone text, p_is_reminder boolean, p_entity_type text, p_entity_id uuid, p_title text, p_body text, p_dedup_key text)` | internal helper | **y** | 16 fn caller(s), 12 DEFINER; 4 caller runs as the INVOKER |
| 115 | `app.ensure_answer_rows(p_response_id uuid, p_item_ids uuid[], p_instance_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 116 | `app.ensure_matrix_answer_rows(p_response_id uuid, p_item_ids uuid[], p_instance_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 117 | `app.ensure_securable_resource_capa_action()` | trigger body | **n** | trigger on public.capa_action |
| 118 | `app.ensure_securable_resource_rca()` | trigger body | **n** | trigger on public.rca |
| 119 | `app.event_capa_fully_settled(p_event_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/143_capa.sql:254) |
| 120 | `app.event_current_custodian(p_event_id uuid, p_user_id uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/mutation/p0-authz-door-audit.sh:350) |
| 121 | `app.event_of_capa(p_capa_id uuid)` | internal helper | **n** | 7 fn caller(s), 7 DEFINER; suite-referenced (supabase/tests/341_dm5_s2_nsp_evidence_substrate.sql:255) |
| 122 | `app.event_of_rca(p_rca_id uuid)` | policy predicate + internal helper | **y** | RLS policy x6; 6 fn caller(s), 6 DEFINER |
| 123 | `app.evidence_label_of(p_kind text, p_artifact uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/283_accreditation_readiness_report.sql:5) |
| 124 | `app.evidence_status_of(p_kind text, p_artifact uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/278_accreditation_schema.sql:10) |
| 125 | `app.feature_enabled(p_key text)` | internal helper | **y** | 104 fn caller(s), 68 DEFINER; 12 caller runs as the INVOKER |
| 126 | `app.guard_action_item()` | trigger body | **n** | trigger on public.action_items; suite-referenced (supabase/tests/229_authz_m1_exclusion_durability.sql:549) |
| 127 | `app.guard_capa_child_lock()` | trigger body | **n** | trigger on public.capa_action, public.capa_action_evidence (+4); suite-referenced (supabase/tests/353_disposal_child_lock_siblings.sql:213) |
| 128 | `app.guard_capa_status()` | trigger body | **n** | trigger on public.capa_plan; suite-referenced (e2e/phase14d-capa.spec.ts:564) |
| 129 | `app.guard_case_correction_request_write()` | trigger body | **n** | trigger on public.case_correction_requests |
| 130 | `app.guard_case_narrative_frozen()` | trigger body | **n** | trigger on public.case_narratives; suite-referenced (supabase/seed.sql:1185) |
| 131 | `app.guard_case_narrative_type_coherent()` | trigger body | **n** | trigger on public.case_narratives; suite-referenced (supabase/tests/296_process_case_integrity.sql:197) |
| 132 | `app.guard_case_offered_outcome_coherent()` | trigger body | **n** | trigger on public.case_offered_outcomes |
| 133 | `app.guard_case_outcome_coherent()` | trigger body | **n** | trigger on public.cases |
| 134 | `app.guard_case_participant_role_key()` | trigger body | **n** | trigger on public.case_participant_roles |
| 135 | `app.guard_case_phase_blocks_referenced()` | trigger body | **n** | trigger on public.case_phases; suite-referenced (supabase/tests/296_process_case_integrity.sql:365) |
| 136 | `app.guard_case_phase_blocks_refs()` | trigger body | **n** | trigger on public.case_phases; suite-referenced (supabase/tests/296_process_case_integrity.sql:364) |
| 137 | `app.guard_case_phase_refs_coherent()` | trigger body | **n** | trigger on public.case_phases; suite-referenced (supabase/tests/296_process_case_integrity.sql:163) |
| 138 | `app.guard_case_phase_status()` | trigger body | **n** | trigger on public.case_phases; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:533) |
| 139 | `app.guard_case_reopening_write()` | trigger body | **n** | trigger on public.case_reopenings |
| 140 | `app.guard_case_result_link_coherent()` | trigger body | **n** | trigger on public.case_phase_allowed_results, public.case_phase_offered_results |
| 141 | `app.guard_case_status()` | trigger body | **n** | trigger on public.cases; suite-referenced (supabase/tests/100_dashboard.sql:222) |
| 142 | `app.guard_case_tag_assignment()` | trigger body | **n** | trigger on public.case_tag_assignments |
| 143 | `app.guard_case_visibility()` | trigger body | **n** | trigger on public.cases; suite-referenced (supabase/tests/307_commission_oversight.sql:11) |
| 144 | `app.guard_commission_oversight()` | trigger body | **n** | trigger on public.commissions; suite-referenced (supabase/tests/mutation/q1-quality-mutation-audit.sh:337) |
| 145 | `app.guard_controlled_document_status()` | trigger body | **n** | trigger on public.controlled_document_versions; suite-referenced (supabase/tests/330_dm3_controlled_documents.sql:349) |
| 146 | `app.guard_event_status()` | trigger body | **n** | trigger on public.patient_safety_event; suite-referenced (supabase/tests/341_dm5_s2_nsp_evidence_substrate.sql:163) |
| 147 | `app.guard_event_triage()` | trigger body | **n** | trigger on public.event_triage |
| 148 | `app.guard_frozen_approver_set()` | trigger body | **n** | trigger on public.document_approvals; suite-referenced (supabase/tests/252_authz_p0_isolation.sql:46) |
| 149 | `app.guard_interview_child_lock()` | trigger body | **n** | trigger on public.case_interview_interviewers, public.case_interview_subjects (+1); suite-referenced (e2e/dsr-disposal-child-lock-regression.spec.ts:189) |
| 150 | `app.guard_interview_links()` | trigger body | **n** | trigger on public.case_interviews; suite-referenced (supabase/seed.sql:1415) |
| 151 | `app.guard_interview_status()` | trigger body | **n** | trigger on public.case_interviews; suite-referenced (e2e/helpers/dsr-fixture.ts:102) |
| 152 | `app.guard_matrix_axis_code_immutable()` | trigger body | **n** | trigger on public.form_matrix_columns, public.form_matrix_rows |
| 153 | `app.guard_matrix_cell_coherent()` | trigger body | **n** | trigger on public.answer_matrix_cells |
| 154 | `app.guard_meeting_cases()` | trigger body | **n** | trigger on public.meeting_cases; suite-referenced (e2e/helpers/dsr-fixture.ts:57) |
| 155 | `app.guard_meeting_child_lock()` | trigger body | **n** | trigger on public.meeting_agenda_items, public.meeting_attendees (+2); suite-referenced (supabase/tests/243_authz_c5_reserved_session_tiers.sql:187) |
| 156 | `app.guard_meeting_status()` | trigger body | **n** | trigger on public.meetings; suite-referenced (supabase/tests/346_print_currency.sql:174) |
| 157 | `app.guard_narrative_revision_append_only()` | trigger body | **n** | trigger on public.case_narrative_revisions |
| 158 | `app.guard_phase_blocks_shape()` | trigger body | **n** | trigger on public.case_phases, public.process_template_phases |
| 159 | `app.guard_process_template_case_type()` | trigger body | **n** | trigger on public.process_template_versions |
| 160 | `app.guard_process_template_outcome()` | trigger body | **n** | trigger on public.process_template_outcomes |
| 161 | `app.guard_professional_linkage()` | trigger body | **n** | trigger on public.professional_profiles; suite-referenced (supabase/tests/255_ethics_e2_targeted.sql:96) |
| 162 | `app.guard_published_template_version()` | trigger body | **n** | trigger on public.process_template_versions; suite-referenced (supabase/tests/364_backfill_mapping_replay.sql:116) |
| 163 | `app.guard_rca_child_lock()` | trigger body | **n** | trigger on public.rca_evidence, public.rca_factors (+4); suite-referenced (supabase/tests/353_disposal_child_lock_siblings.sql:95) |
| 164 | `app.guard_rca_status()` | trigger body | **n** | trigger on public.rca |
| 165 | `app.guard_reference_coherent()` | trigger body | **n** | trigger on public.answer_references; suite-referenced (supabase/tests/276_ff5_references.sql:328) |
| 166 | `app.guard_referral_message()` | trigger body | **n** | trigger on public.referral_messages; suite-referenced (supabase/tests/mutation/w4-technical-director-referrals-audit.sh:89) |
| 167 | `app.guard_reserved_child_lock()` | trigger body | **n** | trigger on public.meeting_closed_session_item_readers, public.meeting_closed_session_items; suite-referenced (supabase/tests/351_meeting_disposal_redaction_set.sql:47) |
| 168 | `app.guard_response_active_print()` | trigger body | **n** | trigger on public.responses; suite-referenced (supabase/tests/312_printed_documents.sql:821) |
| 169 | `app.guard_risk_matrix_coherent()` | trigger body | **n** | trigger on public.answer_risk_matrix |
| 170 | `app.guard_submitted_selections()` | trigger body | **n** | trigger on public.answer_matrix_cells, public.answer_risk_matrix (+1); suite-referenced (supabase/tests/10_immutability.sql:103) |
| 171 | `app.guard_supersession_coherent()` | trigger body | **n** | trigger on public.responses; suite-referenced (supabase/tests/312_printed_documents.sql:1090) |
| 172 | `app.guard_template_narrative_type()` | trigger body | **n** | trigger on public.process_template_narratives |
| 173 | `app.guard_template_phase_form_coherent()` | trigger body | **n** | trigger on public.process_template_phases; suite-referenced (supabase/tests/296_process_case_integrity.sql:214) |
| 174 | `app.guard_template_phase_ruleset_content()` | trigger body | **n** | trigger on public.process_template_phases |
| 175 | `app.has_case_capability(p_case_id uuid, p_uid uuid, p_cap text)` | internal helper | **n** | 12 fn caller(s), 12 DEFINER; suite-referenced (supabase/tests/231_authz_m5_is_active_gate.sql:428) |
| 176 | `app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)` | internal helper | **n** | 17 fn caller(s), 17 DEFINER; suite-referenced (supabase/tests/224_memberships_collapse.sql:31) |
| 177 | `app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)` | internal helper | **n** | 7 fn caller(s), 7 DEFINER; suite-referenced (supabase/tests/319_act_case_caps_arm_divergence.sql:181) |
| 178 | `app.hospital_of_capa_action(p_action_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/341_dm5_s2_nsp_evidence_substrate.sql:254) |
| 179 | `app.hospital_of_commission(p_commission_id uuid)` | internal helper | **y** | 22 fn caller(s), 21 DEFINER; 1 caller runs as the INVOKER |
| 180 | `app.hospital_of_event(p_event_id uuid)` | internal helper | **n** | 14 fn caller(s), 14 DEFINER; suite-referenced (supabase/tests/196_capa_tenant_anchor.sql:131) |
| 181 | `app.hospital_of_referral(p_referral_id uuid)` | UNRESOLVED | **?** | NO reference found by any instrument — policy, trigger, constraint, fn-caller, `src/` or suite |
| 182 | `app.instance_answer_map(p_response_id uuid, p_group_instance_id uuid)` | internal helper | **y** | 4 fn caller(s), 3 DEFINER; 1 caller runs as the INVOKER |
| 183 | `app.instance_is_empty(p_response_id uuid, p_instance_id uuid)` | internal helper | **y** | 3 fn caller(s), 2 DEFINER; 1 caller runs as the INVOKER |
| 184 | `app.is_active(p_user_id uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 56 fn caller(s), 56 DEFINER |
| 185 | `app.is_admin()` | policy predicate + internal helper | **y** | RLS policy x26; 15 fn caller(s), 15 DEFINER |
| 186 | `app.is_admin_for(p_user_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/mutation/w4-technical-director-mutation-audit.sh:14) |
| 187 | `app.is_case_excluded(p_case_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x16; 15 fn caller(s), 15 DEFINER |
| 188 | `app.is_case_respondent(p_case_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 8 fn caller(s), 8 DEFINER |
| 189 | `app.is_document_approver_of(p_document_id uuid, p_uid uuid)` | policy predicate + internal helper | **y** | RLS policy x1; 1 fn caller(s), 1 DEFINER |
| 190 | `app.is_document_version_approver(p_version_id uuid, p_uid uuid)` | policy predicate | **y** | RLS policy x1 |
| 191 | `app.is_dpo_of(p_hospital_id uuid)` | policy predicate + internal helper | **y** | RLS policy x3; 8 fn caller(s), 8 DEFINER |
| 192 | `app.is_dpo_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/349_dsr_request_workflow.sql:144) |
| 193 | `app.is_entitled_document_approver(p_hospital uuid, p_user uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/320_act_expiry_and_acl_hardening.sql:153) |
| 194 | `app.is_hospital_admin_of(p_hospital_id uuid)` | policy predicate + internal helper | **y** | RLS policy x13; 10 fn caller(s), 10 DEFINER |
| 195 | `app.is_hospital_admin_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 7 fn caller(s), 7 DEFINER; suite-referenced (supabase/tests/313_printed_documents_meetings.sql:472) |
| 196 | `app.is_hospital_member_of(p_hospital_id uuid)` | policy predicate | **y** | RLS policy x2 |
| 197 | `app.is_member_of(p_commission_id uuid)` | policy predicate + internal helper | **y** | RLS policy x40; 10 fn caller(s), 10 DEFINER |
| 198 | `app.is_member_of_for(p_commission_id uuid, p_user_id uuid)` | internal helper | **y** | 33 fn caller(s), 31 DEFINER; 2 caller runs as the INVOKER |
| 199 | `app.is_nsp_coordinator_of(p_hospital_id uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/176_nsp_per_org_b_support.sql:200) |
| 200 | `app.is_nsp_coordinator_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/145_pqs_membership.sql:11) |
| 201 | `app.is_nsp_org_admin_of(p_org_id uuid)` | policy predicate + internal helper | **y** | RLS policy x3; 8 fn caller(s), 8 DEFINER |
| 202 | `app.is_nsp_org_admin_of_for(p_org_id uuid, p_user_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/189_nsp_per_hospital_isolation.sql:98) |
| 203 | `app.is_org_admin_of(p_org_id uuid)` | policy predicate + internal helper | **y** | RLS policy x19; 12 fn caller(s), 12 DEFINER |
| 204 | `app.is_org_admin_of_for(p_org_id uuid, p_user_id uuid)` | internal helper | **n** | 10 fn caller(s), 10 DEFINER; suite-referenced (supabase/tests/170_multitenancy_hierarchy.sql:125) |
| 205 | `app.is_org_level_admin_within(p_org_id uuid)` | policy predicate | **y** | RLS policy x1 |
| 206 | `app.is_org_member(p_org_id uuid)` | policy predicate | **y** | RLS policy x8 |
| 207 | `app.is_oversight_only_reader(p_case_id uuid, p_uid uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/356_case_caps_s8_administrativo_read.sql:543) |
| 208 | `app.is_pqs_member_of(p_hospital_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/152_patient_index.sql:421) |
| 209 | `app.is_pqs_member_of_any(p_user_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/320_act_expiry_and_acl_hardening.sql:177) |
| 210 | `app.is_pqs_member_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/145_pqs_membership.sql:11) |
| 211 | `app.is_pqs_operator_in_org(p_org_id uuid)` | policy predicate | **y** | RLS policy x1 |
| 212 | `app.is_pqs_operator_in_org_for(p_org_id uuid, p_user_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/320_act_expiry_and_acl_hardening.sql:178) |
| 213 | `app.is_pqs_operator_of(p_hospital_id uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 13 fn caller(s), 13 DEFINER |
| 214 | `app.is_pqs_operator_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 12 fn caller(s), 12 DEFINER; suite-referenced (supabase/tests/189_nsp_per_hospital_isolation.sql:91) |
| 215 | `app.is_pqs_writer_of(p_hospital_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/175_dropped_symbol_sweep.sql:18) |
| 216 | `app.is_quality_reviewer_in_org(p_org_id uuid)` | policy predicate | **y** | RLS policy x1 |
| 217 | `app.is_quality_reviewer_of(p_hospital_id uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 1 fn caller(s), 1 DEFINER |
| 218 | `app.is_quality_reviewer_of_for(p_hospital_id uuid, p_user_id uuid)` | internal helper | **n** | 3 fn caller(s), 3 DEFINER; suite-referenced (supabase/tests/311_oversight_readonly_perimeter.sql:368) |
| 219 | `app.is_recused_from_case(p_case_id uuid, p_uid uuid)` | internal helper | **n** | 5 fn caller(s), 5 DEFINER; suite-referenced (supabase/tests/368_printed_documents_cases.sql:148) |
| 220 | `app.is_signoff_deferral_open(p_response_id uuid)` | internal helper | **y** | 6 fn caller(s), 5 DEFINER; 1 caller runs as the INVOKER |
| 221 | `app.is_staff_admin_of(p_commission_id uuid)` | policy predicate + internal helper | **y** | RLS policy x63; 151 fn caller(s), 121 DEFINER; 30 caller runs as the INVOKER |
| 222 | `app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)` | policy predicate + internal helper | **y** | RLS policy x2; 27 fn caller(s), 27 DEFINER |
| 223 | `app.is_tenancy_admin_of(p_commission_id uuid)` | policy predicate + internal helper | **y** | RLS policy x55; 69 fn caller(s), 45 DEFINER; 24 caller runs as the INVOKER |
| 224 | `app.is_tenancy_admin_of_for(p_commission_id uuid, p_user_id uuid)` | internal helper | **n** | 8 fn caller(s), 8 DEFINER; suite-referenced (supabase/tests/170_multitenancy_hierarchy.sql:140) |
| 225 | `app.item_question_type(p_version_id uuid, p_question_key text)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 226 | `app.item_required_satisfied(p_response_id uuid, p_item_id uuid, p_item_type text, p_instance_id uuid)` | internal helper | **y** | 2 fn caller(s), 1 DEFINER; 1 caller runs as the INVOKER |
| 227 | `app.latest_published_version(p_form_id uuid)` | internal helper | **n** | 8 fn caller(s), 7 DEFINER; suite-referenced (supabase/tests/320_act_expiry_and_acl_hardening.sql:205) |
| 228 | `app.matrix_cells_by_item(p_response_id uuid, p_instance_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/276_ff5_references.sql:1208) |
| 229 | `app.member_can(p_commission_id uuid, p_capability text)` | policy predicate + internal helper | **y** | RLS policy x3; 10 fn caller(s), 9 DEFINER; 1 caller runs as the INVOKER |
| 230 | `app.member_can_for(p_commission_id uuid, p_capability text, p_user_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/356_case_caps_s8_administrativo_read.sql:18) |
| 231 | `app.mint_capa_code()` | trigger body | **n** | trigger on public.capa_plan |
| 232 | `app.mint_case_number()` | trigger body | **n** | trigger on public.cases; suite-referenced (e2e/charters-cadence.spec.ts:23) |
| 233 | `app.mint_controlled_document_code()` | trigger body | **n** | trigger on public.controlled_documents |
| 234 | `app.mint_event_code()` | trigger body | **n** | trigger on public.patient_safety_event |
| 235 | `app.mint_indicator_code()` | trigger body | **n** | trigger on public.indicators |
| 236 | `app.mint_interview_number()` | trigger body | **n** | trigger on public.case_interviews |
| 237 | `app.mint_meeting_number()` | trigger body | **n** | trigger on public.meetings |
| 238 | `app.org_of_commission(p_commission_id uuid)` | internal helper | **y** | 14 fn caller(s), 12 DEFINER; 2 caller runs as the INVOKER |
| 239 | `app.org_of_hospital(p_hospital_id uuid)` | policy predicate + internal helper | **y** | RLS policy x5; 26 fn caller(s), 26 DEFINER |
| 240 | `app.pending_staff_signoffs(p_response_id uuid)` | internal helper | **y** | 7 fn caller(s), 5 DEFINER; 2 caller runs as the INVOKER |
| 241 | `app.published_version_of_form(p_form_id uuid)` | internal helper | **y** | 4 fn caller(s), 3 DEFINER; 1 caller runs as the INVOKER |
| 242 | `app.published_version_of_template(p_template_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER |
| 243 | `app.rca_bump_in_progress(p_rca_id uuid)` | internal helper | **n** | 7 fn caller(s), 7 DEFINER |
| 244 | `app.recompute_case_status(p_case_id uuid)` | internal helper | **n** | 2 fn caller(s), 2 DEFINER; suite-referenced (supabase/tests/222_status_keys_g6.sql:62) |
| 245 | `app.recompute_template_phase_offered_results(p_phase_id uuid)` | internal helper | **y** | 3 fn caller(s), 1 DEFINER; 2 caller runs as the INVOKER |
| 246 | `app.references_by_item(p_response_id uuid, p_instance_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/276_ff5_references.sql:1118) |
| 247 | `app.referral_target_analyst(p_referral_id uuid, p_uid uuid)` | internal helper | **n** | 4 fn caller(s), 4 DEFINER; suite-referenced (supabase/tests/231_authz_m5_is_active_gate.sql:446) |
| 248 | `app.resolve_notifications_for(p_entity_type text, p_entity_id uuid)` | internal helper | **y** | 4 fn caller(s), 3 DEFINER; 1 caller runs as the INVOKER |
| 249 | `app.response_required_complete(p_response_id uuid)` | internal helper | **y** | 3 fn caller(s), 2 DEFINER; 1 caller runs as the INVOKER |
| 250 | `app.response_validation_errors(p_response_id uuid)` | internal helper | **y** | 2 fn caller(s), 0 DEFINER; 2 caller runs as the INVOKER |
| 251 | `app.risk_matrix_by_item(p_response_id uuid, p_instance_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/276_ff5_references.sql:1210) |
| 252 | `app.save_matrix_answers(p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid)` | internal helper | **y** | 2 fn caller(s), 0 DEFINER; 2 caller runs as the INVOKER |
| 253 | `app.save_reference_answers(p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid)` | internal helper | **y** | 2 fn caller(s), 0 DEFINER; 2 caller runs as the INVOKER |
| 254 | `app.save_risk_matrix_answers(p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid)` | internal helper | **y** | 2 fn caller(s), 0 DEFINER; 2 caller runs as the INVOKER |
| 255 | `app.seed_default_member_titles(p_commission_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER |
| 256 | `app.seed_meetings_on_commission_insert()` | trigger body | **n** | trigger on public.commissions |
| 257 | `app.seed_member_titles_on_commission_insert()` | trigger body | **n** | trigger on public.commissions; suite-referenced (supabase/tests/291_membership_invariants.sql:193) |
| 258 | `app.signoff_target(p_response_id uuid, p_section_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 259 | `app.storage_upload_reserved(p_bucket text, p_name text, p_uid uuid)` | policy predicate | **y** | RLS policy x2 |
| 260 | `app.submitted_form_responses(p_form_id uuid)` | internal helper | **n** | 10 fn caller(s), 10 DEFINER; suite-referenced (supabase/tests/225_supersession.sql:25) |
| 261 | `app.touch_referral_note_updated_at()` | trigger body | **n** | trigger on public.referral_internal_notes |
| 262 | `app.trg_attendee_roster()` | trigger body | **n** | trigger on public.meeting_attendees |
| 263 | `app.trg_audit_accreditation_frameworks()` | trigger body | **n** | trigger on public.accreditation_frameworks |
| 264 | `app.trg_audit_accreditation_standards()` | trigger body | **n** | trigger on public.accreditation_standards |
| 265 | `app.trg_audit_action_item_checklists()` | trigger body | **n** | trigger on public.action_item_checklists |
| 266 | `app.trg_audit_action_item_reminders()` | trigger body | **n** | trigger on public.action_item_reminders |
| 267 | `app.trg_audit_action_item_status_history()` | trigger body | **n** | trigger on public.action_item_status_history |
| 268 | `app.trg_audit_action_item_updates()` | trigger body | **n** | trigger on public.action_item_updates |
| 269 | `app.trg_audit_action_items()` | trigger body | **n** | trigger on public.action_items |
| 270 | `app.trg_audit_administrativo()` | trigger body | **n** | trigger on public.commission_administrativos |
| 271 | `app.trg_audit_administrativo_capabilities()` | trigger body | **n** | trigger on public.commission_administrativo_capabilities |
| 272 | `app.trg_audit_capa_effectiveness()` | trigger body | **n** | trigger on public.capa_effectiveness; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:24) |
| 273 | `app.trg_audit_capa_plan()` | trigger body | **n** | trigger on public.capa_plan; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:24) |
| 274 | `app.trg_audit_case_access()` | trigger body | **n** | trigger on public.case_access_grants |
| 275 | `app.trg_audit_case_child()` | trigger body | **n** | trigger on public.case_custom_field_values, public.case_offered_outcomes (+2); suite-referenced (supabase/tests/296_process_case_integrity.sql:503) |
| 276 | `app.trg_audit_case_narrative_types()` | trigger body | **n** | trigger on public.case_narrative_types |
| 277 | `app.trg_audit_case_narratives()` | trigger body | **n** | trigger on public.case_narratives; suite-referenced (supabase/tests/362_patient_mode_and_narrative_rename.sql:420) |
| 278 | `app.trg_audit_case_phases()` | trigger body | **n** | trigger on public.case_phases; suite-referenced (supabase/tests/296_process_case_integrity.sql:501) |
| 279 | `app.trg_audit_cases()` | trigger body | **n** | trigger on public.cases; suite-referenced (supabase/tests/296_process_case_integrity.sql:486) |
| 280 | `app.trg_audit_commissions()` | trigger body | **n** | trigger on public.commissions |
| 281 | `app.trg_audit_controlled_document_versions()` | trigger body | **n** | trigger on public.controlled_document_versions |
| 282 | `app.trg_audit_controlled_documents()` | trigger body | **n** | trigger on public.controlled_documents |
| 283 | `app.trg_audit_document_approvals()` | trigger body | **n** | trigger on public.document_approvals |
| 284 | `app.trg_audit_event_custody()` | trigger body | **n** | trigger on public.event_custody; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:26) |
| 285 | `app.trg_audit_event_patient()` | trigger body | **n** | trigger on public.event_patient; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:26) |
| 286 | `app.trg_audit_event_triage()` | trigger body | **n** | trigger on public.event_triage; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:27) |
| 287 | `app.trg_audit_evidence_links()` | trigger body | **n** | trigger on public.evidence_links |
| 288 | `app.trg_audit_form_items()` | trigger body | **n** | trigger on public.form_items |
| 289 | `app.trg_audit_form_sections()` | trigger body | **n** | trigger on public.form_sections |
| 290 | `app.trg_audit_form_versions()` | trigger body | **n** | trigger on public.form_versions |
| 291 | `app.trg_audit_forms()` | trigger body | **n** | trigger on public.forms |
| 292 | `app.trg_audit_hospital_updated()` | trigger body | **n** | trigger on public.hospitals |
| 293 | `app.trg_audit_indicator_measurements()` | trigger body | **n** | trigger on public.indicator_measurements |
| 294 | `app.trg_audit_indicators()` | trigger body | **n** | trigger on public.indicators |
| 295 | `app.trg_audit_interviews()` | trigger body | **n** | trigger on public.case_interviews |
| 296 | `app.trg_audit_meeting_signatures()` | trigger body | **n** | trigger on public.meeting_signatures |
| 297 | `app.trg_audit_meetings()` | trigger body | **n** | trigger on public.meetings |
| 298 | `app.trg_audit_memberships()` | trigger body | **n** | trigger on public.memberships; suite-referenced (supabase/tests/291_membership_invariants.sql:89) |
| 299 | `app.trg_audit_patient_identifiers()` | trigger body | **n** | trigger on public.patient_identifiers; suite-referenced (supabase/tests/357_creation_scoped_case_phi.sql:220) |
| 300 | `app.trg_audit_rca()` | trigger body | **n** | trigger on public.rca; suite-referenced (supabase/tests/317_act_capa_audit_scope.sql:27) |
| 301 | `app.trg_audit_responses()` | trigger body | **n** | trigger on public.responses |
| 302 | `app.trg_audit_safety_event()` | trigger body | **n** | trigger on public.patient_safety_event |
| 303 | `app.trg_audit_signoffs()` | trigger body | **n** | trigger on public.response_section_signoffs |
| 304 | `app.trg_audit_standard_assessments()` | trigger body | **n** | trigger on public.standard_assessments |
| 305 | `app.trg_audit_standard_ownerships()` | trigger body | **n** | trigger on public.standard_ownerships; suite-referenced (supabase/tests/372_audit_org_leg_hospital_tier.sql:39) |
| 306 | `app.trg_audit_template_narratives()` | trigger body | **n** | trigger on public.process_template_narratives |
| 307 | `app.trg_audit_template_versions()` | trigger body | **n** | trigger on public.process_template_versions |
| 308 | `app.trg_complete_phase_on_signoff()` | trigger body | **n** | trigger on public.response_section_signoffs; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:655) |
| 309 | `app.trg_meetings_roster()` | trigger body | **n** | trigger on public.meetings; suite-referenced (supabase/tests/313_printed_documents_meetings.sql:53) |
| 310 | `app.trg_pin_respondent_retention()` | trigger body | **n** | trigger on public.case_decisions; suite-referenced (supabase/tests/321_eth_e4_participant_seating.sql:256) |
| 311 | `app.trg_recompute_case_status()` | trigger body | **n** | trigger on public.case_phases |
| 312 | `app.trg_xref_maintain_patient_identifiers()` | trigger body | **n** | trigger on public.patient_identifiers; suite-referenced (e2e/dsr-slice3-adjudication.spec.ts:220) |
| 313 | `app.validate_group_layout(p_form_version_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 314 | `app.validate_template_allowed_results(p_template_version_id uuid, p_position integer, p_allowed_result_ids jsonb)` | internal helper | **y** | 3 fn caller(s), 1 DEFINER; 2 caller runs as the INVOKER |
| 315 | `app.validate_template_phase_blocks(p_template_version_id uuid, p_position integer, p_blocks integer[])` | internal helper | **y** | 5 fn caller(s), 0 DEFINER; 5 caller runs as the INVOKER |
| 316 | `app.validate_template_phase_result(p_template_version_id uuid, p_position integer)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 317 | `app.validate_template_recommend_when(p_template_version_id uuid, p_position integer, p_recommend_when jsonb)` | internal helper | **y** | 6 fn caller(s), 1 DEFINER; 5 caller runs as the INVOKER |
| 318 | `app.validate_template_result_ruleset(p_template_version_id uuid, p_position integer, p_result_ruleset jsonb)` | internal helper | **y** | 4 fn caller(s), 2 DEFINER; 2 caller runs as the INVOKER |
| 319 | `app.version_has_input_key(p_version_id uuid, p_question_key text)` | internal helper | **y** | 3 fn caller(s), 2 DEFINER; 1 caller runs as the INVOKER |
| 320 | `app.version_has_option_code(p_version_id uuid, p_question_key text, p_code text)` | internal helper | **y** | 3 fn caller(s), 1 DEFINER; 1 caller runs as the INVOKER |
| 321 | `public.accept_referral(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:369 |
| 322 | `public.acknowledge_ethics_notification(p_notification_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:505 |
| 323 | `public.acknowledge_event(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:114 |
| 324 | `public.action_items_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/action-items.ts:178); no code path found |
| 325 | `public.activate_phase(p_case_phase_id uuid, p_assigned_to uuid, p_due_date date)` | command door + internal helper | **y** | .rpc() @ src/lib/cases/actions.ts:735; 1 fn caller(s), 1 DEFINER |
| 326 | `public.add_ad_hoc_narrative(p_case_id uuid, p_narrative_type_id uuid, p_new_type_label text, p_title text, p_instructions text, p_assigned_to uuid)` | command door | **y** | .rpc() @ src/lib/case-narratives/actions.ts:742 |
| 327 | `public.add_capa_action(p_capa_id uuid, p_title text, p_owner text, p_assignee_user_id uuid, p_due_date date, p_action_strength text, p_success_measure text, p_root_cause_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:144 |
| 328 | `public.add_capa_action_evidence(p_action_id uuid, p_kind text, p_title text, p_document_id uuid, p_external_url text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:530 |
| 329 | `public.add_capa_action_task(p_action_id uuid, p_description text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:239 |
| 330 | `public.add_capa_measure(p_capa_id uuid, p_name text, p_target text, p_definition text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:304 |
| 331 | `public.add_case_participant(p_case_id uuid, p_participant_id uuid, p_role_id uuid, p_is_primary_subject boolean, p_involvement_summary text)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:286 |
| 332 | `public.add_ethics_allegation(p_case_id uuid, p_category_id uuid, p_description_md text, p_severity text, p_alleged_event_date date)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:274 |
| 333 | `public.add_interview_interviewer(p_interview_id uuid, p_user_id uuid, p_external_name text, p_external_org text, p_role text, p_note text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:609 |
| 334 | `public.add_interview_subject(p_interview_id uuid, p_user_id uuid, p_external_name text, p_clinical_role text, p_external_org text, p_note text, p_relationship_to_case text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:526 |
| 335 | `public.add_pqs_member(p_hospital_id uuid, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/actions.ts:71 |
| 336 | `public.add_rca_evidence(p_rca_id uuid, p_kind text, p_title text, p_document_id uuid, p_external_url text, p_citation_target text, p_cited_entity_id uuid, p_citation_label text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:630 |
| 337 | `public.add_rca_factor(p_rca_id uuid, p_category text, p_text text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:279 |
| 338 | `public.add_rca_member(p_rca_id uuid, p_role text, p_user_id uuid, p_external_name text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:134 |
| 339 | `public.add_rca_root_cause(p_rca_id uuid, p_text text, p_category text, p_classification text, p_type text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:390 |
| 340 | `public.add_rca_timeline_entry(p_rca_id uuid, p_occurred_at timestamp with time zone, p_description text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:188 |
| 341 | `public.add_referral_shared_item(p_referral_id uuid, p_kind text, p_source_narrative_id uuid, p_source_document_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:235 |
| 342 | `public.add_reserved_item(p_session_id uuid, p_case_id uuid, p_substance text, p_decision text, p_withdrawals text, p_quorum_met boolean, p_reader_uids uuid[])` | command door | **y** | .rpc() @ src/lib/meetings/actions.ts:1445 |
| 343 | `public.adjudicate_dsr_request(p_request_id uuid, p_outcome text, p_outcome_basis text, p_legal_consultation_ref text, p_dispose_meeting_ids uuid[])` | command door | **y** | .rpc() @ src/lib/dsr/actions.ts:258 |
| 344 | `public.advance_capa_action(p_action_id uuid, p_status text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:204 |
| 345 | `public.advance_committee_action_item(p_id uuid, p_to_status_id uuid, p_comment text)` | command door + internal helper | **y** | .rpc() @ src/lib/cases/action-items-actions.ts:351; 1 fn caller(s), 1 DEFINER |
| 346 | `public.affiliate_person(p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text)` | command door | **y** | .rpc() @ src/lib/affiliations/actions.ts:214 |
| 347 | `public.affiliate_person_to_org(p_user uuid, p_organization uuid, p_started_on date)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (scripts/door-sweep-cases.sh:251) |
| 348 | `public.apply_minutes_review(p_job_id uuid)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:316 |
| 349 | `public.appoint_administrativo(p_commission_id uuid, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/members/actions.ts:328 |
| 350 | `public.appoint_hospital_dpo(p_hospital_id uuid, p_user_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/349_dsr_request_workflow.sql:25) |
| 351 | `public.appoint_technical_director(p_hospital uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:581 |
| 352 | `public.approve_correction(p_request_id uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:262 |
| 353 | `public.approve_document(p_version_id uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:572 |
| 354 | `public.archive_case_assignment_role(p_role_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:678 |
| 355 | `public.archive_ethics_allegation_category(p_category_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:348 |
| 356 | `public.archive_ethics_sanction_type(p_type_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/290_authz_never_called_door_floor.sql:13) |
| 357 | `public.archive_event_type(p_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:169 |
| 358 | `public.archive_indicator(p_id uuid)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:286 |
| 359 | `public.archive_sentinel_criterion(p_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:230 |
| 360 | `public.assign_case_tag(p_case_id uuid, p_tag_id uuid)` | command door | **y** | .rpc() @ src/lib/cases/tags-actions.ts:240 |
| 361 | `public.assign_ethics_remediation(p_decision_id uuid, p_title text, p_description text, p_assigned_to uuid, p_due_date date)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/290_authz_never_called_door_floor.sql:13) |
| 362 | `public.assign_hospital_admin(p_hospital uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:320 |
| 363 | `public.assign_member_title(p_member_id uuid, p_title_id uuid)` | command door | **y** | .rpc() @ src/lib/commissions/titles-actions.ts:124 |
| 364 | `public.assign_narrative(p_narrative uuid, p_assignee uuid)` | command door + internal helper | **y** | .rpc() @ src/lib/case-narratives/actions.ts:800; 1 fn caller(s), 1 DEFINER |
| 365 | `public.assign_nsp_coordinator(p_hospital uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:238 |
| 366 | `public.assign_nsp_org_admin(p_org uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:385 |
| 367 | `public.assign_org_admin(p_org uuid, p_user uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/190_membership_lockdown.sql:331) |
| 368 | `public.assign_referral_internal_note(p_note_id uuid, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:919 |
| 369 | `public.assign_referral_reviewer(p_referral_id uuid, p_commission_id uuid, p_assignee_user_id uuid, p_assignment_role text, p_due_at timestamp with time zone)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:709 |
| 370 | `public.assume_role(p_role platform_role)` | command door | **y** | .rpc() @ src/lib/role-selection/actions.ts:53 |
| 371 | `public.attach_controlled_document_version_file(p_version_id uuid, p_core_version_id uuid, p_summary_of_changes_md text, p_expiry_date date)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:423 |
| 372 | `public.attest_dsr_task(p_task_id uuid, p_reviewer_name text, p_redactions integer, p_note text)` | command door | **y** | .rpc() @ src/lib/dsr/actions.ts:311 |
| 373 | `public.audit_trail_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/audit.ts:702); no code path found |
| 374 | `public.begin_document_upload(p_resource_type text, p_resource_id uuid, p_title text, p_description text, p_confidentiality_level text, p_document_id uuid, p_declared_file_name text, p_declared_mime text, p_declared_size bigint, p_kind text, p_occurred_on date)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:112 |
| 375 | `public.bulk_create_cases(p_template_id uuid, p_deadline date, p_phase_scope text, p_rows jsonb)` | command door | **y** | .rpc() @ src/lib/cases/bulk-actions.ts:154 |
| 376 | `public.can_dispose_referral_phi(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1571 |
| 377 | `public.cancel_capa_plan(p_capa_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:112 |
| 378 | `public.cancel_ethics_notification(p_notification_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:519 |
| 379 | `public.cancel_event(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:212 |
| 380 | `public.cancel_interview(p_interview_id uuid)` | command door | **y** | string-literal indirection @ src/lib/interviews/actions.ts:441 |
| 381 | `public.cancel_minutes_job(p_job_id uuid)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:135 |
| 382 | `public.cancel_referral_assignment(p_assignment_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:758 |
| 383 | `public.cancel_session(p_session_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:402 |
| 384 | `public.capa_kpis()` | command door | **y** | .rpc() @ src/lib/queries/capa.ts:452 |
| 385 | `public.capa_viewer_can_manage(p_capa_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/capa.ts:149 |
| 386 | `public.case_action_items_kpis(p_commission_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/case-action-items.ts:164 |
| 387 | `public.case_narratives_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/case-narratives/actions.ts:348); no code path found |
| 388 | `public.case_patient_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/cases.ts:2136); no code path found |
| 389 | `public.case_phase_results_enabled()` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:2317 |
| 390 | `public.case_tag_report(p_commission_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/case-tags.ts:135 |
| 391 | `public.case_viewer_capabilities(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:736 |
| 392 | `public.cases_extras_enabled()` | command door | **y** | .rpc() @ src/lib/cases/extras-gate.ts:13 |
| 393 | `public.cast_case_vote(p_decision_id uuid, p_vote text, p_rationale_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:434 |
| 394 | `public.clone_framework(p_framework uuid, p_commission uuid)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:241 |
| 395 | `public.close_capa_plan(p_capa_id uuid, p_lessons_learned_md text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:98 |
| 396 | `public.close_dsr_request(p_request_id uuid, p_outcome text, p_outcome_basis text, p_legal_consultation_ref text)` | command door | **y** | .rpc() @ src/lib/dsr/actions.ts:180 |
| 397 | `public.commission_cadence_overview()` | command door | **y** | .rpc() @ src/lib/queries/charters.ts:111 |
| 398 | `public.commission_derive_organization_id()` | trigger body | **n** | trigger on public.commissions |
| 399 | `public.commission_overview()` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:712 |
| 400 | `public.complete_capa_action(p_action_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:218 |
| 401 | `public.complete_committee_action_item(p_id uuid)` | command door | **y** | .rpc() @ src/lib/cases/action-items-actions.ts:377 |
| 402 | `public.complete_dsr_task(p_task_id uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/dsr/actions.ts:140 |
| 403 | `public.complete_ethics_hearing(p_hearing_id uuid, p_summary_md text, p_outcome_md text, p_respondent_present boolean, p_complainant_present boolean, p_legal_representative_present boolean)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:562 |
| 404 | `public.complete_rca(p_rca_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:100 |
| 405 | `public.complete_session(p_session_id uuid, p_actual_end timestamp with time zone)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:380 |
| 406 | `public.compute_derived_measurement(p_indicator uuid, p_period_label text, p_denominator numeric, p_period_start date, p_period_end date)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:398 |
| 407 | `public.conclude_interview(p_interview_id uuid)` | command door | **y** | string-literal indirection @ src/lib/interviews/actions.ts:441 |
| 408 | `public.conclude_meeting(p_meeting_id uuid, p_held_at timestamp with time zone, p_held_end timestamp with time zone)` | command door | **y** | string-literal indirection @ src/lib/meetings/actions.ts:258 |
| 409 | `public.conclude_narrative(p_narrative uuid)` | command door | **y** | .rpc() @ src/lib/case-narratives/actions.ts:895 |
| 410 | `public.conclude_referral(p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:617 |
| 411 | `public.conclude_referral_internal_note(p_note_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:959 |
| 412 | `public.confirm_triage(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:87 |
| 413 | `public.count_open_cases_for_board(p_commission_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:1697 |
| 414 | `public.create_case(p_commission_id uuid, p_label text, p_patient_enabled boolean, p_outcome_ids uuid[], p_department_id uuid, p_department_other text, p_case_type_id uuid, p_patient jsonb)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:601 |
| 415 | `public.create_case_assignment_role(p_org uuid, p_key text, p_display_name text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:663 |
| 416 | `public.create_case_decision(p_case_id uuid, p_decision_type text, p_summary_md text, p_rationale_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:370 |
| 417 | `public.create_case_from_template(p_template_id uuid, p_label text, p_department_id uuid, p_department_other text, p_case_type_id uuid, p_custom_fields jsonb, p_patient jsonb)` | command door + internal helper | **y** | .rpc() @ src/lib/cases/actions.ts:524; 1 fn caller(s), 1 DEFINER |
| 418 | `public.create_committee_action_item(p_commission uuid, p_source_type text, p_meeting_id uuid, p_agenda_item_id uuid, p_case_id uuid, p_title text, p_description text, p_assigned_to uuid, p_urgency_id uuid, p_due_date date, p_source_case_phase_id uuid, p_visibility_scope text)` | command door + internal helper | **y** | .rpc() @ src/lib/action-items/actions.ts:121; 2 fn caller(s), 2 DEFINER |
| 419 | `public.create_committee_action_item_checklist(p_action_item_id uuid, p_title text, p_sort_order integer)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:182 |
| 420 | `public.create_committee_action_item_reminder(p_action_item_id uuid, p_reminder_type text, p_offset_days integer)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:98 |
| 421 | `public.create_committee_action_item_update(p_action_item_id uuid, p_update_type text, p_body text)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:157 |
| 422 | `public.create_controlled_document(p_commission uuid, p_title text, p_doc_type text, p_review_cycle_months integer, p_category text, p_tags text[], p_description text)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:245 |
| 423 | `public.create_dsr_request(p_hospital_id uuid, p_mrn text, p_file_ref text, p_encounter text, p_due_days integer)` | command door | **y** | .rpc() @ src/lib/dsr/actions.ts:69 |
| 424 | `public.create_ethics_allegation_category(p_org uuid, p_key text, p_display_name text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:334 |
| 425 | `public.create_ethics_sanction_type(p_org uuid, p_key text, p_display_name text)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/290_authz_never_called_door_floor.sql:103) |
| 426 | `public.create_event_type(p_key text, p_label text, p_description text, p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:122 |
| 427 | `public.create_external_participant(p_org uuid, p_type text, p_display_name text)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:390 |
| 428 | `public.create_framework(p_key text, p_name text, p_owner_commission uuid, p_version text, p_description text)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:163 |
| 429 | `public.create_indicator(p_commission uuid, p_name text, p_kind text, p_direction text, p_data_source text, p_frequency text, p_target_comparator text, p_target_value numeric, p_numerator_label text, p_denominator_label text, p_unit text, p_description_md text, p_lower_warn numeric, p_upper_warn numeric, p_derived_config jsonb)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:214 |
| 430 | `public.create_interview(p_case_id uuid, p_title text, p_case_phase_id uuid, p_interview_category text, p_confidentiality_level text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:201 |
| 431 | `public.create_minutes_job(p_meeting_id uuid, p_filename text)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:115 |
| 432 | `public.create_professional_profile(p_org uuid, p_full_name text, p_professional_type text, p_license_number text, p_license_region text, p_specialty text, p_affiliation_status text, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:441 |
| 433 | `public.create_referral_draft(p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean, p_description_md text, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone, p_parent_referral_id uuid, p_target_hospital_id uuid)` | command door + internal helper | **y** | .rpc() @ src/lib/referrals/actions.ts:119; 1 fn caller(s), 1 DEFINER |
| 434 | `public.create_referral_internal_note(p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_kind text, p_assigned_to uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:851 |
| 435 | `public.create_referral_requested_action(p_key text, p_label text, p_description text, p_color_token text, p_position integer)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1303 |
| 436 | `public.create_sentinel_criterion(p_key text, p_label text, p_description text, p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:183 |
| 437 | `public.dashboard_completion_by_member(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:406 |
| 438 | `public.dashboard_distributions(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:403 |
| 439 | `public.dashboard_entity_references(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:413 |
| 440 | `public.dashboard_export_rows(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:778 |
| 441 | `public.dashboard_form_totals(p_commission_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:360 |
| 442 | `public.dashboard_free_text(p_form_id uuid, p_from date, p_to date, p_limit integer)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:404 |
| 443 | `public.dashboard_matrix_cells(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:409 |
| 444 | `public.dashboard_risk_scores(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:410 |
| 445 | `public.dashboard_submissions_over_time(p_form_id uuid, p_from date, p_to date)` | command door | **y** | .rpc() @ src/lib/queries/dashboard.ts:405 |
| 446 | `public.decide_admissibility(p_case_id uuid, p_status text, p_rationale_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:249 |
| 447 | `public.declare_conflict(p_case_id uuid, p_conflict_type text, p_description_md text)` | command door | **y** | .rpc() @ src/lib/case-recusals/actions.ts:106 |
| 448 | `public.decline_referral(p_referral_id uuid, p_note text, p_decline_reason_code text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:386 |
| 449 | `public.delete_ad_hoc_case_narrative(p_narrative_id uuid)` | command door | **y** | .rpc() @ src/lib/case-narratives/actions.ts:928 |
| 450 | `public.delete_ad_hoc_case_phase(p_phase_id uuid)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:1151 |
| 451 | `public.delete_block_library_entry(p_library_entry_id uuid)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2596 |
| 452 | `public.delete_capa_action_evidence(p_evidence_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:281 |
| 453 | `public.delete_committee_action_item(p_id uuid)` | command door | **y** | .rpc() @ src/lib/cases/action-items-actions.ts:313 |
| 454 | `public.delete_committee_action_item_checklist(p_id uuid)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:239 |
| 455 | `public.delete_committee_action_item_reminder(p_id uuid)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:134 |
| 456 | `public.delete_rca_evidence(p_evidence_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:258 |
| 457 | `public.delete_standard(p_standard uuid)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:302 |
| 458 | `public.dispose_case_phi(p_case_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:1073 |
| 459 | `public.dispose_event_phi(p_event_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:235 |
| 460 | `public.dispose_meeting_minutes(p_meeting_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/meetings/actions.ts:496 |
| 461 | `public.dispose_referral_phi(p_referral_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1158 |
| 462 | `public.document_delete_affordances(p_document_ids uuid[])` | command door | **y** | .rpc() @ src/lib/queries/documents.ts:220 |
| 463 | `public.documents_due_for_review(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/controlled-documents.ts:488 |
| 464 | `public.end_affiliation(p_user uuid, p_hospital uuid, p_ended_on date)` | command door + internal helper | **y** | .rpc() @ src/lib/affiliations/actions.ts:328; 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 465 | `public.end_org_affiliation(p_user uuid, p_organization uuid, p_ended_on date)` | command door | **y** | .rpc() @ src/lib/affiliations/actions.ts:376 |
| 466 | `public.ensure_professional_participant(p_profile_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:277 |
| 467 | `public.evidence_candidates(p_commission uuid, p_kind text, p_query text)` | command door | **y** | .rpc() @ src/lib/queries/accreditation.ts:345 |
| 468 | `public.file_correction_request(p_kind text, p_case_phase_id uuid, p_case_narrative_id uuid, p_reason text, p_classification text, p_permitted_corrector uuid)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:171 |
| 469 | `public.finalize_document_upload(p_upload_session_id uuid)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:172 |
| 470 | `public.form_item_options_parent_is_choice()` | trigger body | **n** | trigger on public.form_item_options |
| 471 | `public.form_item_options_sync_version()` | trigger body | **n** | trigger on public.form_item_options |
| 472 | `public.form_items_sync_version()` | trigger body | **n** | trigger on public.form_items |
| 473 | `public.get_case_detail(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:1731 |
| 474 | `public.get_case_meeting_links(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/case-timeline.ts:187 |
| 475 | `public.get_case_patient(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:2131 |
| 476 | `public.get_case_patients(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:2114 |
| 477 | `public.get_case_professional(p_participant_id uuid)` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/cases.ts:1856); no code path found |
| 478 | `public.get_ethics_case_procedure(p_case_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/ethics.ts:422 |
| 479 | `public.get_event_patient(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/safety-events.ts:296 |
| 480 | `public.get_feature_flags()` | command door | **y** | .rpc() @ src/lib/queries/feature-flags.ts:159 |
| 481 | `public.get_meeting_agenda_items(p_meeting_id uuid)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/context.ts:118 |
| 482 | `public.get_meeting_cases(p_meeting_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/meetings.ts:843 |
| 483 | `public.get_member_overview(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/overview.ts:130 |
| 484 | `public.get_own_person_record()` | command door | **y** | .rpc() @ src/lib/queries/own-person.ts:60 |
| 485 | `public.get_participant_patient(p_participant_id uuid)` | command door + internal helper | **y** | .rpc() @ src/lib/queries/cases.ts:2078; 1 fn caller(s), 1 DEFINER |
| 486 | `public.get_patient_trajectory_for_entity(p_module text, p_entity_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/patient-index.ts:237 |
| 487 | `public.get_referral_case_access_summary(p_referral_id uuid, p_commission_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1025 |
| 488 | `public.get_referral_detail(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:667 |
| 489 | `public.get_referral_patient(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1073 |
| 490 | `public.get_reserved_session_items(p_meeting_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/meetings.ts:1062 |
| 491 | `public.get_response_for_signoff(p_response_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/signoffs.ts:373 |
| 492 | `public.get_standard_assessment(p_commission uuid, p_standard uuid)` | command door | **y** | .rpc() @ src/lib/queries/accreditation.ts:399 |
| 493 | `public.grant_case_access(p_case uuid, p_user uuid, p_level text, p_expires_at timestamp with time zone, p_reason text, p_read_standard_phi boolean, p_read_restricted_phi boolean)` | command door | **y** | .rpc() @ src/lib/case-access/actions.ts:177 |
| 494 | `public.grant_member_capability(p_commission_id uuid, p_user_id uuid, p_capability text)` | command door | **y** | .rpc() @ src/lib/members/actions.ts:382 |
| 495 | `public.grant_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid, p_expires_at timestamp with time zone)` | command door + internal helper | **y** | .rpc() @ src/lib/admin/actions.ts:285; 5 fn caller(s), 5 DEFINER |
| 496 | `public.guard_default_section_delete()` | trigger body | **n** | trigger on public.form_sections |
| 497 | `public.guard_profile_privileged_columns()` | trigger body | **n** | trigger on public.profiles; suite-referenced (supabase/tests/188_hospital_user_mgmt.sql:124) |
| 498 | `public.guard_published_structure()` | trigger body | **n** | trigger on public.form_item_options, public.form_item_validations (+2); suite-referenced (supabase/tests/298_authz_p0_isolation.sql:143) |
| 499 | `public.guard_published_version()` | trigger body | **n** | trigger on public.form_versions; suite-referenced (supabase/tests/209_flexible_forms.sql:32) |
| 500 | `public.guard_response_version_commission()` | trigger body | **n** | trigger on public.responses; suite-referenced (supabase/tests/314_qob_org_admin_content_wall.sql:118) |
| 501 | `public.guard_submitted_children()` | trigger body | **n** | trigger on public.answers, public.response_group_instances; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:360) |
| 502 | `public.guard_submitted_response()` | trigger body | **n** | trigger on public.responses; suite-referenced (supabase/tests/225_supersession.sql:384) |
| 503 | `public.guard_submitted_signoffs()` | trigger body | **n** | trigger on public.response_section_signoffs; suite-referenced (supabase/tests/367_deferred_staff_signoff.sql:355) |
| 504 | `public.handle_new_user()` | trigger body | **n** | trigger on auth.users; suite-referenced (supabase/seed.sql:112) |
| 505 | `public.hospital_document_register(p_hospital uuid, p_doc_type text, p_status text, p_review_overdue_only boolean)` | command door | **y** | .rpc() @ src/lib/queries/controlled-documents.ts:530 |
| 506 | `public.hospital_indicator_rollup(p_hospital uuid)` | command door | **y** | .rpc() @ src/lib/queries/indicators.ts:377 |
| 507 | `public.hospital_readiness(p_hospital uuid, p_framework uuid)` | command door | **y** | .rpc() @ src/lib/queries/accreditation.ts:454 |
| 508 | `public.indicator_kpis(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/indicators.ts:346 |
| 509 | `public.indicator_series(p_indicator uuid, p_from text, p_to text)` | command door | **y** | .rpc() @ src/lib/queries/indicators.ts:320 |
| 510 | `public.insert_block_from_library(p_library_entry_id uuid, p_section_id uuid)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2489 |
| 511 | `public.interview_viewer_can_write(p_interview_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/interviews.ts:542 |
| 512 | `public.interviews_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/interviews.ts:729); no code path found |
| 513 | `public.is_nsp_coordinator_of_self(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:206 |
| 514 | `public.is_nsp_org_admin_of_self(p_org_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/org-admin.ts:126 |
| 515 | `public.is_pqs_member_of_self(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:188 |
| 516 | `public.is_pqs_member_self()` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1427 |
| 517 | `public.issue_decision(p_decision_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:450 |
| 518 | `public.issue_ethics_notification(p_case_id uuid, p_notification_type text, p_delivery_method text, p_recipient_participant_id uuid, p_recipient_user_id uuid, p_due_at timestamp with time zone, p_related_document_id uuid, p_notes_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:484 |
| 519 | `public.lift_recusal(p_recusal_id uuid, p_reason_md text)` | command door | **y** | .rpc() @ src/lib/case-recusals/actions.ts:144 |
| 520 | `public.link_evidence(p_commission uuid, p_standard uuid, p_kind text, p_artifact uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:339 |
| 521 | `public.link_referral_case(p_referral_id uuid, p_target_case_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:424 |
| 522 | `public.link_referral_related_case(p_referral_id uuid, p_case_id uuid, p_relationship_type text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:788 |
| 523 | `public.list_addable_commission_members(p_commission_id uuid, p_search text)` | command door | **y** | .rpc() @ src/lib/queries/members.ts:183 |
| 524 | `public.list_approver_candidates(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/controlled-documents.ts:569 |
| 525 | `public.list_case_access(p_case uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:2484 |
| 526 | `public.list_cases_board(p_commission_id uuid, p_limit integer)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:1587 |
| 527 | `public.list_commission_documents(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/controlled-documents.ts:311 |
| 528 | `public.list_dsr_disposable_meetings(p_request_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/dsr.ts:551 |
| 529 | `public.list_hospital_eligible_users_for_pqs(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:293 |
| 530 | `public.list_my_action_items(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/action-items.ts:204 |
| 531 | `public.list_my_assigned_capa_actions()` | command door | **y** | .rpc() @ src/lib/queries/capa.ts:304 |
| 532 | `public.list_my_cases(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/cases.ts:2545 |
| 533 | `public.list_my_dsr_hospitals()` | command door | **y** | .rpc() @ src/lib/queries/dsr.ts:255 |
| 534 | `public.list_my_dsr_task_commissions(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/dsr.ts:296 |
| 535 | `public.list_my_executable_dsr_tasks(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/dsr.ts:295 |
| 536 | `public.list_my_nsp_hospitals()` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:223 |
| 537 | `public.list_my_referral_assignments()` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:875 |
| 538 | `public.list_org_eligible_users(p_org_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:319 |
| 539 | `public.list_org_people(p_org_id uuid, p_search text, p_cpf text, p_include_ended boolean)` | command door | **y** | .rpc() @ src/lib/queries/affiliations.ts:375 |
| 540 | `public.list_pqs_members(p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:244 |
| 541 | `public.list_referral_internal_notes(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:946 |
| 542 | `public.list_referral_reply_documents(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1155 |
| 543 | `public.list_referral_target_commissions(p_source_commission_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/referrals.ts:1310 |
| 544 | `public.list_signoff_queue(p_commission_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/signoffs.ts:336 |
| 545 | `public.log_audit_access(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb)` | command door + internal helper | **y** | .rpc() @ src/lib/audit/access.ts:64; 12 fn caller(s), 12 DEFINER |
| 546 | `public.log_document_previa(p_source_kind text, p_source_id uuid, p_template_key text)` | command door | **y** | .rpc() @ src/app/api/previa/[kind]/[id]/route.ts:183 |
| 547 | `public.mark_document_obsolete(p_document_id uuid)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:680 |
| 548 | `public.meeting_cadence_status(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/charters.ts:86 |
| 549 | `public.meetings_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/meetings/actions.ts:147); no code path found |
| 550 | `public.mint_printed_document(p_id uuid, p_source_kind text, p_source_id uuid, p_template_key text, p_template_version integer, p_content_hash text, p_verification_token text, p_verification_short_code text, p_contains_phi boolean, p_source_revision integer)` | command door | **y** | .rpc() @ src/lib/pdf-mint/actions.ts:348 |
| 551 | `public.my_pending_meeting_signatures()` | command door | **y** | .rpc() @ src/lib/queries/meetings.ts:983 |
| 552 | `public.no_show_session(p_session_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:424 |
| 553 | `public.notify_safety_event(p_reporting_commission_id uuid, p_title text, p_description_md text, p_suspected_harm_level text, p_case_id uuid, p_event_type_id uuid, p_location text, p_discovered_at date)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:86 |
| 554 | `public.nsp_org_capa_rollup(p_org_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/org-admin.ts:69 |
| 555 | `public.nsp_org_event_rollup(p_org_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/org-admin.ts:44 |
| 556 | `public.nsp_org_roster(p_org_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/org-admin.ts:94 |
| 557 | `public.open_capa_plan(p_source text, p_classification text, p_source_id uuid, p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:446 |
| 558 | `public.open_document_version(p_document_version_id uuid)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:247 |
| 559 | `public.open_ethics_external_referral(p_decision_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/290_authz_never_called_door_floor.sql:14) |
| 560 | `public.open_printed_document(p_id uuid)` | command door | **y** | .rpc() @ src/app/api/documents/[id]/route.ts:33 |
| 561 | `public.open_referral_snapshot_document(p_shared_item_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:563 |
| 562 | `public.open_reserved_session(p_meeting_id uuid)` | command door | **y** | .rpc() @ src/lib/meetings/actions.ts:1418 |
| 563 | `public.patient_access_audit(p_mrn text, p_encounter text, p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/patient-index.ts:268 |
| 564 | `public.patient_index_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/patient-index.ts:145); no code path found |
| 565 | `public.patient_safety_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/pqs.ts:150); no code path found |
| 566 | `public.patient_xref_count(p_module text, p_entity_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/patient-index.ts:304 |
| 567 | `public.place_document_hold(p_document_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:337 |
| 568 | `public.post_referral_message(p_referral_id uuid, p_message_type text, p_body text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1188 |
| 569 | `public.pqs_inbox(p_status text, p_suspected_harm_level text, p_reporting_commission_id uuid, p_cursor_reported_at timestamp with time zone, p_cursor_id uuid, p_limit integer)` | command door | **y** | .rpc() @ src/lib/queries/pqs.ts:107 |
| 570 | `public.print_source_state(p_source_kind text, p_source_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/printed-documents.ts:379 |
| 571 | `public.printed_document_currency(p_ids uuid[])` | command door | **y** | .rpc() @ src/lib/pdf-mint/actions.ts:373 |
| 572 | `public.processless_cases_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/cases.ts:2145); no code path found |
| 573 | `public.provide_referral_information(p_referral_id uuid, p_body text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1241 |
| 574 | `public.publish_document(p_version_id uuid, p_effective_date date, p_review_due_date date, p_expiry_date date)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:633 |
| 575 | `public.quality_board_summary(p_organization_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/quality.ts:68 |
| 576 | `public.rca_writer_can_write(p_rca_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/rca.ts:325 |
| 577 | `public.read_minutes_transcript(p_job_id uuid)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:362 |
| 578 | `public.readiness_evidence(p_commission uuid, p_standard uuid)` | command door | **y** | .rpc() @ src/lib/queries/accreditation.ts:281 |
| 579 | `public.readiness_report(p_commission uuid, p_framework uuid)` | command door | **y** | .rpc() @ src/lib/queries/accreditation.ts:240 |
| 580 | `public.reassign_phase(p_case_phase_id uuid, p_new_assignee uuid, p_due_date date)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:849 |
| 581 | `public.receive_referral(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:355 |
| 582 | `public.reclassify_document(p_document_id uuid, p_target_tier text)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:367 |
| 583 | `public.recompute_recommendations(p_case_id uuid)` | internal helper | **y** | 8 fn caller(s), 6 DEFINER; 2 caller runs as the INVOKER |
| 584 | `public.record_capa_effectiveness(p_capa_id uuid, p_verdict text, p_method_md text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:382 |
| 585 | `public.record_capa_measure_result(p_measure_id uuid, p_period text, p_value numeric, p_note text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:359 |
| 586 | `public.record_ethics_finding(p_allegation_id uuid, p_finding text, p_rationale_md text, p_evidence_summary_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:315 |
| 587 | `public.record_indicator_measurement(p_indicator uuid, p_period_label text, p_numerator numeric, p_denominator numeric, p_note text, p_period_start date, p_period_end date)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:355 |
| 588 | `public.record_recusal(p_case_id uuid, p_user_id uuid, p_reason_md text, p_conflict_declaration_id uuid)` | command door | **y** | .rpc() @ src/lib/case-recusals/actions.ts:126 |
| 589 | `public.record_referral_message_receipt(p_message_id uuid, p_event text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1029 |
| 590 | `public.record_session_attendance(p_session_id uuid, p_participant_id uuid, p_attendance_status text, p_role_at_session text)` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/interviews/actions.ts:904); no code path found |
| 591 | `public.redact_professional_profile(p_profile_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:642 |
| 592 | `public.redact_referral_message(p_message_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1007 |
| 593 | `public.redact_referral_note(p_note_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:983 |
| 594 | `public.referrals_enabled()` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/queries/referrals.ts:269); no code path found |
| 595 | `public.reject_answer_on_display_item()` | trigger body | **n** | trigger on public.answers |
| 596 | `public.reject_correction(p_request_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:282 |
| 597 | `public.reject_document(p_version_id uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:596 |
| 598 | `public.reject_invalid_selection()` | trigger body | **n** | trigger on public.answer_selected_options; suite-referenced (supabase/tests/61_answer_model_v2.sql:119) |
| 599 | `public.release_document_hold(p_hold_id uuid)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:347 |
| 600 | `public.remind_document_approver(p_version_id uuid, p_approver_id uuid)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:818 |
| 601 | `public.remove_capa_action(p_action_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:190 |
| 602 | `public.remove_capa_action_task(p_task_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:270 |
| 603 | `public.remove_capa_measure(p_measure_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:342 |
| 604 | `public.remove_case_participant(p_case_participant_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:308 |
| 605 | `public.remove_interview_interviewer(p_interviewer_id uuid)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:667 |
| 606 | `public.remove_interview_subject(p_subject_id uuid)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:578 |
| 607 | `public.remove_pqs_member(p_hospital_id uuid, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/pqs/actions.ts:95 |
| 608 | `public.remove_rca_factor(p_factor_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:329 |
| 609 | `public.remove_rca_member(p_member_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:167 |
| 610 | `public.remove_rca_root_cause(p_root_cause_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:461 |
| 611 | `public.remove_rca_timeline_entry(p_entry_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:224 |
| 612 | `public.remove_referral_shared_item(p_shared_item_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:256 |
| 613 | `public.reopen_capa_plan(p_capa_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:123 |
| 614 | `public.reopen_case(p_case_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:953 |
| 615 | `public.reopen_interview(p_interview_id uuid)` | command door | **y** | string-literal indirection @ src/lib/interviews/actions.ts:441 |
| 616 | `public.reopen_meeting(p_meeting_id uuid)` | command door | **y** | string-literal indirection @ src/lib/meetings/actions.ts:259 |
| 617 | `public.reopen_rca(p_rca_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:111 |
| 618 | `public.reopen_referral(p_referral_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:675 |
| 619 | `public.reopen_triage(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:99 |
| 620 | `public.reorder_departments(p_hospital_id uuid, p_ordered_ids uuid[])` | command door | **y** | .rpc() @ src/lib/hospitals/actions.ts:159 |
| 621 | `public.reorder_event_types(p_ordered_ids uuid[], p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:156 |
| 622 | `public.reorder_rca_timeline(p_rca_id uuid, p_ordered_ids uuid[])` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:238 |
| 623 | `public.reorder_sentinel_criteria(p_ordered_ids uuid[], p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:217 |
| 624 | `public.request_document_disposition(p_document_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:323 |
| 625 | `public.request_referral_information(p_referral_id uuid, p_body text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1215 |
| 626 | `public.resolve_referral(p_referral_id uuid, p_summary_md text, p_follow_up boolean)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:647 |
| 627 | `public.resubmit_correction(p_request_id uuid)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:229 |
| 628 | `public.review_correction(p_request_id uuid)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:244 |
| 629 | `public.review_ethics_appeal(p_appeal_id uuid, p_status text, p_outcome text, p_outcome_rationale_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:609 |
| 630 | `public.revoke_administrativo(p_commission_id uuid, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/members/actions.ts:353 |
| 631 | `public.revoke_case_access(p_case uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/case-access/actions.ts:214 |
| 632 | `public.revoke_hospital_admin(p_hospital uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:352 |
| 633 | `public.revoke_hospital_dpo(p_hospital_id uuid, p_user_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/349_dsr_request_workflow.sql:26) |
| 634 | `public.revoke_member_capability(p_commission_id uuid, p_user_id uuid, p_capability text)` | command door | **y** | .rpc() @ src/lib/members/actions.ts:412 |
| 635 | `public.revoke_nsp_coordinator(p_hospital uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:449 |
| 636 | `public.revoke_nsp_org_admin(p_org uuid, p_user uuid)` | command door | **y** | .rpc() @ src/lib/org/actions.ts:411 |
| 637 | `public.revoke_org_admin(p_org uuid, p_user uuid)` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/org/actions.ts:267); no code path found |
| 638 | `public.revoke_printed_document(p_id uuid, p_reason_class text, p_reason text)` | command door | **y** | .rpc() @ src/lib/pdf-mint/actions.ts:410 |
| 639 | `public.revoke_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid)` | command door + internal helper | **y** | .rpc() @ src/lib/admin/actions.ts:330; 5 fn caller(s), 5 DEFINER |
| 640 | `public.save_block_to_library(p_item_id uuid, p_name text, p_description text)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2385 |
| 641 | `public.save_correction_draft_body(p_request_id uuid, p_body_md text)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:213 |
| 642 | `public.save_minutes_draft(p_job_id uuid, p_draft jsonb)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:272 |
| 643 | `public.save_narrative_body(p_narrative uuid, p_body_md text)` | command door | **y** | .rpc() @ src/lib/case-narratives/actions.ts:867 |
| 644 | `public.save_referral_patient(p_referral_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:283 |
| 645 | `public.save_triage(p_event_id uuid, p_is_pse boolean, p_pse_closure_reason text, p_reach text, p_harm_severity text, p_natural_course boolean, p_review_pathway text, p_disposition_notes_md text, p_sentinel_criteria_ids uuid[])` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:60 |
| 646 | `public.schedule_ethics_hearing(p_case_id uuid, p_hearing_type text, p_meeting_id uuid, p_scheduled_at timestamp with time zone)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:545 |
| 647 | `public.schedule_session(p_interview_id uuid, p_session_type text, p_modality text, p_scheduled_start timestamp with time zone, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:214 |
| 648 | `public.search_patient_xref(p_mrn text, p_encounter text, p_hospital_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/patient-index.ts:201 |
| 649 | `public.send_referral(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:312 |
| 650 | `public.session_context()` | command door | **y** | .rpc() @ src/lib/queries/session.ts:286 |
| 651 | `public.set_capa_action_task_done(p_task_id uuid, p_is_done boolean)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:256 |
| 652 | `public.set_case_confidentiality(p_case_id uuid, p_level text)` | command door | **y** | .rpc() @ src/lib/case-recusals/actions.ts:165 |
| 653 | `public.set_case_narrative_assignment_role(p_narrative_id uuid, p_role_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/362_patient_mode_and_narrative_rename.sql:48) |
| 654 | `public.set_case_offered_outcomes(p_case_id uuid, p_outcome_ids uuid[])` | command door | **y** | .rpc() @ src/lib/cases/outcomes-actions.ts:412 |
| 655 | `public.set_case_participant_role(p_case_participant_id uuid, p_role_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:351 |
| 656 | `public.set_case_patient(p_case_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:463 |
| 657 | `public.set_case_phase_assignment_role(p_phase_id uuid, p_role_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:693 |
| 658 | `public.set_case_phase_result_override(p_case_phase_id uuid, p_result_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/cases/result-actions.ts:398 |
| 659 | `public.set_case_visibility(p_case_id uuid, p_policy text)` | command door | **y** | .rpc() @ src/lib/case-recusals/actions.ts:183 |
| 660 | `public.set_commission_oversight(p_commission_id uuid, p_oversight text)` | command door | **y** | .rpc() @ src/lib/quality/actions.ts:60 |
| 661 | `public.set_document_confidentiality(p_document_id uuid, p_level text)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:285 |
| 662 | `public.set_ethics_decision_details(p_decision_id uuid, p_sanction_type_id uuid, p_sanction_start_date date, p_sanction_end_date date, p_remediation_required boolean, p_remediation_description_md text, p_external_reporting_required boolean, p_external_reporting_target text, p_external_reporting_deadline timestamp with time zone, p_appeal_allowed boolean, p_appeal_deadline timestamp with time zone, p_decision_letter_document_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:399 |
| 663 | `public.set_event_patient(p_event_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:190 |
| 664 | `public.set_framework_status(p_framework uuid, p_status text)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:212 |
| 665 | `public.set_indicator_target(p_id uuid, p_target_value numeric, p_target_comparator text, p_lower_warn numeric, p_upper_warn numeric)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:312 |
| 666 | `public.set_interview_confidentiality(p_interview_id uuid, p_level text)` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/interviews/actions.ts:895); no code path found |
| 667 | `public.set_interview_interviewer_participant(p_interviewer_id uuid, p_participant_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/228_ethics_e1.sql:654) |
| 668 | `public.set_interview_participant(p_interview_id uuid, p_participant_id uuid)` | UNRESOLVED | **?** | every `src/` occurrence is inside a COMMENT (src/lib/interviews/actions.ts:884); no code path found |
| 669 | `public.set_interview_subject_participant(p_subject_id uuid, p_participant_id uuid)` | UNRESOLVED | **?** | no policy / trigger / constraint / fn-caller / `src/` reference; referenced only by the suites (supabase/tests/228_ethics_e1.sql:653) |
| 670 | `public.set_item_validations(p_item_id uuid, p_rules jsonb)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2283 |
| 671 | `public.set_participant_patient(p_case_id uuid, p_participant_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text, p_role_id uuid)` | internal helper | **n** | 1 fn caller(s), 1 DEFINER; suite-referenced (supabase/tests/207_case_participants_e0.sql:279) |
| 672 | `public.set_pqs_rca_due_window(p_hospital_id uuid, p_days integer)` | command door | **y** | .rpc() @ src/lib/pqs/actions.ts:125 |
| 673 | `public.set_primary_subject(p_case_participant_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:331 |
| 674 | `public.set_professional_link_state(p_profile_id uuid, p_link_state text, p_user_id uuid)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:529 |
| 675 | `public.set_rca_factor_key(p_factor_id uuid, p_is_key boolean)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:315 |
| 676 | `public.set_rca_why_root(p_factor_id uuid, p_root_text text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:366 |
| 677 | `public.set_rca_why_step(p_factor_id uuid, p_index integer, p_text text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:348 |
| 678 | `public.set_referral_deadline(p_referral_id uuid, p_response_due_at timestamp with time zone)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:210 |
| 679 | `public.set_standard_assessment(p_commission uuid, p_standard uuid, p_status text, p_note_md text)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:400 |
| 680 | `public.set_standard_ownership(p_hospital uuid, p_standard uuid, p_commission uuid)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:479 |
| 681 | `public.set_template_case_type(p_template_version_id uuid, p_case_type_id uuid)` | command door | **y** | .rpc() @ src/lib/process-templates/actions.ts:269 |
| 682 | `public.set_template_patient_mode(p_template_version_id uuid, p_mode text, p_required_fields text[])` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:1102 |
| 683 | `public.sign_meeting(p_attendee_id uuid, p_method text, p_note text)` | command door | **y** | .rpc() @ src/lib/meetings/actions.ts:1050 |
| 684 | `public.snap_referral_commission_names()` | trigger body | **n** | trigger on public.case_referral; suite-referenced (supabase/tests/mutation/w4-technical-director-referrals-audit.sh:144) |
| 685 | `public.soft_delete_document(p_document_id uuid)` | command door | **y** | .rpc() @ src/lib/documents/actions.ts:354 |
| 686 | `public.start_correction_draft(p_request_id uuid)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:195 |
| 687 | `public.start_referral_review(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:406 |
| 688 | `public.start_session(p_session_id uuid)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:361 |
| 689 | `public.submit_document_for_approval(p_version_id uuid, p_approvers jsonb, p_proposed_effective_date date, p_approval_due_date date)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:537 |
| 690 | `public.submit_ethics_appeal(p_case_id uuid, p_decision_id uuid, p_appeal_reason_md text, p_submitted_by_participant_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:590 |
| 691 | `public.submit_minutes_job(p_job_id uuid, p_service_job_id text)` | command door | **y** | .rpc() @ src/lib/minutes-jobs/actions.ts:207 |
| 692 | `public.submit_rca_for_review(p_rca_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:89 |
| 693 | `public.submit_targeted_case_response(p_response_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:751 |
| 694 | `public.suggest_carry_forward(p_commission uuid)` | command door | **y** | .rpc() @ src/lib/queries/charters.ts:142 |
| 695 | `public.supersede_document(p_document_id uuid)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:664 |
| 696 | `public.supersede_response(p_response_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/responses/actions.ts:1260 |
| 697 | `public.sync_case_phase_on_submit()` | trigger body | **n** | trigger on public.responses; suite-referenced (supabase/tests/144_case_access.sql:398) |
| 698 | `public.sync_profile_email()` | trigger body | **n** | trigger on auth.users |
| 699 | `public.sync_profile_email_confirmed()` | trigger body | **n** | trigger on auth.users |
| 700 | `public.target_case_response(p_response_id uuid, p_case_participant_id uuid)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:728 |
| 701 | `public.toggle_committee_action_item_checklist(p_id uuid, p_is_done boolean)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:201 |
| 702 | `public.transfer_event_custody(p_event_id uuid, p_to_owner_kind text, p_to_commission_id uuid, p_note text)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:136 |
| 703 | `public.triage_disposition(p_event_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/triage.ts:188 |
| 704 | `public.unassign_case_tag(p_case_id uuid, p_tag_id uuid)` | command door | **y** | .rpc() @ src/lib/cases/tags-actions.ts:266 |
| 705 | `public.unassign_narrative(p_narrative uuid)` | command door | **y** | .rpc() @ src/lib/case-narratives/actions.ts:833 |
| 706 | `public.unassign_referral_internal_note(p_note_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:937 |
| 707 | `public.unlink_evidence(p_link uuid)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:358 |
| 708 | `public.unlink_referral_case(p_link_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:810 |
| 709 | `public.update_affiliation(p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_clear_employee_id boolean, p_job_title text, p_work_email text, p_work_phone text, p_clear_job_title boolean, p_clear_work_email boolean, p_clear_work_phone boolean)` | command door | **y** | .rpc() @ src/lib/affiliations/actions.ts:247 |
| 710 | `public.update_block_library_entry(p_library_entry_id uuid, p_name text, p_description text)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2559 |
| 711 | `public.update_capa_action(p_action_id uuid, p_title text, p_owner text, p_assignee_user_id uuid, p_due_date date, p_action_strength text, p_success_measure text, p_root_cause_id uuid)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:170 |
| 712 | `public.update_capa_measure(p_measure_id uuid, p_name text, p_target text, p_definition text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:326 |
| 713 | `public.update_capa_plan(p_capa_id uuid, p_classification text)` | command door | **y** | .rpc() @ src/lib/safety/capa-actions.ts:78 |
| 714 | `public.update_case_custom_field_values(p_case_id uuid, p_values jsonb)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:694 |
| 715 | `public.update_case_meta(p_case_id uuid, p_label text, p_department_id uuid, p_department_other text)` | command door | **y** | .rpc() @ src/lib/cases/actions.ts:658 |
| 716 | `public.update_committee_action_item(p_id uuid, p_title text, p_description text, p_assigned_to uuid, p_urgency_id uuid, p_due_date date, p_visibility_scope text)` | command door | **y** | .rpc() @ src/lib/cases/action-items-actions.ts:277 |
| 717 | `public.update_committee_action_item_checklist(p_id uuid, p_title text, p_sort_order integer)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:221 |
| 718 | `public.update_committee_action_item_reminder(p_id uuid, p_is_active boolean)` | command door | **y** | .rpc() @ src/lib/action-items/satellite-actions.ts:117 |
| 719 | `public.update_controlled_document(p_id uuid, p_title text, p_doc_type text, p_review_cycle_months integer, p_category text, p_tags text[], p_description text)` | command door | **y** | .rpc() @ src/lib/controlled-documents/actions.ts:285 |
| 720 | `public.update_ethics_allegation(p_allegation_id uuid, p_category_id uuid, p_description_md text, p_severity text, p_alleged_event_date date, p_status text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:292 |
| 721 | `public.update_event(p_event_id uuid, p_title text, p_description_md text, p_suspected_harm_level text, p_event_type_id uuid, p_location text, p_discovered_at date)` | command door | **y** | .rpc() @ src/lib/safety/actions.ts:159 |
| 722 | `public.update_event_type(p_id uuid, p_label text, p_description text)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:141 |
| 723 | `public.update_framework(p_framework uuid, p_name text, p_version text, p_description text)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:191 |
| 724 | `public.update_indicator(p_id uuid, p_name text, p_kind text, p_direction text, p_data_source text, p_frequency text, p_target_comparator text, p_target_value numeric, p_numerator_label text, p_denominator_label text, p_unit text, p_description_md text, p_lower_warn numeric, p_upper_warn numeric, p_derived_config jsonb)` | command door | **y** | .rpc() @ src/lib/indicators/actions.ts:257 |
| 725 | `public.update_interview(p_interview_id uuid, p_title text, p_case_phase_id uuid, p_interview_category text, p_confidentiality_level text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:253 |
| 726 | `public.update_interview_interviewer(p_interviewer_id uuid, p_role text, p_note text, p_external_name text, p_external_org text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:641 |
| 727 | `public.update_interview_subject(p_subject_id uuid, p_clinical_role text, p_note text, p_external_name text, p_external_org text, p_relationship_to_case text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:553 |
| 728 | `public.update_interview_summary(p_interview_id uuid, p_summary_md text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:278 |
| 729 | `public.update_org_affiliation(p_user uuid, p_organization uuid, p_started_on date)` | command door | **y** | .rpc() @ src/lib/affiliations/actions.ts:401 |
| 730 | `public.update_professional_profile(p_profile_id uuid, p_full_name text, p_professional_type text, p_license_number text, p_license_region text, p_specialty text, p_affiliation_status text)` | command door | **y** | .rpc() @ src/lib/participants/actions.ts:471 |
| 731 | `public.update_rca(p_rca_id uuid, p_what_md text, p_expected_md text, p_detected text, p_impact text, p_scope text, p_summary_md text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:70 |
| 732 | `public.update_rca_factor(p_factor_id uuid, p_text text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:298 |
| 733 | `public.update_rca_member_role(p_member_id uuid, p_role text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:153 |
| 734 | `public.update_rca_root_cause(p_root_cause_id uuid, p_text text, p_category text, p_classification text, p_type text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:413 |
| 735 | `public.update_rca_timeline_entry(p_entry_id uuid, p_occurred_at timestamp with time zone, p_description text)` | command door | **y** | .rpc() @ src/lib/safety/rca-actions.ts:209 |
| 736 | `public.update_referral_assignment(p_assignment_id uuid, p_status text, p_due_at timestamp with time zone, p_assignment_role text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:736 |
| 737 | `public.update_referral_draft(p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text, p_response_expected boolean, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:184 |
| 738 | `public.update_referral_internal_note(p_note_id uuid, p_title text, p_body_md text, p_kind text)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:887 |
| 739 | `public.update_referral_requested_action(p_id uuid, p_label text, p_description text, p_color_token text, p_position integer, p_is_active boolean)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:1327 |
| 740 | `public.update_sentinel_criterion(p_id uuid, p_label text, p_description text)` | command door | **y** | .rpc() @ src/lib/safety/triage-actions.ts:202 |
| 741 | `public.update_session(p_session_id uuid, p_session_type text, p_modality text, p_scheduled_start timestamp with time zone, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text)` | command door | **y** | .rpc() @ src/lib/interviews/actions.ts:336 |
| 742 | `public.upsert_commission_charter(p_commission uuid, p_meeting_frequency text, p_controlled_document_id uuid)` | command door | **y** | .rpc() @ src/lib/queries/charters.ts:68 |
| 743 | `public.upsert_ethics_case_details(p_case_id uuid, p_complaint_channel text, p_complaint_received_at timestamp with time zone, p_summary_md text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:210 |
| 744 | `public.upsert_matrix_axes(p_item_id uuid, p_rows jsonb, p_columns jsonb)` | command door | **y** | .rpc() @ src/lib/forms/actions.ts:2226 |
| 745 | `public.upsert_standard(p_framework uuid, p_code text, p_title text, p_id uuid, p_parent uuid, p_description_md text, p_position integer, p_level smallint)` | command door | **y** | .rpc() @ src/lib/accreditation/actions.ts:280 |
| 746 | `public.validate_visible_when(p_form_version_id uuid)` | internal helper | **y** | 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 747 | `public.verify_audit_chain(p_commission uuid, p_organization uuid, p_hospital uuid)` | command door | **y** | .rpc() @ src/lib/queries/audit.ts:685 |
| 748 | `public.void_affiliation(p_affiliation uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/affiliations/actions.ts:440 |
| 749 | `public.void_decision(p_decision_id uuid, p_reason text)` | command door | **y** | .rpc() @ src/lib/ethics/actions.ts:464 |
| 750 | `public.void_org_affiliation(p_org_affiliation uuid, p_reason text)` | command door + internal helper | **y** | .rpc() @ src/lib/affiliations/actions.ts:465; 1 fn caller(s), 0 DEFINER; 1 caller runs as the INVOKER |
| 751 | `public.withdraw_correction(p_request_id uuid)` | command door | **y** | .rpc() @ src/lib/corrections/actions.ts:298 |
| 752 | `public.withdraw_referral(p_referral_id uuid)` | command door | **y** | .rpc() @ src/lib/referrals/actions.ts:336 |

---

# LEAD RULINGS on the revoke set — 2026-08-27

The classification above is **accepted**. Population 752 was re-derived independently by the
lead against the catalog and matched exactly. What follows governs the **revoke** step, which
is a separate, lead-authorized task and has **not** been executed.

## RV0 — the governing property: ⛔ a revoke may not create sweep blindness

**This is the ruling; everything else is an application of it.**

`ARM=floor`'s domain is exactly `nspname = 'public'` **and** `prosecdef` **and**
`has_function_privilege('authenticated', …, 'EXECUTE')`. **Revoking that EXECUTE removes the
function from floor's domain.** If the function also returns something other than `bool`/`setof`,
it is simultaneously outside `census`, outside `policy`, and outside `wrapper` (`prosecdef = t`)
— the **F-F blind shape** that AE1.3 §10 was restructured to avoid.

So AE1.2's hardening and plan rule 4 **pull against each other**, and the conflict is real rather
than notional. Verified by the lead, on the door the classification flags as highest-risk:
`public.set_participant_patient` is DEFINER, returns **`uuid`**, and holds EXECUTE for **both**
`authenticated` and `service_role` — a Rule 12 PHI door that a single revoke would move from
"swept by floor" to "swept by nothing".

**Binding procedure for every batch, before any `REVOKE` is written:**

1. **Partition the batch by post-revoke domain membership**: for each target, state which arm's
   domain still contains it *after* the revoke. This is a **property**, derived per function —
   ⛔ never a hand-list, and never inferred from the batch's label.
2. **Targets that remain in ≥ 1 arm's domain → proceed.**
3. **Targets that would fall out of every arm → HOLD.** They are released only by (a) receiving
   the AE1.3 treatment — the authority decision moved into a swept `bool` `can_`-named predicate
   with an `app.*_impl` kernel under the ADR 0156 gate — or (b) a **named ruling accepting the
   blindness, with its reason recorded in the gate record**. ⛔ Never by an allowlist entry: an
   entry resolves against `pg_proc`, so it would not trip ALLOWLIST-ROT and would read as *"swept
   and excused"*.
4. **Record the arm-domain delta as a measured before/after**, per batch. The classification
   already measured `ARM=floor` 432 → 412 and that the 43 `app` boolean helpers **stay** in
   `census`/`policy` (`rettype = 'bool'` carries no EXECUTE term). That is the right shape —
   continue it. ⛔ A batch whose arm delta is not measured does not ship.

⚠ **Scale, and a predicate difference worth stating rather than reconciling away.** The
classification reports *132 of the 384 public command doors* one revoke from the blind shape; the
lead measured **149** `public` DEFINER functions returning `void`/`uuid` that hold `authenticated`
EXECUTE (control: the same probe returns **22** for `boolean`, so it discriminates by return type
rather than matching everything). **Both are honest** — the bases differ (all `public` DEFINER vs
command-door-classified only). Neither number is usable without its predicate attached, which is
this program's standing rule.

## RV1 — batch 4 stays HELD. Correctly identified; the hold is upheld

The four held functions are not released by this ruling. They are exactly the RV0 step-3 class.

## RV2 — `public.set_participant_patient` is not revoked in AE1

Rule 12 PHI door, and the clearest instance of RV0. It is revoked only after it has the AE1.3
door treatment, and **not** in this phase. Attempting privilege hygiene on a PHI door at the cost
of making it unobservable is a bad trade in the direction that matters least.

## RV3 — the 5 constraint-referenced functions are excluded from every batch until the question is answered

Whether Postgres re-checks EXECUTE on a function inside a stored CHECK expression at write time
(5 functions, 8 constraints) is **unsettled**, and the classification was right not to settle it
by assumption — it needs a constructed negative write, which was outside its authorization.

⛔ **Excluded from all four batches until answered by construction.** The answer is cheap (a
negative write inside a rolled-back transaction) and belongs to the revoke task, where it becomes
load-bearing. ⚠ It changes no verdict in this file — all five carry independent
"needs EXECUTE" evidence — so this is a precondition, not a defect.

## RV4 — the 11 unreachable `public` doors are a finding to file, not to revoke here

Eleven `public` DEFINER doors that `authenticated` can call and **nothing in `src/` calls**
(suite-only), plus 3 `app` functions with no reference by any instrument and 15 whose only `src/`
occurrence is a comment — including 10 superseded per-flag `*_enabled()` readers, one of whose
JSDoc still claims a call its body no longer makes.

This is floor-arm-adjacent and genuinely useful, but it is **not** AE1.2's remit and revoking on
reachability grounds would conflate two different questions. **File it as a `FUP-*` index line
with a body.** ⛔ Not a gate-record sentence — that is precisely the class of obligation AFF4 left
unfiled (tracked as `FUP-AFF4-RESIDUE-UNFILED` in `docs/followups/follow-ups-open.md`).

## RV5 — the `anon` residue stays untouched

138 of the revoke targets also hold `anon` EXECUTE. That remains
`FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED` — a **PO decision, not a patch** — and it is not
smuggled into a batch. ⚠ And per ADR 0160 the residue's old framing is refuted: there was no
`167 → 237` growth; those are two predicates at one instant, and `anon` holds no USAGE on `app`.

## RV6 — execution shape

Batches ship **one at a time**, each with a full pgTAP + `e2e:prod` run, because an over-revoke
surfaces as a user-facing `42501` rather than a test failure unless a suite exercises the path.
⚠ **A `REVOKE` you are not entitled to make is a silent no-op** — assert the ACL actually changed,
positively, after each batch. And a revoke verified locally must be **re-verified on the remote
after push**: grants drift independently.
