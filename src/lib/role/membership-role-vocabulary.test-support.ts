import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { ROLE_MANIFEST } from '@/lib/role/role-catalog'

/**
 * ⭐ FUP-VITEST-CATALOG-DRIVEN-CASE-COUNT — the membership role vocabulary, from BOTH sides.
 *
 * TEST SUPPORT, NOT A SUITE. The `.test-support.ts` suffix keeps this file outside
 * `vitest.config.mts`'s `include` (`src/**\/*.{test,spec}.{ts,tsx}`) while leaving it under
 * `src/` for the `@/` alias and eslint's first-party scope. Nothing in the application
 * imports it; it shells out to Docker and must never be reachable from app code.
 *
 * THE PROPERTY IT SERVES. Two unit suites — `src/lib/queries/session-grants.test.ts` and
 * `src/components/shell/nav-scope-exclusivity.test.ts` — read `public.memberships_role_check`
 * from the LIVE database at import and generate one test per role returned (three `it.each`
 * blocks between them, so the dynamic surface is 3N). A read taken inside a `supabase db
 * reset`'s transient window — the constraint present and valid but PARTIAL — generates fewer
 * cases and reports a tidy green; pgTAP `292` pins the vocabulary durably but structurally
 * cannot see that window (it reads the same database at a different time). So each suite
 * asserts that its read equals the expected SET, and the expected set comes from here.
 *
 * ⛔⛔ TWO EXPORTED FUNCTIONS, AND NO MODULE-SCOPE VALUE — ON PURPOSE. A `const` evaluated at
 * module scope would make *how many times the catalog is read* an emergent property of the
 * runner's isolation / pool settings (per-file isolation re-evaluates it; a shared module
 * registry collapses the reads to one per worker), and `vitest.config.mts` pins NEITHER
 * `pool` NOR `isolate`, so that count would move under a version bump nobody connects to
 * these tests. A function needs none of that reasoning: every read is explicit and
 * reviewable at its call site. Keep it that way — the change that breaks it looks exactly
 * like tidying.
 *
 * ⛔ ONE READER, TWO CALL SITES — never collapse the CALLS. The reader's LOGIC used to be
 * copy-pasted into both suites (two independently maintained regexes over
 * `pg_get_constraintdef`, drift-able with nothing to catch it); that is the defect this
 * module removes. The two independent READS are a feature: two reads that must both equal
 * one expected set make a catalog change *between them* observable, which is the transient
 * window above. Each suite keeps its own top-level read.
 */

/**
 * The expected `memberships_role_check` vocabulary, DERIVED from `ROLE_MANIFEST` — every
 * role whose assignment scope is not `"none"` — and sorted, so it compares with
 * `[...read].sort()` by `toEqual`.
 *
 * WHY THIS IS NOT A NEW HAND-TYPED LITERAL. `ROLE_MANIFEST` is already bound to the live
 * `authz.roles` catalog by lint gate 19 (`lint:role-manifest`, parsing the manifest as text
 * against the committed artifact `supabase/tests/vectors/role_manifest.psql`) and pgTAP
 * `411` (that artifact against the live table). A fourth written copy of the vocabulary
 * would have been a fourth drift path; a projection of the pinned one is not.
 *
 * WHY `scopeKind !== "none"` IS THE FILTER. `memberships` rows are keyed to a scope
 * (organization / hospital / commission); a role assigned at NO scope — today only
 * `platform_admin`, which lives in `profiles.is_admin` — has no `memberships` row and is
 * therefore not in the CHECK. The filter is the manifest's own statement of that fact,
 * not a remembered exclusion list.
 *
 * ⚠ SET equality, never `.length`: a count misses a SUBSTITUTION (one role removed and one
 * added leaves the length identical while every generated case silently changes subject).
 */
export function expectedMembershipRoleVocabulary(): string[] {
  return ROLE_MANIFEST.filter((entry) => entry.scopeKind !== 'none')
    .map((entry) => entry.code)
    .sort()
}

/**
 * The live role vocabulary of `public.memberships_role_check`, read through the DB
 * container — the same path every mutation harness in `supabase/tests/mutation/` uses.
 * The container name is derived from `supabase/config.toml`'s `project_id` rather than
 * hardcoded, so renaming the project cannot silently point this at a container that does
 * not exist. Same extraction as pgTAP `292` §3's `role_vocab`.
 *
 * ⚠ REQUIRES THE LOCAL SUPABASE STACK, AND FAILS CLOSED. With the stack down it THROWS —
 * "this guard reads the catalog on purpose and must never silently skip" — rather than
 * falling back to a list: a guard that quietly turns itself off is the "defensive branching
 * converts not-implemented into passing" trap. Zero roles also throws, because an empty
 * enumeration would make every generated assertion vacuous. `guardName` is the calling
 * suite's own name, so each message still says WHICH guard could not read.
 */
export function readRoleVocabularyFromCatalog(guardName: string): string[] {
  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const configPath = path.join(repoRoot, 'supabase', 'config.toml')
  const projectId = /^\s*project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(configPath, 'utf8'),
  )?.[1]
  if (!projectId) {
    throw new Error(`${guardName}: no project_id in ${configPath}`)
  }

  const sql = `select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g'))[1]
                 from pg_constraint
                where conrelid = 'public.memberships'::regclass
                  and conname = 'memberships_role_check'`

  let raw: string
  try {
    raw = execFileSync(
      'docker',
      ['exec', `supabase_db_${projectId}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (cause) {
    throw new Error(
      `${guardName}: could not read memberships_role_check from the live catalog. ` +
        'Start the local stack (`supabase start`) — this guard reads the catalog on ' +
        'purpose and must never silently skip.',
      { cause },
    )
  }

  const roles = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (roles.length === 0) {
    throw new Error(
      `${guardName}: memberships_role_check yielded ZERO roles. Either the constraint ` +
        'was renamed or the extraction regex no longer matches its definition — an empty ' +
        'enumeration would make every assertion below vacuous.',
    )
  }
  return roles
}
