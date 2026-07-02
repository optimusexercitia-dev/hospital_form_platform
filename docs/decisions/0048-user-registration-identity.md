# ADR 0048 — User Registration & Identity Management

**Status:** Accepted · **Date:** 2026-07-01 · **Feature:** User Registration &
Identity Management (additive; no feature flag — the directory + register/manage
surface is org-admin-gated, not dark-launched).
**Builds on:** ADR [0041](0041-multi-tenancy-organizations-hospitals.md) (org/vendor
split, `org_admin` vs `platform_admin`, `home_organization_id` anchoring), ADR
[0009](0009-jwt-local-verification-gate.md) (local JWT identity, the ≤~1h claim
residual), ADR [0010](0010-denormalize-email-on-profiles.md) (trigger-synced
`profiles.email`), ADR [0035](0035-lgpd-anvisa-regulatory-posture.md) (LGPD
minimization). Scoped through a full design interview; the decision record is the
plan `~/.claude/plans/i-would-like-to-sorted-fog.md`.

## Context

The platform provisioned users through a thin **invite** path only: an admin
entered an email, `resolveOrInviteUser()` called `inviteUserByEmail`, the
`handle_new_user` trigger created a bare `profiles` row, the invitee set a password
at `/convite`. There was no professional identity (category, council registration,
matrícula), no verified/pending/suspended lifecycle the app could act on
(`is_active` was a **dead flag** enforced nowhere), no searchable user directory,
and no per-user management surface. This work builds the real registration process:
an org-scoped admin registers people with their professional data, they verify +
activate via email, and the admin manages them (committees, roles, lifecycle) from a
searchable directory — while keeping the platform's posture (vendor isolation,
DB-backed RLS, minimal JWT claims, hash-chained audit, LGPD minimization).
Deferred by explicit decision: MFA, live credential verification, SSO, bulk import.

## Decision

1. **Registrar = `org_admin` (per-org); `platform_admin` stays vendor-isolated.**
   The customer's own super-user registers and manages users within its
   organization; the vendor `platform_admin` (ADR 0041) never touches tenant user
   PII. Employee PII is owned by the tenant. The user directory is **org-scoped**
   (`home_organization_id`); `platform_admin` gets no tenant-user browser.

2. **Combined verify + activate**, reusing the existing invite → `/auth/confirm`
   → `/convite` flow. A profile exists in `pending` from the moment the admin
   saves; the invitee sets their first password on the activation page. No separate
   "confirm email" then "set password" steps, and no new auth surface.

3. **Status is DERIVED, not a stored enum.** From three columns:
   `email_confirmed_at` (denormalized from `auth.users` by a trigger mirroring ADR
   0010's email sync) + `is_active` + `suspended_until`. Derivation order
   (`deactivated > suspended > pending > active`): `pending` =
   `email_confirmed_at IS NULL`; `suspended` = `is_active AND suspended_until >
   now()`; `deactivated` = `NOT is_active`; else `active`. `suspended_until` is a
   **temporary, auto-reinstating** window — a past instant reads `active` again with
   no write. **`deriveUserStatus` is the SINGLE SQL↔TS authority**, kept in agreement
   by a shared vector fixture (`src/lib/users/__fixtures__/status-vectors.json`)
   asserted in **both** pgTAP and Vitest — the same anti-drift discipline as the
   condition evaluator (Architecture Rule 3). No status-events table (that would
   duplicate the audit log).

4. **Full deactivation/suspension enforcement — DB and app, not UI.**
   - A new `app.is_active(uid)` SD-function (`is_active AND (suspended_until IS NULL
     OR now() >= suspended_until)`) is **folded into every membership SD-helper**
     (`is_member_of[_for]`, `is_staff_admin_of[_for]`, `is_org_admin_of[_for]`,
     `is_org_admin_of_commission[_for]`, `is_org_member`, `is_pqs_member_of_for`,
     `is_pqs_member_of_any`, `is_nsp_coordinator_of_for`), so every policy and every
     composite predicate built on them inherits the check — one edit, uniform,
     transitive. **`app.is_admin*` is DELIBERATELY EXCLUDED:** the org-less vendor has
     no `org_admin` above it to reinstate it, so a lockable vendor account is
     unacceptable; the platform-admin lifecycle is out of scope.
   - **`signIn` is the primary gate:** valid credentials for a suspended/deactivated
     account are signed out immediately with a pt-BR notice — no session is
     established (so no redirect loop).
   - **Mid-session:** `getSessionContext()` exposes an explicit `isInactive` signal
     (NOT a bare `null` — a bare null conflates "inactive" with "unauthenticated" and
     loops a still-JWT'd user against the login-bounce middleware); `requireUser()`
     redirects inactive users to a new public route **`/conta-inativa`** (added to the
     middleware public allow-list AND kept OUT of `AUTHED_REDIRECT_AWAY` — the
     anti-loop fix), which signs them out.
   - **Accepted residual (ADR 0009, ≤~1h):** a just-deactivated user holding a live
     JWT could, via direct API, read only their OWN `created_by = auth.uid()` rows
     until token expiry. We do **not** chase this into every self-scoped policy — RLS
     via the helper fold is the data backstop for shared data, and the JWT window is
     bounded and self-only.

5. **Professional identity → a separate `professional_credentials` table**
   (1 user → N): issuing country/state/authority, registration number,
   `verified_at` (cleared on any edit — tamper-visible), optional `expires_on`,
   with global `UNIQUE (country, state, authority, number)`. Category is a
   `professional_categories` **lookup** (managed-vocabulary pattern, like
   `pqs_event_types`), seeded physician/nurse/pharmacist/physiotherapist/
   administrator/other with council mapping (CRM/COREN/CRF/CREFITO). Multi-value
   credentials do not belong as columns on `profiles`.

6. **Org anchor = `home_organization_id` on `profiles`, enforced by a DEFERRED
   CONSTRAINT TRIGGER**, not a plain `CHECK`. The invariant "a non-admin profile
   must be org-anchored" is correct, but a table `CHECK (home_organization_id IS NOT
   NULL OR is_admin)` fires on the **intermediate** `handle_new_user` INSERT (org
   still NULL) and rejects every non-admin signup. The deferred constraint trigger
   (`profiles_tenant_has_org_trg`, `DEFERRABLE INITIALLY DEFERRED`) enforces the same
   rule at **COMMIT**, after the multi-step create flow has anchored the profile —
   identical guarantee, enforcement point moved. The anchor is populated via the
   invite **`user_metadata.home_organization_id`** (service-role-set-once at invite
   time; `handle_new_user` reads it) — a **descriptive anchor, NOT an authorization
   input** (per the Supabase guidance that `user_metadata` is user-editable and must
   never drive authz; here authz still flows through memberships + RLS, and
   `guard_profile_privileged_columns` locks the column against self-mutation after
   creation). Org-less **vendor** accounts satisfy the invariant via a
   `bootstrap_admin` flag read from **`app_metadata`** (the service-role-only,
   non-user-editable channel), which only seeds `profiles.is_admin` at creation.

7. **Hospital = descriptive only, not an access boundary** → nullable
   `home_hospital_id` (FK, `ON DELETE SET NULL`) + `hospital_employee_id`
   (matrícula) on `profiles`. Hospital is an HR/reporting grouping; access is
   org-level + commission-level. Nullable, never gated on.

8. **Committee assignment is optional, 0..N committees, per-committee role**
   (`staff` / `staff_admin`), via one shared assignment control used by the register
   form and the per-user page. This replaces the former split hard-coded
   staff/staff_admin provisioning paths.

9. **Email collision is BLOCKED** with a clear pt-BR error — never a cross-org
   absorb/overwrite. Supabase email is a **global** identity; registering an email
   that already maps to a profile stops with a field error and leaves the existing
   user untouched.

10. **LGPD minimization: no `date_of_birth`.** Required fields are name, email,
    category; everything else optional. We collect the minimum necessary
    (ADR 0035).

## The activation-link fix (BUG-UREG-002)

The invite/recovery emails linked via the default GoTrue templates
(`{{ .ConfirmationURL }}`), which — with no PKCE `flow_type` — emit an
**implicit-flow hash-fragment** link (`/auth/confirm#access_token=…`). The
`/auth/confirm` **server** route (the canonical `@supabase/ssr` pattern) reads
`token_hash` + `type` query params, which are null for a fragment → the invite
dead-ended at `/login?error=link_invalido`; an invited user could never set a
password, and recovery shared the bug. **Fix:** custom **pt-BR email templates
using `{{ .TokenHash }}`** (invite + recovery) so links resolve to
`<site_url>/auth/confirm?token_hash=…&type=invite|recovery` — the exact shape the
handler already verifies via `verifyOtp`. The handler was correct; only the emails
were the wrong shape. A client-hash-`setSession` workaround was rejected (exposes
tokens in the URL, diverges from the server-side SSR pattern).

**PROD dependency (Phase 9):** self-hosted `config.toml` templates are **not**
applied to Supabase Cloud — the pt-BR invite/recovery templates must be uploaded to
the **Dashboard → Auth → Email Templates**, keeping the `{{ .TokenHash }}` + `?type=`
shape, alongside the custom SMTP configuration. Flagged, not blocking.

## Alternatives rejected

- **Stored status enum + a status-events table.** Rejected — status is a pure
  function of three columns already present; a stored enum drifts and a
  status-events table duplicates the audit log.
- **Plain `CHECK` for the org anchor.** Rejected — breaks the multi-step
  `handle_new_user` insert (decision 6).
- **Folding `app.is_active()` into `app.is_admin*`.** Rejected — would make the
  org-less vendor account lockable with no path to reinstate it (decision 4).
- **Bare-`null` `getSessionContext()` for inactive users.** Rejected — loops a
  still-JWT'd user against the login-bounce middleware (decision 4).
- **Client-side hash → `setSession` on `/auth/confirm`.** Rejected — token-in-URL
  exposure and a divergence from the server-side SSR pattern (BUG-UREG-002).
- **Adopting the reviewed "similar platform" model wholesale** — its
  hospital-as-access-boundary spine (hospital is not an access boundary here),
  18-value role enums, a separate `app` schema, and a `pending_approval` gate were
  rejected; its credentials-table, suspended≠deactivated, and invitation-tracking
  (as a resend action) ideas were adopted.

## Consequences

- **Blast radius of the anchor invariant (BUG-UREG-003):** every pre-existing
  new-user invite path had to thread `home_organization_id` into
  `user_metadata`, because the shared `resolveOrInviteUser` helper previously
  invited without it → a non-admin org-less profile → deferred-trigger reject at
  COMMIT. `resolveOrInviteUser` now takes a **required** `homeOrganizationId`
  (compile-time-enforced so no caller is missed); `inviteStaff` and assign-staff_admin
  pass the commission's denormalized `organization_id`, `assignOrgAdmin` passes the
  target org. The existing-user branch needs nothing (already anchored).
- **`is_active` fold touches the whole access surface** — the gate is not declared
  until the FULL pgTAP + E2E suites pass, not just the new file. Verified: pgTAP
  **1252** (the new `180_user_registration.sql` = 33 assertions), Vitest **185** (the
  9 status-vectors), the existing suite unaffected for active users.
- **Widened self-mutation guard:** `guard_profile_privileged_columns` now locks ALL
  identity/lifecycle columns (`suspended_until`, `email_confirmed_at`,
  `home_organization_id`, `home_hospital_id`, `hospital_employee_id`,
  `professional_category_id`) against a signed-in self-update — service-role-only —
  closing the self-unsuspend hole `profiles_update_self` would otherwise open.
- **Seed:** organizations/hospitals moved above the users loop (breaks the
  users↔orgs FK cycle), org threaded into user_metadata, four lifecycle personas
  (`d1`–`d4`: pending/active/suspended/deactivated) + category/credential fixtures.
- Verification: pgTAP `supabase/tests/180_user_registration.sql`, Vitest
  `src/lib/users/status-vectors.test.ts`, E2E `e2e/user-registration.spec.ts`
  (activation via Mailpit, deactivation/suspension enforcement, collision block,
  committee-role, keyboard-only, role-restriction boundary).
