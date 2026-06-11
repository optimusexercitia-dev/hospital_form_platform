# ADR 0001 — Scaffolding & toolchain bootstrap

**Date:** 2026-06-11 · **Status:** accepted

## Context

Phase 0 needs a working Next.js + Supabase + test harness before any teammate
can build features. The lead bootstrapped the scaffold and installed the
tech-stack packages from CLAUDE.md §2.

## Decisions

- **Next.js 16.2.9 / React 19** via `create-next-app` (App Router, `src/`,
  TypeScript, ESLint, Tailwind v4, `@/*` alias, Turbopack). CLAUDE.md says
  "Next.js 15+"; 16 is the current major and satisfies it.
- **shadcn/ui** initialized with the **radix** primitive set and **neutral**
  base color (`components.json`, `src/lib/utils.ts`, tokens in `globals.css`).
- **Vitest config is `vitest.config.mts`** (ESM), not `.ts`. Loading a `.ts`
  config through CommonJS triggers `ERR_REQUIRE_ESM` against an ESM-only
  transitive dep (`std-env`); the `.mts` extension forces ESM loading. The
  project stays CommonJS otherwise (no `"type": "module"`), keeping Next's
  config files unaffected.
- **Supabase CLI pinned as a devDependency** (in addition to the global CLI)
  so `npx supabase ...` is reproducible from a clean clone, per the Phase 0
  acceptance criterion.
- **Playwright installs Chromium only** for now; more browsers can be added if
  cross-browser coverage is needed later.
- **`npm run test` uses `--passWithNoTests`** so the harness is green before the
  Phase 0 smoke tests exist; the teammates add the actual specs.

## Consequences

- Markdown rendering (sanitizing renderer mandated by ARCHITECTURE.md Rule 7)
  has **not** been given a library yet — that choice is deferred to the
  frontend/backend teammates and will get its own ADR.
- The scaffold does not yet include migrations, seed data, or smoke tests;
  those are gated Phase 0 work (see PHASES.md). `supabase start` has not been
  run here to avoid leaving a Docker stack up — it is the next Phase 0 step.
