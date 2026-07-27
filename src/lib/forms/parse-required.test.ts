import { describe, expect, it } from 'vitest'

import { parseRequired } from './parse-required'

/**
 * Regression coverage for BUG-FF1-002 (Blocker).
 *
 * ADR 0087 ruling 4 drops `form_items_conditional_not_required` platform-wide,
 * so "obrigatória" is authorable BESIDE a visibility condition. The action layer
 * kept clearing `required` whenever a condition was present — defending a CHECK
 * that no longer existed — so the builder looked correct while the value was
 * discarded on save.
 *
 * KEYSTONE INTENT: reinstate the interlock (AND `required` with
 * `visibleWhen === null`) and these must go red. They are written so that is
 * unavoidable: the decisive cases submit `required` TOGETHER WITH a
 * `visibleWhen` payload, which is the exact combination the old code zeroed and
 * the only one that distinguishes the two implementations.
 */

/** Build a FormData from a plain record (all values stringified). */
function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const CONDITION = JSON.stringify({
  question_key: 'tipo',
  op: 'equals',
  value: 'medicacao',
})

describe('parseRequired — ruling 4, required survives a condition', () => {
  it('an UNCONDITIONAL item keeps required (the pre-FF-1 behaviour)', () => {
    expect(parseRequired(fd({ required: 'on' }))).toBe(true)
  })

  it('a CONDITIONAL item ALSO keeps required (the ruling-4 reversal)', () => {
    // The decisive case. Under the old interlock this returned false, silently,
    // with no error surfaced anywhere — "se tipo = medicação, o nome do
    // medicamento é obrigatório" is the ordinary authoring case FF-1 exists for.
    expect(parseRequired(fd({ required: 'on', visibleWhen: CONDITION }))).toBe(
      true,
    )
  })

  it('a conditional GROUP-scoped payload keeps it too', () => {
    // The same defect hit repeating-group children, which always arrive with a
    // parentItemId; assert the parser is blind to that routing field as well.
    expect(
      parseRequired(
        fd({ required: 'on', visibleWhen: CONDITION, parentItemId: 'grp-1' }),
      ),
    ).toBe(true)
  })

  it('an unchecked box is not required, with or without a condition', () => {
    // Guards the reversal from over-correcting into "always required".
    expect(parseRequired(fd({}))).toBe(false)
    expect(parseRequired(fd({ visibleWhen: CONDITION }))).toBe(false)
  })

  it('only the checkbox value "on" counts', () => {
    expect(parseRequired(fd({ required: '' }))).toBe(false)
    expect(parseRequired(fd({ required: 'true' }))).toBe(false)
  })
})
