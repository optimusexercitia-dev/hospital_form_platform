import { describe, expect, it } from 'vitest'

import { commissionHref, notificationHref, orgHref } from './routing'

describe('commissionHref', () => {
  it('builds the bare commission base with no segments', () => {
    expect(commissionHref('org-a', 'ccih')).toBe('/o/org-a/c/ccih')
  })

  it('appends multiple path segments', () => {
    expect(commissionHref('org-a', 'ccih', 'manage', 'forms')).toBe(
      '/o/org-a/c/ccih/manage/forms',
    )
  })

  it('accepts numeric segments', () => {
    expect(commissionHref('org-a', 'ccih', 'forms', 42)).toBe(
      '/o/org-a/c/ccih/forms/42',
    )
  })

  it('never emits a double slash and drops empty segments', () => {
    const href = commissionHref('org-a', 'ccih', '', 'dashboard')
    expect(href).toBe('/o/org-a/c/ccih/dashboard')
    expect(href).not.toMatch(/\/\//)
  })

  it('encodes reserved characters in segments', () => {
    expect(commissionHref('org-a', 'ccih', 'a b/c')).toBe(
      '/o/org-a/c/ccih/a%20b%2Fc',
    )
  })
})

describe('orgHref', () => {
  it('builds the bare org base with no segments', () => {
    expect(orgHref('org-a')).toBe('/o/org-a')
  })

  it('appends the manage area path', () => {
    expect(orgHref('org-a', 'manage', 'comissoes')).toBe(
      '/o/org-a/manage/comissoes',
    )
  })

  it('never emits a double slash', () => {
    expect(orgHref('org-a', '', 'manage')).toBe('/o/org-a/manage')
  })
})

describe('notificationHref', () => {
  it('routes a meeting notification to the meeting detail page', () => {
    expect(
      notificationHref({
        entityType: 'meeting',
        entityId: 'meeting-1',
        orgSlug: 'org-a',
        commissionSlug: 'ccih',
      }),
    ).toBe('/o/org-a/c/ccih/meetings/meeting-1')
  })

  it('routes a signoff notification to the queue page, ignoring entityId', () => {
    expect(
      notificationHref({
        entityType: 'response_section_signoff',
        entityId: 'response-1',
        orgSlug: 'org-a',
        commissionSlug: 'ccih',
      }),
    ).toBe('/o/org-a/c/ccih/manage/assinaturas')
  })

  it('routes a capa_action notification to the static personal page (BUG-N-001), never a PQS-gated route', () => {
    expect(
      notificationHref({ entityType: 'capa_action', entityId: 'action-1' }),
    ).toBe('/conta/itens-de-acao')
  })

  it('routes capa_action statically regardless of any org/commission context', () => {
    // No org/commission is needed or consulted — the point is a link no
    // per-recipient RLS lookup can fail to resolve.
    expect(
      notificationHref({
        entityType: 'capa_action',
        entityId: 'action-2',
        orgSlug: 'org-a',
        commissionSlug: 'ccih',
      }),
    ).toBe('/conta/itens-de-acao')
  })

  it('falls back to # when the commission slug is missing (meeting/signoff)', () => {
    expect(
      notificationHref({ entityType: 'meeting', entityId: 'm1', orgSlug: 'org-a' }),
    ).toBe('#')
    expect(
      notificationHref({
        entityType: 'response_section_signoff',
        entityId: 'r1',
        orgSlug: 'org-a',
      }),
    ).toBe('#')
  })
})
