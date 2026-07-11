import { describe, expect, it } from 'vitest'

import { resolveOptionCodes } from './option-code'

/**
 * Unit coverage for `resolveOptionCodes` — the option-code decision that
 * `reconcileOptionRows` (server, `actions.ts`) delegates to. Pure logic, no IO.
 *
 * The load-bearing case is BUG-AMV2-002: a brand-new choice item (no existing
 * codes) whose options arrive with client-minted codes MUST keep those codes,
 * so a "Valor padrão" set in the same dialog still points at a real option code
 * and survives `publish_form_version` (HC080, "valor padrão inválido"). The
 * regression was that new rows were re-coded server-side (the old
 * `existingCodes.has(code)` gate), orphaning the default. The generated-code
 * shape is `slug(label)_suffix`; the random suffix means minted codes are
 * asserted by shape/uniqueness, honored codes by exact equality.
 */

const opt = (code: string, label: string) => ({ code, label })
// slug(label) is `[a-z0-9_]+`; the suffix is `[a-z0-9]+` (see generateOptionCode).
const CODE_SHAPE = /^[a-z0-9_]+_[a-z0-9]+$/

describe('resolveOptionCodes', () => {
  it('BUG-AMV2-002: honors client-minted codes on a brand-new item (empty existing set)', () => {
    const options = [opt('tarde_a1b2c3', 'Tarde'), opt('manha_d4e5f6', 'Manhã')]
    // No existing codes (adding a new item) — the client codes must survive
    // verbatim so a choice default referencing them is not orphaned.
    expect(resolveOptionCodes([], options)).toEqual(['tarde_a1b2c3', 'manha_d4e5f6'])
  })

  it('preserves a kept row’s existing code (analytics identity is stable)', () => {
    const options = [opt('sim_111111', 'Sim'), opt('nao_222222', 'Não')]
    expect(resolveOptionCodes(['sim_111111', 'nao_222222'], options)).toEqual([
      'sim_111111',
      'nao_222222',
    ])
  })

  it('mints a fresh code only for a code-less row, keeping the coded ones', () => {
    const options = [opt('sim_111111', 'Sim'), opt('', 'Talvez')]
    const [kept, minted] = resolveOptionCodes(['sim_111111'], options)
    expect(kept).toBe('sim_111111')
    expect(minted).toMatch(CODE_SHAPE)
    expect(minted).toMatch(/^talvez_/)
    expect(minted).not.toBe('sim_111111')
  })

  it('returns one code per option, aligned by index and order-preserving', () => {
    const options = [opt('a_100000', 'A'), opt('', 'B'), opt('c_300000', 'C')]
    const codes = resolveOptionCodes([], options)
    expect(codes).toHaveLength(3)
    expect(codes[0]).toBe('a_100000')
    expect(codes[2]).toBe('c_300000')
    expect(codes[1]).toMatch(CODE_SHAPE)
  })

  it('de-collides duplicate submitted codes: first wins, the rest are regenerated', () => {
    const options = [opt('dup_aaaaaa', 'One'), opt('dup_aaaaaa', 'Two')]
    const [first, second] = resolveOptionCodes([], options)
    expect(first).toBe('dup_aaaaaa')
    expect(second).not.toBe('dup_aaaaaa')
    expect(second).toMatch(CODE_SHAPE)
    expect(new Set([first, second]).size).toBe(2)
  })

  it('never mints a code that collides with an existing DB code', () => {
    const existing = ['talvez_999999']
    const options = [opt('talvez_999999', 'Talvez'), opt('', 'Talvez também')]
    const [kept, minted] = resolveOptionCodes(existing, options)
    expect(kept).toBe('talvez_999999')
    expect(minted).not.toBe('talvez_999999')
    expect(minted).toMatch(CODE_SHAPE)
  })

  it('mints for every row when none supply a code (legacy client)', () => {
    const options = [opt('', 'Sim'), opt('', 'Não')]
    const codes = resolveOptionCodes([], options)
    expect(codes[0]).toMatch(CODE_SHAPE)
    expect(codes[1]).toMatch(CODE_SHAPE)
    expect(codes[0]).toMatch(/^sim_/) // 'Sim' has no diacritics → clean slug
    expect(new Set(codes).size).toBe(2)
  })

  it('is a safe no-op on an empty option list', () => {
    expect(resolveOptionCodes([], [])).toEqual([])
  })
})
