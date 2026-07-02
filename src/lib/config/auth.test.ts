import { afterEach, describe, expect, it } from 'vitest'

import { isEmailVerificationEnabled } from './auth'

/**
 * `isEmailVerificationEnabled` reads the server-only `AUTH_EMAIL_VERIFICATION`
 * flag. DEFAULT OFF: true ONLY for exactly `on`/`true` (case-insensitive,
 * trimmed); everything else — unset, empty, `off`, `false`, garbage — is false.
 */
describe('isEmailVerificationEnabled', () => {
  const original = process.env.AUTH_EMAIL_VERIFICATION

  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_EMAIL_VERIFICATION
    else process.env.AUTH_EMAIL_VERIFICATION = original
  })

  function withFlag(value: string | undefined): boolean {
    if (value === undefined) delete process.env.AUTH_EMAIL_VERIFICATION
    else process.env.AUTH_EMAIL_VERIFICATION = value
    return isEmailVerificationEnabled()
  }

  it('defaults OFF when unset', () => {
    expect(withFlag(undefined)).toBe(false)
  })

  it('is OFF for empty string', () => {
    expect(withFlag('')).toBe(false)
  })

  it("is OFF for 'off'", () => {
    expect(withFlag('off')).toBe(false)
  })

  it("is OFF for 'false'", () => {
    expect(withFlag('false')).toBe(false)
  })

  it("is OFF for garbage", () => {
    expect(withFlag('yes')).toBe(false)
  })

  it("is ON for 'on'", () => {
    expect(withFlag('on')).toBe(true)
  })

  it("is ON for 'true'", () => {
    expect(withFlag('true')).toBe(true)
  })

  it('is ON for mixed-case and surrounding whitespace', () => {
    expect(withFlag('  On ')).toBe(true)
    expect(withFlag('TRUE')).toBe(true)
    expect(withFlag('True')).toBe(true)
  })
})
