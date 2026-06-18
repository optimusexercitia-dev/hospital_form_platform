# PHASES.md — Hospital Commission Forms Platform

The detailed phased development plan and per-phase acceptance criteria.
Referenced by `CLAUDE.md` (§5). Each phase is gated by the Phase Gate in
`CLAUDE.md` (§6).

**Hard rule: no phase begins until the previous phase has passed the Phase
Gate (CLAUDE.md §6) and the human has approved.** Phases are sequenced so the
Backend can run one phase ahead on schema work when idle, but nothing is merged
ahead of its phase.

### Phase 0 — Scaffolding & Environment
- Next.js + TypeScript + Tailwind v4 + shadcn/ui initialized; ESLint/Prettier.
- Supabase CLI local stack running; empty initial migration; type generation wired.
- Playwright + Vitest installed with one smoke test each (home page renders).
- `PROGRESS.md` created from the template; `docs/decisions/` started.
- **Acceptance**: `npm run dev`, `npm run test`, `npx playwright test`, and
  `supabase start` all succeed from a clean clone.

### Phase 1 — Database Schema, Auth & RLS
- All migrations for the canonical schema: `form_sections` (default-section
  rules, `visible_when`, sign-off settings), `form_items` integrity
  constraints, the display-item answer-rejection trigger, response lifecycle
  columns + one-draft-per-user index, `response_section_signoffs`, and the
  submitted-response immutability triggers; `profiles` auto-created on signup
  (trigger); custom access token hook or `app_metadata` exposing `is_admin`.
- The SQL **condition evaluator** function + the `submit_response` RPC
  (visibility evaluation, required-answer check, sign-off check, stray-answer
  cleanup, atomic status flip) with unit tests at the SQL level. Publish-time
  validation function for `visible_when` (referenced key exists, earlier
  section only, no condition on first section).
- Full RLS policy set + `is_member_of(commission_id)` / `is_staff_admin_of(...)`
  helper functions (`security definer`); `form-assets` Storage bucket with
  commission-scoped policies (image upload UI comes later, but the bucket and
  policies are schema work).
- Seed script: 1 admin, 2 commissions, 1 staff_admin + 2 staff each. Sample
  published forms: (a) an UNSECTIONED form (default section only) with all
  four input types (≥2 with `question_explanation`), one `section_text` and
  one `image` block; (b) a SECTIONED form with ≥3 sections, one conditional
  section, and one `requires_signoff` section (one of each `signoff_role`).
  ~10 submitted responses across both + at least one `in_progress` response.
- **pgTAP or SQL-based RLS tests** proving: staff cannot read another
  commission's data; staff cannot edit forms; published versions, their
  sections, and their items reject UPDATEs; an `answers` row targeting a
  display item is rejected; submitted responses/answers/sign-offs reject
  UPDATEs; an in_progress response is invisible and uneditable to anyone but
  its creator; `submit_response` rejects missing required answers, missing
  sign-offs, and double submission; condition evaluator covers all three ops;
  staff_admin cannot escalate to admin.
- **Acceptance**: RLS + RPC test suites green; types generated; seed produces
  a working local dataset.

### Phase 2 — Authentication & App Shell
- Login (email/password), logout, password reset; invite-acceptance page.
- `middleware.ts` session refresh + role-aware redirects (admin → `/admin`,
  others → their commission, multi-commission users → a picker).
- App shell: navigation, commission switcher, role-aware menu, pt-BR strings,
  loading/error states.
- **Acceptance**: E2E: each seeded persona logs in and lands on the correct
  area; unauthorized routes redirect; direct URL access to a foreign
  commission shows 404/403.

### Phase 3 — Admin Area & User Management
- `/admin`: commission CRUD; assign/remove staff_admins.
- Commission management (`/c/[slug]/manage/members`): staff_admin invites
  staff by email (server route using `auth.admin.inviteUserByEmail` with the
  service role — server-side only), removes staff, sees member list.
- **Acceptance**: E2E: admin creates a commission and assigns a staff_admin;
  staff_admin invites a staff user (invite flow stubbed/intercepted in tests);
  staff_admin of commission A cannot manage commission B.

### Phase 4 — Form Builder & Versioning
- Form list per commission; create form → v1 draft with its default section.
- Builder UI as a **two-level editor: sections containing blocks**.
  - Sections: add/rename/describe/reorder/delete (deleting moves or deletes
    its items with confirmation); per-section settings panel: `visible_when`
    condition editor (pick an earlier section's question + op + value — the
    UI only OFFERS valid targets, but publish-time validation remains the
    authority) and sign-off settings (`requires_signoff`, `signoff_role`).
  - Items within a section: add/edit/delete/reorder, move item to another
    section. Input items: all four types, options editor, required flag,
    optional `question_explanation` ("Texto de apoio"). Display items:
    `section_text` with Markdown editor + preview, `image` with upload to
    `form-assets` (immutable paths per ARCHITECTURE.md Rule 6), alt text
    required, optional caption.
  - A form that stays on its default section shows no section chrome in the
    builder until the user adds a second section ("Adicionar seção").
  - Simple up/down controls — no drag-and-drop in v1.
- Publish flow: runs condition validation, confirmation, archives previous
  published version. "Edit published" clones to a new draft preserving
  `question_key`s, sections, conditions, sign-off settings, and display
  blocks; version history view.
- **Acceptance**: E2E: (a) build an unsectioned form using every input type
  (≥1 with explanation), one text block, one image — publish; (b) build a
  3-section form with one conditional section and one sign-off section —
  publish; (c) attempt an invalid condition (forward reference) → publish
  blocked with a clear pt-BR error; (d) edit (b) → v2, verify v1 archived and
  immutable (sections included), question_keys/conditions/blocks survived the
  clone, and a re-uploaded image gets a NEW storage path while v1 renders the
  old one. Staff role cannot reach the builder.

### Phase 5 — Wizard Filling, Conditional Sections & Resume
- Staff form list (published versions only) showing "continuar preenchimento"
  when an in_progress response exists.
- **Unsectioned forms** (default section only): flat single-page render —
  inputs interleaved with `section_text` (sanitized Markdown) and `image`
  blocks, `question_explanation` as helper text via `aria-describedby`.
- **Sectioned forms**: one-section-per-page wizard — progress indicator
  (visible sections only), back/next, per-section client validation on next.
  Conditional sections appear/disappear from the step list as controlling
  answers change; if a changed answer hides a section that already has
  answers, warn the user and clear those answers on confirm.
- **Resume**: answers upserted on every section navigation;
  `last_section_id` updated; closing the browser and reopening lands the user
  on their last section with all answers intact. Explicit "salvar e sair".
- Review screen (all visible sections + answers, semantic `<h2>` per section,
  inputs grouped in `<section>`/`fieldset`) before submission. Submission
  calls the `submit_response` RPC (server is the authority — the E2E suite
  must include one server-rejection path, e.g. required answer removed via a
  second tab); confirmation screen; "minhas respostas" history (submitted +
  in_progress).
- **Acceptance**: E2E: staff completes the unsectioned form (happy path +
  validation errors); staff completes the sectioned form taking BOTH branches
  of the conditional section across two responses (hidden branch produces no
  answers); mid-fill exit + login again resumes at the correct section with
  answers intact; changing a controlling answer mid-wizard updates the step
  list and clears orphaned answers after the warning; one keyboard-only
  wizard pass; a v1 response remains intact and viewable after v2 is
  published. (Sign-off sections are seeded but their sign-off step is
  Phase 6 — wizard treats them as ordinary sections this phase, and
  `submit_response`'s sign-off check is feature-flagged off until Phase 6.)

### Phase 6 — Section Sign-offs & Submission Lifecycle
- Sign-off step in the wizard for `requires_signoff` sections:
  `respondent` role — an explicit confirmation action by the filler recorded
  as a sign-off row; `staff_admin` role — the response surfaces in a
  staff_admin "pendentes de assinatura" queue; the staff_admin reviews the
  section read-only and signs (optional note). Submission remains blocked
  until all visible sign-off sections are signed (`submit_response` sign-off
  check now enabled).
- Notifications kept minimal in v1: in-app pending queue only (no email).
- Sign-off display: signed sections show "assinado por X em DATA" in the
  review screen and in all read-only views.
- **Acceptance**: E2E: respondent-signed flow end-to-end; staff_admin-signed
  flow end-to-end including the pending queue; submission attempt without a
  required sign-off is rejected by the server with a clear pt-BR message;
  sign-offs are immutable after submission; a staff member cannot sign a
  `staff_admin` section (RLS verified through the UI); sign-off metadata
  visible in the read-only views.

### Phase 7 — Multi-Phase Cases
A **case** groups several form-fills (responses) into an ordered sequence of
**phases** so a commission can run a multi-step evaluation (e.g. a Mortality &
Morbidity review). Each phase reuses the existing response / answer / sign-off /
wizard machinery unchanged. **No patient data**: a case is a system-minted
per-commission case number + an optional non-identifying label. Full design and
rationale in ADR [0017](docs/decisions/0017-multi-phase-cases.md).
- **Schema** (migration `20260613090004_cases_multi_phase.sql`): `process_templates`
  (per-commission blueprint, `draft → active → archived`), `process_template_phases`
  (ordered phase-slots, each bound to a form, optional `recommend_when`), `cases`
  (case number minted per commission, `aberto → concluido | cancelado`), `case_phases`
  (the authority — pinned `form_version_id`, status `pendente → ativa → concluida` /
  `nao_necessaria`, `recommended`, `assigned_to`, `is_ad_hoc`). `responses` gains a
  nullable `case_phase_id`; the one-draft index is scoped to standalone responses and a
  new `unique(case_phase_id)` gives one response per phase.
- **Condition evaluator REUSED unchanged.** `recommend_when` (referencing any earlier
  phase via `from_phase`) is evaluated by feeding the existing `app.eval_condition` a
  new `app.case_phase_answer_map(case_phase_id)` (`security definer`, **submitted-only**)
  after stripping `from_phase`. SQL/TS evaluator + `condition-vectors.json` are untouched
  (no mirror drift). `recompute_recommendations(case_id)` flags `recommended` phases.
- **RPCs** (invoker unless noted): template lifecycle (`create`/`publish`/`archive`) +
  phase-slot CRUD/reorder; `create_case_from_template` (**definer** — materializes phases
  pinning published versions); `activate_phase` (assign + sequential guard), `skip_phase`,
  `add_ad_hoc_phase`, `reassign_phase`, `start_or_resume_phase` (wraps
  `start_or_resume_response`); phase submission reuses `submit_response` + a
  `sync_case_phase_on_submit` trigger; `close_case`/`cancel_case`; **definer** board reads
  `list_cases_board` + `get_case_detail` (status only / submitted answers only — mirror
  ADR 0016, preserve the Phase-7 in_progress-answers invariant). Feature-flagged behind
  `cases_multi_phase` (flipped on at phase completion). New SQLSTATEs `P0016`–`P0022`.
- **UI** under the commission area, reusing the form builder + sign-off queue + wizard:
  - `manage/process-templates/**` — template builder (reuse `BuilderShell`/`SectionCard`/
    `PublishButton`/`StatusBadge`); phase-slot = a form picker + optional `recommend_when`
    editor previewed with the existing `evalCondition`.
  - `manage/cases/**` — cases board (per-case phase progress, `recommended` highlight) +
    per-case detail; coordinator creates a case, assigns + activates phases, skips, adds
    ad-hoc phases, closes. Label field warns it must not contain patient identifiers.
  - `cases/[caseId]/phase/[…]/responder/[responseId]` — assignee fills a phase via the
    **unchanged wizard**, entered through `start_or_resume_phase`.
- **Acceptance**: E2E: a coordinator builds a 3-phase template (one phase with a
  `recommend_when`) → publishes → creates a case → assigns + activates phase 1 → the
  assignee fills + submits → the board shows `Fase 1: concluída` and phase 2 flagged
  `recommended` → coordinator activates phase 2, appends an ad-hoc phase, skips a phase,
  and closes the case; out-of-order activation is rejected (P0018); a member sees case/
  phase **status** but cannot open another member's in-progress phase **answers** by any
  path (board + `get_case_detail` leak none); the assignee fills only their own phase;
  case numbers are per-commission; one keyboard-only pass of the phase wizard + the
  activate/assign flow. SQL/pgTAP: case-number minting concurrency; sequential + skip
  guards; snapshot pins versions and rejects an unpublished form (P0017);
  `case_phase_answer_map` returns `'{}'` for an in-progress source phase (the invariant
  test); terminal-state guards block re-open.

### Phase 8 — Dashboards & Submissions Browser
- SQL views / RPCs for aggregations (counts per option per question_key,
  submissions over time, completion by member — keyed by `question_key` so
  charts span versions). **`status = 'submitted'` only** (use the canonical
  helper); checkbox values unnested via `jsonb_array_elements_text` so each
  selected option counts individually. Questions in conditional sections have
  varying denominators: every distribution reports its own denominator
  ("n de N respostas em que a pergunta era aplicável"), derived as the count
  of distinct submitted responses with any answer in that question's section.
- `/c/[slug]/dashboard`: per-form charts (bar/pie for choice questions,
  trend line for volume) grouped by section, date-range filter, CSV export of
  raw submitted responses (includes a column marking sign-off status per
  signed section).
- **Submissions browser** (`/c/[slug]/dashboard/submissions`, staff_admin):
  list of the commission's SUBMITTED responses filterable by member, form,
  and date range, with an explicit opt-in "em andamento" filter for
  in_progress ones (listed metadata-only — staff_admin cannot open another
  member's in-progress answers); clicking a submitted response opens a
  **read-only, version-faithful detail view** — the submission rendered with
  ITS version's sections and items (display blocks, explanations, and
  sign-off metadata included; sections hidden by conditions marked "não
  aplicável"; unanswered optional items shown blank), reusing the wizard's
  read-only renderer. Driven by a sections → `form_items` LEFT JOIN `answers`
  query so structure is complete even where answers are absent.
- Admin variant: cross-commission overview.
- **Acceptance**: E2E: dashboard numbers match seeded data exactly (assert on
  values, not just rendering), including the smaller denominator of the
  conditional-section question; in_progress responses are excluded from all
  charts; date filter changes results; CSV downloads and matches row counts;
  staff cannot access the dashboard. Submissions browser: filter by member
  returns exactly that member's seeded responses; a v1 submission opens
  showing v1's wording/sections after v2 exists; a response whose conditional
  section was hidden shows it as "não aplicável"; staff can open their own
  submission detail but a foreign response_id (other member or other
  commission) yields "not found" with no data leakage; staff_admin cannot
  read the answers of another member's in_progress response.

### Phase 9 — Deployment
> **Recommended trigger: deploy a pilot once the P0 accreditation core (Phases
> 13–16) is complete** — audit trail, CAPA, indicators, and the standards
> crosswalk are what make the platform worth piloting at a hospital, so a hospital
> sees the differentiating features rather than a bare committee tool. Phase 9 also
> **validates the known prod-auth gap** (ADR 0009 — production needs asymmetric JWT
> signing keys; the local JWT-verification path in middleware has never run against
> Supabase Cloud). Phases 17–21 are then sequenced *after* the pilot so they're
> informed by real-user feedback. Rationale: ADR
> [0028](docs/decisions/0028-accreditation-governance-roadmap.md).
- Multi-stage Dockerfile (Next.js standalone), docker-compose with Caddy
  (auto-HTTPS), `.env` documentation, production Supabase config checklist
  (URL config, redirect URLs, email templates in pt-BR).
- GitHub Actions: lint + unit + E2E on PR; build & deploy to droplet on main.
- `docs/DEPLOY.md` runbook including backup notes.
- **Acceptance**: container builds and runs locally against local Supabase;
  CI pipeline green; QA verifies the runbook is reproducible step-by-step.

### Phase 10 — Meetings
Committees schedule and register meetings (between members and external guests) and the
data that comes out of them (minutes/atas, agenda, action plans, attendance, cases discussed),
with **internal electronic signatures** (schema prepared for future third-party providers).
**No patient data.** Full design + rationale in the approved plan and ADR
[0025](docs/decisions/0025-meetings.md). Feature-flagged behind `meetings` (flipped on at phase
completion). Built ahead of Phase 9 (Deployment), which remains pending.
- **Schema** (migrations `20260615090000`–`090007`): `commission_meeting_types` + `commission_meeting_settings`
  (per-commission vocab + quorum rule, seeded on commission insert), `meetings`
  (per-commission `meeting_number`; lifecycle `agendada → realizada → em_assinatura → assinada →
  distribuida` + `cancelada`; conclusion snapshots quorum), `meeting_agenda_items`,
  `meeting_attendees` (platform user **XOR** external guest; role + attendance),
  `meeting_cases` (junction; conclusion writes a `case_events` row per linkage),
  `meeting_signatures` (provider-abstracted: `method`/`status`/`content_hash`/`provider_ref`/
  `provider_payload`; partial-unique on active rows), `meeting_attachments` (new `meeting-attachments`
  bucket; immutable objects, row soft-delete), `meeting_action_items` (mirrors `case_action_items`).
  Immutability via `app.guard_meeting_status` + `app.guard_meeting_child_lock` (session flag
  `app.in_meeting_rpc`). New SQLSTATEs `HC032`–`HC037`.
- **RPCs**: `create/update/conclude/reopen/distribute/cancel_meeting`; agenda CRUD + reorder;
  attendee CRUD + `seed_expected_meeting_attendees`; `meeting_cases` link/unlink; attachment
  insert + soft-delete; `sign_meeting` (DEFINER; computes `content_hash`; auto-flips to `assinada`
  when the last required signature lands — RPC-side, not a trigger); action-item
  create/update/advance/complete; `my_pending_meeting_signatures` (DEFINER read).
- **RLS**: member SELECT / staff_admin authoring; sign-own-row INSERT on `meeting_signatures`
  gated by `app.can_sign_meeting` (present platform attendee of an `em_assinatura` meeting).
- **UI** under the commission area (reuse cases/forms components): `meetings/` list (filter by
  status/type), schedule form, `meetings/[id]/` detail hub (header + lifecycle controls, minutes
  markdown editor, agenda editor, attendees & quorum, cases linker, action items, attachments,
  signatures panel with "Assinar"), `manage/` meeting-types + quorum config; a **"Reuniões"** nav
  item + a **"Pending Signatures"** shell indicator from `my_pending_meeting_signatures`.
- **Acceptance**: E2E: staff_admin schedules a meeting → adds agenda + attendees (incl. an
  external guest) + links a case + writes minutes → concludes (status `em_assinatura`, quorum
  snapshot populated, a `case_events kind='meeting'` row appears on the case) → a present member
  sees "Pending Signatures", signs, badge clears → when all present members have signed, status
  auto-flips to `assinada` → staff_admin distributes. Negative/security: a plain member sees
  read-only; a non-present user cannot sign (HC036); double-sign HC035; conclude with no present
  attendee HC034; editing minutes while `em_assinatura` rejected; staff_admin reopen revokes
  signatures and re-opens editing; a foreign-commission user gets 404/no leakage; one keyboard-only
  flow. pgTAP: `meeting_number` minting concurrency; lifecycle + child-lock guards; sign-own-row
  RLS + auto-flip; reopen-revokes; same-commission guards (HC032).

### Phase 11 — Interviews
Committees interview healthcare professionals about a specific case (e.g. M&M interviewing the
staff involved in a patient's care). Interviews are scheduled **from within an open case**, have
their own lifecycle, link to a case phase (optional), record multiple **interviewees** and
**interviewers** (registered platform user **XOR** external fallback, each with a role), and carry
evidence attachments (uploaded documents + external audio-recording URLs). On conclusion the
interview writes a `case_events` row (the case "registry"). **No patient data.** Full design +
rationale in the approved plan (`.claude/plans/it-is-common-for-jazzy-lake.md`) and ADR
[0026](docs/decisions/0026-interviews.md). Feature-flagged behind `interviews` (flipped on at phase
completion). Built ahead of Phase 9 (Deployment), which remains pending.
- **Schema** (migrations after `20260615090009`): `case_interviews`
  (per-commission `interview_number`; lifecycle `rascunho → agendada → em_andamento → concluida`
  + `cancelada`, **reopenable**; nullable `case_phase_id`; `summary_md`; nullable `form_version_id`
  forward hook; `registry_event_id` → the `case_events` row), `case_interview_subjects`
  (interviewees; `user_id` XOR `external_name`; **free-text** clinical role), `case_interview_interviewers`
  (`user_id` XOR `external_name`; **fixed-enum** committee role: `entrevistador_principal` /
  `entrevistador` / `observador` / `anotador`), `case_interview_attachments` (unified: `storage_path`
  XOR `external_url`; new `interview-attachments` bucket, 25 MiB, no audio bytes; immutable objects,
  row soft-delete). `case_events.kind` gains `'interview'`. Immutability/lifecycle via
  `app.guard_interview_status` + content-freeze (session flag `app.in_interview_rpc`). New SQLSTATEs
  continue after `HC037`.
- **RPCs**: `create/schedule/start/conclude/reopen/cancel_interview`; subject + interviewer CRUD
  (registered interviewer must be a member → `HC021`); attachment insert (upload XOR link) +
  soft-delete; `conclude_interview` writes/updates the `case_events kind='interview'` row;
  `interviews_enabled()`.
- **RLS (NEW shape — row-level participant write grant)**: member SELECT; **create** = staff_admin/admin;
  **write** (update/delete + all child writes) = staff_admin/admin **OR** a registered interviewer on
  that interview, via `SECURITY DEFINER` `app.can_write_interview` (+ `app.commission_of_interview`),
  mirroring `app.can_sign_meeting`/`commission_of_meeting` to avoid policy recursion. Storage INSERT
  policy keys on path segment `[2]` (`interview_id`) so interviewers can upload.
- **UI** nested under the case detail page: an **"Entrevistas"** panel + "Nova entrevista" dialog,
  and an interview detail page (`cases/[caseId]/interviews/[interviewId]`) — header + lifecycle
  controls, summary markdown editor, subjects panel, interviewers panel, attachments panel (upload +
  add-link + open/download). pt-BR, keyboard-accessible, GSAP micro-animations.
- **Acceptance**: E2E: staff_admin schedules an interview on a case → adds a registered + an external
  subject → adds a registered (member) + external interviewer → starts → uploads a PDF + adds an audio
  URL → concludes (a `case_events kind='interview'` row appears on the case) → reopen + re-conclude
  updates the **same** timeline row (no duplicate) → cancel. Negative/security: a plain-`staff`
  interviewer **can** edit/conclude their interview; a `staff` non-interviewer **cannot** write; a
  foreign-commission user gets no read; MIME/size rejection on upload; `https`-only link validation;
  one keyboard-only flow. pgTAP: `interview_number` minting concurrency; lifecycle + content-freeze
  guards; `can_write_interview` participant grant; commission/case + phase-in-case guards.

### Phase 12 — Case Timeline
*(Complete — 2026-06-16. Recorded here for continuity; full design in ADR
[0027](docs/decisions/0027-case-timeline.md) and `docs/progress/phase-12.md`.)*
Read-only **Linha do tempo** tab on the case detail page aggregating a case's
sub-entities (phases, interviews, meetings, documents, action items, notes,
lifecycle, milestones) into one time-ordered event array rendered as a Feed or a
duration Gantt. **No DB migration** — composes existing RLS-scoped reads (Rule 9);
two dedups (interview `registry_event_id`; meeting-echo). 169/169 green.

---

## Accreditation & Quality-Governance Track (Phases 13–21)

> **Why this track exists.** The platform is being positioned for hospitals that
> must satisfy — or want to *prepare for* — accreditation (ONA in Brazil; JCI/Joint
> Commission internationally; the ANVISA/RDC regulatory backdrop). Phases 0–12 make
> the platform an excellent **committee-operations system**; this track makes it an
> **accreditation-readiness system** by adding the three things surveyors actually
> score — a tamper-evident audit trail, a closed PDCA/CAPA improvement loop, managed
> quality indicators — and the engine that maps everything the platform produces to a
> specific accreditation standard.
>
> **Positioning is fixed: the platform remains a governance / quality LAYER.** The
> hard **no-patient-data** rule (CLAUDE.md §1) is reaffirmed for every phase below —
> these modules document committee *process, measurement, and improvement*, never the
> clinical case itself. A feature that appears to need patient-identifiable data is a
> STOP-and-flag, exactly as before. Strategic rationale + the rejected
> "minimal-identifiers" alternative are recorded in ADR
> [0028](docs/decisions/0028-accreditation-governance-roadmap.md).
>
> **Conventions inherited by every phase here** (do not re-litigate per phase):
> each new feature is **feature-flagged** (inserted OFF, flipped ON in-phase, mirror
> the `meetings`/`interviews` pattern); custom errors continue the **`HC0xx`** class
> from `HC042` upward; all writes go through RLS as the authority with narrow
> `SECURITY DEFINER` exceptions documented in an ADR; all user-facing text pt-BR;
> all explanatory/free text is **sanitized Markdown, never raw HTML** (Rule 7); every
> mutation **emits an audit row** once Phase 13 lands (Architecture Rule 11); one
> keyboard-only flow per phase; types regenerated after every migration. Built ahead
> of Phase 9 (Deployment) — with the agreed plan to **deploy a pilot after Phase 16**
> (the P0 accreditation core), then sequence Phases 17–21 on pilot feedback.

### Phase 13 — Audit Trail (Trilha de Auditoria)
A system-wide, **append-only, tamper-evident** audit log: who did what, to which
entity, when. This is the data-integrity backbone (ALCOA+: Attributable, Legible,
Contemporaneous, Original, Accurate, **Complete, Enduring**) that JCI `MOI` and ONA
all lean on, and the cross-cutting contract every later phase honors. **No patient
data**: the log stores actor + action + entity reference + a non-sensitive field
diff, never answer payloads or free-text bodies. Establishes Architecture **Rule 11**.
Full design + rationale in ADR [0028](docs/decisions/0028-accreditation-governance-roadmap.md).
Feature-flagged behind `audit_trail`.
- **Schema** (migration `…120000`): `public.audit_log`
  (`id`, `occurred_at`, `actor_id → profiles` (nullable for system/service-role
  actions), `actor_is_admin` snapshot, `commission_id` (nullable for global/admin
  actions), `action` text (`'<entity>.<verb>'`, e.g. `form_version.published`,
  `member.added`, `case.status_changed`, `meeting.signed`, `signoff.recorded`,
  `response.opened_foreign`), `entity_type`, `entity_id`, `summary` (pt-BR short
  string), `metadata jsonb` (old→new for a curated allow-list of non-sensitive
  columns; NEVER `answers.value` or any `*_md`/free-text body), `seq bigint`
  (per-commission monotone via sequence), `prev_hash`, `row_hash`). **Tamper-evidence:**
  `row_hash = sha256(prev_hash || canonical(seq,occurred_at,actor,action,entity,metadata))`
  forming a per-commission (and a global) hash chain, computed in the DEFINER writer.
  **Append-only:** `app.guard_audit_immutable` BEFORE UPDATE OR DELETE raises (no row
  is ever mutated or removed, even by service role). New SQLSTATE `HC042`
  (append-only violation — internal, never user-facing).
- **Capture mechanism:** a single DEFINER writer `app.audit_write(action, entity_type,
  entity_id, commission, summary, metadata)` (advisory-locked per commission to serialize
  the chain). Writes are driven by **AFTER INSERT/UPDATE/DELETE triggers on a curated set
  of high-value tables** (forms/versions/sections/items, commission_members, responses
  status flips, signoffs, cases + case_phases status, meetings + signatures, interviews,
  controlled docs/CAPA/indicators/evidence as those land) so coverage is **path-independent**
  (catches both RPC and direct-table writes). Service-role paths that bypass RLS (invites)
  call `app.audit_write` explicitly. **Sensitive READS** that the triggers can't see —
  staff_admin opening another member's submitted response, dashboard CSV export, the
  Phase-19 surveyor portal — log via an explicit `app.audit_write(... '.read'/'.export')`
  call in the query/route layer (a defined, finite set; not every read).
- **RLS**: `audit_log` SELECT = `is_admin()` (all rows) **OR** `is_staff_admin_of(commission_id)`
  (their commission's rows only); **no INSERT/UPDATE/DELETE policy for anyone** (writes only
  through the DEFINER writer; the guard trigger backstops UPDATE/DELETE). Plain `staff` and
  `anon` get nothing.
- **RPCs**: `verify_audit_chain(commission?)` **DEFINER** (`is_staff_admin_of`/admin-gated) —
  recomputes the chain and returns the first broken `seq` or OK; `list_audit(commission, filters)`
  is served by an RLS-scoped query (no RPC needed). `audit_trail_enabled()` DEFINER read.
- **UI**: `/c/[slug]/manage/audit` (staff_admin) + `/admin/audit` (admin cross-commission) —
  a read-only, paginated, filterable timeline (actor, action type, entity type, date range),
  reusing the timeline/feed components; CSV export (itself audited); a "verificar integridade"
  control surfacing `verify_audit_chain`. pt-BR, keyboard-accessible, GSAP rise-in.
- **Acceptance**: E2E: a mutation in each instrumented module writes exactly **one** audit
  row with the correct actor/action/entity/summary (publish a form → row; add a member → row;
  submit a response → row; sign a section → row; change a case status → row; sign a meeting →
  row); `audit_log` **rejects UPDATE and DELETE** (direct attempt fails); staff_admin sees only
  their commission's entries, admin sees all, **`staff` cannot reach the audit view** (RLS +
  route gating); a sensitive read (staff_admin opens a foreign submitted response; CSV export)
  produces a `.read`/`.export` row; actor/action/date filters change results; CSV row count
  matches; one keyboard-only pass. pgTAP: append-only enforcement; per-commission RLS scoping;
  **hash-chain integrity** (intact → `verify_audit_chain` OK; a simulated out-of-band row edit →
  reports the broken `seq`); zero anon-readable audit rows; the writer attributes `auth.uid()`
  correctly and falls back to system on a null actor.

### Phase 14 — PDCA / CAPA Closure (Ciclo PDCA & Ações Corretivas/Preventivas)
Turns the platform's existing lightweight action items into a **closed corrective/
preventive loop**: problem → **root-cause analysis** → action plan → **verification of
effectiveness** → closure. This is the "Check/Act" half of PDCA that JCI `QPS` and ONA
Nível 3 require and that the platform cannot demonstrate today. Built on the existing
action-item patterns; the indicator linkage is a **nullable forward hook** wired in
Phase 15 (this phase does NOT hard-depend on indicators). **No patient data** — a CAPA
documents a *process* failure and its remedy. Full design in ADR
[0028](docs/decisions/0028-accreditation-governance-roadmap.md). Feature-flagged behind `capa`.
- **Schema** (migrations `…121000–121002`): `public.capa_plans`
  (`id`, `commission_id`, `code` (per-commission minted number), `title`,
  `description_md`, `classification ∈ {corretiva, preventiva, melhoria}`,
  `status ∈ {aberto → em_analise → em_execucao → em_verificacao → concluido | cancelado}`,
  `source_kind ∈ {case, meeting, indicator, audit, manual}`, nullable
  `source_case_id`/`source_meeting_id`/`source_indicator_id` (the Phase-15 hook)/
  `source_audit_finding_id` (the Phase-18 hook), `opened_by`/`opened_at`,
  `due_date`, `closed_by`/`closed_at`); `public.capa_root_causes`
  (one-or-few per plan; `method ∈ {cinco_porques, ishikawa, livre}`, `structure jsonb`
  — ordered whys for 5-whys, the 6-M category→causes map for Ishikawa — + `narrative_md`);
  `public.capa_actions` (mirrors `case_action_items`: `assignee`, `due_date`,
  `status ∈ {open, in_progress, done, cancelled}`, `completed_at/by`); `public.capa_effectiveness`
  (`verified_by`, `verified_at`, `verdict ∈ {eficaz, parcial, ineficaz}`, `method_md`,
  nullable `indicator_id` + `measured_value` (the loop-closing hook)). State machine +
  content-freeze via `app.guard_capa_status` (session flag `app.in_capa_rpc`, mirror cases/
  meetings); child-lock freezes RCA + actions once terminal. New SQLSTATEs from `HC043`.
- **RPCs** (gate `capa`; invoker unless noted): `create_capa_plan` (mint retry; from a case/
  meeting/manual), `update_capa_plan`, `set_capa_root_cause(method, structure, narrative)`;
  action CRUD `add/update_capa_action` + lifecycle `advance/complete_capa_action`
  (assignee-OR-staff_admin gate → **HC027**-style, reuse `app.advance_action_item_core` shape);
  `record_capa_effectiveness(verdict, method_md, indicator_id?, measured_value?)`;
  `close_capa_plan` — **conclude gate**: rejects unsettled (open/in_progress) actions
  (**HC044**) and requires a recorded effectiveness verdict (**HC045**), else terminal-first
  `concluido`; `cancel_capa_plan` (anytime; HC046 if already terminal); `reopen_capa_plan`
  (`concluido → em_execucao`, **revokes** the effectiveness row — mirror `reopen_meeting`);
  `capa_kpis(commission)` **DEFINER** (`is_staff_admin_of`/admin-gated: open / overdue /
  em_verificacao / eficaz-vs-ineficaz counts). `commission_of_capa(id)` definer helper drives RLS.
- **RLS**: `capa_plans` + 3 child tables member-READ / staff_admin-WRITE (resolve commission via
  `app.commission_of_capa`); an action **assignee** who is plain `staff` moves status only via the
  narrow `advance/complete_capa_action` DEFINER path (no broad UPDATE) — exactly the action-item rule.
- **UI** under the commission area, reusing action-item + case components: `manage/capa/**` — CAPA
  list (filter status/classification/source/overdue), detail page (header + lifecycle controls; an
  **RCA editor** with method picker: 5-whys ordered inputs / Ishikawa 6-category grid / free Markdown;
  actions panel; effectiveness panel). "Abrir plano de ação (CAPA)" entry points from a **case** detail
  and a **meeting** detail (a decision/action item → CAPA, pre-filling `source_*`). CAPA surfaces on the
  case **timeline** (Phase 12) when `source_case_id` is set. The indicator picker in the effectiveness
  panel renders **disabled with a "disponível com Indicadores (Fase 15)" hint** until the flag lands.
- **Acceptance**: E2E: staff_admin opens a CAPA from a case → classifies `corretiva` → records a
  5-whys RCA → adds 2 actions with assignees + due dates → an assignee (plain `staff`) advances then
  completes their action → staff_admin records effectiveness `eficaz` → closes the plan; the board
  reflects each transition. Negative/lifecycle: **close blocked with no effectiveness** → `HC045` pt-BR;
  **close blocked with an open action** → `HC044` pt-BR; **reopen revokes** the effectiveness verdict and
  unfreezes editing; a concluded plan + its RCA + actions **reject edits** (guard); the Ishikawa method
  persists the 6-category structure and 5-whys persists ordered whys; the narrative is sanitized Markdown
  (no raw HTML survives — Rule 7); a non-assignee `staff` cannot advance an action and cannot edit the plan;
  a foreign-commission user gets no read; every CAPA mutation appears in the **audit trail** (Phase-13
  integration assertion). One keyboard-only pass. pgTAP: status-machine + child-lock guards;
  effectiveness-required-to-close; reopen-revokes; assignee-or-staff_admin action gate; RLS scoping; the
  `source_indicator_id` column accepts NULL and the FK is deferred-safe for the Phase-15 wiring.

### Phase 15 — Quality Indicators (Indicadores de Qualidade)
Formal, managed quality indicators with **numerator/denominator definitions, targets,
periodicity, and trend-vs-target** — the heart of ONA Nível 3 and JCI `QPS` data
management, and the payoff of the platform's stable cross-version `question_key` spine.
Indicators can be entered **manually** or **derived** from existing submitted-form
aggregates. Off-target measurements wire the Phase-14 hook: "open a CAPA"; a CAPA's
effectiveness can then cite a later measurement to **close the improvement loop**.
**No patient data** — indicators are aggregate process/quality metrics. Feature-flagged
behind `quality_indicators`.
- **Schema** (migrations `…122000–122001`): `public.indicators`
  (`id`, `commission_id`, `code`, `name`, `description_md`, `kind ∈ {percentual, taxa,
  contagem, tempo_medio}`, `numerator_label`, `denominator_label`, `unit`,
  `direction ∈ {maior_melhor, menor_melhor}`, `target_value numeric`,
  `target_comparator ∈ {>=, <=, =, >, <}`, `lower_warn?`/`upper_warn?` (control/warning band),
  `frequency ∈ {mensal, bimestral, trimestral, semestral, anual}`, `data_source ∈ {manual, derived}`,
  `derived_config jsonb` (`{form_id, numerator: {question_key, option?}, denominator: {...}}` when
  derived), `status ∈ {ativo, arquivado}`); `public.indicator_measurements`
  (`id`, `indicator_id`, `period_label` (e.g. `'2026-06'`), `period_start`/`period_end`,
  `numerator numeric`, `denominator numeric`, `value numeric`, `source ∈ {manual, derived}`,
  `entered_by`/`entered_at`, `note`, `unique(indicator_id, period_label)`). Measurements are
  **editable by staff_admin but every change is audited** (Phase 13) — corrections are
  contemporaneous + attributable rather than silently overwritten. New SQLSTATEs from `HC047`.
- **RPCs** (gate `quality_indicators`): indicator CRUD `create/update/archive_indicator`,
  `set_indicator_target`; `record_indicator_measurement(indicator, period, num, den, note)`
  (computes `value`; off-target detection); `compute_derived_measurement(indicator, period)`
  **DEFINER** — reads the submitted-only aggregate via the **existing Phase-8 spine**
  (`app.submitted_form_responses` + the `dashboard_distributions` logic) so a derived value
  **equals** the dashboard for the same window; `indicator_series(indicator, from?, to?)`
  **DEFINER** (trend points + the target line); `indicator_kpis(commission)` **DEFINER**
  (`is_staff_admin_of`/admin: na-meta / fora-da-meta / sem-dados counts).
- **RLS**: `indicators` + `indicator_measurements` member-READ / staff_admin-WRITE, commission-scoped.
- **UI**: `manage/indicators/**` — indicator builder (definition, target/comparator, frequency,
  data source: manual entry vs derived-from-a-form's-`question_key`), measurement entry grid, and an
  indicator detail with a **run chart / trend-vs-target** (Recharts) + warning bands + a status chip
  (`na meta` / `fora da meta` / `sem dados`). An off-target measurement surfaces **"Abrir plano de ação
  (CAPA)"** pre-linking `source_indicator_id` (Phase 14). An **Indicadores** panel on
  `/c/[slug]/dashboard` shows the commission's indicator scorecard.
- **Acceptance**: E2E: a **manual** indicator (target ≥ 90%) with monthly measurements renders a trend
  whose on/off-target classification matches the seeded numbers **exactly** (assert values, not just
  rendering); a **derived** indicator bound to a form's `question_key` → `compute_derived_measurement`
  equals the Phase-8 dashboard aggregate for that period (assert equality); an off-target measurement
  exposes "Abrir CAPA" and the created CAPA carries `source_indicator_id`; a CAPA effectiveness row can
  cite the indicator + a later (improved) measurement — the **loop closes end-to-end across Phases 14+15**;
  editing a measurement writes an audit row (Phase 13); `staff` cannot edit indicators; a foreign-commission
  user gets no read; one keyboard-only pass. pgTAP: derived-compute equals the canonical aggregate; RLS
  scoping; off-target detection across both `direction` values; KPI counts; the CAPA `source_indicator_id`
  FK resolves.

### Phase 16 — Standards Crosswalk & Readiness/Gap Engine (Mapa de Padrões & Prontidão)
The **strategic differentiator**: make the platform *aware of accreditation standards* and
let a commission **link the artifacts it already produces** — published forms, meetings,
cases, indicators, CAPA plans, controlled documents — as **evidence** against a specific
standard, then compute a **readiness / gap report** ("for standard X: evidence present /
partial / missing"). This is what turns "we run committees" into "we are prepared for the
survey" and directly serves *facilitating accreditation for hospitals that don't yet have it*.
Frameworks are admin-curated reference packs (ONA + a JCI chapter skeleton seeded);
hospitals may add custom frameworks. **No patient data.** Feature-flagged behind `accreditation`.
- **Schema** (migrations `…123000–123001`): `public.accreditation_frameworks`
  (`id`, `key` (`'ona'`/`'jci'`/custom), `name`, `version`, `description`, `owner_commission_id`
  nullable (NULL = global/admin-curated), `status ∈ {ativo, arquivado}`);
  `public.accreditation_standards` (`id`, `framework_id`, `parent_id` (self-ref hierarchy:
  capítulo → padrão → elemento de mensuração), `code` (e.g. `QPS.1`), `title`, `description_md`,
  `position`); `public.evidence_links` (`id`, `commission_id`, `standard_id`,
  `artifact_kind ∈ {form, form_version, meeting, case, indicator, capa_plan, controlled_document,
  action_item}`, `artifact_id`, `note`, `linked_by`/`linked_at`,
  `unique(commission_id, standard_id, artifact_kind, artifact_id)`);
  `public.standard_assessments` (`id`, `commission_id`, `standard_id`,
  `status ∈ {conforme, parcial, nao_conforme, nao_aplicavel}`, `assessed_by`/`assessed_at`,
  `note_md`, `unique(commission_id, standard_id)`). New SQLSTATEs from `HC049`.
- **RPCs** (gate `accreditation`): framework + standard admin CRUD (`is_admin`-gated for global packs;
  `is_staff_admin_of` for a commission's custom framework) + seed packs; `link_evidence` / `unlink_evidence`
  + `set_standard_assessment` (staff_admin); `readiness_report(commission, framework)` **DEFINER**
  (per-standard evidence count + assessment + chapter rollup + overall %); `hospital_readiness(framework)`
  **DEFINER** (`is_admin`: cross-commission rollup = hospital readiness). An `app.artifact_belongs_to_commission`
  guard rejects linking a foreign artifact.
- **RLS**: `accreditation_frameworks` + `accreditation_standards` SELECT to any authenticated user
  (reference data); `evidence_links` + `standard_assessments` member-READ / staff_admin-WRITE,
  commission-scoped.
- **UI**: `manage/accreditation/**` — pick a framework → standards **tree** with status chips
  (conforme/parcial/não-conforme/N.A.) + evidence count; a per-standard panel to **assess** status and
  **link evidence** via an artifact picker that searches the commission's forms/meetings/cases/indicators/
  CAPA/documents; a **readiness dashboard** (rollup gauges per chapter + a **gap list** of standards with
  no evidence or `nao_conforme`). `/admin/accreditation` — hospital-wide readiness across commissions.
- **Acceptance**: E2E: a seeded framework (ONA + a JCI skeleton) renders as a tree; linking a published
  form + a meeting + an indicator to a standard marks it evidenced and removes it from the gap list;
  assessing a standard `nao_conforme` puts it in the gap list and the rollup % reflects it (assert the
  computed value); the admin hospital-wide view aggregates two commissions' readiness correctly; an
  attempt to link a **foreign-commission artifact** is rejected; `staff` cannot edit; evidence links are
  audited (Phase 13); one keyboard-only pass. pgTAP: evidence-link uniqueness + foreign-artifact rejection;
  RLS scoping; readiness + hospital rollup correctness.

### Phase 17 — Controlled-Document Lifecycle (Gestão de Documentos Controlados)
Policy/procedure documents (políticas, POPs, protocolos, regimentos, manuais) under a
**controlled-document lifecycle**: named-approver workflow, effective/expiry dates, a
**scheduled review cycle**, and a controlled-document register — the core of JCI `MOI`
document control. Reuses the immutable-storage pattern (`form-assets`/`case-documents`)
and the meetings e-signature primitive for approvals. Form publishing is extended with
the same approver + review-due metadata (a published form IS a controlled document).
**No patient data.** Feature-flagged behind `controlled_docs`.
- **Schema** (migrations `…124000–124002`): `public.controlled_documents`
  (`id`, `commission_id`, `code`, `title`, `doc_type ∈ {politica, pop, protocolo, regimento,
  manual, outro}`, `status ∈ {rascunho → em_aprovacao → vigente → em_revisao → obsoleto}`,
  `current_version_id`); `public.controlled_document_versions` (`id`, `document_id`,
  `version_number`, `storage_path` (immutable, new path per upload — Rule 6),
  `summary_of_changes`, `effective_date`, `review_due_date`, `expiry_date?`, `status`);
  `public.document_approvals` (`id`, `document_version_id`, `approver_id`, `approver_title`,
  `decision ∈ {aprovado, rejeitado}`, `decided_at`, `note`, `signature_hash` — sha256 of the
  object + decision, mirroring `meeting_signatures.content_hash`). Additive on `form_versions`:
  `approved_by`, `approved_at`, `review_due_date`, `effective_date`. State machine via
  `app.guard_controlled_document_status`. New SQLSTATEs from `HC051`.
- **RPCs** (gate `controlled_docs`): document CRUD + `add_document_version` (immutable upload),
  `submit_document_for_approval`, `approve_document` / `reject_document` (sign-own-approval, computes
  `signature_hash`; mirror `app.can_sign_meeting`), `publish_document` (`→ vigente`, sets effective +
  review-due), `supersede_document` (new version replaces, prior → obsolete-but-retained),
  `mark_document_obsolete`; `documents_due_for_review(commission)` **DEFINER**. Form publish gains an
  approver + review-due capture.
- **RLS**: documents + versions member-READ / staff_admin-WRITE; approvers **sign their own approval row**
  (no broad write); new immutable `controlled-documents` Storage bucket (members read, staff_admin INSERT,
  NO update/delete; path `{commission_id}/{document_id}/{uuid}.{ext}`; signed-URL reads).
- **UI**: `manage/documents/**` — controlled-document **register** (filter type/status/review-due), a
  detail page (versions, approvals, effective/expiry, download), an **approval queue** ("pendentes de
  aprovação"), and a **review-due list** (drives Phase-20 reminders). The publish-form flow gains
  approver + review-due fields.
- **Acceptance**: E2E: full lifecycle — draft → submit-for-approval → a **named approver e-signs**
  (`aprovado`) → publish (`vigente`, effective date set) → a new version **supersedes** it (prior version
  retained but flagged obsolete) → a past-due `review_due_date` surfaces the doc in the review-due list;
  approval **requires** a named approver signature (unsigned publish rejected); the storage object gets a
  **new path per version** (immutability, Rule 6) and the old version still downloads; documents are
  audited (Phase 13); a foreign-commission user gets no read; one keyboard-only pass. pgTAP: status-machine
  guard; sign-own-approval RLS; immutable-storage (no update/delete); review-due computation; review-due +
  approver metadata on `form_versions`.

### Phase 18 — Self-Assessment, Internal Audit & Mock Tracer (Autoavaliação & Auditoria Interna)
**Scored** internal-audit checklists mapped to accreditation standards (Phase 16), with
audit scheduling, a per-round auditor assignment, and a weighted conformity score —
supporting mock-tracer rounds and gap closure. A non-conforming finding opens a CAPA
(Phase 14) and updates the standard's assessment (Phase 16), wiring the
measure → improve → re-assess loop. **No patient data.** Feature-flagged behind `internal_audit`.
- **Schema** (migrations `…125000–125001`): `public.audit_rounds`
  (`id`, `commission_id`, nullable `framework_id`, `title`, `round_type ∈ {autoavaliacao,
  auditoria_interna, tracer}`, `scheduled_for`, `status ∈ {agendada → em_andamento → concluida |
  cancelada}`, `auditor_id` (any assigned member — **per-round assignment, not a new global role**;
  a true `auditor` role is a deferred ADR option), `score numeric` snapshot on conclude);
  `public.audit_findings` (`id`, `round_id`, nullable `standard_id`, `item` text,
  `result ∈ {conforme, parcial, nao_conforme, nao_aplicavel}`, `weight numeric`, `evidence_note_md`,
  nullable `capa_plan_id` (Phase-14 link)). Weighted score = `Σ(result_factor × weight)` over
  applicable findings. State machine via `app.guard_audit_round_status`. New SQLSTATEs from `HC053`.
- **RPCs** (gate `internal_audit`): round CRUD + `schedule_audit_round`, finding CRUD,
  `conclude_audit_round` (snapshots `score`, freezes findings), `link_finding_to_capa(finding)`
  (creates/links a CAPA with `source_audit_finding_id`), `sync_finding_to_standard(finding)`
  (writes the Phase-16 `standard_assessment`). `audit_round_score(round)` is computed.
- **RLS**: rounds + findings member-READ; WRITE = staff_admin **OR** the round's assigned `auditor_id`
  (a narrow per-round grant, mirror the interview participant-write shape via a definer predicate).
- **UI**: `manage/audits/**` — schedule rounds, **conduct** a round (a checklist of items, each scored
  conforme/parcial/não-conforme/N.A. with weight + evidence note; a standard picker per item), a live
  **score rollup**, and "abrir CAPA" on a non-conforme finding. A mock-tracer is a `round_type`.
- **Acceptance**: E2E: schedule a round → assign an auditor → conduct (score items) → the weighted score
  computes correctly (assert the value) → a `nao_conforme` finding **opens a CAPA** (`source_audit_finding_id`
  set) and **flags the standard** `nao_conforme` (Phase-16 assessment updated) → conclude snapshots the
  score and freezes findings; the assigned auditor (plain `staff`) can score their round, a non-assigned
  `staff` cannot; rounds are audited (Phase 13); a foreign-commission user gets no read; one keyboard-only
  pass. pgTAP: status-machine + freeze-on-conclude; per-round auditor write grant; weighted-score
  correctness across all four results; finding→CAPA + finding→standard links.

### Phase 19 — Surveyor Access & Evidence Export (Acesso de Auditor Externo & Pacote de Evidências)
A **time-boxed, scoped, read-only external-surveyor** access path and a curated
**evidence-export bundle** — so an accreditation surveyor can review readiness + linked
evidence without a full account and without any write path, with **every access audited**.
This is the most security-sensitive phase in the track and requires a **full plan review**
(new external-access shape). **No patient data** ever crosses the boundary. Feature-flagged
behind `surveyor_access`.
- **Schema** (migration `…126000`): `public.surveyor_grants`
  (`id`, `commission_id` (or NULL = admin/hospital-wide), `grantee_name`, `grantee_email`,
  `scope jsonb` (`{framework_ids, commission_ids, from, to}`), `token_hash` (a hashed,
  single-use-mintable opaque token — never stored in clear), `expires_at`, `created_by`/`created_at`,
  `revoked_at`/`revoked_by`, `last_accessed_at`). New SQLSTATEs from `HC055`.
- **RPCs / routes**: `create_surveyor_grant` / `revoke_surveyor_grant` (staff_admin/admin); a **read-only
  surveyor portal** at a separate route group (`/survey/[token]`) served by `SECURITY DEFINER`
  scope-checked reads (readiness report + the standards tree + linked-evidence summaries — **answer-free,
  download-by-signed-URL only where a document is explicitly linked as evidence**); **every portal view
  and every export emits an audit `.read`/`.export` row** (Phase 13). An evidence-export bundle route
  (server, grant-scoped or staff_admin cookie) renders a readiness package (PDF/zip) per framework.
- **RLS / security**: a surveyor grant unlocks ONLY the DEFINER scope-checked reads — **no table write path,
  no PostgREST table access**; the token is validated server-side, expiry + revocation enforced on every
  request; out-of-scope frameworks/commissions/date-ranges are invisible. The platform's own users are
  unaffected. This phase gets a dedicated **security/RLS review** at the QA gate.
- **UI**: `manage/accreditation/survey` (staff_admin) + `/admin/accreditation/survey` (admin) — create /
  list / revoke grants, copy the access link; the minimal, branded, read-only **surveyor portal**; the
  evidence-export action.
- **Acceptance**: E2E: create a time-boxed grant → open the surveyor portal via the link → see ONLY the
  granted scope, **read-only** (no mutation control reachable; direct write attempts blocked) → access
  **expires** after the window and is **killed by revoke**; every portal view + export writes an audit row;
  the export bundle's contents match the readiness report; an out-of-scope framework/commission is not
  visible through the portal by any path; the regular app's RLS is unchanged for normal users; one
  keyboard-only pass. pgTAP / security: token expiry + revocation enforcement; scope confinement (no
  cross-commission / cross-framework leakage); **zero write capability** from a grant; no answer payloads
  in any surveyor read.

### Phase 20 — Notifications & Escalation (Notificações & Escalonamento)
Email + an in-app **notification center** + scheduled **reminders/escalation**, replacing
the v1 "in-app pending queue only" posture. Timely follow-through is what accreditation
follow-up depends on, and the track has accumulated several due/overdue signals worth
surfacing: pending sign-offs, pending meeting signatures, **overdue CAPA actions**, CAPA
effectiveness due, **document review-due**, **indicator measurement-due**, scheduled audit
rounds. Reuses the Phase-3 Mailpit test harness. **No patient data** in any notification
body. Feature-flagged behind `notifications`.
- **Schema** (migration `…127000`): `public.notifications`
  (`id`, `user_id`, `kind`, `commission_id`, `entity_type`/`entity_id`, `title`, `body`
  (pt-BR, no sensitive content), `read_at`, `created_at`); `public.notification_preferences`
  (`user_id`, `commission_id`, per-channel/per-kind opt-in). New SQLSTATEs from `HC057` (if any).
- **RPCs / jobs**: `mark_notification_read` / `mark_all_read` / `set_notification_preferences`
  (own-row only); `compute_due_notifications()` **DEFINER** batch — scans CAPA actions/effectiveness,
  controlled-document review dates, indicator measurement periodicity, audit-round schedules, sign-off /
  signature queues, and enqueues notifications + email payloads; invoked by **`pg_cron`** (or an external
  cron hitting a server route). A server-only **email sender** route (SMTP/Supabase, service-role,
  `import 'server-only'`) — provider-abstracted, mirror the invite path. **Escalation:** an item still
  unactioned after N days notifies the staff_admin (configurable threshold).
- **RLS**: `notifications` + `notification_preferences` are **own-row only** (`user_id = auth.uid()`).
- **UI**: a notification **bell + center** in the app shell (per-user, unread badge), a per-user
  **preferences** page; due/overdue states surfaced inline on the CAPA / documents / indicators lists.
- **Acceptance**: E2E (Mailpit-intercepted, reuse Phase-3): an **overdue CAPA action** generates an in-app
  notification **and** an email; mark-read clears the badge; **preferences are respected** (a disabled kind
  produces neither channel); **escalation** fires to the staff_admin after the threshold; a user sees ONLY
  their own notifications; the cron batch is idempotent (no duplicate notification for the same due event);
  one keyboard-only pass. pgTAP: own-row RLS; `compute_due_notifications` selects exactly the due/overdue
  set across each source; idempotency guard; escalation threshold.

### Phase 21 — Committee Charters & Meeting Cadence (Regimentos & Periodicidade de Reuniões)
Each commission carries a **charter (regimento)** — purpose, scope, authority, membership,
and a **required meeting frequency** — and the platform **tracks adherence to that cadence**
(e.g. CCIH must meet monthly) and **carries forward** unresolved agenda items + open action
items into the next meeting. JCI `GLD` expects every committee to have a defined charter and
to meet on schedule; this closes that governance gap and ties the track back to the Meetings
module. The charter is itself a **controlled document** (Phase 17, `doc_type='regimento'`).
**No patient data.** Feature-flagged behind `charters`.
- **Schema** (migration `…128000`): `public.commission_charters`
  (`commission_id` PK, `purpose_md`, `scope_md`, `authority_md`, `membership_md`,
  `meeting_frequency ∈ {semanal, quinzenal, mensal, bimestral, trimestral}`,
  `effective_date`, `review_due_date`, nullable `controlled_document_id` → the regimento doc).
  (Quorum already lives in `commission_meeting_settings`.) Cadence adherence is **computed** from
  `meetings` history vs `meeting_frequency`. New SQLSTATEs from `HC058` (if any).
- **RPCs** (gate `charters`): `upsert_commission_charter` (staff_admin); `meeting_cadence_status(commission)`
  **DEFINER** (compliant / em atraso vs the last `realizada` meeting + frequency); agenda **carry-forward**
  — `suggest_carry_forward(commission)` pulls open `meeting_action_items` + deferred agenda items for the
  next `create_meeting`.
- **RLS**: `commission_charters` member-READ / staff_admin-WRITE.
- **UI**: `manage/charter` (or under `manage/documents`) — the charter editor (sanitized Markdown) + a
  frequency setting; a **cadence indicator** on the meetings list ("em dia" / "reunião em atraso"); a
  **carry-forward** suggestion step in the schedule-meeting flow.
- **Acceptance**: E2E: define a charter with a **monthly** cadence → the cadence indicator reads compliant
  vs a recent meeting and **em atraso** when the last meeting predates the window (assert against seeded
  meeting dates); scheduling a new meeting **auto-suggests** carried-forward open action items + deferred
  agenda items; the charter renders as a controlled document with a review-due date (Phase 17); charter
  edits are audited (Phase 13); a foreign-commission user gets no read; one keyboard-only pass. pgTAP:
  cadence computation across frequencies; carry-forward selection; RLS scoping; charter↔controlled-document
  link.
