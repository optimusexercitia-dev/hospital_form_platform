import { randomBytes, randomInt, randomUUID } from 'node:crypto'

/**
 * Verification-credential minting (ADR 0104 D10 + lead Amendment A): the
 * ACTION generates id + token + short code BEFORE payload build, because the
 * QR in the canonical bytes must carry the final `/verificar/<token>` URL —
 * the door validates format and the unique constraints enforce uniqueness.
 */

/** Registry id — also the derived storage path (`std/<id>.pdf`). */
export function mintDocumentId(): string {
  return randomUUID()
}

/** ≥192-bit URL-safe token: 24 random bytes → 32 chars of base64url, matching
 * the door's `^[A-Za-z0-9_-]{32,128}$`. */
export function mintVerificationToken(): string {
  return randomBytes(24).toString('base64url')
}

/** The uppercase unambiguous alphabet (no I/O/0/1) — 32 symbols × 10 chars =
 * 50 bits, collision-negligible; the lookup door uppercases presented codes so
 * humans may type them in any case (lead-delegated decision). */
export const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const SHORT_CODE_LENGTH = 10

export function mintVerificationShortCode(): string {
  let code = ''
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    code += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)]
  }
  return code
}
