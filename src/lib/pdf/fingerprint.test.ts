import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { documentFooterHtml, renderDocumentHtml, TEMPLATES } from './render'
import { TEMPLATE_FINGERPRINTS } from './template-fingerprints'
import type {
  DocumentPayload,
  FormResponseDocumentBody,
  RegisteredProvenance,
} from './types'

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
/**
 * ⚠ Extracted and typed as {@link RegisteredProvenance}, NOT inlined — and the
 * reason is the design working. `{ ...payload.provenance, watermark: 'final' }`
 * spreads a UNION, so TypeScript produces `previa & watermark:'final'` as one
 * arm of the result and REFUSES it: ADR 0125 D5's fourth cell is a compile error,
 * exactly as intended. Spreading a narrowed registered value is legal because it
 * cannot land in the previa arm.
 */
const CANONICAL_PROVENANCE: RegisteredProvenance = {
  kind: 'registered',
  watermark: 'draft',
  qr: {
    token: 'FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
    shortCode: 'ABCDEF2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENAAAABBBBCCCCDDDDEEEE',
  },
  emission: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'João Emissor' },
}

const CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: 'Rua Fixa, 100 — Belo Horizonte/MG',
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  provenance: CANONICAL_PROVENANCE,
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Coordenação da comissão',
      scope: 'Seção assinada',
      timestamp: '2026-01-02T13:45:00.000Z',
      method: 'platform_signoff',
    },
  ],
  containsPhi: false,
  sourceRevision: 0,
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
 * the canonical fixture cannot: the FINAL chip (`provenance.watermark: 'final'` — the
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
  provenance: { ...CANONICAL_PROVENANCE, watermark: 'final' },
  containsPhi: true,
  body: {
    // P2 widened DocumentBody to a union; this fixture is the form_response
    // member by construction (CANONICAL declares it literally above).
    ...(CANONICAL.body as FormResponseDocumentBody),
    responseStatus: 'submitted',
    submittedAt: '2026-01-02T13:50:00.000Z',
  },
}

/**
 * ADR 0125 D2/D4/D5 — the EPHEMERAL prévia variant. FROZEN like the others.
 *
 * D2 requires this pin by name: *"an ephemeral page is still rendered by the same
 * templates and is still read by a human, so its look stays pinned even though
 * its bytes are never stored."* It sits in `form_response.variants` because it IS
 * the form_response template — the prévia footer is a branch of it, not a
 * template of its own, so it shares the same `TEMPLATE_VERSION`.
 *
 * ⚠ Every display name here is deliberately free of the reserved verb (no
 * "Emissor"), because the whole-document sweep below runs a plain `/emit|emiss/i`
 * over the rendered output. A fixture whose PAYLOAD contains the verb would make
 * that sweep fail for a reason that is not a defect — the mistake this suite's
 * sibling (`primitives/previa-footer.test.ts`) already made once and now
 * documents.
 */
const PREVIA: DocumentPayload = {
  ...CANONICAL,
  provenance: {
    kind: 'previa',
    watermark: 'draft',
    generation: { at: '2026-01-02T14:00:00.000Z', byDisplay: 'Maria Fixa' },
  },
  body: {
    ...(CANONICAL.body as FormResponseDocumentBody),
    respondentDisplay: 'Maria Fixa',
  },
}

/** PDF·P2 — the meeting (ata) canonical fixture. FROZEN like {@link CANONICAL}:
 * RASCUNHO, no signatures (the "— não assinado —" footer branch), minutes +
 * agenda (all three field kinds) + attendance + action items populated. */
const MEETING_PROVENANCE: RegisteredProvenance = {
  kind: 'registered',
  watermark: 'draft',
  qr: {
    token: 'FIXTURETOKENMEETINGAAAABBBBCCCCD',
    shortCode: 'BCDEFG2345',
    url: 'https://example.invalid/verificar/FIXTURETOKENMEETINGAAAABBBBCCCCD',
  },
  emission: { at: '2026-01-03T14:00:00.000Z', byDisplay: 'João Emissor' },
}

const MEETING_CANONICAL: DocumentPayload = {
  letterhead: {
    hospitalName: 'Hospital Canônico',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'Comissão de Controle de Infecção Hospitalar',
  },
  provenance: MEETING_PROVENANCE,
  signatures: [],
  containsPhi: false,
  sourceRevision: 0,
  body: {
    kind: 'meeting',
    meetingNumber: 42,
    title: 'Reunião ordinária de janeiro',
    meetingTypeDisplay: 'Ordinária',
    statusDisplay: 'Em assinatura',
    scheduledStart: '2026-01-03T12:00:00.000Z',
    heldAt: '2026-01-03T12:05:00.000Z',
    heldEnd: '2026-01-03T13:30:00.000Z',
    modalityDisplay: 'Presencial',
    locationDisplay: 'Sala de reuniões 2',
    quorum: { met: true, presentCount: 5, eligibleCount: 7 },
    minutesMd: 'Ata canônica da reunião.\nSegundo parágrafo.',
    agenda: [
      {
        title: 'Aprovação da ata anterior',
        description: 'Leitura e aprovação.',
        discussionNotes: 'Sem ressalvas.',
        resolution: 'Aprovada por unanimidade.',
      },
      {
        title: 'Item sem deliberação',
        description: null,
        discussionNotes: null,
        resolution: null,
      },
    ],
    attendance: [
      { name: 'Maria Fixa', roleDisplay: 'Presidente', attendanceDisplay: 'Presente' },
      { name: 'João Emissor', roleDisplay: 'Membro', attendanceDisplay: 'Ausente' },
      {
        name: 'Convidada Externa (Org Externa)',
        roleDisplay: 'Convidado(a)',
        attendanceDisplay: 'Convocado(a)',
      },
    ],
    actionItems: [
      {
        title: 'Revisar protocolo de higienização',
        statusDisplay: 'Aberto',
        assigneeDisplay: 'Maria Fixa',
        dueDisplay: '15/01/2026',
      },
    ],
  },
}

/** The FINAL + signed + DEGENERATE-STATE variant (QA MINOR-6): two attestation
 * footer blocks, null minutes, EMPTY agenda, EMPTY attendance, null quorum,
 * absent "Encaminhamentos" — every branch the populated canonical cannot pin. */
const MEETING_FINAL_SIGNED: DocumentPayload = {
  ...MEETING_CANONICAL,
  provenance: { ...MEETING_PROVENANCE, watermark: 'final' },
  signatures: [
    {
      name: 'Maria Fixa',
      title: 'Presidente',
      scope: null,
      timestamp: '2026-01-04T10:00:00.000Z',
      method: 'platform_signoff',
    },
    {
      name: 'Carlos Secretário',
      title: 'Secretário(a)',
      scope: null,
      timestamp: '2026-01-04T11:00:00.000Z',
      method: 'platform_signoff',
    },
  ],
  body: {
    ...(MEETING_CANONICAL.body as import('./types').MeetingDocumentBody),
    statusDisplay: 'Assinada',
    minutesMd: null,
    quorum: null,
    agenda: [],
    attendance: [],
    actionItems: [],
  },
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

/**
 * ⭐ THE FINGERPRINT INPUT IS THE PAGE **PLUS ITS GOTENBERG FOOTER** (PDF·P3,
 * ADR 0144 D13).
 *
 * The footer is a SEPARATE multipart document sent to Gotenberg, so it never
 * appears in `renderDocumentHtml`'s output — which means that without this
 * composition it would be a piece of every printed page that ADR 0104 D4's
 * silent-staleness guard **cannot see**. Someone could change the page numbering,
 * or delete it, and no fingerprint would move.
 *
 * ⚠ TWO GUARDS, NOT ONE, AND THEY ARE NOT REDUNDANT: the footer's bytes are
 * already inside `printed_documents.content_hash`, which detects tampering with
 * a MINTED artifact. This is the STRUCTURAL guard — it stops *us* changing the
 * footer without a deliberate `TEMPLATE_VERSION` decision.
 *
 * ⚠ `?? ''` appends NOTHING for `form_response` and `meeting`
 * (`documentFooterHtml` returns null for them), so both committed fingerprints
 * are unchanged by this composition — asserted below rather than assumed.
 */
const rendered = (p: DocumentPayload) =>
  renderDocumentHtml(p) + (documentFooterHtml(p) ?? '')

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
    const computed = sha256(rendered(CANONICAL))
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
    const computed = sha256(rendered(FINAL_PHI_LOGO))
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

  it('meeting: registry version matches the committed record', () => {
    expect(TEMPLATES.meeting.version).toBe(TEMPLATE_FINGERPRINTS.meeting.version)
  })

  it('meeting: structural fingerprint matches — a template change REQUIRES a version bump', () => {
    const computed = sha256(rendered(MEETING_CANONICAL))
    expect(
      computed,
      `Meeting template output changed (computed ${computed}). Deliberate change: bump ` +
        `TEMPLATE_VERSION in documents/meeting.ts AND update template-fingerprints.ts together.`,
    ).toBe(TEMPLATE_FINGERPRINTS.meeting.fingerprint)
  })

  it('meeting/final_signed: the FINAL + attestation-footer + null-minutes branches are pinned', () => {
    const computed = sha256(rendered(MEETING_FINAL_SIGNED))
    expect(
      computed,
      `Meeting variant output changed (computed ${computed}). Same rule: version + both fields together.`,
    ).toBe(TEMPLATE_FINGERPRINTS.meeting.variants.final_signed)
  })

  it('the meeting variant genuinely renders its pinned branches (no vacuous fixture)', () => {
    const html = renderDocumentHtml(MEETING_FINAL_SIGNED)
    expect(html).toContain('class="wm-chip wm-chip-final"')
    expect(html).toContain('Assinado eletronicamente por <strong>Carlos Secretário</strong>')
    // Markup form, not the bare token — the shared shell CSS defines
    // .signature-missing in EVERY document (the P1 FIX-2 lesson).
    expect(html).not.toContain('class="signature-block signature-missing"')
    // Degenerate-state branches (QA MINOR-6) — variant-only:
    expect(html).toContain('— pauta sem itens registrados —')
    expect(html).toContain('— sem participantes registrados —')
    expect(html).not.toContain('Encaminhamentos')
    expect(html).not.toContain('Quórum:')
    const canonicalHtml = renderDocumentHtml(MEETING_CANONICAL)
    expect(canonicalHtml).toContain('class="signature-block signature-missing"') // unsigned-footer branch
    expect(canonicalHtml).not.toContain('class="wm-chip wm-chip-final"')
    expect(canonicalHtml).toContain('class="ata-minutes"') // minutes branch canonical-only
    expect(html).not.toContain('class="ata-minutes"')
    expect(canonicalHtml).toContain('Encaminhamentos')
    expect(canonicalHtml).toContain('Quórum: atingido (5 de 7)')
    expect(canonicalHtml).not.toContain('— pauta sem itens registrados —')
    expect(canonicalHtml).not.toContain('— sem participantes registrados —')
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

describe('ADR 0125 D5 — REGISTERED documents are untouched by the prévia split', () => {
  /**
   * The prévia footer (`primitives/previa-footer.ts`) emits TEMPLATE-SCOPED CSS
   * rather than extending this module's shared `PRINT_CSS`, and that is
   * load-bearing: `PRINT_CSS` is part of every document's hash, so styling the
   * ephemeral page through it would move BOTH committed fingerprints and force a
   * `TEMPLATE_VERSION` bump on two templates whose layout did not change —
   * corrupting registry metadata to style a page that is never stored. Same
   * reason `documents/meeting.ts` scopes its own styles (its header comment:
   * adding that template moved NO form_response fingerprint).
   *
   * The four fingerprint assertions above already RED if that discipline slips.
   * These add the readable half: what a reviewer would actually check.
   *
   * ⚠ The full-document PRÉVIA variant is NOT pinned here yet — `renderDocumentHtml`
   * cannot yet produce one (its footer call is unconditional and `DocumentPayload.qr`
   * is required). That variant lands WITH the render path (F2 / ADR 0125 D4), and
   * ADR 0125 D2 requires it: an ephemeral page is still rendered by these templates
   * and still read by a human, so its look stays pinned even though its bytes are
   * never stored.
   */
  const registered = [
    ['form_response canonical', CANONICAL],
    ['form_response final/phi/logo', FINAL_PHI_LOGO],
    ['meeting canonical', MEETING_CANONICAL],
    ['meeting final/signed', MEETING_FINAL_SIGNED],
  ] as const

  for (const [name, payload] of registered) {
    it(`${name}: carries the QR footer and NOT the prévia footer`, () => {
      const html = renderDocumentHtml(payload)
      // Positive half first — without it, the absence checks below are satisfied
      // by a renderer that emits no footer at all.
      expect(html).toContain('<footer class="qr-footer">')
      expect(html).toContain('Emitido em ')
      expect(html).not.toContain('previa-footer')
      expect(html).not.toContain('PRÉVIA — sem valor de registro')
    })
  }

  it('form_response/previa: the EPHEMERAL branch is version-pinned too (D2)', () => {
    const computed = sha256(rendered(PREVIA))
    expect(
      computed,
      `Prévia variant output changed (computed ${computed}). Same rule as every ` +
        `other variant: a deliberate template change bumps TEMPLATE_VERSION and ` +
        `updates template-fingerprints.ts in the same commit.`,
    ).toBe(TEMPLATE_FINGERPRINTS.form_response.variants.previa)
  })

  it('the prévia variant genuinely renders the EPHEMERAL branch (no vacuous fixture)', () => {
    const html = renderDocumentHtml(PREVIA)
    expect(html).toContain('<footer class="previa-footer">')
    expect(html).toContain('PRÉVIA — sem valor de registro, não verificável.')
    expect(html).toContain('Gerada em 02/01/2026 11:00 por Maria Fixa.')
    // ...and it carries NONE of the registered page's verification apparatus.
    expect(html).not.toContain('<footer class="qr-footer">')
    expect(html).not.toContain('Código de verificação:')
    expect(html).not.toContain('/verificar/')
    // The disjoint half: the registered canonical is the exact mirror.
    const registeredHtml = renderDocumentHtml(CANONICAL)
    expect(registeredHtml).toContain('<footer class="qr-footer">')
    expect(registeredHtml).not.toContain('previa-footer')
  })

  /**
   * ⛔ **Sweep the RENDERED PROSE, not the raw document.**
   *
   * The first version of the check below swept `renderDocumentHtml(...)` whole
   * and went red — not because the verb reached the page, but because
   * `fonts.generated.ts` inlines ~136 KB of base64 `@font-face` payloads, and a
   * blob that size contains the letters "emit" by chance. A needle applied to
   * machine-encoded bytes measures entropy, not vocabulary.
   *
   * Stripping `<style>` blocks and `data:` URIs leaves exactly what a human
   * reads, which is what ADR 0125 D5 actually governs.
   */
  const renderedProse = (payload: DocumentPayload) =>
    renderDocumentHtml(payload)
      .replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/data:[^"')\s]+/g, '')

  it('⛔ the RESERVED VERB appears NOWHERE in a rendered prévia (ADR 0125 D5)', () => {
    // The whole document, not just the footer fragment: the verb could re-enter
    // through the letterhead, a body label, or a future template edit. The
    // fixture's payload is deliberately verb-free (see PREVIA's note).
    const prose = renderedProse(PREVIA)
    expect(prose.length, 'the stripper gutted the document').toBeGreaterThan(200)
    expect(prose).toContain('PRÉVIA — sem valor de registro') // real content survived
    expect(/emit|emiss/i.test(prose), 'reserved verb reached an unregistered page').toBe(false)
  })

  it('⭐ POSITIVE CONTROL: the same sweep over a REGISTERED page HITS the verb', () => {
    // Without this the check above is satisfied by a stripper that returns prose
    // no footer could ever contain. CANONICAL's payload also contains "João
    // Emissor", so the template's own wording is asserted explicitly too.
    const prose = renderedProse(CANONICAL)
    expect(/emit|emiss/i.test(prose)).toBe(true)
    expect(prose).toContain('Emitido em ')
  })

  it('the RASCUNHO variants stay pinned — an ephemeral page uses these same templates (D2)', () => {
    // ADR 0125 D2 names these by requirement. Both draft-watermarked fixtures
    // must keep rendering the RASCUNHO marks; the prévia reuses them verbatim.
    for (const payload of [CANONICAL, MEETING_CANONICAL]) {
      const html = renderDocumentHtml(payload)
      expect(html).toContain('<div class="wm-diagonal" aria-hidden="true">RASCUNHO</div>')
      expect(html).toContain('<div class="wm-chip wm-chip-draft">RASCUNHO</div>')
    }
  })
})

// ---------------------------------------------------------------------------
// PDF·P3 — the case dossier (ADR 0144). TWO template keys, one module.
// ---------------------------------------------------------------------------

/** The de-identified block: the three demographics, and the five identified
 * fields NULL — which is exactly what the provider produces on that path. */
const CASE_PATIENT_DEID = {
  ageDisplay: '67 anos',
  sexDisplay: 'Feminino',
  unitDisplay: 'UTI Adulto',
  name: null,
  mrn: null,
  dateOfBirthDisplay: null,
  attending: null,
  encounterRef: null,
}

const CASE_BODY_BASE = {
  kind: 'case' as const,
  caseNumber: '0042',
  title: 'Evento adverso — sepse tardia',
  statusDisplay: 'Concluído',
  confidentialityDisplay: 'Restrito',
  caseTypeDisplay: 'Ocorrência',
  outcomeDisplay: 'Procedente',
  departmentDisplay: 'UTI Adulto',
  tags: ['sepse'],
  openedAtDisplay: '01/03/2026',
  closedAtDisplay: '20/03/2026',
  phiDisposed: false,
  participants: [
    {
      name: 'Maria Silva',
      roleDisplay: 'Relatora',
      titleDisplay: 'Enfermagem',
      recusalDisplay: null,
    },
  ],
  phases: [
    {
      title: 'Fase 1 — Avaliação',
      statusDisplay: 'Concluída',
      respondentDisplay: 'Maria Silva',
      submittedAtDisplay: '12/03/2026 14:32',
      resultDisplay: 'Conforme',
      items: [
        { kind: 'question' as const, label: 'Houve dano ao paciente?', value: 'Sim' },
        { kind: 'question' as const, label: 'Observações', value: null },
      ],
    },
  ],
  narratives: [
    {
      title: 'Relato inicial',
      authorDisplay: 'Maria Silva',
      dateDisplay: '02/03/2026 09:00',
      bodyMd: 'Relato do evento.',
    },
  ],
  interviews: [
    {
      title: 'Entrevista nº 1',
      statusDisplay: 'Concluída',
      dateDisplay: '05/03/2026 11:00',
      subjects: ['Profissional A'],
      interviewers: ['Coordenação'],
      summaryMd: 'Resumo da entrevista.',
    },
  ],
  referrals: [
    {
      directionDisplay: 'Encaminhamento enviado',
      counterpartDisplay: 'Comissão de Ética',
      statusDisplay: 'respondido',
      sentAtDisplay: '06/03/2026 10:00',
      question: 'Avaliação ética',
      snapshot: [{ label: 'Relato inicial', value: 'Relato do evento.' }],
      replyStatusDisplay: 'Procedente',
      replyBody: 'Parecer da comissão.',
      repliedAtDisplay: '10/03/2026 16:00',
    },
  ],
  timeline: [
    {
      dateDisplay: '02/03/2026',
      kindDisplay: 'Nota',
      title: 'Registro inicial',
      body: 'Texto do registro.',
      authorDisplay: 'Maria Silva',
    },
  ],
  meetings: [
    {
      meetingDisplay: 'Reunião nº 3',
      dateDisplay: '12/03/2026 15:00',
      summary: 'Discussão do caso.',
      decision: 'Plano de ação aprovado.',
    },
  ],
  actionItems: [
    {
      title: 'Revisar protocolo',
      statusDisplay: 'Concluído',
      assigneeDisplay: 'Equipe NSP',
      dueDisplay: '30/03/2026',
    },
  ],
  corrections: [
    {
      requestedByDisplay: null,
      dateDisplay: '15/03/2026 08:00',
      statusDisplay: 'Aprovada',
      kindDisplay: 'Correção',
      justification: 'Erro de digitação.',
    },
  ],
  documents: [
    {
      title: 'Anexo 1.pdf',
      uploaderDisplay: 'Maria Silva',
      dateDisplay: '12/03/2026',
      contentHash: 'b'.repeat(64),
    },
  ],
}

const CASE_ENVELOPE = {
  letterhead: {
    hospitalName: 'Hospital de Teste',
    hospitalAddress: null,
    logoDataUri: null,
    commissionName: 'CCIH',
  },
  signatures: [],
  containsPhi: true,
  sourceRevision: 3,
}

const CASE_REGISTERED = {
  kind: 'registered' as const,
  watermark: 'final' as const,
  qr: {
    token: 'abcdefghijklmnopqrstuvwxyz012345',
    shortCode: 'ABCDEFGHJK',
    url: 'https://x.invalid/verificar/abcdefghijklmnopqrstuvwxyz012345',
  },
  emission: { at: '2026-03-20T12:00:00.000Z', byDisplay: 'Maria Silva' },
}

/** Canonical `case`: registered, FINAL, de-identified, every section populated. */
const CASE_CANONICAL: DocumentPayload = {
  ...CASE_ENVELOPE,
  provenance: CASE_REGISTERED,
  body: { ...CASE_BODY_BASE, variant: 'deidentified', patients: [CASE_PATIENT_DEID] },
}

/** Canonical `case_identified` — the ONLY payload that renders the five
 * identifier fields, which is why it earns its own committed fingerprint rather
 * than sharing the one above (ADR 0144 D1/D7). */
const CASE_IDENTIFIED: DocumentPayload = {
  ...CASE_ENVELOPE,
  provenance: CASE_REGISTERED,
  body: {
    ...CASE_BODY_BASE,
    variant: 'identified',
    patients: [
      {
        ...CASE_PATIENT_DEID,
        name: 'Fulana de Tal',
        mrn: 'PR-998877',
        dateOfBirthDisplay: '04/09/1958',
        attending: 'Dr. Beltrano',
        encounterRef: 'ATD-2026-0042',
      },
    ],
  },
}

/** The EPHEMERAL branch (ADR 0125 D2/D5): prévia footer instead of the QR block. */
const CASE_PREVIA: DocumentPayload = {
  ...CASE_ENVELOPE,
  provenance: {
    kind: 'previa',
    watermark: 'draft',
    generation: { at: '2026-03-19T12:00:00.000Z', byDisplay: 'Maria Silva' },
  },
  body: { ...CASE_BODY_BASE, variant: 'deidentified', patients: [CASE_PATIENT_DEID] },
}

/**
 * ⭐ THE DISPOSED BRANCH — the one the canonical fixture CANNOT reach, and the
 * one most likely to be wrong. `dispose_case_phi` guts the dossier, so this pins
 * that empty sections DROP (no bare headings), that the index shrinks with them,
 * and that the disposal notice renders. Without it, "degrades gracefully on a
 * disposed case" is a claim no test makes.
 */
const CASE_DISPOSED: DocumentPayload = {
  ...CASE_ENVELOPE,
  containsPhi: false,
  provenance: {
    kind: 'previa',
    watermark: 'draft',
    generation: { at: '2026-03-25T12:00:00.000Z', byDisplay: 'Maria Silva' },
  },
  body: {
    ...CASE_BODY_BASE,
    variant: 'deidentified',
    title: '[PHI removido]',
    phiDisposed: true,
    patients: [],
    phases: [{ ...CASE_BODY_BASE.phases[0]!, items: [] }],
    narratives: [{ ...CASE_BODY_BASE.narratives[0]!, bodyMd: null }],
    interviews: [{ ...CASE_BODY_BASE.interviews[0]!, summaryMd: null }],
    referrals: [],
    timeline: [
      { ...CASE_BODY_BASE.timeline[0]!, title: '[PHI removido]', body: '[PHI removido]' },
    ],
    meetings: [
      { ...CASE_BODY_BASE.meetings[0]!, summary: '[PHI removido]', decision: '[PHI removido]' },
    ],
    corrections: [],
    documents: [{ ...CASE_BODY_BASE.documents[0]!, title: '[PHI removido]' }],
  },
}

describe('PDF·P3 — case dossier fingerprints (ADR 0144 D1/D13)', () => {
  it('both case template keys report the committed version', () => {
    expect(TEMPLATES.case.version).toBe(TEMPLATE_FINGERPRINTS.case.version)
    expect(TEMPLATES.case_identified.version).toBe(
      TEMPLATE_FINGERPRINTS.case_identified.version,
    )
  })

  it('case: structural fingerprint matches — a template change REQUIRES a version bump', () => {
    expect(
      sha256(rendered(CASE_CANONICAL)),
      'the case dossier template changed: bump TEMPLATE_VERSION in documents/case.ts ' +
        'AND update template-fingerprints.ts in the same commit.',
    ).toBe(TEMPLATE_FINGERPRINTS.case.fingerprint)
  })

  it('case_identified: its OWN fingerprint — it renders a section `case` does not', () => {
    expect(sha256(rendered(CASE_IDENTIFIED))).toBe(
      TEMPLATE_FINGERPRINTS.case_identified.fingerprint,
    )
  })

  it('case/previa + case/disposed branches are pinned too (the QA MAJOR-2 lesson)', () => {
    expect(sha256(rendered(CASE_PREVIA))).toBe(TEMPLATE_FINGERPRINTS.case.variants.previa)
    expect(sha256(rendered(CASE_DISPOSED))).toBe(
      TEMPLATE_FINGERPRINTS.case.variants.disposed,
    )
  })

  it('⭐ the four case fixtures are genuinely DIFFERENT renders (no vacuous pins)', () => {
    // Four fingerprints that happened to hash the same bytes would all pass
    // while pinning ONE branch. This anchor is what makes them mean something —
    // the same shape as the form_response and meeting variant anchors above.
    const hashes = [CASE_CANONICAL, CASE_IDENTIFIED, CASE_PREVIA, CASE_DISPOSED].map((p) =>
      sha256(rendered(p)),
    )
    expect(new Set(hashes).size, 'two case fixtures render identically').toBe(4)
  })

  it('⭐ the identified variant renders the identifiers and the de-identified one does NOT', () => {
    const identified = rendered(CASE_IDENTIFIED)
    const deidentified = rendered(CASE_CANONICAL)
    // The five ADR 0144 D5 identified-only fields.
    for (const secret of [
      'Fulana de Tal',
      'PR-998877',
      '04/09/1958',
      'Dr. Beltrano',
      'ATD-2026-0042',
    ]) {
      expect(identified, 'identified must render ' + secret).toContain(secret)
      expect(deidentified, 'DE-IDENTIFIED LEAKED ' + secret).not.toContain(secret)
    }
    // ...and the de-identification FLOOR is present in BOTH (D5's table).
    for (const floor of ['67 anos', 'Feminino', 'UTI Adulto']) {
      expect(identified).toContain(floor)
      expect(deidentified).toContain(floor)
    }
  })

  it('⭐ the disposed dossier drops empty sections instead of printing bare headings', () => {
    const html = rendered(CASE_DISPOSED)
    for (const gone of [
      'Identificação do paciente',
      'Narrativas',
      'Encaminhamentos entre comissões',
      'Solicitações de correção',
    ]) {
      expect(html, 'a gutted section still renders a heading: ' + gone).not.toContain(gone)
    }
    // ...while what survived still renders, and the notice explains the thinness.
    expect(html).toContain('Linha do tempo')
    expect(html).toContain('LGPD Art. 18')

    // ⭐ THE ASYMMETRY, PINNED RATHER THAN COMMENTED. `dispose_case_phi` nulls
    // `case_interviews.summary_md` but does NOT delete the interview, its
    // subjects or its interviewers — so "an interview happened, with whom, when"
    // survives as process evidence while its CONTENT does not. Narratives, whose
    // whole substance is the body, drop entirely. This test is what stops that
    // difference being "fixed" into consistency in either direction.
    expect(html, 'the fact of the interview must survive disposal').toContain(
      'Entrevistas',
    )
    expect(html, 'the interview SUMMARY must not survive disposal').not.toContain(
      'Resumo da entrevista.',
    )
    expect(html, 'a narrative body must not survive disposal').not.toContain(
      'Relato do evento.',
    )
    // ⭐ The differential: the CANONICAL fixture DOES render those headings, so
    // the absences above are about disposal — not about a template that never
    // emits those strings at all.
    const canonical = rendered(CASE_CANONICAL)
    for (const present of ['Identificação do paciente', 'Narrativas', 'Entrevistas']) {
      expect(canonical).toContain(present)
    }
  })

  it('⭐ the case footer is INSIDE the fingerprint input, and no other kind has one', () => {
    // Without `rendered()` composing it in, the D13 footer would be a piece of
    // every printed page that ADR 0104 D4's guard cannot see.
    expect(documentFooterHtml(CASE_CANONICAL)).toContain('pageNumber')
    expect(rendered(CASE_CANONICAL)).toContain('totalPages')
    expect(rendered(CASE_CANONICAL)).not.toBe(renderDocumentHtml(CASE_CANONICAL))
    // ⚠ The deliberate ASYMMETRY (ADR 0144 D13): page numbers ship for the case
    // kind ONLY. Enabling them globally would move two committed fingerprints
    // for no layout change — this is what would red if someone did.
    expect(documentFooterHtml(CANONICAL)).toBeNull()
    expect(documentFooterHtml(MEETING_CANONICAL)).toBeNull()
    expect(rendered(CANONICAL)).toBe(renderDocumentHtml(CANONICAL))
    expect(rendered(MEETING_CANONICAL)).toBe(renderDocumentHtml(MEETING_CANONICAL))
  })
})
