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
 * it records what the harness reports. Read `.claude/instructions-loaded.log` after any
 * session that opened PROGRESS.md or a governed source file. Expect a line with
 * `load_reason=path_glob_match` and the rule's path. NO such line across several sessions
 * that touched governed files ⇒ the rules are inert; re-home them in CLAUDE.md, or accept
 * that their content is reachable only via the archives.
 *
 * ⚠ Absence of a line is only evidence once a governed file was actually touched — an
 * empty log after a session that opened nothing proves nothing.
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
  // Only rules are in question; CLAUDE.md loading is not in doubt and would be noise.
  if (!/[\\/]\.claude[\\/]rules[\\/]/.test(file)) process.exit(0)
  const parts = [
    new Date().toISOString(),
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
