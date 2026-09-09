#!/usr/bin/env node
/**
 * Re-derive the finding behind ADR 0198: how much of `docs/backend-state/` is a work-unit LOG and
 * how much is an axis-free statement of current state.
 *
 * ⛔ THIS SCRIPT EXISTS BECAUSE A FIGURE WITHOUT ITS QUERY IS NOT A MEASUREMENT (CLAUDE.md § graphify,
 * README.md § Maintenance rules 5). ADR 0198 quotes "57 of 67 sections (85%)" and "7 of 11 seam files
 * carry no axis-free section". Anyone may reproduce both, at any commit:
 *
 *     node scripts/measure-state-layer.mjs              # the working tree
 *     node scripts/measure-state-layer.mjs e4ac95e5     # the split commit, which the ADR quotes
 *
 * ⚠ THE CLASSIFIER IS A HEURISTIC, AND IT IS FITTED TO THIS CORPUS. That is the trap LEARN-089 names
 * — a detector whose corpus defines its own pattern — so this script does NOT ask to be trusted: it
 * PRINTS every heading with its verdict, under `--verbose`, so the classification is audited rather
 * than believed. The three arms, stated so a reader can disagree with a specific one:
 *
 *   1. the heading carries a `YYYY-MM-DD`                        → SLICE (a dated section is a slice)
 *   2. the heading opens `<CODE> — ` / `<CODE> - `, where <CODE>  → SLICE (a unit code plus a title)
 *      is one space-free token, ≤ 14 chars, no lowercase
 *   3. the heading carries a parenthesised unit code `(AE1.2;`    → SLICE (a slice named in its aside)
 *
 * Anything else is AXIS-FREE. Arm 2 requires the separator IMMEDIATELY after the token, which is what
 * keeps `END STATE — the document surface as it IS` and `RLS authorization surface (who can do what)`
 * out of the slice column: their leading capitals are the start of a noun phrase, not a code.
 *
 * ⚠ At `e4ac95e5` this reproduces a by-hand classification of all 67 headings exactly (57/10). That
 * agreement is the only evidence the heuristic is sound, and it is evidence about ONE corpus at ONE
 * commit — not a general classifier. Re-audit the `--verbose` listing before quoting a new figure.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⛔ Resolved from THIS FILE, never from `process.cwd()` — running a gate or a measurement from a
// subdirectory must not turn "the subject is absent" into a finding about the repo.
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const DIR_REL = 'docs/backend-state'

const DATED = /\d{4}-\d{2}-\d{2}/
const LEADING_CODE = /^([^\s]{1,14}) [—-] /
const PAREN_CODE = /\([A-Z]{1,6}[0-9][0-9A-Za-z.·-]*[;)]/

export function isSlice(heading) {
  if (DATED.test(heading)) return 'dated'
  const m = LEADING_CODE.exec(heading)
  if (m && !/[a-z]/.test(m[1]) && /[A-Z0-9]/.test(m[1])) return 'unit-coded'
  if (PAREN_CODE.test(heading)) return 'code-in-aside'
  return null
}

/** H2 headings, with fenced code blocks excluded — a `## ` inside a fence is not a section. */
export function headingsOf(text) {
  const out = []
  let fence = false
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
      continue
    }
    if (fence) continue
    const m = /^## (?!#)(.*)$/.exec(line)
    if (m) out.push(m[1].trim())
  }
  return out
}

function readCorpus(ref) {
  if (!ref) {
    const dir = join(REPO_ROOT, DIR_REL)
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
  }
  const listed = execFileSync('git', ['ls-tree', '--name-only', ref, `${DIR_REL}/`], { cwd: REPO_ROOT, encoding: 'utf8' })
  return listed
    .split('\n')
    .filter((p) => p.endsWith('.md'))
    .sort()
    .map((p) => ({ name: p.split('/').pop(), text: execFileSync('git', ['show', `${ref}:${p}`], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }))
}

function main() {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose')
  const ref = args.find((a) => !a.startsWith('--')) ?? null

  const files = readCorpus(ref).filter((f) => f.name !== 'README.md')
  if (files.length === 0) {
    console.error(`measure-state-layer: no files under ${DIR_REL}/ at ${ref ?? 'the working tree'}`)
    process.exit(1)
  }

  let slices = 0
  let axisFree = 0
  const noAxisFree = []
  const archives = []
  const rows = []
  for (const f of files) {
    // ⚠ An ARCHIVE is not a seam and owes no current state (ADR 0198 D4), so it is separated out
    // rather than dropped. Reporting one number for both populations is how "7 of 11 seam files"
    // and "8 of 12 files" become the same measurement wearing two figures.
    const isArchive = /⛔ \*\*ARCHIVE\b/.test(f.text)
    if (isArchive) archives.push(f.name)
    const heads = headingsOf(f.text)
    let free = 0
    for (const h of heads) {
      const why = isSlice(h)
      if (why) slices += 1
      else free += 1
      rows.push([f.name, why ?? 'AXIS-FREE', h])
    }
    axisFree += free
    if (free === 0) noAxisFree.push(f.name)
  }
  const total = slices + axisFree
  const noAxisFreeSeams = noAxisFree.filter((n) => !archives.includes(n))

  if (verbose) {
    for (const [file, verdict, h] of rows) console.log(`${verdict.padEnd(13)} ${file.padEnd(30)} ${h.slice(0, 110)}`)
    console.log('')
  }

  console.log(`measure-state-layer @ ${ref ?? 'working tree'} — population: every \`##\` section in ${DIR_REL}/ except README.md`)
  console.log(`  files                 ${files.length}`)
  console.log(`  ## sections           ${total}`)
  console.log(`  work-unit SLICES      ${slices} (${total ? ((slices / total) * 100).toFixed(0) : 0}%)`)
  console.log(`  AXIS-FREE sections    ${axisFree}`)
  console.log(`  declared ARCHIVEs     ${archives.length}${archives.length ? ` — ${archives.join(', ')} (owe no current state; ADR 0198 D4)` : ' — none declared at this ref'}`)
  console.log(`  files with NO axis-free section: ${noAxisFree.length}${noAxisFree.length ? ` — ${noAxisFree.join(', ')}` : ''}`)
  console.log(`    …of which SEAM files (archives excluded): ${noAxisFreeSeams.length}`)
  console.log(`  ⚠ the classifier is a fitted heuristic; re-run with --verbose and audit it before quoting a new figure.`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main()
