import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  activeMembers,
  profileIsActive,
  type MemberListItem,
} from '@/lib/queries/members'

/**
 * FUP-BULK-1 — the roster's activity predicate must agree with the DOOR's.
 *
 * Every assignee-taking RPC gates its owner on `app.is_member_of_for` →
 * `app.is_active`, whose body is:
 *
 *   coalesce(
 *     (select is_active and (suspended_until is null or now() >= suspended_until)
 *      from public.profiles where id = p_user_id),
 *     false)
 *
 * `profileIsActive` is the TS mirror. These cases exist because the disagreement was
 * INVISIBLE without them: the wizard offered a suspended member, the deal is random,
 * and the resulting HC021 read as a ~22% "flaky" E2E failure rather than as a bug.
 * Each branch below is one way the two can drift apart again.
 */

const HOUR = 60 * 60 * 1000

afterEach(() => {
  vi.useRealTimers()
})

describe('profileIsActive — the TS mirror of app.is_active', () => {
  it('is true for an active profile with no suspension', () => {
    expect(
      profileIsActive({
        full_name: 'Ativa',
        email: 'a@x',
        is_active: true,
        suspended_until: null,
      }),
    ).toBe(true)
  })

  it('is FALSE while a suspension has not lapsed (the FUP-BULK-1 member)', () => {
    expect(
      profileIsActive({
        full_name: 'Suspenso Temporário',
        email: 'suspenso.temp@test.local',
        is_active: true,
        suspended_until: new Date(Date.now() + 24 * HOUR).toISOString(),
      }),
    ).toBe(false)
  })

  it('is true once the suspension has lapsed — `now() >= suspended_until`', () => {
    expect(
      profileIsActive({
        full_name: 'Reativado',
        email: 'r@x',
        is_active: true,
        suspended_until: new Date(Date.now() - 1).toISOString(),
      }),
    ).toBe(true)
  })

  it('treats the boundary instant as ACTIVE, matching SQL `>=` and not `>`', () => {
    const instant = new Date('2026-08-04T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(instant)
    expect(
      profileIsActive({
        full_name: 'Limite',
        email: 'l@x',
        is_active: true,
        suspended_until: instant.toISOString(),
      }),
    ).toBe(true)
  })

  it('is false for a deactivated account even with no suspension', () => {
    expect(
      profileIsActive({
        full_name: 'Desativado Conta',
        email: 'desativado.conta@test.local',
        is_active: false,
        suspended_until: null,
      }),
    ).toBe(false)
  })

  // The `coalesce(..., false)` arm: an absent profile is NOT active. A membership row
  // whose profile embed came back null (RLS-hidden or deleted) must never be handed
  // an assignment on the strength of "we could not tell".
  it('fails CLOSED for an absent profile', () => {
    expect(profileIsActive(null)).toBe(false)
  })

  it('fails CLOSED for a null is_active and for an unparseable timestamp', () => {
    expect(
      profileIsActive({
        full_name: null,
        email: null,
        is_active: null,
        suspended_until: null,
      }),
    ).toBe(false)
    expect(
      profileIsActive({
        full_name: null,
        email: null,
        is_active: true,
        suspended_until: 'not-a-timestamp',
      }),
    ).toBe(false)
  })
})

describe('activeMembers', () => {
  const member = (
    userId: string,
    isActive: boolean,
  ): MemberListItem => ({
    memberId: `m-${userId}`,
    userId,
    fullName: userId,
    email: `${userId}@test.local`,
    role: 'staff',
    joinedAt: '2026-01-01T00:00:00.000Z',
    titleId: null,
    titleName: null,
    isActive,
  })

  it('drops exactly the inactive members and preserves order', () => {
    const roster = [
      member('chefe', true),
      member('suspenso', false),
      member('enfermeiro', true),
    ]
    expect(activeMembers(roster).map((m) => m.userId)).toEqual([
      'chefe',
      'enfermeiro',
    ])
  })

  it('returns an empty list rather than throwing when nobody is assignable', () => {
    expect(activeMembers([member('suspenso', false)])).toEqual([])
  })
})
