/**
 * pt-BR value formatting for printed documents (PURE — ADR 0104 D14).
 *
 * Deterministic: same input, same output — the fingerprint test and the
 * content-hash pipeline both rely on render determinism. Timestamps format in
 * the hospital-local zone (America/Sao_Paulo), the zone the paper will be read
 * in; per-tenant zones would enter as payload data if ever needed.
 *
 * ⚠ The unparseable-input fallback returns the INPUT string — so every
 * template call site wraps these in `esc(...)` (QA MINOR-5): a well-formed
 * date has no HTML metacharacters (esc is a no-op there), and a malformed
 * payload value can never reach Chromium unescaped.
 */

const TZ = 'America/Sao_Paulo'

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** ISO timestamp → `dd/mm/aaaa hh:mm` (pt-BR, hospital-local zone). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateTimeFmt.format(d).replace(',', '')
}

/** ISO date/timestamp → `dd/mm/aaaa`. Plain `yyyy-mm-dd` strings format as a
 * calendar date (no zone shift — a date answer is a date, not an instant). */
export function formatDate(iso: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return dateFmt.format(d)
}
