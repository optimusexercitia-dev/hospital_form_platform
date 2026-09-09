# ADR 0200 — A predicate parameterised on a principal must answer about that principal, and a narrowing can remove the last reader of the parameter

**Status:** proposed — to be accepted at unit `CAN-MANAGE-PROFESSIONAL-SELF-CHECK`'s Record step, after PO approval. ⛔ That flip is the only thing that moves it, and **no gate reds if it never happens**.
**Date:** 2026-09-09
**Area:** authorization / professional identity (Class-2) / the AE5 re-key template
**Amends:** ADR [0193](./0193-the-enforcement-manifest-declares-what-it-measured.md) (D5 — the per-row `definerSurface` obligation the AE5 template inherits is extended: the template must also declare the **keying** of every arm it pairs, because 0193's representative chain `can_create_professional → can_manage_professional` differenced a `p_uid`-keyed arm against an `auth.uid()`-keyed one and the manifest's `expected: "identical"` row rested on the arm this ADR changes)
**Related:** ADR [0078](./0078-authorization-capability-model.md) (the catalog is truth; migration text is stale by design) · ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (the door-audit sweep is a standing gate — a migration owes both arms) · ADR [0106](./0106-act-as-role-assumption.md) (D11, the ACT hat, and why a third-party question must ignore it) · ADR [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) (the AE sequence this batch precedes) · ADR [0176](./0176-authz-permission-layer-made-real.md) (D2/D6, the layer-3 re-key of `org.professionals.read`) · ADR [0190](./0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) · ADR [0192](./0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md)

---

## Context

`app.can_manage_professional(p_org uuid, p_uid uuid)` gates the professional-identity MODIFY
half — `update_professional_profile`, `redact_professional_profile`, `set_professional_link_state`
— and is composed by four further predicates. Its signature promises an answer about `p_uid`.

Migration `20261003007190` (BUG-PROF-INACTIVE-001, 2026-09-01) noted a defect in it and
deliberately did not fix it, in writing:

> *"`app.is_admin()` takes NO argument and reads `auth.uid()`, so the first arm of a predicate
> parameterised on a third party answers about the CALLER. … Folding it in would make this
> security fix unattributable, and it needs its own reachability analysis."*

That became `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` 🟠. Its body recorded, as of 2026-09-01:
13 callers, 12 passing `auth.uid()`, exactly one passing a third party, and a reachable
consequence — *"a platform_admin asking whether user X may read this profile gets TRUE because
the asker is an admin."*

**AE4.7c then changed the subject underneath the follow-up.** Migration `20261003007220` moved the
commission `staff_admin` ascent out of `can_manage_professional` into `can_create_professional`.
That ascent was the **only arm that read `p_uid`**. Removing it left a body whose own header
comment stated the problem and declined to solve it:

> *"With the ascent gone, `p_uid` is a null guard and nothing else:
> FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, narrowed rather than fixed. Left alone deliberately."*

The follow-up's clause (`Closes when: PO's, once BUG-PROF-INACTIVE-001 is green`) came due when
that bug was fixed, and pre-AE5 remediation Batch 8 was opened to discharge it. This ADR records
the reachability measurement, the PO's disposition, and what the fix changes.

## Problem

The reachability analysis was performed on the **live catalog** at migration head pair
**`(20261003007350, 524)`** — derived, not quoted:

```sql
select max(version), count(*) from supabase_migrations.schema_migrations;  -- 20261003007350 | 524
```

It refutes the follow-up's body **in both directions at once**, which is why the disposition could
not be read off the entry.

**The defect is bigger than the body says.** Both arms are caller-keyed, not one.
`app.is_org_admin_of(p_org)` resolves `app.is_active((select auth.uid()))` and
`app.has_role('organization', p_org, 'org_admin', (select auth.uid()))` — the parameter is the
scope, never the principal. So `p_uid` was read by nothing at all.

**The reach is smaller than the body says.** Method: `prosrc` scanned WHOLE per LEARN-048 (a
line-filtered `prosrc` under-reports a multi-line guard), each call expression then extracted
across newlines and every hit hand-classified comment-vs-call.

| quantity | value | derivation |
| --- | --- | --- |
| direct call sites | **7** | `prosrc like '%can_manage_professional%'` excluding the subject → 8 rows, of which **one is the function's own header comment** (`app.can_create_professional (row 43)`), verified by extracting the matched region |
| call expressions in the transitive closure | **20** | the 7 above plus the 13 entry points reaching them through the 4 pass-throughs |
| expressions binding a third party to `p_uid` | **0** | 16 pass `auth.uid()` literally; the 4 pass-throughs forward a parameter that resolves to `auth.uid()` at every entry point above them |
| triggers reaching either predicate | **0** | `pg_trigger` join `pg_proc`, `not tgisinternal` |
| client-reachable call sites | **0** | `app` is absent from `[api].schemas` in `supabase/config.toml`, so no PostgREST door names it regardless of its `authenticated` EXECUTE grant |

The one site a variable-blind classifier would leave undecided — `app._audit_access_authorized`,
which passes `v_uid` — declares `v_uid uuid := auth.uid();` on its first line. **Resolved, not
assumed.**

⇒ **The follow-up's stated consequence is not reachable at head.** The defect is a *latent trap*,
not a live hole: no shipped answer is wrong today, and the next caller that passes a third party
inherits a silent wrong one. That is why **no BUG row is opened** — a BUG row would assert a live
defect the measurement refutes.

**But the trap sits exactly where AE5 will step.** ADR 0193 made
`can_create_professional → can_manage_professional` the representative chain AE5's `org_admin`
increment substitutes through, and `can_create_professional`'s body is literally *the preserved
arm OR `authz.has_permission(p_uid, 'organization', p_org, 'org.professionals.create')`*. **The
asymmetry is visible inside one expression**: the re-keyed arm is keyed on `p_uid`, the preserved
arm it is differenced against on `auth.uid()`. A differential whose two sides answer about
different principals is not a differential — it is comparable only because every current caller
makes them coincide.

**A second site the follow-up does not name.** `app.can_read_professional_profile` carries its
*own* `if coalesce(app.is_admin(), false) then return true;`, which fires **before** it ever calls
`can_manage_professional`. Fixing the named predicate alone would leave the follow-up's own quoted
consequence still true, and closing the entry on that basis would be a partial fix reading as a
complete one.

Both polarities were constructed and measured in rolled-back transactions (there is no reachable
path, so the states had to be built):

| polarity | caller | subject `p_uid` | at head | correct |
| --- | --- | --- | --- | --- |
| over-grant | `platform@test.local`, hat on | `chefe.ccih@test.local` | `true` | `false` |
| under-grant | `chefe.ccih@test.local` | `orgadmin.a@test.local` | `false` | `true` |
| self control | `orgadmin.a@test.local` | itself | `true` | `true` |

## Decision

**R1 (PO, 2026-09-09) — FIX NOW, via the existing `_for` twins.** Not a defer, not a drop of the
admin arm. `app` already carries the subject-keyed twin of every caller-keyed predicate, and
`app.is_admin_for`'s own comment was written for this problem: *"a question about a THIRD PARTY is
unchanged — one principal's hat must never alter what the system concludes about another."* At
head the twins had **3** and **14** real callers respectively (comment-stripped `prosrc` count);
after this migration they have **5** and **15**, which is itself the check that the change landed
at exactly the intended sites.

**R2 (PO) — BOTH SITES, one migration.** `app.can_read_professional_profile`'s own first arm is
re-keyed in the same migration; no `FUP-CAN-READ-…` is filed because it is fixed here. Two
functions in one migration is against the one-predicate discipline, and is justified because it is
**one predicate change applied at both sites of one defect class**, with each site carrying its
**own** bidirectional cells — so each remains individually attributable.

**R3 (PO) — the tightening is ACKNOWLEDGED and DECLARED, never absorbed into a "no regression"
claim.** See § Consequences.

Migration `20261003007360_can_manage_professional_subject_keying.sql`:

```sql
select p_uid is not null and (
  app.is_admin_for(p_uid)
  or app.is_org_admin_of_for(p_org, p_uid)
);
```

and, at the second site, `if coalesce(app.is_admin_for(p_uid), false) then return true; end if;`
with its other three arms preserved verbatim. Signatures, `prosecdef`, `proconfig`, volatility,
owner and ACLs are unchanged; no `app` function appears in `src/lib/types/database.ts`, so
`gen:types` is a no-op.

**Method (lead ruling L1): a full `create or replace`, not `20261003007190`'s
`pg_get_functiondef` + `replace()` pattern**, keeping that migration's both-direction landing
assertions. Two reasons: the change replaces a whole disjunction rather than one clause, so
`replace()` would need two independent substitutions per function and double the surface on which
a mutation that did not fully apply reports green; and **the header comment must be rewritten** —
the live one documents the defect as a deliberate decision, and that sentence is false after this
migration. Every needle is `(`-terminated, because `app.is_admin` is a prefix of
`app.is_admin_for`: a bare-substring check would red forever on the new name and pass on the old
one. The AFTER block also asserts the **preservation** half — the three untouched arms of the
second function are still present — so a `create or replace` that silently narrowed the gate
cannot satisfy it.

## Considered options

**(i) Key both arms on `p_uid` via the existing `_for` family — CHOSEN.** Two identifiers at one
site, one at the other, onto helpers already in production use. No new object, no signature
change, no type regeneration. The only cost is the declared tightening below.

**(ii) Drop the platform-admin arm entirely, keeping only the org-scoped arm.** There is a real
argument for it: `can_manage_professional` gates `update_professional_profile` and
`redact_professional_profile`, i.e. **Class-2 professional identity content**, and the noun rule
(ADR 0078 A35) says a `platform_admin` may not touch commission content. **Rejected for this
batch, not on the merits.** It is a second, independent behaviour change riding in a migration
whose claim is "the predicate answers about `p_uid`", and unlike (i) it moves a *currently
reachable* answer — a `platform_admin` can redact a professional profile today and could not
afterwards. That is precisely the unattributable-fix shape the follow-up cites as the reason it
was not folded into `20261003007190`. Filed as
`FUP-PLATFORM-ADMIN-WRITES-CLASS-2-PROFESSIONAL-CONTENT` 🟠, with its own noun-rule ruling and its
own E2E owed.

**(iii) Defer with a mechanical re-open condition.** Defensible on the reading that the defect is
unreachable at head. **Rejected**, and the third reason is the decisive one: the window is now
(AE5 substitutes its per-role increments through this chain and its differential compares a `p_uid`-keyed
arm against an `auth.uid()`-keyed one); the fix is as small as a fix gets; and **deferral has
already been tried and is what produced the second defective arm** — AE4.7c's narrowing removed the
last `p_uid` reader precisely while leaving the arm alone deliberately. A further defer would be
the third pass over the same predicate.

## Consequences

**⚠ R3 — the substitution is a TIGHTENING at SELF, not an identity, and it is stated here rather
than inside a no-regression claim.** `app.is_admin()` carries a JWT-claim fast path that
`app.is_admin_for` does not:

```sql
-- constructed, rolled back, on a principal whose profiles.is_admin is FALSE
select set_config('request.jwt.claims',
  '{"sub":"…c1","role":"authenticated","is_admin":"true","active_role":"platform_admin"}', true);
select app.is_admin();                --> true    (trusts the claim)
select app.is_admin_for(auth.uid());  --> false   (reads public.profiles)
```

The two agree in production **except in a stale-token window**, and the derivation is
`public.custom_access_token_hook` — the configured `[auth.hook.custom_access_token]`
(`supabase/config.toml:380-382`), whose body reads `select is_admin into v_is_admin` from
`profiles` and then `jsonb_set(claims, '{is_admin}', …)`. So the claim is minted **from** the
column at token issuance; an admin demoted *after* their JWT was issued keeps `is_admin()` = true
until it expires, and `is_admin_for` closes that window. **This is a security improvement and it
is a behaviour change; both halves are recorded.**

Exposure to it was bounded before the change and confirmed after: `select count(*) filter (where
is_admin) || ' of ' || count(*) from public.profiles` → **1 of 36**, so the seed has no divergent
principal; and `test_helpers.claims_for(p_user, p_is_admin, …)` takes `p_is_admin` as an
**argument** without reading `profiles`, so a fixture *can* construct the divergent state.
`grep -rlE "claims_for\([^,)]*, *true" supabase/tests/` → **11 files**, intersected with those
naming either predicate → **exactly one**, `387_initplan_wrap_and_profiles_arm_identity.sql`,
which uses the principal whose `profiles.is_admin` is genuinely true. **Zero fixtures exposed** —
a bound, confirmed by the suite rather than asserted by the grep.

**`406 § 2.2` was passing VACUOUSLY and now passes for its stated reason.** It runs with no claims
set, so before this migration `auth.uid()` was NULL, both caller-keyed arms were false for *every*
subject, and the assertion could not have failed. It now answers about `sa`. ⛔ **The green bar is
identical on both sides of that change**, which is why the upgrade is written into the file as a
dated note and named here: an improvement invisible to every gate is exactly the kind that gets
lost.

**Proof, red-first.** `supabase/tests/415_fup_can_manage_professional_subject_keying.sql` — 17
assertions: 7 fixture/discrimination controls, then bidirectional cells for **each arm of each
site**. Run at head before the migration existed, **6 of 17 failed**, and they are the six ⭐
cells; the 4 SELF-discrimination cells and all 7 controls were green, which is what says the
fixture could reach the failing state rather than being broken. After the migration the file is
green. ⛔ There is deliberately **no oracle-equality cell**: asserting the predicate equals
`is_admin_for(p_uid) or is_org_admin_of_for(p_org, p_uid)` would compare the fixed body to itself
(LEARN-091 — two instruments that agree by construction prove nothing). Two masking arms were
measured open and routed around rather than assumed shut: `chefe.ccih` **does** hold
`org.professionals.read` at the org (so § 2's over-grant cell uses a cross-org subject), and the
case-committee traversal grants for the seeded professional (so § 2 builds a participation-free
subject, asserting both the closed mask and, as its discrimination twin, that the mask is
genuinely reachable).

**Suite shape, measured on both sides rather than inferred**, each on a fresh `supabase db reset`:
`Files=263, Tests=8906` before → `Files=264, Tests=8923` after. **+1 file, +17 assertions —
exactly 415's cells.** No existing assertion moved, with one predicted exception below.

**Collateral, and one prediction that landed.** `410 § 3.7` red on the first post-migration run
with `org.professionals.read: authorizer lost app.is_admin` — the enforcement manifest's
`domainAuthorizer.composedWith` named a gate the body no longer calls, and the needle is
`name || '('`. The manifest row is therefore re-keyed `app.is_admin` → `app.is_admin_for` and the
generated projection regenerated with `scripts/gen-authz-matrix-cells.mjs` (never hand-edited).
⚠ **Two further sites on the same row had to move with it, and the coupling is enforced, not
stylistic**: the generator cross-checks that every `composedWith` arm is either the permission arm
or a declared `residualLegacyAuthority` gate **and** that every such gate appears in
`composedWith`, so changing one without the other fails generation; and `410 § 4.6` pins the
residual-arm projection as a **verbatim string**. `§ 3.6`'s cardinality is unmoved at **21**
(13 site pairs + 8 authorizer pairs) because this is a rename, not an add.

**⚠ ADR 0193 D5's obligation, extended and stated AS DATA rather than prose.** D5 required that a
DEFINER/policy split be *"declared as data in a new per-row `definerSurface`, not described in
prose — and the AE5 template inherits that obligation."* The same now holds for **keying**:

> `app.can_manage_professional(p_org, p_uid)` and
> `app.can_read_professional_profile(p_profile_id, p_uid)` are **subject-keyed**: every arm
> resolves about `p_uid`. The AE5 per-role template that substitutes its increments through
> this chain **must never pair a caller-keyed arm with a `p_uid`-keyed one** in a single
> disjunction, because the resulting legacy-vs-permission differential compares answers about two
> different principals and will attribute the disagreement to the re-key.

⛔ **The template defect is wider than the instance this migration fixes, and that is the durable
half of this ADR.** `app.can_manage_case_vocabulary` and `app.can_manage_external_participant` have
byte-identical bodies of the form
`can_manage_professional(p_org, p_uid) or is_org_commission_staff_admin(p_org, p_uid)` — both
disjuncts are now `p_uid`-keyed, so those two sites were repaired transitively by this change.
They are named here so a future reader knows the class was enumerated rather than the instance
patched.

**What this ADR does not do.** It does not put an `is_active` term on the admin arm — neither
`is_admin()` nor `is_admin_for()` has ever consulted `app.is_active`, so a deactivated
`platform_admin` passed that arm before this change and passes it after. That is a distinct,
pre-existing gap, filed as `FUP-IS-ADMIN-ARM-IGNORES-PRINCIPAL-STATE` 🟠 rather than folded in, on
the same attributability argument that kept this follow-up out of `20261003007190`.
