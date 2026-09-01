#!/usr/bin/env node
/**
 * AE4.5 — the authorization decision-matrix CELL GENERATOR (plan PA-F7).
 *
 * Follows the AE1.3 vector pattern (scripts/gen-person-scope-vectors.mjs → JSON → pgTAP +
 * twins) so there is one pattern in this tree and not two. What it adds over AE1.3 is the
 * thing PA-F7 asks for and AE1.3 does not have: a COVERAGE REPORT that fails when
 * something in the catalog has no test mapping.
 *
 *   node scripts/gen-authz-matrix-cells.mjs             # write
 *   node scripts/gen-authz-matrix-cells.mjs --check     # verify, exit 1 on drift  (gate 12)
 *   node scripts/gen-authz-matrix-cells.mjs --self-test # prove the coverage gate can FAIL
 *
 * ⛔ WHAT THIS EMITS IN AE4 INCREMENT 1: the CELL ENUMERATION — axis coordinates and a
 * stable id per cell, with NO EXPECTED VALUE. Expectations are AE4.3 (the PO-approved
 * staff_admin matrix) and AE4.5 (the differential oracle). A generator that invented
 * expectations would be manufacturing the oracle it is supposed to be measured against.
 *
 * ⚠ `.psql`, NOT `.sql`, AND THE EXTENSION IS LOAD-BEARING — do not "tidy" it. `pg_prove`
 * collects every `*.sql` under the tests directory AS A TEST; this fixture declares no plan
 * and emits no TAP, so being collected fails the whole run with "No plan found in TAP
 * output" — a red that points at the fixture while reading like a defect in whichever suite
 * was added last. `\ir` does not care about the extension.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'supabase', 'tests', 'vectors', 'authz-matrix-axes.json')
const OUT = join(ROOT, 'supabase', 'tests', 'vectors', 'authz_matrix_cells.psql')
const COVERAGE = join(ROOT, 'supabase', 'tests', 'vectors', 'authz-matrix-coverage.json')

/**
 * Stable cell id: the seven axis values joined in a FIXED order.
 *
 * ⛔ NEVER AN ORDINAL. An ordinal renumbers the moment a constraint rule changes, which
 * orphans every name-keyed verdict that cited it — the standing
 * "a rename orphans a name-keyed verdict" lesson. The coordinates ARE the identity, so a
 * cell keeps its name across regenerations as long as it keeps its meaning.
 */
const AXIS_ORDER = [
  'persona',
  'role',
  'activeContext',
  'scope',
  'operation',
  'principalState',
  'resourceLifecycle',
  'sensitivity',
]
const cellId = (c) => AXIS_ORDER.map((a) => c[a]).join('|')

/**
 * ⭐ THE OPERATION DETERMINES ITS OWN SENSITIVITY, for the `_case_caps` tier. This is not a
 * simplification — it is what the bitmask MEANS: `read_standard_phi` IS the standard-PHI
 * bit. Crossing every case operation with every sensitivity value would enumerate cells
 * like "read_standard_phi at sensitivity none", which names no reachable state.
 * Any operation absent from this map carries sensitivity `none`.
 */
const OPERATION_SENSITIVITY = {
  read_standard_phi: 'phi_standard',
  read_restricted_phi: 'phi_restricted',
}

/**
 * Operations that act on a LIFECYCLED resource, keyed per OPERATION (not per tier).
 *
 * ⚠ EMPTY IN INCREMENT 1, DELIBERATELY, AND THIS IS A REAL PROPERTY RATHER THAN A STUB.
 * Axis 5's three tiers are the vocabulary that EXISTS TODAY — role-at-scope predicates,
 * the `_case_caps` bits, and the administrativo capabilities. None of them acts on a form
 * version or a response, which are the families whose lifecycles Axis 6b enumerates. So
 * `resourceLifecycle` legitimately collapses to `not_applicable` for every operation
 * currently declared. AE4.3 populates this map when it derives the form/response
 * permission codes (`commission.forms.manage`, ...), and the cell count grows then — with
 * the growth attributable to that derivation instead of buried in an initial cross-product.
 */
const OPERATION_LIFECYCLES = {}

/**
 * The constraint rules, AS CODE. Each returns the rule name when it EXCLUDES the cell, so
 * every skipped cell can say which rule skipped it. Declared alongside in the JSON's
 * `constraintRules` so the exclusion is reviewable; the JSON is prose, THIS is the gate.
 */
function excludedBy(cell, axes, spec) {
  if ((spec.excludeOperationTiers ?? []).includes(cell.operationTier)) {
    return 'operation_tier_excluded_for_role'
  }
  if (cell.persona === 'anonymous' && cell.activeContext !== 'absent') {
    return 'anonymous_has_no_active_context'
  }
  if (cell.persona === 'anonymous' && cell.principalState !== 'active') {
    return 'anonymous_holds_no_role_state'
  }
  if (cell.scope === 'zero_scope') {
    return 'scope_must_match_role_scope_kind'
  }
  if (cell.sensitivity !== (OPERATION_SENSITIVITY[cell.operation] ?? 'none')) {
    return 'operation_determines_sensitivity'
  }
  const allowed = OPERATION_LIFECYCLES[cell.operation] ?? ['not_applicable']
  if (!allowed.includes(cell.resourceLifecycle)) {
    return 'lifecycle_requires_lifecycled_resource'
  }
  return null
}

/**
 * ⭐ A HARD-DENY CELL COLLAPSES THE AXES DOWNSTREAM OF THE DENY.
 *
 * Once a caller is anonymous, or deactivated, or acting on a foreign org's commission, the
 * answer is DENY *for that reason* — and enumerating the remaining axes underneath it
 * produces N cells that assert the same thing for the same reason. That is not coverage,
 * it is the same test copied N times, and it inflates a coverage report into a number
 * nobody can act on.
 *
 * ⛔ The collapse NEVER applies to the axis the deny is ON: an `inactive` deny still
 * enumerates every principalState, because that axis is the subject of the deny.
 */
const DENY_AXES = {
  wrong_scope: 'scope',
  cross_org: 'scope',
  inactive: 'principalState',
  suspended: 'principalState',
  pending: 'principalState',
  wrong_active_context: 'activeContext',
  unauthenticated: 'persona',
}
const CANONICAL = { principalState: 'active', activeContext: 'matching' }

function collapsedBy(cell, denies) {
  if (denies.length === 0) return null
  const subjectAxes = new Set(denies.map((d) => DENY_AXES[d]).filter(Boolean))
  for (const [axis, canonical] of Object.entries(CANONICAL)) {
    if (subjectAxes.has(axis)) continue
    if (cell[axis] !== canonical) return 'deny_class_collapses_downstream_axes'
  }
  return null
}

/** Which deny classes a cell belongs to — mechanical, from the JSON's axis coordinates. */
function denyClassesFor(cell, denyClasses) {
  const hits = []
  for (const [name, spec] of Object.entries(denyClasses)) {
    if (name.startsWith('_')) continue
    const matches = Object.entries(spec).every(([axis, values]) => values.includes(cell[axis]))
    if (matches) hits.push(name)
  }
  return hits
}

function enumerate(spec) {
  const { axes, denyClasses, subjectRoles } = spec
  const personas = Object.keys(axes.persona.values)
  const contexts = Object.keys(axes.activeContext.values)
  const scopes = Object.keys(axes.scope.values)
  const states = Object.keys(axes.principalState.values)
  const lifecycles = Object.keys(axes.resourceLifecycle.values)
  const sensitivities = Object.keys(axes.sensitivity.values)

  const operations = []
  for (const [tier, ops] of Object.entries(axes.operation.tiers)) {
    for (const op of ops) operations.push({ tier, op })
  }

  const cells = []
  const skipped = []

  for (const role of subjectRoles) {
    for (const persona of personas) {
      for (const activeContext of contexts) {
        for (const scope of scopes) {
          for (const { tier, op } of operations) {
            for (const principalState of states) {
              for (const resourceLifecycle of lifecycles) {
                for (const sensitivity of sensitivities) {
                  const cell = {
                    persona,
                    role,
                    activeContext,
                    scope,
                    operation: op,
                    operationTier: tier,
                    principalState,
                    resourceLifecycle,
                    sensitivity,
                  }
                  const rule = excludedBy(cell, axes, spec)
                  if (rule) {
                    skipped.push({ id: cellId(cell), rule })
                    continue
                  }
                  const denies = denyClassesFor(cell, denyClasses)
                  const collapse = collapsedBy(cell, denies)
                  if (collapse) {
                    skipped.push({ id: cellId(cell), rule: collapse })
                    continue
                  }
                  cell.id = cellId(cell)
                  cell.denyClasses = denies
                  cell.fixtureOnly = persona === 'cross_org_actor' || scope === 'foreign_org_commission'
                  cell.unfillable = principalState === 'offboarded'
                  cells.push(cell)
                }
              }
            }
          }
        }
      }
    }
  }
  return { cells, skipped }
}

/**
 * THE COVERAGE GATE.
 *
 * ⚠⚠ VACUITY, STATED RATHER THAN HIDDEN. In AE4 Increment 1 the catalog holds ZERO
 * permissions and every role is state=`legacy`, so the "every catalog permission has a
 * mapping" arm and the "every non-legacy role has a matrix" arm BOTH RANGE OVER AN EMPTY
 * SET and pass having checked nothing. That is a property of the increment, not a bug in
 * the gate — but a gate that has never once refused anything is not evidence. `--self-test`
 * is the discharge: it feeds synthetic inputs in which each arm HAS a subject and asserts
 * the gate exits 1.
 */
function coverage(spec, cells, skipped) {
  const failures = []

  const enumeratedOps = new Set(cells.map((c) => c.operation))
  const declaredOps = new Set(Object.values(spec.axes.operation.tiers).flat())
  for (const op of declaredOps) {
    if (!enumeratedOps.has(op)) {
      failures.push(`operation "${op}" is declared in the axes but appears in NO enumerated cell`)
    }
  }

  for (const role of spec.subjectRoles) {
    if (!spec.catalogRoles.includes(role)) {
      failures.push(`subject role "${role}" is not present in catalogRoles — the axes file and the catalog disagree`)
    }
    if (!cells.some((c) => c.role === role)) {
      failures.push(`subject role "${role}" has no enumerated cell`)
    }
  }

  for (const permission of spec.catalogPermissions ?? []) {
    if (!enumeratedOps.has(permission)) {
      failures.push(`catalog permission "${permission}" has no test mapping`)
    }
  }

  for (const role of spec.nonLegacyRoles ?? []) {
    if (!spec.subjectRoles.includes(role)) {
      failures.push(`role "${role}" is non-legacy in the catalog but has no approved matrix / differential suite`)
    }
  }

  const bySkipRule = {}
  for (const s of skipped) bySkipRule[s.rule] = (bySkipRule[s.rule] ?? 0) + 1

  return {
    expected: cells.length + skipped.length,
    executed: cells.length,
    skipped: skipped.length,
    skippedByRule: bySkipRule,
    fixtureOnly: cells.filter((c) => c.fixtureOnly).length,
    unfillable: cells.filter((c) => c.unfillable).length,
    denyClassCounts: cells.reduce((acc, c) => {
      for (const d of c.denyClasses) acc[d] = (acc[d] ?? 0) + 1
      return acc
    }, {}),
    failures,
  }
}

// --------------------------------------------------------------------------
// --self-test: prove the coverage gate can FAIL. Runs before anything is written.
// --------------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  const base = JSON.parse(readFileSync(SRC, 'utf8'))
  const checks = [
    {
      name: 'an unmapped catalog permission is caught',
      spec: { ...base, catalogPermissions: ['commission.forms.manage_NOT_IN_AXES'] },
    },
    {
      name: 'a non-legacy role with no matrix is caught',
      spec: { ...base, nonLegacyRoles: ['org_admin'] },
    },
    {
      name: 'a subject role absent from the catalog is caught',
      spec: { ...base, subjectRoles: ['not_a_catalog_role'] },
    },
    {
      // ⚠ THIS ARM WAS VACUOUS ON ITS FIRST WRITING AND THE SELF-TEST CAUGHT IT.
      // The original construction declared a `ghost` tier and expected the coverage arm to
      // fire — but nothing excluded that tier, so its operation WAS enumerated and the arm
      // correctly stayed silent. A self-test arm naming a condition the rules make
      // unreachable is the "a close condition can name the case that CANNOT fail" shape.
      // Fixed by ALSO excluding the tier, which is what actually strands a declared
      // operation with no cell.
      name: 'a declared operation that no cell enumerates is caught',
      spec: {
        ...base,
        excludeOperationTiers: ['ghost'],
        axes: {
          ...base.axes,
          operation: { ...base.axes.operation, tiers: { ...base.axes.operation.tiers, ghost: ['never_enumerated'] } },
        },
      },
    },
  ]
  let bad = 0
  for (const { name, spec } of checks) {
    let cells, skipped
    try {
      ;({ cells, skipped } = enumerate(spec))
    } catch {
      cells = []
      skipped = []
    }
    const cov = coverage(spec, cells, skipped)
    if (cov.failures.length === 0) {
      console.error(`gen-authz-matrix-cells --self-test: NOT CAUGHT — ${name}`)
      bad++
    } else {
      console.log(`gen-authz-matrix-cells --self-test: caught — ${name} (${cov.failures[0]})`)
    }
  }
  // The negative control: the REAL spec must NOT trip the gate, or every check above
  // would be satisfied by a gate that always fails.
  const real = enumerate(base)
  const realCov = coverage(base, real.cells, real.skipped)
  if (realCov.failures.length > 0) {
    console.error(`gen-authz-matrix-cells --self-test: the REAL spec trips the gate — ${realCov.failures[0]}`)
    bad++
  } else {
    console.log('gen-authz-matrix-cells --self-test: caught nothing on the real spec (discrimination control)')
  }
  process.exit(bad === 0 ? 0 : 1)
}

// --------------------------------------------------------------------------
const raw = readFileSync(SRC)
const sha = createHash('sha256').update(raw).digest('hex')
const spec = JSON.parse(raw.toString('utf8'))

const { cells, skipped } = enumerate(spec)

// ⛔ A generator that emits an empty fixture is the "detector that finds nothing" shape:
// pgTAP would iterate zero rows and pass having asserted nothing. Refuse here, where the
// diagnosis is free.
if (cells.length === 0) {
  console.error('gen-authz-matrix-cells: refusing to emit — the enumeration is empty.')
  process.exit(1)
}

const cov = coverage(spec, cells, skipped)
if (cov.failures.length > 0) {
  console.error('gen-authz-matrix-cells: COVERAGE FAILURE — refusing to emit.')
  for (const f of cov.failures) console.error(`  - ${f}`)
  process.exit(1)
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const arr = (a) => (a.length === 0 ? 'array[]::text[]' : `array[${a.map(q).join(', ')}]`)

const rows = cells
  .map(
    (c) =>
      `    (${q(c.id)}, ${q(c.persona)}, ${q(c.role)}, ${q(c.activeContext)}, ${q(c.scope)}, ` +
      `${q(c.operation)}, ${q(c.operationTier)}, ${q(c.principalState)}, ${q(c.resourceLifecycle)}, ` +
      `${q(c.sensitivity)}, ${arr(c.denyClasses)}, ${c.fixtureOnly}, ${c.unfillable})`,
  )
  .join(',\n')

const roleRows = spec.catalogRoles.map((r) => `    (${q(r)})`).join(',\n')

const body = `-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    supabase/tests/vectors/authz-matrix-axes.json
-- Generator: scripts/gen-authz-matrix-cells.mjs
-- sourceSha256: ${sha}
--
-- AE4.5 decision-matrix CELL ENUMERATION — the seven PO-approved axes
-- (docs/design/authz-persona-matrix-axes-ae0.md), constraint rules applied.
--
-- ⛔ NO EXPECTED VALUES. This is the grid, not its contents. AE4.3 approves the
-- staff_admin matrix and AE4.5 fills the differential; a generator that invented
-- expectations would be manufacturing the oracle it is measured against.
--
--   enumerated: ${cov.executed}      skipped by constraint rule: ${cov.skipped}
--   fixture-only cells (no seeded persona can fill them): ${cov.fixtureOnly}
--   unfillable pending AE2.0's offboarded ruling: ${cov.unfillable}
--
-- Editing this file by hand REDS \`npm run lint:authz-vectors\`.
create temp table authz_matrix_cells on commit drop as
  select * from (values
${rows}
  ) as t(cell_id, persona, role, active_context, scope, operation, operation_tier,
         principal_state, resource_lifecycle, sensitivity, deny_classes,
         fixture_only, unfillable);

-- The role list the axes file believes the catalog holds. pgTAP 401 §12 asserts this
-- equals authz.roles — that is what keeps the generator's view of the catalog from
-- drifting away from the catalog itself, using a gate that already runs.
create temp table authz_matrix_catalog_roles on commit drop as
  select * from (values
${roleRows}
  ) as t(code);
`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    console.error(`gen-authz-matrix-cells: ${OUT} is missing — run the generator.`)
    process.exit(1)
  }
  // ⚠ Normalise line endings before comparing. The AE1.3 sibling compares raw, which makes
  // its --check CRLF-brittle on Windows with core.autocrlf; not repeating that here.
  if (current.replace(/\r\n/g, '\n') !== body) {
    console.error(
      'gen-authz-matrix-cells: DRIFT — the generated .psql does not match the axes JSON.\n' +
        'Run `node scripts/gen-authz-matrix-cells.mjs` and commit the result.',
    )
    process.exit(1)
  }
  let currentCov = ''
  try {
    currentCov = readFileSync(COVERAGE, 'utf8')
  } catch {
    console.error(`gen-authz-matrix-cells: ${COVERAGE} is missing — run the generator.`)
    process.exit(1)
  }
  if (currentCov.replace(/\r\n/g, '\n') !== JSON.stringify({ sourceSha256: sha, ...cov }, null, 2) + '\n') {
    console.error('gen-authz-matrix-cells: DRIFT — the coverage report is stale.')
    process.exit(1)
  }
  console.log(
    `gen-authz-matrix-cells: in sync (${cov.executed} cells, ${cov.skipped} skipped, sha ${sha.slice(0, 12)})`,
  )
  process.exit(0)
}

writeFileSync(OUT, body, 'utf8')
writeFileSync(COVERAGE, JSON.stringify({ sourceSha256: sha, ...cov }, null, 2) + '\n', 'utf8')
console.log(
  `gen-authz-matrix-cells: wrote ${cov.executed} cells (${cov.skipped} skipped) -> ${OUT}`,
)
