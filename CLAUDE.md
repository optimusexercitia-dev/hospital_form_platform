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

**Patient data (PHI) is in scope, on HIPAA-compliant infrastructure (Supabase, under
a BAA) — see ADR [0030](./docs/decisions/0030-patient-safety-phi-and-pqs-architecture.md).**
The **binding regulatory regime** for this Brazilian deployment is **LGPD + ANVISA/RDC +
CFM 1821/2007** (20-yr record retention); the HIPAA BAA is the *infrastructure* safeguard,
not the governing law — see ADR
[0035](./docs/decisions/0035-lgpd-anvisa-regulatory-posture.md). PHI is collected only where
the clinical-governance domain requires it — notably the Phase-14 **patient-safety / NSP
module** — and handled under those safeguards: minimum-necessary access via RLS, PHI isolated
into dedicated tables, PHI-access auditing, and platform at-rest encryption (column-level
encryption considered and **declined**; ARCHITECTURE.md **Rule 12**, ADR 0035). Modules that
don't need patient identity stay PHI-free by design. This **reverses** the platform's former
"no patient data, ever" rule.

**Positioning: a governance / quality LAYER for hospital accreditation.** Beyond
digitizing checklists, the platform is being built to help hospitals satisfy — and
*prepare for* — accreditation (ONA in Brazil; JCI / Joint Commission internationally;
the ANVISA/RDC regulatory backdrop). It documents committee **process, measurement,
and improvement**, sitting beside the EHR rather than duplicating it. The patient-safety /
NSP module (Phase 14) records patient context directly; everywhere else the platform stays a
process/measurement layer that holds no PHI by design (minimum-necessary). The PHI posture and
the PQS/NSP architecture are in ADR
[0030](./docs/decisions/0030-patient-safety-phi-and-pqs-architecture.md), which supersedes ADR
[0028](./docs/decisions/0028-accreditation-governance-roadmap.md)'s no-patient-data stance and
its rejected "minimal-identifiers" alternative.

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

### Governance & accreditation concepts (Phases 13+)

Each is feature-flagged and detailed in PHASES.md + its ADR. Most are PHI-free by
design; the patient-safety / NSP module (Phase 14) is the one that records patient
context, under HIPAA safeguards (Rule 12; ADR 0030).

- **Audit trail**: an append-only, tamper-evident (hash-chained) `audit_log` of
  who did what to which entity, when. Every mutation emits a row (Architecture
  Rule 11); reads of another member's data are logged explicitly. The data-integrity
  backbone (ALCOA+) accreditation expects.
- **Patient-safety event → triage → RCA → CAPA (NSP)**: a committee notifies a central
  **Núcleo de Segurança do Paciente** of an **event**, which is triaged
  (patient-safety-event? → reach → harm → sentinel screen) to a **review pathway**; a
  warranted **root-cause analysis** (fishbone / 5-Whys) drives a closed corrective/
  preventive loop — action plan → **verification of effectiveness** → closure with lessons
  learned. PHI-bearing, NSP-owned, access-follows-custody (Phase 14, sub-phases 14a–14d;
  ADR 0030). Committees keep their lightweight action-tasks and escalate when they need this
  rigor.
- **Quality indicator**: a managed metric (numerator/denominator, target,
  periodicity, direction) measured over time and tracked vs target — entered
  manually or **derived** from submitted-form aggregates via `question_key`.
- **Accreditation standard & evidence link**: a configurable framework
  (ONA / JCI / custom) of hierarchical standards; commissions link the artifacts
  they produce (forms, meetings, cases, indicators, CAPA, documents) as
  **evidence**, driving a **readiness / gap report**.
- **Controlled document**: a policy/POP/protocol/regimento under a lifecycle with
  named-approver e-signatures, effective/expiry dates, and a scheduled review cycle.
- **Internal audit / mock tracer**: scored self-assessment rounds mapped to
  standards; a non-conforming finding opens a CAPA and updates the standard's
  assessment.

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
11. **Auditability** (established Phase 13) — an append-only, tamper-evident
    audit trail; every mutation emits an audit row, and reads of another member's
    data — and every read of PHI (Rule 12) — are logged. The log records *that*
    something changed/was read and *who*, never copying answer payloads, free-text/
    Markdown bodies, or PHI into itself.
12. **PHI / HIPAA handling** (established Phase 14; ADR 0030, ADR 0035) — PHI is
    permitted on HIPAA-compliant infrastructure (Supabase BAA), under the binding
    LGPD + ANVISA/RDC + CFM regime (ADR 0035), collected minimum-necessary,
    isolated into dedicated tables behind the tightest RLS, access-audited, and
    protected by platform at-rest encryption (column-level encryption declined).
    Modules that don't need patient identity hold none by design.

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

- **Keep `frontend` and `backend` warm across phases.** Spawn each ONCE (their first
  phase) and REUSE the same teammate for later phases with a new task-specific prompt —
  they retain the architecture + codebase context they built up, which removes the
  per-phase re-read and shrinks the "lead notes" you have to write. Teammates still do
  NOT share your conversation, so each phase's prompt must include that phase's
  context, file paths, and acceptance criteria — but they already hold ARCHITECTURE.md
  and the code they wrote. Spawn a FRESH teammate only if one is genuinely stuck or
  context-poisoned.
- **Contract-first sequencing.** At phase start, have `backend` post the typed
  query/action *signatures* `frontend` depends on (typed stubs in `src/lib/queries/**`
  and the relevant `actions.ts`) BEFORE implementing them, so `frontend` builds against
  real types in parallel instead of inventing a provisional shape that later mismatches
  (this caused rework in Phase 6). Backend then fills in the implementations.
- **Require plan approval** for `backend` on any task touching migrations or RLS, and
  for `frontend` on any task introducing a new page/route group — but **right-size the
  review**. Work that follows an already-approved pattern (a routine additive
  migration, a new RPC mirroring an existing one, a flag flip; a standard
  coordinator-gated route group) gets a **one-line plan + your ack**. Reserve a full
  plan review for **novel or security-sensitive** work: a new RLS *shape*, a
  `SECURITY DEFINER` read path, a service-role route handler, anything touching the
  condition evaluator or the immutability triggers, or a genuinely new UI pattern.
  Reject any plan (fast-tracked or full) that lacks a testing note or violates file
  ownership.
- Spawn `tester` only when the phase's features are implemented and the dev
  server runs. Spawn `qa` only after the tester reports green.
- Break each phase into 5–6 tasks per teammate on the shared task list; mark
  dependencies (e.g., frontend form-builder task depends on backend
  versioning-API task).
- Enforce file ownership (section above). Two teammates must never edit the
  same file in the same phase. Shared types change only via `backend`.
- **Keep the team warm between phases; do the full team cleanup at PROJECT end**
  (or when a teammate is genuinely done for the project) — the lead runs cleanup,
  never a teammate. Spinning the team down each phase only to rebuild it next phase
  throws away context you then pay to re-inject; don't.

## 5. Phased Development Plan

The full phase-by-phase plan, with each phase's deliverables and acceptance
criteria, lives in **[PHASES.md](./PHASES.md)**. Each phase is gated by the
Phase Gate (§6). PHASES.md holds the **core-platform track (0–12)** + the index
of the accreditation track; the **accreditation track (13–21)** detail is split
into **[docs/phases/accreditation-track.md](./docs/phases/accreditation-track.md)**
with its track-wide context in
**[docs/quality-track-context.md](./docs/quality-track-context.md)** (read that
first before building in 13–21). Both defer to this file and ARCHITECTURE.md for
the binding rules — one codebase, one schema, one rulebook.

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
| 7 | Multi-Phase Cases |
| 8 | Dashboards & Submissions Browser |
| 9 | Deployment *(pending — features below are built ahead of it)* |
| 10 | Meetings |
| 11 | Interviews |
| 12 | Case Timeline |
| **— Accreditation & Quality-Governance Track —** | |
| 13 | Audit Trail |
| 14 | Patient-Safety Events, Triage, RCA & CAPA (NSP) — sub-phases 14a–14d |
| 15 | Quality Indicators |
| 16 | Standards Crosswalk & Readiness/Gap Engine |
| 17 | Controlled-Document Lifecycle |
| 18 | Self-Assessment, Internal Audit & Mock Tracer |
| 19 | Surveyor Access & Evidence Export |
| 20 | Notifications & Escalation |
| 21 | Committee Charters & Meeting Cadence |

Phases 13–21 are the **accreditation-readiness track**: they make the platform
provably useful to hospitals pursuing ONA / JCI accreditation while keeping its
governance/quality-layer positioning, with PHI confined to the patient-safety module (ADR 0030). They follow the same
Phase Gate (§6) and ordering hard-rule. **Deployment plan: ship a pilot after
Phase 16** (the P0 core — audit trail, CAPA, indicators, standards crosswalk),
which also validates the prod-auth gap (ADR 0009); Phases 17–21 follow, informed
by pilot feedback. See **docs/phases/accreditation-track.md** for the
authoritative detail of these phases, **docs/quality-track-context.md** for the
track context, and ADR 0028 for the track's rationale and sequencing.

See PHASES.md for the authoritative detail of the core-platform phases (0–12)
and the accreditation-track index.

## 6. Phase Gate (mandatory, in order)

1. **Build complete** — frontend & backend mark all phase tasks done; lint,
   typecheck, and unit tests pass locally.
2. **Test pass** — lead spawns `tester`. Tester writes/updates Playwright specs for
   the phase's acceptance criteria and files a bug report in `PROGRESS.md` for every
   failure. During the fix loop the tester re-runs only the **failing + current-phase
   specs** (chromium) for fast feedback; the **FULL E2E suite (regression included)
   runs once to declare green** — green still requires the full suite to pass.
   Engineers fix; tester re-runs. Repeat until green. Tester never edits app code;
   engineers never edit specs to make them pass without tester sign-off.
3. **QA review** — lead spawns `qa`. QA audits the phase against this file's
   requirements, reviews code quality and RLS coverage, and writes
   `docs/reviews/phase-N-review.md` with verdict `APPROVED` or
   `CHANGES REQUESTED` (with an itemized list). Changes loop back to step 1.
4. **Human approval** — lead presents a summary (what was built, test results,
   QA verdict, open risks) and WAITS for explicit human approval.
5. **Record** — lead updates `PROGRESS.md` (phase → ✅, date, commit hash, links to
   review), archives the completed phase's task detail to `docs/progress/phase-N.md`
   (§7), updates `docs/backend-state.md` if the backend surface changed, and commits
   with `phase(N): complete — <summary>`. The team stays warm for the next phase;
   full cleanup is at project end (§4).

A `TaskCompleted` hook may be configured to reject completion of any task whose
description includes `[gate]` unless `npx playwright test` exits 0 — prefer
this over trusting self-reports.

## 7. Progress Tracking

`PROGRESS.md` at the repo root is the single source of truth. Every teammate
updates ONLY their own rows/sections; the lead owns the phase status table.
Update it when: a task starts/finishes, a bug is filed/fixed, a gate step
passes, a decision is made. Never report status verbally without writing it
to `PROGRESS.md` first. Format is defined in the file itself.

**Keep `PROGRESS.md` small — every spawn reads it.** The live file holds only the
Phase Status table, the **current** phase's task table + lead notes, and the
cross-phase logs (Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups). At
the §6 Record step the lead moves the just-completed phase's task detail + per-phase
notes into `docs/progress/phase-N.md`, leaving a one-line pointer behind; the
cross-phase logs stay here. The durable map of what the backend already provides lives
in **`docs/backend-state.md`** (the lead keeps it current) so per-phase "lead notes"
reference it instead of re-deriving it each phase.

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

## Loop Safety Rules
- Never exceed 5 fix iterations without reporting to the user
- Each iteration must fix at least one new issue — if the same error recurs unchanged, stop and escalate
- Track which files each agent modified to detect conflicts
- If two agents need to modify the same file, serialize those tasks
- Log every iteration: what was tested, what failed, what was fixed