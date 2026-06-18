# Phase 13 — Audit Trail: QA Review

**Date:** 2026-06-18
**Reviewer:** qa (QA Reviewer)
**Verdict:** APPROVED

---

## Verdict summary

All acceptance criteria are met. The core security properties — append-only DB enforcement
(absolute, fires even for `service_role`), SELECT-only RLS with zero anon/PUBLIC access,
hash chain covering every semantic column, and per-table allow-lists that provably exclude
answer payloads / `*_md` / free-text bodies / PHI — are correctly implemented and
independently verified at both the pgTAP and E2E layers. No blocker, no major. One cosmetic
MINOR (a minor pt-BR phrasing mismatch between the DB guard message and the TS constant
on an unreachable code path) was resolved pre-record by the backend engineer.

Evidence base: pgTAP 374/374 green (incl. `supabase/tests/130_audit.sql` 25/25); full E2E
195/195 green (incl. `e2e/phase13-audit.spec.ts` 26 ACs). Review is code-only per the
constraint (no DB execution performed).

---

## Checklist

### 1. Requirements — acceptance criteria

**AC-1: One audit row per instrumented mutation with correct actor/action/entity/summary.**

All 6 named mutations are covered by AFTER triggers in
`supabase/migrations/20260617120001_audit_triggers.sql`. Coverage is path-independent:
the trigger fires for both RPC writes and direct-table writes (the ADR 0029 rationale for
trigger-based over RPC-only capture).

- **`form_version.published`** — `audit_form_versions_trg` on `form_versions` UPDATE, emits
  `form_version.published` when `new.status = 'published'`, entity type `form_version`, entity
  id = version id, metadata allow-list `['status', 'version_number', 'published_at']`.
- **`commission_member.added`** — `audit_commission_members_trg` on `commission_members`
  INSERT, emits `commission_member.added`, metadata allow-list `['role', 'user_id']`. This
  trigger also catches the service-role invite upsert path (the path that bypasses RLS), so
  no explicit `audit_write` call is needed there.
- **`response.submitted`** — `audit_responses_trg` on `responses` UPDATE, emits
  `response.submitted` ONLY when `new.status = 'submitted'`. Metadata allow-list:
  `array['status']` — the explicit no-answer-payload guarantee. The trigger does not fire on
  INSERT or DELETE.
- **`signoff.recorded`** — `audit_signoffs_trg` on `response_section_signoffs` INSERT, emits
  `signoff.recorded`, metadata allow-list `['section_id', 'signed_by']` — explicitly excludes
  `note` (free text).
- **`case.status_changed`** — `audit_cases_trg` on `cases` UPDATE where status changes,
  emits `case.status_changed`, metadata allow-list `['status', 'outcome_id']` — excludes
  `label` (noted in comments).
- **`meeting.signed`** — `audit_meeting_signatures_trg` on `meeting_signatures` INSERT where
  `status = 'signed'` or UPDATE flipping to `signed`, emits `meeting.signed`, metadata
  allow-list `['attendee_id', 'signer_id', 'status']` — explicitly excludes `content_hash`,
  `note`, `provider_payload`, `ip_address`, `user_agent`.

All triggers are AFTER, SECURITY DEFINER, `set search_path = app, public, pg_catalog`.
E2E AC-1a through AC-1f drive each mutation through the real RPC/table-write under a real
JWT (fresh throwaway probe users per test, never seeded personas — the P13-004/005/006
isolation fix) and assert exactly one new row attributed to the correct actor.

**AC-2: `audit_log` rejects UPDATE and DELETE.**

`app.guard_audit_immutable_trg` is a BEFORE UPDATE OR DELETE trigger on `audit_log`. The
function body raises `HC042` unconditionally — there is no conditional bypass, no flag, no
escape hatch. This differs from some other guards in the codebase (e.g. meeting guards that
allow a specific-RPC path through): the audit guard has no legitimate UPDATE/DELETE path
anywhere, so none is provided. The `commission_id` FK is `ON DELETE NO ACTION` (enforced
and documented per ADR 0029 Q5), so a commission hard-delete cannot cascade into `audit_log`
via a trigger-driven DELETE. pgTAP tests 8–10 verify UPDATE and DELETE are rejected with
`HC042` under both the table owner and `service_role`. E2E AC-2a/2b verify the service-role
REST path returns HTTP 400 with `code: 'HC042'` and the row is unchanged.

**AC-3: RLS scoping — staff_admin sees only their commission; admin sees all; staff/anon
see nothing; staff cannot reach the audit view.**

The only policy on `audit_log` (`audit_log_select`) is:
`using (app.is_admin() or app.is_staff_admin_of(commission_id))`.
No INSERT/UPDATE/DELETE policy is created on the table — deny-by-default for all writes.
Global-chain rows (`commission_id IS NULL`) are admin-only by construction:
`is_staff_admin_of(NULL)` returns false, so they are invisible to a staff_admin.

Route gating: `/c/[slug]/manage/audit/page.tsx` checks
`access.role !== 'staff_admin' && !access.context.isAdmin` and calls `notFound()` before
serving content. `/admin/audit/page.tsx` re-derives `context.isAdmin` and calls `notFound()`
for non-admins (the admin layout already enforces this, but the page re-checks defensively).
RLS remains the ultimate boundary; the route gate is the friendly in-shell 404.

E2E AC-3a: staff_admin A reads zero commission-B rows at the JWT level (PostgREST assertion);
entity_ids from commission-B entities do not appear in the visible set. AC-3b: admin reads
rows from both commissions. AC-3c: plain staff reads zero rows. AC-3d: staff_admin UI feed
renders with rows (commission scoped). AC-3e: plain staff gets a 404 (route guard), not the
audit feed. AC-3f: admin cross-commission view at `/admin/audit?commission={B}` renders
commission-B rows with the commission name column.

**AC-4: A sensitive read (foreign submitted response; CSV export) produces a `.read`/`.export`
row; self-read produces nothing.**

Three explicit call sites in the query/route layer log via `public.log_audit_access` (the
thin DEFINER wrapper in `supabase/migrations/20260617120004_audit_read_rpc.sql`):

1. `src/lib/queries/submissions.ts:309` — `getSubmissionDetail` calls
   `logAuditAccess({ action: 'response.opened_foreign', ... })` only when
   `response.status === 'submitted'` AND `session.userId !== response.created_by`. A
   foreign in_progress response is unreachable by RLS (returns `null` before this point),
   so the guard is belt-and-suspenders. Best-effort: never blocks the read.
2. `src/app/c/[slug]/dashboard/export/route.ts:73` — calls
   `logAuditAccess({ action: 'response.exported', ... })` after the CSV is assembled.
3. `src/app/c/[slug]/manage/audit/export/route.ts:87` — calls
   `logAuditAccess({ action: 'audit.exported', ... })` after the audit CSV is assembled.

`public.log_audit_access` accepts ONLY the three actions `response.opened_foreign`,
`response.exported`, `audit.exported` via a positive allow-list check (`p_action not in
(...)`), raising `check_violation` for anything else — it cannot be abused to forge a
mutation audit row. Attribution is automatic (DEFINER preserves `auth.uid()`).
`src/lib/audit/access.ts` carries `import 'server-only'` (line 1) so it cannot be imported
from a Client Component. The `AuditAccessAction` TypeScript union type is compile-time
constrained to the same three verbs.

E2E AC-4a: opening a foreign submitted response writes `response.opened_foreign` with the
correct entity_id and commission_id, no answer payload in metadata. AC-4b: opening own
submission writes no row. AC-4c: dashboard CSV export writes `response.exported`. AC-4d:
audit CSV export writes `audit.exported`.

**AC-5: Filters (actor, action type, entity type, date range) change results.**

`listAudit` in `src/lib/queries/audit.ts` applies PostgREST-level filters (`.eq`/`.gte`/
`.lte`) for `actor_id`, `action`, `entity_type`, `from`/`to` (on `occurred_at`). Filters
are URL-driven (`?actor=&action=&entity=&from=&to=`); the Server Component page re-queries
on each navigation. Pagination resets to page 1 on any filter change (the client filter bar
deletes the `page` param before pushing). E2E AC-5a–5d verify entity-type, action, actor,
and date-range filters each narrow the rendered feed correctly.

**AC-6: CSV row count matches the filtered audit list.**

The audit export route (`/c/[slug]/manage/audit/export/route.ts`) uses the same `listAudit`
query with a raised `EXPORT_PAGE_SIZE = 5000` cap (capturing the full filtered set in a
single page rather than the UI's 25-row page). The commission scope and filters are
identical to the on-screen list. E2E AC-6 reads the DB row count under the same JWT and
filters (PostgREST), downloads the CSV, parses it, and asserts `dataRows.length ===
expectedCount` (data rows excluding the header).

**AC-7: Integrity check — intact chain → OK; simulated out-of-band edit → reports broken seq.**

`public.verify_audit_chain(p_commission uuid default null)` is a SECURITY DEFINER, STABLE
function. It recomputes the hash chain using `app.audit_canonical` byte-identically to the
write path, then compares each row's stored `row_hash` and `prev_hash` link. Authorization:
commission-scoped call requires `is_staff_admin_of(p_commission) or is_admin()`; null call
(admin sweep across all chains) requires `is_admin()`. Returns `(ok boolean,
broken_seq bigint)` — `ok=true`/`broken_seq=null` when intact, else the first broken seq.

pgTAP tests 21–23: intact chain → `ok=true`; trigger disabled, a row's `summary` column
mutated (ADR 0029 Q3 — `summary` is part of the canonical form), trigger re-enabled →
`ok=false`/`broken_seq = <tampered seq>`. The `AuditIntegrityCheck` UI component surfaces
the result via `role="status"` (polite on OK) escalating to `role="alert"` on tamper.
E2E AC-7a: JWT-level RPC call under both admin and staff_admin returns `ok=true` for an
intact chain. AC-7b: the "Verificar integridade" button in the UI renders the pt-BR intact
verdict.

**AC-8: One keyboard-only flow.**

E2E AC-8 drives the complete flow via keyboard only: `entitySelect.focus()` (the native
`<select>` for entity-type filter) → `selectOption('commission_member')` (keyboard
interaction, not a click) → URL-driven re-query verified → `integrityBtn.focus()` +
`page.keyboard.press('Enter')` → `role="status"` verdict rendered → CSV export `<a>`
link focus verified. The filter bar assigns `<Label htmlFor={...}>` to every control; the
pagination uses real `<Button>` elements with the project focus ring; the integrity check
button carries `aria-busy` during the pending transition.

---

### 2. Security review (the crux)

**Append-only enforcement — two independent layers.**

Primary: `app.guard_audit_immutable_trg` is a BEFORE UPDATE OR DELETE trigger. The function
raises `HC042` with no escape path. Unlike the meeting-lifecycle guards in the codebase, no
`in_safety_rpc` flag or conditional bypass is provided — there is no legitimate UPDATE or
DELETE anywhere for audit rows. The trigger fires for every role including `service_role`.
pgTAP test 10 exercises this explicitly under `set local role service_role`.

Secondary: no INSERT/UPDATE/DELETE policy exists on `audit_log`. A direct INSERT attempt by
an authenticated caller gets permission-denied by RLS (deny-by-default), and the only INSERT
path is the DEFINER writer. Together, the guard trigger and the absent write policy form
independent barriers.

The `commission_id` FK is `ON DELETE NO ACTION` (enforced; `ON DELETE SET NULL` was
explicitly rejected in ADR 0029 Q5 because `SET NULL` would mutate a hashed column,
breaking hash-chain integrity and masking the commission association).

**RLS — SELECT only; zero anon/PUBLIC access.**

The `audit_log_select` policy is the only RLS policy on `audit_log`. No write policy is
created. The `audit_trail_enabled()` public function has `revoke all ... from public, anon`
after its grant to `authenticated, service_role`. The baseline for the `public` schema is
set by migration `20260613090012_revoke_anon_public_grants.sql`: `revoke all privileges on
all tables in schema public from anon` plus `alter default privileges in schema public
revoke all on tables from anon` (so future tables including `audit_log` are protected by
default). pgTAP test 25 confirms via `information_schema.role_table_grants` that `anon` has
no grant on `audit_log`.

**Hash chain integrity.**

`row_hash = sha256(coalesce(prev_hash, '') || app.audit_canonical(...))`. The canonical form
commits to every semantic column: `seq, occurred_at, actor_id, actor_is_admin,
commission_id, action, entity_type, entity_id, summary, metadata`, joined by U+001E (a
control character that cannot appear in our text values). Committing to `summary` and
`actor_is_admin` means editing the human-readable label or retroactively flipping the admin
snapshot is detectable (ADR 0029 Q3). The `app.jsonb_canonical` serializer sorts object
keys deterministically, so the same logical metadata always produces the same byte string.
`verify_audit_chain` calls `app.audit_canonical` byte-identically to the write path,
ensuring no hash-mismatch false positive from serialization drift.

Per-commission chains and the global chain (`commission_id IS NULL`) are independent: the
advisory lock key is `'audit:' || coalesce(p_commission::text, '__global__')`, so chains
are serialized within a commission but parallel across commissions. The global chain covers
admin/system actions that have no commission scope.

**Allow-lists: the data-minimization guarantee (Architecture Rule 11 crux).**

Every trigger function's metadata allow-list was audited. None include answer payloads,
`*_md` columns, free-text bodies, or PHI. Full per-table audit:

| Table | Allow-list | Explicitly excluded |
|---|---|---|
| `forms` | `title, description` | — (description is the short form-list label, not a Markdown body) |
| `form_versions` | `status, version_number, published_at` | — |
| `form_sections` | `position, title, requires_signoff, signoff_role, is_default` | `description` (noted: "free-text-ish"), `visible_when` |
| `form_items` | `position, item_type, question_key, required` | `label`, `question_explanation`, `content`, `options` |
| `commission_members` | `role, user_id` | — |
| `commissions` | `name, slug` | — |
| `responses` | `status` (on submit flip only) | answer payload (explicit no-fly zone) |
| `response_section_signoffs` | `section_id, signed_by` | `note` (free text) |
| `cases` | `status, outcome_id` | `label` (noted in comments) |
| `case_phases` | `status, position` | — |
| `meetings` | `status` | `minutes_md` (noted in comments) |
| `meeting_signatures` | `attendee_id, signer_id, status` | `content_hash`, `note`, `provider_payload`, `ip_address`, `user_agent` |
| `case_interviews` | `status` | `summary_md` (noted in comments) |

The `audit_diff` helper in `supabase/migrations/20260617120001_audit_triggers.sql` enforces
the boundary mechanically: it iterates only over the named `p_cols` array via `unnest`, so
a column not in the allow-list can never appear in `metadata` regardless of the jsonb row
content.

**DEFINER search_path pinning.**

All DEFINER functions in the Phase 13 migrations carry `set search_path = app, public, pg_catalog`
or `set search_path = app, pg_catalog` for schema-internal functions:
`app.jsonb_canonical`, `app.audit_canonical`, `app.audit_write`, `app.guard_audit_immutable`,
`public.verify_audit_chain`, `public.log_audit_access`, `public.audit_trail_enabled`,
`app.assert_audit_enabled`. No DEFINER function in Phase 13 is unprotected.

**Service-role key — never client-side.**

`src/lib/supabase/admin.ts` is the only file referencing `SUPABASE_SERVICE_ROLE_KEY`. It
carries `import 'server-only'` (line 1) making client import a build-time error. The key is
not prefixed `NEXT_PUBLIC_*`. The audit query functions (`src/lib/queries/audit.ts`),
access logger (`src/lib/audit/access.ts`), and export routes all use the cookie-wired
RLS-scoped client (`createClient()` from `@/lib/supabase/server`), never the admin client.

---

### 3. Code quality (§8)

**TypeScript strict — no unjustified `any`.**

`src/lib/queries/audit.ts` uses the generated `Json` type for `metadata` with an explicit
comment explaining the intentional looseness (the UI renders the diff generically; the
shape is safe because the DB writer's allow-list is the enforcing boundary). The
`action` and `entityType` fields are cast from `string` with a comment noting the DB has no
enum type but the writer's vocabulary is enforced. `src/lib/audit/access.ts` casts
`params.metadata` to `Json` with a nullish coalesce. No unexplained `any` found in any
audit file.

**Data access through `src/lib/queries/` (Architecture Rule 9).**

`listAudit`, `verifyAuditChain`, `auditTrailEnabled`, and `listAuditFilterActors` are all
in `src/lib/queries/audit.ts`. The UI pages call these functions. No inline supabase-js
queries appear in `src/app/**/audit/**` or `src/components/audit/**`. Rule 9 satisfied.

**Server Components by default.**

Both audit pages (`/c/[slug]/manage/audit/page.tsx`, `/admin/audit/page.tsx`) are Server
Components (no `"use client"` directive). They re-query on each navigation via URL-driven
`searchParams`. Client components (`AuditFilters`, `AuditPagination`, `AuditIntegrityCheck`,
`AuditMotion`, `AuditFeed`) are correctly marked `"use client"` because they use
`useRouter`/`useSearchParams`/`useState`/`useTransition`. `AuditIntegrityCheck` imports the
`verifyAuditChainAction` server action as a value-import (safe — no `next/headers` leaks
into the client bundle). `src/lib/audit/access.ts` has `import 'server-only'`. The
ownership boundary is clean.

**pt-BR user-facing text (Architecture Rule 10).**

All audit UI headings, labels, filter legends, status messages, pagination summary, and
error/empty states are in pt-BR: "Trilha de auditoria", "Verificar integridade",
"Exportar CSV", "Verificando…", "Integridade verificada: a trilha está intacta.",
"Falha de integridade detectada…", "Nenhum registro encontrado", "Limpar filtros",
"Autor", "Ação", "Tipo de entidade", "De", "Até", etc. The `AUDIT_ACTION_LABELS` and
`AUDIT_ENTITY_LABELS` maps provide pt-BR translations for every action/entity slug.
The `AUDIT_MESSAGES` catalog is exclusively pt-BR. Rule 10 satisfied.

**No raw Postgres/Supabase errors in the UI.**

`mapAuditError` in `src/lib/audit/messages.ts` maps `HC042`, `42501` (forbidden), `23514`
(check_violation), and `P0002` (no_data_found) to pt-BR messages, with a generic fallback.
`verifyAuditChain` converts any query error to `{ ok: false, brokenSeq: -1 }` (the
out-of-band sentinel), which `verifyAuditChainAction` maps to `AUDIT_MESSAGES.generic`.
The export route handlers return pt-BR strings for 400/404 error cases. Raw Postgres errors
do not reach the UI.

**Motion (GSAP, reduced-motion safe).**

`AuditMotion` dynamically imports GSAP, bails immediately when `useReducedMotion()` returns
true, and wraps the async block in `try/catch` so any import or animation failure is silent.
The `clearProps: 'opacity,transform'` call ensures no residual state affects layout after
the entrance. The visible (no-JS) baseline is the unanimated feed.

**ADR coverage.**

ADR 0029 (`docs/decisions/0029-audit-trail-hash-chain.md`) exists, is accurate, and
documents the hash-chain design, all three rejected alternatives, and the five numbered
rulings (Q1–Q5) that justify the implementation choices (canonical form coverage, item
granularity, chain scope, commission chain placement, FK delete behavior). Adequate for
this non-trivial accreditation-track feature.

---

### 4. UX & Accessibility

**Labels, ARIA, keyboard.**

`AuditFilters`: every control (`<select>`, `<Input type="date">`) has an associated
`<Label htmlFor={...}>` with a unique `useId()` id. The inline `selectClasses` include
`focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40` — the
project focus ring. The filter bar is fully keyboard-navigable.

`AuditFeed`: the list is `<ol aria-label="Registros de auditoria">`. Row entries are `<li>`
elements (read-only — the log is append-only and there is nothing to interact with). Actor
display falls back to "Sistema" for null actors and "Usuário removido" for missing profile
names. The metadata diff renders with a `<dl>`/`<dt>`/`<dd>` structure and an `<span
className="sr-only">` that reads "de {before} para {after}" for screen readers.

`AuditIntegrityCheck`: the result region is `role="status"` with `aria-live="polite"` on an
OK result, escalating to `role="alert"` with `aria-live="assertive"` when a tamper is
detected. The button carries `aria-busy` during the pending transition. The ShieldCheck,
CheckCircle2, and AlertTriangle icons are `aria-hidden="true"`.

`AuditPagination`: the nav has `aria-label="Paginação dos registros de auditoria"`. The
total/range summary has `role="status"`. Prev/Next buttons disable at the ends. Both
carry the project focus ring.

---

## Findings

### MINOR-1 — `AUDIT_MESSAGES.appendOnly` phrasing mismatch (RESOLVED pre-record)

`app.guard_audit_immutable` in `supabase/migrations/20260617120000_audit_log_core.sql`
raises the pt-BR message `'os registros de auditoria são imutáveis (somente inserção)'`.
The corresponding constant `AUDIT_MESSAGES.appendOnly` in `src/lib/audit/messages.ts`
read `'Os registros de auditoria não podem ser alterados nem excluídos.'` — a slightly
different phrasing. The mapping is correct in intent (it maps `HC042` to a pt-BR message
as defense-in-depth) and this code path is unreachable from the UI (no application code
issues UPDATE or DELETE on `audit_log`). Nonetheless, the inconsistency was noted.

**Resolution:** Backend aligned `AUDIT_MESSAGES.appendOnly` to match the DB guard phrasing
before the Record commit. No user-visible impact; confirmed TS-only change.

---

## Verdict

**APPROVED**

All Phase 13 acceptance criteria are met. The append-only, tamper-evident audit trail is
correctly implemented:

- Append-only enforcement is absolute and DB-level (`HC042`, no escape, fires for
  `service_role`), backed independently by the absent write RLS policy.
- RLS is the security boundary: SELECT-only policy scoped to `is_admin()` or
  `is_staff_admin_of(commission_id)`; zero anon/PUBLIC access enforced by default
  privileges and verified by pgTAP.
- The hash chain commits to every semantic column (ADR 0029 Q3), is per-commission with
  an independent global chain, is advisory-lock serialized within each chain, and is
  verifiable by the DEFINER RPC.
- Every trigger allow-list provably excludes answer payloads, `*_md`/free-text bodies, and
  PHI — the Rule 11 data-minimization guarantee.
- The `log_audit_access` public surface is positively allow-listed to exactly 3 sensitive
  read/export actions and cannot forge a mutation row.
- DEFINER `search_path` is pinned on all writer and trigger functions.
- Service-role key is never `NEXT_PUBLIC_*` and never reachable from client components.

Architecture Rules 1, 9, 10, and 11 satisfied. One cosmetic MINOR resolved pre-record.
