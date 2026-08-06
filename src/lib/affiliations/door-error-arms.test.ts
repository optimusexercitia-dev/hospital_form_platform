import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ⚠ THE SQL↔TS ERROR-ARM DRIFT DETECTOR (AFF W3; ADR 0098 §W3.5, widened by F2).
 *
 * `toState` in `./actions.ts` maps a door's SQLSTATE to a pt-BR sentence and ends in
 * `default: generic` — "Não foi possível concluir. Tente novamente." That default is why
 * a missing arm is INVISIBLE: the switch is TOTAL, so tsc, eslint, Vitest and pgTAP all
 * pass while a real refusal degrades into a retry instruction for a condition retrying
 * cannot fix.
 *
 * ⚠⚠ THIS FILE ALREADY FAILED ONCE, AT EXACTLY THE THING IT EXISTS TO CATCH.
 * Its first version enumerated with `errcode = '([A-Z0-9]{5})'` — while SIX sites in the
 * very migrations it reads raised `errcode = 'check_violation'`, a NAMED CONDITION. The
 * detector built to catch an unmapped code could not see an unmapped code, because its
 * boundary was a SYNTAX (a five-character literal) instead of the PROPERTY (a raise the
 * mapper must handle). That is this project's most-repeated lesson landing inside the fix
 * for its own previous instance.
 *
 * The domain is therefore derived from the property now:
 *   - ANY `errcode = '<whatever>'`, in any spelling;
 *   - named conditions NORMALIZED to the SQLSTATE the client actually receives (a caller
 *     sees `23514`, never the word `check_violation`);
 *   - an UNRECOGNISED name is a FAILURE, not a skip — the one behaviour that keeps the
 *     domain from silently shrinking a third time.
 *
 * ⚠ ON "MIGRATION TEXT IS STALE BY DESIGN": that rule governs believing a FILE about the
 * LIVE CATALOG. This compares two SOURCE artifacts — the migration that defines the door
 * and the TS that maps it. The live half is pinned separately: pgTAP `304` §6 asserts the
 * running kernels raise exactly this set, so a runtime-patched code cannot hide from both.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/** The migrations that define the affiliation doors. */
const DOOR_MIGRATIONS = [
  '20260909000500_affiliation_doors.sql',
  '20260909001000_affiliate_active_guard.sql',
  '20260909001100_update_affiliation_door.sql',
  '20260909001200_affiliation_door_error_codes.sql',
]

/**
 * Postgres named conditions → the SQLSTATE a PostgREST caller actually receives.
 * Deliberately SMALL and deliberately INCOMPLETE: {@link extractRaisedCodes} THROWS on a
 * name that is not here, so an unmapped spelling fails loudly instead of vanishing from
 * the domain the way `check_violation` did.
 */
const CONDITION_TO_SQLSTATE: Record<string, string> = {
  check_violation: '23514',
  unique_violation: '23505',
  foreign_key_violation: '23503',
  insufficient_privilege: '42501',
  raise_exception: 'P0001',
  no_data_found: 'P0002',
}

/**
 * Every SQLSTATE the given SQL raises, normalized. Exported so the detector's own
 * behaviour can be tested against a hand-classified sample — a detector that finds
 * nothing must be proven able to find something.
 *
 * Trigger functions are excluded by RETURN TYPE, not by a name list: their raises fire on
 * paths no door performs (`guard_affiliation_no_delete` only fires on DELETE, which no
 * action calls), so they never reach `toState`. Excluding them by the property rather
 * than by name is the same correction this file's own domain needed.
 */
export function extractRaisedCodes(sql: string): Set<string> {
  return codesFromBlocks(functionBlocks(sql).values())
}

/**
 * The non-trigger function bodies in `sql`, keyed by qualified function name.
 *
 * KEYED, because migrations are FORWARD-ONLY and `create or replace` means the LAST
 * definition wins. Reading every migration's text as if all of it were live is how this
 * detector first reported `23514` as unmapped: `20260909001200` had already replaced
 * `check_violation` with `HC0R5`, but the superseded text in `000500`/`001000`/`001100`
 * is still on disk and must never be edited. Resolving last-write-wins per function is
 * what Postgres does when it applies the chain, so it is what the domain must do too.
 *
 * Trigger functions are excluded by RETURN TYPE, not by a name list: their raises fire
 * on paths no door performs, so they never reach `toState`.
 */
function functionBlocks(sql: string): Map<string, string> {
  const withoutComments = sql.replace(/--[^\n]*/g, '')
  const blocks = withoutComments.split(/create\s+or\s+replace\s+function/i).slice(1)

  const byName = new Map<string, string>()
  for (const block of blocks) {
    // No `.` in this pattern, so the dotAll flag was never needed — and `s` requires an
    // es2018+ target, which tsc rejects here (Vitest transpiled it happily; the gate caught it).
    if (/^\s*[^(]*\([^)]*\)\s*returns\s+trigger/i.test(block)) continue
    const name = /^\s*([a-z_]+\.[a-z_]+)/i.exec(block)?.[1]
    if (!name) continue
    byName.set(name, block)
  }
  return byName
}

function codesFromBlocks(blocks: Iterable<string>): Set<string> {
  const codes = new Set<string>()
  for (const block of blocks) {
    for (const m of block.matchAll(/errcode\s*=\s*'([^']+)'/g)) {
      const raw = m[1]
      if (/^[A-Z0-9]{5}$/.test(raw)) {
        codes.add(raw)
        continue
      }
      const mapped = CONDITION_TO_SQLSTATE[raw]
      if (!mapped) {
        throw new Error(
          `unrecognised named condition '${raw}' - add it to CONDITION_TO_SQLSTATE with ` +
            `its SQLSTATE, or the detector silently stops covering it`,
        )
      }
      codes.add(mapped)
    }
  }
  return codes
}

/**
 * The SQLSTATEs the doors raise AS THE CHAIN RESOLVES THEM - later migrations override
 * earlier definitions of the same function, exactly as applying them does.
 */
function raisedCodes(): Set<string> {
  const resolved = new Map<string, string>()
  for (const file of DOOR_MIGRATIONS) {
    // DOOR_MIGRATIONS is in version order; later files overwrite earlier definitions.
    for (const [name, block] of functionBlocks(readFileSync(join(MIGRATIONS, file), 'utf8'))) {
      resolved.set(name, block)
    }
  }
  return codesFromBlocks(resolved.values())
}

function actionsSource(): string {
  return readFileSync(join(process.cwd(), 'src', 'lib', 'affiliations', 'actions.ts'), 'utf8')
}

// ---------------------------------------------------------------------------
// The dry-run: a hand-classified sample carrying a KNOWN POSITIVE. The old detector could
// not see `check_violation`; the widened one must.
// ---------------------------------------------------------------------------
const SAMPLE = `
create or replace function app.sample_door(p uuid) returns uuid
language plpgsql security definer as $$
begin
  -- raise exception 'a comment naming HC0Z9' using errcode = 'HC0Z9';
  if a then raise exception 'coded' using errcode = 'HC0R0'; end if;
  if b then raise exception 'named' using errcode = 'check_violation'; end if;
  if c then raise exception 'privilege' using errcode = '42501'; end if;
end $$;

create or replace function app.sample_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'never surfaces through toState' using errcode = 'HC0Y8';
end $$;
`

describe('the detector itself (dry-run against a hand-classified sample)', () => {
  it('⭐ finds the NAMED condition the previous version was blind to', () => {
    // The known positive: `check_violation` normalizes to 23514, and the old regex
    // `'([A-Z0-9]{5})'` could not match the word at all.
    expect(extractRaisedCodes(SAMPLE)).toContain('23514')
  })

  it('still finds five-character codes, and ignores commented-out raises', () => {
    const codes = extractRaisedCodes(SAMPLE)
    expect(codes).toContain('HC0R0')
    expect(codes).toContain('42501')
    expect(codes, 'a `--` line naming a code is not a raise').not.toContain('HC0Z9')
  })

  it('excludes trigger functions by RETURN TYPE, not by name', () => {
    expect(extractRaisedCodes(SAMPLE), 'a trigger raise never reaches toState').not.toContain(
      'HC0Y8',
    )
  })

  it('THROWS on an unrecognised named condition rather than skipping it', () => {
    // The behaviour that stops the domain from silently shrinking a third time.
    expect(() =>
      extractRaisedCodes(
        `create or replace function app.x() returns uuid language plpgsql as $$ begin
           raise exception 'y' using errcode = 'division_by_zero'; end $$;`,
      ),
    ).toThrow(/unrecognised named condition/i)
  })
})

// ---------------------------------------------------------------------------
// The contract itself.
// ---------------------------------------------------------------------------
describe('affiliation doors <-> toState error arms', () => {
  it('the door migrations still exist under the names this test reads', () => {
    // A renamed or split migration would make the domain EMPTY, and an empty domain
    // satisfies the main assertion vacuously — reporting success precisely when it had
    // stopped looking.
    const present = new Set(readdirSync(MIGRATIONS))
    for (const file of DOOR_MIGRATIONS) expect(present, file).toContain(file)
  })

  it('finds a non-trivial set of raised SQLSTATEs', () => {
    const codes = raisedCodes()
    expect(codes.size, 'no errcodes parsed — the regex or the files moved').toBeGreaterThan(3)
    expect(codes).toContain('HC0R4')
    expect(codes, 'F2 replaced check_violation with a dedicated code').toContain('HC0R5')
  })

  it('resolves SUPERSEDED definitions away (forward-only chain, last write wins)', () => {
    // 000500/001000/001100 still contain `check_violation` on disk - they are historical
    // and must never be edited - and 001200 replaced it with HC0R5. If the domain read
    // every file as live it would demand an arm for a code no door raises any more: a
    // FALSE positive. A detector's credibility depends on not crying wolf either.
    expect(raisedCodes(), 'no live door raises check_violation (23514) any more').not.toContain(
      '23514',
    )
  })

  it('EVERY SQLSTATE the doors raise has a pt-BR arm in toState', () => {
    const actions = actionsSource()
    const missing = [...raisedCodes()].filter(
      (code) => !new RegExp(`case\\s+'${code}'\\s*:`).test(actions),
    )
    expect(
      missing,
      `these door SQLSTATEs fall through to the generic "try again" message: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('every arm maps to a DISTINCT message (no arm silently duplicates the generic one)', () => {
    // An arm returning `MESSAGES.generic` is an arm in name only — it restores the exact
    // defect this file exists to prevent while looking like a fix.
    const actions = actionsSource()
    for (const code of raisedCodes()) {
      const arm = new RegExp(`case\\s+'${code}'\\s*:[\\s\\S]{0,200}?return\\s*\\{[^}]*\\}`)
      const body = arm.exec(actions)?.[0] ?? ''
      expect(body, `${code} is mapped to the generic message`).not.toMatch(/MESSAGES\.generic/)
    }
  })
})
