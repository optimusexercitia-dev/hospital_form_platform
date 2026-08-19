#!/usr/bin/env node
/**
 * lint:progress — the PROGRESS.md live-state contract, enforced by machine.
 *
 * THE DEFECT CLASS. PROGRESS.md is loaded by every spawn, and every rule that kept it
 * small and true used to live in prose (lead-playbook §5). Prose rules are enforced by
 * attention, and the record shows attention loses: the file's own banner went stale
 * three times about the file's own size; a rotation nearly destroyed seven follow-ups
 * whose index lines had no bodies; a verbatim rotation 404'd 474 relative links; rows
 * for phases completed in June were still being paid for by every teammate spawn in
 * August. None of those had a gate that could contradict them — this is that gate.
 *
 * THE CONTRACT it enforces (PROGRESS.md header + CLAUDE.md §7):
 *   1. SIZE      — PROGRESS.md is at most 60 KB. Hard fail, no warn band: a warn band
 *                  is a figure someone has to notice, and figures nobody must act on
 *                  go stale (the banner's own history).
 *   2. SECTIONS  — the required live sections exist (matched on their stable noun, so
 *                  emoji/decoration drift does not red the gate).
 *   3. PHASES    — no row in § Phase Status has "complet…" in its Status cell. A
 *                  completed row's home is docs/progress/phase-ledger.md; the row
 *                  moves there VERBATIM in the same change that would make this red.
 *   4. FUP INDEX — no resolved line in § Follow-ups (a `- ⬛` marker, or ✅ RESOLVED /
 *                  ✅ CLOSED immediately after the ✅). Resolved lines move verbatim to
 *                  follow-ups-archive.md. Partial states (HALF / PARTIALLY / PO-RULED)
 *                  are OPEN and stay.
 *   5. BODIES    — every OPEN `FUP-*` index line has a body in
 *                  docs/progress/follow-ups.md ("a pointer is not evidence its target
 *                  exists" — the R3 failure). Bounded property, stated: the check
 *                  covers ids matching FUP-[A-Z0-9-]+ only; legacy un-prefixed items
 *                  (e.g. "AUTHZ Gate-2 MINOR-1") are outside its domain.
 *   6. LINKS     — every relative markdown link resolves to an existing file; same-file
 *                  #anchors resolve to a heading (compared alphanumeric-only, so
 *                  punctuation/emoji slugging cannot false-red). Domain is PROGRESS.md,
 *                  CLAUDE.md **and the rotation destinations** — rotating verbatim into
 *                  an unchecked file is how 474 links broke once and 41 more were found
 *                  broken at the moment the destinations were added here.
 *   8. CELLS     — in the capped sections only (CAPPED_SECTIONS): cell length, plus
 *                  unbalanced inline-code / bold spans, which is the class where a
 *                  compression pass cut a cell mid-token and every gate stayed green.
 *   9. BULLETS   — bullet length, same capped sections. § Critical FUP and the OPEN
 *                  follow-up index are EXEMPT BY DECISION (CLAUDE.md §7 protects both).
 *   7. EOL       — the four every-session docs (PROGRESS.md, CLAUDE.md,
 *                  ARCHITECTURE.md, PHASES.md) contain no CR. Belt to the
 *                  .gitattributes suspenders: the attribute normalizes at checkin,
 *                  this catches a CRLF written directly to the working tree.
 *
 * SELF-TEST runs on every invocation before the real scan (house rule: a gate nobody
 * has seen fire is not a gate). Each check is proven able to fail against a synthetic
 * fixture; a checker that cannot red aborts the run.
 *
 *   node scripts/check-progress-doc.mjs [--self-test]   (--self-test: fixtures only)
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const ROOT = process.cwd()
const SIZE_CAP = 60 * 1024
const MAX_CELL = 300
const MAX_BULLET = 400

const TRACKER_DOCS = ['PROGRESS.md', 'CLAUDE.md', 'ARCHITECTURE.md', 'PHASES.md']

/**
 * Link-checked docs. The ROTATION DESTINATIONS are in this list deliberately: a
 * verbatim rotation carries root-relative `docs/...` links into `docs/progress/`,
 * where they no longer resolve. That is not hypothetical — 41 links were already
 * broken this way at the moment these three were added, and an earlier pass broke
 * 474. Rotating into a file nothing link-checks is how the defect survives.
 */
const LINK_CHECKED_DOCS = [
  'PROGRESS.md',
  'CLAUDE.md',
  'docs/progress/deferred-backlog.md',
  'docs/progress/follow-ups-archive.md',
  'docs/progress/bug-log-archive.md',
  'docs/progress/follow-ups.md',
  'docs/progress/decisions-log.md',
  'docs/progress/test-run-archive.md',
  'docs/progress/phase-ledger.md',
  'docs/progress/qa-verdicts-archive.md',
]

/**
 * Sections the shape caps apply to. § Critical FUP and the OPEN follow-up index are
 * EXEMPT BY DECISION — CLAUDE.md §7 protects both by name ("don't satisfy the size
 * cap by trimming § Critical FUP or OPEN index lines"), and density is the point in
 * both. § Now and § State are live working state, likewise exempt.
 *
 * BOUNDED PROPERTY, STATED: this is an allowlist of headings, so a NEW section is
 * uncapped until someone adds it here. That is the known cost of honouring the §7
 * carve-out; the alternative (cap everything, exempt by regex) inverts which side
 * of the boundary a mistake lands on.
 */
const CAPPED_SECTIONS = [
  /^## Phase Status\b/,
  /^## Bug Log\b/,
  /^## Test Run Summary\b/,
  /^## QA Verdicts\b/,
  /^## Decisions\b/,
]

/** Required sections, matched on the stable noun so decoration drift can't red. */
const REQUIRED_SECTIONS = [
  /^## Now\b/m,
  /^## Phase Status\b/m,
  /^## Bug Log\b/m,
  /^## Test Run Summary\b/m,
  /^## QA Verdicts\b/m,
  /^## Decisions\b/m,
  /^## .*State/m,
  /^## .*Critical FUP/m,
  /^## Follow-ups/m,
]

/** Slice the body of one `## `-level section (from its heading to the next one). */
export function sectionBody(text, headingRe) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => headingRe.test(l))
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i
      break
    }
  }
  return { startLine: start + 1, lines: lines.slice(start + 1, end) }
}

export function checkSize(bytes) {
  return bytes <= SIZE_CAP
    ? []
    : [
        `PROGRESS.md is ${bytes} bytes (cap ${SIZE_CAP}). Rotate at the property level: ` +
          `completed rows -> phase-ledger.md, resolved FUP lines -> follow-ups-archive.md, ` +
          `concluded gate/QA/decision rows -> their archives. Never trim Critical FUP or ` +
          `OPEN index lines.`,
      ]
}

export function checkSections(text) {
  return REQUIRED_SECTIONS.filter((re) => !re.test(text)).map(
    (re) => `PROGRESS.md is missing a required section (expected heading matching ${re})`,
  )
}

export function checkPhaseRows(text) {
  const sec = sectionBody(text, /^## Phase Status\b/)
  if (!sec) return [] // absence is checkSections' finding, not this one's
  const out = []
  sec.lines.forEach((line, i) => {
    if (!/^\|/.test(line) || /^\|[\s-]*\|/.test(line)) return // not a row / divider
    const cells = line.split('|')
    const status = cells[3] ?? ''
    if (/complet/i.test(status)) {
      out.push(
        `PROGRESS.md:${sec.startLine + 1 + i} — completed phase row in the live file ` +
          `(status cell: ${status.trim().slice(0, 40)}…). Move the row VERBATIM to ` +
          `docs/progress/phase-ledger.md in this same change.`,
      )
    }
  })
  return out
}

const RESOLVED_LINE = /^- (⬛|.*✅ ?\*{0,2}(RESOLVED|CLOSED)\b)/u

export function checkFupIndex(text) {
  const sec = sectionBody(text, /^## Follow-ups/)
  if (!sec) return []
  const out = []
  sec.lines.forEach((line, i) => {
    if (RESOLVED_LINE.test(line)) {
      out.push(
        `PROGRESS.md:${sec.startLine + 1 + i} — resolved follow-up still in the live index ` +
          `(${line.slice(0, 60)}…). Move the line VERBATIM to follow-ups-archive.md.`,
      )
    }
  })
  return out
}

export function checkFupBodies(text, bodiesText) {
  const sec = sectionBody(text, /^## Follow-ups/)
  if (!sec) return []
  const out = []
  sec.lines.forEach((line, i) => {
    const m = /^- .*?\*\*(FUP-[A-Z0-9-]+)\*\*/u.exec(line)
    if (!m) return
    if (!bodiesText.includes(m[1])) {
      out.push(
        `PROGRESS.md:${sec.startLine + 1 + i} — OPEN index line ${m[1]} has NO body in ` +
          `docs/progress/follow-ups.md. A pointer is not evidence its target exists — ` +
          `write the body before (or with) the index line.`,
      )
    }
  })
  return out
}

/** `[line, lineNo]` for every line inside a CAPPED_SECTIONS section (headings excluded). */
function cappedLines(text) {
  const out = []
  let on = false
  text.split('\n').forEach((line, i) => {
    if (/^## /.test(line)) on = CAPPED_SECTIONS.some((re) => re.test(line))
    else if (on) out.push([line, i + 1])
  })
  return out
}

const isTableRow = (l) => /^\|/.test(l) && !/^\|[\s-]*\|/.test(l)

/**
 * Cell shape in the capped sections: length, and unbalanced inline-code / bold spans.
 *
 * The unbalanced-delimiter checks are the W1 defect class — a compression pass cut a
 * cell mid-token, leaving `` Migration `20260 `` with an open span (and, four rows
 * later, an open `**`). Both survived review and every gate.
 *
 * ⛔ NOT CHECKED, deliberately: "cell ends mid-token without an `…`". Calibrated
 * against the live file, every hit was a FALSE POSITIVE — this file's house style
 * ends prose cells without terminal punctuation, so "ends in a lowercase letter"
 * flags healthy cells. The truncations it was meant to catch are caught by the
 * delimiter checks instead, which have no false positives here. A detector that
 * finds a lot needs proving too.
 */
export function checkCellShape(text) {
  const out = []
  for (const [line, no] of cappedLines(text)) {
    if (!isTableRow(line)) continue
    for (const raw of line.split('|').slice(1, -1)) {
      const cell = raw.trim()
      if (cell.length > MAX_CELL) {
        out.push(
          `PROGRESS.md:${no} — table cell is ${cell.length} chars (cap ${MAX_CELL}). ` +
            `Rationale belongs in the ADR or archive this row links to, not in the row.`,
        )
      }
      if ((cell.match(/`/g) ?? []).length % 2) {
        out.push(
          `PROGRESS.md:${no} — unclosed inline code span in a cell (…${cell.slice(-40)}). ` +
            `A compression pass cut this cell mid-token.`,
        )
      }
      if ((cell.match(/\*\*/g) ?? []).length % 2) {
        out.push(
          `PROGRESS.md:${no} — unclosed bold span in a cell (…${cell.slice(-40)}). ` +
            `A compression pass cut this cell mid-span.`,
        )
      }
    }
  }
  return out
}

/** Bullet length in the capped sections (the OPEN follow-up index is exempt — see above). */
export function checkBulletLength(text) {
  const out = []
  for (const [line, no] of cappedLines(text)) {
    if (!/^\s*- /.test(line) || line.length <= MAX_BULLET) continue
    out.push(
      `PROGRESS.md:${no} — bullet is ${line.length} chars (cap ${MAX_BULLET}). ` +
        `Link the detail instead of restating it.`,
    )
  }
  return out
}

/** Alphanumeric-only form of a heading, for anchor comparison that emoji can't break. */
const anchorKey = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

export function checkLinks(file, text, fileExists) {
  const out = []
  const headings = [...text.matchAll(/^#{1,6} +(.+)$/gm)].map((m) => anchorKey(m[1]))
  const linkRe = /\]\(([^)\s]+)\)/g
  const lines = text.split('\n')
  lines.forEach((rawLine, i) => {
    // Blank out inline code spans, preserving offsets: a `](docs/x.md)` inside backticks
    // is prose ABOUT a link, not a link. follow-ups.md documents this very defect class
    // in a code span, and without this it reds on its own explanation of the rule.
    // BOUNDED: inline spans only — fenced blocks are not tracked here.
    const line = rawLine.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
    for (const m of line.matchAll(linkRe)) {
      const target = m[1]
      if (/^(https?:|mailto:|data:)/.test(target)) continue
      if (target.startsWith('#')) {
        const key = anchorKey(decodeURIComponent(target.slice(1)))
        if (key && !headings.some((h) => h.includes(key) || key.includes(h))) {
          out.push(`${file}:${i + 1} — in-file anchor does not match any heading: ${target}`)
        }
        continue
      }
      const path = target.split('#')[0]
      if (!path.endsWith('.md') && !/\.[a-z]{2,4}$/.test(path)) continue // not a file link
      const rel = join(dirname(file), path)
      if (!fileExists(rel)) {
        out.push(`${file}:${i + 1} — broken relative link: ${target}`)
      }
    }
  })
  return out
}

export function checkEol(file, buf) {
  return buf.includes('\r')
    ? [`${file} contains CR characters — the every-session docs are LF-only (.gitattributes *.md)`]
    : []
}

// --------------------------------------------------------------------------
// SELF-TEST — every checker proven able to fail, on every invocation.
// --------------------------------------------------------------------------
function selfTest() {
  const fails = []
  const expectRed = (name, findings) => {
    if (findings.length === 0) fails.push(name)
  }
  const expectGreen = (name, findings) => {
    if (findings.length !== 0) fails.push(`${name} (false positive: ${findings[0]})`)
  }

  expectRed('size', checkSize(SIZE_CAP + 1))
  expectGreen('size-green', checkSize(SIZE_CAP))

  expectRed('sections', checkSections('# empty file\n'))

  const phaseFixture =
    '## Phase Status\n| P | N | S | B |\n| - | - | - | - |\n| 3 | Admin | ✅ complete | x |\n'
  expectRed('phase-complete', checkPhaseRows(phaseFixture))
  expectGreen(
    'phase-open-green',
    checkPhaseRows('## Phase Status\n| P | N | S | B |\n| - | - | - | - |\n| 9 | Deploy | 🔜 not started | – |\n'),
  )

  expectRed('fup-black-square', checkFupIndex('## Follow-ups\n- ⬛ **FUP-X-1** — done\n'))
  expectRed('fup-resolved', checkFupIndex('## Follow-ups\n- 🟠 **FUP-X-2** — ✅ **RESOLVED 2026-01-01**\n'))
  expectGreen(
    'fup-partial-green',
    checkFupIndex('## Follow-ups\n- 🟠 **FUP-X-3** — ✅ **Local half CLOSED by measurement**\n'),
  )

  expectRed('fup-body', checkFupBodies('## Follow-ups\n- 🔴 **FUP-GHOST-1** — no body\n', 'unrelated'))
  expectGreen(
    'fup-body-green',
    checkFupBodies('## Follow-ups\n- 🔴 **FUP-REAL-1** — has body\n', '## FUP-REAL-1\nbody'),
  )

  const cell = (body) => `## Decisions\n| 2026-01-01 | ${body} | ref |\n`
  expectRed('cell-long', checkCellShape(cell('x'.repeat(MAX_CELL + 1))))
  expectRed('cell-open-code', checkCellShape(cell('Migration `20260')))
  expectRed('cell-open-bold', checkCellShape(cell('**cut mid-span')))
  expectGreen('cell-green', checkCellShape(cell('Migration `20260928000700` is **done**')))
  // The §7 carve-out must be provably a carve-out, not an accident of the fixture.
  expectGreen(
    'cell-exempt-green',
    checkCellShape(`## ⭐⭐ Critical FUP\n| a | ${'x'.repeat(MAX_CELL + 1)} |\n`),
  )
  expectRed('bullet-long', checkBulletLength(`## Bug Log\n- ${'x'.repeat(MAX_BULLET)}\n`))
  expectGreen(
    'bullet-exempt-green',
    checkBulletLength(`## Follow-ups\n- ${'x'.repeat(MAX_BULLET)}\n`),
  )

  expectRed('link-broken', checkLinks('X.md', '[a](does-not-exist.md)\n', () => false))
  expectRed('link-anchor', checkLinks('X.md', '# Title\n[a](#missing-anchor)\n', () => true))
  expectGreen('link-green', checkLinks('X.md', '# My Title\n[a](#my-title) [b](real.md)\n', () => true))
  expectGreen('link-codespan-green', checkLinks('X.md', 'prose `](docs/gone.md)` about links\n', () => false))

  expectRed('eol', checkEol('X.md', 'a\r\nb'))

  if (fails.length) {
    console.error(`check-progress-doc SELF-TEST FAILED — checker(s) cannot fire: ${fails.join(', ')}`)
    process.exit(2)
  }
}

// --------------------------------------------------------------------------
function main() {
  selfTest()
  if (process.argv.includes('--self-test')) {
    console.log('check-progress-doc: self-test OK (all checkers proven able to fail)')
    return
  }

  const findings = []
  const progressPath = join(ROOT, 'PROGRESS.md')
  const progress = readFileSync(progressPath, 'utf8')

  findings.push(...checkSize(statSync(progressPath).size))
  findings.push(...checkSections(progress))
  findings.push(...checkPhaseRows(progress))
  findings.push(...checkFupIndex(progress))
  findings.push(...checkCellShape(progress))
  findings.push(...checkBulletLength(progress))

  const bodies = readFileSync(join(ROOT, 'docs', 'progress', 'follow-ups.md'), 'utf8')
  findings.push(...checkFupBodies(progress, bodies))

  for (const f of LINK_CHECKED_DOCS) {
    const text = readFileSync(join(ROOT, f), 'utf8')
    findings.push(...checkLinks(f, text, (p) => existsSync(resolve(ROOT, p))))
  }
  for (const f of TRACKER_DOCS) {
    findings.push(...checkEol(f, readFileSync(join(ROOT, f), 'utf8')))
  }

  if (findings.length) {
    console.error(`check-progress-doc: ${findings.length} finding(s)\n`)
    for (const f of findings) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log('check-progress-doc: OK (self-test + live-state contract hold)')
}

main()
