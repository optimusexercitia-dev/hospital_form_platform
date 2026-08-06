# External audit — ADR 0097 (AFF) + plan `hospital-affiliation-person-identity.md`

**Date:** 2026-08-05 · **Auditor:** external session (not the AFF team)
**Method:** every catalog claim re-verified against the **live local stack** (fresh-running,
not file-derived — `pg_proc`/`prosrc`, `pg_policies`, `pg_constraint`, `pg_indexes`,
`information_schema` grants, and a role-emulated visibility measurement), plus the cited
TS/TSX sites and a repo-wide grep for the two doomed columns.

**Verdict: the ADR's fact base is solid — all nine catalog findings verified, one minor
factual error. The plan has ONE BLOCKING defect (T3.4 provisioning cannot work as
written) and ONE HIGH design gap (CPF column readability), plus five mediums.
Recommendation: APPROVE the ADR with the corrections below folded in before build.**

---

## Part 1 — Verification of the ADR's nine catalog findings

| # | Claim | Verdict |
|---|-------|---------|
| 1 | `list_addable_commission_members` DEFINER, `authenticated`-executable, gated `is_staff_admin_of OR is_commission_admin_of`, filters `home_organization_id` → org-wide roster | ✅ Verified (prosecdef `t`, ACL `authenticated=X`, body confirmed). TS caller passes no `p_search` (T2.2's claim) ✅ [members.ts:183](../../src/lib/queries/members.ts) |
| 2 | `home_hospital_id` populated 1/30; both `profiles` policies carry it as a leg | ✅ Verified exactly (total 30, populated 1; `profiles_admin_select` + `profiles_select_self_or_admin` both carry the leg) |
| 3 | hospital_admin sees 21/34 memberships, 13/30 profiles, 6 dangling `principal_id` | ✅ Verified **exactly** (role-emulated as `hospitaladmin.a1`: 21 / 13 / 6) |
| 4 | `memberships_scope_shape` per-role switch; commission-tier rows carry `organization_id IS NULL` | ✅ Verified (constraint def read) |
| 5 | `hospital_employee_id` singular `text` on `profiles` | ✅ Verified |
| 6 | `professional_credentials_unique` carries no `organization_id` | ✅ Verified: `UNIQUE (issuing_country, issuing_state, issuing_authority, registration_number)` |
| 7 | `professional_profiles` case-scoped readability; `create_professional_profile` sole writer; `participants` / `professional_participants` have **no** writer | ✅ Verified (`can_read_professional_profile` traverses `professional_participants → case_participants → can_read_case`; prosrc sweep found zero inserters into either participants table, one into `professional_profiles`) |
| 8 | Dual `org_admin`+`hospital_admin` structurally insertable; self-grant denied on every path incl. service; hospital arm requires `is_org_admin_of_for` only | ✅ Verified (`memberships_grant_uq` keys on `role`; `grant_role_impl` inlines the self-grant guard after every branch — its own comment says why; hospital arm has **no** `is_admin_for` arm) |
| 9 | Census: exactly 2 real dominance gaps (`set_standard_ownership`, `standard_ownerships_select`); `list_approver_candidates` a false positive; `is_org_level_admin_within` admits `hospital_admin`/`nsp_org_admin`, excludes `org_admin` | ✅ Verified by an **independent** census (7 functions + 10 policies name `is_hospital_admin_of`; after filtering for an org arm — textual or via `is_commission_admin_of` transitivity — the same 2 remain). No gate the ADR missed. |

Cited code sites also verified: `registerUser`'s email pre-check block
([actions.ts:364–376](../../src/lib/users/actions.ts)) and `resolveOrInviteUser`'s
existing-user branch performing **no** org check ([invite.ts:50–61](../../src/lib/members/invite.ts))
— the D13 bundled fix is a real, live gap.

Substrate prerequisites for the plan also hold: `hospitals_id_org_uq (id, organization_id)`
exists (T1.1's composite FK target); `profiles_email_key` is a partial unique index
`WHERE email IS NOT NULL` (T1.2's shape claim); `memberships` grants `authenticated`
SELECT only (the door posture T1.1 mirrors); `npm run lint:memberships-door` exists and
is already part of `npm run lint`.

**One factual error found (MINOR-1):** D10 states `is_org_level_admin_within` "is used
in **no policy** today". False — it is a leg of **`organizations_select`** (verified in
`pg_policies`). Consequence: the helper is already load-bearing; any AFF-era edit to it
silently changes who can read `organizations`. Correct the ADR text; treat the helper as
shared, not free.

---

## Part 2 — Defects in the plan

### BLOCKER-1 — T3.4 single-hospital provisioning cannot work as specified

T3.4 / ADR D17: seat `org_admin` + `hospital_admin` "via `grant_role_for` with
`p_actor` = the provisioning platform admin".

Verified against the live `grant_role_impl` (which `grant_role_for` delegates to
verbatim — the authority check always runs):

- `org_admin` grant: arm is `is_admin_for(p_actor) OR is_org_admin_of_for(...)` → the
  platform admin **passes**. ✅
- `hospital_admin` grant: arm is `is_org_admin_of_for(v_org, p_actor)` **only — no
  `is_admin_for` arm**. The platform admin **fails with 42501 "sem permissão"**. ❌

And the fallback sequencing fails too: seat `org_admin` first, then have the new
org_admin grant themselves `hospital_admin` → `p_user = p_actor` → the self-grant guard
(which D17 rightly refuses to weaken). **There is no working path through the door
today.** Ironically the ADR's own finding 8 records the missing arm ("its hospital arm
requires `is_org_admin_of_for(org)` only") — D17/T3.4 then forgot it. The plan's ⚠ note
live-probed the *wrong* hazard (the self-grant) and never probed the authority arm.

**Required resolution before build (pick one, record as an ADR amendment):**
(a) add an `is_admin_for` arm to the `hospital_admin` branch — defensible under the
noun rule (memberships = tenancy arm), but note the `technical_director` branch
*deliberately* excludes `is_admin_for` ("tenant governance only"), so this must be an
explicit decision with ALLOW/DENY keystones, not a drive-by edit; or
(b) a dedicated provisioning door with its own narrow gate; or
(c) require a second human (platform seats org_admin; org_admin seats the hospital_admin
of someone else) — which contradicts D17's premise of a solo administrator.

### HIGH-1 — `profiles.cpf` will be readable by every co-commission member unless column privileges are cut

Verified: `authenticated` holds a **table-level** grant on `profiles` (column-privileges
enumeration shows every column under SELECT/UPDATE/INSERT). A newly added `cpf` column is
automatically covered. And `profiles_select_self_or_admin` carries a **co-member leg**
(anyone sharing any commission with you reads your row). Net effect as planned: any staff
member can read a colleague's CPF via PostgREST (`select=cpf`), and every admin tier reads
it for everyone they can see.

D11 ("CPF is never returned to the client") only governs `list_org_people`; D14 only
governs *writes*. The read path is unaddressed. **Required:** column-level `REVOKE
SELECT (cpf)` from `authenticated` (precedent exists — `case_referral` uses column-level
grants), with the action layer reading it through the service client / DEFINER doors; or
store CPF in a separate locked table. Also add `cpf` to
`guard_profile_privileged_columns`' identity set (the plan already recommends this — make
it binding).

### MEDIUM-1 — `guard_profile_privileged_columns` is a runtime landmine for T1.3

The prosrc sweep found exactly one function referencing the doomed columns:
`guard_profile_privileged_columns` compares `new.home_hospital_id` and
`new.hospital_employee_id`. `DROP COLUMN` will **succeed** (plpgsql is late-bound) and
then **every subsequent `profiles` UPDATE fails with 42703** at runtime. The trigger
function must be rewritten in the same migration — regenerated from live
`pg_get_functiondef`, per the plan's own standing trap. It is absent from T1.3's
enumeration list; add it explicitly rather than trusting the grep (a `src/`-scoped grep
never sees it).

### MEDIUM-2 — the customer demo seed breaks and is in no gate

[supabase/demo/seed-revisao-prontuario.sql:215](../../supabase/demo/seed-revisao-prontuario.sql)
sets `home_hospital_id`. This file is applied manually (`psql -f`), is excluded from
`config.toml` `sql_paths`, and is **in nobody's W1–W3 scope** — the exact TV lesson
(2026-08-05): the union of scoped sweeps is not a sweep. Assign it to `backend` in T1.3
by name.

### MEDIUM-3 — `end_affiliation`'s refusal checks only *commission* memberships (D5/T2.1)

Hospital-tier memberships are also seats under that hospital: `hospital_admin`,
`technical_director`, `technical_director_deputy`, `nsp_coordinator`, `pqs_member`.
As specified, ending the affiliation of a sitting technical director succeeds, leaving an
active TD role for a person with no employment row — precisely the seat-orphaning D5
exists to prevent. Either extend the refusal to hospital-tier rows or record the
exclusion as deliberate (with the reason) in the door comment and the ADR.

### MEDIUM-4 — the `hospital_affiliations` SELECT policy "mirror" omits self and org_admin

T1.1 says the SELECT policy "mirrors the widened `profiles` legs (T2.3)" — but T2.3's two
legs are *administrator-side* only. A literal mirror means a person **cannot read their
own affiliation rows** (their own profile/account page breaks) and an `org_admin` cannot
read any. Specify the full policy: `self OR org_admin(org) OR` the two T2.3 legs — and
note the dominance grid (T2.4) would itself flag the org_admin omission if the policy
names `is_hospital_admin_of`, so shipping the omission also ships a grid red or a bogus
allowlist entry.

### MEDIUM-5 — `list_org_people`'s gate silently widens the directory to `nsp_org_admin`

`is_org_level_admin_within` admits `hospital_admin` **and `nsp_org_admin`** (verified).
Ratifying finding 1 justifies hospital admins; handing the full org people directory
(names, emails, affiliations, CPF-keyed lookup) to `nsp_org_admin` is a **new**
disclosure argued nowhere in the ADR. Possibly intended (NSP runs an org-wide roster) —
but it must be a stated decision, or the gate should name
`is_org_admin_of OR is_hospital_admin_of(any hospital of org)` instead of borrowing the
helper for convenience.

---

## Part 3 — Lower-severity observations

- **LOW-1 — the T2.3 DENY keystone is soft by design.** The sibling-hospital admin the
  DENY arm excludes can self-serve the ALLOW: `affiliate_person` permits any hospital
  admin to affiliate any in-org person to their own hospital (D13 allows it; the person's
  consent is not an input), after which the affiliation leg grants the read. The true
  boundary remains the **org** (consistent with finding 1); the keystone pins only the
  default state. Fine — but say so in one sentence in the ADR, so a future auditor does
  not read the DENY arm as tenant isolation. Mitigation already present: the audit
  trigger on `affiliation.created` names the actor.
- **LOW-2 — no audit emission is specified for `list_org_people` / CPF lookups.**
  Rule 11 logs reads of another member's data; a CPF exact-match probe is the most
  targeted identity read the platform will have. The existing directory door doesn't log
  either — but CPF raises the stakes. Decide and record; recommended: emit an audit row
  for CPF-parameterized calls at minimum (this also mitigates LOW-3).
- **LOW-3 — "identical to the email enumeration surface" (D7) understates.** CPF space is
  11 digits with check digits (~10⁹ valid values), densely machine-enumerable; emails are
  not. The registration block + `p_cpf` lookup form an existence oracle over national IDs
  for any org/hospital admin of any tenant. Bounded by the authenticated-admin audience,
  so acceptable — but the asymmetry belongs in the ADR text, and LOW-2's audit row is the
  cheap compensating control.
- **INFO-1 — client sites worth naming in T1.3** (the list is declared orientation-only,
  but these are the trap class): [org.ts:199](../../src/lib/queries/org.ts) embeds
  `profiles!profiles_home_hospital_id_fkey(count)` — an embed string that **typechecks
  after the drop and fails only at runtime** (the TV dropped-column-in-a-select-string
  mechanism); plus `register-user-form.tsx`, `user-profile-edit-form.tsx`, and the
  manage-permission check at [actions.ts:177–200](../../src/lib/users/actions.ts).
- **INFO-2 — seed is a contract.** T3.5 adds an org, personas, and affiliation rows to
  `supabase/seed.sql`, which ~900 pgTAP tests + E2E treat as a fixture contract — the
  measured constants this very ADR cites (21/34, 13/30, 6) are the kind of number baked
  into keystones. Budget for updating counting tests; do not clamp the new fixtures to
  preserve old counts (the pigeonhole lesson).
- **INFO-3 — pgTAP suites `180`/`188` and `e2e/hospital-admin-tier.spec.ts`** reference
  the doomed columns/flows; expected rewrite scope, listed here so the estimate includes
  them.

## What the audit specifically endorses

- The nine-finding fact base is unusually accurate — 9/9 substantively verified, several
  to the exact number, and an independent census reproduced finding 9 with no misses.
- Rejecting `solo_admin`, keeping the global `professional_credentials` unique, refusing
  partial CPF matching, deferring the `professional_profiles` link (D15), and refusing to
  weaken the self-grant guard are all correct calls with sound reasoning.
- The plan's standing-traps section is real, current, and matches the recorded lessons.
- D13's bundled `resolveOrInviteUser` fix addresses a genuine live gap, verified in code.

## Disposition summary

| ID | Severity | One-line | Where |
|----|----------|----------|-------|
| BLOCKER-1 | Blocker | T3.4 provisioning has no working path through `grant_role_impl` | Plan T3.4 / ADR D17 |
| HIGH-1 | High | `cpf` column readable by co-members absent a column-privilege cut | Plan T1.2 / ADR D11+D14 |
| MEDIUM-1 | Medium | `guard_profile_privileged_columns` breaks all profile UPDATEs after the drop | Plan T1.3 |
| MEDIUM-2 | Medium | Demo seed sets `home_hospital_id`; in no gate, no owner | Plan T1.3 |
| MEDIUM-3 | Medium | `end_affiliation` ignores hospital-tier seats | Plan T2.1 / ADR D5 |
| MEDIUM-4 | Medium | Affiliation SELECT "mirror" omits self + org_admin legs | Plan T1.1 |
| MEDIUM-5 | Medium | `list_org_people` gate silently admits `nsp_org_admin` | Plan T2.2 / ADR D10 |
| MINOR-1 | Minor | D10's "used in no policy today" is false (`organizations_select`) | ADR D10 |
| LOW-1..3, INFO-1..3 | Low/Info | See Part 3 | — |

## Resolution (2026-08-05, PO-ruled)

All findings accepted and folded into ADR 0097 + the plan the same day. The four decision
points were ruled as the audit recommended: **BLOCKER-1** → `grant_role_impl`'s
`hospital_admin` branch gains an `is_admin_for` arm (plan T2.5, new task; TD branch and
the self-grant guard untouched); **HIGH-1** → `cpf` column-locked via conversion of
`profiles` to column-list grants (plan T1.2); **MEDIUM-3** → `end_affiliation` blocks on
memberships of **any** tier; **MEDIUM-5** → `list_org_people` gated org_admin +
hospital_admin only, via an inline predicate (no `nsp_org_admin`). MEDIUM-1/2/4,
MINOR-1 and LOW-1/2/3 corrected in place; INFO items folded into T1.3/T3.5.
