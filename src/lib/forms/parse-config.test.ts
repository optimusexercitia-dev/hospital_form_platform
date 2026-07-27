import { describe, expect, it } from 'vitest'

import { parseItemConfig } from './parse-config'

/** Build a FormData from a plain record (all values stringified). */
function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

/** Narrow the parse result to its `config` object (fails the test on an error). */
function cfg(res: ReturnType<typeof parseItemConfig>): Record<string, unknown> {
  if ('error' in res) throw new Error(`unexpected parse error: ${res.error}`)
  expect(res.config).not.toBeNull()
  return res.config as Record<string, unknown>
}

describe('parseItemConfig — the ACTION path (addItem/updateItem) config parse', () => {
  it('empty config → null', () => {
    expect(parseItemConfig('free_text', fd({}))).toEqual({ config: null })
    expect(parseItemConfig('multiple_choice', fd({}))).toEqual({ config: null })
  })

  // -- number/date bounds -----------------------------------------------------
  it('number min/max → config.min/max as numbers', () => {
    const c = cfg(parseItemConfig('number', fd({ configMin: '1', configMax: '10' })))
    expect(c.min).toBe(1)
    expect(c.max).toBe(10)
  })

  it('number min > max → range error', () => {
    const res = parseItemConfig('number', fd({ configMin: '10', configMax: '1' }))
    expect('error' in res).toBe(true)
  })

  it('date bounds keep ISO strings', () => {
    const c = cfg(parseItemConfig('date', fd({ configMin: '2026-01-01' })))
    expect(c.min).toBe('2026-01-01')
  })

  // -- length limits ----------------------------------------------------------
  it('free_text minLength/maxLength → integers', () => {
    const c = cfg(
      parseItemConfig('short_text', fd({ configMinLength: '5', configMaxLength: '10' })),
    )
    expect(c.minLength).toBe(5)
    expect(c.maxLength).toBe(10)
  })

  it('length limits reject non-integer / negative', () => {
    expect('error' in parseItemConfig('free_text', fd({ configMinLength: '2.5' }))).toBe(true)
    expect('error' in parseItemConfig('free_text', fd({ configMinLength: '-1' }))).toBe(true)
  })

  it('minLength > maxLength → range error', () => {
    expect(
      'error' in parseItemConfig('free_text', fd({ configMinLength: '10', configMaxLength: '5' })),
    ).toBe(true)
  })

  it('length fields are ignored for non-text types', () => {
    // A number item never reads configMinLength.
    expect(parseItemConfig('number', fd({ configMinLength: '5' }))).toEqual({ config: null })
  })

  // -- allowOther -------------------------------------------------------------
  it('configAllowOther=1 → config.allowOther=true (MC/checkbox only)', () => {
    expect(cfg(parseItemConfig('multiple_choice', fd({ configAllowOther: '1' }))).allowOther).toBe(true)
    expect(cfg(parseItemConfig('checkbox', fd({ configAllowOther: '1' }))).allowOther).toBe(true)
    // dropdown never offers "Outros".
    expect(parseItemConfig('dropdown', fd({ configAllowOther: '1' }))).toEqual({ config: null })
  })

  // -- flaggedWhen (the previously-untested ACTION path; the 202 gap) ---------
  it('configFlaggedWhen JSON → config.flaggedWhen {op,value}', () => {
    const c = cfg(
      parseItemConfig('number', fd({ configFlaggedWhen: JSON.stringify({ op: 'gt', value: 5 }) })),
    )
    expect(c.flaggedWhen).toEqual({ op: 'gt', value: 5 })
  })

  it('flaggedWhen works for date + time value strings', () => {
    const cd = cfg(
      parseItemConfig('date', fd({ configFlaggedWhen: JSON.stringify({ op: 'gte', value: '2026-07-01' }) })),
    )
    expect(cd.flaggedWhen).toEqual({ op: 'gte', value: '2026-07-01' })
    const ct = cfg(
      parseItemConfig('time', fd({ configFlaggedWhen: JSON.stringify({ op: 'lt', value: '09:30' }) })),
    )
    expect(ct.flaggedWhen).toEqual({ op: 'lt', value: '09:30' })
  })

  it('flaggedWhen rejects a malformed op', () => {
    // `in` is not a flaggedWhen op → error.
    expect(
      'error' in parseItemConfig('number', fd({ configFlaggedWhen: JSON.stringify({ op: 'in', value: 5 }) })),
    ).toBe(true)
  })

  it('flaggedWhen rejects invalid JSON', () => {
    expect('error' in parseItemConfig('number', fd({ configFlaggedWhen: '{not json' }))).toBe(true)
  })

  it('flaggedWhen rejects a missing/object value', () => {
    expect(
      'error' in parseItemConfig('number', fd({ configFlaggedWhen: JSON.stringify({ op: 'gt' }) })),
    ).toBe(true)
    expect(
      'error' in
        parseItemConfig('number', fd({ configFlaggedWhen: JSON.stringify({ op: 'gt', value: { a: 1 } }) })),
    ).toBe(true)
  })

  it('flaggedWhen is ignored for non-number/date/time types', () => {
    // A free_text item never reads configFlaggedWhen.
    expect(
      parseItemConfig('free_text', fd({ configFlaggedWhen: JSON.stringify({ op: 'gt', value: 5 }) })),
    ).toEqual({ config: null })
  })

  // -- combined ---------------------------------------------------------------
  it('number can carry BOTH bounds and flaggedWhen', () => {
    const c = cfg(
      parseItemConfig(
        'number',
        fd({ configMin: '0', configMax: '100', configFlaggedWhen: JSON.stringify({ op: 'gt', value: 90 }) }),
      ),
    )
    expect(c.min).toBe(0)
    expect(c.max).toBe(100)
    expect(c.flaggedWhen).toEqual({ op: 'gt', value: 90 })
  })
  // -- FF-1: repeating-group cardinality (ADR 0087) ---------------------------
  it('repeating_group min/max instances → config.minInstances/maxInstances', () => {
    const c = cfg(
      parseItemConfig(
        'repeating_group',
        fd({ configMinInstances: '1', configMaxInstances: '5' }),
      ),
    )
    // The KEY NAMES are the contract with `ItemConfig` in queries/forms.ts — the
    // read side (`toConfig`) looks for exactly these. Renaming either silently
    // breaks the round trip without any type error, so pin them literally.
    expect(c.minInstances).toBe(1)
    expect(c.maxInstances).toBe(5)
    expect(Object.keys(c).sort()).toEqual(['maxInstances', 'minInstances'])
  })

  it('a lone minimum is kept (that is how a repeating group becomes required)', () => {
    const c = cfg(parseItemConfig('repeating_group', fd({ configMinInstances: '2' })))
    expect(c.minInstances).toBe(2)
    expect('maxInstances' in c).toBe(false)
  })

  it('min > max → range error', () => {
    const res = parseItemConfig(
      'repeating_group',
      fd({ configMinInstances: '5', configMaxInstances: '2' }),
    )
    expect('error' in res).toBe(true)
  })

  it('non-integer / negative counts are rejected', () => {
    expect(
      'error' in parseItemConfig('repeating_group', fd({ configMinInstances: '1.5' })),
    ).toBe(true)
    expect(
      'error' in parseItemConfig('repeating_group', fd({ configMinInstances: '-1' })),
    ).toBe(true)
    expect(
      'error' in parseItemConfig('repeating_group', fd({ configMaxInstances: 'muitas' })),
    ).toBe(true)
  })

  it('a plain `group` has NO instances, so cardinality is ignored (ruling 6)', () => {
    expect(
      parseItemConfig('group', fd({ configMinInstances: '1', configMaxInstances: '5' })),
    ).toEqual({ config: null })
  })

  it('an ordinary input type never picks up instance cardinality', () => {
    expect(
      parseItemConfig('short_text', fd({ configMinInstances: '3' })),
    ).toEqual({ config: null })
  })
})
