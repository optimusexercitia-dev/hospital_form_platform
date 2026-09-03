# CLAUDE.md — Hospital Commission Forms Platform

Loaded by the team lead **and every teammate** — keep it lean; every spawn pays for it. It
holds the shared, stable rules and points to the docs that carry detail:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — binding architecture rules + canonical schema
  (authoritative; indexed in §3). Each rule names its enforcer, or `prose only`.
- **[PHASES.md](./PHASES.md)** — phased plan + per-phase acceptance criteria (§5).
- **[PROGRESS.md](./PROGRESS.md)** — live state only: § Phase Status and § State (§7).
- **[docs/features/INDEX.md](./docs/features/INDEX.md)** — every unit of work, in-progress
  first; a unit's summary is its hub `docs/features/<code>.md`, its log is
  `docs/progress/<code>.md` (§7, ADR 0186).
- **[docs/INDEX.md](./docs/INDEX.md)** — map of `docs/`, the **authority order** (live catalog >
  code > ARCHITECTURE.md > ADRs > trackers), and where each kind of line belongs.
  **[CONTEXT.md](./CONTEXT.md)** — the glossary.
- **[docs/lead-playbook.md](./docs/lead-playbook.md)** — lead-only orchestration protocol.
- **[docs/worktrees.md](./docs/worktrees.md)** — parallel Claude Code sessions on this repo.
- **`.claude/agents/*.md`** — role instructions, appended per teammate.

---

## 1. Project Overview

A web platform that digitizes the manual checklists/forms hospital commissions fill out, so
statistics come from **dashboards** instead of manual tabulation. Frontend design must be
professional yet interactive and engaging — micro-animations via **GSAP**.

**Positioning: a governance / quality LAYER for hospital accreditation** (ONA in Brazil; JCI
internationally). It documents committee **process, measurement, and improvement**, sitting
*beside* the EHR, not duplicating it; outside the three PHI modules it holds **no PHI by
design** (ADR [0030](./docs/decisions/0030-patient-safety-phi-and-pqs-architecture.md)).

**PHI posture = Architecture Rule 12.** PHI is in scope on HIPAA-compliant infrastructure
(Supabase under a BAA), governed by LGPD + ANVISA/RDC + CFM 1821/2007 (20-yr retention; ADR
[0035](./docs/decisions/0035-lgpd-anvisa-regulatory-posture.md)), collected minimum-necessary
and confined to exactly three isolated modules — patient-safety / NSP, inter-committee
referral, and case — each behind the tightest RLS and PHI-access-audited. Table names, doors
and the `case_patient` flag-vs-table trap: ARCHITECTURE.md §2 and Rule 12.

### Core domain concepts

- **Tenancy**: multi-tenant **organizations → hospitals → commissions** (ADR 0041). A
  commission belongs to one hospital, a hospital to one org.
- **Commission**: the lowest unit (e.g., Infection Control). All forms, members, and responses
  belong to exactly one commission.
- **Roles** (definitions + RLS: ADR 0041, `docs/backend-state.md`):
  - `platform_admin` — global superuser over **tenancy, identity, vocabulary and audit**; may
    **not** touch commission content or PHI (the "noun rule", ADR 0078 A35).
  - `org_admin` / `hospital_admin` — manage an org / a hospital and its commissions, users,
    members; a hospital admin's write bound is an affiliation **footprint**, not a role (ADR
    [0133](./docs/decisions/0133-aff2-affiliation-scoped-administration-um-redesign.md)).
  - `staff_admin` (per commission) — builds/edits forms, manages that commission's staff,
    views its dashboard. `staff` (per commission) — fills published forms.
  - **NSP roles** (`nsp_org_admin`, `nsp_coordinator`) run the patient-safety / PQS roster;
    **`administrativo`** is a per-commission delegated-capability grant, not a role (ADR 0061).
  - A user may hold different roles across commissions, hospitals, or organizations.
- **Forms & responses** (schema detail: ARCHITECTURE.md §2 / Rules 2–5): versions go draft →
  published (**IMMUTABLE**; editing clones a new draft, preserving `question_key`s + conditions)
  → archived; a version is an ordered list of `form_sections` (conditional `visible_when`,
  `requires_signoff`); **input items** carry a stable `question_key` for dashboards, **display
  items** none; filling is a wizard with resume — `in_progress` (creator-only, one per
  user/version) → `submitted` (immutable, counted).

### Governance & accreditation modules (Phases 13+)

Feature-flagged; detail in PHASES.md, `docs/phases/accreditation-track.md` and each ADR:
**audit trail** (Rule 11) · **patient-safety event → triage → RCA → CAPA** (NSP; PHI) ·
**inter-committee referrals** (PHI) · **quality indicator** · **accreditation standard &
evidence link** · **controlled document** · **internal audit / mock tracer**.

## 2. Tech Stack (do not deviate without human approval)

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------- |
| Frontend    | Next.js 16+ (App Router, TypeScript, Server Components first) |
| Styling     | Tailwind CSS v4 + shadcn/ui                                   |
| Backend     | Supabase (Postgres, Auth/GoTrue, RLS, PostgREST via supabase-js) |
| Auth        | Supabase Auth, `@supabase/ssr` for server-side sessions       |
| Charts      | Recharts                                                      |
| E2E testing | Playwright (`@playwright/test`)                               |
| Unit tests  | Vitest + Testing Library                                      |
| Animation   | GSAP (`gsap` 3.15, pinned); tokens in `src/components/motion/` |
| Local dev   | Supabase CLI (`supabase start` — local Docker stack)          |
| Deploy      | Docker (Next.js standalone) on Coolify (ADR 0059); Supabase Cloud in production |

### Repository layout

```
/
├── CLAUDE.md / ARCHITECTURE.md / PHASES.md / PROGRESS.md   # rules, schema, plan, status
├── Dockerfile                 # Coolify deploy — Next.js standalone (ADR 0059)
├── .claude/agents/ · rules/ · skills/   # roles · standing rules · procedures
├── scripts/                   # lint gates (docs/lint-gates.md), e2e-prod-gate.sh, door-sweep-cases.sh
├── supabase/migrations/ · tests/ · seed.sql   # the LIVE CATALOG, not the SQL text, is truth (§ graphify)
├── src/app/ · components/ · proxy.ts          # Next.js App Router; o/[org]/…/c/[commission]/ = tenant areas
├── src/lib/                   # domain modules (actions.ts + queries) · supabase/ · queries/ (Rule 9) · types/ (Rule 8)
├── e2e/                       # Playwright specs
├── worktrees/                 # parallel sessions — docs/worktrees.md
└── docs/                      # docs/INDEX.md is the map
```

## 3. Architecture Rules (index)

**Read [ARCHITECTURE.md](./ARCHITECTURE.md) in full before any schema, RLS, query, or storage
work — it is authoritative.** "Architecture Rule N" refers to its numbered rules:

1. **RLS is the security boundary** — explicit policies on every table; service-role keys server-side only; never rely on UI hiding.
2. **Canonical schema** — `profiles`, `commissions`, `memberships` (the single multi-scope table, keyed `principal_id`), `forms`, `form_versions`, `form_sections`, `form_items`, `responses`, `answers`, `response_section_signoffs`; extend, never contradict; verify names against the catalog.
3. **Response lifecycle & resume** — `in_progress` → `submitted` via the `submit_response` RPC; one draft per user/version; condition evaluator mirrored SQL ↔ TS.
4. **Sign-offs** — per (response, section); `signoff_role` gated by RLS; only while `in_progress`.
5. **Published versions are IMMUTABLE** — editing clones to a new draft, preserving `question_key`s + conditions.
6. **Storage immutability** — `form-assets` never overwritten; new path per upload; cloning copies the reference.
7. **Explanatory text is sanitized Markdown, never raw HTML** (stored-XSS).
8. **Generated types** regenerated after every migration; imported only from `src/lib/types/`.
9. **Data access via `src/lib/queries/`** — no inline supabase-js.
10. **User-facing text pt-BR**; code, comments, commits, docs in English.
11. **Auditability** — append-only, tamper-evident trail; every mutation emits a row; reads of another member's data + every PHI read are logged (that + who, never payloads).
12. **PHI / HIPAA** — three isolated Class-1 patient-PHI modules under identical isolation + audited-door safeguards; a Class-2 professional-identity class (`professional_profiles`); others hold none by design. Door counts and gates: ARCHITECTURE.md.
13. **Affiliations NEVER grant capabilities** — an affiliation **LOCATES** the scope; a `memberships` row **GRANTS**; keep the two steps separately visible. Asserted by pgTAP `392`.

## 4. Agent Team

Development uses Claude Code **Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` in
`.claude/settings.json`). The session that opens the project is the **team lead**: it
coordinates, assigns, reviews plans, and does **not** write feature code. Protocol:
[docs/lead-playbook.md](./docs/lead-playbook.md) (lead only).

**Delegation:** mechanical search/enumeration → Haiku · interpretive exploration &
implementation → Sonnet · architecture, authz semantics & multi-file refactors → Opus ·
read-only reviewers → Haiku/Sonnet. ⛔ **Fable is never agent-selected** — the user assigns
it case-by-case.

**Delegation floor — binding on EVERY session, ad-hoc sessions included:** before reading more
than ~3 files, or running repeated grep/`sed` sweeps, to answer ONE question, spawn an
**Explore** subagent and keep only its conclusions. Shell reads count as reads. graphify stays
the FIRST move for codebase questions (§ graphify).

| Teammate   | Agent type          | Scope |
| ---------- | ------------------- | ----- |
| `frontend` | `frontend-engineer` | All UI: `src/app`, `src/components`. MUST use the `frontend-design` skill before new screens; consults `vercel-react-best-practices`. |
| `backend`  | `backend-engineer`  | Supabase migrations, RLS, seed, `src/lib/{supabase,queries,types}`, middleware, server route handlers, Docker/deploy. Consults `supabase` + `supabase-postgres-best-practices`. |
| `tester`   | `qa-tester`         | Playwright E2E in `e2e/`, execution, bug reports. Never fixes app code. |
| `qa`       | `qa-reviewer`       | Final phase review: requirements, code, security/RLS. Read-only on app code; writes only review reports. |

**File ownership is binding**: two teammates never edit the same file in a phase; shared types
change only via `backend`. For work beside the phase — a parallel session, an isolated spike —
use a worktree ([docs/worktrees.md](./docs/worktrees.md)).

## 5. Phased Development Plan

The plan + acceptance criteria: **[PHASES.md](./PHASES.md)** (core 0–12 + the accreditation
index); track 13–21 detail: **[docs/phases/accreditation-track.md](./docs/phases/accreditation-track.md)**
(read **[docs/quality-track-context.md](./docs/quality-track-context.md)** first). Live phase
status: PROGRESS.md § Phase Status; live unit state: its hub, via
[docs/features/INDEX.md](./docs/features/INDEX.md); completed phases:
[docs/progress/phase-ledger.md](./docs/progress/phase-ledger.md). Phases 18–19 stay
post-pilot (ADR 0071).

**Hard rule:** no phase begins until the previous phase has passed the Phase Gate (§6) **and**
the human has approved. Backend may run one phase ahead on schema work, but nothing merges
ahead of its phase.

> ⭐ **Before any authorization / RLS / security-test work**, read the lessons register
> [docs/learning/LESSONS.md](./docs/learning/LESSONS.md) — keystones that could not fail, "text
> is not truth", and **`prosecdef` belongs beside `pg_policies`**. ADR
> [0079](./docs/decisions/0079-authz-door-blindness-standing-invariant.md)'s door-audit sweep
> is a **standing** gate, run in §6 step 1.

When a decision in this file is superseded by an ADR, amend this file too. **Always ask before
making changes to `CLAUDE.md`.**

## 6. Phase Gate (mandatory, in order)

1. **Build complete** — lint, typecheck, unit tests, and the pgTAP suite (`npm run test:db`,
   on a **fresh `supabase db reset`**) pass; the **authz arms** (`census`, `hat`, `floor`,
   `FROMFINDINGS=1 wrapper`) hold, plus the **diff-scoped door sweep, both arms**, if any RLS
   policy or `prosecdef` gate changed. **BLIND blocks the phase; `ERROR` is not a pass.**
   Recipe and what each ARM proves: lead-playbook §4, ADR 0079.
2. **Test pass** — `tester` writes/updates Playwright specs for the acceptance criteria and
   files a bug per failure as a row in `docs/bugs/BUGS.md`. The fix loop reruns failing +
   current-phase specs; the **full suite runs once to declare green** via `npm run e2e:prod`
   (`docs/testing/e2e-prod-build-gate.md`). Tester never edits app code; engineers never edit
   specs to pass without tester sign-off.
3. **QA review** — `qa` writes `docs/reviews/<subject>-review.md` with `APPROVED` or
   `CHANGES REQUESTED`. Changes loop to step 1.
4. **Human approval** — lead presents built / tests / QA verdict / open risks and **waits**.
5. **Record** — lead-playbook §§4–5: the phase row → the ledger, the hub → `complete` with its
   block appended to its record, bugs → status cells, follow-ups → the archive, the handoff
   deleted; `npm run lint` reds on anything completed left behind. Commit
   `phase(N): complete — <summary>`. **Name the authz ARM, never the script.**

## 7. Progress Tracking

A unit's **summary** is its hub's `## Current state` (`docs/features/<code>.md`; six fixed
sections, replace never append, ≤ 60 lines, gated); its **log** is its record's `## Session log`
(`docs/progress/<code>.md`; one dated entry per session, appended: witnesses, gate runs, dead
ends). A state word goes to the hub; a witness goes to the record. **Never report status
verbally without writing it there first.** PROGRESS.md holds only § Phase Status and § State.
Where every other kind of line belongs — bugs (`docs/bugs/BUGS.md`, status is a cell),
follow-ups (`docs/followups/follow-ups-open.md`, the ⭐⭐ Critical list pinned at its top),
lessons (`docs/learning/LESSONS.md`), standing prohibitions (`.claude/rules/`) — is the table in
[docs/INDEX.md](./docs/INDEX.md). `npm run lint:progress` (gate 7) and `lint:registers`
(gate 13) enforce presence and shape, never truth: `PO to rule` is a legal value. ADR
[0186](./docs/decisions/0186-documentation-consolidation-one-home-per-fact.md).

## 8. Conventions & Quality Bar

- TypeScript `strict`; no `any` without an inline justification comment.
- **Lint gate** — `npm run lint` chains every gate in `package.json`'s `lint` script; ALL must
  pass, eslint at **0 errors AND 0 warnings**. Why each gate exists and the trap in reading its
  output: **[docs/lint-gates.md](./docs/lint-gates.md)**. Scope is first-party source (`src/`,
  `e2e/`, `*.test.*`); mark intentionally-unused bindings with a `_` prefix; keep
  `eslint-config-next` pinned to the installed `next` (ADR 0067).
- ⛔ **Prettier does not govern this tree** — never on `src/`, never on the tracker docs:
  `.claude/rules/prettier-does-not-govern-this-tree.md`.
- Conventional commits: `feat(scope):`, `fix:`, `test:`, `chore:`, `phase(N):`.
- Server Components by default; `"use client"` only where interaction requires it.
- Every form input accessible: labels, keyboard navigation, visible focus. The tester includes
  at least one keyboard-only flow per phase.
- Errors user-readable in pt-BR; raw Supabase/Postgres errors never reach the UI.
- Secrets only in `.env.local` (gitignored). `NEXT_PUBLIC_` vars: Supabase URL + anon key only.
  Service-role key is server-only — in client code, that's a phase-blocking bug.
- Non-trivial decisions get an ADR in `docs/decisions/` (Context · Problem · Decision ·
  Considered options · Consequences; ~180 lines is normal). Number: **the highest number on
  ANY live branch + 1**, never the index's "next free" alone; gate 9 catches a duplicate at
  rebase. Header carries `**Status:**`, `**Area:**`, optional `**Related:**`, and a
  `**Supersedes:**` / `**Amends:**` label if it changes an earlier decision — the only input to
  the generated back-pointers; then `npm run adr:index`. ⛔ Never create `docs/adr/`.
- A standing prohibition with **no resolution event** belongs in **`.claude/rules/`**,
  path-scoped, under ADR [0127](./docs/decisions/0127-standing-rules-home-and-staleness-gate.md)'s
  admission bar — never one a gate already enforces; a rule is a hint, never a substitute for a
  gate.

## 9. Commands Reference

```bash
supabase db reset --local      # THE workhorse: rebuild local DB + seed. pgTAP and the E2E
                               #   gate need a FRESH reset — E2E leftovers cause spurious reds.
npm run gen:types              # regenerate src/lib/types/database.ts from LOCAL (Rule 8)
npm run db:link                # = supabase link --project-ref azkbbhskturikxpgmafq (one-time)
npm run db:push                # push migrations to remote
npm run db:reset:linked        # reset REMOTE DB + seed (destructive!)
npm run gen:types:linked       # regenerate types from the linked remote
npm run dev                    # Next.js dev server (http://localhost:3000)
npm run lint && npm run typecheck   # the chain: §8 / docs/lint-gates.md
npm run adr:index              # regenerate docs/decisions/INDEX.md after an ADR header change
npm run features:index         # regenerate docs/features/INDEX.md after a hub frontmatter change
npm run format:check           # Prettier — manual, NOT a lint gate (§8)
npm run test                   # Vitest unit tests (full suite)
npm run test:db                # pgTAP suite (`supabase test db`) — Phase Gate step 1
npx playwright test            # E2E on a dev server (quick loop; needs dev server + seeded DB)
npm run e2e:prod               # FULL prod-standalone E2E gate, batched with server restarts —
                               #   knobs and details: docs/testing/e2e-prod-build-gate.md
```

Single-test debug loops: `npx vitest run <file>` / `-t "<name>"`; `npx playwright test
<spec>` / `-g "<title>"` / `--project=chromium`.

**E2E seed personas** (`supabase/seed.sql`; roster in its header). Two orgs, **Rede A** (CCIH +
Farmácia) and **Rede B**; password for all `Test1234!`; `platform@test.local`,
`orgadmin.a@test.local`, `chefe.ccih@test.local` (`staff_admin` CCIH), `multi@test.local`
(`staff` of two Rede A commissions), `nsporg.a@test.local`. ⛔ **No persona crosses orgs** — a
cross-org test written against `multi@test.local` passes while proving nothing.

## Loop Safety Rules

- Never exceed 5 fix iterations without reporting to the user.
- Each iteration must fix at least one new issue; if the same error recurs unchanged, escalate.
- Track which files each agent modified; serialize tasks that share a file.
- Log every iteration: tested, failed, fixed.

## graphify

Knowledge graph at `graphify-out/`. For codebase questions run `graphify query "<question>"`
first when `graphify-out/graph.json` exists; `graphify path` / `explain` for relationships and
concepts. **Teammates never run `graphify update`** — refresh is lead-only, once per phase,
after the merge (lead-playbook §6). The graph is stale by design; the code wins.

⛔ **Binding exception: graphify does NOT index SQL, and migration file text is STALE by
design** (some migrations rewrite function bodies at runtime). For **any** schema / RLS / RPC /
authorization question the **live catalog is the sole truth**: `pg_proc` (incl. **`prosecdef`**
— a DEFINER's gate *replaces* RLS), `pg_policies`, `pg_policy`, `pg_trigger`, and the ACLs.
Never graphify it, never grep it, never read the migration file and believe it (ADR 0078).

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.
