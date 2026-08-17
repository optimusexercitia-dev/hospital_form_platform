/**
 * ============================================================================
 * DM5 S5.D — the PHI-disposal completion gap, TypeScript half.
 *
 * ⛔ READ THE POLARITY FIRST. This file asserts that something DOES NOT EXIST,
 * which reads backwards. It says:
 *
 *    ⭐ `complete_document_disposal` — the ONLY door that can move a
 *       `file_objects` row out of `disposal_state = 'disposal_pending'` — has
 *       exactly ONE caller in this repository, and it is NOT the disposition
 *       path. It is `reclassifyDocument`, an unrelated copy-then-retire lane.
 *       Nothing completes a disposal requested by
 *       `request_document_disposition` / `dispose_case_phi` /
 *       `dispose_referral_phi`. The PHI bytes stay on the substrate until a
 *       human runs docs/deployment/phi-disposal-runbook.md by hand.
 *
 * ⛔ A FAILURE HERE IS (PROBABLY) GOOD NEWS — someone built the automated
 * completion path. The correct response is NOT to relax the assertion. It is to
 * delete this file, delete supabase/tests/343_dm5_s5_disposal_gap.sql, correct
 * the comment above `requestDocumentDisposition` in ./actions.ts, and retire
 * docs/deployment/phi-disposal-runbook.md + FUP-DM5-DISPOSAL-JOB, all of which
 * describe a manual mitigation that would then be obsolete and misleading.
 *
 * ## Why BOTH halves exist (neither is sufficient)
 *
 * The pgTAP keystone proves no in-database caller, trigger, or scheduled job
 * reaches the door — and pgTAP cannot see `src/`. But the completion job would
 * MOST PLAUSIBLY be built right here: a server action or a route handler with
 * service-role reach, which is precisely what the door's ACL
 * (`service_role`/`postgres`, never `authenticated`) was shaped for. That
 * implementation would leave the catalog untouched and the pgTAP file green.
 * Conversely a `pg_cron`/trigger implementation is invisible to this file.
 *
 * ## Vacuity discipline — the detector is proven able to find something IN
 * ## EVERY RUN, not once at authoring time
 *
 * "No caller exists" is green when no caller exists AND green when the detector
 * is broken, the file walk returns nothing, or the AST parse silently mangles.
 * So:
 *   - `finds a caller in an in-memory fixture`  → the analyser works.
 *   - `finds a caller in a REAL FILE it walks`  → writes a probe module into a
 *     temp directory, runs the same walk+analyse over it, asserts it is found,
 *     deletes it, and asserts it is gone. Covers the walk, not just the parse.
 *   - `the census reads a real, non-trivial file set` → anchors the denominator,
 *     so a walk that silently returns [] cannot pass as "no callers".
 *   - `ignores a comment-only mention` — twice: an in-memory fixture AND the
 *     LIVE instance in ./actions.ts, whose corrected comment now names the door
 *     in prose. Without comment-immunity that correction would itself have
 *     turned this pin red.
 *
 * ## Red-first, as ACTUALLY OBSERVED (2026-08-17)
 *
 * The in-run positive controls prove the DETECTOR can find a caller. They do not
 * prove THE PIN goes red, so that was measured separately against a real
 * mutation of the real tree:
 *   1. wrote `src/lib/documents/redfirst-probe-tmp.ts` containing
 *      `admin.rpc('<door>', …)` inside `scheduledDisposalSweep` — i.e. the most
 *      plausible shape of the job that does not exist;
 *   2. ran this file: exit 1, `Tests 1 failed | 9 passed`, and the failing
 *      assertion was THE GAP, reporting
 *      `+ src/lib/documents/redfirst-probe-tmp.ts :: scheduledDisposalSweep
 *      [rpc-call]` — the red NAMED the file and the function;
 *   3. deleted the probe, verified it gone, re-ran: 10/10, exit 0.
 * A pin that has never been seen failing is a pin nobody has tested.
 *
 * ADR 0120 · FUP-DM5-DISPOSAL-JOB · Rule 12 (LGPD / ANVISA-RDC / CFM 1821).
 * ============================================================================
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * ⚠ Assembled from fragments ON PURPOSE. Written as one literal, this constant
 * would make THIS FILE a match for its own detector — the exact self-detection
 * defect that made the sibling pgTAP keystone red on its first run (its pg_temp
 * helper functions carried the door's name in their own bodies). Test files are
 * excluded from the census below anyway, so this is belt-and-braces; it is here
 * so the same trap cannot reappear if that exclusion is ever narrowed.
 */
const DOOR = ['complete', 'document', 'disposal'].join('_')

/**
 * ⚠ `process.cwd()`, not `import.meta.url`: under vitest's jsdom environment
 * `import.meta.url` is not a `file:` URL and `fileURLToPath` throws ("The URL
 * must be of scheme file"). Measured, not guessed — the first version of this
 * file failed to import for that reason.
 *
 * A root resolved from cwd is only as good as the cwd, and a WRONG root would
 * make the walk return [] and every "no caller" assertion vacuously green. So
 * the root is asserted at module load, loudly, before any census runs.
 */
const REPO = process.cwd()
for (const sentinel of ['package.json', 'ARCHITECTURE.md', 'src/lib/documents/actions.ts']) {
  try {
    statSync(join(REPO, sentinel))
  } catch {
    throw new Error(
      `disposal-gap.test.ts: cwd "${REPO}" is not the repo root (missing ${sentinel}). ` +
        'Refusing to run — a wrong root would make every assertion in this file vacuously green.',
    )
  }
}

/**
 * Census roots. `src/` is where a server action or route handler would live;
 * `scripts/` is where an operational completion script would live (and the
 * runbook deliberately does NOT ship one — if a script appears here, that is a
 * change of mechanism this pin should surface).
 */
const ROOTS = ['src', 'scripts']
const CODE = /\.(m?[jt]sx?|c[jt]s)$/
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git'])
/**
 * Tests and specs are excluded: a test is not a disposal job. This is the ONE
 * exclusion, it is principled rather than convenient, and its cost is stated —
 * a caller written inside a test file is invisible here. `census excludes test
 * files, and that exclusion is load-bearing` pins that it is doing real work
 * rather than quietly swallowing the production surface.
 */
const IS_TEST = /\.(test|spec)\.[cm]?[jt]sx?$/

type Ref = {
  /** Repo-relative, forward-slashed, so assertions read the same on Windows. */
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

/** Nearest named function/method enclosing a node, for a locatable report. */
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
 * Two layers, deliberately — the enumeration boundary is a PROPERTY, not a
 * syntax:
 *   - `rpc-call`   : `x.rpc('<door>', …)`, the shape every real call site uses.
 *   - `string-ref` : ANY string literal equal to the door name, a strict
 *                    SUPERSET of the above.
 * A future indirection (`const FN = '<door>'; admin.rpc(FN)`) is invisible to
 * layer 1 and caught by layer 2, so `the two layers agree` below is what keeps
 * the narrow detector honest instead of quietly going blind.
 *
 * Comments are not AST nodes, so comment-immunity is structural here rather
 * than a regex that has to be kept correct.
 */
function analyse(fileName: string, text: string): Ref[] {
  // ScriptKind must follow the extension: createSourceFile does NOT throw on a
  // syntax error, it returns a best-effort tree — so a .tsx parsed as TS yields
  // a silently mangled AST and confident nonsense. Asserted, not assumed.
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind)
  // `parseDiagnostics` is an INTERNAL TypeScript API, absent from the public
  // `SourceFile` type — hence the narrow cast (not `any`: the shape is spelled
  // out, so a future API change is a type error rather than silent `undefined`).
  // It is used because `createSourceFile` does not throw on malformed input, so
  // this is the only way to know the parse succeeded rather than degraded. The
  // sibling gate `scripts/check-vacuous-assertions.mjs` relies on the same field
  // and is a `.mjs`, which is why it never needed the cast.
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

/** Rendered into failure messages so a red NAMES what broke it. */
const render = (refs: Ref[]): string =>
  refs.map((r) => `${r.file} :: ${r.enclosing} [${r.kind}]`).join('\n') || '(none)'

describe('DM5 S5.D — the disposal-completion gap (TS half)', () => {
  it('census reads a real, non-trivial file set (denominator anchor)', () => {
    // A walk that silently returned [] would make every assertion below
    // vacuously green. Anchor it on volume AND on a named file that must be in
    // scope, so a broken root path cannot pass.
    expect(productionFiles.length).toBeGreaterThan(200)
    expect(productionFiles.map((f) => relative(REPO, f).split('\\').join('/'))).toContain(
      'src/lib/documents/actions.ts',
    )
  })

  it('detector finds a caller in an in-memory fixture (analyser positive control)', () => {
    const found = analyse(
      'fixture.ts',
      `export async function completeIt(admin: Client, id: string) {
         await admin.rpc('${DOOR}', { p_file_object_id: id })
       }`,
    )
    expect(found.filter((r) => r.kind === 'rpc-call')).toHaveLength(1)
    expect(found[0].enclosing).toBe('completeIt')
  })

  it('detector finds a caller in a REAL FILE it walks (end-to-end positive control)', () => {
    // The analyser control above cannot fail if the WALK is broken. This one
    // exercises walk → read → analyse against a genuine file on disk, in a temp
    // directory so nothing is ever written into src/ (a probe left behind by a
    // crashed run would break typecheck for everyone).
    const dir = mkdtempSync(join(tmpdir(), 'dm5-s5-disposal-probe-'))
    const probe = join(dir, 'probe.ts')
    let foundInProbe: Ref[] = []
    let filesSeen = 0
    try {
      writeFileSync(
        probe,
        `export async function scheduledDisposalJob(admin: Client, id: string) {
           await admin.rpc('${DOOR}', { p_file_object_id: id })
         }`,
        'utf8',
      )
      filesSeen = walkFiles(dir).length
      foundInProbe = censusOf(walkFiles(dir).filter((f) => !IS_TEST.test(f)))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    // Asserted OUTSIDE the try/finally so no cleanup path can skip them.
    expect(filesSeen).toBe(1)
    expect(foundInProbe.filter((r) => r.kind === 'rpc-call')).toHaveLength(1)
    expect(foundInProbe[0].enclosing).toBe('scheduledDisposalJob')
    expect(() => statSync(probe)).toThrow()
  })

  it('detector ignores a comment-only mention (in-memory)', () => {
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

  it('detector ignores the LIVE comment-only mention in actions.ts', () => {
    // The corrected comment above requestDocumentDisposition names the door in
    // prose. This is the live twin of the pgTAP keystone's K3b, and it pins that
    // correcting a comment cannot turn this pin red.
    const path = join(REPO, 'src/lib/documents/actions.ts')
    const text = readFileSync(path, 'utf8')
    const textualMentions = text.split(DOOR).length - 1
    const inFile = census.filter((r) => r.file === 'src/lib/documents/actions.ts')
    expect(textualMentions).toBeGreaterThan(1)
    expect(inFile).toHaveLength(1)
    expect(inFile[0].kind).toBe('rpc-call')
  })

  it('census excludes test files, and that exclusion is load-bearing', () => {
    // This very file names the door (assembled, but the exclusion must not be
    // trusted to a coincidence). Pin that test files ARE excluded and that the
    // excluded set is small and real, so the exclusion cannot silently widen
    // into "and also most of src/".
    const excluded = allFiles.filter((f) => IS_TEST.test(f))
    expect(excluded.length).toBeGreaterThan(0)
    expect(allFiles.length - excluded.length).toBe(productionFiles.length)
    expect(excluded.map((f) => relative(REPO, f).split('\\').join('/'))).toContain(
      'src/lib/documents/disposal-gap.test.ts',
    )
  })

  it('⛔ THE GAP: the completion door has exactly ONE caller, and it is reclassifyDocument', () => {
    expect(render(callSites)).toBe(
      'src/lib/documents/actions.ts :: reclassifyDocument [rpc-call]',
    )
  })

  it('⛔ THE GAP: no caller sits on the disposition path', () => {
    // The named-negative half. `requestDocumentDisposition` is the function a
    // coordinator's request actually enters; nothing in it, or in any
    // dispose_*_phi wrapper, reaches the completion door. Asserting the absence
    // of these NAMES (rather than only the total) means a second call site added
    // to the disposition path is reported as such, not merely as "2 ≠ 1".
    //
    // ⛔ `/dispos/i`, NOT `/dispose/i` — QA MINOR-1 caught this by measurement.
    // `/dispose/` does not match `Disposal`, and QA's red-first probe was named
    // `scheduledDisposalSweep` — the single most plausible name a disposal job
    // would carry, and the same name the record's own probe used. So this arm
    // stayed GREEN through the exact mutation it advertises catching, while only
    // the total-count assertion reddened. The property was still caught, by the
    // other assertion; the arm was not doing its stated job.
    // ⭐ That is *the enumeration boundary is a syntax, not a property* — in the
    // file that pins that class. `/dispos/i` covers dispose/disposal/disposition.
    const onDispositionPath = callSites.filter((r) => /dispos/i.test(r.enclosing))
    expect(render(onDispositionPath)).toBe('(none)')
  })

  it('the two detector layers agree — no indirection is hiding a call site', () => {
    // If someone routes the name through a constant, layer 1 goes blind and
    // layer 2 does not. Any string-ref outside a `.rpc()` first argument is a
    // signal to look, not a failure of the property itself — so it is asserted
    // separately and reported by name.
    const stringRefs = census.filter((r) => r.kind === 'string-ref')
    expect(render(stringRefs)).toBe('(none)')
    expect(census).toHaveLength(callSites.length)
  })

  it('nothing schedules the completion door from this layer', () => {
    // The weak half, and it is labelled weak on purpose: there is no scheduler
    // to enumerate (no pg_cron, no CI cron, no sidecar — see the pgTAP K6
    // assertions, which own this property). What CAN be checked here is that no
    // production module pairs a timer/cron construct with the door in one file.
    const suspicious = productionFiles.filter((f) => {
      const text = readFileSync(f, 'utf8')
      return text.includes(DOOR) && /setInterval|node-cron|cron\.schedule|CronJob/.test(text)
    })
    expect(suspicious.map((f) => relative(REPO, f).split('\\').join('/'))).toEqual([])
  })
})
