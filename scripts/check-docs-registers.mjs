#!/usr/bin/env node
/**
 * lint:registers — the ADR 0185 documentation registers, enforced by machine.
 *
 * THE DEFECT CLASS. Every register in this tree that lacked a gate rotted: the PROGRESS.md
 * banner went stale about its own size (ADR 0124), rules described renamed symbols
 * (ADR 0127), a follow-up index drifted from its bodies in both directions (ADR 0140,
 * 0179). ADR 0185 adds five registers — feature hubs, CURRENT.md, BUGS.md, LESSONS.md and
 * postmortems (CURRENT.md's arm retired by ADR 0186 D1: docs/features/INDEX.md is the only
 * projection of hub frontmatter) — plus fields on the follow-up register and a handoff convention that had
 * "no gate" by its own admission. Its admission rule: NO register or field ships without
 * a gate that can red on it. This is that gate.
 *
 * ARMS (each proven able to fail by the self-test that runs first, every invocation):
 *   HUBS      docs/features/<slug>.md — YAML frontmatter with the required keys; id ↔ file
 *             name; status/kind enums; links + ADR numbers resolve; `in_progress` needs a
 *             branch that exists; the `## Current state` block (required for in_progress /
 *             gated, FORBIDDEN for complete and planned — a planned unit has a plan, not a
 *             state) has the six sections in order, an `Updated` date, and ≤ 60 lines;
 *             `parked` carries `Revisit when`; `complete` has a phase-ledger row or an
 *             APPROVED review. When the current git branch IS the hub's branch, `Updated`
 *             may not be older than the newest commit touching src/ supabase/ e2e/ —
 *             "always maintained" is enforced, not asked for (skipped on main). `in_progress` /
 *             `gated` also needs a `progress:` that resolves, and that record must carry a
 *             `## Session log` heading whose `### YYYY-MM-DD` subsections are non-decreasing in
 *             file order (ADR 0186 D3 — append-only, enforced mechanically, not asked for).
 *   CODES     a new BUG-/FUP- id (opened/filed on or after CODE_WATERMARK) uses a code that
 *             is a hub id or a row in legacy-codes.md. ⛔ The watermark grandfathers the
 *             legacy prefixes (72 / 123 distinct); never bump it to pass — that flips the
 *             rot direction (the lint:set-local lesson).
 *   BUGS      docs/bugs/BUGS.md — exact columns; unique ids; status + severity enums
 *             (`unrated` only for legacy rows); Closed empty while open; Doc links resolve;
 *             every docs/bugs/BUG-*.md has a row; a fixed/verified bug with a document has
 *             non-empty Root cause + Regression protection.
 *   FOLLOWUPS (ADR 0186 D4 — the register is now an INDEX, deferred-backlog.md deleted and
 *             merged in as `**Status:** parked` entries) every FUP entry carries Filed (date) ·
 *             Owner (closed vocabulary, OWNER_VOCAB order) · Severity (enum word or legacy
 *             `unrated`, matching the heading emoji) · Closes when · Status (open|parked;
 *             parked needs a non-empty Revisit when — the old bare `**Parked**` marker is no
 *             longer the signal). Entries are ≤ 20 lines with no nested `##`/`####` heading;
 *             `**Register line**` paragraphs are forbidden outright; a `**Body:**` link is
 *             cross-checked against docs/followups/FUP-*.md so an orphan reds BOTH ways. The
 *             Critical pin (D5) is checked for orphans once CRITICAL_PIN_REQUIRED is on, and
 *             its data rows are capped at 300 chars each (plan 5.6). `PO to rule` is a legal
 *             value and is COUNTED, not flagged — but D6 turns every such count into a RATCHET
 *             (see RATCHETS below): a gate that only ever bounds presence still bounds GROWTH.
 *   RATCHET   (ADR 0186 D6) every count this gate used to print as a warning — `Closes when: PO
 *             to rule`, `Severity: … per emoji at consolidation`, `unrated`, a long verbatim
 *             heading, BUGS `untriaged`/`unrated`, LESSONS `prose only` — is now a named
 *             constant in RATCHETS that may only be LOWERED; a commit that raises the live
 *             count above it reds. Every arm prints its live count on the OK line.
 *   LESSONS   docs/learning/LESSONS.md — exact columns; unique LEARN ids; Origin resolves
 *             (ADR / FUP / BUG / sha / path); Enforcement is `prose only` or tokens that
 *             each exist (lint:<script> in package.json, ARM=<arm>, a path, a rule file).
 *   POSTMORT  docs/learning/postmortems/LEARN-*.md — nine sections, all non-empty, and a
 *             LESSONS row with the same id.
 *   HANDOFFS  docs/handoffs/*.md — ≤ 24 KB; frontmatter carries `branch:` (checked against
 *             `git branch --list`) OR `expires:` (an ISO date that must not be before today —
 *             ADR 0186 D3: a unit with a hub carries `branch:`, hubless work `expires:`; neither
 *             present reds); not cited from outside the allowed set (hubs, CURRENT.md, handoffs,
 *             reviews) — the skill's own rule.
 *   LINKS     relative links in every file this gate owns resolve.
 *   INDEX     docs/INDEX.md names every top-level entry of docs/ — a new directory cannot
 *             go unmapped.
 *   RETIRED   (ADR 0186 D8) any citation of a PROGRESS.md section retired by ADR 0185 D6
 *             (§ Now / Bug Log / Critical FUP / Test Run Summary / QA Verdicts / Decisions /
 *             Follow-ups) in a living Markdown file — archives, ADRs, reviews and
 *             docs/design/temp excluded, plus CLAUDE.md until ADR 0186 Wave 4. Code spans and
 *             fenced blocks are blanked first so a quotation is not read as a citation.
 *

 * BOUNDED, STATED: this gate checks PRESENCE and RESOLUTION. It cannot know whether a
 * `Closes when` is true, whether an Enforced-by token actually asserts the rule it is
 * attached to, or whether a Current-state block is honest. Those are review questions.
 *
 *   node scripts/check-docs-registers.mjs [--self-test]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execSync } from 'node:child_process'
import yaml from 'js-yaml'

export const ROOT = process.cwd()

// ─── paths: the one place to update when a register moves ────────────────────────────────
export const PATHS = {
  featuresDir: 'docs/features',
  featuresIndex: 'docs/features/INDEX.md',
  legacyCodes: 'docs/followups/legacy-codes.md',
  bugs: 'docs/bugs/BUGS.md',
  bugsDir: 'docs/bugs',
  followupsDir: 'docs/followups',
  fupOpen: 'docs/followups/follow-ups-open.md',
  fupArchive: 'docs/followups/follow-ups-archive.md',
  lessons: 'docs/learning/LESSONS.md',
  postmortemsDir: 'docs/learning/postmortems',
  handoffsDir: 'docs/handoffs',
  docsIndex: 'docs/INDEX.md',
  phaseLedger: 'docs/progress/phase-ledger.md',
  decisionsDir: 'docs/decisions',
}

// Ids opened/filed on or after this date must use a registered code. The ADR shipped 2026-09-03;
// the rule takes effect the NEXT day because a parallel branch filed three code-less ids on the
// ship day under the old "SCREAMING-KEBAB claim" convention (review F-1, measured), and an id is a
// permanent join key that cannot be renamed to comply. ⛔ Never bump this to pass.
export const CODE_WATERMARK = '2026-09-04'
export const CURRENT_STATE_MAX_LINES = 60
export const HANDOFF_MAX_BYTES = 24 * 1024
export const CRITICAL_PIN_REQUIRED = true // ADR 0185 D5: § Critical FUP lives at the top of the register

export const HUB_STATUS = ['planned', 'in_progress', 'gated', 'complete', 'parked']
export const HUB_KIND = ['feature', 'fup-fix']
export const HUB_REQUIRED_KEYS = ['id', 'title', 'status', 'kind', 'program', 'branch', 'plan', 'progress', 'reviews', 'adrs', 'handoff']
export const CURRENT_STATE_SECTIONS = ['Objective', 'Done since start', 'In progress', 'Next', 'Blockers']

export const BUG_STATUS = ['open', 'fixed', 'verified', 'wontfix', 'duplicate', 'untriaged']
export const BUG_CLOSED_STATUS = ['fixed', 'verified', 'wontfix', 'duplicate']
export const BUG_COLUMNS = ['ID', 'Status', 'Severity', 'Area', 'Description', 'Opened', 'Closed', 'Related', 'Doc']
export const SEVERITY = ['catastrophic', 'critical', 'high', 'medium', 'low']
export const SEVERITY_EMOJI = { catastrophic: '⛔', critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', unrated: '⚪' }

/** ADR 0186 D4: the FOLLOWUPS `**Owner:**` closed vocabulary, in the order multi-owner values
 *  must list them in (`backend + frontend`, never `frontend + backend`). */
export const OWNER_VOCAB = ['lead', 'backend', 'frontend', 'tester', 'qa', 'PO', 'unassigned']
/** FOLLOWUPS index-entry shape (ADR 0186 D4). */
export const FOLLOWUP_STATUS = ['open', 'parked']
export const FOLLOWUP_MAX_ENTRY_LINES = 20
export const FOLLOWUP_MAX_HEADING_CHARS = 160

export const LESSON_COLUMNS = ['ID', 'Area', 'Lesson', 'Origin', 'Enforcement']
export const ARMS = ['census', 'hat', 'floor', 'wrapper', 'policy']
export const POSTMORTEM_SECTIONS = [
  'What happened',
  'Why it happened',
  "Why we didn't detect it earlier",
  'What worked well',
  'What failed',
  'General lesson',
  'Changes made',
  'New rule',
  'Applies to',
]
export const HANDOFF_CITATION_ALLOWED = ['docs/features/', 'docs/planning/', 'docs/handoffs/', 'docs/reviews/']

// ─── RATCHETS (ADR 0186 D6): a count this gate used to print as a WARNING is now a named
// constant that may only be LOWERED — a commit that raises the live count above it reds. Every
// constant starts at Infinity (never a finding) until the Wave 5 data lands and the lead
// measures the true counts off the OK line (`ratchets: name=live/cap`) and writes them in. This
// is deliberately the FIRST wave to introduce a name with no real cap yet — the alternative
// (guessing a cap before the data exists) is exactly the "invented value is invisible" failure
// this gate exists to refuse.
// Caps measured 2026-09-03 after the ADR 0186 Wave 5 migration landed. Each may only be
// LOWERED, in the same commit as the change that lowers the live count; a commit that raises
// one reds (ADR 0186 D6). The PO's three ruling lists live behind the first four.
export const RATCHETS = {
  closesWhenPoToRule: 147, // FOLLOWUPS entries whose `**Closes when:**` is `PO to rule`
  severityPerEmoji: 135, // FOLLOWUPS entries whose `**Severity:**` says "per emoji at consolidation"
  severityUnrated: 29, // FOLLOWUPS entries with `**Severity:** unrated` (legacy-dated, legal)
  revisitWhenPoToRule: 38, // parked FOLLOWUPS entries whose `**Revisit when:**` is `PO to rule`
  longHeadings: 97, // FOLLOWUPS headings over FOLLOWUP_MAX_HEADING_CHARS (verbatim by decision)
  bugsUntriaged: 10, // BUGS.md rows with Status `untriaged`
  bugsUnrated: 40, // BUGS.md rows with Severity `unrated`
  lessonsProseOnly: 47, // LESSONS.md rows with Enforcement `prose only`
}

/** Every live count that exceeds its RATCHETS constant is a finding; may only be LOWERED. */
export function checkRatchets(counts, ratchets = RATCHETS) {
  const F = []
  for (const name of Object.keys(ratchets)) {
    const live = counts[name] ?? 0
    const cap = ratchets[name]
    if (live > cap) F.push(`[RATCHET] ${name} is ${live}, cap ${cap} — may only be lowered`)
  }
  return F
}

// ─── RETIRED (ADR 0186 D8): a PROGRESS.md section ADR 0185 D6 retired, cited in living prose ──
/**
 * A citation, not a mention: `PROGRESS.md § Now` (any wording of the PROGRESS.md prefix, or
 * bare `§ Now` — the section name alone is unambiguous) for the five sections ADR 0185 D6 moved
 * out of PROGRESS.md wholesale, but only the PREFIXED form for § Decisions / § Follow-ups — a
 * bare `§ Decisions` is ambiguous (plenty of other documents number a "§ Decisions").
 */
export const RETIRED_SECTION_RX =
  /(?:PROGRESS\.md(?:'s)? (?:former )?)?§ (?:Now|Bug Log|Critical FUP|Test Run Summary|QA Verdicts)\b|PROGRESS\.md § (?:Decisions|Follow-ups)\b/

/** Historical/decision path prefixes excluded from the RETIRED domain: records OF the retirement or of prior states, never living procedure text. */
export const RETIRED_EXCLUDE_PATH_PREFIXES = ['docs/progress/', 'docs/decisions/', 'docs/reviews/', 'docs/design/temp/']
/** Individual historical files excluded from the RETIRED domain for the same reason as the prefixes above. */
export const RETIRED_EXCLUDE_PATHS = new Set(['docs/bugs/archive.md', 'docs/followups/follow-ups-archive.md', '.claude/claude-md-review-queue.md'])
// CLAUDE.md joins this arm's domain in Wave 4 of ADR 0186 — its two citations may only be removed
// by the PO-approved diff (CLAUDE.md §5 "always ask"). One named constant so Wave 4 deletes one line.
export const RETIRED_EXCLUDE_CLAUDE_MD = 'CLAUDE.md'

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/
const ID_RX = /^[A-Z0-9][A-Z0-9-]*$/
/** The register tables open with an `ID` column; legend tables in the same file do not. */
export const REGISTER_HEADER_RX = /^\s*\|\s*ID\s*\|/
export const LEGEND_HEADER_RX = /^\s*\|\s*Code\s*\|/
/** Same shape as check-progress-doc's RESOLVED_HEADING: the entry is resolved (and, if it is still in the open register, gate 7 requires a **Retained** line). */
export const RESOLVED_HEADING_RX = /⬛|✅ ?\*{0,2}(RESOLVED|CLOSED)\b/u

/**
 * ADR 0186 D8 / plan 6.1: the `complete` cross-check is ROW-grade — a ledger TABLE ROW whose
 * first cell is the id, never "the id string appears anywhere in the ledger". The old
 * `\b${id}\b` scan passed on a MENTION ("see AE4 for context") with no row behind it at all.
 */
export function hubHasLedgerRow(id, ledgerText) {
  const esc = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp(`^\\| *${esc} *\\|`)
  return ledgerText.split('\n').some((l) => rx.test(l))
}

/**
 * ADR 0186 D8 / plan 6.7: how many rows `hubHasLedgerRow` actually has to search — every
 * `|`-prefixed line minus the divider row(s) and ONE header row. Printed on the OK line as an
 * orientation figure (never gated): a census whose parts don't sum is wrong, so this is scoped
 * to exactly the population the row-grade check scans, not a re-derivation by a different rule.
 * BOUNDED, STATED: a file with a SECOND header block further down (a second `| Col | Col |`
 * table) would still have only one header subtracted — phase-ledger.md has never had one.
 */
export function countLedgerDataRows(text) {
  const dividerRx = /^\s*\|[\s:|-]+\|\s*$/
  const pipeLines = text.split('\n').filter((l) => /^\s*\|/.test(l) && !dividerRx.test(l))
  return Math.max(0, pipeLines.length - 1)
}

/**
 * A review's VERDICT LINE says APPROVED — never "the word APPROVED appears anywhere in the
 * file" (the old `\bAPPROVED\b` scan passed on "**Verdict: NOT APPROVED**"). Covers the two
 * bold-paragraph forms the plan names (`**Verdict: APPROVED**`, `**Verdict:** APPROVED`) AND
 * the heading form most reviews actually use (`## Verdict: **APPROVED**`) — DOCS-RESTRUCTURE,
 * the one hub this gate has to keep passing, is recorded that way; a regex built only from the
 * plan's two literal examples would have reintroduced a red on the live tree. `[\s*]{0,4}`
 * skips up to 4 chars of space/bold decoration IN EITHER ORDER between the colon and the verdict
 * word, but no more — "Verdict: NOT APPROVED" stops at "NOT" (not whitespace/`*`) and does not
 * match, so a genuine non-approval still reds.
 */
export const REVIEW_VERDICT_APPROVED_RX = /^#{0,6} *\*{0,2}Verdict:[\s*]{0,4}APPROVED\b/m

export function reviewHasApprovedVerdict(text) {
  return REVIEW_VERDICT_APPROVED_RX.test(text || '')
}

// ─── parsing helpers (pure) ──────────────────────────────────────────────────────────────

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { fm: null, body: text, error: 'no frontmatter' }
  try {
    const fm = yaml.load(m[1])
    return { fm: fm && typeof fm === 'object' ? fm : {}, body: text.slice(m[0].length), error: null }
  } catch (e) {
    return { fm: null, body: text, error: `frontmatter does not parse: ${e.message.split('\n')[0]}` }
  }
}

/**
 * Parse ONE markdown table in `text` into { columns, rows:[{cells, line}] } — the first table
 * whose header row matches `headerRe` (default: the first table). A register file may carry a
 * legend table (BUGS.md opens with the severity scale) before the register itself, and taking
 * the first table there reported the legend's columns as the register's — measured 2026-09-03.
 */
export function parseTable(text, headerRe = null) {
  const lines = text.split('\n')
  let i = -1
  for (let k = 0; k < lines.length - 1; k++) {
    if (!/^\s*\|/.test(lines[k])) continue
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[k + 1] || '')) continue
    if (headerRe && !headerRe.test(lines[k])) continue
    i = k
    break
  }
  if (i === -1) return null
  const columns = splitRow(lines[i])
  const rows = []
  for (let j = i + 2; j < lines.length; j++) {
    if (!/^\s*\|/.test(lines[j])) break
    const cells = splitRow(lines[j])
    rows.push({ cells: Object.fromEntries(columns.map((c, k) => [c, cells[k] ?? ''])), raw: cells, line: j + 1 })
  }
  return { columns, rows, headerLine: i + 1 }
}

export function splitRow(line) {
  const s = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const out = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|'
      i++
    } else if (s[i] === '|') {
      out.push(cur.trim())
      cur = ''
    } else cur += s[i]
  }
  out.push(cur.trim())
  return out
}

/**
 * `### ` entries of a register: heading, the up-to-8 non-blank "field lines" after it, body.
 *
 * ADR 0186 D4: an entry's span runs to the line BEFORE THE NEXT `### ` HEADING (or EOF) —
 * unlike this function's pre-0186 shape, which ended a span at the next heading of ANY level
 * (`##`, `###` or `####`). That widening is deliberate: a `##`/`####` heading is no longer a
 * boundary, it is a VIOLATION to be found INSIDE the span (checkFollowupEntryShape), so the
 * span must include it rather than stop short of it. Field-line cap raised 4 → 8: the new shape
 * adds `**Status:**`, `**Revisit when:**` and `**Body:**` to the original four, plus room for a
 * resolved-and-retained entry's `**Retained**` marker line.
 */
export function parseEntries(text) {
  const lines = text.split('\n')
  const starts = []
  for (let i = 0; i < lines.length; i++) if (/^### /.test(lines[i])) starts.push(i)
  const out = []
  for (let k = 0; k < starts.length; k++) {
    const i = starts[k]
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length
    const bodyLines = lines.slice(i + 1, end)
    const fields = []
    for (const l of bodyLines) {
      if (!l.trim()) {
        if (fields.length) break
        continue
      }
      if (!/^\*\*/.test(l)) break
      fields.push(l)
      if (fields.length === 8) break
    }
    out.push({ heading: lines[i], line: i + 1, fields: fields.join('\n'), body: bodyLines.join('\n'), bodyLines })
  }
  return out
}

/**
 * The `### YYYY-MM-DD` dates under a `## Session log` heading (ADR 0186 D3), in file order,
 * stopping at the next `## ` heading or EOF — or `null` when the heading itself is absent, so a
 * caller can tell "no log" from "log with zero dated sessions yet".
 */
export function sessionLogEntries(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^## Session log\b/.test(l))
  if (start === -1) return null
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break
    const m = lines[i].match(/^### (\d{4}-\d{2}-\d{2})\b/)
    if (m) out.push({ date: m[1], line: i + 1 })
  }
  return out
}

/** A YAML timestamp scalar (js-yaml auto-boxes a bare `YYYY-MM-DD` into a `Date`) or a plain
 *  string, normalized to `YYYY-MM-DD` — or `null` for anything else (an object, a number, …). */
export function isoDateOf(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return typeof v === 'string' ? v : null
}

/** Alphanumeric-only form of a heading, for in-file anchor comparison that emoji/punctuation
 *  can't break. ADR 0186 D8 / plan 6.3: the copy check-progress-doc.mjs (gate 7) used before
 *  the two link checkers merged into this one — now the one export both import. */
export function anchorKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Every `](target)` markdown link in `text`, as `{ target, line }` — fenced blocks and inline
 * code spans blanked first (offsets preserved) so a link pattern QUOTED in prose (the split
 * register bodies talk about `](./NNNN-*.md)`) is not read as a link, and http(s)/mailto/data
 * targets skipped. ADR 0186 D8 / plan 6.3: the ONE link-extraction pass gate 7
 * (check-progress-doc.mjs, which imports `checkLinks` from here) and gate 13 both run on —
 * before this it existed twice and could disagree.
 */
function markdownLinks(text) {
  const scanned = text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
  const out = []
  const rx = /\]\(([^)\s]+)\)/g
  scanned.split('\n').forEach((line, i) => {
    rx.lastIndex = 0
    let m
    while ((m = rx.exec(line))) {
      const t = m[1]
      if (/^(https?:|mailto:|data:)/.test(t)) continue
      out.push({ target: t, line: i + 1 })
    }
  })
  return out
}

/**
 * Repo-relative FILE link targets in `text` — a bare in-file `#anchor` link is excluded (that
 * is `checkLinks`' job, checked against the file's own headings, not a repo path) and so is a
 * target with no `.md` suffix and no 2-4-letter extension (a directory path or a bare slug is
 * not a file link — the extension filter gate 7 used before the merge).
 */
export function relLinks(text) {
  const out = []
  for (const { target } of markdownLinks(text)) {
    if (target.startsWith('#')) continue
    const path = target.split('#')[0]
    if (!path.endsWith('.md') && !/\.[a-z]{2,4}$/.test(path)) continue
    out.push(path)
  }
  return out
}

/** Slug for a hub file name: id lower-cased, runs of non-alphanumerics → '-'. */
export function hubSlug(id) {
  return String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── checkers (pure; `ctx` injects the filesystem/git so fixtures can drive them) ─────────

export function checkHub(hub, ctx) {
  const F = []
  const at = (msg) => F.push(`[HUBS] ${hub.file} — ${msg}`)
  if (hub.error || !hub.fm) return [`[HUBS] ${hub.file} — ${hub.error || 'no frontmatter'}`]
  const fm = hub.fm
  for (const k of HUB_REQUIRED_KEYS) if (!(k in fm)) at(`frontmatter lacks \`${k}\``)
  if (fm.kind === 'fup-fix' && !fm.fup) at('kind fup-fix requires `fup: FUP-…`')
  if (!ID_RX.test(String(fm.id ?? ''))) at(`id \`${fm.id}\` must match ${ID_RX}`)
  else if (basename(hub.file) !== `${hubSlug(fm.id)}.md`) at(`file must be named ${hubSlug(fm.id)}.md for id ${fm.id}`)
  if (!HUB_STATUS.includes(fm.status)) at(`status \`${fm.status}\` not in ${HUB_STATUS.join('|')}`)
  if (!HUB_KIND.includes(fm.kind)) at(`kind \`${fm.kind}\` not in ${HUB_KIND.join('|')}`)
  for (const k of ['plan', 'progress', 'handoff']) {
    if (fm[k] && !ctx.exists(join(PATHS.featuresDir, fm[k]))) at(`\`${k}: ${fm[k]}\` does not resolve`)
  }
  for (const r of Array.isArray(fm.reviews) ? fm.reviews : []) {
    if (!ctx.exists(join(PATHS.featuresDir, r))) at(`review link \`${r}\` does not resolve`)
  }
  if (fm.reviews && !Array.isArray(fm.reviews)) at('`reviews` must be a list')
  if (fm.adrs && !Array.isArray(fm.adrs)) at('`adrs` must be a list')
  for (const a of Array.isArray(fm.adrs) ? fm.adrs : []) {
    if (!/^\d{4}$/.test(String(a)) || !ctx.adrExists(String(a))) at(`ADR \`${a}\` has no file`)
  }
  if (fm.status === 'in_progress') {
    if (!fm.branch) at('status in_progress requires a `branch:`')
    else if (!ctx.branches.includes(fm.branch)) at(`branch \`${fm.branch}\` does not exist`)
  }
  // ADR 0186 D3: an in_progress/gated hub's record carries the session-by-session log; the
  // summary (this file) is replaced every session, so history that matters (what was verified,
  // its witness, gate exit codes) has exactly one home — the record — and this is its gate.
  if (fm.status === 'in_progress' || fm.status === 'gated') {
    if (!fm.progress) {
      at('status in_progress/gated requires a `progress:` that resolves')
    } else {
      const recordRel = join(PATHS.featuresDir, fm.progress)
      if (ctx.exists(recordRel)) {
        const entries = sessionLogEntries(ctx.readRel(recordRel) || '')
        if (entries === null) {
          at(`in_progress/gated hub's progress record \`${fm.progress}\` has no "## Session log"`)
        } else {
          for (let i = 1; i < entries.length; i++) {
            if (entries[i].date < entries[i - 1].date) {
              at(
                `progress record \`${fm.progress}\` Session log date out of order at line ${entries[i].line}: ` +
                  `\`### ${entries[i].date}\` follows \`### ${entries[i - 1].date}\` (append-only — dates must be non-decreasing)`,
              )
            }
          }
        }
      }
      // else: already reported above by the generic `plan`/`progress`/`handoff` resolve loop.
    }
  }
  if (fm.status === 'parked' && !/\*\*Revisit when:\*\*\s*\S/.test(hub.body)) at('status parked requires a `**Revisit when:**` line')
  if (fm.status === 'complete') {
    const inLedger = hubHasLedgerRow(String(fm.id), ctx.ledgerText)
    const approved = (Array.isArray(fm.reviews) ? fm.reviews : []).some((r) => reviewHasApprovedVerdict(ctx.readRel(join(PATHS.featuresDir, r))))
    if (!inLedger && !approved) {
      at(
        'status complete requires a phase-ledger ROW (`| ID | ... |`) or a linked review whose ' +
          'VERDICT LINE says APPROVED — a mention elsewhere in either file, or a verdict of NOT ' +
          'APPROVED / CHANGES REQUESTED, does not satisfy it (ADR 0186 D8)',
      )
    }
  }
  // Current-state block
  const lines = hub.body.split('\n')
  const start = lines.findIndex((l) => /^## Current state\b/.test(l))
  if (start === -1) {
    if (fm.status === 'in_progress' || fm.status === 'gated') at('`## Current state` block is required for in_progress / gated')
  } else {
    if (fm.status === 'complete') at('`## Current state` must be cut when status is complete (into the progress record)')
    if (fm.status === 'planned') at('`## Current state` is forbidden for status planned (a planned unit has a plan, not a state)')
    let end = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i])) {
        end = i
        break
      }
    }
    const block = lines.slice(start, end)
    // trailing blank lines do not count
    let n = block.length
    while (n > 0 && !block[n - 1].trim()) n--
    if (n > CURRENT_STATE_MAX_LINES) at(`Current state is ${n} lines; cap is ${CURRENT_STATE_MAX_LINES} (replace, never append)`)
    const upd = block.join('\n').match(/\*\*Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/)
    if (!upd) at('Current state lacks `**Updated:** YYYY-MM-DD`')
    const secs = block.filter((l) => /^### /.test(l)).map((l) => l.replace(/^### /, '').trim())
    if (secs.join('|') !== CURRENT_STATE_SECTIONS.join('|')) {
      at(`Current state sections must be exactly [${CURRENT_STATE_SECTIONS.join(', ')}] in order; found [${secs.join(', ')}]`)
    }
    if (upd && fm.branch && ctx.currentBranch === fm.branch && ctx.currentBranch !== 'main' && ctx.newestCodeCommitDate) {
      if (upd[1] < ctx.newestCodeCommitDate) {
        at(`Updated ${upd[1]} is older than the newest code commit on this branch (${ctx.newestCodeCommitDate}) — the block is stale`)
      }
    }
  }
  return F
}

/**
 * The registered code an id is filed under, or null. Codes may carry hyphens (hub ids such as
 * C2-TIER1, DOCS-RESTRUCTURE), so the match is "the longest registered code that prefixes the
 * remainder followed by '-'", never "the first hyphen-delimited segment" — that shape read
 * BUG-C2-TIER1-X as code `C2` and would have rejected every multi-segment hub id.
 */
export function codeOf(id, registered) {
  const rest = String(id).replace(/^(?:BUG|FUP)-/, '')
  if (rest === String(id)) return null
  let best = null
  for (const c of registered) if (rest.startsWith(c + '-') && (!best || c.length > best.length)) best = c
  return best
}

export function checkCodes({ bugRows, fupEntries, registered, legacyRows }) {
  const F = []
  if (!legacyRows || legacyRows === 0) F.push(`[CODES] ${PATHS.legacyCodes} — legend missing or empty`)
  for (const r of bugRows) {
    const opened = r.cells.Opened
    if (!DATE_RX.test(opened) || opened < CODE_WATERMARK) continue
    if (!codeOf(r.cells.ID, registered)) F.push(`[CODES] ${PATHS.bugs}:${r.line} — ${r.cells.ID} uses no registered code (a hub id or a legacy-codes row must prefix it)`)
  }
  for (const e of fupEntries) {
    const filed = (e.fields.match(/\*\*Filed:\*\*\s*(\d{4}-\d{2}-\d{2})/) || [])[1]
    if (!filed || filed < CODE_WATERMARK) continue
    if (!codeOf(e.id, registered)) F.push(`[CODES] ${PATHS.fupOpen}:${e.line} — ${e.id} uses no registered code (a hub id or a legacy-codes row must prefix it)`)
  }
  return F
}

/**
 * GitHub-style heading slug (approximate): lowercase, strip everything but letters/digits/`_`/`-`
 * /space, collapse the RUNS OF SPACES that removing padded punctuation exposes (`" — "` → one
 * space, not two) into a single space, then space → `-`. A literal `--` already in the heading
 * text is NOT touched by that collapse (only spaces collapse, not hyphens) — that is the one
 * property callers rely on, so do not "clean up" a genuine `--` into `-`. A heading that starts
 * with a stripped symbol (`"✅ BUG-…"`) legitimately slugs to a LEADING hyphen; do not trim it.
 */
export function githubSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\- ]+/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/ /g, '-')
}

/** Does some `#`-heading in `archiveText` slug to exactly `slug`? Plain match, no GitHub
 *  duplicate-slug disambiguation (`-1`, `-2`, …) — the archive has no duplicate headings today. */
export function anchorExistsInArchive(archiveText, slug) {
  for (const m of archiveText.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    if (githubSlug(m[1]) === slug) return true
  }
  return false
}

/** A BUGS.md Doc link's per-ID document (docs/bugs/BUG-*.md — the README template's shape). */
const BUG_DOC_BASENAME_RX = /^BUG-[A-Z0-9][A-Z0-9-]*\.md$/

export function checkBugs(table, ctx) {
  const F = []
  const W = []
  const counts = { untriaged: 0, unrated: 0 }
  const file = PATHS.bugs
  if (!table) return { findings: [`[BUGS] ${file} — no table found`], warnings: W, counts }
  if (table.columns.join('|') !== BUG_COLUMNS.join('|')) {
    F.push(`[BUGS] ${file}:${table.headerLine} — columns must be [${BUG_COLUMNS.join(' | ')}]; found [${table.columns.join(' | ')}]`)
    return { findings: F, warnings: W, counts }
  }
  const seen = new Map()
  const linkedDocs = new Set()
  for (const r of table.rows) {
    const c = r.cells
    const at = (msg) => F.push(`[BUGS] ${file}:${r.line} — ${c.ID || '(no id)'}: ${msg}`)
    if (!/^BUG-[A-Z0-9][A-Z0-9-]*$/.test(c.ID)) at('id must match BUG-[A-Z0-9-]+')
    if (seen.has(c.ID)) at(`duplicate id (first at line ${seen.get(c.ID)})`)
    seen.set(c.ID, r.line)
    if (!BUG_STATUS.includes(c.Status)) at(`status \`${c.Status}\` not in ${BUG_STATUS.join('|')}`)
    if (c.Status === 'untriaged') counts.untriaged++
    const legacy = c.Opened === '—' || (DATE_RX.test(c.Opened) && c.Opened < CODE_WATERMARK)
    if (c.Severity === 'unrated') {
      counts.unrated++
      if (!legacy) at('`unrated` is allowed only for rows opened before the watermark')
    } else if (!SEVERITY.includes(c.Severity)) at(`severity \`${c.Severity}\` not in ${SEVERITY.join('|')}`)
    if (!(c.Opened === '—' || DATE_RX.test(c.Opened))) at('Opened must be YYYY-MM-DD or —')
    if (!(c.Closed === '—' || DATE_RX.test(c.Closed))) at('Closed must be YYYY-MM-DD or —')
    if ((c.Status === 'open' || c.Status === 'untriaged') && c.Closed !== '—') at('Closed must be — while the bug is open/untriaged')
    if (!legacy && BUG_CLOSED_STATUS.includes(c.Status) && c.Closed === '—') at('a closed bug opened after the watermark needs a Closed date')
    if (c.Doc !== '—') {
      const link = (c.Doc.match(/\]\(([^)]+)\)/) || [])[1]
      if (!link) at('Doc must be — or a markdown link')
      else {
        const hashAt = link.indexOf('#')
        const pathPart = hashAt === -1 ? link : link.slice(0, hashAt)
        const fragment = hashAt === -1 ? null : link.slice(hashAt + 1)
        const p = join(PATHS.bugsDir, pathPart)
        if (!ctx.exists(p)) at(`Doc link \`${link}\` does not resolve`)
        else {
          const base = basename(p)
          if (BUG_DOC_BASENAME_RX.test(base)) {
            // The per-ID doc template (docs/bugs/BUG-*.md, one row's own document): a
            // fixed/verified row needs its two required sections non-empty.
            linkedDocs.add(base)
            if (c.Status === 'fixed' || c.Status === 'verified') {
              const t = ctx.readRel(p) || ''
              for (const sec of ['Root cause', 'Regression protection']) {
                if (!sectionNonEmpty(t, sec)) at(`status ${c.Status} but the document's \`## ${sec}\` is empty`)
              }
            }
          } else if (base === 'archive.md' && fragment) {
            // A pre-2026-07 body: archive.md is free-form history with no Root-cause/Regression-
            // protection headings anywhere, so the completeness check does not apply — the
            // property that DOES apply is that the anchor actually lands on a heading.
            const archiveText = ctx.readRel(p) || ''
            if (!anchorExistsInArchive(archiveText, fragment)) at(`Doc anchor #${fragment} not found in archive.md`)
          } else {
            at(`Doc link \`${link}\` is not a recognized form (expected docs/bugs/BUG-*.md or docs/bugs/archive.md#<slug>)`)
          }
        }
      }
    }
  }
  for (const d of ctx.bugDocFiles) {
    if (!linkedDocs.has(d)) F.push(`[BUGS] ${PATHS.bugsDir}/${d} — no BUGS.md row links this document`)
  }
  // ADR 0186 D6: untriaged/unrated counts used to print here as ad-hoc warnings; they are now
  // RATCHETS (bugsUntriaged, bugsUnrated) — reported via `counts` and enforced by checkRatchets.
  return { findings: F, warnings: W, counts }
}

export function sectionNonEmpty(text, heading) {
  const lines = text.split('\n')
  const i = lines.findIndex((l) => l.trim() === `## ${heading}`)
  if (i === -1) return false
  for (let j = i + 1; j < lines.length; j++) {
    if (/^## /.test(lines[j])) return false
    if (lines[j].trim() && !/^<!--/.test(lines[j].trim())) return true
  }
  return false
}

export function fupEntriesOf(text) {
  return parseEntries(text)
    .map((e) => ({ ...e, id: (e.heading.match(/\b(FUP-[A-Z0-9][A-Z0-9-]*)/) || [])[1] }))
    .filter((e) => e.id)
}

/**
 * Validate a FOLLOWUPS `**Owner:**` value against the closed vocabulary (ADR 0186 D4 / plan
 * 5.1): tokens from OWNER_VOCAB only, joined by exactly `' + '`, listed in vocabulary order,
 * no duplicates, nothing else (no periods, no backticks, no free text). Returns a finding
 * string, or `null` when the value is clean.
 */
export function checkOwnerValue(raw) {
  const v = (raw ?? '').trim()
  if (!v) return 'lacks `**Owner:**`'
  const parts = v.split('+').map((s) => s.trim())
  for (const p of parts) {
    if (!OWNER_VOCAB.includes(p)) return `Owner \`${v}\` — \`${p}\` is not in the closed vocabulary (${OWNER_VOCAB.join(', ')})`
  }
  const idxs = parts.map((p) => OWNER_VOCAB.indexOf(p))
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] === idxs[i - 1]) return `Owner \`${v}\` — duplicate role \`${parts[i]}\``
    if (idxs[i] < idxs[i - 1]) return `Owner \`${v}\` — roles must be listed in vocabulary order (${OWNER_VOCAB.join(', ')})`
  }
  if (v !== parts.join(' + ')) return `Owner \`${v}\` — roles must be joined by \` + \` exactly, nothing else`
  return null
}

/** Every `**Register line**` paragraph in the OPEN register — forbidden outright (ADR 0186 D4):
 *  the shape 5.2's split script deletes, folding any surviving claim into the entry body. */
export function checkNoRegisterLineMarker(text) {
  const F = []
  text.split('\n').forEach((l, i) => {
    if (/\*\*Register line\*\*/.test(l)) {
      F.push(`[FOLLOWUPS] ${PATHS.fupOpen}:${i + 1} — forbidden **Register line** paragraph (ADR 0186 D4); fold its claim into the entry body and delete the paragraph`)
    }
  })
  return F
}

/**
 * Critical pin ROW length (ADR 0186 plan 5.6): each `## ⭐⭐ Critical` data row ≤ 300 chars —
 * the gate-7 per-CELL cap idea, applied to the WHOLE ROW, because a pin row is id · trigger ·
 * deadline · owner, never narrative. Header and divider rows are skipped positionally (the
 * first two `|`-prefixed lines of the section), not by content, so it also fires on a malformed
 * header the same way `parseTable` would refuse to recognize one.
 */
export function checkCriticalPinRowLength(text) {
  const F = []
  const lines = text.split('\n')
  const i = lines.findIndex((l) => /^## .*Critical/.test(l))
  if (i === -1) return F
  let end = lines.length
  for (let j = i + 1; j < lines.length; j++) {
    if (/^## /.test(lines[j])) {
      end = j
      break
    }
  }
  let seenHeader = false
  let seenDivider = false
  for (let j = i + 1; j < end; j++) {
    const l = lines[j]
    if (!/^\s*\|/.test(l)) continue
    if (!seenHeader) {
      seenHeader = true
      continue
    }
    if (!seenDivider) {
      seenDivider = true
      continue
    }
    if (l.length > 300) {
      F.push(`[FOLLOWUPS] ${PATHS.fupOpen}:${j + 1} — Critical pin row is ${l.length} chars (cap 300); rows are id · trigger · deadline · owner, no narrative`)
    }
  }
  return F
}

/** A line inside an entry's span that is an h2 (`## `) or h4+ (`#### `+) heading — forbidden
 *  (ADR 0186 D4): only the entry's own `### ` heading and its `**field:**` lines/body prose
 *  belong there. `### ` nesting is not tested here — it is what ENDS a span (parseEntries). */
const NESTED_HEADING_RX = /^(##(?!#)|####+)\s/

/**
 * Per-entry shape checks new in ADR 0186 D4 / plan 5.1: entry length, no nested `##`/`####`
 * heading, and the heading-length RATCHET (headings stay verbatim by decision, so a long one is
 * tracked, never hard-capped). Returns `{ findings, longHeadings }` — the count feeds RATCHETS.
 */
export function checkFollowupEntryShape(e) {
  const F = []
  const at = (msg) => F.push(`[FOLLOWUPS] ${PATHS.fupOpen}:${e.line} — ${e.id}: ${msg}`)
  const span = [e.heading, ...e.bodyLines]
  let n = span.length
  while (n > 0 && !span[n - 1].trim()) n--
  if (n > FOLLOWUP_MAX_ENTRY_LINES) at(`entry is ${n} lines (cap ${FOLLOWUP_MAX_ENTRY_LINES}); move the body to docs/followups/${e.id}.md and link it with \`**Body:**\``)
  e.bodyLines.forEach((l, idx) => {
    if (NESTED_HEADING_RX.test(l)) at(`line ${e.line + 1 + idx} is a \`${l.match(/^#+/)[0]}\` heading inside the entry — forbidden; only \`### \` entry headings belong in the index`)
  })
  const headingText = e.heading.replace(/^### /, '')
  const longHeadings = headingText.length > FOLLOWUP_MAX_HEADING_CHARS ? 1 : 0
  return { findings: F, longHeadings }
}

/**
 * `**Body:**` cross-check (ADR 0186 D4): every `docs/followups/FUP-*.md` file is linked by
 * EXACTLY ONE entry's `**Body:**` field, and every such link resolves to a real file — orphans
 * BOTH ways red (an unlinked body file, and a link with no file behind it).
 */
export function checkFollowupBodies(entries, bodyFiles) {
  const F = []
  const linked = new Map()
  for (const e of entries) {
    const m = e.fields.match(/\*\*Body:\*\*\s*\[[^\]]*\]\(([^)]+)\)/)
    if (!m) continue
    const file = m[1].replace(/^\.?\//, '')
    if (!linked.has(file)) linked.set(file, [])
    linked.get(file).push(e.id)
  }
  for (const [file, ids] of linked) {
    if (ids.length > 1) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — ${file} is linked by ${ids.length} entries (${ids.join(', ')}); exactly one entry may own a body file`)
    if (!bodyFiles.includes(file)) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — ${ids[0]}'s \`**Body:**\` link \`${file}\` does not resolve to a file in ${PATHS.followupsDir}`)
  }
  for (const f of bodyFiles) {
    if (!linked.has(f)) F.push(`[FOLLOWUPS] ${PATHS.followupsDir}/${f} — no entry's \`**Body:**\` links this file (orphan body)`)
  }
  return F
}

/**
 * ADR 0185 D5: a resolved entry's body lives INLINE in follow-ups-archive.md — the pointer-to-
 * a-separate-file shape (`**Body:**`) is the OPEN register's mechanism for an entry too long to
 * keep in the index, and has no reason to exist once the entry is archived (the whole entry,
 * body included, moves there verbatim). A `**Body:**` line surviving into the archive is a
 * rotation that dropped the file it pointed at, or forgot to fold the body in.
 */
export function checkArchiveNoBodyLink(archiveText) {
  const F = []
  archiveText.split('\n').forEach((l, i) => {
    if (/\*\*Body:\*\*/.test(l)) {
      F.push(
        `[FOLLOWUPS] ${PATHS.fupArchive}:${i + 1} — a resolved entry's body lives INLINE in the ` +
          `archive (ADR 0185 D5); a \`**Body:**\` link belongs only in the open register`,
      )
    }
  })
  return F
}

export function checkFollowups({ open, criticalIds, bodyFiles = [] }) {
  const F = []
  const counts = { poToRule: 0, severityPerEmoji: 0, severityUnrated: 0, revisitWhenPoToRule: 0, longHeadings: 0 }
  const entries = fupEntriesOf(open)
  if (!entries.length) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — no FUP entries found (wrong file?)`)
  for (const e of entries) {
    const at = (msg) => F.push(`[FOLLOWUPS] ${PATHS.fupOpen}:${e.line} — ${e.id}: ${msg}`)
    const f = e.fields
    const filed = f.match(/\*\*Filed:\*\*\s*(\S+)/)
    if (!filed) at('lacks `**Filed:**`')
    else if (!DATE_RX.test(filed[1])) at(`Filed \`${filed[1]}\` is not YYYY-MM-DD`)

    const ownerM = f.match(/\*\*Owner:\*\*\s*([^·\n]+)/)
    const ownerErr = checkOwnerValue(ownerM ? ownerM[1] : null)
    if (ownerErr) at(ownerErr)

    const sevM = f.match(/\*\*Severity:\*\*\s*([^·\n]+)/)
    if (!sevM) at('lacks `**Severity:**`')
    else {
      const sevRaw = sevM[1].trim()
      const sevWord = (sevRaw.match(/^([a-z]+)/) || [])[1] || ''
      if (/per emoji at consolidation/i.test(sevRaw)) counts.severityPerEmoji++
      if (sevWord === 'unrated') {
        counts.severityUnrated++
        if (!(filed && DATE_RX.test(filed[1]) && filed[1] < CODE_WATERMARK)) at(`\`unrated\` severity is legal only for entries Filed before ${CODE_WATERMARK}`)
      } else if (!SEVERITY.includes(sevWord)) {
        at(`severity \`${sevWord}\` not in ${SEVERITY.join('|')}`)
      }
      if ((SEVERITY.includes(sevWord) || sevWord === 'unrated') && !RESOLVED_HEADING_RX.test(e.heading)) {
        // A RESOLVED entry retained as a review lens (gate 7's **Retained** opt-out) keeps ⬛ in the
        // emoji slot — that marker carries its resolution, not its severity, so it is exempt here.
        // Code points, not UTF-16 units: 🔴🟠🟡🟢⚪ are surrogate pairs, so `str[0]` is a lone surrogate.
        const headText = e.heading.replace(/^### /, '').trim()
        const want = SEVERITY_EMOJI[sevWord]
        if (!headText.startsWith(want)) at(`heading emoji ${Array.from(headText)[0]} disagrees with severity ${sevWord} (${want})`)
      }
    }

    const closes = f.match(/\*\*Closes when:\*\*\s*(.*)/)
    if (!closes || !closes[1].trim()) at('lacks `**Closes when:**`')
    else if (/PO to rule/i.test(closes[1])) counts.poToRule++

    const statusM = f.match(/\*\*Status:\*\*\s*([a-z]+)/)
    if (!statusM) at('lacks `**Status:**`')
    else if (!FOLLOWUP_STATUS.includes(statusM[1])) at(`Status \`${statusM[1]}\` not in ${FOLLOWUP_STATUS.join('|')}`)
    else if (statusM[1] === 'parked') {
      const revisit = f.match(/\*\*Revisit when:\*\*\s*(.*)/)
      if (!revisit || !revisit[1].trim()) at('Status parked requires a non-empty `**Revisit when:**`')
      else if (/PO to rule/i.test(revisit[1])) counts.revisitWhenPoToRule++
    }
    // ADR 0186 D4: the old bare `**Parked**` body marker is no longer the signal — `**Status:**
    // parked` is. A marker with no matching Status is now itself a finding, not a fallback path.
    if (/\*\*Parked\*\*(?!:)/.test(e.body) && !(statusM && statusM[1] === 'parked')) {
      at('carries the old `**Parked**` marker with no `**Status:** parked` — the marker is no longer the signal (ADR 0186 D4)')
    }

    const shape = checkFollowupEntryShape(e)
    F.push(...shape.findings)
    counts.longHeadings += shape.longHeadings
  }
  F.push(...checkNoRegisterLineMarker(open))
  F.push(...checkCriticalPinRowLength(open))
  F.push(...checkFollowupBodies(entries, bodyFiles))
  if (criticalIds) {
    const ids = new Set(entries.map((e) => e.id))
    for (const id of criticalIds) if (!ids.has(id)) F.push(`[FOLLOWUPS] Critical pin names ${id}, which has no register entry (orphan)`)
  } else if (CRITICAL_PIN_REQUIRED) {
    F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — the \`## ⭐⭐ Critical\` pin section is required and missing`)
  }
  return { findings: F, warnings: [], counts }
}

/**
 * Ids that are ROWS of the `## ⭐⭐ Critical` pin, or null when the section is absent. A row's item
 * is its second cell's LEADING bold token (`| **C1** | 🔒 **`FUP-X`** — …`); an id merely NAMED in a
 * row's prose is a mention, not a row — the pin's C1 row names three RESOLVED items in passing, and a
 * bare id scan reported all three as orphans (measured 2026-09-03). Same discrimination the retired
 * check-progress-doc `criticalRowRe` made.
 */
export function criticalIdsOf(text) {
  const lines = text.split('\n')
  const i = lines.findIndex((l) => /^## .*Critical/.test(l))
  if (i === -1) return null
  let end = lines.length
  for (let j = i + 1; j < lines.length; j++) {
    if (/^## /.test(lines[j])) {
      end = j
      break
    }
  }
  const ids = new Set()
  for (const l of lines.slice(i, end)) {
    const m = /^\|[^|]*\|[^*|]*\*\*`?(FUP-[A-Z0-9][A-Z0-9-]*)`?\*\*/u.exec(l)
    if (m) ids.add(m[1])
  }
  return [...ids]
}

/** One token of an Origin / Enforcement cell → finding string or null. */
export function checkToken(tok, ctx, kind) {
  const t = tok.trim()
  if (!t) return 'empty token'
  let m
  if ((m = t.match(/^ADR\s+(\d{4})$/))) return ctx.adrExists(m[1]) ? null : `ADR ${m[1]} has no file`
  if (/^FUP-[A-Z0-9-]+$/.test(t)) return ctx.fupExists(t) ? null : `${t} is in no follow-up register`
  if (/^BUG-[A-Z0-9-]+$/.test(t)) return ctx.bugIds.has(t) ? null : `${t} has no BUGS.md row`
  if ((m = t.match(/^`([^`]+)`$/))) {
    const p = m[1].replace(/#.*$/, '')
    return ctx.globExists(p) ? null : `path \`${p}\` does not exist`
  }
  if (kind === 'origin' && /^[0-9a-f]{7,40}$/.test(t)) return ctx.shaExists(t) ? null : `commit ${t} not found`
  if (kind === 'enforcement') {
    if ((m = t.match(/^lint:([a-z0-9-]+)$/))) return ctx.lintScripts.has(`lint:${m[1]}`) ? null : `no \`lint:${m[1]}\` script in package.json`
    if ((m = t.match(/^ARM=([a-z]+)$/))) return ARMS.includes(m[1]) ? null : `unknown arm ${m[1]}`
    if (/^\.claude\/rules\/[^\s]+\.md$/.test(t)) return ctx.exists(t) ? null : `rule file ${t} does not exist`
  }
  return `unrecognized ${kind} token \`${t}\``
}

export function checkLessons(table, ctx) {
  const F = []
  const W = []
  const file = PATHS.lessons
  if (!table) return { findings: [`[LESSONS] ${file} — no table found`], warnings: W, ids: new Set(), counts: { prose: 0 } }
  if (table.columns.join('|') !== LESSON_COLUMNS.join('|')) {
    return { findings: [`[LESSONS] ${file}:${table.headerLine} — columns must be [${LESSON_COLUMNS.join(' | ')}]`], warnings: W, ids: new Set(), counts: { prose: 0 } }
  }
  const ids = new Set()
  let prose = 0
  for (const r of table.rows) {
    const c = r.cells
    const at = (msg) => F.push(`[LESSONS] ${file}:${r.line} — ${c.ID || '(no id)'}: ${msg}`)
    if (!/^LEARN-\d{3,}$/.test(c.ID)) at('id must be LEARN-NNN')
    if (ids.has(c.ID)) at('duplicate id')
    ids.add(c.ID)
    if (!c.Lesson.trim()) at('empty Lesson')
    if (!c.Origin.trim()) at('empty Origin')
    for (const tok of splitTokens(c.Origin)) {
      const f = checkToken(tok, ctx, 'origin')
      if (f) at(`Origin: ${f}`)
    }
    if (/^prose only$/i.test(c.Enforcement.trim())) prose++
    else {
      if (!c.Enforcement.trim()) at('empty Enforcement (write `prose only` if nothing enforces it)')
      for (const tok of splitTokens(c.Enforcement)) {
        const f = checkToken(tok, ctx, 'enforcement')
        if (f) at(`Enforcement: ${f}`)
      }
    }
  }
  // ADR 0186 D6: the `prose only` count used to print here as an ad-hoc warning; it is now the
  // lessonsProseOnly RATCHET — reported via `counts` and enforced by checkRatchets.
  return { findings: F, warnings: W, ids, counts: { prose } }
}

/** Split a cell on commas that are outside backticks and outside parentheses. */
export function splitTokens(cell) {
  const out = []
  let cur = ''
  let tick = false
  let depth = 0
  for (const ch of cell) {
    if (ch === '`') tick = !tick
    if (!tick && ch === '(') depth++
    if (!tick && ch === ')') depth--
    if (ch === ',' && !tick && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.replace(/\s*\([^)]*\)\s*$/, '').trim()).filter(Boolean)
}

export function checkPostmortems(files, lessonIds) {
  const F = []
  for (const f of files) {
    const at = (msg) => F.push(`[POSTMORT] ${PATHS.postmortemsDir}/${f.name} — ${msg}`)
    const id = (f.name.match(/^(LEARN-\d{3,})/) || [])[1]
    if (!id) at('file name must start with LEARN-NNN')
    else if (!lessonIds.has(id)) at(`no LESSONS.md row ${id}`)
    for (const sec of POSTMORTEM_SECTIONS) if (!sectionNonEmpty(f.text, sec)) at(`\`## ${sec}\` missing or empty`)
  }
  return F
}

/**
 * `today` is the wall-clock date as `YYYY-MM-DD` — same pattern as gate 9's proposed-review
 * timer (`build-adr-index.mjs` `checkProposedReview`, `new Date().toISOString().slice(0, 10)`
 * computed once at the call site). Passed in rather than read here so the self-test can fix it
 * instead of the result depending on the day the suite happens to run.
 */
/**
 * Is `name` a handoff file — not the directory's `README.md` placeholder (kept in git when the
 * directory is otherwise empty, ADR 0186 Wave 3: it carries no `branch:`/`expires:` and its
 * name appears in every README mention) and not some other non-Markdown file? ADR 0186 D8 /
 * plan 6.7: lifted out of `main()`, which had this filter with no fixture of its own.
 */
export function isHandoffFile(name) {
  return name.endsWith('.md') && name !== 'README.md'
}

export function checkHandoffs(files, branches, citations, today) {
  const F = []
  for (const f of files) {
    const at = (msg) => F.push(`[HANDOFFS] ${PATHS.handoffsDir}/${f.name} — ${msg}`)
    if (f.bytes > HANDOFF_MAX_BYTES) at(`${f.bytes} bytes exceeds the ${HANDOFF_MAX_BYTES}-byte cap (compress by CUTTING, never by dropping qualifiers)`)
    const branch = f.fm && f.fm.branch ? String(f.fm.branch) : null
    const expiresRaw = f.fm ? f.fm.expires : null
    const expires = expiresRaw != null ? isoDateOf(expiresRaw) : null
    // ADR 0186 D3: a unit with a hub carries `branch:`; hubless work carries `expires:` instead.
    // Neither present is a stale/malformed handoff — it has no way to ever be judged stale.
    if (!branch && expiresRaw == null) at('frontmatter carries neither `branch:` nor `expires:` — one is required (ADR 0186 D3)')
    if (branch && !branches.includes(branch)) at(`branch \`${f.fm.branch}\` no longer exists — stale handoff, delete or promote`)
    if (expiresRaw != null) {
      if (expires === null || !DATE_RX.test(expires)) at(`expires \`${expiresRaw}\` is not an ISO date (YYYY-MM-DD)`)
      else if (expires < today) at(`expires ${expires} is in the past — stale handoff, delete or promote`)
    }
    for (const c of citations.filter((x) => x.handoff === f.name)) {
      if (!HANDOFF_CITATION_ALLOWED.some((p) => c.file.startsWith(p))) at(`cited from ${c.file}:${c.line} — a handoff may not be cited; promote the claim into a durable record`)
    }
  }
  return F
}

/**
 * ADR 0186 D8 / plan 6.3: the ONE link checker for both gate 7 and gate 13 — the union of what
 * each had alone. Fence + code-span blanking and the extension filter came from whichever gate
 * had them; new here for gate 13 is the in-file `#anchor` check (alphanumeric-only substring
 * match against this file's own headings, so emoji/punctuation slugging can't false-red) that
 * only gate 7 used to run.
 */
export function checkLinks(file, text, exists) {
  const F = []
  const headings = [...text.matchAll(/^#{1,6} +(.+)$/gm)].map((m) => anchorKey(m[1]))
  for (const { target, line } of markdownLinks(text)) {
    if (target.startsWith('#')) {
      const key = anchorKey(decodeURIComponent(target.slice(1)))
      if (key && !headings.some((h) => h.includes(key) || key.includes(h))) {
        F.push(`[LINKS] ${file}:${line} — in-file anchor does not match any heading: ${target}`)
      }
      continue
    }
    const path = target.split('#')[0]
    if (!path.endsWith('.md') && !/\.[a-z]{2,4}$/.test(path)) continue
    const p = resolve(dirname(file), path)
    if (!exists(relative('.', p))) F.push(`[LINKS] ${file}:${line} — link \`${target}\` does not resolve`)
  }
  return F
}

export function checkDocsIndex(indexText, docsEntries) {
  if (indexText == null) return [`[INDEX] ${PATHS.docsIndex} — missing`]
  const F = []
  for (const e of docsEntries) {
    if (e === 'INDEX.md') continue
    if (!indexText.includes(e)) F.push(`[INDEX] ${PATHS.docsIndex} — does not mention \`${e}\` (every top-level docs/ entry must be mapped)`)
  }
  return F
}

/** Is a repo-relative path (forward slashes) in the RETIRED arm's domain? */
export function inRetiredDomain(file) {
  if (file === RETIRED_EXCLUDE_CLAUDE_MD) return false
  if (RETIRED_EXCLUDE_PATHS.has(file)) return false
  return !RETIRED_EXCLUDE_PATH_PREFIXES.some((p) => file.startsWith(p))
}

/**
 * Replace fenced code blocks and inline code spans with spaces of equal length (newlines kept),
 * so a quotation of retired-section text inside code is not read as a citation, while every
 * finding still lands on its true line number.
 */
export function blankCode(text) {
  const noFences = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
  return noFences.replace(/(`+)([^`\n]*?)\1/g, (m) => ' '.repeat(m.length))
}

export function checkRetired(file, text) {
  const F = []
  const lines = blankCode(text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = RETIRED_SECTION_RX.exec(lines[i])
    if (m) {
      F.push(
        `[RETIRED] ${file}:${i + 1} — cites a PROGRESS.md section retired by ADR 0185 D6 ("§ Now"); ` +
          `point at the hub, the register, or the docs/progress archive instead (matched \`${m[0]}\`)`,
      )
    }
  }
  return F
}

// ─── filesystem / git context ────────────────────────────────────────────────────────────

function read(rel) {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}
function exists(rel) {
  return existsSync(join(ROOT, rel))
}
function globExists(rel) {
  if (!rel.includes('*')) return exists(rel)
  const dir = dirname(rel)
  const rx = new RegExp('^' + basename(rel).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
  if (!existsSync(join(ROOT, dir))) return false
  return readdirSync(join(ROOT, dir)).some((f) => rx.test(f))
}
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}
function walkMd(dir, out = []) {
  const skip = new Set(['node_modules', '.next', 'worktrees', 'graphify-out', '.git'])
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (skip.has(e.name)) continue
    const rel = dir === '.' ? e.name : `${dir}/${e.name}`
    if (e.isDirectory()) {
      if (rel === '.claude/worktrees') continue
      walkMd(rel, out)
    } else if (e.name.endsWith('.md')) out.push(rel)
  }
  return out
}

export function listHubs() {
  if (!existsSync(join(ROOT, PATHS.featuresDir))) return []
  return readdirSync(join(ROOT, PATHS.featuresDir))
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md' && f !== basename(PATHS.legacyCodes) && f !== 'README.md')
    .sort()
    .map((f) => {
      const file = `${PATHS.featuresDir}/${f}`
      const text = read(file)
      const { fm, body, error } = parseFrontmatter(text)
      return { file, fm, body, error }
    })
}

function buildCtx() {
  const adrFiles = existsSync(join(ROOT, PATHS.decisionsDir)) ? readdirSync(join(ROOT, PATHS.decisionsDir)) : []
  // ADR 0186 D4: deferred-backlog.md is gone (merged into fupOpen as parked entries); a FUP id's
  // body may now live in its own docs/followups/FUP-*.md file, so that set joins the search too.
  const fupBodyNames = existsSync(join(ROOT, PATHS.followupsDir))
    ? readdirSync(join(ROOT, PATHS.followupsDir)).filter((f) => /^FUP-.*\.md$/.test(f)).map((f) => `${PATHS.followupsDir}/${f}`)
    : []
  const fupTexts = [PATHS.fupOpen, PATHS.fupArchive, ...fupBodyNames].map((p) => read(p) || '').join('\n')
  const pkg = JSON.parse(read('package.json') || '{}')
  const bugsTable = parseTable(read(PATHS.bugs) || '', REGISTER_HEADER_RX)
  return {
    exists,
    globExists,
    readRel: read,
    adrExists: (n) => adrFiles.some((f) => f.startsWith(`${n}-`)),
    fupExists: (id) => new RegExp(`\\b${id}\\b`).test(fupTexts),
    bugIds: new Set((bugsTable?.rows || []).map((r) => r.cells.ID)),
    shaExists: (sha) => git(`cat-file -e ${sha}^{commit} && echo ok`) === 'ok' || git(`rev-parse --verify --quiet ${sha}^{commit}`) !== '',
    lintScripts: new Set(Object.keys(pkg.scripts || {}).filter((k) => k.startsWith('lint:'))),
    branches: git('branch --list --format=%(refname:short)').split('\n').filter(Boolean),
    currentBranch: git('branch --show-current'),
    newestCodeCommitDate: git('log -1 --format=%cs -- src supabase e2e') || null,
    ledgerText: read(PATHS.phaseLedger) || '',
    bugDocFiles: existsSync(join(ROOT, PATHS.bugsDir)) ? readdirSync(join(ROOT, PATHS.bugsDir)).filter((f) => /^BUG-.*\.md$/.test(f)) : [],
    bugsTable,
  }
}

// ─── self-test: every checker must red on a bad fixture and stay silent on a good one ────

function selfTest() {
  const fails = []
  const must = (name, findings, expectRed) => {
    const red = findings.length > 0
    if (red !== expectRed) fails.push(`${name}: expected ${expectRed ? 'RED' : 'GREEN'}, got ${red ? 'RED' : 'GREEN'}${red ? ` (${findings[0]})` : ''}`)
  }
  const okCtx = {
    exists: () => true,
    globExists: () => true,
    // Carries a compliant `## Session log` (one dated entry) ahead of the BUGS-doc sections below
    // it, so a hub fixture's progress record and a bug fixture's linked doc can share one context.
    readRel: () => '## Session log\n\n### 2026-09-01 — s1\n\nbody\n\n## Root cause\nx\n## Regression protection\ny\nAPPROVED',
    adrExists: () => true,
    fupExists: () => true,
    bugIds: new Set(['BUG-X-ONE']),
    shaExists: () => true,
    lintScripts: new Set(['lint:progress']),
    branches: ['feat-a', 'main'],
    currentBranch: 'feat-a',
    newestCodeCommitDate: '2026-09-01',
    ledgerText: '| X1 |',
    bugDocFiles: [],
  }
  const goodBlock = '\n## Current state\n\n**Updated:** 2026-09-02\n\n### Objective\na\n### Done since start\nb\n### In progress\nc\n### Next\nd\n### Blockers\ne\n'
  const goodHub = {
    file: 'docs/features/x1.md',
    fm: { id: 'X1', title: 't', status: 'in_progress', kind: 'feature', program: 'X', branch: 'feat-a', plan: null, progress: '../progress/x1.md', reviews: [], adrs: ['0001'], handoff: null },
    body: '# X1\n' + goodBlock,
    error: null,
  }
  must('HUBS good', checkHub(goodHub, okCtx), false)
  must('HUBS bad status', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'done' } }, okCtx), true)
  must('HUBS wrong file name', checkHub({ ...goodHub, file: 'docs/features/other.md' }, okCtx), true)
  must('HUBS missing branch', checkHub({ ...goodHub, fm: { ...goodHub.fm, branch: null } }, okCtx), true)
  must('HUBS branch gone', checkHub({ ...goodHub, fm: { ...goodHub.fm, branch: 'nope' } }, okCtx), true)
  must('HUBS missing key', checkHub({ ...goodHub, fm: (({ handoff: _h, ...rest }) => rest)(goodHub.fm) }, okCtx), true)
  must('HUBS no block', checkHub({ ...goodHub, body: '# X1\n' }, okCtx), true)
  must('HUBS block on complete', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete' } }, okCtx), true)
  must('HUBS complete ok', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete' }, body: '# X1\n' }, okCtx), false)
  must('HUBS block on planned', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'planned' } }, okCtx), true)
  must('HUBS planned ok', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'planned' }, body: '# X1\n' }, okCtx), false)
  must('HUBS complete unrecorded', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete' }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '' }), true)
  // ADR 0186 D8 / plan 6.1: the cross-check is ROW-grade — a mere MENTION of the id in the
  // ledger (no table row) must still red, and a review's verdict must say APPROVED on its
  // VERDICT LINE, not merely contain the word "APPROVED" or "NOT APPROVED" somewhere.
  must(
    'HUBS complete ledger mention-only reds (row-grade, not a string search)',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete' }, body: '# X1\n' }, { ...okCtx, ledgerText: 'See X1 in the summary.\n', readRel: () => '' }),
    true,
  )
  must(
    // reviews: ['review.md'] so this exercises reviewHasApprovedVerdict's rejection — an EMPTY
    // reviews array would red here too, but vacuously (it never looks at the text at all).
    'HUBS complete via review NOT APPROVED reds',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete', reviews: ['review.md'] }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '**Verdict: NOT APPROVED**\n' }),
    true,
  )
  must(
    'HUBS complete via review CHANGES REQUESTED reds',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete', reviews: ['review.md'] }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '**Verdict: CHANGES REQUESTED**\n' }),
    true,
  )
  must(
    // The one live complete hub, DOCS-RESTRUCTURE, is recorded this way — its review's verdict
    // line is a HEADING, not the plan's two literal bold-paragraph examples. A regex built only
    // from those two examples would red on the live tree; this fixture is what keeps it honest.
    'HUBS complete via review heading-form APPROVED ok',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete', reviews: ['review.md'] }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '## Verdict: **APPROVED**\n' }),
    false,
  )
  must(
    'HUBS complete via review bold-colon-outside APPROVED ok',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete', reviews: ['review.md'] }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '**Verdict:** APPROVED\n' }),
    false,
  )
  must('hubHasLedgerRow row', [hubHasLedgerRow('X1', '| X1 | done |') ? '' : 'x'].filter(Boolean), false)
  must('hubHasLedgerRow mention only', [hubHasLedgerRow('X1', 'mentions X1 in prose') ? 'x' : ''].filter(Boolean), false)
  must('reviewHasApprovedVerdict bold', [reviewHasApprovedVerdict('**Verdict: APPROVED**') ? '' : 'x'].filter(Boolean), false)
  must('reviewHasApprovedVerdict bold-colon-outside', [reviewHasApprovedVerdict('**Verdict:** APPROVED') ? '' : 'x'].filter(Boolean), false)
  must('reviewHasApprovedVerdict heading', [reviewHasApprovedVerdict('## Verdict: **APPROVED**') ? '' : 'x'].filter(Boolean), false)
  must('reviewHasApprovedVerdict not approved', [reviewHasApprovedVerdict('**Verdict: NOT APPROVED**') ? 'x' : ''].filter(Boolean), false)
  must('reviewHasApprovedVerdict changes requested', [reviewHasApprovedVerdict('**Verdict: CHANGES REQUESTED**') ? 'x' : ''].filter(Boolean), false)
  must('HUBS sections out of order', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('### Next\nd\n### Blockers\ne\n', '### Blockers\ne\n### Next\nd\n') }, okCtx), true)
  must('HUBS no Updated', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace(/\*\*Updated:\*\* \S+\n/, '') }, okCtx), true)
  must('HUBS stale Updated', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('2026-09-02', '2026-08-01') }, okCtx), true)
  must('HUBS stale Updated skipped on main', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('2026-09-02', '2026-08-01') }, { ...okCtx, currentBranch: 'main' }), false)
  must('HUBS over cap', checkHub({ ...goodHub, body: '# X1\n' + goodBlock + 'x\n'.repeat(CURRENT_STATE_MAX_LINES) }, okCtx), true)
  must('HUBS parked w/o revisit', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'parked' } }, okCtx), true)
  must('HUBS parked ok', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'parked' }, body: goodHub.body + '\n**Revisit when:** later\n' }, okCtx), false)
  must('HUBS bad adr', checkHub(goodHub, { ...okCtx, adrExists: () => false }), true)
  // ADR 0186 D3: in_progress/gated needs `progress:` resolving to a record with `## Session log`
  // whose dated subsections are non-decreasing.
  must('HUBS gated missing progress', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'gated', progress: null } }, okCtx), true)
  must('HUBS in_progress missing progress', checkHub({ ...goodHub, fm: { ...goodHub.fm, progress: null } }, okCtx), true)
  must('HUBS progress record has no Session log', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'gated' } }, { ...okCtx, readRel: () => '## Some other heading\ntext\n' }), true)
  must(
    'HUBS progress record dates out of order',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'gated' } }, { ...okCtx, readRel: () => '## Session log\n\n### 2026-09-05 — a\n\nx\n\n### 2026-09-01 — b\n\ny\n' }),
    true,
  )
  must(
    'HUBS progress record dates non-decreasing ok',
    checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'gated' } }, { ...okCtx, readRel: () => '## Session log\n\n### 2026-09-01 — a\n\nx\n\n### 2026-09-05 — b\n\ny\n' }),
    false,
  )
  must('sessionLogEntries no heading', [sessionLogEntries('# X\nno log here\n') === null ? '' : 'x'].filter(Boolean), false)
  must('sessionLogEntries stops at next ## heading', [sessionLogEntries('## Session log\n### 2026-09-01 — a\n## Other\n### 2020-01-01 — b\n').length === 1 ? '' : 'x'].filter(Boolean), false)
  must('isoDateOf Date', [isoDateOf(new Date('2026-09-17T00:00:00.000Z')) === '2026-09-17' ? '' : 'x'].filter(Boolean), false)
  must('isoDateOf string', [isoDateOf('2026-09-17') === '2026-09-17' ? '' : 'x'].filter(Boolean), false)
  must('isoDateOf other', [isoDateOf(42) === null ? '' : 'x'].filter(Boolean), false)
  must('HUBS unparsed', checkHub({ file: 'docs/features/x1.md', fm: null, body: '', error: 'frontmatter does not parse' }, okCtx), true)

  const reg = new Set(['AE4', 'DM5'])
  const newRow = (id, opened) => ({ cells: { ID: id, Opened: opened }, line: 1 })
  const newFup = (id, filed) => ({ id, fields: `**Filed:** ${filed} (x)`, line: 1 })
  must('CODES good', checkCodes({ bugRows: [newRow('BUG-AE4-A', '2026-09-05'), newRow('BUG-ZZZ-B', '2026-01-01')], fupEntries: [newFup('FUP-DM5-A', '2026-09-05')], registered: reg, legacyRows: 1 }), false)
  must('CODES bad bug', checkCodes({ bugRows: [newRow('BUG-ZZZ-A', '2026-09-05')], fupEntries: [], registered: reg, legacyRows: 1 }), true)
  must('CODES bad fup', checkCodes({ bugRows: [], fupEntries: [newFup('FUP-ZZZ-A', '2026-09-05')], registered: reg, legacyRows: 1 }), true)
  must('CODES no legend', checkCodes({ bugRows: [], fupEntries: [], registered: reg, legacyRows: 0 }), true)
  const regMulti = new Set(['C2-TIER1', 'C2'])
  must('CODES multi-segment hub id', checkCodes({ bugRows: [newRow('BUG-C2-TIER1-A', '2026-09-05')], fupEntries: [], registered: new Set(['C2-TIER1']), legacyRows: 1 }), false)
  must('CODES multi-segment not a prefix', checkCodes({ bugRows: [newRow('BUG-C2-A', '2026-09-05')], fupEntries: [], registered: new Set(['C2-TIER1']), legacyRows: 1 }), true)
  must('codeOf longest wins', [codeOf('FUP-C2-TIER1-X', regMulti) === 'C2-TIER1' ? '' : 'x'].filter(Boolean), false)

  const bugsHdr = `| ${BUG_COLUMNS.join(' | ')} |\n|${'---|'.repeat(BUG_COLUMNS.length)}\n`
  const bugRow = (o = {}) => {
    const c = { ID: 'BUG-X-ONE', Status: 'fixed', Severity: 'high', Area: 'x', Description: 'd', Opened: '2026-09-05', Closed: '2026-09-06', Related: 'X', Doc: '—', ...o }
    return `| ${BUG_COLUMNS.map((k) => c[k]).join(' | ')} |\n`
  }
  const bugsCtx = { ...okCtx, bugDocFiles: [] }
  must('BUGS good', checkBugs(parseTable(bugsHdr + bugRow()), bugsCtx).findings, false)
  must('BUGS bad columns', checkBugs(parseTable('| ID | Status |\n|---|---|\n| a | b |\n'), bugsCtx).findings, true)
  must('BUGS dup id', checkBugs(parseTable(bugsHdr + bugRow() + bugRow()), bugsCtx).findings, true)
  must('BUGS bad status', checkBugs(parseTable(bugsHdr + bugRow({ Status: 'closed' })), bugsCtx).findings, true)
  must('BUGS bad severity', checkBugs(parseTable(bugsHdr + bugRow({ Severity: 'MAJOR' })), bugsCtx).findings, true)
  must('BUGS unrated new', checkBugs(parseTable(bugsHdr + bugRow({ Severity: 'unrated' })), bugsCtx).findings, true)
  must('BUGS unrated legacy ok', checkBugs(parseTable(bugsHdr + bugRow({ Severity: 'unrated', Opened: '2026-01-01', Closed: '—' })), bugsCtx).findings, false)
  must('BUGS closed while open', checkBugs(parseTable(bugsHdr + bugRow({ Status: 'open' })), bugsCtx).findings, true)
  must('BUGS no closed date', checkBugs(parseTable(bugsHdr + bugRow({ Closed: '—' })), bugsCtx).findings, true)
  must('BUGS doc missing', checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](BUG-X-ONE.md)' })), { ...bugsCtx, exists: () => false }).findings, true)
  must('BUGS doc empty root cause', checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](BUG-X-ONE.md)' })), { ...bugsCtx, readRel: () => '## Root cause\n\n## Regression protection\nx\n' }).findings, true)
  must('BUGS doc ok', checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](BUG-X-ONE.md)' })), bugsCtx).findings, false)
  must('BUGS orphan doc', checkBugs(parseTable(bugsHdr + bugRow()), { ...bugsCtx, bugDocFiles: ['BUG-X-TWO.md'] }).findings, true)

  // Doc → archive.md#<slug> (plan 5.7): the completeness check does not apply there (archive.md
  // is free-form history with no Root-cause/Regression-protection headings); the anchor itself
  // must resolve instead.
  const archiveCtx = { ...bugsCtx, readRel: () => '## Some Finding, Corrected\n\nprose\n' }
  must(
    'BUGS archive link good anchor ok',
    checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](archive.md#some-finding-corrected)' })), archiveCtx).findings,
    false,
  )
  must(
    'BUGS archive link bad anchor reds',
    checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](archive.md#no-such-heading)' })), archiveCtx).findings,
    true,
  )
  must(
    'BUGS unrecognized doc form reds',
    checkBugs(parseTable(bugsHdr + bugRow({ Doc: '[d](../other/whatever.md)' })), bugsCtx).findings,
    true,
  )
  must('githubSlug basic', [githubSlug('Some Finding, Corrected') === 'some-finding-corrected' ? '' : 'x'].filter(Boolean), false)
  must('githubSlug keeps consecutive dashes', [githubSlug('A -- B') === 'a----b' ? '' : 'x'].filter(Boolean), false)
  must('anchorExistsInArchive found', [anchorExistsInArchive('## A Thing\n', 'a-thing') ? '' : 'x'].filter(Boolean), false)
  must('anchorExistsInArchive not found', [anchorExistsInArchive('## A Thing\n', 'nope') ? 'x' : ''].filter(Boolean), false)
  must('BUGS untriaged warns', [checkBugs(parseTable(bugsHdr + bugRow({ Status: 'untriaged', Closed: '—' })), bugsCtx).counts.untriaged === 1 ? 'x' : ''].filter(Boolean), true)

  // ── FOLLOWUPS (ADR 0186 D4 — the register is an index; deferred-backlog.md is gone) ───────
  const fupOk =
    '### 🟠 FUP-X-A — claim\n\n**Filed:** 2026-09-01 (x) · **Owner:** lead · **Severity:** high — why\n**Closes when:** done\n**Status:** open\n\nbody\n'
  // Every fixture below passes an EMPTY pin (`criticalIds: []`) so the only red is the property
  // under test — with the pin required, a fixture that omits it reds for the pin and proves nothing.
  must('FOLLOWUPS good', checkFollowups({ open: fupOk, criticalIds: [] }).findings, false)
  must('FOLLOWUPS pin required', checkFollowups({ open: fupOk, criticalIds: null }).findings, CRITICAL_PIN_REQUIRED)
  must('FOLLOWUPS no Filed', checkFollowups({ open: fupOk.replace('**Filed:** 2026-09-01 (x) · ', ''), criticalIds: [] }).findings, true)
  must('FOLLOWUPS bad date', checkFollowups({ open: fupOk.replace('2026-09-01', 'Sept 1'), criticalIds: [] }).findings, true)
  must('FOLLOWUPS no Closes', checkFollowups({ open: fupOk.replace('**Closes when:** done\n', ''), criticalIds: [] }).findings, true)
  must('FOLLOWUPS PO to rule counted', [checkFollowups({ open: fupOk.replace('done', 'PO to rule'), criticalIds: [] }).counts.poToRule === 1 ? 'x' : ''].filter(Boolean), true)
  must('FOLLOWUPS empty register', checkFollowups({ open: '', criticalIds: [] }).findings, true)
  must('FOLLOWUPS critical orphan', checkFollowups({ open: fupOk, criticalIds: ['FUP-X-NOPE'] }).findings, true)
  must('FOLLOWUPS critical ok', checkFollowups({ open: fupOk, criticalIds: ['FUP-X-A'] }).findings, false)
  must('criticalIdsOf absent', [criticalIdsOf(fupOk) === null ? '' : 'x'].filter(Boolean), false)
  must('criticalIdsOf present', criticalIdsOf('## ⭐⭐ Critical\n| **C1** | 🔒 **`FUP-X-A`** — x, see `FUP-X-MENTION` | do | now | PO |\n## Other\n| **C9** | **FUP-X-B** |\n').join() === 'FUP-X-A' ? [] : ['wrong'], false)
  must('criticalIdsOf ignores prose mentions', criticalIdsOf('## ⭐⭐ Critical\n| **C1** | 🔒 **`FUP-X-A`** — resolved `FUP-X-OLD` and FUP-X-OLD2 | do | now | PO |\n').join() === 'FUP-X-A' ? [] : ['wrong'], false)

  // Owner (ADR 0186 D4 closed vocabulary) — direct checkOwnerValue, then through the entry.
  must('checkOwnerValue single ok', [checkOwnerValue('lead')].filter(Boolean), false)
  must('checkOwnerValue pair in order ok', [checkOwnerValue('backend + frontend')].filter(Boolean), false)
  must('checkOwnerValue wrong order reds', [checkOwnerValue('frontend + backend')].filter(Boolean), true)
  must('checkOwnerValue old slash separator reds', [checkOwnerValue('backend/PO')].filter(Boolean), true)
  must('checkOwnerValue duplicate reds', [checkOwnerValue('lead + lead')].filter(Boolean), true)
  must('checkOwnerValue not in vocabulary reds', [checkOwnerValue('Backend Team')].filter(Boolean), true)
  must('checkOwnerValue trailing period reds', [checkOwnerValue('lead.')].filter(Boolean), true)
  must('checkOwnerValue empty reds', [checkOwnerValue('')].filter(Boolean), true)
  must('FOLLOWUPS owner old slash separator reds', checkFollowups({ open: fupOk.replace('**Owner:** lead', '**Owner:** backend/PO'), criticalIds: [] }).findings, true)
  must('FOLLOWUPS owner valid pair ok', checkFollowups({ open: fupOk.replace('**Owner:** lead', '**Owner:** backend + frontend'), criticalIds: [] }).findings, false)
  must('FOLLOWUPS no Owner', checkFollowups({ open: fupOk.replace('**Owner:** lead · ', ''), criticalIds: [] }).findings, true)

  // Severity: the five-level scale, the legacy `unrated` exception, and the emoji match.
  must('FOLLOWUPS no Severity', checkFollowups({ open: fupOk.replace('**Severity:** high — why', ''), criticalIds: [] }).findings, true)
  must('FOLLOWUPS bad severity', checkFollowups({ open: fupOk.replace('high', 'MAJOR'), criticalIds: [] }).findings, true)
  must('FOLLOWUPS emoji mismatch', checkFollowups({ open: fupOk.replace('🟠', '🔴'), criticalIds: [] }).findings, true)
  must('FOLLOWUPS resolved-retained keeps ⬛', checkFollowups({ open: fupOk.replace('🟠', '⬛') + '\n**Retained** as a review lens\n', criticalIds: [] }).findings, false)
  const fupUnratedNew =
    '### ⚪ FUP-X-B — claim\n\n**Filed:** 2026-09-10 (x) · **Owner:** lead · **Severity:** unrated\n**Closes when:** done\n**Status:** open\n\nbody\n'
  const fupUnratedLegacy =
    '### ⚪ FUP-X-C — claim\n\n**Filed:** 2026-08-01 (x) · **Owner:** lead · **Severity:** unrated\n**Closes when:** done\n**Status:** open\n\nbody\n'
  must('FOLLOWUPS unrated after watermark reds', checkFollowups({ open: fupUnratedNew, criticalIds: [] }).findings, true)
  must('FOLLOWUPS unrated before watermark ok', checkFollowups({ open: fupUnratedLegacy, criticalIds: [] }).findings, false)
  must('FOLLOWUPS unrated counted', [checkFollowups({ open: fupUnratedLegacy, criticalIds: [] }).counts.severityUnrated === 1 ? 'x' : ''].filter(Boolean), true)
  must('FOLLOWUPS unrated wrong emoji reds', checkFollowups({ open: fupUnratedLegacy.replace('⚪', '🟢'), criticalIds: [] }).findings, true)
  must(
    'FOLLOWUPS severity-per-emoji counted',
    [checkFollowups({ open: fupOk.replace('**Severity:** high — why', '**Severity:** high — per emoji at consolidation'), criticalIds: [] }).counts.severityPerEmoji === 1 ? 'x' : ''].filter(Boolean),
    true,
  )

  // Status (ADR 0186 D4): required on every entry; parked needs a non-empty Revisit when; the
  // old bare `**Parked**` marker is no longer the signal.
  must('FOLLOWUPS status missing reds', checkFollowups({ open: fupOk.replace('**Status:** open\n', ''), criticalIds: [] }).findings, true)
  must('FOLLOWUPS status invalid value reds', checkFollowups({ open: fupOk.replace('**Status:** open', '**Status:** unknown'), criticalIds: [] }).findings, true)
  must('FOLLOWUPS status parked without revisit reds', checkFollowups({ open: fupOk.replace('**Status:** open', '**Status:** parked'), criticalIds: [] }).findings, true)
  must(
    'FOLLOWUPS status parked with revisit ok',
    checkFollowups({ open: fupOk.replace('**Status:** open', '**Status:** parked\n**Revisit when:** phase 20'), criticalIds: [] }).findings,
    false,
  )
  must(
    'FOLLOWUPS revisit-when po-to-rule counted',
    [
      checkFollowups({ open: fupOk.replace('**Status:** open', '**Status:** parked\n**Revisit when:** PO to rule'), criticalIds: [] }).counts.revisitWhenPoToRule === 1
        ? 'x'
        : '',
    ].filter(Boolean),
    true,
  )
  must('FOLLOWUPS old Parked marker without Status parked reds', checkFollowups({ open: fupOk + '\n**Parked** since x\n', criticalIds: [] }).findings, true)
  must(
    'FOLLOWUPS old Parked marker WITH Status parked does not double-flag',
    checkFollowups({ open: fupOk.replace('**Status:** open', '**Status:** parked\n**Revisit when:** later') + '\n**Parked** since x\n', criticalIds: [] }).findings,
    false,
  )

  // Entry shape (ADR 0186 D4 / plan 5.1): ≤ 20 lines, no nested `##`/`####` heading.
  const fupLong =
    '### 🟢 FUP-LONG-1 — claim\n\n**Filed:** 2026-08-01 (x) · **Owner:** lead · **Severity:** low\n**Closes when:** done\n**Status:** open\n\n' +
    'line\n'.repeat(25)
  must('FOLLOWUPS entry too long reds', checkFollowups({ open: fupLong, criticalIds: [] }).findings, true)
  must('checkFollowupEntryShape too long reds', checkFollowupEntryShape(fupEntriesOf(fupLong)[0]).findings, true)
  must('checkFollowupEntryShape short ok', checkFollowupEntryShape(fupEntriesOf(fupOk)[0]).findings, false)
  const fupNestedH2 =
    '### 🟢 FUP-NEST-1 — claim\n\n**Filed:** 2026-08-01 (x) · **Owner:** lead · **Severity:** low\n**Closes when:** done\n**Status:** open\n\n## Nested\nbody\n'
  const fupNestedH4 = fupNestedH2.replace('## Nested', '#### Nested')
  must('FOLLOWUPS nested h2 heading reds', checkFollowups({ open: fupNestedH2, criticalIds: [] }).findings, true)
  must('FOLLOWUPS nested h4 heading reds', checkFollowups({ open: fupNestedH4, criticalIds: [] }).findings, true)
  must('checkFollowupEntryShape nested h2 reds', checkFollowupEntryShape(fupEntriesOf(fupNestedH2)[0]).findings, true)
  const fupHeadingLong = fupOk.replace('FUP-X-A — claim', 'FUP-X-A — ' + 'x'.repeat(FOLLOWUP_MAX_HEADING_CHARS + 1))
  must(
    'checkFollowupEntryShape long heading is a RATCHET count, not a finding',
    checkFollowupEntryShape(fupEntriesOf(fupHeadingLong)[0]).findings,
    false,
  )
  must('checkFollowupEntryShape long heading counted', checkFollowupEntryShape(fupEntriesOf(fupHeadingLong)[0]).longHeadings === 1 ? [] : ['wrong'], false)

  // `**Register line**` is forbidden outright (ADR 0186 D4).
  must('checkNoRegisterLineMarker green', checkNoRegisterLineMarker(fupOk), false)
  must('checkNoRegisterLineMarker reds', checkNoRegisterLineMarker(fupOk + '\n**Register line** (folded in from PROGRESS.md)\n'), true)
  must('FOLLOWUPS Register line forbidden reds', checkFollowups({ open: fupOk + '\n**Register line** (folded in from PROGRESS.md)\n', criticalIds: [] }).findings, true)

  // Critical pin row length (plan 5.6): id · trigger · deadline · owner, ≤ 300 chars, no narrative.
  const criticalShort = '## ⭐⭐ Critical\n\n| # | item | trigger | owner |\n|---|---|---|---|\n| **C1** | 🔒 **`FUP-X-A`** | now | PO |\n\n' + fupOk
  const criticalLong = criticalShort.replace('| **C1** | 🔒 **`FUP-X-A`** | now | PO |', '| **C1** | ' + 'x'.repeat(310) + ' | now | PO |')
  must('checkCriticalPinRowLength short ok', checkCriticalPinRowLength(criticalShort), false)
  must('checkCriticalPinRowLength long reds', checkCriticalPinRowLength(criticalLong), true)
  must('FOLLOWUPS critical pin row too long reds', checkFollowups({ open: criticalLong, criticalIds: ['FUP-X-A'] }).findings, true)

  // `**Body:**` orphans, BOTH ways (ADR 0186 D4).
  const fupWithBody =
    '### 🟢 FUP-BODY-1 — claim\n\n**Filed:** 2026-08-01 (x) · **Owner:** lead · **Severity:** low\n**Closes when:** done\n**Status:** open · **Body:** [FUP-BODY-1.md](FUP-BODY-1.md)\n\nsee body\n'
  must('checkFollowupBodies linked ok', checkFollowupBodies(fupEntriesOf(fupWithBody), ['FUP-BODY-1.md']), false)
  must('checkFollowupBodies link with no file reds', checkFollowupBodies(fupEntriesOf(fupWithBody), []), true)
  must('checkFollowupBodies unlinked file reds', checkFollowupBodies(fupEntriesOf(fupWithBody), ['FUP-BODY-1.md', 'FUP-ORPHAN-2.md']), true)
  must('FOLLOWUPS body link with no file reds', checkFollowups({ open: fupWithBody, criticalIds: [], bodyFiles: [] }).findings, true)
  must('FOLLOWUPS body linked ok', checkFollowups({ open: fupWithBody, criticalIds: [], bodyFiles: ['FUP-BODY-1.md'] }).findings, false)

  // ADR 0185 D5 / plan Wave 6 "also": the ARCHIVE may not carry a `**Body:**` link — a resolved
  // entry's body lives INLINE there, not behind a pointer to a separate file.
  must('checkArchiveNoBodyLink clean archive ok', checkArchiveNoBodyLink('### ⬛ FUP-X-1 — done\n\nbody lives right here\n'), false)
  must(
    'checkArchiveNoBodyLink reds on a Body link',
    checkArchiveNoBodyLink('### ⬛ FUP-X-1 — done\n\n**Status:** open · **Body:** [FUP-X-1.md](FUP-X-1.md)\n\nsee body\n'),
    true,
  )

  // RATCHETS (ADR 0186 D6): a live count over its constant reds; Infinity never fires.
  must('checkRatchets exceeded reds', checkRatchets({ x: 5 }, { x: 3 }), true)
  must('checkRatchets under cap ok', checkRatchets({ x: 2 }, { x: 3 }), false)
  must('checkRatchets equal to cap ok (not RAISED)', checkRatchets({ x: 3 }, { x: 3 }), false)
  must('checkRatchets infinity cap never fires', checkRatchets({ x: 999999 }, { x: Infinity }), false)

  const lesHdr = `| ${LESSON_COLUMNS.join(' | ')} |\n|${'---|'.repeat(LESSON_COLUMNS.length)}\n`
  const lesRow = (o = {}) => {
    const c = { ID: 'LEARN-001', Area: 'a', Lesson: 'l', Origin: 'ADR 0079', Enforcement: 'lint:progress, ARM=census', ...o }
    return `| ${LESSON_COLUMNS.map((k) => c[k]).join(' | ')} |\n`
  }
  must('LESSONS good', checkLessons(parseTable(lesHdr + lesRow()), okCtx).findings, false)
  must('LESSONS prose only ok', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: 'prose only' })), okCtx).findings, false)
  must('LESSONS bad columns', checkLessons(parseTable('| ID |\n|---|\n| a |\n'), okCtx).findings, true)
  must('LESSONS bad id', checkLessons(parseTable(lesHdr + lesRow({ ID: 'L1' })), okCtx).findings, true)
  must('LESSONS dup id', checkLessons(parseTable(lesHdr + lesRow() + lesRow()), okCtx).findings, true)
  must('LESSONS bad origin adr', checkLessons(parseTable(lesHdr + lesRow()), { ...okCtx, adrExists: () => false }).findings, true)
  must('LESSONS unresolved fup origin', checkLessons(parseTable(lesHdr + lesRow({ Origin: 'FUP-NOPE-X' })), { ...okCtx, fupExists: () => false }).findings, true)
  must('LESSONS unknown lint', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: 'lint:nope' })), okCtx).findings, true)
  must('LESSONS unknown arm', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: 'ARM=laser' })), okCtx).findings, true)
  must('LESSONS empty enforcement', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: '' })), okCtx).findings, true)
  must('LESSONS path missing', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: '`supabase/tests/999.sql`' })), { ...okCtx, globExists: () => false }).findings, true)
  must('LESSONS garbage token', checkLessons(parseTable(lesHdr + lesRow({ Enforcement: 'the reviewer' })), okCtx).findings, true)
  must('LESSONS bad sha', checkLessons(parseTable(lesHdr + lesRow({ Origin: 'abc1234' })), { ...okCtx, shaExists: () => false }).findings, true)
  must('LESSONS path with anchor ok', checkLessons(parseTable(lesHdr + lesRow({ Origin: '`docs/x.md#7.1`' })), okCtx).findings, false)
  must('splitTokens', splitTokens('ADR 0079, `a/b.md` (pgTAP), lint:x').join('|') === 'ADR 0079|`a/b.md`|lint:x' ? [] : ['wrong'], false)

  const pm = POSTMORTEM_SECTIONS.map((s) => `## ${s}\ntext\n`).join('')
  must('POSTMORT good', checkPostmortems([{ name: 'LEARN-001-x.md', text: pm }], new Set(['LEARN-001'])), false)
  must('POSTMORT empty section', checkPostmortems([{ name: 'LEARN-001-x.md', text: pm.replace('## New rule\ntext\n', '## New rule\n\n') }], new Set(['LEARN-001'])), true)
  must('POSTMORT missing section', checkPostmortems([{ name: 'LEARN-001-x.md', text: pm.replace('## Applies to\ntext\n', '') }], new Set(['LEARN-001'])), true)
  must('POSTMORT no row', checkPostmortems([{ name: 'LEARN-001-x.md', text: pm }], new Set()), true)
  must('POSTMORT bad name', checkPostmortems([{ name: 'storage-incident.md', text: pm }], new Set(['LEARN-001'])), true)

  const HO_TODAY = '2026-09-10'
  const ho = { name: 'a.md', bytes: 100, fm: { branch: 'feat-a' } }
  must('HANDOFFS good', checkHandoffs([ho], ['feat-a'], [{ handoff: 'a.md', file: 'docs/features/x.md', line: 1 }], HO_TODAY), false)
  must('HANDOFFS too big', checkHandoffs([{ ...ho, bytes: HANDOFF_MAX_BYTES + 1 }], ['feat-a'], [], HO_TODAY), true)
  must('HANDOFFS branch gone', checkHandoffs([ho], ['main'], [], HO_TODAY), true)
  must('HANDOFFS cited', checkHandoffs([ho], ['feat-a'], [{ handoff: 'a.md', file: 'docs/progress/x.md', line: 3 }], HO_TODAY), true)
  // ADR 0186 D3: branch OR expires is mandatory; expires must be an ISO date, not already past.
  must('HANDOFFS neither branch nor expires', checkHandoffs([{ name: 'b.md', bytes: 100, fm: {} }], ['feat-a'], [], HO_TODAY), true)
  must('HANDOFFS no frontmatter at all', checkHandoffs([{ name: 'b.md', bytes: 100, fm: null }], ['feat-a'], [], HO_TODAY), true)
  must('HANDOFFS expires in the past', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: '2026-01-01' } }], ['feat-a'], [], HO_TODAY), true)
  must('HANDOFFS expires today is not past', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: HO_TODAY } }], ['feat-a'], [], HO_TODAY), false)
  must('HANDOFFS expires in the future ok', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: '2026-12-31' } }], ['feat-a'], [], HO_TODAY), false)
  must('HANDOFFS expires malformed string', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: 'soon' } }], ['feat-a'], [], HO_TODAY), true)
  // js-yaml auto-boxes a bare `expires: 2026-12-31` scalar into a Date — must be honored, not
  // misread as malformed just because it isn't a plain string at parse time.
  must('HANDOFFS expires as YAML Date object, future, ok', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: new Date('2026-12-31T00:00:00.000Z') } }], ['feat-a'], [], HO_TODAY), false)
  must('HANDOFFS expires as YAML Date object, past, reds', checkHandoffs([{ name: 'b.md', bytes: 100, fm: { expires: new Date('2026-01-01T00:00:00.000Z') } }], ['feat-a'], [], HO_TODAY), true)

  must('LINKS good', checkLinks('docs/x.md', '[a](../README.md)', () => true), false)
  must('LINKS bad', checkLinks('docs/x.md', '[a](nope.md)', () => false), true)
  // ADR 0186 D8 / plan 6.3: this fixture CHANGED. Before the merge a bare `#anchor` link was
  // skipped outright (no anchor checker existed here), so `[b](#h)` with no `# H` heading in
  // the fixture text was silently ignored. The unified checker adds gate 7's anchor check, so
  // the union is STRICTER — a heading now has to actually back the anchor for this to stay
  // green, which is the behavior gate 7 already had and gate 13 is adopting.
  must('LINKS ignores http', checkLinks('docs/x.md', '# H\n[a](https://x) [b](#h)', () => false), false)
  must('LINKS extension filter skips a non-file target', checkLinks('docs/x.md', '[a](some-directory)', () => false), false)
  must('LINKS anchor resolves', checkLinks('docs/x.md', '# My Title\n[a](#my-title)', () => true), false)
  must('LINKS anchor does not resolve', checkLinks('docs/x.md', '# My Title\n[a](#nope)', () => true), true)
  must('LINKS code span is a mention, not a link', checkLinks('docs/x.md', 'prose `](docs/gone.md)` about links', () => false), false)

  must('INDEX good', checkDocsIndex('decisions/ and backend-state.md', ['decisions', 'backend-state.md', 'INDEX.md']), false)
  must('INDEX unmapped', checkDocsIndex('decisions/', ['decisions', 'newdir']), true)
  must('INDEX missing', checkDocsIndex(null, ['decisions']), true)

  must('parseFrontmatter bad yaml', [parseFrontmatter('---\na: [\n---\nbody').error || ''].filter(Boolean), true)
  must('parseFrontmatter ok', [parseFrontmatter('---\na: 1\n---\nbody').fm?.a === 1 ? '' : 'x'].filter(Boolean), false)
  must('parseTable escaped pipe', [parseTable('| A | B |\n|---|---|\n| x \\| y | z |\n').rows[0].cells.A === 'x | y' ? '' : 'x'].filter(Boolean), false)
  // A legend table before the register must not be mistaken for it (BUGS.md opens with the severity scale).
  const twoTables = '| Level | Emoji |\n|---|---|\n| high | 🟠 |\n\n| ID | Status |\n|---|---|\n| BUG-X-1 | open |\n'
  must('parseTable by header', [parseTable(twoTables, REGISTER_HEADER_RX)?.columns.join() === 'ID,Status' ? '' : 'x'].filter(Boolean), false)
  must('parseTable first by default', [parseTable(twoTables)?.columns.join() === 'Level,Emoji' ? '' : 'x'].filter(Boolean), false)
  must('parseTable header absent', [parseTable(twoTables, /^\|\s*Nope\s*\|/) === null ? '' : 'x'].filter(Boolean), false)
  must('hubSlug', [hubSlug('C2-TIER1') === 'c2-tier1' && hubSlug('AE4') === 'ae4' ? '' : 'x'].filter(Boolean), false)

  // ADR 0186 D8 / plan 6.7: subject-count helpers, each with its own fixture instead of being
  // asserted only by the live run.
  must('countLedgerDataRows counts data rows only', [countLedgerDataRows('| H1 | H2 |\n|---|---|\n| a | b |\n| c | d |\n') === 2 ? '' : 'x'].filter(Boolean), false)
  must('countLedgerDataRows empty text is zero rows', [countLedgerDataRows('') === 0 ? '' : 'x'].filter(Boolean), false)
  must('isHandoffFile excludes the README placeholder', [isHandoffFile('README.md') ? 'x' : ''].filter(Boolean), false)
  must('isHandoffFile includes a handoff', [isHandoffFile('some-branch.md') ? '' : 'x'].filter(Boolean), false)
  must('isHandoffFile excludes a non-Markdown file', [isHandoffFile('notes.txt') ? 'x' : ''].filter(Boolean), false)

  // RETIRED — a citation must red; the same text quoted (code span or fence) must not.
  must('RETIRED bare § Now reds', checkRetired('x.md', 'See § Now for details.\n'), true)
  must('RETIRED prefixed § Now reds', checkRetired('x.md', 'PROGRESS.md § Now used to hold this.\n'), true)
  must('RETIRED code span is a mention, not a citation', checkRetired('x.md', 'See `§ Now` for details.\n'), false)
  must('RETIRED fenced block is a mention, not a citation', checkRetired('x.md', 'text\n```\n§ Now\n```\nmore\n'), false)
  must('RETIRED prefixed § Decisions reds', checkRetired('x.md', 'See PROGRESS.md § Decisions for rules.\n'), true)
  must('RETIRED bare § Decisions does not red (ambiguous)', checkRetired('x.md', 'See § Decisions for rules.\n'), false)
  must('RETIRED bare § Follow-ups does not red (ambiguous)', checkRetired('x.md', 'See § Follow-ups for rules.\n'), false)
  must('RETIRED line number survives blanking', [checkRetired('x.md', '`x`\n`y`\n§ Now\n')[0]?.startsWith('[RETIRED] x.md:3') ? '' : 'x'].filter(Boolean), false)
  must('inRetiredDomain excludes CLAUDE.md', [inRetiredDomain(RETIRED_EXCLUDE_CLAUDE_MD) ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain excludes docs/decisions', [inRetiredDomain('docs/decisions/0001-x.md') ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain excludes docs/progress', [inRetiredDomain('docs/progress/2026-Q3.md') ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain excludes docs/reviews', [inRetiredDomain('docs/reviews/phase-9-review.md') ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain excludes docs/design/temp', [inRetiredDomain('docs/design/temp/x.md') ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain excludes named historical files', [inRetiredDomain('docs/bugs/archive.md') || inRetiredDomain('docs/followups/follow-ups-archive.md') || inRetiredDomain('.claude/claude-md-review-queue.md') ? 'x' : ''].filter(Boolean), false)
  must('inRetiredDomain includes a living hub', [inRetiredDomain('docs/features/x1.md') ? '' : 'x'].filter(Boolean), false)

  if (fails.length) {
    console.error('check-docs-registers: SELF-TEST FAILED — a checker that cannot red is not a gate:')
    for (const f of fails) console.error('  ' + f)
    process.exit(2)
  }
  return true
}

// ─── main ────────────────────────────────────────────────────────────────────────────────

function main() {
  selfTest()
  if (process.argv.includes('--self-test')) {
    console.log('check-docs-registers: self-test OK')
    return
  }
  const ctx = buildCtx()
  const F = []
  const W = []
  const allMd = walkMd('.')

  // HUBS + CODES
  const hubs = listHubs()
  if (!hubs.length) F.push(`[HUBS] ${PATHS.featuresDir} — no hubs found; ADR 0185 D1 requires one per unit in flight`)
  for (const h of hubs) F.push(...checkHub(h, ctx))
  // Distinct progress records a hub's `progress:` resolves to (ADR 0186 D3 subject count).
  const recordsChecked = new Set(hubs.filter((h) => h.fm?.progress && ctx.exists(join(PATHS.featuresDir, h.fm.progress))).map((h) => join(PATHS.featuresDir, h.fm.progress))).size
  const ids = hubs.filter((h) => h.fm?.id).map((h) => String(h.fm.id))
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  for (const d of new Set(dup)) F.push(`[HUBS] duplicate hub id ${d}`)
  const legacy = parseTable(read(PATHS.legacyCodes) || '', LEGEND_HEADER_RX)
  const registered = new Set([...ids, ...(legacy?.rows || []).map((r) => r.raw[0].replace(/`/g, '').trim())])
  F.push(...checkCodes({ bugRows: ctx.bugsTable?.rows || [], fupEntries: fupEntriesOf(read(PATHS.fupOpen) || ''), registered, legacyRows: legacy?.rows.length || 0 }))

  // BUGS
  const bugs = checkBugs(ctx.bugsTable, ctx)
  F.push(...bugs.findings)
  W.push(...bugs.warnings)

  // FOLLOWUPS
  const open = read(PATHS.fupOpen)
  if (open == null) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — missing`)
  const fupBodyFiles = existsSync(join(ROOT, PATHS.followupsDir))
    ? readdirSync(join(ROOT, PATHS.followupsDir)).filter((f) => /^FUP-.*\.md$/.test(f))
    : []
  let fupCount = 0
  let fu = { counts: { poToRule: 0, severityPerEmoji: 0, severityUnrated: 0, revisitWhenPoToRule: 0, longHeadings: 0 } }
  if (open != null) {
    fu = checkFollowups({ open, criticalIds: criticalIdsOf(open), bodyFiles: fupBodyFiles })
    F.push(...fu.findings)
    W.push(...fu.warnings)
    fupCount = fupEntriesOf(open).length
  }
  const archiveText = read(PATHS.fupArchive)
  if (archiveText != null) F.push(...checkArchiveNoBodyLink(archiveText))

  // LESSONS + POSTMORTEMS
  const lessonsText = read(PATHS.lessons)
  if (lessonsText == null) F.push(`[LESSONS] ${PATHS.lessons} — missing`)
  const les = checkLessons(lessonsText == null ? null : parseTable(lessonsText, REGISTER_HEADER_RX), ctx)
  F.push(...les.findings)
  W.push(...les.warnings)
  if (!exists(`${PATHS.postmortemsDir}/README.md`)) F.push(`[POSTMORT] ${PATHS.postmortemsDir}/README.md — missing (the template lives there)`)
  const pmFiles = existsSync(join(ROOT, PATHS.postmortemsDir))
    ? readdirSync(join(ROOT, PATHS.postmortemsDir))
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .map((f) => ({ name: f, text: read(`${PATHS.postmortemsDir}/${f}`) }))
    : []
  F.push(...checkPostmortems(pmFiles, les.ids))

  // HANDOFFS
  const hoFiles = existsSync(join(ROOT, PATHS.handoffsDir))
    ? readdirSync(join(ROOT, PATHS.handoffsDir))
        .filter(isHandoffFile)
        .map((f) => {
          const rel = `${PATHS.handoffsDir}/${f}`
          return { name: f, bytes: statSync(join(ROOT, rel)).size, fm: parseFrontmatter(read(rel)).fm }
        })
    : []
  const citations = []
  for (const h of hoFiles) {
    for (const f of allMd) {
      if (f.startsWith(PATHS.handoffsDir + '/')) continue
      const t = read(f)
      if (!t || !t.includes(h.name)) continue
      t.split('\n').forEach((l, i) => {
        if (l.includes(h.name)) citations.push({ handoff: h.name, file: f, line: i + 1 })
      })
    }
  }
  const todayIso = new Date().toISOString().slice(0, 10) // wall clock, like gate 9's proposed-review timer
  F.push(...checkHandoffs(hoFiles, ctx.branches, citations, todayIso))

  // LINKS over every file this gate owns
  const owned = [PATHS.docsIndex, PATHS.bugs, PATHS.lessons, PATHS.legacyCodes, PATHS.fupOpen, `${PATHS.postmortemsDir}/README.md`, `${PATHS.bugsDir}/README.md`]
    .concat(hubs.map((h) => h.file))
    .concat(ctx.bugDocFiles.map((f) => `${PATHS.bugsDir}/${f}`))
    .concat(pmFiles.map((p) => `${PATHS.postmortemsDir}/${p.name}`))
    .concat(fupBodyFiles.map((f) => `${PATHS.followupsDir}/${f}`))
  for (const f of owned) {
    const t = read(f)
    if (t != null) F.push(...checkLinks(f, t, exists))
  }

  // INDEX
  F.push(...checkDocsIndex(read(PATHS.docsIndex), readdirSync(join(ROOT, 'docs')).sort()))

  // RETIRED (ADR 0186 D8): citations of a PROGRESS.md section ADR 0185 D6 retired, in any
  // living Markdown file. Domain = every *.md `walkMd` finds, minus the historical/decision
  // paths and CLAUDE.md (see RETIRED_EXCLUDE_* above).
  const retiredFiles = allMd.filter(inRetiredDomain)
  for (const f of retiredFiles) {
    const t = read(f)
    if (t != null) F.push(...checkRetired(f, t))
  }

  // RATCHETS (ADR 0186 D6): counts that may only decrease, gathered from the arms above.
  const ratchetCounts = {
    closesWhenPoToRule: fu.counts.poToRule,
    severityPerEmoji: fu.counts.severityPerEmoji,
    severityUnrated: fu.counts.severityUnrated,
    revisitWhenPoToRule: fu.counts.revisitWhenPoToRule,
    longHeadings: fu.counts.longHeadings,
    bugsUntriaged: bugs.counts?.untriaged ?? 0,
    bugsUnrated: bugs.counts?.unrated ?? 0,
    lessonsProseOnly: les.counts?.prose ?? 0,
  }
  F.push(...checkRatchets(ratchetCounts))

  // ADR 0186 D8 / plan 6.7: the population the row-grade `complete` check (hubHasLedgerRow)
  // actually scans, printed on the OK line so a reader doesn't have to re-derive it.
  const ledgerRowsChecked = countLedgerDataRows(ctx.ledgerText)

  for (const w of W) console.log('check-docs-registers: WARN ' + w)
  if (F.length) {
    console.error(`check-docs-registers: ${F.length} finding(s)`)
    for (const f of F) console.error('  ' + f)
    process.exit(1)
  }
  const ratchetsLine = Object.entries(RATCHETS)
    .map(([name, cap]) => `${name}=${ratchetCounts[name]}/${cap === Infinity ? '∞' : cap}`)
    .join(' ')
  console.log(
    `check-docs-registers: OK (self-test + ${hubs.length} hubs, ${recordsChecked} records, ` +
      `${ledgerRowsChecked} ledger rows, ${ctx.bugsTable?.rows.length ?? 0} bugs, ${ctx.bugDocFiles.length} bug docs, ` +
      `${fupCount} follow-ups, ${fupBodyFiles.length} follow-up bodies, ${les.ids.size} lessons, ` +
      `${pmFiles.length} postmortems, ${hoFiles.length} handoffs, ${retiredFiles.length} md files scanned for retired citations)`,
  )
  console.log(`check-docs-registers: ratchets: ${ratchetsLine}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
