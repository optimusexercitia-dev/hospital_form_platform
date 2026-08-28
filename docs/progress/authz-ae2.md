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
