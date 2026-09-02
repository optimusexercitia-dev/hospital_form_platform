import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ROLE_LABELS,
  ROLE_MANIFEST,
  ROLE_ORDER,
  ROLE_SCOPE_KIND,
} from '@/lib/role/role-catalog'
// ⚠ A TEST importing from `src/components` — deliberate, and not the layering inversion
// role-catalog.ts's header warns about. That warning is about a `src/lib/queries` MODULE
// taking a runtime dependency on components; this is a gate reaching for the map it
// binds, and the map is a pure pt-BR label object with no client boundary.
import { ROLE_LABELS as BLOCKER_ROLE_LABELS } from '@/components/users/affiliation-blocker-label'

/**
 * ⭐ AE4.8 [PA-F1] — THE TS MANIFEST IS BOUND TO THE DB CATALOG, HERE, NOT IN REVIEW.
 *
 * WHY THIS FILE EXISTS RATHER THAN A RUNTIME QUERY. ADR 0155 G4 asked for
 * `assume_role`'s validity check to read `authz.roles.session_selectable` "via a typed
 * query". It is not implementable: AE4.1 keeps `authz` out of `config.toml`'s exposed
 * schemas and grants no client role USAGE on it (measured — `anon`, `authenticated` AND
 * `service_role` are all false). Satisfying G4 literally would mean cutting a NEW public
 * door into the schema AE4 deliberately sealed, in exchange for a UI pre-filter whose
 * authority is `public.assume_role` anyway. So the binding moves from query time to GATE
 * time: same "cannot drift silently" property, no new runtime surface.
 *
 * ⚠ THE CATALOG IS READ AT TEST TIME, NOT TRANSCRIBED. The recorded rule is that an
 * enumeration's boundary must be the PROPERTY, never a remembered list — and every
 * instance of the landing-seam class so far has been someone updating one list and not
 * the other. This is the sibling of `session-grants.test.ts`'s FUP-QO-2 guard, which
 * binds the same manifest to `memberships_role_check` from the other side.
 *
 * ⚠ REQUIRES THE LOCAL SUPABASE STACK, and FAILS LOUDLY when it is down rather than
 * skipping. A guard that quietly turns itself off is the trap it exists to prevent.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

/** Read `authz.roles` through the DB container — the same route every mutation harness
 * in `supabase/tests/mutation/` takes, and the same container-name derivation
 * `session-grants.test.ts` uses (renaming the project cannot silently point this at a
 * container that does not exist). */
function readAuthzRolesFromCatalog(): Array<{
  code: string
  scopeKind: string
  sessionSelectable: boolean
}> {
  const configPath = path.join(REPO_ROOT, 'supabase', 'config.toml')
  const projectId = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(configPath, 'utf8'),
  )?.[1]
  if (!projectId) {
    throw new Error(`AE4.8 manifest guard: no project_id in ${configPath}`)
  }

  // ⚠ `session_selectable` is spelled out as 't'/'f' RATHER THAN concatenated directly.
  // Inside a `||` expression Postgres casts boolean to text as 'true'/'false', NOT the
  // 't'/'f' that psql prints for a bare boolean COLUMN — so the obvious form parses to
  // sessionSelectable=false for every row, which makes the two comparison assertions
  // vacuous against an empty set. Caught by the discrimination control below, which is
  // the only assertion here that could see it.
  const sql =
    "select code || '|' || allowed_scope_kind || '|' || " +
    "case when session_selectable then 't' else 'f' end from authz.roles"

  let raw: string
  try {
    raw = execFileSync(
      'docker',
      [
        'exec',
        `supabase_db_${projectId}`,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-tAc',
        sql,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (cause) {
    throw new Error(
      'AE4.8 manifest guard: could not read authz.roles from the live catalog. Start ' +
        'the local stack (`supabase start`) — this guard reads the catalog on purpose ' +
        'and must never silently skip.',
      { cause },
    )
  }

  const rows = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, scopeKind, selectable] = line.split('|')
      return { code, scopeKind, sessionSelectable: selectable === 't' }
    })

  if (rows.length === 0) {
    throw new Error(
      'AE4.8 manifest guard: authz.roles yielded ZERO rows. Either the catalog is ' +
        'unseeded or the schema moved — an empty enumeration would make every ' +
        'assertion below vacuous.',
    )
  }
  return rows
}

describe('role-catalog manifest ↔ authz.roles', () => {
  const catalog = readAuthzRolesFromCatalog()
  const selectable = catalog.filter((r) => r.sessionSelectable)

  it('the manifest covers every platform_role — ROLE_ORDER is not exhaustive by type', () => {
    // ⛔ `as const satisfies readonly PlatformRole[]` does NOT catch a MISSING role: a
    // short array still satisfies the constraint. ROLE_LABELS is exhaustive by type, so
    // comparing against its keys is the check the type system cannot make.
    expect([...ROLE_ORDER].sort()).toEqual(Object.keys(ROLE_LABELS).sort())
    expect(ROLE_MANIFEST).toHaveLength(Object.keys(ROLE_LABELS).length)
    expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length)
  })

  it('the manifest is exactly the session-selectable half of authz.roles', () => {
    // ⚠ NOT "every authz.roles row". `administrativo` is a per-commission delegated
    // CAPABILITY, not a platform_role (CLAUDE.md §1, ADR 0061), and it is the one row
    // with session_selectable = false. A guard keyed on row COUNT would red on day one
    // and be "fixed" by loosening it; keyed on the property, it says something true.
    expect([...ROLE_ORDER].sort()).toEqual(selectable.map((r) => r.code).sort())
  })

  it('every manifest scopeKind equals authz.roles.allowed_scope_kind', () => {
    const fromCatalog = Object.fromEntries(
      selectable.map((r) => [r.code, r.scopeKind]),
    )
    const fromManifest = Object.fromEntries(
      ROLE_MANIFEST.map((r) => [r.code, r.scopeKind]),
    )
    expect(fromManifest).toEqual(fromCatalog)
  })

  it('DISCRIMINATION CONTROL — the catalog read distinguishes selectable from not', () => {
    // ⛔ Without this, a query returning every row as sessionSelectable=true would
    // satisfy the two assertions above only by accident of the current data, and a
    // query returning NONE would make `selectable` empty and both comparisons vacuous
    // against an equally empty manifest. Both directions must be observed.
    expect(selectable.length).toBeGreaterThan(0)
    expect(catalog.length).toBeGreaterThan(selectable.length)
    expect(catalog.some((r) => !r.sessionSelectable)).toBe(true)
  })

  it('the affiliation-blocker label map covers the same roles — SHARED KEYS, OWN WORDING', () => {
    // ⭐ AE4.8's first bullet, as RULED rather than as written. The plan said "the six
    // label maps collapse into ROLE_LABELS re-exports". Measured, there are no six: the
    // Interviewer/Attendee/RcaMember maps key on unrelated enums, and the two that DO key
    // on platform roles carry deliberately DIFFERENT pt-BR vocabularies —
    // "Coordenação" here vs "Coordenador(a) de comissão" in the picker. Collapsing the
    // TEXT would have changed user-facing copy in an increment specified as
    // behaviour-preserving, and broken the fixture that pins the current wording.
    //
    // ⛔ So the binding is on the KEY SET only. Adding a role to the manifest now fails
    // here until it is named in the blocker map too — which is the actual defect the
    // bullet was aimed at (that module's own header records shipping a blocker rendered
    // as a nameless empty label). The wording stays that module's to own.
    //
    // ⚠ `platform_admin` is excluded BY PROPERTY, not by exception: blockers come from
    // `memberships`, and platform_admin lives in `profiles.is_admin` and never holds a
    // memberships row (D11), so a label for it there could never render.
    const expected = ROLE_ORDER.filter((c) => c !== 'platform_admin').sort()
    expect(Object.keys(BLOCKER_ROLE_LABELS).sort()).toEqual(expected)
  })

  it('ROLE_SCOPE_KIND holds only values the catalog vocabulary uses', () => {
    // Catches a typo'd scope kind that happens to match no role and would otherwise
    // surface only as a silently-unpartitioned grant.
    //
    // ⛔ ASSERTED AS A SET DIFFERENCE, NOT IN A LOOP. The loop form put every assertion
    // on a conditional path — an empty ROLE_SCOPE_KIND would have run zero `expect`s and
    // passed. `lint:vacuous` caught it, which is the gate doing exactly its job; the
    // set-difference form asserts unconditionally AND names what was unexpected.
    const catalogKinds = new Set(catalog.map((r) => r.scopeKind))
    const unknown = [...new Set(Object.values(ROLE_SCOPE_KIND))].filter(
      (kind) => !catalogKinds.has(kind),
    )
    expect(unknown).toEqual([])
    // Cardinality control: the comparison above is only meaningful over a non-empty map.
    expect(Object.keys(ROLE_SCOPE_KIND).length).toBe(ROLE_ORDER.length)
  })
})
