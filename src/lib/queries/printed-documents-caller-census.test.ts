/**
 * ============================================================================
 * AE1.4 rulings — PO observation #4 (docs/design/authz-ae1-rpc-rulings.md,
 * approved 2026-08-27): `lookup_printed_document` is WRITE-BEARING (every call
 * inserts a `verification_lookups` row), its EXECUTE is service_role-only, and
 * the ONLY thing standing between the public `/verificar` surface and an
 * unbounded lookup/enumeration loop is the TS rate limiter. That control is
 * per-caller, so it holds only while EVERY caller goes through the budgeted
 * wrapper. This file pins exactly that:
 *
 *   ⭐ the door has exactly ONE production caller —
 *      `lookupPrintedDocumentVerification` in src/lib/queries/printed-documents.ts —
 *      and inside that wrapper `consumeLookupBudget(...)` runs BEFORE the RPC.
 *
 * A second caller is not automatically a defect — but it MUST route through the
 * budget (or carry its own), so a red here means: look, then extend the pin.
 *
 * Machinery copied from src/lib/documents/disposal-gap.test.ts (the house
 * caller-census pattern), including its vacuity discipline: every run proves the
 * detector can find a caller (in memory AND via a real walked file) and that a
 * comment-only mention does not count.
 * ============================================================================
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** Assembled from fragments so this file cannot match its own detector. */
const DOOR = ['lookup', 'printed', 'document'].join('_')
const WRAPPER_FILE = 'src/lib/queries/printed-documents.ts'
const WRAPPER_FN = 'lookupPrintedDocumentVerification'
const BUDGET_FN = 'consumeLookupBudget'

const REPO = process.cwd()
for (const sentinel of ['package.json', 'ARCHITECTURE.md', WRAPPER_FILE]) {
  try {
    statSync(join(REPO, sentinel))
  } catch {
    throw new Error(
      `printed-documents-caller-census.test.ts: cwd "${REPO}" is not the repo root ` +
        `(missing ${sentinel}). Refusing to run — a wrong root would make every ` +
        'assertion here vacuously green.',
    )
  }
}

const ROOTS = ['src', 'scripts']
const CODE = /\.(m?[jt]sx?|c[jt]s)$/
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git'])
const IS_TEST = /\.(test|spec)\.[cm]?[jt]sx?$/

type Ref = {
  file: string
  kind: 'rpc-call' | 'string-ref'
  enclosing: string
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkFiles(full, out)
    } else if (entry.isFile() && CODE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function enclosingName(node: ts.Node): string {
  let cur: ts.Node | undefined = node
  while (cur) {
    if (ts.isFunctionDeclaration(cur) && cur.name) return cur.name.text
    if (ts.isMethodDeclaration(cur) && ts.isIdentifier(cur.name)) return cur.name.text
    if (
      ts.isVariableDeclaration(cur) &&
      ts.isIdentifier(cur.name) &&
      cur.initializer &&
      (ts.isArrowFunction(cur.initializer) || ts.isFunctionExpression(cur.initializer))
    ) {
      return cur.name.text
    }
    cur = cur.parent
  }
  return '<module scope>'
}

/**
 * Two layers (the enumeration boundary is a property, not a syntax):
 * `rpc-call` = `x.rpc('<door>', …)`; `string-ref` = any other string literal
 * equal to the door name, catching indirection the narrow detector cannot see.
 * Comments are not AST nodes, so comment-immunity is structural.
 */
function analyse(fileName: string, text: string): Ref[] {
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  const parseErrors =
    (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? []
  if (parseErrors.length) {
    throw new Error(
      `${fileName}: ${parseErrors.length} parse error(s), first: ` +
        ts.flattenDiagnosticMessageText(parseErrors[0].messageText, ' '),
    )
  }
  const refs: Ref[] = []
  const rpcArgs = new Set<ts.Node>()
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'rpc' &&
      node.arguments.length > 0
    ) {
      const first = node.arguments[0]
      if (ts.isStringLiteralLike(first) && first.text === DOOR) {
        rpcArgs.add(first)
        refs.push({ file: fileName, kind: 'rpc-call', enclosing: enclosingName(node) })
      }
    }
    if (ts.isStringLiteralLike(node) && node.text === DOOR && !rpcArgs.has(node)) {
      refs.push({ file: fileName, kind: 'string-ref', enclosing: enclosingName(node) })
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  return refs
}

function censusOf(files: string[]): Ref[] {
  return files.flatMap((f) =>
    analyse(f, readFileSync(f, 'utf8')).map((r) => ({
      ...r,
      file: relative(REPO, f).split('\\').join('/'),
    })),
  )
}

const allFiles = ROOTS.flatMap((r) => walkFiles(join(REPO, r)))
const productionFiles = allFiles.filter((f) => !IS_TEST.test(f))
const census = censusOf(productionFiles)
const callSites = census.filter((r) => r.kind === 'rpc-call')

const render = (refs: Ref[]): string =>
  refs.map((r) => `${r.file} :: ${r.enclosing} [${r.kind}]`).join('\n') || '(none)'

describe('AE1.4 obs#4 — lookup_printed_document caller census (the rate limiter fronts every caller)', () => {
  it('census reads a real, non-trivial file set (denominator anchor)', () => {
    expect(productionFiles.length).toBeGreaterThan(200)
    expect(productionFiles.map((f) => relative(REPO, f).split('\\').join('/'))).toContain(
      WRAPPER_FILE,
    )
  })

  it('detector finds a caller in an in-memory fixture (analyser positive control)', () => {
    const found = analyse(
      'fixture.ts',
      `export async function lookupIt(admin: Client, cred: string) {
         await admin.rpc('${DOOR}', { p_credential: cred, p_viewer: null })
       }`,
    )
    expect(found.filter((r) => r.kind === 'rpc-call')).toHaveLength(1)
    expect(found[0].enclosing).toBe('lookupIt')
  })

  it('detector finds a caller in a REAL FILE it walks (end-to-end positive control)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ae14-lookup-census-probe-'))
    const probe = join(dir, 'probe.ts')
    let foundInProbe: Ref[] = []
    let filesSeen = 0
    try {
      writeFileSync(
        probe,
        `export async function unbudgetedLookup(admin: Client, cred: string) {
           await admin.rpc('${DOOR}', { p_credential: cred, p_viewer: null })
         }`,
        'utf8',
      )
      filesSeen = walkFiles(dir).length
      foundInProbe = censusOf(walkFiles(dir).filter((f) => !IS_TEST.test(f)))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    expect(filesSeen).toBe(1)
    expect(foundInProbe.filter((r) => r.kind === 'rpc-call')).toHaveLength(1)
    expect(foundInProbe[0].enclosing).toBe('unbudgetedLookup')
    expect(() => statSync(probe)).toThrow()
  })

  it('detector ignores a comment-only mention', () => {
    const found = analyse(
      'fixture.ts',
      `export function nothingToSeeHere() {
         // ${DOOR} is named here and never called.
         /* nor here: ${DOOR} */
         return 1
       }`,
    )
    expect(found).toHaveLength(0)
  })

  it('⛔ THE PIN: the door has exactly ONE caller, and it is the budgeted wrapper', () => {
    expect(render(callSites)).toBe(`${WRAPPER_FILE} :: ${WRAPPER_FN} [rpc-call]`)
  })

  it('the two detector layers agree — no indirection is hiding a call site', () => {
    const stringRefs = census.filter((r) => r.kind === 'string-ref')
    expect(render(stringRefs)).toBe('(none)')
    expect(census).toHaveLength(callSites.length)
  })

  it('⛔ THE PIN: inside the wrapper, the rate budget is consumed BEFORE the RPC fires', () => {
    // Textual ordering inside the one census'd wrapper, with the slice guarded
    // (an indexOf miss yields -1 and would silently compare against the whole
    // file — the FUP-DM5-BYTE-PROOF lesson).
    const text = readFileSync(join(REPO, WRAPPER_FILE), 'utf8')
    const fnStart = text.indexOf(`export async function ${WRAPPER_FN}`)
    expect(fnStart).toBeGreaterThan(-1)
    const body = text.slice(fnStart)

    const budgetAt = body.indexOf(`${BUDGET_FN}(`)
    const rpcAt = body.indexOf(`.rpc('${DOOR}'`)
    expect(budgetAt).toBeGreaterThan(-1)
    expect(rpcAt).toBeGreaterThan(-1)
    expect(budgetAt).toBeLessThan(rpcAt)
    // And the budget call is real code in this function, not a mention in a
    // comment: the line it sits on must not be a comment line.
    const lineStart = body.lastIndexOf('\n', budgetAt) + 1
    const line = body.slice(lineStart, body.indexOf('\n', budgetAt)).trim()
    expect(line.startsWith('//')).toBe(false)
    expect(line.startsWith('*')).toBe(false)
  })

  it('census excludes test files, and that exclusion is load-bearing', () => {
    const excluded = allFiles.filter((f) => IS_TEST.test(f))
    expect(excluded.length).toBeGreaterThan(0)
    expect(allFiles.length - excluded.length).toBe(productionFiles.length)
    expect(excluded.map((f) => relative(REPO, f).split('\\').join('/'))).toContain(
      'src/lib/queries/printed-documents-caller-census.test.ts',
    )
  })
})
