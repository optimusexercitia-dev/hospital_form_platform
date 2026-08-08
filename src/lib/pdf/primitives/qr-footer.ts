import { renderSVG } from 'uqr'

import { esc } from '../escape'
import { formatDateTime } from '../format'
import type { DocumentEmission, DocumentQr } from '../types'

/**
 * QR verification footer (ADR 0104 D10) + emission line. The QR encodes the
 * `/verificar/<token>` URL — a dedicated verification credential, never the
 * registry id (the paper never carries a registry key). The human-typable
 * short code prints beside it as the damage fallback, in Mono.
 *
 * `uqr` is a zero-dependency pure encoder returning an SVG STRING — no canvas,
 * no DOM, Vitest-safe (the B0 dependency pick).
 */
export function renderQrFooter(qr: DocumentQr, emission: DocumentEmission): string {
  const svg = renderSVG(qr.url, { ecc: 'M', border: 1 })
  return `<footer class="qr-footer">
  <div class="qr-code">${svg}</div>
  <div class="qr-meta">
    <div class="qr-verify">Verifique a autenticidade deste documento em:</div>
    <div class="qr-url">${esc(qr.url)}</div>
    <div class="qr-short">Código de verificação: <span class="qr-short-code">${esc(qr.shortCode)}</span></div>
    <div class="qr-emission">Emitido em ${formatDateTime(emission.at)} por ${esc(emission.byDisplay)}</div>
  </div>
</footer>`
}
