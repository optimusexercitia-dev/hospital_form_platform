#!/usr/bin/env node
/**
 * GATE 17 — `npm run lint:data-access`.
 *
 * Exit: 0 clean | 1 a finding | 2 the checker itself cannot run.
 *
 *   node scripts/check-data-access-registry.mjs
 *   node scripts/check-data-access-registry.mjs --self-test
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `docs/backend-state/README.md` routes a reader to `data-access.md` to look up an RPC, a
 * helper, a feature flag, or the `src/lib/queries/` module that owns a query (Rule 9).
 * Measured 2026-09-09 against the live catalog and the tree: 169 of 533 non-trigger
 * `public` functions appeared in it, 24 of 42 typed `FeatureFlags` fields, 73 of 109
 * modules. ⭐ A designated authority answering a third of the questions put to it is this
 * project's most-repeated failure, and hand-writing the missing rows is what produced the
 * 742 KB predecessor. The registries are now GENERATED
 * (`scripts/gen-data-access-surface.mjs`); this gate is what keeps them true between
 * commits.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⛔ WHAT THIS GATE DOES **NOT** PROVE, STATED SO A GREEN IS NOT OVER-READ
 *
 * It never opens a database. Every gate in the `lint` chain is a text comparison over
 * committed files, because a gate needing Docker cannot run in the chain at all
 * (`check-budget-anchor.mjs` states the doctrine; gate 15 lives by it). So the claim
 * "the documentation matches the live catalog" is gated in two composable halves:
 *
 *   doc == pin      ← THIS GATE            (text only, `npm run lint`)
 *   pin == catalog  ← supabase/tests/400_data_access_census.sql  (live, `npm run test:db`)
 *
 * ⛔ A green here means the doc and the pin agree. It says NOTHING about whether either
 * matches the catalog — that verdict belongs to `npm run test:db`, and its ABSENCE is not
 * this gate's coverage. The summary line prints that bound every run rather than leaving a
 * reader to infer it.
 *
 * ⚠ The SOURCE-derived halves are different, and better: typed flag fields, flag readers
 * and Rule-9 module ownership come from `src/`, which this gate CAN read. Those are
 * recomputed EXACTLY and depend on no pin at all. The partition is deliberate — what can
 * be proven here is proven here; what cannot is named, never skipped silently.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE CHECKS
 *
 *   P1  Every generated file and the pgTAP mirror exist and are non-empty.
 *   P2  Exactly one well-formed anchor per generated file, carrying every key its kind
 *       requires. ⛔ ZERO anchors AND TWO anchors are both findings (gate 15's P-checks:
 *       a second anchor is how a "fix" gets bolted on beside the one being gated).
 *   A   `rows=` equals the data rows actually in that file's table. A census whose parts
 *       do not sum is wrong, and this is the arm that would notice a truncated write.
 *   B   The partition sums: definer+invoker == rows · typed+untyped == rows ·
 *       queries+actions == rows.
 *   C   Every catalog-derived anchor's `rows` and `digest` appear in the pgTAP mirror as
 *       PINNED LITERALS, each on its own line beside its key. ⭐ Gate 15's shape, and it is
 *       load-bearing: the gate reads the literal pgTAP actually asserts, never a comment
 *       restating it, so two comments cannot agree while the assertion says otherwise.
 *   D   The SQL spliced into the mirror is byte-identical to the marked block in
 *       `scripts/data-access-census.sql`. One home for the census grammar.
 *   E   The SOURCE halves recompute exactly: the whole module file, and the typed-field +
 *       readers columns of the flag file.
 *   F   Flag drift, BOTH polarities — an untyped live key (callers must cast) and a dead
 *       typed field (reads `false` for ever via the safe default, so nothing ever fails and
 *       nobody notices). ⛔ A one-directional check reports half of this.
 *   G   The three FROZEN registry headings in `data-access.md` each carry a
 *       `⚠ **Superseded**` forward marker. Without it a reader lands on the stale table and
 *       never learns the generated one exists. (Gate 16 check C proves such a marker
 *       RESOLVES; only this gate knows those three headings must HAVE one.)
 */


import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  OUTPUTS,
  build,
  countTableRows,
  deriveFlagReaders,
  deriveModules,
  deriveTypedFlags,
  extractSqlBlock,
  normalise,
  parseAnchors,
  parseCensus,
  renderQueryModules,
  sharedPreamble,
} from './gen-data-access-surface.mjs'

// ⛔ Script-relative, never `process.cwd()` — `check-budget-anchor.mjs:125`.
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const DIR_REL = 'docs/backend-state'
const DIR = join(REPO_ROOT, 'docs', 'backend-state')
const PGTAP_REL = 'supabase/tests/400_data_access_census.sql'
const CENSUS_REL = 'scripts/data-access-census.sql'
const FLAGS_TS_REL = 'src/lib/queries/feature-flags.ts'
const HANDWRITTEN_REL = `${DIR_REL}/data-access.md`

/** The keys each anchor kind must carry, and the partition each must satisfy. */
const ANCHOR_SPEC = {
  rpc: { keys: ['kind', 'schema', 'rows', 'definer', 'invoker', 'trigger', 'aclnull', 'digest'], parts: ['definer', 'invoker'], pinned: true },
  helper: { keys: ['kind', 'schema', 'rows', 'definer', 'invoker', 'trigger', 'aclnull', 'digest'], parts: ['definer', 'invoker'], pinned: true },
  flags: { keys: ['kind', 'rows', 'typed', 'untyped', 'dead', 'digest'], parts: ['typed', 'untyped'], pinned: true },
  modules: { keys: ['kind', 'rows', 'queries', 'actions', 'exports', 'digest'], parts: ['queries', 'actions'], pinned: false },
}

/**
 * The three FROZEN headings in `data-access.md` that the generated files supersede, and
 * where each reader is sent. ⛔ These sections are NOT deleted and NOT edited: ADR 0196 D5
 * freezes a posted section, and the prose inside them — the three-hop
 * `commission_of_template_*` family, `confidentiality_rank`'s "do NOT re-order it",
 * `can_read_case_or_admin`'s "ORing the admin arm OUTSIDE the DEFINER out-votes the m2
 * deny" — is exactly the part a catalog cannot derive and must survive the cutover.
 */
const SUPERSEDED_HEADINGS = [
  { heading: '## RPC inventory', target: 'generated-rpc-surface.md' },
  { heading: '## Helper functions', target: 'generated-helper-surface.md' },
  { heading: '## Feature flags (`app.feature_flags`)', target: 'generated-feature-flags.md' },
  {
    heading: '## Data-access & action modules (Rule 9 — no inline supabase-js in UI)',
    target: 'generated-query-modules.md',
  },
]

/**
 * ⛔ EXACT, never `startsWith`. The first version matched on a prefix, and its self-test arm
 * "a frozen heading is renamed" passed WITHOUT the check firing: `## RPC inventory (old)`
 * still starts with `## RPC inventory`, so a rename that breaks every inbound `§` citation
 * looked untouched. A frozen heading is frozen as a WHOLE STRING, because the string is what
 * a marker in another file cites.
 */
const headingAt = (lines, heading) => lines.findIndex((l) => l.trimEnd() === heading)

const MARKER_RE = /^⚠ \*\*Superseded\*\* —/

/** ⭐ Gate 15's mirror shape: the literal is on its own line beside its key, so what the
 *  gate reads IS what pgTAP asserts. */
const PIN_RE = /^[ \t]*\('([a-z]+)',[ \t]*(\d+),[ \t]*'([0-9a-f]{32})'\)/gm

// ═══════════════════════════════════════════════════════════════════════════════════════
// ONE inspect(), so the self-test and the real run cannot disagree about what is correct
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} io  every input as TEXT, so a fixture and the real tree take the same path
 * @returns {string[]} findings, each prefixed with its check letter
 */
export function inspect(io) {
  const F = []
  const { files, pgtap, censusSql, flagsTs, handwritten, modulesExpected, readersActual } = io

  // ── P1 ────────────────────────────────────────────────────────────────────────────
  for (const { name } of OUTPUTS) {
    const t = files[name]
    if (t === undefined || t === null) F.push(`[P1] ${DIR_REL}/${name} — missing`)
    else if (normalise(t).trim().length === 0) F.push(`[P1] ${DIR_REL}/${name} — empty`)
  }
  if (pgtap === undefined || pgtap === null) F.push(`[P1] ${PGTAP_REL} — missing`)
  else if (normalise(pgtap).trim().length === 0) F.push(`[P1] ${PGTAP_REL} — empty`)
  if (F.length) return F // nothing below can be trusted with a missing input

  // ── P2 / A / B ────────────────────────────────────────────────────────────────────
  const anchors = {}
  for (const { kind, name } of OUTPUTS) {
    const text = files[name]
    const parsed = parseAnchors(text)
    if (parsed.error) {
      F.push(`[P2] ${DIR_REL}/${name} — ${parsed.error}`)
      continue
    }
    if (parsed.anchors.length !== 1) {
      F.push(
        `[P2] ${DIR_REL}/${name} — ${parsed.anchors.length} DATA-ACCESS-ANCHOR lines, expected exactly 1` +
          (parsed.anchors.length > 1 ? ' (a second anchor is how a fix gets bolted on beside the one being gated)' : ''),
      )
      continue
    }
    const a = parsed.anchors[0]
    const spec = ANCHOR_SPEC[kind]
    const missing = spec.keys.filter((k) => !(k in a))
    if (missing.length) {
      F.push(`[P2] ${DIR_REL}/${name} — anchor is missing ${missing.join(', ')}`)
      continue
    }
    if (a.kind !== kind) {
      F.push(`[P2] ${DIR_REL}/${name} — anchor says kind=${a.kind}, this file is the ${kind} surface`)
      continue
    }
    const nonNumeric = spec.keys.filter((k) => k !== 'kind' && k !== 'schema' && k !== 'digest' && !/^\d+$/.test(a[k]))
    if (nonNumeric.length) {
      F.push(`[P2] ${DIR_REL}/${name} — anchor value(s) not a count: ${nonNumeric.join(', ')}`)
      continue
    }
    anchors[kind] = a

    const actual = countTableRows(text)
    if (Number(a.rows) !== actual) {
      F.push(
        `[A] ${DIR_REL}/${name} — anchor says rows=${a.rows}, the table holds ${actual}. ` +
          `A census whose parts do not sum is wrong; regenerate rather than editing the anchor.`,
      )
    }
    const sum = spec.parts.reduce((n, k) => n + Number(a[k]), 0)
    if (sum !== Number(a.rows)) {
      F.push(
        `[B] ${DIR_REL}/${name} — ${spec.parts.join('+')} = ${sum} but rows=${a.rows}; ` +
          `the partition does not cover the population.`,
      )
    }
  }
  // ⛔ NO SHORT-CIRCUIT PAST HERE. An earlier version returned as soon as any anchor failed
  // to parse, which made [C]…[G] unreachable whenever [P2] fired — so a single malformed
  // anchor silently suppressed six other checks, and the mutation run read every one of them
  // as "not caught". Checks that do not DEPEND on an anchor now always run, and those that do
  // are guarded per kind. ⚠ Only [P1] still returns early: nothing can be checked in a file
  // that could not be read.

  // ── C: the pin mirrors the anchor, literal for literal ────────────────────────────
  const pins = new Map()
  PIN_RE.lastIndex = 0
  let m
  while ((m = PIN_RE.exec(normalise(pgtap))) !== null) {
    if (pins.has(m[1])) F.push(`[C] ${PGTAP_REL} — kind \`${m[1]}\` is pinned twice`)
    pins.set(m[1], { rows: Number(m[2]), digest: m[3] })
  }
  const shouldPin = OUTPUTS.filter((o) => ANCHOR_SPEC[o.kind].pinned).map((o) => o.kind)
  for (const kind of shouldPin) {
    const a = anchors[kind]
    // ⛔ UNDECIDED, not clean: with no parsed anchor there is nothing to compare the pin
    // against. [P2] has already reported the anchor; inventing a [C] finding here would
    // double-report one defect, and passing would be worse.
    if (!a) continue
    const p = pins.get(kind)
    if (!p) {
      F.push(
        `[C] ${PGTAP_REL} — no pin for \`${kind}\`. Without it the catalog half of the claim ` +
          `is unasserted, and this gate's green would be the ONLY verdict.`,
      )
      continue
    }
    if (p.rows !== Number(a.rows)) {
      F.push(`[C] \`${kind}\` rows: the doc anchor says ${a.rows}, ${PGTAP_REL} pins ${p.rows}`)
    }
    if (p.digest !== a.digest) {
      F.push(`[C] \`${kind}\` digest: the doc anchor says ${a.digest}, ${PGTAP_REL} pins ${p.digest}`)
    }
  }
  for (const kind of pins.keys()) {
    if (!shouldPin.includes(kind)) F.push(`[C] ${PGTAP_REL} — pins unknown kind \`${kind}\``)
  }

  // ── D: one home for the census grammar ────────────────────────────────────────────
  for (const block of ['FUNC_ROW', 'FLAG_ROW']) {
    let want
    try {
      want = extractSqlBlock(censusSql, block)
    } catch (e) {
      F.push(`[D] ${CENSUS_REL} — ${e.message}`)
      continue
    }
    // The mirror indents the splice by two spaces; compare on the un-indented text.
    const flat = normalise(pgtap)
      .split('\n')
      .map((l) => (l.startsWith('  ') ? l.slice(2) : l))
      .join('\n')
    if (!flat.includes(want)) {
      F.push(
        `[D] ${PGTAP_REL} — the spliced ${block} expression is not byte-identical to ` +
          `${CENSUS_REL}. The census grammar has ONE home; regenerate rather than editing either copy.`,
      )
    }
  }

  // ── E: the SOURCE halves, recomputed exactly ──────────────────────────────────────
  if (modulesExpected !== null && normalise(files['generated-query-modules.md']) !== normalise(modulesExpected)) {
    F.push(
      `[E] ${DIR_REL}/generated-query-modules.md — differs from a fresh derivation of ` +
        `\`src/lib/queries/\` + the action modules. This half needs no database, so it is ` +
        `proven here rather than deferred to the pin. Run \`npm run data-access:surface\`.`,
    )
  }

  let typed = null
  try {
    typed = deriveTypedFlags(flagsTs)
  } catch (e) {
    F.push(`[E] ${FLAGS_TS_REL} — ${e.message}`)
  }
  const flagRows = parseFlagTable(files['generated-feature-flags.md'])
  if (flagRows.length === 0) {
    F.push(
      `[E] ${DIR_REL}/generated-feature-flags.md — parsed ZERO flag rows. Refusing to report ` +
        `a clean comparison over an empty set.`,
    )
  } else if (typed) {
    const typedSet = new Set(typed)
    for (const r of flagRows) {
      const shouldBeTyped = typedSet.has(r.key)
      if (shouldBeTyped !== r.typed) {
        F.push(
          `[E] flag \`${r.key}\` — the table says ${r.typed ? 'typed' : 'untyped'}, ` +
            `${FLAGS_TS_REL} says ${shouldBeTyped ? 'typed' : 'untyped'}`,
        )
      }
    }
    // The READERS column is source-derived too, so it is proven here rather than deferred.
    // ⚠ Only for keys the table already lists: a key the walk finds but the catalog does not
    // hold is a CATALOG question, and answering it from `src/` would be this gate claiming a
    // verdict it has no instrument for.
    if (readersActual !== null) {
      for (const r of flagRows) {
        const want = (readersActual.get(r.key) ?? []).join('|')
        const got = r.readers.join('|')
        if (want !== got) {
          F.push(
            `[E] flag \`${r.key}\` readers — the table lists ${r.readers.length}, a fresh walk ` +
              `of \`src/\` finds ${(readersActual.get(r.key) ?? []).length}. Run \`npm run data-access:surface\`.`,
          )
        }
      }
    }
    // ── F: drift, both polarities ───────────────────────────────────────────────────
    const liveKeys = new Set(flagRows.map((r) => r.key))
    const untyped = flagRows.filter((r) => !typedSet.has(r.key)).map((r) => r.key)
    const dead = typed.filter((k) => !liveKeys.has(k))
    if (untyped.length) {
      F.push(
        `[F] ${untyped.length} live flag key(s) carry no \`FeatureFlags\` field: ` +
          `${untyped.map((k) => `\`${k}\``).join(', ')}. A caller must \`as FeatureFlagKey\` past ` +
          `the type system to read them.`,
      )
    }
    if (dead.length) {
      F.push(
        `[F] ${dead.length} \`FeatureFlags\` field(s) name no live key: ` +
          `${dead.map((k) => `\`${k}\``).join(', ')}. These read \`false\` for ever via the safe ` +
          `default, so nothing ever fails and nobody notices.`,
      )
    }
    const a = anchors.flags
    if (a && (Number(a.untyped) !== untyped.length || Number(a.dead) !== dead.length)) {
      F.push(
        `[F] ${DIR_REL}/generated-feature-flags.md — the anchor says untyped=${a.untyped} ` +
          `dead=${a.dead}; recomputed from source: untyped=${untyped.length} dead=${dead.length}`,
      )
    }
  }

  // ── G: the frozen headings send the reader on ─────────────────────────────────────
  if (handwritten !== null) {
    const lines = normalise(handwritten).split('\n')
    for (const { heading, target } of SUPERSEDED_HEADINGS) {
      const i = headingAt(lines, heading)
      if (i < 0) {
        F.push(
          `[G] ${HANDWRITTEN_REL} — heading \`${heading}\` not found. It is FROZEN and posted ` +
            `(ADR 0196 D5): it may be superseded but never renamed or deleted.`,
        )
        continue
      }
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j += 1
      const marker = lines.slice(j, j + 8).join('\n')
      if (!MARKER_RE.test(lines[j] ?? '')) {
        F.push(
          `[G] ${HANDWRITTEN_REL} § ${heading.replace(/^#+ /, '')} — no ` +
            `\`⚠ **Superseded** —\` marker under the heading. Without it a reader lands on ` +
            `the stale table and never learns \`${target}\` exists.`,
        )
      } else if (!marker.includes(target)) {
        F.push(
          `[G] ${HANDWRITTEN_REL} § ${heading.replace(/^#+ /, '')} — the marker does not name ` +
            `\`${target}\`, which is the file that supersedes it.`,
        )
      }
    }
  }

  return F
}

/** Data rows of the generated flag table: `| \`key\` | \`local\` | ✅ or ⛔ | … |`. */
export function parseFlagTable(text) {
  const rows = []
  for (const line of normalise(text).split('\n')) {
    if (!line.startsWith('| `')) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 3) continue
    const key = cells[0].replace(/^`|`$/g, '')
    if (!/^[a-z0-9_]+$/.test(key)) continue
    const readers = cells[3] === '—' ? [] : cells[3].split('<br>').map((s) => s.replace(/^`|`$/g, '').trim()).filter(Boolean)
    rows.push({ key, typed: cells[2].includes('✅'), readers })
  }
  return rows
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Real run
// ═══════════════════════════════════════════════════════════════════════════════════════

function readOr(rel) {
  const p = join(REPO_ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

function collect() {
  const files = {}
  for (const { name } of OUTPUTS) files[name] = readOr(`${DIR_REL}/${name}`)
  let modulesExpected = null
  try {
    modulesExpected = renderQueryModules({
      modules: deriveModules(REPO_ROOT),
      preamble: sharedPreamble(DIR),
      script: 'gen-data-access-surface.mjs',
    })
  } catch {
    // Left null: [E]'s module arm is then UNPROVEN rather than silently clean, and the
    // summary says so. ⛔ It is never treated as a pass.
    modulesExpected = null
  }
  let readersActual = null
  try {
    readersActual = deriveFlagReaders(REPO_ROOT)
  } catch {
    // Left null => [E]'s readers arm is UNPROVEN, never silently clean.
    readersActual = null
  }
  return {
    files,
    pgtap: readOr(PGTAP_REL),
    censusSql: readOr(CENSUS_REL) ?? '',
    flagsTs: readOr(FLAGS_TS_REL) ?? '',
    handwritten: readOr(HANDWRITTEN_REL),
    modulesExpected,
    readersActual,
  }
}

/**
 * ⛔ THREE STATES, NEVER TWO: clean · the CORPUS has drifted (rc 1) · the CHECKER is broken
 * (rc 2). Collapsing the middle into the last is not a cosmetic slip — it sends a reader to
 * debug this script when the actual answer is "run the generator".
 *
 * ⚠ MEASURED, by the on-disk mutation run this gate shipped with: the first version ran the
 * self-test FIRST, over fixtures cloned from the real corpus. Every one of eight real
 * mutations therefore poisoned the self-test's own baseline, and all eight reported
 * `SELF-TEST FAILED — the checker is not trustworthy` while the checker was working
 * perfectly. That is `check-budget-anchor.mjs` ruling R28 ("a fixture derived from the real
 * artefact is poisoned by the very plant it exists to detect") arriving from the opposite
 * direction, and the remedy here is different from canonicalising: the arms are scored as a
 * DELTA against whatever the baseline already reports, so the self-test stays valid over a
 * corpus in any state, and the corpus's own findings are reported as the GATE's verdict.
 */
function main() {
  const argv = process.argv.slice(2)

  let io
  try {
    io = collect()
  } catch (e) {
    console.error(`data-access registry gate: FAILED — ${e.message}`)
    process.exit(2)
  }

  let F
  try {
    F = inspect(io)
  } catch (e) {
    console.error(`data-access registry gate: FAILED — inspect threw: ${e.message}`)
    process.exit(2)
  }

  // ⛔ The self-test gets its OWN fixture corpus, never `io`. See selfTest()'s header.
  const st = selfTest({ verbose: argv.includes('--self-test') })
  if (st.rc !== 0) {
    console.error(
      `data-access registry gate: SELF-TEST FAILED — the CHECKER is not trustworthy. ` +
        `⛔ This is not the same as the corpus having drifted; fix the script, not the docs.`,
    )
    process.exit(2)
  }
  if (argv.includes('--self-test')) {
    console.log(
      `data-access registry gate self-test: OK (${st.arms} arms — every check proven able to ` +
        `fire AND to stay silent; every mutation proven to have applied)` +
        (F.length
          ? `\n  ⚠ The baseline corpus carries ${F.length} finding(s) of its own, so arms were ` +
            `scored as a DELTA against it. Run the gate without --self-test to see them.`
          : ''),
    )
    return
  }

  if (F.length) {
    console.error(`data-access registry gate: FAILED (${F.length} finding${F.length === 1 ? '' : 's'})\n`)
    for (const f of F) console.error(`  ⛔ ${f}`)
    console.error(
      `\n  Most of these are fixed by \`npm run data-access:surface\` (needs the local stack).\n` +
        `  ⛔ Never hand-edit a generated file or a pin to make this pass — that is the drift.\n`,
    )
    process.exit(1)
  }

  const unproven = io.modulesExpected === null ? ' ⚠ [E] module arm UNPROVEN (derivation failed)' : ''
  console.log(
    `data-access registry gate: OK — 4 generated registries agree with their pins and with ` +
      `\`src/\`.${unproven}\n` +
      `  ⚠ BOUND: this gate never opened a database. "The doc matches the CATALOG" is proven ` +
      `only together with\n     ${PGTAP_REL} under \`npm run test:db\`. A green here is not that verdict.`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// --self-test: every check proven able to FIRE and to STAY SILENT
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * A small, CLEAN corpus in the real format.
 *
 * ⭐ It is built by the GENERATOR'S OWN RENDERERS from a fixture census, never hand-written.
 * A hand-written copy of production text is a copy that drifts: the day a renderer changes a
 * column, a hand-written fixture keeps testing the old shape and every arm stays green while
 * the gate stops matching reality. Here the fixture cannot disagree with the format, because
 * one function emits both.
 */
export function fixtureCorpus() {
  const CENSUS =
    'FUNC|public|fn_one|p_id uuid|void|definer|volatile|function|authenticated=X/postgres\n' +
    'FUNC|public|fn_two||boolean|invoker|stable|function|authenticated=X/postgres\n' +
    'FUNC|app|helper_one|p_id uuid|boolean|definer|stable|function|<NULL=PUBLIC>\n' +
    'FUNC|app|guard_one||trigger|invoker|volatile|trigger|<NULL=PUBLIC>\n' +
    'FLAG|flag_a|true|A fixture flag.\n' +
    'FLAG|flag_b|false|Another fixture flag.\n'
  const SQL =
    '-- fixture census\n' +
    '-- >>> BEGIN FUNC_ROW <<<\n' +
    "select 'FUNC|' || n.nspname\nfrom pg_proc p\nwhere p.prokind = 'f'\n" +
    '-- >>> END FUNC_ROW <<<\n' +
    '-- >>> BEGIN FLAG_ROW <<<\n' +
    "select 'FLAG|' || f.key\nfrom app.feature_flags f\n" +
    '-- >>> END FLAG_ROW <<<\n'
  const typed = ['flag_a', 'flag_b']
  const readersActual = new Map([['flag_a', ['src/lib/queries/a.ts:aEnabled']]])
  const modules = [
    { kind: 'query', path: 'src/lib/queries/a.ts', exports: ['aEnabled'], types: 0 },
    { kind: 'action', path: 'src/lib/b/actions.ts', exports: ['doB'], types: 0 },
  ]
  const built = build({
    census: parseCensus(CENSUS),
    typed,
    readers: readersActual,
    modules,
    preamble: '> fixture preamble\n> second line',
    sqlText: SQL,
  })
  const files = Object.fromEntries(built.files)
  const handwritten =
    '# fixture\n\n> fixture preamble\n> second line\n\n' +
    SUPERSEDED_HEADINGS.map(
      ({ heading, target }) =>
        `${heading}\n\n⚠ **Superseded** — for the inventory only.\nSee ${target} § The generated ` +
        `${target.includes('flag') ? 'flag' : target.includes('module') ? 'module' : 'function'} registry.\n\nBody prose that survives.\n`,
    ).join('\n')
  return {
    files,
    pgtap: built.pgtap,
    censusSql: SQL,
    flagsTs: `export interface FeatureFlags {\n${typed.map((k) => `  ${k}: boolean`).join('\n')}\n}\n`,
    handwritten,
    modulesExpected: files['generated-query-modules.md'],
    readersActual,
  }
}

/**
 * ⛔ Fixtures only — the real tree is never mutated, and the baseline is built by
 * CANONICALISING the real artefacts, not by hand. A hand-written copy of production text is
 * a copy that drifts, and a fixture derived from the real artefact without canonicalising is
 * poisoned by the very defect it exists to detect (`check-budget-anchor.mjs` ruling R28).
 *
 * ⛔ EVERY MUTATION IS PROVEN TO HAVE APPLIED before its arm is scored. A mutation that
 * silently no-ops leaves the fixture clean, the check silent, and the arm green — it reads
 * exactly like a working detector (LEARN-090).
 */
export function selfTest({ verbose = false, base = null, baseFindings = null } = {}) {
  const bad = []
  let arms = 0

  // ⛔ THE BASELINE IS A SYNTHETIC FIXTURE, NOT THE REAL CORPUS, and the `base` argument is
  // accepted only so a caller can say so explicitly. Two measured reasons, both from the
  // on-disk mutation run this gate shipped with:
  //
  //   1. A self-test whose fixtures are CLONED FROM the artefact under test is poisoned by
  //      the very plant it exists to detect (`check-budget-anchor.mjs` ruling R28). Eight
  //      real on-disk mutations each poisoned the baseline and made the gate report
  //      `SELF-TEST FAILED — the checker is not trustworthy` while the checker was working.
  //   2. Worse, and subtler: an arm's own mutation can COLLIDE with a corpus already mutated
  //      elsewhere — the `C digest` arm rewrote the first 32-hex literal to `ffff…` on a file
  //      where the on-disk mutation had already written exactly that, so the fixture did not
  //      change and the arm tested nothing. Only the "mutation did not apply" guard saw it.
  //
  // ⚠ The cost is stated rather than hidden: these fixtures prove the LOGIC, not that the
  // logic holds over the real corpus's shapes. That second claim is what the out-of-band
  // mutation run buys, and neither substitutes for the other — the same division gate 16
  // settled on ("Fixtures only; never the real files") after gate 11 mutated `src/` in place.
  base = base ?? fixtureCorpus()
  const BASE = new Set(baseFindings ?? inspect(base))
  const added = (F) => F.filter((f) => !BASE.has(f))

  const clone = () => ({ ...base, files: { ...base.files } })
  /**
   * Score a must-fire arm: prove the mutation changed the subject, then demand a finding
   * whose letter matches.
   */
  const fires = (label, letter, mutate) => {
    arms += 1
    const io = clone()
    const before = JSON.stringify(io.files) + String(io.pgtap) + String(io.flagsTs) + String(io.handwritten) + String(io.censusSql)
    mutate(io)
    const after = JSON.stringify(io.files) + String(io.pgtap) + String(io.flagsTs) + String(io.handwritten) + String(io.censusSql)
    if (before === after) {
      bad.push(`${label} — MUTATION DID NOT APPLY (the arm would have passed having tested nothing)`)
      return
    }
    let F
    try {
      F = inspect(io)
    } catch (e) {
      // ⛔ A THROW IS NOT A CATCH. The contract is a named finding, not a stack trace: a
      // crash in `npm run lint` reads as a broken script and the next person "fixes" the
      // script rather than the drift.
      bad.push(`${label} — THREW instead of reporting (${e.message})`)
      return
    }
    const New = added(F)
    if (!New.some((f) => f.startsWith(`[${letter}]`))) {
      bad.push(
        `${label} — NOT CAUGHT by [${letter}] (new findings: ${New.length ? New.map((x) => x.slice(0, 28)).join('; ') : 'none'})`,
      )
    } else if (verbose) {
      console.log(`  · caught [${letter}] — ${label}`)
    }
  }

  const RPC = 'generated-rpc-surface.md'
  const FLAGS = 'generated-feature-flags.md'
  const MODS = 'generated-query-modules.md'

  // ── P1 ────────────────────────────────────────────────────────────────────────────
  fires('P1: a generated file is missing', 'P1', (io) => { io.files[RPC] = null })
  fires('P1: a generated file is empty', 'P1', (io) => { io.files[RPC] = '\n  \n' })
  fires('P1: the pgTAP mirror is missing', 'P1', (io) => { io.pgtap = null })

  // ── P2 ────────────────────────────────────────────────────────────────────────────
  fires('P2: the anchor line is deleted', 'P2', (io) => {
    io.files[RPC] = io.files[RPC].replace(/^<!-- DATA-ACCESS-ANCHOR.*$/m, '')
  })
  fires('P2: a SECOND anchor is bolted on beside the gated one', 'P2', (io) => {
    io.files[RPC] = io.files[RPC].replace(
      /^(<!-- DATA-ACCESS-ANCHOR.*)$/m,
      '$1\n<!-- DATA-ACCESS-ANCHOR kind=rpc schema=public rows=1 definer=1 invoker=0 trigger=0 aclnull=0 digest=00000000000000000000000000000000 -->',
    )
  })
  fires('P2: the anchor loses a required key', 'P2', (io) => {
    io.files[RPC] = io.files[RPC].replace(/ digest=[0-9a-f]{32}/, '')
  })
  fires('P2: an anchor token has no `=`', 'P2', (io) => {
    io.files[RPC] = io.files[RPC].replace(/DATA-ACCESS-ANCHOR /, 'DATA-ACCESS-ANCHOR bare ')
  })
  fires('P2: the anchor names the wrong kind', 'P2', (io) => {
    io.files[RPC] = io.files[RPC].replace('kind=rpc', 'kind=helper')
  })

  // ── A / B ─────────────────────────────────────────────────────────────────────────
  fires('A: a table row is deleted without touching the anchor (a truncated write)', 'A', (io) => {
    const lines = io.files[RPC].split('\n')
    const i = lines.findIndex((l) => l.startsWith('| `public.'))
    lines.splice(i, 1)
    io.files[RPC] = lines.join('\n')
  })
  fires('A: the anchor rows figure is edited instead of regenerating', 'A', (io) => {
    io.files[RPC] = io.files[RPC].replace(/ rows=(\d+)/, (_, n) => ` rows=${Number(n) + 1}`)
  })
  fires('B: the definer/invoker partition stops covering the population', 'B', (io) => {
    io.files[RPC] = io.files[RPC].replace(/ definer=(\d+)/, (_, n) => ` definer=${Number(n) - 1}`)
  })

  // ── C ─────────────────────────────────────────────────────────────────────────────
  fires('C: the pgTAP pin disagrees with the doc anchor on the DIGEST', 'C', (io) => {
    io.pgtap = io.pgtap.replace(/'([0-9a-f]{32})'\)/, "'ffffffffffffffffffffffffffffffff')")
  })
  fires('C: the pgTAP pin disagrees with the doc anchor on the ROW COUNT', 'C', (io) => {
    io.pgtap = io.pgtap.replace(/\('rpc', (\d+),/, (_, n) => `('rpc', ${Number(n) + 1},`)
  })
  fires('C: a whole pin is removed, leaving the catalog half unasserted', 'C', (io) => {
    io.pgtap = io.pgtap.replace(/^ *\('rpc', \d+, '[0-9a-f]{32}'\),?\n/m, '')
  })
  fires('C: a pin is duplicated', 'C', (io) => {
    io.pgtap = io.pgtap.replace(/^( *\('rpc', \d+, '[0-9a-f]{32}'\),?)$/m, '$1\n$1')
  })

  // ── D ─────────────────────────────────────────────────────────────────────────────
  fires('D: the spliced census SQL is edited in the pgTAP copy', 'D', (io) => {
    io.pgtap = io.pgtap.replace("p.prokind = 'f'", "p.prokind in ('f','p')")
  })
  fires('D: the census SQL loses its extraction markers', 'D', (io) => {
    io.censusSql = io.censusSql.replace('-- >>> END FUNC_ROW <<<', '')
  })

  // ── E ─────────────────────────────────────────────────────────────────────────────
  fires('E: the module registry no longer matches a fresh derivation', 'E', (io) => {
    io.files[MODS] = io.files[MODS].replace(/^\| `src\/lib\/queries\/[a-z-]+\.ts` \| query \|.*$/m, '')
  })
  // ⚠ This arm mutates ✅ → ⛔, deliberately, and not the other way round. The first version
  // flipped `⛔ **none**` → `✅` and PASSED VACUOUSLY the moment the tree's last untyped key was
  // given a field: the search string was simply absent, so nothing was mutated and nothing was
  // checked. Caught only by the "mutation did not apply" guard. ⛔ Never key a mutation on a
  // token that a CLEAN corpus is not guaranteed to contain.
  fires('E: a flag row denies a typed field that `feature-flags.ts` DOES declare', 'E', (io) => {
    io.files[FLAGS] = io.files[FLAGS].replace('| ✅ |', '| ⛔ **none** |')
  })
  // The readers column is the half a stale generated file loses first: it changes whenever
  // any file in `src/` gains or drops a `featureEnabled('…')` call, with no migration and no
  // schema change to prompt a regeneration. Measured for real while this gate was being
  // built — removing one `as FeatureFlagKey` cast created a reader the committed table
  // predated, and this arm is what reported it.
  fires('E: a flag row lists a reader that a fresh walk of `src/` does not find', 'E', (io) => {
    io.files[FLAGS] = io.files[FLAGS].replace(/\| `src\/[^|]*` \|/, '| `src/lib/queries/ghost.ts:ghostReader` |')
  })
  fires('E: the flag table is emptied (a clean comparison over an empty set)', 'E', (io) => {
    io.files[FLAGS] = io.files[FLAGS].replace(/^\| `[a-z0-9_]+` \|.*$/gm, '')
  })

  // ── F, BOTH polarities ────────────────────────────────────────────────────────────
  fires('F: a typed field is added that names no live key (the DEAD direction)', 'F', (io) => {
    io.flagsTs = io.flagsTs.replace(
      'export interface FeatureFlags {',
      'export interface FeatureFlags {\n  zzz_not_a_live_key: boolean',
    )
  })
  fires('F: a typed field is removed, orphaning a live key (the UNTYPED direction)', 'F', (io) => {
    const k = parseFlagTable(io.files[FLAGS]).find((r) => r.typed)?.key
    io.flagsTs = io.flagsTs.replace(new RegExp(`^  ${k}: boolean$`, 'm'), '')
  })

  // ── G ─────────────────────────────────────────────────────────────────────────────
  fires('G: a frozen heading loses its Superseded forward marker', 'G', (io) => {
    io.handwritten = io.handwritten.replace(/^⚠ \*\*Superseded\*\* —.*$/m, '')
  })
  fires('G: the marker no longer names the file that supersedes the section', 'G', (io) => {
    io.handwritten = io.handwritten.replace('generated-rpc-surface.md', 'somewhere-else.md')
  })
  fires('G: a frozen heading is renamed', 'G', (io) => {
    io.handwritten = io.handwritten.replace(/^## RPC inventory$/m, '## RPC inventory (old)')
  })

  // ── ⛔ THE DISCRIMINATION HALVES. Every arm above proves a check can FIRE. A check
  //    that fires on everything is not a detector, it is a broken gate. These prove the
  //    checks key on the predicate they name rather than on a mutation's mere presence.
  const silent = (label, mutate) => {
    arms += 1
    const io = clone()
    const before = JSON.stringify(io.files) + String(io.handwritten)
    mutate(io)
    if (before === JSON.stringify(io.files) + String(io.handwritten)) {
      bad.push(`${label} — MUTATION DID NOT APPLY`)
      return
    }
    let F
    try {
      F = inspect(io)
    } catch (e) {
      bad.push(`${label} — THREW (${e.message})`)
      return
    }
    const New = added(F)
    if (New.length) bad.push(`${label} — FIRED on a change it must ignore: ${New[0]}`)
    else if (verbose) console.log(`  · silent — ${label}`)
  }
  silent('prose added to a generated file is not a table row', (io) => {
    io.files[RPC] = io.files[RPC].replace(
      /^\| --- \| --- \| --- \| --- \| --- \| --- \|$/m,
      '| --- | --- | --- | --- | --- | --- |\n\nAn added paragraph.\n',
    )
  })
  silent('an extra Superseded marker elsewhere in the handwritten file', (io) => {
    io.handwritten = `${io.handwritten}\n## Something else\n\n⚠ **Superseded** — x. See data-access.md § RPC inventory.\n`
  })
  silent('a comment mentioning a pin is not a pin', (io) => {
    io.files[RPC] = `${io.files[RPC]}\n<!-- not an anchor: ('rpc', 1, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') -->\n`
  })

  // ── ⛔ THE GLOBAL CONTROL: re-inspecting the UNMUTATED corpus must reproduce the baseline
  //    EXACTLY — no more findings, no fewer. Every arm above is a delta against that set, so
  //    an inspect() that is non-deterministic, or that a previous arm left mutated through a
  //    shared object, would make every delta meaningless while each arm still read green.
  //    ⚠ This is deliberately NOT "the corpus is clean": whether the corpus has drifted is the
  //    GATE's verdict (rc 1), not evidence about the checker (rc 2). Conflating the two is the
  //    defect the mutation run found.
  arms += 1
  let realF
  try {
    realF = inspect(base)
  } catch (e) {
    bad.push(`the REAL corpus THREW — ${e.message}`)
    realF = []
  }
  const drifted = added(realF)
  const vanished = [...BASE].filter((f) => !realF.includes(f))
  if (drifted.length || vanished.length) {
    bad.push(
      `re-inspecting the unmutated corpus did not reproduce the baseline ` +
        `(+${drifted.length} / -${vanished.length}) — the arms' deltas mean nothing: ` +
        `${(drifted[0] ?? vanished[0]).slice(0, 80)}`,
    )
  } else if (verbose) {
    console.log(
      BASE.size === 0
        ? '  · caught nothing on the real corpus (discrimination control)'
        : `  · reproduced the ${BASE.size}-finding baseline exactly (discrimination control; ` +
          `the corpus itself has drifted — that is the GATE's verdict, not the checker's)`,
    )
  }

  if (bad.length) {
    console.error(`data-access registry gate self-test: FAILED (${bad.length}/${arms} arms)\n`)
    for (const b of bad) console.error(`  ⛔ ${b}`)
    console.error('')
    return { rc: 1, arms }
  }
  return { rc: 0, arms }
}

// ⛔ Run only when invoked as a script — `check-backend-state.mjs` ran `main()` on IMPORT
// until 2026-09-09, and the whole gate executed for anyone importing a helper from it.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main()
