---
branch: authz-ae2-affiliation-tenancy
task: AE2 — affiliation/person-tenancy split completion (ADR 0155 D8+D3)
adrs: [0155, 0163, 0164, 0165, 0166, 0167, 0168, 0079, 0133, 0151, 0159]
base_sha: cf9ddef1
created: 2026-08-28
updated: 2026-08-28
status: live
---

# Handoff — AE2

## ▶ RESUME HERE

1. `git log --oneline cf9ddef1..HEAD; git status --porcelain`
2. `supabase db reset --local` — ⛔ **mandatory before ANY verdict**
   (`FUP-AE2-CATALOG-SUPERSET-OF-CHAIN`: a hand-applied migration makes the catalog a
   superset of the chain and **no gate can see it**).
3. Read **PROGRESS.md § Now** — this file is not status truth.
4. Next build task: **ADR 0168 Amdt 1's three doors** (§ Next task).

⛔ Re-measure before relying on anything below — see § Trust.

## Trust

Written **cold at ~85% context**, compacted from the session rather than appended from its
start. Treat every unwitnessed sentence as BELIEVED. The VERIFIED witnesses were run
in-session at the SHAs named; **nothing below was re-run at `cf9ddef1`**.

## Goal and scope boundary

Move every visibility/containment decision off `profiles.home_organization_id`, then **drop
the column**. Closes `FUP-AFF4-HOMEORG-PHASE2`. Pre-pilot.

⛔ **NOT in scope:** AE3+ · the `authz` catalog (AE4) · `personScopeAllows`' empty-footprint
deny (hospital-footprint, deliberately pinned — ADR 0163) · the two `is_admin_for` sites ADR
0167 keeps (organization/`org_admin` bootstrap; hospital/`hospital_admin`).

## State

### Done — VERIFIED

| What | Witness | When |
| --- | --- | --- |
| 7 migrations `…005400`–`…006000` | `git diff --name-only main...HEAD -- supabase/migrations/` | 08-28 |
| Zero policies name the column | `pg_policies` where `qual‖with_check ~ home_organization_id` → **0** | 08-28 |
| AE2.2 · 2.3a · 2.5 · 2.4 inc 1/3/4 | `docs/progress/authz-ae2.md`, per-increment gate sections | 08-27/28 |
| R2-B1 kernel (ADR 0166) | `app.ensure_provisioned_org_affiliation`: `anon`/`authenticated`/`service_role` EXECUTE = **f**, `postgres` = **t**, `prosecdef=t`, `search_path` pinned | 08-28 |
| ADR 0167 clause 1 (`staff_admin`) | `20261003006000` applied; `test:db` 245f/8224 PASS | 08-28 |
| `test:db` at `422e8f7e` | `Files=245, Tests=8224, Result: PASS`, exit 0 | 08-28 |

### Written but UNVERIFIED at `cf9ddef1`

Everything after `422e8f7e` is **docs only** (ADR 0167 Amdt 2; ADR 0168 + Amdt 1). No code
moved. `npm run lint` exit 0 was last run at `cf9ddef1`; `test:db` was **not** re-run after.

### Not started

ADR 0168's three doors · ADR 0167 Amdt 2 (`staff` sub-arm) · `is_admin` demotion backstop ·
detector logging · the drop increment · re-review · `db reset --linked`.

### Tree

`cf9ddef1`, clean **except** two pre-existing, not-ours untracked paths: `docs/learning/`
and `scripts/progress-cleanup-2026-08-26.mjs`. ⛔ Do not commit them — one was swept in by a
broad `git add -A docs/` and deliberately un-tracked again. **13 commits unpushed** to
`origin/authz-ae2-affiliation-tenancy`.

## Gates

| Arm / suite | SHA | Result | Exit |
| --- | --- | --- | ---: |
| `ARM=census` | 422e8f7e | 567 gates / 603 verdicts, HOLDS | 0 |
| `ARM=hat` · `floor` · `FROMFINDINGS=1 wrapper` | 422e8f7e | — · 72 never-called · BLIND 41 | 0 |
| diff-scoped sweep (ADR 0167) | 422e8f7e | deriver **exit 1, ZERO cases** — ruled in phase doc | — |
| `test:db` · `lint` · `typecheck` | 422e8f7e | 245f/8224 PASS · 11/11 · 0 | 0 |

**Did NOT run, at any SHA:** `npm run e2e:prod` (lead's; owed before Gate AE2) · the full
periodic wrapper sweep · **any arm at `cf9ddef1`**.

⛔ **The arms do not see the two role kernels.** `app.grant_role_impl` and
`app.revoke_role_impl` return **`void`** (catalog-measured), so no census clause admits
them — `ARM=census` exit 0 is **not a verdict about them**. Their compensating control is
the 20+2 mutation audit (all RED-PROVEN, residual 4/40).

## Dead ends — the mechanism each failed by

1. **Re-predicating the containment trigger in AE2.2 (the plan's own instruction).** Not
   implementable: `handle_new_user` writes `profiles` inside GoTrue's `auth.users`
   transaction while the affiliation is created in a **later PostgREST transaction**, so
   `DEFERRABLE INITIALLY DEFERRED` defers to the wrong COMMIT and the predicate raises on
   **every signup**. Compounded by a **circular dependency** — the door that *creates* the
   affiliation was itself gated on the column (`HC0R0`). → ADR 0164.
2. **Re-pointing `listLinkableOrgUsers` at `organization_affiliations`.** Collapses a
   `staff_admin` coordinator's picker from **10 candidates to 1**: that table's SELECT
   policy has no staff_admin arm by design (ADR 0151 D1). An `!inner` embed collapses
   identically — the embed is RLS-filtered too. → shape C-b′.
3. **Adding a staff_admin arm to `organization_affiliations_select`** (option C-a). ⭐
   Measured: C-a *would have worked* for the picker; its harm is the widened audience for
   everything **else** that policy gates, which **no behavioural cell could catch**.
   Rejected in ADR 0164; a policy-text gate pins it.
4. **The INVOKER→DEFINER keystone survived its own mutation.** AE2.2 had made profile
   visibility itself affiliation-derived, so the trigger's blindness and the profile's
   became **correlated**: it never reached the containment check, and an
   `if not found then return null` turned ADR 0159's predicted **fail-CLOSED into a silent
   fail-OPEN**. Fixed fail-closed. ⭐ Generalises: *re-predicating one gate can invert the
   failure mode of another that reads through it.*
5. **ADR 0168's two-door split** — closed person creation. § M11 below.

## Decisions made in flight

All **ruled** by the PO. Rationale lives in the ADRs — not restated here.

- **0163** last-org retention (+ **Amdt 1**: its "SUBSET capabilities" bound was a
  *hospital-tier label pinned to an org-tier rule*; retention is capability-**blind**).
- **0164** containment moves to the destructive event; T1 rejected; **the historical
  backfill is discharged by a remote reset**, valid only while `non_test = 0` (PO-measured
  08-28) and **expiring when the pilot loads data**.
- **0166** governance-role provisioning implies an org affiliation, in the **kernel** not
  the callers (+ **Amdt 1**: clauses 5/6 are **narrowings**, not preservations — measured,
  `grant_role_impl` had *no* tenancy check on the target at all).
- **0167** + **Amdt 1/1a/2** — § `staff` below. **0168** + **Amdt 1** — § M11 below.

## ⭐ M11 — orphan recovery (ADR 0168), the hardest thread

**What M11 is.** `affiliate_person_to_org_impl` / `affiliate_person_impl` gate the person
side with *"known here, **or known nowhere**"*. An anchorless person has zero non-voided
rows → the `EXISTS` is false → **the whole check falls through**, so any org or hospital
admin holding the uuid may claim them. ADR 0165 recorded this **unaccepted**; ADR 0164 made
the written ruling a **hard pre-condition on the column drop**.

**Why it is not "an admin gets a roster entry".** It is **the SUBSET bound dissolving**.
Claiming yields a Class-2 identity read, then `cpf_change` + `lifecycle` — CPF rewrite and
the platform-wide deactivation kill switch. Mechanism, verified at
`src/lib/users/person-scope.ts:146-159`: a freshly claimed person's footprint is **exactly
the claiming hospital**, so SUBSET's loop finds nothing outside the administered set and
falls through to true while INTERSECTION returns true immediately. ⭐ The two bounds coincide
**only because the claimer created the footprint they are then measured against.**
⚠ **Architecture Rule 13 is NOT violated** — a Rule-13 test would pass and hide this. The
property is: *the locating fact became self-servable by the same actor who exercises the
grant.* **Assert that, not Rule 13.**

**PO ruling: split the branch, do not lock the door.** Locking strands orphans — they are in
no roster and reachable only by uuid.

**⛔ The difficulty, and it invalidated the first ruling.** The two-door form **closes person
creation for both tiers**: once the column drops, an anchorless person and a **just-created**
person are the **same DB state**. Live probe on a virgin profile: current gate admits TRUE,
`"known here"` alone admits FALSE. Breaks `registerUser` (`src/lib/users/actions.ts:796`) and
`ensureActiveAffiliation` (`:405`). ⛔ **ADR 0165 predicted exactly this** (`0165:129-131`)
and 0168 adopted the alternative 0165 had rejected, **for the reason 0165 gave** — the lead
amended 0165 without reading its own rejected-alternative reasoning. **`393` holds EIGHT
anchorless-dependent cells (W3, W5, W6, W7, H1, H4, H6, F1), not the four 0168 named**; W3 is
labelled `(PERSON CREATION)` and differs from W5 **only in the column under drop**.

**⭐ The diagnosis that settles it:** *the split cannot be a predicate over STATE; it has to be
a split over **DOORS**, because the door's ACL is the only durable discriminator left.*

**⚖ FINAL, PO-ruled 2026-08-28 — THREE doors** (ADR 0168 Amdt 1): **ordinary** (tenant tier,
*known here* only) · **recovery** (`platform_admin`-only, own audit verb) · **creation**
(`service_role`-only, own audit verb, called by the two registrars).

**The third door is a measured bound.** Catalog closure over `pg_proc` (comments stripped —
both impls cite themselves in their headers) **terminates at depth 1**: four reachable
wrappers over two owner-only bodies. TS closure: **3** production call sites — two
`service_role` with `p_user` created in the same request; **one** client-supplied,
`affiliate_person` (`src/lib/affiliations/actions.ts:214`), on the `authenticated` client,
**zero TS authorization by explicit design** (`:19-25`, *"NO AUTHORIZATION LIVES HERE"*),
hospital tier. ⭐ **That single site is the whole exposure, and it is the door the narrowing
closes.**

⚠ **Residual, BELIEVED not closed:** the channel that could steer `userId` to a pre-existing
orphan is a `createUser`/invite returning an existing id, blocked by a `profiles.email`
collision guard that is **currently total** (0 NULL of 36 rows, two sync triggers) over a
column that is **nullable by schema**. Live-closed, not impossible.

**⛔ Three costs the implementation must price in:**

- **A TS MIRROR no call-site sweep finds** — `src/lib/members/invite.ts:105-121`
  re-implements this gate (`listNonVoidedOrgAffiliationsFor` + an `is_admin` arm) on a path
  where **no SQL door ever runs**. Narrowing the SQL alone **drifts it, and no gate would
  red.** Re-cut in the same increment.
- **`393 § 5.7` is a sibling pin whose needle is the predicate's SHAPE** (regexes for
  `if exists (…) … HC0R0`, asserts `1|2`). The rewrite makes it stop matching → red. ⛔ Re-cut
  as a real pin, **never edited to match** — a needle adjusted to fit has stopped pinning.
- **`public.affiliate_person_to_org` holds `authenticated` EXECUTE with ZERO callers.** Rule
  on it; do not leave as found.

## ⭐ The `staff` sub-arm narrowing (ADR 0167 Amdt 2) — RULED, NOT BUILT

**Origin.** A peer session measured the commission `staff_admin` actor grid; the lead
re-derived all of it on a fresh reset before acting (the peer flagged its own figures
inadmissible — correctly). ⛔ The lead did **not** treat the peer's report that the user had
agreed as authorization; the PO ruled directly.

**ADR 0167 (built, `…006000`)** closed a **one-way door** for `staff_admin`: `grant` admitted
`app.is_admin_for` and `revoke` did not, so a platform admin could **seat** a commission
coordinator and not **remove** one. Direction verified rather than argued:
`technical_director` and `quality_reviewer` gate with **no `is_admin_for` arm at all**.

**⛔ The difficulty.** The lead's retirement clause claimed the QA m1 asymmetry note *"has no
subject"*. **Measured, false** — the note covers the whole commission arm, which has **two
sub-arms**, and clause 1 fixed only `staff_admin`. **The same one-way door survived for
`staff`.** Caught because the implementer was told to derive the site set from `pg_proc`
rather than trust line numbers: it found **5** `is_admin_for` sites where the prose implied
one region.

**⚖ FINAL, PO-ruled 2026-08-28 (ADR 0167 Amdt 2): close it by NARROWING** — delete
`app.is_admin_for(p_actor)` from `grant_role_impl`'s **`staff` sub-arm**. A platform admin can
then do **neither**.

**Why it is cleaner than it looks:** the third participant that made this a *different* grid,
`is_staff_admin_of_for`, is **symmetric** — already on both sides — so removal leaves the two
predicates **identical**, not merely compatible. Two consequences: the QA m1 note is **retired
outright** (its replacement's subject is gone too), and the suite's grant/revoke **agreement
property can be UNSCOPED** to span both sub-arms, which is strictly stronger.

**⚠ Obligations carried into the build:**

- ⛔ **It is a NARROWING.** Search pgTAP + `e2e/` for fixtures seating a commission **`staff`**
  as a platform admin. **A red there is a reachability finding, not a test to patch.** The
  `staff` population is larger than `staff_admin` — expect **more** fixture reliance.
- ⛔ **Re-derive the site from `pg_proc` on a fresh reset.** 0167's implementer ruled this
  sub-arm **KEPT** at the time; Amdt 2 reverses that. The other two KEPT sites stay out.
- ⚠ **Precedent from clause 1: five fixtures broke, and the dangerous one produced NO RED.**
  `293 § 2`'s grid cell flipped ALLOWED → 42501 while the suite stayed **green**, because only
  4 of 12 cells were named — a coverage loss disguised as a pass. Also `291 § 4.13` went
  **vacuous rather than red**. Expect the same shapes.

## Open questions / blockers

| Item | Who / what answers it |
| --- | --- |
| Actor-grid discrepancy — `admin/actions.ts:238`/`:307` comments claim "platform_admin OR org_admin" and are **false** about the code beneath. `assignStaffAdmin` is unreachable by a platform admin, but `public.grant_role` called directly **succeeds** | PO — needs its own ruling; deliberately untouched |
| `assignOrgAdmin` not atomic as a whole (org grant + single-hospital bootstrap are two RPCs) | PO — recorded residual, never represented as fixed |
| Whether `db reset --linked` is still valid | Re-measure `non_test` on the remote; **expires at pilot data-load** |

## Next task

**ADR 0168 Amdt 1's three doors**, its own increment. First commands:

```bash
supabase db reset --local
docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc "select proname, prosecdef, pg_get_function_result(oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and proname like 'affiliate_person%';"
```

Then, each its own gated increment: **ADR 0167 Amdt 2** (`staff` sub-arm) · the `is_admin`
demotion backstop (round-2 CNV-5 measured it **reachable**; ⛔ an INVOKER trigger reading
affiliations reproduces ADR 0159) · detector logging (stop enumerating platform-wide orphan
UUIDs in any organization's request path) · **the drop increment — ⛔ includes the `seed.sql`
rewrite: 6 lines derive affiliations FROM the column and no AE2 commit has touched that
file** · re-review at the new head · `db reset --linked` on PO authorization.

## Re-derivation appendix

```bash
npm run lint          # ELEVEN gates
npm run test:db       # after a FRESH reset only
for a in census hat floor; do ARM=$a bash supabase/tests/mutation/p0-authz-invariant.sh; echo "$a=$?"; done
FROMFINDINGS=1 ARM=wrapper bash supabase/tests/mutation/p0-authz-invariant.sh; echo "wrapper=$?"
CASES="$(bash scripts/door-sweep-cases.sh <base>)"; echo "deriver=$?"   # exit 1 = FINDING, never a pass
```

⛔ **Catalog is truth** for every schema/RLS/RPC claim — never a migration file, never
graphify. ⛔ **Capture exit codes directly; a pipe erases them.**
