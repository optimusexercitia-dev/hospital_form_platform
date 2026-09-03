#!/usr/bin/env node
/**
 * lint:rules — the `.claude/rules/` staleness contract, enforced by machine.
 *
 * THE DEFECT CLASS. Standing rules ("never fix X by granting Y") have **no resolution
 * event**. Nothing ever closes them, so wherever they live they only accumulate — which
 * is why they were moved out of PROGRESS.md. But moving them to `.claude/rules/` trades a
 * VISIBLE accumulation problem for an INVISIBLE one: a path-scoped rule is silent until
 * it fires, so a rule whose subject was renamed or deleted goes on loading forever,
 * teaching a fact about code that no longer exists. Nothing in the repo could contradict
 * it. This is that contradiction.
 *
 * THE CONTRACT:
 *   1. PATHS    — every rule carries at least one `paths:` glob. A rule with NO `paths:`
 *                 loads on every session and every teammate spawn: that is the always-on
 *                 context cost this directory exists to avoid, arrived at by omission.
 *   2. ORPHAN   — every `paths:` glob matches at least one existing file. THE KEYSTONE:
 *                 zero matches means the rule's subject was renamed or deleted, so the
 *                 rule can never fire again. The glob is already there for loading, so
 *                 this check costs nothing and is the one that catches a rename.
 *   3. ANCHORS  — every `anchors:` entry resolves. `path` must exist; `path#literal`
 *                 must exist AND still contain that literal. This is what makes "is this
 *                 rule still true?" a machine question. A rule that can name nothing
 *                 checkable is not admitted — that precondition caps the population
 *                 instead of merely observing it.
 *   4. SOURCE   — every rule names its `source:` (a BUG, FUP or ADR id). The text is a
 *                 REWRITE, not a verbatim rotation, so the ID is the only path back to
 *                 the original reasoning.
 *
 * BOUNDED PROPERTY, STATED: anchors that live in the DATABASE (a `prosecdef` gate, an
 * ACL, an RLS policy) are NOT checkable here — `lint` runs with no Docker. Those belong
 * in the pgTAP suite. This gate bounds the FILE-resolvable half and says so, rather than
 * reporting a pass that reads wider than its domain.
 *
 * Disposition when a rule reds: repoint it, or retire it VERBATIM to
 * docs/progress/rules-archive.md with its provenance. Never delete outright.
 *
 * SELF-TEST runs before the real scan, every invocation (house rule: a gate nobody has
 * seen fire is not a gate). A checker that cannot red aborts the run.
 *
 *   node scripts/check-rules-staleness.mjs [--self-test]
 */
import { readFileSync, existsSync, readdirSync, globSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const RULES_DIR = join(ROOT, '.claude', 'rules')
const ARCHIVE = 'docs/progress/rules-archive.md'

/**
 * VOLUME BOUNDS. The staleness checks above catch a rule whose SUBJECT disappeared. They
 * say nothing about how many rules there are, how broad each one is, or how big it has
 * grown — and every anchor keeps resolving while all three drift. Measured on the first
 * population: one rule's globs matched **659 files**, so it loaded on essentially every
 * backend task; it was retired. These are the analogue of PROGRESS.md's cell caps.
 */
const MAX_GLOB_FILES = 40 // per rule, unless it declares `broad:` with a reason
const MAX_RULE_BYTES = 2048
const MAX_RULES = 12

/**
 * Minimal frontmatter reader for the shape rules use: scalars, `- ` lists, and YAML block
 * scalars (`>`, `>-`, `|`, `|-`, …).
 *
 * ⛔ FIXED (ADR 0186 D8 / plan 6.2a): the old reader treated `broad: >-` as a plain scalar,
 * so `fm.broad` became the two-character LITERAL `">-"` — non-empty, so it silently satisfied
 * the "waiver needs a reason in writing" check with the block indicator itself, and the actual
 * folded reason on the following indented lines was dropped on the floor (same bug for
 * `source:`). This reader now collects those continuation lines instead of ignoring them, so a
 * `broad:`/`source:` written as a block scalar with NO body folds to `''` and fails the
 * non-empty check it used to pass vacuously.
 */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const out = {}
  const lines = m[1].split('\n')
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '')
  let key = null
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    if (!raw.trim() || raw.trimStart().startsWith('#')) {
      i++
      continue
    }
    const item = /^\s*-\s+(.*)$/.exec(raw)
    if (item && key && Array.isArray(out[key])) {
      out[key].push(unquote(item[1]))
      i++
      continue
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(raw)
    if (!kv) {
      i++
      continue
    }
    key = kv[1]
    const val = kv[2].trim()
    const block = /^([>|])[+-]?\d*$/.exec(val)
    if (block) {
      // Collect the indented lines that follow, up to (not including) the next line at or
      // below the frontmatter's own indent (blank lines belong to the block and don't end it).
      const body = []
      let indent = null
      let j = i + 1
      while (j < lines.length) {
        const l = lines[j]
        if (!l.trim()) {
          body.push('')
          j++
          continue
        }
        const lead = /^(\s+)/.exec(l)
        if (!lead || (indent !== null && lead[1].length < indent)) break
        if (indent === null) indent = lead[1].length
        body.push(l.slice(indent))
        j++
      }
      while (body.length && body[body.length - 1] === '') body.pop()
      out[key] =
        block[1] === '|'
          ? body.join('\n')
          : body.reduce((acc, l, idx) => (idx === 0 ? l : l === '' || body[idx - 1] === '' ? `${acc}\n${l}` : `${acc} ${l}`), '')
      i = j
      continue
    }
    out[key] = val === '' ? [] : unquote(val)
    i++
  }
  return out
}

/**
 * @param deps  {exists, globMatch, fileHas} — injected so the self-test can drive the
 *              checker against fixtures without touching the filesystem.
 */
export function checkRule(name, fm, deps, bytes = 0) {
  const { exists, globMatch, fileHas } = deps
  if (!fm) {
    return [
      `${name} — no YAML frontmatter. Without \`paths:\` this rule loads on EVERY ` +
        `session and every teammate spawn.`,
    ]
  }
  const out = []
  const list = (k) => (Array.isArray(fm[k]) ? fm[k] : fm[k] ? [fm[k]] : [])

  const paths = list('paths')
  if (paths.length === 0) {
    out.push(
      `${name} — no \`paths:\` globs. An unscoped rule loads on EVERY session and every ` +
        `teammate spawn; that is the always-on cost this directory exists to avoid. ` +
        `Scope it, or put it in CLAUDE.md as a deliberate choice.`,
    )
  }
  for (const g of paths) {
    if (globMatch(g).length === 0) {
      out.push(
        `${name} — \`paths:\` glob matches NOTHING: "${g}". The subject was renamed or ` +
          `deleted, so this rule can never fire again. Repoint it, or retire it to ` +
          `${ARCHIVE} with its provenance.`,
      )
    }
  }

  // BREADTH. A glob wide enough to fire on most of a subtree is an always-on rule wearing
  // a path-scoped costume — CLAUDE.md content without CLAUDE.md's review discipline. Wide
  // is sometimes correct (a rule whose subject genuinely IS a whole directory), so it is
  // opt-out-able — but only in writing, which turns breadth from an accident into a choice.
  const matched = paths.reduce((n, g) => n + globMatch(g).length, 0)
  const broad = typeof fm.broad === 'string' ? fm.broad.trim() : ''
  if (matched > MAX_GLOB_FILES && !broad) {
    out.push(
      `${name} — \`paths:\` matches ${matched} files (soft cap ${MAX_GLOB_FILES}). A rule this ` +
        `wide loads on most work in the subtree: an always-on rule in disguise. Four ` +
        `dispositions, in order of preference — (1) NARROW the glob, if the real subject is a ` +
        `few files; (2) BUILD A GATE, because a gate beats a rule, then retire this under (5); ` +
        `(3) declare \`broad: <why this subtree IS the subject>\` and own it, only when the ` +
        `subtree really is the subject; (4) PROMOTE it to CLAUDE.md or ARCHITECTURE.md — ` +
        `"loads on most of a subtree" IS always-on, and always-on content belongs where ` +
        `always-on review reaches it. ` +
        `⛔ (5) Retire to ${ARCHIVE} ONLY once something else carries the lesson — a gate, a ` +
        `test, or CLAUDE.md. NOTHING READS THE ARCHIVE, so retiring an unenforced rule does ` +
        `not file it, it deletes it.`,
    )
  }

  if (bytes > MAX_RULE_BYTES) {
    out.push(
      `${name} — rule file is ${bytes} bytes (cap ${MAX_RULE_BYTES}). A rule is a pointer plus ` +
        `a prohibition; rationale belongs in the \`source:\` it names. This is the drift that ` +
        `put 2,159 characters in one PROGRESS.md cell.`,
    )
  }

  const anchors = list('anchors')
  if (anchors.length === 0) {
    out.push(
      `${name} — no \`anchors:\`. A rule that names nothing checkable can never be shown ` +
        `stale. Name a file, or a \`file#literal\` that must still appear in it.`,
    )
  }
  for (const a of anchors) {
    const [path, literal] = a.split('#')
    if (!exists(path)) {
      out.push(
        `${name} — anchor file is gone: ${path}. The rule outlived what it describes; ` +
          `repoint or retire it to ${ARCHIVE}.`,
      )
      continue
    }
    if (literal && !fileHas(path, literal)) {
      out.push(
        `${name} — anchor "${literal}" no longer appears in ${path}. The rule may now be ` +
          `describing code that does not exist; re-verify it against the file, then ` +
          `repoint or retire it.`,
      )
    }
  }

  if (!fm.source || (Array.isArray(fm.source) && fm.source.length === 0)) {
    out.push(
      `${name} — no \`source:\`. A rule is a REWRITE of its original, so the BUG-*/FUP-*/ADR ` +
        `id is the only route back to the reasoning. Name it.`,
    )
  }
  return out
}

/**
 * POPULATION. Nothing else bounds how many rules exist: every anchor keeps resolving as
 * the directory grows, so the gate stays green all the way to a second CLAUDE.md. Ten
 * rules scoped to one subtree all load on a single file touch — path-scoping bounds WHEN
 * they load, never HOW MANY load together.
 */
/**
 * ADR 0186 D8 / plan 6.2b: a missing `.claude/rules/` directory used to print OK and exit 0 —
 * gate 7's stance is that a gate that cannot find its subject is not a pass, and this gate's
 * subject is the directory itself.
 */
export function checkRulesDirExists(exists) {
  return exists
    ? []
    : ['.claude/rules/ is missing — a gate that cannot find its subject is not a pass; every standing rule needs a home to be checked in.']
}

export function checkPopulation(count) {
  return count <= MAX_RULES
    ? []
    : [
        `.claude/rules/ holds ${count} rules (cap ${MAX_RULES}). Retire the ones whose lesson ` +
          `is now enforced by a gate or by code — that is the intended exit, and ${ARCHIVE} is ` +
          `where they go. A rules directory that only grows is the category this one was ` +
          `created to escape.`,
      ]
}

// --------------------------------------------------------------------------
// SELF-TEST — every checker proven able to fail, on every invocation.
// --------------------------------------------------------------------------
function selfTest() {
  const fails = []
  const red = (n, f) => { if (f.length === 0) fails.push(n) }
  const green = (n, f) => { if (f.length !== 0) fails.push(`${n} (false positive: ${f[0]})`) }

  const ok = { exists: () => true, globMatch: () => ['a'], fileHas: () => true }
  const good = { paths: ['src/**'], anchors: ['src/x.ts#sym'], source: 'BUG-1' }

  green('healthy-rule', checkRule('r', good, ok))

  red('no-frontmatter', checkRule('r', null, ok))
  red('no-paths', checkRule('r', { ...good, paths: [] }, ok))
  red('orphan-glob', checkRule('r', good, { ...ok, globMatch: () => [] }))
  red('anchor-file-gone', checkRule('r', good, { ...ok, exists: () => false }))
  red('anchor-literal-gone', checkRule('r', good, { ...ok, fileHas: () => false }))
  red('no-anchors', checkRule('r', { ...good, anchors: [] }, ok))
  red('no-source', checkRule('r', { paths: ['src/**'], anchors: ['src/x.ts'] }, ok))

  const wide = { ...ok, globMatch: () => new Array(MAX_GLOB_FILES + 1).fill('f') }
  red('too-broad', checkRule('r', good, wide))
  // Breadth must be waivable IN WRITING, and the waiver must actually waive.
  green('broad-declared-green', checkRule('r', { ...good, broad: 'this subtree IS the subject' }, wide))
  red('broad-empty-reason', checkRule('r', { ...good, broad: '   ' }, wide))

  red('too-big', checkRule('r', good, ok, MAX_RULE_BYTES + 1))
  green('size-green', checkRule('r', good, ok, MAX_RULE_BYTES))

  red('too-many-rules', checkPopulation(MAX_RULES + 1))
  green('population-green', checkPopulation(MAX_RULES))

  // ADR 0186 D8 / plan 6.2b: a missing rules directory is a finding, not a silent OK.
  red('rules-dir-missing', checkRulesDirExists(false))
  green('rules-dir-present-green', checkRulesDirExists(true))

  // The parser must actually parse — a parser that silently returns {} would make
  // every check above vacuous against real files.
  const fm = parseFrontmatter('---\npaths:\n  - "a/**"\n  - "b.ts"\nsource: BUG-9\n---\nbody\n')
  if (!fm || fm.paths?.length !== 2 || fm.paths[0] !== 'a/**' || fm.source !== 'BUG-9') {
    fails.push('frontmatter-parser')
  }
  if (parseFrontmatter('no frontmatter here\n') !== null) fails.push('frontmatter-absent')

  // ADR 0186 D8 / plan 6.2a: block scalars fold their continuation lines instead of yielding
  // the bare indicator string. `>` folds to spaces (blank line = paragraph break); `|` keeps
  // literal newlines; a block scalar with NO continuation folds to `''`, not `'>-'` or `'|'`.
  const fmFolded = parseFrontmatter('---\nbroad: >-\n  line one\n  line two\n---\nbody\n')
  if (!fmFolded || fmFolded.broad !== 'line one line two') fails.push('frontmatter-folded-scalar')
  const fmLiteral = parseFrontmatter('---\nnotes: |\n  line one\n  line two\n---\nbody\n')
  if (!fmLiteral || fmLiteral.notes !== 'line one\nline two') fails.push('frontmatter-literal-scalar')
  const fmEmptyBehindIndicator = parseFrontmatter('---\nbroad: >-\nanchors:\n  - x\n---\nbody\n')
  if (!fmEmptyBehindIndicator || fmEmptyBehindIndicator.broad !== '') fails.push('frontmatter-empty-behind-indicator')
  // End to end: a rule whose `broad:` is a block indicator with nothing behind it must still
  // red on breadth — the exact defect class 6.2a exists to close.
  const wideFixture = { exists: () => true, globMatch: () => new Array(MAX_GLOB_FILES + 1).fill('f'), fileHas: () => true }
  red(
    'end-to-end: empty-behind-indicator broad still reds on breadth',
    checkRule('r', parseFrontmatter('---\npaths:\n  - "a/**"\nbroad: >-\nanchors:\n  - x\nsource: BUG-1\n---\n'), wideFixture),
  )

  if (fails.length) {
    console.error(`check-rules-staleness SELF-TEST FAILED — checker(s) cannot fire: ${fails.join(', ')}`)
    process.exit(2)
  }
}

// --------------------------------------------------------------------------
function main() {
  selfTest()
  if (process.argv.includes('--self-test')) {
    console.log('check-rules-staleness: self-test OK (all checkers proven able to fail)')
    return
  }

  const dirExists = existsSync(RULES_DIR)
  const findings = [...checkRulesDirExists(dirExists)]
  const files = dirExists ? readdirSync(RULES_DIR).filter((f) => f.endsWith('.md')) : []
  findings.push(...checkPopulation(files.length))

  const deps = {
    exists: (p) => existsSync(join(ROOT, p)),
    globMatch: (g) => globSync(g, { cwd: ROOT }),
    fileHas: (p, lit) => readFileSync(join(ROOT, p), 'utf8').includes(lit),
  }

  for (const f of files) {
    const text = readFileSync(join(RULES_DIR, f), 'utf8')
    findings.push(
      ...checkRule(`.claude/rules/${f}`, parseFrontmatter(text), deps, Buffer.byteLength(text)),
    )
  }

  if (findings.length) {
    console.error(`check-rules-staleness: ${findings.length} finding(s)\n`)
    for (const f of findings) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`check-rules-staleness: OK (${files.length} rule file(s), anchors + globs resolve)`)
}

main()
