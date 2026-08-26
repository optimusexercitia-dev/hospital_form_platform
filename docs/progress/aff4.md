# AFF4 — organization affiliation, per-hospital staff data, the voided tense

> **Task-detail record, written at the §6 step-5 Record step (2026-08-26).** Rotated out of
> `PROGRESS.md` in the same edit that recorded the phase.
>
> ⛔ **THIS FILE IS NOT THE AUTHORITY — [`docs/plans/aff4-org-affiliation.md`](../plans/aff4-org-affiliation.md) IS.**
> The plan carries the full build record: the pre-step narrative, every ruled PO decision, the
> per-task measurements, and the follow-ups discovered during the build. This file exists so a
> *status* reader has the shape of the phase and the addresses of everything else, without the plan
> being loaded. Where the two disagree, read the plan — and see § "Two documents disagree" below,
> because on one point they demonstrably do.

---

## What AFF4 built

Org belonging became a **row with a lifecycle** instead of a column. Concretely:

- **`organization_affiliations`** (D1) — a new table mirroring `hospital_affiliations`. RLS is
  SELECT-only (`principal_id = auth.uid()` OR `app.is_org_admin_of(organization_id)`), with **no
  hospital tier, by design**; every write goes through a door.
- **Per-hospital staff data ON `hospital_affiliations`** (D9) — `job_title` / `work_email` /
  `work_phone`. **No new `profiles` columns and no parallel `hospital_staff_profiles` table**, which
  was the alternative the ADR declined.
- **The voided tense** (D7–D8) — `voided_at` / `voided_by` / `void_reason` on **both** affiliation
  tables. *End says "was true and stopped"; void says "was never true."* Voided rows leave every
  person-read leg, footprint resolver, active-unique index and roster, while the row itself stays
  visible to the same audience badged *Anulado*. No hard DELETE — Rule 12's minimise-not-destroy
  posture (ADR 0072 §7·3). ⭐ **This is what closes Critical FUP C5.**
- **"Active", defined once** (D6) — affiliations are `ended_on IS NULL AND voided_at IS NULL`;
  memberships are `expires_at IS NULL OR expires_at > now()`. The three existing read policies
  deliberately do **not** gain an `expires_at` filter.
- **`home_organization_id` demoted, not dropped** (D10) — the roster predicate moves to org
  affiliations; **every existing RLS leg and the tenant trigger stay on the column**, and migrating
  them is D10's named **Phase 2** follow-on, triggered before multi-org is ever enabled.

**Tracks as actually executed** — **Track P** (P1–P4, pre-step, landed on `main` *before* the
branch) · **Track B** B1–B9 (B6 split B6a/B6b; B4 landed in increments 1–3) · **Track F** F0–F6 (plus
the F0-regression repair) · **Track T** T1–T6. ⚠ **T6 exists** — the DatePicker locator sweep; a
Record-step brief that says "T1–T5" is one task short.

## The doors, the trigger, the tense pair

**Five new doors** (D2), each a `public` `prosecdef` actor-kernel triple with a `service_role`-only
`_for` twin, measured live by QA:

`affiliate_person_to_org` · `end_org_affiliation` · `update_org_affiliation` ·
`void_affiliation` (hospital rows, creation-symmetric authority) · `void_org_affiliation` (org rows,
`org_admin` only). New SQLSTATEs `HC0R6`–`HC0RA`, pinned by name in pgTAP `304` §6.7.

⚠ **A SIXTH new function exists and is easy to miscount as one of the five:** `get_own_person_record`
(D14), the self-only door behind `/conta/meus-dados`. It is self-only **by shape** (`pronargs = 0`),
has **no `_for` twin**, and carries **no ARM 1 verdict** — a named absence backed by a
mutation-proven keystone. QA's own phrasing is *"all six new functions measured live."*

**The D4 containment trigger** — `hospital_affiliation_has_org_trg` → `app.assert_hospital_affiliation_has_org`
(migration `20261003004000`), `DEFERRABLE INITIALLY DEFERRED`. It was created SECURITY **INVOKER**,
which broke D5's one-step rehire for **every** `hospital_admin` (`BUG-D5-REHIRE-HOSPADMIN-001`), and
is now **SECURITY DEFINER** per ADR [0159](../decisions/0159-invariant-backstops-run-as-definer.md)
(`89793d43`, migration `20261003004300`, pinned by pgTAP `381`).

**The tense pair on `OrgUserListItem`** — `orgAffiliationStatus: 'ativo' | 'encerrado' | null` and
`orgAffiliationEndedOn: string | null`, in `src/lib/users/types.ts`. ⛔ The scope rule is **enforced
in the TYPE, not by memory**: `null` means *"not resolvable at this scope"* — `listOrgUsers` never
returns null (its roster predicate **is** an org affiliation), `listHospitalUsers` **always** returns
null. Both directions pinned in `src/lib/queries/org-roster-predicate.test.ts`.

## Migrations and pgTAP

Twelve migrations, `20261003003200` → `20261003004300`. Fourteen pgTAP files touched or added; the
AFF4 suite is **371–375 + 377–381**. ⚠ **`376` is a genuine numbering gap, not a missing file** —
recorded here so nobody re-derives it as a hole.

## Gate record

⛔ **Read this section for what it does NOT say as much as for what it does.** The QA review states
plainly: *"I did not re-run any authz arm, the pgTAP suite, Vitest, or the lint gates"*, and *"no gate
figure from this branch is quoted anywhere in this review."* So the figures below are the build's own,
and the ones marked **not recorded** were never written down by anyone.

| gate | recorded outcome |
| --- | --- |
| lint (all ten) · `tsc` · vitest | named as run; **no totals recorded** in the plan or the review |
| pgTAP | **no suite total recorded.** Per-file plans only: `374` plan(15) · `379` plan(43) · `381` plan(12) |
| 4 authz arms | plan: *"All four authz arms hold (`census` · `hat` · `wrapper` · `floor`)."* **No numeric results.** |
| diff-scoped door sweep | ⛔ **QA did NOT re-derive or re-run it.** The review's own §6: *"If B3's `ERROR`/`BLIND` dispositions were mis-ruled, this review would not catch it."* **No COVERED/BLIND counts exist in either document.** |
| findings baseline | untouched — blast radius `700 → 701`, `git diff --stat` = **1 insertion** |
| `e2e:prod` | ✅ **GATE GREEN, exit 0** — see the row below |

### The 2026-08-26 `e2e:prod` gate — the row PROGRESS.md points here for

**`GATE GREEN, exit 0` — 1250 passed · 0 failed · 0 infra · 2 flaky · 0 did-not-run · 21 batches;
accounted 1252/1263 (11 skipped).**

⚠ **THE TWO FLAKY TESTS, BY IDENTITY — because a count cannot tell a NEW flake from a recurring one**
(that is exactly `FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES`, and `GATE_LOGDIR` is not run-scoped, so
the raw logs that carried the names are overwritten by batch number):

- `act-role-assumption.spec.ts:157`
- `phase2-auth-shell.spec.ts:268`

**Both are EXISTING named baseline entries — they are the two members of `FUP-E2E-REPEAT-FLAKY`
([deferred-backlog.md](deferred-backlog.md)) — so this run produced ZERO new flaky names.** That
sentence, not the number `2`, is the finding.

⛔ **`0 infra` IS A POST-RERUN FIGURE. Batch 9's first attempt COLLAPSED** — `server_dead=1`,
`conn_errors=36`, **21 tests unrun** — and was superseded by a clean rerun of **67/67**. The green is
single-run *per batch*; it is **not** a first-attempt sweep of the whole suite. Recorded because a
bare `0 infra` reads as "nothing collapsed", and this is the fourth gate in a row where that reading
would have been wrong.

⚠ **A green gate is not "every control was driven":** 11 tests were **skipped**, and the gate's
`accounted N/N` counts a skip as accounted.

## ADRs

| ADR | what it decided | amends |
| --- | --- | --- |
| [0151](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md) | the whole D1–D17 program | 0097 · 0148 |
| [0152](../decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md) | PostgREST maps SQLSTATE class `P0*` → HTTP 500 (`P0001` excepted); the live defect is a **73-function class**, not a door bug | 0151 (D16a) |
| [0153](../decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) | a subset door-sweep writes to **scratch**; the committed baseline is never opened for write | 0079 (Amdt 1) |
| [0154](../decisions/0154-roster-predicate-is-the-query-filter-not-list-org-people.md) | the roster predicate is the **application query filter**, not `list_org_people` | 0151 (D10) |
| [0155](../decisions/0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) | ⛔ **PROPOSED — nothing approved, nothing to be built**; a staged sequence gated on AFF4's merge | — |
| [0156](../decisions/0156-door-sqlstate-gate-domain-is-structural.md) | the door-SQLSTATE gate's domain is a **structural property**, not a list of names | 0098 |
| [0157](../decisions/0157-dominance-grid-population-bounded-by-schema.md) | the dominance grid's population was bounded by **schema**, not by the property: 13 → 32, 45 gates. **BLIND, NOT VULNERABLE** — zero gaps before and after | 0079 · 0097 |
| [0158](../decisions/0158-hospital-directory-keeps-its-predicate.md) | the hospital directory keeps its predicate — **never fix a read by granting access** | 0154 |
| [0159](../decisions/0159-invariant-backstops-run-as-definer.md) | an invariant backstop runs as **DEFINER**; two individually-correct decisions can compose into a break | 0151 (D4) |

## What discharged here

**Ten follow-ups** — bodies, closure notes and the verbatim PROGRESS.md index lines are in
[follow-ups-archive.md](follow-ups-archive.md) § "Rotated 2026-08-26 — AFF4 Record":
`FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY` · `FUP-AFF2-CONTA` · `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` ·
`FUP-AFF2-UPDATE-PROFILE-AFFILIATION-HALF-IS-DEAD` · `FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME` ·
`FUP-MANAGE-ROUTES-HAVE-NO-ERROR-BOUNDARY` · `FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`
(= **Critical FUP C5**, which leaves § Critical FUP with it) — plus three already archived at the
pre-step (`FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE` · `FUP-OPEN-DOCUMENT-VERSION-500-ON-EVERY-RAISE` ·
`FUP-DOOR-SWEEP-RECIPE-STILL-BLIND-TO-ALTER-POLICY`).

**One bug** — `BUG-D5-REHIRE-HOSPADMIN-001`, AFF4's own regression, fixed in `89793d43` (ADR 0159) →
[bug-log-archive.md](bug-log-archive.md).

⛔ **ELEVEN were forecast, TEN discharged.** `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` stays OPEN by PO
ruling at the Record step — see § "Two documents disagree".

## Two documents disagree — resolve before quoting either

1. **`FUP-AFF2-ACTIVE-MEANS-TWO-THINGS`.** ADR 0151 § Consequences and the QA review (AC6 row 2:
   **DONE**) both say it discharges. The PO held it OPEN at the Record step on a catalog
   measurement — both `profiles` SELECT policies still return `f` for `expires_at` filtering.
   ⚠ **That measurement is also exactly what D6 RULED should be true**, so it is evidence the ruling
   shipped rather than evidence a hole survives. The item stays OPEN on the PO's call, **not** on a
   demonstrated defect.
2. **AFF4's own F0 regression.** The plan's Risks/RESUME sections still say the DatePicker branch is
   HELD and F6 unshipped; `3d588673` merged it and `1cbaa1b7` shipped F6, and the regression was
   repaired at `b953854c` (**12** sites, not the 10 first recorded). QA flagged the plan text as stale
   (review R7). ⛔ Quoting the plan's Risks section would misdirect gate attribution.

## ⭐ The lesson this build is worth remembering for

**TWELVE instruments in one build reported success while measuring nothing** — the plan calls it
*"a pattern, not twelve incidents"*: in every case the human-readable output looked right and the
honest instrument was an exit code or a direct measurement. **Two of the twelve are a different
species and are the dangerous kind — they return a CONSTANT.**

> ⭐⭐ *A constant-`0` instrument is invisible **because it is usually right**: it can only be wrong on
> the rare failing run, and "0 failures" is the most reassuring number in any gate report, so it is
> the last one anyone interrogates.*

The two constants: `tasklist /FI "IMAGENAME eq node.exe"` under Git Bash (MSYS rewrites `/FI`, stderr
is discarded, `| wc -l` prints `0` — verified against a moment with **seven** node processes), and
`grep -cE '^not ok'` over `supabase test db` output (pg_prove consumes the raw TAP stream, so **no
`not ok` line is ever printed** — this was appended to nearly every pgTAP figure reported for a day).

**The rule the plan draws from it:** *every counting instrument in a gate report must be run once
against a KNOWN FAILURE before its zero is believed.*

⚠ **The count is only trustworthy if it is complete, and #11 and #12 were both found by the author of
the instrument** — the case most likely to go unrecorded, because nobody else would ever have known.

## ⛔ Residue this Record step did NOT file

The QA review's §5 lists **~16 obligations** and the plan's *"Follow-ups DISCOVERED during the build"*
section lists **~20 more**. **They were not converted into `FUP-*` index lines at this Record step.**
That is a known, stated gap, not an omission being hidden: several of the review's items say in their
own words *"it needs a FUP index line and a body at Record."*

Highest-signal members, so they are findable by name rather than only by reading two large documents —
**this list is a pointer, not the register**:

- the **actor-attribution** residue (1 of 50 `trg_audit_*` triggers carries `actor_user_id`; stated
  only in a commit message and a migration header) and the **audit-trigger CLASS** gap (the instance
  was fixed, the class was not);
- **D14-GAP** — the affiliation dates are never rendered on `/conta`, *"not logged anywhere"*;
- **R13** — `e2e/aff4-registration-dates.spec.ts`'s header has asserted a falsehood since `bcf62723`;
  **R14** — the missing D13 E2E arm;
- the **hospital directory keeps an org-offboarded person with an expired commission seat** — ⛔ *not*
  an authorization leak, a stale roster; **unscheduled, needs a PO go** (this one **is** registered, as
  `FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER`);
- **12 DatePicker renders sit outside F0's measured mechanism** (of 38), one with **no name-bearing
  attribute at all**;
- the **`claims_for` vacuity class has no measured denominator** — 41 two-arg call sites reported
  against **2449** total `claims_for(` occurrences; ⛔ do **not** close it by making `claims_for` raise
  (built and reverted);
- **`supabase/tests/00_setup.sql` COMMITS OVER a migration's function definition**, so migration
  `20260918002000`'s `claims_for` is *"never in force during any test run"*;
- **five date fields have ZERO E2E coverage**, two of them AFF4 surfaces (`affiliations-panel`
  "Data de início"; `register-person-wizard` Nascimento / Início-do-vínculo);
- **`GATE_LOGDIR` is not run-scoped**, which is why this phase's flake identities had to be captured
  by hand above;
- **per-tenant timezone** — the `America/Sao_Paulo` fix pins one zone app-wide and Brazil spans four.

## Durable facts promoted out of this build

Two facts outlive AFF4 and were written to [`docs/backend-state.md`](../backend-state.md) rather than
left here:

1. **A `DEFERRABLE INITIALLY DEFERRED` constraint is invisible to any test that rolls back** — which
   is **every pgTAP suite in this repo**. It bit in `380_org_affiliation_residual_coverage.sql` §6:
   `backend` wrote the obvious arm ("insert an orphan, expect a refusal"), watched the insert
   **succeed**, and the test **passed while proving nothing**. Remedy is one statement:
   `set constraints all immediate;` after the insert and before the assertion.
2. **An invariant backstop must run as DEFINER** — a backstop that reads under caller RLS composes
   with a deliberately narrow policy into a false-positive that fails the whole transaction
   (ADR 0159).
