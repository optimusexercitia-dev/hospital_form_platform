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
