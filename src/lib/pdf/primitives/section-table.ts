import { esc } from '../escape'

/** One rendered row of a section: a question with its (pre-formatted) answer,
 * or a display-text passage spanning the full width. */
export interface SectionTableRow {
  kind: 'question' | 'display_text'
  label: string
  /** Pre-formatted pt-BR value; null = unanswered. Always null for display_text. */
  value: string | null
}

/**
 * The section body table: question | answer rows, display text full-width.
 * Values arrive PRE-FORMATTED from the data provider (the template only lays
 * out — ADR 0104 D4) and are escaped here (Rule 7).
 */
export function renderSectionTable(rows: SectionTableRow[]): string {
  if (rows.length === 0) {
    return '<div class="section-empty">— seção sem itens —</div>'
  }
  const body = rows
    .map((row) => {
      if (row.kind === 'display_text') {
        return `<tr class="row-display"><td colspan="2">${esc(row.label)}</td></tr>`
      }
      const value =
        row.value === null
          ? '<span class="unanswered">— não respondido —</span>'
          : esc(row.value)
      return `<tr class="row-question"><td class="cell-label">${esc(row.label)}</td><td class="cell-value">${value}</td></tr>`
    })
    .join('\n')
  return `<table class="section-table"><tbody>\n${body}\n</tbody></table>`
}
