import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { renderDocumentHtml, TEMPLATES } from './render'
import { TEMPLATE_FINGERPRINTS } from './template-fingerprints'
import type { DocumentPayload, FormResponseDocumentBody } from './types'

/**
 * ADR 0104 D4 — the template-staleness guard. A template that changes without
 * a version bump is silent metadata corruption (the registry would record
 * version 1 for two different layouts). This suite REDS on exactly that.
 *
 * Includes the proven-detecting case (memory: a detector that finds nothing
 * must be proven able to find something): a representative template-style
 * mutation is shown to MOVE the fingerprint.
 */

/** Canonical fixture — FROZEN. Changing it changes every fingerprint, which is
 * indistinguishable from a template change; extend templates with NEW fixtures
 * instead of editing this one. */
const CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: 'Rua Fixa, 100 — Belo Horizonte/MG',
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  watermarks: ['draft'],
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Coordenação da comissão',
      scope: 'Seção assinada',
      timestamp: '2026-01-02T13:45:00.000Z',
      method: 'platform_signoff',
    },
  ],
  qr: {
    token: 'FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
    shortCode: 'ABCDEF2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
  },
  emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'João Emissor' },
  containsPhi: false,
  body: {
    kind: 'form_response',
    formTitle: 'Checklist Canônico',
    versionNumber: 3,
    respondentDisplay: 'João Emissor',
    responseStatus: 'in_progress',
    startedAt: '2026-01-02T12:00:00.000Z',
    submittedAt: null,
    sections: [
      {
        title: null,
        description: null,
        requiresSignoff: false,
        signature: null,
        items: [
          { kind: 'question', label: 'Pergunta respondida', value: 'Sim' },
          { kind: 'question', label: 'Pergunta aberta', value: null },
          { kind: 'display_text', label: 'Texto explicativo do formulário.', value: null },
        ],
      },
      {
        title: 'Seção assinada',
        description: 'Descrição da seção.',
        requiresSignoff: true,
        signature: {
          name: 'Maria Fixa',
          title: 'Coordenação da comissão',
          scope: 'Seção assinada',
          timestamp: '2026-01-02T13:45:00.000Z',
          method: 'platform_signoff',
        },
        items: [{ kind: 'question', label: 'Confirmação', value: 'Confirmado' }],
      },
      {
        title: 'Seção pendente',
        description: null,
        requiresSignoff: true,
        signature: null,
        items: [{ kind: 'question', label: 'Nota', value: null }],
      },
    ],
  },
}

/**
 * QA MAJOR-2 variant — FROZEN like {@link CANONICAL}. Exercises the branches
 * the canonical fixture cannot: the FINAL chip (`watermarks: ['final']` — the
 * branch every submitted response renders), the non-suppressible
 * confidentiality band (`containsPhi: true` — the FIRST thing P3's PHI delta
 * touches, pinned BEFORE it lands), and the letterhead logo `<img>`.
 */
const FINAL_PHI_LOGO: DocumentPayload = {
  ...CANONICAL,
  letterhead: {
    ...CANONICAL.letterhead,
    logoDataUri:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  },
  watermarks: ['final'],
  containsPhi: true,
  body: {
    // P2 widened DocumentBody to a union; this fixture is the form_response
    // member by construction (CANONICAL declares it literally above).
    ...(CANONICAL.body as FormResponseDocumentBody),
    responseStatus: 'submitted',
    submittedAt: '2026-01-02T13:50:00.000Z',
  },
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

describe('template fingerprints (ADR 0104 D4)', () => {
  it('renders deterministically (same payload, same bytes)', () => {
    expect(renderDocumentHtml(CANONICAL)).toBe(renderDocumentHtml(CANONICAL))
  })

  it('form_response: registry version matches the committed record', () => {
    expect(TEMPLATES.form_response.version).toBe(
      TEMPLATE_FINGERPRINTS.form_response.version,
    )
  })

  it('form_response: structural fingerprint matches — a template change REQUIRES a version bump', () => {
    const computed = sha256(renderDocumentHtml(CANONICAL))
    const recorded = TEMPLATE_FINGERPRINTS.form_response.fingerprint
    expect(
      computed,
      `Template output changed (computed ${computed}). If this was a deliberate ` +
        `template change: bump TEMPLATE_VERSION in documents/form-response.ts AND ` +
        `update template-fingerprints.ts (version + fingerprint) in the same commit. ` +
        `Never update the fingerprint without the version decision.`,
    ).toBe(recorded)
  })

  it('form_response/final_phi_logo: the FINAL-chip + PHI-band + logo branches are version-pinned too (QA MAJOR-2)', () => {
    const computed = sha256(renderDocumentHtml(FINAL_PHI_LOGO))
    const recorded = TEMPLATE_FINGERPRINTS.form_response.variants.final_phi_logo
    expect(
      computed,
      `Variant output changed (computed ${computed}). A deliberate template change ` +
        `requires the TEMPLATE_VERSION bump + BOTH fingerprint fields updated together.`,
    ).toBe(recorded)
  })

  it('the variant genuinely renders the pinned branches (no vacuous fixture)', () => {
    // MARKUP forms, not bare class tokens — the CSS block defines the
    // selectors in EVERY document, so a token-contains would be vacuous.
    const html = renderDocumentHtml(FINAL_PHI_LOGO)
    expect(html).toContain('class="wm-chip wm-chip-final"')
    expect(html).toContain('DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>')
    expect(html).toContain('<img class="lh-logo"')
    // ...and the canonical fixture does NOT — the two pins cover disjoint branches.
    const canonicalHtml = renderDocumentHtml(CANONICAL)
    expect(canonicalHtml).not.toContain('class="wm-chip wm-chip-final"')
    expect(canonicalHtml).not.toContain('DOCUMENTO CONFIDENCIAL — CONTÉM DADOS DE PACIENTE</div>')
    expect(canonicalHtml).not.toContain('<img class="lh-logo"')
  })

  it('the detector DETECTS: a representative template mutation moves the fingerprint', () => {
    // Simulate the class of change the guard exists for — a structural/CSS-class
    // edit anywhere in the rendered document.
    const html = renderDocumentHtml(CANONICAL)
    const mutated = html.replace('class="section-table"', 'class="section-tbl"')
    expect(mutated).not.toBe(html) // the mutation landed (§7.15 — no vacuous drill)
    expect(sha256(mutated)).not.toBe(sha256(html))
  })
})
