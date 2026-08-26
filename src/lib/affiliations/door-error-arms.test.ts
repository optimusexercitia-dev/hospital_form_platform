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
 * and the TS that maps it. The live half is pinned separately, in pgTAP `304` §6, which
 * derives its domain from the CATALOG — owner-only VOLATILE `app` kernels reachable from a
 * client-callable `public` wrapper, plus those wrappers — and asserts they raise exactly a
 * declared set. So a code that exists only after a runtime body rewrite cannot hide from
 * both halves.
 *
 * ⛔ THE TWO HALVES DO NOT PRODUCE THE SAME SET, and this comment used to say they did:
 * "pgTAP 304 §6 asserts the running kernels raise exactly this set". That was false the
 * whole time it was here — §6 was reporting on a hand-maintained list of three pre-AFF4
 * kernels and its regex could not see a named condition at all, so it covered none of
 * AFF4's five codes while this sentence vouched that it did. A comment is an assertion
 * that goes stale silently, in the file whose entire purpose is to stop exactly that.
 * §6's domain is the whole DOOR FAMILY, so its set is strictly WIDER than the
 * `actions.ts`-derived one here: it also carries the membership-role doors' `HC0G*` and
 * the `23514` they reach through `check_violation`. Each half must equal ITS OWN declared
 * set. Neither is the other's oracle.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/**
 * ⛔ THERE IS NO HAND-MAINTAINED MIGRATION LIST ANY MORE, and the reason is measured.
 *
 * This file used to carry `DOOR_MIGRATIONS`, four filenames, and it reported on ITS OWN
 * LIST rather than on the domain — going green *because* the list was short. AFF4 added
 * three door migrations and five SQLSTATEs (HC0R6-HC0RA); none of the files were in the
 * list, so the test kept passing while covering none of them. A coverage test keyed on a
 * hand-maintained list is a hand-list wearing a coverage label.
 *
 * The domain is now derived from the PROPERTY that actually decides it: the SQLSTATEs
 * that can reach {@link toState} are exactly those raised by the doors THIS MODULE CALLS.
 * So the door names come from `actions.ts`'s own `.rpc('…')` call sites, and their SQL
 * comes from whichever migration last defined them. Add a door to `actions.ts` and it is
 * covered on the next run, with nobody remembering anything.
 */
function doorRpcNames(): string[] {
  const names = [...actionsSource().matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1])
  return [...new Set(names)].sort()
}

/**
 * Every migration, in version order, keeping only the door blocks — so a later file
 * overrides an earlier definition exactly as applying them does.
 *
 * ⚠ Scanning ALL migrations rather than a subset is deliberate: any filter over filenames
 * reintroduces the hand-list one level up, where it is harder to see.
 */
function resolvedDoorBlocks(): Map<string, string> {
  const wanted = new Set<string>()
  for (const rpc of doorRpcNames()) {
    wanted.add(`app.${rpc}_impl`)
    wanted.add(`public.${rpc}`)
  }

  const resolved = new Map<string, string>()
  for (const file of readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    for (const [name, block] of functionBlocks(readFileSync(join(MIGRATIONS, file), 'utf8'))) {
      if (wanted.has(name)) resolved.set(name, block)
    }
  }
  return resolved
}

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
  // ⚠ `or replace` is OPTIONAL. AFF4's new doors are bare `create function` (they are new,
  // so there is nothing to replace), and a splitter requiring `or replace` skipped every
  // one of them — the file would have gone green over the new doors even once its
  // migrations were in scope. An enumeration boundary drawn on a SYNTAX cannot enforce a
  // PROPERTY.
  const blocks = withoutComments.split(/create\s+(?:or\s+replace\s+)?function/i).slice(1)

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
  return codesFromBlocks(resolvedDoorBlocks().values())
}

/**
 * The SQLSTATEs whose raise ALSO carries a `detail =` payload — i.e. the refusals that
 * enumerate something for the user, rather than merely refusing.
 *
 * ⚠ A SECOND, DIFFERENT QUESTION from {@link raisedCodes}. That one asks "does this code
 * have a pt-BR sentence"; this asks "does the arm KEEP what the door bothered to compute".
 * `HC0RA` had a sentence and passed every existing test in this file while silently
 * discarding the list of hospitals it emitted — so the user was told they had blocking
 * affiliations and never told WHICH. Found while fixing the same defect one arm over
 * (AFF4 B2, `parseBlockers` dropping `kind`/`hospital`).
 */
export function codesCarryingDetail(sql: string): Set<string> {
  const codes = new Set<string>()
  for (const block of functionBlocks(sql).values()) {
    for (const m of block.matchAll(/errcode\s*=\s*'([^']+)'\s*,\s*detail\s*=/g)) {
      codes.add(CONDITION_TO_SQLSTATE[m[1]] ?? m[1])
    }
  }
  return codes
}

/**
 * The CODE of one `toState` arm — `case '<code>':` up to the next `case`/`default`, with
 * `//` comments STRIPPED.
 *
 * ⚠⚠ BOTH HALVES ARE SCAR TISSUE, EARNED ON THE FIRST RUN OF THE TEST BELOW.
 *
 * 1. **The boundary is the next arm, not a character budget.** The first version bounded the
 *    arm with `[\s\S]{0,300}?`; a four-line explanatory comment pushed `return` past 300
 *    characters, the regex matched NOTHING, and the test reported the arm as defective —
 *    a FALSE POSITIVE that survived the fix it was written for. An enumeration boundary
 *    drawn on a SYNTAX (how many characters) cannot enforce a PROPERTY (what this arm does).
 *    That is this file's own most-repeated lesson, landing one more time.
 * 2. **Comments are stripped, or the check is VACUOUS.** The comment written to explain the
 *    HC0RA fix contains the word `parseBlockers`. Searching the raw arm text would have
 *    matched the COMMENT and passed while the arm did nothing — a green that asserts only
 *    that someone described the fix.
 */
function armBody(actions: string, code: string): string {
  const start = new RegExp(`case\\s+'${code}'\\s*:`).exec(actions)
  if (!start) return ''
  const rest = actions.slice(start.index + start[0].length)
  const end = /\n\s*(?:case\s+'|default\s*:)/.exec(rest)
  return (end ? rest.slice(0, end.index) : rest).replace(/\/\/[^\n]*/g, '')
}

function detailCodes(): Set<string> {
  const codes = new Set<string>()
  for (const block of resolvedDoorBlocks().values()) {
    for (const m of block.matchAll(/errcode\s*=\s*'([^']+)'\s*,\s*detail\s*=/g)) {
      codes.add(CONDITION_TO_SQLSTATE[m[1]] ?? m[1])
    }
  }
  return codes
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
  it('⭐ the DERIVATION finds doors, and finds SQL for every one of them', () => {
    // The domain is derived, so the thing that can empty is the derivation. Both halves
    // are pinned: no door names parsed, or a named door whose SQL nothing defines.
    const rpcs = doorRpcNames()
    expect(rpcs.length, 'no .rpc() call sites parsed from actions.ts — the regex or the path moved').toBeGreaterThan(3)

    const resolved = resolvedDoorBlocks()
    const unresolved = rpcs.filter((rpc) => !resolved.has(`app.${rpc}_impl`))
    expect(
      unresolved,
      `actions.ts calls these doors but no migration defines app.<name>_impl for them — a rename, ` +
        `or a door whose logic moved, either way the codes it raises are no longer covered: ${unresolved.join(', ')}`,
    ).toEqual([])
  })

  it('⭐ covers the AFF4 doors specifically — the ones the old hand-list missed', () => {
    // A regression pin, not decoration. These five SQLSTATEs existed with arms in
    // `toState` while the domain that was supposed to demand them looked at four files
    // that predate them by a month.
    const codes = raisedCodes()
    for (const code of ['HC0R6', 'HC0R7', 'HC0R8', 'HC0R9', 'HC0RA']) {
      expect(codes, `${code} is raised by an AFF4 door but is not in the derived domain`).toContain(code)
    }
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

  it('⭐ every SQLSTATE that carries a DETAIL payload PARSES it in its arm', () => {
    // ⛔ THE DEFECT THIS EXISTS FOR IS NOT A MISSING ARM — every code below already had a
    // pt-BR sentence and passed every other test in this file. `HC0RA` computed a list of
    // blocking hospitals, attached it to the raise, and `toState` never read `error.details`
    // on that arm, so it was discarded before `parseBlockers` could be reached. A door that
    // bothers to ENUMERATE and a UI that says only "it did not work" is the B2 defect one
    // arm over.
    const actions = actionsSource()
    const codes = [...detailCodes()]
    expect(
      codes.length,
      'no `errcode = .., detail = ..` raises parsed — the regex or the files moved',
    ).toBeGreaterThan(2)

    // Guard the extractor itself: an arm that resolves EMPTY is a broken boundary, not a
    // clean arm, and it would otherwise read as a pass.
    const unresolved = codes.filter((code) => armBody(actions, code).trim() === '')
    expect(
      unresolved,
      `no arm body extracted for these — the boundary regex drifted, and an empty arm ` +
        `silently satisfies every check below: ${unresolved.join(', ')}`,
    ).toEqual([])

    const dropped = codes.filter((code) => !/parseBlockers/.test(armBody(actions, code)))
    expect(
      dropped,
      `these doors compute a DETAIL payload that toState throws away, so the refusal cannot ` +
        `name what blocked it: ${dropped.join(', ')}`,
    ).toEqual([])
  })

  it('the arm extractor is comment-blind and arm-bounded (it can still report a real drop)', () => {
    // The vacuity control. A comment NAMING parseBlockers must not satisfy the check, and an
    // arm must not absorb its neighbour's body.
    const fake = `
      case 'HC0AA':
        // this comment mentions parseBlockers and must not count
        return { ok: false, error: MESSAGES.x }
      case 'HC0BB':
        return { ok: false, error: MESSAGES.y, blockers: parseBlockers(error.details) }
      default:`
    expect(armBody(fake, 'HC0AA'), 'comment-only mention must not satisfy it').not.toMatch(
      /parseBlockers/,
    )
    expect(armBody(fake, 'HC0BB'), 'a real call must still be found').toMatch(/parseBlockers/)
    expect(armBody(fake, 'HC0AA'), 'an arm must stop at the next case').not.toMatch(/MESSAGES\.y/)
  })

  it('the detail detector can find something (dry-run, known positive)', () => {
    // A detector that finds nothing must be proven able to find something — and the
    // discriminator is the `, detail =` suffix, not the raise.
    const found = codesCarryingDetail(`
      create or replace function app.d() returns uuid language plpgsql as $$ begin
        raise exception 'enumerates' using errcode = 'HC0R1', detail = v::text;
        raise exception 'bare refusal' using errcode = 'HC0R2';
      end $$;`)
    expect(found).toContain('HC0R1')
    expect(found, 'a raise with no detail payload is not in the domain').not.toContain('HC0R2')
  })

  it('every arm maps to a DISTINCT message (no arm silently duplicates the generic one)', () => {
    // An arm returning `MESSAGES.generic` is an arm in name only — it restores the exact
    // defect this file exists to prevent while looking like a fix.
    const actions = actionsSource()
    // FUP-VACUOUS-AUDIT-1: `raisedCodes()` is parsed from migration text, so a regex
    // or path drift empties it silently and "every arm maps to a DISTINCT message"
    // becomes true of zero arms. A sibling test pins the size, but a sibling cannot
    // stop THIS test reporting a property it never checked.
    const codes = raisedCodes()
    expect(codes.size, 'no errcodes parsed — the regex or the files moved').toBeGreaterThan(3)
    for (const code of codes) {
      const arm = new RegExp(`case\\s+'${code}'\\s*:[\\s\\S]{0,200}?return\\s*\\{[^}]*\\}`)
      const body = arm.exec(actions)?.[0] ?? ''
      expect(body, `${code} is mapped to the generic message`).not.toMatch(/MESSAGES\.generic/)
    }
  })
})
