import { describe, expect, it } from 'vitest'

import {
  PARTICIPANT_TYPES,
  PARTICIPANT_TYPE_LABELS,
  participantTypeLabel,
} from '@/lib/forms/reference-constants'

/**
 * FF-5 (ADR 0091) — the TS half of a MIRRORED SQL/TS vocabulary.
 *
 * `app.participant_type_label` (SQL) and `PARTICIPANT_TYPE_LABELS` (TS) both
 * translate `participants.participant_type` for display. Two copies are
 * structurally necessary — the builder renders labels for types the user has not
 * chosen yet, entirely client-side, while the sign-off projection is DEFINER SQL
 * — so this is the same mirrored-evaluator situation ARCHITECTURE.md already
 * governs, and it carries the same obligation: the pair must not drift.
 *
 * ⚠ THE POINT OF THIS FILE IS THAT THE LITERALS ARE THE SHARED VECTOR. Asserting
 * `PARTICIPANT_TYPE_LABELS.patient === PARTICIPANT_TYPE_LABELS.patient` would be
 * vacuous — it cannot fail. The seven expected strings are written out BY HAND
 * below, and the FF-5 pgTAP suite asserts the identical seven against the SQL
 * function. Changing a label on one side alone reds one of the two suites.
 *
 * This is the "encode load-bearing claims executably" rule: the claim "SQL and
 * TS agree on this vocabulary" is otherwise a comment, and a comment is an
 * assertion that goes stale silently.
 */

/** The shared vector. Keep byte-identical to `app.participant_type_label`. */
const EXPECTED: Readonly<Record<string, string>> = {
  patient: 'Paciente',
  professional: 'Profissional',
  external_person: 'Pessoa externa',
  department: 'Setor',
  institution: 'Instituição',
  regulatory_body: 'Órgão regulador',
  other: 'Outro',
}

describe('participant type labels — the TS half of the SQL/TS mirror', () => {
  it('maps all seven types to the exact pt-BR strings the SQL twin emits', () => {
    // FUP-VACUOUS-AUDIT-1: the count is asserted, not assumed. Every assertion in
    // this test lives inside the loop, so an EXPECTED that lost entries would leave
    // the test green having compared nothing — and the title says "all seven".
    expect(Object.keys(EXPECTED)).toHaveLength(7)
    for (const [type, label] of Object.entries(EXPECTED)) {
      expect(participantTypeLabel(type)).toBe(label)
    }
  })

  it('covers EVERY declared participant type — no type may be unlabelled', () => {
    // Guards the direction the per-key assertions cannot: a type added to
    // PARTICIPANT_TYPES (mirroring a widened DB CHECK) without a label would
    // otherwise sail through, and `participantTypeLabel` would silently emit the
    // English identifier into the UI — the exact Rule 10 defect this fixes.
    expect([...PARTICIPANT_TYPES].sort()).toEqual(Object.keys(EXPECTED).sort())
    for (const type of PARTICIPANT_TYPES) {
      expect(PARTICIPANT_TYPE_LABELS[type]).toBe(EXPECTED[type])
    }
  })

  it('emits NO raw English identifier for any declared type', () => {
    // The defect, stated as its own assertion rather than inferred from the
    // table above: whatever the labels become, none may be the DB identifier.
    // FUP-VACUOUS-AUDIT-1: pin the population first — an emptied PARTICIPANT_TYPES
    // would make this test pass while checking no type at all.
    expect(PARTICIPANT_TYPES).toHaveLength(7)
    for (const type of PARTICIPANT_TYPES) {
      expect(participantTypeLabel(type)).not.toBe(type)
    }
  })

  it('falls back to the raw value for an unmapped type, mirroring the SQL else-branch', () => {
    // Visible-and-reportable beats silently blank: a null sublabel on the
    // patient lane, where every label is the identical surrogate 'Paciente', is
    // indistinguishable from "these two rows are the same person".
    expect(participantTypeLabel('a_future_eighth_type')).toBe('a_future_eighth_type')
  })

  it('passes null/undefined through as null', () => {
    expect(participantTypeLabel(null)).toBeNull()
    expect(participantTypeLabel(undefined)).toBeNull()
  })
})
