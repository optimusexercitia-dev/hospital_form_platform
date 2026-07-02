# QA Review — User Registration & Identity Management

**Reviewer:** `qa` · **Date:** 2026-07-01 · **Branch:** `feat/user-registration`
**Verdict:** CHANGES REQUESTED → **APPROVED** (re-review) → **APPROVED, verdict holds** (re-re-review 2026-07-01)

## Re-re-review (2026-07-01) — M4 re-fix (light) — APPROVED, verdict unchanged

Post-APPROVAL, a full-suite run surfaced a regression traced to the **M4** template
reword (NOT B1 — the B1 assessment stands): the reword had left Go `html/template`
actions inside HTML comments and let `recovery.html` end in a non-text context, so
`html/template` refused to render → GoTrue 500 "Error sending invite email" → every
invite/register failed. Backend re-fixed and added the functional pgTAP case the
original coverage was missing. Light re-review of just this re-fix:

- **`invite.html` + `recovery.html` — valid `html/template` now.** Both opening and
  closing comments contain NO `{{ }}` actions (the old `{{ .TokenHash }}`/
  `{{ .ConfirmationURL }}` comment references are gone, replaced by prose — "the
  double-brace TokenHash/SiteURL syntax"), and both files END in a text-context `<p>`
  (the generic-expiry paragraph), with the trailing comment deliberately placed ABOVE
  it. Each also carries an inline IMPORTANT note warning the next editor not to
  reintroduce actions-in-comments. **Link shape preserved:** button href AND fallback
  link both use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
  (`&type=recovery` for recovery) — the exact shape `/auth/confirm`'s
  `verifyOtp({token_hash, type})` expects. **pt-BR intact** ("Ative sua conta" /
  "Redefinir sua senha"); **expiry copy still de-drifted** ("O link expira por
  segurança", no hardcoded duration).
- **B1 + M1/M2/M3 confirmed untouched this pass.** The B1 peer-branch gate
  (`app.is_active(auth.uid())`, migration L508-519), the M1 nsp_coordinator-exclusion
  assertion, the M2 corrected parity comments, and the M3 credential-collision
  messages are all still present and unchanged.
- **New functional pgTAP case present** (`180_user_registration.sql:210-224`, now
  `plan(38)`): adds the pending user (d1, `email_confirmed_at` NULL) to CCIH, then
  reads as the active `staff_ccih` peer and asserts visibility — proving the peer
  branch keys on the CALLER's activity + shared commission, not on the TARGET being
  confirmed/active. This is exactly the coverage that would have caught a broken
  roster; well-constructed. 38 assertions counted = `plan(38)`, consistent with the
  reported pgTAP 1257/1257.

Verification cross-check: reported combo phase3+user-reg back to 26/26 and invite smoke
→ HTTP 200. **Verdict unchanged: APPROVED.** Human approval remains gated on the lead's
full-suite re-run (templates reloaded via restart) coming back green.

---

## Re-review (2026-07-01) — all 5 items RESOLVED, verdict → APPROVED

Backend addressed the BLOCKER + all 4 MINORs; I re-reviewed each against source
independently (not on the reported summary). All confirmed fixed.

- **B1 (BLOCKER) — RESOLVED + independently confirmed.** The raw peer self-join
  branch in `profiles_select_self_or_admin`
  (`20260702000000_user_registration.sql:508-519`) now explicitly requires
  `app.is_active(auth.uid())` before the `exists(...)`; the SELF branch
  (`id = auth.uid()`) stays open (correct — needed for `/conta-inativa`), and the
  two org-admin branches gate caller-activity transitively via the folded
  `app.is_org_admin_of(...)`. I re-checked my *original two-policy concern* in full:
  `profiles_admin_select` (L529-546) has exactly three branches — `app.is_admin()`
  (the vendor path, deliberately NOT is_active-gated per ADR 0048), and two
  org-admin branches both `app.is_org_admin_of`-gated — and **no raw peer join**, so
  it needed no change. Every ANOTHER-user-visibility branch across BOTH policies is
  now activity-gated; the only ungated read is a user's own row. **Active-user
  visibility is genuinely unchanged**: for an active caller `app.is_active(auth.uid())`
  short-circuits to true and the `exists(...)` runs exactly as before. The new pgTAP
  (`180_user_registration.sql:195-232`) is well-constructed and truly isolates the
  peer branch — it uses two plain CCIH *members* (neither an org_admin, so the
  org-anchor branch cannot mask the result): an ACTIVE member reads a peer (1); a
  SUSPENDED member cannot (0); a DEACTIVATED member cannot (0, with a correct
  claims-cleared service-role write to flip `is_active`). Seed personas verified
  present and correctly wired (`staff2.ccih` …004 is a CCIH member + org-a anchored).
- **M1 — RESOLVED.** `180_user_registration.sql:184-192` adds an `nsp_coordinator`
  (`nspcoord.a`, org-a, NOT an org_admin) and asserts it gets zero rows from the
  org-anchor directory path (reading a committee-less pending user, reachable ONLY
  via that path) — pinning the "org_admin-ONLY, nsp_coordinator excluded" design
  point against regression.
- **M2 — RESOLVED.** The false SQL↔TS "parity" claim is corrected in all three
  places: the pgTAP header (L20-23), the Vitest header
  (`status-vectors.test.ts:10-17`), and the fixture `_comment` — each now states
  `deriveUserStatus` is TS-only with no SQL twin, and explains the intentional
  `email_confirmed_at` divergence from the separate `app.is_active()` boolean.
- **M3 — RESOLVED.** A credential `23505` now maps to a specific, actionable pt-BR
  message (`credentialCollision`: *"Este registro profissional já está cadastrado
  (órgão, UF e número)."*) in all three credential write paths — `registerUser`
  insert (`actions.ts:294`), `upsertCredential` update (`:382`) and insert (`:395`).
  Surfaced as a form-level `role="alert"` error rather than pinned to a single input
  — reasonable given credentials are a repeating sub-form with no stable field id;
  the message content is credential-specific, which was the point. Confirmed backend
  is correct that there is **no category-collision insert path** (categories are a
  platform_admin lookup referenced by FK only) — not a gap.
- **M4 — RESOLVED.** Both `invite.html` and `recovery.html` de-drift the expiry copy
  to a generic *"O link expira por segurança"* with a comment tying the exact-duration
  option to `config.toml` `otp_expiry`.

Verification cross-check: pgTAP `plan(37)` matches 37 static assertion calls (+4 over
the prior 33), consistent with the reported 1256/1256. The B1 edit is contained
within the existing policy body; no structural change to the migration. The full-suite
regression re-run (B1 touches the shared `profiles` policy) is in the lead's hands per
the same discipline noted below — clearing that is the last gate step before human
approval.

No items remain open. Nothing else in the original review needed rework; the design,
the other RLS surfaces, the action layer, and the frontend were APPROVED as-is.

---

## Original review (verdict at the time: CHANGES REQUESTED)

Scope reviewed: migration `supabase/migrations/20260702000000_user_registration.sql`,
the `app.is_active()` fold, RLS (profiles/professional_credentials/professional_categories),
`src/lib/users/actions.ts`, `src/lib/queries/org-users.ts`, `src/lib/members/invite.ts` +
its 3 callers, the inactive-user gate (`signIn`, `getSessionContext`, `/conta-inativa`,
`src/proxy.ts`), the auth-email flow, LGPD/pt-BR/audit posture, and the frontend surface
under `src/app/o/[org]/manage/usuarios/**` + `src/components/users/**`. Cross-checked
against `~/.claude/plans/i-would-like-to-sorted-fog.md`, ADR
[0048](../decisions/0048-user-registration-identity.md), `CLAUDE.md`, `ARCHITECTURE.md`,
and the PROGRESS.md task board / Bug Log for this feature.

## Summary

The build is substantial and mostly well-executed: the derived-status model, the
deferred-constraint org anchor, the atomic `registerUser` action, the collision block, the
loop-free inactive-user gate (`signIn` primary gate + `getSessionContext().isInactive` +
`/conta-inativa` + middleware allowlist), the widened `guard_profile_privileged_columns`
self-mutation lock, and the frontend surface are all solid and match the plan/ADR. The
tester's three real regressions (BUG-UREG-001/002/003) were genuinely fixed and
re-verified. However, this review found **one BLOCKER**: the "fold `app.is_active()` into
every membership helper" claim — the central security property the migration exists to
establish — has a real, unfolded gap in a live RLS policy on `profiles`, which the pgTAP
suite does not catch because it tests the *helper functions*, not this *policy branch*.
That single gap is enough to block approval per the review posture (an RLS/immutability
hole is `CHANGES REQUESTED` regardless of what else is correct).

---

## BLOCKER

### B1 — `profiles_select_self_or_admin`'s shared-commission peer-visibility branch bypasses the `app.is_active()` fold entirely

**File:** `supabase/migrations/20260702000000_user_registration.sql:500-507` (re-created,
unchanged from `supabase/migrations/20260620000000_baseline.sql:21977-21983`, where the
same gap pre-dates this feature).

**Requirement violated:** ADR 0048 decision 4 / migration header §5: *"`app.is_active(uid)`
… folded into every membership SD-helper … so every policy and every composite predicate
built on them inherits the check — one edit, uniform, transitive."* Also CLAUDE.md's
audit-checklist item 2: *"the DB-level invariants hold… no UI-only access control."*

```sql
-- shared-commission peer visibility (pre-existing path).
or (exists (
  select 1
  from public.commission_members me
  join public.commission_members them on them.commission_id = me.commission_id
  where me.user_id = auth.uid()
    and them.user_id = profiles.id
))
```

This branch is a **raw self-join on `commission_members`** — it calls no `app.*` helper
and therefore never consults `app.is_active()`. Every other branch in this policy (and in
`profiles_admin_select`) correctly routes through `app.is_org_admin_of(...)`, which *is*
folded; this is the one branch that does its own inline membership check.

**Impact:** a deactivated or currently-suspended user who still holds a live JWT (bounded
by the ADR-0009 ≤~1h residual) can read the **full `profiles` row — including the new
identity columns this very migration adds (`home_organization_id`, `home_hospital_id`,
`hospital_employee_id`, `professional_category_id`, `email_confirmed_at`,
`suspended_until`)** — of **every peer in every commission they belong to**, via a direct
PostgREST call. This is a materially broader residual than the one ADR 0048 explicitly
accepts: the ADR's "Accepted residual" paragraph scopes the JWT-window exception to *"only
their OWN `created_by = auth.uid()` rows"*; this branch grants read of *other users'* rows,
which is exactly the shared-data case the ADR says "RLS via the helper fold is the data
backstop" for.

**Why the test suite didn't catch it:** `supabase/tests/180_user_registration.sql`'s fold
assertions (lines 130-146) test `app.is_member_of_for` and `app.is_org_admin_of_for`
directly — correctly proving those *functions* are folded — but never probes the
`profiles` SELECT policy itself with a suspended/deactivated actor sharing a commission
with the target row. The org-directory-path assertions (lines 152-174) use `orgadmin_a`,
`staff_ccih`, and `orgadmin_b` — none of them a *suspended/deactivated* actor exercising
the peer-visibility branch. The gap is invisible to both the pgTAP suite and the E2E spec.

**Fix:** add `app.is_active(auth.uid())` to the `me`/`them` branch's `WHERE` clause (or
rewrite the branch as `app.is_member_of(me.commission_id) and exists(...)`, consistent
with how the other branches delegate to a folded helper), in both
`profiles_select_self_or_admin` and the parallel term if present in `profiles_admin_select`
(the admin-select policy's own commission_members/commissions join is already
`app.is_org_admin_of`-gated on the *actor*, so that one is fine — only the peer-join branch
needs the fix). Add a pgTAP case: suspend `u_suspended` (already a CCIH member per seed),
authenticate as it, and assert it can no longer `SELECT` a CCIH peer's profile row it could
read while active — mirroring the existing `is_member_of_for` fold assertion but against
the live policy, not just the helper.

---

## MAJOR

None.

## MINOR (cheap to fix — clear before phase record per standing preference)

### M1 — No test coverage for the explicitly-designed `nsp_coordinator` exclusion from the org directory

The migration comment (`20260702000000_user_registration.sql:477`) and ADR intent are
explicit: *"org_admin-ONLY (nsp_coordinator does NOT get the whole-org directory)."* This
is a deliberate, named security boundary, but neither `supabase/tests/180_user_registration.sql`
nor `e2e/user-registration.spec.ts` asserts it — the only role-boundary tests present are
"plain staff/staff_admin 404s" and "foreign org_admin 404s." Structurally the exclusion is
correct (the `profiles_select_self_or_admin`/`profiles_admin_select` OR-terms only check
`app.is_org_admin_of`, never `app.is_nsp_coordinator_of`), so this is not a second BLOCKER,
but an explicitly-called-out design point with zero regression coverage should be pinned
down — a future edit to these policies could silently admit `nsp_coordinator` and nothing
would fail. Add one pgTAP case (an `nsp_coordinator`-but-not-`org_admin` actor gets zero
rows from the org-anchor directory path) using the existing per-org NSP fixtures
(`nspcoord.a`/`pqs.a` from the NSP-per-org seed).

### M2 — `180_user_registration.sql`'s "SQL status derivation" claim is inaccurate; no such function exists

The file header (`supabase/tests/180_user_registration.sql:16`, *"the SQL status
derivation matches the shared status-vectors fixture"*) and the Vitest file's own comment
(`src/lib/users/status-vectors.test.ts:7-9`, *"asserted here (TS `deriveUserStatus`) and in
pgTAP (the SQL derivation), so the two cannot drift"*) both claim a SQL-side status
derivation exists and is parity-tested against `status-vectors.json`. There is no such
function anywhere in the migration or elsewhere in `supabase/` — status is derived
**only** in TypeScript (`deriveUserStatus` in `src/lib/users/types.ts`), consumed by
`listOrgUsers`/`getOrgUser`. This isn't a functional bug (status is a display-only
derivation; the actual access-control predicate is the separately- and correctly-tested
`app.is_active()`), but the "parity" comments are simply false and will mislead the next
person who touches either file. Either add the SQL derivation function the comments
describe and genuinely test it against the fixture, or correct both comments to say the
fixture is TS-only.

### M3 — Credential/category collisions surface only the generic error, not a field-specific one

`upsertCredential` and the credential-insert branch of `registerUser`
(`src/lib/users/actions.ts:288`, `:375`) both map a `23505` (duplicate
`(issuing_country, issuing_state, issuing_authority, registration_number)`) to
`MESSAGES.generic` ("Não foi possível concluir. Tente novamente."). This correctly avoids
leaking a raw Postgres error (CLAUDE.md §8), but gives the operator no actionable signal
that the specific registration number is already claimed — unlike the email-collision path,
which does surface a precise `fieldErrors.email` message. Catch the `23505` on
`professional_credentials_unique` specifically and return a field error on
`registrationNumber` (mirroring the email-collision pattern already in the same file).

### M4 — Invite/resend email copy hardcodes "expira em uma hora" outside the config that governs it

`supabase/templates/invite.html:37` hardcodes *"O link expira em uma hora"*; the actual TTL
is `supabase/config.toml`'s `otp_expiry = 3600`. They agree today, but nothing ties them
together — a future change to `otp_expiry` silently makes the email copy wrong. Low
priority (cheap either to leave as a known coupling, noted in a comment, or to interpolate
if the template engine supports it); flagging only because it's a one-line comment fix.

---

## What was verified and holds up

- **Deferred anchor-invariant trigger** (`profiles_tenant_has_org_trg`): correctly a
  `DEFERRABLE INITIALLY DEFERRED` constraint trigger (not a `CHECK`), verified against the
  catalog in pgTAP; the rationale for not using `CHECK` (breaks the multi-step
  `handle_new_user` insert) is sound and documented in ADR 0048 decision 6.
- **`app.is_active()` fold across the membership *functions***: independently verified
  complete. Comparing every `app.*` membership helper defined in the baseline
  (`is_member_of[_for]`, `is_staff_admin_of[_for]`, `is_org_admin_of[_for]`,
  `is_org_admin_of_commission[_for]`, `is_org_member`, `is_pqs_member_of[_for/_any]`,
  `is_pqs_writer_of`, `is_nsp_coordinator_of[_for]`) against what this migration redefines,
  the three not directly redefined (`is_nsp_coordinator_of`, `is_pqs_member_of`,
  `is_pqs_writer_of`) all delegate transitively to an already-folded `_for` variant — traced
  and confirmed. `app.is_admin*` is deliberately excluded (R3 ruling; vendor lockout
  avoidance) — correct, since the org-less vendor has no `org_admin` above it to reinstate
  it. Every composite predicate downstream (`can_read_case`, `can_write_capa`,
  `can_read_event`, etc.) builds on the folded `_for` helpers and inherits transitively — no
  gaps found among ~20 composite predicates traced. **The one exception is the RLS-policy-level
  gap in B1**, which sits *beside* the helper fold rather than inside it.
- **`bootstrap_admin` via `app_metadata`**: correctly read from `raw_app_meta_data` (not
  `raw_user_meta_data`), which is service-role-only and not user-editable — a self-signup
  cannot set it. `handle_new_user` only seeds `profiles.is_admin` at creation; the
  authoritative claim still derives from the DB column via the access-token hook, matching
  ADR 0002/0009.
- **`registerUser` atomicity + collision block**: the email-collision pre-check plus the
  `inviteUserByEmail`-race fallback (matching on "already"/"registered" in the error
  message) both block before any write, never absorbing/overwriting an existing identity.
  Failures after the invite (`profileError`, `credError`, `memberError`) are surfaced, not
  swallowed, consistent with `[[phi-write-atomic-with-create]]` discipline even though this
  data isn't PHI.
- **`resolveOrInviteUser`/BUG-UREG-003 fix**: `homeOrganizationId` is now a required,
  compile-time-enforced parameter; all three callers (`members/actions.ts`,
  `admin/actions.ts`, `platform/actions.ts`) correctly resolve and thread a real org id
  before inviting.
- **Inactive-user gating, loop-freedom traced end-to-end**: `signIn` signs out immediately
  on a suspended/deactivated credential match (no session ever established — avoids a
  bare-null-context loop); `getSessionContext().isInactive` is an explicit signal (not
  conflated with "unauthenticated"); `requireUser()` redirects to `/conta-inativa`;
  `src/proxy.ts` allowlists `/conta-inativa` as public AND excludes it from
  `AUTHED_REDIRECT_AWAY` — confirmed no loop is possible in either direction. The
  `organization_members_select` RLS policy backing `context.orgAdminOf` is itself
  `app.is_org_admin_of`-gated (folded), so a deactivated org_admin loses `orgAdminOf` too —
  a second, independent layer behind the `requireUser()` gate.
- **`guard_profile_privileged_columns` widening (R2)**: correctly locks
  `suspended_until`/`email_confirmed_at`/`home_organization_id`/`home_hospital_id`/
  `hospital_employee_id`/`professional_category_id` to service-role-only (the
  `auth.uid() IS NULL` escape), verified by pgTAP (`180_user_registration.sql:208-219`)
  that a signed-in suspended user cannot self-clear `suspended_until` but can still edit
  `full_name`. The trigger is `CREATE OR REPLACE`d in place under the pre-existing
  `BEFORE UPDATE` trigger binding — correct Postgres semantics, no re-attachment needed.
- **`professional_credentials`/`professional_categories` RLS**: credentials SELECT is
  self/org_admin-of-home-org/platform_admin, no write policy (service-role-only path,
  verified: RLS enabled + no INSERT/UPDATE/DELETE policy denies by default); categories
  are any-authenticated-read, platform_admin-write (correct "managed vocabulary" pattern,
  mirrors `pqs_event_types`).
- **No new public RPC introduced** — the action layer writes directly against tables via
  `createAdminClient()`, not new `SECURITY DEFINER` RPCs, so the REVOKE-before-GRANT
  requirement doesn't newly apply beyond `app.is_active` itself, which does have it
  (verified in pgTAP, line 225-228).
- **LGPD minimization**: no `date_of_birth` column anywhere; required fields are exactly
  name/email/category per plan Q10.
- **pt-BR + no raw errors**: every user-facing string in the action layer, forms, lifecycle
  dialogs, and `/conta-inativa` is pt-BR; every Supabase/Postgres error is mapped to a
  generic or field-specific pt-BR message before reaching the client (only the two
  collision-mapping MINORs above are rough edges, not leaks).
- **Frontend a11y**: `Field`/`FieldLabel`/`FieldError`/`aria-describedby` pattern used
  consistently; status is always paired with a pt-BR text label (never color alone);
  destructive lifecycle actions go through `AlertDialog` confirmation; the register form
  uses `role="alert"` for the assertive collision error vs. `role="status"` for other
  banners; `notFound()` is used correctly at both the directory and per-user routes for
  cross-org/foreign-user access (indistinguishable 404, no existence leak) — verified this
  matches the `manage` layout's own `org_admin`-of-`org` gate.
- **Audit coverage (Rule 11)**: profile/credential/committee/lifecycle mutations flow
  through table writes that are covered by the platform's existing mutation-audit
  triggers; no PHI is introduced (professional identity, not patient data — correctly
  scoped outside Rule 12).

## Bug Log cross-check

BUG-UREG-001 (stub layer), BUG-UREG-002 (invite token_hash), and BUG-UREG-003 (member-invite
anchor regression) are all marked RESOLVED in `PROGRESS.md` and independently confirmed
resolved by this review (implementations are real, not stubs; the token_hash template
matches the `/auth/confirm` handler's `verifyOtp({token_hash, type})` shape; all three
`resolveOrInviteUser` callers now thread a real org id). No open Bug Log items for this
feature at time of review.

## Verdict

**CHANGES REQUESTED** — one BLOCKER (B1). Fix the `profiles_select_self_or_admin`
peer-visibility branch to route through a folded helper (or add the `app.is_active`
gate inline), add the regression pgTAP case, and re-run the full pgTAP + E2E suites
(the fix touches RLS the same way BE-2a/BE-3 did, so it warrants the same full-suite
discipline noted in ADR 0048's consequences section). Clear M1-M4 alongside it per the
standing preference for cheap MINORs at phase-record time. No changes needed to the
overall design, the migration's other RLS surfaces, the action layer, or the frontend.
