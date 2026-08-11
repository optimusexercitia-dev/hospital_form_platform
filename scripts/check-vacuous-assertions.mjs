#!/usr/bin/env node
/**
 * Vacuous-pass detector (FUP-VACUOUS-AUDIT-1, from BUG-VACUOUS-ASSERT-1).
 *
 * THE DEFECT SHAPE. A test whose every assertion sits inside a conditional can
 * complete having asserted NOTHING, and reports exactly the same GREEN as a test
 * that verified the real thing. This is invisible to every other gate in the
 * project: ESLint doesn't flag it, `tsc` doesn't either (both branches are valid
 * TypeScript), and a passing Playwright run cannot tell you which branch ran.
 *
 * THE CHECKABLE PROPERTY. Rather than trying to prove "some regression would still
 * be caught" (undecidable in general), this asserts the strictly weaker, fully
 * decidable property the bug actually names:
 *
 *     every test must carry at least ONE assertion that executes UNCONDITIONALLY.
 *
 * A test that satisfies it may still be a weak test. A test that FAILS it is
 * provably able to pass having checked nothing — which is the shape being hunted.
 *
 * WHAT COUNTS AS UNCONDITIONAL. An assertion reached from the test body without
 * passing through an `if`, `try`, `switch`, loop, `?:`, `||`/`&&`/`??`, or a
 * callback that may never fire. Deliberate exceptions, because these DO always run:
 *   - `await test.step('…', async () => { … })`   — the step body always executes
 *   - a call to a local helper whose own body asserts unconditionally
 *     (resolved transitively, cycle-safe)
 * `expect`, `expect.soft` and `expect.poll` all count. `test.skip`/`fixme` bodies
 * are not analysed.
 *
 * SELF-TEST (`--self-test`). A detector that finds nothing must be proven able to
 * find something, so this ships with hand-classified fixtures covering both
 * polarities and exits non-zero if it misclassifies any of them. Run it before
 * believing a clean report.
 *
 * Usage:
 *   node scripts/check-vacuous-assertions.mjs [--self-test] [--json] [paths…]
 * Default paths: e2e/*.spec.ts plus any *.test.ts(x) under src/.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const TEST_FNS = new Set(['test', 'it'])
// Modifiers that still produce a running test (`only`, `fails`) vs ones that don't.
const RUNNING_MODIFIERS = new Set(['only', 'fails', 'concurrent', 'sequential'])
// Wrappers whose callback ALWAYS runs and whose failure propagates out of the
// wrapper — so an assertion inside one is guaranteed, not conditional.
const RETRY_WRAPPERS = new Set(['waitFor', 'waitForElementToBeRemoved', 'act'])
// Per-file map of `const <name> = [ … ]` bindings, so a `for…of` over one of them
// can be resolved back to its literal. Rebuilt by analyseSource for each file.
let ARRAY_CONSTS = new Map()

/** Is this call `expect(...)`, `expect.soft(...)`, or `expect.poll(...)`? */
function isExpectCall(node) {
  if (!ts.isCallExpression(node)) return false
  let head = node.expression
  // Unwrap the matcher chain: expect(x).not.toBe(y) -> expect(x)
  while (ts.isPropertyAccessExpression(head) || ts.isCallExpression(head)) {
    head = ts.isCallExpression(head) ? head.expression : head.expression
  }
  return ts.isIdentifier(head) && head.text === 'expect'
}

/** `test('name', fn)` / `it.only(...)` -> the test's body function, else null. */
function asTestCall(node) {
  if (!ts.isCallExpression(node)) return null
  const callee = node.expression
  let name = null
  if (ts.isIdentifier(callee)) {
    name = callee.text
  } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    const modifier = callee.name.text
    if (!RUNNING_MODIFIERS.has(modifier)) return null // skip / fixme / describe / each
    name = callee.expression.text
  }
  if (!name || !TEST_FNS.has(name)) return null
  const title = node.arguments[0]
  const body = node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a))
  if (!body || !body.body) return null
  return {
    title: title && ts.isStringLiteralLike(title) ? title.text : '<dynamic title>',
    fn: body,
  }
}

/** `await test.step('…', async () => {…})` -> the step's body, else null. */
function asTestStep(node) {
  if (!ts.isCallExpression(node)) return null
  const c = node.expression
  if (
    !ts.isPropertyAccessExpression(c) ||
    !ts.isIdentifier(c.expression) ||
    c.expression.text !== 'test' ||
    c.name.text !== 'step'
  ) {
    return null
  }
  return node.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) ?? null
}

/**
 * Does this statement list contain an assertion on EVERY path through it?
 * Walks only into constructs that are guaranteed to execute.
 */
function assertsUnconditionally(node, helpers, seen) {
  if (!node) return false
  let found = false
  // Once a conditional bail-out (`if (…) { return }`) has been seen, NOTHING after
  // it is guaranteed any more — there is a live path to the end of the test that
  // skips every later assertion. This is the Flow 4c shape, and the detector's own
  // self-test caught the first version of this function getting it wrong.
  // A conditional `test.skip()` is deliberately NOT treated this way: a skipped test
  // is reported as skipped, which is honest. A silent `return` is not.
  let guaranteed = true

  const visitStatement = (stmt) => {
    if (found || !guaranteed) return
    // Guaranteed-executing wrappers we deliberately walk through.
    if (ts.isBlock(stmt)) {
      if (assertsUnconditionally(stmt.statements, helpers, seen)) found = true
      return
    }
    if (ts.isLabeledStatement(stmt)) return visitStatement(stmt.statement)

    // `try { … } finally { … }` with NO catch: the try body runs unconditionally and
    // an assertion failure inside it PROPAGATES (finally cannot swallow it), so it
    // genuinely guarantees an assertion. A `catch` clause is the opposite — it eats
    // the failure — so try/catch stays non-guaranteeing. The `try/finally + cleanup`
    // idiom is common in this repo's E2E specs and treating it as vacuous produced
    // false positives on real, correctly-asserting security tests.
    if (ts.isTryStatement(stmt)) {
      if (!stmt.catchClause && assertsUnconditionally(stmt.tryBlock.statements, helpers, seen)) {
        found = true
        return
      }
      if (containsTestExitingReturn(stmt)) guaranteed = false
      return
    }

    // Any expression statement: look for an unconditional assertion inside it,
    // but do NOT descend into short-circuit / ternary / callback positions.
    if (ts.isExpressionStatement(stmt) || ts.isVariableStatement(stmt) || ts.isReturnStatement(stmt)) {
      if (containsGuaranteedAssertion(stmt, helpers, seen)) found = true
      return
    }
    // EXHAUSTIVE BRANCHING. `if (c) { assert } else { assert }` does guarantee an
    // assertion — every path through it asserts. So does an `else if` chain that
    // ends in a real `else`, by recursion. Only an `if` with no `else`, or one whose
    // branches don't all assert, leaves a silent path. Missing this flagged real
    // deny-tests that correctly assert both the 403 and the empty-result outcome.
    if (ts.isIfStatement(stmt) && stmt.elseStatement) {
      const branch = (s) => (ts.isBlock(s) ? s.statements : [s])
      if (
        assertsUnconditionally(branch(stmt.thenStatement), helpers, seen) &&
        assertsUnconditionally(branch(stmt.elseStatement), helpers, seen)
      ) {
        found = true
        return
      }
      if (containsTestExitingReturn(stmt)) guaranteed = false
      return
    }

    // `for (const x of [a, b, c])` over a NON-EMPTY ARRAY LITERAL is guaranteed to
    // execute — the collection is right there and cannot be empty. A loop over a
    // computed collection is NOT (an empty result asserts nothing, which is the
    // shape being hunted), so only the literal form is admitted.
    if (ts.isForOfStatement(stmt) && isNonEmptyArrayLiteral(stmt.expression)) {
      const body = ts.isBlock(stmt.statement) ? stmt.statement.statements : [stmt.statement]
      if (assertsUnconditionally(body, helpers, seen)) {
        found = true
        return
      }
    }

    // if / try / switch / loops / throw: not guaranteed, so they can never SUPPLY
    // the assertion — but they can REVOKE the guarantee for everything after them.
    //
    // ⚠ Only a SILENT exit revokes it. `if (c) { …asserts…; return }` is a guard
    // clause whose early-exit path DOES assert, so it is the same shape as an
    // exhaustive if/else and must not be penalised: the taken path asserts here, and
    // the fall-through path still has the rest of the test to assert in. Revoking on
    // any `return` at all flagged a pile of correctly-written guard clauses.
    if (containsTestExitingReturn(stmt) && !exitPathAsserts(stmt, helpers, seen)) {
      guaranteed = false
    }
  }

  const list = Array.isArray(node) ? node : node.statements ? node.statements : [node]
  for (const stmt of list) visitStatement(stmt)
  return found
}

/**
 * A non-empty array literal, seen through the wrappers that do not change it:
 * `as const`, `satisfies T`, `<T>expr`, and parentheses. Without this unwrap the
 * extremely common `for (const t of ['a','b'] as const)` reads as a computed
 * collection and produces a false positive.
 */
function isNonEmptyArrayLiteral(expr) {
  let e = expr
  while (
    ts.isAsExpression(e) ||
    ts.isTypeAssertionExpression?.(e) ||
    ts.isSatisfiesExpression?.(e) ||
    ts.isParenthesizedExpression(e)
  ) {
    e = e.expression
  }
  // `const cases = [...]` then `for (const c of cases)` is the same guarantee as an
  // inline literal — the binding is a const in this file and its initialiser is right
  // there. Resolving it removes a very common table-driven-test false positive.
  if (ts.isIdentifier(e)) {
    const decl = ARRAY_CONSTS.get(e.text)
    if (!decl) return false
    e = decl
    while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression
  }
  return (
    ts.isArrayLiteralExpression(e) &&
    e.elements.length > 0 &&
    // A spread could expand to nothing, so it cannot carry the guarantee.
    !e.elements.some((el) => ts.isSpreadElement(el))
  )
}

/**
 * Does every early-exit path inside this statement assert before it returns?
 *
 * Used to tell a GUARD CLAUSE (`if (bad) { expect(...); return }`) from a SILENT
 * BAIL (`if (bad) { return }`). Only the latter leaves a path through the test with
 * no assertion on it. Conservative: anything it cannot see through counts as silent.
 */
function exitPathAsserts(stmt, helpers, seen) {
  const branch = (s) => (s ? (ts.isBlock(s) ? s.statements : [s]) : [])
  if (ts.isIfStatement(stmt)) {
    // Check only the sub-branches that can actually return.
    for (const s of [stmt.thenStatement, stmt.elseStatement]) {
      if (!s) continue
      if (!containsTestExitingReturn(s)) continue
      // A branch that calls `test.skip()` / `test.fixme()` is not a silent exit:
      // the runner reports the test as SKIPPED, which is visible and honest. Only a
      // bare `return` produces a GREEN that claims a check that never happened.
      if (callsTestSkip(s)) continue
      if (!assertsUnconditionally(branch(s), helpers, seen)) return false
    }
    return true
  }
  if (ts.isTryStatement(stmt)) {
    return assertsUnconditionally(stmt.tryBlock.statements, helpers, seen)
  }
  // Loops, switch, labelled statements: not modelled — treat as silent.
  return false
}

/** `test.skip(...)` / `test.fixme(...)` anywhere in this statement (not in a nested fn). */
function callsTestSkip(node) {
  let found = false
  const walk = (n) => {
    if (found) return
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      TEST_FNS.has(n.expression.expression.text) &&
      (n.expression.name.text === 'skip' || n.expression.name.text === 'fixme')
    ) {
      found = true
      return
    }
    ts.forEachChild(n, (c) => {
      if (ts.isArrowFunction(c) || ts.isFunctionExpression(c)) return
      walk(c)
    })
  }
  walk(node)
  return found
}

/** A `return` that exits the TEST (not a nested callback) anywhere inside `node`. */
function containsTestExitingReturn(node) {
  let found = false
  const walk = (n) => {
    if (found) return
    if (ts.isReturnStatement(n)) {
      found = true
      return
    }
    ts.forEachChild(n, (c) => {
      if (ts.isArrowFunction(c) || ts.isFunctionExpression(c) || ts.isFunctionDeclaration(c)) return
      walk(c)
    })
  }
  walk(node)
  return found
}

/** Assertion reachable from `node` without passing a conditional boundary. */
function containsGuaranteedAssertion(node, helpers, seen) {
  let found = false
  const walk = (n) => {
    if (found || !n) return
    if (isExpectCall(n)) {
      found = true
      return
    }
    // Testing-Library / Vitest retry wrappers: `waitFor(() => expect(…))`,
    // `waitForElementToBeRemoved`, `act(() => …)`. The callback is always invoked and
    // an assertion that never satisfies makes the WRAPPER throw, so an expect inside
    // one is genuinely guaranteed — unlike a `.forEach` callback, which simply may
    // not fire. Missing this flagged real, correctly-asserting tests.
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      RETRY_WRAPPERS.has(n.expression.text)
    ) {
      for (const arg of n.arguments) {
        if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue
        const b = arg.body
        if (containsGuaranteedAssertion(ts.isBlock(b) ? b : ts.factory.createExpressionStatement(b), helpers, seen)) {
          found = true
          return
        }
      }
    }

    const step = asTestStep(n)
    if (step) {
      // The step callback always runs.
      if (assertsUnconditionally(ts.isBlock(step.body) ? step.body.statements : [step.body], helpers, seen)) {
        found = true
      }
      return
    }
    // A call to a local helper that itself asserts unconditionally.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const helper = helpers.get(n.expression.text)
      if (helper && !seen.has(n.expression.text)) {
        seen.add(n.expression.text)
        const hb = helper.body
        if (hb && assertsUnconditionally(ts.isBlock(hb) ? hb.statements : [hb], helpers, seen)) {
          found = true
        }
        seen.delete(n.expression.text)
        if (found) return
      }
    }
    // Do NOT descend into conditional / short-circuit / callback positions.
    if (
      ts.isConditionalExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isFunctionExpression(n) ||
      (ts.isBinaryExpression(n) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(n.operatorToken.kind))
    ) {
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return found
}

/** Count assertions anywhere in the test (used only to describe the finding). */
function countAllAssertions(fn) {
  let n = 0
  const walk = (node) => {
    if (isExpectCall(node)) n++
    ts.forEachChild(node, walk)
  }
  walk(fn)
  return n
}

/** Does this test bail early via a bare `return` inside a conditional? */
function hasConditionalEarlyReturn(fn) {
  let found = false
  const walk = (node, insideConditional) => {
    if (found) return
    if (ts.isReturnStatement(node) && insideConditional && !node.expression) {
      found = true
      return
    }
    const nowConditional =
      insideConditional ||
      ts.isIfStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isTryStatement(node)
    ts.forEachChild(node, (c) => {
      // Don't follow nested function bodies — their `return` is not the test's.
      if (ts.isArrowFunction(c) || ts.isFunctionExpression(c) || ts.isFunctionDeclaration(c)) return
      walk(c, nowConditional)
    })
  }
  walk(fn, false)
  return found
}

function analyseSource(fileName, text) {
  // ⚠ ScriptKind must follow the extension. `createSourceFile` does NOT throw on a
  // syntax error — it returns a best-effort tree — so parsing a .tsx as TS yields a
  // silently mangled AST and confident nonsense downstream. That mistake produced 22
  // false "NO-ASSERTIONS-AT-ALL" findings on the first run of this script, which is
  // the very failure mode it exists to hunt. The parse is now asserted, not assumed.
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  const parseErrors = sf.parseDiagnostics ?? []
  if (parseErrors.length) {
    const first = ts.flattenDiagnosticMessageText(parseErrors[0].messageText, ' ')
    throw new Error(`${parseErrors.length} parse error(s), first: ${first}`)
  }

  // Local helper functions (module scope) that may carry assertions, and the
  // array-literal consts a table-driven test loops over.
  const helpers = new Map()
  ARRAY_CONSTS = new Map()
  const collect = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) helpers.set(node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        helpers.set(node.name.text, node.initializer)
      }
      let init = node.initializer
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression
      // Last write wins is fine: a name bound twice to different literals in one file
      // is rare, and treating the later one as authoritative is the conservative read
      // only when it is EMPTY (which withholds the guarantee anyway).
      if (ts.isArrayLiteralExpression(init)) ARRAY_CONSTS.set(node.name.text, init)
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)

  const findings = []
  const walk = (node) => {
    const t = asTestCall(node)
    if (t) {
      const body = t.fn.body
      const stmts = ts.isBlock(body) ? body.statements : [body]
      const ok = assertsUnconditionally(stmts, helpers, new Set())
      const total = countAllAssertions(t.fn)
      if (!ok) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        findings.push({
          file: fileName,
          line: line + 1,
          title: t.title,
          assertionsInFile: total,
          kind: total === 0 ? 'NO-ASSERTIONS-AT-ALL' : 'ALL-ASSERTIONS-CONDITIONAL',
          earlyReturn: hasConditionalEarlyReturn(t.fn),
        })
      }
      return // don't descend into nested test() (there shouldn't be any)
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return findings
}

// ---------------------------------------------------------------------------
// Self-test — hand-classified fixtures, both polarities. A detector that finds
// nothing must first be proven able to find something.
// ---------------------------------------------------------------------------
const FIXTURES = [
  // --- must be FLAGGED ---
  { flag: true, name: 'if with no else', src: `test('a', async () => { if (x) { expect(1).toBe(1) } })` },
  { flag: true, name: 'nested ifs only', src: `test('a', async () => { if (x) { if (y) { expect(1).toBe(1) } } })` },
  { flag: true, name: 'early bare return', src: `test('a', async () => { if (!ok) { return } expect(1).toBe(1) })` },
  // A guard clause that ASSERTS before returning covers its own exit path.
  { flag: false, name: 'guard clause asserts then returns', src: `test('a', async () => { if (!ok) { expect(x).toBe(1); return } expect(1).toBe(1) })` },
  { flag: true, name: 'guard asserts then returns, but fall-through does not', src: `test('a', async () => { if (!ok) { expect(x).toBe(1); return } if (y) { expect(1).toBe(1) } })` },
  { flag: true, name: 'guard whose assertion is itself conditional', src: `test('a', async () => { if (!ok) { if (z) { expect(x).toBe(1) } return } expect(1).toBe(1) })` },
  // A runtime skip is reported as SKIPPED, not green — honest, so not a finding.
  { flag: false, name: 'conditional test.skip then return', src: `test('a', async () => { if (!rows.length) { test.skip(true, 'no fixture'); return } expect(1).toBe(1) })` },
  { flag: true, name: 'bare return with no skip and no assert', src: `test('a', async () => { if (!rows.length) { return } expect(1).toBe(1) })` },
  { flag: true, name: 'no assertions at all', src: `test('a', async () => { await page.goto('/') })` },
  { flag: true, name: 'assert only in loop over computed collection', src: `test('a', async () => { for (const r of rows) { expect(r).toBeNull() } })` },
  { flag: false, name: 'loop over non-empty array literal', src: `test('a', async () => { for (const e of ['a','b']) { expect(e).toBeTruthy() } })` },
  { flag: true, name: 'loop over EMPTY array literal', src: `test('a', async () => { for (const e of []) { expect(e).toBeTruthy() } })` },
  { flag: false, name: 'loop over array literal AS CONST', src: `test('a', async () => { for (const e of ['a','b'] as const) { expect(e).toBeTruthy() } })` },
  { flag: true, name: 'loop over spread literal (may expand to nothing)', src: `test('a', async () => { for (const e of [...xs]) { expect(e).toBeTruthy() } })` },
  // Table-driven tests: a const bound to an array literal is the same guarantee.
  { flag: false, name: 'loop over const array literal', src: `const rows = ['a','b']; test('a', async () => { for (const r of rows) { expect(r).toBeTruthy() } })` },
  { flag: true, name: 'loop over const EMPTY array literal', src: `const rows = []; test('a', async () => { for (const r of rows) { expect(r).toBeTruthy() } })` },
  { flag: true, name: 'loop over a const that is not a literal', src: `const rows = build(); test('a', async () => { for (const r of rows) { expect(r).toBeTruthy() } })` },
  { flag: false, name: 'assert inside awaited waitFor', src: `test('a', async () => { await waitFor(() => expect(fn).toHaveBeenCalled()) })` },
  { flag: false, name: 'assert inside waitFor block body', src: `test('a', async () => { await waitFor(() => { expect(fn).toHaveBeenCalled() }) })` },
  { flag: true, name: 'waitFor with NO assertion inside', src: `test('a', async () => { await waitFor(() => ready()) })` },
  { flag: true, name: 'assert in try WITH catch (swallowed)', src: `test('a', async () => { try { expect(1).toBe(1) } catch {} })` },
  // try/finally does NOT swallow — the cleanup idiom must stay clean.
  { flag: false, name: 'assert in try WITHOUT catch (finally cleanup)', src: `test('a', async () => { try { expect(1).toBe(1) } finally { cleanup() } })` },
  { flag: true, name: 'try/finally where only cleanup asserts nothing', src: `test('a', async () => { try { doThing() } finally { cleanup() } })` },
  // A helper that bails early does not guarantee an assertion for its caller.
  { flag: true, name: 'helper with its own early return', src: `function h(r) { if (!r) return; expect(r).toBe(1) } test('a', async () => { h(x) })` },
  { flag: true, name: 'assert in ternary', src: `test('a', async () => { const v = x ? expect(1).toBe(1) : 0 })` },
  { flag: true, name: 'assert behind &&', src: `test('a', async () => { x && expect(1).toBe(1) })` },
  { flag: true, name: 'assert in callback', src: `test('a', async () => { rows.forEach(r => expect(r).toBeNull()) })` },
  { flag: true, name: 'if/else where else lacks assert', src: `test('a', async () => { if (x) { expect(1).toBe(1) } else { log() } })` },
  // Exhaustive branching genuinely guarantees an assertion.
  { flag: false, name: 'if/else where BOTH branches assert', src: `test('a', async () => { if (x) { expect(1).toBe(1) } else { expect(2).toBe(2) } })` },
  { flag: false, name: 'else-if chain ending in a real else', src: `test('a', async () => { if (x) { expect(1).toBe(1) } else if (y) { expect(2).toBe(2) } else { expect(3).toBe(3) } })` },
  { flag: true, name: 'else-if chain with NO final else', src: `test('a', async () => { if (x) { expect(1).toBe(1) } else if (y) { expect(2).toBe(2) } })` },
  // The Flow 5d shape: outer else asserts, but the then-branch nests a bare if.
  { flag: true, name: 'if/else whose then-branch nests a bare if', src: `test('a', async () => { if (x) { if (y) { expect(1).toBe(1) } } else { expect(2).toBe(2) } })` },
  // --- must NOT be flagged ---
  { flag: false, name: 'plain unconditional', src: `test('a', async () => { expect(1).toBe(1) })` },
  { flag: false, name: 'awaited unconditional', src: `test('a', async () => { await expect(l).toBeVisible() })` },
  { flag: false, name: 'unconditional after an if', src: `test('a', async () => { if (x) { doThing() } expect(1).toBe(1) })` },
  { flag: false, name: 'expect.soft counts', src: `test('a', async () => { expect.soft(1).toBe(1) })` },
  { flag: false, name: 'inside test.step', src: `test('a', async () => { await test.step('s', async () => { expect(1).toBe(1) }) })` },
  { flag: false, name: 'local asserting helper', src: `const check = (v) => { expect(v).toBe(1) }; test('a', async () => { check(2) })` },
  { flag: false, name: 'skipped test not analysed', src: `test.skip('a', async () => { if (x) { expect(1).toBe(1) } })` },
  { flag: false, name: 'test.only still analysed + clean', src: `test.only('a', async () => { expect(1).toBe(1) })` },
  // Regression guard for the .tsx mis-parse that produced 22 false positives: a JSX
  // test with a plain unconditional assertion must come back CLEAN, not flagged.
  {
    flag: false,
    name: 'JSX body parses (tsx)',
    file: 'fixture.tsx',
    src: `it('a', async () => { render(<Foo bar={1} />); expect(x).not.toBeNull() })`,
  },
  {
    flag: true,
    name: 'JSX body, all assertions conditional',
    file: 'fixture.tsx',
    src: `it('a', async () => { render(<Foo />); if (y) { expect(x).toBe(1) } })`,
  },
]

function selfTest(quiet) {
  let bad = 0
  for (const f of FIXTURES) {
    let got
    try {
      got = analyseSource(f.file ?? 'fixture.ts', f.src).length > 0
    } catch (err) {
      console.error(`  FIXTURE DID NOT PARSE: "${f.name}" — ${err.message}`)
      bad++
      continue
    }
    if (got !== f.flag) {
      bad++
      console.error(`  MISCLASSIFIED: "${f.name}" — expected ${f.flag ? 'FLAG' : 'clean'}, got ${got ? 'FLAG' : 'clean'}`)
    }
  }
  // stderr, never stdout: `--json` output must stay machine-parseable.
  const line = `self-test: ${FIXTURES.length - bad}/${FIXTURES.length} OK` + (bad ? ' — DETECTOR IS UNSOUND' : '')
  if (quiet) console.error(line)
  else console.log(line)
  return bad === 0
}

// ---------------------------------------------------------------------------

function collectFiles(roots) {
  const out = []
  const visit = (p) => {
    let st
    try {
      st = statSync(p)
    } catch {
      return
    }
    if (st.isDirectory()) {
      if (/node_modules|\.next|test-results|playwright-report/.test(p)) return
      for (const e of readdirSync(p)) visit(join(p, e))
      return
    }
    if (/\.spec\.tsx?$|\.test\.tsx?$/.test(p)) out.push(p)
  }
  roots.forEach(visit)
  return out.sort()
}

const argv = process.argv.slice(2)
const wantJson = argv.includes('--json')
const wantSelfTest = argv.includes('--self-test')
// `--gate` exits non-zero on any finding. Wired into `npm run lint` once the count
// reached zero, so it can only ever go back up deliberately. Reporting mode (no
// flag) always exits 0, which is what you want while triaging a backlog.
const wantGate = argv.includes('--gate')
const paths = argv.filter((a) => !a.startsWith('--'))

if (wantSelfTest) {
  process.exit(selfTest(false) ? 0 : 1)
}

if (!selfTest(wantJson)) {
  console.error('Refusing to report: the detector failed its own fixtures.')
  process.exit(1)
}

const files = collectFiles(paths.length ? paths : ['e2e', 'src'])
const findings = []
for (const f of files) {
  try {
    findings.push(...analyseSource(f, readFileSync(f, 'utf8')))
  } catch (err) {
    console.error(`  parse error in ${f}: ${err.message}`)
  }
}

if (wantJson) {
  console.log(JSON.stringify(findings, null, 2))
} else {
  const byFile = new Map()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  console.log(`\nscanned ${files.length} spec files · ${findings.length} test(s) with NO unconditional assertion\n`)
  for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${relative(process.cwd(), file).split(sep).join('/')}  (${list.length})`)
    for (const f of list) {
      const tags = [f.kind, f.earlyReturn ? 'early-return' : null].filter(Boolean).join(' · ')
      console.log(`  L${String(f.line).padEnd(5)} ${tags}`)
      console.log(`         ${f.title.slice(0, 110)}`)
    }
    console.log()
  }
}

if (wantGate) {
  if (findings.length) {
    console.error(
      `\nvacuous-assertion gate: FAILED — ${findings.length} test(s) can pass having asserted nothing.\n` +
        'Every test needs one assertion on an unconditional path. See\n' +
        'docs/reviews/vacuous-assertion-audit.md for the property and the accepted shapes.',
    )
    process.exit(1)
  }
  console.log(`vacuous-assertion gate: OK (${files.length} spec files, 0 findings)`)
}
process.exitCode = 0
