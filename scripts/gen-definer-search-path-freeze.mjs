#!/usr/bin/env node
/**
 * GATE 18 — `npm run lint:definer-freeze`.
 *
 * Exit: 0 clean | 1 a finding | 2 the checker itself cannot run.
 *
 *   node scripts/gen-definer-search-path-freeze.mjs --write      # regenerate from the LIVE catalog
 *   node scripts/gen-definer-search-path-freeze.mjs --check      # gate 18, no database
 *   node scripts/gen-definer-search-path-freeze.mjs --self-test  # prove every checker can fail
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * ADR 0208 D4 rules `set search_path = ''` with a schema-qualified body the SOLE forward
 * convention for a new or touched SECURITY DEFINER. The 861 remaining non-empty paths are
 * frozen compatibility debt: they may not GROW, and they converge on touch. The lineage, so
 * the figure is dateable rather than bare: 867 -> 865 at migration `20261003007410` (two
 * members) -> 861 at `20261003007420` (the four temp-table DEFINERs). D5 orders the
 * enforcer to be a pgTAP ratchet (419) over a frozen NAME SET — ⛔ never a hand-typed list,
 * because the list this tree would have to hand-type is 867 signatures long and the one
 * time a `search_path` expectation was hand-typed in this repo it was copied out of a
 * broken catalog and PINNED THE DEFECT (`413`'s own comment says so).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⛔ THE TWO ARMS, AND WHY NEITHER IS SUFFICIENT ALONE
 *
 *   forgot to regenerate    -> pgTAP 419 § 1a reds  (live \ frozen is non-empty)
 *   regenerated to hide it  -> THIS GATE reds       (the artifact grew against its baseline)
 *
 * A ratchet held only by 419 is defeated by re-running `--write`, which is a one-word fix a
 * hurried author reaches for precisely when the gate is trying to stop them. So the
 * shrink-only property is checked HERE, against the artifact's own git baseline, where
 * re-running the generator cannot help.
 *
 * ⛔ BUT IT IS A BRANCH-POINT RATCHET, AND THAT BOUND IS REAL. The baseline is
 * `merge-base HEAD <ref>`, so when HEAD IS the baseline ref's tip — a growth committed
 * DIRECTLY on `main`, which this repo does do — the merge-base is HEAD and the artifact
 * compares equal to ITSELF: the arm returns clean and is VACUOUS for that case. It holds for
 * any growth on a unit branch (the normal path, and where the pre-merge gate runs) and for an
 * UNCOMMITTED growth on `main`. ⭐ 419 is the arm that catches the committed-on-`main` case,
 * because it compares the artifact against the LIVE CATALOG and does not care about git.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⛔ WHAT THIS GATE DOES **NOT** PROVE, STATED SO A GREEN IS NOT OVER-READ
 *
 * It never opens a database — every gate in the `lint` chain is a text comparison over
 * committed files, because a gate needing Docker cannot run in the chain at all
 * (`check-budget-anchor.mjs` states the doctrine; gates 15 and 17 live by it). The claim
 * splits into two composable halves:
 *
 *   artifact == its own anchor, and shrinks only   <- THIS GATE      (`npm run lint`)
 *   artifact == the live catalog                   <- pgTAP 419      (`npm run test:db`)
 *
 * ⛔ A green here means the committed bytes are self-consistent and did not grow. It says
 * NOTHING about whether they still match the catalog — that verdict is 419's, and its
 * ABSENCE is not this gate's coverage. The summary line prints that bound on every run.
 *
 * ⛔⛔ AND D4 IS A TWO-CLAUSE CONVENTION OF WHICH THIS GATES ONE. D4 is `set search_path = ''`
 * **with schema-qualified object references**. Nothing here, and nothing in 419, reads a single
 * function BODY. That half is gated ELSEWHERE, by pgTAP `421_definer_qualified_body.sql`, which
 * hands every empty-path DEFINER to Postgres itself — `plpgsql_check_function_tb` for the
 * plpgsql members, a re-execution of `pg_get_functiondef` for the `language sql` ones (because
 * `ALTER FUNCTION … SET search_path` never re-validates a body) — and counts `42P01`/`42883` as
 * findings. ⛔ 421's FIRST STATED BOUND: a body that builds SQL with `execute` is opaque to both
 * arms, so 421 holds that population at ZERO rather than claiming to check it.
 * ⛔ AND ITS SECOND: the temp-table EXCLUSION. A `42P01` on a relation the SAME body creates by
 * `create temp table` is excused — the four ADR 0208 D6 DEFINERs read their own temp tables
 * unqualified by design — and nothing else is: not another body's temp table, not a name that
 * merely prefixes one, not a `create temp table` written in a comment or a SINGLE-QUOTED string
 * literal — dollar-quoted text is NOT scrubbed, and 421's header states that bound and why no
 * stripper is bolted on (`421 § 3d`/`§ 3f`/`§ 3g` hold those three halves). A reader who knows only the `execute` bound
 * comes away thinking every `42P01` in the population is gated, and a whole class is not.
 * That matters because the clause is not cosmetic — under `search_path = ''`
 * `pg_temp` is still searched FIRST for relation names, and `anon`/`authenticated`/`service_role`/
 * `authenticator` all hold database TEMP (4 of 4, ADR 0208 D5's census), so an unqualified
 * relation reference inside an empty-path DEFINER remains shadowable by a temp object. The empty
 * path narrows the exposure; the qualified body closes it.
 * ⛔ 421 lives in `npm run test:db`, NOT in this chain: it opens a database, which no `lint` gate
 * may. Its absence from a green `npm run lint` is not this gate's coverage.
 * FUP-DEFINER-SEARCH-PATH-NARROW-FIX-QUALIFIED-BODY-CLAUSE-OF-D4-IS-UNGATED: closed by 421.
 *
 * ⛔ And the frozen set is a set of NAMES. A member that changes from one non-empty path to
 * a DIFFERENT non-empty path keeps its name and moves nothing here. That is the AC-1 shape
 * as specified; `414` holds the resolvability property over the same population, and D4's
 * "may not grow" is about the population, not about each member's value.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CENSUS = join(ROOT, 'scripts', 'definer-search-path-census.sql')
const OUT_REL = 'supabase/tests/vectors/definer_search_path_freeze.psql'
const OUT = join(ROOT, ...OUT_REL.split('/'))
const MIRROR = join(ROOT, 'supabase', 'tests', '419_definer_search_path_freeze.sql')
const BLOCK = 'definer_nonempty_domain'
const TABLE = 'definer_search_path_freeze'

const normalise = (s) => s.replace(/\r\n/g, '\n')
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

/**
 * ⚠ CODE-POINT ORDER, NOT THE DATABASE'S DEFAULT COLLATION. 419 pins an md5 over
 * `string_agg(sig, '|' order by sig collate "C")`; `collate "C"` IS code-point order, and
 * JavaScript's `<` on strings is too. Under the cluster's default collation Postgres orders
 * `_` differently, and the md5 of a byte-identical set would disagree with this one.
 */
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

const digestsOf = (sigs) => ({
  rows: sigs.length,
  sha: sha256(sigs.join('\n') + '\n'),
  md: md5(sigs.join('|')),
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// The census block — ONE home, extracted by text (scripts/data-access-census.sql's shape)
// ═══════════════════════════════════════════════════════════════════════════════════════

export function extractBlock(sqlText, name) {
  const t = normalise(sqlText)
  const begin = `-- >>> BEGIN ${name} <<<`
  const end = `-- >>> END ${name} <<<`
  const a = t.indexOf(begin)
  const b = t.indexOf(end)
  if (a < 0 || b < 0 || b < a) throw new Error(`no ${begin} … ${end} block`)
  return t.slice(a + begin.length, b).trim()
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The catalog half — docker exec psql, the only connection idiom this repo has
// ═══════════════════════════════════════════════════════════════════════════════════════

function dbContainer() {
  const names = execFileSync('docker', ['ps', '--filter', 'name=supabase_db', '--format', '{{.Names}}'], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (names.length === 0) throw new Error('no running supabase_db container — --write needs the local stack')
  let ref = null
  const cfg = join(ROOT, 'supabase', 'config.toml')
  if (existsSync(cfg)) {
    const m = normalise(readFileSync(cfg, 'utf8')).match(/^project_id\s*=\s*"([^"]+)"/m)
    if (m) ref = m[1]
  }
  const exact = ref ? names.find((n) => n === `supabase_db_${ref}`) : null
  if (exact) return exact
  if (names.length > 1) {
    throw new Error(
      `${names.length} supabase_db containers are running (${names.join(', ')}) and none matches ` +
        `this project's ref (${ref ?? 'unknown'}). Refusing to freeze an ambiguous stack.`,
    )
  }
  return names[0]
}

/** ⛔ `ON_ERROR_STOP=1` always: without it psql skips a failing statement and STILL EXITS 0,
 *  so a census can silently narrow and the freeze would shrink for the wrong reason. */
function readCatalog() {
  const block = extractBlock(readFileSync(CENSUS, 'utf8'), BLOCK)
  const sql = `select 'SIG|' || d.sig from (\n${block}\n) d where d.sp_nonempty order by d.sig collate "C";\n`
  const out = execFileSync(
    'docker',
    ['exec', '-i', dbContainer(), 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { input: sql, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  const sigs = []
  for (const line of normalise(out).split('\n')) {
    if (line.length === 0) continue
    if (!line.startsWith('SIG|')) throw new Error(`census emitted an unrecognised line: ${line.slice(0, 120)}`)
    sigs.push(line.slice(4))
  }
  // ⚠ A census whose parts do not sum is wrong, and an EMPTY one is the failure that reads
  // most like success: a freeze of nothing makes 419 § 1a red loudly, but a freeze of
  // nothing written by a hurried `--write` during a convergence would read as "it shrank".
  if (sigs.length === 0) throw new Error('census produced ZERO non-empty-path DEFINERs — refusing to write')
  if (new Set(sigs).size !== sigs.length) throw new Error('census produced duplicate signatures — refusing to write')
  return sigs
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Render / parse
// ═══════════════════════════════════════════════════════════════════════════════════════

export function render(sigs) {
  const { rows, sha, md } = digestsOf(sigs)
  return (
    `-- GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    `-- Source:    the LIVE catalog — pg_proc.prosecdef × proconfig, schemas app/public/authz\n` +
    `-- Domain:    scripts/definer-search-path-census.sql, block \`${BLOCK}\`\n` +
    `-- Generator: scripts/gen-definer-search-path-freeze.mjs  (--write / --check / --self-test)\n` +
    `-- Consumer:  supabase/tests/419_definer_search_path_freeze.sql\n` +
    `-- anchor: definer-search-path-freeze rows=${rows} sha256=${sha} md5=${md}\n` +
    `--\n` +
    `-- The NON-EMPTY \`search_path\` population of SECURITY DEFINER functions in app/public/authz,\n` +
    `-- frozen as a name set that may only SHRINK (ADR 0208 D4/D5).\n` +
    `--\n` +
    `-- ⛔ REGENERATING THIS FILE IS NOT A WAY TO GET PAST A RED. \`--write\` is legitimate in\n` +
    `-- exactly one situation: a migration has CONVERGED one or more members to \`set search_path\n` +
    `-- = ''\`, and the resulting diff is a PURE DELETION. Gate 18 resolves this file's git\n` +
    `-- baseline and refuses any diff that adds a name — so a new non-empty DEFINER absorbed by a\n` +
    `-- re-run reds there instead of here.\n` +
    `--\n` +
    `-- ⚠ \`.psql\`, NOT \`.sql\`, AND THE EXTENSION IS LOAD-BEARING — do not "tidy" it. \`pg_prove\`\n` +
    `-- collects every \`*.sql\` under the tests directory AS A TEST; this fixture declares no plan\n` +
    `-- and emits no TAP, so being collected fails the whole run with "No plan found in TAP\n` +
    `-- output". \`\\ir\` does not care about the extension.\n` +
    `--\n` +
    `-- ⚠ Ordered by \`sig collate "C"\` — code-point order, which is what 419's md5 pin and the\n` +
    `-- generator's JavaScript sort both assume. Editing this file by hand REDS gate 18.\n` +
    `create temp table ${TABLE} on commit drop as\n` +
    `  select * from (values\n` +
    sigs.map((s) => `    ('${s.replace(/'/g, "''")}')`).join(',\n') +
    `\n  ) as t(sig);\n`
  )
}

export function parseArtifact(text) {
  const t = normalise(text)
  const anchors = t.split('\n').filter((l) => l.startsWith('-- anchor: definer-search-path-freeze '))
  const sigs = []
  const body = t.slice(t.indexOf('select * from (values'))
  for (const m of body.matchAll(/^ {4}\('(.*)'\),?$/gm)) sigs.push(m[1].replace(/''/g, "'"))
  return { anchors, sigs }
}

export function parseAnchor(line) {
  const rows = line.match(/\brows=(\d+)\b/)
  const sha = line.match(/\bsha256=([0-9a-f]{64})\b/)
  const md = line.match(/\bmd5=([0-9a-f]{32})\b/)
  return { rows: rows ? Number(rows[1]) : null, sha: sha ? sha[1] : null, md: md ? md[1] : null }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The checkers. Each is pure over text so --self-test can prove it able to fail.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** P2 + A + B + C — the artifact agrees with its own anchor, is sorted and is unique. */
export function checkArtifact(text) {
  const f = []
  const { anchors, sigs } = parseArtifact(text)
  // ⛔ ZERO anchors AND TWO anchors are both findings — gate 15's P-check shape: a second
  // anchor is how a "fix" gets bolted on beside the one being gated.
  if (anchors.length !== 1) {
    f.push(`${OUT_REL}: expected exactly 1 anchor line, found ${anchors.length}.`)
    return f
  }
  const a = parseAnchor(anchors[0])
  if (a.rows === null || a.sha === null || a.md === null) {
    f.push(`${OUT_REL}: the anchor is missing one of rows= / sha256= / md5=.`)
    return f
  }
  if (sigs.length === 0) {
    f.push(`${OUT_REL}: no signature rows parsed — a freeze of nothing is not a shrink.`)
    return f
  }
  const d = digestsOf(sigs)
  if (a.rows !== d.rows) f.push(`${OUT_REL}: anchor says rows=${a.rows}, the file holds ${d.rows}.`)
  if (a.sha !== d.sha) f.push(`${OUT_REL}: anchor sha256 does not match the rows — hand-edited, or stale.`)
  if (a.md !== d.md) f.push(`${OUT_REL}: anchor md5 does not match the rows — hand-edited, or stale.`)
  const sorted = [...sigs].sort(byCodePoint)
  if (sigs.some((s, i) => s !== sorted[i])) f.push(`${OUT_REL}: rows are not in code-point order.`)
  if (new Set(sigs).size !== sigs.length) f.push(`${OUT_REL}: duplicate signatures.`)
  return f
}

/** D + E — the pgTAP mirror pins the same numbers AS LITERALS, and splices the same domain.
 *  ⭐ The literals are read from the lines pgTAP actually asserts, never from a comment
 *  restating them, so two comments cannot agree while the assertion says otherwise. */
export function checkMirror(mirrorText, artifactText, censusText) {
  const f = []
  const { anchors } = parseArtifact(artifactText)
  if (anchors.length !== 1) return f // checkArtifact already reported it
  const a = parseAnchor(anchors[0])
  const lines = normalise(mirrorText).split('\n')

  const pinned = (marker, re) => {
    const i = lines.findIndex((l) => l.includes(marker))
    if (i < 0) return { ok: false, why: `the mirror has no assertion carrying "${marker}"` }
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const m = lines[j].match(re)
      if (m) return { ok: true, value: m[1] }
    }
    return { ok: false, why: `no literal matching ${re} in the 5 lines above "${marker}"` }
  }

  const rows = pinned('§ 0c ROWS PIN', /^\s*(\d+),\s*$/)
  if (!rows.ok) f.push(`419: ${rows.why}.`)
  else if (Number(rows.value) !== a.rows) {
    f.push(`419 pins rows=${rows.value}; ${OUT_REL}'s anchor says ${a.rows}. Regenerate, then move the pin.`)
  }

  const cm = pinned('§ 0d CONTENT PIN', /^\s*'([0-9a-f]{32})',\s*$/)
  if (!cm.ok) f.push(`419: ${cm.why}.`)
  else if (cm.value !== a.md) {
    f.push(`419 pins md5=${cm.value}; ${OUT_REL}'s anchor says ${a.md}. Regenerate, then move the pin.`)
  }

  try {
    if (extractBlock(mirrorText, BLOCK) !== extractBlock(censusText, BLOCK)) {
      f.push(
        `419's spliced \`${BLOCK}\` block is not byte-identical to scripts/definer-search-path-census.sql. ` +
          `One home for the domain: edit the census file and re-splice.`,
      )
    }
  } catch (e) {
    f.push(`419: ${String(e.message)}`)
  }
  return f
}

/** F — the RATCHET. Current ⊆ baseline: removals are the legal shrink, additions are the
 *  finding. Returns {findings, note} — `note` is printed whatever the verdict, because a
 *  silent "nothing to compare" is how an unproven arm reads as a clean one. */
export function checkShrinkOnly(currentText, baselineText) {
  if (baselineText === null) {
    return { findings: [], note: 'GENESIS — the artifact does not exist at the baseline; nothing to ratchet against yet.' }
  }
  const cur = new Set(parseArtifact(currentText).sigs)
  const base = new Set(parseArtifact(baselineText).sigs)
  if (base.size === 0) {
    return { findings: [`the baseline artifact parsed to ZERO rows — refusing to call that a shrink.`], note: 'baseline unparseable' }
  }
  const added = [...cur].filter((s) => !base.has(s)).sort(byCodePoint)
  const removed = [...base].filter((s) => !cur.has(s)).sort(byCodePoint)
  const note = `baseline ${base.size} -> ${cur.size} (removed ${removed.length}, added ${added.length})` +
    (removed.length ? `; converged: ${removed.join(', ')}` : '')
  if (added.length === 0) return { findings: [], note }
  return {
    findings: [
      `THE FREEZE GREW by ${added.length}: ${added.join(', ')}.\n` +
        `  ADR 0208 D4 forbids a new or touched SECURITY DEFINER on a non-empty search_path. ` +
        `Converge it to \`set search_path = ''\` with a schema-qualified body — ` +
        `⛔ re-running --write to absorb it is the move this arm exists to refuse.`,
    ],
    note,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// git baseline
// ═══════════════════════════════════════════════════════════════════════════════════════

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** ⛔ Exit 2, never a silent pass, when no baseline resolves. An escape hatch for the
 *  unmeasurable also silences the measured: clean / UNPROVEN / dirty is a three-way
 *  partition here, and `npm run lint` chains with `&&` so a 2 reds the chain. */
function resolveBaseline() {
  // ⚠ LOCAL `main` FIRST, and that is not the obvious order. This repo routinely leaves `main`
  // unpushed for several units (the phase-ledger commits say so), so `origin/main` is often many
  // commits BEHIND and its merge-base yields an older, LARGER frozen set — against which a set
  // that grew since could still pass as a subset. The tighter baseline is the newer one.
  // `origin/main` stays as the fallback for a fresh clone or CI checkout with no local branch.
  for (const cand of ['main', 'origin/main']) {
    let ok = true
    try {
      git(['rev-parse', '--verify', '--quiet', `${cand}^{commit}`])
    } catch {
      ok = false
    }
    if (!ok) continue
    let base = cand
    try {
      base = git(['merge-base', 'HEAD', cand]).trim() || cand
    } catch {
      /* shallow clone or unrelated history: compare against the tip instead */
    }
    try {
      return { ref: `${cand} (${base.slice(0, 12)})`, text: git(['show', `${base}:${OUT_REL}`]) }
    } catch {
      return { ref: `${cand} (${base.slice(0, 12)})`, text: null } // absent at the baseline = GENESIS
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — every checker proven able to fail, on every invocation of --self-test.
// ═══════════════════════════════════════════════════════════════════════════════════════

function selfTest() {
  const fails = []
  const red = (n, f) => {
    if (f.length === 0) fails.push(n)
  }
  const green = (n, f) => {
    if (f.length !== 0) fails.push(`${n} (false positive: ${f[0]})`)
  }
  const good = render(['app.a(uuid)', 'app.b(uuid)', 'public.c()'])
  const census = readFileSync(CENSUS, 'utf8')

  green('artifact-clean', checkArtifact(good))
  red('artifact-no-anchor', checkArtifact(good.replace(/^-- anchor: .*$/m, '-- anchor: none')))
  red('artifact-two-anchors', checkArtifact(good.replace(/^(-- anchor: .*)$/m, '$1\n$1')))
  red('artifact-rows-drift', checkArtifact(good.replace(/rows=3/, 'rows=4')))
  red('artifact-sha-drift', checkArtifact(good.replace(/sha256=[0-9a-f]{64}/, `sha256=${'0'.repeat(64)}`)))
  red('artifact-md5-drift', checkArtifact(good.replace(/md5=[0-9a-f]{32}/, `md5=${'0'.repeat(32)}`)))
  // A row swapped for another row of the SAME length: rows= still agrees, the digests move.
  red('artifact-row-swapped', checkArtifact(good.replace("    ('app.b(uuid)')", "    ('app.z(uuid)')")))
  red('artifact-unsorted', checkArtifact(render(['app.b(uuid)', 'app.a(uuid)']).replace(/^( {4}\('app\.b\(uuid\)'\)),$/m, '$1,')))

  const mirror = readFileSync(MIRROR, 'utf8')
  const artifact = existsSync(OUT) ? readFileSync(OUT, 'utf8') : good
  green('mirror-clean', checkMirror(mirror, artifact, census))
  red('mirror-rows-pin-moved', checkMirror(mirror.replace(/^(\s*)(\d+),$/m, '$1999999,'), artifact, census))
  red('mirror-block-drift', checkMirror(mirror.replace("p.prosecdef\n-- >>> END", "p.prosecdef and false\n-- >>> END"), artifact, census))
  red('mirror-pin-assertion-gone', checkMirror(mirror.replace('§ 0c ROWS PIN', '§ 0c rows pin'), artifact, census))

  green('shrink-none', checkShrinkOnly(good, good).findings)
  green('shrink-legal', checkShrinkOnly(render(['app.a(uuid)']), good).findings)
  red('shrink-grew', checkShrinkOnly(render(['app.a(uuid)', 'app.b(uuid)', 'app.d(uuid)', 'public.c()']), good).findings)
  red('shrink-baseline-empty', checkShrinkOnly(good, good.replace(/ {4}\('[^']*'\),?\n/g, '')).findings)

  if (fails.length) {
    console.error(`gen-definer-search-path-freeze --self-test: ${fails.length} checker(s) not proven able to fail:`)
    for (const x of fails) console.error(`  - ${x}`)
    process.exit(1)
  }
  console.log(`gen-definer-search-path-freeze --self-test: OK (17 cases; every checker red on its own mutation)`)
  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// main
// ═══════════════════════════════════════════════════════════════════════════════════════

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) selfTest()

if (argv.includes('--write')) {
  let sigs
  try {
    sigs = readCatalog()
  } catch (e) {
    console.error(`gen-definer-search-path-freeze --write: ${String(e.message)}`)
    process.exit(2)
  }
  const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null
  writeFileSync(OUT, render(sigs), 'utf8')
  const d = digestsOf(sigs)
  console.log(`gen-definer-search-path-freeze: wrote ${d.rows} signatures -> ${OUT_REL}`)
  console.log(`gen-definer-search-path-freeze: 419 must pin  rows=${d.rows}  md5=${d.md}`)
  if (before !== null) {
    const { note } = checkShrinkOnly(readFileSync(OUT, 'utf8'), before)
    console.log(`gen-definer-search-path-freeze: against the PREVIOUS file on disk — ${note}`)
  }
  console.log(`⛔ The committed diff must be a PURE DELETION. Gate 18 checks that against git, not against this line.`)
  process.exit(0)
}

if (argv.includes('--check')) {
  if (!existsSync(OUT)) {
    console.error(`gen-definer-search-path-freeze: ${OUT_REL} is missing — run --write.`)
    process.exit(1)
  }
  if (!existsSync(MIRROR)) {
    console.error(`gen-definer-search-path-freeze: the pgTAP mirror 419 is missing — the freeze has no gate.`)
    process.exit(1)
  }
  const artifact = readFileSync(OUT, 'utf8')
  const findings = [
    ...checkArtifact(artifact),
    ...checkMirror(readFileSync(MIRROR, 'utf8'), artifact, readFileSync(CENSUS, 'utf8')),
  ]
  let note = 'not reached'
  if (findings.length === 0) {
    const base = resolveBaseline()
    if (base === null) {
      console.error(
        `gen-definer-search-path-freeze: UNPROVEN — neither origin/main nor main resolves, so the ` +
          `shrink-only arm could not run. ⛔ This is exit 2, not a pass: an unmeasured ratchet and a ` +
          `clean one are not the same verdict.`,
      )
      process.exit(2)
    }
    const r = checkShrinkOnly(artifact, base.text)
    findings.push(...r.findings)
    note = `${r.note} [baseline ${base.ref}]`
  }
  if (findings.length) {
    console.error(`gen-definer-search-path-freeze: ${findings.length} finding(s):`)
    for (const x of findings) console.error(`  - ${x}`)
    process.exit(1)
  }
  const { rows } = parseAnchor(parseArtifact(artifact).anchors[0])
  console.log(
    `gen-definer-search-path-freeze: in sync (${rows} frozen non-empty DEFINER paths; ${note}). ` +
      `⛔ Bound: this gate never opened a database — "matches the live catalog" is pgTAP 419's verdict, in npm run test:db.`,
  )
  process.exit(0)
}

console.error('usage: gen-definer-search-path-freeze.mjs --write | --check | --self-test')
process.exit(2)
