#!/usr/bin/env node
/**
 * InstructionsLoaded probe — measures whether `.claude/rules/*.md` actually fire.
 *
 * WHY THIS EXISTS. ADR 0127 moved standing rules into `.claude/rules/` with `paths:`
 * frontmatter, on the understanding that such a file loads when Claude touches a matching
 * file. That understanding is **unproven**: path-scoping is behind a runtime feature flag
 * (`claudemd_rule_globs`), and a rule file created mid-session did not load when a matching
 * file was opened — which is equally consistent with session-start enumeration or with the
 * flag being off. The two cannot be told apart from inside one session.
 *
 * A rule that does not fire is worse than the bullet it replaced, so this does not assume:
 * it records what the harness reports. Read `.claude/instructions-loaded.log` and read it
 * as a THREE-way result, not a yes/no (see the `kind` column below).
 *
 * ⚠ TWO preconditions before the log means anything, BOTH learned the hard way:
 *   1. The hook must have been registered AT SESSION START. `.claude/settings.json` is read
 *      when the session opens, so the session that ADDS this hook can never be the session
 *      that observes it. The first honest reading is the NEXT session.
 *   2. A governed file must actually have been touched. An empty log after a session that
 *      opened nothing governed proves nothing.
 * Both are the same mistake in different clothes — concluding from a measurement whose
 * instrument was installed after the thing it was meant to measure.
 *
 * Silent and non-blocking by design: never edits, never fails a turn.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOG = join(process.cwd(), '.claude', 'instructions-loaded.log')

let raw = ''
try {
  raw = readFileSync(0, 'utf8')
} catch {
  process.exit(0)
}

try {
  const h = JSON.parse(raw)
  const file = h.file_path ?? '?'
  // ⛔ EVERY load is logged, including CLAUDE.md — deliberately, and this is the whole
  // design. An earlier version filtered to `.claude/rules/` only, on the reasoning that
  // CLAUDE.md loading "is not in doubt and would be noise". That made an empty log
  // AMBIGUOUS between the two things it exists to tell apart:
  //   no lines at all            -> the hook never ran (not registered, or unsupported)
  //   lines, but none marked RULE -> the hook ran and rules did NOT load  <- the answer
  //   lines marked RULE           -> rules fire
  // A detector that finds nothing must be provable able to find something; filtered to
  // the one case in question, this one could not prove it was alive.
  const kind = /[\\/]\.claude[\\/]rules[\\/]/.test(file) ? 'RULE ' : 'other'
  const parts = [
    new Date().toISOString(),
    kind,
    `file=${file}`,
    `reason=${h.load_reason ?? '?'}`,
    `globs=${Array.isArray(h.globs) ? h.globs.join(',') : (h.globs ?? '-')}`,
    `trigger=${h.trigger_file_path ?? '-'}`,
  ]
  appendFileSync(LOG, parts.join(' · ') + '\n', 'utf8')
} catch {
  /* malformed payload: stay silent rather than fail a turn */
}
process.exit(0)
