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
 *   1. SIZE      — PROGRESS.md TARGETS 80 KB and HARD-FAILS at 100 KB (PO instruction
 *                  2026-08-27, ADR 0124 Amdt 3). The band between them WARNS on every
 *                  run. This reverses the original "hard fail, no warn band" rule,
 *                  whose stated fear was that "a warn band is a figure someone has to
 *                  notice, and figures nobody must act on go stale". That fear is
 *                  answered by CONSTRUCTION, not by trust: the warning is emitted by
 *                  this script on every `npm run lint`, into the same stream as a
 *                  finding, and it names the byte count and the target. It is not a
 *                  figure in prose that someone must remember to check — the failure
 *                  mode the old rule was written against. What the single hard cap
 *                  actually produced was the OPPOSITE defect: at 40 bytes of headroom
 *                  (measured 2026-08-27) every status write became a rotation
 *                  emergency, and compression under that pressure cuts QUALIFIERS
 *                  first — the bound on a fact is its shortest clause and reads as
 *                  hedging. The target keeps the rotation pressure; the cap stops the
 *                  file from becoming a hostage to it.
 *                  ⛔ The band is NOT permission to sit at 99 KB. Rotate at 80 KB.
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
 *                  broken at the moment the destinations were added here. Quarterly
 *                  § Now archives (<YYYY>-Q<n>.md, ADR 0139) are discovered by
 *                  pattern, with a zero-match positive control.
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
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const SIZE_TARGET = 80 * 1024
const SIZE_CAP = 100 * 1024
const CLAUDE_SIZE_CAP = 40 * 1024
const MAX_CELL = 300
const MAX_BULLET = 400

const TRACKER_DOCS = ['PROGRESS.md', 'CLAUDE.md', 'ARCHITECTURE.md', 'PHASES.md']

/**
 * Link-checked docs beyond docs/progress/. The link domain was once a hand-registered
 * list of rotation destinations here — and every widening of it found debt the registry
 * had been hiding: 41 broken links the moment the first three destinations were added,
 * 130 more the moment the sweep went REGISTRY-FREE (2026-08-24, ADR 0140). Since then
 * main() sweeps EVERY docs/progress/*.md, so a new destination or narrative file is
 * covered the day it is created, with no list to keep current.
 */
const LINK_CHECKED_DOCS = ['PROGRESS.md', 'CLAUDE.md']

/**
 * Quarterly § Now archives (ADR 0139): concluded § Now bullets rotate verbatim to
 * docs/progress/<YYYY>-Q<n>.md, keyed to the ROTATION date. The full sweep link-checks
 * them like everything else; this pattern remains as the ZERO-MATCH control's subject —
 * 2026-Q3.md exists from 2026-08-24 and archives never delete, so a directory listing
 * with no quarterly file means the sweep is looking at the wrong directory.
 */
export const QUARTERLY_ARCHIVE_RE = /^\d{4}-Q[1-4]\.md$/

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

const ROTATION_ADVICE =
  `Rotate at the property level: completed rows -> phase-ledger.md, resolved FUP lines ` +
  `-> follow-ups-archive.md, concluded S-Now bullets -> the current quarter's ` +
  `docs/progress/<YYYY>-Q<n>.md (ADR 0139), concluded gate/QA/decision rows -> their ` +
  `archives. Never trim Critical FUP or OPEN index lines.`

export function checkSize(bytes) {
  return bytes <= SIZE_CAP
    ? []
    : [
        `PROGRESS.md is ${bytes} bytes — OVER the ${SIZE_CAP}-byte HARD CAP. ` +
          ROTATION_ADVICE,
      ]
}

/**
 * The soft target (ADR 0124 Amdt 3). Non-fatal BY DESIGN and loud by construction —
 * main() prints it on every run, green or red, so it is never a figure someone has to
 * remember to go and look up. ⛔ Do NOT promote this to a finding to "be safe": the
 * whole point of the band is that a status write at 81 KB is not an emergency. And
 * ⛔ do NOT raise SIZE_TARGET to silence it — that is the lint:set-local watermark
 * lesson (bumping the watermark grandfathers the growth you just wrote and flips the
 * rot direction from stricter to weaker). Rotate instead.
 */
export function warnSize(bytes) {
  return bytes > SIZE_TARGET && bytes <= SIZE_CAP
    ? [
        `PROGRESS.md is ${bytes} bytes — over the ${SIZE_TARGET}-byte TARGET ` +
          `(hard cap ${SIZE_CAP}, ${SIZE_CAP - bytes} bytes left). Rotate NOW, while it ` +
          `is still a choice: compression under cap pressure cuts qualifiers first. ` +
          ROTATION_ADVICE,
      ]
    : []
}

/**
 * CLAUDE.md is loaded by every session AND every teammate spawn — the one file where
 * bytes are paid on every context, which PROGRESS.md never was. It had the pre-ADR-0124
 * disease PROGRESS.md was cured of: monotonic growth (32 KB on 2026-08-19 → 37,291 B on
 * 2026-08-24) with no cap and no rotation pressure. The cap forces the same conscious
 * "what leaves" decision. ⛔ NEVER raise the cap to make a red pass — that is the
 * lint:set-local watermark lesson (a bumped watermark grandfathers the growth you just
 * wrote and flips the rot direction). Rotate content into ARCHITECTURE.md, an ADR, or a
 * path-scoped rule instead; raising the cap is a PO decision recorded in an ADR (0140).
 */
export function checkClaudeSize(bytes) {
  return bytes <= CLAUDE_SIZE_CAP
    ? []
    : [
        `CLAUDE.md is ${bytes} bytes (cap ${CLAUDE_SIZE_CAP}). It is loaded by EVERY session ` +
          `and every teammate spawn. Rotate content to ARCHITECTURE.md, an ADR, or a ` +
          `.claude/rules/ rule — never raise the cap to pass (ADR 0140).`,
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

/**
 * A REAL register entry for `id`, as opposed to a mention of it: a line whose OWN LEADING
 * BOLD TOKEN is that id. `[^*\n]*` before the bold is what carries the distinction — it
 * forbids an earlier bold span, so `- 🟠 **FUP-A** — … compare **FUP-B**` registers
 * **A only**, and a backticked mention with no bold at all (`see 🟠 \`FUP-C\``) registers
 * nothing.
 *
 * ⛔ The property is deliberately "the line is ABOUT this item from its first word", NOT
 * "the line is a list item" — a narrower shape rule would have rejected the retention note
 * for FUP-DM5-NO-ANSWER-VS-NOTHING, which the **PO ruled on 2026-08-28 IS that body's
 * register entry** (follow-ups-archive.md § the six-note block). It is an italic note, not
 * a bullet. Leading markers are therefore optional and cover the four live shapes: `- `
 * bullets, `- [ ]` checkboxes (the parked backlog), `_` italic notes, `> ` quotes.
 * Backticks inside the bold are optional — the parked backlog writes one entry as
 * ``**`FUP-X`**``.
 */
const indexEntryRe = (id) =>
  new RegExp(`^[-_>]?\\s*(?:\\[[ x]\\]\\s*)?[^*\\n]*\\*\\*\`?${id}\`?\\*\\*`, 'mu')

/**
 * § Critical FUP is a TABLE, not a list, and it is PO-curated (CLAUDE.md §7 protects it
 * from rotation). A row there is a register entry in its own right.
 */
const criticalRowRe = (id) => new RegExp(`^\\|[^|\\n]*\\|[^*\\n]*\\*\\*\`?${id}\`?\\*\\*`, 'mu')

/**
 * INVERSE of checkFupBodies (ADR 0140): a body in follow-ups.md that no live register
 * ENTRY indexes is residue — resolved (its body belongs in follow-ups-archive.md) or
 * worse, an ORPHAN whose index line was deleted instead of moved. Two orphans were found
 * at the 2026-08-24 sweep (FUP-DM5-MANIFEST-FLAG, FUP-DM5-REMOTE-STATE-MEASURED — both
 * resolved, indexed NOWHERE). A session that greps follow-ups.md and lands on such a body
 * has no way to see the item is not open.
 *
 * ⛔ **LIVE used to mean `progressText.includes(id)` — a substring hit anywhere in the
 * file — and that is the hole this check was built to close.** An id named in ordinary
 * prose kept its body "indexed": FUP-DISPOSE-DIALOG-OVERCLAIM closed 2026-08-20 and rode a
 * ⛔ note *about its closure instrument* for eleven days, invisible to this gate, and
 * surfaced only when the 2026-08-31 cleanup cut the note for unrelated reasons. The old
 * docstring called the width "deliberately over-inclusive… the safe failure direction is
 * under-flagging"; that reasoning was sound about the REMEDY and wrong about the TEST —
 * the way to keep an open body safe is to make the finding's prescribed action safe, not
 * to make the detector blind.
 *
 * So the width moved into the VERDICT instead. Two kinds, and the difference is which
 * action is correct:
 *   • MENTION-ONLY — the id is in a live register file but not as an entry. The item may
 *     well be open, so the prescribed action is **restore the index line**, and the
 *     finding says in terms that deleting the body is the wrong repair.
 *   • ABSENT — indexed nowhere at all. The original orphan case, unchanged.
 */
export function checkFupBodyResidue(bodiesText, progressText, backlogText) {
  const out = []
  const seen = new Set()
  for (const m of bodiesText.matchAll(/^#{2,4} .*?(FUP-[A-Z0-9-]+)/gmu)) {
    const id = m[1]
    if (seen.has(id)) continue
    seen.add(id)

    const entry =
      indexEntryRe(id).test(progressText) ||
      criticalRowRe(id).test(progressText) ||
      indexEntryRe(id).test(backlogText)
    if (entry) continue

    const mentioned = progressText.includes(id) || backlogText.includes(id)
    out.push(
      mentioned
        ? `docs/progress/follow-ups.md — body for ${id} is MENTIONED in a live register but ` +
            `has no index ENTRY (no line, and no § Critical FUP row, whose own LEADING BOLD ` +
            `TOKEN is ${id}). A mention is not an index line: it keeps the body ` +
            `reachable by grep while the register the PO reads from does not carry the item. ` +
            `⛔ If it is OPEN, restore its index line — do NOT resolve this finding by ` +
            `deleting the body. If it is RESOLVED, move the body VERBATIM to ` +
            `follow-ups-archive.md and cut the mention with it.`
        : `docs/progress/follow-ups.md — body for ${id}, but NO live register indexes it ` +
            `(not in PROGRESS.md, not in deferred-backlog.md). If it is resolved, move the ` +
            `body VERBATIM to follow-ups-archive.md; if it is open, its index line was ` +
            `LOST — restore it (QA finding R3: a follow-up with no index line is invisible work).`,
    )
  }
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

  // ADR 0124 Amdt 3 — the soft target. Three properties, because a two-threshold size
  // check has three failure modes a one-threshold check did not have:
  //   (a) the band is NON-EMPTY. If SIZE_TARGET ever reaches SIZE_CAP the warn can
  //       never fire for any input, and a warner that cannot warn is the vacuous-gate
  //       class this whole self-test exists to prevent — it would pass (b) and (c)
  //       below by being silent, which is exactly what "green" looks like.
  //   (b) the warn FIRES inside the band and is SILENT below the target.
  //   (c) the warn stops at the cap and the HARD FAIL takes over — proven at the
  //       boundary, not at a comfortable midpoint, since off-by-one at SIZE_CAP is the
  //       one place the two checkers could both go quiet and leave a gap.
  if (SIZE_TARGET >= SIZE_CAP) fails.push('size-band-empty')
  expectRed('size-warn', warnSize(SIZE_TARGET + 1))
  expectRed('size-warn-at-cap', warnSize(SIZE_CAP))
  expectGreen('size-warn-under-target-green', warnSize(SIZE_TARGET))
  expectGreen('size-warn-over-cap-green', warnSize(SIZE_CAP + 1))
  expectGreen('size-in-band-not-a-finding', checkSize(SIZE_TARGET + 1))

  expectRed('claude-size', checkClaudeSize(CLAUDE_SIZE_CAP + 1))
  expectGreen('claude-size-green', checkClaudeSize(CLAUDE_SIZE_CAP))

  // ADR 0140: the residue check must fire on an unindexed body, and stay quiet for a
  // body indexed in EITHER live register.
  expectRed('fup-residue', checkFupBodyResidue('## ⬛ FUP-GONE-1 — done\n', 'no mention', 'none'))
  expectGreen(
    'fup-residue-live-green',
    checkFupBodyResidue('## 🔴 FUP-LIVE-1 — x\n', '- 🔴 **FUP-LIVE-1** — open', ''),
  )
  expectGreen(
    'fup-residue-backlog-green',
    checkFupBodyResidue('### FUP-BACK-1 — x\n', '', '- 🟡 **FUP-BACK-1** — parked'),
  )

  // ── The mention-vs-entry distinction, pinned in BOTH directions ──────────────────
  // The regression specimen, verbatim in shape: a body kept "indexed" by a ⛔ note ABOUT
  // it. This passed the old `includes(id)` test for eleven days, which is why it is the
  // first assertion here and not the last.
  const mentionOnly = '- ⛔ **`FUP-MENTION-1`’s closure instrument was SWAPPED** — prose'
  expectRed(
    'fup-residue-mention-only',
    checkFupBodyResidue('## ⬛ FUP-MENTION-1 — x\n', mentionOnly, ''),
  )
  // …and it must name the RIGHT repair. A mention-only finding that reads like the orphan
  // finding would send a session to delete an open body — the failure the old width was
  // (correctly) afraid of, now handled in the verdict instead of by going blind.
  if (!/restore its index line/.test(checkFupBodyResidue('## FUP-M2 — x\n', 'see FUP-M2', '')[0] ?? ''))
    fails.push('fup-residue-mention-wrong-remedy')
  // A prose mention in the MIDDLE of another item's line is the same hole, one step in.
  expectRed(
    'fup-residue-mention-mid-line',
    checkFupBodyResidue('## FUP-MID-1 — x\n', '- 🟠 **FUP-OTHER** — compare **FUP-MID-1**', ''),
  )
  // ⛔ VACUITY CONTROL: the tightened matcher must still accept every real entry shape, or
  // it would red the whole live register and read as "the tracker is broken".
  for (const [name, entry] of [
    ['emoji', '- 🟡 **FUP-SHAPE-1** — open'],
    ['checkbox', '- [ ] **`FUP-SHAPE-1`** — parked'],
    ['critical-row', '| **C9** | 🔒 **`FUP-SHAPE-1`** — the PO list | do the thing |'],
    // The PO-ruled retention note (2026-08-28) is an ITALIC note, not a bullet. A
    // list-item-only rule would have red-flagged the one entry a human explicitly ruled on.
    ['italic-note', '_**FUP-SHAPE-1** — ✅ resolved; body deliberately STAYS as a review lens._'],
  ])
    expectGreen(`fup-residue-entry-${name}-green`, checkFupBodyResidue('## FUP-SHAPE-1 — x\n', entry, ''))
  // ⛔ The loosened leading marker must NOT re-open the hole: a backticked mention with no
  // bold, and a bold mention that is not the line's first, both still register nothing.
  expectRed(
    'fup-residue-backticked-mention',
    checkFupBodyResidue('## FUP-TICK-1 — x\n', '  not covered at all — see 🟠 `FUP-TICK-1`.', ''),
  )

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

  // ADR 0139: the quarterly-archive discovery pattern, proven able to match AND to
  // reject — a pattern that matches nothing makes the quarterly loop vacuous, and one
  // that matches everything link-checks files the list never promised to cover.
  if (!QUARTERLY_ARCHIVE_RE.test('2026-Q3.md')) fails.push('quarterly-re-match')
  if (
    QUARTERLY_ARCHIVE_RE.test('now-concluded-2026-08.md') ||
    QUARTERLY_ARCHIVE_RE.test('2026-Q5.md') ||
    QUARTERLY_ARCHIVE_RE.test('x2026-Q3.md')
  ) {
    fails.push('quarterly-re-reject')
  }

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
  const warnings = []
  const progressPath = join(ROOT, 'PROGRESS.md')
  const progress = readFileSync(progressPath, 'utf8')

  const progressBytes = statSync(progressPath).size
  findings.push(...checkSize(progressBytes))
  warnings.push(...warnSize(progressBytes))
  findings.push(...checkClaudeSize(statSync(join(ROOT, 'CLAUDE.md')).size))
  findings.push(...checkSections(progress))
  findings.push(...checkPhaseRows(progress))
  findings.push(...checkFupIndex(progress))
  findings.push(...checkCellShape(progress))
  findings.push(...checkBulletLength(progress))

  const bodies = readFileSync(join(ROOT, 'docs', 'progress', 'follow-ups.md'), 'utf8')
  findings.push(...checkFupBodies(progress, bodies))
  const backlog = readFileSync(join(ROOT, 'docs', 'progress', 'deferred-backlog.md'), 'utf8')
  findings.push(...checkFupBodyResidue(bodies, progress, backlog))

  // Registry-free link sweep (ADR 0140): EVERY docs/progress/*.md. The zero-match
  // control stands guard on the sweep itself: 2026-Q3.md exists from 2026-08-24 and
  // archives never delete, so a listing with no quarterly archive means the sweep is
  // reading the wrong directory — absence of a verdict is not absence of coverage.
  const progressDocs = readdirSync(join(ROOT, 'docs', 'progress'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/progress/${f}`)
  if (!progressDocs.some((f) => QUARTERLY_ARCHIVE_RE.test(f.slice('docs/progress/'.length)))) {
    findings.push(
      `no docs/progress/<YYYY>-Q<n>.md quarterly archive found — 2026-Q3.md exists since ` +
        `2026-08-24 and archives never delete, so a zero match means the link sweep is ` +
        `reading the wrong directory and docs/progress is silently unchecked.`,
    )
  }

  for (const f of [...LINK_CHECKED_DOCS, ...progressDocs]) {
    const text = readFileSync(join(ROOT, f), 'utf8')
    findings.push(...checkLinks(f, text, (p) => existsSync(resolve(ROOT, p))))
  }
  for (const f of TRACKER_DOCS) {
    findings.push(...checkEol(f, readFileSync(join(ROOT, f), 'utf8')))
  }

  // Warnings print FIRST and on BOTH paths — a soft target that only surfaces when
  // something else already failed is a figure nobody sees, which is the objection the
  // original no-warn-band rule raised and the reason this block is unconditional.
  for (const w of warnings) console.error(`  ⚠ ${w}`)

  if (findings.length) {
    console.error(`check-progress-doc: ${findings.length} finding(s)\n`)
    for (const f of findings) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(
    `check-progress-doc: OK (self-test + live-state contract hold)` +
      (warnings.length ? ` — with ${warnings.length} size warning(s) above` : ''),
  )
}

// Run only as the entry point, so sibling tooling can `import` the checkers instead of
// re-implementing them — a second implementation would be free to disagree with the gate.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
