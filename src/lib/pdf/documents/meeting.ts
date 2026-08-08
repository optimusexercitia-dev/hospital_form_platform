import { esc } from '../escape'
import { formatDateTime } from '../format'
import { renderSignatureBlock, renderUnsigned } from '../primitives'
import type { MeetingDocumentBody, SignatureAttestation } from '../types'

/**
 * The meeting (ata) document template (PDF·P2; ADR 0104 D4/D13/D15 step 2).
 *
 * TEMPLATE_VERSION is LOAD-BEARING metadata: recorded in the registry at mint,
 * reported by verification. ⛔ Any visual/structural change REQUIRES bumping it
 * — `fingerprint.test.ts` reds on an unbumped change (canonical + variant).
 *
 * Template-SCOPED styles: this module emits its own `<style>` block instead of
 * extending the shared shell CSS — deliberately, so adding this template moved
 * NO form_response fingerprint (the shell is part of every document's hash).
 *
 * The multi-signature FOOTER renders from the ENVELOPE's attestations (D13 —
 * whole-document scope); with none recorded it renders "— não assinado —",
 * composing with the RASCUNHO watermark rather than blocking the mint.
 */
export const TEMPLATE_KEY = 'meeting'
export const TEMPLATE_VERSION = 1

/**
 * The ONE watermark derivation for meetings (QA MINOR-5): FINAL ⇔ the minutes
 * are approved+signed (`signed` | `distributed` — ADR 0104 D7); every other
 * state — including `in_signature` and `cancelled` — is RASCUNHO. Consumed by
 * the provider AND the mint dialog preview, so the mark the dialog promises is
 * the mark the renderer stamps, by construction. PURE (string in, flag out) —
 * importable from client code via `@/lib/pdf/documents/meeting`.
 */
export function meetingWatermarkFor(status: string): 'draft' | 'final' {
  return status === 'signed' || status === 'distributed' ? 'final' : 'draft'
}

const STYLE = `<style>
.ata-meta { font-size: 8.5pt; color: #444; margin-bottom: 5mm; }
.ata-meta .meta-item { margin-right: 6mm; }
.ata-section-title { font-family: 'IBM Plex Serif', serif; font-weight: 600; font-size: 11.5pt;
  border-bottom: 0.6pt solid #999; padding-bottom: 1mm; margin: 6mm 0 2.5mm; }
.ata-minutes { white-space: pre-line; font-size: 10pt; }
.agenda-item { margin-bottom: 3.5mm; break-inside: avoid; }
.agenda-item-title { font-weight: 600; }
.agenda-field { font-size: 9.5pt; margin-top: 0.8mm; }
.agenda-field .agenda-label { color: #555; }
.ata-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.ata-table th { text-align: left; border-bottom: 0.8pt solid #666; padding: 1.2mm 2mm;
  font-weight: 600; }
.ata-table td { border-bottom: 0.4pt solid #ccc; padding: 1.2mm 2mm; vertical-align: top; }
.ata-signatures { margin-top: 8mm; }
.ata-empty { font-size: 9pt; color: #767676; font-style: italic; }
</style>`

function metaLine(body: MeetingDocumentBody): string {
  const parts = [
    body.meetingTypeDisplay
      ? `<span class="meta-item">Tipo: ${esc(body.meetingTypeDisplay)}</span>`
      : '',
    `<span class="meta-item">Situação: ${esc(body.statusDisplay)}</span>`,
    `<span class="meta-item">Agendada para: ${esc(formatDateTime(body.scheduledStart))}</span>`,
    body.heldAt
      ? `<span class="meta-item">Realizada em: ${esc(formatDateTime(body.heldAt))}${body.heldEnd ? ` — ${esc(formatDateTime(body.heldEnd))}` : ''}</span>`
      : '',
    body.modalityDisplay
      ? `<span class="meta-item">Modalidade: ${esc(body.modalityDisplay)}</span>`
      : '',
    body.locationDisplay
      ? `<span class="meta-item">Local: ${esc(body.locationDisplay)}</span>`
      : '',
    body.quorum
      ? `<span class="meta-item">Quórum: ${
          body.quorum.met === null ? 'não apurado' : body.quorum.met ? 'atingido' : 'não atingido'
        }${
          body.quorum.presentCount !== null && body.quorum.eligibleCount !== null
            ? ` (${body.quorum.presentCount} de ${body.quorum.eligibleCount})`
            : ''
        }</span>`
      : '',
  ]
  return parts.filter(Boolean).join('\n    ')
}

function agendaSection(body: MeetingDocumentBody): string {
  if (body.agenda.length === 0) {
    return '<div class="ata-empty">— pauta sem itens registrados —</div>'
  }
  return body.agenda
    .map((item, idx) => {
      const fields = [
        item.description
          ? `<div class="agenda-field"><span class="agenda-label">Descrição:</span> ${esc(item.description)}</div>`
          : '',
        item.discussionNotes
          ? `<div class="agenda-field"><span class="agenda-label">Discussão:</span> ${esc(item.discussionNotes)}</div>`
          : '',
        item.resolution
          ? `<div class="agenda-field"><span class="agenda-label">Deliberação:</span> ${esc(item.resolution)}</div>`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
      return `<div class="agenda-item">
  <div class="agenda-item-title">${idx + 1}. ${esc(item.title)}</div>
  ${fields}
</div>`
    })
    .join('\n')
}

function attendanceSection(body: MeetingDocumentBody): string {
  if (body.attendance.length === 0) {
    return '<div class="ata-empty">— sem participantes registrados —</div>'
  }
  const rows = body.attendance
    .map(
      (a) =>
        `<tr><td>${esc(a.name)}</td><td>${esc(a.roleDisplay)}</td><td>${esc(a.attendanceDisplay)}</td></tr>`,
    )
    .join('\n')
  return `<table class="ata-table"><thead><tr><th>Participante</th><th>Função</th><th>Presença</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

function actionItemsSection(body: MeetingDocumentBody): string {
  if (body.actionItems.length === 0) return ''
  const rows = body.actionItems
    .map(
      (item) =>
        `<tr><td>${esc(item.title)}</td><td>${esc(item.statusDisplay)}</td><td>${
          item.assigneeDisplay ? esc(item.assigneeDisplay) : '—'
        }</td><td>${item.dueDisplay ? esc(item.dueDisplay) : '—'}</td></tr>`,
    )
    .join('\n')
  return `<h2 class="ata-section-title">Encaminhamentos</h2>
<table class="ata-table"><thead><tr><th>Ação</th><th>Situação</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>
${rows}
</tbody></table>`
}

/** Renders the ata body; the signature FOOTER comes from the envelope (D13). */
export function renderMeetingBody(
  body: MeetingDocumentBody,
  signatures: SignatureAttestation[],
): string {
  const minutes = body.minutesMd
    ? `<h2 class="ata-section-title">Ata</h2>
<div class="ata-minutes">${esc(body.minutesMd)}</div>`
    : ''
  const footer =
    signatures.length > 0
      ? signatures.map((sig) => renderSignatureBlock(sig)).join('\n')
      : renderUnsigned()

  return `${STYLE}
<h1 class="doc-title">Ata — Reunião nº ${body.meetingNumber}: ${esc(body.title)}</h1>
<div class="ata-meta">
    ${metaLine(body)}
</div>
${minutes}
<h2 class="ata-section-title">Pauta e deliberações</h2>
${agendaSection(body)}
<h2 class="ata-section-title">Participantes</h2>
${attendanceSection(body)}
${actionItemsSection(body)}
<div class="ata-signatures">
${footer}
</div>`
}
