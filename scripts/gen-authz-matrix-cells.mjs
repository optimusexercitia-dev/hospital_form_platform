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
const MANIFEST_SRC = join(ROOT, 'supabase', 'tests', 'vectors', 'authz-enforcement-manifest.json')
const MANIFEST_OUT = join(ROOT, 'supabase', 'tests', 'vectors', 'authz_enforcement_manifest.psql')

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
function coverage(spec, manifest, cells, skipped, manifestRawText) {
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

  // ------------------------------------------------------------------------
  // ⛔ THE `spec.catalogPermissions` ARM IS RETIRED HERE (ADR 0176 D5), NOT POPULATED — and
  // the reason is NOT "it was empty". It is that its PREDICATE IS FALSE BY CONSTRUCTION.
  //
  // The arm read `if (!enumeratedOps.has(permission))`, i.e. it demanded that a CATALOG
  // PERMISSION CODE appear as an AXIS-5 OPERATION. Those are two different vocabularies and
  // the axes file says so in its own words: Axis 5 is "THREE TIERS WITH NO SHARED NAMESPACE"
  // whose members are `is_staff_admin_of`, `view_case_overview`, `read_standard_phi`, … —
  // never `commission.forms.edit`. So `spec.catalogPermissions ?? []` was not merely
  // unexercised: had anyone ever populated it from the catalog, as plan item [IA-F2] asked,
  // it would have emitted 43 failures on its first run and blocked generation outright.
  // A vacuous arm hid a wrong arm. Coverage of the catalog is now manifestFailures() below,
  // which compares the permission set against the MANIFEST, where the two vocabularies match.
  //
  // ⭐ ITS SIBLING `spec.nonLegacyRoles` IS THE OPPOSITE CASE AND IS *POPULATED*, NOT RETIRED
  // — measured 2026-09-02 rather than assumed, because retiring both on one argument is how a
  // half-swept class gets buried under evidence. Its predicate ("a non-legacy role must have
  // an approved matrix / differential suite") is TRUE and CHECKABLE: authz.role_state is
  // {legacy, test_validation, authoritative}, `staff_admin` is `authoritative`, and it IS in
  // subjectRoles — so the arm now has a subject and passes ON MERIT. It reds the moment an
  // AE5 increment flips a role to authoritative (or test_validation) without adding a suite,
  // which is precisely the drift AE5 produces. See arm C2 in manifestFailures().
  // ------------------------------------------------------------------------

  // ⭐ THE fixtureOnly FLAG IS CROSS-CHECKED, NOT SELF-CHECKED. Asserting the flag against
  // the same expression that computes it would be a tautology. Instead: every cell the
  // JSON's `cross_org` DENY CLASS captures must also be flagged fixture-only. The deny
  // class is declared in the axes file and the flag is computed in this script, so the two
  // are independently specified — a rename on either side breaks the agreement and reds
  // here. Without this the flag can go silently dead (the `===` simply stops matching) and
  // AE4.3 would size its cross-org fixture work from a zero that means nothing.
  const crossOrgDenied = cells.filter((c) => c.denyClasses.includes('cross_org'))
  const unflagged = crossOrgDenied.filter((c) => !c.fixtureOnly)
  if (unflagged.length > 0) {
    failures.push(
      `${unflagged.length} cell(s) in the cross_org deny class are NOT flagged fixtureOnly — ` +
        `the flag and the deny class disagree (first: ${unflagged[0].id})`,
    )
  }
  if (crossOrgDenied.length > 0 && cells.filter((c) => c.fixtureOnly).length === 0) {
    failures.push('the cross_org deny class has members but NO cell is flagged fixtureOnly — the flag is dead')
  }

  const man = manifestReport(spec, manifest, manifestRawText)
  failures.push(...man.failures)

  const bySkipRule = {}
  for (const s of skipped) bySkipRule[s.rule] = (bySkipRule[s.rule] ?? 0) + 1

  return {
    expected: cells.length + skipped.length,
    executed: cells.length,
    skipped: skipped.length,
    skippedByRule: bySkipRule,
    fixtureOnly: cells.filter((c) => c.fixtureOnly).length,
    denyClassCounts: cells.reduce((acc, c) => {
      for (const d of c.denyClasses) acc[d] = (acc[d] ?? 0) + 1
      return acc
    }, {}),
    manifest: man.stats,
    failures,
  }
}

// ==========================================================================
// ADR 0176 D5 — THE ENFORCEMENT MANIFEST GATE. NO DEFAULT ARM.
//
// ⛔ THE BINDING CONSTRAINT: this runs inside `npm run lint` (gate 12), which must NEVER
// require Docker. Nothing here queries a database. The manifest carries a COMMITTED
// SNAPSHOT of the catalog; this function proves the manifest is internally consistent and
// agrees with that snapshot, and `supabase/tests/410_ae49_d5_enforcement_manifest.sql`
// proves the snapshot agrees with the LIVE CATALOG after a fresh reset. Neither half alone
// closes the loop, and moving either half into the other breaks something real: a live query
// here would make `npm run lint` need Docker; a JSON-only check there would re-assert what
// lint already knows.
//
// ⛔ NO `??` ON THE MANIFEST READ PATH. Every required key is tested with `has()` and
// reported by name when absent. `spec.catalogPermissions ?? []` is exactly how the arm this
// replaces came to range over nothing, so the shape is refused structurally rather than by
// discipline. `req()` below throws if the emitter is ever reached with a key this function
// failed to demand.
// ==========================================================================
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)
const req = (o, k, ctx) => {
  if (!has(o, k)) throw new Error(`manifest emit: required key "${k}" missing at ${ctx} (validation gap)`)
  return o[k]
}
const isStr = (v) => typeof v === 'string' && v.length > 0
/** The ONE arm that counts as permission-keyed. Everything else an authorizer composes is
 *  residual legacy authority and must be declared as such (ADR 0176 D2 interface 2). */
const PERMISSION_ARM = 'authz.has_permission'
const diff = (a, b) => a.filter((x) => !b.includes(x))

/**
 * ⭐⭐ DUPLICATE KEYS INSIDE A PERMISSION ROW — a class I hit while authoring this manifest,
 * which is why it is gated rather than trusted to discipline.
 *
 * `JSON.parse` accepts a duplicate key SILENTLY and keeps the LAST one. Writing
 * `"pendingRekey": null` near the top of a row while an older `"pendingRekey": { … }` still
 * sat at the bottom produced a row that READ as re-keyed and PARSED as pending — and every
 * arm below validated the parsed value, so the whole gate agreed with the wrong half of the
 * file. No amount of downstream checking can see this: by the time validation runs, the
 * shadowed key is gone.
 *
 * Detected on the RAW TEXT, keyed on indentation, because that is the only place the
 * duplicate still exists.
 */
function duplicateRowKeys(rawText) {
  const dups = []
  let row = null
  let seen = new Set()
  for (const [i, line] of rawText.split(/\r?\n/).entries()) {
    const rowStart = line.match(/^ {4}"([^"]+)": \{/)
    if (rowStart) { row = rowStart[1]; seen = new Set(); continue }
    const key = line.match(/^ {6}"([A-Za-z_]+)":/)
    if (key && row !== null) {
      if (seen.has(key[1])) dups.push(`"${row}" declares "${key[1]}" TWICE (line ${i + 1}) — JSON.parse keeps the LAST silently`)
      seen.add(key[1])
    }
  }
  return dups
}

function manifestReport(spec, manifest, rawText) {
  const failures = []
  const F = (m) => failures.push(`manifest: ${m}`)

  if (typeof rawText === 'string') for (const d of duplicateRowKeys(rawText)) F(d)

  for (const key of ['schemaVersion', 'catalogSnapshot', 'roleStateDomain', 'approvedSuites',
                     'hardDenyVocabulary', 'fieldContracts', 'permissions']) {
    if (!has(manifest, key)) F(`top-level key "${key}" is missing`)
  }
  if (failures.length > 0) return { failures, stats: {} }

  const fc = manifest.fieldContracts
  const snap = manifest.catalogSnapshot
  const rows = manifest.permissions
  const vocab = Object.keys(manifest.hardDenyVocabulary).filter((k) => !k.startsWith('_'))

  // --- ARM M1: no default arm, structurally. ------------------------------
  // The 401 § 19 mapping this manifest retires was a `CASE … ELSE`. A wildcard key here
  // would rebuild it in JSON, so the forbidden names are DATA in fieldContracts and checked.
  for (const k of fc.forbiddenDefaultKeys) {
    if (has(rows, k)) F(`row key "${k}" is a DEFAULT ARM — every permission must be named explicitly (ADR 0176 D5)`)
  }

  const rowCodes = Object.keys(rows).filter((k) => !k.startsWith('_')).sort()
  const snapCodes = has(snap, 'permissions') ? [...snap.permissions].sort() : null
  if (snapCodes === null) F('catalogSnapshot.permissions is missing — there is no set to difference against')

  // --- ARM A / ARM B: the two set differences D5 names, both directions. --
  if (snapCodes !== null) {
    for (const c of diff(snapCodes, rowCodes)) {
      F(`catalog permission "${c}" has NO manifest row — name its enforcement path (catalog - manifest)`)
    }
    for (const c of diff(rowCodes, snapCodes)) {
      F(`manifest row "${c}" names a permission that is not in the catalog snapshot (manifest - catalog)`)
    }
  }

  // --- ARM C3: approvedSuites and the axes file's subjectRoles are FUSED. -
  // C1 reads approvedSuites and C2 reads subjectRoles; without this they could drift apart
  // and each arm would keep passing against its own half.
  const suiteRoles = Object.keys(manifest.approvedSuites).filter((k) => !k.startsWith('_')).sort()
  const subjectRoles = [...spec.subjectRoles].sort()
  for (const r of diff(suiteRoles, subjectRoles)) F(`approvedSuites names "${r}" but the axes file's subjectRoles does not`)
  for (const r of diff(subjectRoles, suiteRoles)) F(`subjectRoles names "${r}" but approvedSuites has no entry for it`)

  // --- ARM D: the role snapshot and the axes file's catalogRoles agree. ---
  const snapRoles = snap.roles.map((r) => r.code).sort()
  for (const r of diff(snapRoles, [...spec.catalogRoles].sort())) F(`role "${r}" is in the manifest snapshot but not in the axes file's catalogRoles`)
  for (const r of diff([...spec.catalogRoles].sort(), snapRoles)) F(`role "${r}" is in the axes file's catalogRoles but not in the manifest snapshot`)

  // --- ARM C1: D5's third set difference — authoritative - approved suites.
  const authoritative = snap.roles.filter((r) => r.state === 'authoritative').map((r) => r.code)
  for (const r of diff(authoritative, suiteRoles)) {
    F(`role "${r}" is AUTHORITATIVE in the catalog snapshot but has no approved suite (authoritative - approved suites)`)
  }

  // --- ARM C2: the RETAINED `nonLegacyRoles` predicate, strictly wider. ---
  // Non-legacy is the complement of `legacy` over the measured role_state domain, so it
  // covers `test_validation` too — a role mid-differential owes a suite just as much.
  const legacyValue = manifest.roleStateDomain.legacyValue
  const nonLegacy = snap.roles.filter((r) => r.state !== legacyValue).map((r) => r.code)
  for (const r of diff(nonLegacy, subjectRoles)) {
    F(`role "${r}" is non-legacy (state=${snap.roles.find((x) => x.code === r).state}) in the catalog but has no approved matrix / differential suite`)
  }
  for (const r of snap.roles) {
    if (!manifest.roleStateDomain.values.includes(r.state)) F(`role "${r.code}" carries state "${r.state}", outside the measured authz.role_state domain`)
  }

  // --- ARMS M2..M12: every row, every required field, explicitly. ---------
  const statusCounts = {}
  const usedDenyClasses = new Set()
  let siteCount = 0
  for (const code of rowCodes) {
    const row = rows[code]
    const at = `permissions["${code}"]`
    let missing = false
    for (const k of fc.requiredPermissionKeys) {
      if (!has(row, k)) { F(`${at} is missing required key "${k}" — there is no default for it`); missing = true }
    }
    if (missing) continue

    if (!fc.statusValues.includes(row.status)) { F(`${at}.status "${row.status}" is not one of ${fc.statusValues.join(' | ')}`); continue }
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1

    const sites = row.enforcementSites
    const boundary = row.callGraphBoundary
    if (!Array.isArray(sites)) F(`${at}.enforcementSites must be an array`)
    siteCount += Array.isArray(sites) ? sites.length : 0

    // M4 — status consistency. `pending-rekey` is a POSITIVE declaration with an owner and an
    // expiry, never the absence of one.
    if (row.status === 're-keyed') {
      const da = row.domainAuthorizer
      if (da === null || typeof da !== 'object') F(`${at} is re-keyed but names no domainAuthorizer`)
      else {
        for (const k of ['function', 'composedWith', 'executableByAuthenticated']) {
          if (!has(da, k)) F(`${at}.domainAuthorizer is missing "${k}"`)
        }
        if (!isStr(da.function)) F(`${at}.domainAuthorizer.function must name a function`)
        // ⭐ NOT OPTIONAL, AND MEASURED RATHER THAN ASSUMED. Re-keying MOVES authority: the
        // four commission.forms.edit policies each collapsed to a single authorizer call and
        // the tenancy-admin arm reappeared INSIDE the authorizer. A row that recorded only
        // per-site composition would have declared that arm deleted. `composedWith` here is
        // what 410 § 3.7 asserts is still in the authorizer body.
        if (!Array.isArray(da.composedWith) || da.composedWith.length === 0) {
          F(`${at}.domainAuthorizer.composedWith must list what the authorizer composes — an empty list claims the authorizer is a bare permission check, which no layer-3 authorizer is`)
        }
        if (typeof da.executableByAuthenticated !== 'boolean') {
          F(`${at}.domainAuthorizer.executableByAuthenticated must be a boolean — "a correct door nothing can reach" is only visible if the grant posture is declared`)
        }
      }
      if (row.pendingRekey !== null) F(`${at} is re-keyed but still carries a pendingRekey block`)
      if (row.targetAuthorizer !== null) F(`${at} is re-keyed but still carries a targetAuthorizer`)

      // ⛔⛔ THE PARTITION THAT STOPS `re-keyed` READING AS `fully permission-keyed`.
      // Every authority the authorizer composes is EITHER the permission arm or a declared
      // residual legacy arm with a population and a retirement condition. Re-keying MOVED
      // these arms from the policy body — where a `pg_policies` audit would see them — into a
      // SECURITY DEFINER function where it cannot. An unclassified arm is exactly the door
      // blindness ADR 0079 exists for, so it fails generation rather than being described.
      const residual = row.residualLegacyAuthority
      if (!Array.isArray(residual)) F(`${at}.residualLegacyAuthority must be an array (use [] to declare none)`)
      else {
        for (const [i, e] of residual.entries()) {
          for (const k of ['gate', 'population', 'retiredBy']) {
            if (!isStr(e[k])) F(`${at}.residualLegacyAuthority[${i}].${k} must be a non-empty string — an undated residual arm is a permanent one`)
          }
        }
        const declaredResidual = residual.map((e) => e.gate)
        for (const armFn of Array.isArray(da?.composedWith) ? da.composedWith : []) {
          if (armFn === PERMISSION_ARM) continue
          if (!declaredResidual.includes(armFn)) {
            F(`${at}: the authorizer composes "${armFn}", which is neither the permission arm (${PERMISSION_ARM}) nor a declared residualLegacyAuthority — a re-keyed row may not hide a non-permission grant path`)
          }
        }
        for (const g of declaredResidual) {
          if (!(Array.isArray(da?.composedWith) ? da.composedWith : []).includes(g)) {
            F(`${at}.residualLegacyAuthority names "${g}", which the authorizer does not compose — a residual arm that is not there overstates what still has to be retired`)
          }
        }
        if (!(Array.isArray(da?.composedWith) ? da.composedWith : []).includes(PERMISSION_ARM)) {
          F(`${at} is re-keyed but its authorizer never composes ${PERMISSION_ARM} — "re-keyed" with no permission arm is the inert-catalog defect ADR 0176 was written to repair`)
        }
      }
    } else {
      // ⛔ A pending row has no authorizer to hide an arm inside, so the honest value is [] —
      // and it is DECLARED, never defaulted, so a row cannot acquire the empty list by silence.
      if (!Array.isArray(row.residualLegacyAuthority) || row.residualLegacyAuthority.length > 0) {
        F(`${at} is pending-rekey and must declare residualLegacyAuthority: [] — a residual arm is a property of a re-keyed authorizer, and claiming one here would attribute an arm to a function that does not exist yet`)
      }
      if (row.domainAuthorizer !== null) F(`${at} is pending-rekey but names a domainAuthorizer — flip the status or clear the field`)
      if (row.pendingRekey === null) F(`${at} is pending-rekey but carries no pendingRekey block (layer1Gate / owner / expiry)`)
      else for (const k of ['layer1Gate', 'owner', 'expiry']) {
        if (!isStr(row.pendingRekey[k])) F(`${at}.pendingRekey.${k} must be a non-empty string`)
      }
    }
    if (row.targetAuthorizer !== null) {
      for (const k of ['function', 'provisional', 'executableByAuthenticated']) {
        if (!has(row.targetAuthorizer, k)) F(`${at}.targetAuthorizer is missing "${k}"`)
      }
    }

    // M5 — sites OR a reviewed boundary, never neither.
    if ((!Array.isArray(sites) || sites.length === 0) && boundary === null) {
      F(`${at} declares NEITHER an enforcement site NOR a reviewed call-graph boundary`)
    }
    if (boundary !== null) {
      for (const k of ['reason', 'reviewedBy', 'reviewedOn']) {
        if (!isStr(boundary[k])) F(`${at}.callGraphBoundary.${k} must be a non-empty string — an unreviewed boundary is a default in disguise`)
      }
    }

    // M11 — site shape.
    for (const [i, s] of (Array.isArray(sites) ? sites : []).entries()) {
      const sat = `${at}.enforcementSites[${i}]`
      for (const k of ['kind', 'schema', 'relation', 'name', 'composedWith']) {
        if (!has(s, k)) F(`${sat} is missing "${k}"`)
      }
      if (!fc.siteKinds.includes(s.kind)) F(`${sat}.kind "${s.kind}" is not one of ${fc.siteKinds.join(' | ')}`)
      if (s.kind === 'policy' && !isStr(s.relation)) F(`${sat} is a policy site but names no relation`)
      if (s.kind === 'function' && s.relation !== null) F(`${sat} is a function site and must carry relation: null`)
    }

    // M6 — THE ESCAPE-HATCH FENCE. `not-attributable-until-rekey` is honest on a row whose
    // sites are genuinely unknown, and it is a silencer on a row whose sites are listed.
    // Partitioning clean / unproven / dirty means the unproven label cannot be borrowed.
    if (!fc.hardDenyProvenanceValues.includes(row.hardDenyProvenance)) {
      F(`${at}.hardDenyProvenance "${row.hardDenyProvenance}" is not one of ${fc.hardDenyProvenanceValues.join(' | ')}`)
    }
    if (row.hardDenyProvenance === 'not-attributable-until-rekey') {
      if (Array.isArray(sites) && sites.length > 0) {
        F(`${at} claims hard denies are "not-attributable-until-rekey" while ENUMERATING ${sites.length} site(s) — the unproven label may not silence a measurable row`)
      }
      if (boundary === null) F(`${at} claims "not-attributable-until-rekey" without a reviewed call-graph boundary`)
    }

    // M7 — hard-deny classes come from the declared vocabulary.
    if (!Array.isArray(row.hardDenyClasses)) F(`${at}.hardDenyClasses must be an array`)
    else for (const d of row.hardDenyClasses) {
      if (!vocab.includes(d)) F(`${at} names hard-deny class "${d}", which is not in hardDenyVocabulary`)
      else usedDenyClasses.add(d)
    }

    // M8 — lifecycle as DATA per permission (D5: "never a global omission").
    const ax = row.axes
    for (const k of ['resourceLifecycle', 'resourceLifecycleProvenance', 'sensitivity']) {
      if (!has(ax, k)) F(`${at}.axes is missing "${k}"`)
    }
    if (!Array.isArray(ax.resourceLifecycle) || ax.resourceLifecycle.length === 0) {
      F(`${at}.axes.resourceLifecycle must be a non-empty list — an empty list is the global omission D5 forbids`)
    } else for (const l of ax.resourceLifecycle) {
      if (!fc.lifecycleValues.includes(l)) F(`${at}.axes.resourceLifecycle names "${l}", outside the axis vocabulary`)
    }
    if (!fc.lifecycleProvenanceValues.includes(ax.resourceLifecycleProvenance)) {
      F(`${at}.axes.resourceLifecycleProvenance "${ax.resourceLifecycleProvenance}" is not one of ${fc.lifecycleProvenanceValues.join(' | ')}`)
    }
    if (ax.resourceLifecycleProvenance === 'axis-vocabulary-inapplicable' &&
        !(Array.isArray(ax.resourceLifecycle) && ax.resourceLifecycle.length === 1 && ax.resourceLifecycle[0] === 'not_applicable')) {
      F(`${at} claims its lifecycle is inapplicable by axis vocabulary yet declares ${JSON.stringify(ax.resourceLifecycle)}`)
    }

    // M9 — sensitivity is declared TWICE (as an axis and as the catalog mirror) and fused,
    // so 410's catalog binding on `catalog.sensitivityCeiling` also pins the axis value.
    for (const k of ['resourceKind', 'riskClass', 'sensitivityCeiling', 'resolutionScopeKind']) {
      if (!isStr(row.catalog[k])) F(`${at}.catalog.${k} must be a non-empty string`)
    }
    if (ax.sensitivity !== row.catalog.sensitivityCeiling) {
      F(`${at}.axes.sensitivity (${ax.sensitivity}) disagrees with catalog.sensitivityCeiling (${row.catalog.sensitivityCeiling})`)
    }

    // M10 — the legacy-equivalence gate, per row, replacing 401 § 19's `CASE … ELSE`.
    if (!isStr(row.legacyEquivalence.gate)) F(`${at}.legacyEquivalence.gate must name a gate — this field is what retired the ELSE arm`)
    if (!isStr(row.legacyEquivalence.expected)) F(`${at}.legacyEquivalence.expected must be a non-empty string`)

    // M12 — an exception is explicit or explicitly absent; a MISSING key is neither.
    if (row.exception !== null) {
      for (const k of ['owner', 'expiry', 'reason']) {
        if (!isStr(row.exception[k])) F(`${at}.exception.${k} must be a non-empty string (D5: owner and expiry of any compatibility exception)`)
      }
    }
  }

  return {
    failures,
    stats: {
      permissionRows: rowCodes.length,
      snapshotPermissions: snapCodes === null ? null : snapCodes.length,
      snapshotRoles: snapRoles.length,
      migrationHead: snap.migrationHead,
      statusCounts,
      enforcementSites: siteCount,
      authoritativeRoles: authoritative.sort(),
      nonLegacyRoles: nonLegacy.sort(),
      // ⚠ REPORTED, NOT GATED, AND THE REASON IS RECORDED IN THE MANIFEST HEADER: gating
      // "every vocabulary entry is used" today could only be satisfied by FABRICATING
      // attributions, because 40 of 43 rows are honestly not-attributable-until-rekey and the
      // 3 rows with enumerated sites MEASURED zero hard denies. Visible beats invented.
      unusedHardDenyClasses: vocab.filter((v) => !usedDenyClasses.has(v)).sort(),
    },
  }
}

// --------------------------------------------------------------------------
// The manifest fixture consumed by pgTAP 410 (and by 401 § 19, which the manifest retires).
// --------------------------------------------------------------------------
function emitManifest(manifest, manifestSha) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`
  const qn = (v, t) => (v === null || v === undefined ? `null::${t}` : q(v))
  const qb = (v) => (v === null || v === undefined ? 'null::boolean' : v ? 'true' : 'false')
  const arr = (a) => (a.length === 0 ? 'array[]::text[]' : `array[${a.map(q).join(', ')}]`)

  const rows = manifest.permissions
  const codes = Object.keys(rows).filter((k) => !k.startsWith('_')).sort()

  const permRows = codes.map((code) => {
    const r = rows[code]
    const at = `permissions["${code}"]`
    const ta = req(r, 'targetAuthorizer', at)
    const pr = req(r, 'pendingRekey', at)
    const ex = req(r, 'exception', at)
    const ax = req(r, 'axes', at)
    const cat = req(r, 'catalog', at)
    const le = req(r, 'legacyEquivalence', at)
    const da = req(r, 'domainAuthorizer', at)
    // ⭐ ONE UNIFIED `authorizer` COLUMN, plus the source it came from. Without it, §5's grant-
    // posture assertions would read `targetAuthorizer` and silently go VACUOUS the moment a
    // row flipped to `re-keyed` and cleared that field — the assertion would keep reporting
    // "(none)" over an empty domain and read exactly like coverage.
    const auth = da !== null ? da : ta
    const authSource = da !== null ? 'domain' : ta !== null ? 'target' : null
    return (
      `    (${q(code)}, ${q(req(r, 'status', at))}, ${qn(da === null ? null : da.function, 'text')}, ` +
      `${qn(auth === null ? null : auth.function, 'text')}, ${qn(authSource, 'text')}, ` +
      `${qb(ta === null ? null : ta.provisional)}, ` +
      `${qb(auth === null ? null : auth.executableByAuthenticated)}, ` +
      `${arr(da === null ? [] : da.composedWith)}, ` +
      `${arr(req(r, 'residualLegacyAuthority', at).map((e) => e.gate))}, ` +
      `${q(le.gate)}, ${q(le.expected)}, ` +
      `${q(cat.resourceKind)}, ${q(cat.riskClass)}, ${q(cat.sensitivityCeiling)}, ${q(cat.resolutionScopeKind)}, ` +
      `${arr(ax.resourceLifecycle)}, ${q(ax.resourceLifecycleProvenance)}, ${q(ax.sensitivity)}, ` +
      `${arr(req(r, 'hardDenyClasses', at))}, ${q(req(r, 'hardDenyProvenance', at))}, ` +
      `${req(r, 'callGraphBoundary', at) !== null}, ${req(r, 'enforcementSites', at).length}, ` +
      `${qn(pr === null ? null : pr.layer1Gate, 'text')}, ${qn(pr === null ? null : pr.owner, 'text')}, ` +
      `${qn(pr === null ? null : pr.expiry, 'text')}, ` +
      `${qn(ex === null ? null : ex.owner, 'text')}, ${qn(ex === null ? null : ex.expiry, 'text')})`
    )
  })

  const siteRows = []
  for (const code of codes) {
    for (const s of rows[code].enforcementSites) {
      siteRows.push(
        `    (${q(code)}, ${q(s.kind)}, ${q(s.schema)}, ${qn(s.relation, 'text')}, ${q(s.name)}, ${arr(s.composedWith)})`,
      )
    }
  }

  const roleRows = manifest.catalogSnapshot.roles.map(
    (r) => `    (${q(r.code)}, ${q(r.state)}, ${r.sessionSelectable ? 'true' : 'false'})`,
  )
  const snapPermRows = [...manifest.catalogSnapshot.permissions].sort().map((c) => `    (${q(c)})`)
  const suiteRows = Object.keys(manifest.approvedSuites).filter((k) => !k.startsWith('_')).sort().map((r) => `    (${q(r)})`)
  const vocabRows = Object.keys(manifest.hardDenyVocabulary)
    .filter((k) => !k.startsWith('_'))
    .sort()
    .map((k) => `    (${q(k)}, ${qn(manifest.hardDenyVocabulary[k].gate, 'text')})`)

  // ⛔ A `values` list with zero rows is a syntax error, and emitting one would turn a
  // pgTAP suite into an aborted file rather than a red assertion. The site table is the only
  // one that can legitimately be empty (every permission behind a call-graph boundary), so
  // it degrades to a typed empty relation instead of vanishing.
  const sitesBody =
    siteRows.length > 0
      ? `select * from (values\n${siteRows.join(',\n')}\n  ) as t(code, site_kind, site_schema, site_relation, site_name, composed_with)`
      : `select null::text as code, null::text as site_kind, null::text as site_schema, null::text as site_relation, null::text as site_name, null::text[] as composed_with where false`

  return `-- GENERATED FILE — DO NOT EDIT BY HAND.
-- Source:    supabase/tests/vectors/authz-enforcement-manifest.json
-- Generator: scripts/gen-authz-matrix-cells.mjs
-- sourceSha256: ${manifestSha}
--
-- ADR 0176 D5 — THE ENFORCEMENT MANIFEST, as a pgTAP fixture.
--
-- ⛔ WHAT THIS IS FOR. It carries the manifest's COMMITTED SNAPSHOT of the catalog into a
-- session where the LIVE CATALOG is available. \`npm run lint\` (gate 12) proves the manifest
-- is internally consistent and agrees with this snapshot WITHOUT DOCKER; 410 proves the
-- snapshot agrees with authz.permissions / authz.roles. Splitting it this way is deliberate:
-- a live catalog query inside the lint gate would make \`npm run lint\` require Docker.
--
-- ⛔ NO DEFAULT ARM. Every one of the ${codes.length} permissions is named explicitly. The
-- \`CASE … ELSE 'is_staff_admin_of_for'\` this replaces sent 38 of 43 codes to one gate, so a
-- 44th permission would have INHERITED a mapping instead of forcing a decision.
--
-- Editing this file by hand REDS \`npm run lint:authz-vectors\`.

create temp table authz_manifest_permissions on commit drop as
  select * from (values
${permRows.join(',\n')}
  ) as t(code, status, domain_authorizer, authorizer, authorizer_source,
         authorizer_provisional, authorizer_exec_authenticated, authorizer_composed_with,
         residual_legacy_authority,
         legacy_gate, legacy_expected,
         resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind,
         lifecycles, lifecycle_provenance, sensitivity, hard_deny_classes, hard_deny_provenance,
         has_boundary, site_count, pending_layer1_gate, pending_owner, pending_expiry,
         exception_owner, exception_expiry);

create temp table authz_manifest_sites on commit drop as
  ${sitesBody};

-- The snapshot lists asserted against the live catalog by 410. ⛔ These are NOT derived from
-- the manifest's row keys — the redundancy is what gives 410 a real set difference to compute.
create temp table authz_manifest_snapshot_permissions on commit drop as
  select * from (values
${snapPermRows.join(',\n')}
  ) as t(code);

create temp table authz_manifest_snapshot_roles on commit drop as
  select * from (values
${roleRows.join(',\n')}
  ) as t(code, state, session_selectable);

create temp table authz_manifest_approved_suites on commit drop as
  select * from (values
${suiteRows.join(',\n')}
  ) as t(role_code);

create temp table authz_manifest_hard_deny_vocab on commit drop as
  select * from (values
${vocabRows.join(',\n')}
  ) as t(class_name, gate);
`
}

// --------------------------------------------------------------------------
// --self-test: prove the coverage gate can FAIL. Runs before anything is written.
// --------------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  const base = JSON.parse(readFileSync(SRC, 'utf8'))
  const baseManifestText = readFileSync(MANIFEST_SRC, 'utf8')
  const baseManifest = JSON.parse(baseManifestText)
  // Every manifest arm is exercised by MUTATING the real manifest, so an arm can only pass
  // here by actually noticing the mutation. `structuredClone` keeps the mutations from
  // leaking between checks — a shared object would let one arm's edit satisfy the next.
  const clone = () => structuredClone(baseManifest)
  const mutate = (fn) => { const m = clone(); fn(m); return m }
  const patchRow = (code, patch) => mutate((m) => Object.assign(m.permissions[code], patch))
  const REP = 'commission.forms.edit'   // a row WITH enumerated sites
  const BND = 'commission.cases.read'   // a row behind a call-graph boundary

  const checks = [
    // ⛔ TWO ARMS WERE REMOVED HERE AT AE4.9 (ADR 0176 D5), AND THE REASONS DIFFER. Removing
    // a subject breaks its assertions in two directions, so neither is deleted silently:
    //
    //   * `an unmapped catalog permission is caught` — fed `spec.catalogPermissions`, whose
    //     production loop is RETIRED because its predicate is false by construction (see the
    //     retirement comment in coverage()). The arm only ever passed because its synthetic
    //     input `commission.forms.manage_NOT_IN_AXES` was ALSO absent from the axis operations
    //     — it proved the loop ran, never that the loop asked a meaningful question.
    //     Replaced by: `D5 catalog - manifest` + `D5 manifest - catalog` below.
    //
    //   * `a non-legacy role with no matrix is caught` — fed `spec.nonLegacyRoles`. That
    //     PREDICATE IS NOT RETIRED; it moved to manifestReport() arm C2, where its subject is
    //     the manifest's measured role snapshot instead of a key nothing ever populated.
    //     Replaced by: `the retained non-legacy arm: a test_validation role with no
    //     differential suite is caught`, which additionally covers the `test_validation`
    //     state that the old arm's `authoritative`-shaped framing would have missed.
    {
      // The fixtureOnly flag going dead. Renaming the persona the flag keys on (while the
      // deny class keeps naming the old value) is exactly how a flag stops matching without
      // anything reding — so the arm renames it and expects the cross-check to fire.
      name: 'a dead fixtureOnly flag is caught',
      spec: {
        ...base,
        axes: {
          ...base.axes,
          persona: {
            ...base.axes.persona,
            values: Object.fromEntries(
              Object.entries(base.axes.persona.values).map(([k, v]) =>
                k === 'cross_org_actor' ? ['cross_org_actor_RENAMED', v] : [k, v],
              ),
            ),
          },
          scope: {
            ...base.axes.scope,
            values: Object.fromEntries(
              Object.entries(base.axes.scope.values).map(([k, v]) =>
                k === 'foreign_org_commission' ? ['foreign_org_commission_RENAMED', v] : [k, v],
              ),
            ),
          },
        },
        denyClasses: {
          ...base.denyClasses,
          cross_org: { scope: ['foreign_org_commission_RENAMED'], persona: ['cross_org_actor_RENAMED'] },
        },
      },
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

    // ======================================================================
    // ADR 0176 D5 — the ENFORCEMENT MANIFEST arms. Every one of these is new, so every one
    // must be SHOWN to fail; an arm that has never refused anything is not a gate. These
    // replace the two arms that ranged over `?? []` and passed having checked nothing.
    // ======================================================================
    {
      // D5 set difference 1 of 3. THE 44TH-PERMISSION CASE, which is the whole point:
      // generation must break until someone names the new permission's enforcement path.
      name: 'D5 catalog - manifest: a catalog permission with no manifest row is caught',
      manifest: mutate((m) => m.catalogSnapshot.permissions.push('commission.forty_fourth.invented')),
    },
    {
      // D5 set difference 2 of 3, the direction a one-way check would miss: a row for a
      // permission the catalog no longer has. Without this, deleting a permission leaves a
      // manifest row asserting an enforcement path for something that does not exist.
      name: 'D5 manifest - catalog: a manifest row for an unknown permission is caught',
      manifest: mutate((m) => { m.permissions['commission.ghost.row'] = structuredClone(m.permissions[BND]) }),
    },
    {
      // D5 set difference 3 of 3, stated in the ADR's own words.
      name: 'D5 authoritative - approved suites: an authoritative role with no suite is caught',
      manifest: mutate((m) => { m.catalogSnapshot.roles.find((r) => r.code === 'org_admin').state = 'authoritative' }),
    },
    {
      // ⭐ THE RETAINED `nonLegacyRoles` ARM — the one NOT retired. It fires on
      // `test_validation` too, which D5's `authoritative` wording alone would miss, and this
      // check is the evidence that it can refuse rather than merely being populated.
      name: 'the retained non-legacy arm: a test_validation role with no differential suite is caught',
      manifest: mutate((m) => { m.catalogSnapshot.roles.find((r) => r.code === 'org_admin').state = 'test_validation' }),
    },
    {
      // The literal thing 401 § 19's `CASE … ELSE` was: one key answering for everything.
      name: 'NO DEFAULT ARM: a wildcard row key is caught',
      manifest: mutate((m) => { m.permissions['*'] = structuredClone(m.permissions[BND]) }),
    },
    {
      name: 'NO DEFAULT ARM: a row missing a required key is caught (no field has a fallback)',
      manifest: mutate((m) => { delete m.permissions[BND].hardDenyProvenance }),
    },
    {
      // THE ESCAPE-HATCH FENCE. "not-attributable-until-rekey" is honest where sites are
      // unknown and a silencer where they are listed; borrowing it on a measurable row is
      // exactly how an unmeasurable-case allowance comes to silence the measured ones.
      name: 'the escape-hatch fence: "not-attributable-until-rekey" on a row WITH sites is caught',
      manifest: patchRow(REP, { hardDenyProvenance: 'not-attributable-until-rekey' }),
    },
    {
      name: 'a pending-rekey row that also names a domainAuthorizer is caught',
      manifest: patchRow(BND, { domainAuthorizer: 'app.can_something' }),
    },
    {
      name: 'a re-keyed row that names no domainAuthorizer is caught',
      manifest: patchRow(BND, { status: 're-keyed', pendingRekey: null }),
    },
    {
      name: 'a row declaring NEITHER a site NOR a reviewed boundary is caught',
      manifest: patchRow(BND, { callGraphBoundary: null }),
    },
    {
      name: 'an unreviewed call-graph boundary (no reviewer) is caught',
      manifest: mutate((m) => { delete m.permissions[BND].callGraphBoundary.reviewedBy }),
    },
    {
      // D5: lifecycle and sensitivity are DATA PER PERMISSION, "never a global omission".
      name: 'an empty resourceLifecycle (the global omission) is caught',
      manifest: mutate((m) => { m.permissions[BND].axes.resourceLifecycle = [] }),
    },
    {
      name: 'a lifecycle claimed inapplicable while declaring real lifecycle values is caught',
      manifest: mutate((m) => { m.permissions[BND].axes.resourceLifecycle = ['draft'] }),
    },
    {
      // The fuse that makes 410's catalog binding on sensitivityCeiling also pin the axis.
      name: 'axes.sensitivity disagreeing with catalog.sensitivityCeiling is caught',
      manifest: mutate((m) => { m.permissions[BND].axes.sensitivity = 'phi' }),
    },
    {
      name: 'a hard-deny class outside the declared vocabulary is caught',
      manifest: patchRow(REP, { hardDenyClasses: ['not_a_real_deny_class'] }),
    },
    {
      // Without this, C1 (approvedSuites) and C2 (subjectRoles) could drift apart and each
      // would keep passing against its own half of a broken pair.
      name: 'approvedSuites drifting from the axes file subjectRoles is caught',
      manifest: mutate((m) => { m.approvedSuites.org_admin = { matrix: 'nope' } }),
    },
    {
      name: 'a snapshot role absent from the axes file catalogRoles is caught',
      manifest: mutate((m) => { m.catalogSnapshot.roles.find((r) => r.code === 'staff').code = 'staff_RENAMED' }),
    },
    {
      // The retired ELSE arm, refused in its new home: a row with no legacy gate.
      name: 'a row whose legacyEquivalence names no gate is caught (the retired ELSE)',
      manifest: mutate((m) => { m.permissions[BND].legacyEquivalence.gate = '' }),
    },
    {
      name: 'a policy site that names no relation is caught',
      manifest: mutate((m) => { m.permissions[REP].enforcementSites[0].relation = null }),
    },
    {
      name: 'a compatibility exception with no owner/expiry is caught (D5 requires both)',
      manifest: patchRow(BND, { exception: { reason: 'because' } }),
    },
    {
      // ⭐⭐ THE ONE I HIT WHILE AUTHORING. `JSON.parse` keeps the LAST duplicate silently, so
      // a row can READ as re-keyed and PARSE as pending and every other arm agrees with the
      // wrong half. Only the raw text still holds the evidence, so this arm feeds raw text.
      name: 'a DUPLICATE key inside a permission row is caught (JSON.parse hides it)',
      manifest: baseManifest,
      manifestRaw: baseManifestText.replace(
        `    "${BND}": {\n      "status":`,
        `    "${BND}": {\n      "pendingRekey": null,\n      "status":`,
      ),
    },
    {
      // The re-key MOVED the tenancy arm from the policies into the authorizer. A row that
      // recorded only per-site composition would have declared that authority deleted.
      name: 'a re-keyed row whose authorizer composes nothing is caught',
      manifest: mutate((m) => { m.permissions[REP].domainAuthorizer.composedWith = [] }),
    },
    {
      name: 'a re-keyed row that does not declare its authorizer grant posture is caught',
      manifest: mutate((m) => { delete m.permissions[REP].domainAuthorizer.executableByAuthenticated }),
    },
    {
      name: 'a re-keyed row still carrying a targetAuthorizer is caught',
      manifest: patchRow(REP, { targetAuthorizer: { function: 'app.x', provisional: false, executableByAuthenticated: true } }),
    },
    {
      // ⛔⛔ THE LEAD'S CONDITION, MADE FALSIFIABLE. Re-keying moved the tenancy arm out of the
      // policy body (where a pg_policies audit sees it) and into a DEFINER function (where it
      // does not). A row that drops the disclosure would read as fully permission-keyed.
      name: 'a re-keyed row hiding a non-permission grant path is caught',
      manifest: patchRow(REP, { residualLegacyAuthority: [] }),
    },
    {
      name: 'a residual arm declared without a retirement condition is caught',
      manifest: mutate((m) => { delete m.permissions[REP].residualLegacyAuthority[0].retiredBy }),
    },
    {
      // ⛔ ISOLATED: this ADDS an undeclared-side entry rather than RENAMING the real one.
      // A rename breaks BOTH directions at once, so failures[0] would be the sibling arm's
      // message and this arm would never be shown to fire on its own predicate — the
      // "an arm caught by ANOTHER arm's message is not proof that arm works" shape.
      name: 'a residual arm the authorizer does not actually compose is caught',
      manifest: mutate((m) => {
        m.permissions[REP].residualLegacyAuthority.push({ gate: 'app.not_composed_at_all', population: 'p', retiredBy: 'r' })
      }),
    },
    {
      // The opposite failure, and the one that matters most: a row marked re-keyed whose
      // authorizer never calls the resolver at all — the inert-catalog defect ADR 0176 repairs.
      name: 'a re-keyed row whose authorizer never composes the permission arm is caught',
      manifest: mutate((m) => {
        m.permissions[REP].domainAuthorizer.composedWith = ['app.is_tenancy_admin_of_for']
      }),
    },
    {
      name: 'a pending-rekey row claiming a residual arm is caught (no authorizer to hold it)',
      manifest: patchRow(BND, { residualLegacyAuthority: [{ gate: 'app.x', population: 'y', retiredBy: 'z' }] }),
    },
  ]
  let bad = 0
  for (const { name, spec, manifest, manifestRaw } of checks) {
    const useSpec = spec ?? base
    const useManifest = manifest ?? baseManifest
    const manifestText = manifestRaw
    let cells, skipped
    try {
      ;({ cells, skipped } = enumerate(useSpec))
    } catch {
      cells = []
      skipped = []
    }
    let cov
    try {
      cov = coverage(useSpec, useManifest, cells, skipped, manifestText)
    } catch (e) {
      // A THROW IS NOT A CATCH. The gate's contract is a named failure, not a stack trace:
      // a crash in `npm run lint` reads as a broken script rather than as a refused manifest,
      // and the next person "fixes" the script. Treated as NOT CAUGHT on purpose.
      console.error(`gen-authz-matrix-cells --self-test: THREW instead of reporting — ${name} (${e.message})`)
      bad++
      continue
    }
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
  const realCov = coverage(base, baseManifest, real.cells, real.skipped, baseManifestText)
  if (realCov.failures.length > 0) {
    console.error(`gen-authz-matrix-cells --self-test: the REAL spec trips the gate — ${realCov.failures[0]}`)
    bad++
  } else {
    console.log('gen-authz-matrix-cells --self-test: caught nothing on the real spec (discrimination control)')
  }
  // ⭐ A SECOND DISCRIMINATION CONTROL, FOR THE EMITTER. The arms above prove the VALIDATOR
  // can refuse; they say nothing about whether the emitter can run. `req()` throws on a key
  // the validator forgot to demand, so emitting the real manifest is what proves the two
  // halves agree about which fields exist.
  try {
    const psql = emitManifest(baseManifest, 'selftest')
    const n = (psql.match(/^ {4}\('/gm) ?? []).length
    if (n === 0) throw new Error('the emitted fixture has no rows')
    console.log(`gen-authz-matrix-cells --self-test: emitter ran on the real manifest (${n} fixture rows)`)
  } catch (e) {
    console.error(`gen-authz-matrix-cells --self-test: the emitter FAILED on the real manifest — ${e.message}`)
    bad++
  }
  process.exit(bad === 0 ? 0 : 1)
}

// --------------------------------------------------------------------------
const raw = readFileSync(SRC)
const sha = createHash('sha256').update(raw).digest('hex')
const spec = JSON.parse(raw.toString('utf8'))

const manifestRaw = readFileSync(MANIFEST_SRC)
const manifestSha = createHash('sha256').update(manifestRaw).digest('hex')
const manifest = JSON.parse(manifestRaw.toString('utf8'))

const { cells, skipped } = enumerate(spec)

// ⛔ A generator that emits an empty fixture is the "detector that finds nothing" shape:
// pgTAP would iterate zero rows and pass having asserted nothing. Refuse here, where the
// diagnosis is free.
if (cells.length === 0) {
  console.error('gen-authz-matrix-cells: refusing to emit — the enumeration is empty.')
  process.exit(1)
}

const cov = coverage(spec, manifest, cells, skipped, manifestRaw.toString('utf8'))
if (cov.failures.length > 0) {
  console.error('gen-authz-matrix-cells: COVERAGE FAILURE — refusing to emit.')
  for (const f of cov.failures) console.error(`  - ${f}`)
  process.exit(1)
}

const manifestBody = emitManifest(manifest, manifestSha)

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const arr = (a) => (a.length === 0 ? 'array[]::text[]' : `array[${a.map(q).join(', ')}]`)

const rows = cells
  .map(
    (c) =>
      `    (${q(c.id)}, ${q(c.persona)}, ${q(c.role)}, ${q(c.activeContext)}, ${q(c.scope)}, ` +
      `${q(c.operation)}, ${q(c.operationTier)}, ${q(c.principalState)}, ${q(c.resourceLifecycle)}, ` +
      `${q(c.sensitivity)}, ${arr(c.denyClasses)}, ${c.fixtureOnly})`,
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
--
-- ⚠ THE FIXTURE-ONLY COUNT IS AN AE4.3 SIZING INPUT, NOT A FOOTNOTE. No seeded persona
-- holds a membership or affiliation outside its home org — there is NO cross-org persona —
-- so a cross-org test written against a seeded persona passes while proving nothing. Every
-- cell above marked fixture-only needs a purpose-built actor, created and deleted BY
-- IDENTITY (positional cleanup eats seed rows ~900 tests depend on).
--
-- Editing this file by hand REDS \`npm run lint:authz-vectors\`.
create temp table authz_matrix_cells on commit drop as
  select * from (values
${rows}
  ) as t(cell_id, persona, role, active_context, scope, operation, operation_tier,
         principal_state, resource_lifecycle, sensitivity, deny_classes, fixture_only);

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
  let currentManifest = ''
  try {
    currentManifest = readFileSync(MANIFEST_OUT, 'utf8')
  } catch {
    console.error(`gen-authz-matrix-cells: ${MANIFEST_OUT} is missing — run the generator.`)
    process.exit(1)
  }
  if (currentManifest.replace(/\r\n/g, '\n') !== manifestBody) {
    console.error(
      'gen-authz-matrix-cells: DRIFT — the generated enforcement-manifest .psql does not match the manifest JSON.\n' +
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
  if (currentCov.replace(/\r\n/g, '\n') !== JSON.stringify({ sourceSha256: sha, manifestSha256: manifestSha, ...cov }, null, 2) + '\n') {
    console.error('gen-authz-matrix-cells: DRIFT — the coverage report is stale.')
    process.exit(1)
  }
  console.log(
    `gen-authz-matrix-cells: in sync (${cov.executed} cells, ${cov.skipped} skipped, sha ${sha.slice(0, 12)}; ` +
      `manifest ${cov.manifest.permissionRows} rows, ${JSON.stringify(cov.manifest.statusCounts)}, sha ${manifestSha.slice(0, 12)})`,
  )
  process.exit(0)
}

writeFileSync(OUT, body, 'utf8')
writeFileSync(MANIFEST_OUT, manifestBody, 'utf8')
writeFileSync(COVERAGE, JSON.stringify({ sourceSha256: sha, manifestSha256: manifestSha, ...cov }, null, 2) + '\n', 'utf8')
console.log(
  `gen-authz-matrix-cells: wrote ${cov.executed} cells (${cov.skipped} skipped) -> ${OUT}\n` +
    `gen-authz-matrix-cells: wrote ${cov.manifest.permissionRows} manifest rows ` +
    `(${JSON.stringify(cov.manifest.statusCounts)}, ${cov.manifest.enforcementSites} sites) -> ${MANIFEST_OUT}`,
)
