# CLAUDE.md — Hospital Commission Forms Platform

This file is loaded by the team lead AND every teammate. It holds the shared
rules and the team protocol, and points to two companion docs that carry the
detail:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the binding architecture rules and
  canonical database schema (referenced by §3).
- **[PHASES.md](./PHASES.md)** — the detailed phased development plan and
  per-phase acceptance criteria (referenced by §5).

Role-specific instructions live in `.claude/agents/*.md` and are appended to
each teammate's system prompt.

---

## 1. Project Overview

A web platform that digitizes the manual checklists and forms filled out by
hospital commissions, so that statistics can be generated automatically through
dashboards instead of manual tabulation. Frontend design should be professional, but also interactive and engaging, with micro animations using things like GSAP and three.js to make it a captivating experience. 

**No patient data or sensitive health information is ever collected or stored.**
HIPAA/LGPD-health compliance is explicitly out of scope. If a feature appears to
require collecting patient-identifiable data, STOP and flag it to the human.

### Core domain concepts

- **Commission**: an organizational unit (e.g., Infection Control Commission).
  All forms, members, and responses belong to exactly one commission.
- **Roles**:
  - `admin` (global): creates/edits commissions, assigns staff_admins, sees everything.
  - `staff_admin` (per commission): builds/edits forms, manages staff users of
    their own commission, views that commission's dashboard.
  - `staff` (per commission): fills out published forms of their commission.
  - A user may hold different roles in different commissions.
- **Form versioning**: forms follow a draft → published → archived lifecycle.
  Published versions are IMMUTABLE (sections AND items). Editing clones into a
  new draft (sections, items, conditions, display blocks — everything).
  Responses always reference a specific `form_version_id`. Input items carry a
  stable `question_key` across versions so dashboards aggregate across versions.
- **Sections (first-class)**: a form version is an ordered list of
  `form_sections`; every `form_item` belongs to exactly one section.
  - **Unsectioned forms**: every version has ≥1 section. Creating a form
    auto-creates a default section (`is_default = true`, title null). A
    version whose only section is the default renders as a flat, single-page
    form with no section chrome — this is how "a form may or may not have
    sections" is modeled without nullable `section_id` special cases.
  - **Conditional sections**: a section may carry `visible_when` (null =
    always visible) referencing a `question_key` answered in an EARLIER
    section. Hidden sections collect no answers, require nothing, and are
    skipped by the wizard.
  - **Sign-offs**: a section may set `requires_signoff`; sign-off is recorded
    per response per section (who + when) and is a precondition of submission.
- **Form items**: each section contains an ORDERED list of `form_items` of two
  kinds (a lightweight "dynamic zone" model):
  - **Input items** (collect answers): `multiple_choice`, `dropdown`,
    `checkbox`, `free_text`. Each may carry an optional
    `question_explanation` — help text shown to staff while filling the form
    (rendered as muted helper text under the question label and counted as the
    input's accessible description).
  - **Display items** (render only, never answered): `section_text`
    (Markdown explanatory text) and `image` (Supabase Storage reference).
    Display items have no `question_key` and are invisible to dashboards.
- **Filling is a wizard with resume**: sectioned forms render one section per
  page with progress indication. Answers are persisted on every section
  navigation, so a response has a lifecycle: `in_progress` (resumable,
  editable by its creator only) → `submitted` (immutable, counted by
  dashboards). One in_progress response per user per form version.

## 2. Tech Stack (do not deviate without human approval)

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Frontend    | Next.js 15+ (App Router, TypeScript, Server Components first) |
| Styling     | Tailwind CSS v4 + shadcn/ui                                   |
| Backend     | Supabase (Postgres, Auth/GoTrue, RLS, PostgREST via supabase-js) |
| Auth        | Supabase Auth, `@supabase/ssr` for server-side sessions       |
| Charts      | Recharts                                                      |
| E2E testing | Playwright (`@playwright/test`)                               |
| Unit tests  | Vitest + Testing Library                                      |
| Local dev   | Supabase CLI (`supabase start` — local Docker stack)          |
| Deploy      | Docker (Next.js standalone) + Caddy on a DigitalOcean droplet; Supabase Cloud in production |

### Repository layout

```
/
├── CLAUDE.md                  # this file — shared rules + team protocol
├── ARCHITECTURE.md            # architecture rules + canonical schema (see §3)
├── PHASES.md                  # detailed phased plan + acceptance criteria (see §5)
├── PROGRESS.md                # phase tracker — single source of truth for status
├── .claude/agents/            # teammate role definitions
├── supabase/
│   ├── migrations/            # SQL migrations (owned by Backend)
│   ├── seed.sql               # local dev seed data (test users, demo commission)
│   └── config.toml
├── src/
│   ├── app/                   # Next.js App Router (owned by Frontend)
│   │   ├── (auth)/            # login, invite acceptance
│   │   ├── admin/             # global admin area
│   │   └── c/[slug]/          # commission area: manage / forms / dashboard
│   ├── components/            # owned by Frontend
│   ├── lib/
│   │   ├── supabase/          # client factories (browser/server) — Backend
│   │   ├── queries/           # typed data-access functions — Backend
│   │   └── types/             # generated DB types + domain types — Backend
│   └── middleware.ts          # session refresh + route gating — Backend
├── e2e/                       # Playwright specs (owned by Tester)
├── docs/decisions/            # short ADRs for any non-trivial choice
└── docker/                    # Dockerfile, compose, Caddyfile (Phase 8)
```

## 3. Architecture Rules

The binding architecture rules and the canonical database schema live in
**[ARCHITECTURE.md](./ARCHITECTURE.md)** — read it in full before any schema,
RLS, query, or storage work; cross-references to "Architecture Rule N" point at
its numbered rules. In brief:

1. **RLS is the security boundary** — explicit policies on every table; never
   rely on UI hiding; service-role keys server-side only.
2. **Canonical schema** — `profiles`, `commissions`, `commission_members`,
   `forms`, `form_versions`, `form_sections`, `form_items`, `responses`,
   `answers`, `response_section_signoffs`. Backend may extend, never contradict.
   Includes the sections-integrity rules (default section, two-level ordering,
   per-version `question_key`, `visible_when` shape, input-vs-display items).
3. **Response lifecycle & resume** — `in_progress` → `submitted`; one draft per
   user per version; submission goes through the `submit_response` RPC (the
   authority); a single condition evaluator mirrored SQL ↔ TypeScript.
4. **Sign-offs** — per (response, section); `signoff_role` governs who may sign,
   enforced by RLS, only while `in_progress`.
5. **Published versions are IMMUTABLE** (versions, sections, items) in the DB;
   editing clones to a new draft preserving `question_key`s and conditions.
6. **Storage immutability** — `form-assets` objects are never overwritten; every
   upload gets a new path; cloning copies the reference only.
7. **Explanatory text is sanitized Markdown, never raw HTML** (stored-XSS).
8. **Generated types** regenerated after every migration; imported only from
   `src/lib/types/`.
9. **Data access goes through `src/lib/queries/`** — no inline supabase-js;
   centralize the "answerable questions" and "submitted responses" filters.
10. **All user-facing text pt-BR**; code, comments, commits, docs in English.

See ARCHITECTURE.md for the authoritative, detailed form of each rule.

## 4. Agent Team

Development uses Claude Code **Agent Teams** (experimental). Enable in
`.claude/settings.json`:

```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

Requires Claude Code v2.1.32+. The session that opens this project acts as
**team lead / orchestrator**: it coordinates, assigns tasks, reviews plans, and
does NOT write feature code itself.

### Teammates (spawn using these agent types from `.claude/agents/`)

| Teammate name | Agent type          | Scope |
| ------------- | ------------------- | ----- |
| `frontend`    | `frontend-engineer` | All UI: `src/app`, `src/components`. MUST use the `frontend-design` skill before building new screens. |
| `backend`     | `backend-engineer`  | Supabase migrations, RLS, seed data, `src/lib/{supabase,queries,types}`, `middleware.ts`, server route handlers, Docker/deploy assets. |
| `tester`      | `qa-tester`         | Playwright E2E specs in `e2e/`, test execution, bug reports. Never fixes app code. |
| `qa`          | `qa-reviewer`       | Final phase review: requirements audit, code review, security/RLS review. Read-only on app code; writes only review reports. |

### Lead protocol

- Spawn `frontend` and `backend` at the start of a phase with a task-specific
  prompt (teammates do NOT inherit your conversation — include all relevant
  context, file paths, and acceptance criteria in the spawn prompt).
- **Require plan approval** for `backend` on any task touching migrations or
  RLS, and for `frontend` on any task introducing a new page/route group.
  Reject plans that lack a testing note or that violate file ownership.
- Spawn `tester` only when the phase's features are implemented and the dev
  server runs. Spawn `qa` only after the tester reports green.
- Break each phase into 5–6 tasks per teammate on the shared task list; mark
  dependencies (e.g., frontend form-builder task depends on backend
  versioning-API task).
- Enforce file ownership (section above). Two teammates must never edit the
  same file in the same phase. Shared types change only via `backend`.
- Shut down idle teammates and clean up the team at phase end (lead runs
  cleanup, never a teammate).

## 5. Phased Development Plan

The full phase-by-phase plan, with each phase's deliverables and acceptance
criteria, lives in **[PHASES.md](./PHASES.md)**. Each phase is gated by the
Phase Gate (§6).

**Hard rule: no phase begins until the previous phase has passed the Phase
Gate (§6) and the human has approved.** Phases are sequenced so the Backend can
run one phase ahead on schema work when idle, but nothing is merged ahead of
its phase.

| Phase | Name |
| ----- | ---- |
| 0 | Scaffolding & Environment |
| 1 | Database Schema, Auth & RLS |
| 2 | Authentication & App Shell |
| 3 | Admin Area & User Management |
| 4 | Form Builder & Versioning |
| 5 | Wizard Filling, Conditional Sections & Resume |
| 6 | Section Sign-offs & Submission Lifecycle |
| 7 | Dashboards & Submissions Browser |
| 8 | Deployment |

See PHASES.md for the authoritative detail of each phase.

## 6. Phase Gate (mandatory, in order)

1. **Build complete** — frontend & backend mark all phase tasks done; lint,
   typecheck, and unit tests pass locally.
2. **Test pass** — lead spawns `tester`. Tester writes/updates Playwright specs
   for the phase's acceptance criteria, runs the FULL E2E suite (regression
   included), and files a bug report in `PROGRESS.md` for every failure.
   Engineers fix; tester re-runs. Repeat until green. Tester never edits app
   code; engineers never edit specs to make them pass without tester sign-off.
3. **QA review** — lead spawns `qa`. QA audits the phase against this file's
   requirements, reviews code quality and RLS coverage, and writes
   `docs/reviews/phase-N-review.md` with verdict `APPROVED` or
   `CHANGES REQUESTED` (with an itemized list). Changes loop back to step 1.
4. **Human approval** — lead presents a summary (what was built, test results,
   QA verdict, open risks) and WAITS for explicit human approval.
5. **Record** — lead updates `PROGRESS.md` (phase → ✅, date, commit hash,
   links to review), commits with `phase(N): complete — <summary>`, cleans up
   the team.

A `TaskCompleted` hook may be configured to reject completion of any task whose
description includes `[gate]` unless `npx playwright test` exits 0 — prefer
this over trusting self-reports.

## 7. Progress Tracking

`PROGRESS.md` at the repo root is the single source of truth. Every teammate
updates ONLY their own rows/sections; the lead owns the phase status table.
Update it when: a task starts/finishes, a bug is filed/fixed, a gate step
passes, a decision is made. Never report status verbally without writing it
to `PROGRESS.md` first. Format is defined in the file itself.

## 8. Conventions & Quality Bar

- TypeScript `strict`; no `any` without an inline justification comment.
- Conventional commits: `feat(scope):`, `fix:`, `test:`, `chore:`, `phase(N):`.
- Server Components by default; `"use client"` only where interaction requires it.
- Every form input accessible: labels, keyboard navigation, visible focus.
  The tester includes at least one keyboard-only flow per phase.
- Errors are user-readable in pt-BR; raw Supabase/Postgres errors never reach the UI.
- Secrets only in `.env.local` (gitignored). `NEXT_PUBLIC_` vars: Supabase URL
  and anon key only. Service-role key is server-only — if it appears in client
  code, that is a phase-blocking bug.
- Non-trivial decisions get a 5–10 line ADR in `docs/decisions/`.

## 9. Commands Reference

> **Status:** Phase 0 is not yet complete. Until scaffolding lands, NONE of the
> commands below run from a clean clone (there is no `package.json`, `supabase/`,
> or `src/` yet) — they document the intended toolchain. Check `PROGRESS.md` for
> the current phase before assuming any command works.

```bash
supabase link --project-ref azkbbhskturikxpgmafq   # link CLI to remote project (one-time, run first)
supabase db push                                    # push migrations to remote
supabase db reset --linked                          # reset remote DB + seed (destructive!)
supabase gen types typescript --linked > src/lib/types/database.ts
npm run dev                    # Next.js dev server (http://localhost:3000)
npm run lint && npm run typecheck
npm run test                   # Vitest unit tests (full suite)
npx playwright test            # full E2E suite (requires dev server + seeded DB)
npx playwright test --ui       # interactive debugging
```

Running a single test (tight debug loops):

```bash
npx vitest run path/to/file.test.ts        # one Vitest file
npx vitest run -t "name of the test"       # one Vitest test by name
npx vitest watch path/to/file.test.ts      # watch a single file
npx playwright test e2e/login.spec.ts      # one E2E spec file
npx playwright test -g "logs in"           # E2E tests matching a title
npx playwright test --project=chromium     # restrict to one browser
```

E2E seeded personas (defined in `supabase/seed.sql`, applied via `supabase db reset --linked`):
`admin@test.local`, `chefe.ccih@test.local` (staff_admin, commission A),
`staff1.ccih@test.local`, plus equivalents for commission B. Password for all:
`Test1234!`.
