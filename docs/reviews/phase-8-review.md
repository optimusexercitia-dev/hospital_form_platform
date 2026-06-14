# Phase 8 QA Review — Dashboards & Submissions Browser

**Date:** 2026-06-13
**Reviewer:** qa (qa-reviewer)
**Scope:** Phase 8 — Dashboards & Submissions Browser
**Tester verdict:** GREEN — 106/106 (full suite); 24 Phase-8 tests; pgTAP 189/189; build green (lint + typecheck + unit 24/24)
**Commits reviewed:** frontend `83c85e8`, backend through `cd314d9`

---

## Verdict: APPROVED

No blockers. No majors. Two MINORs — recommended to clear before recording per the team's "clear cheap MINORs before record" preference. Two INFOs carried forward.

---

## Summary

All 12 PHASES.md §Phase 8 acceptance clauses are met and tested. The RLS/security crux — the in_progress-answers invariant — is confirmed sound at every Phase-8 path. The definer RPC gating is correctly implemented. The B6 anon/PUBLIC EXECUTE revoke is complete and durable. ADR 0020 is consistent across SQL and TS.

The two tester-surfaced items are adjudicated below. Both resolve to MINOR, not blocking.

---

## 1. Requirements Audit

### AC coverage (PHASES.md §Phase 8 Acceptance)

| Clause | Tested? | Notes |
|--------|---------|-------|
| Dashboard numbers match seed exactly | Yes — AC-1/1b/1c (Form A 6, Sim×2/Não×2/Parcialmente×2, Luvas×6/Máscara×3/Touca×3/Avental×3). pgTAP tests 1–8. | PASS |
| Smaller denominator for conditional section | Yes — AC-2 (temperatura denominator=2, organizacao_estoque denominator=4). pgTAP test 5. | PASS |
| in_progress excluded from charts | Yes — AC-3 (headline stays 6; denominator 6 of 6). | PASS |
| Date filter changes results | Yes — AC-4 (single-day range → headlineNum < 6). | PASS |
| CSV downloads, matches row counts | Yes — AC-5a (≥6 rows). Row count rationale addressed below under item (A). | PASS |
| CSV has sign-off-status column | Yes — AC-5b (header matches `/Assinatura:/i`). | PASS |
| Staff gated to 404, no "Painel" nav | Yes — AC-6 / AC-6b. Server `notFound()` + nav absent. | PASS |
| Submissions browser member/form/date filters | Yes — AC-7a/7b/7c/7d. | PASS |
| in_progress toggle: metadata-only, non-link rows | Yes — AC-8. `SubmissionRow` renders a plain `<li>` (no `<a>`) for non-submitted rows. | PASS |
| Foreign response_id → 404 no-leak | Yes — AC-10b / commission-match double-check in detail page. | PASS |
| staff_admin cannot read another member's in_progress answers | Yes — AC-11 (live JWT RLS query returns `[]`). | PASS |
| Version-faithful detail (conditional "não aplicável", sign-off metadata, display blocks) | Yes — AC-9 / AC-9b. `SubmissionDetailView` uses `evalCondition` over own `answersByKey`. | PASS |
| Admin cross-commission overview | Yes — F6 (`admin/painel/page.tsx`), backed by `commission_overview()` RPC, admin-gated. | PASS |
| Keyboard-only flow | Yes — AC-12. Focus assertions at each step. | PASS |

### ADR 0020 coverage

`app.submitted_form_responses` is the single SQL source of `submitted AND case_phase_id IS NULL`. Every aggregation RPC (distributions, free text, over time, by-member, totals, export rows) calls through this helper. The TS twin `isDashboardCountable` mirrors it. The submissions browser explicitly does NOT use this helper (includes case-phase rows, badged). Consistent and documented.

---

## 2. Security / RLS Audit

### 2a. Definer RPC gating

All five aggregation RPCs (`dashboard_form_totals`, `dashboard_distributions`, `dashboard_free_text`, `dashboard_submissions_over_time`, `dashboard_completion_by_member`) and `dashboard_export_rows` each begin with:

```sql
select commission_id into v_commission_id from public.forms where id = p_form_id;
if v_commission_id is null or not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
  return;
end if;
```

`commission_overview()` uses `if not app.is_admin() then return; end if`. All have `set search_path = app, public, pg_catalog`. An unauthorized caller gets an empty set, not an error, so no information leaks. pgTAP tests 10, 11, 12 verify the gating. SOUND.

### 2b. in_progress-answers invariant (the crux)

`responses_select` (migration `20260612100006_rls_policies.sql` line 243):
```sql
created_by = auth.uid()
or app.is_admin()
or (status = 'submitted' and app.is_staff_admin_of(commission_id))
```

`answers_select` mirrors through `responses` with the same three-clause predicate. A staff_admin reading another member's in_progress response gets 0 rows from `responses` and 0 rows from `answers`. This policy was NOT changed by Phase 8.

Phase-8 data paths:
- **List** (`listSubmissions`): issues `supabase.from('responses')` through the cookie-wired RLS client. RLS filters in_progress foreign rows at the DB layer. Even with `includeInProgress: true`, the query returns only rows visible to the authenticated caller, which for a staff_admin means only their own in_progress rows (none, typically).
- **Detail** (`getSubmissionDetail`): calls `.maybeSingle()` on `responses`. A foreign in_progress response returns `null` → `notFound()`. The subsequent `answers` read never executes.
- **Detail page** (`[responseId]/page.tsx` line 38): performs an additional commission-match check: `if (!detail || detail.commissionId !== access.commission.id) notFound()`. This is defense-in-depth over and above RLS.
- **Export** (`dashboard_export_rows` RPC): calls `app.submitted_form_responses()` which filters `status = 'submitted'`, excluding all in_progress responses entirely.
- **Dashboard aggregations**: all aggregate through `app.submitted_form_responses()`, submitted-only. No in_progress path.

AC-11 live-verifies this at the HTTP layer with a real staff_admin JWT. INVARIANT HOLDS.

### 2c. B6 anon/PUBLIC EXECUTE revoke

Migration `20260613090012` revokes:
- `all privileges on all tables/sequences/functions in schema public from anon`
- `execute on all functions in schema public from public` (the root cause — anon inherits via PUBLIC)
- Sets `alter default privileges ... revoke all/execute on tables/sequences/functions from anon/public`

Migration `20260613090014` closes the re-leak from `dashboard_export_rows` (created after the B6 revoke):
- `revoke all on function public.dashboard_export_rows(uuid) from public, anon`
- `alter default privileges ... revoke execute on functions from public` (durable root-cause fix)

pgTAP tests 15, 16, 17 verify:
- `anon` cannot SELECT public tables or EXECUTE public functions
- `dashboard_export_rows` specifically: not anon-executable, authenticated-executable
- Generic guard: zero public functions are anon-executable

The lead's live-DB spot-check (all app RPCs `authenticated=t`, `anon=f`; only `custom_access_token_hook` lacks authenticated EXECUTE — intentional) is consistent with what the migrations produce. SOUND.

### 2d. Export route — no service-role key

`src/app/c/[slug]/dashboard/export/route.ts` uses `getFormExport()` which calls `createClient()` (the cookie-wired server client, RLS-scoped). No service-role key on this path. The coarse gate at line 54 (`access.role !== 'staff_admin'`) is defense-in-depth; the RPC's internal `is_staff_admin_of` gate is the authority. SOUND.

### 2e. Client-side form filter in `listSubmissions`

`submissions.ts` line 241: `if (filters.formId) rows = rows.filter((r) => r.formId === filters.formId)`. The comment explains this correctly: `form_id` lives on the embedded `form_versions` join, not directly filterable via a PostgREST `.eq` on the parent `responses` table without a join path. The full submission list is already RLS-scoped to the commission, so the client-side filter operates on a safe pre-filtered set. No security concern; a commission with a very large number of responses per form could have scalability implications in the future, but this is not a v1 concern.

---

## 3. Code Quality Audit

### Rule 9 — no inline supabase-js

No calls to `createClient` or `.from()` / `.rpc()` exist in `src/app/c/[slug]/dashboard/**` pages or `src/components/dashboard/**`. All data access flows through `src/lib/queries/dashboard.ts` and `src/lib/queries/submissions.ts`. PASS.

### TypeScript `strict`

No `any` used in the Phase-8 surface files. The `ExportRpcRow` interface at `dashboard.ts:354` is explicitly typed. The `startData` shape in the spec (`phase8-dashboard.spec.ts:778`) uses a typed union — this is test code, not application code, and the inline type annotation is explicit. PASS.

### Server Components by default

`dashboard/page.tsx`, `submissions/page.tsx`, `submissions/[responseId]/page.tsx`, `admin/painel/page.tsx` are all Server Components (no `"use client"` at the top). The `"use client"` boundary is correctly placed at `DashboardForms`, `DashboardFilters`, `CommissionOverview`, `SubmissionsFilters` — all of which require interactivity (URL pushes, reduced-motion hook). `SubmissionDetailView` and `SubmissionRow` are correctly server-renderable props-only components. PASS.

### Accessibility

- Every chart `<div aria-hidden="true">` paired with a real visible `<table>` (not `sr-only` — the table is the visual fallback too). `DistributionChart` and `CommissionOverview` both do this correctly.
- SVG labels via `aria-hidden="true"` on chart containers.
- `DistributionChart`: `<article aria-labelledby={headingId}>` with `<h4 id={headingId}>`. PASS.
- `DashboardFilters`: `<Label htmlFor={...}>` + native `<input type="date">` — keyboard-operable, labeled, `min`/`max` cross-constraints set. The CSV export is `<a download>` with visible label text "Exportar CSV". PASS.
- `SubmissionsFilters` (not fully read but tested by AC-12 keyboard flow). PASS.
- `submission-row.tsx`: in_progress row is a plain `<li>` (non-interactive); submitted row is a `<Link>` with `focus-visible:ring-[3px]`. No keyboard trap. PASS.
- `SubmissionDetailView`: `<section aria-labelledby={headingId}>`, `<h2 id={headingId}>` per section. PASS.
- Recharts animations gated by `useReducedMotion` (`useSyncExternalStore` pattern) in all chart components. PASS.

### pt-BR strings

All user-facing text is Brazilian Portuguese. Error responses in the export route are pt-BR ("Parâmetro \"form\" ausente.", "Não encontrado."). No raw Postgres error surfaces — the route returns 404 on any data-access failure. PASS.

---

## 4. Adjudication of Tester-Surfaced Items

### Item (A): CSV export ignores the dashboard date filter

**Finding:** The `DashboardFilters` component at `/src/components/dashboard/dashboard-filters.tsx:62–66` builds the export URL and **does** pass `from` and `to` query params:
```ts
if (from) exportParams.set("from", from);
if (to) exportParams.set("to", to);
const exportHref = `/c/${slug}/dashboard/export?${exportParams.toString()}`;
```

However, the **route handler** (`src/app/c/[slug]/dashboard/export/route.ts`) reads only the `form` query param (line 41) and never reads `from` or `to`. The `getFormExport` function (`src/lib/queries/dashboard.ts:372`) accepts only `formId: string` with no date-range parameter. The backing RPC `dashboard_export_rows` also accepts no date params. So the frontend correctly passes the params but the backend silently ignores them — exporting all standalone-submitted responses for the form regardless of the active date range.

**Adjudication: MINOR.** The inconsistency is real: a user looking at a date-filtered dashboard might expect the exported CSV to reflect what they see on screen, but they get all-time data. This is not a security issue (the export is correctly gated; it never widens beyond submitted+standalone). The tester surfaced this honestly by relaxing the row-count assertion to `>= 6` rather than masking it.

**Concrete fix:** Accept `from` and `to` in `getFormExport(formId, range?)`, pass them through to `supabase.rpc('dashboard_export_rows', { p_form_id: formId, p_from: range?.from, p_to: range?.to })`, add corresponding `p_from date default null` / `p_to date default null` params to the `dashboard_export_rows` SQL function (with a `where (p_from is null or r.submitted_at::date >= p_from) and (p_to is null or r.submitted_at::date <= p_to)` clause in the base query), and have the route handler extract those params (`request.nextUrl.searchParams.get('from')`). The tester assertion can then tighten back to `=== 6` when the date filter is applied.

**Classification: MINOR-1.**

### Item (B): Exact-number acceptance via `?to=yesterday` date windowing

**Finding:** The `openDashboard` helper in `phase8-dashboard.spec.ts:145` defaults to `seedOnly = true`, which appends `?to=yesterday` to the URL. The lead notes explain why: Phase 5/6/7 tests submit responses on the current day (`submitted_at = now()`), while the seed places responses at `now() - i days (i=1..6)`. Filtering `to=yesterday` isolates the seeded data.

**Adjudication: Sound test accommodation, not a masked app defect.** The application correctly excludes in_progress responses (confirmed by pgTAP + AC-3) and applies the date filter at the SQL level (via `sr.submitted_at::date <= p_to` in each RPC). The `?to=yesterday` window is the correct way to pin exact-count assertions when the full suite contaminates the DB state with same-day responses. The seeded numbers themselves are correct: Form A 6 standalone, Form B 4 standalone; distributions match seed.sql. This is standard shared-DB test hygiene, not a defect.

---

## 5. Minor Findings

### MINOR-1 — CSV export does not honor the active date filter

See Item (A) above for full analysis and concrete fix.
- Files: `src/app/c/[slug]/dashboard/export/route.ts`, `src/lib/queries/dashboard.ts:372`, `supabase/migrations/20260613090013_dashboard_export.sql`
- Requirement: PHASES.md §Phase 8 "CSV export of raw submitted responses" (the user views a date-filtered dashboard and clicks "Exportar CSV" — the natural expectation is that the CSV matches what is on screen)
- Fix: thread `p_from`/`p_to` through route → `getFormExport(formId, range?)` → RPC. Non-breaking change to the SQL function.

### MINOR-2 — Form tab badge count does not follow the date filter

The form picker tab (rendered by `FormPicker` in `dashboard-forms.tsx:113`) shows `form.totalSubmitted` from `listDashboardForms` → `dashboard_form_totals`, which has **no date filter**. Meanwhile the body headline (`DashboardBody` line 131) shows the date-filtered `dashboard.totalSubmitted` (from `submissionsOverTime.reduce(...)`). After applying a date range the tab badge still reads "6" while the headline reads "1", which is visually inconsistent.

- Files: `src/components/dashboard/dashboard-forms.tsx:113`, `src/lib/queries/dashboard.ts:192–202` (`listDashboardForms` → `dashboard_form_totals`)
- Fix options: (a) pass `range` to `listDashboardForms` and propagate it to `dashboard_form_totals`; or (b) badge the tab with the all-time count and make this explicit in the tooltip/caption ("6 no total"). Option (b) is lower effort.
- Severity: MINOR — no data is incorrect; it is a display-consistency gap.

---

## 6. INFO / Carry-forwards

### INFO-1 — `totalSubmitted` derived from `submissionsOverTime` sum

In `getFormDashboard` (line 249), `totalSubmitted` is computed as `submissionsOverTime.reduce((acc, p) => acc + p.count, 0)` rather than from `dashboard_form_totals`. This means the headline is the date-filtered total (consistent with the body charts) but diverges from the form tab badge (see MINOR-2). It also means if `dashboard_submissions_over_time` and the other RPCs have differing internal filters in a future change, the headline could drift. Consider adding a direct "in-scope count" column to one of the existing RPC calls to make the source of truth explicit. **Not a bug today; observational note.**

### INFO-2 — Phase 9 carry-forward (unchanged)

Production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys. Otherwise `getClaims()` falls back to a per-request `getUser()` GoTrue round trip (ADR 0009). This is a Phase 9 deploy checklist item. Not a Phase 8 issue.

---

## Conclusion

Phase 8 meets all stated requirements. The RLS boundary is sound, the in_progress-answers invariant holds across every new read path, the definer RPCs are properly gated and search_path-pinned, and the B6 anon/PUBLIC revoke is complete and durable. Accessibility, pt-BR strings, and code quality are all in good shape. The two MINORs are cheap pre-record fixes (MINOR-1 is a real user-facing inconsistency; MINOR-2 is a display polish gap). No blocking issues.

**Verdict: APPROVED** (conditional on MINOR-1 and MINOR-2 being cleared before the phase record step, per team preference).
