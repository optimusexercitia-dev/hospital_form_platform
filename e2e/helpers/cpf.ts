/**
 * Generates fresh, VALID (check-digit-correct) CPFs for E2E fixtures.
 *
 * `registerUser` now REQUIRES a CPF (ADR 0097 D7) and `profiles.cpf` is unique
 * platform-wide, so every spec that registers a person through the identifier-first
 * flow needs a CPF nobody else has used. This mirrors the check-digit algorithm in
 * `src/lib/users/cpf.ts` (`isValidCpf`) / `app.is_valid_cpf` (SQL) exactly — a CPF this
 * helper produces MUST validate under both, or the seed's own mirrored-rule contract is
 * broken. Deliberately duplicated rather than imported: `e2e/**` must not import
 * application source (test-vs-app boundary), and the algorithm is public domain (a
 * fixed weighted-sum + mod-11 rule), not a secret worth centralizing across that line.
 *
 * Uniqueness: seeded with the current time in milliseconds plus a per-call counter, so
 * two calls in the same millisecond (or across parallel workers) never collide. Time-
 * based, not reset-scoped, because this suite runs against a live, non-reset local DB
 * between gate runs (tester boundary — no `supabase db reset` without the lead's
 * say-so), so a CPF minted in one run must not collide with one from an earlier run
 * still sitting in the DB.
 */

let counter = 0

function checkDigits(base9: string): string {
  const d = Array.from(base9, (c) => c.charCodeAt(0) - 48)

  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += d[i] * (10 - i)
  let dv1 = sum % 11
  dv1 = dv1 < 2 ? 0 : 11 - dv1

  const d10 = [...d, dv1]
  sum = 0
  for (let i = 0; i < 10; i += 1) sum += d10[i] * (11 - i)
  let dv2 = sum % 11
  dv2 = dv2 < 2 ? 0 : 11 - dv2

  return `${dv1}${dv2}`
}

/** A fresh, check-digit-valid, digits-only CPF — never a seeded/reserved value. */
export function uniqueCpf(): string {
  counter += 1
  // 9 digits from (time, counter) — mod down, then guard the repdigit edge case
  // ('000000000'..'999999999' pass the arithmetic but are not issuable numbers, and
  // `isValidCpf` rejects them).
  const n = (Date.now() * 1000 + counter) % 1_000_000_000
  let base = String(n).padStart(9, '0')
  if (/^(\d)\1{8}$/.test(base)) {
    base = `1${base.slice(1)}`
  }
  return base + checkDigits(base)
}
