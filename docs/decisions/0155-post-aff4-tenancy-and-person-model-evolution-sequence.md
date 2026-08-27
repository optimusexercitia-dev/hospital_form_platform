# ADR 0155 — Post-AFF4 tenancy and person-model evolution: a staged sequence, not a redesign

- **Status:** ACCEPTED (as amended) 2026-08-26 — PO-approved the same day the mandatory
  re-analysis trigger fired (AFF4 merged 2026-08-26). Originally PROPOSED 2026-08-26 as a
  sequencing sketch; re-analyzed against the post-AFF4 catalog, audited by the
  [authorization model evolution audit](../design/authorization-model-evolution-audit-2026-08-26.md)
  (2026-08-26, PO-endorsed), and amended by eleven PO-ratified decisions (§ Ratified decisions).
  ⛔ **Accepting this ADR authorizes the SEQUENCE as the plan of record. It builds nothing by
  itself** — every implementation phase enters through the normal phase machinery (§6 gate, PO
  approval per phase).
- **Related:** 0041 (tenancy shape) · 0078 (capability model + the methodology finding) ·
  0079 (door-blindness audit family) · 0097 / 0133 (affiliation) · 0106 (active-role assumption) ·
  0151 / 0154 / 0158 / 0159 (AFF4).
- **Amends:** 0151 — **D10's scheduling clause only.** D10 filed the `home_organization_id`
  Phase 2 follow-on as *"trigger: before multi-org is ever enabled; not pilot-blocking"*; D8 below
  promotes it to **pre-pilot** (implementation Phase 2). D10's substance — demoted-not-dropped,
  the open lifecycle-authority question — is unchanged.
- **Not amended by this ADR:** ADR 0041's tenancy shape. Only a future D6 build would amend it,
  and that proposal must carry the label then — this acceptance deliberately does not.
- **Origin:** a design review on 2026-08-26 conducted over the live catalog (the original PROPOSED
  draft; not a build session), then — the same day — AFF4's merge, the independent audit, a full
  catalog re-measure at migration head `20261003004300`, two application-side sweeps, and a PO
  grilling session that ratified the amendments. No code was changed by any of it.

## Context

Four observations, the first three from the original draft (all survived the post-AFF4
re-measure), all measured against the live catalog rather than read from migration text (the
ADR 0078 methodology finding).

**1. `memberships` states the same fact three times.** The role is explicit; `memberships_scope_shape`
constrains which scope column may be set *for that role*; the three partial indexes repeat the same
split; and every helper repeats it a fourth time as a `case p_scope_type` ladder.

> ⚠ **The common criticism of this table — "the role is derived from which column is non-null" — is
> backwards, and must not be carried into any redesign.** The CHECK reads
> `CASE role WHEN 'org_admin' THEN organization_id IS NOT NULL AND …`: the role is authoritative and
> the columns are constrained *by* it. The defect is **repetition**, not ambiguity. The distinction
> decides the fix — repetition is cured by extracting the shared knowledge, ambiguity would have
> required changing the storage (D6).

**2. The model has already grown three bolt-ons for things a unified model would have held.**

| Bolt-on | What it is really doing |
| --- | --- |
| `commission_administrativo_capabilities` | a second grant system, for one pseudo-role, with its own CHECK list and audit trigger |
| `hospital_affiliations` / `organization_affiliations` | a separate "where this person works" axis, distinct from authorization |
| `profiles.is_admin` | a platform-level role with no scope row to hang a membership on |

Three independent bolt-ons is the model indicating what it wanted to be.

**3. `profiles` protects the restricted personal-detail columns with column-level grants** —
`cpf`, `date_of_birth` and `phone` carry no grant to `authenticated` (re-verified 2026-08-26:
`REFERENCES` only), while eleven sibling columns carry full grants. That mechanism exists **only
because personal details share a row with authorization state and account lifecycle**. It works
(verified: a `select *` as `authenticated` is refused; a named-column select is admitted) but it is
a workaround for a table doing two jobs. ⚠ Naming corrected from the original draft's "the PII
columns" (audit F9): `full_name` and `email` are also personal data — what distinguishes these
three is the *withheld-by-column-grant* mechanism, not PII-ness.

**4. The duplication has an application-side half the original draft under-weighted** (audit F1,
measured 2026-08-26 in a dedicated sweep). The app maintains effectively **three hand-written role
vocabularies**: the session partition (`src/lib/queries/session-grants.ts`), the landing-route
precedence chain (`src/app/page.tsx`) **plus a deliberately hand-mirrored second copy of the same
routing table** (`landingRouteForRole`, `src/lib/role/role-catalog.ts`), and **six** pt-BR label
maps (one canonical, one full duplicate, four local commission-only ones). `session-grants.ts`'s
own header records **three occasions** on which a fully-provisioned role crossed neither app seam
and its holder landed on "Você ainda não tem acesso" (BUG-HAT-001, the Diretor Técnico,
`quality_reviewer`). Adding a role today is a coordinated change across the role CHECK, the
scope-shape CHECK, the `platform_role` enum, the grant/revoke kernel, the role helpers, and ≥ 8
application surfaces. **That — not the shape of `memberships` — is the dominant change cost**, and
it is what D7 exists to collapse.

## Ratified decisions (2026-08-26 grilling) — the approval's scope, written down

The PO ratified all eleven recommendations. Each is binding on the sequence below; the letters in
parentheses are the option chosen where alternatives were offered.

| # | Decision |
| --- | --- |
| **G1** | Pilot gate = implementation **Phases 0–4** (b). Phase 5 (remaining roles) is post-pilot, role-by-role. |
| **G2** | D4 is a **single-shot migration** pre-live (b) — no dual-write choreography. The dual-write contract becomes **mandatory for any comparable extraction once the pilot holds real data**. |
| **G3** | Extraction target: **`public.profile_private_details`** (a) — RLS + revoke-all + controlled doors, the platform's existing audited pattern; no new table-holding schema. |
| **G4** | Session context keeps **role-type semantics, declared final-for-now** (a). The selection vocabulary moves from the `platform_role` enum to the catalog during Phases 4–5. Exact-scope contexts require their own ADR. ADR 0106 unchanged. |
| **G5** | **One role per principal per commission stands**; the catalog inherits the constraint. Relaxing it later is an `ALTER`, not a redesign. |
| **G6** | **D5 is demoted** (a): not scheduled; its discovery value folds into D6's entry conditions. |
| **G7** | This ADR is amended **in place** to ACCEPTED; the audit is promoted out of `docs/design/temp/` to `docs/design/`; both land on the `authz-evolution-adr-0155` branch. |
| **G8** | Gate-apparatus re-pointing is **blocking per role**: a substitution increment ships its catalog-completeness / wrapper-coverage / direct-call-census / ACL / mutation arms in the same increment or does not merge. |
| **G9** | The program is **registered**: PROGRESS.md § Decisions row, § Now line, and `FUP-AFF4-HOMEORG-PHASE2` (index line + body) filed with this acceptance. |
| **G10** | Authz Phases 0–1 may start **in parallel** with the standing pre-pilot queue (b); **C1a keeps its queue position** — this program does not preempt the PHI-disposal rehearsal. |
| **G11** | Service-role hardening (a): the **nine person-authority raw-DML sites convert** to actor-validating doors; the system-actor and self-scoped sites are **manifested**, not converted. Detail in D9. |

## Decision — the amended sequence

### D0 — Ordering rule: AFF4 first — ✅ DISCHARGED 2026-08-26

AFF4 is through its §6 gate (e2e:prod exit 0, QA APPROVED, human-approved 2026-08-26), merged,
pushed, and schema-applied remotely. Two of D0's five reasons are corrected here because they were
committed and may have been read:

- **Reason 3 said** *"Every unfinished AFF4 task sits on a table these steps touch: B5 …, B6 …,
  B8 …, F5, B9"* — **stale by the Record step**: P1–P4 · B1–B9 · F0–F6 · T1–T6 all executed;
  nothing was deferred except 0151 D10's Phase 2 (now D8 below).
- **Reason 4 said** *"ADR 0151's own risk register forbids it"* — **misattributed**: the
  no-second-feature-branch rule lives in the AFF4 **plan's** Risks section
  (`docs/plans/aff4-org-affiliation.md`), not in ADR 0151. The rule held (the one branch that
  appeared took no numbers and was merged *into* AFF4) and dissolved with AFF4's merge.

### D1 — Finish AFF4, release the held DatePicker branch — ✅ DISCHARGED 2026-08-26

The hold dissolved by the mechanism the plan itself named: the DatePicker bucket merged **into**
AFF4 (`3d588673`) before AFF4 merged, so the §6 gate ran *with* those sites. Nothing left to
release.

### D2 — Harvest AFF4's rulings as design input, in writing

Kept; largely delivered by the audit, which records both rulings as reusable design rules:

- **ADR 0154's boundary-filter ruling** — filter at the data-access boundary in *both* surfaces,
  same parameter name, same default, one explicit widener. *(Narrowing can be wrong and safe;
  widening cannot.)* This rule is load-bearing again in D8's shadow comparison.
- **The INTERSECTION / SUBSET footprint resolver** (ADR 0133) — the shape of "authority bounded by
  a footprint rather than a role". ⚠ **Citation corrected** (both the original draft and the audit
  cite the wrong file): the semantics live in `personScopeAllows`,
  `src/lib/users/person-scope.ts` — `person-footprint.ts` resolves the footprint and *delegates*.

Remainder: cite both at the program's first Record step. Cost: documentation only.

### D3 — Name the affiliation ≠ authorization split in ARCHITECTURE.md

Kept, and the gap is now **measured**, not assumed: ARCHITECTURE.md contains **zero** occurrences
of "affiliation" in any language (swept 2026-08-26). The rule exists only in scattered module
comments (`check-memberships-door.mjs`, `person-footprint.ts`) — the exact prose-rot failure mode
this repo keeps paying for. The rule to add: **affiliations are visibility and lifecycle inputs
and NEVER grant capabilities**; CONTEXT.md already carries the glossary half. Cost: documentation
only; lands in implementation Phase 2 alongside D8.

### D4 — Extract the restricted personal-detail columns out of `profiles` (amended: G2, G3)

- Extract **exactly** `cpf`, `date_of_birth`, `phone` into **`public.profile_private_details`**
  (keyed `profile_id` PK/FK → `profiles.id`), preserving CPF validation and uniqueness semantics.
  Named for what it is — the withheld-by-grant columns — **not** "the PII table"; do not claim all
  PII is isolated (audit F9).
- Protection is the platform's existing audited pattern (G3): RLS enabled immediately,
  revoke-all, exact controlled doors for self and authorized-administrator reads/writes — the
  shape the three PHI modules already use, which the ARM family and door sweeps already know how
  to audit. This **retires column-level grants as a mechanism** and gives LGPD/DSR work a single
  table to point at; `guard_profile_privileged_columns` loses its identity half.
- **Migration contract (G2): single-shot, pre-live.** One migration set creates, backfills,
  re-points the readers (SQL functions + service-role application readers), and drops the three
  columns. The gate is the access-test matrix — self · same-scope admin · wrong hospital · wrong
  org · inactive actor · service-role orchestration — plus null-count/CPF-uniqueness/row-hash
  comparison in a non-PHI audit output; **not** rollout staging. Rationale, recorded so it is not
  re-derived: the remote holds only the E2E seed fixture (no real customer data — re-measure,
  never quote), and a dual-write window is a two-writer disagreement surface with no audience.
  ⛔ **Once the pilot holds real data, the audit §7 Phase 3 dual-write contract is the mandatory
  shape for any comparable extraction.**
- ⛔ **NOT a `persons` / `accounts` split.** `profiles.id` remains the person key; the **93
  FK-bearing tables** (145 constraints — count tables, not constraints, when quoting this;
  re-verified 2026-08-26) never move.
- ⛔ **`is_active` is explicitly OUT of scope.** It is read at STEP 2 of every `app._case_caps`
  call *and* inside every role probe — the hottest read in the system. Moving it puts a join on
  the hot path of every RLS check for no design gain.

### D5 — Extract the hierarchy walk into `app.scope_chain(…)` — ⭕ DEMOTED (G6): not scheduled

The original step is preserved here because it was committed and may have been read: *introduce
`app.scope_chain(…)` returning the ordered ancestry and have the tenancy helpers call it —
"No migration. No RLS performance change… Fully reversible… Its real value is discovery."*

Two amendments retire it from the sequence:

1. **The performance claim is retracted as unproven** (audit correction 2): "same reads against
   the same indexes" does not prove "no performance change" — function/SRF shape affects planning
   and invocation count. Had D5 stayed scheduled it would have carried a benchmark gate.
2. **Its discovery value has been mostly delivered** by the audit's findings and the catalog
   re-measure, and D8 touches the same callers with an actual payoff attached. What remains folds
   into **D6's entry conditions**: any D6 proposal must carry the complete enumeration of
   hierarchy-encoding callers that D5 would have produced.

### D6 — The `scopes`-table migration stays deferred; forcing functions broadened

Deferred, explicitly, not rejected. Before it may be **re-proposed**, both must hold:

1. **A forcing function — broadened** (audit): a concrete new tenancy level (department, hospital
   network) **or** a new standing non-tenancy scope **or** an exact-assignment-context requirement
   that cannot be represented safely under G4's role-type semantics **or** repeated inheritance
   logic whose *measured* cost exceeds the registry migration cost. The original draft named only
   the first, too narrowly.
2. **`EXPLAIN (ANALYZE, BUFFERS)` evidence on the hot read paths** — the ADR 0078 A5 discipline,
   gated *before* any policy is repointed. ⛔ **Unchanged by the benchmark below**: a synthetic
   measurement narrows the design space, it does not discharge a gate on real data.

⚠ **The benchmark below constrains the SHAPE of any future D6 proposal**: a per-row ancestry
function is ruled out on the measured numbers; a proposal must carry a closure table (or the
per-statement `my_reachable_scopes()` hoist) to be considered at all. Domain office constraints
(one titular technical director) stay declarative via carried discriminators + composite FKs —
never a generic trigger. If taken up, D6 amends ADR 0041 and must carry the label — no gate can
detect a missing one.

### D7 — NEW: a migration-managed role/permission catalog, adopted by role-by-role direct substitution

**Reverses this ADR's own original rejection** of "roles and capabilities fully as data"
(preserved verbatim under Rejected alternatives). What changed the verdict is not the gains —
those were always acknowledged — but the audit's observation that **the platform being pre-live
dissolves the rejection's mechanism**: adoption needs no runtime shadow evaluation, so at every
moment each role has **exactly one authoritative evaluator**, and the ADR 0079 gate family
survives because the RLS **wrapper names stay stable** while their implementations delegate.
`memberships`, its three concrete scope columns, and every domain table stay as they are.

- **Storage:** a non-exposed `authz` schema with explicit default privileges — `authz.roles`,
  `authz.permissions`, `authz.role_permissions`, `authz.permission_implications` (acyclic; must
  preserve the current PHI/write separations: content read ⇏ PHI, PHI ⇏ write, restrictions
  before positive sources). Rows are inserted by migrations only; application roles get **no
  DML**. **Tenant-authored roles remain forbidden.** Permission codes are stable, action-oriented
  strings (`case.content.read`, `commission.membership.manage`, …), statically greppable at the
  enforcement wrappers.
- **Adoption — direct substitution, `staff_admin` first** (canonical role key kept unless a
  deliberate rename from the UI label is separately approved). Per role: derive the complete
  permission matrix from memberships, policies, helpers, mutation commands, session selection,
  routes and UI guards; seed the bundle; prove **legacy ≡ catalog in pgTAP over identical
  exhaustive fixtures** (a pre-cutover test oracle, **never** a runtime authorization mode);
  atomically cut the stable wrapper family over to the resolver; inventory and replace or
  explicitly allowlist every direct `has_role(…, '<role>')` bypass; then remove the legacy
  branch, retaining a forward rollback migration. Unmigrated roles have exactly three states —
  `legacy`, `test_validation`, `authoritative` — and `test_validation` never affects runtime.
  ⛔ **Never `legacy_allowed OR new_allowed`; callers never select their evaluator.**
- **G8, binding:** a role's substitution increment ships its gate re-pointing **in the same
  increment** — catalog-completeness, wrapper-coverage, direct-call census, ACL and mutation
  arms. A substitution whose arms are not re-pointed does not merge. Once a role is
  authoritative, its approved permission matrix — not a retained runtime shadow — is the
  regression oracle.
- **G5:** one role per principal per commission stands; the catalog inherits the constraint.
- **G4:** session context keeps role-type semantics (final-for-now); the selection vocabulary
  moves from the `platform_role` enum to the catalog during adoption; exact-scope contexts
  require their own ADR. No effective permission list ever goes in the JWT.
- **Domain adapters, not a universal interpreter:** the case capability lattice, recusals and
  respondent denies, clinical qualification validators, `case_access_grants`, and the
  Administrativo appointment tables all stay where they are, adapted to the shared vocabulary.
  Never query an arbitrary table from a caller-provided resource type.

### D8 — NEW: 0151 D10's Phase 2 is scheduled pre-pilot (the clause this ADR amends)

The audit's largest-tenancy-gap finding (F3): AFF4 separated affiliation from authorization, but
the RLS legs and the tenant trigger intentionally stayed on `profiles.home_organization_id` — and
the named follow-on had **no register line anywhere**; it existed only as ADR prose plus echoes.
Filed 2026-08-26 as **`FUP-AFF4-HOMEORG-PHASE2`** (PROGRESS.md index + body), and promoted from
*"before multi-org, not pilot-blocking"* to **implementation Phase 2, pre-pilot** — a coherence
prerequisite for D7, which must not seed permission matrices against a containment anchor
scheduled to disappear. The increment must: migrate every remaining visibility/containment
decision off the column; **explicitly re-answer lifecycle authority over fully-offboarded
persons** (0151 D10's open question, unchanged by this ADR); shadow old/new visibility decisions
and **block every unexplained widening** (D2's rule applied); and demote or remove the column only
after a caller inventory.

### D9 — NEW: independent integrity and privilege debt closes first (audit F4/F5/F7/F8)

None of this waits for the catalog:

- **F7** — `commission_administrativos` carries exactly **one** FK (`appointed_by → profiles`;
  verified in the catalog 2026-08-26). Orphan-preflight, deliberate repair, then add
  `commission_id → commissions` and `user_id → profiles` with a production-safe validation
  sequence.
- **F5** — classify every authenticated-executable DEFINER (public command door / policy
  predicate / trigger / internal helper); revoke EXECUTE where the classification does not
  require it; set explicit default privileges for every object owner in `public`, `app`, and
  `authz`; track reachable-definer count as a security budget. Re-measured 2026-08-26:
  **432** (`public`) + **320** (`app`) DEFINERs executable by `authenticated`; `anon`-executable
  `app` functions grew **167 → 237** across the five migrations after the audit's snapshot —
  inert today (`anon` lacks schema USAGE;
  `FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED`) but accumulating in the wrong direction.
- **F4 (G11)** — measured 2026-08-26 in a dedicated sweep: **12 raw service-role DML sites**
  whose only authorization is a TypeScript predicate before an RLS-bypassing write. The **nine
  person-authority sites convert** to actor-validating `*_for` doors — five `profiles` writes
  (invite patch; person fields; deactivate / reactivate / suspend — **the platform kill
  switch**) and four `professional_credentials` writes, all in `src/lib/users/actions.ts`; the
  pattern, SQLSTATE discipline and gate arms already exist, so conversion is mechanical. The
  self-scoped `must_change_password` write and the `meeting_minutes_jobs` webhook/cron sites are
  **manifested, not converted** — they have no human principal, and forcing them through a
  person-actor door would fabricate an actor. Every service-role DML target (Storage and
  Auth-admin writes included) gets a registry entry naming owner, reason, revalidation function,
  audit event, and mutation test. ⚠ The raw-DML lint gate today covers exactly **two** table
  names and is client-blind — the registry, not that gate, is the closing instrument.
- **F8** — triage the advisor's initplan / multiple-permissive warnings; benchmark and repair the
  hot, high-cardinality subset; capture `EXPLAIN (ANALYZE, BUFFERS)` baselines **before** any
  substitution so a regression is attributable to its cause.

### D10 — NEW: the pre-pilot cutline and the queue (G1, G10)

- **The pilot gate is implementation Phases 0–4**: baseline, hardening, home-org Phase 2, the
  restricted-detail extraction, and the catalog with `staff_admin` substituted end-to-end.
- **Phase 5 (remaining roles) is post-pilot**, role-by-role. An unmigrated role runs the current,
  tested evaluator — exactly what would have run anyway; the mixed state is safe by construction
  under D7's single-evaluator rule.
- **Phase 6 is decided now** (G4): no open product decision remains on session granularity.
- **Phase 7 = D6**, deferred.
- **Queue (G10):** Phases 0–1 may start immediately, in parallel with the standing pre-pilot
  queue. **C1a (the PHI-disposal rehearsal) keeps its queue position** — a new program is the
  classic way a 🔴 rehearsal item silently ages, so this ADR states explicitly that it does not
  preempt it.

## Implementation sequence — plan of record

The phase detail lives in the audit
([§7](../design/authorization-model-evolution-audit-2026-08-26.md)) and is deliberately **not
restated here** — a second copy is the one that drifts. The amendments that override it, by phase:

| Phase | As audited | Amended |
| --- | --- | --- |
| 0 — baseline & re-measure | as written | unchanged (this ADR's figures are its first input) |
| 1 — integrity & privilege debt | manifest service-role targets | **G11**: convert the nine person-authority sites; manifest the rest (D9) |
| 2 — affiliation/person split completion | as written | **D8**: pre-pilot (amends 0151 D10's scheduling); carries D3's ARCHITECTURE.md rule |
| 3 — restricted-detail extraction | dual-write rollout | **G2**: single-shot pre-live; dual-write binds post-pilot (D4) |
| 4 — catalog + `staff_admin` substitution | as written | **G8**: gate re-pointing blocks the merge (D7) |
| 5 — remaining roles | as written | **post-pilot** (G1) |
| 6 — context granularity | product decision required | **decided**: role-type semantics final-for-now (G4) |
| 7 — generic scopes | when justified | = D6, deferred, triggers broadened |

The audit's §8 decision-and-test matrix binds every substitution; its remaining open product
questions (inheritance per permission, high-risk permission ceilings, revocation SLA) are
Phase 4/5 per-role inputs, resolved with each role's matrix approval.

## Why D6 differs in kind from D4 and D7

Three costs that are invisible in a schema diff — **two serious, and a third that measurement
downgraded from a blocker to a checklist item** (see the correction under 3):

1. **RLS performance.** The role helpers run **per row**, and most policies call them (re-measured
   2026-08-26: **131 of 278** policies match the role-helper family by the predicate recorded
   under Measured figures). D6 replaces a partial-index probe with a tree walk on the hot path of
   every case, meeting and document read. Mitigable — but the mitigation must be picked on
   evidence, so it was **measured**: see *Measured — what ancestry actually costs under RLS*.
2. ⭐ **It invalidates the authorization gate apparatus itself.** `ARM=census` / `hat` / `floor` /
   `wrapper` and the door sweeps work by **statically analysing SQL for role checks**. Change how
   roles are **stored** and checked and every committed finding baseline is void — you would be
   rebuilding the audit apparatus at the same time as the thing it audits, with no trustworthy
   baseline in between. ⚠ **D7 is deliberately shaped to dodge this cost**: it keeps the storage,
   keeps the wrapper names, and re-points the arms role-by-role under G8 — which is precisely why
   the catalog was acceptable and D6 still is not. This repo's own recorded trap, at program
   scale: *where two defects share a symptom, fixing one and re-running looks exactly like fixing
   both.*
3. **A constraint class that must be deliberately restored — but it *does* survive.**
   ⛔ **CORRECTED 2026-08-26, and the original claim is kept here because it was committed and may
   have been read.** This item originally said: *"`UNIQUE (hospital_id) WHERE role =
   'technical_director'` has no `hospital_id` column to sit on once scope is a single `scope_id`,
   and falls back to a trigger — later, slower, and racy under concurrency."* **That is false**,
   and it was refuted by building the shape rather than reasoning about it.

   With `scope_kind` denormalized onto `role_grants` and held honest by **composite** foreign
   keys, all four rules hold as declarative constraints. Measured in a rolled-back transaction,
   2026-08-26:

   | Attempt | Outcome | Enforced by |
   | --- | --- | --- |
   | second `technical_director` at the same hospital | **rejected** | `UNIQUE (scope_id) WHERE role = 'technical_director'` |
   | second role for one principal at the same commission | **rejected** | `UNIQUE (principal_id, scope_id) WHERE scope_kind = 'commission'` |
   | `technical_director` granted at a *commission* | **rejected** | FK `(role, scope_kind)` → `roles(key, grantable_at_kind)` |
   | a row claiming a `scope_kind` its scope does not have | **rejected** | FK `(scope_id, scope_kind)` → `scopes(id, kind)` |

   ⭐ **The `unique (id, kind)` constraint on `scopes` pays for itself twice.** It is what makes
   the typed FK legal *and* what lets `kind` be carried down onto `role_grants` without becoming
   forgeable. Once the discriminating column is back, partial-index constraints come back with it.

   ⭐ **On the tier rule the new shape is strictly better.** Today a role's tier is one branch of a
   ten-way `CASE` in `memberships_scope_shape`, edited for every role added. The composite FK to
   `roles(key, grantable_at_kind)` replaces that whole `CASE` with one constraint that is never
   edited again — and adding a role becomes an `INSERT`. *(Under D7 this benefit arrives earlier
   and cheaper: the catalog's `allowed_scope_kind` carries the same knowledge without touching the
   storage.)*

   **The residual cost, which is real but small:** one extra column per grant row, and the
   discriminator must actually be carried. ⚠ **Forget it and the constraints vanish silently** —
   nothing errors, the rules simply stop being enforceable. That is a checklist item for any D6
   proposal, not an argument against one.

> ⚠ **The general form, corrected.** The original wording here — *"a more generic schema makes
> specific constraints harder to express"* — is too broad, and being too broad is exactly what
> produced the false claim above. The accurate form:
>
> **A generic schema loses a constraint only when the DISCRIMINATING COLUMN disappears. Carry the
> discriminator back in, and keep it honest with a composite FK rather than a trigger, and the
> constraint returns as an index.**

## Measured — what ancestry actually costs under RLS (2026-08-26, synthetic)

Cost 1 above was quantified rather than left as a judgement. A synthetic tenancy tree was built in
a **rolled-back transaction** on the local stack — 226 scopes (1 platform · 5 organizations ·
20 hospitals · 200 commissions), **depth 4**, an 871-row closure table, two grants for the test
principal, and 10 000 rows carrying a `scope_id`. Each strategy was expressed as a `STABLE`
boolean function and evaluated **once per row**, which is what an RLS predicate does.

| Strategy | Time (10 000 rows) | Rows matched |
| --- | --- | --- |
| Flat probe — one index lookup, **no inheritance** | 27–31 ms | 50 |
| Recursive CTE, per row | **644–790 ms** | 2050 |
| `ltree` path containment | 511–518 ms | 2050 |
| **Closure table** | **102–113 ms** | 2050 |

**Three findings.**

1. **The naive form is a different complexity class, not a constant factor.** Per call, a
   recursive CTE materialises a working table, runs the seed, iterates until an iteration returns
   zero rows (depth 4 → five iterations), then tears down. The index lookups are the cheap part;
   the executor machinery is the cost, and it is paid 10 000 times.
2. ⭐ **A closure table puts D6's read cost roughly back where it is today.** At ~4× a single flat
   probe — and today's hardcoded hierarchy walk is already a small fixed number of probes —
   precomputing every `(descendant, ancestor)` pair moves the recursion to **write** time, where a
   tenancy tree changes almost never. **This is the finding that would make D6 implementable at
   all if a forcing function arrives**; without it, D6 should be assumed infeasible on the hot
   paths.
3. **`ltree` is the wrong tool for this particular question.** It excels at *descendant* queries.
   An authorization check asks the *ancestor* question, which a closure table answers in one index
   lookup.

### ⭐ The mitigation that outranks all three: stop asking the question per row

`app._case_caps(cases.id, auth.uid())` cannot be hoisted out of the per-row loop, because
`cases.id` varies per row — `STABLE` permits reuse only for *identical* arguments. (Same mechanism
as the register's `professional_credentials_select` item: bare `auth.uid()` evaluates per row,
while `( SELECT auth.uid() )` becomes an InitPlan and evaluates once.)

A function taking **no per-row argument** does become an InitPlan:

```sql
create function app.my_reachable_scopes() returns setof uuid stable ...  -- ONCE per statement
-- policy:  using (scope_id in (select app.my_reachable_scopes()))
```

The recursion then runs once per statement instead of once per row, and the per-row test collapses
to a hash lookup. This is the move `_case_caps` already makes one level down — compute an integer
once, then answer seven questions with bit tests — applied to the scope tree. **Any serious D6
proposal must carry this shape or a closure table; a per-row ancestry function is not
proposable.**

⚠ **Limits of this benchmark, stated so it is not later quoted as a fact.** Synthetic; warm cache;
single connection; no concurrency. The flat row **answers a different question** — 50 hits against
2050, because it cannot see the inherited organization grant — so it is a floor for comparison,
not a candidate. Only two grants for the test principal, one tree shape, one depth; the `ltree`
figure is additionally formulation-dependent and must not be quoted as a bound on that type.
**Re-measure against real data before any scheduling decision** — D6's condition 2 is unchanged.

## Rejected alternatives

- **Roles and capabilities fully as data** (`roles` / `capabilities` / `role_capabilities`
  tables) — ⛔ **REVERSED 2026-08-26 by D7**; the original rejection is preserved because it was
  committed: *"Rejected for now because role checks stop being statically greppable, and that
  property is the mechanism the entire ADR 0079 gate family depends on… Revisit only alongside D6,
  never separately."* The reversal does **not** refute the concern — it routes around it: D7
  keeps wrapper names stable and greppable, keeps permission codes greppable at the wrappers,
  re-points the arms per role under G8, and is possible *without* D6 precisely because the scope
  storage does not change. The half that stands: **tenant-authored roles remain forbidden**, and
  runtime-flexible evaluation (shadow modes, caller-selected evaluators) stays rejected.
- **Any step before AFF4 merges** — moot; D0 discharged.
- **Splitting `profiles` into `persons` + `accounts` wholesale** — still rejected (93-FK blast
  radius, re-verified 2026-08-26). Revisit only for non-login people, service principals, merged
  identities, or an independent account/person lifecycle.
- **Moving `is_active` as part of D4** — still rejected on the hot-path argument.
- **A non-exposed identity schema for `profile_private_details`** — rejected (G3) in favour of the
  platform's existing `public` + RLS + doors pattern; a second table-holding schema adds a
  mechanism without an additional enforced property.
- **Exact-scope session contexts before the pilot** — rejected (G4); requires its own ADR if a
  need materialises.

## Measured figures (2026-08-26, local catalog at head `20261003004300`) — ⛔ re-measure before acting on any of them

| Figure | Value | Predicate / note | Bears on |
| --- | --- | --- | --- |
| `public` tables with RLS | **170/170** | `pg_class.relrowsecurity`, relkind `r` | baseline |
| `public` policies | **278** | `pg_policies` | D6/D7 |
| Policies calling a role helper | **131** of 278 | qual‖with_check ~ `has_role\|is_admin\|is_org_admin\|is_hospital_admin\|is_staff_admin\|is_member_of\|is_nsp_\|is_commission_admin` — the audit's 117 used a narrower family list; **quote the predicate with the figure** | D6 (RLS perf) |
| Policies reading `memberships` directly | **4** | qual‖with_check ~* `memberships` — ⭐ **closes the original draft's one unverified load-bearing assumption**: policies delegate to helpers; D6's blast radius is as stated | D6/D7 |
| Functions reading `memberships` | **41** | `public`+`app`, comment-stripped `prosrc` | D7 |
| `app.can_*` functions | **51** | — | F2 |
| SECURITY DEFINER functions | **454** `public` + **389** `app` | — | F5 |
| …executable by `authenticated` | **432** + **320** | `has_function_privilege` | F5 |
| `anon`-executable `app` functions | **237** (was 167 at the audit's snapshot) | effective EXECUTE incl. PUBLIC residue; inert — `anon` lacks schema USAGE | F5 |
| Tables with an FK to `profiles` | **93** (145 constraints) | count **tables**, not constraints | D4 |
| `commission_administrativos` FKs | **1** (`appointed_by`) | `pg_constraint` | F7 |
| Withheld `profiles` columns | 3 (`cpf`, `date_of_birth`, `phone`) | `REFERENCES`-only for `authenticated` | D4 |
| App-side raw service-role DML sites | **12** (9 person-authority) | dedicated sweep, `createAdminClient()` call sites | D9/G11 |

The original draft's figures (283 policies / 119 role-helper / 45 `profiles`-reading functions /
25 app call sites) were measured pre-AFF4-completion and are superseded above — their staleness
within a single day is itself the argument for Phase 0's re-measure step.

## Consequences

- **The sequence is the plan of record; nothing is built by this ADR.** Each phase enters through
  the normal phase machinery with its own gate and PO approval. G1 fixes what the pilot waits for.
- **ADR 0151 D10's scheduling is amended** (pre-pilot, was not-pilot-blocking); its substance is
  not. `FUP-AFF4-HOMEORG-PHASE2` is the register line the follow-on never had.
- **D4 and D9 are independent** of the catalog and of each other, and independently revertible.
- **D5 is not scheduled**; its residue lives in D6's entry conditions.
- **D6 remaining deferred is the expected outcome**, not a failure of this ADR. If no forcing
  function ever arrives, `memberships` stays as it is, and that is a correct result.
- **The audit is the detail authority for phase content**; this ADR is the authority for what was
  *decided*. Where they disagree, this ADR wins, then must be amended to say why.

## Re-analysis triggers

1. ~~AFF4 merges~~ — **fired and discharged 2026-08-26** (this acceptance is its output).
2. **Pilot data-load** — G2's boundary: from that point the dual-write extraction contract binds,
   and the "safe to touch pre-live" premises above expire. Re-read D4 and D9 before any
   comparable migration after it.
3. **A D6 forcing function arrives** (broadened list in D6) — promotes D6 from deferred to
   proposable, with its entry conditions.
4. **Phase 5's last role substitutes** — re-read D7: the legacy evaluator, the `platform_role`
   enum's remaining consumers, and the role-name-grep arms should all be retired by then; whatever
   remains is debt to file.
5. **An LGPD / DSR workstream starts** — D4's extraction supplies the table that work would
   otherwise have to invent; align rather than duplicate.

## Provenance and limits of this analysis

⚠ **Stated rather than hidden**, and the grades of evidence are deliberately not blended:

- **Measured on the live catalog** — every row of the Measured figures table, at head
  `20261003004300`, 2026-08-26. Real, and stale the moment the next migration lands.
- **Measured in the application source** — the role-vocabulary and service-role sweeps (dedicated
  read-only agents, 2026-08-26); the `person-scope.ts` citation correction.
- **Measured synthetically** — the ancestry timings and the constraint-feasibility results, with
  the limits stated inline; the constraint results transfer (facts about PostgreSQL semantics),
  the timings compare strategies only.
- **Ratified, not measured** — G1–G11 are PO decisions made 2026-08-26 on the evidence above;
  their scope is recorded in § Ratified decisions precisely so it is never reconstructed from
  memory.
- **Inferred, not measured** — difficulty estimates and blast-radius consequences of phases not
  yet attempted. ⛔ Do not promote an inference to a measurement by quoting it next to one.

The original draft's closing caveat — *"the 119-policy helper assumption is unverified"* — is
**closed**: 4 of 278 policies read `memberships` directly; the rest delegate.
