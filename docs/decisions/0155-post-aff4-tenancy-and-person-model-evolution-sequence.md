# ADR 0155 — Post-AFF4 tenancy and person-model evolution: a staged sequence, not a redesign

- **Status:** PROPOSED 2026-08-26. ⛔ **Nothing here is approved and nothing is to be built.**
  Re-analysis is gated on AFF4's merge (ADR 0151) and **must re-measure every figure below**.
- **Related:** 0041 (tenancy shape) · 0078 (capability model + the methodology finding) ·
  0079 (door-blindness audit family) · 0097 / 0133 (affiliation) · 0151 / 0154 (AFF4).
- **Amends / Supersedes:** none. This ADR proposes future work; it changes no standing decision.
  If **D6** is ever taken up it *would* amend 0041 and must carry that label then.
- **Origin:** a design review on 2026-08-26 conducted over the live catalog during a walkthrough
  of the case/meeting authorization paths. Not a build session; no code was changed.

## Context

Three observations, all measured against the live catalog rather than read from migration text
(the ADR 0078 methodology finding).

**1. `memberships` states the same fact three times.** The role is explicit; `memberships_scope_shape`
constrains which scope column may be set *for that role*; the three partial indexes repeat the same
split; and every helper repeats it a fourth time as a `case p_scope_type` ladder.

> ⚠ **The common criticism of this table — "the role is derived from which column is non-null" — is
> backwards, and must not be carried into any redesign.** The CHECK reads
> `CASE role WHEN 'org_admin' THEN organization_id IS NOT NULL AND …`: the role is authoritative and
> the columns are constrained *by* it. The defect is **repetition**, not ambiguity. The distinction
> decides the fix — repetition is cured by extracting the shared knowledge (D5), ambiguity would have
> required changing the storage (D6).

**2. The model has already grown three bolt-ons for things a unified model would have held.**

| Bolt-on | What it is really doing |
| --- | --- |
| `commission_administrativo_capabilities` | a second grant system, for one pseudo-role, with its own CHECK list and audit trigger |
| `hospital_affiliations` / `organization_affiliations` | a separate "where this person works" axis, distinct from authorization |
| `profiles.is_admin` | a platform-level role with no scope row to hang a membership on |

Three independent bolt-ons is the model indicating what it wanted to be.

**3. `profiles` protects PII with column-level grants** — `cpf`, `date_of_birth` and `phone` carry no
grant to `authenticated`, while eleven sibling columns carry `arw`. That mechanism exists **only
because PII shares a row with authorization state and account lifecycle**. It works (verified: a
`select *` as `authenticated` is refused; a named-column select is admitted) but it is a workaround
for a table doing two jobs.

## Decision — the sequence, and the rule that orders it

### D0 — Ordering rule: AFF4 completes and merges before any step below begins

Five reasons, strongest first:

1. **AFF4 *is* D3.** `organization_affiliations` + the voided tense on `hospital_affiliations`,
   held separately from `memberships`, is the affiliation/authorization split. It cannot be
   sequenced before itself.
2. **The saving is already spent.** B4's blocker enumeration (*org-tier / hospital-tier of org
   hospitals / commission-tier via `commissions.hospital_id` → org*) is a hand-written ancestor
   walk — precisely what D6 would replace. **B4 is already committed.** Taking D6 now is a rewrite,
   not an avoided cost. This argument was strong three weeks ago and is now inverted.
3. **No clean seam remains.** Every unfinished AFF4 task sits on a table these steps touch:
   B5 (backfill off `profiles.home_organization_id`), B6 (roster re-predication), B8
   (`person-footprint.ts`, which feeds **write** authority; `getOwnPersonRecord`), F5, B9.
4. **ADR 0151's own risk register forbids it** — *"no second feature branch during AFF4"*. One
   already appeared and required a PO merge-order ruling to hold.
5. **It destroys the gate baseline.** AFF4's §6 gate diffs against P4's named-flake baseline at
   `3894c667`. A concurrent schema refactor makes *"mine or pre-existing?"* unanswerable — the exact
   failure the DatePicker hold exists to prevent.

### D1 — Step 1: finish AFF4 through the §6 gate and merge; then release the held DatePicker branch

No new scope. Named here only so the sequence has an explicit first element.

### D2 — Step 2: harvest AFF4's rulings as design input, in writing

Two artefacts specifically, because both re-decide questions any redesign faces and both currently
live only inside a plan document:

- **ADR 0154's boundary-filter ruling** — filter at the data-access boundary in *both* surfaces, same
  parameter name, same default, one explicit widener. *(Narrowing can be wrong and safe; widening
  cannot.)*
- **`person-footprint.ts`'s INTERSECTION / SUBSET resolver** (ADR 0133) — the shape of "authority
  bounded by a footprint rather than a role".

Cost: documentation only.

### D3 — Step 3: name the affiliation ≠ authorization split in ARCHITECTURE.md

AFF4 builds the mechanism; no rule states that the two axes are separate, so the next reader
re-derives it — or worse, adds authorization data to an affiliation table because nothing said not to.

Cost: documentation only.

### D4 — Step 4: extract the PII columns out of `profiles` ("Move 4-lite")

- Extract **exactly** `cpf`, `date_of_birth`, `phone` into their own table keyed on `profiles.id`.
- ⛔ **NOT a `persons` / `accounts` split.** `profiles.id` remains the person key, so the **93
  FK-bearing tables never move.** The wholesale split re-points all 93 to buy a conceptual tidiness
  the extraction already delivers.
- ⛔ **`is_active` is explicitly OUT of scope.** It is read at STEP 2 of every `app._case_caps` call
  *and* inside every role probe (`is_member_of_for`, `is_staff_admin_of_for`, …) — the hottest read
  in the system. Moving it puts a join on the hot path of every RLS check for no design gain.
- Payoff: retires column-level grants as a mechanism (the protection becomes a table, the natural
  unit of RLS and grants); gives LGPD/DSR work a single table to point at; `guard_profile_privileged_columns`
  loses its identity half.

### D5 — Step 5: extract the hierarchy walk into one function, without changing storage

Introduce `app.scope_chain(…)` returning the ordered ancestry (commission → hospital → organization →
platform) and have the tenancy helpers call it instead of open-coding the walk.

- **No migration.** No RLS performance change — the same reads against the same indexes.
- Role names stay literal in SQL, so `ARM=census` / `hat` / `floor` / `wrapper` and the door sweeps
  keep working unchanged.
- Fully reversible.
- ⭐ **Its real value is discovery.** It forces enumeration of every caller that encodes the
  hierarchy — which is the expensive part of D6, obtained at a fraction of the cost and without
  committing to D6.

### D6 — Step 6: the `scopes`-table migration is NOT approved and requires a forcing function

Deferred, explicitly, not rejected. Before it may even be **re-proposed**, both must hold:

1. **A concrete requirement for a new tenancy level** (department, hospital network, …). The payoff
   of D6 is that adding a level is cheap; absent a level to add, the cost buys unexercised optionality.
2. **`EXPLAIN (ANALYZE, BUFFERS)` evidence on the hot read paths** — the ADR 0078 A5 discipline,
   gated *before* any policy is repointed. ⛔ **Unchanged by the benchmark below**: a synthetic
   measurement narrows the design space, it does not discharge a gate on real data.

⚠ **The benchmark below also constrains the SHAPE of any future D6 proposal**, so it is not merely
supporting evidence: a per-row ancestry function is ruled out on the measured numbers, and a proposal
must carry a closure table (or the per-statement `my_reachable_scopes()` hoist) to be considered at
all.

If taken up, it amends ADR 0041 and must carry the `**Amends:**` label — no gate can detect a missing one.

## Why D6 differs in kind from D4 and D5

Three costs that are invisible in a schema diff:

1. **RLS performance.** The role helpers run **per row**, and **119 of 283 policies** call them.
   D6 replaces a partial-index probe with a tree walk on the hot path of every case, meeting and
   document read. Mitigable — but the mitigation must be picked on evidence rather than by
   assumption, so it was **measured**: see *Measured — what ancestry actually costs under RLS* below.
2. ⭐ **It invalidates the authorization gate apparatus itself.** `ARM=census` / `hat` / `floor` /
   `wrapper` and the door sweeps work by **statically analysing SQL for role checks**. Change how
   roles are stored and checked and every committed finding baseline is void — you would be
   rebuilding the audit apparatus at the same time as the thing it audits, with no trustworthy
   baseline in between. This repo's own recorded trap, at program scale: *where two defects share a
   symptom, fixing one and re-running looks exactly like fixing both.*
3. **A business rule stops being an index.** `UNIQUE (hospital_id) WHERE role = 'technical_director'`
   has no `hospital_id` column to sit on once scope is a single `scope_id`, and falls back to a
   trigger — later, slower, and racy under concurrency unless written carefully.

> ⚠ The general form, worth carrying beyond this ADR: **a more generic schema makes specific
> constraints harder to express.** Every step toward "anything can be configured" is a step away from
> "this particular thing is impossible."

## Measured — what ancestry actually costs under RLS (2026-08-26, synthetic)

Cost 1 above was quantified rather than left as a judgement. A synthetic tenancy tree was built in a
**rolled-back transaction** on the local stack — 226 scopes (1 platform · 5 organizations ·
20 hospitals · 200 commissions), **depth 4**, an 871-row closure table, two grants for the test
principal, and 10 000 rows carrying a `scope_id`. Each strategy was expressed as a `STABLE` boolean
function and evaluated **once per row**, which is what an RLS predicate does.

| Strategy | Time (10 000 rows) | Rows matched |
| --- | --- | --- |
| Flat probe — one index lookup, **no inheritance** | 27–31 ms | 50 |
| Recursive CTE, per row | **644–790 ms** | 2050 |
| `ltree` path containment | 511–518 ms | 2050 |
| **Closure table** | **102–113 ms** | 2050 |

**Three findings.**

1. **The naive form is a different complexity class, not a constant factor.** Per call, a recursive
   CTE materialises a working table, runs the seed, iterates until an iteration returns zero rows
   (depth 4 → five iterations), then tears down. The index lookups are the cheap part; the executor
   machinery is the cost, and it is paid 10 000 times.
2. ⭐ **A closure table puts D6's read cost roughly back where it is today.** At ~4× a single flat
   probe — and today's hardcoded hierarchy walk is already a small fixed number of probes —
   precomputing every `(descendant, ancestor)` pair moves the recursion to **write** time, where a
   tenancy tree changes almost never. **This is the finding that would make D6 implementable at all
   if a forcing function arrives**; without it, D6 should be assumed infeasible on the hot paths.
3. **`ltree` is the wrong tool for this particular question.** It excels at *descendant* queries
   ("everything under this organization", prefix and variable-depth patterns). An authorization check
   asks the *ancestor* question, which a closure table answers in one index lookup.

### ⭐ The mitigation that outranks all three: stop asking the question per row

`app._case_caps(cases.id, auth.uid())` cannot be hoisted out of the per-row loop, because `cases.id`
varies per row — `STABLE` permits reuse only for *identical* arguments. (Same mechanism as the
register's `professional_credentials_select` item: bare `auth.uid()` evaluates per row, while
`( SELECT auth.uid() )` becomes an InitPlan and evaluates once.)

A function taking **no per-row argument** does become an InitPlan:

```sql
create function app.my_reachable_scopes() returns setof uuid stable ...  -- ONCE per statement
-- policy:  using (scope_id in (select app.my_reachable_scopes()))
```

The recursion then runs once per statement instead of once per row, and the per-row test collapses to
a hash lookup. This is the move `_case_caps` already makes one level down — compute an integer once,
then answer seven questions with bit tests — applied to the scope tree. **Any serious D6 proposal
should carry this shape rather than a per-row ancestry function.**

⚠ **Limits of this benchmark, stated so it is not later quoted as a fact.** Synthetic; warm cache;
single connection; no concurrency. The flat row **answers a different question** — 50 hits against
2050, because it cannot see the inherited organization grant — so it is a floor for comparison, not a
candidate. Only two grants for the test principal, one tree shape, one depth; the `ltree` figure is
additionally formulation-dependent and must not be quoted as a bound on that type. **Re-measure
against real data before any scheduling decision** — D6's condition 2 is unchanged by this section.

## Rejected alternatives

- **Roles and capabilities fully as data** (`roles` / `capabilities` / `role_capabilities` tables).
  Gains are real — adding a role becomes an `INSERT`, and *"who can `read_cases` in hospital X"*
  becomes a join instead of a grep across SQL bodies. **Rejected for now** because role checks stop
  being statically greppable, and that property is the mechanism the entire ADR 0079 gate family
  depends on. For a system whose product is accreditation evidence, trading static provability for
  runtime flexibility is not obviously correct. Revisit only alongside D6, never separately.
- **Any step before AFF4 merges** — see D0.
- **Splitting `profiles` into `persons` + `accounts` wholesale** — rejected in favour of D4's
  extraction, on the 93-FK blast radius.
- **Moving `is_active` as part of D4** — rejected on the hot-path argument above.

## Measured figures (2026-08-26, local catalog) — ⛔ re-measure before acting on any of them

| Figure | Value | Bears on |
| --- | --- | --- |
| Tables with an FK to `profiles` | **93** | D4 (why it is an extraction) |
| Functions reading `profiles` | 45 | D4 |
| App call sites `.from('profiles')` | 25 | D4 |
| Functions reading `memberships` | 41 | D5 / D6 |
| Policies calling a role helper | **119** of **283** | D6 (RLS perf) |
| Roles in the `memberships` CHECK | 10 | D5 / D6 |
| PII columns with no `authenticated` grant | 3 (`cpf`, `date_of_birth`, `phone`) | D4 |

These are a snapshot taken during a design review, not a gate figure. AFF4 itself adds relations and
doors, so **every row above will be wrong by the time this ADR is re-analysed.**

## Consequences

- **Nothing here authorizes work.** The sequence exists so that the next person to ask *"should we
  redesign `memberships`?"* finds a considered answer instead of re-deriving one.
- **D4 and D5 are independent and independently revertible.** Neither is a prerequisite for the
  other, and either may be dropped without disturbing the rest.
- **D3 and D2 are documentation-only** and could be absorbed into AFF4's own Record step if the PO
  prefers, rather than waiting for a separate increment.
- **D6 remaining deferred is the expected outcome**, not a failure of this ADR. If no forcing
  function ever arrives, `memberships` stays as it is, and that is a correct result.

## Re-analysis triggers

1. **AFF4 merges** — mandatory. Re-read this ADR against what AFF4 actually built; several
   observations above may have been overtaken by it.
2. **A new tenancy level is requested** — promotes D6 from deferred to proposable.
3. **An LGPD / DSR workstream starts** — raises D4's priority, since it supplies the table that work
   would otherwise have to invent.
4. **This ADR is still PROPOSED 30 days after AFF4's merge** — close it as declined rather than
   letting it sit; a stale PROPOSED ADR reads as a plan.

## Provenance and limits of this analysis

⚠ **Stated rather than hidden**, and the three grades of evidence here are deliberately not blended:

- **Measured on the live catalog** — every row of the *Measured figures* table (relation counts,
  policy counts, grants). Real, and stale the moment AFF4 lands.
- **Measured synthetically** — only the ancestry timings, on a fabricated tree in a rolled-back
  transaction. They compare *strategies against each other*; they are **not** a prediction of this
  system's latency, and the caveats in that section are part of the claim.
- **Inferred, not measured** — every difficulty estimate, every blast-radius consequence, and the
  whole sequencing argument. **No step was attempted.** ⛔ Do not promote an inference to a
  measurement by quoting it next to one.

⚠ **One load-bearing assumption is unverified:** that the 119 policies counted above mostly **call**
the role helpers rather than inlining role logic of their own. If a meaningful share inline it, D6's
blast radius is larger than stated and D5's discovery value is correspondingly higher. **Verify that
before scheduling anything.**
