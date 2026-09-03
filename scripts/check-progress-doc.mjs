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
 *   1. SIZE      — PROGRESS.md TARGETS 20 KB and HARD-FAILS at 30 KB (ADR 0185 D6, which cut
 *                  § Now, § Bug Log, § Critical FUP, § Follow-ups, § Decisions, § Test Run
 *                  Summary and § QA Verdicts out of the file: 48 KB → ~12 KB + a generated
 *                  roll-up. The 80 / 100 KB figures were ADR 0124 Amdt 3 and the rationale
 *                  below is theirs; it still holds at the new scale.) The band WARNS on every
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
 *   2. SECTIONS  — the required live sections exist (§ Phase Status, § State — matched on
 *                  their stable noun, so emoji/decoration drift does not red the gate), AND
 *                  the sections ADR 0185 D6 moved OUT (§ Now → the hubs' Current-state blocks,
 *                  § Bug Log → docs/bugs/BUGS.md, § Critical FUP + § Follow-ups → the register,
 *                  § Decisions → the ADR index, § Test Run Summary + § QA Verdicts → the hubs)
 *                  have NOT come back — the first heading back reds. Same shape as the old 4c:
 *                  "just one line here" is how a cut section restarts.
 *   3. PHASES    — no row in § Phase Status has "complet…" in its Status cell. A
 *                  completed row's home is docs/progress/phase-ledger.md; the row
 *                  moves there VERBATIM in the same change that would make this red.
 *   4. REGISTER  — ADR 0179 folded the § Follow-ups one-line index INTO the bodies, so
 *                  the OPEN register is ONE file (docs/followups/follow-ups-open.md — moved
 *                  out of docs/progress/ by ADR 0185 D5; REGISTER_DIR is the one place that
 *                  knows) and an item is ONE `### ` entry. The properties below replace the
 *                  two that the merge would have left VACUOUSLY GREEN rather than red; the
 *                  FIELDS on each entry (Filed · Owner · Severity · Closes when · Status ·
 *                  Revisit when · Body) are lint:registers' job, not this gate's:
 *                    a. no RESOLVED entry left in the open register — opt-out only via
 *                       an explicit, ENTRY-SCOPED `**Retained**` line, so the exemption
 *                       is readable where it applies instead of allowlisted in here;
 *                    b. no duplicate id, and no id with an entry in BOTH the register
 *                       and follow-ups-archive.md (open-vs-resolved answered both ways);
 *                    c. RETIRED by ADR 0185 D6 — § Follow-ups itself may no longer exist in
 *                       PROGRESS.md (SECTIONS forbids the heading), so "must not re-grow an
 *                       index" has no section to check; a check kept against an absent
 *                       section passes vacuously, which is the shape this file refuses.
 *                       History: that section was 125 lines / 51 KB (53 % of the file);
 *                    d. RETIRED by ADR 0185 D5 — § Critical FUP moved INTO the register as a
 *                       pinned section; its orphan check lives in lint:registers
 *                       (criticalIdsOf). Same vacuity argument as c;
 *                    e. RETIRED by ADR 0186 D4 — deferred-backlog.md is DELETED, merged into
 *                       the register as `**Status:** parked` entries, so "an id entered in
 *                       both the register and the backlog" has no second file to compare
 *                       against; checkDoubleRegistration and its indexEntryRe helper retired
 *                       with it (a `**Status:** parked` entry with no Revisit when is now
 *                       lint:registers' job, same file, one register). Same vacuity argument
 *                       as c and d — a comparison against a deleted file passes vacuously.
 *                  Bounded property, unchanged: ids matching FUP-[A-Z0-9-]+ only;
 *                  legacy un-prefixed items (e.g. "AUTHZ Gate-2 MINOR-1") are outside
 *                  the domain. Partial states (HALF / PARTIALLY / PO-RULED) are OPEN.
 *   6. LINKS     — every relative markdown link resolves to an existing file; same-file
 *                  #anchors resolve to a heading (compared alphanumeric-only, so
 *                  punctuation/emoji slugging cannot false-red). Domain is PROGRESS.md,
 *                  CLAUDE.md, every docs/progress/*.md, docs/followups/*.md and docs/bugs/*.md
 *                  (the rotation destinations, ADR 0185 D3/D5) — rotating verbatim into
 *                  an unchecked file is how 474 links broke once and 41 more were found
 *                  broken at the moment the destinations were added here. Quarterly
 *                  § Now archives (<YYYY>-Q<n>.md, ADR 0139) are discovered by
 *                  pattern, with a zero-match positive control.
 *   8. CELLS     — in the capped sections only (CAPPED_SECTIONS): cell length, plus
 *                  unbalanced inline-code / bold spans, which is the class where a
 *                  compression pass cut a cell mid-token and every gate stayed green.
 *   9. BULLETS   — bullet length, same capped sections (§ Phase Status alone since ADR 0185
 *                  D6). § Critical FUP was EXEMPT BY DECISION while it lived here (CLAUDE.md
 *                  §7); it lives in the register now. ⛔ The OPEN follow-up index used to be the
 *                  second exemption; ADR 0179 moved it out of this file entirely, and
 *                  follow-ups-open.md is not length-capped at all — cap pressure must
 *                  never land on the register, because compression under cap pressure
 *                  cuts qualifiers first.
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
const SIZE_TARGET = 20 * 1024 // ADR 0185 D6 (was 80 KB, ADR 0124 Amdt 3)
const SIZE_CAP = 30 * 1024 // ADR 0185 D6 (was 100 KB)
/** ADR 0185 D5 moved the follow-up register out of docs/progress/. One constant, one place. */
const REGISTER_DIR = 'docs/followups'
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
 * Sections the shape caps apply to. § Critical FUP is EXEMPT BY DECISION — CLAUDE.md §7
 * protects it by name ("don't satisfy the size cap by trimming § Critical FUP"), and
 * density is the point there. § Now and § State are live working state, likewise exempt.
 * ⛔ The OPEN follow-up index was the second named exemption until ADR 0179 moved the
 * register out of this file (now docs/followups/follow-ups-open.md, ADR 0185 D5); since
 * ADR 0185 D6 § Follow-ups and § Critical FUP may not exist here at all (FORBIDDEN_SECTIONS),
 * so the only capped section left is § Phase Status.
 *
 * BOUNDED PROPERTY, STATED: this is an allowlist of headings, so a NEW section is
 * uncapped until someone adds it here. That is the known cost of honouring the §7
 * carve-out; the alternative (cap everything, exempt by regex) inverts which side
 * of the boundary a mistake lands on.
 */
const CAPPED_SECTIONS = [/^## Phase Status\b/]

/** Required sections, matched on the stable noun so decoration drift can't red. */
const REQUIRED_SECTIONS = [/^## Phase Status\b/m, /^## .*State/m]

/**
 * Sections ADR 0185 D6 moved OUT of PROGRESS.md, with where each went. The first heading that
 * comes back reds — a cut section restarts one line at a time, and the record shows § Now was
 * 17 KB of diary within a month of being created as "current phase & next actions".
 */
const FORBIDDEN_SECTIONS = [
  [/^## Now\b/m, "the owning hub's `## Current state` block (docs/features/<code>.md, ADR 0185 D2)"],
  [/^## Bug Log\b/m, 'docs/bugs/BUGS.md (ADR 0185 D3)'],
  [/^## .*Critical FUP/m, `the pinned Critical section at the top of ${REGISTER_DIR}/follow-ups-open.md (ADR 0185 D5)`],
  [/^## Follow-ups/m, `${REGISTER_DIR}/follow-ups-open.md (ADR 0179 + 0185 D5)`],
  [/^## Decisions\b/m, 'docs/decisions/INDEX.md, which is generated (ADR 0185 D6)'],
  [/^## Test Run Summary\b/m, "the owning hub's Current state / progress record (ADR 0185 D6)"],
  [/^## QA Verdicts\b/m, 'the review file and the owning hub (ADR 0185 D6)'],
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
  `Rotate at the property level: completed phase rows -> phase-ledger.md; a completed hub's ` +
  `Current state -> its progress record (status: complete); resolved FUP entries -> ` +
  `${REGISTER_DIR}/follow-ups-archive.md; a closed bug flips its BUGS.md status cell. ` +
  `Nothing else should be in this file (ADR 0185 D6).`

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

/** ADR 0185 D6: a section that was cut may not return. The first heading back reds. */
export function checkForbiddenSections(text) {
  return FORBIDDEN_SECTIONS.filter(([re]) => re.test(text)).map(
    ([re, home]) =>
      `PROGRESS.md has a section ADR 0185 D6 moved out (heading matching ${re}). Its home is ` +
      `${home}; put the content there and delete the heading — one line back is how a cut ` +
      `section regrows.`,
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

/**
 * ⛔ RESOLVED_LINE (`/^- (⬛|.*✅ ?\*{0,2}(RESOLVED|CLOSED)\b)/u`) lived here and matched a
 * BULLET. ADR 0179 left no bullets to match, so it was replaced by RESOLVED_HEADING rather
 * than retargeted — a bullet regex pointed at a file of headings is not a stricter check, it
 * is a check that never fires.
 */

/**
 * An entry heading in the OPEN register (REGISTER_DIR/follow-ups-open.md). ADR 0179 merged
 * the one-line index that lived in PROGRESS.md § Follow-ups INTO the bodies, so an item is
 * now ONE `### ` entry and the headings ARE the index.
 */
const REGISTER_ENTRY = /^### (.*?(FUP-[A-Z0-9-]+).*)$/gmu
const RESOLVED_HEADING = /⬛|✅ ?\*{0,2}(RESOLVED|CLOSED)\b/u
/** The opt-out for a resolved entry deliberately kept as a review lens — must be EXPLICIT. */
const RETAINED = /\*\*Retained\*\*|body deliberately STAYS/u

/**
 * ⛔ RETIRED (ADR 0185 D6): checkNoIndexInProgress asked whether PROGRESS.md § Follow-ups had
 * re-grown an index line. That section may no longer EXIST (FORBIDDEN_SECTIONS), so the check
 * would have passed vacuously on every run — the shape this file exists to refuse — and its
 * concern is now the stricter one: the heading itself reds. Retired with its self-tests rather
 * than retargeted, the same way RESOLVED_LINE was.
 */

/**
 * A RESOLVED entry left in the OPEN register. Succeeds checkFupIndex, which asked the same
 * question of the PROGRESS.md index lines that no longer exist.
 *
 * ⛔ The opt-out is deliberately narrow and must be WRITTEN IN THE ENTRY: one body
 * (FUP-DM5-NO-ANSWER-VS-NOTHING) is PO-ruled to stay as a review lens. An entry claiming the
 * exemption has to say so where a reader sees it — an allowlist in this script would silence
 * the measured cases along with the unmeasurable one.
 */
export function checkRegisterResolved(registerText) {
  const out = []
  const lines = registerText.split('\n')
  lines.forEach((line, i) => {
    if (!line.startsWith('### ')) return
    const id = /FUP-[A-Z0-9-]+/u.exec(line)
    if (!id || !RESOLVED_HEADING.test(line)) return
    // the entry body runs to the next `### ` heading
    let j = i + 1
    while (j < lines.length && !lines[j].startsWith('### ')) j++
    const block = lines.slice(i, j).join('\n')
    if (RETAINED.test(block)) return
    out.push(
      `${REGISTER_DIR}/follow-ups-open.md:${i + 1} — RESOLVED entry ${id[0]} is still in the OPEN ` +
        `register. Move the WHOLE entry verbatim to follow-ups-archive.md (append before the ` +
        `cut, cmp-verify). If it is deliberately retained as a review lens, say so in the entry ` +
        `with a **Retained** line — the exemption has to be readable, not remembered.`,
    )
  })
  return out
}

/**
 * Two integrity properties the merged register still needs, because merging index and body
 * removed the old cross-check rather than the risk it covered:
 *   • a DUPLICATE id — two entries for one item, so an edit lands on one of them;
 *   • an id with an entry in BOTH the register and the archive — the resolved/open split is
 *     what tells a reader whether the item is live, and a body in both answers both ways.
 * ⛔ Neither could happen while index and body were separate files keyed by one id. They can now.
 */
export function checkRegisterIntegrity(registerText, archiveText) {
  const out = []
  const seen = new Map()
  for (const m of registerText.matchAll(REGISTER_ENTRY)) {
    const id = m[2]
    if (seen.has(id)) {
      out.push(
        `${REGISTER_DIR}/follow-ups-open.md — DUPLICATE entry for ${id}. One item is one entry; ` +
          `two entries mean an edit reaches one of them. Merge them, keeping every claim.`,
      )
      continue
    }
    seen.set(id, true)
  }
  const archived = new Set(
    [...archiveText.matchAll(/^#{2,4} .*?(FUP-[A-Z0-9-]+)/gmu)].map((m) => m[1]),
  )
  for (const id of seen.keys()) {
    if (!archived.has(id)) continue
    out.push(
      `${REGISTER_DIR}/follow-ups-open.md — ${id} has an entry in the OPEN register AND a body in ` +
        `follow-ups-archive.md. One of them is wrong: if it is resolved the open entry should ` +
        `have moved, if it is open the archive copy is a stale duplicate. ⛔ Do not resolve this ` +
        `by deleting either one until you know which.`,
    )
  }
  return out
}

/**
 * ⛔ RETIRED (ADR 0185 D5): checkCriticalRowsHaveEntries asked whether a PROGRESS.md § Critical
 * FUP row pointed at a register entry. The section moved INTO the register as a pinned
 * `## ⭐⭐ Critical` block, so the same question — a Critical id with no entry — is asked there by
 * lint:registers (criticalIdsOf + CRITICAL_PIN_REQUIRED). Kept here it would pass vacuously on a
 * section FORBIDDEN_SECTIONS forbids. Retired with its self-tests, criticalRowRe with it.
 *
 * ⛔ RETIRED (ADR 0186 D4): `indexEntryRe` and `checkDoubleRegistration` asked whether a FUP id
 * was entered in BOTH the register and `deferred-backlog.md` — a WARNING, bounded on purpose,
 * because parked-vs-actionable was a judgement this script could not make. That second file is
 * DELETED: every parked item merged into the register as its own `**Status:** parked` entry
 * (with `**Revisit when:**`, lint:registers' job now, same file). A comparison against a file
 * that no longer exists passes vacuously — the exact shape this file exists to refuse — so both
 * are retired with their self-tests rather than retargeted, the same way RESOLVED_LINE was.
 */

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

  // ── ADR 0185 D6: the cut sections may not come back ─────────────────────────────────
  // Asserted before anything else here: the first heading back reds, and a clean file with
  // the two required sections is green. (ADR 0179's "no index line back in § Follow-ups"
  // test lived here; the section itself is forbidden now, so the check and its tests retired.)
  for (const heading of ['## Now — x', '## Bug Log', '## ⭐⭐ Critical FUP — y', '## Follow-ups / Deferred', '## Decisions', '## Test Run Summary', '## QA Verdicts']) {
    expectRed(`forbidden-section:${heading}`, checkForbiddenSections(`# P\n\n${heading}\n\nbody\n`))
  }
  expectGreen('forbidden-section-green', checkForbiddenSections('# P\n\n## Phase Status\n\n## State — x\n'))
  // ⛔ VACUITY CONTROL: a "Now" or "Decisions" mentioned in prose or at h3 is not a section.
  expectGreen(
    'forbidden-section-mention-green',
    checkForbiddenSections('# P\n\n## Phase Status\n\nsee the old Now section; ### Decisions taken\n\n## State\n'),
  )
  expectGreen('sections-required-green', checkSections('## Phase Status\n\n## State — live\n'))

  // A resolved entry must not sit in the OPEN register…
  expectRed(
    'register-resolved',
    checkRegisterResolved('### ⬛ FUP-DONE-1 — finished\n\nbody\n'),
  )
  expectRed(
    'register-resolved-tick',
    checkRegisterResolved('### 🟠 FUP-DONE-2 — ✅ **RESOLVED 2026-01-01**\n\nbody\n'),
  )
  // …unless the entry SAYS it is retained. The exemption is readable, not remembered:
  // FUP-DM5-NO-ANSWER-VS-NOTHING is PO-ruled (2026-08-28) to stay as a review lens.
  expectGreen(
    'register-resolved-retained-green',
    checkRegisterResolved('### ⬛ FUP-LENS-1 — done\n\nits body deliberately STAYS as a lens\n'),
  )
  // ⛔ and the opt-out must not leak to the NEXT entry — an entry-scoped rule that read the
  // whole file would silence every resolved entry after the first retained one.
  expectRed(
    'register-resolved-optout-is-entry-scoped',
    checkRegisterResolved(
      '### ⬛ FUP-LENS-1 — done\n\nbody deliberately STAYS as a lens\n\n### ⬛ FUP-DONE-3 — done\n\nbody\n',
    ),
  )
  // A partial state is still OPEN and must stay green (inherited from the old index check).
  expectGreen(
    'register-partial-green',
    checkRegisterResolved('### 🟠 FUP-HALF-1 — ✅ **Local half CLOSED by measurement**\n\nb\n'),
  )

  // Integrity: a duplicate entry, and an id live in BOTH the register and the archive.
  expectRed(
    'register-duplicate',
    checkRegisterIntegrity('### 🟡 FUP-TWICE-1 — a\n\n### 🟡 FUP-TWICE-1 — b\n', ''),
  )
  expectRed(
    'register-archive-collision',
    checkRegisterIntegrity('### 🟡 FUP-BOTH-1 — open\n', '### ⬛ FUP-BOTH-1 — archived\n'),
  )
  expectGreen(
    'register-integrity-green',
    checkRegisterIntegrity('### 🟡 FUP-OK-1 — open\n', '### ⬛ FUP-OTHER-1 — archived\n'),
  )

  // (Double-registration-vs-backlog and the § Critical FUP orphan test lived here. Both are
  // retired: deferred-backlog.md is deleted (ADR 0186 D4 — merged into the register as
  // `**Status:** parked` entries) and § Critical FUP moved into the register (ADR 0185 D5).
  // lint:registers asserts both questions now, with its own fixtures.)

  expectRed('sections', checkSections('# empty file\n'))

  const phaseFixture =
    '## Phase Status\n| P | N | S | B |\n| - | - | - | - |\n| 3 | Admin | ✅ complete | x |\n'
  expectRed('phase-complete', checkPhaseRows(phaseFixture))
  expectGreen(
    'phase-open-green',
    checkPhaseRows('## Phase Status\n| P | N | S | B |\n| - | - | - | - |\n| 9 | Deploy | 🔜 not started | – |\n'),
  )

  // ⛔ The retired checkFupIndex / checkFupBodies self-tests lived here. Both asked their
  // question of PROGRESS.md index lines that ADR 0179 removed, so BOTH would have passed
  // vacuously rather than failed — the exact shape this file exists to refuse. ADR 0185 then
  // retired checkNoIndexInProgress and checkCriticalRowsHaveEntries for the same reason (their
  // sections are FORBIDDEN now); ADR 0186 D4 retired checkDoubleRegistration/indexEntryRe the
  // same way (deferred-backlog.md, their subject, is deleted). The survivors
  // (checkRegisterResolved, checkRegisterIntegrity) and the successor (checkForbiddenSections)
  // are asserted above.

  const cell = (body) => `## Phase Status\n| 2026-01-01 | ${body} | ref |\n`
  expectRed('cell-long', checkCellShape(cell('x'.repeat(MAX_CELL + 1))))
  expectRed('cell-open-code', checkCellShape(cell('Migration `20260')))
  expectRed('cell-open-bold', checkCellShape(cell('**cut mid-span')))
  expectGreen('cell-green', checkCellShape(cell('Migration `20260928000700` is **done**')))
  // The §7 carve-out must be provably a carve-out, not an accident of the fixture.
  expectGreen(
    'cell-exempt-green',
    checkCellShape(`## ⭐⭐ Critical FUP\n| a | ${'x'.repeat(MAX_CELL + 1)} |\n`),
  )
  expectRed('bullet-long', checkBulletLength(`## Phase Status\n- ${'x'.repeat(MAX_BULLET)}\n`))
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
  findings.push(...checkForbiddenSections(progress))
  findings.push(...checkPhaseRows(progress))
  findings.push(...checkCellShape(progress))
  findings.push(...checkBulletLength(progress))

  // ADR 0179: the OPEN register is ONE file holding entry + body per item (ADR 0185 D5: in
  // REGISTER_DIR). A missing register file is a finding, never a silent skip. ADR 0186 D4:
  // deferred-backlog.md is a THIRD file no longer — it is deleted, merged into the register as
  // `**Status:** parked` entries — so this control now covers exactly the two that remain.
  const regFile = (name) => {
    const p = join(ROOT, REGISTER_DIR, name)
    if (!existsSync(p)) {
      findings.push(`${REGISTER_DIR}/${name} is missing — the register moved there by ADR 0185 D5; a gate that cannot find its subject is not a pass`)
      return ''
    }
    return readFileSync(p, 'utf8')
  }
  const register = regFile('follow-ups-open.md')
  const archive = regFile('follow-ups-archive.md')
  findings.push(...checkRegisterResolved(register))
  findings.push(...checkRegisterIntegrity(register, archive))

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

  // ADR 0185 D3/D5 moved the bug archive and the follow-up register out of docs/progress/;
  // both destinations are swept the same registry-free way, so nothing rotated there is unchecked.
  const movedDocs = [REGISTER_DIR, 'docs/bugs']
    .filter((d) => existsSync(join(ROOT, d)))
    .flatMap((d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`))
  for (const f of [...LINK_CHECKED_DOCS, ...progressDocs, ...movedDocs]) {
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
