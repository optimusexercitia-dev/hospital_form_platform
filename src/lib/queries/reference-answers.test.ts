import { describe, expect, it } from 'vitest'

import {
  TOP_LEVEL_SCOPE,
  buildReferenceAnswers,
  type ScopedReferenceRow,
} from '@/lib/queries/responses'

/**
 * FF-5 (ADR 0091) — `buildReferenceAnswers`, the pure read-side shaper.
 *
 * Written while diagnosing BUG-FF5-002 ("Sem resposta" for every TOP-LEVEL
 * reference on the submissions detail view). The defect turned out to be a
 * missing PROP at the page's call site, not a mapping error — but "I read it and
 * it looks right" is the weakest possible way to clear a suspect, and this
 * function was one of two. These tests clear it by construction instead.
 *
 * They also close a real coverage hole: the function is consumed by
 * `getResponseForFill` AND `getSubmissionDetail`, both of which need a live
 * database, so nothing exercised its branches offline.
 */

const ANSWER = { item_id: 'item-1', group_instance_id: null }

function row(over: Partial<ScopedReferenceRow> = {}): ScopedReferenceRow {
  return {
    reference_kind: 'participant',
    participant_id: 'p-1',
    commission_id: null,
    profile_id: null,
    answers: ANSWER,
    participants: { display_name: 'UTI Adulto', participant_type: 'department' },
    commissions: null,
    profiles: null,
    ...over,
  }
}

describe('buildReferenceAnswers', () => {
  it('buckets a top-level row under TOP_LEVEL_SCOPE, keyed by item id', () => {
    const byScope = buildReferenceAnswers([row()])
    expect(byScope.get(TOP_LEVEL_SCOPE)).toEqual({
      'item-1': {
        kind: 'participant',
        targetId: 'p-1',
        label: 'UTI Adulto',
        // pt-BR (Rule 10) — never the raw `department` identifier.
        sublabel: 'Setor',
      },
    })
  })

  it('buckets an instance-scoped row under its instance id, not the top level', () => {
    // The distinction BUG-FF5-002 turned on: in-group references reach the view
    // through `instances`, top-level ones through their own map. A shaper that
    // merged the two would have made the bug invisible in one direction.
    const byScope = buildReferenceAnswers([
      row({ answers: { item_id: 'item-2', group_instance_id: 'gi-9' } }),
    ])
    expect(byScope.get(TOP_LEVEL_SCOPE)).toBeUndefined()
    expect(byScope.get('gi-9')?.['item-2']?.targetId).toBe('p-1')
  })

  it('resolves the commission lane from its own embed', () => {
    const byScope = buildReferenceAnswers([
      row({
        reference_kind: 'commission',
        participant_id: null,
        commission_id: 'c-1',
        participants: null,
        commissions: { name: 'CCIH' },
      }),
    ])
    expect(byScope.get(TOP_LEVEL_SCOPE)?.['item-1']).toEqual({
      kind: 'commission',
      targetId: 'c-1',
      label: 'CCIH',
      sublabel: null,
    })
  })

  it('resolves the user lane, with the e-mail as sublabel', () => {
    const byScope = buildReferenceAnswers([
      row({
        reference_kind: 'user',
        participant_id: null,
        profile_id: 'u-1',
        participants: null,
        profiles: { full_name: 'Enfermeiro CCIH Um', email: 'staff1@test.local' },
      }),
    ])
    expect(byScope.get(TOP_LEVEL_SCOPE)?.['item-1']).toEqual({
      kind: 'user',
      targetId: 'u-1',
      label: 'Enfermeiro CCIH Um',
      sublabel: 'staff1@test.local',
    })
  })

  it('falls back to the target id when the lane row has no name', () => {
    // `on delete restrict` makes a dangling target impossible, so a null label
    // means the row's own name column is null. Render the id, never a blank.
    const byScope = buildReferenceAnswers([
      row({ participants: { display_name: null, participant_type: 'department' } }),
    ])
    expect(byScope.get(TOP_LEVEL_SCOPE)?.['item-1']?.label).toBe('p-1')
  })

  it('drops a row whose reference_kind is not a known lane', () => {
    // Unreachable today (the CHECK pins three lanes); keeps a future
    // hospital/org lane from rendering as an unlabelled field in a client that
    // predates it.
    expect(
      buildReferenceAnswers([row({ reference_kind: 'hospital' })]).size,
    ).toBe(0)
  })

  it('returns an empty map for no rows — the shape a caller spreads', () => {
    // `getSubmissionDetail` does `referencesByScope.get(TOP_LEVEL_SCOPE) ?? {}`,
    // so "no references" must be an absent bucket, not a throw.
    const byScope = buildReferenceAnswers([])
    expect(byScope.size).toBe(0)
    expect(byScope.get(TOP_LEVEL_SCOPE) ?? {}).toEqual({})
  })
})
