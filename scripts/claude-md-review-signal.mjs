#!/usr/bin/env node
/**
 * Stop-hook signal collector for the CLAUDE.md review cadence (CLAUDE.md §7).
 *
 * WHY. CLAUDE.md itself says a stale CLAUDE.md is worse than a missing one — but
 * "review it periodically" is exactly the kind of prose rule this repo has watched rot
 * ("standing in prose alone once meant it ran once in three weeks"). This hook makes
 * the trigger mechanical: when a session ends, it scans the transcript for moments
 * where the user corrected the assistant or called something stale — the moments that
 * usually mean CLAUDE.md taught the session something wrong, or failed to teach it
 * something it needed — and queues them while they are fresh.
 *
 * WHAT IT IS NOT. It is not an LLM review (deliberate: an LLM pass on every Stop costs
 * tokens on every session and proposes noise), and it never edits CLAUDE.md. It only
 * appends candidates to `.claude/claude-md-review-queue.md` (gitignored — the queue is
 * per-checkout working state, not record). The `/review-claude-md` skill consumes the
 * queue and proposes diffs; the "always ask before changing CLAUDE.md" rule governs
 * those proposals.
 *
 * CONTRACT WITH THE HARNESS. Receives the Stop-hook JSON on stdin
 * ({ session_id, transcript_path, stop_hook_active, … }). A Stop hook that exits
 * non-zero or writes to stderr can block the assistant — this one must NEVER interfere:
 * every failure path is a silent exit 0, and `stop_hook_active` exits immediately so a
 * continued conversation is not re-scanned into a loop.
 *
 * HEURISTIC, AND SAID SO. The signal patterns below are a deliberately small,
 * high-precision set — corrections, staleness language, explicit CLAUDE.md mentions,
 * standing-instruction language. Missing a signal costs a queue entry, not data (the
 * transcript is still on disk and the skill reads it); a noisy pattern costs review
 * time every session. Tune toward precision.
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const QUEUE = join(process.cwd(), '.claude', 'claude-md-review-queue.md')
const MAX_EXCERPT = 240
const MAX_SIGNALS_PER_SESSION = 8

/** name → pattern; names appear in the queue so the reviewer sees WHY it matched. */
const SIGNALS = [
  ['correction', /\b(that'?s|that is|this is|you'?re|you are) (wrong|not right|incorrect|not true|not correct)\b/i],
  ['correction', /\b(no[,.] (that|this|it)\b|not what i (asked|meant|wanted))/i],
  ['staleness', /\b(stale|outdated|out of date|doesn'?t exist anymore|no longer (exists|true|correct))\b/i],
  ['claude-md', /\bCLAUDE\.md\b/],
  ['standing-rule', /\b(from now on|always remember|never again|going forward|in future sessions)\b/i],
  ['methodology', /\b(source of truth|deteriorat|constant source of errors|every session)\b/i],
]

function userTexts(transcriptPath) {
  const texts = []
  const raw = readFileSync(transcriptPath, 'utf8')
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.type !== 'user' || entry.isMeta) continue
    const content = entry.message?.content
    if (typeof content === 'string') {
      texts.push(content)
    } else if (Array.isArray(content)) {
      for (const part of content) {
        // tool_result parts are observed data, not the user speaking — skip them.
        if (part?.type === 'text' && typeof part.text === 'string') texts.push(part.text)
      }
    }
  }
  return texts
}

function main() {
  let input = ''
  try {
    input = readFileSync(0, 'utf8')
  } catch {
    return
  }
  let hook
  try {
    hook = JSON.parse(input)
  } catch {
    return
  }
  if (hook.stop_hook_active) return
  const transcript = hook.transcript_path
  if (!transcript || !existsSync(transcript)) return

  let texts
  try {
    texts = userTexts(transcript)
  } catch {
    return
  }

  const found = []
  for (const t of texts) {
    // System-reminder blocks ride inside user turns but are not the user speaking.
    if (t.startsWith('<system-reminder>') || t.startsWith('<command-name>')) continue
    for (const [name, re] of SIGNALS) {
      const m = re.exec(t)
      if (!m) continue
      const at = Math.max(0, m.index - 80)
      const excerpt = t.slice(at, at + MAX_EXCERPT).replace(/\s+/g, ' ').trim()
      found.push({ name, excerpt })
      break // one signal per message is enough to queue it
    }
    if (found.length >= MAX_SIGNALS_PER_SESSION) break
  }
  if (found.length === 0) return

  const sessionId = hook.session_id ?? 'unknown-session'
  try {
    // Re-running Stop for the same session must not duplicate the entry.
    if (existsSync(QUEUE) && readFileSync(QUEUE, 'utf8').includes(sessionId)) return
    mkdirSync(dirname(QUEUE), { recursive: true })
    const stamp = new Date().toISOString()
    const lines = [
      `## ${stamp} — session ${sessionId}`,
      ``,
      `- transcript: \`${transcript}\``,
      ...found.map((f) => `- **${f.name}**: ${f.excerpt}`),
      ``,
      ``,
    ]
    appendFileSync(QUEUE, lines.join('\n'), 'utf8')
  } catch {
    // Never block the Stop on queue-write failure.
  }
}

main()
