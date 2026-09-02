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
 * ⭐ AE4.8 [PA-F1], split at AE4.9 "do now" item (d) / audit finding IA-F7.
 *
 * WHY THIS FILE USED TO SHELL OUT TO DOCKER, AND WHY IT NO LONGER DOES.
 * The original guard read `authz.roles` through `docker exec … psql` so that
 * `ROLE_MANIFEST` could never drift from the live catalog without a test noticing (ADR
 * 0155 G4's "typed query" ask is not implementable — `authz` is deliberately outside
 * every client role's reach; see `role-catalog.ts`'s `isPlatformRole` doc comment for
 * the full reasoning). That bound `npm run test` (a unit-test run) to Docker being up,
 * which is a database dependency a *unit* suite must not carry.
 *
 * IA-F7 splits the guard by what each half actually needs:
 *   - Provable from `ROLE_MANIFEST`/`ROLE_LABELS`/`ROLE_SCOPE_KIND`/`BLOCKER_ROLE_LABELS`
 *     alone, with no I/O beyond reading this repo's own committed text — stays HERE.
 *   - Needs the live `authz.roles` catalog — moved to the pgTAP suite
 *     `supabase/tests/411_ae48_role_manifest_db_gate.sql`, which runs post-`db reset`
 *     as part of the DB gate, not as a unit test.
 *
 * THE CROSS-LANGUAGE SEAM. `ROLE_MANIFEST` is TypeScript; pgTAP is SQL; neither side can
 * import the other. 411's file carries a COMMITTED (code, scope_kind) snapshot between
 * `MANIFEST-SNAPSHOT-BEGIN`/`END` markers — a literal, machine-checkable stand-in for
 * `ROLE_MANIFEST` that both sides key on:
 *   - THIS file reads 411's SQL as plain text (`fs.readFileSync`, no DB, no Docker) and
 *     asserts the snapshot equals `ROLE_MANIFEST` — see the last test below.
 *   - 411 asserts that SAME snapshot against the live `authz.roles` table.
 * Neither hop alone re-proves the original claim ("ROLE_MANIFEST is authz.roles' live
 * session-selectable half"); chained, they do, and each hop can red independently on its
 * own half of a drift (edit `ROLE_MANIFEST` without touching 411's snapshot → this file
 * reds; edit a migration's role seed without touching 411's snapshot → 411 reds).
 *
 * ⚠ THE CATALOG IS STILL READ AT (DB) GATE TIME, NOT TRANSCRIBED BY HAND INTO A SECOND
 * TS FILE. The recorded rule is that an enumeration's boundary must be the PROPERTY,
 * never a remembered list — every instance of the landing-seam class so far has been
 * someone updating one list and not the other. This is the sibling of
 * `session-grants.test.ts`'s FUP-QO-2 guard, which binds the same manifest to
 * `memberships_role_check` from the other side.
 */

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

const DB_GATE_RELATIVE_PATH = path.join(
  'supabase',
  'tests',
  '411_ae48_role_manifest_db_gate.sql',
)
const MANIFEST_SNAPSHOT_BEGIN = '-- MANIFEST-SNAPSHOT-BEGIN'
const MANIFEST_SNAPSHOT_END = '-- MANIFEST-SNAPSHOT-END'

/**
 * Parse the (code, scope_kind) snapshot embedded in 411's pgTAP file — see the module
 * doc comment above. Plain-text `fs.readFileSync` of a file already checked into THIS
 * repo: no DB connection, no Docker, no network. This is what lets the drift check below
 * run in the same process as every other unit test.
 */
function readManifestSnapshotFromDbGate(): Array<{ code: string; scopeKind: string }> {
  const gatePath = path.join(REPO_ROOT, DB_GATE_RELATIVE_PATH)
  const text = readFileSync(gatePath, 'utf8')

  const begin = text.indexOf(MANIFEST_SNAPSHOT_BEGIN)
  const end = text.indexOf(MANIFEST_SNAPSHOT_END)
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `AE4.9/IA-F7 manifest guard: could not find the ${MANIFEST_SNAPSHOT_BEGIN} / ` +
        `${MANIFEST_SNAPSHOT_END} markers in ${DB_GATE_RELATIVE_PATH}. Keep them exactly — ` +
        'this test parses that file as plain text to bind ROLE_MANIFEST to the committed ' +
        'snapshot 411 checks against the live catalog.',
    )
  }
  const block = text.slice(begin, end)

  // Matches each `('code', 'scope_kind')` row. The surrounding `create temp table` /
  // `insert into … values` SQL has no other single-quoted-pair shape, so this cannot
  // pick up anything but the data rows.
  const rowPattern = /\(\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*\)/g
  const rows: Array<{ code: string; scopeKind: string }> = []
  let match: RegExpExecArray | null
  while ((match = rowPattern.exec(block)) !== null) {
    rows.push({ code: match[1], scopeKind: match[2] })
  }

  if (rows.length === 0) {
    throw new Error(
      `AE4.9/IA-F7 manifest guard: parsed ZERO rows out of ${DB_GATE_RELATIVE_PATH}'s ` +
        'snapshot block. An empty snapshot would make the comparison below vacuous.',
    )
  }
  return rows
}

describe('role-catalog manifest — pure checks + the committed DB-gate snapshot binding', () => {
  it('the manifest covers every platform_role — ROLE_ORDER is not exhaustive by type', () => {
    // ⛔ `as const satisfies readonly PlatformRole[]` does NOT catch a MISSING role: a
    // short array still satisfies the constraint. ROLE_LABELS is exhaustive by type, so
    // comparing against its keys is the check the type system cannot make.
    expect([...ROLE_ORDER].sort()).toEqual(Object.keys(ROLE_LABELS).sort())
    expect(ROLE_MANIFEST).toHaveLength(Object.keys(ROLE_LABELS).length)
    expect(new Set(ROLE_ORDER).size).toBe(ROLE_ORDER.length)
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

  it('ROLE_SCOPE_KIND is defined for exactly the manifest roles (cardinality control)', () => {
    // Ported from the old "ROLE_SCOPE_KIND holds only values the catalog vocabulary
    // uses" test's non-DB half. Its OTHER half — no scope kind is a stranger to
    // `authz.roles.allowed_scope_kind`'s real vocabulary — needs the live catalog and
    // now lives in 411 §5; this half needs nothing but the TS objects themselves, and
    // guards against ROLE_SCOPE_KIND being shorter than ROLE_ORDER, which would make
    // 411 §5's vocabulary-subset check meaningful over a silently-shrunken set.
    expect(Object.keys(ROLE_SCOPE_KIND).length).toBe(ROLE_ORDER.length)
  })

  it('ROLE_MANIFEST matches the committed snapshot 411 binds to the live catalog (IA-F7)', () => {
    // ⭐ THE DRIFT CHECK. This is the TS-side hop of the two-hop chain described in the
    // module doc comment: it proves ROLE_MANIFEST agrees with the COMMITTED snapshot
    // (plain text, no DB); 411 proves that SAME snapshot agrees with the live
    // `authz.roles` catalog (DB, post-`db reset`). Together they re-prove what the old
    // single Docker-shelling test proved — that ROLE_MANIFEST is exactly authz.roles'
    // session-selectable half, with matching scope kinds — without either hop acquiring
    // the other's dependency.
    //
    // ⛔ Edit ROLE_MANIFEST (add/remove a role, change a scopeKind) without updating
    // 411's snapshot block, or vice versa, and THIS test reds — no `supabase start`
    // required to see it.
    const snapshot = readManifestSnapshotFromDbGate()
    const fromManifest = [...ROLE_MANIFEST]
      .map((r) => ({ code: r.code, scopeKind: r.scopeKind }))
      .sort((a, b) => a.code.localeCompare(b.code))
    const fromSnapshot = [...snapshot].sort((a, b) => a.code.localeCompare(b.code))

    // Cardinality control first: a truncated snapshot would make the equality below
    // pass on a subset instead of the whole manifest.
    expect(snapshot.length).toBe(ROLE_MANIFEST.length)
    expect(fromSnapshot).toEqual(fromManifest)
  })
})
