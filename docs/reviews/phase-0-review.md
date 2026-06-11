# Phase 0 QA Review

**Phase:** 0 — Scaffolding & Environment  
**Date:** 2026-06-11  
**Reviewer:** qa  
**Verdict:** APPROVED

---

## Summary

Phase 0 meets all acceptance criteria from PHASES.md. Every required command
(`npm run dev`, `npm run test`, `npx playwright test`, `supabase start`) works
from the current checkout. The five acceptance items are all satisfied.
Two minor findings are noted below — neither is blocking for Phase 0 given its
scope, but one must be resolved before Phase 2.

---

## Acceptance Criteria Audit

| Criterion | Status | Evidence |
| --------- | ------ | -------- |
| Next.js + TS + Tailwind v4 + shadcn + ESLint/Prettier initialized | PASS | package.json, components.json, .prettierrc.json, eslint.config.mjs all present and correct |
| Supabase CLI local stack running | PASS | `npx supabase status` confirms stack is up at http://127.0.0.1:54321 |
| Empty initial migration | PASS | `supabase/migrations/20260611234112_initial.sql` — intentionally empty, comment-documented |
| Type generation wired | PASS | `gen:types` npm script in package.json; database.ts generated from empty schema |
| Playwright installed with one smoke test | PASS | `e2e/home.spec.ts` — 3 tests, 3 passed, includes keyboard-only flow |
| Vitest installed with one smoke test | PASS | `src/app/page.test.tsx` — 2 tests, 2 passed |
| PROGRESS.md created | PASS | Present at repo root with all required tables |
| `docs/decisions/` started | PASS | ADR 0001 exists at `docs/decisions/0001-scaffolding-and-toolchain.md` |
| All four commands succeed | PASS | Verified locally: lint, typecheck, `npm run test`, `npx playwright test` all exit 0 |

---

## Code Quality Review

### Client Factories (`src/lib/supabase/`)

Both `browser.ts` and `server.ts` follow the current `@supabase/ssr` patterns
correctly:

- `browser.ts` uses `createBrowserClient` — correct.
- `server.ts` uses `createServerClient` with `getAll`/`setAll` cookie handlers
  and `await cookies()` — this is the correct async pattern for Next.js App
  Router. The `setAll` silently swallows the `ReadonlyRequestCookiesError` that
  fires from Server Components, which is the documented workaround.
- Both are typed with `Database` imported from `src/lib/types/`.
- Neither references the service-role key.

### TypeScript

`tsconfig.json` has `"strict": true`. No `any` usage found in any Phase 0
source file. `vitest/globals` and `@testing-library/jest-dom` are in the
`types` array — correct for global Vitest APIs in tests.

### `database.ts`

Generated from the empty Phase 0 schema. Contains only the `graphql_public`
schema entries plus empty `public` tables/views/functions — exactly expected.
The boilerplate `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, and
`CompositeTypes` generic helpers are present and will be populated in Phase 1.

### Tests

- Vitest smoke tests make semantic assertions (heading by role, link count)
  rather than implementation-tied snapshots — appropriate for a scaffold test.
- Playwright spec includes the keyboard-only tab-focus test required by
  CLAUDE.md §8 for each phase.
- `--passWithNoTests` was removed (confirmed absent from package.json and
  vitest.config.mts), consistent with the PROGRESS.md task note.

---

## Security Review

1. **No service-role key in client code.** `grep` of `src/` for `service_role`,
   `SERVICE_ROLE`, and `sb_secret` returns nothing. The key appears only in
   `.env.local` (gitignored) and the `.env.example` placeholder.

2. **`NEXT_PUBLIC_` prefix correctly scoped.** Only `NEXT_PUBLIC_SUPABASE_URL`
   and `NEXT_PUBLIC_SUPABASE_ANON_KEY` carry the prefix. `SUPABASE_SERVICE_ROLE_KEY`
   is correctly unprefixed in both `.env.example` and `.env.local`.

3. **`.env.local` is gitignored.** `git check-ignore .env.local` confirms it.
   The `.gitignore` pattern is `.env*` with a whitelist for `.env.example`.

4. **`.claude/settings.json` contains no secrets** — only the
   `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env flag.

5. **`.env.local` contains commented-out remote production JWT keys** (lines
   17–19). These are valid local-dev keys for the linked Supabase Cloud project
   and are gitignored, so they pose no immediate risk. However, having
   production service-role credentials on disk alongside development secrets
   is a hygiene concern; this is noted as a minor finding below.

---

## Findings

### MINOR-1 — `layout.tsx` declares `lang="en"` instead of `lang="pt-BR"`

**File:** `src/app/layout.tsx:27`  
**Rule:** CLAUDE.md §8 / Architecture Rule 10 — all user-facing text pt-BR.  
**Impact:** The HTML language declaration affects screen readers, spell
checkers, and hyphenation. This is a scaffold-default left unmodified; it does
not affect Phase 0 functionality but must be changed before any real UI is
delivered in Phase 2. Non-blocking for Phase 0 given there is no user-facing
content yet beyond the Next.js default page, but it should be corrected at the
start of Phase 2.  
**Action:** Change `lang="en"` to `lang="pt-BR"` in `src/app/layout.tsx`.

### MINOR-2 — PROGRESS.md "Follow-ups" has a stale open item

**File:** `PROGRESS.md` line 71  
**Finding:** The Follow-ups section still lists `[ ] Run supabase start to
confirm the local stack boots from a clean clone` as an open item, but the
Tasks table marks that item "done" and the stack is verified running. The
inconsistency is harmless but misleads readers about what is still pending.  
**Action:** Close/remove that follow-up item in PROGRESS.md.

### INFORMATIONAL — ADR 0001 records a superseded decision

**File:** `docs/decisions/0001-scaffolding-and-toolchain.md:28`  
**Finding:** The ADR states "`npm run test` uses `--passWithNoTests`", but this
flag was subsequently removed (correctly noted in the PROGRESS.md task row).
The ADR does not record the change.  
**Action:** Add a one-line note to ADR 0001 stating the flag was removed once
the smoke tests were added.

---

## Verdict

**APPROVED.**

All Phase 0 acceptance criteria are met. The two minor findings (lang attribute
and stale follow-up item) do not constitute blocking defects for a scaffolding
phase but must be tracked. MINOR-1 must be resolved in Phase 2 before any
user-facing content ships.
