# AE2 — Affiliation/person-tenancy split completion (detail)

Phase record for **AE2** of the authorization-evolution program (ADR
[0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) D8 + D3;
plan [authz-evolution.md](../plans/authz-evolution.md) §AE2). Branch
`authz-ae2-affiliation-tenancy`, cut from `main` at the AE1 merge. **Closes
`FUP-AFF4-HOMEORG-PHASE2`. Pre-pilot.**

> **Live status is PROGRESS.md § Now, never this file.** This is the durable detail record.

## Task state

| Task | State | Artifact |
| --- | --- | --- |
| **AE2.0** — PO ruling: offboarded-person lifecycle authority | ✅ **RULED 2026-08-27** | ADR [0163](../decisions/0163-offboarded-person-lifecycle-authority.md) — **last-org retention**, **capability-blind**, four bounds. ⚠ This cell read "SUBSET capabilities" until 2026-08-28; ADR 0163 Amendment 1 § 1 **RETIRED** that wording (QA M5) |
| **AE2.1** — close the consumer set | ✅ **DONE 2026-08-27** | [census](../design/authz-ae2-home-org-consumer-census.md) |
| **AE2.2** — migration design: per-leg re-predication | ✅ **DONE 2026-08-27** | migrations `20261003005400` + `20261003005500`; suites `390`, `391` |
| **AE2.3a** — the widening differential, **read/visibility half** (phase keystone) | ✅ **DONE 2026-08-27** | suite `392` (38 assertions); 50-cell matrix, 5 pre-declared widenings, 5 accepted narrowings, 8-mutation vacuity proof |
| **AE2.3b** — the widening differential, **write/containment half** | 🟡 **PARTIAL** | increment 1's half **DONE** (`393` § 3 + § 5); increment 3's **capability-level** differential **DONE** (`394`, 396 cells). Still owed: the picker (increment 4) |
| **AE2.4 inc 1** — the circular pair | ✅ **DONE 2026-08-28** | migration `20261003005600`; suite `393` (44 assertions); ADR [0165](../decisions/0165-affiliation-derived-tenant-gate-and-its-widening.md); **16**-mutation vacuity proof. ⚠ This cell said `9` — the round-1 figure, never re-derived after rounds 2–3 (QA M5). ⭐ The class worth naming: a quoted figure that **flatters** gets caught; one that **self-deprecates** does not |
| **AE2.4 inc 3** — the write-authority path (hard gate on the drop) | ✅ **DONE 2026-08-28** | migration `20261003005700`; suite `394` (42 assertions); ADR 0163 now FULLY LIVE; 18-mutation vacuity proof |
| **AE2.4 inc 4** — the coordinator picker **and** the last preambles: `listLinkableOrgUsers` (shape C-b′) · `resolveOrInviteUser` (QA M14) · `addStaff` (QA B1) · ADR 0164's required mitigation given a caller (QA M3) | ✅ **DONE 2026-08-28** | migration `20261003005800`; suite `395` (43 assertions); vitest `invite.test.ts` (9) + `org-roster-predicate.test.ts` (16). ⚠ The scope is **three** column consumers, not one — the row named only the picker, which is how the other two fell between increments |
| **AE2 · QA R2-B1** — the kernel invariant (ADR 0166) **+ the B5 forward comment correction (R2-M1)** | ✅ **DONE 2026-08-28** | migration `20261003005900`; suite `396` (**63** assertions, observed RED-FIRST 32/59 at the previous head); **23**-mutation vacuity proof, keyed by subject, 50/63 proven able to fail. ⛔ Scope was the kernel + the comment + the matrix ONLY — the existing-data backfill, the `is_admin` demotion backstop and the detector's logging are **NOT** started |
| **ADR 0167** — commission `staff_admin` has ONE authority, on both sides (its own gated increment, before the drop) | ✅ **DONE 2026-08-28** | migration `20261003006000`; suite `397` (40 assertions, observed RED-FIRST **11/39** at the previous head); **20**-mutant vacuity proof, keyed by subject, 36/40 proven able to fail; vitest `admin/actions.test.ts` (9). ⛔ Five fixture reachability findings ruled by the lead first — one of them a **silent** verdict flip in `293 § 2` that reds nothing. ⚠ The `staff` sub-arm's one-way door SURVIVES and awaits its own PO ruling |
| **AE2.4** — drop the column | 🔜 | after all four increments **and** R2-B1's still-owed items |
| **AE2.5** — D3 binding text in ARCHITECTURE.md | ✅ **DONE** (commit `7654110c`) | Architecture **Rule 13**, `ARCHITECTURE.md:650-676`. ⚠ This cell read `🔜` while `PROGRESS.md` already said `2.5 ✅` (QA M5) |

## AE2.0 — the ruling, and why the question was the other way round

The plan states AE2.0 as *"who may still administer a fully-offboarded person"*. Measuring
before designing turned it around: **the question is what replaces the authority AE2 deletes.**

`authorizePersonScopedAdmin` (`src/lib/users/actions.ts:379-389`) resolves the target's
`home_organization_id` first, returns `{ok:false}` on null, and then grants outright via
`authorizeOrgOps(orgId)` — **an arm with no affiliation term at all**. So an offboarded person
is administrable today *only* because of the column AE2.4 drops, and **doing nothing is a
silent narrowing**, not a no-op. Its blast radius is rehire-after-deactivation, which ADR 0151
D5 promises is one-step.

⚠ `personScopeAllows`' empty-footprint deny is **not** the subject — it already answers "no
footprint, no `hospital_admin` claim", pinned explicitly against the vacuous-subset inversion,
and that answer stands unchanged.

Ruling: **(a) last-org retention.** (b) platform-only and (c) time-boxed were both rejected as
*premature rather than wrong*, each owing a prior decision — see ADR 0163 § Consequences.

## AE2.1 — the census

Derived at head `20261003005300`; **every load-bearing count re-derived independently by the
lead before the artifact was committed**, both derivations agreeing.

| Class | Count | Predicate |
| --- | ---: | --- |
| RLS legs | **3** | `pg_policies` where `qual‖with_check ~ 'home_organization_id'`, unanchored — all `SELECT`, **0 in `with_check`** |
| Functions | **13** | `prosrc` over `public`+`app` **after stripping `--` comments** (14 raw; `list_org_people` matches only as a comment saying it no longer filters) — 12 DEFINER + 1 INVOKER |
| Views / matviews | **0 / 0** | `pg_views` / `pg_matviews` definition match |
| FK / CHECK / index / default | **1 / 0 / 0 / 0** | `pg_constraint`, `pg_index`, `information_schema` |
| `src/` | **50** lines, 14 files | 28 prod (13 read · 2 write · 6 type-only · 7 comment) + 22 test |
| Fixtures | **6 / 67 / 2** | `seed.sql` / `supabase/tests/**` (37 files) / `demo/` |

**NOT NULL:** `attnotnull = f`. There is no NOT NULL and no CHECK — enforcement is entirely
`profiles_tenant_has_org_trg`, a **deferred constraint trigger**, and the rule is
**conditional**: `if new.home_organization_id is null and not new.is_admin then raise`. Live
data: 36 profiles, 1 NULL, and that one is `is_admin`.

### ⛔ The AE2.2 trap this census surfaced — and the plan names the wrong function for it

`assert_profile_tenant_has_org` is **`prosecdef = f` (INVOKER)**, which is harmless *today*
only because its body reads **no table at all** — it is a pure NULL check on `new`. AE2.2
changes exactly that: re-predicating containment onto an active org affiliation gives it a read
of `public.organization_affiliations`, whose SELECT policy is
`principal_id = auth.uid() OR app.is_org_admin_of(organization_id)` — **no hospital tier, by
design** (ADR 0151 D1).

An INVOKER trigger reading that under a `hospital_admin`'s RLS cannot see the row, raises a
false positive, and reproduces `BUG-D5-REHIRE-HOSPADMIN-001` — the AFF4 regression that broke
one-step rehire for **every** `hospital_admin`, unconditionally (ADR 0159).

⚠ **The plan's AE2.2 reassurance is true of a function this phase does not touch.** It reads
*"the AFF4 D4 backstop is already SECURITY DEFINER per ADR 0159 — extend, don't fork"*, which
names `app.assert_hospital_affiliation_has_org` (`prosecdef = t`, verified). **The trigger AE2.2
actually re-predicates is the other one, and it is INVOKER.**

**Binding:** the security context changes **in the same migration that gives the trigger a table
read**, never as a follow-up, and AE2.3 carries a `hospital_admin` containment-accept cell.

### Two sibling axes, one swept

`src/lib/queries/members.ts:243` still filters `.eq('home_organization_id', organizationId)` —
the predicate AFF4 B6a moved `listOrgUsers` off, pinned by a regression test **for that one
function only**. Its sibling door `list_addable_commission_members` keys the same way, with **no
affiliation filter at all**, so a fully-offboarded person is *still listed as addable to a
commission*. Both are AE2.2 re-predication targets and AE2.3 differential cells; neither is
authorized by ADR 0163.

## AE2.2 — per-leg re-predication

Two increments, deliberately separate so a bisect stays meaningful: **`20261003005400`** is
mechanism-preserving (the three RLS legs), **`20261003005500`** is a behaviour change (the
roster door). Keystones **`390`** (55 assertions) and **`391`** (15), both written first and
**observed red** — 390's surface arm could not resolve either function and its D11 re-sweep
read 3 policies still naming the column; 391 red at §2.1, §2.2, §3.1, §4.1, §4.2.

### The per-leg contract (old → new), verbatim

All three policies are `SELECT`, all three carried the column in exactly **one OR leg**, and
**no policy in the database carries it in `with_check`**.

| # | policy / door | old predicate | new predicate |
| --- | --- | --- | --- |
| 1 | `public.profiles` / `profiles_admin_select` | `((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))` | `app.can_administer_person_via_affiliation(profiles.id)` |
| 2 | `public.profiles` / `profiles_select_self_or_admin` | *(identical text)* | `app.can_administer_person_via_affiliation(profiles.id)` |
| 3 | `public.professional_credentials` / `professional_credentials_select` | `EXISTS (SELECT 1 FROM profiles p WHERE p.id = professional_credentials.user_id AND p.home_organization_id IS NOT NULL AND app.is_org_admin_of(p.home_organization_id))` | `app.can_administer_person_via_affiliation(professional_credentials.user_id)` |
| 4 | `public.list_addable_commission_members` (door body, not a policy) | `pr.home_organization_id = v_org_id` | `exists (… organization_affiliations oa where oa.principal_id = pr.id and oa.organization_id = v_org_id and oa.ended_on is null and oa.voided_at is null)` |

Every other arm of all three policies, and everything else in the door, is reproduced
byte-for-byte from the live catalog. **Zero policies now reference `home_organization_id`**
(390 §B7 — the D11 re-sweep, unanchored over `qual` **and** `with_check`).

### The two new objects, with arm domains **derived per function from the catalog**

Derived by running the harness's own domain SQL (`p0-authz-invariant.sh` ARM 3 / ARM 5,
`p0-authz-door-audit.sh` `PRED_DOMAIN`, `act-hat-blind-sweep.sh`) against `pg_proc` — never a
hand list, never inferred from the batch's label:

| object | census | policy | hat | floor | wrapper |
| --- | --- | --- | --- | --- | --- |
| `app.can_administer_person_via_affiliation(uuid) → bool` — DEFINER, STABLE, `search_path=app,public,pg_catalog`, EXECUTE `{postgres, authenticated, service_role}` | ✅ **in** | ✅ **in** | ✅ in population | ❌ out (`public` only) | ❌ out (`prosecdef=f` only) |
| `app.person_authority_orgs(uuid) → table(organization_id uuid)` — DEFINER, STABLE, pinned, EXECUTE **`postgres` only** | ❌ out | ❌ out | ✅ in population | ❌ out | ❌ out |

⚠ **`person_authority_orgs` is in NO arm's finding domain — stated, not hidden.** That is plan
rule 4's C2 shape: set-returning and not `authenticated`-reachable, so census's row-returning
clause does not admit it and the boolean clauses cannot. **Absence of a verdict is absence of
coverage, not coverage.** Its compensating control is named rather than assumed: 390 §C asserts
ADR 0163's bounds against it directly, including the two an inspection would not catch — a tie
yielding **all** tied orgs (§C5), and a voided row ending **later** than the non-voided one
(§C7, which returns EMPTY under any `max()`-before-void-filter implementation).

It is **not** `authenticated`-reachable on purpose: a row-returning DEFINER is a gate you can
walk through, and granting it would let any caller enumerate any person's organizations by id.
ACLs are asserted **positively** via `has_function_privilege` (390 §A5/A6/A11/A12), never by
reading `proacl` for absence. Both bodies were checked against the harness's
`DEGENERATE_PREDICATE` in all three forms: neither is degenerate.

### ADR 0155 D3 compliance — stated explicitly, as asked

**It complies.** The affiliation **locates** and the membership **grants**, and the split is
structural rather than documentary: `app.person_authority_orgs` contains **no caller term at
all** — it cannot grant, because it does not know who is asking — and the grant is a separate,
visible `app.is_org_admin_of(...)` conjunct in a *different function*, applied to the org the
affiliation resolved. **No leg had to be bent to fit, and there is no leg that cannot be
expressed this way.** 390 §D10 is the assertion that reds if the two steps are ever collapsed:
a principal who *shares* an active affiliation with the subject, holding no `org_admin`
membership, must get FALSE.

### The containment trigger — ruled **T3**, and why that is sequencing, not deferral

`public.assert_profile_tenant_has_org` is **not** re-predicated. The plan's "re-derive
containment from an active org affiliation" is **not implementable as written**, measured:

- `public.handle_new_user` inserts the `profiles` row inside the **`auth.users` transaction**
  (GoTrue); the org affiliation is created by `app.affiliate_person_to_org_impl`, reached from
  `src/lib/users/actions.ts:700` as a **separate PostgREST transaction**. The trigger is
  DEFERRABLE INITIALLY DEFERRED, so it fires at COMMIT — of *its own* transaction. **Deferral
  buys nothing across two.** An active-affiliation predicate would raise on every signup,
  unconditionally.
- ⛔ **The dependency is circular, and the census did not draw this out:**
  `app.affiliate_person_to_org_impl` — the door that *creates* the affiliation — is itself
  gated on the column (`if v_person_org is null or v_person_org is distinct from p_organization
  then raise … HC0R0`). Containment cannot move onto affiliations while the affiliation-creating
  door is gated on the column. **Both halves must break in one move, and that move is AE2.4** —
  which must rewrite this function anyway, because its body reads `new.home_organization_id`
  directly and the column drops there. Doing it in AE2.2 would mean rewriting one function
  twice in one phase.
- Post-0163 the column-based containment invariant and the column-based authority leg were the
  **same fact**: "has `home_organization_id`" implied "some admin can reach this person" *only*
  because of the leg this migration deleted. Preserved as-is after the drop, it would be a
  ceremony rather than an invariant.

⚠ **No security-context change is owed here, and that absence is deliberate** — recorded
because the INVOKER trap is now documented in three places and a later reader will ask why
AE2.2 did not fix it. T3 gives the trigger **no table read**, so it stays `prosecdef = f`
harmlessly (it is a pure NULL check on `new`). ⛔ **Whoever gives it a table read must change
its security context in the SAME migration** — under a `hospital_admin`'s RLS it cannot see the
row, raises a false positive, and reproduces `BUG-D5-REHIRE-HOSPADMIN-001` unconditionally.

**T1 rejected outright** (having `handle_new_user` create the affiliation silently discards the
caller's backdated `p_started_on` and the `created_by` attribution, and redesigns person
creation inside a re-predication migration). **T2 is the recommended AE2.4 shape, not ruled:**
re-predicate containment to "≥ 1 **non-voided** org affiliation" — 0163's own derivation
domain, i.e. exactly the persons who have a retaining org — and move enforcement to the only
post-creation event that can destroy it, a deferred constraint trigger on
`organization_affiliations` void/delete. ⚠ **Its cost, stated:** creation-time containment
genuinely disappears, so a half-failed `createPerson` leaves an anchorless profile where the
column closes that window today. **That window is inherent once the column goes** — T2 does not
introduce it.

### The sibling roster axis (increment 2, `20261003005500`)

Delta measured **before** the change, shadowing old-vs-new per (commission, person) in one
transaction, over the seed roster plus the three states rule 10 says the seed cannot construct:

| population | old | new | verdict |
| --- | --- | --- | --- |
| seed roster | 104 | 104 | **0 only-old, 0 only-new** |
| fully offboarded (ended, non-voided) | listed in 4 commissions | 0 | NARROWING |
| voided-only | listed in 4 commissions | 0 | NARROWING |
| column says org A, ACTIVE affiliation in org B | org A's 4 | org B's 2 | **both** |

**Direction, and the reason of record (PO-framed 2026-08-27): the two doors answer different
questions.** `person_authority_orgs` answers *"who may **administer** this person"*;
`list_addable_commission_members` answers *"who may be **staffed** here"*. ADR 0163's retention
answers the first only, and **was never an input to the second** (the old predicate had no
affiliation term at all) — so active-only here is not a *restriction* of retention; retention is
**out of scope**. That is what makes the deliberate divergence between two predicates that look
like they should match a principled one rather than a judgment call. *(Corroborating, not the
premise: bound 3 also says retention "never makes the person a member of anything".)*

**The narrowing breaks no flow:** rehire is `affiliate_person` **first** — one step, no prior
`org_admin` ticket (ADR 0151 D5) — which makes the person actively affiliated, and only then
addable. The existing order already works. The widening is **pre-declared** in the migration
header and asserted in 391 §3 rather than arriving as a silent green.

### ⛔ Where reality disagreed with the plan and the census

1. **The plan's AE2.2 containment sentence is not implementable** (above). Its reassurance
   *"the AFF4 D4 backstop is already SECURITY DEFINER — extend, don't fork"* names
   `app.assert_hospital_affiliation_has_org` (`prosecdef = t`, `{postgres=X}`); the trigger
   AE2.2 actually targets is `public.assert_profile_tenant_has_org` (`prosecdef = f`,
   `{postgres, authenticated, service_role}`). Both verified in the catalog. **The census had
   this right; the plan does not.**
2. **The census listed `app.affiliate_person_to_org_impl` as a consumer but did not surface the
   circularity** it creates with the containment trigger. That is what makes T3 unarguable
   rather than merely convenient.
3. ⛔ **A NAMED CENSUS LIMITATION — the generalizable finding of this increment.** AE2.1
   classified the 28 production `src/` lines as **read / write / type-only / comment**. That
   partition **cannot surface the property that matters here**:

   > *this read is **RLS-bound**, and the table it is being moved to has a **narrower audience**
   > than the column it replaces.*

   AE2.1 caught the SQL instance (the INVOKER trigger) and **missed this one because it is a TS
   read, not SQL** — the same defect, invisible to the same instrument, in a different language.
   Measured instance: `listLinkableOrgUsers` (`src/lib/queries/members.ts:243`) is a plain
   RLS-bound read whose callers are the two commission **case** pages, so its dominant caller is
   a `staff_admin` coordinator. `organization_affiliations_select` is
   `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)` — **no staff_admin arm,
   no hospital tier, by design (ADR 0151 D1)**. Measured: `chefe.ccih@test.local` sees **1**
   affiliation row (their own) against **10** visible `profiles` rows; `orgadmin.a@test.local`
   sees 29. The naive re-predication collapses the coordinator's picker to one person, and an
   embedded `!inner` join collapses identically, because the embed is RLS-filtered too.

   **The governance consequence is what makes this a blocker rather than a papercut:** a
   coordinator pushed from *possui conta* to *não possui conta*, which ADR 0108 D6 makes an
   audited human assertion rendering the exclusion vacuously satisfied.

   **Checked now, so AE2.4 inherits a count and not an assumption.** Of the census's production
   read sites, exactly **2 of 7 are RLS-bound**; the other 5 (`members/actions.ts:210`,
   `members/invite.ts:52`, `users/person-footprint.ts:499`, `users/actions.ts:382`, `:421`) run
   on `createAdminClient()` or an injected service-role client and are **structurally immune**.
   Of the two RLS-bound ones, only `listLinkableOrgUsers` uses the column as a **filter**;
   `org-users.ts:55/761` is a **projection** inside `PROFILE_SELECT` — a different AE2.4 concern
   (the column must leave the select list, not be re-predicated).
4. ⚠ **An unexercised instance of the same hazard, already shipped by AFF4 B6a — reachability
   checked, not assumed.** `listOrgUsers` derives its roster from `listOrgAffiliationTenses`
   under the caller's RLS. Measured: `hospitaladmin.a1` sees **1** affiliation row in org A
   against **23** visible `profiles` rows, so the same collapse exists in the predicate. It is
   **not reachable**: `src/app/o/[org]/manage/usuarios/page.tsx:163` routes
   `isOrgAdmin ? listOrgUsers : listHospitalUsers`. ⛔ Recorded as an **unexercised hazard, not
   an all-clear** — the guard is a call-site ternary, not a property of the query, so "not
   reachable" is not "protected".

### Handed to AE2.4

- The containment trigger (**T2** recommended, with its stated cost) **and**
  `app.affiliate_person_to_org_impl`'s own re-predication — **one** decision, because of the
  circularity.
- **`listLinkableOrgUsers`.** ⛔ **Option C-a — adding a staff_admin/co-membership arm to
  `organization_affiliations_select` — is REJECTED** (lead, 2026-08-27): fixing an application
  read by widening a tenancy policy, against an ADR that says "no hospital tier, **by design**",
  is the never-fix-X-by-granting-Y shape, and a policy widened for a picker stays widened for
  everything else it gates. **Recommended shape is C-b′:** a **`public` INVOKER** RPC returning
  `setof profiles` — so `profiles` RLS still applies to the caller and the perimeter semantics
  are preserved exactly — whose body filters with a **`bool`-returning `app` DEFINER** helper
  (`app.person_has_active_affiliation(person, org)`) so the affiliation lookup is not RLS-bound.
  It never materializes a roster (no disclosure), and it is a **swept** shape: ADR 0079
  Amendment 7's `public` INVOKER wrapper over an `app` DEFINER predicate, which is exactly what
  `ARM=wrapper` exists for, with the `bool` helper landing in census + policy + hat. ⚠ **Verify
  it against the real callers before AE2.4 commits to it; if it does not hold, say so rather
  than bending it.**
- **`org-roster-predicate.test.ts:186`'s wrong grain.** It pins the old predicate's absence for
  `listOrgUsers` **only**; the sibling needs its own pin. Its own comment already concedes an
  over-claim about its scope: *"SCOPE, STATED HONESTLY BECAUSE THE MUTATION RUN CORRECTED ME …
  IT DOES NOT."*
- The `professional_credentials` **pre-declared widening candidate**: the old leg ran its
  `profiles` sub-select under the **caller's** RLS; the new DEFINER call removes that implicit
  second gate. Believed set-identical (anyone the new predicate admits is also admitted by the
  re-predicated `profiles_admin_select`), but that is an **argument, not a measurement** — AE2.3
  measures it. ⛔ Not asserted away in AE2.2.
- `profiles.home_organization_id` is untouched: column, `attnotnull` (`false`), values and FK
  all exactly as before.

### Collateral, and the gate figures

Two suites moved, both predicted by a blast-radius sweep and then confirmed by running them:

- **`360` §5.2 read 0 of 5.** ⭐ *The fixture had built its world out of the column under test*
  — it anchored its personas with `home_organization_id` and never inserted an
  `organization_affiliations` row. **Fixed the fixture, mirroring `seed.sql:404-408`'s own
  derivation, not the assertion.** The org_admin persona there deliberately gets **no**
  affiliation row: §5.2 passing without one is the evidence that the membership grants while
  the affiliation only locates.
- **`387` §C1's qual-text md5 moved by design** (`7522eb73…` → `a115005b…`). Re-captured, with
  the check that licenses it recorded in place: **§B's per-persona BEHAVIOUR md5s did NOT
  move**, including both `org_admin` personas whose visibility the changed leg dominates.
  Identical rows, different text. Seed parity is exact — **0** non-admin profiles whose home org
  lacks a matching active affiliation, **0** with an active affiliation elsewhere — which is why
  AE2.3 should see near-zero movement, as ADR 0163 predicted.

Four stale in-test claims corrected where this change falsified them: `374` §0.3's description
and its §3 scope control (which no longer isolates two *different* mechanisms, since both legs
are affiliation-derived now — **weakened, and said so** rather than left to rot), `371` §6.2's
label, and `381`'s tenant-anchor comment, whose **write** half still holds while its **read**
half is now wrong.

**Gates — exit codes captured directly (never through a pipe), on a fresh `supabase db reset`:**

| gate | result | exit |
| --- | --- | --- |
| `supabase db reset --local` | clean | **0** |
| `npm run test:db` | 239 files, **7941** tests, PASS | **0** |
| `npm run lint` (11 gates) | pass | **0** |
| `npm run typecheck` | pass | **0** |
| `npm run test` (vitest) | 145 files, **1974** tests | **0** |
| `npm run gen:types` | run after both migrations; **no diff** — both new objects live in `app` and no table changed | **0** |

⛔ Not run here, by instruction: the ARM sweep and `e2e:prod` — those are the phase gate, run by
the lead.

### AE2.2 gate subset — run by the lead, on a fresh reset

⚠ Per [PA-F18] this is the **increment's** gate subset, not Gate AE2. The phase gate closes over
the last increment; AE2.3–AE2.5 are unbuilt.

**The four ARM arms — recorded as what each ENUMERATED, never as exit 0** (plan rule 2):

| arm | asks | enumerated | exit |
| --- | --- | --- | ---: |
| `ARM=census` | has anything **ever asked** about this gate? | **566** live gates / **602** verdicts · INVARIANT HOLDS | **0** |
| `ARM=hat` | does any door read `memberships` without the caller's hat? | self-test **6/6 OK** · 3 findings, all reasoned-allowlisted | 0 |
| `ARM=floor` | is every door actually **called**? | **72** never-called doors, all allowlisted; every allowlist entry resolves to a live door | 0 |
| `FROMFINDINGS=1 ARM=wrapper` | the `prosecdef = f` half | BLIND set **41**, all allowlisted | 0 |
| diff-scoped door sweep (4 cases) | does anything **notice** when a gate is opened? | `ARM-DOMAIN predicate=1/113 policy=3/226 out-of-domain-bool=35` · **SWEPT 4 · COVERED 4 · BLIND 0 · ERROR 0** | 0 (CLEAN) |

⛔ **The domain qualifier, stated beside the green** (plan rule 2): the **426** reachable command
doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) are outside every arm's domain until that FUP closes.
"All arms green" here means *within those domains*.

#### `ARM=census` failed first, and that is the arm working

The first run exited **1** — `INVARIANT VIOLATED`, naming
`app.can_administer_person_via_affiliation` as **UNKNOWN**: *"nothing has asked whether a keystone
notices when they open."* That is exactly what `ARM=census` exists for — it is the arm that catches
a gate you just added, and a brand-new gate passes `ARM=policy` **vacuously**. The diff-scoped
sweep measured it **COVERED**, the verdict was merged into the committed baseline, and census
re-run holds at **602** verdicts (601 → 602). ⛔ `person_authority_orgs` was **correctly not**
flagged — it is not `authenticated`-reachable, so it is outside census's domain, which is an
absence of coverage and not a clean bill (ruled below).

#### ⛔ What `ARM=census` structurally could NOT have caught — and the deriver did

All three altered policies **already carried `COVERED`**, earned against the **PRE-ALTER**
predicate. `ALTER POLICY` keeps the gate's **name**, and census backstops only *newcomers* — so a
stale verdict would have transferred silently to a predicate it was never measured against. ⚠ The
gate not being new is precisely what makes this silent. Surfaced by
`scripts/door-sweep-cases.sh` (ADR 0079 Amendment 8 ruling 3), **not** by anyone remembering it —
which is the entire reason that ruling lives in a script that can red rather than in a paragraph.
All three were **re-measured and replaced**, not inherited; each gained holders (`302`, `303`,
`360`, `371`, `374`, `390`) because the new predicate is exercised by suites the old column leg
never reached. Record: `docs/reviews/authz-door-audit-findings.md` § Note 2026-08-27.

**Hazards handled, measured not remembered:** the subset run wrote to `$WORK` and the committed
baseline was **verified unchanged by cksum** before the manual merge; the four rows were folded in
as a **merge of changed rows**, never a copy of the subset file (ADR 0079 Amendment 1, hazard 1).
`FROMFINDINGS=1 ARM=wrapper` was **re-run after** the merge — BLIND set unchanged at 41 — rather
than assumed unaffected.
## The two name-excluded functions — RULED (lead, 2026-08-27)

`door-sweep-cases.sh` excluded both by its name filter
(`^(is_|can_|has_|referral_target_analyst|attachment_confidentiality_ok)`, minus `^is_valid_`) and
printed them as **a review list, not a drop**: *"A function here is not 'not a gate' — it is 'the
filter cannot tell'."* Both rulings below, per the deriver's own instruction that the ruling belongs
in the gate record.

### `app.person_authority_orgs` — NOT a gate; helper, with the reason

**Ruling: classify `helper:` in `authz-unswept-backlog.txt`.** It is **authority-relevant but not
an authorization gate**: its body contains **no caller term at all** — it cannot know who is asking,
so it cannot decide allow/deny. It answers *which organizations confer authority over this person*;
the allow/deny decision is `app.can_administer_person_via_affiliation`, which **is** in CASES and
**is** swept. That separation is not incidental — it is ADR 0155 D3's LOCATE/GRANT split, built
deliberately so the grant is a swept object.

Two further bounds, both catalog-measured:
- `has_function_privilege` is **false for `anon`, `authenticated` AND `service_role`** — it is
  `postgres`-only, so no client role can reach it at all.
- It returns `TABLE(organization_id uuid)`. The door sweep can only neutralize a **boolean**
  predicate; there is no mutation of this shape the harness can express.

⛔ **Absence of a sweep verdict here is absence of coverage, not coverage** — so the compensating
control is named, and it is one that **itself carries verdicts**: pgTAP `390 §C` asserts ADR 0163's
three bounds directly, including the two cases that would otherwise fail silently —
**§C5/§D9** (an `ended_on` tie must yield **all** tied orgs, because an arbitrary tie-break is a
*narrowing* and AE2.3's differential only pre-declares *widenings*) and **§C7** (a voided row
ending later than the real one: filtering voided **after** `max()` yields EMPTY — a total, silent
loss of authority).

### `public.list_addable_commission_members` — IS a gate; owes a TARGETED mutation case

**Ruling: it is an authorization gate.** It is `prosecdef = t` and it decides **who is listed as
addable to a commission** — increment 2 changed exactly that decision. The name filter cannot see
it and the sweep cannot neutralize it (set-returning, not boolean), so per the deriver it **owes a
targeted mutation case**, in the shape AE1.3 used for its `service_role`-only doors.

⚠ **Red-first observation is NOT that case, and must not be recorded as if it were.** Suite `391`
was written first and observed red at §2.1/§2.2/§3.1/§4.1/§4.2, which proves the suite is sensitive
to *the change that was made*. A mutation case proves something different and strictly stronger:
that the suite still notices when the predicate is **neutralized later**. The two coincide only if
391's redness came from the affiliation predicate and nothing else in the migration — plausible,
**unmeasured**, and exactly the kind of "both premises true, conclusion unchecked" step this repo
keeps paying for.

**Owed before Gate AE2 closes:** neutralize the `exists (… oa.ended_on is null and oa.voided_at is
null)` arm in `list_addable_commission_members` (widen it to `true`), confirm `391` **reds**, assert
**the edit actually landed** before trusting the rerun (*a mutation that did not fully apply reports
green*), and prove the rollback restores the original body.

#### ✅ DISCHARGED 2026-08-27 — the targeted mutation case, run twice

Run on a **fresh `supabase db reset --local`** (exit **0**). Baseline catalog state, captured
before anything was touched: `md5(prosrc) = 3e52be46c21ef60f5776b4a3edba5932`, `length = 1451`,
`prosecdef = t`. The body was dumped via `pg_get_functiondef()` to a scratch file and every
restore executed **that file**, so the rollback is a replay of the captured definition rather
than a re-derivation of it.

⚠ **The run shape had to be established before any verdict, and the first attempt proved why.**
Running `391` **alone** aborts: `ERROR: schema "test_helpers" does not exist` (that schema is
created by `00_setup.sql`, which persists outside the suite's transaction), giving
`Files=1, Tests=4` and `Result: FAIL` — a **FAIL-shaped abort that ran 4 of 15 assertions**.
Read as a keystone verdict it is indistinguishable from a hold, which is exactly the confusion
AE1's audit could not resolve. **The correct invocation is `00_setup.sql` + `391`, and its shape
is `Files=2, Tests=16`.** Every run below is reported with its shape, and a shape below 16 would
have been recorded as `ERROR`, never as a hold.

| # | mutation (applied in-DB via `pg_get_functiondef` + `regexp_replace` + `execute`) | edit landed? | run shape | exit | failures |
| --- | --- | --- | --- | ---: | --- |
| baseline | none | md5 `3e52be46…`, len 1451 | `Files=2, Tests=16` | **0** | PASS |
| **M1** | the affiliation **tense** conjuncts only — `oa.ended_on is null` **and** `oa.voided_at is null` → `true` | ✅ md5 → `991fdb07…`, len 1441, marker `MUT-M1` present, `ended_on\|voided_at` **absent**, still reads `organization_affiliations`, `prosecdef` still `t` | `Files=2, Tests=16` | **1** | **§2.1, §2.2** |
| restore | replay of the captured definition | ✅ md5 back to `3e52be46…`, len 1451, marker gone | `Files=2, Tests=16` | **0** | PASS |
| **M2** | the whole predicate — `exists (… organization_affiliations …)` → `true` | ✅ md5 → `a7c6f98e…`, len 1202, marker `MUT-M2` present, `organization_affiliations` **absent**, caller gate `is_staff_admin_of` **still present**, `prosecdef` still `t` | `Files=2, Tests=16` | **1** | **§2.1, §2.2, §3.1, §4.2** |
| restore | replay of the captured definition | ✅ md5 back to `3e52be46…`, byte-identical, no markers | `Files=2, Tests=16` | **0** | PASS |

**Both mutations were asserted to have LANDED from the catalog, never from the command's exit
status** — the `do $$` block raises if either `regexp_replace` is a no-op, and the post-state md5,
length and marker presence were read back out of `pg_proc`. Restores were verified the same way:
**byte-identical `prosrc`**, not "the command succeeded".

**Why two mutations rather than one.** M2 is the door sweep's own shape (neutralize the boolean
predicate to `true`) and is the case the ruling asked for. M1 is strictly finer and answers a
question M2 cannot: with M2 the person needs **no affiliation row at all**, so §3.1's
cross-anchored person is admitted for a reason (`true`) that has nothing to do with tense. M1
leaves the org scoping intact and neutralizes **only** `ended_on`/`voided_at` — and `391` still
reds at §2.1 and §2.2, which is the assertion that the suite notices the **ADR 0163 bound 1
(void ≠ end) and the offboarding narrowing specifically**, not merely that some predicate exists.
⭐ Under M1, §3.1 correctly stays **green**, and that green is informative rather than vacuous:
it localises which assertion covers which conjunct.

**What this adds over the red-first observation, stated precisely.** Red-first proved `391` was
sensitive to *the change that was made*. This proves it is sensitive to the predicate being
**neutralized later** — and, via M1, to each half of that predicate independently. The
"391's redness came only from the affiliation predicate" step that AE2.2 recorded as *plausible,
unmeasured* is now **measured**: §4.2 moves only under M2 (the table reference disappearing),
§2.1/§2.2 move under both, and §1.1/§1.2/§3.2/§3.3/§4.1/§4.3/§4.4 move under neither — so the
migration's caller gate, its tenancy gate and its DEFINER context are pinned by assertions that
are **independent** of the arm under test.

⚠ **Residue: none.** The final state is byte-identical to the migration's, and the fresh
`supabase db reset` that precedes the AE2.3a verdicts re-derives the body from the migration
chain regardless.

## AE2.3a — the widening differential, read/visibility half (`392`)

Suite `supabase/tests/392_ae23a_widening_differential.sql`, **38 assertions**, one transaction,
both predicates evaluated per (caller, target) pair so no stack state can skew one side against
the other. Run on a fresh `supabase db reset --local`.

### ⛔ AE2.3 is SPLIT — and half of what the plan asks for has no subject yet

The plan's AE2.3 demands the differential cover *"containment-trigger accept **and** reject ·
affiliation lifecycle transitions"* and *"INSERT `WITH CHECK` · UPDATE new-row `WITH CHECK`"*.
Both were **re-measured**, not assumed:

- The containment trigger was ruled **T3** — AE2.4's, not AE2.2's.
  `public.assert_profile_tenant_has_org` is **unchanged** by this phase's migrations.
- `392 §1.2` re-measures the census claim from `pg_policies` rather than citing it: all three
  re-predicated legs are **`cmd = SELECT` with `with_check IS NULL`**. There is no INSERT arm and
  no UPDATE new-row arm to differentiate.

⛔ Writing those cells anyway would have produced a suite **green having asserted nothing**. So:

| | scope | owner |
| --- | --- | --- |
| **AE2.3a** | the READ/VISIBILITY half — the 3 SELECT legs, `list_addable_commission_members`, and every door consuming the changed predicate | ✅ **DONE, this task** |
| **AE2.3b** | the WRITE/CONTAINMENT half — the containment trigger, `app.affiliate_person_to_org_impl`, the picker | **owed at AE2.4** |

⚠ The plan's warning *"the phase changes write containment; a read-only differential proves the
wrong half"* is **true of AE2.4**. AE2.2 changed no write containment at all, so for AE2.2 the
read half is the whole half. ⛔ `392` must not be read as discharging AE2.4's differential.

### The consumer set, closed from the catalog rather than from the census

`pg_policies` + `pg_proc` at head: the changed predicate
`app.can_administer_person_via_affiliation` is consumed by **exactly three policies and nothing
else** — no function anywhere calls it; `app.person_authority_orgs` is called only by it. The
RLS-bound (INVOKER) readers of the two re-predicated tables are **three**, each dispositioned:

| door | disposition |
| --- | --- |
| `app.resolve_default_source` | reads **the actor's own** profile (`p.id = p_actor`) — carried by the `id = auth.uid()` self arm, which this phase did not touch. Not a differential surface. |
| `public.list_audit_filter_actors` | `LEFT JOIN profiles` — a visibility change nulls a `full_name`, it cannot change the row set. Not a differential surface. |
| `public.reference_candidates` (`v_kind='user'`) | **is** a consumer, but its own conjunct requires a non-expired **commission membership in the response's org**. `392 §0.2` measures that every constructed target holds **zero** memberships, so its result set is empty under *both* predicates — its differential over this population is provably empty, and over the seed population `§8.2` measures zero movement. ⚠ Recorded as a bounded measurement, not an all-clear. |

### The cell matrix — 5 callers × 10 targets = 50 pre-declared cells

All ten targets carry `home_organization_id = org A`, including the ones whose only affiliation
is elsewhere. That is what makes it a differential and not a snapshot: under the old predicate
`orgadmin.a` administered **all ten**, so every narrowing is attributable to the new predicate
alone (`§0.1`). Ids live in a `0ae23a…` namespace disjoint from 390's and 391's; nothing is
shared across cases and nothing is deleted positionally.

| | T1 active A | T2 ended A | T3 voided-only | T4 ended A + active B | T5 `ended_on` TIE A/B | T6 voided ends LATER | T7 active A+B | T8 col A, active B | T9 no row | T10 col A, active C |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **CA** `orgadmin.a` | = | = | **↓** | **↓** | = | = | = | **↓** | **↓** | **↓** |
| **CB** `orgadmin.b` | = | = | = | **↑** | **↑** | = | **↑** | **↑** | = | = |
| **CC** `solo.c` (cross-org) | = | = | = | = | = | = | = | = | = | **↑** |
| **CH** `hospitaladmin.a1` | = | = | = | = | = | = | = | = | = | = |
| **CS** `staff1.ccih` (D3) | = | = | = | = | = | = | = | = | = | = |

`=` unchanged (40) · `↑` widening (5) · `↓` newly hidden (5). ⭐ CA×T2 is **`=`**, not `↓` — ADR
0163's retention is what holds it, and it is the cell that would flip if retention were ever
dropped as a "simplification".

**The five pre-declared widenings, each with its reason** (`§2.3`, compared against a hand list
written **independently** of the expectation table — deriving it from `§2.2` would make it a
restatement, green whenever `§2.2` is green; `§2.5` cross-checks the two):

| pair | reason |
| --- | --- |
| CB×T4 | ended in A but **ACTIVE in B** — arm 2 must not fire while arm 1 is non-empty (bound 3) |
| CB×T5 | the `ended_on` **TIE** — bound 2 yields ALL tied orgs. ⭐ This cell exists *because* an arbitrary tie-break is a **NARROWING**, and a differential that only pre-declares widenings would never notice one |
| CB×T7 | active in **both** orgs — the plan's own named legitimate widening |
| CB×T8 | column says A, active only in B — the substrate is the truth |
| CC×T10 | the same class measured through a **cross-org actor** (org C), so it is not an artefact of the A/B pair |

**The five newly-hidden pairs, each accepted in writing** (`§2.4`): CA×T3 (bound 1 — void is
"was never true"), CA×T4 (authority follows the ACTIVE org), CA×T8 and CA×T10 (the intended
mechanism change), and **CA×T9** — a person with **no affiliation row at all** becomes
`platform_admin`-only. ⚠ CA×T9 is the one with real product consequence and it is accepted with
its blast radius named: the state is **constructed**, every person is created through an
affiliation-creating door, and the seed's only affiliation-less profile is `platform@test.local`
(`is_admin`, already reached by `app.is_admin()`). ⛔ Recorded as an accepted narrowing, not as
"cannot happen" — *"not reachable" is not "protected"*.

### What the seed cannot reach, and what was built instead

⛔ **No seeded persona holds a membership or affiliation outside its home org, and there is no
cross-org persona.** The cross-org axis is therefore built from `solo.c@test.local` — org C, a
one-person organisation — as the **actor**, with T10 as the only subject it can ever reach. A
cross-org claim written against `multi@test.local` would have passed while proving nothing.

### Why the policy-level numbers are not absorbed by permissive siblings

All three policies are permissive and OR'd, so a table-level read test normally proves nothing
about one leg. `§0.2`/`§0.3`/`§0.5` buy the isolation — every fixture person holds **zero**
memberships and **zero** hospital affiliations and no caller is a platform admin — which is what
licenses `§3.1`/`§3.2` to assert that policy-level visibility **equals** the leg, pair for pair,
on both re-predicated tables.

### The `professional_credentials` widening candidate — MEASURED, not inherited

AE2.2 handed this over as *"believed set-identical, but that is an argument, not a measurement"*.
Measured over all 50 pairs: **`§5.1`** credentials-visible ⇒ profiles-visible, **0 violations**;
**`§5.2`** the two are equal in **both** directions, **0 mismatches**; **`§5.3`** at least 5 pairs
actually read a credential, so neither is a true statement about an all-false matrix. **The
implicit `profiles`-RLS gate the migration removed binds on ZERO pairs.**

⚠ Stated so neither half is oversold: the removed gate could only ever **bind** if the credentials
leg's inner condition were not itself a disjunct of the `profiles` SELECT policy — and it was, and
its replacement still is (`§1.2` pins exactly that, so a future divergence reds and forces the
measurement to be redone). Given that, the old leg reduces to its inner condition **under both
readings** of how Postgres applies RLS to tables referenced inside a policy expression, so the
conclusion does not depend on resolving that question. The behavioural half — that the gate is
non-binding **in fact, on every pair** — is measured, not reduced.

### The roster door's divergence, measured rather than argued

`§6.2` reproduces the **whole** old row filter (`home_organization_id = v_org_id and is_active and
not is_admin and not exists(memberships)`), not just its changed conjunct: all ten were addable to
CCIH. `§6.3` measures exactly **{T1, T7}** under the new one — 10 → 2. `§6.6` measures the roster
**widening** at org B: **{T4, T7, T8}** are addable there although their column says org A, while
**T5**, whose org-B row is ENDED, is not.

⭐ **`§6.4` is the assertion that turns AE2.2's stated intention into a measurement:** T2, T5 and
T6 **are** retained for org A by the authority predicate and are **not** addable to org A's
commission. The two doors answer different questions — *"who may ADMINISTER"* vs *"who may be
STAFFED"* — and if anyone ever unifies them, `§6.3` and `§6.4` disagree.

### Seed population — a floor, not an exact count

`§8.1` floors the seed snapshot at ≥ 30 persons (catalog-driven counts drift); `§8.2` measures
**zero movement** across the whole seed roster for all three `org_admin` callers; `§8.3` floors
the both-true pairs at ≥ 25 so that zero delta is agreement between two live predicates rather
than two silent falses. This is the near-zero movement ADR 0163 predicted, and it is what makes
"every widening is pre-declared or it is a red" affordable rather than a rubber stamp.

### ⛔ THE VACUITY PROOF — `392` was GREEN ON ITS FIRST RUN, which is a finding

A differential written against an **already-landed** migration cannot be red-first, so its green
proves nothing on its own. Eight mutations, each applied in-DB, each **asserted to have LANDED
from `pg_proc` / `pg_policies` (never from a command's exit status)**, each rolled back and the
rollback verified byte-identical. **Run shape was captured for every run: `Files=2, Tests=39`
throughout** — no run ever aborted, so no `ERROR` was ever counted as a hold.

| # | mutation | assertions that RED | exit |
| --- | --- | --- | ---: |
| **V1** | `person_authority_orgs` arm 2: drop the `not exists (… active …)` guard | §2.2, §2.4 | 1 |
| **V2** | filter voided **after** `max()` (the ordering bug) | §2.2, §2.4, §2.6, **§3.3**, §6.4 | 1 |
| **V3** | bound 1 removed entirely (voided rows count) | §2.2, **§2.3**, §2.4, §2.6, §3.3, §6.4 | 1 |
| **V4** | `list_addable_commission_members`: drop the `ended_on` conjunct | **§6.3**, **§6.6** | 1 |
| **V5** | `can_administer_person_via_affiliation` → `select true` | §2.2, §2.3, §2.4, §2.6, **§4.3, §4.4**, **§8.2** | 1 |
| **V6** | drop the leg from `professional_credentials_select` **only** | §1.2, **§3.2**, **§5.2, §5.3** | 1 |
| **V7** | drop the leg from **both** `profiles` SELECT policies | §1.2, **§3.1**, §3.3, §3.4, **§5.1, §5.2** | 1 |
| **V8** | `grant execute on app.person_authority_orgs to authenticated` | **§7.1** | 1 |

⭐ **V6/V7 exist because V1–V5 could not have proven `§3.1`/`§3.2`/`§5.x` non-vacuous.** Those
mutate the **predicate**, and policy-level visibility moves *with* it — the equality holds on both
sides of the mutation and the assertions stay green while asserting nothing. V6/V7 break the
**coupling** instead, leaving the predicate intact and removing the leg from the policies. That is
the class this repo has paid for repeatedly: *an assertion that moves with its subject has not been
shown able to fail.*

⭐ **Only V3 reds `§2.3`** — the undeclared-widening rule. V1/V2 move cells that were *already*
`old = true` for CA, so they lose a **narrowing** rather than gain a widening. V3 makes T6's voided
org-B row the `max()`, which hands `orgadmin.b` a person they never had: an **undeclared widening**,
and the only mutation of the eight that produces one.

⚠ **Not shown able to fail, stated rather than glossed:** §0.1–§0.8, §1.1, §2.1, §2.5, §4.1, §4.2,
§6.1, §6.2, §6.5, §7.2, §8.1, §8.3. Every one is a **precondition, floor, control, cross-check or
shape pin** — their job is to red when the *fixture or the surface* changes, not when the predicate
does, and no predicate mutation can exercise them. That is a stated bound on the mutation audit,
not a claim of full coverage.

Policy quals were verified **byte-identical after V6/V7** (`md5(qual)` per policy, all three
unchanged), so `387 §C1`'s pinned qual-text md5 did not move; and the whole run was followed by a
fresh `supabase db reset` before any gate figure was taken.

### ⛔ Where reality disagreed with AE2.2's expectations

1. **`app.can_administer_person_for` still reads `profiles.home_organization_id`** — measured: 12
   functions still name the column after AE2.2, and that one is the **capability** predicate
   (`fields` / `credentials` / `cpf_change` / `lifecycle`). So ADR 0163's ruling is today
   implemented **only on the read side**: the SUBSET-capability retention it grants is still being
   delivered by the column, and re-predicating it is **AE2.4's**, not a gap in AE2.2. Behaviour is
   unchanged today because a person's home org and their retaining org coincide everywhere in the
   seed; they diverge exactly on the constructed cells T4/T5/T6/T8/T10. ⛔ **AE2.3b must carry a
   capability-level differential for those five, or the column drop will silently move write
   authority.**
2. **`391` cannot be run alone.** It aborts with `schema "test_helpers" does not exist`
   (`Files=1, Tests=4`, `Result: FAIL`) — a FAIL-shaped abort that ran 4 of 15 assertions. The same
   is true of `392`. The correct single-suite invocation is `00_setup.sql` + the suite, and every
   verdict above records its run shape so an abort cannot be counted as a hold.
3. **Everything else matched.** The 50-cell expectation table was written from the catalog before
   the first behavioural run and matched it exactly — all five widenings, all five narrowings, and
   the seed's zero movement.

### Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | clean | **0** |
| `npm run test:db` | **240** files, **7979** tests, PASS (239/7941 → +1 file, +38 assertions: exactly this suite, nothing else moved) | **0** |
| `npm run lint` (11 gates) | pass (adr-index: 161 ADRs, next free 0164; service-role registry 44==44; mojibake 2989 files clean) | **0** |
| `npm run typecheck` | pass | **0** |
| `npm run test` (vitest) | 145 files, **1974** tests | **0** |
| `npm run gen:types` | not run — **no migration in this task**; `392` is a test file and the catalog is byte-identical to the AE2.2 head (all three mutated bodies restored and md5-verified) | n/a |

⛔ Not run here, by instruction: the ARM sweep and `e2e:prod` — those are the phase gate, run by
the lead. ⚠ `392` adds **no** new gate or `prosecdef` boolean, so it introduces nothing for
`ARM=census` to find; the AE2.2 gate subset stands unchanged.

## AE2.4 increment 1 — the circular pair (migration `20261003005600`, suite `393`)

Ruling ADR [0164](../decisions/0164-tenant-containment-moves-from-creation-time-to-the-destructive-event.md);
re-expression + rejected alternative ADR
[0165](../decisions/0165-affiliation-derived-tenant-gate-and-its-widening.md); security context ADR
[0159](../decisions/0159-invariant-backstops-run-as-definer.md) D1/D2.

### The per-object contract (old → new), reproduced from the catalog BEFORE the change

| object | old | new |
| --- | --- | --- |
| `public.assert_profile_tenant_has_org` (**name kept** — a rename orphans every name-keyed verdict) | trigger on `profiles` AFTER INSERT OR UPDATE OF `home_organization_id, is_admin`; body `new.home_organization_id is null and not new.is_admin` → raise. `prosecdef = f`, EXECUTE `{postgres, authenticated, service_role}` | constraint trigger `org_affiliation_tenant_containment_trg` on `organization_affiliations` AFTER **UPDATE OF `voided_at` OR DELETE**, DEFERRABLE INITIALLY DEFERRED; body: `old.principal_id` must keep ≥ 1 **NON-VOIDED** org affiliation unless `is_admin`. **`prosecdef = t`**, pinned `search_path`, EXECUTE **owner-only** |
| `app.affiliate_person_to_org_impl` | `v_person_org is null or v_person_org is distinct from p_organization` → `HC0R0` | `if not found` → `HC0R0`; then ≥ 1 non-voided affiliation **and none in `p_organization`** → `HC0R0`. Same SQLSTATE, same pt-BR message, conflation preserved |
| `app.affiliate_person_impl` (**pulled into this increment by lead ruling**) | identical, against `v_org := app.org_of_hospital(p_hospital)` | identical, against `v_org` |
| `app.tenant_orphan_profiles()` **(new)** | — | DEFINER, STABLE, pinned, **`postgres`-only** EXECUTE; returns `(profile_id, reason ∈ {never_affiliated, all_voided})` |

Everything outside the gate in both doors — authority arms, the `HC0R4` deactivated check, the
idempotency, the org-parent ensure, every comment — is reproduced **byte-for-byte** from
`pg_get_functiondef()` at head `20261003005500`; the migration is generated from that dump with a
guarded replacement, so nothing else could drift.

⭐ **`affiliate_person_impl` was verified identical, not transplanted.** Both gates were lifted from
`pg_proc` and diffed: byte-identical apart from the organisation expression. `393 § 5.7` re-derives
that identity every run (2 doors, 1 distinct normalised predicate), so a fix applied to one sibling
and not the other reds. This reverses the increment's original scope — the lead ruled it in because
*"one axis was swept, its sibling was not"* has already happened three times in this phase.

### The mitigation, and the proof it can fire

ADR 0164 requires app-side compensation **or** an orphan-detection assertion. Chosen: the detector,
because app-side compensation lives in `src/lib/users/actions.ts`, which increment 3 owns.

**The discriminator is `is_admin`, and that choice is the whole point.** `393 § 1.3` re-measures
that the `platform_admin` genuinely has zero non-voided org affiliations — so an orphan is
**shape-identical to a legitimate row**. A detector keyed on absence alone flags the platform admin
forever; one tuned to ignore "no affiliation at all" ignores exactly the shape it hunts. `is_admin`
is orthogonal to affiliation-presence.

- `§ 1.2` seed population = **0** orphans (snapshotted **before** this file constructs any).
- `§ 1.3` + `§ 1.4` = the discrimination claim: same shape, different verdict.
- `§ 1.5` a **constructed** never-affiliated orphan **is** flagged; `§ 1.6` an all-voided one is
  flagged with the other `reason`; `§ 1.7` an ENDED, non-voided person is **not**.
- **Mutation M8** (detector made blind) reds § 1.5/§ 1.6; **M7** (discriminator removed) reds
  § 1.2/§ 1.4. Neither assertion is vacuous.

**The reachability bound is measured, not asserted** (`§ 1.8`/`§ 1.9`, each with a positive control):
the orphan appears in `list_org_people` neither under `p_include_ended` nor by exact-match CPF,
while an ENDED non-voided person with a CPF **is** returned. Full path sweep in ADR 0165.

### Arm domains — derived per function from the catalog, with the harness's own domain SQL

⛔ **The containment trigger MIGRATED OUT of two domains at once.** Before: `prosecdef = f`, `public`,
plpgsql, `authenticated`-executable → **in** census clause 2 **and in `ARM=wrapper`**. After: DEFINER
+ owner-only EXECUTE → **out of all four** (census c1/c2, ARM 1 predicate, ARM 5 wrapper). That is
plan rule 4's *"a REVOKE moves a door between domains"* firing on a `prosecdef` flip and an ACL
narrowing together. `app.tenant_orphan_profiles()` is out of all four too (set-returning but not
`authenticated`-reachable — the `app.person_authority_orgs` disposition). Both doors: unchanged,
out of all four. Reasoning + the per-object list: `docs/reviews/authz-door-audit-findings.md`
§ Note 2026-08-28. Its `authz-unswept-backlog.txt` line was **removed in place with the reason**,
because its stated basis ("INVOKER wrapper, no openable guard") is now false.

⛔ **Absence of a verdict is absence of coverage.** Named compensating control, itself
verdict-carrying: `393 § 2` — accept **and** reject on the state axis (§ 2.1–2.4, § 2.8) and the
**actor** axis (§ 2.5–2.7), plus `§ 2.9` stating that the DELETE arm is **unreachable** (the refusal
comes from `guard_org_affiliation_no_delete`, matched on its message since both raise 23514) and has
therefore **not** been shown able to fire.

**Arms re-run after the change, exit codes captured directly:**

| arm | asks | enumerated | exit |
| --- | --- | --- | ---: |
| `ARM=census` | has anything **ever asked** about this gate? | **565** live gates (566 → 565: exactly the one that left the domain) / **601** verdicts (602 → 601: exactly the removed backlog line) · INVARIANT HOLDS | **0** |
| `FROMFINDINGS=1 ARM=wrapper` | the `prosecdef = f` half | BLIND set **41**, unchanged, all allowlisted | **0** |

⚠ Not run here: `ARM=floor`, `ARM=hat`, the diff-scoped policy sweep and `e2e:prod` — the lead's.

#### ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**: migrations touched, ZERO cases derived

Per ADR 0079 Amendment 8 ruling 2 and CLAUDE.md § 6 that is **never a pass**. The four functions it
lists as EXCLUDED-BY-NAME are ruled individually below; the deriver's own options do not apply, and
both halves of why are measured rather than argued:

- **Option (a) — "widen `CASES=` and sweep them" — is unavailable BY CONSTRUCTION for all four.**
  The sweep can neutralize only a **boolean** predicate. Catalog-measured return types:
  `assert_profile_tenant_has_org` → `trigger`; `tenant_orphan_profiles` → set-returning `record`;
  `affiliate_person_to_org_impl` and `affiliate_person_impl` → `uuid`. None is `bool`.
- **Option (b) as literally worded — "these migrations contain no policy and no `prosecdef` gate" —
  is FALSE.** All four are `prosecdef = t`, and **two of them are authorization decisions**:
  `affiliate_person_{to_org_,}impl` read caller identity and raise `42501` *'sem permissão'*
  (measured over comment-stripped `prosrc`, not inferred from their names).
- **So the ruling is the third form, the one AE2.2 used for `list_addable_commission_members`:** the
  compensating control is the targeted mutation audit, **named per function** — see the subject
  column below — and it carries verdicts of its own.

**Classification of the four** (ADR 0159 D2's discriminator: *does it read caller identity?*):

- `public.assert_profile_tenant_has_org` — reads caller identity **false**, raises no `42501`, not
  `authenticated`-executable. **An invariant backstop, NOT an access decision.** ⚠ Its fail-open mode
  is not abstractly "security-relevant" — it is **coupled to this increment's own widening**: an
  orphan produced by a fail-open void is exactly the shape the re-expressed tenant gate now lets any
  org **or hospital** admin claim. That coupling is why it owes a case despite not being a gate.
- `app.tenant_orphan_profiles` — no caller term at all, `postgres`-only, STABLE, set-returning.
  **Not a gate** → `helper:`, the `app.person_authority_orgs` disposition. M7/M8/M13/M14 are firing
  proofs of a **required mitigation**, not keystones of an access decision.
- `app.affiliate_person_to_org_impl` / `app.affiliate_person_impl` — **are** gates, measured.

**Two domain qualifiers that must travel with any "arms green" sentence about this increment:**

1. ⚠ **M5/M6/M10/M11/M12/M15 cover the doors' TENANT conjunct — NOT their AUTHORITY arms.**
   `app.is_org_admin_of_for` / `is_hospital_admin_of_for` are unchanged by this increment and carry
   pre-existing `42501` cells in `302` and `379`. **That is not a gap**, but "the mutation audit
   covers the doors" must not be read as covering their authority arms. Both halves stated.
2. ⚠ **The reachable surface is the `public` wrappers** — `affiliate_person`,
   `affiliate_person_to_org` (DEFINER, `uuid`, `authenticated`-executable) — which sit in the
   **`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2)** class: outside every arm's domain by construction,
   before and after this increment. The `impl` bodies the mutations target are `postgres`-only.

⚠ This increment adds **no** RLS policy and **no** `prosecdef` boolean gate, so
`scripts/door-sweep-cases.sh` has nothing of that shape to derive; the two new objects are a trigger
function and a set-returning helper, neither neutralizable by ARM 1.

⛔ **A hazard caught by re-deriving the delta instead of reading "INVARIANT HOLDS".** The first draft
of the findings note carried the domain matrix as a **Markdown table**, and `ARM=census` reported
**607** verdicts instead of 601 — `verdicts_from_findings` takes column 1 of *every* `| ` line in
that file, so six rows of documentation became six manufactured verdicts. An instrument that creates
what it counts, and it would have masked a real newcomer. The note now carries a list, not a table.

### AE2.3b cells for this increment — the write/containment differential

Both predicates evaluated in one transaction, per case; the OLD gate reproduced from an **RLS-free**
snapshot of the column (it was a read inside a DEFINER door against the row in hand, never a re-read
under the caller's RLS).

| tier | cell | state | old | new |
| --- | --- | --- | --- | --- |
| org | W1 / W2 / W3 | active A · ended-non-voided A (rehire) · **no affiliation (person creation)** | pass | pass |
| org | W4 | column B, active B | HC0R0 | HC0R0 |
| org | **W5 / W6 / W7** | column B + no row · voided-only · **true orphan** | HC0R0 | **pass — WIDENING** |
| org | W8 | active in A **and** B (idempotent path) | pass | pass |
| org | **W9** | column A, only ended-non-voided in B | pass | **HC0R0 — NARROWING** |
| org | W10 | no profile at all | HC0R0 | HC0R0 |
| hosp | H1 / H2 | no affiliation (creation) · ended-non-voided A (**D5 one-step rehire**) | pass | pass |
| hosp | H3 | column B, active B | HC0R0 | HC0R0 |
| hosp | **H4** | column B, no affiliation | HC0R0 | **pass — WIDENING** |
| hosp | **H5** | column A, only ended-non-voided in B | pass | **HC0R0 — NARROWING** |

The widening list is written **independently** of the expectation table (`§ 3.2`/`§ 5.2` compare
MEASURED against DECLARED; `§ 3.4` compares EXPECTED against DECLARED, so the two hand artefacts
cannot drift into agreement). `§ 3.5`/`§ 5.4` floor both predicates as genuinely mixed (5/5 and 7/3;
3/2 and 3/2), so a match is agreement between two live predicates and not between two constants.
`§ 3.6`/`§ 3.7` pin **HC0R0** and the verbatim pt-BR message across both tiers, W10 included.

⭐ **W8 is `=`, not a narrowing, and that is a deliberate refinement.** The obvious predicate — *"no
non-voided affiliation outside `p_organization`"* — refuses every person active in two
organisations, **including on the door's own idempotent early-return path**. Caught by writing the
cell, not by reading the body.

### ⛔ THE VACUITY PROOF — sixteen mutations, and one found a live defect in MY OWN keystone

Every mutation applied in-DB via `pg_get_functiondef()` + `replace` + `execute`, with the `do` block
raising if the replacement was a no-op; every one **asserted to have LANDED from `pg_proc`** (md5,
length, `prosecdef`, marker presence) and **never** from a command's exit status; every restore
replayed from the captured definition and verified **byte-identical** by md5. **Run shape captured
for every run: `Files=2, Tests=45` throughout** — no run aborted, so no `ERROR` was counted as a hold.

⛔ **The table carries the SUBJECT, not just the change.** A mutation list keyed only by what it
edits reads as a per-function verdict without being one; the lead's zero-case ruling needs
*"which mutation is THIS function's targeted case"*, and that question is unanswerable from a
subject-less table. Rounds 2 and 3 exist because producing this column exposed four assertions
no mutation had ever moved.

| # | subject | mutation | assertions that RED | exit |
| --- | --- | --- | --- | ---: |
| **M1** | `assert_profile_tenant_has_org` | containment predicate → never raises | § 2.1, § 2.4 | 1 |
| **M2** | `assert_profile_tenant_has_org` | ⭐⭐ `alter function … security invoker` (context only; body md5 unchanged) | **§ 0.3, § 2.5** | 1 |
| **M3** | `assert_profile_tenant_has_org` | the `is_admin` exemption removed | § 2.8 | 1 |
| **M4** | `assert_profile_tenant_has_org` | non-voided narrowed to ACTIVE | § 2.3 | 1 |
| **M9** | `assert_profile_tenant_has_org` (**ACL**) | `grant execute … to authenticated` | § 0.5 | 1 |
| **M16** | `assert_profile_tenant_has_org` | containment **always** raises | **§ 2.2**, § 2.3, § 2.5 | 1 |
| **M5** | `affiliate_person_to_org_impl` | the whole compound tenant gate → never raises | § 3.1, § 3.2, § 3.3, § 3.5, § 5.7 | 1 |
| **M10** | `affiliate_person_to_org_impl` | the `if not found` raise's **message** only | **§ 3.7** | 1 |
| **M11** | `affiliate_person_to_org_impl` | ⭐ conjunct **1** only (*has ≥ 1 non-voided anywhere*) | § 3.1, § 3.2, § 3.3, § 3.5, **§ 3.8**, § 5.7 | 1 |
| **M12** | `affiliate_person_to_org_impl` | ⭐ conjunct **2** only (*none in `p_organization`*) | § 3.1, § 3.3, § 3.5, **§ 3.9**, § 5.7 | 1 |
| **M15** | `affiliate_person_to_org_impl` | the containment raise's **SQLSTATE** only (`HC0R0`→`HC0RZ`) | **§ 3.6**, § 5.7 | 1 |
| **M6** | `affiliate_person_impl` | ⭐ the same compound gate, **sibling only** | § 5.1, § 5.2, § 5.3, § 5.4, § 5.7 | 1 |
| **M7** | `tenant_orphan_profiles` | `not p.is_admin` removed | § 1.2, § 1.4 | 1 |
| **M8** | `tenant_orphan_profiles` | made blind (flags nobody) | § 1.5, § 1.6 | 1 |
| **M13** | `tenant_orphan_profiles` | non-voided narrowed to ACTIVE | **§ 1.7** | 1 |
| **M14** | `tenant_orphan_profiles` (**ACL**) | `grant execute … to authenticated` | **§ 1.1** | 1 |

**Targeted cases per function, which is the form the zero-case ruling needs:**
`assert_profile_tenant_has_org` → M1, M2, M3, M4, M9, M16 · `affiliate_person_to_org_impl` → M5,
M10, M11, M12, M15 · `affiliate_person_impl` → M6 · `tenant_orphan_profiles` → M7, M8, M13, M14.
**All four have targeted cases; none is uncovered.**

⭐ **M6 exists because M5 could not have proven § 5 non-vacuous.** Mutating the org door moves § 3
*and* § 5.7; only mutating the sibling **alone** shows that the hospital-tier cells are held by the
hospital-tier predicate and not riding on the org one. Same reasoning as 392's V6/V7.

⭐⭐ **M11/M12 PARTITION THE COMPOUND GATE, and that partition is a result.** M5 proves the gate
matters; it can never show *which arm* does — the lesson AE2.2 paid for with
`list_addable_commission_members`. Measured, the two arms are cleanly separable:

- **conjunct 1** (*has ≥ 1 non-voided affiliation anywhere*) holds **person creation** (§ 3.8 reds
  under M11, not under M12) **and all three declared widenings** (§ 3.2 reds under M11, **not**
  under M12). It is the load-bearing half of this increment's widening, and now measurably so.
- **conjunct 2** (*none of them is in `p_organization`*) holds **one-step rehire** (§ 3.9 reds under
  M12, not under M11).
- **both** hold the narrowing and the floor (§ 3.3 / § 3.5 red under either).

⭐ **M10/M15 are deliberately complementary**, so § 3.6 and § 3.7 are each shown able to fail
*independently*: M10 moves the not-found **message** and leaves the code (reds § 3.7 alone, proving
the not-found / wrong-organisation **conflation** — the security property, since splitting them
makes the door a cross-tenant existence oracle); M15 moves the containment raise's **SQLSTATE** and
leaves the message (reds § 3.6 alone).

⭐ **M16 is the ACCEPT side's proof.** Every § 2 accept cell is a `lives_ok`, and M1 (*never raises*)
cannot move one — so before M16 the entire accept side had never been shown able to fail. ⚠ § 2.8
does **not** red under M16, and that is informative rather than a miss: the `is_admin` exemption
returns before the containment check, so § 2.8 is held by the exemption arm (M3) and § 2.2/2.3/2.5
by the containment arm.

#### ⛔⛔ M2's FIRST RUN REDDED ONLY § 0.3 — my keystone could not fail, and the reason inverts ADR 0159

The first draft of the trigger contained `if not found then return null` after the `profiles` read
("no profile, nothing to contain"). Under `security invoker`, § 2.5 stayed **green**. Measured
directly rather than reasoned about, with a `raise notice` build: `current_user = authenticated`,
`session_user = postgres`, **visible non-voided rows = 0** — so the trigger *was* running under the
caller's RLS, but it never reached its containment check, because **profile visibility is itself
affiliation-derived since AE2.2** (`profiles_select_self_or_admin` →
`app.can_administer_person_via_affiliation`). A caller blind to the affiliations is blind to the
subject's `profiles` row as well.

⭐ **The two blindnesses are CORRELATED, and the escape hatch converted the whole regression into a
SILENT ACCEPT** — a fail-OPEN that orphans the person, strictly worse than the false-positive
refusal ADR 0159 predicts, and **invisible to an accept cell**. ADR 0159's hospital-tier case fails
the other way because *its* subject row is the one being written.

**Fix:** the trigger now **fails closed** — a subject that cannot be resolved is treated as
non-admin and falls through to the containment check. Under DEFINER that branch is unreachable
anyway (`guard_profile_no_delete` blocks profile deletes; `profiles_id_fkey` is ON DELETE RESTRICT),
which is what makes fail-closed free here rather than a trade. After the fix M2 reds **§ 0.3 and
§ 2.5**. ⛔ Recorded because it is the exact shape this increment refused to accept from its own
brief, found in this file, by mutation and not by reading.

⚠ **Not shown able to fail — 17 of 44, stated rather than glossed:** § 0.1, § 0.2, § 0.4, § 0.6,
§ 0.7, § 1.3, § 1.8, § 1.9, § 2.6, § 2.7, § 2.9, § 3.4, § 4.1, § 4.2, § 4.3, § 5.5, § 5.6. Every one
is a structural pin, precondition, non-vacuity floor, RLS control, cross-check between two hand
artefacts, catalog measurement, or a declared-unreachable arm — their job is to red when the
*surface or the fixture* changes, not when a predicate does, and no predicate mutation can exercise
them. **27 of 44 are proven able to fail.** A stated bound on the audit, not a claim of full
coverage.

⛔ **This list shrank from 22 to 17 because it was AUDITED, not because more tests were written.**
Five of the original 22 (§ 1.1, § 1.7, § 3.7, § 3.8, § 3.9) were assertions the report's prose
implied were covered and no mutation had ever moved; § 3.6 and § 2.2 were two more found while
compiling the list. ⭐ The instrument that found them was the **subject column** above: an
assertion-keyed mutation list cannot show that a *cell* is unexercised, only that a *mutation* ran.

### ⛔ Where reality disagreed with the brief, ADR 0164, and the phase record

1. ⭐⭐ **THE `hospital_admin` CONTAINMENT-ACCEPT CELL HAS NO SUBJECT.** The brief (and the AE2.2
   record, three times) says the INVOKER trap must be caught by a `hospital_admin` accept cell.
   Measured (`§ 4.3` asserts it from the catalog rather than stating it): `authenticated` holds only
   `r` on `organization_affiliations` and the table carries no non-SELECT policy, so every write is
   a DEFINER door; **exactly one** door writes `voided_at` (`app.void_org_affiliation_impl`) and its
   authority arm is `app.is_org_admin_of_for` **only** — no hospital arm (ADR 0151 D8).
   `app.affiliate_person_impl` only INSERTs org affiliations, which cannot fire a void/delete
   trigger. **No `hospital_admin` can fire the new trigger by any path.** The keystone is therefore a
   **cross-org-blind `org_admin`** (§ 2.5), and the `hospital_admin` rehire survives as § 4.1,
   explicitly labelled a hospital-tier **regression control** and not this trigger's keystone —
   labelling it otherwise would have been the keystone-that-could-not-fail shape. Lead independently
   re-derived and accepted, 2026-08-28.
2. **ADR 0159's predicted failure mode is wrong for this trigger** — fail-OPEN, not false positive.
   See the M2 subsection above. Recorded in ADR 0165 § Consequences.
3. **The widening is wider than "orphan recovery" makes it sound**: the hospital door's authority arm
   includes `hospital_admin`, so a hospital admin can claim an orphan too (cell H4).
4. ⚠ **Voiding a person's last non-voided affiliation now raises a raw `23514`** from the trigger.
   Unlike its hospital-tier precedent (ADR 0156, where "every reachable path refuses earlier"), this
   raise **is** reachable by a user action, so it can surface unmapped in the UI. Owed: a mapped
   `HC0R*` refusal inside `void_org_affiliation`, with its own `toState` mapping — a separate change.
5. ⚠ **`gen:types` produced NO diff**, and that is expected rather than a skipped step: no table
   changed and both new/changed functions live in `app` or return `trigger`, so PostgREST's schema
   is untouched.

### ⛔ STALE ASSERTIONS THIS INCREMENT CREATED — the drop increment's checklist

Every one of these says an invariant is enforced by a trigger that no longer exists. The two inside
this increment's own scope are **fixed**; the rest are listed because a stale assertion recorded only
in prose is how these survive:

- ✅ **fixed** `supabase/tests/180_user_registration.sql` § (a) — it *asserted* the dropped trigger's
  existence and was **RED** in the full suite. Rewritten onto the new trigger. Its § (b) was
  **re-labelled**: the count is now a statement about the SEED, not about an enforced invariant.
- ✅ **fixed** `supabase/tests/00_setup.sql:168` and `supabase/tests/385_…:371` — comments citing the
  trigger as the mechanism.
- ⛔ **owed** `public.handle_new_user` body comment: *"the `profiles_tenant_has_org` CHECK then
  rejects a non-admin insert"* — **nothing does now**. Not edited here: that function must be
  rewritten at the column drop anyway, and rewriting it twice in one phase is what AE2.2 avoided.
- ⛔ **owed** `src/lib/members/invite.ts:35` and `src/lib/users/actions.ts:739` — same false claim.
  `users/actions.ts` is increment 3's file; not touched, to keep file ownership clean.
- ⛔ **owed, and NOT ours** `e2e/phase13-audit.spec.ts:139` — tester's scope.
- ⛔ **owed** `docs/backend-state.md` lines **396**, **599**, **5674** — the backend surface map names
  `profiles_tenant_has_org_trg` as a live anchor invariant, and line 599 gives it as the *reason*
  `finalize_invited_person_for` omits the column from its write list.
- ⛔ **owed, and it is a CONSUMER not just a comment**: `resolveOrInviteUser`
  (`src/lib/members/invite.ts:51`) resolves an **email** to a person id with no affiliation
  predicate and gates on `home_organization_id`. It is not named in any increment's target list and
  the drop must handle it (ADR 0165 § Consequences).

⚠ **A method note, because the miss was in the instrument.** The blast-radius sweep for
`profiles_tenant_has_org` was piped through `head -40` and silently stopped at `e2e/` — the
`supabase/tests/` hits, including the one that was **RED**, were below the cut. The truncated output
read as a complete sweep. Re-run unbounded, there were 59 references.

### Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | clean | **0** |
| `npm run test:db` | **241** files, **8023** tests, PASS (240/7979 → +1 file, +44 assertions: exactly suite `393`, nothing else moved) | **0** |
| `npm run lint` (11 gates) | pass (adr-index: **163** ADRs, next free 0166; mojibake 2991 files clean) | **0** |
| `npm run typecheck` | pass | **0** |
| `npm run test` (vitest) | 145 files, **1974** tests | **0** |
| `npm run gen:types` | run after the migration; **no diff** (see disagreement 5) | **0** |
| `ARM=census` | 565 live / 601 verdicts · INVARIANT HOLDS | **0** |
| `FROMFINDINGS=1 ARM=wrapper` | BLIND 41, unchanged | **0** |

**Red-first, recorded with its shape:** `393` was run against the **un-migrated** catalog before the
migration existed. `Files=2, Tests=8` — § 0.1/0.2/0.3/0.5/0.6/0.7 **RED**, then an abort at the
detector snapshot (`function app.tenant_orphan_profiles() does not exist`). ⚠ § 0.4 (pinned
`search_path`) passed pre-migration and could not have failed on that axis: the outgoing function
already carried the same `search_path`. Said rather than counted as a red.

## AE2.4 increment 3 — the write-authority path (migration `20261003005700`, suite `394`)

Rulings ADR [0163](../decisions/0163-offboarded-person-lifecycle-authority.md) (last-org
retention) and [0164](../decisions/0164-tenant-containment-moves-from-creation-time-to-the-destructive-event.md)
(this increment is the **hard gate on the column drop**); shape ADR 0155 D3 / **Architecture
Rule 13**.

### The per-object contract (old → new), reproduced from the catalog BEFORE the change

| object | old | new |
| --- | --- | --- |
| `app.can_administer_person_for(text, uuid, uuid)` (**name kept** — a rename orphans every name-keyed verdict) | `v_org uuid` ← `select pr.home_organization_id … where pr.id = p_user`; three uses: (a) `v_org is null` ⇒ false, (b) `is_org_admin_of_for(v_org, p_actor)` ⇒ true, (c) `h.organization_id = v_org` scopes the hospital arm | `v_orgs uuid[]` ← `array(select organization_id from app.person_authority_orgs(p_user))`; (a) `cardinality = 0` ⇒ false, (b) `exists(unnest(v_orgs) o where is_org_admin_of_for(o, p_actor))` ⇒ true, (c) `h.organization_id = any (v_orgs)`. **Everything from D2 down byte-identical.** DEFINER, STABLE, pinned `search_path`, `postgres`-only EXECUTE — all four unchanged |
| `app.person_audit_organization(uuid, uuid)` **(new)** | — | DEFINER, STABLE, pinned, **`postgres`-only**; the located organisation **through which the actor's authority resolved**, `order by organization_id limit 1` among those the actor administers; NULL ⇒ fail-closed |
| the six kernels — `set_person_active_impl` · `suspend_person_impl` · `update_person_fields_impl` · `upsert_credential_impl` · `delete_credential_impl` · `finalize_invited_person_impl` | `select pr.home_organization_id into v_org …` | `v_org := app.person_audit_organization(p_actor, p_user)` (`delete_credential_impl` passes `v_user`; `update_person_fields_impl` drops the column from its `v_cur` record). **No other statement in any of the six changed** |
| TS twin — `authorizePersonScopedAdmin`, `authorizeForUser`, `getPersonAdminView` | three verbatim copies of the same resolution | all three on `personAuthorityOrgs(userId)`, the TS mirror of `app.person_authority_orgs`; `administeredHospitalsIn(orgIds)` shared by the two that are identical end to end |

Both `can_administer_person_for` and the six kernels were generated from `pg_get_functiondef()`
dumps at head `20261003005600` with guarded replacements, so nothing outside the changed
statements could drift.

### ⛔ THE ADR IS TRUE OF THE STRING AND FALSE OF THE GRAIN — the six kernels are not six gates

ADR 0163 records that "all six AE1.3 person-door kernels" also resolve the column. Measured: in
every one of the six the value feeds **only** `app.audit_write(p_organization => v_org)`.
Authority in all six is `app.can_administer_person_for`, which is why re-predicating that one
function is the whole authority change.

⛔ **And it is still an authorization decision, in the other direction.** `audit_log_select`
carries `((commission_id IS NULL) AND app.is_org_admin_of(organization_id))` and all six write
`p_commission => null` — so `v_org` decides **who may READ the audit row**. Lead ruled it a
read-authority differential and it is measured as one (`394 § 7`, `§ 10`).

⚠ **The tie-break is BOUNDED-BUT-ARBITRARY and is pre-declared as such** (`§ 7.4`, and stated in
the function's own body comment). Where an actor administers two located organisations, the lower
uuid wins and the **losing** organisation's other admins lose readership of that row. Any candidate
is a defensible attribution; *which* one is arbitrary, chosen for determinism. Two alternatives
rejected with reasons: `min()` over the person's organisations regardless of the actor can
attribute a row to an organisation that had nothing to do with the act; NULL-on-ambiguity hides the
row from the very admin who caused it.

### ⭐ THE CAPABILITY AXIS IS VACUOUS ON THE ORG TIER — measured, then fixed

The obvious "capability-level differential" is AE2.3a's ten targets times four capabilities. That
produces **four identical copies** and nothing else: the org_admin arm returns `true` **before** the
capability dispatch, and the INTERSECTION/SUBSET split lives on the `hospital_admin` arm, which is
reached only when the target has a **non-empty footprint** — which AE2.3a's population deliberately
lacks. **An axis that cannot vary is not an axis.** `394 § 2.2` measures the inertness on the org
tier rather than assuming it, and `§ 3.2` floors the liveness on the hospital tier so `§ 3.1` cannot
pass over a second inert matrix.

So the suite carries **two** populations: **P1–P10**, the ten AE2.3a shapes (org tier, zero
footprint), and **Q1–Q7**, built so INTERSECTION and SUBSET genuinely disagree.

### What the seed cannot reach — measured before a cell was written

- ⭐ **The seed has NO `hospital_admin` in org B.** Org B carries `orgadmin.b`, `nspcoord.b`,
  `pqs.b`, `quality.b` and no hospital admin. Every hospital-tier **widening** needs an actor
  administering a hospital in the *new* organisation, so `HB1` is **constructed**. A cell written
  against `hospitaladmin.a1` would have passed proving nothing.
- ⭐ **An ACTIVE hospital affiliation cannot strand itself in the OLD organisation.**
  `assert_hospital_affiliation_has_org` (AFF4 D4 / ADR 0151 D4) requires an active org affiliation
  in the SAME organisation, so "footprint in org A while the org affiliation is in B" is unreachable
  through that leg. It **is** reachable through the footprint's other leg — a commission membership
  that outlives the org affiliation, exactly the state the shipped comment describes. Q2 and Q5 are
  built that way. ⛔ Not "constructed inside a rollback where the deferred trigger never fires" —
  that would be measuring a cell for a state the database forbids.
- No seeded persona holds a membership or affiliation outside its home org; the cross-org actor is
  `solo.c@test.local`, as `392` established. Ids live in a `0ae24c…` namespace disjoint from
  390/391/392/393, and every deletion is by identity.

### The capability differential — 396 cells, 48 widenings, 44 narrowings

5 callers × 10 P-targets + 7 callers × 7 Q-targets, × 4 capabilities, both predicates in one
transaction. The OLD predicate is reproduced as `pg_temp.can_admin_with_orgs(cap, user, actor,
orgs[])` fed an **RLS-free snapshot** of the column.

⭐ **The reproduction's faithfulness is CONTROLLED, not assumed** (`§ 9.1`): the same reproduction
fed `app.person_authority_orgs(target)` must equal the **shipped** function on all 396 cells. That
isolates the difference between the two sides to the **organisation list alone** — any drift in the
reproduced D2 / footprint / INTERSECTION / SUBSET logic reds there instead of masquerading as a
finding in § 4 or § 5. `§ 8.2` is the second control, over the seed roster.

**Org tier (P) — reproduces AE2.3a's read-side matrix EXACTLY** (`§ 2.3`): the same five widenings
`{CB×P4, CB×P5, CB×P7, CB×P8, CC×P10}` and five narrowings `{CA×P3, CA×P4, CA×P8, CA×P9, CA×P10}`,
now on the WRITE path. Two independently written predicates agreeing cell for cell is the
cross-check that the write path did not drift from the read path.

**Hospital tier (Q) — where the capability axis is live.** Masks are (fields, credentials,
cpf_change, lifecycle):

| | Q1 active A, fp A+A2 | Q2 ended A + active B, fp STRANDED in A | Q3 active B, fp HCB+HSA | Q4 ended-B only, fp EMPTY | Q5 ended-A only, fp A+A2 | Q6 active A **and** B, fp HCA+HCB | Q7 active B, fp HCB only |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **CA** org_admin A | = | **↓×4** | **↓×4** | **↓×4** | = | = | **↓×4** |
| **CB** org_admin B | = | **↑×4** | **↑×4** | **↑×4** | = | **↑×4** | **↑×4** |
| **HA1** hosp_admin HCA | = TTFF | **↓ fields+credentials** | = | = | = TTFF | = TTFF | = |
| **HAD** hosp_admin HCA+HSA | = TTTT | **↓×4** | **↓ fields+credentials** | = | = TTTT | = TTFF | = |
| **HB1** hosp_admin HCB *(constructed)* | = | = | **↑ fields+credentials** | = | = | **↑ fields+credentials** | **↑×4** |
| **CC**, **CS** | = | = | = | = | = | = | = |

⭐ **`394 § 3.3` is the keystone cell — HB1×Q3.** A `hospital_admin` of ONE hospital in the newly
located organisation gains `fields` and `credentials` (INTERSECTION) over a two-hospital footprint
and is **still refused** `cpf_change` and `lifecycle` (SUBSET). Under the column this actor reached
**nothing**. ⛔ This is the cell the drop would have moved silently, and no seeded persona can
construct it. **HB1×Q7 is its control**: a SINGLE-hospital footprint makes INTERSECTION and SUBSET
coincide, which is what shows Q3's split is a property of the FOOTPRINT and not of the predicate.

⭐ **ADR 0163 bound 4 survives STRUCTURALLY, not incidentally** (`§ 3.4`): Q4's retaining
organisation is B and HB1 administers a hospital there, yet all four capabilities refuse — the
empty-footprint rule does it, so retention adds no hospital-tier reach by construction rather than
by the locator happening to be narrow.

**Widenings** (48 cells) are pre-declared against a hand list written independently of the
expectation table; `§ 4.1` and `§ 4.2` together make the two sets EQUAL, and `§ 4.3` floors both
predicates as genuinely mixed so a match between two constants cannot satisfy them.
**Narrowings** (44 cells) each carry a written disposition (`§ 5.1`/`§ 5.2`). The one with real
product consequence is **CA×P9** — a person with no affiliation row at all becomes administrable by
nobody, for all four capabilities. Accepted with its blast radius named: recovery is one affiliation
away, because increment 1 deliberately left an orphan claimable by any org admin (ADR 0165
W5/W6/W7), and that path does not route through this predicate. ⛔ Accepted, not "cannot happen".

⭐ The other narrowings worth reading are **HA1×Q2 / HAD×Q2 / HAD×Q3**: a `hospital_admin` of the
OLD organisation loses a person whose employment moved. The footprint is stranded in org A by a
commission membership that outlived the org affiliation; the person is org B's now, and org A's
hospital admins keeping edit rights over them is the defect, not the loss.

### ⭐ § 6 — THE RULING THAT WAS NOT TAKEN, MEASURED BESIDE THE ONE THAT WAS

ADR 0163's Decision paragraph says retention is "bounded to the **SUBSET** capabilities". Read
literally that denies an `org_admin` of the retaining organisation `fields` and `credentials` over a
fully-offboarded person — a **narrowing against today**, since the org arm holds all four.

**PO ruling 2026-08-28: the ADR is wrong, not the reading.** INTERSECTION/SUBSET (ADR 0133 Amdt 1
r1) bounds the `hospital_admin` arm and has never applied to `org_admin`; the Decision paragraph
borrowed a hospital-tier label and pinned it to an org-tier rule. ⛔ The tell is that the ADR
contradicts itself — bound 3 says retention "grants nothing beyond what an `org_admin` of an ACTIVE
affiliation would hold", and such an admin holds all four. Implementation is **capability-blind**;
ADR 0163's implementation-status section is updated here and the Decision-paragraph amendment is
the lead's.

Measured anyway, because a ruling that a reading was *not* intended is worth more with the
alternative beside it: retention fires on exactly `{P2, P5, P6, Q4, Q5}` (`§ 6.1`); the
counterfactual would move **16 of 396 cells** (`§ 6.2`), creating **12 new narrowings** and
cancelling **4 declared widenings** (`§ 6.3`). `§ 6.4` reds if anyone later "restores" the SUBSET
wording without re-opening the ruling.

### § 10 — the six kernels end to end, and why it exists

⛔ **A measured gap, not completeness.** `385` and `386` are the person-door suites and they assert
the audit row's `action`, `actor_id` and `metadata` — and **never** its `organization_id`
(grep-measured over both files before § 10 was written). That value is exactly what this increment
moves, and it is a read-authority value. Without § 10 the kernels' half of the change would have
shipped with no assertion anywhere.

⭐ **The § 10.2 floor caught an instrument defect that would otherwise have passed gloriously.** The
fixture's first draft watermarked new audit rows with `select max(seq)`. **`audit_log.seq` is
PER-CHAIN, not global** — `app.audit_write` derives it from the max within the row's own chain,
which is what makes `verify_audit_chain` work — so `where seq > that` matched **nothing**: six rows
were written and the instrument reported zero. An assertion of the form *"zero rows carry the old
value"* would have been true of an empty set. The watermark is now an id snapshot.

⛔ **And the § 10 fixture is exception-guarded, which is not defensive tidiness.** An unguarded
fixture that DRIVES the subject under test turns any mutation of that subject into a suite ABORT —
a FAIL-shaped abort that runs a prefix of the plan and is indistinguishable from a hold. Measured:
the first mutation run reported `Files=2, Tests=40` for **M1 and M4**, so § 10 never executed and
its coverage under them was UNKNOWN rather than green. Guarded, those mutations now RED § 10.1 and
§ 10.2 instead of erasing them, and every run in the table below has the same shape.

### Arm domains — derived per function from the catalog, with the harness's own domain SQL

| object | census c1 (bool / set-returning DEFINER) | census c2 (`public` INVOKER plpgsql) | ARM=policy predicate domain | ARM=floor | ARM=wrapper |
| --- | --- | --- | --- | --- | --- |
| `app.can_administer_person_for` → `bool`, DEFINER, `postgres`-only | ✅ **in** | ❌ out | ✅ **in** | ❌ out | ❌ out |
| `app.person_audit_organization` → `uuid`, DEFINER, `postgres`-only | ❌ out | ❌ out | ❌ out | ❌ out | ❌ out |
| the six `*_impl` kernels → `void`/`uuid`, DEFINER, `postgres`-only | ❌ out | ❌ out | ❌ out | ❌ out | ❌ out |
| `app.person_authority_orgs` (unchanged, AE2.2's) | ❌ out | ❌ out | ❌ out | ❌ out | ❌ out |

⚠ **`can_administer_person_for` is in two domains and already carried a verdict — which is the
danger, not the comfort.** It keeps its NAME and changed its BODY, and census backstops only
*newcomers*; the standing `COVERED` verdict was earned against the OLD predicate. This is AE2.2's
`ALTER POLICY` hazard repeating on a function. `scripts/door-sweep-cases.sh` exits **0** and derives
exactly **1 case — `can_administer_person_for`** — re-measured by the lead rather than inherited.
⚠ Note the census clause admits it on `prosecdef AND typname='bool'` alone; `authenticated`
reachability is **not** part of that clause, which is why a `postgres`-only predicate is in it.

⛔ **Absence of a verdict is absence of coverage.** `person_audit_organization` and the six kernels
are in **no** arm's domain. Named compensating controls, each verdict-carrying: `394 § 7` (5
assertions) and `§ 10` (3), with targeted mutations **M8/M9/M10/M11/M16/M17** for the attribution
locator and **M12/M13/M14** for the kernels. The deriver's 7-name review list is ruled the way
increment 1 ruled its four: option (a) — widen `CASES=` — is **unavailable by construction**,
because the sweep can neutralize only a **boolean** predicate and all seven return `void` or `uuid`.

⚠ **`person_audit_organization` is an authorization INPUT, not a helper, and that is a different
disposition from `app.person_authority_orgs` even though both are `postgres`-only and out of every
arm's domain** (lead sharpening, 2026-08-28). It supplies the column `audit_log_select` gates
commission-less rows on, so it participates in an access decision; `person_authority_orgs` contains
no caller term at all and genuinely cannot. **Same domain, different reason — and the reason is
what a later reader needs.** It is excluded from the sweep by its RETURN TYPE, not by being inert.

### ⛔ THE VACUITY PROOF — eighteen mutations, keyed by SUBJECT

Every mutation applied in-DB via `pg_get_functiondef()` + `replace` + `execute`, the `do` block
raising if the replacement was a no-op; every one **asserted to have LANDED from `pg_proc`** (md5
moved, marker present) and **never** from a command's exit status; every restore replayed from the
captured definition and verified **byte-identical** by md5. **Run shape captured for every run:
`Files=2, Tests=43` throughout** — no run aborted, so no `ERROR` was counted as a hold. Final
catalog state equals baseline for all six objects and the final suite run is PASS.

⛔ **The table carries the SUBJECT, not just the change.** An assertion-keyed list proves mutations
ran; it cannot show a cell nothing targets, because absence looks identical to not-listed.

| # | subject | mutation | assertions that RED | exit |
| --- | --- | --- | --- | ---: |
| **M1** | `can_administer_person_for` | ⭐ the LOCATE step reverted to the column — the whole-increment mutation | § 1.2, § 1.5, § 2.1, § 2.3, § 3.1, § 3.3, § 4.2, § 4.3, § 5.2, § 6.2, § 6.3, § 6.4, § 7.1, § 7.3, § 9.1, § 10.1, § 10.2, § 10.3 | 1 |
| **M2** | `can_administer_person_for` | the empty-locate deny → `return true` (the composition trap) | § 2.1, § 2.3, **§ 4.1**, § 4.3, § 5.2, § 6.2, § 6.3, § 7.1, § 8.2, § 9.1 | 1 |
| **M3** | `can_administer_person_for` | ⭐ the org arm's membership conjunct → `true` (Rule 13's forbidden collapse) | § 2.1, § 2.3, § 3.1, § 3.2, § 3.3, § 3.4, § 4.1, § 4.3, § 5.2, § 6.2, § 6.3, § 7.1, § 7.2, § 7.3, § 8.2, § 9.1, **§ 9.2**, § 10.3 | 1 |
| **M4** | `can_administer_person_for` | ⭐ the org arm removed entirely — the ACCEPT-side mover | § 2.1, § 2.3, § 3.1, § 4.2, § 4.3, **§ 5.1**, § 6.2, § 6.3, § 6.4, § 7.3, § 8.2, **§ 8.3**, § 9.1, § 10.1, § 10.2 | 1 |
| **M5** | `can_administer_person_for` | the hospital arm's **organisation** conjunct dropped | § 3.1, § 4.3, § 5.2, § 6.2, § 6.3, § 7.1, § 9.1 | 1 |
| **M18** | `can_administer_person_for` | the hospital arm's **membership** conjunct dropped (M5's other half) | § 3.1, § 4.1, § 4.3, § 5.2, § 6.2, § 6.3, § 7.1, § 7.2, § 8.2, § 9.1, **§ 9.2**, § 10.3 | 1 |
| **M6** | `can_administer_person_for` | ⭐ ADR 0163's literal SUBSET reading made live | § 2.1, **§ 2.2**, § 2.3, § 3.1, § 4.2, § 4.3, § 5.1, § 6.2, § 6.3, **§ 6.4**, § 9.1 | 1 |
| **M7** | `can_administer_person_for` (**context**) | `alter function … security invoker` (body md5 unchanged) | **§ 1.1** | 1 |
| **M8** | `person_audit_organization` | the actor filter dropped entirely — the DENY-side mover | § 7.1, § 7.3, **§ 7.5** | 1 |
| **M16** | `person_audit_organization` | ⭐ the **hospital** disjunct alone | § 7.1, § 7.2, § 7.3 | 1 |
| **M17** | `person_audit_organization` | ⭐ the **org_admin** disjunct alone | § 7.1, § 7.2, § 7.3, § 7.4, § 10.1 | 1 |
| **M9** | `person_audit_organization` | the tie-break direction reversed (`desc`) | **§ 7.4** | 1 |
| **M10** | `person_audit_organization` | returns NULL always — the ACCEPT-side mover | § 7.1, § 7.2, § 7.3, § 7.4, § 10.1 | 1 |
| **M11** | `person_audit_organization` (**ACL**) | `grant execute … to authenticated` | **§ 1.4** | 1 |
| **M12** | `set_person_active_impl` | its attribution reverted to the column | § 1.3, § 1.5, § 10.1, § 10.2 | 1 |
| **M13** | `finalize_invited_person_impl` | ⭐ the same, **sibling only** | § 1.3, § 1.5, § 10.1, § 10.2 | 1 |
| **M14** | `upsert_credential_impl` | its authority call neutralized — the DENY-side mover for § 10 | **§ 10.3** | 1 |
| **M15** | `person_authority_orgs` (**ACL**) | `grant execute … to authenticated` | **§ 1.6** | 1 |

**Targeted cases per subject, which is the form the zero-case ruling needs:**
`can_administer_person_for` → M1, M2, M3, M4, M5, M6, M7, M18 · `person_audit_organization` → M8,
M9, M10, M11, M16, M17 · the six kernels → M12, M13, M14 · `person_authority_orgs` (AE2.2's,
asserted here) → M15. **No subject is uncovered.**

⭐ **BOTH POLARITIES, PER SUBJECT — the increment-1 lesson applied rather than cited.** A "never
denies" mutation cannot move an accept cell.

- `can_administer_person_for`: accept-movers **M4** (§ 5.1, § 8.3, and § 10.1/10.2 lose their rows)
  and **M6**; deny-movers **M2** — which produces an **undeclared widening**, the only class § 4.1
  exists for — plus **M3**, **M5**, **M18**.
- `person_audit_organization`: accept-movers **M10**, **M9**, **M17**; deny-mover **M8**, the only
  one that reds **§ 7.5** (the "returns NULL for an unauthorized actor" cell).
- the six kernels: accept-movers **M12**, **M13**; deny-mover **M14**.

⭐ **M13 exists because M12 could not have proven § 10 per-kernel.** Mutating one kernel's
attribution shows § 10.1 notices *a* kernel; mutating a different one alone shows it notices *each*.
Same reasoning as `393`'s M6 and `392`'s V6/V7.

⭐ **M5/M18 and M16/M17 partition the two compound predicates**, so no arm is proven only as part of
a whole-`if` neutralization. M16 reds § 7.1/7.2/7.3 but **not** § 7.4 — informative rather than a
miss: § 7.4's actor is an `org_admin` of both organisations, so the disjunct M16 removes is not the
one that answers it.

⚠ **Not shown able to fail — 9 of 42, stated rather than glossed:** § 0.1, § 0.2, § 0.3, § 0.4,
§ 0.5, § 0.6, § 0.7, § 6.1, § 8.1. Every one is a precondition, a fixture-shape measurement or a
population floor — their job is to red when the **fixture or the substrate** changes, not when a
predicate does, and no mutation of this increment's objects can exercise them. ⚠ § 0.6 measures
`app.person_authority_orgs`' output and **would** move under a mutation of that function; it is
listed here because that function is AE2.2's and unchanged by this increment, not because it is
unreachable. **33 of 42 are proven able to fail.**

### ⛔ Where reality disagreed with the brief, the ADRs and the phase record

1. ⭐⭐ **ADR 0163's "so do all six kernels" is true of the string and false of the grain** — their
   column read is audit attribution, not authority. Corrected in the ADR. The lead ruled the second
   half the important one: it is a **read-authority** value because `audit_log_select` gates on it.
2. ⭐⭐ **ADR 0163's Decision paragraph contradicts its own bound 3** and is being amended (§ 6).
3. ⛔ **`authorizeForUser` and `getPersonAdminView` were named by NO increment's target list** and
   are the second and third copies of the same preamble. Lead assigned both here; the enumerating
   property is *"an authorization preamble that resolves the column"*, never a list. Filed as
   `FUP-AE2-PERSON-PREAMBLE-THREE-COPIES`, whose durable half is that **no gate can see a fourth
   copy appear** — a TS authorization preamble is in no arm's domain.
4. ⛔ **A defect in my own new helper, caught by a sibling's stated principle.** `personAuthorityOrgs`
   first returned `[]` on a read error. That LOOKS safe — it denies — and it is
   `BUG-AUTHZ-FOOTPRINT-ASYMMETRIC-READ-LIFTS-THE-D2-LOCK` one leg over: a silent DENY
   indistinguishable from a real one. Worse, sitting IN FRONT of `resolvePersonFootprint` it
   short-circuits that function's deliberate throw and re-hides a closed bug class behind a newer
   function. It now throws; keystone `person-footprint-reads.test.ts § 4`, with a positive control.
5. ⛔ **`audit_log.seq` is PER-CHAIN, not global** — see § 10 above. Caught by a floor, not by
   reading.
6. ⛔ **An unguarded fixture that drives the subject under test converts a mutation into a suite
   ABORT.** Measured as `Files=2, Tests=40` on two mutations before the guard. A shape drop is
   **ERROR**, never a hold.
7. ⚠ **Three vitest fixtures had built their world out of the column under test** — the pgTAP
   `360 § 5.2` shape, in TypeScript. `d14-person-level`, `person-admin-view` and
   `person-footprint-reads` anchored their targets with `profiles.home_organization_id` and never
   seeded an `organization_affiliations` row, so **42 arms** went red for a FIXTURE reason while
   wearing the label of the authority rule they exist to pin. **Fixed by mirroring the real
   substrate**, never by relaxing an assertion.
8. ⚠ **`394` was GREEN ON ITS FIRST POST-MIGRATION RUN**, every hand-computed cell matching. That is
   only trustworthy because it was **observed RED first** against the un-migrated catalog
   (`Files=2, Tests=30`; 14 assertions failing, then an abort at § 7.1 on *"function
   app.person_audit_organization does not exist"*) **and** because § 4.1 / § 5.1 were measured to
   pass **vacuously** in that red run — nothing moved, so "every widening is pre-declared" was true
   of an empty set. § 4.2 / § 4.3 are what give them teeth.
9. ⚠ **`§ 2.2` also passed pre-migration** and could not have failed on that axis then: the old
   predicate is capability-inert on the org tier for the same structural reason. Said rather than
   counted as a red. It is proven able to fail by **M6**.
10. ⚠ **`gen:types` produced no diff**, expected: no table changed and both new/changed functions
    live in `app`.

### Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | clean | **0** |
| `npm run gen:types` | run after the migration; **no diff** | **0** |
| `npm run test:db` | **242** files, **8065** tests, PASS (241/8023 → +1 file, +42 assertions: exactly suite `394`, nothing else moved) | **0** |
| `npm run typecheck` | pass | **0** |
| `npm run test` (vitest) | 145 files, **1978** tests (1974 → +4: three new `§ 4` arms and one `§ 5` arm) | **0** |
| `npm run lint` (11 gates) | pass — gate 7 needed the new FUP's index line in PROGRESS.md, which is outside this task's write scope and was added by the lead | **0** |
| `scripts/door-sweep-cases.sh` | **DERIVED (0) — 1 case: `can_administer_person_for`** | **0** |

⛔ Not run here, by instruction: the ARM sweep and `e2e:prod` — the lead's.

#### ⛔ B6 discharged — increment 3's ARM evidence, recorded here with its provenance (lead, 2026-08-28)

QA B6 was right that this record did not carry it: increment 3's own gate table says *"Not run
here… the lead's"*, and `PROGRESS.md` quoted figures the phase doc could not source. **The arms
were run.** They are written here so the evidence lives where a reader looks, rather than in a
session transcript.

**Run by the lead on a FRESH `supabase db reset`**, from the repo root with absolute paths, exit
codes captured directly (never through a pipe), at branch head `2664081c`:

- `ARM=census` — exit **0**, INVARIANT HOLDS, **565** live gates / **601** verdicts.
- `ARM=hat` — exit **0**, self-test 6/6, 3 findings all reasoned-allowlisted.
- `ARM=floor` — exit **0**, **72** `authenticated`-reachable `prosecdef` doors with 0 calls, all
  allowlisted; every allowlist entry resolves to a live door.
- `FROMFINDINGS=1 ARM=wrapper` — exit **0**, BLIND set **41**, all allowlisted.
- Diff-scoped sweep, `CASES="can_administer_person_for"` (derived, never hand-listed):
  `ARM-DOMAIN predicate=1/113 policy=0/226 out-of-domain-bool=35` · **SWEPT 1 · COVERED 1 · BLIND 0
  · ERROR 0**, exit **0 (CLEAN)**, baseline `Files=242, Tests=8065`.
- ⭐ `census` and `wrapper` were **re-run AFTER** the findings-baseline merge — 565/601 and BLIND 41
  unchanged — rather than assumed unaffected by it.

⚠ **QA's sharper half stands and is the reason this section exists.** The figures are
**digit-for-digit identical** to increment 1's census and AE2.2's floor/wrapper, and a reader cannot
distinguish *"re-measured and identical"* from *"copied forward"*. They are identical for a derivable
reason: increment 3 added **`app.person_audit_organization`**, which returns `uuid` and is
`postgres`-only and therefore **enters no arm's domain**, and modified `can_administer_person_for`,
which was **already counted**. No `public` `authenticated`-reachable DEFINER door was added (floor
unchanged) and no `prosecdef = f` function (wrapper unchanged). ⛔ **That reason is the evidence, not
the equality** — a matching number is not a matching measurement, and this paragraph exists so the
next reader does not have to take the coincidence on trust.

## AE2.4 increment 4 — the coordinator picker and the last preambles (migration `20261003005800`, suite `395`)

Ruling ADR [0164](../decisions/0164-tenant-containment-moves-from-creation-time-to-the-destructive-event.md)
§ Decision item 4 (shape **C-b′**; option **C-a REJECTED**); consumer set ADR
[0165](../decisions/0165-affiliation-derived-tenant-gate-and-its-widening.md) § Consequences.
⚠ **This increment is three column consumers, not one.** The plan and the task table named
`listLinkableOrgUsers`; `resolveOrInviteUser` was added by ADR 0165 and QA M14, and `addStaff` by QA
B1. The enumerating property is *"a predicate that resolves the person's tenancy from the column"*,
never a list — which is why this increment also ships a **module-level** property that can see the
fourth copy nobody has listed yet.

### Part A — the picker: C-b′ VERIFIED against the real callers, with the numbers

The brief required verification before commitment, and the answer is **C-b′ holds**. Measured live
on a fresh `supabase db reset` at head `20261003005700`, all three variants evaluated for the same
caller in the same transaction (`395 § 1` re-measures it every run):

| caller (role) | OLD `home_organization_id` | **NAIVE** RLS-bound affiliation | **C-b′** DEFINER bool | visible `organization_affiliations` rows |
| --- | ---: | ---: | ---: | ---: |
| `chefe.ccih` (staff_admin — the dominant caller) | **10** | **1** | **10** | 1 |
| `dr.john` (staff, Ética) | 10 | 1 | **10** | 1 |
| `multi` (staff ×2) | 13 | 1 | **13** | 1 |
| `hospitaladmin.a1` | 23 | 1 | **23** | 1 |
| `orgadmin.a` | 28 | 28 | **28** | 29 |

**The coordinator's ten are preserved; the naive re-predication collapses them to one — themselves.**
⭐ `orgadmin.a` is the row that matters for method: the naive shape works *for them*, so a
verification written against an org admin would have passed and proved nothing. `395 § 1.1–§ 1.5`
assert **set equality**, not counts, per caller; `§ 1.6` measures the naive collapse in the same
transaction so the `1` is a result rather than a remembered sentence; `§ 1.7` floors the picker at
≥ 5 rows so § 1.1 is not an agreement between two empty sets.

⛔ **No caller depends on a shape the RPC cannot return.** The two call sites are the commission case
pages (`…/casos/[caseId]/page.tsx:137`, `…/manage/cases/[caseId]/(detail)/page.tsx:169`); the value
reaches `PlatformUserField`, which reads exactly `userId`, `fullName`, `email` — `AddableUser`'s
three fields and nothing else. No caller sorts, counts, indexes positionally, passes a search term,
or catches. The `throw`-on-error contract is preserved and now pinned
(`org-roster-predicate.test.ts`), because the two neighbours in `members.ts` return `[]` on error and
"make it consistent with its neighbours" is a plausible future edit that would reintroduce ADR 0108
D6's vacuous exclusion.

### ⛔ Three places where the brief's own C-b′ description does not survive contact

1. **`setof profiles` is wrong in BOTH directions, and the return type was never what preserved the
   perimeter.** Under INVOKER the composite cannot even be produced: `authenticated` holds
   COLUMN-LIST SELECT grants on `profiles` and **no grant at all on `cpf`, `date_of_birth`,
   `phone`** (measured from `information_schema.column_privileges`), so `select p.*` raises 42501.
   Under DEFINER it would disclose all three. What preserves the perimeter is `prosecdef = f`. The
   door returns `table(user_id uuid, full_name text, email text)` — `AddableUser` exactly, and the
   same shape as its sibling `list_addable_commission_members`. `395 § 0.8` pins it.
2. **The `bool` helper does NOT land in `ARM=hat`.** Derived by running the harness's own domain SQL
   rather than inheriting the brief's list: `act-hat-blind-sweep.sh`'s population is functions whose
   body references `memberships`, and this one contains no caller term at all. It IS in census
   clause 1 and in `ARM=policy`'s `PRED_DOMAIN` — the latter **by its body, not its name**: the
   door filter is `^(is_|can_|has_|…)` and `person_has_active_org_affiliation` matches none of it;
   it is admitted by `principal_id` in `prosrc`. `395 § 0.6` evaluates that expression verbatim, so
   a rewrite that drops the word and silently leaves the swept domain reds.
3. **C-b′ carries a disclosure the brief does not mention, and it is inherent rather than
   incidental.** An INVOKER wrapper may only call functions ITS CALLER may execute, so the DEFINER
   helper must be granted to `authenticated` — which makes it a one-bit existence oracle over a
   (person, org) uuid pair. ⭐ It is **pre-declared and asserted positively** (`§ 5.1`) rather than
   left for a later reader: `solo.c`, who can read no org-A profile at all, gets `true` for an
   org-A person. Bounded, and the bounds are measured too: one bit about opaque uuids, not
   enumerable, nothing a caller who can already see the person does not learn from the picker
   itself — and it does **not** become a roster (`§ 4.1` zero rows, `§ 5.2` zero policy rows).
   ⛔ The alternative that removes it — a DEFINER wrapper re-imposing the `profiles` perimeter in
   its own body — was rejected: it duplicates a six-arm RLS policy inside a function, and the
   second copy is what drifts.

### The per-object contract (old → new), reproduced from the catalog BEFORE the change

| object | old | new |
| --- | --- | --- |
| `listLinkableOrgUsers` (`src/lib/queries/members.ts`) | `.from('profiles').select('id, full_name, email').eq('home_organization_id', org).eq('is_active', true).eq('is_admin', false).order('full_name', asc, nullsFirst:false).limit(500)` | `.rpc('list_linkable_org_users', { p_organization })`. **Signature and return type unchanged** (`(organizationId: string) => Promise<AddableUser[]>`) |
| `public.list_linkable_org_users(uuid)` **(new)** | — | INVOKER, STABLE, plpgsql, pinned `search_path`, EXECUTE `{authenticated, service_role}`; `where p.is_active and not p.is_admin and app.person_has_active_org_affiliation(p.id, p_organization) order by p.full_name asc nulls last, p.id limit 500` |
| `app.person_has_active_org_affiliation(uuid,uuid)` **(new)** | — | DEFINER, STABLE, pinned, EXECUTE `{authenticated, service_role}`; `exists(organization_affiliations where principal_id = … and organization_id = … and ended_on is null and voided_at is null)` |
| `resolveOrInviteUser` (`src/lib/members/invite.ts`) | `select id, home_organization_id … ; if (existing.home_organization_id !== homeOrganizationId) throw` | `select id, is_admin …`; **arm 1** `if (existing.is_admin) throw`; **arm 2** ≥ 1 non-voided affiliation **and none in `organizationId`** → throw. Same message on both arms |
| `addStaff` (`src/lib/members/actions.ts`) | `select id, home_organization_id, is_active …; if (!profile ‖ profile.home_organization_id !== orgId ‖ !profile.is_active)` | `select id, is_active …` + `personHasActiveOrgAffiliation(admin, userId, orgId)` |
| `public.tenant_orphan_profiles()` **(new)** | — | DEFINER, STABLE, pinned, **`service_role`-only**; pure delegation to `app.tenant_orphan_profiles()` |
| `personAuthorityOrgs` (`src/lib/users/person-footprint.ts`) | inline `createAdminClient().from('organization_affiliations')…` | `listNonVoidedOrgAffiliationsFor(admin, userId)` — the **read** moves to `src/lib/queries/`, the four bounds stay |

⚠ **Two deliberate divergences between predicates that look like they should match**, both with
AE2.2's own reason of record — *the two doors answer different questions*:

- the **picker** and `addStaff` use **ACTIVE** (ended and voided both excluded): *"who may be SEATED
  here"*, the `list_addable_commission_members` question;
- `resolveOrInviteUser` uses **NON-VOIDED, known-here-or-known-nowhere**: *"may this identity be
  BOUND here"*, the `affiliate_person_to_org_impl` question.

⭐ **The second is not a preference — the obvious predicate is measurably wrong.** Neither
`assignStaffAdmin` nor `assignOrgAdmin` creates an org affiliation for the user it invites
(`handle_new_user` writes none, and neither caller calls `affiliate_person_to_org_for` — verified),
so a person **this very function invited** has zero affiliations. An active-only predicate refuses
the second call for the same e-mail, breaking re-provisioning — which
`e2e/platform-org-admin-provisioning.spec.ts:85` depends on **by name**. Mirroring increment 1's
already-ruled gate is what makes the invited state and the ADR 0164 orphan admissible.

⛔ **AND THAT MIRROR ADMITS THE PLATFORM ADMIN, WHICH THE COLUMN REFUSED BY ACCIDENT.** Under
`home_organization_id` a platform admin was refused because their anchor is NULL — a refusal falling
out of the anchor, not out of a rule. Under affiliations they have zero non-voided rows and the gate
**admits** them. The noun rule (ADR 0078 A35) is now a **separate, stated arm**, and it is the same
discriminator `app.tenant_orphan_profiles()` uses for the same reason: an orphan is shape-identical
to the platform admin, and `is_admin` is the one property orthogonal to affiliation-presence.
⚠ Both arms raise the **same message** on purpose (a distinguishable one is a platform-admin
oracle), so the message cannot tell a test which arm fired — the keystone therefore asserts that the
affiliation read is **never issued** on the `is_admin` path, and seeds a perfectly valid ORG_A
affiliation so that deleting the arm makes the test fail as *resolved*, not as *thrown*.

### The constructed divergence — what the seed cannot reach

⛔ In `seed.sql` a person's home org and their active affiliation org **always coincide**, so the
seed cannot distinguish the old predicate from the new one at all. § 1 is therefore a
**preservation** claim, not a differential. § 2 constructs the eight shapes where they disagree
(`0ae24d…` namespace, disjoint from 390/391/392/393/394; every deletion by identity):

| | D1 active A | D2 ended A | D3 voided-only | D4 col A / active B | D5 no row | D6 inactive | D7 `is_admin` | D8 active A+B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| org A picker (`chefe.ccih`) | **in** | out | out | out | out | out | out | **in** |
| old column predicate | in | in | in | in | in | out | out | in |
| org B picker (`orgadmin.b`) | — | — | — | **in** | — | — | — | **in** |

**6 → 2** for the same caller (`§ 2.8`). ⚠ **The hand-computed value was `6 → 1` and the run
corrected it**: D8, active in both orgs, is legitimately in A's picker as well as B's. Recorded
rather than quietly fixed — it is the cell `§ 2.10` exists for.

⭐ **The isolation § 2 had to buy, and it is the difference between a measurement and a coincidence.**
The picker is an INTERSECTION of two gates — the caller's `profiles` perimeter AND the affiliation
predicate — so an absent target is absent for one of two reasons and the two are indistinguishable.
Every constructed target therefore holds a **CCIH commission membership**, which puts it inside
`chefe.ccih`'s co-membership arm unconditionally, and `§ 2.0` MEASURES that all eight are visible.
Without that cell every § 2 deny has two possible causes and proves neither. ⛔ The membership is
not a fixture convenience: the people most likely to be seated on an ethics case ARE the
commission's own members, which is the entire reason this door is not `listAddableMembers`.

⛔ **The fixture does not build its world out of the subject under test.** Every affiliation is
inserted DIRECTLY, never through `affiliate_person_to_org_for` — whose own tenant gate is increment
1's subject and would have silently refused exactly the divergent shapes § 2 needs.

### QA Gate AE2 — the six blocking findings, and what each now measures

| id | what it now measures — as a sentence | evidence |
| --- | --- | --- |
| **B1** | `addStaff` refuses a target with no **ACTIVE org affiliation** to the commission's organisation, and the claim that it mirrors the picker is re-derived from the catalog every run instead of asserted in a comment | `src/lib/members/actions.ts` re-predicated; `395 § 8.1` normalises the tense predicate out of `list_addable_commission_members` **and** the picker's helper and asserts **2 functions, 1 distinct predicate**; `org-roster-predicate.test.ts` witnesses the four filters the TS twin asks for |
| **B2** | see the `393` section — the H-cells now carry an ACTOR axis | (in `393`) |
| **B3** | see the `393` section — the four declared widenings assert a ROW EXISTS, not that the door stayed quiet | (in `393`) |
| **B4** | `394 § 9.2` and `390 § D10` are statements about the LOCATE/GRANT split, because the caller is measured to **share an affiliation** and to **hold no membership** — both derived through `app.person_authority_orgs` itself, so they measure the same fact the predicate under test consumes | `394 § 9.1a/§ 9.1b`, `390 § D9a/§ D9b`, ported from `392 § 4.1/§ 4.2` |
| **B5** (comment half) | the orphan window says **nobody** can administer such a person through the six doors, and names ADR 0165 D1's re-affiliation as the actual recovery path | `20261003005600` header, `393 § 1` banner |
| **B6** | lead's — arm evidence | — |

⭐ **B1's failure mode ran BOTH ways, which is why "it is only defence in depth" was not a defence.**
An offboarded person — ended affiliation, column still naming the org — was **refused by the picker
and seated by `addStaff`**, since the form is a POST and this re-verify is exactly what a tampered
form meets; and a person actively affiliated here whose column named another org was **offered by
the picker and refused at submit**.

### The majors this increment closed

| id | what it now measures / says | evidence |
| --- | --- | --- |
| **M1** | ADR 0165 declares `**Amends:** 0164` with the scope reversal as its reason; `INDEX.md` carries the inbound edge | `npm run adr:index` regenerated; gate 9 green |
| **M2** | `…005500`'s comment says the picker moves in **AE2.4 increment 4**, and names `addStaff` as the twin this migration itself left behind | migration header |
| **M3** | the detector has a production caller — and could not have had one as it stood | see below |
| **M5** | three task-table cells corrected (**AE2.5 shipped**, inc 1 = **16** mutations, AE2.0 **capability-blind**) + `…005400:6`'s retired "SUBSET-bounded" label | task table above |
| **M6** | ADR 0163's bounds 1–3 have TypeScript coverage, and the three mocks actually filter | `person-footprint-reads.test.ts § 5` (5 new arms, each mutation-proven) |
| **M7** | the `organization_affiliations` read lives in `src/lib/queries/affiliations.ts`; the bounds stay in `person-footprint.ts` | `listNonVoidedOrgAffiliationsFor` |
| **M8/M9/M10** | see the `393`, `391` and `394` sections | — |
| **M11** | ADR 0165 states the **gained-capability set** an actor holding the uuid acquires, and marks it a PO decision recorded unaccepted | ADR 0165 § Consequences |
| **M13** | the census's function class carries its schema bound in the **summary row**, and the database-wide re-derivation is recorded with its delta | census § "the function class is schema-bounded" |
| **M14** | the increment-4 task row names all three consumers | task table above |

#### M3 — the mitigation gets a caller, and the honest bound on what that buys

⛔ **It could not have acquired one as it stood, and the TYPECHECKER found that, not a review.**
`app.tenant_orphan_profiles()` lives in `app`; PostgREST exposes only `public`, so
`client.rpc('tenant_orphan_profiles')` is a 404 by construction — the *correct door nothing can
reach* shape. A grant on the `app` function, which is the obvious fix, would have changed nothing.
`20261003005800` adds `public.tenant_orphan_profiles()`, a pure delegation, **`service_role`-only**
(never `authenticated`: a row-returning DEFINER is a gate you walk THROUGH, not one you neutralize,
and this one enumerates exactly the people no tenant admin can reach). The `app` function's
`postgres`-only ACL is **untouched**, so `393 § 1.1`'s three role bits are unchanged.

**Where it is called: `createPerson`'s success path AND its two post-account failure branches**
(`isTenantOrphan`, `src/lib/users/actions.ts`). That is ADR 0164's own first option — *app-side
compensation in the person-creation path* — in the only mechanism this repo has actually shipped and
reviewed for maintenance work without a scheduler: **ADR 0099 D10 / Amendment 1's lazy,
request-triggered check invoked from existing traffic**. ⭐ It is strictly better than D10's case,
because the trigger is not "somebody eventually opens a page" but *the very request that could have
produced the state*. ⛔ **Not a scheduler, and none was invented** — `pg_cron` is not installed, the
`cron` schema does not exist, there is no `.github/workflows/`, and the Dockerfile runs one process
(`FUP-DM5-DISPOSAL-JOB`, measured). ADR 0121 D2's `pg_cron → pg_net → route` design stays
ratified-but-unbuilt and this does not pre-empt it.

⚠ **The success path is covered, not only the failures, and that is a finding rather than caution.**
`createPerson` creates the org affiliation only `if (isOrgAdminCaller)`; a **`hospital_admin`
registering a person with no hospital** takes neither that branch nor D5's org-parent ensure, and
reaches the success return having created an account with no organisation affiliation at all.

⛔ **What it does not cover, stated plainly rather than implied by its absence:** a process crash
BETWEEN the account write and the check (no in-process compensation can catch that, by
construction); orphans produced by any path other than `createPerson`; and it **warns the human in
front of the form** — it does not alert, page, or persist a work item, and nothing polls. A
decorative mitigation is worse than a declared gap, so the residual is named here and in the
function's own docstring. ⚠ It **fails open** on a detector outage — deliberately and narrowly: it
is a warning channel layered on a result already decided, and it is never an authorization input.

### Part C — the wrong-grain pin: BOTH, and why

`org-roster-predicate.test.ts:186` pinned the old predicate's absence for `listOrgUsers` **only**,
and its own comment conceded the over-claim. The fix is **not** "give the sibling its own pin",
because that is the same instrument one name wider — and this phase has now paid for that grain
**five times**: `listOrgUsers`/`listLinkableOrgUsers` (AE2.2), the roster door/`addStaff` (B1),
`can_administer_person_for`/`authorizeForUser`/`getPersonAdminView` (inc 3), and
`resolveOrInviteUser` falling between two increments (M14). **A per-function assertion is a
statement about a NAME, and the defect is always a name nobody listed.**

So the file now carries both, answering different questions:

- **per-function arms** — what each door asks the database for. The only thing that can witness a
  FILTER, since the mock supplies the rows. New: the picker calls `rpc('list_linkable_org_users')`
  and touches `profiles` never; `personHasActiveOrgAffiliation` asks all four conjuncts;
  `listNonVoidedOrgAffiliationsFor` asks for `voided_at is null` and **must not** ask for
  `ended_on is null` (the tenancy/staffing divergence, pinned in the direction that can rot).
- **a module property** — enumerating every non-test `.ts` under `src/lib` **by property, from
  `git ls-files`**, and asserting that none *filters on* or *compares* `home_organization_id`.
  ⭐ This is the half that can notice a sixth copy in a function nobody has written a test for.

⛔ **The detector is proven able to find something, twice over:** four in-test controls fix its
discrimination (it must match `.eq('home_organization_id', …)` and `profile.home_organization_id
!== org`, and must NOT match a `select()` projection or an object-literal metadata key), and a
**planted offender in a real file** (`src/lib/queries/commissions.ts`) was measured to red it —
`expected [ 'src/lib/queries/commissions.ts' ] to deeply equal []` — then restored byte-identical.
⚠ Its bound, stated: it reads SOURCE TEXT, so a dynamically-built column name (`.eq(someVar, …)`)
is invisible to it. It is a floor, and it is the half that scales.

### ⛔ A fixture that had built its world out of the column under test — the third this phase

`src/lib/members/staff-ops-mirror.test.ts` went **RED on all three ALLOW arms** the moment
`addStaff` was re-predicated: it anchored its target with `home_organization_id: ORG_A` and never
seeded an `organization_affiliations` row. That is pgTAP `360 § 5.2`'s shape, in TypeScript, after
increment 3 found three more of them. **Fixed by mirroring the real substrate, never by relaxing an
assertion** — and the column was **removed** from the fixture rather than left beside the new row,
because with both present the arms would pass whichever fact the action read and the fixture would
have stopped being evidence that it moved.

### ⛔ THE VACUITY PROOF — nineteen mutations, keyed by SUBJECT

`395` was **observed RED first** (`Files=2, Tests=9`: § 0.1–0.6 and § 0.8 failed, then an abort on
*"function public.list_linkable_org_users(uuid) does not exist"*). ⚠ **§ 0.7 PASSED pre-migration
and could not have failed on that axis** — it pins that `organization_affiliations_select` is
UNCHANGED, which is true by construction before the change. Said rather than counted as a red.

Every mutation applied in-DB via `pg_get_functiondef()` + `regexp_replace` + `execute`, with the
`do` block **raising on a no-op**; every one **asserted to have LANDED from `pg_proc`** (md5 moved,
length, `prosecdef`, marker) — never from a command's exit status; every restore replayed from the
captured definition and verified **byte-identical by md5**. ACL and security-context mutations are
verified through `has_function_privilege` / `prosecdef` instead, since neither moves `prosrc`.

⛔ **Run shape captured for every run, and every row below is against the SAME artifact.** The suite
gained § 9.0 mid-audit (see the finding after the table), so the eleven rows measured before it
were **re-run** rather than reported at their old shape: a mutation table whose rows were taken
against two different suites is a table nobody can compare. Final shape `Files=2, Tests=45`
throughout (44 assertions + `00_setup`).

| # | subject | mutation | assertions that RED | exit |
| --- | --- | --- | --- | ---: |
| baseline | — | none | *(none)* | **0** |
| **M1** | `person_has_active_org_affiliation` | whole predicate → `select true` — **the DENY-side mover** | § 0.6, 2.2, 2.3, 2.4, 2.5, 2.8, 3.2, 3.3, 3.4, **3.5**, **4.1**, 8.1 | 1 |
| **M5** | `person_has_active_org_affiliation` | whole predicate → `select false` — ⭐ **the ACCEPT-side mover** | § 0.6, **1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**, 2.1, 2.8, 2.9, 2.10, 3.1, **4.2**, **5.1**, 8.1 | 1 |
| **M2** | `person_has_active_org_affiliation` | ⭐ conjunct: `ended_on is null` → `true` | § 2.2, 2.8, **3.2**, 8.1 | 1 |
| **M3** | `person_has_active_org_affiliation` | ⭐ conjunct: `voided_at is null` → `true` | § 2.3, 2.8, **3.3**, 8.1 | 1 |
| **M4** | `person_has_active_org_affiliation` | ⭐ conjunct: `organization_id = p_organization` → `true` | § 2.4, 2.8, **3.4**, 4.1, 8.1 | 1 |
| **M19** | `person_has_active_org_affiliation` (**context**) | ⭐⭐ `alter function … security invoker` (body md5 **unchanged**) | **§ 0.4**, 0.6, **1.1, 1.2, 1.3, 1.4**, 1.6, 1.7, 2.1, 2.8, 5.1 | 1 |
| **M6** | `person_has_active_org_affiliation` (**ACL**) | `grant execute … to anon` | **§ 0.5** | 1 |
| **M7** | `list_linkable_org_users` (**context**) | ⭐⭐ `alter function … security definer` (body md5 **unchanged**) | **§ 0.1, 0.2**, **1.1, 1.2, 1.3, 1.4**, **4.1** | 1 |
| **M8** | `list_linkable_org_users` | the `not p.is_admin` conjunct → `true` | **§ 2.7**, 2.8 | 1 |
| **M9** | `list_linkable_org_users` | the `p.is_active` conjunct → `true` | § 1.5, **2.6**, 2.8 | 1 |
| **M10** | `list_linkable_org_users` | the helper call → `true` (the whole org predicate) | § 2.2, 2.3, 2.4, 2.5, 2.8, 4.1 | 1 |
| **M12** | `list_linkable_org_users` | `limit 500` → `limit 5000` — ⛔ **found a defect in § 6.2** | **§ 6.2** *(only after the pin was fixed — see below)* | 1 |
| **M12b** | `list_linkable_org_users` | the `limit` removed entirely | **§ 6.2** | 1 |
| **M13** | `list_linkable_org_users` | `order by … asc nulls last` → `desc nulls first` | **§ 6.1** | 1 |
| **M11** | `list_linkable_org_users` (**ACL**) | `grant execute … to anon` | **§ 0.3** | 1 |
| **M14** | `public.tenant_orphan_profiles` | the delegation filtered to `reason = 'never_affiliated'` | **§ 9.0, 9.2** | 1 |
| **M15** | `public.tenant_orphan_profiles` | ⭐ delegation replaced by an inline re-implementation **without the `is_admin` discriminator** | § 9.0, 9.2, **9.3** | 1 |
| **M16** | `public.tenant_orphan_profiles` (**ACL**) | `grant execute … to authenticated` | **§ 9.1** | 1 |
| **M17** | `list_addable_commission_members` (**the SIBLING**) | ⭐ its tense conjuncts → `true`, the picker untouched | **§ 8.1** | 1 |

**Targeted cases per subject:** `person_has_active_org_affiliation` → M1, M2, M3, M4, M5, M6, M19 ·
`list_linkable_org_users` → M7, M8, M9, M10, M11, M12, M12b, M13 · `public.tenant_orphan_profiles`
→ M14, M15, M16 · `list_addable_commission_members` → M17. **No subject is uncovered.**

⭐⭐ **BOTH POLARITIES, PER SUBJECT — and for the helper the pair is the whole result.** M1 (*never
denies*) cannot move a single § 1 cell: with the predicate always true the picker still equals the
old column set for every seed caller, because on the seed the two facts coincide. M5 (*never
accepts*) is what moves § 1.1–§ 1.7, § 2.1, § 2.9, § 2.10, § 3.1, § 4.2 and § 5.1 — **fifteen
assertions that had not been shown able to fail by any deny-side mutation.** For the picker the
pair is M10/M8-M9 (deny) against M7/M13 (accept-and-shape); for the orphan wrapper, M14/M15 (it
reports too little / the wrong set) against M16 (its audience widens).

⭐⭐ **M19 IS THE MECHANISM, MEASURED — AND IT LOCALISES.** Flipping ONLY the helper's security
context, with `md5(prosrc)` identical on both sides, reproduces **exactly the collapse the rejected
naive re-predication would have caused**: § 1.1–§ 1.4 red — `chefe.ccih`, `dr.john`, `multi`,
`hospitaladmin.a1` all lose their perimeter — while **§ 1.5 (`orgadmin.a`) stays GREEN**, because an
org admin can read `organization_affiliations` and never needed the DEFINER context at all. That
green is the informative half: it is the measurement showing why a verification written against an
org admin proves nothing, and it is the same shape as M7's § 1.5, which also does not move.

⭐ **M2/M3/M4 partition the helper's compound predicate cleanly**, so no arm is proven only as part
of a whole-predicate neutralization: each reds its own § 3 cell and its own § 2 cell and nothing
else. ⚠ M3 matters more than it looks: D3's voided row has `ended_on IS NULL`, so a helper filtering
only on tense returns TRUE for it — § 3.3 is the cell that separates "void" from "end".

⭐ **M17 exists because M1–M13 could not have proven § 8.1 non-vacuous.** Every mutation of the
picker's own helper moves § 8.1 *along with* the thing it is comparing against — an assertion that
moves with its subject has not been shown able to fail. M17 mutates the **sibling alone**, leaving
the helper intact, which is the direction QA finding B1 actually travelled: the read door moved and
its twin did not.

#### ⛔⛔ M12 FOUND A DEFECT IN MY OWN ASSERTION — a substring match wearing the label of a bound

§ 6.2 pinned the 500-row cap as `prosrc ~ 'limit\s+500'`. **`limit 5000` matches that**, so M12 —
widening the cap tenfold — ran **GREEN**. The assertion named a bound and measured a prefix. Fixed
with a word boundary (`'limit\s+500\y'`), after which M12 reds § 6.2 alone, and M12b (the cap
removed entirely) reds it from the other direction. ⛔ Recorded because it is precisely the class
this increment was told to watch for in its own fixes — *an assertion that passes for a reason other
than the property it names* — and because **only re-running the instrument found it**; the pin reads
correct.

#### ⛔ A SECOND SELF-AUDIT FINDING — § 9.2/§ 9.3 WOULD HAVE BEEN VACUOUS ON THE SEED

The seed contains **zero** tenant orphans: its only affiliation-less profile is the `platform_admin`,
whom the detector correctly excludes. So § 9.2 (wrapper rows == `app` rows, full join, both
directions) compared **two empty sets**, and § 9.3 (no `is_admin` profile is reported) counted inside
one. Both green having asserted nothing. § 9.0 was added to close it, and it is not a floor alone —
it pins **membership AND reason**: this suite's own § 2 fixture supplies exactly two orphan shapes,
`D5 = never_affiliated` (no row was ever created) and `D3 = all_voided` (every row voided), and
§ 9.0 asserts `'D3=all_voided,D5=never_affiliated'`. M14 and M15 both red it.

### The residual bound — assertions no mutation of this increment's objects can reach

**7 of 44 at this point in the audit: § 0.7, § 0.8, § 2.0, § 5.2, § 7.1, § 7.2** — ⚠ § 0.7 and
§ 5.2 left the residual when M18/M18b ran (see the gates section below), so the FINAL figure is
**4 of 44**.
Each is a **precondition, a shape pin, a fixture-isolation measurement or a catalog re-sweep**;
their job is to red when the *surface, the fixture or the schema* changes, not when a predicate
does, and no mutation of the four subjects above can exercise them:

- **§ 0.8** (the door returns exactly `user_id, full_name, email`) — a signature change, not a
  predicate change; no body mutation moves it.
- **§ 2.0** (the isolation buy: `chefe.ccih` can see all eight constructed targets) — a statement
  about the FIXTURE and about `profiles` RLS, which this increment does not touch. ⚠ It is the cell
  that would red if a seed or policy change silently removed the isolation § 2 rests on, which is
  exactly what it is for.
- **§ 7.1 / § 7.2** (zero policies and exactly two functions still name `home_organization_id`) — a
  floor handed to the drop increment; only a migration moves them.

**37 of 44 are proven able to fail.** A stated bound on this audit, not a claim of full coverage.

#### The policy prohibition, proven able to fail — and what M18 revealed about it

| # | subject | mutation | assertions that RED | exit |
| --- | --- | --- | --- | ---: |
| **M18** | `organization_affiliations_select` (**policy**) | ⭐ **option C-a's LITERAL shape** — a co-membership arm added to the tenancy policy | **§ 0.7**, § 1.6 | 1 |
| **M18b** | `organization_affiliations_select` (**policy**) | the policy opened entirely (`using (true)`) | **§ 0.7**, § 1.6, **§ 5.2** | 1 |

Restore verified by `md5` of the normalised qual back to `9b622d17779c5f06b2b51a641225f6be`, and the
suite green after it.

⭐⭐ **M18 measured something the ADRs argue rather than measure: under C-a the picker's own numbers
DO NOT MOVE.** § 1.1–§ 1.5 stay green either way, and § 1.6 — the naive-collapse control — reds,
because with a co-membership arm the naive re-predication would have *worked*. **C-a would have
repaired the read.** So the harm C-a does is invisible in this suite's behaviour: it is a widened
audience for everything else the policy gates, not a wrong picker. ⛔ That is precisely why the
prohibition had to become a **policy-text gate** (§ 0.7) rather than a behavioural one — a
behavioural assertion could never have caught it, and "a policy widened for a picker stays widened"
is a sentence no cell in this suite can otherwise contradict.

### Arm domains — derived per object from the catalog, with the harness's own domain SQL

Evaluated by running `p0-authz-invariant.sh` ARM 3's two census clauses, `p0-authz-door-audit.sh`'s
`PRED_DOMAIN`, ARM 2's floor predicate, `p0-authz-invoker-audit.sh`'s worklist and
`act-hat-blind-sweep.sh`'s population **against `pg_proc`** — never a hand list, never inferred from
the object's name:

| object | census c1 | census c2 | ARM=policy | ARM=floor | ARM=wrapper | ARM=hat |
| --- | --- | --- | --- | --- | --- | --- |
| `app.person_has_active_org_affiliation(uuid,uuid) → bool`, DEFINER, `{authenticated, service_role}` | ✅ **in** | ❌ | ✅ **in** | ❌ | ❌ | ❌ |
| `public.list_linkable_org_users(uuid)`, **INVOKER**, plpgsql, `{authenticated, service_role}` | ❌ | ✅ **in** | ❌ | ❌ | ✅ **in** | ❌ |
| `public.tenant_orphan_profiles()`, DEFINER, set-returning, **`service_role` only** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

⚠ **The brief's claim that the `bool` helper lands in `ARM=hat` is FALSE, measured.** The hat
population is functions whose comment-stripped body references `memberships`; this one contains no
caller term at all. Corrected rather than repeated.

⚠ **`ARM=policy` admits the helper by its BODY, not its name.** The door filter is
`^(is_|can_|has_|…)` and `person_has_active_org_affiliation` matches none of it; it is admitted by
`principal_id` in `prosrc`. `395 § 0.6` evaluates that expression verbatim every run, so a rewrite
dropping the word silently leaves the swept domain — and reds.

⚠ **The wrapper being `plpgsql` is a DECISION, not a default.** Written as `language sql` it would
have been in **no** arm's domain at all (census clause 2 and ARM=wrapper both require
`lanname = 'plpgsql'`), and escaping the enumeration through a language choice nobody would notice
is the escape-hatch shape this repo keeps paying for. `395 § 0.2` pins it inside the domain.

⛔ **`public.tenant_orphan_profiles` is in NO arm's domain** — set-returning (so neither boolean
clause admits it), DEFINER (so not ARM=wrapper's), and **not `authenticated`-reachable** (so
neither census c1's row-returning clause nor ARM=floor). **Absence of a verdict is absence of
coverage**, so the compensating control is named and it carries verdicts of its own: `395 § 9.0`
(both orphan shapes and their reasons), `§ 9.1` (ACL, positively, per role), `§ 9.2` (delegation is
pure, both directions), `§ 9.3` (the `is_admin` discriminator survives), with targeted mutations
M14/M15/M16.

### Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | clean | **0** |
| `npm run gen:types` | run after the migration; **+15 lines** — the two new `public` RPCs. ⚠ Unlike increments 1 and 3 this DOES diff, and that is the expected sign of a PostgREST-reachable surface | **0** |
| `npm run test:db` | **243** files, **8119** tests, PASS (242/8065 → +1 file, +54 assertions: `395` +44, `390` +2, `391` +1, `393` +4, `394` +3 — the sum is exact, nothing else moved) | **0** |
| `npm run typecheck` | pass | **0** |
| `npm run lint` (11 gates) | pass (adr-index 163 ADRs; vacuous 265 spec files / 0 findings; mojibake 2996 files clean; service-role registry 44 == 44) | **0** |
| `npm run test` (vitest) | 145 files, **1993** tests (1978 → +15: `invite.test.ts` +5, `org-roster-predicate.test.ts` +5, `person-footprint-reads.test.ts` +5) | **0** |
| `scripts/door-sweep-cases.sh` | **DERIVED (0) — 5 cases** | 0 |
| `ARM=census` | **567** live gates / **601** verdicts · ⛔ **INVARIANT VIOLATED** — see below | **1** |
| `FROMFINDINGS=1 ARM=wrapper` | BLIND set **41**, unchanged, all allowlisted. ⚠ **VACUOUS for this increment's wrapper** — see below | **0** |

⛔ Not run here, by instruction: the diff-scoped door sweep, `ARM=floor`, `ARM=hat` and `e2e:prod` —
the lead's.

#### ⛔ `ARM=census` EXITS 1, AND THAT IS THE ARM WORKING — it is handed over, not discharged

565 → **567** live gates; the two newcomers are exactly this increment's:

```
app.person_has_active_org_affiliation(p_person uuid, p_organization uuid)
public.list_linkable_org_users(p_organization uuid)
```

*"These are not BLIND — they are UNKNOWN. Nothing has asked whether a keystone notices when they
open."* A brand-new gate passes `ARM=policy` **vacuously**, which is what census exists to stop.
**The discharge is the diff-scoped sweep, and it is the lead's step** (increment 1's split). The
deriver produced the exact command:

    WORK=<scratch> CASES="can_administer_person_via_affiliation person_has_active_org_affiliation professional_credentials_select profiles_admin_select profiles_select_self_or_admin" bash supabase/tests/mutation/p0-authz-door-audit.sh

⚠ **Three of those five are not this increment's, and why they are in the list is worth knowing:**
`can_administer_person_via_affiliation`, `profiles_admin_select`, `profiles_select_self_or_admin`
and `professional_credentials_select` were pulled in because this increment edited migrations
`…005400`, `…005500` and `…005600` — **comment-only edits** for QA M2 and M5, all in file headers
OUTSIDE any function body, so `prosrc` and every policy qual are byte-identical. The deriver cannot
tell a comment from a predicate and **should not try**; it greps `alter policy` and flags. ⛔ Their
STALE-verdict warning is nevertheless real for a different reason — those verdicts were earned
against the PRE-AE2.2 predicates and `ALTER POLICY` keeps a gate's NAME, which is the hazard ADR
0079 Amendment 8 ruling 3 put in a script rather than a paragraph. AE2.2 re-measured all three; this
increment did not change them again.

#### ⚠ `FROMFINDINGS=1 ARM=wrapper` IS GREEN AND THAT GREEN IS VACUOUS HERE

`public.list_linkable_org_users` **is** in ARM=wrapper's domain (measured above) and **is absent
from the committed findings**, so it is in no BLIND set and the arm passes by not knowing about it.
That is exactly the hazard ADR 0079 Amendment 7 names — *"a NEW wrapper passes `ARM=wrapper`
vacuously by being absent from the findings"* — and it is the reason census's domain was widened in
the same change. ⛔ **Census caught it; the wrapper arm could not have.** Recorded so "all arms
green" is never written about this increment without its qualifier.

#### ⛔ A HAZARD THIS INCREMENT CREATED IN THE SHARED STACK, CAUGHT BY A PEER AND NOT BY ME

While `395` was being built, `20261003005800` was applied to the local stack **directly via `psql`**
rather than through `supabase db reset`, so the live catalog carried DDL that
`supabase_migrations.schema_migrations` had no row for. Two consequences, both measured by the agent
working on `393` rather than by me:

1. an **early draft** of the migration granted `app.tenant_orphan_profiles()` to `service_role`; the
   committed file does not (the reachable half is the `public` wrapper instead). The grant survived
   the file edit, and `393 § 1.1` — which pins that function's three role bits — was **RED on the
   live stack while green in the migration chain**;
2. every gate figure any agent read from that stack was against schema a reset would not reproduce.

⭐ **The generalisable half: `create or replace` + a hand-applied migration make the catalog a
SUPERSET of the chain, and nothing reds.** A dropped `grant` line leaves the grant behind. The
`supabase db reset` that precedes every figure in the table above is what makes them chain-derived;
after it, `app.tenant_orphan_profiles`' ACL reads `postgres=X/postgres`, `…005800` is recorded, and
`393 § 1.1` is green. ⚠ It is also a live instance of *shared local stack = one owner*: three agents
shared this database, and one concurrent run produced an ERROR-shaped `Files=2, Tests=8` verdict
that is indistinguishable from a failure unless the run shape is read.

### Residual bound — updated after M18/M18b

**4 of 44: § 0.8, § 2.0, § 7.1, § 7.2.** § 0.7 and § 5.2 left the residual when M18/M18b moved them.
Each remaining one is a signature pin, a fixture-isolation measurement or a catalog re-sweep — they
red when the *surface, the fixture or the schema* changes, not when a predicate does. **40 of 44 are
proven able to fail.**

## AE2 · QA R2-B1 — the kernel invariant (migration `20261003005900`, suite `396`)

Ruling: ADR [0166](../decisions/0166-governance-role-provisioning-implies-organization-affiliation.md)
— eight binding clauses plus the QA-B5 grain correction it carries. Discharges QA round 2's
**R2-B1** (blocking) and **R2-M1** (the B5 residue that was live in the catalog).

⛔ **Deliberately NOT started, by instruction, and each still owed before the drop:** R2-B1's
existing-data backfill · the `is_admin` true→false demotion backstop (round-2 CNV-5/R2-m3) ·
the detector's platform-wide logging (R2-m4) · the column drop itself. Nothing below claims any
of them.

### The seam — the shared kernel, and the two shapes rejected before it

`assignStaffAdmin` and `assignOrgAdmin` provision through `resolveOrInviteUser`, grant a
membership through the sanctioned role doors, and create no affiliation. The fix lands in
`app.grant_role_impl` and NOT in the two TypeScript callers, for the reason ADR 0166 states and
this increment re-measured:

- a TypeScript-only fix leaves the kernel able to recreate the state, and every OTHER caller of
  `grant_role`/`grant_role_for` with these two role shapes keeps producing it — measured, there
  are **two more** (`src/lib/users/actions.ts:978` `registerUser`'s committee loop and
  `:1287`'s commission role change, both passing `p_role` from input, both able to carry
  `staff_admin`);
- a second `affiliate_person_to_org_for` call from TypeScript is a **SECOND TRANSACTION**, which
  recreates the membership-without-affiliation partial write it is meant to remove. `396 § 5.9`
  is the assertion that shape cannot satisfy, and MUT-F1 measures it failing.

⛔ **And it is not a platform-admin arm on `app.affiliate_person_to_org_impl`.** That door is
`is_org_admin_of_for`-only by design (the noun rule), and widening it would broaden
employment/affiliation authority far beyond the ruling. The behaviour lives in an **owner-only
internal module that is not a door at all**. `396 § 0.8` re-derives from `pg_proc` every run that
the ordinary door still carries no `is_admin_for` arm, with `--` comments stripped, because that
door's own comment quotes the arm it deliberately does not have.

### The per-object contract (old → new), reproduced from the catalog BEFORE the change

| object | before (head `20261003005800`) | after |
| --- | --- | --- |
| `app.ensure_provisioned_org_affiliation(uuid,uuid,uuid,date) → uuid` | did not exist | **NEW.** DEFINER, `search_path=app, public, pg_catalog`, owner `postgres`, ACL **`postgres=X/postgres`** — measured, and `authenticated`/`anon`/`service_role` all `false` by `has_function_privilege`. No authority check of its own; the actor is an argument, so **reachability IS the vulnerability** and that is why `service_role` is revoked too |
| `app.grant_role_impl(...)` | 227 lines, no tenancy check on the TARGET on any arm | +55 lines: one declaration (`v_aff_org`) and one guarded block. **Diff of `pg_get_functiondef()` before → after: 55 added, 0 removed, 0 changed** — "byte-for-byte apart from the insertion" is a measurement here, not a claim |
| `public.grant_role` / `public.grant_role_for` | `{postgres, service_role, authenticated}` / `{postgres, service_role}` | **unchanged, and asserted so** (`396 § 0.4/§ 0.5`) — preserved, not merely untouched |
| `comment on function app.tenant_orphan_profiles()` | *"administrable by platform_admin alone"*, live in the catalog | ADR 0166's grain, re-emitted by a **forward** migration. `396 § 8.1/§ 8.2` pin it in both directions |

### ⛔ THE KEYSTONE IS THE PROMOTION, NOT THE INSERT

`grant_role_impl`'s commission tier has a T1.0 atomic-replacement branch that **`return`s early**
after updating an existing membership row. A helper call placed beside the final `insert into
public.memberships` is therefore **dead code for every `staff` → `staff_admin` promotion** — which
is precisely what `assignStaffAdmin` documents as its purpose ("promoting an existing 'staff'
member updates the row in place"). The block sits **above** the T1.0 block, so one call site covers
both paths.

`396 § 3` is the proof, and it is built so it cannot pass for the wrong reason: **P3's `staff`
membership is inserted DIRECTLY in owner context, never through `grant_role`** — seating it through
the door under test would have created the affiliation § 3.3 is about to measure. § 3.2 asserts the
replacement branch was genuinely taken (one row, role replaced in place) so § 3.3 is measuring the
early-return path and not the INSERT path. **MUT-C3 moves the block below the `return` and reds
exactly § 0.7 and § 3.3, and nothing else** — the whole rest of the suite stays green, which is the
measurement that the ordering is load-bearing and invisible everywhere else.

### RED-FIRST — and two defects the run found in MY OWN suite

`396` was written first and **observed RED at head `20261003005800`: 32 of 59 failing** (the suite
was 59 assertions at that point; two coverage gaps and two more cells were added afterwards — see
below — so the shipped shape is 63). The run also produced two findings against the suite itself:

1. ⛔⛔ **A cell that calls a mutating function and counts rows in ONE `select` measures the state
   BEFORE the call.** § 6.1–§ 6.3 came back `ok|0|0` with the membership demonstrably landed: a
   single SQL statement reads one snapshot, taken before the volatile call inside it wrote
   anything. Sixteen cells were affected. Fixed by parking the call's result in a GUC and
   asserting from a **separate statement**. An assertion that silently measures the wrong instant
   is exactly the class this phase keeps paying for.
2. ⛔ **The parking statement had to be a `do` block, not a bare `select`.** `select
   set_config(...)` PRINTS the value it stored, and when that value is the string `ok`, psql emits
   a line pg_prove's TAP parser reads **as a test result**. Measured: 59 assertions reported as
   **69** with *"Tests out of sequence"* — **green under a direct `psql` run and mis-parsed under
   the real runner**. Only running the actual gate found it.
3. ⛔ **`§ 5.9` was GREEN ON ITS FIRST RUN, which is a finding and not a pass.** "A forced
   membership failure leaves no affiliation" is trivially true on a database where nothing ever
   writes an affiliation. **§ 5.9b** is the differential that repairs it: the identical call with
   the forced failure dropped writes BOTH rows.

Two coverage gaps were then found by deriving the mutation list *before* running it, and closed
before the audit started (so every row below is against ONE artifact):

- **§ 5.4b** — the design's mutation *"narrow the non-voided collision to active-only"* moved **no
  cell**: every foreign-affiliated fixture was ACTIVE elsewhere. P13 (an **ended, non-voided** row
  in B and nothing else) is the state that separates the two, and it is the whole point of the
  clause — an identity KNOWN to another organisation, holding no active tenancy anywhere.
- **§ 5.1b** — "the ensure runs after authority" was not observable: § 5.1's target is
  affiliation-clean, so moving the ensure above the authority check changes nothing a rollback does
  not hide. An unauthorized actor naming a **foreign** target answers `42501` and not `HC0R0`, and
  that difference is measurable.

### ⛔ TWO DECLARED NARROWINGS OF AN EXPOSED DOOR — measured, not inherited from the ADR's wording

ADR 0166 clause 5 says a person affiliated entirely elsewhere *"remains refused"*. ⚠ **Measured at
head `20261003005800`, they were NOT refused.** `grant_role_impl`'s org_admin and staff_admin arms
carried **no tenancy check on the target at all**: an org_admin of A could seat ANY profile on the
platform as A's administrator, org C's own administrator included. Clause 6's platform-administrator
case succeeded the same way. Both are refusals now, and they are **narrowings of an exposed door**,
enumerated with their population rather than quoted from the ADR:

| cell | narrowed from | narrowed to | population |
| --- | --- | --- | --- |
| `§ 5.2` | any profile could be seated as `org_admin`/`staff_admin`, a `platform_admin` included | refused, `HC0R0`, neither row | targets with `profiles.is_admin` — one row in the seed |
| `§ 5.4` / `§ 5.4b` | a person whose non-voided affiliations are entirely in another organisation could be seated | refused, `HC0R0`, neither row | cross-org seats. **Reached one existing suite** — see `170` below |
| `§ 5.3` | a DEACTIVATED account could be granted these two roles | refused, `HC0R4`, no membership | `desativado.conta` in the seed; no live caller reaches it |
| `§ 5.6` | a non-existent commission produced a raw `23503` from the membership insert | `23514` `comissão inexistente`, the sibling branches' shape | platform-admin-only; every tenant arm is already false for an id naming nothing |

⚠ **Reachability through the two named actions is near-empty, and that is worth stating rather than
letting the narrowing read as bigger than it is:** `resolveOrInviteUser` already applies the same
known-here-or-known-nowhere predicate with `is_admin` as a stated separate arm (increment 4), so
`assignOrgAdmin`/`assignStaffAdmin` refuse those targets *before* reaching the kernel. The narrowing
bites on **direct `grant_role` / `grant_role_for` calls** and on the two `users/actions.ts` callers.

⚠ **And the pt-BR surface does not distinguish them:** both actions map every RPC error to
`MESSAGES.generic`, so a refusal from these arms reads as a generic failure. Not fixed here (UI copy
is `frontend`'s and the actions were out of scope); named so it is not discovered later as a defect.

### ⚠ ONE DELIBERATE DEVIATION FROM THE SUPPLIED DESIGN — the check ordering

The design ordered the module's checks **inactive-before-foreign**. This implementation orders them
**foreign-before-inactive**, mirroring `app.affiliate_person_to_org_impl` byte-for-byte. The single
differing cell is a target who is **both** inactive and foreign-affiliated: the supplied order
answers `HC0R4`, which tells a caller that an unknown uuid names a real, deactivated person in
another tenant; the sibling's order answers `HC0R0`, conflated with "not found".

**⛔ ORACLE-KILL is a documented, load-bearing property of this door family** (`20261003003700`'s
header: *"the refusals read as redundant precisely because they must not be distinguishable"*), and
"both siblings move together" is the lesson this phase has now paid for three times. So the
sibling's order wins. **`396 § 5.5` makes the difference visible instead of arguing it**: it asserts
that a uuid with NO profile and a real-but-foreign-and-deactivated person return the
**byte-identical** sqlstate and message, with § 5.5b pinning that the shared answer is `HC0R0`
specifically (§ 5.5 alone would be green if both sides raised the same unrelated error). **One `if`
block and one expectation flip if the PO rules the other way.**

### `170` — the narrowing reached an existing suite, and what changed there

`170_multitenancy_hierarchy.sql § 33` went red: `test_helpers.bootstrap()` affiliates every persona
to its OWN org, and § 33 then seats `st_x` as `org_admin` of a **different**, file-local org — a
cross-org seat, which clause 5 makes illegitimate. The fixture gained one
`organization_affiliations` row anchoring `st_x` to that org.

⛔ **That is a fixture PRECONDITION change, not a weakened assertion**, and the distinction is the
whole point: § 33's subject is the Phase-A hierarchy predicates and `assign_org_admin`'s authority
check, not the tenancy gate; both § 33's claim and § 34's cross-org refusal (denied at AUTHORITY,
before the gate ever runs) are unchanged, and the suite's assertion count did not move.

### Arm domains — derived per object from the catalog, with the harnesses' own domain SQL

Evaluated by running `p0-authz-invariant.sh` ARM 3's two census clauses, `p0-authz-door-audit.sh`'s
`PRED_DOMAIN`, ARM 2's floor predicate, `act-hat-blind-sweep.sh`'s population and ARM 5's wrapper
clause **against `pg_proc`** — never a hand list, never inferred from the object's name:

| object | census c1 | census c2 | ARM=policy | ARM=floor | ARM=wrapper | ARM=hat |
| --- | --- | --- | --- | --- | --- | --- |
| `app.ensure_provisioned_org_affiliation(uuid,uuid,uuid,date) → uuid`, DEFINER, owner-only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `app.grant_role_impl(...) → void`, DEFINER, owner-only | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **in** |
| `public.grant_role(...) → void`, DEFINER, `{authenticated, service_role}` | ❌ | ❌ | ❌ | ✅ **in** | ❌ | ❌ |
| `public.grant_role_for(...) → void`, DEFINER, `service_role` only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

⛔ **THE NEW MODULE IS IN NO ARM'S DOMAIN, AND ABSENCE OF A VERDICT IS ABSENCE OF COVERAGE.** Every
clause that could have admitted it is bounded away: census c1 wants `bool` or a *reachable*
set-returning DEFINER (this returns `uuid` and is owner-only); c2 and ARM=wrapper want
`prosecdef = f`; `ARM=policy`'s `PRED_DOMAIN` is bounded by `t.typname='bool'`; ARM=floor is
`nspname='public'` and `authenticated`-reachable; ARM=hat's population is bodies naming
`memberships`, and this body names none. It sits in the census's OWN stated exclusion —
*"prosecdef scalar non-bool command doors — FUP-AUTHZ-COMMAND-DOOR-UNSWEPT"* — narrowed further by
being unreachable.

⚠ **So `ARM=census` will NOT exit 1 for this increment, and that is not the arm passing.** Unlike
increment 4, whose two newcomers were a boolean and a public INVOKER, nothing here enters any arm's
enumeration. The compensating control is named and carries verdicts of its own: `396 § 0.1–§ 0.3`
(context, pinned `search_path`, and EXECUTE asserted **positively per role**, `service_role`
included), `§ 5.10/§ 5.11` (behavioural unreachability from `authenticated` AND from
`service_role`), and **fourteen targeted mutations** — A1–A10 on the body, B1–B4 on ACL/context.

#### ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**, and here is the ruling it demands

    RESULT: FINDING (1) — the diff TOUCHED supabase/migrations and ZERO cases were derived.
    EXCLUDED BY NAME — A REVIEW LIST, NOT A DROP:
      - ensure_provisioned_org_affiliation
      - grant_role_impl

Exit code captured **directly** (a first read through `| tail` reported 0 — the pipe erases it). The
deriver asks for one of two things; this is the ruling, as a claim someone can check:

1. **The migration contains ZERO RLS policy statements** — measured, `create|alter|drop policy`
   count is **0**. So the `alter policy` half of the finding is empty by measurement, not by silence.
2. **It adds one `prosecdef` function, and that function is not a gate the sweep could neutralize.**
   `app.ensure_provisioned_org_affiliation` returns `uuid`, so the door sweep — which works by
   neutralizing a **boolean predicate** — has no predicate to flip. And it decides the **TENANCY of
   the TARGET**, not the **AUTHORITY of the ACTOR**: it contains no caller term, no identity
   primitive, and no `memberships` read. Its authority comes entirely from its ACL and its single
   owner-controlled caller.
3. **`app.grant_role_impl` IS an authorization kernel, and this increment added no authority arm to
   it.** The 55 added lines contain no `is_*` / `can_*` / `has_*` call and no `memberships` read;
   the authority dispatch is byte-identical, which the 55-added / **0-removed / 0-changed**
   `pg_get_functiondef()` diff is the proof of.
4. **Both therefore owe the TARGETED mutation case the deriver names, and both have one** — 10 body
   + 4 ACL/context mutations on the module, 7 on the kernel, each observed red below.

### ⛔ THE VACUITY PROOF — keyed by SUBJECT

Every body mutation applied in-DB from a baseline held **inside the database** (`mut396.baseline`),
so no definition ever made a round trip through a Windows console. Every one **raises on a no-op**,
so a needle that stopped matching is an ERROR and never a silent green; every one is **asserted to
have LANDED from `pg_proc`** (md5 MOVED *and* a unique marker present), never from a command's exit
status; every restore is verified **byte-identical by md5**. ACL, security-context and comment
mutations do not move `prosrc`, so they are verified through `has_function_privilege` / `prosecdef` /
`proconfig` / `obj_description` instead. **The FULL suite ran for every row** and `Files=`/`Tests=`
is recorded per row: a shape drop is an **ERROR**, not a hold.

⛔ **AND THE EXTRACTOR ITSELF WAS WRONG FIRST.** pg_prove's `Failed tests:` list **wraps at ~78
columns**, and the continuation lines carry more test numbers with no marker of their own. The first
pass read only the first line and silently under-reported: C1's `§ 7.2` and A2's `§ 5.8`, `§ 5.9`,
`§ 5.9b`, `§ 7.1`, `§ 7.2` were all missing. Every row below is from the corrected parser. A
mutation table is an instrument, and an instrument that quietly drops findings reads exactly like a
narrow blast radius.

Run shape `Files=244, Tests=8182` on every row unless marked. Cells named by their `396` label.

| # | subject | mutation | assertions that RED | exit |
| --- | --- | --- | --- | ---: |
| baseline | — | none | *(none)* | **0** |
| **A1** | the module (body) | ⭐ **the NEVER-REFUSES mover** — all four refusal arms neutralised at once | § 5.2, 5.3, 5.4, 5.4b, 5.5, 5.5b | 1 |
| **A2** | the module (body) | ⭐ **the ALWAYS-REFUSES mover** — an unconditional raise at the top | § 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.5, 5.3, 5.6b, 5.8, 5.9, 5.9b, 7.1, 7.2 · **+ `170` § 33 · `190` §§ 16, 18–19 · `224` §§ 13–15 · `291` §§ 22–23, 27, 29–32 · `306` §§ 39–43, 45 · `293` ABORTED** | 1 |
| **A3** | the module (body) | ⭐ conjunct: the target-`is_admin` refusal → `false` | **§ 5.2** | 1 |
| **A4** | the module (body) | ⭐ conjunct: the collision check narrowed to **ACTIVE-only** | **§ 5.4b** | 1 |
| **A5** | the module (body) | the whole foreign-org refusal removed | § 5.4, **5.4b**, 5.5 | 1 |
| **A6** | the module (body) | ⭐ conjunct: the inactive-account refusal → `false` | **§ 5.3** | 1 |
| **A7** | the module (body) | ⭐ conjunct: the profile-not-found refusal → `false` | **§ 5.5, 5.5b** | 1 |
| **A8** | the module (body) | the idempotency check removed (clause 3) | § 4.1, 4.2 · + the six suites A2 moves | 1 |
| **A9** | the module (body) | ⛔ `created_by := p_user` — **clause 7's forbidden shortcut** | **§ 1.3**, 2.3 | 1 |
| **A10** | the module (body) | `started_on := date '2020-01-01'` (clause 8) | **§ 1.3** | 1 |
| **B1** | the module (**ACL**) | `grant execute … to authenticated` | **§ 0.3, 5.10**, 6.1 | 1 |
| **B2** | the module (**ACL**) | ⭐ `grant execute … to service_role` | **§ 0.3, 5.11**, 6.1 | 1 |
| **B3** | the module (**context**) | ⭐⭐ `alter function … security invoker` (body md5 **unchanged**) | **§ 0.1** | 1 |
| **B4** | the module (**context**) | `alter function … reset search_path` (body md5 **unchanged**) | **§ 0.2** | 1 |
| **C1** | the kernel | the ensure removed from the **org-admin** branch | § 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 4.1, 4.3, 4.5, 5.2, 5.3, 5.4, 5.4b, 5.5, 5.5b, 5.8, 5.9b, **7.2** | 1 |
| **C2** | the kernel | the ensure removed from the **staff-admin** branch | § 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, **5.6** | 1 |
| **C3** | the kernel | ⭐⭐ the ensure block **MOVED BELOW the T1.0 early return** | **§ 0.7, 3.3, 3.4 — and nothing else** | 1 |
| **C4** | the kernel | the commission org written into **`v_org`** as well (the trap the comment names) | § 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2 · + `291` § 29 · `306` § 41 | 1 |
| **C5** | the kernel | the guard widened to **any commission role** | **§ 6.1** | 1 |
| **C6** | the kernel | the guard widened to **any organization role** | **§ 6.2** | 1 |
| **C7** | the kernel | the ensure block **MOVED ABOVE the authority dispatch** | **§ 5.1b** · + `170` § 34 | 1 |
| **D1** | `app.tenant_orphan_profiles` | ⛔ **Option 3 — the detector made to ignore membership holders** | **§ 3.0, 9.2** · + `395` § 41 | 1 |
| **E1** | the catalog **comment** | the retired B5 sentence restored verbatim | **§ 8.1, 8.2** | 1 |
| **F1** | ⭐ **the CALLER FIXTURE** | affiliation and membership split into **SEPARATE transactions** | **§ 5.1, 5.9**, 6.1 | 1 |

**Targeted cases per subject:** module body → A1–A10 · module ACL/context → B1–B4 · kernel → C1–C7 ·
detector → D1 · catalog comment → E1 · caller → F1. **No subject is uncovered.**

⭐⭐ **BOTH POLARITIES, AND FOR THIS MODULE THE PAIR IS THE WHOLE RESULT.** A1 (*never refuses*)
moves only the six refusal cells — with every refusal off, the seed's provisioning still produces
exactly the right rows, because on this fixture the accept path and the correct path coincide. A2
(*never accepts*) is what moves the thirty positive cells **and six other suites**, which is the
measurement of how much of the platform now depends on this module succeeding. Neither alone is a
proof; the pair is.

⭐⭐ **C3 IS THE KEYSTONE PROOF AND IT LOCALISES PERFECTLY.** Moving the block below the T1.0
`return` reds **§ 0.7, § 3.3 and § 3.4, and NOTHING ELSE** — 60 of 63 cells, all six other role
suites, and the entire rest of the tree stay green. That is the whole argument for why the
placement had to be measured rather than reviewed: it is invisible everywhere except on the
promotion, and the promotion is `assignStaffAdmin`'s documented purpose.

⭐ **A3/A4/A6/A7 partition the module's refusal predicate cleanly** — each reds its own cell and
nothing else, so no arm is proven only as part of a whole-predicate neutralization. **A4 is the one
that would not have existed without deriving the mutation list first:** narrowing the collision
check to ACTIVE-only moved **no cell at all** until § 5.4b was written, because every foreign-
affiliated fixture in the file was active elsewhere. The design named that mutation; the suite could
not have failed it.

⭐ **B3 is the mechanism with `md5(prosrc)` identical on both sides.** Flipping ONLY the security
context reds § 0.1 and nothing behavioural — correctly, and the null result is the informative half:
the module is called exclusively from a DEFINER kernel running as `postgres`, so INVOKER changes
nothing a test can see. **Its danger is entirely in the ACL**, which is what B1/B2 measure. An
audit that only checked behaviour would have called the context flag cosmetic.

⭐ **C4 confirms the comment rather than trusting it.** Writing the commission's org into `v_org`
re-shapes every commission-tier membership row and violates `memberships_scope_shape` — it reds
seven cells here **plus `291` § 29 and `306` § 41**, two suites that have nothing to do with this
increment. The `⚠ NOT v_org` comment in the migration is therefore a measured claim.

⭐ **F1 is the shape ADR 0166 § Consequences rules out, and it does more damage than atomicity.**
`§ 5.9` reds as designed (`HC0RM|1|0` — the affiliation survives the failed grant). But `§ 5.1`
reds too, with **`42501|0|1`**: a caller-side affiliate call writes an organisation affiliation for
a target the door then **refuses on authority**. A second transaction is not merely non-atomic; it
lets an unauthorized actor leave a tenancy fact behind.

#### ⛔ TWO ROWS ARE **ERROR**, NOT HOLDS — A2 AND A8 DROPPED THE RUN SHAPE

Both report `Files=244, **Tests=8175**` (−7) and both show `293_membership_door_kernel.sql
(Wstat: 768 (exited 3) Tests: 18 Failed: 0)` — that suite **aborted after 18 of its assertions**,
a hard error rather than a failure. Neither mutation is subtle: A2 refuses every governance grant
in the tree and A8 turns a repeat grant into a `23505`, so several suites cannot build their
fixtures. The rows are reported as ERROR-shaped and their red lists are read as a lower bound —
`Failed: 0` on an aborted file means *"nothing got far enough to fail"*, not *"nothing broke"*.
⛔ Recorded rather than held, because a shape drop compared against a full-shape baseline is not a
comparison.

### The residual bound

**13 of 63 were moved by no mutation: § 0.4, § 0.5, § 0.6, § 0.8, § 1.0, § 1.5, § 2.0, § 4.4,
§ 5.7, § 5.12, § 6.3, § 9.1, § 9.3.** **50 of 63 are proven able to fail.** A stated bound on this
audit, not a claim of full coverage. Each residual is a preservation pin, a precondition, an
absence pin or a control, and the reason it cannot move is named:

- **§ 0.4 / § 0.5 / § 0.6 / § 5.12** — the three ACLs this increment must PRESERVE. A mutation that
  moved them would be a mutation of an object this increment does not change; they red when a later
  increment widens a door, which is what they are for.
- **§ 0.8** — the forbidden-shortcut gate on `app.affiliate_person_to_org_impl`, a function this
  increment deliberately does not touch. It reds the day someone implements this invariant the way
  ADR 0166 forbids.
- **§ 1.0 / § 2.0** — preconditions. They exist so the § 1 and § 2 cells cannot pass over a person
  who was already fine; nothing in the subject can move them.
- **§ 1.5** (no `hospital_affiliations` row invented) and **§ 6.3** (the hospital tier untouched) —
  **absence pins for clause 1**. Their mutations would be *"make the module also write a hospital
  affiliation"* and *"widen the guard to the hospital tier"*; neither was written. ⚠ Named as a
  gap rather than as coverage: C5/C6 widen the commission and organization tiers and are measured,
  the hospital tier is not.
- **§ 4.4** (the retained ended row keeps its ORIGINAL end date) — its mutation is *"reactivate by
  UPDATE instead of INSERT"*, a rewrite rather than a substitution, and it was not written. ⚠ Its
  twin **§ 4.3** covers clause 4 from the count side and IS moved (A2, C1), so the clause is not
  unmeasured — only this strengthening of it is.
- **§ 5.7** — the self-grant guard is a **pre-existing deny**. Moving the ensure across it changes
  nothing observable, because the guard raises either way and the transaction rolls back. § 5.1b
  exists precisely because the *authority* ordering had the same problem and could be made
  observable; the self-grant ordering could not.
- **§ 9.1 / § 9.3** — the detector's positive control and its seed floor. Their job is to stay
  green so that every *"absent from the detector"* cell above means something; **§ 9.2**, the one
  that must red under symptom suppression, is moved by D1.

### The actor-grid discrepancy — MEASURED, REPORTED, and CHANGED NOTHING

Asked for as a separate measurement, and it is real. Three sources describe who may seat a
commission coordinator and they do not agree:

- `src/lib/admin/actions.ts:77-91` — `authorizeStaffAdminOps`'s **body** requires
  `context.orgAdminOf.length > 0` and the commission's org in that list. There is **no `isAdmin`
  short-circuit**, so a platform admin is refused.
- `:70-76` — its own SECURITY docstring says the short-circuit is *"DELIBERATELY ABSENT"* and
  explains why (the action runs on the service-role client, so this TS check is the only control).
  **Agrees with the body.**
- `:238` (`assignStaffAdmin`) and `:307` (`removeStaffAdmin`) — both say *"platform_admin OR
  org_admin of the commission's org (Phase C)"*. **Both are FALSE about the code they sit on.**
- `app.grant_role_impl`'s commission arm (read from `pg_proc`) is
  `app.is_admin_for(p_actor) or app.is_tenancy_admin_of_for(p_scope_id, p_actor)` — the **kernel
  DOES admit a platform admin**. So the two inline comments describe the SQL grid, not the TS one.

Net: `assignStaffAdmin` is unreachable by a platform administrator, while `public.grant_role` called
directly by one at commission/`staff_admin` scope succeeds. ⛔ **R2-B1 does not settle that, and
nothing here changed it** — no arm was added or removed. It is a separate ruling: either the two
comments are corrected, or the TS check is aligned with the kernel. Recorded, not decided.

### Gates — exit codes captured DIRECTLY, never through a pipe, on a fresh `supabase db reset`

| gate | result | exit |
| --- | --- | ---: |
| `supabase db reset --local` | clean; head **`20261003005900`** confirmed in `schema_migrations` | **0** |
| `npm run gen:types` | ⭐ **EMPTY diff.** The module lives in `app` (never PostgREST-reachable) and both `public` door signatures are unchanged, so there is nothing to commit and nothing unexplained — the opposite of increment 4, where a diff was the expected sign of a new reachable surface | **0** |
| `npm run test:db` | **Files=244, Tests=8182, PASS** (243/8119 → **+1 file, +63 assertions**: `396` +63, `170` +0 — the sum is exact, nothing else moved) | **0** |
| `npm run lint` (11 gates) | pass — mojibake **3001** tracked files clean · vacuous **265** spec files / 0 findings · set-local watermark **UNCHANGED** (this migration uses none) · service-role registry 44 == 44 | **0** |
| `npm run typecheck` | pass | **0** |
| `npx vitest run` | **145** files / **1993** tests, pass — unchanged, this increment touches no TypeScript | **0** |
| `scripts/door-sweep-cases.sh` | ⛔ **FINDING (1)** — migrations touched, ZERO cases derived. **Ruled above, not silenced** | **1** |

⛔ Not run here, by instruction: `ARM=census` / `hat` / `floor` / `wrapper`, the diff-scoped door
sweep, and `npm run e2e:prod` — the lead's. ⚠ And see the arm-domain section: **`ARM=census` cannot
flag this increment's newcomer**, so its green must not be read as a verdict on it.

⚠ **Every figure above is from a fresh `supabase db reset`** — `FUP-AE2-CATALOG-SUPERSET-OF-CHAIN`
makes an un-reset figure inadmissible, and this increment did the mutation audit against
`create or replace` in-place edits, which is exactly the superset-producing shape. The audit's own
baselines were held **inside the database** and every restore was verified byte-identical by md5;
the reset that precedes the table above is what makes these numbers chain-derived anyway.

### Residuals this increment leaves behind, named

- ⚠ **`assignOrgAdmin` is still not atomic AS A WHOLE, and this increment does not claim it is.**
  Its org_admin grant and its single-hospital `hospital_admin` bootstrap are **two RPCs**, so a
  failure of the second still leaves the first. The bootstrap is not authorized to be removed and
  was not touched; `396 § 7.1/§ 7.2` pin that both calls still succeed and that the pair leaves
  exactly ONE affiliation for TWO memberships. What R2-B1 makes atomic is *membership ∧
  affiliation within one grant*, which is what clause 2 asks for.
- ⚠ **`audit_log.actor_id` is NULL for the implied affiliation on the service path**, because the
  audit trigger reads `auth.uid()` and `grant_role_for` carries no session. Pre-existing, not
  introduced here; the REAL actor is on the affiliation row (`created_by`), which `§ 1.3` asserts.
  `§ 1.10` pins that the row is audited at all (Rule 11) — a fact created as a side effect of
  another operation is exactly the kind that gets written without a trail.
- ⚠ **E2E teardown, for the tester and the lead:**
  `e2e/platform-org-admin-provisioning.spec.ts`'s `purgeInvitee()` deletes only the membership. The
  invitee now also acquires an `organization_affiliations` row, and
  `guard_org_affiliation_no_delete` refuses DELETE **unconditionally — there is no GUC escape**, so
  the teardown cannot simply extend. On the gate (which resets per batch) this is invisible; on a
  **repeat local run without a reset** the invitee stays visible in ORG_B's roster and both pickers.
  The fix is `void_org_affiliation`, and it belongs to the spec's owner. ⛔ Not edited here.
  ⓘ The spec always seats into the same constant `ORG_B`, so the repeat run is **idempotent**, not
  refused — the leftover row is a visibility residue, not a breakage.
- ⚠ **`ARM=hat`'s population now sees a longer `app.grant_role_impl` body.** The added block reads
  `public.commissions`, never `memberships`, so it introduces no new caller-bound memberships chunk
  — but the arm is the lead's and the function is in its population.

## ADR 0167 — commission `staff_admin` has ONE authority, on both sides

Its **own separately-gated increment**, before the column drop: migration `20261003006000`,
pgTAP suite **`397`** (40 assertions, observed **RED-FIRST 11/39** at head `20261003005900`),
mutation harness
`supabase/tests/mutation/adr0167-staff-admin-one-authority-mutation-audit.sh` (**20 mutants,
20 RED-PROVEN**), vitest `src/lib/admin/actions.test.ts` (9). Ruling: ADR
[0167](../decisions/0167-commission-staff-admin-has-one-authority-on-both-sides.md).
⛔ Nothing here touches `home_organization_id`, the column drop, or `seed.sql`.

### The measured grid, before and after

Both rows re-derived on a fresh `supabase db reset`, never read from migration text.

| actor | grant `staff_admin` BEFORE | grant AFTER | revoke BEFORE | revoke AFTER | TS gate BEFORE | TS gate AFTER |
| --- | --- | --- | --- | --- | --- | --- |
| `platform_admin` | ✅ ALLOWED | ⛔ **42501** | ⛔ 42501 | ⛔ 42501 | ⛔ refused | ⛔ refused |
| `org_admin` of the org | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED | ✅ admitted | ✅ admitted |
| `hospital_admin` of THE hospital | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED | ✅ ALLOWED | ⛔ refused | ✅ **admitted** |
| `hospital_admin` of ANOTHER hospital, same org | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ refused | ⛔ refused |
| `org_admin` of ANOTHER org | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ refused | ⛔ refused |
| `org_admin` of the org, INACTIVE | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | ⛔ 42501 | n/a | n/a |

**Grant and revoke now agree for every actor.** They disagreed for exactly one row before, and
that row is the one-way door: escalation with no matching de-escalation by the same actor.

### The site set, derived from `pg_proc` — TWO changed of FIVE

Comment-stripped `prosrc`, occurrences of `is_admin_for(`: `app.grant_role_impl` = **5**,
`app.revoke_role_impl` = **1**. ⛔ Derived by counting the live body, never by trusting the line
numbers in the brief.

| # | site | ruling |
| --- | --- | --- |
| 1 | `organization` / `org_admin` | **KEPT** — the bootstrap ADR 0167 checked. `397 § 7.1/§ 7.2` prove the chain platform_admin → org_admin → staff_admin is unbroken |
| 2 | `hospital` / `hospital_admin` | **KEPT** — out of scope; cites AFF T2.5 / ADR 0097 D17 / audit BLOCKER-1 by name. `397 § 7.3` pins it behaviourally |
| 3 | `commission` / **`staff`** sub-arm | **KEPT — RULED OUT OF SCOPE, not overlooked.** A different (scope, role) pair; ADR 0167 § Consequences: "the other `grant_role_impl` arms keep their own actor grids". It also admits `is_staff_admin_of_for`, which the `staff_admin` arm does not — a different authority set entirely |
| 4 | `commission` / `staff_admin` sub-arm — **SITE (a)** | ⛔ **CHANGED** |
| 5 | T1.0 outgoing-role guard (`v_existing_role = 'staff_admin'`) — **SITE (b)** | ⛔ **CHANGED** |
| — | `revoke_role_impl`'s `organization` / `org_admin` | **KEPT** — the ruling aligns grant DOWN to revoke; `397 § 0.4` pins that revoke was not moved UP |

The re-emitted bodies were diffed against the pre-migration `pg_get_functiondef` with comments
filtered out: **the code delta is exactly those two predicates and nothing else**, and
`revoke_role_impl`'s code is byte-identical (only its comment changed). `prosecdef`, ACLs and
`search_path` all unchanged after the `create or replace`.

### The narrowing search — and why "removes nothing reachable" is the WRONG summary

⭐ **The capability removed is real.** `public.grant_role` is EXECUTE-able by `authenticated`
(`397 § 1.4` pins that, and a `revoke` mutant proves the cell binds), so a signed-in platform
admin could call this door **directly over PostgREST**. That the TypeScript gate refused them and
`/o/[org]/manage` 404s them is exactly the ADR's subject: **the door and the gate disagreed and
the door was wider.** ⛔ Do not record this change as cosmetic.

Clean negatives, auditable: `seed.sql` and `supabase/demo/` contain **zero**
`grant_role`/`grant_role_impl` calls — every commission `staff_admin` there is a direct `INSERT`
into `public.memberships` and is unaffected. `e2e/**` has three `grant_role` RPC sites, **none**
platform-admin × commission × `staff_admin`, and **no** spec asserts a platform admin may seat a
coordinator; `/admin/comissoes/[slug]` does not exist as a route. In `src/**` the only additional
`staff_admin`-capable commission callers are `registerUser` and `assignCommitteeRole`
(`src/lib/users/actions.ts`), both gated by `authorizeForCommission` → org-or-hospital, neither
with a platform arm.

**Five things broke, and four of them were reds.** All five were ruled by the lead before any
fixture was touched.

| # | subject | what it was | disposition |
| --- | --- | --- | --- |
| 1 | `291_membership_invariants.sql` § 4 | Every T1.0 door call ran as the bootstrap platform admin (org-less, `is_admin`) | **Re-actored onto `oa_b`** (the bootstrap's `org_admin`, added to 291's `k`). ⭐ The important half was not the four reds: **4.13 "an authorized admin CAN demote" would have gone VACUOUS, not red** — with 4.1 refused, `st_x` stays plain `staff` and the demotion becomes a no-op that trivially passes. `291:353` was, measured, the **only** site in the repository where a platform admin demoted a commission `staff_admin` |
| 2 | `396 § 5.6` | Asserted `23514` from the ADR 0166 `'comissão inexistente'` guard, "reachable only for a platform admin" | **Re-cut to `42501`.** The guard is now unreachable **by design**: authority-before-existence is the enumeration-oracle kill, and a guard reachable by someone authority refuses would make `grant_role` answer differently for a real commission id than a fabricated one. ⛔ **The guard is KEPT** as defence-in-depth; both the migration and 396 carry the warning against deleting it as dead code |
| 3 | `293 § 2` | The (`platform_admin`, commission, `staff_admin`) cell flipped ALLOWED → 42501 on **both** entry points and **nothing went red** — 2.1/2.2/2.3/2.4 are aggregates and none of 2.5–2.8 names a `platform_admin` cell | **Two assertions added.** `2.9` names the ADR 0167 policy; `2.10` pins the **whole 12-cell map**, because the pattern was "only 4 of 12 cells named" and a fifth named cell would have left seven with the same blind spot. ⚠ Verified independently: the **committed** 293 still runs green at 25/25 against the new migration — the flip really was silent |
| 4 | `w3-door-kernel-mutation-audit.sh` `widen_role_pin` | Its needle **was site (a) verbatim**, so `_mut_w3_sub` would abort the case with `MUTATION NO-OP` | **Needle re-pointed** to the post-narrowing spelling; the mutant's semantics are unchanged. Re-run: `widen_role_pin` **RED-PROVEN** |
| 5 | `w1-membership-mutation-audit.sh` CONTROL | `SRC=291`; the control hard-aborts on any unmutated red, so finding 1 stopped the harness before it scored a single mutant | **Re-run after the 291 repair: `CONTROL: all green (35 ok, 0 not ok)`** |

### Two pre-existing findings surfaced by this work — NOT fixed here

- ⛔ **`w1`'s three `grant_role` mutants cannot fail.** `revert_replacement_arm`,
  `revert_outgoing_authority` and `naive_delete_insert` all call
  `pg_get_functiondef('public.grant_role(text,uuid,text,uuid,uuid)')` — a **5-arg signature that
  does not exist** (the live one is 6-arg), so the cast throws and the file aborts:
  `ABSENT(aborted)`, three of nine mutants. They also needle the **pre-`_for` spelling**
  (`app.is_admin()`, `app.is_tenancy_admin_of(p_scope_id)`, `granted_by = (select auth.uid())`),
  superseded when ADR 0094 W3/T3.3 moved the logic into `app.grant_role_impl` with an explicit
  `p_actor`. A mutant pinned to a signature that no longer exists is **a harness that cannot fail
  reported as a harness that cannot run**. FUP text handed to the lead.
- ⛔ **`w3`'s `authenticated_gets_service_door` is NOT PROVEN**, and it is pre-existing: verified
  by running `w3` with `SRC` pointed at the **committed** 293 — same verdict, and its control is
  green at 25. Granting `authenticated` EXECUTE on `grant_role_for` leaves `293 § 4.1` green, so
  the ACL keystone is defended by something other than the ACL. The
  *incidental-guard-closes-a-hole* shape. FUP text handed to the lead.

### The grant/revoke agreement property, and why it is SCOPED

`397 § 4.1` is a **property over the actor set**, not five hand-paired cells: one temp table
`actors` drives BOTH grids, and the assertion counts rows where the grant verdict and the revoke
verdict differ, expecting **0**. An actor added later is covered without anyone remembering to
pair it. Three cells stop it being vacuous: `§ 4.2` (each column holds BOTH outcomes — an
all-deny grid satisfies § 4.1, and an over-eager narrowing looks exactly like a fix), `§ 4.3`
(the shared verdict is the DECLARED one per actor — § 4.1 + § 4.2 are both satisfied by a grid
that agreed on the WRONG answer), and `§ 4.4` (six actors, twelve probes — a `where` clause
matching nothing satisfies § 4.1 over zero rows).

⛔ **It is scoped to `staff_admin` deliberately, and the reason is a live finding.** The
commission **`staff`** sub-arm keeps its `is_admin_for` on the grant side and has never had one on
revoke, so **the same one-way door survives one role over**: a platform admin may SEAT a
commission `staff` and may not REMOVE one. ADR 0167 bounds itself to the `staff_admin` arm, so
closing it here would be an unruled authorization change. Widening § 4.1 to the whole commission
branch would red on that gap. `397 § 6` **measures** it instead — with a mutant
(`close_the_staff_gap`) proving § 6.2 reds the moment the gap is closed, which is what keeps § 6 a
measurement of an open question rather than a defect pinned as expected.

### ⚠ Three disagreements with ADR 0167, all recorded rather than silently absorbed

1. **§ Consequences says the QA m1 note "has no subject". Measured, that is half true.** The note
   sat above the WHOLE commission arm of `revoke_role_impl`, covering both sub-arms. After clause
   1 the `staff_admin` halves agree; the `staff` halves do not. The note was retired as instructed
   **and replaced by a narrowed one** scoped to the surviving asymmetry, citing the ADR's own
   scope bound and the pending PO ruling. Deleting it flat would have left a real, undocumented
   asymmetry that a future reader would "fix". ✅ **Ratified: ADR 0167 Amendment 1** (commit
   `7a30e835`), which also records that the surviving `staff` door is owed its own PO ruling and
   that its grid is **not** the same grid — the `staff` arm has a third participant
   (`is_staff_admin_of_for`) the `staff_admin` arm does not.
2. **The ADR does not mention that it makes ADR 0166's `'comissão inexistente'` guard
   unreachable.** Ruled option (a): keep the guard, re-cut `396 § 5.6`, record the cross-reference
   here. ⛔ Neither ADR was amended by this increment.
3. **The `staff`-vs-`staff_admin` split was ruled OUT of scope** (site 3 above) rather than
   treated as part of "the commission arm" — on the ADR's own § Consequences bound.

### Prose corrected (ADR 0167 clause 3), and one stale claim left as-is

`src/lib/admin/actions.ts`: the two false "platform_admin OR org_admin" comments at
`assignStaffAdmin` and `removeStaffAdmin` (measured: the gate has always refused a platform
admin); the `authorizeStaffAdminOps` docstring's **reason** ("this TS check is the ONLY control on
that path" — false since ADR 0094 W3/T3.3 moved the membership write to the cookie client; the
admin client survives only for `resolveOrInviteUser`), replaced by **the kernel is the control**;
and the module docstring's matching service-role claim.

⚠ **Beyond the brief, and reported:** the same stale route appears twice more, in
`revalidateCommissionPages`'s docstring and its caller's comment. Corrected as PROSE ONLY — and
they exposed a real defect left untouched: **`revalidatePath('/admin/comissoes/<slug>')` matches
no route** (`src/app/admin/comissoes/` does not exist), so the page `StaffAdminManager` actually
lives on, `/o/[org]/manage/comissoes/[commissionSlug]`, is never revalidated. Changing which paths
are revalidated is a behaviour change and was **not** made here.

### The TypeScript widening, and the copy that was not made

`authorizeStaffAdminOps` now reads `organization_id` **and** `hospital_id` and delegates to
`isCommissionAdmin` (`src/lib/auth/access.ts`), which already is "org_admin of the org OR
hospital_admin of the hospital". ⛔ **The predicate was not re-derived** — a third copy is the
sibling-axis defect this repo keeps paying for. The early `orgAdminOf.length === 0` short-circuit
was deleted: it alone would have refused every hospital admin regardless of the delegation.

Reachability checked, not assumed: `commissions_select_member_or_admin` carries
`app.is_hospital_admin_of(hospital_id)`, so a hospital admin CAN read the row the gate needs —
otherwise this would have been a correct door nothing can reach.

### Mutation audit — 20 mutants, keyed by SUBJECT, both polarities per gate

Restores are **byte-identical by construction**: the mutation is injected inside 397's own
transaction, so the suite's closing `rollback` undoes the DDL. `_mut_a167_sub` raises
`MUTATION NO-OP` on any needle that matches nothing, so a silent no-op cannot pass as GREEN.

| subject | mutant | polarity | verdict |
| --- | --- | --- | --- |
| site (a), the commission `staff_admin` grant arm | `restore_is_admin_site_a` | widen | RED-PROVEN |
| site (a) | `deny_all_site_a` | narrow | RED-PROVEN |
| site (b), the T1.0 outgoing-role guard | `restore_is_admin_site_b` | widen | RED-PROVEN |
| site (b) | `deny_all_site_b` | narrow | RED-PROVEN |
| site (b)'s MESSAGE (the site discriminator) | `site_b_generic_message` | lateral | RED-PROVEN |
| the revoke side / the agreement property | `revoke_admits_platform` | widen | RED-PROVEN |
| the revoke side / the agreement property | `revoke_drops_hospital_tier` | narrow | RED-PROVEN |
| `is_tenancy_admin_of_for` — org disjunct | `drop_org_disjunct` | narrow | RED-PROVEN |
| `is_tenancy_admin_of_for` — hospital disjunct | `drop_hospital_disjunct` | narrow | RED-PROVEN |
| `is_tenancy_admin_of_for` — the hospital disjunct's SCOPE | `widen_hospital_to_whole_org` | widen | RED-PROVEN |
| `is_tenancy_admin_of_for` — the `is_active` conjunct | `drop_is_active_conjunct` | widen | RED-PROVEN |
| preserved site 3 (`staff` sub-arm) | `remove_staff_arm_is_admin` | narrow | RED-PROVEN |
| preserved site 1 (org bootstrap) | `remove_org_arm_is_admin` | narrow | RED-PROVEN |
| preserved site 2 (hospital bootstrap) | `remove_hospital_arm_is_admin` | narrow | RED-PROVEN |
| the retired QA m1 sentence | `restore_qa_m1_note` | re-add | RED-PROVEN |
| the ADR 0167 citation that replaced it | `strip_adr0167_citation` | remove | RED-PROVEN |
| tenant isolation (cross-org) | `cross_org_leak` | widen | RED-PROVEN |
| the anti-lockout property over ALL commissions | `orphan_a_commission` (**data, not code**) | narrow | RED-PROVEN |
| the surviving `staff` gap § 6 pins | `close_the_staff_gap` | closes the gap | RED-PROVEN |
| the PostgREST reachability § 1.4 claims | `revoke_door_from_authenticated` | narrow | RED-PROVEN |
| the TS widening | `ts_narrow_to_org_only` | narrow | RED (2/9) |
| the TS widening's HOSPITAL SCOPING | `ts_widen_to_any_hospital` | widen | RED (2/9) |

⚠ **One mutant first reported `NOT PROVEN -> ABSENT(aborted)` and it was MY GREP PATTERN, not the
assertion** — `widen_hospital_to_whole_org`'s expected-red pattern omitted the closing backtick in
"a `hospital_admin` of another hospital". A wrong matcher reads exactly like a live defect. Fixed
and re-run; the run shapes below are from the corrected run.

**Run shapes, per run:** the suite is `Files=2, Tests=41` under
`supabase test db 00_setup.sql 397….sql` (40 assertions + `00_setup`'s 1). Every mutant run
returned a full TAP stream — **no run dropped its shape** — and the CONTROL closes at
`all green (40 ok, 0 not ok)`. ⛔ An `ABSENT(aborted)` is treated as an ERROR to rule on, never as
a hold. Both TS mutants restored **byte-identical** (`cmp` clean).

### The residual bound — 4 of 40, each named

Computed by re-running all 20 SQL mutants and taking the union of assertions moved: **36 of 40**
were moved by at least one. The four that were not are floors, not guarantees:

- **§ 1.1** no session claims in force — a property of the HARNESS; only a mutation of the test
  file could move it.
- **§ 1.3** the four targets are in the states their cells assume — a fixture precondition, and
  the thing the other cells are measured against.
- **§ 4.4** six actors probed on both sides — the anti-vacuity population floor over this file's
  own temp tables, which the subject cannot reach.
- **§ 5.4** the target actually KEPT its role — an **atomicity** pin. A mutant that refuses AND
  writes cannot make it red: the raise unwinds its own subtransaction. Its failure mode needs a
  non-transactional writer, which this door cannot become.

⛔ Four unproven assertions is a **bound on this audit**, not a claim of coverage elsewhere. The
bound is also published in 397's own header, so a reader of the suite does not have to find this
file.

### Arm domains, derived per function from the catalog

Derived by running the harnesses' own domain SQL against `pg_proc` — never a hand list.

| object | census | policy | hat | floor | wrapper |
| --- | --- | --- | --- | --- | --- |
| `app.grant_role_impl` — DEFINER, returns `void`, EXECUTE owner-only | ❌ **out** | ✅ in | ❌ out of the FINDING domain | ❌ out | ❌ out (`prosecdef = t`) |
| `app.revoke_role_impl` — same | ❌ **out** | ✅ in | ❌ out of the FINDING domain | ❌ out | ❌ out |
| `app.is_tenancy_admin_of_for` — DEFINER `bool`, `authenticated` | ✅ in | ✅ in | ❌ out (reads no `memberships` itself) | ❌ out (`app` schema) | ❌ out |
| `public.grant_role` / `public.revoke_role` — DEFINER `void`, `authenticated` | ❌ out | ✅ in | ❌ out | ✅ **in** | ❌ out |

⚠ **`grant_role_impl` and `revoke_role_impl` are OUT of the census domain — stated, not hidden.**
Census admits `prosecdef` functions that are boolean OR set-returning-and-reachable; these return
`void`, so **neither clause can see them**. Absence of a verdict is absence of coverage. Their
compensating control is named rather than assumed: 397's behavioural grid + the 20-mutant audit,
and 293's equivalence grid now carrying the whole-map pin.

For the hat arm the population predicate is a `memberships` chunk whose `principal_id` is bound to
a caller-derived value. Measured: both kernels read `memberships` with `principal_id = p_user` — a
**parameter**, with no `:= auth.uid()` variable anywhere in either body — so neither has a
caller-bound chunk and neither can produce a hat finding. The hat evidence for this family lives
in `app.has_role`, untouched here.

⛔ **The ARM sweep itself and `e2e:prod` were NOT run by this increment** — they are the lead's.

### Gate figures, re-measured (exit codes captured directly, never through a pipe)

| gate | result |
| --- | --- |
| `npm run test:db` on a fresh `supabase db reset` | **`Files=245, Tests=8224` — `Result: PASS`, exit `0`** |
| `npm run lint` (11 gates) | exit `0` |
| `npm run typecheck` | exit `0` |
| `npm run test` (vitest) | `Test Files 146 passed`, `Tests 2002 passed`, exit `0` |
| `npm run gen:types` | exit `0`, **zero diff** in `src/lib/types/database.ts` (function bodies only; no signature changed) |
| ADR 0167 mutation audit | **20/20 RED-PROVEN**, CONTROL `all green (40 ok, 0 not ok)` |
| `w1` mutation audit CONTROL | `all green (35 ok, 0 not ok)` — restored by the 291 repair |
| `w3` mutation audit | `widen_role_pin` RED-PROVEN; CONTROL `all green (27 ok, 0 not ok)` |

⚠ Every figure was re-measured on a fresh reset for this increment. The previously-recorded
`244/8182` was **not** carried forward; the delta is `+1` file (397) and `+42` tests (40 from 397,
2 from 293).

### ADR 0167 gate — run by the lead on a fresh reset (2026-08-28)

**The four ARM arms, recorded as what each ENUMERATED** (plan rule 2):

- `ARM=census` — exit **0**, **567** live gates / **603** verdicts, and its own words:
  *"no unswept newcomer WITHIN THIS ARM'S DOMAIN"*.
- `ARM=hat` — exit **0**. · `ARM=floor` — exit **0**, **72** never-called doors, all allowlisted.
- `FROMFINDINGS=1 ARM=wrapper` — exit **0**, BLIND set **41**.

⛔ **Domain qualifier, and here it is the whole story:** `app.grant_role_impl` and
`app.revoke_role_impl` both return **`void`** (catalog-measured), so **no census clause admits
them.** `ARM=census` exiting 0 is **not a verdict about the two functions this increment changed.**
The **426** reachable command doors of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (C2) remain outside every
arm's domain as always.

#### ⛔ `scripts/door-sweep-cases.sh` exits **1 — FINDING**: migrations touched, ZERO cases derived

Per ADR 0079 Amendment 8 ruling 2 and CLAUDE.md § 6 this is **never a pass**. Its EXCLUDED-BY-NAME
review list is `grant_role_impl` and `revoke_role_impl`, ruled here individually — and **neither of
the deriver's two options applies**, both halves measured rather than argued:

- **Option (a) — "widen `CASES=` and sweep them" — is UNAVAILABLE BY CONSTRUCTION.** The sweep can
  neutralize only a **boolean** predicate; both functions return **`void`**.
- **Option (b) as literally worded — "these migrations contain no policy and no `prosecdef` gate" —
  is FALSE.** Both are `prosecdef = t`, and both are unambiguously **authorization decisions**:
  comment-stripped `prosrc` raises `42501` **12** times in `grant_role_impl` and **10** times in
  `revoke_role_impl`.
- **So the ruling is the third form** — the one AE2.2 used for `list_addable_commission_members` and
  AE2.4 increment 1 used for its quartet: the compensating control is the **targeted mutation
  audit**, and it must carry verdicts of its own. It does: **20 SQL + 2 TS mutants, all RED-PROVEN**,
  residual **4 of 40** published in `397`'s header, plus `397`'s behavioural grid and `293`'s
  whole-map pin.

⭐ **Why this increment's evidence is unusually strong where the arms are unusually weak.** The arms
cannot see either function, so a green here proves nothing about them — and the mutation audit was
built knowing that. Three specifics worth keeping:

1. **The silent flip was MEASURED, not argued.** `w3` was re-run with `SRC` pointed at the
   **committed** `293` against the new migration: green at **25/25**. The authorization change
   genuinely produced no red. ⛔ That is the finding — a suite staying green while losing the only
   assertion of a policy converts a deliberate change into an unrecorded one.
2. **The fix was scoped by the PROPERTY, not the instance.** The pattern was **4 of 12** grid cells
   named, so a single named cell would have left **seven** with the same blind spot. The whole
   12-cell map is pinned instead.
3. **The agreement property carries three anti-vacuity cells**, each closing a way it could pass
   while proving nothing: an **all-deny** grid satisfies *grant = revoke*; so does a grid that
   **agrees on the wrong answer**; so does a `where` matching **zero rows**. ⭐ That is the
   discipline applied to the *fix*, which is the step this repo has twice shipped without.

---

## Increment B (NOT BUILT) — the `grant_role` split, ADR 0168 Amdt 3

**PO-ruled 2026-08-28.** Pre-measured here so the blast radius is a *finding on record* rather than
something the build discovers.

### Why it exists

A live probe (fresh reset, rolled back) found a **third tenant-reachable door** carrying the
anchorless-admitting predicate ADR 0168 closed on the other two:

| Probe | Result |
| --- | --- |
| `org_admin` of Rede A → `public.grant_role('organization', A, 'org_admin', <orphan uuid>)` | **ACCEPTED** — orphan gained an active org-A affiliation **and** an `org_admin` membership |
| commission `staff_admin` → `grant_role('commission', …, 'staff_admin', <orphan uuid>)` | REFUSED `42501` |

Exposure bounded to the **`(organization, org_admin)`** arm. ⭐ The census that missed it was bounded
by the **name** `affiliate_person%`; this door does not carry that name. **Bound a door census by the
CAPABILITY — what writes `organization_affiliations` — never by a name family.**

### The shape to build

`app.ensure_provisioned_org_affiliation` gains `p_allow_anchorless boolean default false`; its
containment becomes, using the SAME named helpers increment A introduced:

```sql
if not (app.person_known_to_org(p_user, p_organization)
        or (p_allow_anchorless and app.person_is_anchorless(p_user))) then
  raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
end if;
```

`public.grant_role` (authenticated) passes **false**; `public.grant_role_for` (service_role) passes
**true**. ⛔ Depends on increment A — do not start before its helpers land.

### ⚠ Blast radius, MEASURED not guessed

- **`396` is almost entirely SAFE.** Its harness `pg_temp.try_grant` (`:288-299`) drives
  `public.grant_role_for`, which keeps the wide predicate. `§ 0.5` (`grant_role` still reachable by
  `authenticated`) also survives — this narrows the target-tenancy **predicate**, not the door's
  **audience**.
- ⛔ **EXACTLY ONE cell flips, and it is a real product path:** `396 § 2.1` (`:401-406`) —
  *"an org_admin seats a commission coordinator through the SESSION door — **assignStaffAdmin's
  shape**, actor bound from `auth.uid()`"* — over P2, whose `§ 2.0` precondition is *"P2 is
  unaffiliated and reported by the detector"*. That is precisely the state the narrowing refuses, and
  it is why the PO ruling moves `assignStaffAdmin` to `grant_role_for`.
- ⚠ **THE CELL'S SUBJECT CHANGES, NOT JUST ITS CALL.** Re-pointing `§ 2.1` at `grant_role_for` leaves
  `§ 2.2/2.3/2.4` green while its own description — *"the SESSION door … assignStaffAdmin's shape"* —
  becomes **false**. ⛔ Re-cut the description with the call, or this is the "a comment is an
  assertion that goes stale silently" shape with four green cells sitting on top of it.
- ⚠ **Then ask the question the re-cut raises:** with `assignStaffAdmin` moved off it, does any
  production caller still reach `public.grant_role`'s commission arm? If none does, `§ 0.5` is
  pinning an `authenticated` door nothing can reach — a **finding to rule on**, not a cell to keep
  green. Derive the answer from the TS call sites, not from this note.

---

## Increment C (NOT BUILT) — ADR 0167 Amdt 2, and ⛔ the compensation it must carry

**Swept file-only 2026-08-28, before any edit.** The headline is not the reds.

> ⛔ **Amendment 2 is a narrowing that, UNCOMPENSATED, WEAKENS THE PROOF OF AMENDMENT-0 CLAUSE 1.**
> Building it as written trades a closed gap for a keystone that no longer has a behavioural
> witness. The compensation below is part of the increment, not a follow-up.

### ⚠ The ADR's own prediction was measured FALSE, in the reassuring direction

Amdt 2 says *"the `staff` population is larger than `staff_admin`, so expect MORE fixture reliance."*
Measured: **the opposite** — 7 sites, in two files. Every other commission-`staff` grant in pgTAP
already uses a non-platform actor (`224`, `291`, `293:344`, `306`, `396`). ⭐ A prediction that
over-states the blast radius is *not* harmless: it invites the builder to treat a small red set as
"as expected" and stop looking — which is exactly where the quiet damage is.

### The 5 REDs — all real reachability findings, two meant to be DELETED

`293:232` (§ 2.10 whole-map literal) · `293:258-262` (§ 3.2) · `397:164-173` (§ 0.3, count **and**
regex move) · `397:474-478` (§ 5.3) · `397:513-517` (§ 6.1). ⛔ `397 § 6` and `397:42-54` carry their
own exit instruction — *"IF EITHER CELL BELOW REDS … DELETE this section rather than 'repairing'
it."* Obey it.

⭐ **Clause 1's own fix works:** `293 § 2.10` pins the WHOLE 12-cell map, so the `staff` flip **reds**
instead of passing silently — the precise failure clause 1 was written about. Residual risk is human:
2.1–2.8 stay green, so a reader who edits the `293:232` literal without reading `293:200-241`
reproduces it anyway.

### ⛔ The quiet damage — bigger than clause 1's was, and none of it reds

1. **`293:251-256` (§ 3.1) goes VACUOUS while green.** Today the platform admin passes the arm and
   is refused by the self-grant guard with `'não é permitido conceder acesso a si mesmo'`. After the
   narrowing it is refused **one statement earlier** with the generic `'sem permissão'`. **The cell
   compares SQLSTATE only**, so it stays green measuring the wrong thing — and `293:247-250` says
   this cell exists *specifically* to pin the inlined `p_actor` comparison that a delegation would
   have made a silent no-op. ⚠ **The trap:** its positive twin § 3.2 reds, so re-homing § 3.2's actor
   to clear the red leaves § 3.1 permanently vacuous.
2. **`397:465-472` (§ 5.2) goes VACUOUS while green.** SQLSTATE-only over six actors; platform stays
   `42501`, now sourced from the sub-arm. Its docstring — *"only true because site (b) was fixed"* —
   becomes false: the cell is `42501` **with or without** site (b).
3. ⛔⛔ **Site (b) — clause 1's KEYSTONE — loses EVERY behavioural assertion in the repository.**
   Walk 397's six actors: four are refused at the narrowed sub-arm, two pass site (b); **no actor in
   the file reaches site (b)'s raise.** The only class that can is
   `is_staff_admin_of_for ∧ ¬is_tenancy_admin_of_for` — `291 § 4.10` (actor `sa_x`), which asserts
   `'42501', null`, **no message**. Confirmed against the mutation audit: `restore_is_admin_site_b`
   keeps only its two **structural** reds, and `site_b_generic_message` becomes **NOT RED-PROVEN**.
   ⚠ `run_case` only checks the named patterns are `not ok` — it never asserts they are the *only*
   reds, so a recorded red-set is a **subset**, not the blast radius.

### The compensation the increment MUST carry

- **Give site (b) a behavioural witness back**: add the message assertion to `291 § 4.10` (or a new
  cell on that actor class) — it is the only actor class that still reaches the raise.
- **Re-cut `293 § 3.1` and `397 § 5.2` to discriminate by MESSAGE, not SQLSTATE** — a refusal that
  moves to a different statement must be visible.
- **Unscope § 4's agreement property** to span both sub-arms: `397:339-343`/`:345-349` hard-code
  `'staff_admin'`; the caveats at `397:52-54`, `:420-423`, `:523` all lose their subject. Floor
  `397:445-449` moves **`6|12` → `6|24`** — the anti-vacuity floor doubles, which is the point.
- **Re-run and re-record the mutation audit's expected red sets** — two mutants degrade, and a
  degraded mutant that is still listed reads as coverage.

### Not affected — confirmed, not assumed

`seed.sql` never calls the door (`grep -c grant_role` → **0**; 13 `'staff'` rows are raw DML), has no
`set role`, and its three `request.jwt.claims` blocks carry **no `is_admin` key**. Playwright: **zero**
sites — both commission-`staff` grants use `admin@test.local` (`…001`, an `org_admin`), and the only
spec signing in as `platform@test.local` grants `organization`/`org_admin` only. `291` is entirely
unaffected — clause 1 already re-homed it to `oa_b`, with its own ⛔ *"Do NOT restore the platform
admin here to make a future red go away."*

---

## Increment A ✅ BUILT — ADR 0168 Amdt 1/2, the three doors

`20261003006100_adr0168_three_doors_orphan_recovery.sql` · `393` re-cut (48 → 55 assertions) ·
`398` new (25) · `database.ts` regen.

### The shape that shipped

**ORDINARY** (`app.affiliate_person_to_org_impl`, `app.affiliate_person_impl`) narrowed to
`app.person_known_to_org` · **CREATION** (`…affiliate_new_person…`, `service_role`-only wrappers)
keeps gen-1's predicate, bounded by ACL + its own audit verb · **RECOVERY**
(`public.recover_orphan_person_to_org`, `authenticated`, `app.is_admin_for`) requires
`app.person_is_anchorless`.

⭐ **`393`'s differential gained a DOOR dimension** — `ae24_declared` is now keyed
`(door, label, tier, direction)`. The ordinary door declares **NO WIDENINGS** (that is the security
claim, stated as data); the creation door carries gen-1's widenings **preserved**, which records
that ADR 0168 *moved* those semantics rather than deleting them.

### Gates — exit codes captured directly

| Gate | Result | Exit |
| --- | --- | ---: |
| `ARM=census` (lead-verified, post-merge) | 569 gates / **605** verdicts (was 603) · INVARIANT HOLDS | 0 |
| `scripts/door-sweep-cases.sh fa3fe93f` | `CASES=[person_is_anchorless person_known_to_org]` | 0 |
| diff-scoped sweep over those two | `SWEPT 2 · COVERED 2 · BLIND 0 · ERROR 0 — CLEAN` | 0 |
| `ARM=hat` · `FROMFINDINGS=1 ARM=wrapper` | INVARIANT HOLDS (run unasked — new gates) | 0 |
| `npm run lint` (lead-verified) | **11/11** | 0 |
| `npm run test` · `typecheck` | 146 files / 2003 tests · 0 errors | 0 |
| vitest `d14` + `invite` (lead-verified) | 55/55 + 9/9 | 0 |

⭐ **`ARM=census` VIOLATED first, exactly as designed** — it named the two brand-new predicates,
which is the arm's whole purpose (a new gate is in no BLIND set, so `ARM=policy` passes it
vacuously). Fixed by **merging** the two rows into `docs/reviews/authz-door-audit-findings.md`; the
subset run wrote to SCRATCH and the committed baseline was verified unchanged by cksum + empty
`git diff --stat` (ADR 0153 — ⛔ never `git checkout --` that file).

### ⭐ The vacuity hunt — measured, not inspected

Both suites were **green on their first run**, which this repo treats as a finding. Five mutation
controls, each asserting the edit landed first: restoring the anchorless disjunct to **one** sibling
reds `393 § 5.7` in **both** directions; an ACL flip reds `398 § 1.2` (the ruling pin); a misspelled
verb reds `§ 4.1/4.7/4.8`; a widened recovery predicate reds `§ 3.3`.

⛔ **"Did anything go vacuous rather than red?" was answered by INSTRUMENTATION, not by reading.**
Both narrowed doors were made to `raise warning` on every call whose behaviour the narrowing flipped,
and all 246 files were run: **exactly 7 flipped calls in the whole suite** — W3, W5, W6, W7, H1, H4,
H6, every one of them `393`'s own cells. F1 correctly absent (it routes through the creation door).
**No other suite ever reached the anchorless branch**, so nothing else *could* have gone vacuous.
The instrument's own only casualty was `§ 5.7` noticing the instrument — then removed, and its
absence re-measured from `pg_proc`.

### Two defects the run caught in the first draft — both from this repo's known families

- ⛔ **A door called inside a query's `WHERE` cannot see its own audit rows** (snapshot isolation) and
  reported `(none)` — a *fabricated* "this door emits no verb". The snapshot rule is now written into
  `398 § 4`'s header so the next author does not re-derive it.
- An assertion's actor hit the **authority** arm before the **containment** arm, so the cell was
  measuring the wrong refusal.

### Rulings taken during the build, recorded because no gate would carry them

1. **The recovery door needed an org-existence guard** (`HC0R5`). `is_org_admin_of_for` gives the
   ordinary door one for free; `is_admin_for` is org-independent, so a typo'd org uuid would have
   surfaced as a raw `23503` in the UI. No oracle concern — a platform_admin already enumerates orgs
   under the noun rule. Pinned as `398 § 3.5`.
2. **The recovery door has no idempotent branch, and that is a consequence, not an omission** — an
   anchorless person has zero non-voided rows of any tense, so the siblings' probe cannot match.
   Documented so nobody "restores" dead code.
3. ⛔ **The deriver's exit-0 carried an 8-item EXCLUDED-BY-NAME list** (both ordinary impls, both
   creation impls, both creation wrappers, the recovery impl + wrapper). The name filter is
   acknowledged blind, and **for an ALTERED gate `ARM=census` does not backstop it**. **Ruled: all
   eight are authorization gates; none is a boolean predicate, so the door sweep structurally cannot
   neutralize them; each therefore owes a targeted mutation case — and each now has one with a
   recorded red** (M1/M2 · A + `398 § 2.1/2.2/2.5` · C + `398 § 3.3`).

### Increment A — lead-verified gate numbers (re-run independently, fresh reset)

`supabase db reset --local` exit **0** → `npm run test:db`: **`Files=246, Tests=8256, Result: PASS`,
exit 0** (baseline `245/8224`; +1 file = `398`, +32 tests). Re-run by the lead rather than carried
from the builder's report, because a census run mutates and restores in between and *a green
baseline is not evidence the DB is fit to measure from*. The full door-family ACL matrix was also
re-derived from `pg_proc` by the lead: all 5 impls + 2 helpers owner-only; both creation wrappers
`service_role`-ONLY; recovery `authenticated`-only; `anon` false everywhere.

---

## Increment B — TS half ✅ DONE (SQL half in flight)

`assignStaffAdmin` (`src/lib/admin/actions.ts`) moved from `public.grant_role` (session door) to
`public.grant_role_for` (service_role twin, explicit `p_actor` from `getSessionContext()`).
⛔ No authority traded — the `_for` twin re-derives the SAME authority in PostgreSQL from `p_actor`.

- **`lint:service-role-registry` reds on this by design** — the move creates a NEW service-role call
  site. Registry row added; gate back to **45 == 45**.
- ⭐ **The change SURFACED A FIXTURE THAT DID NOT MODEL REALITY.** `actions.test.ts`'s `contextWith()`
  returned **no `userId`**, though the real `getSessionContext()` has always had one
  (`platform/actions.ts:assignOrgAdmin` reads it). It sat harmless for as long as no cell read the
  field — an incomplete fixture is invisible until something needs the missing part. Fixed the
  **fixture**, not the guard.
- ⚠ **Checked rather than assumed, and it could easily have gone the other way:** the deny cells use
  `expect(rpc).not.toHaveBeenCalled()`, and moving from the cookie client to the admin client would
  make those **vacuous** if the two mocks were distinct spies. Measured — `vi.mock` returns the SAME
  `supabaseMock` for both `createClient` and `createAdminClient`, so the single `rpc` spy still sees
  the call. The deny cells stay live.
- **Red-proven, both halves:** a wrong `p_actor` reds, and reverting production to the session door
  reds. `p_actor` is asserted explicitly because the twin's whole point is that PostgreSQL derives
  authority from THAT id — a call passing the TARGET instead of the caller is an authority bypass
  `result.ok` cannot see. 9/9 after restore.

### Increment B ✅ BUILT — SQL half

`20261003006200_adr0168_amdt3_grant_role_split.sql` · `399` new (16) · `396 § 2` re-cut
(`plan(63)`→`plan(64)`) · `293` re-cut (unplanned — see below).

**Gates:** `test:db` **247 files / 8273 tests PASS** · lint **11/11** · `ARM=census` 0 (569/605) ·
deriver 0 · diff-scoped sweep **CLEAN (2/2 COVERED, 0 BLIND)** · typecheck 0. Findings baseline
`md5sum -c` **OK** — untouched by the builder; the 2-line diff on it is increment A's merge.

**The asymmetry pin (`399 § 1.1`)** derives BOTH literals from `pg_proc` in ONE cell
(`grant_role=false grant_role_for=true`), anchored on the preceding parameter *name* so a reordered
call reds rather than matching the wrong literal, and yielding `NO-MATCH` rather than an empty string
if the body's shape changes. ⭐ One cell for both, so "restore symmetry" cannot land as one red and
one green — and M1/M2 move it from **opposite sides**, which is the one-directional-mutation trap
closed rather than merely avoided.

**Red-first:** `399` was run against the **un-migrated** DB — **7 of 16 red**, and `§ 2.1`'s
pre-migration failure *is* the lead's live probe reproduced as a test.

### ⭐⭐ The finding that outlives this increment: a CAPABILITY-bounded sibling census

`399 § 3.1` replaces the name-bounded sibling census with one derived every run: **every function
whose comment-stripped body inserts into `public.organization_affiliations`**, with its predicate
profile. Measured **pre-migration**, `app.ensure_provisioned_org_affiliation` sat in that set
carrying `-+-` — **neither named predicate while writing the table**, and *nothing in the estate was
asking*. That is exactly the hole ADR 0168 Amdt 3 was written about, now a live gate instead of a
lesson. ⛔ This is the shape every future door census in this repo should take.

### ⛔ Three honesty notes that must not be lost

1. **`ARM=census` gives this door NO coverage and never did.** `ensure_provisioned_org_affiliation`
   is `prosecdef` returning **uuid** — a scalar non-bool command door, explicitly outside the census
   domain (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`). No regression, but **"census clean" is not evidence
   about this function**; `399` is. Absence of a verdict is absence of coverage.
2. **`293` was a FIFTH flip the lead's blast-radius estimate missed** — and it failed **loudly**
   (`Bad plan. You planned 27 tests but ran 3`), because `has_function_privilege` on a
   no-longer-resolving signature *raises*. Re-cut to resolve the oid **by name** and assert the
   domain size in the same string (`'0|1'`) — strictly stronger, since the old literal could not see
   an added overload and the `|1` stops it going green on an empty set.
3. **Two harness defects the builder hit and reported rather than hid:** a mutation that **did not
   land** (un-doubled quotes) — caught only because the harness asserts the edit landed first; and a
   restore that was a **silent no-op**, because the REVOKE named an 8-arg signature where the
   function is 7-arg. ⛔ *A REVOKE against a signature that does not match is a silent no-op*, so the
   "baseline re-run" afterwards was dirty.

### Regression this increment introduced, found and fixed by the lead

Adding `p_allow_anchorless` changed `app.grant_role_impl`'s signature, and **five mutation harnesses
hard-coded the old 7-arg literal** (`adr0167-…`, `f1-expiry-seam`, `q1-quality`, `w3-door-kernel`,
`w4-technical-director`). Measured, not assumed: the stale cast **raises**
(`function … does not exist`). Fixed to `'app.grant_role_impl'::regproc` — resolves by name and
errors on a stale overload, which is the property actually wanted — and the one **DDL** site to the
real 8-arg signature, since `execute` on a non-existent signature raises and *a mutation that does
not apply reports GREEN*. Verified by executing all three constructs; encoding and LF endings intact.

---

## ⚖ M11 / ADR 0164's HARD PRE-CONDITION ON THE DROP — DISCHARGED, measured 2026-08-28

Not inferred from "the migrations landed". Re-run with **the same instrument that found the defect
open**, through the **public wrappers as a real signed-in user**, on a fresh reset, rolled back.

| Door | Actor | Before | After |
| --- | --- | --- | --- |
| `public.affiliate_person` — ADR 0168 Amdt 1 calls this *"the entire exposure"* | `hospital_admin` of Central A | accepted | **REFUSED `HC0R0`** |
| `public.affiliate_person_to_org` | `org_admin` of A | accepted | **REFUSED `HC0R0`** |
| `public.grant_role` → `ensure_provisioned_org_affiliation` (the door the name-bounded census missed) | `org_admin` of A | **accepted — anchor + `org_admin` membership both written** | **REFUSED `HC0R0`** |
| `public.recover_orphan_person_to_org` — ⭐ POSITIVE CONTROL | `platform_admin` | n/a | **ACCEPTED, row written (1 org affiliation)** |

⛔ **The preconditions were asserted in the same transaction, so a refusal cannot be a fixture that
stopped constructing the state:** the orphan is still flagged by `app.tenant_orphan_profiles()`, and
the hospital_admin genuinely still holds `is_hospital_admin_of_for(Central A)`. Without those two
lines every "REFUSED" above would be satisfied by a subject that no longer exists.

⭐ **The positive control is the half that makes this a discharge rather than a lockout.** ADR 0168
refused to lock the door precisely because an orphan is in no roster and reachable only by uuid;
"all three doors refuse" on its own would have been the *stranding* outcome the ADR rejected. Three
tenant doors closed, one platform door open, orphan recoverable — that is the ruled shape, measured.

---

## Increment F (NOT BUILT) — the drop: the `seed.sql` half, measured

`supabase/seed.sql` carries **6** references to `home_organization_id` (`:77`, `:111`, `:257`,
`:379`, `:405`, `:407`). Two are load-bearing:

- **`:257`** — the persona loop writes `user_metadata.home_organization_id` from `u ->> 'org'`, which
  is what `handle_new_user` reads to populate the column. The drop owns `handle_new_user`
  (`src/lib/members/invite.ts` already says so: *"that metadata key outlives this increment on
  purpose"*).
- **`:405-407`** — the org-affiliation seed **derives from the column**:
  `select pr.id, pr.home_organization_id … where pr.home_organization_id is not null and not pr.is_admin`.

⛔ **THE WRINKLE, and it is structural rather than a rename.** That block's own header argues
*"⭐ DERIVED, NOT HAND-LISTED … a hand list of persona UUIDs would have to be edited every time a
persona is added, and the failure mode of forgetting is a persona who is invisible in the directory
for reasons no test explains."* After the drop that predicate **has no subject**, and the obvious
replacement — a literal persona list — is exactly what the header forbids.

The honest source is the same one the loop already uses: `u ->> 'org'` from the persona JSON array.
But that array is scoped to a `do $$ … $$` block (the `auth.users` loop) and **the affiliation insert
at `:405` is a top-level statement outside it**. So the rewrite must either materialise
`(id, org)` from the loop into a temp table and derive from that, or move the insert inside the
block. ⭐ Either keeps "derived, not hand-listed" true; a literal list silently breaks the property
the comment exists to protect, and no gate would notice.

⚠ Ordering is load-bearing and self-enforcing (`:374-376`): the org affiliation must precede the
hospital one or `supabase db reset` fails at seed time on the deferred containment trigger. Any
restructuring must preserve that, and the failure is loud, which is the good case.

### Increment F — the FULL break map, measured file-only 2026-08-28

⚠ SQL claims below are from migration text and are **INDICATIVE ONLY** — verify in the catalog.

| Kind | Where |
| --- | --- |
| ⛔ live SQL read in a function body | `public.handle_new_user` · `public.guard_profile_privileged_columns` · `test_helpers.bootstrap` (`00_setup.sql:173`) — **CNV-3's closed set of 3** |
| ⛔ live PostgREST projection | `src/lib/queries/org-users.ts:55` (`PROFILE_SELECT`) → 42703 |
| ⛔ live raw-SQL read in a spec | `e2e/platform-org-admin-provisioning.spec.ts:142-144` (selects the column **and asserts its value**) |
| ⛔ seed derivation | `seed.sql:405-408` (+ the "derived, not hand-listed" wrinkle above) |
| ⛔ baseline script | `scripts/authz-explain-baselines-ae0.sql` ×6 |
| ⛔ pgTAP | **171 refs / 45 files.** Three classes: fixture `update … set home_organization_id` (~40 files, mechanical) · **AE2 differential suites that reproduce the OLD predicate ON PURPOSE** (`390`–`395` — rewritten or retired, never "fixed") · schema assertions red **by design** (`180:47` `has_column`, `:98`, `:103`) |
| ⚠ metadata writers to delete | `src/lib/users/actions.ts:723` · `src/lib/members/invite.ts:147` · `e2e/mem-memberships-collapse.spec.ts:106` · `e2e/phase13-audit.spec.ts:161` · `seed.sql:257` · `demo/seed-revisao-prontuario.sql:203` |
| ✅ already-green negative pins | `person-admin-view.test.ts:557` · `org-roster-predicate.test.ts:204,422,504-529` |

### ⛔⛔ THE GATE CANNOT SEE THE METADATA WRITERS — and it says so on purpose

`src/lib/queries/org-roster-predicate.test.ts:517-520` is a **self-test** asserting that the
module-property regex does **NOT** match `data: { home_organization_id: organizationId }` (nor a
`select('…')` projection). That is correct for what the property is about — *predicates* — and it
means **the repo's own drop gate is deliberately blind to both metadata writers and to
`PROFILE_SELECT`**.

⭐ So the two loudest classes at the drop are the two nothing will report: a projection that fails at
**runtime** (42703, not build), and metadata keys that simply become inert with **no error at all**.
⛔ The metadata writers must be removed **by hand, in the same increment**, and their removal
verified by something other than that property test.

### ⚠ One inherited claim to verify, not carry

`src/lib/users/d14-person-level.test.ts:451,458-460` says the column *"is kept on the profiles row
above ONLY because `registerUser`'s email/CPF pre-checks still read it on a different path."*
**Unverified, and the sweep found no such read.** If false, that fixture line is load-bearing for
nothing and the comment is a stale assertion of exactly the kind that has cost this phase repeatedly.
Measure the pre-checks before trusting either the comment or its removal.

### ⚠ Already-stale comments the drop will walk past

`e2e/phase13-audit.spec.ts:139` and `20260702000000:369,377` still describe
`profiles_tenant_has_org_trg` as live; `…005600:83` **dropped** it. `src/lib/queries/org-users.ts:33`
still describes an `is_org_admin_of(home_organization_id)` leg on the `profiles` SELECT policy that
AE2.2 removed, and `:483` describes D10 Phase 2 as not-yet-done. None reds anything.

---

## Increment C ✅ BUILT — ADR 0167 Amdt 2, `staff` sub-arm narrowed WITH its compensation

`20261003006300_adr0167_amdt2_commission_staff_subarm.sql` — ⭐ both bodies generated from live
`pg_get_functiondef` by a script that **aborts on any needle miss**, so they are byte-for-byte the
catalog apart from one predicate and three comment blocks. Site re-derived from `pg_proc`: 3 live
`is_admin_for(` sites in `grant_role_impl`; one removed; now 2 grant / 1 revoke, re-verified after
reset.

**Red-first:** the three suites were run **unmodified** against the narrowed door — exactly the
predicted set reds (`293 § 2.10`, `§ 3.2`; `397 § 0.3`, `§ 5.3`, `§ 6.1`), and `291` had **zero**,
confirming it was behaviourally unaffected as the sweep claimed.

### ⛔⛔ THE LEAD'S PRESCRIBED COMPENSATION WAS WRONG, and the correction is the lesson

The brief said: give site (b) a witness by adding the message assertion to `291 § 4.10`, whose actor
class is `is_staff_admin_of_for ∧ ¬is_tenancy_admin_of_for`. **Measured, that does not restore the
witness.**

> Both `291 § 4.10`'s actor and 397's actor 7 are `is_admin_for = **false**`. So restoring site (b)'s
> dropped `is_admin_for` leaves the raise **firing anyway** — `restore_is_admin_site_b` stays
> degraded to structural reds, which is the exact degradation the compensation existed to fix.
> **Only an actor that is BOTH `is_admin_for` AND a commission `staff_admin` makes site (b) DECIDE
> anything.**

⭐ **Generalises: a witness that proves a guard FIRES is not a witness that the guard DECIDES.** To
red-prove a mutation you need an actor for whom the *mutated predicate changes the outcome* — not
merely one who reaches the line. 397 gained `pa_sa` (ord 8, both hats); § 5.3 was re-homed onto it,
actor 7 kept as its control, and `291 § 4.10` done as well.

### The agreement-property floor is `8|32`, not the lead's `6|24`

Unscoping over the original **6** actors would have been *its own vacuity*: none of them satisfies
`is_staff_admin_of_for`, so the `staff` sub-arm's **third disjunct** — the one Amdt 2 argues is
"symmetric and untouched" — would have been asserted by **nothing**, and the two sub-arms' grids
would have come out identical row-for-row. Actors 7/8 are `42501` on `staff_admin` and `ALLOWED` on
`staff`, which forced `expected` to split into `exp_sa` / `exp_st` / `exp_demote`.

### Mutation audit: 20 → 22 mutants, and a THIRD needed work

- `restore_is_admin_site_b` — re-armed **behaviourally** via actor 8 (was structural-only).
- `site_b_generic_message` — was moving **nothing**; now reds `5.2 5.3`.
- ⛔ **`remove_staff_arm_is_admin` — not named in the brief: its NEEDLE CEASED TO EXIST**, so it would
  have reported `NOT PROVEN → MUTATION NO-OP`. Replaced by `restore_is_admin_staff_subarm` plus the
  opposite polarity `deny_all_staff_subarm` — both directions, per the one-directional-mutation trap.
- `close_the_staff_gap` → `revoke_staff_admits_platform` (its expected red lived in the deleted § 6).

**22/22 RED-PROVEN**, CONTROL 41 ok / 0 not ok. ⭐ The **full blast radius of all 22** is now recorded
at the foot of the audit script, because `run_case` only checks its named patterns are `not ok` and
never that they are the ONLY reds. Union = **37 of 41**; unmoved = `1.1, 1.3, 4.4, 5.4` — harness
precondition, fixture precondition, population floor, atomicity pin, each already named in 397's
published residual bound.

### Vacuity, answered by instrumentation over all 247 files

`293` flipped=2 reds=0 · `397` flipped=2 reds=1. **Two files, four calls, in the whole estate.** The
three vacuous-not-red cells the sweep predicted are all now discriminating by **message**:
`293 § 3.1` re-homed to `sa_x` and re-cut to `throws_ok` with the message (⚠ **its twin § 3.2 was
re-homed in the same edit — re-homing § 3.2 alone was the trap the sweep named**) · `397 § 5.2`
re-cut to full-verdict over all 8 actors · `397 § 6` **deleted** per its own written exit
instruction, its subject re-homed to § 2.7 + § 3.7 as assertions of the *closed* policy.

Two comments that went false were corrected and are now pinned in **both directions** by `397 § 0.5`:
`grant_role_impl`'s site-(b) note ("the 'staff' sub-arm above ADMITS a platform admin") and
`revoke_role_impl`'s QA m1 replacement note, retired outright per Amdt 2 § Consequences 1.

### Ruling recorded: the deriver's EXCLUDED-BY-NAME list

It now contains `grant_role`, `grant_role_for`, `grant_role_impl`, `revoke_role_impl` because this
increment **altered** them, and ⛔ for an altered gate `ARM=census` does not backstop the name filter.
**Ruled:** all four are authorization gates; none is a boolean predicate (the impls return `void`), so
the door sweep structurally cannot neutralize them; each owes a **targeted** mutation case and each
has one — the 22-mutant audit attacks both impls in both polarities, and
`revoke_door_from_authenticated` + `397 § 1.4 / § 8` + `293 § 1.1–1.7` cover the two wrappers.

---

## Increment E ✅ DONE — detector logging (round-2 finding R2-m4)

`isTenantOrphan` (`src/lib/users/actions.ts`) logged the **entire platform-wide orphan set** — every
`profileId` and `reason` — on `registerUser`'s failure branches. That action has **one** entry point,
`/o/[org]/manage/usuarios/novo`, driven by an `org_admin` or `hospital_admin`. So a single tenant's
request log received the **cross-tenant orphan roster**: precisely the id set
`app.tenant_orphan_profiles()` is `postgres`-only in order to withhold, because it *"enumerates
people no tenant admin can reach"*.

Now logs **this person only**. ⛔ The RPC still returns the whole set — that is its contract, and the
`is_admin` discrimination lives inside it; what changed is **what leaves the process**. Return value
is semantically identical (`orphans.find(...) !== undefined` for `orphans.some(...)`).

⭐ **It also stops the wolf-crying.** Invite-provisioned admins report as `never_affiliated`, so the
old line fired on **every** registration in **every** org regardless of outcome — training operators
to ignore the one signal ADR 0164's mitigation exists to give. It now fires only when *this*
registration is what went wrong.

⚠ **The "are there others nobody has noticed?" question was real and is deliberately NOT answered
here any more.** It belongs on a platform-admin surface where the audience matches the data, not
smuggled into a tenant's request path as a side effect of an unrelated failure. Stated in the code
rather than dropped silently.

### The witness — and why it is a MODULE PROPERTY

⛔ **Measured: NOTHING tested the detector log, in any suite.** A privacy fix with no witness is what
silently regresses. But the behavioural route was closed: `isTenantOrphan` is not exported, and
`d14-person-level.test.ts`'s shared `rpc` mock returns `{ error: null }` unconditionally, so the
logging branch is unreachable without changing a fixture **55 other tests** depend on. Exporting a
private helper, or widening that mock, to buy a witness is a larger change than the fix.

So `src/lib/users/tenant-orphan-logging.test.ts` uses the repo's existing idiom
(`org-roster-predicate.test.ts`): a positive source-text pattern for the spill shape, plus
- a **self-test that the pattern matches the expression that actually shipped** (without it the
  assertion is satisfied by a regex that can never match again — the dominant failure family here);
- a **self-test that it does NOT match** the replacement or the two legitimate collection uses
  (`.find`, `.some`), so the fix is not written around the test;
- a **non-vacuity-of-subject** cell — the file still calls the detector at all, or the property goes
  green the day `isTenantOrphan` is deleted and absence reads identically to compliance.

**Red-proven against the real thing:** reintroducing the shipped enumeration into
`src/lib/users/actions.ts` reds the main assertion; restore clean, 4/4. ⚠ Bound stated in the file:
it reads source text, cannot see an indirectly-built enumeration, and says nothing about whether the
log is *correct* — only that the plural set is not spilled.

---

## Increment D ✅ BUILT — the `is_admin` demotion backstop (CNV-5 / R2-m3)

`20261003006400_adr0166_demotion_tenant_anchor_backstop.sql` · `400_…` new suite (30 cells) ·
`cnv5-demotion-backstop-mutation-audit.sh`.

**The finding was REPRODUCED before it was fixed**, both paths: a signed-in `platform_admin`
demoting itself, and demoting a second anchorless admin — `UPDATE 1`, orphans **0 → 1**,
`never_affiliated`. The catching arm genuinely existed once (`profiles_tenant_has_org_trg`, whose
event list named `is_admin`) and `…005600:83` dropped it, re-attaching the re-predicated function to
`organization_affiliations` **only**.

**Host: `public.guard_profile_privileged_columns()`** — and the decisive fact is stronger than
"a DEFINER is available": `app.person_is_anchorless` is `postgres=X/postgres` and **not granted to
`authenticated`** (measured — as `authenticated` it raises `permission denied`). It is callable only
from inside a postgres-owned DEFINER, so ⭐ **the ADR 0159 prohibited shape is not merely wrong here,
it is impossible.**

**`is_active`: NO ARM, and it is a RULING not an omission.** A 2×2 differential (anchored/anchorless
× active/inactive, plus an anchorless admin both ways) moved orphan membership in **zero** cells —
`tenant_orphan_profiles()` carries no `is_active` term. Deactivation cannot manufacture an orphan;
an arm there would refuse legitimate deactivations while preventing nothing.

**Errcode `HC0RB` minted, and the argument is about the TEST:** the guard already raises `23514`
twice, so a deny cell asserting `23514` **could be satisfied by the wrong arm** — wrong-arm vacuity
in its own suite. ADR 0156:42-43 excludes trigger functions from the gate's domain (lead-verified,
not taken on the builder's reading), and :49 gives the reason — those are sites no `toState` mapper
is responsible for. So the mapper-lessness is the anticipated cost, not an oversight.

### ⭐⭐ M4 — a NEW lesson: a mutation can LAND and still be vacuous

The first attempt at M4 replaced only one conjunct of the polarity gate. **Its md5 moved — the
"assert the edit landed" check passed — and the suite came back GREEN**, which reads as "this cell is
robust". It was not: the surviving `coalesce(old.is_admin, false)` still gated the arm, so the
promotion never reached it and **the labelled defect was never constructed**.

> ⛔ **A landed-but-vacuous mutation is indistinguishable from a robust assertion.** Asserting the
> edit landed is NECESSARY AND NOT SUFFICIENT — the mutation must also be shown to construct the
> state it is named for.

This extends the existing rule (`a mutation that did not fully apply reports GREEN`) one level down.
Recorded in the audit script.

**Mutation table, both polarities, each asserted landed and restored:** M1 arm removed · M2 predicate
→ constant-TRUE (moves the **accept** cells) · M3 → constant-FALSE (moves the **deny** cells, a
disjoint set — the opposite-polarity pair) · M4 polarity gate dropped · M5 schema-qualification
dropped (`42883` cascade — the lead's addition A) · M6 `new.id` → `old.id`. Final md5 back to
baseline.

**Vacuity hunt by full-suite run:** `test:db` under M1 reds **only `400`** — so the header's "400 is
the sole drift protection on this arm" is **measured**, and nothing elsewhere went vacuous.

### Rulings and honesty notes

1. ⛔ **`ARM=census` does not cover this arm — structurally.** Its domain is `prosecdef` **bool**
   gates, set-returning gates, public INVOKER plpgsql, and RLS policies; this arm lives in a
   `trigger`-returning DEFINER. No violation named it because it is **out of domain, not swept**.
   That is precisely why the M1 full-suite run above is the evidence.
2. **Door-sweep attribution was incomplete** — the appended row credited `393,398` only, though `400`
   is measurably sensitive (neutralizing the helper reds `400 § 1.2, 1.4, 2.4, 2.5, 2.7, 2.8`).
   Verdict COVERED was right; the witness list was not. ⚠ Corrected by hand by the lead from that
   measurement — a full sweep would re-derive it.
3. ✅ **Addition B settled by MEASUREMENT, so no follow-up is filed:** **no TypeScript path writes
   `profiles.is_admin`.** The only `src/` touch of that column is a SELECT (`invite.ts:118`,
   `.select('id, is_admin')`). The sole producer of `HC0RB` is a direct PostgREST UPDATE. **No mapper
   is owed** — an owed follow-up nobody can act on is indistinguishable from a real one.
4. ⚠ **`database.ts` was found STALE** (three ADR 0168 doors missing from an earlier increment's
   regen). Lead re-verified: a fresh `gen:types` now produces **no diff**, and all three doors are
   present. `person_known_to_org`'s absence is correct — it is `app.*`, owner-only, invisible to
   PostgREST.
5. **R2-m3 adjacent fact, recorded not fixed:** `app.is_admin()` prefers the JWT claim over the table
   read, so a demotion does not revoke the actor's own hat until the token refreshes.

---

## Increment F — part 1 ✅ DONE (TS, ahead of the migration)

The pieces that are safe **before** the column drops, done first to shrink the atomic step.

- **`org-users.ts` `PROFILE_SELECT`** — `home_organization_id` removed. ⭐ **This was the single
  most dangerous reference in `src/`**, and the reason is worth keeping: it is a **PROJECTION, not a
  predicate**, and `org-roster-predicate.test.ts`'s module property is bounded to predicate usage —
  its own self-test at `:517-520` asserts it does **NOT** match a `select('…')` string. So this
  column would have passed **every gate** and failed at **runtime** with PostgREST `42703`.
- **`ProfileRow.home_organization_id`** and **`OrgUserDetail.homeOrganizationId`** removed, with the
  producer at `org-users.ts:761`.
  ⚠ **Proved dead before removing, and the distinction is a trap:** every `.homeOrganizationId`
  access in the tree resolves to `RegisterUserInput`'s **same-named but different** field (the org
  the registrar picked, `actions.ts:98`) — which STAYS. Only the `OrgUserDetail` field was
  write-only. A careless rename-sweep here breaks registration.
- **Three stale comments corrected**, each a false assertion no gate could contradict:
  `org-users.ts:33` claimed `profiles` SELECT still had an `is_org_admin_of(home_organization_id)`
  leg (AE2.2 removed it) · `:486` claimed D10 Phase 2 was not done · and
  ⛔ **`d14-person-level.test.ts:458` claimed the fixture kept the column "ONLY because
  `registerUser`'s email/CPF pre-checks still read it".** **Measured FALSE** — both pre-checks are
  `.select('id')` (`actions.ts:691,713`). That comment would have justified keeping a field nothing
  needs, in the very increment whose job is removing it.

**Gates:** `typecheck` 0 · `vitest` 32 files / **611 tests** pass · `npm run lint` 11/11.

⚠ **Deliberately NOT done yet** — these must land WITH the migration or they red something now:
the six metadata writers (`actions.ts:723`, `invite.ts:147`, two e2e specs, `seed.sql:257`,
`demo/…:203`) and `e2e/platform-org-admin-provisioning.spec.ts:142-144`, which **asserts the column's
value** and is fed by `invite.ts:147`. Removing the writer without the assertion reds a real spec.

---

## ⚖ Increment F — the retirement audit. VERDICT: RETIRE NOTHING, RE-CUT ALL SIX

Measured per-assertion across `390`–`395` (**255 assertions**, every `plan(N)` matching its real
count). Coverage decided by **SUBJECT** — which function/policy/predicate a cell exercises and in
which direction — never by description text.

### The headline: not one of the six is a pure differential suite

| file | dies with the column | hybrid | ⭐ MUST SURVIVE | infra |
| --- | ---: | ---: | ---: | ---: |
| 390 | 5 | 3 | **41** | 8 |
| 391 | 2 | 2 | **8** | 4 |
| 392 | 9 | 1 | **21** | 7 |
| 393 | 2 | 9 | **36** | 8 |
| 394 | 8 | 11 | **20** | 6 |
| 395 | 8 | 0 | **30** | 6 |

⛔ **`395` is barely a differential suite at all — 8 column cells out of 44.** `393` is 2 of 55.
Retiring "the AE2 differential suites" would have deleted **156 live assertions** to remove 34.

### ⛔⛔ The three findings that would have been silent losses

1. **`app.can_administer_person_via_affiliation` — the predicate ALL THREE re-predicated `SELECT`
   legs call — is asserted ONLY in `390` and `392`.** Repo-wide, every other occurrence is a
   *comment* (`360:98`, `387:298`) or `docs/`. Retire both and the **entire org-tier person-read
   predicate becomes unasserted**: no existence, no DEFINER, no STABLE, no pinned `search_path`, no
   ACL, no behaviour, and nothing asserting any policy calls it.
2. **`person_audit_organization` occurs in exactly ONE test file in the tree** (`394`, 13 refs).
   `394 §10.1` is also the only assertion anywhere that the six person-door kernels attribute their
   audit row to the **located** org — `385`/`386` assert `action`, `actor_id`, `metadata` and
   **never** `organization_id`.
3. **ADR 0163's four retention bounds on `app.person_authority_orgs` live only in `390 §C1–C8` and
   `394 §0.6`.** Outside the six the locator is touched by two cells, neither of which measures
   retention, ties, void-ordering, or the honest empty.

### ⭐ Two gates that stay GREEN while the drop breaks something

- ⛔ **`test_helpers.bootstrap` names the column and is OUTSIDE the domain of both "remaining set"
  enumerations.** `394 §1.5` and `395 §7.2` both scope `nspname in ('app','public')`; `test_helpers`
  is neither. So the two cells whose entire job is "these are the functions still naming the column"
  **stay green while the third one breaks.** It is the same shape as `PROFILE_SELECT`: the bound is
  a domain nobody re-derived.
- **`180_user_registration.sql` carries three column assertions that are in none of the six** —
  `:47` `has_column`, `:97-101`, `:102-106` — plus `profiles_home_organization_id_fkey` is the only
  remaining non-function catalog reference.

### The plan, per file

- **`393` — RE-CUT, DO NOT RETIRE.** Delete `ae24_snapshot`, `measured_old`/`expected_old`, the two
  `update … home_organization_id` fixtures (`:457-461`), and the gen-0 halves of §3.1–§3.5 / §5.1–§5.4.
  ⭐ **§5.7 may be dropped outright — `399 §3.1` supersedes it** with a capability-bounded domain
  instead of a five-name hand list.
- **`395` — re-cut** (8 cells): §1.1–§1.5, §2.8, §7.1, §7.2.
- **`390` — heaviest cargo.** Only 5+3 go; §A7–§A12 and all of §C must MOVE or the predicate above
  loses every assertion.
- **`392`** — §3.1/§3.2 are the only assertions in the estate that the **policies actually call** the
  predicate (not merely that the predicate is correct). §5.1/§5.2 are the only measurement of the
  implicit `profiles`-RLS gate the DEFINER call removed.
- **`391`** — §3.3 (the noun rule through `list_addable_commission_members`) and §4.4 (that door is
  still `SECURITY DEFINER`) are UNIQUE; §4.2 is superseded by `395 §8.1`.
- **`394`** — §0.6, §1.4, §6.1–§6.4, §7.1–§7.5, §9.2, §10.1–§10.3 must survive.

⚠ **Rule 13's LOCATE-vs-GRANT split is asserted by exactly three cells — `390 §D10`, `392 §4.3`,
`394 §9.2` — and ALL THREE are inside the six.** `394 §9.2` is the only one on the *write* predicate.
At least one must survive any re-cut.
