import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CASE_TERMINOLOGY,
  mergeCaseTypeTerminology,
  type CaseTypeTerminologyRow,
} from './terminology'

/**
 * Pure merge/fallback for the terminology resolver (ETH·E3a BE-6). The RLS read lives in
 * `@/lib/queries/case-types`; this proves the deterministic fallback the resolver relies
 * on — null/unknown type → default; a missing term_key → default for THAT key only.
 */
describe('mergeCaseTypeTerminology', () => {
  it('null caseTypeId → the platform default bundle (identity)', () => {
    expect(mergeCaseTypeTerminology(null, [])).toBe(DEFAULT_CASE_TERMINOLOGY)
  })

  it('a type with zero rows → default labels, carrying the id', () => {
    const t = mergeCaseTypeTerminology('type-1', [])
    expect(t.caseTypeId).toBe('type-1')
    expect(t.case).toEqual(DEFAULT_CASE_TERMINOLOGY.case)
    expect(t.timeline).toEqual(DEFAULT_CASE_TERMINOLOGY.timeline)
  })

  it('a full 5-key bundle overrides every slot', () => {
    const rows: CaseTypeTerminologyRow[] = [
      { term_key: 'case', singular_label: 'Denúncia', plural_label: 'Denúncias', help_text: null },
      { term_key: 'primary_subject', singular_label: 'Médico denunciado', plural_label: 'Médicos denunciados', help_text: null },
      { term_key: 'timeline', singular_label: 'Cronologia processual', plural_label: null, help_text: 'ajuda' },
      { term_key: 'document', singular_label: 'Documento', plural_label: 'Documentos', help_text: null },
      { term_key: 'decision', singular_label: 'Decisão', plural_label: 'Decisões', help_text: null },
    ]
    const t = mergeCaseTypeTerminology('ethics', rows)
    expect(t.caseTypeId).toBe('ethics')
    expect(t.case.singular).toBe('Denúncia')
    expect(t.primarySubject.singular).toBe('Médico denunciado')
    expect(t.timeline.singular).toBe('Cronologia processual')
    expect(t.timeline.helpText).toBe('ajuda')
  })

  it('a missing term_key falls back to the platform default for THAT key only', () => {
    const rows: CaseTypeTerminologyRow[] = [
      { term_key: 'case', singular_label: 'Denúncia', plural_label: 'Denúncias', help_text: null },
      // 'timeline' deliberately absent
      { term_key: 'decision', singular_label: 'Parecer', plural_label: 'Pareceres', help_text: null },
    ]
    const t = mergeCaseTypeTerminology('partial', rows)
    expect(t.case.singular).toBe('Denúncia') // overridden
    expect(t.decision.singular).toBe('Parecer') // overridden
    expect(t.timeline).toEqual(DEFAULT_CASE_TERMINOLOGY.timeline) // fell back
    expect(t.primarySubject).toEqual(DEFAULT_CASE_TERMINOLOGY.primarySubject) // fell back
    expect(t.document).toEqual(DEFAULT_CASE_TERMINOLOGY.document) // fell back
  })
})
