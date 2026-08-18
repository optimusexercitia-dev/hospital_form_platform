# CLAUDE.md — Hospital Commission Forms Platform

Loaded by the team lead **and every teammate** — keep it lean; every spawn pays
for it. It holds the shared, stable rules and points to the docs that carry detail:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — binding architecture rules + canonical
  schema (authoritative; summarized in §3).
- **[PHASES.md](./PHASES.md)** — phased plan + per-phase acceptance criteria (§5).
- **[PROGRESS.md](./PROGRESS.md)** — live phase/status tracker + full backlog (§7).
- **[docs/lead-playbook.md](./docs/lead-playbook.md)** — lead-only orchestration
  protocol (the single lead session reads it once; teammates get task-specific prompts).
- **[docs/worktrees.md](./docs/worktrees.md)** — git worktree setup + running parallel
  Claude Code sessions on this repo efficiently.
- **`.claude/agents/*.md`** — role instructions, appended per teammate.

---

## 1. Project Overview

A web platform that digitizes the manual checklists/forms hospital commissions fill
out, so statistics come from **dashboards** instead of manual tabulation. Frontend
design must be professional yet interactive and engaging — micro-animations via
**GSAP** for a captivating experience.

**Positioning: a governance / quality LAYER for hospital accreditation** (ONA in
Brazil; JCI / Joint Commission internationally; the ANVISA/RDC backdrop). It
documents committee **process, measurement, and improvement**, sitting *beside* the
EHR, not duplicating it. Outside the three PHI modules it holds **no PHI by design**
(minimum-necessary). Rationale: ADR
[0030](./docs/decisions/0030-patient-safety-phi-and-pqs-architecture.md) (supersedes
[0028](./docs/decisions/0028-accreditation-governance-roadmap.md)'s no-patient-data
stance).

**PHI posture (= Architecture Rule 12 — stated once here; elsewhere cite "Rule 12").**
Patient data (PHI) is in scope on HIPAA-compliant infrastructure (Supabase, under a
BAA), governed by the binding **LGPD + ANVISA/RDC + CFM 1821/2007** regime (20-yr
retention; the BAA is the *infrastructure* safeguard, not the governing law — ADR
[0035](./docs/decisions/0035-lgpd-anvisa-regulatory-posture.md)). PHI is collected
minimum-necessary and confined to **exactly three isolated modules** — patient-safety
/ NSP (`event_patient`), inter-committee **referral** (`referral_patient`), and
**case** (`patient_identifiers`, anchored on `patient_participants`) — each behind the
tightest RLS, PHI-access-audited, and protected by platform at-rest encryption
(column-level encryption **declined**). ADRs 0030 / 0035 / 0037 / 0038. This
**reverses** the platform's former "no patient data, ever" rule.

> ⚠ **`case_patient` is a FEATURE-FLAG KEY, not a table** — the case module's PHI lives in
> **`patient_identifiers`** keyed to **`patient_participants`**; the flag and the predicate
> `app.can_read_case_patient` carry the name, **no relation does**. Verify against the
> catalog, never this sentence — detail: ARCHITECTURE.md §2 (case module; ADRs 0038/0066).

### Core domain concepts

- **Tenancy**: multi-tenant **organizations → hospitals → commissions** (ADR 0041).
  A commission belongs to one hospital, a hospital to one org.
- **Commission**: the lowest unit (e.g., Infection Control). All forms, members, and
  responses belong to exactly one commission.
- **Roles** (full definitions + RLS: ADR 0041, `docs/backend-state.md`):
  - `platform_admin` — global superuser. **May** administer **tenancy, identity, vocabulary and
    audit** (orgs, hospitals, memberships, professional identity, catalogs, `audit_log`). **May NOT**
    touch **commission content or PHI** — cases, responses, narratives, meetings, patient data.
    *(The "noun rule" — ADR 0078 A35.)* ⚠ The census figures behind it are **TABLE-level reads
    through RLS**, not proof the content is unreachable — a DEFINER function's gate bypasses RLS
    entirely (BUG-AUTHZ-001; full record: `docs/progress/bug-log-archive.md` + the A35 amendment).
    Cite the census as row-level. Corollary, the standing one: **`prosecdef` belongs beside `pg_policies`.**
  - `org_admin` / `hospital_admin` — manage an org / a single hospital and its
    commissions, users, members. ⚠ **`hospital_admin` is NOT confined to its own hospital's
    people** — the user directory is org-scoped *by decision* (ADR 0048 D1), and the DEFINER door
    `list_addable_commission_members` returns the whole org's active roster, wider than the
    `profiles` policy allows (ratified: ADR
    [0097](./docs/decisions/0097-hospital-affiliation-person-identity.md) finding 1 + Consequences).
    ADR 0097 (AFF) also makes hospital **affiliation** a read-visibility input — reversing ADR
    0048 D7's "hospital is never gated on".
  - `staff_admin` (per commission) — builds/edits forms, manages that commission's
    staff, views its dashboard.
  - `staff` (per commission) — fills published forms.
  - **NSP roles** (`nsp_org_admin`, `nsp_coordinator`) run the patient-safety / PQS
    roster; **`administrativo`** is a per-commission delegated-capability grant (not a
    role enum; ADR 0061).
  - A user may hold different roles across commissions, hospitals, or organizations.
- **Forms & responses** (schema-level detail authoritative in ARCHITECTURE.md §2 /
  Rules 2–5):
  - **Versioning**: draft → published → archived; published versions **IMMUTABLE**;
    editing **clones** to a new draft, preserving `question_key`s + conditions.
    Responses reference a specific `form_version_id`; input items keep a stable
    `question_key` for cross-version dashboards.
  - **Sections (first-class)**: a version is an ordered list of `form_sections` (≥1; a
    lone `is_default` section renders flat/unsectioned); a section may carry
    `visible_when` (conditional, on an earlier `question_key`) and `requires_signoff`.
  - **Items**: **input items** collect answers (8 types — `multiple_choice` … `time`;
    optional `question_explanation` help text); **display items** render only
    (`section_text`, `image`) — no `question_key`, invisible to dashboards.
  - **Filling** is a wizard with resume: answers persist on every navigation; lifecycle
    `in_progress` (resumable, creator-only) → `submitted` (immutable, counted); one
    `in_progress` response per user per version.

### Governance & accreditation modules (Phases 13+)

Each is feature-flagged; full detail in PHASES.md + `docs/phases/accreditation-track.md`
+ its ADR. PHI-free unless flagged **(PHI — Rule 12)**:

- **Audit trail** — append-only, hash-chained `audit_log` (Rule 11).
- **Patient-safety event → triage → RCA → CAPA (NSP)** — notify → triage → root-cause
  → closed CAPA loop. **(PHI — Rule 12; ADR 0030.)**
- **Inter-committee referrals (Encaminhamentos)** — a `Case` sent to another committee
  over a frozen snapshot; structured reply; QPS sees the full trajectory. **(PHI —
  Rule 12; ADR 0037.)**
- **Quality indicator** — numerator/denominator/target/periodicity/direction; manual or
  **derived** from submitted-form aggregates via `question_key`.
- **Accreditation standard & evidence link** — ONA/JCI/custom framework; commissions
  link artifacts as evidence, driving a **readiness/gap report**.
- **Controlled document** — policy/POP/protocol lifecycle with e-signatures,
  effective/expiry dates, scheduled review cycle.
- **Internal audit / mock tracer** — scored self-assessment; a non-conforming finding
  opens a CAPA.

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
| Animation   | GSAP (`gsap` 3.15, pinned) — the §1 micro-animation mandate; tokens in `src/components/motion/` |
| Local dev   | Supabase CLI (`supabase start` — local Docker stack)          |
| Deploy      | Docker (Next.js standalone) on Coolify (Dockerfile app type — no compose/Caddy; ADR 0059); Supabase Cloud in production |

### Repository layout

```
/
├── CLAUDE.md / ARCHITECTURE.md / PHASES.md / PROGRESS.md   # rules, schema, plan, status
├── Dockerfile                 # Coolify deploy — root, Next.js standalone (ADR 0059)
├── .claude/agents/            # teammate role definitions  (+ .claude/skills/)
├── scripts/                   # e2e-prod-gate.sh (the §6 gate) · check-tailwind-css-vars.mjs
│                              #   + check-memberships-door · check-client-server-imports ·
│                              #   check-vacuous-assertions (the 4 non-eslint lint gates, §8)
│                              #   · worktree-setup.sh
├── supabase/
│   ├── migrations/            # SQL migrations (Backend) — the live catalog, not this
│   │                          #   text, is truth (see the graphify exception below)
│   ├── tests/                 # pgTAP suites (Backend) — the numbered files
│   ├── seed.sql               # local dev seed (2 orgs; persona roster in its header)
│   ├── demo/ · snippets/ · templates/
│   └── config.toml
├── src/
│   ├── app/                   # Next.js App Router (Frontend)
│   │   ├── (auth)/ · auth/    # login, invite, password reset
│   │   ├── admin/             # platform-admin area
│   │   ├── api/               # route handlers (Backend)
│   │   ├── c/ · conta/ · conta-inativa/   # commission picker · account · deactivated
│   │   └── o/[org]/…/c/[commission]/  # tenant → commission areas (manage/forms/dashboard, NSP)
│   ├── components/            # (Frontend)
│   ├── proxy.ts               # (Backend)
│   └── lib/                   # domain modules (Backend) — one per feature area
│       │                      #   (cases, safety, referrals, ethics, documents, charters,
│       │                      #   notifications, indicators, attachments, participants, …),
│       │                      #   each typically actions.ts + queries; PLUS the three
│       │                      #   Rule 8/9 anchors:
│       ├── supabase/          # client factories + middleware session/gating helper
│       ├── queries/           # typed data-access functions
│       └── types/             # generated DB types + domain types
├── e2e/                       # Playwright specs (Tester)
├── worktrees/                 # parallel sessions — docs/worktrees.md
└── docs/                      # decisions/ (ADRs) · backend-state.md (backend surface
                               #   map) · lead-playbook.md · progress/ · reviews/ · phases/ ·
                               #   plans/ · design/ · testing/ · deployment/ · worktrees.md
```

## 3. Architecture Rules (index)

**Read [ARCHITECTURE.md](./ARCHITECTURE.md) in full before any schema, RLS, query, or
storage work — it is authoritative.** "Architecture Rule N" refers to its numbered
rules:

1. **RLS is the security boundary** — explicit policies on every table; service-role keys server-side only; never rely on UI hiding.
2. **Canonical schema** — `profiles`, `commissions`, `memberships`, `forms`, `form_versions`, `form_sections`, `form_items`, `responses`, `answers`, `response_section_signoffs` (+ sections-integrity rules); extend, never contradict. ⚠ **`memberships` is the single multi-scope table** (org + hospital + commission; keyed `principal_id`, **not** `user_id`) — **`commission_members` does not exist**; verify against the catalog, never this line. Detail + the scope-exclusivity CHECK: ARCHITECTURE.md §2.
3. **Response lifecycle & resume** — `in_progress` → `submitted` via the `submit_response` RPC (the authority); one draft per user/version; condition evaluator mirrored SQL ↔ TS.
4. **Sign-offs** — per (response, section); `signoff_role` gated by RLS; only while `in_progress`.
5. **Published versions are IMMUTABLE** — editing clones to a new draft, preserving `question_key`s + conditions.
6. **Storage immutability** — `form-assets` never overwritten; new path per upload; cloning copies the reference.
7. **Explanatory text is sanitized Markdown, never raw HTML** (stored-XSS).
8. **Generated types** regenerated after every migration; imported only from `src/lib/types/`.
9. **Data access via `src/lib/queries/`** — no inline supabase-js.
10. **User-facing text pt-BR**; code, comments, commits, docs in English.
11. **Auditability** — append-only, tamper-evident trail; every mutation emits a row; reads of another member's data + every PHI read are logged (records *that* + *who*, never payloads/PHI).
12. **PHI / HIPAA** — see §1: three isolated **Class-1 patient-PHI** modules (`event_patient` / `referral_patient` / **`patient_identifiers`+`patient_participants`** — ⚠ *not* `case_patient`, which is a flag key, see §1) under identical isolation + audited-single-door safeguards. A distinct **Class-2 professional-identity** class (`professional_profiles`; case-scoped RLS + audited reads, no single door) lands in F1 (ADR 0064/0065); others hold none by design.

## 4. Agent Team

Development uses Claude Code **Agent Teams** (experimental; requires v2.1.32+), enabled
via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1"` in `.claude/settings.json`. The session
that opens the project is the **team lead / orchestrator**: it coordinates, assigns,
reviews plans, and does **not** write feature code. **Lead orchestration protocol →
[docs/lead-playbook.md](./docs/lead-playbook.md)** (lead only).

**Delegation:** exploration/grep → Haiku · implementation → Sonnet · architecture &
multi-file refactors → Opus/Fable · read-only reviewers → Haiku/Sonnet.

| Teammate   | Agent type          | Scope |
| ---------- | ------------------- | ----- |
| `frontend` | `frontend-engineer` | All UI: `src/app`, `src/components`. MUST use the `frontend-design` skill before new screens; consults `vercel-react-best-practices`. |
| `backend`  | `backend-engineer`  | Supabase migrations, RLS, seed, `src/lib/{supabase,queries,types}`, middleware, server route handlers, Docker/deploy. Consults `supabase` + `supabase-postgres-best-practices`. |
| `tester`   | `qa-tester`         | Playwright E2E in `e2e/`, execution, bug reports. Never fixes app code. |
| `qa`       | `qa-reviewer`       | Final phase review: requirements, code, security/RLS. Read-only on app code; writes only review reports. |

**File ownership is binding**: two teammates never edit the same file in a phase;
shared types change only via `backend`. Details of warm-team reuse, contract-first
sequencing, and plan-approval right-sizing live in the lead-playbook. For work that
needs to happen *beside* the phase instead — a parallel human session, an isolated
spike — see [docs/worktrees.md](./docs/worktrees.md) rather than adding it to this
tree's coordination.

## 5. Phased Development Plan

The full plan + acceptance criteria live in **[PHASES.md](./PHASES.md)** (core
platform 0–12 + the accreditation-track index). Accreditation track **13–21** detail is
in **[docs/phases/accreditation-track.md](./docs/phases/accreditation-track.md)** (read
**[docs/quality-track-context.md](./docs/quality-track-context.md)** first). **Live
status and the full backlog** — including Phase 22 (Referrals), Phase 23 (Patient
Identity), and cross-cutting workstreams — live in **PROGRESS.md**. One codebase, one
schema, one rulebook.

**Hard rule:** no phase begins until the previous phase has passed the Phase Gate (§6)
**and** the human has approved. Backend may run one phase ahead on schema work, but
nothing merges ahead of its phase.

**Live order and pilot status: PROGRESS.md § "Remaining pre-pilot work"** (the Phase Status
table alone does not carry sequencing). Phases 18–19 stay post-pilot (ADR 0071).

> ⭐ **Before any authorization / RLS / security-test work, read
> [docs/progress/authz-handoff.md §7](./docs/progress/authz-handoff.md)** — the ADR-0078
> lessons: keystones that could not fail, the many ways "text is not truth", and
> **`prosecdef` belongs beside `pg_policies`**. They are **not** authz-specific and they cost
> six review rounds. ADR
> [0079](./docs/decisions/0079-authz-door-blindness-standing-invariant.md)'s door-audit sweep
> is a **standing** gate, operationalized in **§6 step 1** — "standing" in prose alone once
> meant it ran once in three weeks, and the next run found 15 BLIND gates.

When a decision in this file is superseded by an ADR, amend this file too — a stale
`CLAUDE.md` is worse than a missing one, because it is loaded into every session. However, always ask before making changes to `CLAUDE.md`.

## 6. Phase Gate (mandatory, in order)

1. **Build complete** — all phase tasks done; lint, typecheck, unit tests, **and the pgTAP
   suite (`npm run test:db`)** pass locally. Run pgTAP on a **fresh `supabase db reset`** — an
   E2E-mutated DB yields spurious commission-count reds that are not defects.
   **Authz gates** — `ARM=census` (~2 s), `ARM=hat` (~10 s), `ARM=floor` (~1 min) **and**
   `FROMFINDINGS=1 ARM=wrapper` (~2 s) of
   `supabase/tests/mutation/p0-authz-invariant.sh` must hold. **`ARM=census` is the one that
   catches a gate you just added** — a brand-new gate is in no BLIND set, so it passes
   `ARM=policy` **vacuously** (ADR 0079 Amendment 3). ⚠ **`ARM=wrapper` covers the
   `prosecdef = f` half** (ADR 0079 Amendment 7): every other arm bounds its domain with
   `p.prosecdef`, so a `public` INVOKER wrapper whose own probe is the only gate in front of an
   `app` DEFINER body was in **no** arm's domain at all. Its census domain widened in the same
   change — without that a NEW wrapper passes `ARM=wrapper` vacuously by being absent from the
   findings. **If the phase touched any RLS policy or
   `prosecdef` boolean gate**, also run the **diff-scoped** door sweep over exactly those
   (~1 min/gate), deriving the list from the migration diff, never by hand — recipe: **ADR
   [0079](./docs/decisions/0079-authz-door-blindness-standing-invariant.md) Amendment 1**.
   **BLIND blocks the phase** (keystone it; allowlist only an unreachable backstop, never a
   tenant-isolation policy); **`ERROR` is not a pass** (cover it in the phase's mutation
   audit). Sweep-run mechanics incl. the findings-file restore: lead-playbook §4. The
   **full** ~5 h sweep is a periodic audit, **not** a phase step — and `ARM=wrapper`'s own
   full sweep (~100 min, 56 suite runs) is periodic for the same reason; the phase step is
   the cheap `FROMFINDINGS=1` comparison against the committed findings.
2. **Test pass** — `tester` writes/updates Playwright specs for the acceptance criteria
   and files a bug per failure in PROGRESS.md. The fix loop reruns **failing +
   current-phase** specs (chromium); the **full E2E suite runs once to declare green** —
   via **`npm run e2e:prod`** (prod-standalone, batched + server-restart-per-batch; a plain
   `npx playwright test` monolith collapses on Windows — see `docs/testing/e2e-prod-build-gate.md`).
   Tester never edits app code; engineers never edit specs to pass without tester
   sign-off.
3. **QA review** — `qa` audits the phase and writes
   `docs/reviews/phase-N-review.md` with `APPROVED` or `CHANGES REQUESTED`. Changes loop
   to step 1.
4. **Human approval** — lead presents a summary (built, test results, QA verdict, open
   risks) and **waits** for explicit approval.
5. **Record** — lead updates PROGRESS.md, **rotates** the completed phase's detail out
   (mechanics: lead-playbook §§4–5), updates `docs/backend-state.md` if the backend surface
   changed, and commits `phase(N): complete — <summary>`. **Name the authz ARM, never the script:**
   `ARM=floor` asks whether every door is *called*, a diff-scoped `ARM=policy` whether anything
   *notices* when a gate is opened, `ARM=census` whether anything has *ever asked*, `ARM=hat`
   whether any door reads `memberships` without the caller's hat — a gate record
   naming the script reads as full coverage while delivering the cheap half (ADR 0079;
   `docs/progress/follow-ups-archive.md`).

## 7. Progress Tracking

**PROGRESS.md is the single source of truth for status.** Update it when a task
starts/finishes, a bug is filed/fixed, a gate step passes, or a decision is made —
**never report status verbally without writing it there first**. Every teammate updates
**only their own** rows/sections; the lead owns the phase-status table. **Keep it small
— every spawn reads it** (target well under 60 KB): the live file holds only the current
phase + the head of each cross-phase log. The rotation/archive discipline is the lead's
(mechanics: **lead-playbook**). The durable backend-surface map is
**`docs/backend-state.md`** — reference it instead of re-deriving the backend each phase.

## 8. Conventions & Quality Bar

- TypeScript `strict`; no `any` without an inline justification comment.
- **Lint gate** — `npm run lint` is **SIX gates chained**; ALL must pass (verify against
  `package.json`, not this list): `eslint --max-warnings=0` **&&** `lint:css-vars` **&&**
  `lint:memberships-door` **&&** `lint:client-server-imports` **&&** `lint:vacuous` **&&**
  `lint:set-local`. Each was added after the class it gates shipped a live defect:
  - `lint:css-vars` (`check-tailwind-css-vars.mjs`) — the Tailwind-v4 bare `[--var]` form, which
    compiles to dead CSS; added after it shipped nine dead motion utilities.
  - `lint:memberships-door` (`check-memberships-door.mjs`) — direct `memberships` reads that
    bypass the `has_role` doors.
  - `lint:client-server-imports` (`check-client-server-imports.mjs`) — a client value-import from
    a server query module, which **aborts `next build`** while tsc/lint/vitest stay green.
  - `lint:vacuous` (`check-vacuous-assertions.mjs`) — a test that can go GREEN having asserted
    nothing. Record: [docs/reviews/vacuous-assertion-audit.md](./docs/reviews/vacuous-assertion-audit.md).
  - `lint:set-local` (`check-migration-set-local.mjs`) — a top-level `set local` in a migration,
    which is a **silent no-op** outside a transaction (Postgres warns `25P01` and continues) and so
    passes every local gate; where it wraps a data-dependent backfill a fresh reset matches zero rows
    and hides it. Bounded by a **watermark, not an allowlist** — ⛔ **the watermark grandfathers the 12
    pre-existing files and must NOT be bumped on a `db push`**, or it grandfathers the files you just
    wrote and flips the rot direction from stricter to weaker. Rationale + the 3-layer positive
    control: the script header and `FUP-DM5-SETLOCAL-MIGRATION`.
  eslint itself must be **0 errors AND 0 warnings** (warnings fail the gate). Scope is first-party source (`src/`, `e2e/`, `*.test.*`);
  `.claude/` tooling + build dirs are ignored; mark intentionally-unused bindings with a
  `_` prefix; keep `eslint-config-next` pinned to the installed `next`. Rationale: ADR 0067.
- Conventional commits: `feat(scope):`, `fix:`, `test:`, `chore:`, `phase(N):`.
- Server Components by default; `"use client"` only where interaction requires it.
- Every form input accessible: labels, keyboard navigation, visible focus. The tester
  includes at least one keyboard-only flow per phase.
- Errors user-readable in pt-BR; raw Supabase/Postgres errors never reach the UI.
- Secrets only in `.env.local` (gitignored). `NEXT_PUBLIC_` vars: Supabase URL + anon
  key only. Service-role key is server-only — in client code, that's a phase-blocking bug.
- Non-trivial decisions get a 5–10 line ADR in `docs/decisions/`.

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
npm run lint && npm run typecheck   # lint = eslint(0 warnings) && css-vars && memberships-door
                               #   && client-server-imports && vacuous && set-local — all six (§8)
npm run format:check           # Prettier (npm run format to write)
npm run test                   # Vitest unit tests (full suite)
npm run test:db                # pgTAP suite (`supabase test db`) — Phase Gate step 1
npx playwright test            # E2E on a dev server (quick loop; needs dev server + seeded DB)
npm run e2e:prod               # FULL prod-standalone E2E gate — batches the suite + restarts the
                               #   server per batch to avoid the Windows monolith collapse.
                               #   Knobs: BATCH_SIZE / RESET / REBUILD / RETRIES / SPECS.
                               #   Details: docs/testing/e2e-prod-build-gate.md
```

Single-test debug loops: `npx vitest run <file>` / `-t "<name>"`; `npx playwright test
<spec>` / `-g "<title>"` / `--project=chromium`.

**E2E seed personas** (`supabase/seed.sql`, applied by `db reset`). Two orgs — **Rede A**
(commissions CCIH + Farmácia) and **Rede B** (cross-org boundary). Password for ALL:
`Test1234!`. Key personas (full roster in the seed header): `platform@test.local`
(`platform_admin`), `orgadmin.a@test.local` (`org_admin` A), `chefe.ccih@test.local`
(`staff_admin` A / CCIH), `multi@test.local` (`staff` of A **and** B — commission
picker), `nsporg.a@test.local` (`nsp_org_admin` A).

## Loop Safety Rules

- Never exceed 5 fix iterations without reporting to the user.
- Each iteration must fix at least one new issue — if the same error recurs unchanged,
  stop and escalate.
- Track which files each agent modified to detect conflicts.
- If two agents need to modify the same file, serialize those tasks.
- Log every iteration: what was tested, what failed, what was fixed.

## graphify

This project has a knowledge graph at `graphify-out/`.

- For codebase questions, run `graphify query "<question>"` first when
  `graphify-out/graph.json` exists; `graphify path "<A>" "<B>"` for relationships and
  `graphify explain "<concept>"` for focused concepts — these return a scoped subgraph,
  usually much smaller than GRAPH_REPORT.md or raw grep.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- **Refresh is lead-only, ONCE PER PHASE, after the merge to `main`, in its own
  `chore(graphify):` commit. Teammates: do not run `graphify update` at all** — if you already
  did, revert `graphify-out/` and say so. (A small fix regenerates the whole graph — a
  near-certain conflict in a generated file; mechanics + rationale: lead-playbook §6.)
  ⚠ Between refreshes the graph is **stale by design** — an orientation aid, never an
  authority. When it disagrees with the code, the code wins (and for SQL, see the binding
  exception below: the catalog wins over both).
- ⛔ **Exception, binding: graphify does NOT index SQL — and migration file text is STALE by design**
  (some migrations rewrite function bodies at runtime via `pg_get_functiondef()` + `replace()` +
  `execute`). For **any** schema / RLS / RPC / authorization question the **live catalog is the sole
  truth**: `pg_proc` (incl. **`prosecdef`** — a DEFINER's gate *replaces* RLS), `pg_policies`,
  `pg_policy`, `pg_trigger`, and the **ACLs**. Never graphify it, never grep it, never read the
  migration file and believe it. Reading files here has already produced a confident **false P0** and
  burned an external auditor. ADR 0078 "METHODOLOGY FINDING"; the `Bash` graphify hook is off for
  this reason.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
