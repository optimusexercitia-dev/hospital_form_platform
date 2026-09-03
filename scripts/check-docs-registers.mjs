#!/usr/bin/env node
/**
 * lint:registers — the ADR 0185 documentation registers, enforced by machine.
 *
 * THE DEFECT CLASS. Every register in this tree that lacked a gate rotted: the PROGRESS.md
 * banner went stale about its own size (ADR 0124), rules described renamed symbols
 * (ADR 0127), a follow-up index drifted from its bodies in both directions (ADR 0140,
 * 0179). ADR 0185 adds five registers — feature hubs, CURRENT.md, BUGS.md, LESSONS.md and
 * postmortems — plus fields on the follow-up register and a handoff convention that had
 * "no gate" by its own admission. Its admission rule: NO register or field ships without
 * a gate that can red on it. This is that gate.
 *
 * ARMS (each proven able to fail by the self-test that runs first, every invocation):
 *   HUBS      docs/features/<slug>.md — YAML frontmatter with the required keys; id ↔ file
 *             name; status/kind enums; links + ADR numbers resolve; `in_progress` needs a
 *             branch that exists; the `## Current state` block (required for in_progress /
 *             gated, FORBIDDEN for complete) has the six sections in order, an `Updated`
 *             date, and ≤ 60 lines; `parked` carries `Revisit when`; `complete` has a
 *             phase-ledger row or an APPROVED review. When the current git branch IS the
 *             hub's branch, `Updated` may not be older than the newest commit touching
 *             src/ supabase/ e2e/ — "always maintained" is enforced, not asked for
 *             (skipped on main).
 *   CURRENT   docs/planning/CURRENT.md lists exactly the in_progress hubs, both ways.
 *   CODES     a new BUG-/FUP- id (opened/filed on or after CODE_WATERMARK) uses a code that
 *             is a hub id or a row in legacy-codes.md. ⛔ The watermark grandfathers the
 *             legacy prefixes (72 / 123 distinct); never bump it to pass — that flips the
 *             rot direction (the lint:set-local lesson).
 *   BUGS      docs/bugs/BUGS.md — exact columns; unique ids; status + severity enums
 *             (`unrated` only for legacy rows); Closed empty while open; Doc links resolve;
 *             every docs/bugs/BUG-*.md has a row; a fixed/verified bug with a document has
 *             non-empty Root cause + Regression protection.
 *   FOLLOWUPS every FUP entry carries Filed (date) · Owner · Severity (enum word, matching
 *             the heading emoji) · Closes when; a Parked entry carries Revisit when; every
 *             deferred-backlog entry carries Revisit when. `PO to rule` is a legal value and
 *             is COUNTED (it is the honest cell); an invented value is not detectable — the
 *             gate bounds presence, humans bound truth. The Critical pin (D5) is checked
 *             for orphans once CRITICAL_PIN_REQUIRED is on.
 *   LESSONS   docs/learning/LESSONS.md — exact columns; unique LEARN ids; Origin resolves
 *             (ADR / FUP / BUG / sha / path); Enforcement is `prose only` or tokens that
 *             each exist (lint:<script> in package.json, ARM=<arm>, a path, a rule file).
 *   POSTMORT  docs/learning/postmortems/LEARN-*.md — nine sections, all non-empty, and a
 *             LESSONS row with the same id.
 *   HANDOFFS  docs/handoffs/*.md — ≤ 24 KB; `branch:` exists; not cited from outside the
 *             allowed set (hubs, CURRENT.md, handoffs, reviews) — the skill's own rule.
 *   LINKS     relative links in every file this gate owns resolve.
 *   INDEX     docs/INDEX.md names every top-level entry of docs/ — a new directory cannot
 *             go unmapped.
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
  legacyCodes: 'docs/features/legacy-codes.md',
  current: 'docs/planning/CURRENT.md',
  bugs: 'docs/bugs/BUGS.md',
  bugsDir: 'docs/bugs',
  fupOpen: 'docs/progress/follow-ups-open.md',
  fupBacklog: 'docs/progress/deferred-backlog.md',
  fupArchive: 'docs/progress/follow-ups-archive.md',
  lessons: 'docs/learning/LESSONS.md',
  postmortemsDir: 'docs/learning/postmortems',
  handoffsDir: 'docs/handoffs',
  docsIndex: 'docs/INDEX.md',
  phaseLedger: 'docs/progress/phase-ledger.md',
  decisionsDir: 'docs/decisions',
}

export const CODE_WATERMARK = '2026-09-04' // ids opened/filed on or after this must use a registered code
export const CURRENT_STATE_MAX_LINES = 60
export const HANDOFF_MAX_BYTES = 24 * 1024
export const CRITICAL_PIN_REQUIRED = false // flipped in the commit that moves § Critical FUP into the register

export const HUB_STATUS = ['planned', 'in_progress', 'gated', 'complete', 'parked']
export const HUB_KIND = ['feature', 'fup-fix']
export const HUB_REQUIRED_KEYS = ['id', 'title', 'status', 'kind', 'program', 'branch', 'plan', 'progress', 'reviews', 'adrs', 'handoff']
export const CURRENT_STATE_SECTIONS = ['Objective', 'Done since start', 'In progress', 'Next', 'Blockers']

export const BUG_STATUS = ['open', 'fixed', 'verified', 'wontfix', 'duplicate', 'untriaged']
export const BUG_CLOSED_STATUS = ['fixed', 'verified', 'wontfix', 'duplicate']
export const BUG_COLUMNS = ['ID', 'Status', 'Severity', 'Area', 'Description', 'Opened', 'Closed', 'Related', 'Doc']
export const SEVERITY = ['catastrophic', 'critical', 'high', 'medium', 'low']
export const SEVERITY_EMOJI = { catastrophic: '⛔', critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }

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

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/
const ID_RX = /^[A-Z0-9][A-Z0-9-]*$/
/** The register tables open with an `ID` column; legend tables in the same file do not. */
export const REGISTER_HEADER_RX = /^\s*\|\s*ID\s*\|/
export const LEGEND_HEADER_RX = /^\s*\|\s*Code\s*\|/
/** Same shape as check-progress-doc's RESOLVED_HEADING: the entry is resolved (and, if it is still in the open register, gate 7 requires a **Retained** line). */
export const RESOLVED_HEADING_RX = /⬛|✅ ?\*{0,2}(RESOLVED|CLOSED)\b/u

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

/** `### ` entries of a register: heading, the up-to-4 non-blank "field lines" after it, body. */
export function parseEntries(text) {
  const lines = text.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^### /.test(lines[i])) continue
    let end = lines.length
    for (let j = i + 1; j < lines.length; j++) {
      if (/^##+ /.test(lines[j])) {
        end = j
        break
      }
    }
    const body = lines.slice(i + 1, end)
    const fields = []
    for (const l of body) {
      if (!l.trim()) {
        if (fields.length) break
        continue
      }
      if (!/^\*\*/.test(l)) break
      fields.push(l)
      if (fields.length === 4) break
    }
    out.push({ heading: lines[i], line: i + 1, fields: fields.join('\n'), body: body.join('\n') })
  }
  return out
}

export function relLinks(text) {
  const out = []
  const rx = /\]\(([^)\s]+)\)/g
  let m
  while ((m = rx.exec(text))) {
    const t = m[1]
    if (/^(https?:|mailto:|#)/.test(t)) continue
    out.push(t.replace(/#.*$/, ''))
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
  if (fm.status === 'parked' && !/\*\*Revisit when:\*\*\s*\S/.test(hub.body)) at('status parked requires a `**Revisit when:**` line')
  if (fm.status === 'complete') {
    const inLedger = ctx.ledgerText.includes(`| ${fm.id} |`) || new RegExp(`\\b${fm.id}\\b`).test(ctx.ledgerText)
    const approved = (Array.isArray(fm.reviews) ? fm.reviews : []).some((r) => /\bAPPROVED\b/.test(ctx.readRel(join(PATHS.featuresDir, r)) || ''))
    if (!inLedger && !approved) at('status complete requires a phase-ledger row or an APPROVED review')
  }
  // Current-state block
  const lines = hub.body.split('\n')
  const start = lines.findIndex((l) => /^## Current state\b/.test(l))
  if (start === -1) {
    if (fm.status === 'in_progress' || fm.status === 'gated') at('`## Current state` block is required for in_progress / gated')
  } else {
    if (fm.status === 'complete') at('`## Current state` must be cut when status is complete (into the progress record)')
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

export function checkCurrent(text, inProgressIds) {
  const F = []
  if (text == null) return [`[CURRENT] ${PATHS.current} — missing`]
  const listed = new Set()
  for (const m of text.matchAll(/^- \*\*([A-Z0-9][A-Z0-9-]*)\*\*/gm)) listed.add(m[1])
  for (const id of inProgressIds) if (!listed.has(id)) F.push(`[CURRENT] ${PATHS.current} — in_progress hub ${id} is not listed`)
  for (const id of listed) if (!inProgressIds.includes(id)) F.push(`[CURRENT] ${PATHS.current} — lists ${id}, which is not an in_progress hub`)
  return F
}

export function codeOf(id) {
  const m = String(id).match(/^(?:BUG|FUP)-([A-Z0-9]+)-/)
  return m ? m[1] : null
}

export function checkCodes({ bugRows, fupEntries, registered, legacyRows }) {
  const F = []
  if (!legacyRows || legacyRows === 0) F.push(`[CODES] ${PATHS.legacyCodes} — legend missing or empty`)
  for (const r of bugRows) {
    const opened = r.cells.Opened
    if (!DATE_RX.test(opened) || opened < CODE_WATERMARK) continue
    const c = codeOf(r.cells.ID)
    if (!c || !registered.has(c)) F.push(`[CODES] ${PATHS.bugs}:${r.line} — ${r.cells.ID} uses code \`${c}\`, not a hub id or legacy-codes row`)
  }
  for (const e of fupEntries) {
    const filed = (e.fields.match(/\*\*Filed:\*\*\s*(\d{4}-\d{2}-\d{2})/) || [])[1]
    if (!filed || filed < CODE_WATERMARK) continue
    const c = codeOf(e.id)
    if (!c || !registered.has(c)) F.push(`[CODES] ${PATHS.fupOpen}:${e.line} — ${e.id} uses code \`${c}\`, not a hub id or legacy-codes row`)
  }
  return F
}

export function checkBugs(table, ctx) {
  const F = []
  const W = []
  const file = PATHS.bugs
  if (!table) return { findings: [`[BUGS] ${file} — no table found`], warnings: W }
  if (table.columns.join('|') !== BUG_COLUMNS.join('|')) {
    F.push(`[BUGS] ${file}:${table.headerLine} — columns must be [${BUG_COLUMNS.join(' | ')}]; found [${table.columns.join(' | ')}]`)
    return { findings: F, warnings: W }
  }
  const seen = new Map()
  const linkedDocs = new Set()
  let untriaged = 0
  let unrated = 0
  for (const r of table.rows) {
    const c = r.cells
    const at = (msg) => F.push(`[BUGS] ${file}:${r.line} — ${c.ID || '(no id)'}: ${msg}`)
    if (!/^BUG-[A-Z0-9][A-Z0-9-]*$/.test(c.ID)) at('id must match BUG-[A-Z0-9-]+')
    if (seen.has(c.ID)) at(`duplicate id (first at line ${seen.get(c.ID)})`)
    seen.set(c.ID, r.line)
    if (!BUG_STATUS.includes(c.Status)) at(`status \`${c.Status}\` not in ${BUG_STATUS.join('|')}`)
    if (c.Status === 'untriaged') untriaged++
    const legacy = c.Opened === '—' || (DATE_RX.test(c.Opened) && c.Opened < CODE_WATERMARK)
    if (c.Severity === 'unrated') {
      unrated++
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
        const p = join(PATHS.bugsDir, link.replace(/#.*$/, ''))
        if (!ctx.exists(p)) at(`Doc link \`${link}\` does not resolve`)
        else {
          linkedDocs.add(basename(p))
          if (c.Status === 'fixed' || c.Status === 'verified') {
            const t = ctx.readRel(p) || ''
            for (const sec of ['Root cause', 'Regression protection']) {
              if (!sectionNonEmpty(t, sec)) at(`status ${c.Status} but the document's \`## ${sec}\` is empty`)
            }
          }
        }
      }
    }
  }
  for (const d of ctx.bugDocFiles) {
    if (!linkedDocs.has(d)) F.push(`[BUGS] ${PATHS.bugsDir}/${d} — no BUGS.md row links this document`)
  }
  if (untriaged) W.push(`[BUGS] ${untriaged} untriaged row(s) — PO to rule`)
  if (unrated) W.push(`[BUGS] ${unrated} unrated legacy row(s)`)
  return { findings: F, warnings: W }
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

export function checkFollowups({ open, backlog, criticalIds }) {
  const F = []
  const W = []
  let poToRule = 0
  const entries = fupEntriesOf(open)
  if (!entries.length) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — no FUP entries found (wrong file?)`)
  for (const e of entries) {
    const at = (msg) => F.push(`[FOLLOWUPS] ${PATHS.fupOpen}:${e.line} — ${e.id}: ${msg}`)
    const f = e.fields
    const filed = f.match(/\*\*Filed:\*\*\s*(\S+)/)
    if (!filed) at('lacks `**Filed:**`')
    else if (!DATE_RX.test(filed[1])) at(`Filed \`${filed[1]}\` is not YYYY-MM-DD`)
    if (!/\*\*Owner:\*\*\s*\S/.test(f)) at('lacks `**Owner:**`')
    const sev = f.match(/\*\*Severity:\*\*\s*([a-z]+)/)
    if (!sev) at('lacks `**Severity:**`')
    else if (!SEVERITY.includes(sev[1])) at(`severity \`${sev[1]}\` not in ${SEVERITY.join('|')}`)
    else if (!RESOLVED_HEADING_RX.test(e.heading)) {
      // A RESOLVED entry retained as a review lens (gate 7's **Retained** opt-out) keeps ⬛ in the
      // emoji slot — that marker carries its resolution, not its severity, so it is exempt here.
      // Code points, not UTF-16 units: 🔴🟠🟡🟢 are surrogate pairs, so `str[0]` is a lone surrogate.
      const headText = e.heading.replace(/^### /, '').trim()
      const want = SEVERITY_EMOJI[sev[1]]
      if (!headText.startsWith(want)) at(`heading emoji ${Array.from(headText)[0]} disagrees with severity ${sev[1]} (${want})`)
    }
    const closes = f.match(/\*\*Closes when:\*\*\s*(.*)/)
    if (!closes || !closes[1].trim()) at('lacks `**Closes when:**`')
    else if (/PO to rule/i.test(closes[1])) poToRule++
    if (/\*\*Parked\*\*/.test(e.body) && !/\*\*Revisit when:\*\*\s*\S/.test(e.body)) at('Parked entry lacks `**Revisit when:**`')
  }
  const b = parseEntries(backlog)
  if (!b.length) F.push(`[FOLLOWUPS] ${PATHS.fupBacklog} — no entries found (wrong file?)`)
  let revisitPo = 0
  for (const e of b) {
    const m = e.body.match(/\*\*Revisit when:\*\*\s*(.*)/)
    if (!m || !m[1].trim()) F.push(`[FOLLOWUPS] ${PATHS.fupBacklog}:${e.line} — entry lacks \`**Revisit when:**\``)
    else if (/PO to rule/i.test(m[1])) revisitPo++
  }
  if (criticalIds) {
    const ids = new Set(entries.map((e) => e.id))
    for (const id of criticalIds) if (!ids.has(id)) F.push(`[FOLLOWUPS] Critical pin names ${id}, which has no register entry (orphan)`)
  } else if (CRITICAL_PIN_REQUIRED) {
    F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — the \`## ⭐⭐ Critical\` pin section is required and missing`)
  }
  if (poToRule) W.push(`[FOLLOWUPS] ${poToRule} entries with \`Closes when: PO to rule\``)
  if (revisitPo) W.push(`[FOLLOWUPS] ${revisitPo} backlog entries with \`Revisit when: PO to rule\``)
  return { findings: F, warnings: W }
}

/** Ids inside a `## ⭐⭐ Critical` section of the register, or null when the section is absent. */
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
  for (const m of lines.slice(i, end).join('\n').matchAll(/\b(FUP-[A-Z0-9][A-Z0-9-]*)/g)) ids.add(m[1])
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
  if (!table) return { findings: [`[LESSONS] ${file} — no table found`], warnings: W, ids: new Set() }
  if (table.columns.join('|') !== LESSON_COLUMNS.join('|')) {
    return { findings: [`[LESSONS] ${file}:${table.headerLine} — columns must be [${LESSON_COLUMNS.join(' | ')}]`], warnings: W, ids: new Set() }
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
  if (prose) W.push(`[LESSONS] ${prose} of ${table.rows.length} lessons are \`prose only\``)
  return { findings: F, warnings: W, ids }
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

export function checkHandoffs(files, branches, citations) {
  const F = []
  for (const f of files) {
    const at = (msg) => F.push(`[HANDOFFS] ${PATHS.handoffsDir}/${f.name} — ${msg}`)
    if (f.bytes > HANDOFF_MAX_BYTES) at(`${f.bytes} bytes exceeds the ${HANDOFF_MAX_BYTES}-byte cap (compress by CUTTING, never by dropping qualifiers)`)
    if (f.fm && f.fm.branch && !branches.includes(String(f.fm.branch))) at(`branch \`${f.fm.branch}\` no longer exists — stale handoff, delete or promote`)
    for (const c of citations.filter((x) => x.handoff === f.name)) {
      if (!HANDOFF_CITATION_ALLOWED.some((p) => c.file.startsWith(p))) at(`cited from ${c.file}:${c.line} — a handoff may not be cited; promote the claim into a durable record`)
    }
  }
  return F
}

export function checkLinks(file, text, exists) {
  const F = []
  for (const l of relLinks(text)) {
    const p = resolve(dirname(file), l)
    if (!exists(relative('.', p))) F.push(`[LINKS] ${file} — link \`${l}\` does not resolve`)
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
  const fupTexts = [PATHS.fupOpen, PATHS.fupArchive, PATHS.fupBacklog].map((p) => read(p) || '').join('\n')
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
    readRel: () => '## Root cause\nx\n## Regression protection\ny\nAPPROVED',
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
    fm: { id: 'X1', title: 't', status: 'in_progress', kind: 'feature', program: 'X', branch: 'feat-a', plan: null, progress: null, reviews: [], adrs: ['0001'], handoff: null },
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
  must('HUBS complete unrecorded', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'complete' }, body: '# X1\n' }, { ...okCtx, ledgerText: '', readRel: () => '' }), true)
  must('HUBS sections out of order', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('### Next\nd\n### Blockers\ne\n', '### Blockers\ne\n### Next\nd\n') }, okCtx), true)
  must('HUBS no Updated', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace(/\*\*Updated:\*\* \S+\n/, '') }, okCtx), true)
  must('HUBS stale Updated', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('2026-09-02', '2026-08-01') }, okCtx), true)
  must('HUBS stale Updated skipped on main', checkHub({ ...goodHub, body: '# X1\n' + goodBlock.replace('2026-09-02', '2026-08-01') }, { ...okCtx, currentBranch: 'main' }), false)
  must('HUBS over cap', checkHub({ ...goodHub, body: '# X1\n' + goodBlock + 'x\n'.repeat(CURRENT_STATE_MAX_LINES) }, okCtx), true)
  must('HUBS parked w/o revisit', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'parked' } }, okCtx), true)
  must('HUBS parked ok', checkHub({ ...goodHub, fm: { ...goodHub.fm, status: 'parked' }, body: goodHub.body + '\n**Revisit when:** later\n' }, okCtx), false)
  must('HUBS bad adr', checkHub(goodHub, { ...okCtx, adrExists: () => false }), true)
  must('HUBS unparsed', checkHub({ file: 'docs/features/x1.md', fm: null, body: '', error: 'frontmatter does not parse' }, okCtx), true)

  must('CURRENT good', checkCurrent('- **X1** — a → [hub](../features/x1.md)\n', ['X1']), false)
  must('CURRENT missing', checkCurrent('', ['X1']), true)
  must('CURRENT extra', checkCurrent('- **X1** — a\n- **X2** — b\n', ['X1']), true)
  must('CURRENT absent file', checkCurrent(null, []), true)

  const reg = new Set(['AE4', 'DM5'])
  const newRow = (id, opened) => ({ cells: { ID: id, Opened: opened }, line: 1 })
  const newFup = (id, filed) => ({ id, fields: `**Filed:** ${filed} (x)`, line: 1 })
  must('CODES good', checkCodes({ bugRows: [newRow('BUG-AE4-A', '2026-09-05'), newRow('BUG-ZZZ-B', '2026-01-01')], fupEntries: [newFup('FUP-DM5-A', '2026-09-05')], registered: reg, legacyRows: 1 }), false)
  must('CODES bad bug', checkCodes({ bugRows: [newRow('BUG-ZZZ-A', '2026-09-05')], fupEntries: [], registered: reg, legacyRows: 1 }), true)
  must('CODES bad fup', checkCodes({ bugRows: [], fupEntries: [newFup('FUP-ZZZ-A', '2026-09-05')], registered: reg, legacyRows: 1 }), true)
  must('CODES no legend', checkCodes({ bugRows: [], fupEntries: [], registered: reg, legacyRows: 0 }), true)

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
  must('BUGS untriaged warns', checkBugs(parseTable(bugsHdr + bugRow({ Status: 'untriaged', Closed: '—' })), bugsCtx).warnings, true)

  const fupOk = '### 🟠 FUP-X-A — claim\n\n**Filed:** 2026-09-01 (x) · **Owner:** lead · **Severity:** high — why\n**Closes when:** done\n\nbody\n'
  const blOk = '### 🟡 Title\n\n**Parked:** 2026-08-19 · **Revisit when:** phase 20\n\nbody\n'
  must('FOLLOWUPS good', checkFollowups({ open: fupOk, backlog: blOk, criticalIds: null }).findings, false)
  must('FOLLOWUPS no Filed', checkFollowups({ open: fupOk.replace('**Filed:** 2026-09-01 (x) · ', ''), backlog: blOk }).findings, true)
  must('FOLLOWUPS bad date', checkFollowups({ open: fupOk.replace('2026-09-01', 'Sept 1'), backlog: blOk }).findings, true)
  must('FOLLOWUPS no Owner', checkFollowups({ open: fupOk.replace('**Owner:** lead · ', ''), backlog: blOk }).findings, true)
  must('FOLLOWUPS no Severity', checkFollowups({ open: fupOk.replace('**Severity:** high — why', ''), backlog: blOk }).findings, true)
  must('FOLLOWUPS bad severity', checkFollowups({ open: fupOk.replace('high', 'MAJOR'), backlog: blOk }).findings, true)
  must('FOLLOWUPS emoji mismatch', checkFollowups({ open: fupOk.replace('🟠', '🔴'), backlog: blOk }).findings, true)
  must('FOLLOWUPS resolved-retained keeps ⬛', checkFollowups({ open: fupOk.replace('🟠', '⬛') + '\n**Retained** as a review lens\n', backlog: blOk }).findings, false)
  must('FOLLOWUPS no Closes', checkFollowups({ open: fupOk.replace('**Closes when:** done\n', ''), backlog: blOk }).findings, true)
  must('FOLLOWUPS PO to rule counted', checkFollowups({ open: fupOk.replace('done', 'PO to rule'), backlog: blOk }).warnings, true)
  must('FOLLOWUPS parked w/o revisit', checkFollowups({ open: fupOk + '**Parked** since x\n', backlog: blOk }).findings, true)
  must('FOLLOWUPS backlog no revisit', checkFollowups({ open: fupOk, backlog: blOk.replace(' · **Revisit when:** phase 20', '') }).findings, true)
  must('FOLLOWUPS empty register', checkFollowups({ open: '', backlog: blOk }).findings, true)
  must('FOLLOWUPS critical orphan', checkFollowups({ open: fupOk, backlog: blOk, criticalIds: ['FUP-X-NOPE'] }).findings, true)
  must('FOLLOWUPS critical ok', checkFollowups({ open: fupOk, backlog: blOk, criticalIds: ['FUP-X-A'] }).findings, false)
  must('criticalIdsOf absent', [criticalIdsOf(fupOk) === null ? '' : 'x'].filter(Boolean), false)
  must('criticalIdsOf present', criticalIdsOf('## ⭐⭐ Critical\n| FUP-X-A |\n## Other\nFUP-X-B\n').join() === 'FUP-X-A' ? [] : ['wrong'], false)

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

  const ho = { name: 'a.md', bytes: 100, fm: { branch: 'feat-a' } }
  must('HANDOFFS good', checkHandoffs([ho], ['feat-a'], [{ handoff: 'a.md', file: 'docs/features/x.md', line: 1 }]), false)
  must('HANDOFFS too big', checkHandoffs([{ ...ho, bytes: HANDOFF_MAX_BYTES + 1 }], ['feat-a'], []), true)
  must('HANDOFFS branch gone', checkHandoffs([ho], ['main'], []), true)
  must('HANDOFFS cited', checkHandoffs([ho], ['feat-a'], [{ handoff: 'a.md', file: 'docs/progress/x.md', line: 3 }]), true)

  must('LINKS good', checkLinks('docs/x.md', '[a](../README.md)', () => true), false)
  must('LINKS bad', checkLinks('docs/x.md', '[a](nope.md)', () => false), true)
  must('LINKS ignores http', checkLinks('docs/x.md', '[a](https://x) [b](#h)', () => false), false)

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

  // HUBS + CURRENT + CODES
  const hubs = listHubs()
  if (!hubs.length) F.push(`[HUBS] ${PATHS.featuresDir} — no hubs found; ADR 0185 D1 requires one per unit in flight`)
  for (const h of hubs) F.push(...checkHub(h, ctx))
  const ids = hubs.filter((h) => h.fm?.id).map((h) => String(h.fm.id))
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  for (const d of new Set(dup)) F.push(`[HUBS] duplicate hub id ${d}`)
  const inProgress = hubs.filter((h) => h.fm?.status === 'in_progress').map((h) => String(h.fm.id))
  F.push(...checkCurrent(read(PATHS.current), inProgress))
  const legacy = parseTable(read(PATHS.legacyCodes) || '', LEGEND_HEADER_RX)
  const registered = new Set([...ids, ...(legacy?.rows || []).map((r) => r.raw[0].replace(/`/g, '').trim())])
  F.push(...checkCodes({ bugRows: ctx.bugsTable?.rows || [], fupEntries: fupEntriesOf(read(PATHS.fupOpen) || ''), registered, legacyRows: legacy?.rows.length || 0 }))

  // BUGS
  const bugs = checkBugs(ctx.bugsTable, ctx)
  F.push(...bugs.findings)
  W.push(...bugs.warnings)

  // FOLLOWUPS
  const open = read(PATHS.fupOpen)
  const backlog = read(PATHS.fupBacklog)
  if (open == null) F.push(`[FOLLOWUPS] ${PATHS.fupOpen} — missing`)
  if (backlog == null) F.push(`[FOLLOWUPS] ${PATHS.fupBacklog} — missing`)
  if (open != null && backlog != null) {
    const fu = checkFollowups({ open, backlog, criticalIds: criticalIdsOf(open) })
    F.push(...fu.findings)
    W.push(...fu.warnings)
  }

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
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          const rel = `${PATHS.handoffsDir}/${f}`
          return { name: f, bytes: statSync(join(ROOT, rel)).size, fm: parseFrontmatter(read(rel)).fm }
        })
    : []
  const allMd = walkMd('.')
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
  F.push(...checkHandoffs(hoFiles, ctx.branches, citations))

  // LINKS over every file this gate owns
  const owned = [PATHS.docsIndex, PATHS.current, PATHS.bugs, PATHS.lessons, PATHS.legacyCodes, `${PATHS.postmortemsDir}/README.md`, `${PATHS.bugsDir}/README.md`]
    .concat(hubs.map((h) => h.file))
    .concat(ctx.bugDocFiles.map((f) => `${PATHS.bugsDir}/${f}`))
    .concat(pmFiles.map((p) => `${PATHS.postmortemsDir}/${p.name}`))
  for (const f of owned) {
    const t = read(f)
    if (t != null) F.push(...checkLinks(f, t, exists))
  }

  // INDEX
  F.push(...checkDocsIndex(read(PATHS.docsIndex), readdirSync(join(ROOT, 'docs')).sort()))

  for (const w of W) console.log('check-docs-registers: WARN ' + w)
  if (F.length) {
    console.error(`check-docs-registers: ${F.length} finding(s)`)
    for (const f of F) console.error('  ' + f)
    process.exit(1)
  }
  console.log(`check-docs-registers: OK (self-test + ${hubs.length} hubs, ${ctx.bugsTable?.rows.length ?? 0} bugs, ${les.ids.size} lessons, ${hoFiles.length} handoffs)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
