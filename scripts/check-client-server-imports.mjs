#!/usr/bin/env node
/**
 * lint:client-server-imports — the executable form of BUG-FBE-005.
 *
 * THE DEFECT IT CATCHES. A Client Component that VALUE-imports from a `server-only`
 * module drags `@/lib/supabase/server` (and `next/headers`) into the browser graph and
 * ABORTS `next build`. Types erase; values do not. `tsc --noEmit`, `eslint` and
 * `vitest` ALL pass over it — the entire green bar is structurally unable to see this
 * class, which is why it needs its own gate rather than a note in a brief.
 *
 * It has now happened TWICE on this project (BUG-FBE-005, then ETH·E4's
 * `EXTERNAL_PARTICIPANT_TYPES`). The recorded lesson after the first — "require a real
 * `next build` in the green bar" — did not prevent the second, because a load-bearing
 * claim that lives only in prose goes stale silently. Hence: a gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * ⛔ TWO CALIBRATION RULES. DO NOT "SIMPLIFY" EITHER ONE OUT.
 *
 * This detector's first run reported 364 findings. Almost all were its own bugs. The
 * two fixes below took it 364 → 30 → 4, and the final 4 collapsed to ONE real root.
 * A detector that finds a lot needs proving exactly as much as one that finds nothing;
 * both rules exist because removing them silently restores a 300-finding false wall
 * that will be read as noise and switched off.
 *
 *   RULE 1 — a `'use server'` module TERMINATES traversal.
 *     It is an RPC SEAM, not a bundling seam. Next.js replaces its exports with
 *     client-side stubs and never pulls the module (or anything it imports) into the
 *     client graph. A Client Component importing a Server Action that itself imports a
 *     `server-only` query module is CORRECT and extremely common here — that is the
 *     entire Server Actions pattern. Without this rule: 364 findings, ~all false.
 *
 *   RULE 2 — strip comments BEFORE matching imports.
 *     Comments are not code. Several modules in this repo DOCUMENT this very bug in
 *     prose containing the words "import type" / "import ... from" — including
 *     `custom-field-input.tsx` and `notification-bell-client.tsx`, whose comments exist
 *     precisely because someone already hit it. An un-stripped regex matches the
 *     WARNINGS AGAINST the bug and reports them as the bug. Without this rule: 30
 *     findings, 26 of them prose.
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * WHAT COUNTS AS A VALUE IMPORT. `import type X from` and `import { type A, type B }`
 * are fully erased by the compiler. A brace clause with even ONE non-`type` specifier
 * carries a runtime binding and is a value import. The self-test below pins all four
 * arms of that rule and the gate refuses to run if it fails — a detector whose own
 * erasure logic is wrong reports confident nonsense in both directions.
 *
 * Usage:  node scripts/check-client-server-imports.mjs [--gate] [--root <dir>]
 *         --gate  exit 1 on findings (CI). Without it, report and exit 0.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'

const argv = process.argv.slice(2)
const GATE = argv.includes('--gate')
const rootArg = argv.indexOf('--root')
const ROOT = rootArg >= 0 ? resolve(argv[rootArg + 1]) : process.cwd()
const SRC = join(ROOT, 'src')
const rel = (p) => relative(ROOT, p).split(/[/\\]+/).join('/')

const cache = new Map()
const read = (f) => {
  if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8'))
  return cache.get(f)
}

const isClient = (f) => /^\s*["']use client["']/m.test(read(f).slice(0, 400))

/**
 * RULE 3 — a server module is defined by the MODULE SET it pulls, not by one literal.
 *
 * The first version keyed only on `import 'server-only'`. That is the marker, not the
 * property: 47 modules in `src/` import `@/lib/supabase/server` WITHOUT the literal
 * (`queries/members.ts` among them). Transitivity happened to cover them — the chain
 * reaches `supabase/server.ts`, which does carry the literal — but that made the gate
 * depend on ONE file keeping ONE line. Anything that pulls `next/headers` or the server
 * Supabase factory is server-bound and cannot be in a client graph, so key on that.
 */
const SERVER_MODULE_RE =
  /from\s*["'](?:@\/lib\/supabase\/server|next\/headers)["']/
const isServerOnly = (f) => {
  const src = read(f)
  return (
    /^\s*import\s+["']server-only["']/m.test(src) || SERVER_MODULE_RE.test(stripComments(src))
  )
}
/** RULE 1 — see the header. Removing this restores ~360 false findings. */
const isUseServer = (f) => /^\s*["']use server["']/m.test(read(f).slice(0, 400))
/** RULE 2 — see the header. Removing this makes the gate match its own documentation. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** True when the import clause is fully erased at compile time. */
function clauseIsTypeOnly(typeKeyword, clause) {
  if (typeKeyword) return true
  const braced = clause.match(/^\{([\s\S]*)\}$/)
  if (braced) {
    const specs = braced[1].split(',').map((s) => s.trim()).filter(Boolean)
    if (specs.length && specs.every((s) => /^type\s/.test(s))) return true
  }
  return false
}

/**
 * RULE 4 — `export … from` is a VALUE EDGE too.
 *
 * A re-export creates exactly the same bundling edge as an import, and this project's
 * own guidance says so out loud ("do NOT re-export it from the server-only module — a
 * re-export still drags `server-only` into the client graph"). The first version of
 * this gate matched only `import … from`, so it was blind to the one workaround the
 * guidance explicitly warns against — it could not have caught the "helpful" fix.
 * `export type { … } from` is erased and is skipped by the same clause rule.
 */
function valueImports(f) {
  const src = stripComments(read(f))
  const out = []
  const re =
    /\b(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g
  let m
  while ((m = re.exec(src))) {
    const clause = m[2]
    if (clauseIsTypeOnly(m[1], clause)) continue
    out.push({ spec: m[3], clause: clause.replace(/\s+/g, ' ').slice(0, 70) })
  }
  return out
}

function resolveSpec(spec, from) {
  let base
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec)
  else return null
  for (const c of [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')])
    if (existsSync(c)) return c
  return null
}

const memo = new Map()
function chainToServerOnly(f, seen = new Set()) {
  if (memo.has(f)) return memo.get(f)
  if (seen.has(f)) return null
  seen.add(f)
  if (isUseServer(f)) return null // RULE 1
  if (isServerOnly(f)) return [f]
  for (const { spec } of valueImports(f)) {
    const t = resolveSpec(spec, f)
    if (!t) continue
    const sub = chainToServerOnly(t, new Set(seen))
    if (sub) {
      const r = [f, ...sub]
      memo.set(f, r)
      return r
    }
  }
  memo.set(f, null)
  return null
}

// ── SELF-TEST. A gate whose own erasure rule is wrong is worse than no gate. ────────
const probe = (clause, kw = 'import') => {
  const m = /\b(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/.exec(
    `${kw} ${clause} from "@/x"`,
  )
  return clauseIsTypeOnly(m[1], m[2])
}
const selfTests = [
  ['{ FOO }', false, 'a plain named import is a VALUE import'],
  ['type { Foo }', true, 'import type { } is erased'],
  ['{ type Foo }', true, 'an all-type brace clause is erased'],
  ['{ Foo, type Bar }', false, 'one value specifier makes the whole clause a value import'],
  ['Foo', false, 'a default import is a VALUE import'],
]
// RULE 4 arms — the re-export edge the first version was blind to.
const reexportTests = [
  ['{ FOO }', false, 'export { X } from is a VALUE edge'],
  ['type { Foo }', true, 'export type { X } from is erased'],
  ['*', false, 'export * from is a VALUE edge'],
]
const stripTests = [
  ['// import { X } from "@/lib/queries/y"\nconst a = 1', false, 'a commented import is not an import'],
  ['/* import { X } from "@/a" */\nconst a = 1', false, 'a block-commented import is not an import'],
]
let ok = 0
for (const [clause, want, label] of selfTests) {
  if (probe(clause) === want) ok++
  else console.error(`  self-test FAILED: ${label}`)
}
for (const [clause, want, label] of reexportTests) {
  if (probe(clause, 'export') === want) ok++
  else console.error(`  self-test FAILED: ${label}`)
}
for (const [src, want, label] of stripTests) {
  const found = /import\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/.test(stripComments(src))
  if (found === want) ok++
  else console.error(`  self-test FAILED: ${label}`)
}
const TOTAL = selfTests.length + reexportTests.length + stripTests.length
console.log(`self-test: ${ok}/${TOTAL} ${ok === TOTAL ? 'OK' : 'FAILED'}`)
if (ok !== TOTAL) {
  console.error('client/server import gate: detector is not trustworthy — refusing to run.')
  process.exit(2)
}

// ── Scan ───────────────────────────────────────────────────────────────────────────
const files = []
;(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(p) && !/\.(test|spec)\./.test(p)) files.push(p)
  }
})(SRC)

const clients = files.filter(isClient)
const findings = []
for (const f of clients) {
  for (const { spec, clause } of valueImports(f)) {
    const t = resolveSpec(spec, f)
    if (!t) continue
    const chain = chainToServerOnly(t)
    if (chain) findings.push({ client: f, spec, clause, chain })
  }
}

console.log(
  `scanned ${clients.length} client modules · ${files.filter(isServerOnly).length} server-only modules`,
)
for (const x of findings) {
  console.log(`\n  ${rel(x.client)}`)
  console.log(`    VALUE-imports  ${x.clause}  from "${x.spec}"`)
  console.log(`    reaches server-only via:\n            ${x.chain.map(rel).join('\n         -> ')}`)
}
if (findings.length === 0) {
  console.log('\nclient/server import gate: OK (0 findings)')
  process.exit(0)
}
console.log(
  `\nclient/server import gate: ${findings.length} finding(s) — these ABORT \`next build\`.`,
)
console.log('Fix: move the runtime value into a client-safe module (e.g.')
console.log('src/lib/forms/reference-constants.ts). Do NOT re-export it from the')
console.log('server-only module — a re-export still drags `server-only` into the client graph.')
process.exit(GATE ? 1 : 0)
