import { esc } from '../escape'
import { renderTableOfContents, type TableOfContentsEntry } from '../primitives'
import type {
  CaseActionItemEntry,
  CaseCorrectionEntry,
  CaseDocumentBody,
  CaseDocumentManifestEntry,
  CaseInterviewEntry,
  CaseMeetingEntry,
  CaseNarrativeEntry,
  CaseParticipantEntry,
  CasePatientEntry,
  CasePhaseEntry,
  CaseReferralEntry,
  CaseTimelineEntry,
} from '../types'

/**
 * The case DOSSIER template (PDF·P3; ADR 0104 D15 step 3; ADR 0144 D1/D2/D13).
 *
 * ⚠ **TWO TEMPLATE KEYS, ONE MODULE, ONE RENDERER.** `case` and
 * `case_identified` are the same document; they differ in what the patient
 * section contains. The key is DERIVED from `body.variant` by `templateFor` in
 * `../render` — never passed alongside it — so the registry's label cannot
 * disagree with the bytes. Both keys carry their own committed fingerprint,
 * which is STRONGER than one key would be: the identified variant renders a
 * section the other does not, and each hash pins the structure that actually
 * shipped.
 *
 * TEMPLATE_VERSION is LOAD-BEARING metadata: recorded in the registry at mint,
 * reported by verification. ⛔ Any visual/structural change to EITHER variant
 * REQUIRES bumping it — `fingerprint.test.ts` reds on an unbumped change.
 *
 * Template-SCOPED styles, like the ata: this module emits its own `<style>`
 * block rather than extending the shared shell CSS, so adding this template
 * moved NO form_response or meeting fingerprint (the shell is part of every
 * document's hash).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THE SECTION LIST IS COUPLED TO A TRIGGER SET AND TO AN RLS PREDICATE
 * ═══════════════════════════════════════════════════════════════════════════
 * Every table rendered below carries a `bump_case_print_revision` trigger
 * (migration `20261003002200`), because ADR 0144 D15's whole point is that a
 * rendered table with no trigger drifts silently while `/verificar` keeps
 * reporting *"autêntico e atual"*.
 *
 * ⛔ **ADDING A SECTION HERE CAN REQUIRE TWO CHANGES ELSEWHERE:**
 *   1. a trigger on the new table in `20261003002200`'s set — or the new
 *      section drifts unbumped, which is the exact defect D15 exists to prevent;
 *   2. if that table has a PER-CALLER SELECT policy, a new masking axis in
 *      `app.can_read_full_case_content` (`20261003002300`) — or the dossier
 *      renders, to a caller entitled to mint, content that caller's own screens
 *      mask. That predicate's seven axes were MEASURED against exactly the
 *      tables this file renders.
 * Both of those files carry the mirror of this note.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEGRADING ON A DISPOSED CASE (ADR 0144, the D3 rationale correction)
 * ═══════════════════════════════════════════════════════════════════════════
 * `dispose_case_phi` does not merely drop identifiers, it GUTS this document:
 * `patient_identifiers` and the phases' `answers` are DELETED; `body_md` and
 * `summary_md` are nulled; event titles/bodies, subject notes, `cases.label`,
 * document titles and meeting summaries/decisions are REDACTED.
 *
 * ⇒ Sections render only when they have content ({@link section} drops an empty
 * one entirely rather than emitting a bare heading), and the TOC is built from
 * the SAME list, so index and body cannot disagree. A fully disposed case still
 * produces a well-formed document: letterhead, running header, TOC, the
 * disposal notice, and whatever survived. That is D3's corrected rationale — the
 * page is worth minting as *a record that the case existed and was disposed*,
 * not as a process record for a tracer.
 */
export const TEMPLATE_KEY = 'case'
export const TEMPLATE_KEY_IDENTIFIED = 'case_identified'
export const TEMPLATE_VERSION = 1

const STYLE = `<style>
.case-running-header { position: fixed; top: -10mm; left: 0; right: 0;
  font-size: 7.5pt; color: #555; letter-spacing: 0.04em;
  display: flex; justify-content: space-between; }
.case-meta { font-size: 8.5pt; color: #444; margin-bottom: 5mm; }
.case-meta .meta-item { margin-right: 6mm; }
.doc-toc { margin: 0 0 6mm; padding: 3mm 4mm; border: 0.5pt solid #999; background: #fafafa;
  break-inside: avoid; }
.toc-title { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 11pt;
  margin-bottom: 1.5mm; }
.toc-list { margin: 0; padding-left: 5mm; font-size: 9.5pt; }
.toc-list li { margin: 0.4mm 0; }
.toc-empty { font-size: 9pt; color: #767676; font-style: italic; }
.case-section { break-before: page; margin-bottom: 6mm; }
.case-section:first-of-type { break-before: auto; }
.case-section-title { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 11.5pt;
  border-bottom: 0.6pt solid #999; padding-bottom: 1mm; margin: 0 0 2.5mm; }
.case-sub { font-weight: 600; font-size: 10pt; margin: 3mm 0 1mm; break-after: avoid; }
.case-block { margin-bottom: 3.5mm; break-inside: avoid; }
.case-field { font-size: 9.5pt; margin-top: 0.8mm; }
.case-field .case-label { color: #555; }
.case-prose { white-space: pre-line; font-size: 10pt; margin-top: 1mm; }
.case-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.case-table th { text-align: left; border-bottom: 0.8pt solid #666; padding: 1.2mm 2mm;
  font-weight: 600; }
.case-table td { border-bottom: 0.4pt solid #ccc; padding: 1.2mm 2mm; vertical-align: top; }
.case-hash { font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; word-break: break-all; }
.case-disposed { border: 0.8pt solid #7a1f1f; color: #7a1f1f; padding: 2.5mm 3mm;
  font-size: 9.5pt; margin-bottom: 5mm; break-inside: avoid; }
.case-unanswered { color: #767676; font-style: italic; font-weight: 400; }
</style>`

/** A rendered top-level section. `html` empty ⇒ the section does not exist. */
interface Section {
  title: string
  html: string
}

/**
 * Builds one section, or `null` when it has no content.
 *
 * ⛔ Returning null rather than an empty heading is ADR 0144's disposal
 * requirement: *"Empty sections must not render as empty headings."* A disposed
 * case would otherwise print a dozen headings over nothing, which reads as a
 * broken renderer rather than as an erased record.
 */
function section(title: string, html: string): Section | null {
  return html.trim().length > 0 ? { title, html } : null
}

function field(label: string, value: string | null): string {
  return value === null || value.trim() === ''
    ? ''
    : `<div class="case-field"><span class="case-label">${esc(label)}:</span> ${esc(value)}</div>`
}

function prose(value: string | null): string {
  return value === null || value.trim() === ''
    ? ''
    : `<div class="case-prose">${esc(value)}</div>`
}

// ---------------------------------------------------------------------------
// Section builders — one per top-level section, in printed order.
// ---------------------------------------------------------------------------

/**
 * D5's patient block.
 *
 * ⛔ **The template does NOT decide what to hide — the PROVIDER does.** On the
 * de-identified variant the five identified fields arrive already `null`,
 * because `buildCasePayload` never copies them. So this function renders
 * whatever it is given, and a template edit cannot widen the disclosure.
 *
 * ⚠ **NO "unavailable" MARKER, DELIBERATELY (ADR 0144 Amendment 2).** A minter
 * without `read_standard_phi` gets no demographics at all — `get_case_patients`
 * returns null — and this section then simply does not render. It must NOT print
 * "— dados demográficos indisponíveis —" or any equivalent: that line would
 * print the MINTER'S ENTITLEMENT onto the page, which is a worse disclosure than
 * the absence it would be being honest about. Absence and withholding look
 * identical, on purpose.
 */
function patientSection(patients: CasePatientEntry[]): string {
  return patients
    .map((p) => {
      const lines = [
        field('Nome', p.name),
        field('Prontuário', p.mrn),
        field('Data de nascimento', p.dateOfBirthDisplay),
        field('Idade', p.ageDisplay),
        field('Sexo', p.sexDisplay),
        field('Unidade', p.unitDisplay),
        field('Profissional responsável', p.attending),
        field('Atendimento', p.encounterRef),
      ]
        .filter(Boolean)
        .join('\n')
      return lines ? `<div class="case-block">\n${lines}\n</div>` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function participantsSection(rows: CaseParticipantEntry[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (p) =>
        `<tr><td>${esc(p.name)}</td><td>${esc(p.roleDisplay)}</td><td>${
          p.titleDisplay ? esc(p.titleDisplay) : '—'
        }</td><td>${p.recusalDisplay ? esc(p.recusalDisplay) : '—'}</td></tr>`,
    )
    .join('\n')
  return `<table class="case-table"><thead><tr><th>Nome</th><th>Papel</th><th>Titulação</th><th>Impedimento</th></tr></thead><tbody>
${body}
</tbody></table>`
}

/** D2: phase answers are rendered INLINE. */
function phasesSection(rows: CasePhaseEntry[]): string {
  if (rows.length === 0) return ''
  return rows
    .map((phase) => {
      const meta = [
        field('Situação', phase.statusDisplay),
        field('Responsável', phase.respondentDisplay),
        field('Enviado em', phase.submittedAtDisplay),
        field('Resultado', phase.resultDisplay),
      ]
        .filter(Boolean)
        .join('\n')
      // ⚠ `items` is EMPTY on a disposed case — `dispose_case_phi` DELETES the
      // answers outright. The phase itself survives, so it still renders with
      // its metadata; only the answer table drops.
      const answers =
        phase.items.length === 0
          ? ''
          : `<table class="case-table"><tbody>
${phase.items
  .map((item) =>
    item.kind === 'display_text'
      ? `<tr><td colspan="2">${esc(item.label)}</td></tr>`
      : `<tr><td>${esc(item.label)}</td><td>${
          item.value === null
            ? '<span class="case-unanswered">— não respondido —</span>'
            : esc(item.value)
        }</td></tr>`,
  )
  .join('\n')}
</tbody></table>`
      return `<div class="case-block">
<div class="case-sub">${esc(phase.title)}</div>
${meta}
${answers}
</div>`
    })
    .join('\n')
}

function narrativesSection(rows: CaseNarrativeEntry[]): string {
  // ⚠ A narrative whose `bodyMd` was nulled by disposal contributes NOTHING —
  // not a heading with an empty body. Filtered before mapping, so a fully
  // disposed case drops the whole section rather than printing N empty titles.
  const body = rows
    .filter((n) => n.bodyMd !== null && n.bodyMd.trim() !== '')
    .map(
      (n) => `<div class="case-block">
<div class="case-sub">${esc(n.title)}</div>
${[field('Autoria', n.authorDisplay), field('Data', n.dateDisplay)].filter(Boolean).join('\n')}
${prose(n.bodyMd)}
</div>`,
    )
    .join('\n')
  return body
}

/**
 * ⚠ **DELIBERATELY ASYMMETRIC WITH {@link narrativesSection}, and the asymmetry
 * is about what SURVIVES disposal.** A narrative whose `bodyMd` was nulled is
 * filtered out entirely — its title is a slot label ("Relato inicial") and its
 * whole substance was the body, so all that would print is a heading over
 * nothing. An interview is different: `dispose_case_phi` nulls `summary_md` but
 * does NOT delete the interview, its subjects or its interviewers. That an
 * interview HAPPENED, with whom, and when, is process evidence in its own right
 * and is exactly what ADR 0144 D3's corrected rationale says a disposed dossier
 * is still worth minting for — *a record that the case existed and was
 * disposed*. So interviews keep their metadata and lose only the summary.
 * Pinned by the disposed fingerprint fixture, which asserts the section heading
 * SURVIVES while the summary text does not.
 */
function interviewsSection(rows: CaseInterviewEntry[]): string {
  if (rows.length === 0) return ''
  return rows
    .map(
      (i) => `<div class="case-block">
<div class="case-sub">${esc(i.title)}</div>
${[
  field('Situação', i.statusDisplay),
  field('Data', i.dateDisplay),
  field('Entrevistado(s)', i.subjects.length ? i.subjects.join('; ') : null),
  field('Entrevistador(es)', i.interviewers.length ? i.interviewers.join('; ') : null),
]
  .filter(Boolean)
  .join('\n')}
${prose(i.summaryMd)}
</div>`,
    )
    .join('\n')
}

/** D2: the frozen snapshot AND the structured reply, both inline. */
function referralsSection(rows: CaseReferralEntry[]): string {
  if (rows.length === 0) return ''
  return rows
    .map((r) => {
      const snapshot = r.snapshot.length
        ? `<table class="case-table"><tbody>
${r.snapshot.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.value)}</td></tr>`).join('\n')}
</tbody></table>`
        : ''
      return `<div class="case-block">
<div class="case-sub">${esc(r.directionDisplay)} — ${esc(r.counterpartDisplay)}</div>
${[
  field('Situação', r.statusDisplay),
  field('Enviado em', r.sentAtDisplay),
  field('Questão', r.question),
]
  .filter(Boolean)
  .join('\n')}
${snapshot}
${[field('Resposta', r.replyStatusDisplay), field('Respondido em', r.repliedAtDisplay)]
  .filter(Boolean)
  .join('\n')}
${prose(r.replyBody)}
</div>`
    })
    .join('\n')
}

function timelineSection(rows: CaseTimelineEntry[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (e) =>
        `<tr><td>${esc(e.dateDisplay)}</td><td>${esc(e.kindDisplay)}</td><td>${esc(
          e.title,
        )}${e.body ? `<div class="case-prose">${esc(e.body)}</div>` : ''}</td><td>${
          e.authorDisplay ? esc(e.authorDisplay) : '—'
        }</td></tr>`,
    )
    .join('\n')
  return `<table class="case-table"><thead><tr><th>Data</th><th>Tipo</th><th>Registro</th><th>Autoria</th></tr></thead><tbody>
${body}
</tbody></table>`
}

function meetingsSection(rows: CaseMeetingEntry[]): string {
  if (rows.length === 0) return ''
  return rows
    .map(
      (m) => `<div class="case-block">
<div class="case-sub">${esc(m.meetingDisplay)}</div>
${field('Data', m.dateDisplay)}
${[field('Resumo', m.summary), field('Decisão', m.decision)].filter(Boolean).join('\n')}
</div>`,
    )
    .join('\n')
}

function actionItemsSection(rows: CaseActionItemEntry[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (a) =>
        `<tr><td>${esc(a.title)}</td><td>${esc(a.statusDisplay)}</td><td>${
          a.assigneeDisplay ? esc(a.assigneeDisplay) : '—'
        }</td><td>${a.dueDisplay ? esc(a.dueDisplay) : '—'}</td></tr>`,
    )
    .join('\n')
  return `<table class="case-table"><thead><tr><th>Ação</th><th>Situação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>
${body}
</tbody></table>`
}

function correctionsSection(rows: CaseCorrectionEntry[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (c) =>
        `<tr><td>${esc(c.dateDisplay ?? '—')}</td><td>${
          c.requestedByDisplay ? esc(c.requestedByDisplay) : '—'
        }</td><td>${esc(c.statusDisplay)}</td><td>${
          c.kindDisplay ? esc(c.kindDisplay) : '—'
        }</td><td>${c.justification ? esc(c.justification) : '—'}</td></tr>`,
    )
    .join('\n')
  return `<table class="case-table"><thead><tr><th>Data</th><th>Solicitante</th><th>Situação</th><th>Tipo</th><th>Justificativa</th></tr></thead><tbody>
${body}
</tbody></table>`
}

/**
 * D2's uploaded-binary MANIFEST — filename · uploader · date · content hash.
 *
 * ⛔ The bytes are NOT embedded, and that is a decision with a reason: Gotenberg
 * renders HTML and cannot inline an arbitrary PDF or JPEG; embedding would
 * duplicate bytes already governed by the DM3 controlled-document lifecycle; and
 * a line carrying a CONTENT HASH is stronger evidence than a re-encoded copy —
 * it lets a tracer verify the artifact they were handed separately, which an
 * embedded re-render could not.
 */
function documentsSection(rows: CaseDocumentManifestEntry[]): string {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      (d) =>
        `<tr><td>${esc(d.title)}</td><td>${
          d.uploaderDisplay ? esc(d.uploaderDisplay) : '—'
        }</td><td>${d.dateDisplay ? esc(d.dateDisplay) : '—'}</td><td class="case-hash">${
          d.contentHash ? esc(d.contentHash) : '—'
        }</td></tr>`,
    )
    .join('\n')
  return `<table class="case-table"><thead><tr><th>Documento</th><th>Enviado por</th><th>Data</th><th>Hash (SHA-256)</th></tr></thead><tbody>
${body}
</tbody></table>`
}

function metaLine(body: CaseDocumentBody): string {
  return [
    `<span class="meta-item">Situação: ${esc(body.statusDisplay)}</span>`,
    `<span class="meta-item">Classificação: ${esc(body.confidentialityDisplay)}</span>`,
    body.caseTypeDisplay
      ? `<span class="meta-item">Tipo: ${esc(body.caseTypeDisplay)}</span>`
      : '',
    body.departmentDisplay
      ? `<span class="meta-item">Setor: ${esc(body.departmentDisplay)}</span>`
      : '',
    `<span class="meta-item">Abertura: ${esc(body.openedAtDisplay)}</span>`,
    body.closedAtDisplay
      ? `<span class="meta-item">Encerramento: ${esc(body.closedAtDisplay)}</span>`
      : '',
    body.outcomeDisplay
      ? `<span class="meta-item">Desfecho: ${esc(body.outcomeDisplay)}</span>`
      : '',
    body.tags.length
      ? `<span class="meta-item">Marcadores: ${esc(body.tags.join('; '))}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')
}

/**
 * The RUNNING HEADER (D13) — case number + confidentiality label, repeated on
 * every page.
 *
 * ⚠ `position: fixed` is what repeats it: Chromium's print pipeline paints a
 * fixed box once per page, which is the same mechanism the shipped `.phi-band`
 * and `.wm-diagonal` primitives already rely on. It is NOT `@page` margin-box
 * content — Chromium ignores that entirely, which is also why the page NUMBER
 * cannot live here and travels as a Gotenberg footer instead.
 */
function runningHeader(body: CaseDocumentBody): string {
  return `<div class="case-running-header">
  <span>Caso ${esc(body.caseNumber)}</span>
  <span>${esc(body.confidentialityDisplay)}</span>
</div>`
}

/** Renders the dossier body. */
export function renderCaseBody(body: CaseDocumentBody): string {
  // ⭐ ONE list drives BOTH the index and the document. A parallel hand-written
  // TOC array is the drift this avoids — it would eventually name a section the
  // document does not contain, on a page that claims to be an authoritative
  // record.
  const sections: Section[] = [
    section('Identificação do paciente', patientSection(body.patients)),
    section('Participantes', participantsSection(body.participants)),
    section('Fases do processo', phasesSection(body.phases)),
    section('Narrativas', narrativesSection(body.narratives)),
    section('Entrevistas', interviewsSection(body.interviews)),
    section('Encaminhamentos entre comissões', referralsSection(body.referrals)),
    section('Reuniões', meetingsSection(body.meetings)),
    section('Linha do tempo', timelineSection(body.timeline)),
    section('Planos de ação', actionItemsSection(body.actionItems)),
    section('Solicitações de correção', correctionsSection(body.corrections)),
    section('Documentos anexados', documentsSection(body.documents)),
  ].filter((s): s is Section => s !== null)

  const toc: TableOfContentsEntry[] = sections.map((s) => ({ title: s.title }))

  // A factual notice, not an error state: it explains WHY the document below is
  // thin, so a reader does not mistake an erased record for a broken renderer.
  const disposalNotice = body.phiDisposed
    ? `<div class="case-disposed">Os dados de paciente deste caso foram descartados
      (LGPD Art. 18). O conteúdo removido não consta deste documento.</div>`
    : ''

  return `${STYLE}
${runningHeader(body)}
<h1 class="doc-title">Dossiê do caso ${esc(body.caseNumber)}${
    body.title ? ` — ${esc(body.title)}` : ''
  }</h1>
<div class="case-meta">
    ${metaLine(body)}
</div>
${disposalNotice}
${renderTableOfContents(toc)}
${sections
  .map(
    (s) => `<section class="case-section">
<h2 class="case-section-title">${esc(s.title)}</h2>
${s.html}
</section>`,
  )
  .join('\n')}`
}
