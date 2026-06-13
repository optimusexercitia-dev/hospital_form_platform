# backend-state.md — Living Backend Capability Map

> **Purpose.** A durable, terse map of what the backend already provides, so the lead
> references it at phase start instead of re-deriving ~50 lines of "lead notes" each
> phase. The **lead keeps this current** at the §6 Record step (CLAUDE.md §7): when a
> phase adds an RPC, flips a flag, or changes an RLS surface, update the relevant table
> here. This is a map, not the authority — `ARCHITECTURE.md` is the spec and the
> migrations are the truth. Last updated: **2026-06-13 (Phase 6 complete; commit `94566f2`).**

## Migrations (forward-only, additive)

| Range | Phase | What landed |
| ----- | ----- | ----------- |
| `…100001–100003` | 1 | Core schema: profiles trigger, commissions, members, forms, versions, sections, items; admin claim (access-token hook, ADR 0002). |
| `…100004` | 1 | Response lifecycle: responses, answers, signoffs; published + submitted immutability triggers; display-item answer-rejection trigger. |
| `…100005` | 1 | Condition evaluator + `submit_response` + publish validation. Sign-off check feature-flagged OFF (ADR 0004). |
| `…100006–100007` | 1 | Full RLS policy set + helpers; `form-assets` Storage bucket policies. Deny-by-default. |
| `…100008` | 1 | QA loop-back RLS hardening (staff_admin UPDATE role-restricted; `eval_condition` search_path pinned; profiles no-delete; version↔commission guard). |
| `…100009` | 3 | Denormalized `profiles.email` (citext, nullable) + sync triggers (ADR 0010). |
| `…100010` | 4 | Builder RPCs + deferrable position uniques (ADR 0011); repaired `form_versions` insert RLS (ADR 0013). |
| `…100011` | 5 | Response-fill RPCs (ADR 0015). |
| `…090001–090003` | 6 | Sign-off: flag flip + cross-version guard (P0013); sign-off RPCs; definer read path (ADR 0016). |

## RPC inventory

All `security invoker` unless marked **DEFINER**. Invoker RPCs rely on RLS as the
authority; definer RPCs are narrow, internally gated exceptions (documented in an ADR).

| RPC | Mode | Purpose / notes |
| --- | ---- | --------------- |
| `submit_response(response)` | invoker | **The submission authority.** Visibility eval from saved answers, required-answer check, sign-off check (gated by `signoff_enforcement` flag), stray-answer cleanup, atomic flip → submitted. |
| `publish_form_version(version)` | invoker | Runs `validate_visible_when`, archives prior published, flips to published. |
| `validate_visible_when(version)` | invoker | Publish-time condition structural validation (referenced key exists, earlier section only, not on first section). |
| `create_form(...)` | invoker | Form + v1 draft + default section, atomic. |
| `clone_form_version(source)` | invoker | Copy sections+items, preserve `question_key`/`visible_when`/sign-off/`storage_path`, remap ids. Returns existing draft if one exists (ADR 0012). |
| `reorder_section` / `reorder_item` | invoker | Single-statement CASE swap against deferrable uniques (ADR 0011). |
| `delete_section_moving_items(section, target?)` | invoker | Atomic "move items to target then delete source". |
| `save_section_answers(response, section, answers, clear_item_ids)` | invoker | Atomic section upsert + `last_section_id` + `updated_at`; `clear_item_ids` = orphan-clear; cross-version item guard → **P0013**. |
| `start_or_resume_response(version)` | invoker | Resume existing in_progress or create; `unique_violation`-catch race; published-only backstop. |
| `sign_section(response, section, note)` | invoker | Backs BOTH respondent (wizard) and staff_admin (queue) sign. RLS `signoffs_insert` enforces signer-role; RPC adds visibility + in_progress precondition. Unique-race → **P0015**. |
| `list_signoff_queue(commission)` | **DEFINER** | `is_staff_admin_of`-gated; predicate = visible + unsigned + `staff_admin`-role + submit-ready (`app.response_required_complete`). ADR 0016. |
| `get_response_for_signoff(response)` | **DEFINER** | Narrow read of one in_progress response with a pending staff_admin sign-off. Does NOT broaden `responses_select` (preserves Phase-7 invariant). ADR 0016. |

## Helper functions

- `is_member_of(commission)` / `is_staff_admin_of(commission)` — `security definer`,
  used throughout RLS.
- `app.is_admin()` — from the verified JWT claim, DB fallback as defense-in-depth.
- `app.eval_condition(...)` — the **SQL** condition evaluator. Mirrored in TypeScript by
  `evalCondition` in `src/lib/queries/conditions.ts`; the shared vector file
  `src/lib/queries/__fixtures__/condition-vectors.json` keeps them in agreement.
  **Drift is phase-blocking.**
- `app.answer_map(response)` — answers keyed for evaluation.
- `app.response_required_complete(response)` — submit-readiness (used by the queue).
- `app.can_sign_section` / `app.can_read_signoff` — definer predicates (090003) that
  do response fact-finding for the sign-off path without RLS-filtering the parent row;
  signer-role rules unchanged.
- `app.feature_enabled(name)` — reads `app.feature_flags`.

## Feature flags (`app.feature_flags`)

| Flag | State | Notes |
| ---- | ----- | ----- |
| `signoff_enforcement` | **ON** (Phase 6, migration `…090001`) | `submit_response` blocks submission until every VISIBLE `requires_signoff` section is signed → **P0012**. Was OFF in Phases 1–5 (ADR 0004). |

## RLS authorization surface (who can do what)

- **Builder mutation surface** — `forms`, `form_versions`, `form_sections`,
  `form_items` grant ALL to `staff_admin` of the commission + admin. Published
  immutability is **trigger-enforced**, not RLS. Draft edits need no new RLS.
- **Responses/answers** — creator alone reads/edits their `in_progress` response +
  answers. One draft per (version, user) via `responses_one_draft_per_user_idx`.
  Submitted responses/answers/signoffs are immutable (triggers). **Staff_admins
  deliberately CANNOT read another member's in_progress answers** via general RLS —
  the Phase-7 invariant; the sign-off queue/review uses the DEFINER RPCs above instead.
- **Sign-offs** — `signoffs_insert` enforces the signer-role rule in the DB
  (respondent → `created_by`; staff_admin → `is_staff_admin_of`, `signed_by =
  auth.uid()`, in_progress only). `signoffs_select` lets creator/admin/staff_admin read.
- **Storage** (`form-assets`) — members read, staff_admin upload; no UPDATE/DELETE
  (immutable paths). Service role never used on the display/upload path.

## SQLSTATE → meaning (data-layer maps these to pt-BR; no raw PG errors reach the UI)

| Code | Meaning | Example pt-BR mapping |
| ---- | ------- | --------------------- |
| `P0002` | not found | "Resposta não encontrada." |
| `P0010` | already submitted | "Resposta já enviada." |
| `P0011` | required answer missing | "Há perguntas obrigatórias sem resposta." |
| `P0012` | sign-off pending | "Há seções pendentes de assinatura." |
| `P0013` | invalid cross-version item | "Dados inválidos para este formulário." |
| `P0014` | section not available / not visible | "Seção não disponível para assinatura." |
| `P0015` | already signed (unique race) | "Seção já assinada." |
| `23514` | check violation | "Publique um rascunho." / "já enviada." (context) |
| `23505` | unique violation | (resume race; question_key collision retry) |
| `42501` | RLS denied | forbidden (e.g. wrong signer role) |

## Data-access & action modules (Rule 9 — no inline supabase-js in UI)

- Queries: `src/lib/queries/{session,commissions,members,forms,responses,signoffs}.ts`
  + the canonical helpers `answerableItems(tree)` and the submitted-responses filter.
- Actions: `src/lib/{auth,admin,members,forms,responses}/actions.ts` — `ActionState`
  shape, server-side authz re-check before write, pt-BR mapping.
- Service-role client: `src/lib/supabase/admin.ts` (`import 'server-only'`), invite path only.

## ADR index (decisions that shape the backend)

0002 admin claim hook · 0003 pgTAP · 0004 sign-off flag · 0005 visible_when shape ·
0009 JWT local verification (prod needs asymmetric keys) · 0010 email denorm ·
0011 reorder · 0012 clone-returns-existing-draft · 0013 form_versions insert RLS ·
0015 response-fill RPCs · 0016 sign-off definer read path.
