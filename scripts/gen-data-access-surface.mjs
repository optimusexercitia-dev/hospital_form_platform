#!/usr/bin/env node
/**
 * GENERATE the data-access surface: four seam files in `docs/backend-state/` derived from
 * the LIVE CATALOG and from `src/`, plus the pgTAP mirror that pins the catalog halves.
 *
 *   node scripts/gen-data-access-surface.mjs              # write   (needs the local stack)
 *   node scripts/gen-data-access-surface.mjs --check      # verify  (needs the local stack)
 *   node scripts/gen-data-access-surface.mjs --self-test  # prove the deriver can FAIL
 *
 * Exit: 0 clean | 1 drift or a failed self-test arm | 2 the generator itself cannot run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `docs/backend-state/README.md` routes a reader to `data-access.md` to "look up an RPC, a
 * helper function, a feature flag, or the `src/lib/queries/` module that owns a query
 * (Rule 9)". Measured 2026-09-09 against the live catalog and the tree:
 *
 *   · 533 non-trigger `public` functions exist; 169 appear anywhere in that file.
 *   ·  42 typed `FeatureFlags` fields exist;     18 appear nowhere in it.
 *   · 109 query/action modules exist on disk;    36 are unnamed.
 *
 * ⭐ That is the shape this project keeps re-finding: a designated authority whose callers
 * are told it is authoritative, and which answers a third of the questions put to it. It
 * is not fixed by writing the missing rows -- 183 commits of discipline produced the
 * 742 KB predecessor. ADR 0196 § Considered options option 4 already ruled that generation
 * is the right answer FOR THE REGISTRIES and called extending the derive-and-compare pair
 * "follow-on work". This is that follow-on.
 *
 * ⛔ WHAT IS *NOT* GENERATED, and must survive untouched: the explanations, invariants and
 * exceptional behaviour in `data-access.md` -- § Helper functions' prose (the three-hop
 * `commission_of_template_*` family, `confidentiality_rank`'s "do NOT re-order it",
 * `can_read_case_or_admin`'s "ORing the admin arm OUTSIDE the DEFINER out-votes the m2
 * deny"), § Data-access & action modules' module-split reasoning, and every § Feature
 * flags note about which flip migration was pushed. A catalog knows a function's ACL; it
 * does not know that re-ordering an enum would open legal-privileged documents. Those
 * sections stay FROZEN and posted (ADR 0196 D5) with a forward marker; this generator
 * takes over only the part a machine can derive, which is exactly the part that rotted.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE TWO-HALF SPLIT, AND WHY IT IS NOT AN ESCAPE HATCH
 *
 * Every gate in the `lint` chain is a pure text comparison over committed files; a gate
 * that needs Docker cannot be a lint gate here (`check-budget-anchor.mjs` header states
 * the doctrine, and gate 15 lives by it). So the claim "the doc matches the catalog" is
 * gated in two composable halves, neither of which needs the other's environment:
 *
 *   doc == pin     -- gate 17 (`check-data-access-registry.mjs`), TEXT ONLY, in `lint`
 *   pin == catalog -- `supabase/tests/400_data_access_census.sql`, LIVE, in `test:db`
 *
 * ⛔ Read those as a pair. Gate 17 alone proves nothing about the catalog, and it says so
 * in its own output rather than letting a green read as coverage. The pgTAP half alone
 * proves nothing about the doc.
 *
 * ⚠ The SOURCE-derived halves (typed flag fields, flag readers, module ownership) need no
 * database at all, so gate 17 recomputes those EXACTLY and does not depend on the pin.
 * Partitioned deliberately: what gate 17 can prove, it proves; what it cannot, it names.
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ⛔ Script-relative, never `process.cwd()`. The idiom is `check-budget-anchor.mjs:125` /
// `check-backend-state.mjs:74`; the two cwd-relative scripts (`service-role-dml-census`,
// `check-service-role-registry`) are the ones ADR 0196 filed a follow-up against.
export const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')

export const DIR_REL = 'docs/backend-state'
const DIR = join(REPO_ROOT, 'docs', 'backend-state')
const CENSUS_SQL = join(REPO_ROOT, 'scripts', 'data-access-census.sql')
const PGTAP_REL = 'supabase/tests/400_data_access_census.sql'
const PGTAP = join(REPO_ROOT, 'supabase', 'tests', '400_data_access_census.sql')
const FLAGS_TS_REL = 'src/lib/queries/feature-flags.ts'

/** The four generated seam files, by anchor `kind`. Order is the write order. */
export const OUTPUTS = [
  { kind: 'rpc', name: 'generated-rpc-surface.md' },
  { kind: 'helper', name: 'generated-helper-surface.md' },
  { kind: 'flags', name: 'generated-feature-flags.md' },
  { kind: 'modules', name: 'generated-query-modules.md' },
]

/** ⛔ FIRST, always -- copied verbatim from `check-backend-state.mjs`, deliberately not
 *  shared: `.gitattributes` pins `*.md` to LF, but a gate depending on that reds on a
 *  checkout somebody configured differently. */
export function normalise(raw) {
  return String(raw).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function md5(s) {
  return createHash('md5').update(s, 'utf8').digest('hex')
}

/**
 * ⛔ BYTE ORDER, NOT LOCALE ORDER. The digest is recomputed in SQL by the pgTAP mirror as
 * `md5(string_agg(l, chr(10) order by l collate "C"))`, so the JS side must sort the same
 * way or the two halves disagree while each is internally consistent.
 *
 * ⚠ MEASURED, on the mirror's first run: sorting with `String.localeCompare` produced
 * matching ROW COUNTS and MISMATCHED DIGESTS for both function surfaces. The generator
 * looked entirely correct on its own and the pgTAP suite looked entirely broken; neither
 * could have found it alone. That is the whole reason the mirror is a second independent
 * instrument rather than a restatement — `collate "C"` on one side and `Buffer.compare` on
 * the other make them agree about the SAME fact instead of agreeing by construction.
 */
export function byteOrder(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

/** The canonical digest: census lines joined by LF, in byte order. */
export function digestOf(lines) {
  return md5([...lines].sort(byteOrder).join('\n'))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The shared preamble -- read, never embedded
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Gate 16 check A demands every seam file's preamble be BYTE-IDENTICAL. A generator
 * holding its own copy would be the twelfth home of a rule that already has eleven, and
 * the one that silently stops matching when a human edits the others.
 *
 * ⛔ So it is READ from the existing hand-written seam files, and we refuse to guess when
 * they disagree: that is gate 16's finding to report, not this generator's to paper over.
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

export function sharedPreamble(dir = DIR, generated = OUTPUTS.map((o) => o.name)) {
  const skip = new Set(['README.md', 'stamp-history.md', ...generated])
  const seams = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !skip.has(f))
    .sort()
  const seen = new Map()
  for (const f of seams) {
    const p = preambleOf(readFileSync(join(dir, f), 'utf8'))
    if (p === null) continue
    seen.set(p, [...(seen.get(p) ?? []), f])
  }
  if (seen.size === 0) throw new Error(`no seam file in ${DIR_REL}/ carries a preamble`)
  if (seen.size > 1) {
    const groups = [...seen.values()].map((g) => g.join(','))
    throw new Error(
      `the shared preamble is not identical across ${DIR_REL}/ (${groups.join(' | ')}). ` +
        `Gate 16 check A reports this; fix it there, then regenerate.`,
    )
  }
  return [...seen.keys()][0]
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The catalog half -- docker exec psql, the only connection idiom this repo has
// ═══════════════════════════════════════════════════════════════════════════════════════

/** ⛔ The two row expressions live in `data-access-census.sql` and are extracted BY TEXT,
 *  so the pgTAP mirror cannot drift from the census. Gate 17 re-runs this extraction and
 *  compares -- without a database. */
export function extractSqlBlock(sqlText, name) {
  const t = normalise(sqlText)
  const begin = `-- >>> BEGIN ${name} <<<`
  const end = `-- >>> END ${name} <<<`
  const a = t.indexOf(begin)
  const b = t.indexOf(end)
  if (a < 0 || b < 0 || b < a) {
    throw new Error(`data-access-census.sql: no ${begin} … ${end} block`)
  }
  return t.slice(a + begin.length, b).trim()
}

function dbContainer() {
  // Discovery, not a hard-coded name: `storage-manifest.mjs:1550` is the precedent.
  // ⚠ Filtered to THIS project's ref when we can see it -- another Supabase stack
  // (`supabase_db_escalume` was running while this was written) would otherwise be
  // censused instead, and a census of the wrong database is worse than none.
  const names = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) {
    throw new Error('no running supabase_db container — this generator needs the local stack')
  }
  let ref = null
  const cfg = join(REPO_ROOT, 'supabase', 'config.toml')
  if (existsSync(cfg)) {
    const m = normalise(readFileSync(cfg, 'utf8')).match(/^project_id\s*=\s*"([^"]+)"/m)
    if (m) ref = m[1]
  }
  const exact = ref ? names.find((n) => n === `supabase_db_${ref}`) : null
  if (exact) return exact
  if (names.length > 1) {
    throw new Error(
      `${names.length} supabase_db containers are running (${names.join(', ')}) and none ` +
        `matches this project's ref (${ref ?? 'unknown'}). Refusing to census an ambiguous stack.`,
    )
  }
  return names[0]
}

/** Runs the census file. ⛔ `ON_ERROR_STOP=1` always: without it psql skips a failing
 *  section and STILL EXITS 0, so the census silently narrows and every diff reads clean. */
export function runCensus() {
  const container = dbContainer()
  const sql = readFileSync(CENSUS_SQL, 'utf8')
  const out = execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  return parseCensus(out)
}

export function parseCensus(raw) {
  const lines = normalise(raw).split('\n').filter((l) => l.length > 0)
  const funcs = []
  const flags = []
  for (const l of lines) {
    if (l.startsWith('FUNC|')) {
      const [, schema, name, args, returns, security, volatility, kind, acl] = l.split('|')
      funcs.push({ line: l, schema, name, args, returns, security, volatility, kind, acl })
    } else if (l.startsWith('FLAG|')) {
      const p = l.split('|')
      flags.push({ line: l, key: p[1], local: p[2] === 'true', description: p.slice(3).join('|') })
    } else {
      throw new Error(`census emitted an unrecognised line: ${l.slice(0, 120)}`)
    }
  }
  // ⚠ A CENSUS WHOSE PARTS DO NOT SUM IS WRONG. An empty section is the failure this
  // catches: `ON_ERROR_STOP` guards a psql error, nothing guards a section that ran and
  // matched nothing.
  if (funcs.length === 0) throw new Error('census produced ZERO functions — refusing to generate')
  if (flags.length === 0) throw new Error('census produced ZERO feature flags — refusing to generate')
  if (funcs.length + flags.length !== lines.length) {
    throw new Error(`census parts do not sum: ${funcs.length}+${flags.length} != ${lines.length}`)
  }
  return { funcs, flags }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The source half -- no database, so gate 17 recomputes all of this exactly
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The `FeatureFlags` interface's own fields. `FeatureFlagKey = keyof FeatureFlags`, so
 *  this set is exactly what a caller may pass to `featureEnabled` without a cast. */
export function deriveTypedFlags(text) {
  const t = normalise(text)
  const start = t.indexOf('export interface FeatureFlags {')
  if (start < 0) throw new Error(`${FLAGS_TS_REL}: no \`export interface FeatureFlags {\``)
  const end = t.indexOf('\n}', start)
  if (end < 0) throw new Error(`${FLAGS_TS_REL}: the FeatureFlags interface is unterminated`)
  const body = t.slice(start, end)
  const keys = [...body.matchAll(/^ {2}([a-z0-9_]+): boolean$/gm)].map((m) => m[1])
  if (keys.length === 0) throw new Error(`${FLAGS_TS_REL}: FeatureFlags declares no boolean fields`)
  return [...new Set(keys)].sort()
}

const SRC_EXT = /\.tsx?$/
function walkSrc(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__fixtures__') continue
      walkSrc(p, acc)
    } else if (SRC_EXT.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      acc.push(p)
    }
  }
  return acc
}

/**
 * Every `featureEnabled('<key>')` / `featureEnabledServerOnly('<key>')` call site, and the
 * exported symbol that encloses it -- the flag's TYPED READER.
 *
 * ⚠ Attribution is "the nearest PRECEDING `export` of a value", which is a heuristic and is
 * labelled as one in the output. A call inside a non-exported helper is attributed to the
 * exported symbol above it, which over-reports reach; a file with no export above the call
 * yields `(module scope)`. Stated here because an unstated bound is the defect, not the
 * bound: this column tells you WHERE to look, and is not evidence of a call graph.
 */
export function deriveFlagReaders(root = REPO_ROOT) {
  const files = walkSrc(join(root, 'src'))
  const byKey = new Map()
  const CALL = /\bfeatureEnabled(?:ServerOnly)?\(\s*['"]([a-z0-9_]+)['"]\s*\)/g
  const EXPORT = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/
  for (const f of files) {
    const text = normalise(readFileSync(f, 'utf8'))
    if (!text.includes('featureEnabled')) continue
    const lines = text.split('\n')
    const rel = relative(root, f).replace(/\\/g, '/')
    lines.forEach((line, i) => {
      CALL.lastIndex = 0
      let m
      while ((m = CALL.exec(line)) !== null) {
        const key = m[1]
        let owner = '(module scope)'
        for (let j = i; j >= 0; j -= 1) {
          const e = lines[j].match(EXPORT)
          if (e) {
            owner = e[1]
            break
          }
        }
        if (!byKey.has(key)) byKey.set(key, new Set())
        byKey.get(key).add(`${rel}:${owner}`)
      }
    })
  }
  return new Map([...byKey].map(([k, v]) => [k, [...v].sort()]))
}

/**
 * The Rule-9 module population: `src/lib/queries/*.ts` plus every action module. The
 * population is a DIRECTORY WALK bound to the naming property, never a hand-list -- ADR
 * 0196 D7's rule, because a guard enumerating a list somebody must remember to update has
 * a hole shaped like forgetting.
 */
export function deriveModules(root = REPO_ROOT) {
  const libDir = join(root, 'src', 'lib')
  const rows = []
  const isTest = (n) => /\.test\.tsx?$/.test(n)

  const qDir = join(libDir, 'queries')
  if (existsSync(qDir)) {
    for (const n of readdirSync(qDir).sort()) {
      if (!n.endsWith('.ts') || isTest(n)) continue
      if (!statSync(join(qDir, n)).isFile()) continue
      rows.push({ kind: 'query', path: `src/lib/queries/${n}` })
    }
  }
  for (const d of readdirSync(libDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name === 'queries') continue
    for (const n of readdirSync(join(libDir, d.name)).sort()) {
      if (!n.endsWith('.ts') || isTest(n)) continue
      if (!(n === 'actions.ts' || n.endsWith('-actions.ts'))) continue
      rows.push({ kind: 'action', path: `src/lib/${d.name}/${n}` })
    }
  }
  // Action modules living beside the query layer (`src/lib/queries/*-actions.ts`) would be
  // classified `query` by the first pass; re-key them so the two kinds partition cleanly.
  for (const r of rows) {
    if (r.kind === 'query' && /-actions\.ts$/.test(r.path)) r.kind = 'action'
  }

  const EXPORT_DECL = /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm
  const EXPORT_LIST = /^export\s*\{([^}]*)\}/gm
  const TYPE_DECL = /^export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/gm
  for (const r of rows) {
    const text = normalise(readFileSync(join(root, r.path), 'utf8'))
    const vals = new Set()
    for (const m of text.matchAll(EXPORT_DECL)) vals.add(m[1])
    for (const m of text.matchAll(EXPORT_LIST)) {
      for (const part of m[1].split(',')) {
        const sym = part.trim().split(/\s+as\s+/).pop().trim()
        if (/^[A-Za-z0-9_$]+$/.test(sym) && sym !== 'type') vals.add(sym)
      }
    }
    r.exports = [...vals].sort()
    r.types = new Set([...text.matchAll(TYPE_DECL)].map((m) => m[1])).size
  }
  rows.sort((a, b) => byteOrder(a.path, b.path))
  return rows
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Anchors -- the machine-readable figures gate 17 and pgTAP both key on (ADR 0195 shape)
// ═══════════════════════════════════════════════════════════════════════════════════════

export const ANCHOR_RE = /^[ \t]*<!--[ \t]*DATA-ACCESS-ANCHOR\b([^>]*?)-->[ \t]*$/gm

export function parseAnchors(text) {
  const out = []
  const re = new RegExp(ANCHOR_RE.source, 'gm')
  let m
  while ((m = re.exec(normalise(text))) !== null) {
    const kv = {}
    for (const pair of m[1].trim().split(/\s+/).filter(Boolean)) {
      const i = pair.indexOf('=')
      if (i < 0) return { error: `malformed anchor token \`${pair}\`` }
      kv[pair.slice(0, i)] = pair.slice(i + 1)
    }
    out.push(kv)
  }
  return { anchors: out }
}

function anchorLine(kv) {
  return `<!-- DATA-ACCESS-ANCHOR ${Object.entries(kv).map(([k, v]) => `${k}=${v}`).join(' ')} -->`
}

/** Data rows of the file's ONE registry table: a pipe row that is neither the header nor
 *  the `---` separator. Used by gate 17 to prove `rows=` is the truth about this file. */
export function countTableRows(text) {
  let n = 0
  for (const line of normalise(text).split('\n')) {
    if (!line.startsWith('| ')) continue
    if (/^\|[\s:|-]+\|$/.test(line)) continue
    if (/^\| (Function|Flag|Module) \|/.test(line)) continue
    n += 1
  }
  return n
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Renderers
// ═══════════════════════════════════════════════════════════════════════════════════════

const cell = (s) => String(s).replace(/\|/g, '\\|')
const code = (s) => (String(s).length ? `\`${String(s).replace(/\|/g, '\\|')}\`` : '—')

const GENERATED_BANNER = (script) =>
  `⚙ **GENERATED FILE — do not edit by hand.** Every row below is derived from the LIVE\n` +
  `CATALOG and from \`src/\` by \`scripts/${script}\`; rebuild with \`npm run data-access:surface\`.\n` +
  `\`npm run lint:data-access\` (gate 17) reds when this file and its pgTAP pin disagree, and\n` +
  `[\`${PGTAP_REL}\`](../../${PGTAP_REL}) reds when the pin and the catalog disagree.\n` +
  `⛔ A correction belongs in the GENERATOR or in the catalog, never in this file: an edit\n` +
  `here is erased by the next run and gated in the meantime.\n` +
  `\n` +
  `⛔ **This file carries facts, never judgements.** What a door is FOR, which of its arms is\n` +
  `load-bearing, and whether a flag's flip migration was pushed to production all stay\n` +
  `handwritten in [\`data-access.md\`](data-access.md), which is frozen and posted (ADR 0196\n` +
  `D5). A catalog knows an ACL; it does not know that re-ordering an enum would open\n` +
  `legal-privileged documents.`

function header(title, preamble) {
  return `# Backend State — ${title}\n\n${preamble}\n`
}

export function renderFunctionSurface({ schema, title, funcs, preamble, script }) {
  const rows = funcs.filter((f) => f.schema === schema).sort((a, b) => byteOrder(a.line, b.line))
  const digest = digestOf(rows.map((r) => r.line))
  const kv = {
    kind: schema === 'public' ? 'rpc' : 'helper',
    schema,
    rows: rows.length,
    definer: rows.filter((r) => r.security === 'definer').length,
    invoker: rows.filter((r) => r.security === 'invoker').length,
    trigger: rows.filter((r) => r.kind === 'trigger').length,
    aclnull: rows.filter((r) => r.acl === '<NULL=PUBLIC>').length,
    digest,
  }
  const out = []
  out.push(header(title, preamble))
  out.push(anchorLine(kv))
  out.push('')
  out.push(GENERATED_BANNER(script))
  out.push('')
  out.push(
    `**${kv.rows} functions** in schema \`${schema}\` — ${kv.definer} \`SECURITY DEFINER\`, ` +
      `${kv.invoker} invoker, ${kv.trigger} trigger functions, ${kv.aclnull} with a NULL \`proacl\`.`,
  )
  out.push('')
  out.push(
    `⚠ **A NULL \`proacl\` is rendered \`<NULL=PUBLIC>\` and means PUBLIC MAY EXECUTE** — it is` +
      ` the default, not an absence of grants. Reading it as "no grants" inverts the fact` +
      ` (the same trap \`scripts/catalog-fingerprint.sql\` names). ⚠ **A \`definer\` row's gate` +
      ` REPLACES RLS**, so its EXECUTE list is the whole boundary: \`prosecdef\` belongs beside` +
      ` \`pg_policies\`, never read alone (ADR 0078, ADR 0079).`,
  )
  out.push('')
  out.push('## The generated function registry')
  out.push('')
  out.push('| Function | Args | Returns | Security | Volatility | EXECUTE |')
  out.push('| --- | --- | --- | --- | --- | --- |')
  for (const r of rows) {
    out.push(
      `| ${code(`${r.schema}.${r.name}`)}${r.kind === 'trigger' ? ' *(trigger)*' : ''} ` +
        `| ${code(r.args)} | ${code(r.returns)} | ${r.security === 'definer' ? '**definer**' : 'invoker'} ` +
        `| ${r.volatility} | ${code(r.acl)} |`,
    )
  }
  out.push('')
  return out.join('\n')
}

export function renderFeatureFlags({ flags, typed, readers, preamble, script }) {
  const rows = [...flags].sort((a, b) => byteOrder(a.line, b.line))
  const typedSet = new Set(typed)
  const liveSet = new Set(rows.map((r) => r.key))
  const untyped = rows.filter((r) => !typedSet.has(r.key)).map((r) => r.key)
  const dead = typed.filter((k) => !liveSet.has(k))
  const digest = digestOf(rows.map((r) => r.line))
  const kv = {
    kind: 'flags',
    rows: rows.length,
    typed: rows.filter((r) => typedSet.has(r.key)).length,
    untyped: untyped.length,
    dead: dead.length,
    digest,
  }
  const out = []
  out.push(header('the feature-flag surface (GENERATED)', preamble))
  out.push(anchorLine(kv))
  out.push('')
  out.push(GENERATED_BANNER(script))
  out.push('')
  out.push(
    `**${kv.rows} keys** in \`app.feature_flags\` — ${kv.typed} carry a \`FeatureFlags\` field, ` +
      `${kv.untyped} do not, and ${kv.dead} typed fields name no live key.`,
  )
  out.push('')
  out.push(
    `⛔ **THE \`local\` COLUMN IS NOT PRODUCTION.** \`supabase/seed.sql\` forces flags ON for` +
      ` local + E2E, and a flip that lives only in \`seed.sql\` is OFF in production until its` +
      ` own migration is pushed. Nothing asserts on this column — not gate 17, not the pgTAP` +
      ` mirror — because only a human knows whether the flip migration reached the remote.` +
      ` **The production claim stays handwritten** in [\`data-access.md\`](data-access.md)` +
      ` § Feature flags. Resolve a VALUE in \`app.feature_flags.enabled\` on the deployment you` +
      ` mean, never from this table and never from a comment.`,
  )
  out.push('')
  out.push(
    `⚠ **\`Typed readers\` is a nearest-preceding-export attribution, not a call graph.** It` +
      ` tells you where to look. A call inside a non-exported helper is attributed to the` +
      ` exported symbol above it, which over-reports reach.`,
  )
  out.push('')
  out.push('## The generated flag registry')
  out.push('')
  out.push('| Flag | `local` | `FeatureFlags` field | Typed readers | Description (from the catalog) |')
  out.push('| --- | --- | --- | --- | --- |')
  for (const r of rows) {
    const rd = readers.get(r.key) ?? []
    out.push(
      `| ${code(r.key)} | ${r.local ? '`true`' : '`false`'} ` +
        `| ${typedSet.has(r.key) ? '✅' : '⛔ **none**'} ` +
        `| ${rd.length ? rd.map((s) => code(s)).join('<br>') : '—'} ` +
        `| ${cell(r.description) || '—'} |`,
    )
  }
  out.push('')
  out.push('## Drift, both polarities')
  out.push('')
  out.push(
    `A one-directional check would report half of this. ⛔ **An untyped live key forces callers` +
      ` to cast** (\`"power_authoring" as FeatureFlagKey\` was in the tree when this generator` +
      ` was written); **a dead typed field** reads \`false\` for ever via the safe default, so` +
      ` nothing ever fails and nobody ever notices.`,
  )
  out.push('')
  out.push(`- Live keys with no \`FeatureFlags\` field (${untyped.length}): ` +
    (untyped.length ? untyped.map(code).join(', ') : '*none*'))
  out.push(`- \`FeatureFlags\` fields naming no live key (${dead.length}): ` +
    (dead.length ? dead.map(code).join(', ') : '*none*'))
  out.push('')
  return out.join('\n')
}

export function renderQueryModules({ modules, preamble, script }) {
  const rows = [...modules].sort((a, b) => byteOrder(a.path, b.path))
  const digest = digestOf(rows.map((r) => `${r.kind}|${r.path}|${r.exports.join(',')}`))
  const kv = {
    kind: 'modules',
    rows: rows.length,
    queries: rows.filter((r) => r.kind === 'query').length,
    actions: rows.filter((r) => r.kind === 'action').length,
    exports: rows.reduce((n, r) => n + r.exports.length, 0),
    digest,
  }
  const out = []
  out.push(header('the Rule-9 data-access module surface (GENERATED)', preamble))
  out.push(anchorLine(kv))
  out.push('')
  out.push(GENERATED_BANNER(script))
  out.push('')
  out.push(
    `**${kv.rows} modules** — ${kv.queries} under \`src/lib/queries/\`, ${kv.actions} action ` +
      `modules, ${kv.exports} exported value symbols between them.`,
  )
  out.push('')
  out.push(
    `Architecture Rule 9: data access goes through these modules — no inline supabase-js in` +
      ` UI. ⚠ **Presence here is not a Rule-9 audit.** This table answers "which module owns` +
      ` this query"; it does not claim every caller obeys the rule, and a module appearing` +
      ` here is not evidence that nothing bypasses it. The population is a DIRECTORY WALK` +
      ` bound to the naming property (\`src/lib/queries/*.ts\`, \`src/lib/*/actions.ts\`,` +
      ` \`*-actions.ts\`), never a hand-list — ADR 0196 D7.`,
  )
  out.push('')
  out.push('## The generated module registry')
  out.push('')
  out.push('| Module | Kind | Exported value symbols |')
  out.push('| --- | --- | --- |')
  for (const r of rows) {
    out.push(
      `| ${code(r.path)} | ${r.kind} | ${r.exports.length ? r.exports.map(code).join(' · ') : '—'} |`,
    )
  }
  out.push('')
  return out.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The pgTAP mirror -- the half gate 17 cannot prove
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⭐ THE MIRROR'S SHAPE IS LOAD-BEARING, and it is gate 15's (ADR 0195): each pinned
 * literal carries its key ON ITS OWN LINE, so gate 17 reads the ACTUAL pgTAP literal and
 * never a comment restating it. If the gate compared the doc's anchor against a COMMENT,
 * two comments could agree while the `is()` literal said something else entirely -- a
 * mirror that mirrors nothing.
 */
export function renderPgtap({ pins, funcRowSql, flagRowSql }) {
  const planCount = pins.length * 2
  return `-- 400_data_access_census — the LIVE half of the generated data-access surface.
--
-- ⚙ GENERATED by scripts/gen-data-access-surface.mjs. Rebuild with
--   npm run data-access:surface
-- ⛔ Do not hand-edit: gate 17 (\`npm run lint:data-access\`) compares the pins below
-- against the anchors in docs/backend-state/generated-*.md WITHOUT a database, and
-- compares the SQL spliced here against scripts/data-access-census.sql byte for byte.
--
-- WHAT THIS SUITE IS FOR, stated so a green is not over-read:
--   doc == pin      is gate 17's claim   (text only, in \`npm run lint\`)
--   pin == catalog  is THIS suite's claim (live, in \`npm run test:db\`)
-- Neither half alone says the doc matches the catalog. Together they do.
--
-- ⚠ WHEN THIS REDS AFTER A MIGRATION IT IS USUALLY RIGHT AND THE REMEDY IS ONE COMMAND:
-- \`npm run data-access:surface\`, then commit the regenerated files. That is the same
-- discipline Architecture Rule 8 already imposes for \`npm run gen:types\`.
-- ⛔ Never edit a pin to match a changed catalog without regenerating the doc: the pin and
-- the doc are two homes for one number, and un-syncing them is exactly what gate 17 exists
-- to catch.
--
-- ⚠ \`app.feature_flags.enabled\` IS NOT PINNED, on purpose. It is seeded ON locally and the
-- production value is a different fact; pinning it would red on every seed change while
-- proving nothing about the deployment anybody cares about.

begin;
select plan(${planCount});

create temporary table _dac_live (kind text, rows bigint, digest text);

-- ⛔ THE ROW EXPRESSION BELOW IS SPLICED, VERBATIM, FROM scripts/data-access-census.sql.
-- Gate 17 re-extracts it and compares byte for byte, so this copy cannot drift from the
-- census the documentation was generated with. Editing it here reds gate 17.
insert into _dac_live (kind, rows, digest)
select case when l like 'FUNC|public|%' then 'rpc' else 'helper' end,
       count(*),
       md5(string_agg(l, chr(10) order by l collate "C"))
from (
${funcRowSql.split('\n').map((l) => `  ${l}`).join('\n')}
) s(l)
group by 1;

insert into _dac_live (kind, rows, digest)
select 'flags', count(*), md5(string_agg(l, chr(10) order by l collate "C"))
from (
${flagRowSql.split('\n').map((l) => `  ${l}`).join('\n')}
) s(l);

-- The pins, generated from the same census that produced the documentation.
create temporary table _dac_pin (kind text, rows bigint, digest text);
insert into _dac_pin (kind, rows, digest) values
${pins.map((p) => `  ('${p.kind}', ${p.rows}, '${p.digest}')`).join(',\n')};

${pins
  .map(
    (p) => `select is(
  (select rows from _dac_live where kind = '${p.kind}'),
  (select rows from _dac_pin  where kind = '${p.kind}'),
  '${p.kind}: the live catalog holds the pinned number of rows — if this reds, run npm run data-access:surface'
);
select is(
  (select digest from _dac_live where kind = '${p.kind}'),
  (select digest from _dac_pin  where kind = '${p.kind}'),
  '${p.kind}: the live catalog digests to the pinned value — a rename, an ACL change or a prosecdef flip reds here even when the COUNT is unchanged'
);`,
  )
  .join('\n')}

select * from finish();
rollback;
`
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Build
// ═══════════════════════════════════════════════════════════════════════════════════════

/** ONE function builds every artefact, so `--check`, `--write` and the self-test can never
 *  disagree about what the correct output is (the `check-budget-anchor.mjs:170` lesson). */
export function build({ census, typed, readers, modules, preamble, sqlText }) {
  const script = 'gen-data-access-surface.mjs'
  const files = new Map()
  files.set(
    'generated-rpc-surface.md',
    renderFunctionSurface({
      schema: 'public',
      title: 'the `public` RPC surface (GENERATED)',
      funcs: census.funcs,
      preamble,
      script,
    }),
  )
  files.set(
    'generated-helper-surface.md',
    renderFunctionSurface({
      schema: 'app',
      title: 'the `app` helper surface (GENERATED)',
      funcs: census.funcs,
      preamble,
      script,
    }),
  )
  files.set(
    'generated-feature-flags.md',
    renderFeatureFlags({ flags: census.flags, typed, readers, preamble, script }),
  )
  files.set('generated-query-modules.md', renderQueryModules({ modules, preamble, script }))

  const pins = []
  for (const [name, text] of files) {
    const kind = OUTPUTS.find((o) => o.name === name).kind
    if (kind === 'modules') continue // source-derived: gate 17 recomputes it exactly, no pin needed
    const { anchors } = parseAnchors(text)
    pins.push({ kind, rows: Number(anchors[0].rows), digest: anchors[0].digest })
  }
  const pgtap = renderPgtap({
    pins,
    funcRowSql: extractSqlBlock(sqlText, 'FUNC_ROW'),
    flagRowSql: extractSqlBlock(sqlText, 'FLAG_ROW'),
  })
  return { files, pgtap, pins }
}

function collect() {
  const census = runCensus()
  const typed = deriveTypedFlags(readFileSync(join(REPO_ROOT, FLAGS_TS_REL), 'utf8'))
  const readers = deriveFlagReaders()
  const modules = deriveModules()
  const preamble = sharedPreamble()
  const sqlText = readFileSync(CENSUS_SQL, 'utf8')
  return build({ census, typed, readers, modules, preamble, sqlText })
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(selfTest())
  }

  let built
  try {
    built = collect()
  } catch (e) {
    console.error(`gen-data-access-surface: FAILED — ${e.message}`)
    process.exit(2)
  }

  const check = argv.includes('--check')
  const drift = []
  for (const [name, text] of built.files) {
    const p = join(DIR, name)
    const current = existsSync(p) ? normalise(readFileSync(p, 'utf8')) : null
    if (check) {
      if (current === null) drift.push(`${DIR_REL}/${name} — missing`)
      else if (current !== normalise(text)) drift.push(`${DIR_REL}/${name} — differs from the catalog`)
    } else if (current !== normalise(text)) {
      writeFileSync(p, text, 'utf8')
      console.log(`wrote ${DIR_REL}/${name}`)
    }
  }
  const pgtapCur = existsSync(PGTAP) ? normalise(readFileSync(PGTAP, 'utf8')) : null
  if (check) {
    if (pgtapCur === null) drift.push(`${PGTAP_REL} — missing`)
    else if (pgtapCur !== normalise(built.pgtap)) drift.push(`${PGTAP_REL} — differs from the catalog`)
  } else if (pgtapCur !== normalise(built.pgtap)) {
    writeFileSync(PGTAP, built.pgtap, 'utf8')
    console.log(`wrote ${PGTAP_REL}`)
  }

  if (check) {
    if (drift.length) {
      console.error(
        `gen-data-access-surface --check: DRIFT\n\n` +
          drift.map((d) => `  ⛔ ${d}`).join('\n') +
          `\n\n  Run \`npm run data-access:surface\` and commit the result.\n`,
      )
      process.exit(1)
    }
    console.log(
      `gen-data-access-surface --check: OK — ${built.files.size} generated files and the pgTAP ` +
        `pin agree with the live catalog (${built.pins.map((p) => `${p.kind}=${p.rows}`).join(', ')}).`,
    )
    return
  }
  console.log(
    `gen-data-access-surface: OK — ${built.pins.map((p) => `${p.kind}=${p.rows}`).join(', ')}. ` +
      `Now run \`npm run lint:data-access\` and \`npm run test:db\`.`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// --self-test: prove each DERIVER can fail, and that it stays silent on the real tree
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⛔ Fixtures only; the real tree is never mutated. `service-role-dml-census.mjs` mutates
 * `src/` in place and restores in a `finally` -- every later gate moved away from that, and
 * this one does not go back.
 *
 * ⛔ AND THE MUTATION MUST BE PROVEN TO HAVE APPLIED. A fixture byte-identical to its
 * baseline is counted BROKEN, not passing: a mutation that silently no-ops reports rc=0 and
 * reads exactly like a working arm (`check-budget-anchor.mjs:520`; LEARN-090).
 */
export function selfTest() {
  const bad = []
  let arms = 0
  const t = (label, cond) => {
    arms += 1
    if (!cond) bad.push(label)
  }
  /** Assert the mutation CHANGED the subject before asking whether it was caught. */
  const mutated = (label, before, after) => {
    arms += 1
    if (normalise(before) === normalise(after)) bad.push(`${label} — MUTATION DID NOT APPLY`)
    return normalise(before) !== normalise(after)
  }

  // ── parseCensus: the three-way partition, and the sum ──────────────────────────────
  const CENSUS_OK =
    'FUNC|public|a|p uuid|void|definer|volatile|function|authenticated=X/postgres\n' +
    'FUNC|app|b||boolean|invoker|immutable|function|<NULL=PUBLIC>\n' +
    'FLAG|x|true|desc\n'
  t('parseCensus accepts a well-formed census', parseCensus(CENSUS_OK).funcs.length === 2)
  t('parseCensus keeps the FLAG row', parseCensus(CENSUS_OK).flags.length === 1)
  t(
    'parseCensus REFUSES a census with zero functions (an empty section is not a clean run)',
    (() => {
      try {
        parseCensus('FLAG|x|true|d\n')
        return false
      } catch {
        return true
      }
    })(),
  )
  t(
    'parseCensus REFUSES a census with zero flags',
    (() => {
      try {
        parseCensus('FUNC|public|a||void|invoker|volatile|function|x\n')
        return false
      } catch {
        return true
      }
    })(),
  )
  t(
    'parseCensus REFUSES an unrecognised line rather than dropping it',
    (() => {
      try {
        parseCensus(CENSUS_OK + 'NOISE|whatever\n')
        return false
      } catch {
        return true
      }
    })(),
  )

  // ── deriveTypedFlags ──────────────────────────────────────────────────────────────
  const IFACE = 'export interface FeatureFlags {\n  alpha: boolean\n  beta: boolean\n}\n'
  t('deriveTypedFlags reads every boolean field', deriveTypedFlags(IFACE).join(',') === 'alpha,beta')
  const IFACE_LESS = IFACE.replace('  beta: boolean\n', '')
  if (mutated('deriveTypedFlags mutation (drop a field)', IFACE, IFACE_LESS)) {
    t('deriveTypedFlags NOTICES a dropped field', deriveTypedFlags(IFACE_LESS).join(',') === 'alpha')
  }
  t(
    'deriveTypedFlags REFUSES a file with no FeatureFlags interface',
    (() => {
      try {
        deriveTypedFlags('export const x = 1\n')
        return false
      } catch {
        return true
      }
    })(),
  )
  t(
    'deriveTypedFlags REFUSES an interface declaring no boolean field (vacuity)',
    (() => {
      try {
        deriveTypedFlags('export interface FeatureFlags {\n  note: string\n}\n')
        return false
      } catch {
        return true
      }
    })(),
  )
  t(
    'deriveTypedFlags does NOT pick up a nested or differently-indented field',
    deriveTypedFlags('export interface FeatureFlags {\n  a: boolean\n    b: boolean\n}\n').join(',') === 'a',
  )

  // ── extractSqlBlock ───────────────────────────────────────────────────────────────
  const SQLF = 'noise\n-- >>> BEGIN FUNC_ROW <<<\nselect 1\n-- >>> END FUNC_ROW <<<\nmore\n'
  t('extractSqlBlock returns exactly the marked block', extractSqlBlock(SQLF, 'FUNC_ROW') === 'select 1')
  const SQLF_BROKEN = SQLF.replace('-- >>> END FUNC_ROW <<<\n', '')
  if (mutated('extractSqlBlock mutation (drop the END marker)', SQLF, SQLF_BROKEN)) {
    t(
      'extractSqlBlock REFUSES an unterminated block rather than returning the rest of the file',
      (() => {
        try {
          extractSqlBlock(SQLF_BROKEN, 'FUNC_ROW')
          return false
        } catch {
          return true
        }
      })(),
    )
  }
  t(
    'extractSqlBlock REFUSES a block that is absent',
    (() => {
      try {
        extractSqlBlock(SQLF, 'NOPE')
        return false
      } catch {
        return true
      }
    })(),
  )

  // ── parseAnchors / countTableRows ─────────────────────────────────────────────────
  const DOC = '# T\n\n<!-- DATA-ACCESS-ANCHOR kind=rpc rows=2 digest=abc -->\n\n' +
    '| Function | Args |\n| --- | --- |\n| `a` | `x` |\n| `b` | `y` |\n'
  t('parseAnchors finds the anchor', parseAnchors(DOC).anchors.length === 1)
  t('parseAnchors reads every key', parseAnchors(DOC).anchors[0].digest === 'abc')
  t('parseAnchors reports a malformed token instead of dropping it', !!parseAnchors('<!-- DATA-ACCESS-ANCHOR bare -->').error)
  t('parseAnchors finds NO anchor in a file without one', parseAnchors('# T\n\nbody\n').anchors.length === 0)
  t('countTableRows counts data rows only', countTableRows(DOC) === 2)
  t('countTableRows ignores the header and the separator', countTableRows('| Function | A |\n| --- | --- |\n') === 0)
  const DOC_ROW = DOC + '| `c` | `z` |\n'
  if (mutated('countTableRows mutation (add a row)', DOC, DOC_ROW)) {
    t('countTableRows NOTICES an added row', countTableRows(DOC_ROW) === 3)
  }

  // ── preambleOf / sharedPreamble ───────────────────────────────────────────────────
  t('preambleOf returns the blockquote run after the H1', preambleOf('# T\n\n> a\n> b\n\nbody\n') === '> a\n> b')
  t('preambleOf returns null when there is no blockquote', preambleOf('# T\n\nbody\n') === null)
  t('preambleOf returns null when there is no H1', preambleOf('> a\n') === null)

  // ── deriveFlagReaders / deriveModules, on the REAL tree ───────────────────────────
  // ⛔ These two are DIRECTORY WALKS: a fixture cannot prove they walk the right tree, so
  // they are exercised against the real one and asserted non-empty. An empty walk is the
  // failure mode that reads exactly like "nothing to report".
  let readers = null
  let modules = null
  try {
    readers = deriveFlagReaders()
    modules = deriveModules()
  } catch (e) {
    bad.push(`the source derivers THREW on the real tree — ${e.message}`)
  }
  t('deriveFlagReaders finds call sites on the real tree (not an empty walk)', (readers?.size ?? 0) > 0)
  t('deriveModules finds modules on the real tree (not an empty walk)', (modules?.length ?? 0) > 0)
  t(
    'deriveModules partitions into query AND action kinds (both non-empty)',
    (modules ?? []).some((m) => m.kind === 'query') && (modules ?? []).some((m) => m.kind === 'action'),
  )
  t(
    'deriveModules excludes test files',
    !(modules ?? []).some((m) => /\.test\.tsx?$/.test(m.path)),
  )
  t(
    'deriveModules records exports for at least one module',
    (modules ?? []).some((m) => m.exports.length > 0),
  )

  // ── The renderers, and the anchor they emit ───────────────────────────────────────
  const FIXCENSUS = parseCensus(CENSUS_OK)
  const PRE = '> preamble\n'
  const rpc = renderFunctionSurface({ schema: 'public', title: 'x', funcs: FIXCENSUS.funcs, preamble: PRE, script: 's' })
  const rpcA = parseAnchors(rpc).anchors[0]
  t('renderFunctionSurface emits one anchor', parseAnchors(rpc).anchors.length === 1)
  t('the anchor rows figure equals the rendered table rows', Number(rpcA.rows) === countTableRows(rpc))
  t('the anchor partitions definer + invoker to the total', Number(rpcA.definer) + Number(rpcA.invoker) === Number(rpcA.rows))
  const flagsDoc = renderFeatureFlags({
    flags: FIXCENSUS.flags,
    typed: ['x', 'ghost'],
    readers: new Map([['x', ['src/a.ts:read']]]),
    preamble: PRE,
    script: 's',
  })
  const flagsA = parseAnchors(flagsDoc).anchors[0]
  t('renderFeatureFlags counts the DEAD typed field', Number(flagsA.dead) === 1)
  t('renderFeatureFlags counts the typed live key', Number(flagsA.typed) === 1)
  t('renderFeatureFlags rows equals the rendered table rows', Number(flagsA.rows) === countTableRows(flagsDoc))
  const flagsUntyped = renderFeatureFlags({
    flags: FIXCENSUS.flags,
    typed: [],
    readers: new Map(),
    preamble: PRE,
    script: 's',
  })
  t(
    'renderFeatureFlags counts an UNTYPED live key — the opposite polarity',
    Number(parseAnchors(flagsUntyped).anchors[0].untyped) === 1,
  )
  const mods = renderQueryModules({
    modules: [{ kind: 'query', path: 'src/lib/queries/a.ts', exports: ['f'], types: 0 }],
    preamble: PRE,
    script: 's',
  })
  t('renderQueryModules rows equals the rendered table rows', Number(parseAnchors(mods).anchors[0].rows) === countTableRows(mods))

  // ── The digest actually discriminates ─────────────────────────────────────────────
  const alt = parseCensus(CENSUS_OK.replace('|definer|', '|invoker|'))
  const rpcAlt = renderFunctionSurface({ schema: 'public', title: 'x', funcs: alt.funcs, preamble: PRE, script: 's' })
  if (mutated('digest mutation (flip prosecdef)', rpc, rpcAlt)) {
    t(
      'the digest CHANGES when prosecdef flips even though the ROW COUNT does not',
      parseAnchors(rpcAlt).anchors[0].digest !== rpcA.digest &&
        parseAnchors(rpcAlt).anchors[0].rows === rpcA.rows,
    )
  }
  const aclAlt = parseCensus(CENSUS_OK.replace('authenticated=X/postgres', '<NULL=PUBLIC>'))
  const rpcAcl = renderFunctionSurface({ schema: 'public', title: 'x', funcs: aclAlt.funcs, preamble: PRE, script: 's' })
  if (mutated('digest mutation (ACL widened to PUBLIC)', rpc, rpcAcl)) {
    t('the digest CHANGES when an ACL widens to PUBLIC', parseAnchors(rpcAcl).anchors[0].digest !== rpcA.digest)
    t('the aclnull count NOTICES the widened ACL', Number(parseAnchors(rpcAcl).anchors[0].aclnull) === 1)
  }

  // ── The pgTAP mirror ──────────────────────────────────────────────────────────────
  const pg = renderPgtap({
    pins: [{ kind: 'rpc', rows: 2, digest: 'abc' }],
    funcRowSql: 'select 1',
    flagRowSql: 'select 2',
  })
  t('renderPgtap pins the row count on its own line', /^\s*\('rpc', 2, 'abc'\)/m.test(pg))
  t('renderPgtap splices the FUNC expression', pg.includes('select 1'))
  t('renderPgtap splices the FLAG expression', pg.includes('select 2'))
  t('renderPgtap plans two assertions per pin', pg.includes('select plan(2);'))

  // ── ⛔ THE DISCRIMINATION CONTROL. Every arm above proves a deriver can NOTICE a
  //    change. An instrument that reports a change on everything is not a detector, so
  //    the unmutated real subject must come back CLEAN.
  let controlOk = false
  try {
    const typedReal = deriveTypedFlags(readFileSync(join(REPO_ROOT, FLAGS_TS_REL), 'utf8'))
    const preReal = sharedPreamble()
    const sqlReal = readFileSync(CENSUS_SQL, 'utf8')
    extractSqlBlock(sqlReal, 'FUNC_ROW')
    extractSqlBlock(sqlReal, 'FLAG_ROW')
    controlOk = typedReal.length > 0 && preReal.startsWith('>') && (modules?.length ?? 0) > 0
  } catch (e) {
    bad.push(`the REAL tree trips the derivers — ${e.message}`)
  }
  t('the REAL tree derives cleanly (discrimination control)', controlOk)

  // ── ⭐ A SECOND CONTROL, FOR THE WRITER HALF. The arms above prove the derivers can
  //    refuse; they say nothing about whether `build()` can run end to end. Building the
  //    real source halves against a FIXTURE census is what proves the two agree about
  //    which fields exist -- a renderer reading a key no deriver emits throws here.
  try {
    const built = build({
      census: FIXCENSUS,
      typed: deriveTypedFlags(readFileSync(join(REPO_ROOT, FLAGS_TS_REL), 'utf8')),
      readers: readers ?? new Map(),
      modules: modules ?? [],
      preamble: sharedPreamble(),
      sqlText: readFileSync(CENSUS_SQL, 'utf8'),
    })
    t('build() produces every declared output', built.files.size === OUTPUTS.length)
    t('build() pins every catalog-derived file and no source-derived one', built.pins.length === OUTPUTS.length - 1)
    console.log(
      `gen-data-access-surface --self-test: the builder ran on the real source halves ` +
        `(${built.files.size} files, ${built.pins.length} pins)`,
    )
  } catch (e) {
    bad.push(`build() FAILED on the real source halves — ${e.message}`)
    arms += 2
  }

  if (bad.length) {
    console.error(`gen-data-access-surface --self-test: FAILED (${bad.length}/${arms} arms)\n`)
    for (const b of bad) console.error(`  ⛔ ${b}`)
    console.error('')
    return 1
  }
  console.log(
    `gen-data-access-surface --self-test: OK (${arms} arms — every deriver proven able to ` +
      `notice a change AND to stay silent on the real tree; every mutation proven to have applied)`,
  )
  return 0
}

// ⛔ Run only when invoked as a script. Gate 17 IMPORTS the derivers from here, and until
// `check-backend-state.mjs` was fixed on 2026-09-09 its `main()` ran on import — observed
// for real. Not repeating it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main()
