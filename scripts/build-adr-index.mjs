#!/usr/bin/env node
/**
 * build-adr-index.mjs — generates and gates `docs/decisions/INDEX.md`.
 *
 *   node scripts/build-adr-index.mjs --write   (= npm run adr:index)      rewrite the index
 *   node scripts/build-adr-index.mjs --check   (= npm run lint:adr-index) gate 9 of `npm run lint`
 *   node scripts/build-adr-index.mjs --self-test                          checkers only
 *
 * WHY A GENERATOR AND NOT A DOCUMENT
 * ----------------------------------
 * The index's load-bearing column is `Changed by` — "ADR 0033 was amended by 0038" — and
 * that is the one fact an ADR file *cannot* carry about itself: it is written after the
 * fact, by a different author, in a different file. Measured 2026-08-24 over 136 ADRs:
 * **50 verb-edges / 42 distinct source→target pairs across 30 amended ADRs**, of which only
 * **5 pairs** carried a hand-written back-pointer (0028, 0032, 0033, 0061, 0120). The other
 * 37 had none: 0078 never mentioned 0079, 0030 never 0037, 0033 never 0038, 0094 never 0095.
 * A session that opened 0033 read a superseded rule with nothing in the file able to
 * contradict it — and the stale text is always the *tighter* rule, so it reads as care.
 * The `BACK-POINTERS` section below closes that: the inverse edge is now generated INTO the
 * amended ADR, so the reader who never opens the index still sees it.
 *
 * Every column here is derived from the ADRs' own header blocks, so the index cannot
 * drift from them: `--check` regenerates and byte-compares. A hand-written index would be
 * the 137th record that rots with no gate — which is exactly what happened to the prose
 * ADR list inside `docs/backend-state.md`, whose own text says it "had stopped in the
 * 0070s" before a catch-up batch.
 *
 * DETERMINISM IS A HARD REQUIREMENT: no timestamps, no counters that depend on anything
 * but the ADR files themselves. A non-deterministic byte anywhere makes the gate red on
 * every run and it gets disabled within a week.
 *
 * EDGES ARE ADVISORY. They are parsed from header labels (`**Supersedes:**`,
 * `**Amends in effect:**`, ...), not from the ADR bodies. The parse is deliberately
 * over-inclusive: a label reading `Supersedes / relates` records the edge, because for an
 * index the failure mode that costs something is a MISSING edge (you read a superseded
 * rule and believe it), not a spurious one (you open one more ADR than you needed).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'docs', 'decisions')
const INDEX_PATH = join(DIR, 'INDEX.md')
const ADR_FILE_RX = /^(\d{4})-(.+)\.md$/
const TITLE_CAP = 88

// --------------------------------------------------------------------------
// PARSE — pure functions over one ADR's text.
// --------------------------------------------------------------------------

/**
 * An ADR's metadata lives between the H1 and the first `##` heading. That boundary is a
 * PROPERTY of the format, not a line count: 32 of 136 files carry metadata past line 15,
 * and 0073's `**Amends:**` sits at line 112 with 0121's `**Status:**` at line 161. Any
 * fixed cap silently drops those.
 */
export function splitPreamble(text) {
  const lines = text.split(/\r?\n/)
  let end = lines.findIndex((l, i) => i > 0 && /^##\s/.test(l))
  if (end < 0) end = lines.length
  return { h1: lines[0] ?? '', preamble: lines.slice(1, end).join('\n') }
}

/** `# ADR 0079 — Long title` / `# 0050 — Title` / `# Title` → `Long title`. */
export function parseTitle(h1) {
  return h1
    .replace(/^#+\s*/, '')
    .replace(/^ADR\s+/i, '')
    .replace(/^\d{4}\s*[—–\-:]\s*/, '')
    .trim()
}

/**
 * Bold metadata labels, with their values.
 *
 * The COLON is what distinguishes a label from ordinary bold emphasis — `**Supersedes:**`
 * vs `**IMMUTABLE**` — so it is required rather than inferred from position. Requiring it
 * is what lets the parser accept a label mid-line (`... always implied). **Supersedes:**
 * nothing.`) without swallowing every bolded word in the preamble.
 *
 * A value runs to the next label or the end of the preamble, so it may span lines: ADR
 * 0137's `**Amends in effect:**` is four lines long.
 */
export function parseLabels(preamble) {
  const rx = /\*\*\s*([A-Za-z][^*\n]{1,44}?)\s*(:?)\s*\*\*(\s*:)?/g
  const hits = []
  for (const m of preamble.matchAll(rx)) {
    const hasColon = m[2] === ':' || Boolean(m[3])
    if (!hasColon) continue
    hits.push({ label: m[1].trim(), start: m.index, end: m.index + m[0].length })
  }
  const out = hits.map((h, i) => ({
    label: h.label,
    value: preamble
      .slice(h.end, i + 1 < hits.length ? hits[i + 1].start : preamble.length)
      .replace(/\s+/g, ' ')
      .replace(/^[\s:·•|;]+/, '')
      .replace(/[\s·•|;,]+$/, '')
      .trim(),
  }))
  // Plain (unbolded) `Status: accepted` — 8 of 136 ADRs never bolded the label.
  for (const key of ['Status', 'Date']) {
    if (out.some((o) => o.label.toLowerCase() === key.toLowerCase())) continue
    const m = preamble.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'im'))
    if (m) out.push({ label: key, value: m[1].trim() })
  }
  return out
}

/**
 * The displayed status is a BUCKET, not the raw line — raw statuses take ~14 shapes here
 * and would blow the table apart. The bucket is read off the LEADING token, so ADR 0028's
 * "Accepted — its no-patient-data stance is superseded by ADR 0030" buckets as Accepted
 * (it is), while its supersession shows up in the edge columns where it belongs.
 */
export function normalizeStatus(raw) {
  if (!raw) return 'unknown'
  const head = raw
    .replace(/[*_`>]/g, '')
    .replace(/^[\s✅⛔⚠🔴🟠🟡🟢·—–-]+/, '')
    .slice(0, 40)
    .toLowerCase()
  if (/^superseded|^withdrawn|^retired/.test(head)) return 'superseded'
  if (/^rejected|^declined/.test(head)) return 'rejected'
  if (/^propos/.test(head)) return 'proposed'
  if (/^draft/.test(head)) return 'draft'
  if (/^defer/.test(head)) return 'deferred'
  if (/^accept|^ratif|^aceito|^po ruling|^shipped|^built|^done|^complete/.test(head)) {
    return 'accepted'
  }
  return 'unknown'
}

const NOTHING_RX = /^(nothing|none|n\/?a|—|–|-)\b/i

/**
 * VOICE decides direction, and getting it wrong inverts the arrow.
 *
 * `**Amends:** ADR 0072` is an OUTGOING claim — "I change 0072". `**Amended (2026-07-14):**`
 * is the opposite: ADR 0073 recording that IT was amended, with other ADR numbers appearing
 * incidentally in the prose that follows. A naive /amend/ test reads the second as the first
 * and produces a backwards edge — measured 2026-08-24, that is exactly what it did, claiming
 * 0072 and 0078 were "amended by 0073" when 0073 is the ADR that was amended.
 *
 * The active forms (`amends`, `supersedes`) never match the passive ones (`amended`,
 * `superseded`) because `\b` fails before the trailing `d`. That is the whole rule.
 *
 * `reverses` maps onto `amends`: ADR 0047's `**Extends / partially reverses:**` genuinely
 * changes what ADR 0032 decision 7 says, which is the case a back-pointer exists for. Plain
 * `**Extends:**` is deliberately NOT an edge — an extended decision still reads true — and
 * the index reports those separately so the exclusion is visible rather than silent.
 */
const SUPERSEDES_RX = /\bsupersedes?\b/i
const AMENDS_RX = /\b(amends?|reverses?|replaces?)\b/i
export const EXTENDS_ONLY_RX = /\bextends?\b/i

/** Header-declared outgoing edges, as `{verb, target}` with `verb` in {supersedes, amends}. */
export function parseEdges(labels, selfNum) {
  const out = []
  for (const { label, value } of labels) {
    const verbs = []
    if (SUPERSEDES_RX.test(label)) verbs.push('supersedes')
    if (AMENDS_RX.test(label)) verbs.push('amends')
    if (!verbs.length) continue
    if (NOTHING_RX.test(value)) continue
    for (const m of value.matchAll(/\b(0\d{3})\b/g)) {
      if (m[1] === selfNum) continue
      for (const verb of verbs) {
        if (!out.some((e) => e.verb === verb && e.target === m[1])) {
          out.push({ verb, target: m[1] })
        }
      }
    }
  }
  return out
}

/**
 * An edge label WITHOUT its colon is invisible — `**Amends** ADR 0097` parses as bold
 * emphasis, the edge is never recorded, and the amended ADR gets no back-pointer. Found
 * LIVE 2026-08-24, one day after this index shipped: 0133 (`**Amends** ADR 0097 D11 +
 * D14` — the D14 retirement invisible in both directions) and 0125 (`**Amends** ADR 0104
 * D7` — declared "knowingly, in writing", and the writing was machine-invisible).
 * PREAMBLE-ONLY by design: bold edge verbs in ADR bodies are prose about other things,
 * and all three body-text hits in the corpus were exactly that. A HARD finding, unlike
 * the advisory anomalies: a colon-less edge label has no legitimate long-lived state —
 * either add the colon (it is a declaration) or unbold the verb (it is prose). The
 * passive voice (`**superseded by**` in the generated back-pointer block) never matches
 * because the verb regexes require the active form.
 */
export function colonlessEdgeLabels(preamble) {
  const out = []
  // Blank inline code spans first (offsets preserved): `**Amends** ADR …` in backticks is
  // prose ABOUT the defect, not an instance of it — ADR 0140's own Context describes this
  // class and was this detector's first false positive. Same defense as checkLinks in
  // check-progress-doc.mjs, for the same reason.
  const text = preamble.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length))
  const rx = /\*\*\s*([A-Za-z][^*\n]{1,44}?)\s*(:?)\s*\*\*(\s*:)?/g
  for (const m of text.matchAll(rx)) {
    if (m[2] === ':' || m[3]) continue
    const label = m[1].trim()
    if (!SUPERSEDES_RX.test(label) && !AMENDS_RX.test(label)) continue
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 160)
    if (/\b0\d{3}\b/.test(after)) out.push(label)
  }
  return out
}

export function parseAdr(file, text) {
  const num = file.slice(0, 4)
  const { h1, preamble } = splitPreamble(text)
  const labels = parseLabels(preamble)
  const pick = (name) => labels.find((l) => l.label.toLowerCase() === name)?.value ?? ''
  const statusRaw = pick('status')
  const dateRaw = pick('date')
  const isoIn = (s) => (s.match(/\b(20\d\d-\d\d-\d\d)\b/) ?? [])[1] ?? ''
  return {
    num,
    file,
    title: parseTitle(h1),
    statusRaw,
    status: normalizeStatus(statusRaw),
    date: isoIn(dateRaw) || isoIn(statusRaw) || isoIn(preamble),
    edges: parseEdges(labels, num),
    malformed: colonlessEdgeLabels(preamble),
  }
}

// --------------------------------------------------------------------------
// ANALYSE — the whole corpus.
// --------------------------------------------------------------------------

/**
 * HARD anomalies (`--check` fails on them even when the index is byte-current) vs SOFT
 * ones (recorded in the generated file). The split is not cosmetic: a soft anomaly still
 * cannot be ignored, because it lands IN the generated bytes, so a new one makes the
 * checked-in index stale and the gate reds until a human regenerates and reads the diff.
 * An escape hatch for the unprovable would silence the proven along with it, so there
 * isn't one — soft findings are reported, never suppressed.
 */
export function analyse(adrs) {
  const byNum = new Map()
  for (const a of adrs) {
    if (!byNum.has(a.num)) byNum.set(a.num, [])
    byNum.get(a.num).push(a)
  }

  const duplicates = [...byNum.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([num, v]) => ({ num, files: v.map((a) => a.file).sort() }))

  const dangling = []
  const incoming = new Map(adrs.map((a) => [a.num, []]))
  for (const a of adrs) {
    for (const e of a.edges) {
      if (!byNum.has(e.target)) {
        dangling.push({ from: a.num, verb: e.verb, target: e.target })
        continue
      }
      incoming.get(e.target).push({ verb: e.verb, from: a.num })
    }
  }

  const nums = [...byNum.keys()].sort()
  const max = nums.length ? Number(nums[nums.length - 1]) : 0
  const missing = []
  for (let i = 1; i <= max; i++) {
    const n = String(i).padStart(4, '0')
    if (!byNum.has(n)) missing.push(n)
  }
  const nextFree = String(max + 1).padStart(4, '0')

  return {
    duplicates,
    dangling,
    missing,
    nextFree,
    incoming,
    malformed: adrs.filter((x) => x.malformed?.length).map((x) => ({ num: x.num, labels: x.malformed })),
    noStatus: adrs.filter((a) => !a.statusRaw).map((a) => a.num),
    unknownStatus: adrs.filter((a) => a.statusRaw && a.status === 'unknown').map((a) => a.num),
    open: adrs.filter((a) => ['proposed', 'draft', 'deferred'].includes(a.status)),
  }
}

export const PROPOSED_REVIEW_MAX_DAYS = 30

/**
 * The Anomalies section tells readers to re-read the proposed/draft/deferred ADR list
 * "periodically" against what is actually built — and a prose cadence is the mechanism
 * this repo has measured failing ("standing" in prose once meant a sweep ran once in
 * three weeks; ADR 0079). `docs/decisions/proposed-review.json` records WHEN that list
 * was last read and WHAT the set was; this check reds when the review is older than
 * PROPOSED_REVIEW_MAX_DAYS or the set has drifted from the stamp. `reviewed: null`
 * means no review has happened yet — the clock runs from `installed`, so the FIRST
 * review comes due 30 days after gate installation rather than being fabricated as
 * already done. CHECK-TIME ONLY: the rendered index stays deterministic (no dates in
 * the bytes); only the exit code is date-dependent, which is the point of an expiry.
 */
export function checkProposedReview(stamp, openNums, todayIso) {
  if (!stamp) {
    return [
      'docs/decisions/proposed-review.json is missing or unreadable — it stamps the last ' +
        'review of the proposed/draft/deferred ADR list (see the Anomalies section).',
    ]
  }
  const findings = []
  const stamped = [...(stamp.proposed ?? [])].sort().join(', ')
  const current = [...openNums].sort().join(', ')
  if (stamped !== current) {
    findings.push(
      `the proposed/draft/deferred ADR set changed since the last review — stamped: ` +
        `[${stamped || 'none'}], current: [${current || 'none'}]. Re-read the changed ADRs ` +
        `against what is built, then update proposed-review.json (set + reviewed date).`,
    )
  }
  const baseline = stamp.reviewed ?? stamp.installed
  if (!baseline) {
    findings.push('proposed-review.json carries neither `reviewed` nor `installed` — no clock to run')
  } else {
    const days = Math.floor((Date.parse(todayIso) - Date.parse(baseline)) / 86400000)
    if (days > PROPOSED_REVIEW_MAX_DAYS) {
      findings.push(
        stamp.reviewed
          ? `the proposed-ADR review is ${days} days old (max ${PROPOSED_REVIEW_MAX_DAYS}) — ` +
              `re-read the list against what is built, then update proposed-review.json.`
          : `the FIRST proposed-ADR review is owed — the gate was installed ${days} days ago ` +
              `(max ${PROPOSED_REVIEW_MAX_DAYS}) and no review has been recorded yet.`,
      )
    }
  }
  return findings
}

/**
 * A CRLF working copy fails the byte-compare and reads as "out of date", sending whoever
 * hits it to regenerate — which fixes nothing, because the next checkout re-introduces the
 * CRs. `.gitattributes` pins `*.md` to `eol=lf`, so this should be unreachable; it exists
 * to name the cause if that pin is ever lost, rather than pointing at the wrong repair.
 */
export function checkEol(text) {
  return text.includes('\r')
    ? [
        'docs/decisions/INDEX.md contains CR characters — it is generated LF-only and ' +
          'byte-compared. Check `.gitattributes` still carries `*.md text eol=lf`; ' +
          'regenerating will NOT hold until it does.',
      ]
    : []
}

export function hardFindings({ duplicates, dangling, malformed }) {
  return [
    ...duplicates.map(
      (d) =>
        `duplicate ADR number ${d.num} — ${d.files.join(' AND ')}. A citation "ADR ${d.num}" ` +
        `is ambiguous; renumber one (precedent: the 0061/0062 "Numbering note" blockquote).`,
    ),
    ...dangling.map(
      (d) => `ADR ${d.from} ${d.verb} ADR ${d.target}, which has no file in docs/decisions/`,
    ),
    ...(malformed ?? []).map(
      (m) =>
        `ADR ${m.num} declares an edge WITHOUT the label colon (**${m.labels.join('** / **')}** ` +
        `near an ADR number in the preamble) — the parser reads labels only with a colon ` +
        `(\`**Amends:**\`), so this edge is INVISIBLE to the index and the back-pointer. ` +
        `Add the colon, or unbold the verb if it is prose (live precedent: 0133/0125).`,
    ),
  ]
}

// --------------------------------------------------------------------------
// RENDER — deterministic; no timestamps, nothing outside the ADR files.
// --------------------------------------------------------------------------

const STATUS_CELL = {
  accepted: 'accepted',
  superseded: '⛔ superseded',
  proposed: '⚠ proposed',
  draft: '⚠ draft',
  deferred: '⚠ deferred',
  rejected: 'rejected',
  unknown: '— unparsed —',
}

const cell = (s) => s.replace(/\|/g, '\\|')

function truncate(s, cap) {
  return s.length <= cap ? s : `${s.slice(0, cap - 1).trimEnd()}…`
}

function edgeCell(list, format) {
  const by = new Map()
  for (const e of list) {
    const k = format(e)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(e.target ?? e.from)
  }
  return (
    [...by.entries()].map(([verb, ns]) => `${verb} ${[...new Set(ns)].sort().join(', ')}`).join(' · ') || '–'
  )
}

export function render(adrs, a) {
  const L = []
  L.push('# ADR Index')
  L.push('')
  L.push('> ⚙ **GENERATED FILE — do not edit by hand.** Every column is derived from each')
  L.push('> ADR\'s own header block. Rebuild with `npm run adr:index`; `npm run lint:adr-index`')
  L.push('> (gate 9 of `npm run lint`) reds when this file is out of date, when two ADRs share')
  L.push('> a number, or when an ADR cites a number that has no file.')
  L.push('>')
  L.push('> **Writing a new ADR?** Take the *next free number* below, write the file, then run')
  L.push('> `npm run adr:index`. Declare what it changes in the header block with a')
  L.push('> `**Supersedes:**` / `**Amends:**` label — that label is the ONLY input to the')
  L.push('> `⚠ Changed by` column, which is the one thing an ADR cannot record about itself.')
  L.push('>')
  L.push('> Edges are **advisory** and over-inclusive by design; the ADR text is truth.')
  L.push('')
  L.push(
    `**${adrs.length} ADRs** · next free number: **${a.nextFree}** · ` +
      `${a.incoming.size ? [...a.incoming.values()].filter((v) => v.length).length : 0} carry an ` +
      `inbound supersedes/amends edge`,
  )
  L.push('')

  L.push('## ⚠ Anomalies')
  L.push('')
  const hard = hardFindings(a)
  if (hard.length) {
    L.push('**Blocking** (`lint:adr-index` fails until resolved):')
    L.push('')
    for (const h of hard) L.push(`- ⛔ ${h}`)
    L.push('')
  }
  L.push(
    `- **Missing numbers:** ${a.missing.length ? a.missing.join(', ') : 'none'} — a gap is not ` +
      'automatically a defect (0077 was withdrawn by the PO and its subject re-filed as 0078; ' +
      '0034 was never used), but a gap nobody can explain usually means a lost file.',
  )
  L.push(
    `- **No parseable \`Status:\`:** ${a.noStatus.length ? a.noStatus.join(', ') : 'none'}` +
      `${a.unknownStatus.length ? ` · **unrecognised status wording:** ${a.unknownStatus.join(', ')}` : ''}`,
  )
  L.push(
    `- **Still proposed / draft / deferred (${a.open.length}):** ` +
      `${a.open.length ? a.open.map((x) => x.num).join(', ') : 'none'} — an ADR's status is the ` +
      "author's claim on the day it was written, and nothing updates it when the code ships. " +
      'The last review of this list is stamped in `proposed-review.json`; gate 9 reds when ' +
      'that review is more than 30 days old or this set has drifted from it.',
  )
  L.push('')

  L.push('## Index')
  L.push('')
  L.push('| # | ADR | Status | Date | Changes | ⚠ Changed by |')
  L.push('| --- | --- | --- | --- | --- | --- |')
  for (const adr of adrs) {
    const inbound = a.incoming.get(adr.num) ?? []
    L.push(
      `| ${adr.num} ` +
        `| [${cell(truncate(adr.title, TITLE_CAP))}](${adr.file}) ` +
        `| ${STATUS_CELL[adr.status]} ` +
        `| ${adr.date || '–'} ` +
        `| ${cell(edgeCell(adr.edges, (e) => e.verb))} ` +
        `| ${cell(edgeCell(inbound, (e) => (e.verb === 'supersedes' ? '⛔ superseded by' : '⚠ amended by')))} |`,
    )
  }
  L.push('')
  return L.join('\n')
}

// --------------------------------------------------------------------------
// BACK-POINTERS — the inverse edge, written into the amended ADR itself.
//
// The index carries the same information, but a reader who opens 0033 to answer a question
// never goes to the index first; they land in the file and believe it. So the pointer has to
// be in the file. Making it GENERATED and marker-delimited is what keeps it from becoming the
// next stale record: `--write` rewrites the block, `--check` byte-compares it, and a new ADR
// that declares `**Amends:** 0033` puts the pointer into 0033 without anyone remembering to.
//
// It deliberately does NOT replace the hand-written decision-level notes that already exist in
// 0028 / 0032 / 0033 / 0061 / 0120 — those say WHICH decision changed and are richer than
// anything derivable from a header label. This block is the banner; those are the detail.
// --------------------------------------------------------------------------

export const BP_START = '<!-- adr-backpointers:start — generated by scripts/build-adr-index.mjs, do not edit -->'
export const BP_END = '<!-- adr-backpointers:end -->'

/**
 * No `Label:` colon forms inside the block — a colon would make it a metadata label, the
 * parser would read the ADR numbers back out of it, and the generator would feed itself.
 * `selfTest` pins that: parsing a file with the block must yield the same edges as without.
 */
export function renderBackpointer(inbound, byNum) {
  if (!inbound || !inbound.length) return null
  const pick = (verb) => [...new Set(inbound.filter((e) => e.verb === verb).map((e) => e.from))].sort()
  const link = (n) => `[${n}](${byNum.get(n).file})`
  const sup = pick('supersedes')
  // A `**Supersedes / amends:**` label emits both verbs for the same ADR. Listing it under
  // both reads as two separate events; supersession is the stronger claim, so it wins.
  const amd = pick('amends').filter((n) => !sup.includes(n))
  const parts = []
  if (sup.length) parts.push(`**superseded by** ${sup.map(link).join(', ')}`)
  if (amd.length) parts.push(`**amended by** ${amd.map(link).join(', ')}`)
  return [
    BP_START,
    `> ⬅ **A later ADR changes this one** — it is ${parts.join(', and ')}.`,
    '> Check what changed before relying on anything below. An amended decision goes on reading',
    '> as current law, and the half that went stale is always the *tighter*, more cautious rule —',
    '> so it reads as care, never as something to double-check.',
    '>',
    "> Generated back-pointer; the forward declaration lives in the amending ADR's header block.",
    '> Full map: [INDEX.md](INDEX.md).',
    BP_END,
  ].join('\n')
}

/** Idempotent: strips any existing block, normalises the gap after the H1, re-inserts. */
export function applyBackpointer(text, block) {
  let lines = text.split('\n')
  const s = lines.indexOf(BP_START)
  const e = lines.indexOf(BP_END)
  if (s >= 0 && e > s) lines = [...lines.slice(0, s), ...lines.slice(e + 1)]

  const h1 = lines.findIndex((l) => /^#\s/.test(l))
  if (h1 < 0) return text // no H1 to anchor on; leave the file alone rather than guess
  const head = lines.slice(0, h1 + 1)
  const tail = lines.slice(h1 + 1)
  while (tail.length && tail[0].trim() === '') tail.shift()
  return block ? [...head, '', block, '', ...tail].join('\n') : [...head, '', ...tail].join('\n')
}

/** Files whose on-disk back-pointer block differs from what the corpus implies. */
export function backpointerPlan(adrs, a, dir = DIR) {
  const byNum = new Map(adrs.map((x) => [x.num, x]))
  const plan = []
  for (const adr of adrs) {
    const path = join(dir, adr.file)
    const current = readFileSync(path, 'utf8')
    const next = applyBackpointer(current, renderBackpointer(a.incoming.get(adr.num), byNum))
    if (next !== current) plan.push({ num: adr.num, file: adr.file, path, next })
  }
  return plan
}

// --------------------------------------------------------------------------
export function loadAdrs(dir = DIR) {
  return readdirSync(dir)
    .filter((f) => ADR_FILE_RX.test(f))
    .sort()
    .map((f) => parseAdr(f, readFileSync(join(dir, f), 'utf8')))
}

// --------------------------------------------------------------------------
// SELF-TEST — every checker proven able to fail, on every invocation.
// --------------------------------------------------------------------------
function selfTest() {
  const fails = []
  const eq = (name, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fails.push(`${name} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)
    }
  }
  const expectRed = (name, findings) => {
    if (findings.length === 0) fails.push(`${name} (cannot fire)`)
  }
  const expectGreen = (name, findings) => {
    if (findings.length !== 0) fails.push(`${name} (false positive: ${findings[0]})`)
  }

  // --- preamble boundary: metadata past a naive line cap must still be seen.
  const late = `# ADR 0999 — T\n${'filler\n'.repeat(40)}**Amends:** ADR 0111\n\n## Context\n**Amends:** 0222\n`
  eq('preamble-late-label', parseEdges(parseLabels(splitPreamble(late).preamble), '0999'), [
    { verb: 'amends', target: '0111' },
  ])
  eq('preamble-stops-at-h2', splitPreamble(late).preamble.includes('0222'), false)

  // --- titles
  eq('title-adr-prefix', parseTitle('# ADR 0079 — The invariant'), 'The invariant')
  eq('title-bare-number', parseTitle('# 0050 — Unified hub'), 'Unified hub')

  // --- labels: the colon is what separates a label from bold emphasis.
  eq(
    'label-emphasis-not-a-label',
    parseLabels('Published versions are **IMMUTABLE** always').map((l) => l.label),
    [],
  )
  eq(
    'label-inline-run',
    parseLabels('**Status:** Accepted · **Date:** 2026-07-02 · **Phase:** 9').map((l) => l.label),
    ['Status', 'Date', 'Phase'],
  )
  eq(
    'label-value-stops-at-next-label',
    parseLabels('**Status:** Accepted · **Date:** 2026-07-02')[0].value,
    'Accepted',
  )
  eq(
    'label-multiline-value',
    parseLabels('**Amends:** ADR 0038\nand ADR 0037 too\n')[0].value,
    'ADR 0038 and ADR 0037 too',
  )
  eq('label-bold-outside-colon', parseLabels('**Status**: Accepted')[0]?.label, 'Status')
  eq('label-plain-fallback', parseLabels('Status: Accepted — 2026-07-02')[0]?.label, 'Status')

  // --- status buckets
  eq('status-accepted', normalizeStatus('Accepted (human-approved plan, 2026-07-02)'), 'accepted')
  eq('status-proposed', normalizeStatus('Proposed / deferred · **Date:** 2026-06-14'), 'proposed')
  eq('status-emoji-lead', normalizeStatus('✅ **ACCEPTED 2026-08-17** — partially'), 'accepted')
  eq('status-leading-token-wins', normalizeStatus('Accepted — stance superseded by 0030'), 'accepted')
  eq('status-superseded', normalizeStatus('Superseded by ADR 0093'), 'superseded')
  eq('status-unknown', normalizeStatus('mumble mumble'), 'unknown')
  eq('status-empty', normalizeStatus(''), 'unknown')

  // --- edges
  eq('edge-nothing', parseEdges([{ label: 'Supersedes', value: 'nothing.' }], '0137'), [])
  eq('edge-self-skipped', parseEdges([{ label: 'Amends', value: 'ADR 0137' }], '0137'), [])
  eq(
    'edge-dual-verb-label',
    parseEdges([{ label: 'Supersedes / amends', value: '0057' }], '0093'),
    [
      { verb: 'supersedes', target: '0057' },
      { verb: 'amends', target: '0057' },
    ],
  )
  eq(
    'edge-linked-form',
    parseEdges([{ label: 'Amends in effect', value: 'ADR [0038](0038-x.md) and [0037](0037-y.md)' }], '0137'),
    [
      { verb: 'amends', target: '0038' },
      { verb: 'amends', target: '0037' },
    ],
  )
  // A migration id must not be mistaken for an ADR number.
  eq('edge-no-migration-id', parseEdges([{ label: 'Amends', value: 'migration 20260921000100' }], '0001'), [])

  // --- VOICE: a passive label is the ADR recording that IT was changed, not a claim about
  // another ADR. Reading it as outgoing inverts the arrow. Live instances: 0073, 0130.
  eq('voice-passive-amended', parseEdges([{ label: 'Amended (2026-07-14)', value: 'after the 0072/0073 evaluation' }], '0073'), [])
  eq('voice-passive-superseded', parseEdges([{ label: 'Superseded design', value: 'see ADR 0078' }], '0073'), [])
  eq('voice-passive-sentence', parseEdges([{ label: 'Decision 9 is amended', value: 'ADR 0131 withdrew it' }], '0130'), [])
  eq('voice-active-amends', parseEdges([{ label: 'Amends', value: 'ADR 0072' }], '0073'), [{ verb: 'amends', target: '0072' }])
  eq('voice-active-supersedes', parseEdges([{ label: 'Supersedes (in part)', value: 'ADR 0019' }], '0020'), [{ verb: 'supersedes', target: '0019' }])
  // `reverses` is material and counts; bare `extends` is additive and deliberately does not.
  eq('voice-reverses-counts', parseEdges([{ label: 'Extends / partially reverses', value: 'ADR 0032' }], '0047'), [{ verb: 'amends', target: '0032' }])
  eq('voice-extends-excluded', parseEdges([{ label: 'Extends', value: 'ADR 0032' }], '0044'), [])

  // --- corpus analysis
  const mk = (num, edges = []) => ({ num, file: `${num}-x.md`, title: 't', statusRaw: 'Accepted', status: 'accepted', date: '', edges })
  expectRed('dup-detect', hardFindings(analyse([mk('0001'), { ...mk('0001'), file: '0001-y.md' }])))
  expectGreen('dup-green', hardFindings(analyse([mk('0001'), mk('0002')])))
  expectRed('dangling-detect', hardFindings(analyse([mk('0002', [{ verb: 'amends', target: '0001' }])])))
  expectGreen('dangling-green', hardFindings(analyse([mk('0001'), mk('0002', [{ verb: 'amends', target: '0001' }])])))
  eq('missing-detect', analyse([mk('0001'), mk('0003')]).missing, ['0002'])
  eq('missing-green', analyse([mk('0001'), mk('0002')]).missing, [])
  eq('next-free', analyse([mk('0001'), mk('0003')]).nextFree, '0004')
  eq(
    'inverse-edge',
    analyse([mk('0001'), mk('0002', [{ verb: 'supersedes', target: '0001' }])]).incoming.get('0001'),
    [{ verb: 'supersedes', from: '0002' }],
  )

  expectRed('eol', checkEol('a\r\nb'))
  expectGreen('eol-green', checkEol('a\nb'))

  // --- colon-less edge labels (the 0133/0125 class): active verb + nearby ADR number,
  // preamble-only; the passive voice (incl. the generated back-pointer block) never fires.
  eq('colonless-detect', colonlessEdgeLabels('**Amends** ADR [0097](x.md) D11 + D14'), ['Amends'])
  eq('colonless-colon-green', colonlessEdgeLabels('**Amends:** ADR 0097'), [])
  eq('colonless-no-number-green', colonlessEdgeLabels('this **supersedes** the old flow entirely'), [])
  eq('colonless-passive-green', colonlessEdgeLabels('**Amended** later; see ADR 0131'), [])
  eq('colonless-bp-green', colonlessEdgeLabels('> it is **superseded by** [0079](0079-x.md)'), [])
  eq('colonless-codespan-green', colonlessEdgeLabels('describes the class (`**Amends** ADR 0097`) in prose'), [])
  expectRed(
    'malformed-hard',
    hardFindings({ duplicates: [], dangling: [], malformed: [{ num: '0133', labels: ['Amends'] }] }),
  )

  // --- proposed-ADR review stamp
  const prOpen = ['0022', '0031']
  expectRed('pr-missing', checkProposedReview(null, prOpen, '2026-08-24'))
  expectRed('pr-drift', checkProposedReview({ installed: '2026-08-24', reviewed: null, proposed: ['0022'] }, prOpen, '2026-08-24'))
  expectRed('pr-first-review-owed', checkProposedReview({ installed: '2026-01-01', reviewed: null, proposed: prOpen }, prOpen, '2026-08-24'))
  expectRed('pr-review-stale', checkProposedReview({ installed: '2026-01-01', reviewed: '2026-06-01', proposed: prOpen }, prOpen, '2026-08-24'))
  expectGreen('pr-installed-green', checkProposedReview({ installed: '2026-08-24', reviewed: null, proposed: prOpen }, prOpen, '2026-08-24'))
  expectGreen('pr-reviewed-green', checkProposedReview({ installed: '2026-01-01', reviewed: '2026-08-20', proposed: prOpen }, prOpen, '2026-08-24'))

  // --- back-pointers
  const bpNums = new Map([
    ['0017', { num: '0017', file: '0017-multi-phase-cases.md' }],
    ['0136', { num: '0136', file: '0136-deferred.md' }],
  ])
  const bpIn = [
    { verb: 'supersedes', from: '0017' },
    { verb: 'amends', from: '0136' },
  ]
  eq('bp-none-when-unamended', renderBackpointer([], bpNums), null)
  const bp = renderBackpointer(bpIn, bpNums)
  eq('bp-names-both-verbs', /\*\*superseded by\*\* \[0017\].*\*\*amended by\*\* \[0136\]/s.test(bp), true)
  eq('bp-links-resolve-to-files', bp.includes('(0017-multi-phase-cases.md)'), true)
  // A `Supersedes / amends` label emits both verbs for one ADR; it must be named once.
  const bpBoth = renderBackpointer(
    [
      { verb: 'supersedes', from: '0017' },
      { verb: 'amends', from: '0017' },
    ],
    bpNums,
  )
  eq('bp-dedupes-dual-verb', (bpBoth.match(/\[0017\]/g) || []).length, 1)
  eq('bp-dual-verb-prefers-supersedes', bpBoth.includes('**superseded by** [0017]') && !bpBoth.includes('amended by'), true)

  const doc = '# ADR 0005 — T\n\n**Status:** Accepted\n\n## Context\nbody\n'
  const once = applyBackpointer(doc, bp)
  eq('bp-inserted-under-h1', once.split('\n')[2], BP_START)
  eq('bp-keeps-body', once.includes('**Status:** Accepted') && once.includes('## Context'), true)
  // Idempotency is the whole contract: --check byte-compares, so a second run that differs
  // would red the gate forever with nothing to fix.
  eq('bp-idempotent', applyBackpointer(once, bp), once)
  eq('bp-updates-in-place', applyBackpointer(once, renderBackpointer([{ verb: 'amends', from: '0136' }], bpNums)).split(BP_START).length, 2)
  eq('bp-removed-cleanly', applyBackpointer(once, null), doc)
  eq('bp-no-h1-left-alone', applyBackpointer('no heading here\n', bp), 'no heading here\n')

  // ⛔ The generator must not read its own output back as new edges, or each run would add
  // amenders and the fixed point would never be reached.
  const withBlock = splitPreamble(once)
  eq('bp-edge-neutral', parseEdges(parseLabels(withBlock.preamble), '0005'), [])
  eq('bp-status-still-parsed', parseAdr('0005-t.md', once).status, 'accepted')

  // --- render must be deterministic and must escape pipes out of table cells.
  const corpus = [{ ...mk('0001'), title: 'A | B' }]
  eq('render-deterministic', render(corpus, analyse(corpus)), render(corpus, analyse(corpus)))
  eq('render-escapes-pipe', render(corpus, analyse(corpus)).includes('A \\| B'), true)
  eq('title-truncated', truncate('x'.repeat(TITLE_CAP + 10), TITLE_CAP).length, TITLE_CAP)

  if (fails.length) {
    console.error(`build-adr-index SELF-TEST FAILED — checker(s) broken: ${fails.join('; ')}`)
    process.exit(2)
  }
}

// --------------------------------------------------------------------------
function main() {
  selfTest()
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    console.log('build-adr-index: self-test OK (all checkers proven able to fail)')
    return
  }

  const adrs = loadAdrs()
  const a = analyse(adrs)
  const expected = render(adrs, a)
  const hard = hardFindings(a)

  if (argv.includes('--write')) {
    writeFileSync(INDEX_PATH, expected, 'utf8')
    const plan = backpointerPlan(adrs, a)
    for (const p of plan) writeFileSync(p.path, p.next, 'utf8')
    console.log(`build-adr-index: wrote docs/decisions/INDEX.md (${adrs.length} ADRs, next free ${a.nextFree})`)
    console.log(
      plan.length
        ? `build-adr-index: updated back-pointer blocks in ${plan.length} ADR(s): ${plan.map((p) => p.num).join(', ')}`
        : 'build-adr-index: back-pointer blocks already current',
    )
    if (hard.length) {
      console.error(`\nbuild-adr-index: ${hard.length} BLOCKING anomaly(ies) recorded in the index\n`)
      for (const h of hard) console.error(`  ✗ ${h}`)
      process.exit(1)
    }
    return
  }

  // --check (default)
  const findings = []
  if (!existsSync(INDEX_PATH)) {
    findings.push('docs/decisions/INDEX.md is missing — run `npm run adr:index`')
  } else {
    const actual = readFileSync(INDEX_PATH, 'utf8')
    const eol = checkEol(actual)
    findings.push(...eol)
    if (!eol.length && actual !== expected) {
      findings.push(
        'docs/decisions/INDEX.md is out of date with docs/decisions/*.md — run `npm run adr:index`' +
          ' (a new ADR, or an edited Status/Supersedes/Amends header, needs the index rebuilt)',
      )
    }
  }
  const plan = backpointerPlan(adrs, a)
  if (plan.length) {
    findings.push(
      `${plan.length} ADR(s) have a stale or missing back-pointer block — run \`npm run adr:index\`: ` +
        plan.map((p) => p.num).join(', '),
    )
  }
  findings.push(...hard)

  // Proposed-ADR review cadence (ADR 0140) — check-time only, never in the rendered bytes.
  const stampPath = join(DIR, 'proposed-review.json')
  let stamp = null
  if (existsSync(stampPath)) {
    try {
      stamp = JSON.parse(readFileSync(stampPath, 'utf8'))
    } catch {
      stamp = null
    }
  }
  findings.push(
    ...checkProposedReview(stamp, a.open.map((x) => x.num), new Date().toISOString().slice(0, 10)),
  )

  if (findings.length) {
    console.error(`build-adr-index: ${findings.length} finding(s)\n`)
    for (const f of findings) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`build-adr-index: OK (${adrs.length} ADRs indexed, next free ${a.nextFree})`)
}

// Run only as the entry point, so sibling tooling can `import` the parser instead of
// re-implementing it — a second parse would be free to disagree with the gate's.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
