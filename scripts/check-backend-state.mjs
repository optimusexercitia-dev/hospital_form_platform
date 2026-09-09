#!/usr/bin/env node
/**
 * Gate 16 — the structural invariants of `docs/backend-state/`.
 *
 * WHY THIS EXISTS. Until 2026-09-09 the backend surface map was ONE file,
 * `docs/backend-state.md`, at 742 KB / 6,353 lines — and CLAUDE.md told the lead and every
 * teammate to reference it at phase start. No context window holds that, so nobody read it whole;
 * the instruction read like a guard across many phases while guarding nothing. 72% of it (4,577
 * lines across 53 dated sections) was ordered by PHASE, so a reader asking "what is the surface
 * NOW" had to replay the slices in order and apply supersessions by hand — which is why the file
 * carried 33 `SUPERSEDED` and 45 `STALE` markers and a hand-maintained "END STATE" block at the
 * top whose own registry figure had gone stale. The split re-files it on the MODULE SEAM axis.
 *
 * A split does not stay split on its own. TWELVE checks hold it. A/B/C/D shipped 2026-09-09; B2 and E
 * followed hours later when internal QA found each missing (M1, M2); F followed an EXTERNAL review
 * that found the defect all of them had walked past; G/H/I/J followed when that same review showed
 * the split had changed the FILING and not the CONTENT (ADR 0198) — see F, and the long block above
 * `checkStatePresent` for G/H/I/J:
 *
 *   A. PREAMBLE IDENTICAL — every seam file opens with byte-identical maintenance boilerplate.
 *      A rule repeated in twelve files is a rule that drifts in eleven of them.
 *   B. ROUTED — every seam file sits in a README.md table row WITH a "when to open it" clause.
 *      An unrouted file is an unread file; a row with no clause is not a route.
 *   B2. ROUTER TARGETS EXIST — the opposite polarity of B, and it was the hole: deleting a seam
 *      file left the gate at rc=0 still printing "all routed".
 *   C. SUPERSEDED TARGETS RESOLVE — a forward marker that names a file which does not exist sends
 *      the reader nowhere, which is worse than no marker: it reads like care.
 *   D. SIZE — warn at 160 KB, FAIL at 200 KB, per file. ⛔ The remedy is never to raise the cap,
 *      never to open a phase-named overflow file, and never to delete a posted section. It is to
 *      find the seam inside the file that wants its own home.
 *   E. A SEAM IS A NOUN — no digit in a seam filename. This is D2's enforcer; without it a routed
 *      `phase-24-2026-09-20.md` passed green and the phase axis could grow back one file at a time.
 *   F. LOCAL LINKS AND ANCHORS RESOLVE — via gate 13's `checkLinks`, imported, never re-implemented.
 *   K. BULK — no line over 8,000 chars anywhere; no hand-written section over 450 lines. D bounds a
 *      FILE and is silent on the shape inside one: the predecessor's worst artefact was a single
 *      66,557-character line, in a file that was under cap the whole time.
 *
 *   G/H/I/J. THE CURRENT-STATE LAYER — every DOMAIN seam carries a replaceable, axis-free
 *      `## Current state` projection ABOVE its frozen slices; the projection stays a projection
 *      rather than a log; it is not staler than the history it sits on; and the exemptions from it
 *      are declared, proven, printed and ratcheted. A–F held the FILING and said nothing at all
 *      about the CONTENT — which stayed a log (ADR 0198).
 *
 * ⛔ F IS THE CHECK WHOSE ABSENCE COST THE MOST, and neither the split nor the internal QA round
 * caught it. Moving 6,353 lines one directory deeper without rebasing their relative paths left
 * **87 dangling links** — every `decisions/…` written from `docs/backend-state.md` resolves from
 * `docs/`, not from `docs/backend-state/`. Gate 16 was green the whole time because it validated
 * router destinations and marker filenames and nothing else, and this directory sits outside all
 * three link-gated corpora. All 87 were fixed by prepending `../`. ⚠ The first mutation written to
 * prove F fires DID NOT APPLY (it edited a link the file does not contain) and reported rc=0 — a
 * vacuous test that read exactly like a passing one. Mutations here assert they applied.
 *
 * ⛔ TWO P2 PROPERTIES ARE DELIBERATELY NOT GATED, and the measurement is why — not an oversight:
 *   · "DUPLICATE FACTS ACROSS SEAMS" has no non-noisy key. Measured over this corpus: migration ids
 *     appear in more than one seam **18%** of the time (33 of 186) and pgTAP suite refs **15%**
 *     (18 of 117) — both legitimately, because one migration touches several seams. Section
 *     headings duplicate only **3** times and all three are STRUCTURAL by design (`## Current
 *     state`, `## Extracted from the pre-split stamp chain`, `## The generated function registry`),
 *     so a heading-keyed check would enforce nothing after allowlisting them. A gate on any of
 *     these fires constantly, is right to, and gets disabled within a week.
 *   · "CONTENT BELONGS TO ITS SEAM" is not mechanically decidable at all. Misfiling stays
 *     invisible to this gate and is caught only by a reader.
 *   Both are stated so nobody infers coverage from a green run. Do not add a noisy detector for
 *   either; if one is wanted, it needs a key that is not the three measured above.
 *
 * ⚠ STATED BOUNDS, so nobody reads more coverage into this than it has:
 *   · F uses `existsSync` like gates 7 and 13 — case-INSENSITIVE on NTFS. Gate 9's case-exact
 *     variant is not used, so a wrong-case link inside this directory still passes.
 *   · C's region cut is a real blind spot in two low-realism cases: a dangling marker replicated
 *     IDENTICALLY into all twelve preambles (A agrees, C is cut), and one placed in README.md
 *     (skipped whole). Both are the cut's price, and neither is hypothetical-only by luck.
 *   · Nothing here checks that a seam file's CONTENT belongs to its seam. Misfiling is invisible.
 *   · Nothing checks registry COMPLETENESS, duplicate facts across seams, or per-SECTION size. Those
 *     are the remaining open P1/P2 items, not silent gaps.
 *   · The historical/current-state RATIO is REPORTED, never gated — deliberately. It degrades as
 *     append-only history grows CORRECTLY, so gating it would come to red for correct behaviour and
 *     its only remedy would be deleting posted sections, which D5 forbids. Check I gates the thing
 *     worth gating instead: history appended, projection not refreshed. ADR 0198 § Considered options.
 *   · G/H/I/J check that a projection EXISTS, is shaped, is axis-free and is not stale. They cannot
 *     check that it is TRUE: a wrong sentence in a well-formed block passes every one of them.
 *
 * ⛔ THE POPULATION IS THE DIRECTORY LISTING, never a list in this file. A guard that enumerates a
 * list somebody must remember to update has a hole shaped like forgetting — the failure family
 * this repo already names ("a verified-facts baseline is a HAND-LIST wearing a label").
 *
 * ⛔ Resolved from THIS FILE, never from `process.cwd()` — the hardening `check-budget-anchor.mjs`
 * took on 2026-09-08. Running a gate from a subdirectory must not turn "the subject is absent"
 * into a finding about the repo.
 *
 * SELF-TEST (`--self-test`, and it runs before every real run): each check is fed a fixture that
 * BREAKS it and a fixture that satisfies it. A detector that finds nothing has to be proven able
 * to find something, and a detector that fires on everything is no better.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// ⛔ ONE link checker, imported — never a reimplementation. `checkLinks` is gate 13's, already
// shared with gates 7 and 9 (FUP-ADR-CROSS-LINKS-HAVE-NO-GATE closed by giving them one checker,
// "not a third that could disagree"). This makes `docs/backend-state/` the FOURTH corpus handed to
// that same function, which is what FUP-REGISTER-GATE-HYGIENE-LINK-CHECKING-HAS-NO-GATE-OUTSIDE-
// THREE-CORPORA asks for — bind the corpus to the property, not to a hand-list.
import { checkLinks, CURRENT_STATE_MAX_LINES } from './check-docs-registers.mjs'

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const DIR_REL = 'docs/backend-state'
const DIR = join(REPO_ROOT, 'docs', 'backend-state')
const ROUTER = 'README.md'

export const WARN_BYTES = 160 * 1024
export const HARD_BYTES = 200 * 1024

/** ⛔ FIRST, always. `.gitattributes` pins `*.md` to LF in both directions, but a gate that
 *  depends on that is a gate that reds on a checkout somebody configured differently. */
export function normalise(raw) {
  return String(raw).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * The preamble is the FIRST contiguous run of blockquote lines after the H1. Returned verbatim so
 * the comparison is byte-for-byte; `null` when the file has no such run (itself a finding).
 */
export function preambleOf(text) {
  const lines = normalise(text).split('\n')
  let i = 0
  while (i < lines.length && !lines[i].startsWith('# ')) i += 1
  if (i === lines.length) return null
  i += 1
  while (i < lines.length && lines[i].trim() === '') i += 1
  if (i === lines.length || !lines[i].startsWith('>')) return null
  const start = i
  while (i < lines.length && lines[i].startsWith('>')) i += 1
  return lines.slice(start, i).join('\n')
}

/** A. Every seam file carries the SAME preamble. The router is excluded — it carries the rules in
 *  full rather than the pointer to them, which is the one asymmetry the design wants. */
export function checkPreambleIdentical(files) {
  const seams = files.filter((f) => f.name !== ROUTER)
  if (seams.length === 0) return [`[A] ${DIR_REL}/ — no seam files found; the directory cannot be empty`]
  const F = []
  const byPreamble = new Map()
  for (const f of seams) {
    const p = preambleOf(f.text)
    if (p == null) {
      F.push(`[A] ${DIR_REL}/${f.name} — no preamble blockquote after the H1 (every seam file carries the shared one verbatim)`)
      continue
    }
    if (!byPreamble.has(p)) byPreamble.set(p, [])
    byPreamble.get(p).push(f.name)
  }
  if (byPreamble.size > 1) {
    // Majority wins only for the MESSAGE; any divergence at all is the finding.
    const groups = [...byPreamble.entries()].sort((a, b) => b[1].length - a[1].length)
    const [, canonical] = groups[0]
    for (const [, names] of groups.slice(1)) {
      F.push(
        `[A] ${DIR_REL}/ — preamble differs in ${names.join(', ')} (the other ${canonical.length} ` +
          `file(s) agree). A rule repeated in ${seams.length} files is a rule that drifts in ${seams.length - 1} of them; ` +
          `edit it in ONE place and re-copy, never fix the copies one at a time.`,
      )
    }
  }
  return F
}

/**
 * B. Every seam file is named by the router, **in a row that says when to open it**.
 *
 * ⛔ Population = the directory listing. ⚠ A bare `routerText.includes('(name.md)')` was the first
 * version and QA (M3) was right that it enforced nothing about D3: a bare mention in prose passed.
 * The row shape is the checkable half of "the router dispatches on the ACTION" — the file must sit
 * in a table row whose trailing cell carries a real clause, not an empty or token cell.
 */
export const MIN_WHEN_CHARS = 20

export function checkRouted(files, routerText) {
  if (routerText == null) return [`[B] ${DIR_REL}/${ROUTER} — missing; the directory has no entry point`]
  const F = []
  const rows = routerText.split('\n').filter((l) => l.trim().startsWith('|'))
  for (const f of files) {
    if (f.name === ROUTER) continue
    const row = rows.find((l) => l.includes(`(${f.name})`))
    if (!row) {
      F.push(`[B] ${DIR_REL}/${f.name} — not in a ${ROUTER} table row. An unrouted file is an unread file: add a row saying WHEN to open it.`)
      continue
    }
    const cells = row.split('|').slice(1, -1).map((c) => c.trim())
    const when = cells[cells.length - 1] ?? ''
    if (cells.length < 2 || when.length < MIN_WHEN_CHARS) {
      F.push(
        `[B] ${DIR_REL}/${f.name} — its ${ROUTER} row has no "when you are about to…" clause ` +
          `(found ${when.length} chars; ≥ ${MIN_WHEN_CHARS} required). The router dispatches on the ACTION, not on contents.`,
      )
    }
  }
  return F
}

/**
 * B2. Every router link INTO this directory resolves to a file that exists.
 *
 * ⛔ THE OPPOSITE POLARITY OF B, and it was missing. QA (M1) deleted a seam file and gate 16 stayed
 * at rc=0 still reporting "all routed", because B only asked "is every file named?" and never "does
 * every name exist?". `docs/backend-state/` is outside all three link-gated corpora, so nothing else
 * in the tree would have caught it either. A one-directional check leaves the other direction
 * unproven — and D10 is the decision that says a pointer resolving nowhere is worse than none.
 */
export function checkRouterTargetsExist(routerText, known) {
  if (routerText == null) return []
  const F = []
  for (const m of normalise(routerText).matchAll(/\]\(([A-Za-z0-9._-]+\.md)\)/g)) {
    if (!known.has(m[1])) {
      F.push(`[B2] ${DIR_REL}/${ROUTER} — routes to \`${m[1]}\`, which does not exist in ${DIR_REL}/. A dangling router row is worse than no row.`)
    }
  }
  return F
}

/**
 * E. A seam is a NOUN, not a number.
 *
 * ⛔ D2 ("a new phase EXTENDS its seam file; it never opens a phase-named file") had NO enforcer —
 * QA (M2) routed a `phase-24-2026-09-20.md` and the gate passed green, which is the decision the
 * whole design rests on going unguarded. Any digit in a seam filename is the tell: every legitimate
 * seam here is words (`document-model`, `privacy-and-dsr`), while every phase-shaped name this
 * repo produces carries a number (`dm5-s3`, `ae4`, `phase-16`, a date). Deliberately blunt: the
 * cost of a false positive is renaming a file, the cost of a false negative is the phase axis
 * growing back one file at a time.
 */
export function checkSeamNaming(files) {
  const F = []
  for (const f of files) {
    if (f.name === ROUTER) continue
    if (/\d/.test(f.name)) {
      F.push(
        `[E] ${DIR_REL}/${f.name} — a seam filename may not contain a digit. A seam is a NOUN, not a ` +
          `phase, a date or a slice number (ADR 0196 D2): EXTEND the seam file this work belongs to.`,
      )
    }
  }
  return F
}

/**
 * Everything after the shared preamble, with the line offset that keeps reported numbers true.
 *
 * ⛔ WHY THE PREAMBLE IS CUT. The preamble and README both QUOTE the marker form in order to
 * mandate it. Parsing those as markers made check C fire on all 13 files on its first real run —
 * a detector reading its own instructions as data. Same decision escalume's corpus builder makes
 * when it excludes the router, "so admitting it would let the router's own prose be parsed as a
 * claim about a route". The cut is by REGION, not by pattern: a rule that tried to spot
 * "descriptive" markers by wording would be a second thing to keep in sync.
 */
export function bodyAfterPreamble(text) {
  const lines = normalise(text).split('\n')
  const pre = preambleOf(text)
  if (pre == null) return { lines, offset: 0 }
  const preLines = pre.split('\n')
  const at = lines.findIndex((l, i) => l === preLines[0] && lines.slice(i, i + preLines.length).join('\n') === pre)
  if (at < 0) return { lines, offset: 0 }
  const start = at + preLines.length
  return { lines: lines.slice(start), offset: start }
}

/**
 * C. Every forward marker resolves. The marker form the README mandates is
 *    `⚠ **Superseded** — <clause>. See <file> § <n>.`
 * The target is the first `.md` filename mentioned on the marker line or the two lines after it
 * (markers wrap). A marker naming no file at all is also a finding — "superseded by something,
 * somewhere" is exactly the pointer that rots silently.
 *
 * The ROUTER is skipped whole: it carries the rules, not claims about the surface.
 */
export function checkSupersededTargets(files, known, all = files) {
  const F = []
  const byName = new Map(all.map((f) => [f.name, f]))
  const MARKER = /⚠\s*\*\*Superseded\*\*/
  for (const f of files) {
    if (f.name === ROUTER) continue
    const { lines, offset } = bodyAfterPreamble(f.text)
    for (let i = 0; i < lines.length; i += 1) {
      if (!MARKER.test(lines[i])) continue
      // ⚠ The window is the marker's whole PARAGRAPH (to the next blank line), not a fixed 3 lines.
      // A fixed window was the first version and it reported a VALID marker as "names no target"
      // the first time one ran longer than three lines — a false positive that would have taught
      // the next author to shorten the explanation rather than to name the target. Capped so a
      // missing blank line cannot swallow the rest of the file.
      let end = i
      while (end < lines.length && lines[end].trim() !== '' && end - i < 12) end += 1
      const window = lines.slice(i, end).join(' ')
      const names = [...window.matchAll(/([A-Za-z0-9._-]+\.md)/g)].map((m) => m[1])
      if (names.length === 0) {
        F.push(`[C] ${DIR_REL}/${f.name}:${i + offset + 1} — Superseded marker names no target file (\`See <file> § <n>.\`)`)
        continue
      }
      for (const n of names) {
        if (!known.has(n)) {
          F.push(`[C] ${DIR_REL}/${f.name}:${i + offset + 1} — Superseded marker points at \`${n}\`, which is not in ${DIR_REL}/`)
          continue
        }
        // The SECTION half. Until 2026-09-09 only the filename was checked, so
        // `See notifications.md § 9999.` passed — half the mandated form unverified, which is the
        // half a reader actually navigates by. A `§` clause must name a real heading in the target.
        const sec = window.match(new RegExp(`${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*§\\s*([^.]+?)\\s*(?:\\.|$)`))
        if (!sec) continue
        const wanted = sec[1].trim().toLowerCase()
        const target = byName.get(n)
        // ⛔ Cannot read the target's text (a caller passed only the name set) => UNDECIDED, not
        // a finding. A section check that fires because it could not look is a false positive
        // wearing a verdict. In the real run `all` is every file, so this never short-circuits.
        if (!target) continue
        const heads = normalise(target?.text ?? '')
          .split('\n')
          .filter((l) => /^#{2,4} /.test(l))
          .map((l) => l.replace(/^#+ /, '').toLowerCase())
        if (wanted && !heads.some((h) => h.includes(wanted))) {
          F.push(
            `[C] ${DIR_REL}/${f.name}:${i + offset + 1} — Superseded marker names \`${n} § ${sec[1].trim()}\`, ` +
              `but no heading in ${n} matches. The section is the half a reader navigates by.`,
          )
        }
      }
    }
  }
  return F
}

/** D. Size. Warnings are returned separately: a warn must not red the build, or it gets raised. */
export function checkSizes(files) {
  const F = []
  const W = []
  for (const f of files) {
    const b = Buffer.byteLength(f.text, 'utf8')
    if (b > HARD_BYTES) {
      F.push(
        `[D] ${DIR_REL}/${f.name} — ${(b / 1024).toFixed(1)} KB exceeds the ${HARD_BYTES / 1024} KB cap. ` +
          `⛔ Do NOT raise the cap, do NOT open a phase-named overflow file, do NOT delete a posted section. ` +
          `Find the seam inside this file that wants its own home, split it, and route it in ${ROUTER}.`,
      )
    } else if (b > WARN_BYTES) {
      W.push(`[D] ${DIR_REL}/${f.name} — ${(b / 1024).toFixed(1)} KB is over the ${WARN_BYTES / 1024} KB warn line (cap ${HARD_BYTES / 1024} KB). Plan the next seam.`)
    }
  }
  return { F, W }
}

/**
 * F. Every ordinary local link and in-file anchor resolves.
 *
 * ⛔ THIS IS THE CHECK WHOSE ABSENCE COST THE MOST. The split moved 6,353 lines one directory
 * DEEPER without rebasing their relative paths, so **87 links** written as `decisions/…` from
 * `docs/backend-state.md` silently became dangling from `docs/backend-state/`. Gate 16 passed
 * throughout — it validated router destinations and marker filenames and nothing else — and this
 * directory sits outside all three link-gated corpora, so no other gate looked either. Found by an
 * external review, not by anything in this repo. Every one of the 87 resolved by prepending `../`.
 *
 * ⚠ `exists` is `existsSync`, matching gates 7 and 13 — case-INSENSITIVE on NTFS. Gate 9's
 * case-exact variant is not used here, so a wrong-case link inside this directory still passes.
 * Stated rather than left to be discovered.
 */
export function checkLocalLinks(files, root, exists) {
  const F = []
  for (const f of files) {
    F.push(...checkLinks(`${DIR_REL}/${f.name}`, normalise(f.text), exists))
  }
  return F
}

// ---------------------------------------------------------------------------
// G / H / I / J — the CURRENT-STATE layer (ADR 0198, amending ADR 0196)
// ---------------------------------------------------------------------------
/**
 * WHY THESE FOUR EXIST. A–F hold the FILING and say nothing about the CONTENT — and on the day of
 * the split the content was still a log. Measured with `node scripts/measure-state-layer.mjs` at
 * `e4ac95e5`: of the **67** `##` sections in this directory, **57 (85%)** were date-stamped or
 * unit-coded work-unit slices, and **7 of the 11** seam files carried no axis-free "what is true
 * now" section at all. A reader asking "what is the surface NOW" still replayed one seam's history
 * and applied its supersessions by hand — 12 slices instead of 53, which is ADR 0196's own
 * concession ("the seam axis reduces the supersession problem; it does not eliminate it"), not a
 * state document.
 *
 * ADR 0198 gives every DOMAIN seam two explicit layers: a REPLACEABLE `## Current state` projection
 * on top, and the frozen append-only slices below it, untouched. ⛔ ADR 0196 D5 is not weakened —
 * the new layer sits ABOVE history and never rewrites it. These four checks hold that split.
 *
 *   G. PRESENT AND WELL-FORMED — every domain seam carries `## Current state`, FIRST among its `##`
 *      sections, with `**Updated:** YYYY-MM-DD` and exactly the five `###` sections in order.
 *   H. A PROJECTION, NOT A LOG — inside the block: no `⚠ **Superseded**` marker (this layer is
 *      REPLACED, so a supersession marker here is a category error), no deployment verdict, and no
 *      date other than `**Updated:**` itself. The date rule is what makes it axis-free: a dated line
 *      inside the block IS a slice, whatever it is called.
 *   I. NOT STALER THAN THE HISTORY IT PROJECTS — `**Updated:**` is not older than the newest date in
 *      any heading BELOW the block. ⛔ This, not a ratio, is the anti-rot mechanism. A
 *      historical/current RATIO was considered and REJECTED (ADR 0198 § Considered options): history
 *      is append-only by D5, so the ratio necessarily degrades as the corpus grows CORRECTLY, and
 *      its only remedy would be deleting posted sections — which D5 forbids and maintenance rule 4
 *      names. A ratio gate would come to red for correct behaviour and teach the forbidden fix.
 *      Check I fires on exactly the thing worth firing on: history was appended and the projection
 *      was not refreshed. The ratio is still REPORTED on every run, as a statistic, never a verdict.
 *   J. EXEMPTIONS ARE DECLARED, PROVEN, VISIBLE AND RATCHETED — a file may be exempt from G only by
 *      declaring itself GENERATED or ARCHIVE, and the declaration must name where its currency is
 *      proven. ⛔ Without J this family would be an escape hatch, and "an escape hatch for the
 *      UNMEASURABLE also silences the MEASURED". The exempt set is printed on every run and bounded
 *      by a ratchet that may only be LOWERED.
 *
 * ⚠ STATED BOUNDS, so nobody reads more coverage into these than they have:
 *   · Nothing here checks that the projection is TRUE — only that it exists, is shaped, is axis-free
 *     and is not stale. A wrong sentence in a well-formed block passes. Truth is a review property;
 *     the per-bullet citation discipline (ADR 0198 D3) is what a reviewer checks it with.
 *   · I reads dates from HEADINGS only. A newer date in a slice's BODY does not trip it — a heading
 *     is what a slice is announced by, and matching prose dates would fire on "until 2026-08-05".
 *   · H's date rule is deliberately blunt: it also rejects a legitimate date a writer wanted in the
 *     block. That is the intended trade — the cost of a false positive is moving one sentence down
 *     into history; the cost of a false negative is the phase axis growing back INSIDE the layer
 *     built to retire it.
 *   · G checks that the five sections are present, ordered and within the cap. It does not check
 *     that a section is non-empty. An empty `### Invariants` passes.
 */
export const STATE_HEADING = '## Current state'

/** ⛔ The seam vocabulary is NOT the hub vocabulary, and that is deliberate. Gate 13's
 *  `CURRENT_STATE_SECTIONS` (Objective · Done since start · In progress · Next · Blockers) describes
 *  a unit of WORK over time. A seam is a SURFACE; forcing work words onto it would re-introduce the
 *  very axis this layer exists to remove. The SHAPE is reused exactly — one replaceable block, a
 *  dated stamp, a fixed ordered section list, a line cap — and only the nouns differ (ADR 0198 D2).
 *  The cap itself is IMPORTED, not re-declared, so the number 60 keeps one home. */
export const SEAM_STATE_SECTIONS = ['Surface', 'Invariants', 'Rollout', 'Open edges', 'Where the detail lives']

/** ⛔ RATCHET — may only be LOWERED (the ADR 0186 D6 idiom). Set from MEASUREMENT, not from taste:
 *  the observed need of the largest domain seams at introduction. ⚠ Two blocks came in ABOVE it and
 *  were TRIMMED to fit rather than the number being raised to meet them — the ratchet biting on its
 *  own introduction is the discipline, not an exception to it. The smallest seam needs 61.
 *  Raising it is how a summary becomes a log one line at a time. If a block does not fit, cut a
 *  paraphrase and point at the frozen section instead — the detail is directly below it. */
export const SEAM_STATE_MAX_LINES = 100

/** The never-exceed bound the ratchet may not be argued past — DERIVED from the reused hub constant
 *  rather than chosen: a seam projection may cost at most twice a unit hub's block. */
export const SEAM_STATE_CEILING = CURRENT_STATE_MAX_LINES * 2

/** ⛔ RATCHET — may only be LOWERED. Four generated registries + one pre-split archive today. */
export const MAX_STATE_EXEMPT = 5

const GENERATED_DECL = /⚙ \*\*GENERATED FILE/
const ARCHIVE_DECL = /⛔ \*\*ARCHIVE\b/
const DATE_RX = /\d{4}-\d{2}-\d{2}/
/** A deployment verdict: a claim about an EXTERNAL system frozen into a durable map (ADR 0198 D5). */
const DEPLOY_VERDICT = /(NOT PUSHED|LOCAL[ -]ONLY|\bPUSHED\b)/i

/**
 * The declaration PARAGRAPH — the marker line to the next blank line, capped.
 *
 * ⛔ SCOPED BY REGION, NEVER BY SEARCHING THE WHOLE FILE, and a mutation run is what proved that
 * necessary. `generated-feature-flags.md` carries a generated DATA ROW whose prose contains the words
 * "Gate 2"; a whole-file `/gate \d+/` test therefore passed no matter what the declaration said, and
 * deleting "(gate 17)" from the declaration left the gate GREEN. The requirement was unfalsifiable in
 * exactly the file it governs. A structural claim about a DECLARATION has to be tested against the
 * declaration — the same REGION cut check C makes for the preamble, for the same reason.
 */
export function declarationParagraph(text, marker) {
  const lines = normalise(text).split('\n')
  const i = lines.findIndex((l) => marker.test(l))
  if (i < 0) return null
  let j = i
  while (j < lines.length && lines[j].trim() !== '' && j - i < 14) j += 1
  return lines.slice(i, j).join('\n')
}

/**
 * What KIND of file this is, and — for an exempt kind — whether its declaration actually names where
 * its currency is proven. ⛔ A self-declared exemption that names no proof is not an exemption; it is
 * the escape hatch wearing a label, so it comes back as a FINDING rather than as an exemption. The
 * three states are kept apart on purpose: exempt-and-proven, domain, and declared-but-unproven.
 */
export function classifySeam(file) {
  if (file.name === ROUTER) return { kind: 'router' }
  const text = normalise(file.text)
  if (GENERATED_DECL.test(text)) {
    // Proof of currency = a rebuild command AND a named gate that reds on drift — both looked for in
    // the DECLARATION only. See declarationParagraph above for what a whole-file test cost.
    const decl = declarationParagraph(text, GENERATED_DECL) ?? ''
    const hasCmd = /npm run [a-z0-9:_-]+/.test(decl)
    const hasGate = /\bgate \d+\b/i.test(decl)
    if (!hasCmd || !hasGate) {
      return {
        kind: 'unproven',
        badDecl:
          `declares itself GENERATED but names ${!hasCmd ? 'no rebuild command' : 'no gate'}. An exemption from ` +
          `the current-state layer is granted for PROVEN currency, never for the claim of it: name the ` +
          `\`npm run …\` that rebuilds the file and the gate that reds when it drifts.`,
      }
    }
    return { kind: 'generated', why: 'derived from the live catalog; currency proven by a named gate' }
  }
  if (ARCHIVE_DECL.test(text)) {
    const decl = declarationParagraph(text, ARCHIVE_DECL)
    if (!decl || !/[A-Za-z0-9._-]+\.md/.test(decl)) {
      return {
        kind: 'unproven',
        badDecl:
          `declares itself an ARCHIVE but its declaration names no live successor \`.md\`. An archive is history ` +
          `OF something: say what reads current instead, or it is just an unmaintained seam with a label.`,
      }
    }
    return { kind: 'archive', why: 'frozen pre-split history; a live successor is named' }
  }
  return { kind: 'domain' }
}

/** The `## Current state` block, with true line numbers and trailing blanks trimmed; `null` if absent. */
export function stateBlockOf(text) {
  const lines = normalise(text).split('\n')
  const start = lines.findIndex((l) => l.trimEnd() === STATE_HEADING)
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i
      break
    }
  }
  let n = end
  while (n > start + 1 && !lines[n - 1].trim()) n -= 1
  return { start, end: n, lines: lines.slice(start, n) }
}

/** G (and J's declared-but-unproven arm). Present, first, dated, exactly five sections, within cap. */
export function checkStatePresent(files) {
  const F = []
  for (const f of files) {
    const cls = classifySeam(f)
    if (cls.kind === 'unproven') {
      F.push(`[J] ${DIR_REL}/${f.name} — ${cls.badDecl}`)
      continue
    }
    if (cls.kind !== 'domain') continue
    const block = stateBlockOf(f.text)
    if (!block) {
      F.push(
        `[G] ${DIR_REL}/${f.name} — no \`${STATE_HEADING}\` block. A seam file exists to answer "what is TRUE ` +
          `about this part of the backend NOW"; without this layer a reader must replay its frozen slices and ` +
          `apply their supersessions by hand, which is the defect the split reduced and ADR 0198 removes.`,
      )
      continue
    }
    const firstH2 = normalise(f.text).split('\n').findIndex((l) => /^## /.test(l))
    if (firstH2 !== block.start) {
      F.push(
        `[G] ${DIR_REL}/${f.name}:${block.start + 1} — \`${STATE_HEADING}\` must be the FIRST \`##\` section. ` +
          `A reader must not scroll past history to reach the state.`,
      )
    }
    if (!/\*\*Updated:\*\*\s*\d{4}-\d{2}-\d{2}/.test(block.lines.join('\n'))) {
      F.push(`[G] ${DIR_REL}/${f.name}:${block.start + 1} — \`${STATE_HEADING}\` lacks \`**Updated:** YYYY-MM-DD\``)
    }
    const secs = block.lines.filter((l) => /^### /.test(l)).map((l) => l.replace(/^### /, '').trim())
    if (secs.join('|') !== SEAM_STATE_SECTIONS.join('|')) {
      F.push(
        `[G] ${DIR_REL}/${f.name}:${block.start + 1} — sections must be exactly ` +
          `[${SEAM_STATE_SECTIONS.join(', ')}] in order; found [${secs.join(', ')}]`,
      )
    }
    if (block.lines.length > SEAM_STATE_MAX_LINES) {
      F.push(
        `[G] ${DIR_REL}/${f.name}:${block.start + 1} — the block is ${block.lines.length} lines; the ratchet is ` +
          `${SEAM_STATE_MAX_LINES} (ceiling ${SEAM_STATE_CEILING}). ⛔ Do NOT raise the ratchet — it may only be ` +
          `LOWERED. Cut a paraphrase and point at the frozen section instead; the detail is directly below it.`,
      )
    }
  }
  return F
}

/** H. Inside the block: no supersession marker, no deployment verdict, no date but `**Updated:**`. */
export function checkStateIsProjection(files) {
  const F = []
  for (const f of files) {
    if (classifySeam(f).kind !== 'domain') continue
    const block = stateBlockOf(f.text)
    if (!block) continue
    // ⚠ The date ban is lifted for CITATIONS in the last section, and only there. That section's job
    // is to NAME the frozen sections below, and a frozen heading's own name may carry a date
    // (`§ REMOTE CENSUS 2026-08-18`). Forcing a writer to truncate it would break the navigation the
    // section exists to provide — so the exception is scoped to a line that actually cites: one
    // carrying a `§` or a markdown link. A bare dated CLAIM parked there still reds.
    let inCitations = false
    block.lines.forEach((line, i) => {
      const at = `${DIR_REL}/${f.name}:${block.start + i + 1}`
      if (/⚠\s*\*\*Superseded\*\*/.test(line)) {
        F.push(
          `[H] ${at} — a \`⚠ **Superseded**\` marker inside \`${STATE_HEADING}\`. This layer is REPLACED in ` +
            `place, never superseded: delete the stale sentence and write the true one. Markers belong to the ` +
            `frozen slices below, which may not be edited.`,
        )
      }
      const dep = line.match(DEPLOY_VERDICT)
      if (dep) {
        F.push(
          `[H] ${at} — a deployment verdict (\`${dep[0]}\`) inside \`${STATE_HEADING}\`. Whether a migration ` +
            `reached the remote is a claim about an EXTERNAL system and goes stale silently; this layer names the ` +
            `MEASUREMENT, never the result — conventions.md § Remote discipline (ADR 0198 D5).`,
        )
      }
      if (/^### /.test(line)) inCitations = line.trim() === `### ${SEAM_STATE_SECTIONS[SEAM_STATE_SECTIONS.length - 1]}`
      if (DATE_RX.test(line) && !/\*\*Updated:\*\*/.test(line) && !(inCitations && /§|\]\(/.test(line))) {
        F.push(
          `[H] ${at} — a date inside \`${STATE_HEADING}\` other than \`**Updated:**\`. A dated line IS a slice ` +
            `whatever it is called; move it down into the frozen history, where the phase axis belongs. ` +
            `(In \`### ${SEAM_STATE_SECTIONS[SEAM_STATE_SECTIONS.length - 1]}\` a date is allowed only inside a ` +
            `\`§ …\` citation or a markdown link — a frozen section's own NAME may carry a date.)`,
        )
      }
    })
  }
  return F
}

/** I. The projection is not older than the newest history it sits above. */
export function checkStateNotStale(files) {
  const F = []
  for (const f of files) {
    if (classifySeam(f).kind !== 'domain') continue
    const block = stateBlockOf(f.text)
    if (!block) continue
    const upd = block.lines.join('\n').match(/\*\*Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/)
    if (!upd) continue // already reported by G
    const lines = normalise(f.text).split('\n')
    let newest = null
    let fence = false
    for (let i = block.end; i < lines.length; i += 1) {
      if (/^\s*(```|~~~)/.test(lines[i])) {
        fence = !fence
        continue
      }
      if (fence || !/^#{2,6} /.test(lines[i])) continue
      for (const m of lines[i].matchAll(/(\d{4}-\d{2}-\d{2})/g)) {
        if (newest == null || m[1] > newest) newest = m[1]
      }
    }
    if (newest && upd[1] < newest) {
      F.push(
        `[I] ${DIR_REL}/${f.name}:${block.start + 1} — \`${STATE_HEADING}\` is stamped ${upd[1]}, but a frozen ` +
          `heading below it is dated ${newest}. History was appended and the projection was not refreshed — which ` +
          `is exactly how this layer rots back into a log. REPLACE the block and re-stamp it.`,
      )
    }
  }
  return F
}

/**
 * J. The exempt set is bounded. ⛔ A ratchet, never a cap: it may be LOWERED when an exemption is
 * retired, and a commit that raises it reds. The set itself is printed by `main()` on every run, so
 * an exemption is never silent — the failure this guards against is not a wrong exemption but an
 * unnoticed one.
 */
export function checkStateExemptions(files) {
  const exempt = files.filter((f) => ['generated', 'archive'].includes(classifySeam(f).kind))
  if (exempt.length <= MAX_STATE_EXEMPT) return []
  return [
    `[J] ${DIR_REL}/ — ${exempt.length} files are exempt from the current-state layer (${exempt.map((f) => f.name).join(', ')}); ` +
      `the ratchet is ${MAX_STATE_EXEMPT}. ⛔ Do NOT raise it. A seam that is neither generated nor archived owes a ` +
      `\`${STATE_HEADING}\` block — the exemption exists for files whose currency another gate already proves.`,
  ]
}

/**
 * The canonical EMPTY form of a current-state block, emitted from `SEAM_STATE_SECTIONS` — the same
 * constant checks G and H read.
 *
 * ⛔ WHY THIS IS CODE AND NOT A MARKDOWN TEMPLATE FILE. A template file is a SECOND copy of the
 * shape, and a second copy drifts: it is the exact failure ADR 0196 D6 names about the preamble ("a
 * rule repeated in twelve files is a rule that drifts in eleven of them") and the reason the ADR
 * index is generated rather than hand-listed. Rename a section here and the scaffold renames itself;
 * a template file would have gone on printing the old name until somebody noticed. `--scaffold` is
 * the ONE authority on the form, and the self-test asserts the thing it prints passes the checks —
 * a scaffold its own gate would reject is worse than no scaffold at all.
 *
 * The prose is deliberately instructional rather than plausible-looking filler: a writer who leaves
 * a line in has left an instruction in, which reads as unfinished. Filler reads as finished.
 */
export function scaffold(today = new Date().toISOString().slice(0, 10)) {
  const guidance = {
    Surface: [
      '- **`schema.table`** — what it holds, in one clause. Name the NOUNS this seam owns.',
      '- **Doors** — the RPCs and helpers. ⛔ Do not list signatures, `prosecdef` or grants here:',
      '  point at [`generated-rpc-surface.md`](generated-rpc-surface.md) and',
      '  [`generated-helper-surface.md`](generated-helper-surface.md), which are derived from the catalog.',
    ],
    Invariants: [
      '- **What must stay TRUE.** Each bullet should be something a future change could BREAK.',
      '  ⛔ Keep every qualifier, negation and scope bound — "no authenticated INSERT" is not',
      '  "INSERT is restricted", and "not reachable" is not "protected". This is the section that',
      '  earns the block; a paraphrase that softens a bound is worse than no bullet.',
    ],
    Rollout: [
      '- Flags over this seam: `flag_key`. ⛔ Resolve each flag\'s VALUE and its readers from',
      '  [`generated-feature-flags.md`](generated-feature-flags.md), never from a sentence here.',
      '- ⛔ **Deployment status is not stated in this layer** (ADR 0198 D5). Whether a migration reached',
      '  the remote is a claim about an external system that rots silently — measure it with the recipes',
      '  in [`conventions.md` § Remote discipline](conventions.md#remote-discipline--standing-rules-measure-never-quote).',
    ],
    'Open edges': [
      '- Known gaps, deferred work, and places this map is THIN. ⚠ "Could not verify" is a legitimate',
      '  and useful entry — write it rather than leaving a confident silence.',
    ],
    'Where the detail lives': [
      '- The frozen slices below, in order: **§ <short prefix>** · **§ <short prefix>**.',
      '- ADR [NNNN](../decisions/NNNN-<slug>.md) (<what it decided>).',
    ],
  }
  const out = [
    STATE_HEADING,
    '',
    `**Updated:** ${today} — a REPLACEABLE projection of the frozen slices below. Replace this block in`,
    'place; never append to it, and never move a line of history into it (ADR 0198). Figures live in the',
    'generated registries; the live catalog is the authority (ADR 0078).',
  ]
  for (const s of SEAM_STATE_SECTIONS) {
    out.push('', `### ${s}`, '', ...(guidance[s] ?? ['- …']))
  }
  return out.join('\n')
}

/** The historical/current ratio — REPORTED, never a verdict. See the note on check I above. */
export function stateLayerStats(files) {
  let stateLines = 0
  let historyLines = 0
  let domains = 0
  for (const f of files) {
    if (classifySeam(f).kind !== 'domain') continue
    domains += 1
    const block = stateBlockOf(f.text)
    const total = normalise(f.text).split('\n').length
    const s = block ? block.lines.length : 0
    stateLines += s
    historyLines += Math.max(0, total - s)
  }
  return { domains, stateLines, historyLines, ratio: stateLines ? historyLines / stateLines : Infinity }
}

/**
 * K. BULK — no pathological line, no runaway hand-written section.
 *
 * ⛔ Check D bounds a FILE. It is silent on the shape inside one, and the predecessor's worst
 * artefact was not a big file but a single **66,557-character line** — the collapsed
 * `Last updated / Previous / prior` chain, which no editor, diff or reviewer could read, and which
 * hid its own contents for months. D never saw it because the file it lived in was under cap.
 *
 * The SECTION cap exempts `generated` and `archive` seams: their size is a property of their
 * source, not of anyone's discipline, and they carry their own currency proof (check J). The LINE
 * cap applies to everything, generated included — a catalog row that renders as an 8,000-character
 * line is a generator bug, not a large table.
 *
 * ⚠ Both caps are set ABOVE today's measured maximum (line 6,798 in `conventions.md`; hand-written
 * section 394 in `printing.md`), so this check does not force a reflow of anything already posted —
 * it is a ceiling against the pathological case, never a style rule. ⛔ Because nothing in the tree
 * violates it today, the ONLY evidence it works is its self-test and the real-corpus mutation.
 */
export const MAX_LINE_CHARS = 8000
export const MAX_SECTION_LINES = 450

export function checkBulk(files) {
  const F = []
  for (const f of files) {
    const lines = normalise(f.text).split('\n')
    lines.forEach((l, i) => {
      if (l.length > MAX_LINE_CHARS) {
        F.push(
          `[K] ${DIR_REL}/${f.name}:${i + 1} — a single line of ${l.length} characters (cap ${MAX_LINE_CHARS}). ` +
            `The predecessor's worst artefact was a 66,557-character line no reader could open; break it into lines.`,
        )
      }
    })
    const kind = classifySeam(f).kind
    if (kind === 'generated' || kind === 'archive' || kind === 'router') continue
    const idx = lines.map((l, i) => (l.startsWith('## ') ? i : -1)).filter((i) => i >= 0)
    idx.forEach((start, k) => {
      const end = k + 1 < idx.length ? idx[k + 1] : lines.length
      if (end - start > MAX_SECTION_LINES) {
        F.push(
          `[K] ${DIR_REL}/${f.name}:${start + 1} — section "${lines[start].slice(3, 60)}" is ${end - start} lines ` +
            `(cap ${MAX_SECTION_LINES}). ⛔ Do NOT raise the cap: a section this long is a seam that wants splitting, ` +
            `or history that belongs in the unit record.`,
        )
      }
    })
  }
  return F
}

export function runChecks(files, root = REPO_ROOT, exists = (p) => existsSync(join(root, p))) {
  const known = new Set(files.map((f) => f.name))
  const router = files.find((f) => f.name === ROUTER)
  const { F: sizeF, W } = checkSizes(files)
  const routerText = router ? normalise(router.text) : null
  return {
    F: [
      ...checkPreambleIdentical(files),
      ...checkRouted(files, routerText),
      ...checkRouterTargetsExist(routerText, known),
      ...checkSupersededTargets(files, known),
      ...checkSeamNaming(files),
      ...checkLocalLinks(files, root, exists),
      ...checkBulk(files),
      ...checkStatePresent(files),
      ...checkStateIsProjection(files),
      ...checkStateNotStale(files),
      ...checkStateExemptions(files),
      ...sizeF,
    ],
    W,
  }
}

// ---------------------------------------------------------------------------
// Self-test — both arms. Fixtures only; never the real files.
// ---------------------------------------------------------------------------
const PRE = '> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)**.\n> Second line.'
const good = (name, extra = '') => ({ name, text: `# Backend State — x\n\n${PRE}\n\n## S\n\nbody\n${extra}` })
const WHEN_A = 'touch a thing you are about to change'
const ROUTER_OK = {
  name: ROUTER,
  text: `# Backend State — the router\n\n| Open this | When you are about to |\n| --- | --- |\n| [\`a.md\`](a.md) | ${WHEN_A} |\n| [\`b.md\`](b.md) | ${WHEN_A} |\n`,
}

function selfTest() {
  const bad = []
  let armCount = 0
  const t = (label, cond) => {
    armCount += 1
    if (!cond) bad.push(label)
  }

  // A — divergence caught, agreement clean
  t('A catches a drifted preamble', checkPreambleIdentical([good('a.md'), { name: 'b.md', text: `# X\n\n> different\n\n## S\n` }]).length > 0)
  t('A catches a missing preamble', checkPreambleIdentical([good('a.md'), { name: 'b.md', text: '# X\n\n## S\nbody\n' }]).length > 0)
  t('A clean when identical', checkPreambleIdentical([good('a.md'), good('b.md')]).length === 0)

  // B — unrouted caught, routed clean
  t('B catches an unrouted file', checkRouted([ROUTER_OK, good('a.md'), good('zz.md')], ROUTER_OK.text).length === 1)
  t('B clean when all routed', checkRouted([ROUTER_OK, good('a.md'), good('b.md')], ROUTER_OK.text).length === 0)
  t('B catches a missing router', checkRouted([good('a.md')], null).length === 1)
  // M3: a bare mention in PROSE is not a route — the row shape is what enforces D3.
  t('B catches a prose mention with no table row', checkRouted([ROUTER_OK, good('c.md')], ROUTER_OK.text + '\nsee also [c](c.md) somewhere\n').length === 1)
  t('B catches a row whose when-clause is empty', checkRouted([ROUTER_OK, good('c.md')], ROUTER_OK.text + '| [`c.md`](c.md) |  |\n').length === 1)
  t('B catches a row whose when-clause is a token', checkRouted([ROUTER_OK, good('c.md')], ROUTER_OK.text + '| [`c.md`](c.md) | tbd |\n').length === 1)

  // M1: the OPPOSITE polarity of B — a routed name that does not exist.
  t('B2 catches a dangling router target', checkRouterTargetsExist(ROUTER_OK.text, new Set([ROUTER, 'a.md'])).length === 1)
  t('B2 clean when every target exists', checkRouterTargetsExist(ROUTER_OK.text, new Set([ROUTER, 'a.md', 'b.md'])).length === 0)
  t('B2 silent on a missing router', checkRouterTargetsExist(null, new Set()).length === 0)

  // M2: D2's enforcer — a seam is a noun, not a number.
  t('E catches a phase-named file', checkSeamNaming([good('phase-24-2026-09-20.md')]).length === 1)
  t('E catches a slice-coded file', checkSeamNaming([good('dm5-s3.md')]).length === 1)
  t('E clean on noun seams', checkSeamNaming([good('document-model.md'), good('privacy-and-dsr.md')]).length === 0)
  t('E never fires on the router', checkSeamNaming([{ name: ROUTER, text: '' }]).length === 0)

  // C — dangling target caught, resolving target clean, targetless marker caught
  const known = new Set([ROUTER, 'a.md', 'b.md'])
  t('C catches a dangling target', checkSupersededTargets([{ name: 'a.md', text: '## S\n⚠ **Superseded** — x. See gone.md § 2.\n' }], known).length === 1)
  t('C clean on a resolving target', checkSupersededTargets([{ name: 'a.md', text: '## S\n⚠ **Superseded** — x. See b.md § 2.\n' }], known).length === 0)
  t('C catches a targetless marker', checkSupersededTargets([{ name: 'a.md', text: '## S\n⚠ **Superseded** — x, somewhere.\n' }], known).length === 1)
  t('C skips the marker form QUOTED in the preamble', checkSupersededTargets([{ name: 'a.md', text: `# X

> rules: use ⚠ **Superseded** — x.

## S
body
` }], known).length === 0)
  t('C still fires BELOW the preamble (the cut does not blind it)', checkSupersededTargets([{ name: 'a.md', text: `# X

> rules: use ⚠ **Superseded** — x.

## S
⚠ **Superseded** — y. See gone.md § 1.
` }], known).length === 1)
  t('C reports the TRUE line number past the preamble', checkSupersededTargets([{ name: 'a.md', text: `# X

> pre

## S
⚠ **Superseded** — y. See gone.md § 1.
` }], known).some((f) => f.includes(':6')))
  t('C skips the router whole', checkSupersededTargets([{ name: ROUTER, text: `## S
⚠ **Superseded** — x. See gone.md § 1.
` }], known).length === 0)
  t('C sees a target on the SIXTH line of a long marker', checkSupersededTargets([{ name: 'a.md', text: `## S
⚠ **Superseded** — one
two
three
four
five. See b.md § 2.
` }], known).length === 0)
  t('C stops at a BLANK line (a later file name is not this marker’s target)', checkSupersededTargets([{ name: 'a.md', text: `## S
⚠ **Superseded** — x.

unrelated prose citing b.md
` }], known).length === 1)
  t('C ignores ordinary prose', checkSupersededTargets([{ name: 'a.md', text: '## S\nthis was superseded by nothing\n' }], known).length === 0)

  // C section half — `§ 9999` used to pass
  const secFiles = [{ name: 'b.md', text: `## Real Heading\nbody\n` }]
  const mk = (marker) => [{ name: 'a.md', text: `## S\n${marker}\n` }]
  t('C catches a marker naming a NON-EXISTENT section', checkSupersededTargets(mk('⚠ **Superseded** — x. See b.md § 9999.'), known, secFiles).length === 1)
  t('C clean when the section EXISTS', checkSupersededTargets(mk('⚠ **Superseded** — x. See b.md § Real Heading.'), known, secFiles).length === 0)
  t('C tolerates a marker with no section clause', checkSupersededTargets(mk('⚠ **Superseded** — x. See b.md.'), known, secFiles).length === 0)

  // F — link integrity, via the SHARED checker (M-P0)
  t('F catches a dangling local link', checkLocalLinks([{ name: 'a.md', text: '[x](decisions/gone.md)' }], '', () => false).length === 1)
  t('F clean when the link resolves', checkLocalLinks([{ name: 'a.md', text: '[x](../decisions/ok.md)' }], '', () => true).length === 0)
  t('F treats a code span as a mention, not a link', checkLocalLinks([{ name: 'a.md', text: 'see `a[_for](org[,uid])` here' }], '', () => false).length === 0)
  t('F ignores http', checkLocalLinks([{ name: 'a.md', text: '[x](https://example.invalid/z.md)' }], '', () => false).length === 0)

  // D — over cap fails, over warn warns only, under both clean
  t('D fails over the hard cap', checkSizes([{ name: 'a.md', text: 'x'.repeat(HARD_BYTES + 1) }]).F.length === 1)
  t('D warns (not fails) over the warn line', (() => {
    const r = checkSizes([{ name: 'a.md', text: 'x'.repeat(WARN_BYTES + 1) }])
    return r.F.length === 0 && r.W.length === 1
  })())
  t('D clean under both', (() => {
    const r = checkSizes([{ name: 'a.md', text: 'x'.repeat(1024) }])
    return r.F.length === 0 && r.W.length === 0
  })())

  // ── K — bulk. Nothing in the tree violates K today, so these arms and the real-corpus mutation
  // are the ONLY evidence it can fire at all. Each is paired with a silent half.
  const bulkDoc = (body) => ({ name: 'a.md', text: `# X\n\n> pre\n\n${body}` })
  t('K catches a pathological LINE', checkBulk([bulkDoc(`## S\n${'x'.repeat(MAX_LINE_CHARS + 1)}\n`)]).length === 1)
  t('K clean on a long-but-sane line', checkBulk([bulkDoc(`## S\n${'x'.repeat(MAX_LINE_CHARS - 1)}\n`)]).length === 0)
  t('K catches a runaway SECTION', checkBulk([bulkDoc(`## S\n${'body\n'.repeat(MAX_SECTION_LINES + 1)}`)]).length === 1)
  t('K clean on a section at the cap', checkBulk([bulkDoc(`## S\n${'body\n'.repeat(MAX_SECTION_LINES - 2)}`)]).length === 0)
  // The section cap must NOT apply to a generated file: its size is a property of its source.
  t('K exempts a GENERATED file from the section cap', (() => {
    const gen = {
      name: 'generated-x.md',
      text: `# X\n\n> pre\n\n> ⚙ **GENERATED FILE — do not edit by hand.** Rebuild with \`npm run gen:x\`; gate 16 reds on drift.\n\n## S\n${'body\n'.repeat(MAX_SECTION_LINES + 50)}`,
    }
    return classifySeam(gen).kind === 'generated' && checkBulk([gen]).length === 0
  })())
  // ...but the LINE cap still applies to it — a giant line is a generator bug, not a large table.
  t('K still catches a pathological line in a GENERATED file', checkBulk([{
    name: 'generated-x.md',
    text: `# X\n\n> pre\n\n> ⚙ **GENERATED FILE — do not edit by hand.** Rebuild with \`npm run gen:x\`; gate 16 reds on drift.\n\n## S\n${'x'.repeat(MAX_LINE_CHARS + 1)}\n`,
  }]).length === 1)


  // ── G/H/I/J — the current-state layer (ADR 0198) ─────────────────────────────────────────────
  // Every arm below is a PAIR: the check fires on a fixture that breaks it, and stays silent on one
  // that satisfies it. The silent halves are not decoration — a detector that fires on everything is
  // no better than one that finds nothing, and three of them (H on a date BELOW the block, I on a
  // fenced heading, I on a prose date) are DISCRIMINATION halves: near-misses that must NOT fire.
  const ST = (extra = '') =>
    `## Current state\n\n**Updated:** 2026-09-09 — x\n\n### Surface\n\ns\n\n### Invariants\n\ni\n\n` +
    `### Rollout\n\nr\n\n### Open edges\n\no\n\n### Where the detail lives\n\nw\n${extra}`
  const HIST = '\n## H — a slice (2026-01-01)\n\nbody\n'
  const seam = (state, hist = HIST) => ({ name: 'a.md', text: `# X\n\n${PRE}\n\n${state}${hist}` })
  const okSeam = seam(ST())
  const GEN = (extra) => ({
    name: 'generated-x.md',
    text: `# X (GENERATED)\n\n${PRE}\n\n⚙ **GENERATED FILE — do not edit by hand.** ${extra}\n\n## Rows\n\nbody\n`,
  })
  const ARCH = (extra) => ({ name: 'stamp-history.md', text: `# X\n\n${PRE}\n\n⛔ **ARCHIVE** — ${extra}\n\n## Old\n\nbody\n` })

  // G — presence, position, stamp, sections, cap
  t('G catches a missing current-state block', checkStatePresent([seam('')]).length === 1)
  t('G clean on a well-formed block', checkStatePresent([okSeam]).length === 0)
  t('G catches a block that is not the FIRST ## section', checkStatePresent([{ name: 'a.md', text: `# X\n\n${PRE}\n\n## Old (2026-01-01)\n\nbody\n\n${ST()}` }]).some((f) => f.includes('FIRST')))
  t('G catches a missing **Updated:** stamp', checkStatePresent([seam(ST().replace('**Updated:** 2026-09-09 — x', 'no stamp'))]).some((f) => f.includes('Updated')))
  t('G catches sections out of order', checkStatePresent([seam(ST().replace('### Surface', '### Invariants').replace(/### Invariants\n\ni/, '### Surface\n\ni'))]).some((f) => f.includes('in order')))
  t('G catches a renamed section', checkStatePresent([seam(ST().replace('### Rollout', '### Deployment'))]).some((f) => f.includes('in order')))
  t('G catches a block over the ratchet', checkStatePresent([seam(ST('x\n'.repeat(80)))]).some((f) => f.includes('ratchet')))
  t('G clean at exactly the ratchet', checkStatePresent([seam(ST('x\n'.repeat(SEAM_STATE_MAX_LINES - 23)))]).length === 0)
  t('G never fires on the router', checkStatePresent([{ name: ROUTER, text: '# R\n\n## Rules\n' }]).length === 0)
  t('G never fires on a GENERATED file', checkStatePresent([GEN('rebuild with `npm run data-access:surface`; gate 17 reds on drift.')]).length === 0)
  t('G never fires on an ARCHIVE file', checkStatePresent([ARCH('the pre-split map. Read conventions.md instead.')]).length === 0)

  // J — an exemption must NAME its proof, and the set is ratcheted
  t('J catches a GENERATED file naming no gate', checkStatePresent([GEN('rebuild with `npm run data-access:surface`.')]).some((f) => f.includes('no gate')))
  t('J catches a GENERATED file naming no rebuild command', checkStatePresent([GEN('gate 17 reds on drift.')]).some((f) => f.includes('no rebuild command')))
  t('J catches an ARCHIVE naming no live successor', checkStatePresent([ARCH('the old map. Nothing replaces it.')]).some((f) => f.includes('no live successor')))
  t('J: an unproven declaration is NOT silently exempt (it is a finding, not a pass)', checkStatePresent([GEN('rebuilt somehow.')]).length === 1)
  const GEN_BODY = (declExtra, bodyExtra) => ({
    name: 'generated-x.md',
    text: `# X (GENERATED)\n\n${PRE}\n\n⚙ **GENERATED FILE — do not edit by hand.** ${declExtra}\n\n## Rows\n\n${bodyExtra}\n`,
  })
  t('J region cut: a gate named only in the BODY does not satisfy the declaration', checkStatePresent([GEN_BODY('rebuild with `npm run x`.', 'a row mentioning Gate 2 in prose')]).some((f) => f.includes('no gate')))
  t('J region cut: a rebuild command named only in the BODY does not satisfy it either', checkStatePresent([GEN_BODY('gate 17 reds on drift.', 'a row mentioning npm run something')]).some((f) => f.includes('no rebuild command')))
  t('J region cut: a declaration naming BOTH is still clean with an unrelated body', checkStatePresent([GEN_BODY('rebuild with `npm run x`; gate 17 reds on drift.', 'rows about Gate 2 and npm run other')]).length === 0)
  t('J region cut: an ARCHIVE whose only .md sits below the declaration is a finding', checkStatePresent([{ name: 'stamp-history.md', text: `# X\n\n${PRE}\n\n⛔ **ARCHIVE** — nothing lives here.\n\n## Old\n\nsee conventions.md\n` }]).some((f) => f.includes('no live successor')))
  t('J catches the exempt set over its ratchet', checkStateExemptions(Array.from({ length: MAX_STATE_EXEMPT + 1 }, () => ARCH('x. See conventions.md.'))).length === 1)
  t('J clean at exactly the exempt ratchet', checkStateExemptions(Array.from({ length: MAX_STATE_EXEMPT }, () => ARCH('x. See conventions.md.'))).length === 0)
  t('J counts only exempt kinds, never domain seams', checkStateExemptions([okSeam, okSeam, okSeam, okSeam, okSeam, okSeam]).length === 0)

  // H — the block stays a projection, not a log
  t('H catches a Superseded marker inside the block', checkStateIsProjection([seam(ST('⚠ **Superseded** — x. See b.md § y.\n'))]).some((f) => f.includes('REPLACED in')))
  t('H catches a NOT PUSHED verdict inside the block', checkStateIsProjection([seam(ST('- ⛔ NOT PUSHED to the remote.\n'))]).some((f) => f.includes('deployment verdict')))
  t('H catches a LOCAL ONLY verdict inside the block', checkStateIsProjection([seam(ST('- migrations are LOCAL ONLY.\n'))]).some((f) => f.includes('deployment verdict')))
  t('H catches a positive PUSHED verdict too (both polarities)', checkStateIsProjection([seam(ST('- ✅ PUSHED at the gate.\n'))]).some((f) => f.includes('deployment verdict')))
  t('H catches a stray date inside the block', checkStateIsProjection([seam(ST().replace('### Surface\n\ns', '### Surface\n\n- swept 2026-01-02'))]).some((f) => f.includes('a date inside')))
  t('H allows a dated § CITATION in the last section (a frozen heading may be named)', checkStateIsProjection([seam(ST('- § REMOTE CENSUS 2026-08-18 below.\n'))]).length === 0)
  t('H allows a dated markdown LINK in the last section', checkStateIsProjection([seam(ST('- [x](b.md#h-2026-08-18) below.\n'))]).length === 0)
  t('H still catches a bare dated CLAIM in the last section (the exception is scoped to citations)', checkStateIsProjection([seam(ST('- swept on 2026-08-18 and left open.\n'))]).some((f) => f.includes('a date inside')))
  t('H catches a dated claim in an EARLIER section even though the last one allows citations', checkStateIsProjection([seam(ST().replace('### Rollout\n\nr', '### Rollout\n\n- § flipped 2026-01-02'))]).some((f) => f.includes('a date inside')))
  t('H does NOT fire on the **Updated:** date itself', checkStateIsProjection([okSeam]).length === 0)
  t('H does NOT fire on a date BELOW the block (the discrimination half)', checkStateIsProjection([seam(ST(), '\n## H — a slice (2026-12-31)\n\nbody dated 2026-12-31\n')]).length === 0)
  t('H is silent on an exempt file', checkStateIsProjection([GEN('`npm run x`; gate 17. Dated 2026-01-01, NOT PUSHED.')]).length === 0)

  // I — the projection may not be staler than the history it sits on
  t('I catches a stamp older than a frozen heading below', checkStateNotStale([seam(ST(), '\n## H — later (2026-12-31)\n\nbody\n')]).length === 1)
  t('I clean when the stamp is newer than every heading below', checkStateNotStale([okSeam]).length === 0)
  t('I clean when there is no history at all', checkStateNotStale([seam(ST(), '')]).length === 0)
  t('I ignores a heading-shaped line inside a FENCE (discrimination)', checkStateNotStale([seam(ST(), '\n## H — x\n\n```\n## fake (2026-12-31)\n```\n')]).length === 0)
  t('I ignores a date in PROSE below (discrimination — headings only, by design)', checkStateNotStale([seam(ST(), '\n## H — x\n\nsee 2026-12-31 in prose\n')]).length === 0)
  t('I reads the NEWEST heading date, not the first', checkStateNotStale([seam(ST(), '\n## A (2026-12-31)\n\nb\n\n## B (2026-01-01)\n\nb\n')]).length === 1)
  t('I is silent on an exempt file', checkStateNotStale([GEN('`npm run x`; gate 17.')]).length === 0)

  // ⛔ The scaffold must satisfy the very checks it scaffolds for. Without this arm the two could
  // drift apart silently, and the first writer to use it would be handed a red.
  const scaffolded = { name: 'a.md', text: `# X\n\n${PRE}\n\n${scaffold('2026-09-09')}\n\n## H — a slice (2026-01-01)\n\nbody\n` }
  t('scaffold: what --scaffold prints passes check G', checkStatePresent([scaffolded]).length === 0)
  t('scaffold: what --scaffold prints passes check H', checkStateIsProjection([scaffolded]).length === 0)
  t('scaffold: what --scaffold prints passes check I', checkStateNotStale([scaffolded]).length === 0)
  t('scaffold: it emits every section, in order, from the ONE constant', scaffold().split('\n').filter((l) => /^### /.test(l)).map((l) => l.slice(4)).join('|') === SEAM_STATE_SECTIONS.join('|'))
  t('scaffold: it fits well inside the ratchet, leaving room to write', scaffold().split('\n').length < SEAM_STATE_MAX_LINES / 2)

  // The reported ratio counts DOMAIN seams only — a statistic that lies is worse than none.
  t('stats count domain seams only', stateLayerStats([okSeam, GEN('`npm run x`; gate 17.'), { name: ROUTER, text: '# R\n' }]).domains === 1)
  t('stats separate state lines from history lines', (() => {
    const s = stateLayerStats([okSeam])
    return s.stateLines === 23 && s.historyLines > 0
  })())

  if (bad.length) {
    console.error('backend-state gate: SELF-TEST FAILED\n')
    for (const b of bad) console.error(`  - ${b}`)
    process.exit(1)
  }
  return armCount
}

// ---------------------------------------------------------------------------
function main() {
  const n = selfTest()
  if (process.argv.includes('--scaffold')) {
    console.log(scaffold())
    return
  }
  if (process.argv.includes('--self-test')) {
    console.log(`backend-state gate self-test: OK (${n} arms — each check proven able to fire AND to stay silent)`)
    return
  }

  let names
  try {
    names = readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()
  } catch {
    console.error(
      `backend-state gate: FAILED\n\n  ${DIR_REL}/ does not exist. That directory is the backend surface map ` +
        `(split from the single file docs/backend-state.md on 2026-09-09). If this fired from a subdirectory, ` +
        `the path resolves from THIS FILE, so that is not the cause — the directory is genuinely absent.`,
    )
    process.exit(1)
  }

  const files = names.map((name) => ({ name, text: readFileSync(join(DIR, name), 'utf8') }))
  const { F, W } = runChecks(files)

  for (const w of W) console.warn(`backend-state gate: WARN — ${w}`)
  if (F.length) {
    console.error('backend-state gate: FAILED\n')
    for (const f of F) console.error(`  ${f}`)
    console.error(`\n  Rules: ${DIR_REL}/${ROUTER} § Maintenance rules.`)
    if (F.some((f) => /^\[[GHIJ]\]/.test(f))) {
      console.error(
        `  For a [G]/[H]/[I]/[J] finding, the canonical empty block is \`node scripts/check-backend-state.mjs --scaffold\` ` +
          `— emitted from the same constants these checks read, so it cannot drift from them. How to fill it in: ` +
          `${DIR_REL}/${ROUTER} § Writing and refreshing a current-state block.`,
      )
    }
    process.exit(1)
  }

  // ⛔ The exempt set is PRINTED on every run, clean or not. An exemption nobody sees is the escape
  // hatch this family exists to bound: J caps how many there may be, this is what makes them visible.
  const exempt = files.map((f) => [f.name, classifySeam(f)]).filter(([, c]) => c.kind === 'generated' || c.kind === 'archive')
  for (const [name, c] of exempt) console.log(`backend-state gate: EXEMPT from the current-state layer — ${name} (${c.kind}: ${c.why})`)
  const st = stateLayerStats(files)
  console.log(
    `backend-state gate: state layer — ${st.domains} domain seam(s), ${st.stateLines} current-state line(s) over ` +
      `${st.historyLines} frozen line(s) (ratio 1:${st.ratio.toFixed(1)}; ratchet ${SEAM_STATE_MAX_LINES} lines/block, ` +
      `${exempt.length}/${MAX_STATE_EXEMPT} exemptions). ⚠ The ratio is REPORTED, never gated — see check I.`,
  )
  const total = files.reduce((a, f) => a + Buffer.byteLength(f.text, 'utf8'), 0)
  const largest = files.reduce((a, f) => (Buffer.byteLength(f.text, 'utf8') > Buffer.byteLength(a.text, 'utf8') ? f : a))
  console.log(
    `backend-state gate: OK — ${files.length - 1} seam file(s) + ${ROUTER}, all routed, preamble identical, ` +
      `${(total / 1024).toFixed(0)} KB total, largest ${largest.name} at ${(Buffer.byteLength(largest.text, 'utf8') / 1024).toFixed(1)} KB ` +
      `(warn ${WARN_BYTES / 1024} KB / cap ${HARD_BYTES / 1024} KB)${W.length ? ` — ${W.length} warning(s) above` : ''}.`,
  )
}

// ⛔ Run the gate only when invoked as a script. Until 2026-09-09 `main()` ran on IMPORT, so any
// future gate importing a helper from here would silently execute the whole check — observed for
// real while debugging check F. `check-docs-registers.mjs` is import-safe; so is this now.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main()
