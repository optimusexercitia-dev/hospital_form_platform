#!/usr/bin/env node
/**
 * ABSENT-SUBJECT ASSERTION DETECTOR — FUP-E2E-ABSENT-ROW-ASSERTIONS.
 *
 * THE DEFECT SHAPE. `expect(row?.field).not.toBeNull()` PASSES when `row` is absent:
 * `row?.field` is `undefined`, and `undefined` is not `null`. The assertion's own message
 * ("the RPC actually disposed this fixture") becomes the false statement a missing row
 * makes it assert. Live on PHI-erasure assertions.
 *
 * ⛔ THE PROPERTY IS A COMPOSITION, AND EACH HALF ALONE IS USELESS:
 *
 *     a subject that may be ABSENT   ×   a matcher that ACCEPTS `undefined`
 *
 * The FUP's fourth correction is the whole reason this file is shaped this way: every
 * earlier statement of the item said "optional chaining converts a missing subject into a
 * passing assertion", which is true ONLY in composition with such a matcher. Stated at
 * that grain it reads as a licence to sweep every `?.` in the tree, and the population it
 * yields is mostly sound tests. So: ⛔ NEVER grep for `?.`.
 *
 * WHERE THE MATCHER SET COMES FROM. `scripts/absent-subject-matchers.json`, which was
 * MEASURED against the live runtime, and is re-proved on every `npm run test` by
 * `src/lib/matcher-vacuity-truth-table.test.ts`. ⛔ Do not hand-type the set here: the
 * detector and its proof must share one definition or the gate drifts off the thing that
 * justifies it. Four counts have been claimed for this item and four were wrong.
 *
 * TWO REPORTED CLASSES, deliberately not blurred into one number:
 *   A. OPTIONAL-CHAIN subject (`row?.field`) — precise and decidable.
 *   B. INDEXED subject (`rows[0].field`) — the "helper returns [] on a failed read" family
 *      (FUP-E2E-HELPERS-SWALLOW-FAILED-READS). `rows[0]` is `undefined` on an empty array,
 *      so this reaches the same vacuity WITHOUT any `?.` — which is why a `?.` sweep
 *      cannot enumerate the population.
 *
 * INTENT MATTERS, and the JSON splits by it:
 *   - `claimsFieldHasAValue`      — `.not.toBeNull()` and friends.
 *   - `claimsFieldIsErasedOrAbsent` — `.toBeFalsy()`, `.toBeUndefined()`. ⭐ The half the
 *     FUP never looked for, and the WORSE one for Rule 12: a PHI-erasure claim on a row
 *     that was NEVER CREATED passes, and the conclusion drawn is "the PHI was erased".
 *     ⚠ `.toBeNull()` throws on `undefined`, so it is the safe way to assert erasure.
 *
 * SELF-TEST (`--self-test`). A detector that finds nothing must be proven able to find
 * something, and one that finds a lot needs proving too. Ships hand-classified fixtures
 * covering BOTH polarities and exits non-zero if it misclassifies any. Run it before
 * believing any report.
 *
 * Usage:
 *   node scripts/check-absent-subject-assertions.mjs [--self-test] [--json] [--gate] [paths…]
 *
 * ⚠ NOT WIRED INTO `npm run lint`. A gate change is not a mid-phase edit (CLAUDE.md §8),
 * and the live population must be triaged first — converting a swallowed read into a real
 * assertion can surface a hidden failure in a spec nobody has analysed.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const MATCHERS = require('../scripts/absent-subject-matchers.json')

const ROOT = process.cwd()

// ─────────────────────────────────────────────────────────────────────────────────────
// 1. THE RULE SET, DERIVED from the measured JSON labels — never hand-typed.
//    Label grammar: `.not.toBe(null)` -> {negated, method, argKind}
// ─────────────────────────────────────────────────────────────────────────────────────
function parseLabel(label) {
  const negated = label.startsWith('.not.')
  const rest = negated ? label.slice(5) : label.slice(1)
  const open = rest.indexOf('(')
  const method = rest.slice(0, open)
  const arg = rest.slice(open + 1, rest.lastIndexOf(')'))
  let argKind
  if (arg === '') argKind = 'none'
  else if (arg === 'null') argKind = 'null'
  else if (arg === 'false') argKind = 'false'
  else if (arg === '<literal>') argKind = 'literal'
  else if (arg.startsWith('expect.any')) argKind = 'anyMatcher'
  else argKind = 'other'
  return { negated, method, argKind, label }
}

const RULES = []
for (const [intent, labels] of Object.entries(MATCHERS.acceptsUndefined)) {
  if (intent.startsWith('_')) continue
  for (const l of labels) RULES.push({ ...parseLabel(l), intent })
}
if (RULES.length === 0) {
  console.error('FATAL: no rules derived from absent-subject-matchers.json — the detector')
  console.error('       would report a clean tree having asked nothing. Fix the JSON.')
  process.exit(2)
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 2. AST helpers
// ─────────────────────────────────────────────────────────────────────────────────────
function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

/** Classify the argument node of a matcher call into the same vocabulary as parseLabel. */
function argKindOf(node) {
  if (!node) return 'none'
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null'
  if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'any'
  ) return 'anyMatcher'
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword
  ) return 'literal'
  return 'other'
}

/**
 * Does this subject expression evaluate to `undefined` when the underlying ROW is absent?
 * Returns 'optional' | 'indexed' | null.
 * ⚠ Bounded deliberately: this is a SHAPE test, not a type analysis. It cannot know that a
 * helper always returns a row, and it cannot see a subject made absent one call frame away
 * with no syntax at the call site at all. Under-selection here is invisible, so treat the
 * report as a floor. [[enumeration-boundary-is-a-syntax-not-a-property]]
 */
function subjectRisk(node) {
  // ── CLASS A: any optional chain in the subject. `a?.b` yields `undefined` rather than
  //    throwing, which is what lets a vacuous matcher accept it.
  let optional = false
  const visit = (n) => {
    if (optional) return
    if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n)) &&
      n.questionDotToken
    ) { optional = true; return }
    ts.forEachChild(n, visit)
  }
  visit(node)
  if (optional) return 'optional'

  // ── CLASS B: the indexed element must be THE SUBJECT ITSELF — `expect(rows[0])`.
  //
  // ⛔ MEASURED CORRECTION 2026-08-29, and it is the whole reason this function is not
  // the obvious one-liner. The first version flagged an index ANYWHERE in the subject, so
  // it reported `expect(rows[0].ended_on).not.toBeNull()` as vacuous. It is NOT:
  //
  //     []       [0]        -> undefined        (no throw)
  //     []       [0].field  -> TypeError        ⭐ THROWS, so the test FAILS LOUDLY
  //     []       [0]?.field -> undefined        (that is class A, caught above)
  //
  // So `rows[0].field` is SAFE — noisy on an empty read, but never silent. Flagging it
  // put 19 sound assertions on the report, and the self-test did not catch it because the
  // fixture asserting that shape was HAND-CLASSIFIED to match the same wrong belief.
  // A hand-classified fixture is a belief wearing the label of a control; the shapes are
  // now measured against the runtime in matcher-vacuity-truth-table.test.ts.
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const a = node.argumentExpression
    if (ts.isNumericLiteral(a) || ts.isIdentifier(a)) return 'indexed'
  }
  return null
}

/**
 * THE GUARD CHECK — why this detector reports two populations, not one.
 *
 * `expect(xrefRows.length).toBe(1)` on the line above makes
 * `expect(xrefRows[0]?.encounter_key).not.toBeNull()` SOUND: the row cannot be absent by
 * the time the second line runs. The `?.` is then redundant, not vacuous.
 *
 * ⛔ Without this, the report hands a reviewer sound assertions labelled as defects, and
 * the natural response — "fix" them — churns correct tests. A detector that finds a lot
 * needs proving as much as one that finds nothing.
 *
 * ⚠ BOUNDED, and the bound runs in the SAFE direction: only preceding statements in the
 * SAME block are examined, and only against the subject's root identifier. A guard in a
 * helper, a parent block, or behind a conditional is not seen — so GUARDED is a floor and
 * UNGUARDED is the set that still needs human triage, never an automatic defect list.
 */
function rootIdentifier(node) {
  let n = node
  while (n) {
    if (ts.isIdentifier(n)) return n.text
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) n = n.expression
    else if (ts.isCallExpression(n)) n = n.expression
    else if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) n = n.expression
    else return null
  }
  return null
}

/** Is `stmt` an assertion that <root> is non-empty / present? */
function isExistenceGuard(stmt, root) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const method = n.expression.name.text
      const inner = n.expression.expression
      // strip a `.not.` — a negated guard is not a guard
      if (ts.isPropertyAccessExpression(inner) && inner.name.text === 'not') return
      const target = ts.isCallExpression(inner) ? inner : null
      if (
        target &&
        ((ts.isIdentifier(target.expression) && target.expression.text === 'expect') ||
          (ts.isPropertyAccessExpression(target.expression) &&
            ts.isIdentifier(target.expression.expression) &&
            target.expression.expression.text === 'expect'))
      ) {
        const subj = target.arguments[0]
        if (subj && rootIdentifier(subj) === root) {
          const arg = n.arguments[0]
          const positiveCount =
            arg && ts.isNumericLiteral(arg) ? Number(arg.text) > 0 : method === 'toBeGreaterThan'
          if (method === 'toHaveLength' && positiveCount) found = true
          if (method === 'toEqual' && positiveCount) found = true
          if (method === 'toBeGreaterThan') found = true

          // ⭐ THE GENERAL RULE, and it subsumes the special cases above. ANY preceding
          // assertion on the same root whose matcher THROWS on `undefined` proves the
          // subject was present — the test could not have reached the next line otherwise.
          // Derived from the SAME measured file as the vacuous set, so the two halves can
          // never disagree.
          //
          // ⛔ This was NOT in the first version, and its absence would have cost real
          // damage: the FUP names `meeting-held-time.spec.ts:296/373/566` as live
          // instances, and every one of them is preceded by
          // `expect(row?.status).toBe('held')` — which throws on undefined. They are
          // SOUND. Without this rule the detector hands them over as defects and the
          // "fix" churns three correct assertions, in a file nobody had reason to touch.
          const safe = new Set(
            MATCHERS.throwsOnUndefined.map((l) => l.replace(/^\.(not\.)?/, '').replace(/\(.*/, '')),
          )
          const negatedHere = ts.isPropertyAccessExpression(inner) && inner.name.text === 'not'
          if (!negatedHere && safe.has(method)) {
            // `.toBe(<literal>)`/`.toEqual(...)` only throw on undefined when the expected
            // value is NOT undefined — `expect(x).toBe(undefined)` would pass.
            const argIsUndefined =
              arg && ts.isIdentifier(arg) && arg.text === 'undefined'
            if (!argIsUndefined) found = true
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(stmt)
  return found
}

function isGuarded(expectCall, subjectNode) {
  const root = rootIdentifier(subjectNode)
  if (!root) return false
  // find the statement containing this call, and its enclosing statement list
  let stmt = expectCall
  while (stmt.parent && !ts.isBlock(stmt.parent) && !ts.isSourceFile(stmt.parent)) stmt = stmt.parent
  const block = stmt.parent
  if (!block || !block.statements) return false
  for (const s of block.statements) {
    if (s === stmt) break
    if (isExistenceGuard(s, root)) return true
  }
  return false
}

/** Walk out from an `expect(X)` call to the matcher actually applied. */
function matcherOf(expectCall) {
  let node = expectCall.parent
  let negated = false
  const chain = []
  while (node && ts.isPropertyAccessExpression(node)) {
    const name = node.name.text
    if (name === 'not') negated = true
    else if (name === 'resolves' || name === 'rejects') return null // async shape, out of scope
    else chain.push(name)
    const call = node.parent
    if (call && ts.isCallExpression(call) && call.expression === node) {
      return { negated, method: name, argKind: argKindOf(call.arguments[0]), node: call }
    }
    node = node.parent
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 3. SCAN
// ─────────────────────────────────────────────────────────────────────────────────────
function scanText(file, text) {
  const sf = parse(file, text)
  const findings = []
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      n.arguments.length >= 1 &&
      ((ts.isIdentifier(n.expression) && n.expression.text === 'expect') ||
        (ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression) &&
          n.expression.expression.text === 'expect' &&
          ['soft', 'poll'].includes(n.expression.name.text)))
    ) {
      const risk = subjectRisk(n.arguments[0])
      if (risk) {
        const m = matcherOf(n)
        if (m) {
          const rule = RULES.find(
            (r) => r.negated === m.negated && r.method === m.method && r.argKind === m.argKind,
          )
          if (rule) {
            const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
            findings.push({
              file,
              line: line + 1,
              klass: risk === 'optional' ? 'A' : 'B',
              matcher: rule.label,
              intent: rule.intent,
              guarded: isGuarded(n, n.arguments[0]),
              subject: n.arguments[0].getText(sf).replace(/\s+/g, ' ').slice(0, 90),
            })
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return findings
}

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.next' || e === '.git') continue
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(spec|test)\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 4. SELF-TEST — both polarities, hand-classified.
// ─────────────────────────────────────────────────────────────────────────────────────
const FIXTURES = [
  // --- MUST be flagged -------------------------------------------------------------
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.phi_disposed_at).not.toBeNull() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.f, 'msg').not.toBeNull() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(a?.b?.c).not.toBe(null) })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.purged_at).toBeFalsy() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.audio_deleted_at).toBeUndefined() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.s).not.toBe('draft') })` },
  { want: true,  klass: 'B', src: `test('x', () => { expect(rows[0]).not.toBeNull() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(rows[0]?.held_at).not.toBeNull() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect.soft(row?.f).not.toBeNull() })` },
  // --- MUST NOT be flagged ---------------------------------------------------------
  //     safe matcher: throws on undefined, so an absent row fails loudly
  { want: false, src: `test('x', () => { expect(row?.f).toBeTruthy() })` },
  { want: false, src: `test('x', () => { expect(row?.f).toBeNull() })` },
  { want: false, src: `test('x', () => { expect(row?.f).toBeDefined() })` },
  { want: false, src: `test('x', () => { expect(row?.f).toBe(false) })` },
  { want: false, src: `test('x', () => { expect(row?.f).toEqual(expect.any(String)) })` },
  //     vacuous matcher but the subject CANNOT be absent — the half that makes this a
  //     composition rather than a matcher blacklist
  { want: false, src: `test('x', () => { expect(row.f).not.toBeNull() })` },
  { want: false, src: `test('x', () => { expect(count).not.toBeNull() })` },
  //     GUARDED by a SAFE-matcher assertion on the same root -- the shape that actually
  //     protects the FUP's own meeting-held-time instances. `.toBe('held')` throws on
  //     undefined, so the next line cannot be reached with an absent row.
  { want: false, src: `test('x', () => { expect(row?.status).toBe('held'); expect(row?.held_at).not.toBeNull() })` },
  { want: false, src: `test('x', () => { expect(row?.f).toBeTruthy(); expect(row?.g).not.toBeNull() })` },
  //     ...but the guard must be on the SAME root, and must not itself be vacuous
  { want: true,  klass: 'A', src: `test('x', () => { expect(other?.status).toBe('held'); expect(row?.held_at).not.toBeNull() })` },
  { want: true,  klass: 'A', src: `test('x', () => { expect(row?.status).not.toBeNull(); expect(row?.held_at).not.toBeNull() })` },
  //     GUARDED: a preceding existence assertion makes the optional chain redundant.
  //     Reported separately, never as a defect. (`want:false` = not on the defect list.)
  { want: false, src: `test('x', () => { expect(rows).toHaveLength(1); expect(rows[0]?.f).not.toBeNull() })` },
  { want: false, src: `test('x', () => { expect(rows.length).toBe(1); expect(rows[0]?.f).not.toBeNull() })` },
  //     ...but a NEGATED "guard" is not a guard, and an empty-length one is the opposite
  { want: true,  klass: 'A', src: `test('x', () => { expect(rows).toHaveLength(0); expect(rows[0]?.f).not.toBeNull() })` },
  //     a bare `?.` with a safe matcher: the shape a `?.` grep would wrongly sweep
  { want: false, src: `test('x', () => { expect(page?.url()).toContain('/x') })` },
  //     ⭐ MEASURED, not assumed: `[][0].field` throws a TypeError, so this fails LOUDLY.
  //     The first version of this detector flagged it and put 19 sound assertions on the
  //     report. This fixture is the regression pin for that correction.
  { want: false, src: `test('x', () => { expect(rows[0].held_at).not.toBeNull() })` },
  { want: false, src: `test('x', () => { expect(rpc.mock.calls[0][1].p_ref).toBeUndefined() })` },
]

function selfTest() {
  let bad = 0
  FIXTURES.forEach((f, i) => {
    const got = scanText(`fixture-${i}.spec.ts`, f.src).filter((g) => !g.guarded)
    const flagged = got.length > 0
    if (flagged !== f.want) {
      bad++
      console.error(`  ✗ fixture ${i}: expected ${f.want ? 'FLAG' : 'no flag'}, got ${flagged ? 'FLAG' : 'no flag'}`)
      console.error(`      ${f.src}`)
    } else if (f.want && f.klass && got[0].klass !== f.klass) {
      bad++
      console.error(`  ✗ fixture ${i}: expected class ${f.klass}, got ${got[0].klass}`)
    }
  })
  if (bad) {
    console.error(`check-absent-subject-assertions: SELF-TEST FAILED (${bad}/${FIXTURES.length})`)
    console.error('⛔ Every report from this detector is inadmissible until this passes.')
    return 1
  }
  console.log(`check-absent-subject-assertions: self-test OK (${FIXTURES.length} fixtures, both polarities)`)
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────────────
// 5. MAIN
// ─────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const wantJson = argv.includes('--json')
const gate = argv.includes('--gate')
const paths = argv.filter((a) => !a.startsWith('--'))

if (argv.includes('--self-test')) process.exit(selfTest())

// ⛔ The self-test runs BEFORE every real scan. A detector reporting "0 findings" without
// having proved it can find one is the exact artefact this repo keeps re-learning about.
if (selfTest() !== 0) process.exit(2)

const targets = paths.length
  ? paths.flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p]))
  : [...walk(join(ROOT, 'e2e')), ...walk(join(ROOT, 'src'))]

const findings = []
for (const f of targets) {
  try { findings.push(...scanText(f, readFileSync(f, 'utf8'))) } catch (e) {
    console.error(`  ! could not scan ${f}: ${e.message}`)
    process.exitCode = 2
  }
}

if (wantJson) {
  console.log(JSON.stringify({ scanned: targets.length, findings }, null, 2))
} else {
  const live = findings.filter((f) => !f.guarded)
  const guarded = findings.filter((f) => f.guarded)
  const a = live.filter((f) => f.klass === 'A')
  const b = live.filter((f) => f.klass === 'B')
  const erase = live.filter((f) => f.intent === 'claimsFieldIsErasedOrAbsent')
  console.log(`\nscanned ${targets.length} spec/test file(s)\n`)
  for (const klass of ['A', 'B']) {
    const rows = live.filter((f) => f.klass === klass)
    if (!rows.length) continue
    console.log(
      klass === 'A'
        ? '── CLASS A — optional-chained subject (`row?.field`)'
        : '── CLASS B — indexed subject (`rows[0].field`) — the swallowed-read family',
    )
    for (const r of rows) {
      const tag = r.intent === 'claimsFieldIsErasedOrAbsent' ? ' ⛔ERASURE-CLAIM' : ''
      console.log(`   ${relative(ROOT, r.file)}:${r.line}  ${r.matcher}${tag}`)
      console.log(`      subject: ${r.subject}`)
    }
    console.log('')
  }
  if (guarded.length) {
    console.log('── GUARDED — a preceding existence assertion on the same subject makes these SOUND.')
    console.log('   The optional chain is redundant, not vacuous. ⚠ Do NOT "fix" these: churning a')
    console.log('   correct test is the cost of a detector that finds a lot without proving it.')
    for (const r of guarded) {
      console.log(`   ${relative(ROOT, r.file)}:${r.line}  ${r.matcher}   (${r.subject})`)
    }
    console.log('')
  }
  console.log(`UNGUARDED ${live.length}   (class A ${a.length} · class B ${b.length})   GUARDED ${guarded.length}`)
  console.log(`  of which ERASURE claims: ${erase.length} — a row that was never created`)
  console.log('  satisfies these, and the conclusion drawn is "the data was erased".')
  console.log('\n⚠ This is a FLOOR, not the population. The detector tests SHAPE at the')
  console.log('  assertion site; a subject made absent one call frame away leaves no syntax')
  console.log('  here at all. ⛔ Do not quote this total as "the count".')
}

if (gate && findings.some((f) => !f.guarded)) process.exit(1)
