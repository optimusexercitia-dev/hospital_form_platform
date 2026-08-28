import { execSync } from 'node:child_process'
import { test, expect } from '@playwright/test'

import { cachedSignIn } from './helpers/auth'

/**
 * FUP-MEM-2 — platform org_admin provisioning, the one caller `293` could not reach.
 *
 * ADR 0094 W3/T3.3 moved `assignOrgAdmin` (`src/lib/platform/actions.ts`) off raw
 * `memberships` DML and onto the `public.grant_role_for` service door. Five of the six
 * migrated callers had an E2E spec; this one had none, because nothing in `e2e/` drove
 * the platform organisation area at all. pgTAP `293`'s equivalence grid proves the DOOR
 * (both entry points agree on the `organization × org_admin` cell) — but a green DB bar
 * cannot see the WIRING, and the wiring is where FF-1 hid three live bugs through lint,
 * tsc, build, 457 unit tests and 3919 pgTAP assertions.
 *
 * The wiring claim under test is specific, not "it works": the action must pass the
 * **platform admin's own uid** as `p_actor`. `app.grant_role_impl` admits the org_admin
 * grant via `app.is_admin_for(p_actor)` — the tenancy arm of the noun rule — and stamps
 * `granted_by = p_actor`. So `granted_by` is the observable that separates "the right
 * actor reached the door" from "something reached the door": pass the invited user, or
 * the service client's absent `auth.uid()`, and the call either 42501s or attributes the
 * grant to the wrong principal. Asserting only that the membership row EXISTS would pass
 * in both of those broken worlds.
 *
 *   MEM2-1  provisioning by email seats org_admin, attributed to the platform admin,
 *           and anchors the invited profile to the target org (the deferred-anchor
 *           invariant the action's own comment claims).
 *   MEM2-2  re-provisioning the same pair is idempotent — one row, not two (the
 *           kernel's `on conflict do nothing`, which the old direct INSERT relied on
 *           the same way).
 *   MEM2-3  the door is platform-only: an org_admin of another org cannot reach /admin.
 */

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/** Seeded identifiers. */
const ORG_B = '0c000000-0000-0000-0000-00000000000b'
const ORG_B_NAME = 'Rede Hospitalar B'
const PLATFORM_UID = '00000000-0000-0000-0000-0000000000b0'

/**
 * A dedicated invitee, never a seed persona. `seed.sql` is a contract ~900 tests read
 * from, and granting org_admin to one of its personas would change what every roster,
 * dashboard and isolation spec sees. This address belongs to this file alone, and is
 * purged both BEFORE and AFTER so a leaked row from an aborted run cannot make a later
 * run pass for the wrong reason (or fail in another file).
 */
const INVITEE = 'e2e.mem2.orgadmin@test.local'

function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`,
    { encoding: 'utf8' },
  )
    .toString()
    .trim()
}

/**
 * Delete the invitee BY IDENTITY (its e-mail), never by position. A `.first()`-shaped
 * teardown once deleted a seed row and killed later batches in other files during
 * *setup* — so this names exactly one address and touches nothing else.
 */
/**
 * Remove only what this file GRANTS — the org_admin membership — and deliberately leave
 * the invited profile and auth user behind.
 *
 * ⚠ Two product invariants make the obvious teardown impossible, and both were learned
 * the hard way here:
 *   1. `guard_profile_no_delete` — *"profiles are never deleted; deactivate via
 *      is_active"*. There is no GUC escape; the guard raises unconditionally. A teardown
 *      that deletes a profile is not cleaning up, it is fighting a designed invariant.
 *   2. `profiles.id` FKs `auth.users.id` with no cascade, so the auth user cannot go
 *      either while its profile stands.
 *
 * ⚠ And this teardown ran green for a day without ever executing: MEM2-1 was failing
 * BEFORE it created the invitee, so the purge always matched zero rows. A teardown is
 * only exercised once the test it cleans up after starts passing — do not read "the
 * suite is green" as "the teardown works".
 *
 * Leaving the profile is harmless and keeps the file idempotent. On a fresh DB (every
 * gate batch resets) the invitee does not exist, so MEM2-1 exercises the INVITE path; on
 * a repeat local run `resolveOrInviteUser` resolves the existing user instead. The
 * assertions — `granted_by` and the org anchor — hold either way, because the membership
 * is what this file creates and destroys.
 */
function purgeInvitee(): void {
  sql(
    `delete from public.memberships m using public.profiles p ` +
      `where m.principal_id = p.id and p.email = '${INVITEE}';`,
  )
}

test.beforeAll(() => {
  purgeInvitee()
})

test.afterAll(() => {
  purgeInvitee()
})

test.describe.configure({ mode: 'serial' })

test('MEM2-1: the platform admin seats an org_admin by e-mail, through the door, attributed to itself', async ({
  page,
}) => {
  await cachedSignIn(page, 'platform@test.local')
  await page.goto('/admin')

  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Administrador da organização' }) })
  await expect(section).toBeVisible({ timeout: 30_000 })

  await section.getByLabel('Organização').selectOption({ label: ORG_B_NAME })
  await section.getByLabel('E-mail').fill(INVITEE)
  await section.getByRole('button', { name: 'Atribuir administrador' }).click()

  await expect(
    page.getByText('Administrador(a) da organização atribuído(a) com sucesso.'),
  ).toBeVisible({ timeout: 30_000 })

  // ── DB truth ──────────────────────────────────────────────────────────────
  // One ORG-tier org_admin row for the invitee on rede B. `commission_id is null`
  // is part of the claim: the org tier is what makes a principal able to hold
  // org_admin AND nsp_org_admin of the same organisation.
  const row = sql(
    `select coalesce(m.granted_by::text,'<null>') || '|' || coalesce(m.commission_id::text,'<null>') ` +
      `from public.memberships m join public.profiles p on p.id = m.principal_id ` +
      `where p.email = '${INVITEE}' and m.role = 'org_admin' and m.organization_id = '${ORG_B}';`,
  )

  // THE wiring assertion. `grant_role_impl` stamps granted_by = p_actor, so this is
  // the platform admin's uid iff the action forwarded the authorized session's actor.
  expect(row).toBe(`${PLATFORM_UID}|<null>`)

  // The action's other claim: a tenant user must end up BELONGING to the org it was
  // seated on. ⭐ THE SUBSTRATE CHANGED AND THE ASSERTION GOT STRONGER, not weaker.
  // This read `profiles.home_organization_id` until the AE2 drop — a column
  // `handle_new_user` copied out of invite metadata, so it asserted that the INVITE
  // carried the right org, and would have stayed green even if the seating produced no
  // tenancy at all. The org association now comes from `app.grant_role_impl` →
  // `app.ensure_provisioned_org_affiliation` (ADR 0166), so the honest question is
  // whether a LIVE affiliation exists — which is also what the directory, the pickers
  // and every authority predicate actually read.
  //
  // ⚠ Asserted as an exact `1|<tense>` rather than a bare count: a row that exists but
  // is ended-or-voided is not a tenancy, and `count >= 1` would not know the difference.
  const orgTenancy = sql(
    `select count(*)::text || '|' || coalesce(bool_or(oa.ended_on is null and oa.voided_at is null)::text,'none') ` +
      `from public.organization_affiliations oa join public.profiles p on p.id = oa.principal_id ` +
      `where p.email = '${INVITEE}' and oa.organization_id = '${ORG_B}';`,
  )
  expect(orgTenancy).toBe('1|true')
})

test('MEM2-2: re-provisioning the same person on the same organisation stays at ONE row', async ({
  page,
}) => {
  await cachedSignIn(page, 'platform@test.local')
  await page.goto('/admin')

  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Administrador da organização' }) })
  await section.getByLabel('Organização').selectOption({ label: ORG_B_NAME })
  await section.getByLabel('E-mail').fill(INVITEE)
  await section.getByRole('button', { name: 'Atribuir administrador' }).click()

  await expect(
    page.getByText('Administrador(a) da organização atribuído(a) com sucesso.'),
  ).toBeVisible({ timeout: 30_000 })

  const count = sql(
    `select count(*) from public.memberships m join public.profiles p on p.id = m.principal_id ` +
      `where p.email = '${INVITEE}' and m.role = 'org_admin' and m.organization_id = '${ORG_B}';`,
  )
  expect(count).toBe('1')
})

test('MEM2-3: an org_admin of another organisation cannot reach the platform area', async ({
  page,
}) => {
  await cachedSignIn(page, 'orgadmin.a@test.local')
  await page.goto('/admin')

  // The route is platform-only; a tenant admin never sees the provisioning form.
  await expect(
    page.getByRole('heading', { name: 'Administrador da organização' }),
  ).toHaveCount(0)
})
