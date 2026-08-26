# Org affiliation & per-hospital staff data — data-model analysis

**Status: ANALYSIS — DECIDED 2026-08-25.** Written in response to a PO request to
evaluate four suggested data-model changes for the user-management surface. **The
decisions were PO-ruled the same day after a three-round grilling and are recorded in
ADR [0151](../decisions/0151-aff4-organization-affiliation-staff-data-voided-tense.md)
(program AFF4); implementation plan:
[aff4-org-affiliation.md](./aff4-org-affiliation.md).** Where this analysis and the ADR
differ (the grilling refined several §9 recommendations — void authority, ride-along
scope), **the ADR wins**; this document remains the record of the reasoning and the
rejected alternatives.

Schema facts below were verified against the **live local catalog** on 2026-08-25
(pg_policies, information_schema grants, pg_proc/prosecdef, triggers) — per the standing
rule, re-verify against the catalog before building; never against this text or migration
files. Decision history is cited by ADR number.

---

## 1. The four proposals under review

1. Users keep a **single `profiles` row** even when working at multiple hospitals.
2. Keep `hospital_affiliations`; add a **`hospital_staff_profiles`** table
   (`employee_number`, `job_title`, `local_email`, `local_phone`, …) so each hospital
   maintains its own editable data for a user.
3. Create an **`organization_affiliations`** table.
4. Review **`professional_credentials`** and **`professional_profiles`**.

Verdicts up front: **(1) keep — already the decided model. (2) right need, wrong shape —
extend `hospital_affiliations` instead of adding a parallel table. (3) yes — this is the
actual fix for org-level offboarding, with the specific design in §4. (4)
`professional_profiles` must stay out of user management entirely;
`professional_credentials` stays person-level with two hygiene fixes.** Plus one addition
the proposals don't mention but the program should carry: the **voided tense** for
affiliation rows, which discharges Critical FUP C5
(`FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`) and prevents its org-level twin
from being born with the new table (§5).

---

## 2. Ground truth (catalog-verified 2026-08-25)

- **Person ↔ org edge today is `profiles.home_organization_id` and nothing else.**
  Single-valued, FK `ON DELETE RESTRICT`, and enforced **NOT NULL for every non-admin
  profile** by the deferred constraint trigger `profiles_tenant_has_org_trg`. No
  lifecycle, no history, no "ended" state. The org roster door `list_org_people` filters
  on it (ADR 0097 D10).
- **`hospital_affiliations` already is a per-hospital staff record**: `(principal_id,
  organization_id, hospital_id, hospital_employee_id [matrícula], started_on, ended_on,
  created_by, ended_by)`, partial-unique active row per (person, hospital), **no-delete
  guard** (`guard_affiliation_no_delete_trg`), audit trigger, and a full actor-kernel
  door triple each for affiliate / end / update (`app.*_impl` owner-only →
  `public.*` auth.uid() wrapper → `public.*_for` service-role twin — ADR 0098 §W2.1).
  `authenticated` holds SELECT only; the SELECT policy admits self + `org_admin` of the
  org + `hospital_admin` of the hospital (+ the via-membership hospital-admin leg).
- **Affiliation is a visibility input, never a capability input** (ADR 0097 D2);
  `memberships` is the sole role store (ADR 0094/0075). Person-level admin authority is
  footprint-bound and split INTERSECTION (fields, credentials) vs SUBSET (CPF, lifecycle)
  — TypeScript-enforced, no RLS backstop possible on service-role paths (ADR 0133).
- **Read visibility is ever-held, write authority present-tense** since AFF3 (ADR 0148)
  — ending an affiliation no longer revokes the acting admin's read of the record.
- **Deactivation is a platform-wide kill switch** (`app.is_active` folded into every
  membership predicate — ADR 0048 D4); local offboarding is `end_affiliation`, which
  refuses while the person holds active memberships of any tier at that hospital
  (ADR 0097 D5).
- **`profiles` is on column-list grants**; `cpf`, `date_of_birth`, `phone` are excluded
  from every `authenticated` grant — any new `profiles` column needs its own grant or
  reads 42501 (pgTAP 301 §0.10).
- **`professional_profiles`** is the Class-2, org-scoped, possibly account-less
  case-subject registry (nullable `user_id`, `link_state` machinery, redaction +
  retention pins, audited read door `get_case_professional`, column-list grants with
  `cpf`/`user_id`/retention columns revoked). **`professional_credentials`** is the
  person's council registrations with a deliberate **cross-tenant** UNIQUE
  (ADR 0097 D9). No column named `job_title`/`cargo` exists anywhere in `public`; the
  closest facts are `profiles.professional_category_id` (controlled lookup; gates
  `technical_director`) and `hospital_affiliations.hospital_employee_id`.
- Scale: 36 profiles, 5 affiliations, 43 memberships locally — backfills are trivial.

**Why org-level offboarding is unsolved:** it is not un-built, it is *unrepresentable*.
After ending every hospital affiliation and revoking every membership, the person still
matches the roster predicate (`home_organization_id`) forever; the column cannot be
nulled (tenant trigger raises) and no org-transfer path exists in any ADR. Deactivation
is the wrong tool by design — it is platform-wide, and cross-org identity is "reachable
in fact, unreachable by design" (ADR 0097 Consequences). There is nothing whose lifecycle
an org admin could end.

---

## 3. Proposal 2 — per-hospital staff data: extend `hospital_affiliations`, don't add a table

The need is real (each hospital maintains its own editable employment data), but a
parallel `hospital_staff_profiles` keyed on the same (person, hospital) pair is the wrong
shape:

- **It already exists in all but name.** Matrícula, spell dates, created/ended actors,
  no-delete guard, audit trigger, doors, RLS, E2E specs — all present on
  `hospital_affiliations`. A second table duplicates that entire surface (RLS, grants,
  ARM census entries, dominance-grid rows, pgTAP) for zero new semantics.
- **Two tables on one pair drift.** Which one says "still employed"? A profile row with
  no lifecycle contradicts an affiliation that ended; a rehire (new affiliation spell)
  either shares stale profile data or needs its own — at which point the table has grown
  a lifecycle and *is* `hospital_affiliations` again. Employment attributes belong to the
  **spell**: on rehire, the new affiliation row carries the new matrícula/cargo, and
  history stays correct per spell (Rule 11, 20-yr retention).
- ADR 0065 §4 records the platform's explicit aversion to another identity store.

**Recommended change instead** — add to `hospital_affiliations`:

| column | type | notes |
|---|---|---|
| `job_title` | `text` | cargo at this hospital, free text (UI pt-BR). Distinct from `profiles.professional_category_id`, which stays person-level (it gates `technical_director`). |
| `work_email` | `citext` | hospital-issued contact. Named `work_*`, not `local_*`, to contrast with `profiles.phone`/`email` (personal, column-locked). |
| `work_phone` | `text` | idem. |

- `employee_number` is already `hospital_employee_id` — no change.
- **Reads:** `hospital_affiliations` has a table-level SELECT grant, so new columns are
  automatically visible to the existing policy audience (self + org admin + that
  hospital's admins). That is the right audience for employment data — but it must be
  *stated as decided*, not inherited by accident (PO decision 3, §7).
- **Writes:** extend `affiliate_person_impl` / `update_affiliation_impl` (and their
  wrappers) — **no new doors, no new footprint semantics.** These fields are
  hospital-scoped, so authority is the doors' existing "org_admin of the org OR
  hospital_admin of *that* hospital" — strictly tighter than INTERSECTION, sidestepping
  the AFF2 capability-classification question entirely. This is the "each hospital edits
  its own data" requirement satisfied by the ownership split already decided in
  ADR 0133/D14: hospital admins own employment facts, org admins own identity.
- If HR appetite grows later (department, shift, cost center), a 1:1
  `hospital_affiliation_details` can be split off then. Not now.

---

## 4. Proposal 3 — `organization_affiliations`: yes, and here is the shape

This is the substantive fix. Org-level belonging becomes a **row with a lifecycle**,
mirroring the hospital tier exactly (same idioms, same guards, same tense rules):

```
organization_affiliations (
  id uuid pk,
  principal_id uuid NOT NULL → profiles ON DELETE CASCADE,
  organization_id uuid NOT NULL → organizations ON DELETE CASCADE,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date NULL,          -- soft end; CHECK ended_on >= started_on
  created_by / created_at / ended_by,
  voided_at / voided_by / void_reason      -- §5, if accepted
)
-- UNIQUE (principal_id, organization_id) WHERE ended_on IS NULL AND voided_at IS NULL
-- no-delete guard trigger; audit trigger (affiliation.org_* verbs)
```

Doors (actor-kernel triple each, entering `ARM=census` in the same change):

- **`affiliate_person_to_org`** — mostly internal: called by registration and backfill.
  Cross-org creation **stays blocked** exactly as `affiliate_person` blocks cross-tenant
  today (conflated with not-found — no CPF existence oracle for other orgs). The table
  makes the flagged cross-org-identity question *solvable later*; it does not solve it.
- **`end_org_affiliation`** — the org offboarding action. **Refuses** (mirroring
  `end_affiliation`, ADR 0097 D5) while the person holds, in that org: any active
  hospital affiliation, or any active/unexpired membership at any tier (org-tier rows,
  hospital-tier rows of the org's hospitals, commission-tier via commission → hospital →
  org). Blockers returned as `detail`, so the UI can render a guided **"Desligar da
  organização"** wizard: remove seats → end hospital affiliations → end org affiliation.
  No cascade — each step is its own audited, refusable action, which is the platform's
  existing composition pattern and keeps the technical-director-orphaning class of bug
  impossible by construction.
- **`update_org_affiliation`** — `started_on` corrections.
- **Authority: `org_admin` of that org only.** No hospital_admin arm (above their
  scope); no platform_admin arm (mirrors `affiliate_person`, which deliberately has
  none). Dominance-grid and census entries added with the doors.

**Containment invariant:** an active hospital affiliation requires an active org
affiliation in the same org. Enforced in the doors (`affiliate_person_impl` checks the
parent; `end_org_affiliation_impl` refuses on active children) plus a deferred
constraint-trigger backstop in the style of `profiles_tenant_has_org_trg`. (A structural
`org_affiliation_id` FK on `hospital_affiliations` was considered — it adds provenance
but not the temporal invariant, since soft-end can't cascade through an FK; the doors
must refuse either way. Optional, not recommended for v1.)

**`home_organization_id`: demote, don't drop.** Two phases, deliberately decoupled:

- **Phase 1 (this program):** backfill one active `organization_affiliations` row per
  non-admin profile from `home_organization_id` (`started_on` ≈ profile `created_at`,
  documented as an approximation — the same honesty owed by
  `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE`). Registration creates the org affiliation
  alongside the hospital one. **`list_org_people` switches its roster predicate to org
  affiliations**: ever-held rows visible (the AFF3 tense — the offboarding actor must
  not lose sight of the record they just ended), default-filtered to active with an
  explicit status chip, so "empty never means no-permission" and "ended" never reads as
  "gone". `home_organization_id` remains the registration/tenancy anchor and **every
  existing RLS leg stays untouched**.
- **Phase 2 (separate decision, later):** migrate the `profiles` /
  `professional_credentials` policy legs and the tenant trigger off
  `home_organization_id`; only then consider dropping it. Rationale for the split: those
  legs are the entire person-read surface — coupling that blast radius to the
  offboarding fix is how a two-week program becomes a two-month one.

**Multi-org, named now, not enabled now:** the table makes a person-in-two-orgs
representable (already true in fact via memberships — `multi@test.local`). The day
cross-org affiliation is enabled, **account lifecycle must acquire the org-level SUBSET
bound** (an org_admin may deactivate only a person whose entire org footprint is inside
their org) — the AFF2 lesson applied one tier up. Recording this in the ADR now costs a
sentence; rediscovering it later costs an incident.

---

## 5. The voided tense — close C5 here, and don't mint its twin

Critical FUP **C5** (`FUP-AFF3-NO-REVOCATION-FOR-A-MIS-ENTERED-AFFILIATION`): since AFF3
made read visibility ever-held and `hospital_affiliations` has no delete path, a row
created against the **wrong hospital** grants that hospital's admins permanent read of a
person who never worked there — `end_affiliation` no longer revokes anything. The PO-owed
decision (real DELETE vs a third tense) is already on the tracker, triggered "before the
first real hospital roster is loaded".

This program touches affiliation lifecycle anyway, and a new org-level affiliation table
would inherit the identical defect on day one. Decide it **once, for both tables**:

- `voided_at timestamptz`, `voided_by uuid`, `void_reason text NOT NULL` (when voided).
- **Void ≠ end.** End says "this was true and stopped"; void says "this was never true".
  Voided rows drop out of **every** read-visibility leg (the ever-held legs gain
  `voided_at IS NULL`) and out of the active-unique index predicate, but stay in the
  table and the audit trail (no hard DELETE — the no-delete guards stand).
- Doors `void_affiliation` / `void_org_affiliation`: `org_admin`-only (a void rewrites
  the visibility record, which is above a hospital admin's authority over its own
  mistake), reason required, audited.

If the PO prefers to keep C5 a separate program, `organization_affiliations` should still
ship with the void columns dormant — retrofitting a tense onto policies is the expensive
direction.

---

## 6. Proposal 4 — `professional_credentials` / `professional_profiles`

- **`professional_profiles`: keep entirely out of user management.** It is the Class-2
  case-subject registry: org-scoped, possibly account-less (`user_id` nullable,
  `link_state` machinery), carrying redaction + retention-pin logic and an audited read
  door. Merging it toward `profiles`/staff data would break the account-less respondent
  use case, drag Class-2 audit obligations onto ordinary user reads, and tangle the
  redaction freeze with HR edits. The only legitimate seam — CPF linking — is
  FUP-ETH-1 and stays deferred for the disclosure reasons recorded there (a
  registration-side match would leak "this doctor is an ethics subject").
- **`professional_credentials`: stays person-level.** A council registration is a fact
  about the person, not the employment; the cross-tenant UNIQUE is deliberate (0097 D9 —
  per-org scoping would let two tenants claim the same registration for different
  people). Do **not** fold it under per-hospital staff data. Three hygiene items ride
  along naturally:
  1. Close the read half of `FUP-AFF2-ACTIVE-MEANS-TWO-THINGS` while these policies are
     open (the membership legs of the `profiles`/`professional_credentials` SELECT
     policies never filter `expires_at`).
  2. The directory's missing registro search leg
     (`FUP-AFF2-DIRECTORY-SEARCH-HAS-NO-REGISTRO-LEG`) is a natural ride-along but not
     free: per its register body the live search matches name/e-mail at **two** sites in
     `org-users.ts` (org- vs hospital-admin semantics split per D14), and the fix is a
     1→N **join filter** against `professional_credentials` respecting D13's widened
     SELECT — a decision is owed, not just a query edit.
  3. Grant-posture note (not urgent): `authenticated` holds full table-level DML on
     `professional_credentials` with RLS default-deny doing the blocking — functional,
     but inconsistent with the column-list posture of its siblings.

---

## 7. Alternatives considered and rejected

- **Single multi-scope `affiliations` table** (org + hospital rows, mirroring
  `memberships`): symmetry is attractive, but the memberships scope-shape is itself a
  recurring complexity source (the `scope_shape` CHECK, COALESCE policy legs), the
  affiliation domain has a real containment hierarchy (org ⊃ hospital) that one table
  obscures behind CHECKs, and `hospital_affiliations` already exists with doors, guards,
  audit, pgTAP and E2E — rebuilding the whole AFF surface for aesthetics churns
  everything and buys nothing.
- **Operational-only offboarding** (a composite action over existing rows, no new
  table): fails structurally — after ending everything, the person still matches the
  roster predicate forever (§2), and `home_organization_id` can be neither nulled nor
  reassigned.
- **`hospital_staff_profiles` as proposed**: §3 — parallel-table drift, rehire
  ambiguity, duplicated security surface.

## 8. Build obligations (when approved — so known failure classes aren't repeated)

- Every new door: actor-kernel triple; `ARM=census` domain membership **in the same
  change** (a brand-new gate passes `ARM=policy` vacuously — ADR 0079 Amdt 3);
  dominance-grid rows for any gate admitting `hospital_admin`; diff-scoped door sweep at
  the gate.
- TS-only authority bounds get Vitest keystones (service-role paths have no RLS
  backstop, and cannot — ADR 0098 §W3.2).
- `app.audit_write` records `actor_id = NULL` on service paths — thread the actor
  through metadata as `log_cpf_probe_for` does; don't assume the trigger names them.
- No new `profiles` columns anywhere in this design — deliberately, to avoid the
  column-grant tax (every new `profiles` column needs its own grant or reads 42501).
- Migration hygiene: no top-level `SET LOCAL`; backfill guard-wrapped; ADR number taken
  from `INDEX.md`; migration/ADR numbering coordinated if any parallel branch is open
  (the 0144–0146 collision).
- E2E: registration incl. the org affiliation, the guided offboarding wizard, the void
  path — with real assertions (`FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY` is the cautionary
  tale for lifecycle specs).
- `FUP-AFF2-CONTA` synergy: the `/conta` self-view is the natural vehicle for the data
  subject reading their own affiliations (the self leg already exists in the policy) —
  worth bundling.

## 9. Open PO decisions

1. **Voided tense in scope now** (recommended — discharges C5 and spares the new table
   the same defect) or a separate program with dormant columns?
2. **Roster tense:** ended people visible behind a filter with a status chip
   (recommended, AFF3-consistent) vs hidden entirely?
3. **Visibility of `job_title` / `work_email` / `work_phone`:** the affiliation-policy
   audience — self + org admin + that hospital's admins (recommended) — or wider
   (colleague-visible)?
4. Add `department` (setor) alongside `job_title` now, or wait for demand?
5. **Phase 2** (migrating RLS legs off `home_organization_id`): commit to it now as a
   named follow-on, or leave as a flagged option?
6. **Cross-org affiliation stays blocked** (recommended; no CPF oracle) — confirm.
