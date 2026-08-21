# ADR 0133 — AFF2: affiliation-scoped administration, mandatory-CPF registration & the user-management redesign

> ⚠ **Renumbered 0129 → 0133 (2026-08-21).** Authored as 0129 on a branch while main's
> DSR track independently allocated 0129
> ([0129-meeting-child-lock-disposal-flag](./0129-meeting-child-lock-disposal-flag.md),
> merged + pushed + cited across PROGRESS.md, ADR 0130 and migration history — that
> claim to the number wins). Any external note citing "ADR 0129 (AFF2)" means this file.

**Status:** Accepted (PO-approved 2026-08-20 via a two-round grilling interview; build
not started) · **Date:** 2026-08-20 · **Feature:** the named workstream **AFF2** —
(1) hospital admins gain person-level and account-lifecycle authority over people whose
entire hospital footprint they administer; (2) registration becomes wizard-shaped with
CPF mandatory in the UI and the quick-invite escape hatch removed; (3) the three
user-management screens are rebuilt to the "Gestão de Usuários" design handoff
(`docs/design/temp/user_management_redesign/`, option 1a directory + profile, 1b wizard).
Plan: [docs/plans/aff2-user-management.md](../plans/aff2-user-management.md).
**Amends** ADR [0097](./0097-hospital-affiliation-person-identity.md) D11 + D14, ADR
[0098](./0098-aff-w1-substrate-shape-decisions.md) §W3.2, and ADR
[0048](./0048-user-registration-identity.md) D10; **reconciles** ADR
[0051](./0051-hospital-admin-tier-and-hospital-audit-tier.md) D1's local-authority
intent with 0097's cross-hospital safeguards; **upholds** 0097 D7 (CPF posture) and D12
(identifier-first registration).

> ## ✅ AMENDMENT 1 (2026-08-21) — the footprint bound splits by capability; the LGPD posture is stated; D10 gains its second read path
>
> PO-ruled 2026-08-21 (grilling interview at the post-DSR reconciliation; build still
> not started). Six rulings:
>
> 1. **The footprint bound splits by capability (amends D1(c) as applied through D3).**
>    D3's four classes no longer share one bound:
>    - **Person-level fields** (name, category, DOB, phone) **and professional
>      credentials** (add/edit/remove) widen to **footprint-INTERSECTION**: a
>      hospital_admin holds these over any person whose active footprint intersects
>      their administered set — spanning people included. Writes now match the read
>      boundary D13 already draws (its legs are per-hospital, i.e. intersection); the
>      name-fix local-knowledge argument holds at *every* hospital the person serves.
>    - **CPF change and account lifecycle** (deactivate / reactivate / suspend) **keep
>      the subset bound** — sole-footprint people only; spanning people stay
>      org_admin-only. Deactivation is cross-hospital denial-of-access and a CPF
>      rewrite is a person-key identity event other hospitals depend on; neither is a
>      local fix.
>    Consequence for D4: the authorizer takes the capability as an input (two arms,
>    intersection vs subset), and `updateUserProfile` applies the **tighter** bound
>    whenever the input includes `cpf`. The B5 matrix gains the split arms — the
>    sharpest new keystone is the cross-hospital pair *field-edit ALLOW /
>    deactivate DENY on the same target*.
> 2. **D2 is untouched, for ALL capabilities**: any org-tier or hospital-tier
>    membership on the target ⇒ org_admin-only; empty footprint ⇒ org_admin-only.
> 3. **The silent cross-hospital write is an ACCEPTED residual** (it returns for
>    fields/credentials, the exact write 0097 D14 existed to prevent): Hospital A's
>    admin edits a person also serving at B without B's knowledge; concurrent edits
>    are last-write-wins, arbitrated by the audit trail. Accepted on the PO's
>    trust-plus-audit rationale. Nicety, not commitment: an "última alteração"
>    provenance line on the profile ships only if it falls out of existing audit
>    queries for free.
> 4. **D10's wording is corrected — DOB has TWO read paths, phone one.** DOB is
>    readable via (i) the B6 rail behind the (now intersection-widened) authorizer
>    and (ii) the audited `list_org_people` door, whose gate is org_admin ∨ any
>    hospital_admin of the org — D11's homonym rationale requires exactly that reach
>    (the colliding person is typically at *another* hospital). Phone stays
>    rail-only. "Readable only on the admin management surface" is retired as
>    written; the column-lock posture (no `authenticated` grant) is unchanged.
> 5. **The LGPD posture for the new columns is stated (reconciles ADR
>    [0130](./0130-dsr-subject-request-workflow.md)):** the DSR lane is
>    patient-keyed by design (`dsr_requests.patient_key` via `patient_xref`);
>    **professional** data subjects exercise their Art. 18 rights administratively
>    (through their organization's administration), out of DSR scope **by design,
>    not omission**. DOB/phone claim no independent retention basis — they follow
>    the account lifecycle. **FUP-AFF2-CONTA is the titular-access control**, not a
>    UI nicety.
> 6. **Two details pinned at decision level:** `phone` is stored digits-only (no
>    CHECK constraint — optional contact data, not an identifier; formatting is
>    display-side), and both new columns **join `guard_profile_privileged_columns`**
>    (the plan's build-time hedge is struck; D10 already implied it). Also ruled:
>    the design handoff **stays in `docs/design/temp/user_management_redesign/`**
>    (the plan's move-on-sign-off item is retired).

## Context

ADR 0051 created `hospital_admin` as "the org_admin of one hospital" for decentralized
Brazilian networks — and explicitly rejected a management-only variant. ADR 0097
D14 / 0098 W3.2 then pulled every person-level fact (name, CPF, category, credentials)
and the whole account lifecycle back to `org_admin`, because "two hospital admins
editing them is a silent cross-hospital write". That safeguard is correct **only for
people who span hospitals**. For the realistic large-network deployment (regionally
disjoint hospitals, near-zero shared staff) it routes every name fix, credential
update and — worst — every offboarding through a single org-wide role, degrading the
org_admin's "control" into rubber-stamping requests from admins with better local
knowledge. Meanwhile the create/edit asymmetry (a hospital admin may *enter* a
person's CPF at registration but not *fix a typo in it* the next day) shows the rule
is static per-field where the risk is per-person.

Facts verified against the live stack for this decision (none file-derived):
CPF is already **required at the action layer** (`registerUser`, ADR 0097 D7); the
register flow is already **identifier-first** (D12); CPF is **write-only on every
admin surface**, org_admin included (D7/HIGH-1); `professional_credentials` SELECT
admits **self / platform_admin / org_admin only** — the redesign's credential column
would render empty for every hospital admin; `profiles` has **no** `date_of_birth`
or `phone` column (DOB was rejected by 0048 D10); `memberships_scope_shape` cleanly
partitions all ten roles into org-tier / hospital-tier / commission-tier.

## Decisions

### The affiliation-scoped authority rule

1. **A hospital_admin holds person-level and lifecycle authority over a target person
   iff ALL of:** (a) the target's `home_organization_id` is an organization where the
   caller holds an active `hospital_admin` membership; (b) the target's memberships
   are **all commission-tier** — the tier is derived from `memberships_scope_shape`,
   never from a role list in prose; (c) the target's **hospital footprint** — active
   `hospital_affiliations` ∪ the hospitals of the target's active commission-tier
   memberships (via `commissions.hospital_id`) — is **non-empty** and **entirely
   within** the caller's administered hospitals.
2. **Any org-tier or hospital-tier membership on the target ⇒ org_admin-only**, even a
   seat at the caller's own hospital. Deactivating an account is a backdoor revocation
   of seats whose appointment chains the hospital admin does not own (ADR 0051 D4);
   this also makes self-deactivation structurally impossible (the caller is themselves
   hospital-tier). **Empty footprint ⇒ org_admin-only** — an unaffiliated,
   uncommitteed person belongs to no hospital.
3. **The widened capability set is all four classes:** person-level fields (name,
   professional category, and the new D10/D11 columns below), **CPF change** (D14's
   create/change asymmetry is retired — the footprint bound plus the global collision
   guard and the audited probe are the controls), professional credentials
   (add/edit/remove; editing still clears `verified_at`), and account lifecycle
   (deactivate / reactivate / suspend). `resendInvite` was already reachable.
4. **Enforcement stays in the TS actions layer**, where 0098 W3.2 put it — every
   affected path runs service-role with no RLS backstop, so a new shared authorizer
   (working name `authorizePersonScopedAdmin`) replaces `authorizeOrgAdminForUser` at
   its call sites, keeping the org_admin arm and adding the footprint arm. Keystoned
   in **Vitest with ALLOW and DENY arms** (sole-hospital target · cross-hospital
   footprint · org-tier target · hospital-tier target · zero footprint · sibling
   hospital's admin), the 0098 precedent. A SQL twin of the predicate is deliberately
   **not** built — no RLS policy consumes it, and a dead DB predicate is a standing
   census liability. Accepted residual: a footprint change racing a single action
   (TOCTOU) — bounded to one write, same class as the ADR 0009 JWT residual.
5. **Audit shape is unchanged** — the same emissions fire regardless of which admin
   acted. The platform-wide service-path actor-attribution gap (AFF F3b:
   `audit_write` derives `auth.uid()`, NULL on service paths) remains its own
   scheduled workstream; AFF2 must not widen it further and `created_by`-style
   columns remain the attribution that survives.

### Registration

6. **CPF stays mandatory, enforced where it already is.** The action layer keeps its
   D7 requirement; the new wizard marks CPF required (the handoff's "opcional" label
   is stale and is not implemented). The **column stays nullable** — the documented
   escape for future non-CPF identifiers (passport, CRNM) without a schema change.
7. **The wizard's step 1 is identifier-first (D12 upheld):** the CPF field leads; a
   complete CPF runs the audited `list_org_people` lookup and branches (in-org match →
   offer to affiliate; already affiliated → link; foreign-org collision → the D8
   block; not found → the remaining identification fields). The handoff's flat step-1
   form is adapted, not copied.
8. **The "Enviar convite agora" escape hatch is REMOVED.** Every registration walks
   all three steps. Steps 2 (vínculo) and 3 (comissões) keep "Pular etapa" — an
   org_admin may still create a genuinely unaffiliated person (who is then, by
   Decision 2, org_admin-only). **A hospital_admin's registration always creates the
   affiliation** to their (server-set, never client-trusted) hospital — skipping
   step 2 skips matrícula and start date, never the affiliation itself — so a
   hospital admin never creates a person they immediately cannot manage.

### New person columns (amends 0048 D10)

9. **`profiles.date_of_birth` (date, nullable) and `profiles.phone` (text, nullable)
   are added, both optional at registration.** Recorded LGPD minimum-necessary
   justification: Brazil's high homonym rate makes DOB the practical *human*
   differentiator between same-named professionals (CPF differentiates at the system
   level but is deliberately undisclosed); phone lets an org_admin reach a
   professional directly instead of routing through a hospital admin.
10. **Both columns are column-locked like `cpf`:** excluded from every `authenticated`
    column-list grant on `profiles` (SELECT and UPDATE). They are readable only on
    the admin management surface via a service-role read behind the Decision-1/4
    authorizer, and writable only through `registerUser` / `updateUserProfile`.
    A co-commission member's row read never carries a colleague's birth date or
    personal phone.
11. **DOB joins the `list_org_people` payload (amends 0097 D11); phone does not.**
    The homonym problem bites exactly in the registration-lookup match cards and the
    directory-adjacent pickers; phone differentiates nothing and stays out of the
    door. The directory table gets **no** DOB column. Self-service view of DOB/phone
    on `/conta` is **deferred** as named follow-up FUP-AFF2-CONTA (LGPD titular
    access), severable by design.

### Display & the credential read

12. **CPF renders presence-only on the profile rail** ("Cadastrado ✓" / "Não
    informado") — no digits, masked or otherwise. The D7/HIGH-1 write-only posture
    is upheld; full value appears nowhere outside the person's own future `/conta`
    surface and the edit form's blank write-only field.
13. **`professional_credentials` SELECT widens** with an affiliation leg and a
    membership leg mirroring the AFF `profiles` widening: a hospital_admin reads the
    credentials of people actively affiliated with, or holding commission-tier seats
    under, a hospital they administer. Deliberate RLS widening: diff-scoped
    `ARM=policy` run, keystones with ALLOW **and** DENY arms (the DENY arm a sibling
    hospital's admin — pinning the default state, not a tenant boundary, per 0097 D6's
    caveat). Without this the redesign's "Registro" column silently violates "empty
    never means no-permission" for every hospital admin.

### The redesign

14. **The three screens are rebuilt to the handoff** — option 1a table directory
    (status filter pills `?status=` server-filtered with counts from the unfiltered
    scoped set, search, hospital select/switcher) and identity-band + rail profile;
    option 1b three-step wizard — recreated in the existing stack (Tailwind tokens,
    `src/components/ui/*`, lucide, GSAP-token motion), never shipping the reference
    HTML. **Both admin roles get the same screens**; scope differences stay data-side
    (org-wide vs hospital roster) and authority-side (Decision 1). Copy that asserted
    "editáveis apenas pela administração da organização" becomes scope-aware.
    Adaptations from fidelity, all decided above: CPF required (D6), identifier-first
    step 1 (D7), no escape hatch (D8), presence-only CPF (D12), Nascimento/Telefone
    rows backed by the new columns (D9), no 1a slide-over, no 1b directory cards or
    profile tiles.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Keep person-level authority org_admin-only (status quo) | Routes every local HR event at a 10-hospital network through one role; the control degrades to rubber-stamping (the Context analysis). |
| Footprint = affiliations only | The org-wide member picker seats people on commissions of hospitals they hold no affiliation with; a hospital admin could deactivate someone actively serving elsewhere. |
| Keep CPF-change org_admin-only (partial widening) | The typo-fix on a sole-hospital person is the founding scenario; collision guard + audited probe + footprint bound are the real controls. |
| A `people_manager` delegated capability (0061 pattern) | A second authorization vocabulary for the same boundary; the footprint rule expresses the actual invariant directly. |
| A SQL predicate twin for the scope rule | No RLS consumer exists; every path is service-role. A dead DB gate is census/sweep liability forever. |
| Relax the action layer so the escape hatch can create name+email-only people | Contradicts D7's person-key premise; PO chose to remove the hatch instead. |
| Masked CPF digits on the rail (as drawn) | Five digits of a national ID disclosed for no workflow; presence-only answers the admin's actual question. |
| Grant DOB/phone to `authenticated` | Every co-commission member reads every colleague's birth date and phone — a disclosure with no purpose to tie it to. |
| DOB in the directory table / phone in the lookup payload | Email + hospital + council number already differentiate table rows; phone differentiates nothing. |
| Hide credentials from hospital admins instead of widening RLS | "—" cells read as missing data — the exact "empty means no-permission" trap the codebase bans. |

## Consequences

- **Two migrations + one door edit:** the `profiles` columns (with their column-grant
  exclusions and a `guard_profile_privileged_columns` check-at-build), the
  `professional_credentials` SELECT widening, and the `list_org_people` payload — the
  door body **re-emitted from the live `pg_get_functiondef`**, never from migration
  text, with `extensions.citext` signatures (both standing lessons). Diff-scoped
  sweep covers exactly these; no new door, no new role, no `prosecdef` flip.
- **The Vitest keystone matrix becomes the authority** for the scope rule (service
  path, no RLS to pgTAP against) — the 0098 W3.2 precedent, now with six arms.
- **Directory queries widen** (credentials + committee chips + status filter/counts,
  batched); the hospital-admin leg of those reads only works because of Decision 13.
- **ADR 0051 D1's local-authority mirror is restored for the people plane, bounded** —
  the drift this ADR's Context describes is now a stated, footprint-bounded rule
  instead of an accumulating exception list.
- The pre-existing service-path audit-attribution gap now covers more actors doing
  more things; its dedicated workstream inherits AFF2's surfaces (Decision 5).
- Follow-up registered: **FUP-AFF2-CONTA** (self-service DOB/phone view on `/conta`).
