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
| **AE2.2** — migration design: per-leg re-predication | ▶ next | — |
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
