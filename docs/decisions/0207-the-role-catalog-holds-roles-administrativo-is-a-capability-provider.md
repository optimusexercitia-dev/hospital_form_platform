# ADR 0207 — The role catalog holds roles: `administrativo` becomes a capability-provider namespace whose entitlement source is each individual capability, and `platform_role` retires

**Status:** Accepted (2026-09-11, PO rulings — unit AE5-SUCCESSOR-ADRS)
**Date:** 2026-09-11
**Area:** authorization / role catalog
**Amends:** ADR [0176](./0176-authz-permission-layer-made-real.md) — **D8's bundle is decided.** D8 lists four items and forbids picking any off inside a role increment; its **F6** slot was already decided elsewhere (see Related), and this ADR decides the other three — **F8** (`administrativo` out of `authz.roles`), the **`platform_role` retirement**, **F7** (one manifest entry per role). D8's *"⛔ None may be picked off inside a role increment"* is **preserved and given a carrier**: the build lands as one named unit before the first increment, never inside one. D8's classification-columns clause is untouched (settled separately — see Related).
**Related:** ADR [0201](./0201-the-keying-asymmetry-is-the-model.md) (the role-wide hat D1 keeps `administrativo` outside of) · ADR [0203](./0203-the-seam-is-already-encoded-the-classification-columns-are-not.md) (Batch 9's other opening ADR) · ADR [0205](./0205-per-object-grant-plane-convention.md) (D11 — the capability plane is explicitly OUTSIDE the per-object grant convention; D6·4 — *"an administrativo never grants"*) · ADR [0197](./0197-data-access-registries-are-generated-not-maintained.md) (the generated-artifact `--check` pattern D4 adopts) · ADR [0061](./0061-administrativo-delegated-role.md) (the delegated capability grant) · ADR [0134](./0134-case-surface-split-and-administrativo-case-read.md) (Amdt 6 — `app.member_can_for`)
⚠ **Numbering.** `docs/plans/pre-ae5-remediation.md` §3 item 5 reserved **0202** for this subject, says it *"never will"* be filled, and offers *"renumber the deferred pair and say so here"*. The PO took that branch on 2026-09-11. Re-measured at reservation: the highest ADR on **any** live ref (3 local + 4 remote) is **0206**, and a sweep for `0202|0204|0207|0208` across every ref returns 0 rows ⇒ **0207**. Every sentence naming *"ADR 0202"* as reserved carries a dated note pointing here.

---

## Context

**Everything below is measured on the live catalog** (ADR 0078 — migration text is stale by design),
container `supabase_db_azkbbhskturikxpgmafq`, witnessed in `docs/progress/ae5-successor-adrs.md`
§ Session log, entry *2026-09-11 — verification of the rulings' cited facts (backend)*: 10 of the 14
facts the PO's rulings cite reproduce exactly, 4 differ. The four corrections are carried **as
facts**, at the PO's unchanged intent, each marked ⚠ beside the clause it changes.

The implementation audit of `authz-ae4-catalog`
(`docs/reviews/authz-evolution-implementation-audit-2026-09-02.md`) raised two MODERATE findings this
ADR closes. **F8** (`:360-376`) — *"the role table contains something explicitly declared not to be a
role"*:

> The role seed inserts 12 rows: 11 platform roles plus `administrativo`. Its own comments say
> `administrativo` is "NOT A ROLE" and assign the structurally unreachable `capability_plane` scope
> kind to keep it out of memberships […] This makes `authz.roles` and `role_permissions.role_code`
> lie about their domain. […] Avoid solving this with more sentinel scope kinds. The need for an
> unreachable value is evidence that the table's abstraction is wrong.

**F7** (`:337-358`) — *"the TypeScript seam is shallower than advertised"*:

> However, a future role still crosses multiple declarations […] `ROLE_MANIFEST` merely zips the
> first three sources […] they do not provide one local extension seam. Deepen the module: define one
> ordered manifest entry with code, label, assignment scope, selection status, landing branch,
> fallback/summary strategy, and precedence. Derive the compatibility exports and branch lists from
> it.

**What 0176 D8 said**, verbatim, and why this ADR is its carrier:

> **D8 — Explicitly NOT decided; bundled into the AE5 plan and decided together:** F6
> exact-assignment active context vs the role-wide hat (audit scope must match whichever wins); F8
> `administrativo` out of `authz.roles` (a 12th row under an unreachable `capability_plane` sentinel
> whose own comment says NOT A ROLE); `platform_role` retirement; F7 one manifest entry per role in
> `role-catalog.ts`. All are pre-users design choices, none blocks the AE4 merge, and one
> compatibility migration beats four. ⛔ None may be picked off inside a role increment.

## Problem

**F8:** `authz.roles` carries a row its own seed comment calls *NOT A ROLE*, held out of
`memberships` by a sentinel scope kind every future constraint must remember (the TypeScript binding
already filters it — 12 DB rows vs 11 selectable roles). **`platform_role`:** a Postgres enum
duplicates the catalog's role vocabulary and is the half no catalog constraint watches. **F7:**
adding a role means editing five declarations in one file, three of which type exhaustiveness covers
and two of which it does not. ⛔ None may be solved inside a role increment (0176 D8), so they need a
carrier that runs **before** the first increment — which is what this ADR names.

## Decision

### D1 — `administrativo` LEAVES `authz.roles`; the entitlement source is each individual capability, never one bundle

The PO's refinement of the lead's proposal, verbatim:

> `administrativo` leave `authz.roles`. I would make one refinement to the proposal: administrativo
> should be a capability-provider namespace, but the actual entitlement source must be each
> individual capability—not one administrativo bundle.

```
memberships / profiles.is_admin
        → role assignment adapter → role_permissions ┐
                                                     ├→ entitlement seam → has_permission → app.can_*
administrativo capability rows
        → capability adapter → capability_permissions┘
```

> Do not put administrativo into assignment_facts, and do not make it produce a fake role_code. The
> existing resolver is explicitly role-shaped—role_code, role_state, and hat_ok (resolver
> `supabase/migrations/20261003007250_ae49_d4_resolver_contract.sql:208`). The provider-neutral seam
> should sit above that implementation while preserving the stable authz.has_permission interface.

**Measured, so it holds in the catalog and not only in the file:**
`authz.entailed_grants(uuid,text,uuid,text)` returns `TABLE(role_code text, granting_permission_code
text, role_state text, hat_ok boolean)` and reads `from authz.assignment_facts(p_principal) af join
authz.roles r on r.code = af.role_code`. ⇒ the seam goes **above** it; `authz.has_permission` keeps
its signature and its meaning.

### D2 — The capability→permission mapping constraints

The PO's list, verbatim:

> The mapping must preserve the measured capability boundaries:
> - read_cases → commission.cases.read
> - view_signoffs → commission.signoffs.read
> - schedule_meetings, create_cases, and assign_case_phases need narrower codes or carefully split
>   mappings. They must not simply receive commission.meetings.manage or commission.cases.manage:
>   those existing permissions cover much broader surfaces.
> - bulk_create_cases must continue requiring both create and assignment entitlements.
> - Creation-scoped patient entry must not become standing PHI-write authority.
> - Appointment alone grants nothing; feature flag, active account, current commission membership,
>   and the concrete capability row remain mandatory.
> - Administrativo remains hat-independent—it is delegated authority layered onto membership, not a
>   selectable hat.
> - It must never receive authority/lifecycle capabilities such as staff management, case-access
>   granting, case closure, reserved-session authorship, or signing.

⚠ **Correction carried as a measured fact — the vocabulary is FIVE capabilities and one DOOR.**
`read_cases` is not an enum label anywhere; the vocabulary is a CHECK on a column:

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.commission_administrativo_capabilities'::regclass;
-- commission_administrativo_capabilities_capability_check :: CHECK ((capability = ANY (ARRAY[
--   'schedule_meetings','create_cases','assign_case_phases','view_signoffs','read_cases'])))
```

`bulk_create_cases` is **not** in that array. It is `public.bulk_create_cases(p_template_id uuid,
p_deadline date, p_phase_scope text, p_rows jsonb)`, `prosecdef = true`, whose **live body** carries
`or (app.member_can(v_commission_id, 'create_cases') and app.member_can(v_commission_id,
'assign_case_phases'))`. ⇒ the PO's sentence is correct as written and describes a **door-level
invariant to preserve**, not a capability to map: after the cutover the conjunction must still hold
over whatever codes `create_cases` and `assign_case_phases` map to. A mapping that hands the door one
broad code silently discharges it.

⚠ `member_can` is **two** functions, both `prosecdef`, both `returns boolean` —
`app.member_can(p_commission_id uuid, p_capability text)` (resolves `auth.uid()`) and
`app.member_can_for(p_commission_id uuid, p_capability text, p_user_id uuid)` (the third-party form;
`app._case_caps`' S8 arm calls it, ADR 0134 Amdt 6). Both are in scope for item 6; neither moves
before it (D5).

⛔ **The three narrower codes are NOT chosen here.** All four codes the PO names exist today
(`commission.cases.read`, `commission.signoffs.read`, `commission.meetings.manage`,
`commission.cases.manage`, of 43 in `authz.permissions`); what `schedule_meetings`, `create_cases`
and `assign_case_phases` map to is **owed** — § Consequences.

### D3 — `platform_role` is RETIRED

Chosen as offered (the recommended option): the column re-types to catalog-validated text with an FK
to `authz.roles(code)`; `public.assume_role` becomes **one non-overloaded text signature** validating
`session_selectable` **and the caller's real assignment**; the enum is dropped **last**, after its
dependencies are gone; the TypeScript type derives from the catalog, not from the generated enum.
Measured: `public.assume_role(platform_role)` is `prosecdef = true`, is the enum's only routine
dependent, and is not overloaded.

### D4 — F7: one ordered manifest entry, compat exports derived, the binding test becomes a generated-artifact gate

Chosen as offered. One ordered manifest entry per role carries code, label, assignment scope,
selection status, landing branch, fallback/summary strategy and precedence; `ROLE_LABELS`,
`ROLE_SCOPE_KIND`, `ROLE_ORDER`, `ROLE_BRANCH` and the `scopeSummary` role-group switch become
**derived compatibility exports**, not five parallel sources; `PlatformRole` is inferred from the
manifest (today `src/lib/role/role-catalog.ts:39` reads
`Database["public"]["Enums"]["platform_role"]`, which D3 removes); the binding test becomes a
**generated-artifact `--check` gate** on ADR 0197's pattern — generated from migration-owned catalog
data, a text-only gate in `npm run lint` proving the committed artifact current, a pgTAP assertion in
`npm run test:db` proving the pin equals the catalog. ⛔ Neither half alone is the verdict (0197 D4).

⭐ **Measured, so the compat unit does not rediscover it:** F7's *second* complaint — the DB-binding
test shelling into Docker during Vitest — is **already remediated**, split on AE4.9 into
`supabase/tests/411_ae48_role_manifest_db_gate.sql` plus a text-only hop in
`src/lib/role/role-catalog.test.ts` (no `execSync`/`docker` call survives there); D4 changes only that
411's `MANIFEST-SNAPSHOT` block stops being **hand-maintained**. The five declarations are live and
unremediated, each shifted +10 lines since the audit (`ROLE_LABELS:42` · `ROLE_SCOPE_KIND:67` ·
`ROLE_ORDER:99` · `ROLE_BRANCH:194` · `scopeSummary`'s switch `:348`; `ROLE_MANIFEST` zips the first
three at `:121-126`).

### D5 — The build is ONE named backend unit, `AE5-ROLE-CATALOG-COMPAT`, before the first AE5 increment

The PO's ordered steps, verbatim:

> I would execute this as ADR 0202 followed by a named backend unit such as AE5-ROLE-CATALOG-COMPAT,
> before the first actual AE5 increment:
> 1. Convert app.active_role_selections.role from platform_role to catalog-validated text and add
>    an FK to authz.roles(code), preserving existing values.
> 2. Replace assume_role(platform_role) with one non-overloaded text signature that validates
>    session_selectable and the caller's real assignment.
> 3. Remove the old enum after its dependencies are gone.
> 4. Delete the inert administrativo role row and remove capability_plane from authz.scope_kind.
> 5. Collapse the TypeScript role mirrors into the single F7 manifest and infer PlatformRole from it
>    rather than the retired generated enum (current mirrors `src/lib/role/role-catalog.ts:39`).
> 6. Leave member_can behavior untouched until proposed-order item 6, when the capability plane is
>    mapped to permission codes as a sibling entitlement provider—"mapped, not merged," exactly as
>    the plan states (`docs/plans/authz-evolution.md:1178`).

(*"ADR 0202"* is this ADR; see ⚠ Numbering.)

⚠ **Correction carried as a measured fact — step 4's second half is an `ALTER DOMAIN`, and it has a
second dependent.** `authz.scope_kind` is a **DOMAIN over `text`** (`typtype = 'd'`), not an enum:

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where contypid = 'authz.scope_kind'::regtype;
-- scope_kind_check :: CHECK ((VALUE = ANY (ARRAY['organization','hospital','commission','none','capability_plane'])))
select a.attrelid::regclass::text||'.'||a.attname from pg_attribute a
 where a.atttypid = 'authz.scope_kind'::regtype and a.attnum > 0 and not a.attisdropped;
-- authz.roles.allowed_scope_kind   |   public.memberships.scope_kind
```

⇒ step 4 is **`ALTER DOMAIN authz.scope_kind DROP CONSTRAINT scope_kind_check` + re-add without
`capability_plane`**, run **after** the `administrativo` row is deleted, and it tightens a domain
`public.memberships.scope_kind` also depends on. ⛔ *"Remove it from the enum"* would mis-order the
unit — Postgres offers no `ALTER TYPE … DROP VALUE`, and this is not an enum anyway. **The compat
unit proves, red-first, that no `memberships` row carries `capability_plane` before the tightening.**
Measured today: **0** rows, and `memberships_role_check` structurally admits only ten role codes,
none mapping to `capability_plane` — but a CHECK can be altered, so the proof is a cell in the unit,
never an inherited assumption. `member_can` / `member_can_for` behaviour is untouched (step 6).

### D6 — Sequencing: `staff_admin` is the already-authoritative BASELINE, not increment 1

The PO's ruling, verbatim:

> This also cleans up the sequencing language: staff_admin is the already-authoritative baseline,
> not AE5 increment 1. After the compatibility unit, the remaining work is ten real role cutovers
> plus one capability-plane cutover. Item 1 is therefore staff; item 6 remains the administrativo
> provider mapping.

Arithmetic, from the catalog: 12 rows − `administrativo` (the capability plane) − `staff_admin`
(already `authoritative`) = **10** role cutovers plus **1** capability-plane cutover. The Proposed
order at `docs/plans/authz-evolution.md:1178-1180` already numbers from `staff`; it was right, and
the *"increment 1 is `staff_admin`"* sentences were the disagreeing half. ⇒
**`FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES` closes on this ruling.**
⚠ The refuted reading has **five** live sites, not the three its close condition names:
`docs/progress/ae5-opening-adr.md:519-522` · `docs/plans/authz-evolution.md:1174` ·
`docs/plans/pre-ae5-remediation.md:396-398` · **`:640`** · **`:670`**. Each carries a dated correction
marker beside it (ADR [0105](./0105-rename-is-tenancy-admin-of.md):24 — historical documents are not
rewritten), and `docs/plans/authz-evolution.md:1215`'s existing ⛔ note, which held the disagreement
open, receives a dated **update** rather than a second marker beside it.

### D7 — The blast-radius census, with its queries

The census `FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS` says nobody
ran. Measured live; each row carries its query, because a count in ungated prose rots (ADR 0195).

| limb | reach | query |
| --- | --- | --- |
| enum labels | **11** | `select e.enumlabel from pg_enum e where e.enumtypid = 'public.platform_role'::regtype order by e.enumsortorder` |
| columns typed by it | **1** — `app.active_role_selections.role` | `select a.attrelid::regclass, a.attname from pg_attribute a where a.atttypid = 'public.platform_role'::regtype and a.attnum > 0 and not a.attisdropped` |
| routines naming it | **1** — `public.assume_role(p_role platform_role)`, `prosecdef`, not overloaded | `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('app','public','authz') and p.prokind in ('f','p') and pg_get_functiondef(p.oid) ilike '%platform_role%'` |
| RLS policies | **0** | `select count(*) from pg_policies where coalesce(qual,'')||coalesce(with_check,'') ilike '%platform_role%'` |
| first-party TS files | **7** (6 hand-written + `src/lib/types/database.ts`, generated) | `grep -rln 'platform_role' src/` |

⚠ `prokind in ('f','p')` is **required** in the routine query: without it `pg_get_functiondef` errors
on aggregates (`ERROR: "array_agg" is an aggregate function`) and the census returns nothing at all —
a silently-empty sweep. Cross-check: `select distinct d.classid::regclass, d.objid from pg_depend d
where d.refobjid = 'public.platform_role'::regtype and d.deptype <> 'i'` → exactly two dependents,
`pg_class` + `pg_proc`, consistent with 1 column + 1 routine and no third limb.

**The catalog's 12 rows** (`select code, allowed_scope_kind, system_managed, session_selectable,
state from authz.roles order by code`; the full table is in the record's entry 8): `staff_admin`
alone is `authoritative`, the other eleven `legacy`; `administrativo` is the **only** row at
`allowed_scope_kind = 'capability_plane'` and the **only** one with `session_selectable = f`;
`platform_admin` is the only `system_managed` row and the only one at `'none'`; the remaining nine
are `session_selectable`, not `system_managed`, and split 6 hospital / 2 organization / 1 commission
(`staff`). `authz.role_permissions` carries rows for **one** `role_code` — `staff_admin`, 42 of 43
permissions. ⇒ **`FUP-AE5-MATRIX-ARM3-CELLS-ADR-0202-BLAST-RADIUS-CITES-ANOTHER-ADRS-CENSUS` closes
on branch (a)** of its own close condition — the census is run and lands in a durable home (this
ADR) — and `docs/plans/pre-ae5-remediation.md:398`'s *"3 sites and fully measured"* gets a dated
correction beside it naming this section.

## Considered options

Three options were offered per question; below is what was offered and what the PO did with it,
including where the PO rejected or refined the recommendation.

**F8 — where `administrativo` lives.** (a) *Keep the row and document the exception* — rejected by the
audit's own argument, adopted here: a sentinel every future constraint must remember is evidence the
abstraction is wrong. (b) *Move it out as a capability provider* — **recommended, taken, and
REFINED**: the offered form made `administrativo` a provider whose entitlement source was *the
`administrativo` bundle*. The PO changed the source — *"the actual entitlement source must be each
individual capability—not one administrativo bundle"* — and added two prohibitions not offered: ⛔ not
into `assignment_facts`, ⛔ never a fake `role_code`. (c) *Model it as a role with a narrower scope
kind* — rejected: a second sentinel where the finding says to remove the first.

**`platform_role`.** (a) *Keep the enum and pin it to the catalog with a test* — rejected: two
vocabularies that must agree. (b) **Retire it** — recommended and **chosen as offered**. (c) *Keep it
as a generated type only* — rejected: the column and the routine signature are the reach that
matters, and (b) alone removes them.

**F7.** (a) *Leave the five declarations and lean on type exhaustiveness* — rejected by the finding:
exhaustiveness covers three of five. (b) **One ordered manifest entry; compat exports derived; the
binding test becomes a generated-artifact `--check` gate** — recommended and **chosen as offered**.
(c) *Generate the whole TS catalog from the DB at build time* — not recommended, not taken: it would
make `npm run lint` require Docker, which 0197 D4's doctrine forbids.

**The carrier.** The offered form was *one compatibility migration* (0176 D8's own phrase). The PO
**sequenced** it instead — an ADR followed by a named unit with six ordered steps, the enum dropped
last and `member_can` deferred to item 6 — so the unit has a defined end that does not touch the
capability plane's behaviour.

## Consequences

**`AE5-ROLE-CATALOG-COMPAT` is a named, owed unit**, running **before** AE5 increment 1 (`staff`).
✅ **DATED NOTE 2026-09-13 — BUILT.** D5 steps 1–5 landed in migration `20261003007430` (unit [hub](../features/ae5-role-catalog-compat.md) · [record](../progress/ae5-role-catalog-compat.md) · [review](../reviews/ae5-role-catalog-compat-review.md)), QA APPROVED, PO-approved 2026-09-12, merged 2026-09-13. Measured at close: one `assume_role(p_role text)` on `search_path = ''`, `to_regtype('public.platform_role')` NULL, 11 rows in `authz.roles`, the domain CHECK at four values, both `member_can` bodies md5-unchanged. ⛔ **Step 6 is NOT built** and the three narrower codes stay OWED, exactly as § *What this ADR does NOT decide* says.
Its acceptance, in outline — the unit writes the detail:

- **RED-first cells.** Every step's keystone is written before its SQL and observed red; a keystone
  green on its first run is a finding, not a pass — the surface does not exist yet.
- **The `memberships` proof** precedes step 4's `ALTER DOMAIN` tightening — a cell asserting no
  `memberships` row carries `capability_plane`, red-first against a planted row.
- **`assume_role`'s new signature** owes both halves of its gate — `session_selectable` **and the
  caller's real assignment** — with a mutation on each; today
  `supabase/tests/408_ae49_assume_role_session_selectable.sql` proves only the first.
  ⚠ **Added 2026-09-11 (PO ruling on sequencing; ADR 0105 — appended beside, not rewritten):**
  the new signature is a **new SECURITY DEFINER**, so ADR 0208 D4 binds it to `search_path = ''`
  with a schema-qualified body — the current `assume_role(platform_role)` is `prosecdef` on
  `search_path=app, public, pg_catalog` (measured live). The unit therefore runs **AFTER**
  `DEFINER-SEARCH-PATH-NARROW-FIX` (0208 D5's `419` ratchet), so the new door lands under the
  gate that observes the non-empty-path population rather than before it; the ratchet's frozen
  set may shrink when the old signature is dropped and must not grow. This ADR's step order is
  unchanged.
- **`npm run gen:types`** after every migration (Rule 8); D7's 7-file TS reach is the blast radius
  step 5 works through — 6 hand-written, 1 regenerated.
- **The generated manifest artifact** lands with both halves of 0197 D4: a text-only `--check` in
  `npm run lint` and a catalog pin in `npm run test:db`. ⛔ A single half is not the verdict.

**What this ADR does NOT decide**, named so it is not read as settled: ⛔ **the three narrower
permission codes are OWED, not chosen** — which codes `schedule_meetings`, `create_cases` and
`assign_case_phases` receive, and whether by a split or a new code, is decided at proposed-order
item 6 with the measured surface of `commission.meetings.manage` and `commission.cases.manage` in
front of it, and ⛔ nothing may map them to those two broad codes meanwhile · ⛔
**`authz.capability_permissions` does not exist** (`to_regclass` → NULL) — the D1 diagram names a
future table whose shape is item 6's · ⛔ **no capability-plane behaviour changes here**:
`app.member_can` / `app.member_can_for` and every door calling them keep their current semantics
through the compat unit · ⛔ **AE5 itself stays post-pilot** (ADR 0155 G1) — this ADR decides, it
starts nothing.

**Two live sequencing clauses are re-based.** *"Due before increment 2"* is retired wherever it
appears: with `staff_admin` the baseline rather than an increment, this ADR and its unit are due
before **increment 1**. D6's five correction markers stop the old ordinal being quoted to justify an
ordering.

**The `bulk_create_cases` conjunction becomes an invariant with a name.** It was an incidental
property of one door's body; after item 6 the mapping must preserve it, and the door's test owes a
cell that reds when a single broad code discharges it.
