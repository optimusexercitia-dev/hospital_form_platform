/**
 * CPF — the person key (ADR 0097 D7).
 *
 * NOTE: intentionally NOT `server-only`. This is a pure pair of functions, safe to
 * import from a Client Component (the identifier-first register form validates as the
 * admin types, W3/T3.1) as well as from the server actions.
 *
 * ⚠ This is the TS half of a MIRRORED RULE — the SQL half is `app.is_valid_cpf`
 * (migration `20260909000200_profiles_cpf.sql`), which backs the CHECK constraints on
 * `profiles.cpf` and `professional_profiles.cpf`. Same class as the condition
 * evaluator (Architecture Rule 3): one authority, two call sites, and DRIFT IS
 * PHASE-BLOCKING. The two are held in agreement by the shared golden vectors in
 * `__fixtures__/cpf-vectors.json`, which `cpf.test.ts` runs against this half and
 * pgTAP `301` runs against the other — plus a drift detector asserting the pgTAP file
 * still embeds those bytes verbatim.
 *
 * Storage form is DIGITS ONLY. {@link normalizeCpf} is the only thing that may accept
 * punctuation; {@link isValidCpf} deliberately refuses a formatted CPF, exactly as the
 * SQL half does, so a caller cannot skip normalization and still pass.
 */

/**
 * Strip everything that is not a digit. The action layer calls this on operator input
 * BEFORE validating or storing, so '111.444.777-35' and '11144477735' are one value.
 */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Whether `value` is a well-formed CPF in STORAGE form: exactly 11 digits, not one of
 * the eleven repdigits, and both check digits correct.
 *
 * The repdigit exclusion is not cosmetic — '00000000000' and its ten siblings SATISFY
 * the check-digit arithmetic, so without it the validator accepts eleven non-issuable
 * numbers.
 */
export function isValidCpf(value: string): boolean {
  if (!/^[0-9]{11}$/.test(value)) return false
  if (/^([0-9])\1{10}$/.test(value)) return false

  const d = Array.from(value, (c) => c.charCodeAt(0) - 48)

  // First check digit: weights 10..2 over digits 1..9.
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += d[i] * (10 - i)
  let dv = sum % 11
  dv = dv < 2 ? 0 : 11 - dv
  if (dv !== d[9]) return false

  // Second check digit: weights 11..2 over digits 1..10.
  sum = 0
  for (let i = 0; i < 10; i += 1) sum += d[i] * (11 - i)
  dv = sum % 11
  dv = dv < 2 ? 0 : 11 - dv
  return dv === d[10]
}

/**
 * ADR 0147's SINGLE CPF masking mechanism, moved here from `person-footprint.ts` so both
 * directions of the CPF rule live in one module: `normalizeCpf` strips it for storage and
 * comparison, `maskCpf` renders it for a human.
 *
 * ⛔ THERE IS EXACTLY ONE OF THESE. Masking is a shoulder-surfing and screenshot
 * mitigation, applied at the query boundary — never a confidentiality boundary against
 * the subject, and never duplicated in SQL. A second implementation is how the two drift
 * into showing different digit counts on different screens.
 *
 * Returns null for anything that is not 11 digits: a partial CPF is not a CPF, and
 * rendering one implies a completeness the data does not have.
 */
export function maskCpf(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return null
  const bullet = '•'
  return (
    digits.slice(0, 3) +
    '.' +
    bullet.repeat(3) +
    '.' +
    bullet +
    digits.slice(7, 9) +
    '-' +
    digits.slice(9, 11)
  )
}
