import { describe, expect, it } from 'vitest'

import { generateOptionCode, resolveOptionCodes, slugifyLabel } from './option-code'

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

/**
 * BUG-FF2-004 — `slugifyLabel` mangled every accented pt-BR label.
 *
 * NFD decomposes an accented letter into base + combining mark; the old code
 * went straight to `replace(/[^a-z0-9]+/g, '_')`, which turned each mark into a
 * '_' SEPARATOR instead of deleting it. `Higienização das mãos` minted
 * `higienizac_a_o_das_ma_os`. Portuguese being what it is, that hit most real
 * labels — and question_keys are the cross-version aggregation key, so the
 * damage was permanent per form.
 *
 * MUTATION: drop the `.replace(/[̀-ͯ]/g, '')` line -> every case in
 *   the first block goes red.
 */
describe('slugifyLabel — pt-BR diacritics (BUG-FF2-004)', () => {
  it.each([
    ['Higienização das mãos', 'higienizacao_das_maos'],
    ['Não conforme', 'nao_conforme'],
    ['Ações e Opções', 'acoes_e_opcoes'],
    ['Câmara Três Ônibus', 'camara_tres_onibus'],
    ['À noite', 'a_noite'],
    ['Água potável', 'agua_potavel'],
    ['Índice de infecção', 'indice_de_infeccao'],
    ['Óbito', 'obito'],
    ['Última revisão', 'ultima_revisao'],
    ['Bilíngue', 'bilingue'],
    ['Coração, pulmão e rim', 'coracao_pulmao_e_rim'],
  ])('%s -> %s', (label, expected) => {
    expect(slugifyLabel(label)).toBe(expected)
  })

  it('strips marks from UPPERCASE accented letters too', () => {
    // Uppercase decomposes the same way; the strip must run before/independent
    // of lowercasing or 'Á' would survive as 'a_'.
    expect(slugifyLabel('ÁGUA E ESGOTO')).toBe('agua_e_esgoto')
  })

  it('covers every mark pt-BR produces under NFD', () => {
    expect(slugifyLabel('ç ã õ á é í ó ú â ê ô à ü')).toBe(
      'c_a_o_a_e_i_o_u_a_e_o_a_u',
    )
  })
})

describe('slugifyLabel — shape invariants unchanged by the fix', () => {
  it('collapses punctuation and whitespace runs, and trims the edges', () => {
    expect(slugifyLabel('  Qual  é  o   turno? ')).toBe('qual_e_o_turno')
  })

  it('falls back to "pergunta" for empty and diacritic-only labels', () => {
    expect(slugifyLabel('')).toBe('pergunta')
    expect(slugifyLabel('   ')).toBe('pergunta')
    // Marks alone now vanish entirely rather than becoming underscores, so this
    // reaches the fallback where it used to yield a run of separators.
    expect(slugifyLabel('~~~')).toBe('pergunta')
  })

  it('caps the base at 40 characters', () => {
    expect(slugifyLabel('a'.repeat(100))).toHaveLength(40)
    // Stripped marks make slugs SHORTER, so a label that used to be truncated
    // may now fit — the cap still holds.
    expect(slugifyLabel('ção '.repeat(30)).length).toBeLessThanOrEqual(40)
  })
})

describe('code minting stays collision-free with the shorter slugs', () => {
  // Shorter bases mean more labels share a base, so the suffix carries more of
  // the uniqueness load. Both mint paths must still never repeat a code.
  it('generateOptionCode never returns a code already in `taken`', () => {
    const taken = new Set<string>()
    const codes = Array.from({ length: 200 }, () =>
      generateOptionCode('Higienização das mãos', taken),
    )
    expect(new Set(codes).size).toBe(200)
    expect(codes.every((c) => /^higienizacao_das_maos_[a-z0-9]+$/.test(c))).toBe(true)
  })

  it('resolveOptionCodes de-collides two options with the SAME accented label', () => {
    const codes = resolveOptionCodes([], [
      { code: '', label: 'Não conforme' },
      { code: '', label: 'Não conforme' },
    ])
    expect(codes[0]).not.toBe(codes[1])
    expect(codes.every((c) => c.startsWith('nao_conforme_'))).toBe(true)
  })

  it('never re-mints a code that already exists on the item (immutability)', () => {
    // The whole point of the forward-only posture: an existing code is carried
    // through verbatim even though slugifyLabel would now produce a different
    // base for the same label.
    const [kept] = resolveOptionCodes(['higienizac_a_o_das_ma_os_111111'], [
      { code: 'higienizac_a_o_das_ma_os_111111', label: 'Higienização das mãos' },
    ])
    expect(kept).toBe('higienizac_a_o_das_ma_os_111111')
  })
})
