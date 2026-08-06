import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ⚠ THE SQL↔TS ERROR-ARM DRIFT DETECTOR (AFF W3; ADR 0098 §W3.5).
 *
 * `toState` in `./actions.ts` maps a door's SQLSTATE to a pt-BR sentence, and it ends in
 * `default: generic` — "Não foi possível concluir. Tente novamente." That default is
 * exactly why a missing arm is INVISIBLE: the switch is TOTAL, so tsc, eslint, Vitest
 * and pgTAP all pass while a real refusal silently degrades into a retry instruction
 * for a condition retrying cannot fix.
 *
 * It has already happened once. `20260909001000` added `HC0R4` ("conta desativada") to
 * `app.affiliate_person_impl`; `toState` had arms for 42501 and HC0R0–HC0R3, so a
 * deactivated account was reported as a transient failure. Nothing could have caught
 * it, because nothing compared the two sides.
 *
 * This is the recorded "a new door must inherit EVERY sibling arm" lesson with the
 * enumeration crossing a LANGUAGE boundary — and the recorded fix for that class is to
 * derive the enumeration from the authority that defines the property, not from the
 * list that already exists. So this test reads the SQLSTATEs out of the affiliation
 * migrations and requires an arm for each, rather than checking the arms it can see.
 *
 * ⚠ ON "MIGRATION TEXT IS STALE BY DESIGN": that rule governs believing a FILE about
 * the LIVE CATALOG. This test compares two SOURCE artifacts — the migration that
 * defines the door and the TS that maps it — which is a different claim. The live half
 * is pinned separately: pgTAP `304` §6 asserts the running kernels raise exactly this
 * set, so a runtime-patched code cannot hide from both.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/** The migrations that define the affiliation doors. */
const DOOR_MIGRATIONS = [
  '20260909000500_affiliation_doors.sql',
  '20260909001000_affiliate_active_guard.sql',
  '20260909001100_update_affiliation_door.sql',
]

function raisedCodes(): Set<string> {
  const codes = new Set<string>()
  for (const file of DOOR_MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
      // Strip SQL comments first: a `--` line documenting a code is not a raise, and
      // counting one is the recorded prosrc-regex trap in its file-shaped form.
      .replace(/--[^\n]*/g, '')
    for (const m of sql.matchAll(/errcode\s*=\s*'([A-Z0-9]{5})'/g)) codes.add(m[1])
  }
  return codes
}

describe('affiliation doors <-> toState error arms', () => {
  it('the door migrations still exist under the names this test reads', () => {
    // A renamed or split migration would make `raisedCodes()` return an empty set, and
    // an empty set satisfies the main assertion VACUOUSLY — the detector would report
    // success precisely when it had stopped looking.
    const present = new Set(readdirSync(MIGRATIONS))
    for (const file of DOOR_MIGRATIONS) expect(present, file).toContain(file)
  })

  it('finds a non-trivial set of raised SQLSTATEs (the detector can see something)', () => {
    const codes = raisedCodes()
    expect(codes.size, 'no errcodes parsed — the regex or the files moved').toBeGreaterThan(3)
    expect(codes).toContain('HC0R4')
  })

  it('EVERY SQLSTATE the doors raise has a pt-BR arm in toState', () => {
    const actions = readFileSync(
      join(process.cwd(), 'src', 'lib', 'affiliations', 'actions.ts'),
      'utf8',
    )
    const missing = [...raisedCodes()].filter(
      (code) => !new RegExp(`case\\s+'${code}'\\s*:`).test(actions),
    )
    expect(
      missing,
      `these door SQLSTATEs fall through to the generic "try again" message: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('every arm maps to a DISTINCT message (no arm silently duplicates the generic one)', () => {
    // An arm that returns `MESSAGES.generic` is an arm in name only — it restores the
    // exact defect this file exists to prevent while looking like a fix.
    const actions = readFileSync(
      join(process.cwd(), 'src', 'lib', 'affiliations', 'actions.ts'),
      'utf8',
    )
    for (const code of raisedCodes()) {
      const arm = new RegExp(`case\\s+'${code}'\\s*:[\\s\\S]{0,200}?return\\s*\\{[^}]*\\}`)
      const body = arm.exec(actions)?.[0] ?? ''
      expect(body, `${code} is mapped to the generic message`).not.toMatch(
        /MESSAGES\.generic/,
      )
    }
  })
})
