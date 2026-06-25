import { describe, expect, it } from 'vitest'

import { commissionHref, orgHref } from './routing'

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
