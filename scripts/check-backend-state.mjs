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
 * A split does not stay split on its own. Four checks hold it:
 *
 *   A. PREAMBLE IDENTICAL — every seam file opens with byte-identical maintenance boilerplate.
 *      A rule repeated in twelve files is a rule that drifts in eleven of them.
 *   B. ROUTED — every seam file is reachable from README.md. An unrouted file is an unread file.
 *   C. SUPERSEDED TARGETS RESOLVE — a forward marker that names a file which does not exist sends
 *      the reader nowhere, which is worse than no marker: it reads like care.
 *   D. SIZE — warn at 160 KB, FAIL at 200 KB, per file. ⛔ The remedy is never to raise the cap,
 *      never to open a phase-named overflow file, and never to delete a posted section. It is to
 *      find the seam inside the file that wants its own home.
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
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/** B. Every seam file is named by the router. ⛔ Population = the directory listing. */
export function checkRouted(files, routerText) {
  if (routerText == null) return [`[B] ${DIR_REL}/${ROUTER} — missing; the directory has no entry point`]
  const F = []
  for (const f of files) {
    if (f.name === ROUTER) continue
    if (!routerText.includes(`(${f.name})`)) {
      F.push(`[B] ${DIR_REL}/${f.name} — not linked from ${ROUTER}. An unrouted file is an unread file: add a row saying WHEN to open it.`)
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
export function checkSupersededTargets(files, known) {
  const F = []
  const MARKER = /⚠\s*\*\*Superseded\*\*/
  for (const f of files) {
    if (f.name === ROUTER) continue
    const { lines, offset } = bodyAfterPreamble(f.text)
    for (let i = 0; i < lines.length; i += 1) {
      if (!MARKER.test(lines[i])) continue
      const window = lines.slice(i, i + 3).join(' ')
      const names = [...window.matchAll(/([A-Za-z0-9._-]+\.md)/g)].map((m) => m[1])
      if (names.length === 0) {
        F.push(`[C] ${DIR_REL}/${f.name}:${i + offset + 1} — Superseded marker names no target file (\`See <file> § <n>.\`)`)
        continue
      }
      for (const n of names) {
        if (!known.has(n)) {
          F.push(`[C] ${DIR_REL}/${f.name}:${i + offset + 1} — Superseded marker points at \`${n}\`, which is not in ${DIR_REL}/`)
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

export function runChecks(files) {
  const known = new Set(files.map((f) => f.name))
  const router = files.find((f) => f.name === ROUTER)
  const { F: sizeF, W } = checkSizes(files)
  return {
    F: [
      ...checkPreambleIdentical(files),
      ...checkRouted(files, router ? normalise(router.text) : null),
      ...checkSupersededTargets(files, known),
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
const ROUTER_OK = { name: ROUTER, text: '# Backend State — the router\n\n| [`a.md`](a.md) | when |\n| [`b.md`](b.md) | when |\n' }

function selfTest() {
  const bad = []
  const t = (label, cond) => { if (!cond) bad.push(label) }

  // A — divergence caught, agreement clean
  t('A catches a drifted preamble', checkPreambleIdentical([good('a.md'), { name: 'b.md', text: `# X\n\n> different\n\n## S\n` }]).length > 0)
  t('A catches a missing preamble', checkPreambleIdentical([good('a.md'), { name: 'b.md', text: '# X\n\n## S\nbody\n' }]).length > 0)
  t('A clean when identical', checkPreambleIdentical([good('a.md'), good('b.md')]).length === 0)

  // B — unrouted caught, routed clean
  t('B catches an unrouted file', checkRouted([ROUTER_OK, good('a.md'), good('zz.md')], ROUTER_OK.text).length === 1)
  t('B clean when all routed', checkRouted([ROUTER_OK, good('a.md'), good('b.md')], ROUTER_OK.text).length === 0)
  t('B catches a missing router', checkRouted([good('a.md')], null).length === 1)

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
` }], known)[0].includes(':6'))
  t('C skips the router whole', checkSupersededTargets([{ name: ROUTER, text: `## S
⚠ **Superseded** — x. See gone.md § 1.
` }], known).length === 0)
  t('C ignores ordinary prose', checkSupersededTargets([{ name: 'a.md', text: '## S\nthis was superseded by nothing\n' }], known).length === 0)

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

  if (bad.length) {
    console.error('backend-state gate: SELF-TEST FAILED\n')
    for (const b of bad) console.error(`  - ${b}`)
    process.exit(1)
  }
  return 17
}

// ---------------------------------------------------------------------------
function main() {
  const n = selfTest()
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
    process.exit(1)
  }

  const total = files.reduce((a, f) => a + Buffer.byteLength(f.text, 'utf8'), 0)
  const largest = files.reduce((a, f) => (Buffer.byteLength(f.text, 'utf8') > Buffer.byteLength(a.text, 'utf8') ? f : a))
  console.log(
    `backend-state gate: OK — ${files.length - 1} seam file(s) + ${ROUTER}, all routed, preamble identical, ` +
      `${(total / 1024).toFixed(0)} KB total, largest ${largest.name} at ${(Buffer.byteLength(largest.text, 'utf8') / 1024).toFixed(1)} KB ` +
      `(warn ${WARN_BYTES / 1024} KB / cap ${HARD_BYTES / 1024} KB)${W.length ? ` — ${W.length} warning(s) above` : ''}.`,
  )
}

main()
