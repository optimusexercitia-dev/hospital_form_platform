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
