#!/usr/bin/env node
/**
 * GATE 19 — `npm run lint:role-manifest`.
 *
 * Exit: 0 clean | 1 a finding | 2 the checker itself cannot run.
 *
 *   node scripts/gen-role-manifest.mjs --write      # regenerate from the LIVE catalog
 *   node scripts/gen-role-manifest.mjs --check      # gate 19, no database
 *   node scripts/gen-role-manifest.mjs --self-test  # prove every checker can fail
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * ADR 0207 D4 turns the ROLE_MANIFEST ↔ `authz.roles` binding into a GENERATED-ARTIFACT
 * gate on ADR 0197 D4's pattern. Until this file, the binding's SQL side was a block of
 * ELEVEN HAND-TYPED ROWS inside `supabase/tests/411_ae48_role_manifest_db_gate.sql`,
 * between `MANIFEST-SNAPSHOT-BEGIN`/`END` markers, and 411's own comment admitted the
 * problem: *"Keep this block in sync with ROLE_MANIFEST BY HAND — both drift directions
 * are gated, but nothing enforces the edit itself; a code review noticing 'ROLE_MANIFEST
 * changed, did 411 move too' is still the first line of defense."* A human noticing is
 * not a gate. The rows are now generated from the catalog and committed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⛔ THE TWO HALVES, AND WHY NEITHER IS THE VERDICT ALONE (ADR 0197 D4, restated because
 * a reader who knows only one of them over-reads a green)
 *
 *   artifact == the TypeScript manifest   <- THIS GATE   (`npm run lint`, text only)
 *   artifact == the live `authz.roles`    <- pgTAP 411    (`npm run test:db`)
 *
 * Chained, the two hops prove ROLE_MANIFEST agrees with the catalog without either hop
 * acquiring the other's dependency. ⛔ A green HERE says the committed bytes agree with
 * the committed TypeScript. It says NOTHING about whether either still matches the
 * database — that verdict is 411's, and its ABSENCE is not this gate's coverage. The
 * summary line prints that bound on every run.
 *
 * ⛔ THIS GATE NEVER OPENS A DATABASE. Every gate in the `lint` chain is a text
 * comparison over committed files, because a gate needing Docker cannot run in the chain
 * at all (`check-budget-anchor.mjs` states the doctrine; gates 15, 17 and 18 live by it).
 * Only `--write` talks to Postgres.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ WHAT THIS GATE DOES **NOT** COVER, STATED SO A GREEN IS NOT OVER-READ
 *
 * The artifact carries the five columns BOTH sides can speak about:
 * `code`, `scope_kind`, `session_selectable`, `system_managed`, `state`. Of those, the
 * TypeScript manifest declares only the first three, so:
 *
 *   · `system_managed` and `state` are compared HERE against nothing. They are pinned by
 *     411 against the live catalog and by this file's own anchor digest against a hand
 *     edit — so a migration that changes either, without a regeneration, reds in 411.
 *     ⛔ But there is no TypeScript twin to disagree with them, and that is not an
 *     oversight to "fix" by inventing manifest fields no TypeScript consumer reads.
 *
 *   · `label`, `branch`, `branchEmptyFallback` and the manifest's ORDER (which IS the
 *     landing precedence) have NO catalog twin at all — Postgres has no opinion about
 *     pt-BR wording or about where a role lands — so they are absent from the artifact
 *     and are gated by `src/lib/role/role-catalog.test.ts` instead (manifest coverage,
 *     and the assertion that roles sharing a branch declare the same fallback).
 *     ⛔ Their absence from the artifact is deliberate, not a gap this file should close:
 *     a pin is only worth having where two independent sources can disagree.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THE ARTIFACT IS GENERATED FROM THE CATALOG AND NOT FROM THE TYPESCRIPT
 *
 * ADR 0207 D4: *"generated from migration-owned catalog data."* It matters which way the
 * arrow points. Generated from the catalog, a migration that changes a role is followed
 * by `--write`, and THIS gate then reds until the TypeScript is brought along — the
 * database leads and the mirror follows, which is the direction the authority actually
 * runs. Generated from the TypeScript, `--check` would be green the instant the artifact
 * was written and the drift would sit in 411 alone, collapsing a two-arm gate into one.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_REL = 'supabase/tests/vectors/role_manifest.psql'
const OUT = join(ROOT, ...OUT_REL.split('/'))
const TS_REL = 'src/lib/role/role-catalog.ts'
const TS_SRC = join(ROOT, ...TS_REL.split('/'))
const MIRROR_REL = 'supabase/tests/411_ae48_role_manifest_db_gate.sql'
const MIRROR = join(ROOT, ...MIRROR_REL.split('/'))
const TABLE = 'role_manifest_pin'
const TS_BEGIN = '// ROLE-MANIFEST-BEGIN'
const TS_END = '// ROLE-MANIFEST-END'

const normalise = (s) => s.replace(/\r\n/g, '\n')
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex')
const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex')

/**
 * ⚠ CODE-POINT ORDER, NOT THE DATABASE'S DEFAULT COLLATION — the trap gate 17 was bitten
 * by and gate 18 pre-empted. 411 pins an md5 over `string_agg(… order by code collate
 * "C")`; `collate "C"` IS code-point order, and JavaScript's `<` on strings is too. Under
 * the cluster's default collation Postgres orders `_` differently, and the md5 of a
 * byte-identical set would disagree with this one.
 */
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** One row's canonical text. The digest input and the pgTAP pin must agree BYTE FOR BYTE,
 *  so there is exactly one function that renders a row and both sides call it. */
const rowText = (r) =>
  `${r.code}|${r.scope_kind}|${r.session_selectable}|${r.system_managed}|${r.state}`

const digestsOf = (rows) => ({
  rows: rows.length,
  sha: sha256(rows.map(rowText).join('\n') + '\n'),
  md: md5(rows.map(rowText).join('|')),
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// The TypeScript half — parsed as PLAIN TEXT. No loader, no `tsx`, no database.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Pull `{ code, scopeKind, sessionSelectable }` out of ROLE_MANIFEST's marked block.
 *
 * ⛔ THROWS rather than returning an empty list. A parser that silently finds NOTHING
 * makes every comparison downstream vacuously true — the exact shape 411's own header
 * warned about for its predecessor regex ("the vitest side guards against a parse that
 * finds zero rows; a parse that finds the WRONG rows would not be caught"). Zero rows,
 * a missing marker and an entry missing a field are all findings here, not silence.
 */
export function extractTsManifest(tsText) {
  const t = normalise(tsText)
  const a = t.indexOf(TS_BEGIN)
  const b = t.indexOf(TS_END)
  if (a < 0 || b < 0 || b < a) {
    throw new Error(
      `${TS_REL}: could not find the ${TS_BEGIN} … ${TS_END} markers. Keep them exactly — ` +
        `this gate parses that block as plain text.`,
    )
  }
  const block = t.slice(a + TS_BEGIN.length, b)
  const objects = block.match(/\{[^{}]*\}/g) ?? []
  const rows = []
  for (const o of objects) {
    const code = o.match(/\bcode:\s*"([^"]+)"/)
    const scope = o.match(/\bscopeKind:\s*"([^"]+)"/)
    const sel = o.match(/\bsessionSelectable:\s*(true|false)\b/)
    if (!code || !scope || !sel) {
      throw new Error(
        `${TS_REL}: a ROLE_MANIFEST entry is missing code / scopeKind / sessionSelectable ` +
          `(near ${o.slice(0, 60).replace(/\s+/g, ' ')}…).`,
      )
    }
    rows.push({
      code: code[1],
      scope_kind: scope[1],
      session_selectable: sel[1] === 'true',
    })
  }
  if (rows.length === 0) {
    throw new Error(`${TS_REL}: parsed ZERO ROLE_MANIFEST entries — a comparison against an empty manifest is vacuous.`)
  }
  return rows
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
        `this project's ref (${ref ?? 'unknown'}). Refusing to pin an ambiguous stack.`,
    )
  }
  return names[0]
}

/** ⛔ `ON_ERROR_STOP=1` always: without it psql skips a failing statement and STILL EXITS 0,
 *  so the roster could silently narrow and the pin would be written over a partial read. */
function readCatalog() {
  const sql =
    `select 'ROW|' || r.code || '|' || r.allowed_scope_kind::text || '|' || r.session_selectable ` +
    `|| '|' || r.system_managed || '|' || r.state::text\n` +
    `  from authz.roles r order by r.code collate "C";\n`
  const out = execFileSync(
    'docker',
    ['exec', '-i', dbContainer(), 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  )
  const rows = []
  for (const line of normalise(out).split('\n')) {
    if (line.length === 0) continue
    if (!line.startsWith('ROW|')) throw new Error(`the catalog read emitted an unrecognised line: ${line.slice(0, 120)}`)
    const [code, scope_kind, sel, sysm, state] = line.slice(4).split('|')
    // ⚠ `'x' || <boolean>` yields the TEXT output of boolean — `true`/`false`, NOT psql's
    // `-qAt` column rendering `t`/`f`. This parser read `t` on its first live run, so every
    // row came back `false` on both flags. ⭐ MEASURED, not merely fixed: `--check` caught
    // it immediately (11 findings, one per role, `session_selectable=false` against
    // `sessionSelectable=true`), which is the cross-language arm doing exactly the job it
    // exists for — a defect in the GENERATOR, found by the gate that reads its output.
    const bool = (v, field) => {
      if (v === 'true') return true
      if (v === 'false') return false
      throw new Error(`the catalog read returned ${JSON.stringify(v)} for ${field} on role "${code}" — expected true/false`)
    }
    rows.push({
      code,
      scope_kind,
      session_selectable: bool(sel, 'session_selectable'),
      system_managed: bool(sysm, 'system_managed'),
      state,
    })
  }
  // ⚠ A census whose parts do not sum is wrong, and an EMPTY one is the failure that reads
  // most like success — a pin of nothing makes 411 red loudly, but only after someone runs
  // the DB gate, and this gate would have called it clean in the meantime.
  if (rows.length === 0) throw new Error('authz.roles returned ZERO rows — refusing to write')
  if (new Set(rows.map((r) => r.code)).size !== rows.length) throw new Error('duplicate role codes — refusing to write')
  return rows
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Render / parse
// ═══════════════════════════════════════════════════════════════════════════════════════

export function render(rows) {
  const { rows: n, sha, md } = digestsOf(rows)
  return (
    `-- GENERATED FILE — DO NOT EDIT BY HAND.\n` +
    `-- Source:    the LIVE catalog — authz.roles\n` +
    `-- Generator: scripts/gen-role-manifest.mjs  (--write / --check / --self-test)\n` +
    `-- Consumers: supabase/tests/411_ae48_role_manifest_db_gate.sql  (artifact == the catalog)\n` +
    `--            scripts/gen-role-manifest.mjs --check              (artifact == the TS manifest)\n` +
    `-- anchor: role-manifest rows=${n} sha256=${sha} md5=${md}\n` +
    `--\n` +
    `-- The role catalog, pinned. ⛔ NEITHER CONSUMER IS THE VERDICT ALONE (ADR 0197 D4):\n` +
    `-- gate 19 proves these bytes equal \`src/lib/role/role-catalog.ts\`'s ROLE_MANIFEST and\n` +
    `-- never opens a database; 411 proves they equal \`authz.roles\` and is the only arm that\n` +
    `-- does. Chained, ROLE_MANIFEST agrees with the catalog.\n` +
    `--\n` +
    `-- ⛔ \`system_managed\` and \`state\` have NO TypeScript twin — gate 19 cannot check them,\n` +
    `-- and 411 is their only reader. \`label\`, \`branch\` and the manifest's ORDER have no\n` +
    `-- catalog twin and are deliberately absent here; role-catalog.test.ts gates those.\n` +
    `--\n` +
    `-- ⚠ \`.psql\`, NOT \`.sql\`, AND THE EXTENSION IS LOAD-BEARING — do not "tidy" it.\n` +
    `-- \`pg_prove\` collects every \`*.sql\` under the tests directory AS A TEST; this fixture\n` +
    `-- declares no plan and emits no TAP, so being collected fails the whole run with "No plan\n` +
    `-- found in TAP output". \`\\ir\` does not care about the extension.\n` +
    `--\n` +
    `-- ⚠ Ordered by \`code collate "C"\` — code-point order, which is what 411's md5 pin and\n` +
    `-- the generator's JavaScript sort both assume. Editing this file by hand REDS gate 19.\n` +
    `create temp table ${TABLE} (\n` +
    `  code text, scope_kind text, session_selectable boolean, system_managed boolean, state text\n` +
    `) on commit drop;\n` +
    `insert into ${TABLE} (code, scope_kind, session_selectable, system_managed, state) values\n` +
    rows
      .map(
        (r) =>
          `  ('${r.code.replace(/'/g, "''")}', '${r.scope_kind.replace(/'/g, "''")}', ` +
          `${r.session_selectable}, ${r.system_managed}, '${r.state.replace(/'/g, "''")}')`,
      )
      .join(',\n') +
    `;\n`
  )
}

export function parseArtifact(text) {
  const t = normalise(text)
  const anchors = t.split('\n').filter((l) => l.startsWith('-- anchor: role-manifest '))
  const rows = []
  const i = t.indexOf(`insert into ${TABLE}`)
  const body = i < 0 ? '' : t.slice(i)
  for (const m of body.matchAll(/^ {2}\('(.*?)', '(.*?)', (true|false), (true|false), '(.*?)'\),?;?$/gm)) {
    rows.push({
      code: m[1].replace(/''/g, "'"),
      scope_kind: m[2].replace(/''/g, "'"),
      session_selectable: m[3] === 'true',
      system_managed: m[4] === 'true',
      state: m[5].replace(/''/g, "'"),
    })
  }
  return { anchors, rows }
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

/** A — the artifact agrees with its own anchor, is sorted and is unique. */
export function checkArtifact(text) {
  const f = []
  const { anchors, rows } = parseArtifact(text)
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
  if (rows.length === 0) {
    f.push(`${OUT_REL}: no role rows parsed — a pin of nothing is not a pin.`)
    return f
  }
  const d = digestsOf(rows)
  if (a.rows !== d.rows) f.push(`${OUT_REL}: anchor says rows=${a.rows}, the file holds ${d.rows}.`)
  if (a.sha !== d.sha) f.push(`${OUT_REL}: anchor sha256 does not match the rows — hand-edited, or stale.`)
  if (a.md !== d.md) f.push(`${OUT_REL}: anchor md5 does not match the rows — hand-edited, or stale.`)
  const sorted = [...rows].sort((x, y) => byCodePoint(x.code, y.code))
  if (rows.some((r, i) => r.code !== sorted[i].code)) f.push(`${OUT_REL}: rows are not in code-point order.`)
  if (new Set(rows.map((r) => r.code)).size !== rows.length) f.push(`${OUT_REL}: duplicate role codes.`)
  return f
}

/** B — THE CROSS-LANGUAGE HALF: the artifact equals the TypeScript manifest, on the three
 *  columns TypeScript declares. ⛔ Compared as a SET keyed on code, in BOTH directions, so
 *  a role present on one side only is named rather than quietly skipped by a join. */
export function checkTsAgreement(artifactText, tsText) {
  const f = []
  let ts
  try {
    ts = extractTsManifest(tsText)
  } catch (e) {
    return [String(e.message)]
  }
  const art = parseArtifact(artifactText).rows
  if (art.length === 0) return f // checkArtifact already reported it

  const artByCode = new Map(art.map((r) => [r.code, r]))
  const tsByCode = new Map(ts.map((r) => [r.code, r]))

  for (const code of [...tsByCode.keys()].sort(byCodePoint)) {
    if (!artByCode.has(code)) {
      f.push(`role "${code}" is in ${TS_REL}'s ROLE_MANIFEST but not in ${OUT_REL}. Run --write against a catalog that carries it.`)
    }
  }
  for (const code of [...artByCode.keys()].sort(byCodePoint)) {
    if (!tsByCode.has(code)) {
      f.push(`role "${code}" is in ${OUT_REL} (and therefore in authz.roles) but not in ${TS_REL}'s ROLE_MANIFEST.`)
    }
  }
  for (const code of [...tsByCode.keys()].sort(byCodePoint)) {
    const a = artByCode.get(code)
    const t = tsByCode.get(code)
    if (!a || !t) continue
    if (a.scope_kind !== t.scope_kind) {
      f.push(`role "${code}": ${OUT_REL} says scope_kind=${a.scope_kind}, ROLE_MANIFEST says scopeKind=${t.scope_kind}.`)
    }
    if (a.session_selectable !== t.session_selectable) {
      f.push(
        `role "${code}": ${OUT_REL} says session_selectable=${a.session_selectable}, ` +
          `ROLE_MANIFEST says sessionSelectable=${t.session_selectable}.`,
      )
    }
  }
  return f
}

/** C — the pgTAP mirror INCLUDES this artifact and pins the same numbers AS LITERALS.
 *  ⭐ The literals are read from the lines pgTAP actually asserts, never from a comment
 *  restating them, so two comments cannot agree while the assertion says otherwise. */
export function checkMirror(mirrorText, artifactText) {
  const f = []
  const { anchors } = parseArtifact(artifactText)
  if (anchors.length !== 1) return f // checkArtifact already reported it
  const a = parseAnchor(anchors[0])
  const t = normalise(mirrorText)
  const lines = t.split('\n')

  // ⛔ The include is checked FIRST and by itself: a 411 that pins the right numbers while
  // no longer reading the artifact would assert them about a table it never filled.
  if (!/^\\ir\s+vectors\/role_manifest\.psql\s*$/m.test(t)) {
    f.push(`${MIRROR_REL}: no \`\\ir vectors/role_manifest.psql\` line — the pins below would be asserted about a table nothing populated.`)
  }

  const pinned = (marker, re) => {
    const i = lines.findIndex((l) => l.includes(marker))
    if (i < 0) return { ok: false, why: `the mirror has no assertion carrying "${marker}"` }
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const m = lines[j].match(re)
      if (m) return { ok: true, value: m[1] }
    }
    return { ok: false, why: `no literal matching ${re} in the 5 lines above "${marker}"` }
  }

  const rows = pinned('§ 0a ROWS PIN', /^\s*(\d+),\s*$/)
  if (!rows.ok) f.push(`${MIRROR_REL}: ${rows.why}.`)
  else if (Number(rows.value) !== a.rows) {
    f.push(`${MIRROR_REL} pins rows=${rows.value}; ${OUT_REL}'s anchor says ${a.rows}. Regenerate, then move the pin.`)
  }

  const cm = pinned('§ 0b CONTENT PIN', /^\s*'([0-9a-f]{32})',\s*$/)
  if (!cm.ok) f.push(`${MIRROR_REL}: ${cm.why}.`)
  else if (cm.value !== a.md) {
    f.push(`${MIRROR_REL} pins md5=${cm.value}; ${OUT_REL}'s anchor says ${a.md}. Regenerate, then move the pin.`)
  }
  return f
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — every checker proven able to fail, on every invocation of --self-test.
// ═══════════════════════════════════════════════════════════════════════════════════════

const SAMPLE = [
  { code: 'aaa_role', scope_kind: 'none', session_selectable: true, system_managed: true, state: 'legacy' },
  { code: 'bbb_role', scope_kind: 'commission', session_selectable: true, system_managed: false, state: 'authoritative' },
  { code: 'ccc_role', scope_kind: 'hospital', session_selectable: false, system_managed: false, state: 'legacy' },
]

const sampleTs = (rows) =>
  `${TS_BEGIN}\nexport const ROLE_MANIFEST = [\n` +
  rows
    .map(
      (r) =>
        `  {\n    code: "${r.code}",\n    label: "x",\n    scopeKind: "${r.scope_kind}",\n` +
        `    sessionSelectable: ${r.session_selectable},\n    branch: "isAdmin",\n` +
        `    branchEmptyFallback: "/",\n    scopeSummary: "none",\n  },\n`,
    )
    .join('') +
  `] as const satisfies readonly RoleManifestShape[]\n${TS_END}\n`

function selfTest() {
  const fails = []
  const red = (n, f) => {
    if (f.length === 0) fails.push(n)
  }
  const green = (n, f) => {
    if (f.length !== 0) fails.push(`${n} (false positive: ${f[0]})`)
  }
  const good = render(SAMPLE)
  const goodTs = sampleTs(SAMPLE)

  green('artifact-clean', checkArtifact(good))
  red('artifact-no-anchor', checkArtifact(good.replace(/^-- anchor: .*$/m, '-- anchor: none')))
  red('artifact-two-anchors', checkArtifact(good.replace(/^(-- anchor: role-manifest .*)$/m, '$1\n$1')))
  red('artifact-rows-drift', checkArtifact(good.replace(/rows=3/, 'rows=4')))
  red('artifact-sha-drift', checkArtifact(good.replace(/sha256=[0-9a-f]{64}/, `sha256=${'0'.repeat(64)}`)))
  red('artifact-md5-drift', checkArtifact(good.replace(/md5=[0-9a-f]{32}/, `md5=${'0'.repeat(32)}`)))
  // A value swapped for another of the SAME length: rows= still agrees, the digests move.
  red('artifact-value-swapped', checkArtifact(good.replace("'hospital'", "'commissio'")))
  red(
    'artifact-unsorted',
    checkArtifact(render([SAMPLE[1], SAMPLE[0], SAMPLE[2]]).replace(/rows=3/, 'rows=3')),
  )

  green('ts-clean', checkTsAgreement(good, goodTs))
  red('ts-role-removed', checkTsAgreement(good, sampleTs(SAMPLE.slice(0, 2))))
  red('ts-role-added', checkTsAgreement(good, sampleTs([...SAMPLE, { ...SAMPLE[0], code: 'ddd_role' }])))
  red('ts-scope-changed', checkTsAgreement(good, sampleTs([{ ...SAMPLE[0], scope_kind: 'hospital' }, SAMPLE[1], SAMPLE[2]])))
  red(
    'ts-selectable-flipped',
    checkTsAgreement(good, sampleTs([SAMPLE[0], SAMPLE[1], { ...SAMPLE[2], session_selectable: true }])),
  )
  red('ts-markers-gone', checkTsAgreement(good, goodTs.replace(TS_BEGIN, '// nope')))
  red('ts-block-empty', checkTsAgreement(good, `${TS_BEGIN}\n${TS_END}\n`))
  red('ts-entry-missing-field', checkTsAgreement(good, goodTs.replace(/\n\s*scopeKind: "none",/, '')))

  const mirror = existsSync(MIRROR) ? readFileSync(MIRROR, 'utf8') : ''
  const artifact = existsSync(OUT) ? readFileSync(OUT, 'utf8') : good
  green('mirror-clean', checkMirror(mirror, artifact))
  red('mirror-rows-pin-moved', checkMirror(mirror.replace(/^(\s*)(\d+),$/m, '$1999999,'), artifact))
  red('mirror-include-gone', checkMirror(mirror.replace(/^\\ir\s+vectors\/role_manifest\.psql\s*$/m, '-- gone'), artifact))
  red('mirror-rows-assertion-gone', checkMirror(mirror.replace('§ 0a ROWS PIN', '§ 0a rows pin'), artifact))
  red('mirror-content-assertion-gone', checkMirror(mirror.replace('§ 0b CONTENT PIN', '§ 0b content pin'), artifact))

  if (fails.length) {
    console.error(`gen-role-manifest --self-test: ${fails.length} checker(s) not proven able to fail:`)
    for (const x of fails) console.error(`  - ${x}`)
    process.exit(1)
  }
  console.log(`gen-role-manifest --self-test: OK (22 cases; every checker red on its own mutation)`)
  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// main
// ═══════════════════════════════════════════════════════════════════════════════════════

const argv = process.argv.slice(2)
if (argv.includes('--self-test')) selfTest()

if (argv.includes('--write')) {
  let rows
  try {
    rows = readCatalog()
  } catch (e) {
    console.error(`gen-role-manifest --write: ${String(e.message)}`)
    process.exit(2)
  }
  writeFileSync(OUT, render(rows), 'utf8')
  const d = digestsOf(rows)
  console.log(`gen-role-manifest: wrote ${d.rows} roles -> ${OUT_REL}`)
  console.log(`gen-role-manifest: 411 must pin  rows=${d.rows}  md5=${d.md}`)
  console.log(
    `⛔ Regenerating is NOT a way past a red in gate 19: this file now follows the CATALOG, ` +
      `so a role the TypeScript manifest does not carry reds --check until ROLE_MANIFEST is brought along.`,
  )
  process.exit(0)
}

if (argv.includes('--check')) {
  for (const [p, rel] of [
    [OUT, OUT_REL],
    [TS_SRC, TS_REL],
    [MIRROR, MIRROR_REL],
  ]) {
    if (!existsSync(p)) {
      console.error(`gen-role-manifest: ${rel} is missing — the pin has no ${p === OUT ? 'artifact' : 'reader'}.`)
      process.exit(1)
    }
  }
  const artifact = readFileSync(OUT, 'utf8')
  const findings = [
    ...checkArtifact(artifact),
    ...checkTsAgreement(artifact, readFileSync(TS_SRC, 'utf8')),
    ...checkMirror(readFileSync(MIRROR, 'utf8'), artifact),
  ]
  if (findings.length) {
    console.error(`gen-role-manifest: ${findings.length} finding(s):`)
    for (const x of findings) console.error(`  - ${x}`)
    process.exit(1)
  }
  const { rows } = parseAnchor(parseArtifact(artifact).anchors[0])
  console.log(
    `gen-role-manifest: in sync (${rows} roles; artifact == ROLE_MANIFEST on code/scope_kind/session_selectable). ` +
      `⛔ Bound: this gate never opened a database — "matches the live authz.roles" is pgTAP 411's verdict, in ` +
      `npm run test:db, and system_managed/state have no TypeScript twin to disagree with here.`,
  )
  process.exit(0)
}

console.error('usage: gen-role-manifest.mjs --write | --check | --self-test')
process.exit(2)
