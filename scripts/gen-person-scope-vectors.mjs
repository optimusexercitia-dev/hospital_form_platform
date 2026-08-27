#!/usr/bin/env node
/**
 * AE1.3 / ADR 0161 — compile the shared person-authority vectors to SQL.
 *
 * ADR 0133 D4 declined to build a SQL twin of `personScopeAllows`, and one of its stated
 * reasons was that a mirror is a DRIFT LIABILITY. ADR 0155 G11 reversed the refusal. This
 * generator is the drift control that reversal owes: ONE case list, consumed by both
 * halves, because two independently-authored lists drift silently and nothing reds.
 *
 * WHY A GENERATOR AND NOT A DIRECT READ. pgTAP runs INSIDE the database. Reading the JSON
 * at test time would need `pg_read_file` (superuser) against a path the Postgres container
 * can actually see — the repo is not mounted there, so the path that works on the host is
 * not the path that works in the container, and the failure mode is a test that silently
 * reads nothing. Compiling at build time removes the question. (Same reasoning, same
 * shape, as scripts/gen-print-source-vectors.mjs — deliberately, so there is one pattern
 * here and not two.)
 *
 * DRIFT IS BLOCKED BY A HASH, NOT BY TRUST. The generated file carries `-- sourceSha256:`
 * over the JSON's exact bytes:
 *   - edit the JSON without regenerating -> hash mismatch -> `npm run test` REDS
 *     (src/lib/users/person-scope-vectors.test.ts)
 *   - hand-edit the generated .psql       -> the same red, from the other direction
 *   - TS disagrees with a vector          -> that same vitest file REDS
 *   - SQL disagrees with a vector         -> pgTAP 384 §9 REDS, naming the vector
 *
 * Usage:
 *   node scripts/gen-person-scope-vectors.mjs            # write
 *   node scripts/gen-person-scope-vectors.mjs --check    # verify, exit 1 on drift
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src', 'lib', 'users', '__fixtures__', 'person-scope-vectors.json')

/**
 * ⚠ `.psql`, NOT `.sql`, AND THAT EXTENSION IS LOAD-BEARING — do not "tidy" it.
 * `pg_prove` collects every `*.sql` under the tests directory AS A TEST. This fixture
 * declares no plan and emits no TAP, so being collected fails the whole run with
 * `Parse errors: No plan found in TAP output` — a red that points at the fixture while
 * reading like a defect in whichever suite was added last. `\ir` does not care about the
 * extension.
 */
const OUT = join(ROOT, 'supabase', 'tests', 'vectors', 'person_scope_vectors.psql')

/** Hash the RAW BYTES, not the parsed object — a reformat is a change worth noticing. */
const raw = readFileSync(SRC)
const sha = createHash('sha256').update(raw).digest('hex')
const { vectors } = JSON.parse(raw.toString('utf8'))

if (!Array.isArray(vectors) || vectors.length === 0) {
  // A generator that emits an empty fixture is the "detector that finds nothing" shape:
  // pgTAP would iterate zero rows and pass having asserted nothing.
  console.error('gen-person-scope-vectors: refusing to emit — the vector list is empty.')
  process.exit(1)
}

const CAPABILITIES = new Set(['fields', 'credentials', 'cpf_change', 'lifecycle'])
for (const [i, v] of vectors.entries()) {
  // ⛔ A vector naming a capability the predicate does not know would make `HC0T7` fire
  // inside the driver and abort the whole suite with a message about capabilities rather
  // than about this file. Fail here, where the diagnosis is free.
  if (!CAPABILITIES.has(v.capability)) {
    console.error(`gen-person-scope-vectors: vector ${i} has unknown capability ${v.capability}`)
    process.exit(1)
  }
  if (typeof v.expect !== 'boolean' || typeof v.tier !== 'boolean') {
    console.error(`gen-person-scope-vectors: vector ${i} must carry boolean tier + expect`)
    process.exit(1)
  }
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const arr = (a) => (a.length === 0 ? `array[]::text[]` : `array[${a.map(q).join(', ')}]`)

const rows = vectors
  .map(
    (v) =>
      `    (${q(v.shape)}, ${q(v.capability)}, ${arr(v.footprint)}, ${v.tier}, ` +
      `${arr(v.administered)}, ${v.expect})`,
  )
  .join(',\n')

const body = `-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    src/lib/users/__fixtures__/person-scope-vectors.json
-- Generator: scripts/gen-person-scope-vectors.mjs
-- sourceSha256: ${sha}
--
-- The ADR 0133 person-authority decision (D1-D4 + Amendment 1 ruling 1), as ONE case list
-- driving BOTH halves of the mirror ADR 0161 sanctioned:
--   TS  -> personScopeAllows                (src/lib/users/person-scope.ts)
--   SQL -> app.can_administer_person_for    (20261003004600)
--
-- ⚠ The shape that matters is S4: footprint {H1,H2} against a caller administering {H1}.
-- A sole-footprint person satisfies BOTH bounds, so every sole-footprint vector passes
-- under either one and can never detect an INTERSECTION/SUBSET swap. Only a footprint
-- that EXCEEDS the caller's coverage separates them.
--
-- Editing this file by hand REDS src/lib/users/person-scope-vectors.test.ts.
create temp table person_scope_vectors on commit drop as
  select * from (values
${rows}
  ) as t(shape, capability, footprint, tier, administered, expect);
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    console.error(`gen-person-scope-vectors: ${OUT} is missing — run the generator.`)
    process.exit(1)
  }
  if (current !== body) {
    console.error(
      'gen-person-scope-vectors: DRIFT — the generated .psql does not match the JSON.\n' +
        'Run `node scripts/gen-person-scope-vectors.mjs` and commit the result.',
    )
    process.exit(1)
  }
  console.log(`gen-person-scope-vectors: in sync (${vectors.length} vectors, sha ${sha.slice(0, 12)})`)
  process.exit(0)
}

writeFileSync(OUT, body, 'utf8')
console.log(`gen-person-scope-vectors: wrote ${vectors.length} vectors -> ${OUT}`)
