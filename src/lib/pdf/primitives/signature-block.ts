import { esc } from '../escape'
import { formatDateTime } from '../format'
import type { SignatureAttestation } from '../types'

/**
 * Signature ATTESTATION block (ADR 0104 D13): "Assinado eletronicamente por
 * [name], [title] — [date/time]". No cursive fonts, no images, no synthesized
 * signature look — a printed imitation of a wet signature misrepresents its
 * legal nature. The caption states the basis honestly: these are platform
 * sign-offs, NOT ICP-Brasil qualified signatures.
 */
export function renderSignatureBlock(sig: SignatureAttestation): string {
  const title = sig.title ? `, ${esc(sig.title)}` : ''
  return `<div class="signature-block">
  <div class="sig-line">Assinado eletronicamente por <strong>${esc(sig.name)}</strong>${title} — ${esc(formatDateTime(sig.timestamp))}</div>
  <div class="sig-caption">Assinatura eletrônica registrada na plataforma</div>
</div>`
}

/** The unsigned marker for a section that expects a sign-off (D13.3) —
 * composes with the RASCUNHO watermark rather than blocking the mint. */
export function renderUnsigned(): string {
  return '<div class="signature-block signature-missing">— não assinado —</div>'
}
