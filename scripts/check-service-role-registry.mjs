#!/usr/bin/env node
/**
 * check-service-role-registry.mjs -- gate 11.
 *
 * The service-role DML registry in `docs/backend-state.md` must be RE-DERIVED, never
 * hand-maintained: plan `docs/plans/authz-evolution.md` AE1.4 step 1 `[PA-F10]` states
 * that "a diff between derivation and registry is a red". Until this script existed that
 * comparison was a human reading two lists side by side, and the doc said so in its own
 * words. It drifted within one commit: AE1.3 converted nine raw-DML sites into door
 * calls and the registry kept describing the raw DML.
 *
 * WHAT IT COMPARES
 *   derived set = `scripts/service-role-dml-census.mjs --json`, bucket IN_SCOPE
 *                 MINUS the `callDoor` wrapper placeholder (see WRAPPER EXPANSION)
 *                 PLUS  every service-role `callDoor(...)` call site, derived here
 *   registry set = the `Key` cell of every table row in the registry section
 *
 * Identity is `<relpath>::<symbol>::<writeKind>::<target>` -- file + symbol + kind +
 * target, never the line number, which is volatile. Comparison is a MULTISET: two rows
 * can legitimately share an identity (`assignOrgAdmin` calls `grant_role_for` twice, at
 * the org tier and for the single-hospital auto-seat), and a set comparison would let one
 * of them be deleted without a red.
 *
 * WRAPPER EXPANSION (why this script derives anything at all)
 *   The census detects member calls -- `client.rpc('name', ...)`. AE1.3 introduced
 *   `callDoor(client, 'name', args)` (`src/lib/types/rpc-args.ts`), a free function, so
 *   five real service-role door calls became invisible to it. What the census reports
 *   instead is ONE row for the wrapper's own inner `client.rpc(fn, ...)`, target
 *   `<dynamic:fn>`, naming only the first service-role caller it happened to find. That
 *   single row stands in for N call sites, so taking the census output at face value
 *   would under-count the service-role write surface. This script expands it: it drops
 *   the placeholder and derives the real call sites from source.
 *
 *   The substitution is asserted in BOTH directions, so it cannot go stale silently:
 *   placeholder present but zero service-role `callDoor` sites is a red, and vice versa.
 *
 * SELF-TEST
 *   Every run first proves the differ can fail: it drops a registry key (expects exactly
 *   one MISSING) and injects a bogus one (expects exactly one EXTRA). A differ that
 *   cannot report a difference would green forever, which is the class `lint:vacuous`
 *   exists for. Parsing zero keys is likewise a red, not a clean bill of health.
 *
 * Usage: node scripts/check-service-role-registry.mjs [--verbose]
 * Exit:  0 clean | 1 registry/derivation differ | 2 self-test or derivation failure
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = process.cwd()
const SCAN_DIR = join(ROOT, 'src')
const DOC = join(ROOT, 'docs', 'backend-state.md')
const CENSUS = join(ROOT, 'scripts', 'service-role-dml-census.mjs')
const SECTION_RE = /^## Service-role DML registry\b/
const KEY_CELL_RE = /^`([^`]+)`$/

const WRAPPER_MODULE = '@/lib/types/rpc-args'
const WRAPPER_NAME = 'callDoor'
const ADMIN_MODULE = '@/lib/supabase/admin'
const ADMIN_FACTORY = 'createAdminClient'
const SESSION_MODULES = new Set(['@/lib/supabase/server', '@/lib/supabase/browser'])
const SESSION_FACTORY = 'createClient'

const VERBOSE = process.argv.includes('--verbose')
const problems = []
const fail = (msg) => problems.push(msg)

// ---------------------------------------------------------------------------
// 1. Derived set: the census
// ---------------------------------------------------------------------------

function runCensus() {
  let raw
  try {
    raw = execFileSync(process.execPath, [CENSUS, '--json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (err) {
    console.error(`FATAL: could not run the census (${CENSUS}).`)
    console.error(String(err.message || err))
    process.exit(2)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('FATAL: the census did not emit parseable JSON for --json.')
    process.exit(2)
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('FATAL: the census emitted no sites at all. Refusing to report a clean diff.')
    process.exit(2)
  }
  return parsed
}

const identity = (rel, symbol, writeKind, target) => `${rel}::${symbol}::${writeKind}::${target}`

// ---------------------------------------------------------------------------
// 2. Derived set: the callDoor wrapper expansion
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const st = statSync(abs)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      walk(abs, out)
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(abs)
    }
  }
  return out
}

/** local identifier name -> { imported, module } for every named import in the file. */
function buildImportTable(sourceFile) {
  const table = new Map()
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue
    const mod = stmt.moduleSpecifier.text
    const named = stmt.importClause.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        table.set(el.name.text, { imported: (el.propertyName ?? el.name).text, module: mod })
      }
    }
  }
  return table
}

/** Nearest enclosing function-like ancestor that has a determinable name. */
function enclosingSymbolName(node) {
  let n = node.parent
  while (n) {
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n)
    ) {
      if (n.name && ts.isIdentifier(n.name)) return n.name.text
      const p = n.parent
      if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
    }
    n = n.parent
  }
  return '<module scope>'
}

/** Find a same-file `const x = <init>` for an identifier. */
function findInitializer(sourceFile, name) {
  let found = null
  const visit = (node) => {
    if (found) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer ?? null
      return
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sourceFile, visit)
  return found
}

/**
 * SERVICE_ROLE | USER_SESSION | UNRESOLVED for the client argument of a callDoor call.
 * Follows identifier aliases (`const admin = adminClient`) up to `maxHops`.
 */
function classifyClientArg(expr, sourceFile, importTable, maxHops = 6) {
  let node = expr
  for (let hop = 0; hop <= maxHops; hop += 1) {
    while (node && (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))) {
      node = node.expression
    }
    if (!node) return 'UNRESOLVED'
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const imp = importTable.get(node.expression.text)
      if (imp && imp.imported === ADMIN_FACTORY && imp.module === ADMIN_MODULE) return 'SERVICE_ROLE'
      if (imp && imp.imported === SESSION_FACTORY && SESSION_MODULES.has(imp.module)) {
        return 'USER_SESSION'
      }
      return 'UNRESOLVED'
    }
    if (ts.isIdentifier(node)) {
      const next = findInitializer(sourceFile, node.text)
      if (!next) return 'UNRESOLVED'
      node = next
      continue
    }
    return 'UNRESOLVED'
  }
  return 'UNRESOLVED'
}

/** Every service-role `callDoor(client, 'name', ...)` call site in src/. */
function deriveWrapperSites() {
  const sites = []
  for (const abs of walk(SCAN_DIR)) {
    const text = readFileSync(abs, 'utf8')
    if (!text.includes(WRAPPER_NAME)) continue
    const rel = relative(ROOT, abs).split(sep).join('/')
    const sourceFile = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const importTable = buildImportTable(sourceFile)
    const local = [...importTable.entries()].find(
      ([, v]) => v.imported === WRAPPER_NAME && v.module === WRAPPER_MODULE,
    )
    if (!local) continue
    const localName = local[0]

    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === localName
      ) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const at = `${rel}:${line}`
        if (node.arguments.length < 2) {
          fail(`DERIVATION: ${WRAPPER_NAME}() at ${at} has fewer than 2 arguments -- cannot derive.`)
          return
        }
        const nameArg = node.arguments[1]
        if (!ts.isStringLiteralLike(nameArg)) {
          fail(
            `DERIVATION: ${WRAPPER_NAME}() at ${at} passes a non-literal function name ` +
              `(${nameArg.getText().slice(0, 60)}) -- the door it opens cannot be derived. ` +
              `Pass a string literal, or this write site is invisible to the registry.`,
          )
          return
        }
        const cls = classifyClientArg(node.arguments[0], sourceFile, importTable)
        if (cls === 'UNRESOLVED') {
          fail(
            `DERIVATION: ${WRAPPER_NAME}('${nameArg.text}') at ${at} -- could not resolve the ` +
              `client argument to a known factory. Refusing to guess whether it is service-role.`,
          )
          return
        }
        if (cls !== 'SERVICE_ROLE') return
        sites.push({
          key: identity(rel, enclosingSymbolName(node), 'rpc', nameArg.text),
          at,
        })
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sourceFile, visit)
  }
  return sites
}

// ---------------------------------------------------------------------------
// 3. Registry set: the Key cells
// ---------------------------------------------------------------------------

function parseRegistryKeys() {
  const lines = readFileSync(DOC, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => SECTION_RE.test(l))
  if (start === -1) {
    console.error(`FATAL: no "## Service-role DML registry" heading in ${DOC}.`)
    process.exit(2)
  }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## /.test(lines[i])) {
      end = i
      break
    }
  }

  const keys = []
  let sawHeader = false
  for (let i = start; i < end; i += 1) {
    const line = lines[i]
    if (!line.startsWith('|')) {
      sawHeader = false
      continue
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length === 0) continue
    const first = cells[0]
    if (/^:?-{2,}:?$/.test(first)) continue
    if (!sawHeader) {
      if (first !== 'Key') {
        fail(
          `REGISTRY: the table at ${DOC}:${i + 1} has no machine-readable "Key" column ` +
            `(first header cell is "${first}"). Every registry table must carry one, or its ` +
            `rows are invisible to this gate.`,
        )
      }
      sawHeader = true
      continue
    }
    const m = KEY_CELL_RE.exec(first)
    if (!m || !m[1].includes('::')) {
      fail(
        `REGISTRY: row at ${DOC}:${i + 1} has no parseable identity key in its first cell ` +
          `(found "${first.slice(0, 80)}"). Expected a single backticked ` +
          `\`path::symbol::writeKind::target\`.`,
      )
      continue
    }
    keys.push(m[1])
  }
  return keys
}

// ---------------------------------------------------------------------------
// 4. Multiset diff
// ---------------------------------------------------------------------------

function tally(keys) {
  const m = new Map()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

/** Returns { missing: [{key,n}], extra: [{key,n}] } -- missing = derived but not in registry. */
function diff(derived, registry) {
  const a = tally(derived)
  const b = tally(registry)
  const missing = []
  const extra = []
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const d = (a.get(k) ?? 0) - (b.get(k) ?? 0)
    if (d > 0) missing.push({ key: k, n: d })
    else if (d < 0) extra.push({ key: k, n: -d })
  }
  missing.sort((x, y) => x.key.localeCompare(y.key))
  extra.sort((x, y) => x.key.localeCompare(y.key))
  return { missing, extra }
}

// ---------------------------------------------------------------------------
// 5. Self-test: prove the differ can report a difference
// ---------------------------------------------------------------------------

function selfTest(derived, registry) {
  if (derived.length === 0) return ['self-test: derivation is empty -- nothing to prove against.']
  const errs = []

  const dropped = registry.slice()
  const removedIdx = dropped.indexOf(derived[0])
  if (removedIdx === -1) {
    // The registry does not contain derived[0]; the real diff below will say so. Use any
    // registry row instead so the differ is still exercised.
    if (dropped.length > 0) dropped.splice(0, 1)
  } else {
    dropped.splice(removedIdx, 1)
  }
  if (registry.length > 0) {
    const before = diff(derived, registry)
    const after = diff(derived, dropped)
    const grew =
      after.missing.reduce((s, x) => s + x.n, 0) - before.missing.reduce((s, x) => s + x.n, 0) === 1 ||
      before.extra.reduce((s, x) => s + x.n, 0) - after.extra.reduce((s, x) => s + x.n, 0) === 1
    if (!grew) {
      errs.push('self-test A FAILED: dropping one registry row did not change the diff by one.')
    }
  }

  const injected = registry.concat('src/__self_test__/nonexistent.ts::ghost::rpc::never_real')
  const withGhost = diff(derived, injected)
  if (!withGhost.extra.some((x) => x.key.includes('__self_test__'))) {
    errs.push('self-test B FAILED: an injected bogus registry row was not reported as EXTRA.')
  }

  return errs
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const censusRows = runCensus()
const inScope = censusRows.filter((r) => r.bucket === 'IN_SCOPE')

const placeholders = inScope.filter(
  (r) => r.rel === 'src/lib/types/rpc-args.ts' && r.symbol === WRAPPER_NAME,
)
const censusKeys = inScope
  .filter((r) => !(r.rel === 'src/lib/types/rpc-args.ts' && r.symbol === WRAPPER_NAME))
  .map((r) => identity(r.rel, r.symbol, r.writeKind, r.target))

const wrapperSites = deriveWrapperSites()

// The substitution must hold in both directions, or the expansion rule has gone stale.
if (wrapperSites.length > 0 && placeholders.length !== 1) {
  fail(
    `EXPANSION: derived ${wrapperSites.length} service-role ${WRAPPER_NAME}() site(s) but the ` +
      `census reports ${placeholders.length} wrapper placeholder row(s) (expected exactly 1). ` +
      `The census's view of ${WRAPPER_MODULE} changed -- re-check the expansion rule in this ` +
      `script before trusting either list.`,
  )
}
if (wrapperSites.length === 0 && placeholders.length > 0) {
  fail(
    `EXPANSION: the census still reports a ${WRAPPER_NAME}() placeholder row but no ` +
      `service-role ${WRAPPER_NAME}() call site was derived. One of the two is wrong.`,
  )
}

const derivedKeys = censusKeys.concat(wrapperSites.map((s) => s.key))
const registryKeys = parseRegistryKeys()

if (registryKeys.length === 0) {
  fail(
    `REGISTRY: parsed ZERO identity keys from the registry section of ${DOC}. ` +
      `An empty parse is a red, never a clean diff.`,
  )
}

const selfTestErrors = selfTest(derivedKeys, registryKeys)
if (selfTestErrors.length > 0) {
  console.error('Service-role DML registry gate: SELF-TEST FAILED\n')
  for (const e of selfTestErrors) console.error(`  ${e}`)
  process.exit(2)
}

const { missing, extra } = diff(derivedKeys, registryKeys)

if (VERBOSE) {
  console.log(`census IN_SCOPE       : ${inScope.length}`)
  console.log(`  wrapper placeholder : ${placeholders.length} (dropped)`)
  console.log(`  ${WRAPPER_NAME}() expansion : ${wrapperSites.length}`)
  for (const s of wrapperSites) console.log(`      ${s.at}  ${s.key}`)
  console.log(`derived identities    : ${derivedKeys.length}`)
  console.log(`registry rows         : ${registryKeys.length}`)
}

if (problems.length > 0 || missing.length > 0 || extra.length > 0) {
  console.error('Service-role DML registry gate: FAILED\n')
  console.error(
    `  derived ${derivedKeys.length} service-role write site(s); registry has ${registryKeys.length} row(s).\n`,
  )
  if (missing.length > 0) {
    console.error(`  ${missing.length} site(s) DERIVED but MISSING from the registry:`)
    for (const m of missing) console.error(`    + ${m.key}${m.n > 1 ? `  (x${m.n})` : ''}`)
    console.error('')
  }
  if (extra.length > 0) {
    console.error(`  ${extra.length} registry row(s) with NO derived site (stale or wrong key):`)
    for (const e of extra) console.error(`    - ${e.key}${e.n > 1 ? `  (x${e.n})` : ''}`)
    console.error('')
  }
  for (const p of problems) console.error(`  ${p}`)
  if (problems.length > 0) console.error('')
  console.error(
    '  The registry is re-derived, never hand-maintained (AE1.4 [PA-F10]). Re-run\n' +
      '  `node scripts/service-role-dml-census.mjs` and bring\n' +
      '  docs/backend-state.md > "Service-role DML registry" back into agreement --\n' +
      '  a new site needs a row stating owner, reason, revalidation mechanism, audit\n' +
      '  event, and the test that would notice its guard vanish.',
  )
  process.exit(1)
}

console.log(
  `Service-role DML registry: OK -- ${derivedKeys.length} derived site(s) == ${registryKeys.length} registry row(s) ` +
    `(census ${censusKeys.length} + ${WRAPPER_NAME}() ${wrapperSites.length}).`,
)
