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
| **AE2.0** — PO ruling: offboarded-person lifecycle authority | ✅ **RULED 2026-08-27** | ADR [0163](../decisions/0163-offboarded-person-lifecycle-authority.md) — **last-org retention**, SUBSET capabilities, four bounds |
| **AE2.1** — close the consumer set | ✅ **DONE 2026-08-27** | [census](../design/authz-ae2-home-org-consumer-census.md) |
| **AE2.2** — migration design: per-leg re-predication | ✅ **DONE 2026-08-27** | migrations `20261003005400` + `20261003005500`; suites `390`, `391` |
| **AE2.3** — the widening differential (phase keystone) | 🔜 | — |
| **AE2.4** — drop the column | 🔜 | — |
| **AE2.5** — D3 binding text in ARCHITECTURE.md | 🔜 | — |

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
