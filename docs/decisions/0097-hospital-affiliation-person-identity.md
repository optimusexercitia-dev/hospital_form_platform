# ADR 0097 — Hospital affiliation, person identity (CPF) and the org-scoped people directory

**Status:** Proposed (awaiting human approval; no build started) · **Date:** 2026-08-05
**Inputs:** PO scenario of 2026-08-05 (a professional hired by a second hospital of the
same organization) and the design interview that followed; three catalog-verified
explorations of the live local stack (registration flow, `memberships`/`profiles` RLS,
branch + ADR history). Plan:
[docs/plans/hospital-affiliation-person-identity.md](../plans/hospital-affiliation-person-identity.md).
Amends ADR [0048](./0048-user-registration-identity.md) (D1, D7, D9); reconciles ADR
[0051](./0051-hospital-admin-tier-and-hospital-audit-tier.md) (D1, D7); complements ADR
[0041](./0041-multi-tenancy-organizations-hospitals.md), [0064](./0064-case-subject-generalization-participants.md)
/ [0065](./0065-pre-pilot-foundations-conventions.md) (professional identity), and
[0094](./0094-membership-hardening-and-technical-director.md) (the membership kernel).

## Context

**The scenario.** Dr. John is registered at *Hospital Regional* by that hospital's admin.
Months later *Hospital Municipal* — same organization — hires him and needs him on a
committee. Municipal's admin opens the only affordance they have, "Registrar pessoa", and
hits a wall: `registerUser` pre-checks `profiles.email` and blocks with
*"Este e-mail já está cadastrado na plataforma."* ([src/lib/users/actions.ts:364](../../src/lib/users/actions.ts)).
The first customer is a five-hospital organization with ~150 professionals, a small but
real fraction of whom work at more than one of its hospitals.

**The premise was wrong.** The working assumption — "we decided hospital admins only see
users of their own hospital" — is not a decision of record. ADR 0048 D1 says the opposite:
*"The user directory is org-scoped (`home_organization_id`)."* D7 goes further —
*"Hospital = descriptive only, not an access boundary … Nullable, never gated on"* — and
0048 explicitly **rejected** the reviewed similar platform's *"hospital-as-access-boundary
spine"*. ADR 0051 D1 then made `hospital_admin` a real hospital-scoped administrator. The
two ADRs contradict each other, and the cross-hospital professional is exactly where the
contradiction surfaces. This ADR resolves it.

**Catalog findings (all verified against the live local stack, 2026-08-05; none file-derived):**

1. **The org-wide lookup already ships, undeclared.** `list_addable_commission_members`
   is DEFINER, granted to `authenticated`, gated `is_staff_admin_of OR is_commission_admin_of`
   — and `app.is_commission_admin_of_for` carries a hospital leg, so a `hospital_admin`
   passes. Its body filters `profiles` on `home_organization_id = <the commission's org>`.
   It therefore **already discloses the whole organization's active non-vendor roster to
   any hospital admin**, wider than the `profiles` table policy permits. The commission
   member picker consequently *already works* for Dr. John; only the register-person
   screen and the hospital roster do not.
2. **`profiles.home_hospital_id` is inert.** Populated on **1 of 30** seeded profiles. Its
   column comment says *"Descriptive HR unit only — hospital is NOT an access boundary
   here"* while `profiles_admin_select` / `profiles_select_self_or_admin` use it as one.
   A hospital admin's visibility today comes almost entirely from the commission-admin leg.
3. **`memberships` SELECT is strictly wider than `profiles` SELECT for a hospital admin.**
   Measured: a hospital_admin sees 21/34 membership rows but only 13/30 profiles, leaving
   **6 membership rows whose `principal_id` cannot be resolved** — their own co-`hospital_admin`,
   their hospital's `technical_director` and `technical_director_deputy`, all
   `nsp_coordinator`s and `pqs_member`s. A roster joining the two renders blank rows.
4. **No row expresses "employed at this hospital."** `memberships_scope_shape` is a
   per-role switch; commission-tier rows (`staff`, `staff_admin`) carry `organization_id
   IS NULL` and no `hospital_id`. Hospital affiliation is only ever *implied* by a
   commission membership or a hospital-tier role.
5. **`hospital_employee_id` (matrícula) is singular on `profiles`** — but a professional
   working at two hospitals holds a different matrícula at each.
6. **CPF is captured nowhere.** Council registration is modelled 1→N in
   `professional_credentials`, whose `UNIQUE (issuing_country, issuing_state,
   issuing_authority, registration_number)` carries **no `organization_id`** and is
   therefore a cross-tenant global constraint acting as an accidental identity key.
7. **`professional_profiles` is org-scoped storage but case-scoped readability**
   (`can_read_professional_profile` → `professional_participants` → `case_participants` →
   `can_read_case`), and per FUP-ETH-1 its only writer is `create_professional_profile`.
   In practice a row exists because someone is the subject of an ethics case.
8. **A single principal may already hold `org_admin` + `hospital_admin` of the same org.**
   Probed live: both rows insert (`memberships_grant_uq` keys on `role`), both predicates
   return true. **But no product path can seat it** — `app.grant_role_impl` denies
   `p_user = p_actor` on every path including the service path, and its hospital arm
   requires `is_org_admin_of_for(org)` only. A single-hospital tenant with one
   administrator is unseatable.
9. **ADR 0051 D1's "org_admin dominates hospital_admin" is false today.** A census of
   gates naming `is_hospital_admin_of` without an `is_org_admin_of` arm returned three;
   read individually, one is a false positive (`list_approver_candidates` reaches
   org_admin via `is_commission_admin_of`) and **two are real**:
   `set_standard_ownership` (`if not app.is_hospital_admin_of(p_hospital) then raise 42501`)
   and `standard_ownerships_select` (`is_hospital_member_of OR is_hospital_admin_of`).
   `app.is_org_level_admin_within` separately admits `hospital_admin`/`nsp_org_admin` and
   excludes `org_admin` outright. This is BUG-AUTHZ-001's shape, recurring because
   dominance is asserted in prose and tested nowhere.

## Decisions

### Affiliation

1. **A new `public.hospital_affiliations` table** — `(principal_id, hospital_id,
   organization_id, hospital_employee_id, started_on, ended_on, …)` — records that a
   person works at a hospital. Rejected alternatives: a new `memberships` role (a
   permanent authorization tax on every future gate for a descriptive fact), and deriving
   affiliation purely from commission membership (leaves a registered-but-uncommitteed
   person invisible — the `novato.pendente` hole).
2. **Affiliation is a VISIBILITY input, never a CAPABILITY input.** It answers "whom may
   this administrator see"; it grants the affiliated person nothing. This is the clean
   split `home_hospital_id`'s RLS leg was reaching for before it went inert.
   **This amends ADR 0048 D7** — hospital *is* now an access boundary for reads.
3. **`profiles.home_hospital_id` and `profiles.hospital_employee_id` are DROPPED.**
   Matrícula moves onto the affiliation row, where it belongs: it is a property of the
   employment, not of the person. `home_organization_id` is untouched — it remains the
   tenancy anchor (ADR 0048 D6) and the filter of every org-scoped read.
4. **Leaving a hospital is a soft `ended_on`, never a DELETE** (Rule 11; the 20-year
   retention regime of ADR 0035). No `UNIQUE (principal_id, hospital_id)` — historical
   rows are legitimate; a partial unique `(principal_id, hospital_id) WHERE ended_on IS
   NULL` enforces one *active* affiliation.
5. **Ending an affiliation is REFUSED while the person holds active commission
   memberships under that hospital**, with the blocking memberships enumerated to the
   caller. A governance platform must not revoke committee seats as a side effect of an
   HR action.

### Visibility

6. **`profiles` SELECT is widened**, with two legs: an affiliation leg (the principal has
   an active affiliation to a hospital I administer) and a membership leg (the principal
   holds any membership under a hospital I administer). The second closes finding 3
   independently of this feature — a hospital admin who cannot render their own technical
   director's name is a live defect. This is a deliberate RLS widening and carries a
   diff-scoped `ARM=policy` run plus keystones with **both** ALLOW and DENY arms, the DENY
   arm being a sibling hospital's admin.

### Identity

7. **`profiles.cpf` is the person key.** Column nullable (a documented escape for foreign
   professionals without a later schema change), **required at the action layer**, check
   digits validated, stored digits-only, **unique platform-wide**. Global uniqueness
   creates an enumeration surface *identical to the one `profiles_email_key` already
   creates* — recorded here explicitly rather than discovered in a later audit.
   Rationale over email: at 150 people across five hospitals, homonyms ("João Silva") are
   the realistic collision, and CPF is how HR already identifies staff. The first
   customer uses personal emails, so email churn is **not** the driving argument.
8. **Within the caller's own organization a match is never an error** — it is the
   feature. `registerUser` keeps its hard collision block unchanged as the backstop for
   the genuine cross-org case and for the race; the register screen front-loads the
   lookup so the block is rarely reached. The CPF collision message reuses the existing
   email-collision copy verbatim in form ("já cadastrado na plataforma"), naming neither
   the holder nor their tenant. **This amends ADR 0048 D9** — the block stands, but only
   after an in-org lookup has had its chance.
9. **`professional_credentials`' cross-tenant global UNIQUE is KEPT.** Scoping it per-org
   would let two tenants assert the same council registration belongs to different people;
   dropping it removes a real integrity guard. Its violation is caught at the action layer
   and surfaced in pt-BR without naming the holder or their tenant, closing a standing
   violation of the "no raw Postgres errors in the UI" convention.

### The directory

10. **The org-scoped people directory is RATIFIED, not invented.** A new DEFINER RPC
    `list_org_people(p_org_id, p_search)` gated `app.is_org_admin_of(org) OR
    app.is_org_level_admin_within(org)` — the second helper already exists, already
    treats `hospital_admin` as an org-level actor, and is used in **no policy today**.
    Doing nothing would have ratified finding 1 silently; this makes it a stated decision
    with an ADR and door coverage. **This amends ADR 0048 D1** — the org-scoped directory
    is reachable by hospital admins, which is what the product already does.
11. **Payload:** name, email, professional category, and **same-org affiliations** (one
    organization is one legal controller, and without affiliations an admin cannot tell
    two homonyms apart). Nothing beyond the org. **CPF is a search input only and is never
    returned to the client** — `list_org_people` takes it as an exact-match parameter.
    Partial CPF matching is refused outright: it is an enumeration oracle over national
    IDs and no workflow needs it. Name and email may match partially.
12. **One identifier-first registration flow**, not two buttons. The first field resolves
    the identifier, then branches: not found → the current create form; found in my org,
    unaffiliated → offer to affiliate; found and already affiliated → link to their page;
    global collision outside my org → the existing block. Forcing the admin to know in
    advance which case they are in is the original defect.

### Doors and boundaries

13. **Affiliation mutates through a DEFINER door** (`affiliate_person` / `end_affiliation`),
    `authenticated`-executable, no table DML grant — consistent with the `memberships`
    posture, because a write that grants read access to a person's profile is an
    authorization mutation regardless of its HR clothing. The door hard-fails when
    `profiles.home_organization_id ≠ the hospital's organization` — the tenant check
    `resolveOrInviteUser` is **missing today** ([src/lib/members/invite.ts:50](../../src/lib/members/invite.ts)),
    which is fixed in the same pass. **Self-affiliation is permitted** (unlike a role
    grant it confers no capability, and an administrator absent from their own roster is a
    bug); the door comments say so, so a later reader does not "fix" it.
14. **Person-level fields are `org_admin`-only.** Name, CPF, professional category and
    credentials are facts about the person, not about a hospital; two hospital admins
    editing them is a silent cross-hospital write. A hospital admin edits only their own
    affiliation row and their own hospital's committee memberships. Removal by a hospital
    admin is strictly scoped to their own hospital's subtree; **account deactivation is
    unreachable by hospital admins** — `app.is_active` is folded into every membership
    predicate, so account deactivation is a platform-wide kill switch, and one hospital's
    offboarding must never end a professional's access at another.

### Professional identity

15. **`professional_profiles` gains `cpf`; linking is DEFERRED and only ever runs from
    inside a case.** A registration-side match would disclose to a hospital admin with no
    case access that a doctor is or was the subject of an ethics review (finding 7) — a
    worse leak than the one being fixed. A blind server-side link is also rejected: a
    silent join between an account and a case subject with no audit-visible actor is what
    Rule 11 exists to prevent. The column lands now because it is free during the reset
    window; the linking *behaviour* waits for FUP-ETH-1 to unblock the seating path
    (`participants` and `professional_participants` have no writer at all today).
    **This is deferred, not delivered.**

### Single-hospital tenants

16. **No data-model change is needed** — a principal already holds `org_admin` +
    `hospital_admin` of one org (finding 8, probed live). A combined `solo_admin` role is
    **rejected**: it widens `memberships_role_check`, adds a `memberships_scope_shape`
    arm, reds the ADR-0094 completeness grid until it has grant *and* revoke arms, and
    adds a tenth OR-term every future gate must remember — a permanent authorization tax
    for a UI convenience the model already handles.
17. **Provisioning seats both roles when the organization has exactly one hospital**, via
    the service path with `p_actor` = the provisioning platform admin, which sidesteps the
    self-grant guard **without weakening it**. Multi-hospital orgs keep the explicit
    appointment step. Relaxing the self-grant guard for `org_admin → hospital_admin` was
    considered and rejected: the "you are granting yourself a subset" premise is exactly
    what finding 9 shows to be untrue.
18. **Dominance becomes an enforced invariant.** A pgTAP grid — mechanically the shape of
    the ADR-0094 role-completeness grid — reads gates from `pg_policies` + `prosrc` and
    asserts every gate admitting `is_hospital_admin_of` also admits `is_org_admin_of`,
    with an explicit allowlist for deliberate exceptions. The two live gaps
    (`set_standard_ownership`, `standard_ownerships_select`) are fixed in this workstream,
    because shipping a new grid red is worse than not shipping it.

### Placement

19. **All of it lands pre-pilot, as the named workstream AFF** (the numbered track is the
    accreditation roadmap; a tenancy fix does not belong in its numbering). The *feature*
    is not urgent — the customer has a handful of multi-hospital professionals. The
    *schema* is: a new table, two dropped columns, a new unique column, a widened policy
    and a new door are free while `supabase db reset` is free, and materially more
    expensive the day after the pilot's remote `db push`. A split (behaviour pre-pilot,
    schema post-pilot) is the worst option — it ships the widened policy before the
    affiliation table that feeds it exists, so the policy leg is built twice.

## Consequences

- **`home_hospital_id`'s removal is a multi-file refactor**, not a column drop: it appears
  in two `profiles` policies, in `registerUser`'s hospital-admin arm, in
  `updateUserProfile`'s validation, and in the `?hospital=` deep-link plumbing of ADR 0051
  D7. Each site becomes an affiliation read.
- **The register screen stops being a create-only surface.** "Registrar pessoa" keeps its
  label but resolves before it creates, which is the behavioural core of this ADR.
- **This workstream ratifies an existing over-disclosure.** Finding 1 is live today with
  no door coverage; after this ADR it is declared, gated by a named predicate, and swept.
  Reviewers comparing `pg_policies` against this ADR will find the DEFINER doors wider
  than the table policies **by design** — ADR 0078 A28 / 0079's standing point that
  `prosecdef` belongs beside `pg_policies` applies directly.
- **Cross-org identity remains unreachable by design and reachable in fact.** One account
  spans orgs via memberships (`multi@test.local` is seeded that way) while
  `home_organization_id` anchors the person to one. This ADR does not change that; it only
  declares that the org-scoped lookup never crosses the anchor.
- **The first customer's numbers argue against urgency and for scope discipline.** No bulk
  import is built. If a later customer needs one, it must be CPF-keyed match-or-create,
  and decision 7 is what makes that possible.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Hospital-scoped user directory (the assumed status quo) | Never a decision of record; contradicts ADR 0048 D1; and the product already does the opposite (finding 1). |
| A hospital-tier `memberships` role for affiliation | Affiliation is descriptive, not authorization. Costs a role-check widening, a scope-shape arm, grant + revoke arms, and the completeness grid. |
| Affiliation as purely descriptive, feeding no RLS | Leaves a registered-but-uncommitteed person invisible to their own hospital's admin — builds the table without fixing the bug. |
| Email as the person key | Homonyms are the realistic collision at this scale; CPF is HR's own key. |
| Per-org CPF uniqueness | Permits two tenants to assert contradictory identity for one human; buys nothing, since email is already globally unique. |
| Registration-side `professional_profiles` match | Discloses ethics-case subjecthood to admins with no case access. |
| Blind server-side professional link | A silent account↔case-subject join with no audit-visible actor. |
| A combined `solo_admin` role | Permanent authorization tax for a UI convenience the model already supports. |
| Relaxing the self-grant guard for `org_admin → hospital_admin` | Punches a hole in a keystone deliberately inlined to survive the service path, on a dominance premise finding 9 disproves. |
| Narrowing `memberships` SELECT instead of widening `profiles` | Would hide a hospital's own technical director from its own administrator. |
