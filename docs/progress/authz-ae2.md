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
| **AE2.3a** — the widening differential, **read/visibility half** (phase keystone) | ✅ **DONE 2026-08-27** | suite `392` (38 assertions); 50-cell matrix, 5 pre-declared widenings, 5 accepted narrowings, 8-mutation vacuity proof |
| **AE2.3b** — the widening differential, **write/containment half** | 🟡 **PARTIAL** | increment 1's half **DONE** (`393` § 3 + § 5); increment 3's **capability-level** differential **DONE** (`394`, 396 cells). Still owed: the picker (increment 4) |
| **AE2.4 inc 1** — the circular pair | ✅ **DONE 2026-08-28** | migration `20261003005600`; suite `393` (44 assertions); ADR [0165](../decisions/0165-affiliation-derived-tenant-gate-and-its-widening.md); 9-mutation vacuity proof |
| **AE2.4 inc 3** — the write-authority path (hard gate on the drop) | ✅ **DONE 2026-08-28** | migration `20261003005700`; suite `394` (42 assertions); ADR 0163 now FULLY LIVE; 18-mutation vacuity proof |
| **AE2.4 inc 4** — `listLinkableOrgUsers` (shape C-b′) | 🔜 | — |
| **AE2.4** — drop the column | 🔜 | after all four increments |
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
