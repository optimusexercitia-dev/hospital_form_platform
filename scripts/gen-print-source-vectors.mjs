#!/usr/bin/env node
/**
 * ADR 0125 D1/D8 (+ Amendment 2) · ADR 0126 D5/D10 — compile the shared
 * print-derivation vectors to SQL.
 *
 * WHY A GENERATOR AND NOT A DIRECT READ. pgTAP runs INSIDE the database. Reading
 * the JSON at test time would need `pg_read_file` (superuser) against a path the
 * Postgres container can actually see — the repo is not mounted there, so the path
 * that works on the host is not the path that works in the container, and the
 * failure mode is a test that silently reads nothing. Compiling to SQL at build
 * time removes the question.
 *
 * DRIFT IS PHASE-BLOCKING, and it is blocked by a hash rather than by trust:
 * the generated file carries `-- sourceSha256:` over the JSON's exact bytes.
 *   - edit the JSON without regenerating  -> hash mismatch -> `npm run test` REDS
 *     (src/lib/queries/print-source-vectors.test.ts)
 *   - hand-edit the generated .sql        -> same red, from the other direction
 *   - either predicate disagrees with a vector -> that predicate's own suite REDS
 *     (pgTAP for SQL, vitest for TS)
 *
 * Usage:
 *   node scripts/gen-print-source-vectors.mjs            # write
 *   node scripts/gen-print-source-vectors.mjs --check    # verify, exit 1 on drift
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src', 'lib', 'queries', '__fixtures__', 'print-source-registers-vectors.json')
/**
 * ⚠ `.psql`, NOT `.sql`, AND THAT EXTENSION IS LOAD-BEARING — do not "tidy" it.
 *
 * `pg_prove` (what `supabase test db` runs) recurses the tests directory and
 * collects every `*.sql` file AS A TEST. This fixture is not a test: it declares
 * no plan and emits no TAP, so being collected fails the whole run with
 * `Parse errors: No plan found in TAP output` — a red that points at the fixture
 * while reading like a defect in whichever suite was added last.
 *
 * `\ir` takes an explicit path and does not care about the extension, so moving
 * outside pg_prove's glob costs nothing and removes the collision. Measured both
 * halves: with `.psql` the fixture is not collected AND the including suite still
 * loads it.
 */
const OUT = join(ROOT, 'supabase', 'tests', 'vectors', 'print_source_registers_vectors.psql')

/** Hash the RAW BYTES, not the parsed object — a reformat is a change worth noticing. */
const raw = readFileSync(SRC)
const sha = createHash('sha256').update(raw).digest('hex')
const { vectors } = JSON.parse(raw.toString('utf8'))

if (!Array.isArray(vectors) || vectors.length === 0) {
  // A generator that emits an empty fixture is the "detector that finds nothing"
  // shape: pgTAP would iterate zero rows and pass having asserted nothing.
  console.error('gen-print-source-vectors: refusing to emit — the vector list is empty.')
  process.exit(1)
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
// The three kind-scoped flags default FALSE when absent (see the JSON's INPUT
// SHAPE note); they are emitted explicitly for every row so the SQL consumer never
// has to know the JSON's defaulting rule. `meeting_disposed` joined them with the
// disposal conjunct — a NEW flag must be added HERE as well as in the column list
// below, or every row silently takes the SQL default and the pgTAP suite asserts
// the wrong input while staying green.
const rows = vectors
  .map(
    (v) =>
      `    (${q(v.kind)}, ${q(v.status)}, ${v.correction_open ?? false}, ${v.phase_voided ?? false}, ${v.meeting_disposed ?? false}, ${v.registers}, ${q(v.watermark)})`,
  )
  .join(',\n')

const body = `-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    src/lib/queries/__fixtures__/print-source-registers-vectors.json
-- Generator: scripts/gen-print-source-vectors.mjs
-- sourceSha256: ${sha}
--
-- ADR 0125 D1/D8 (+ Amendment 2) · ADR 0126 D5/D10 + the disposal conjunct.
-- Loaded by the pgTAP print suites so app.print_source_registers and
-- app.print_source_watermark are driven by the SAME rows as their TS twins in
-- src/lib/pdf/documents/print-source.ts.
--
-- The three flags are KIND-SCOPED: correction_open / phase_voided are
-- form_response-only, meeting_disposed is meeting-only, and every predicate must
-- IGNORE a flag outside its kind. That ignoring is PINNED by the cross-kind rows,
-- not left to this comment.
--
-- Editing this file by hand REDS src/lib/queries/print-source-vectors.test.ts.
create temp table print_source_vectors on commit drop as
  select * from (values
${rows}
  ) as t(kind, status, correction_open, phase_voided, meeting_disposed, registers, watermark);
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    console.error(`gen-print-source-vectors: ${OUT} is missing. Run without --check.`)
    process.exit(1)
  }
  if (current.replace(/\r\n/g, '\n') !== body) {
    console.error('gen-print-source-vectors: DRIFT — the generated SQL does not match the JSON.')
    console.error('  Fix: node scripts/gen-print-source-vectors.mjs')
    process.exit(1)
  }
  console.log(`gen-print-source-vectors: OK (${vectors.length} vectors, sha ${sha.slice(0, 12)})`)
  process.exit(0)
}

writeFileSync(OUT, body, 'utf8')
console.log(`gen-print-source-vectors: wrote ${vectors.length} vectors -> ${OUT}`)
