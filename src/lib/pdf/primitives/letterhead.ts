import { esc } from '../escape'
import type { DocumentLetterhead } from '../types'

/**
 * Letterhead (ADR 0104 D4): per-hospital branding enters as DATA — name, logo
 * (data-URI), address — never as template code. Text-only when no logo.
 */
export function renderLetterhead(letterhead: DocumentLetterhead): string {
  const logo = letterhead.logoDataUri
    ? `<img class="lh-logo" src="${esc(letterhead.logoDataUri)}" alt="" />`
    : ''
  const address = letterhead.hospitalAddress
    ? `<div class="lh-address">${esc(letterhead.hospitalAddress)}</div>`
    : ''
  return `<header class="letterhead">
  ${logo}
  <div class="lh-text">
    <div class="lh-hospital">${esc(letterhead.hospitalName)}</div>
    ${address}
    <div class="lh-commission">${esc(letterhead.commissionName)}</div>
  </div>
</header>`
}
