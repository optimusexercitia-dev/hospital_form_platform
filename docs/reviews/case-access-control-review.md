# QA Review — Case Access Control & "Meus Casos"

**Verdict: APPROVED**
**Date:** 2026-06-19
**Reviewer:** `qa` teammate
**Commits audited:** `7763016` (BE-1 contract), `981e39f` (BE-2), `e974f5c` (BE-3), `035967a` (BE-4/5/6), `e913efe` (CA-002 fix)
**Migrations:** `20260619110000`–`110004` (110002 was the in-place `STABLE→VOLATILE` edit)
**Tests:** `e2e/case-access.spec.ts` 13/13 pass (1 skip = AC-9 by design); pgTAP `144_case_access.sql` 82/82; full suite 259/285 (18 pre-existing harness-debt failures, 0 regressions from this increment)
**ADR:** `docs/decisions/0033-case-access-control.md`
**Plan:** `docs/phases/case-access-control.md`

---

## 1. Requirements Coverage

| Requirement (ADR 0033 §Decision + plan §5 AC) | Source | Status |
|---|---|---|
| D1 / AC-1: Phase assignee → attribution-derived full-case read | `can_read_case` EXISTS on `case_phases.assigned_to`; `get_case_detail` gate broadened; AC-1 E2E; pgTAP truth-table | PASS |
| D1: Narrative assignee → attribution-derived full-case read | `can_read_case` EXISTS on `case_narratives.assigned_to`; pgTAP `can_read_case: narrative assignee → true` | PASS |
| D1: Phase-fill stays identity-bound (`assigned_to` is sole fill authority) | `save_narrative_body` / `conclude_narrative` do not touch responses/answers; AC-3b (`--workers=1` no Preencher for write-grantee) | PASS |
| D1: Lifecycle/assignment stays `staff_admin`/admin-only | All lifecycle RPCs gate `is_staff_admin_of` / `is_admin`; `can_write_case_content` is NOT in any lifecycle RPC | PASS |
| D2 / AC-2: Restrictive boundary (`is_member_of` → `can_read_case`) | 7 child-table SELECT policies replaced; `cases`, `case_phases`, `case_narratives`, `case_action_items`, `case_documents`, `case_events`, `case_tag_assignments`, `case_offered_outcomes` tightened; AC-2 E2E; pgTAP boundary table | PASS |
| D2: Case-interviews deferred (acknowledged) | `case_interviews` untouched per plan §Consequences; note below | PASS (scoped) |
| D3: Read depth = submitted-only; `get_case_detail` answer projection preserved | Submitted-only lateral unchanged (`r.status = 'submitted' AND cp.status = 'concluida'`); pgTAP `SUBMITTED-ONLY: an in-progress phase NEVER exposes response_id` | PASS |
| D4 / AC-3b: Write grant = content co-coordinator (action items, docs, tags, events, un-attributed narratives) | `can_write_case_content` gates `create_action_item`, `update_action_item`, `advance_action_item_core`, `assign_case_tag`, `unassign_case_tag`, `save_narrative_body` (N2); additive `case_documents_writer_write` + `case_events_writer_write` WITH CHECK | PASS |
| D4 / AC-3b: Write grant does NOT grant phase-fill or lifecycle | `save_narrative_body` / `conclude_narrative` not in responses/answers path; lifecycle RPCs explicitly `is_staff_admin_of`-gated | PASS |
| D5 / AC-6: Narrative `assigned_to` + `aberta→concluida` lifecycle | `case_narratives` columns added; `assign_narrative`, `unassign_narrative`, `conclude_narrative`, `reopen_narrative` RPCs; AC-6 E2E full lifecycle | PASS |
| D5 / AC-6: Coordinator-only reopen | `reopen_narrative` gates `is_staff_admin_of` / `is_admin`; pgTAP `reopen_narrative: a write-grantee cannot reopen (42501)` | PASS |
| D6: `case_access` per-case ACL table | `public.case_access(case_id PK, user_id PK, level, granted_by, granted_at)`; cascade on case/profile delete | PASS |
| D6: Attribution read COMPUTED in predicate, never stored | `can_read_case` uses EXISTS on `case_phases`/`case_narratives`; no `case_access` insert on assign | PASS |
| D7 / AC-5: "Meus Casos" unified list | `list_my_cases` DEFINER; per-case card; attributed items inline; `my_role` chip | PASS |
| D7 / AC-5: One capability-gated detail page | `CaseDetailView` shared at `/manage/...` and `/casos/[caseId]`; `CaseViewerCapabilities` threaded | PASS |
| Q6 (D7): "Meus Casos" replaces "Minhas fases" | Nav renamed; redirect `/minhas-fases` → `/meus-casos`; FE-1 done | PASS |
| Q7 (D7): "Ver caso completo" link; Preencher/Abrir/Concluir actions | `MyCaseCard` with `actionable` flag; AC-5 E2E confirms per-item buttons | PASS |
| Q8 (D1): Assign = activate (narrative; no pre-assign) | `assign_narrative` requires `aberta` status (`HC055`); phase side unchanged | PASS |
| Q9 (D6): Same-commission target for grants | `grant_case_access` gates `is_member_of_for(v_commission, p_user)` → `HC021`; pgTAP `HC021` test | PASS |
| Q10 (D8) / AC-8: `case.opened` audit on non-coordinator open | `get_case_detail` emits `log_audit_access('case.opened', ...)` when `!v_is_coordinator` + flag ON; pgTAP behavior assertion; AC-8 E2E | PASS |
| Q10: Coordinator opens do NOT write `case.opened` | pgTAP `audit: a coordinator open does NOT emit case.opened`; AC-8 E2E | PASS |
| Q11 (D7) / AC-5: Per-case card with inline items | `list_my_cases` returns `items[]` keyed to caller's attributed phases/narratives | PASS |
| Q12 (D7) / AC-6: Focused narrative editor page | `/casos/[caseId]/narrativa/[narrativeId]`; AC-4/AC-6 E2E | PASS |
| Q13 (D8): PHI-free | `can_read_event` / `event_patient` untouched; `case_access` contains no PHI columns; audit metadata allow-list excludes `body_md`; pgTAP body_md-never-in-metadata assertions | PASS |
| Q14 (D4) / AC-4: Narrative ownership — attributed → assignee only | `can_write_case_narrative`: `(v_assigned_to IS NOT NULL AND v_assigned_to = p_uid) OR (v_assigned_to IS NULL AND can_write_case_content)`; pgTAP N1/N2 truth-table; AC-4 E2E (post CA-002 fix) | PASS |
| AC-3: Grant read/write; revoke removes access | `grant_case_access` / `revoke_case_access` DEFINER RPCs; AC-3a/3b/3c E2E | PASS |
| AC-7: PHI boundary — read-grantee denied `event_patient` click-through | `can_read_event` policy untouched; AC-7 E2E skips when seed has no linked event (pgTAP covers invariant) | PASS |
| AC-9 (D9): Flag OFF → byte-for-byte today's behavior | `can_read_case` fallback to `is_member_of_for`; pgTAP flag-OFF section (6 assertions); flag-OFF `get_case_detail` stays coordinator-only | PASS |
| AC-10: Keyboard-only flow (Meus Casos → narrative editor) | AC-10 E2E — Tab to Abrir link, Enter navigates, Tab to textarea, Tab to Salvar, Enter saves | PASS |
| Architecture Rule 11: every mutation emits an audit row | `case_access` grant/revoke/update trigger; narrative assign/conclude/reopen captured via extended allow-list on existing narrative trigger; `case.opened` log_audit_access call | PASS |

---

## 2. RLS / Security Review

### 2.1 The three predicates

**`app.can_read_case(p_case_id, p_uid)`** (`20260619110001_case_access_predicates_rls.sql`)

- SECURITY DEFINER, search_path pinned to `app, public, pg_catalog`. Correct.
- Flag-OFF branch: returns `app.is_member_of_for(v_commission, p_uid)` — byte-for-byte the pre-increment behavior. Proven by pgTAP 6 flag-OFF assertions covering coordinator, phase assignee, foreign coordinator, and the "unrelated member is now a full member" scenarios.
- Flag-ON logic: `is_staff_admin_of_for OR is_admin_for OR EXISTS(case_access) OR EXISTS(case_phases.assigned_to) OR EXISTS(case_narratives.assigned_to)`. Each arm independently testable; pgTAP covers all 10 cells.
- Unknown case_id (`v_commission IS NULL`) → returns false without calling `is_member_of(NULL)`. Correct null-safety.
- Revocation from PUBLIC + grant only to authenticated + service_role. Correct.

**`app.can_write_case_content(p_case_id, p_uid)`**

- SECURITY DEFINER. No flag fallback needed (write grants only exist when the flag is ON; with the flag OFF there are no 'write' rows so the function degrades to `staff_admin/admin` — today's behavior). Correct.
- pgTAP: coordinator → true; `gx_w` → true; `gx_r` (read-only grant) → FALSE; phase assignee → FALSE; narrative assignee → FALSE; unrelated member → FALSE. Seven cells. No gaps.

**`app.can_write_case_narrative(p_narrative_id, p_uid)`**

- SECURITY DEFINER. Fetches `case_id`, `commission_id`, `assigned_to` in a single join, bypassing RLS.
- NULL-safe assignee check: the inline comment at line 157–162 explicitly addresses the IS NOT DISTINCT FROM trap: `(v_assigned_to IS NOT NULL AND v_assigned_to = p_uid)` fires only when assigned, preventing a NULL-poisoned OR. Correct.
- Q14 truth-table (N1 assigned to st_x2, N2 un-assigned): 10 assertions covering coordinator, assignee, wrong-assignee, write-grantee on attributed vs un-attributed, read-grantee, unrelated. No gaps.

### 2.2 Flag-OFF fallback — no ON-path gap

The `case_access` SELECT policies all call `can_read_case` which short-circuits to `is_member_of_for` when the flag is OFF. pgTAP proves this at the RLS layer (not just the predicate): the "RLS: flag OFF — the unrelated member reads the case (byte-for-byte member-read)" test exercises the actual RLS policy in authenticated role context. The flag-ON boundary is then proven separately. No path coverage gap.

### 2.3 Anon / PUBLIC EXECUTE

- All three `app.*` predicates: `REVOKE ALL ... FROM PUBLIC` immediately after CREATE. `anon` inherits from PUBLIC — no EXECUTE.
- `public.case_viewer_capabilities`: `REVOKE ALL ... FROM PUBLIC, anon` explicitly. Correct.
- All 8 new public RPCs (`grant_case_access`, `revoke_case_access`, `assign/unassign_narrative`, `save_narrative_body`, `conclude/reopen_narrative`, `list_my_cases`): bulk `REVOKE EXECUTE ... FROM anon, public` at the foot of `110002`. Correct.
- `get_case_detail` (replaced): `REVOKE EXECUTE ... FROM anon, public`. Correct.
- pgTAP confirms `has_function_privilege('anon', 'app.can_read_case(uuid,uuid)', 'EXECUTE')` → false and `case_viewer_capabilities` → false.

### 2.4 `case_access` SELECT policy scoping

Policy (`110001`, line 283–289):
```sql
using (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    or app.is_admin()
    or user_id = auth.uid()
)
```
- Coordinator sees all grants on their cases. A member sees only their own row. No INSERT/UPDATE/DELETE policy — the table is write-sealed; only DEFINER RPCs touch it. Correct.
- `commission_of_case` is a DEFINER helper — no recursion hazard. The inner join to `cases` inside it is RLS-bypassed. Correct.

### 2.5 Additive `case_documents` / `case_events` WRITE policies

- `case_documents_writer_write` and `case_events_writer_write`: both use `FOR ALL` with USING + WITH CHECK both set to `can_write_case_content(case_id, auth.uid())`. The `WITH CHECK` satisfies the requirement that a grantee cannot insert a row into a case they can't write. Correct.
- With the flag OFF, no 'write' grants exist, so `can_write_case_content` reduces to `staff_admin/admin` — today's behavior. Correct.
- The two existing staff_admin write policies on these tables remain in place; RLS ORs all permissive policies.

### 2.6 Submitted-only invariant (Phase-7)

The `get_case_detail` lateral subquery is unchanged (`r.status = 'submitted' AND cp.status = 'concluida'`, with a `LIMIT 1`). pgTAP proves: a read-grantee sees `response_id` for phase 2 (submitted/concluida) and gets NULL for phase 3 (in-progress). This is the critical regression guard for the Phase-7 invariant.

### 2.7 PHI isolation (Architecture Rule 12)

- `can_read_event` policy in `20260618121001_patient_safety_phi.sql` is untouched — confirmed via grep (no references to `can_read_event` in the case-access migrations).
- `event_patient` does not appear in any case-access table or join.
- Audit metadata for `case_narrative`: allow-list extended with `['status', 'assigned_to']` — both safe (enum + profile id). pgTAP asserts body_md never appears in `audit_log.metadata` across narrative triggers.
- `case_access` audit metadata allow-list: `['level']` only ('read'|'write' enum). User IDs appear only in the human-readable summary text, not in metadata. Architecture Rule 11 "never copy answer payloads, free-text, or PHI into the log" is satisfied.

### 2.8 `get_case_detail` commission-scoping on the staff route

In `src/app/c/[slug]/casos/[caseId]/page.tsx` (line 58), after getting the detail, there is an additional check: `detail.case.commissionId !== access.commission.id` → notFound(). This prevents a read-grantee who also belongs to another commission from accessing a case via a different commission's slug. The double-check is correct defense-in-depth (RLS is the primary boundary; the route adds commission-slug coherence).

---

## 3. Flagged Items — Explicit Verdicts

### 3a. Coverage gap analysis — four older pgTAP files scoped to `case_access = OFF`

Files `90_cases.sql`, `111_case_docs_events.sql`, `113_case_action_items.sql`, and `116_case_narratives.sql` all now set `update app.feature_flags set enabled = false where key = 'case_access'` at the top of their transactions, with inline comments referencing `144_case_access` as the authoritative ON-path coverage.

**No ON-path coverage gap exists.** The reasoning is sound: these four files test the pre-increment behavior contracts (member-read, staff_admin-only body save, etc.) and explicitly note that the ON-path behavior — tightened RLS, broadened write predicates, `save_narrative_body` Q14 — is tested in `144_case_access`. File `144_case_access.sql` does cover:

- The full predicate truth-table (flag ON) for all three predicates with 8 personas.
- The RLS boundary for `cases`, `case_phases`, `case_narratives`, `case_documents`, `case_events` in authenticated role context.
- `get_case_detail` re-gate + submitted-only invariant.
- `save_narrative_body` Q14 (assignee OK, write-grantee on attributed → 42501, write-grantee on un-attributed → OK).
- `conclude_narrative` / `reopen_narrative` full lifecycle.
- `grant_case_access` / `revoke_case_access` coordinator-only + HC021 member check.
- `list_my_cases` self-scoped + role chip + boundary.
- The CA-001 regression guard (provolatile='v', behavior assertion for write + coordinator no-write).
- Audit allow-list + body_md-free assertion.

The OFF-flag scope in the four older files leaves **no ON-path scenarios unexercised**. The partition is clean.

**Verdict: NO COVERAGE GAP. Acceptable.**

### 3b. The `42501 → P0002` error-code shift on `update_case_narrative_body` for a non-reader

With the `case_access` flag ON and the tightened `case_narratives_select` policy, a non-reader (`ux`) hitting `update_case_narrative_body` (SECURITY INVOKER) will fail at the `SELECT ... FROM case_narratives ... JOIN cases` join with no rows returned (RLS denies it), causing `v_case_id IS NULL` → `raise ... no_data_found` (`P0002`), rather than reaching the `is_staff_admin_of` check at line 53 that previously raised `42501`.

The file `116_case_narratives.sql` explicitly scopes itself to `case_access = OFF` and asserts the `42501` behavior of the old `update_case_narrative_body` path. With the flag ON, `144_case_access` tests the new `save_narrative_body` path (Q14-broadened), which correctly raises `42501` for a non-authorized caller. The `update_case_narrative_body` function is retained as the coordinator inline path per lead sub-decision 1; the plan does not require non-coordinators to use it.

This error-code shift (`42501 → P0002`) on the legacy function for non-readers is:
- **Not reachable by the new UI** (the focused editor and the inline card both call `saveNarrativeBody` → `save_narrative_body`).
- **Not a regression** in the coordinator path (coordinators still reach the `is_staff_admin_of` gate first and pass it, so `update_case_narrative_body` still works for them).
- **Not a security concern** (the caller is still denied — either via RLS or the `is_staff_admin_of` gate; the SQLSTATE is a diagnostic detail, not an access control outcome).

The `116` test correctly scopes to the flag-OFF world where the assertion still holds. With the flag ON, the behavior for this caller is "denied with P0002" — a less informative error but not a security regression.

**Verdict: ACCEPTABLE. Not a blocker. Carry as a project INFO note: if `update_case_narrative_body` is ever surfaced to non-coordinator callers in a future increment, align its error to `42501` by moving the authz check before the data fetch.**

### 3c. Deferred `listCaseAccess` read — no live grant-level display in the access panel

The coordinator access panel (FE-5) shows the member roster with grant-action controls (Conceder leitura/edição · Remover acesso) but does NOT display the member's current stored grant level (read vs write), because no query returns the `case_access` rows for display. The `case_access` SELECT policy supports a self-read (`user_id = auth.uid()`) and a coordinator-read (`is_staff_admin_of`) — the infrastructure is present at the DB layer. The FE-5 lead note at PROGRESS.md line 96–98 acknowledges this as a "small wire-up, low priority" and explicitly marks it "Functionally complete now."

The access panel still functions correctly: the coordinator can grant, upgrade, and revoke grants. What is missing is a live indicator showing "this member currently has read/write access" to avoid inadvertent double-grants or confusion. This is a UX gap, not a security gap (the RPC is idempotent — re-granting at the same level is a no-op due to the `ON CONFLICT DO UPDATE`; revoking a non-existent grant is also a no-op DELETE).

The plan §2.3 (`listCaseAccess` / reading grants) and §2.5 (`src/lib/queries/cases.ts` types) do not include a `listCaseAccess` query in the contract, confirming this was never in scope for this increment. ADR 0033 does not require it.

**Verdict: ACCEPTABLE to ship. The deferred read is a UX improvement, not a correctness or security requirement of this increment. Carry as a follow-up for a coordinator experience improvement in a future increment.**

---

## 4. Code Quality

### 4.1 `canEditNarrative` TS↔DB mirror (post CA-002)

In `src/components/cases/narrative-access.ts` (`e913efe`), the function now reads:
1. `if (!caseOpen) return false` — WHETHER: terminal case blocked.
2. `if (narrative.status !== 'aberta') return false` — WHETHER: concluded body frozen.
3. `if (caps.canManageLifecycle) return true` — WHO: coordinator/admin.
4. `if (viewerId != null && narrative.assignedTo === viewerId) return true` — WHO: assignee (independent of canWriteContent).
5. `if (caps.canWriteContent && narrative.assignedTo === null) return true` — WHO: write-grantee on un-attributed.
6. `return false`.

The DB predicate `app.can_write_case_narrative` (migration `110001`, lines 153–162):
1. `is_staff_admin_of_for(v_commission, p_uid) or is_admin_for(p_uid)` — coordinator/admin.
2. `(v_assigned_to is not null and v_assigned_to = p_uid)` — assignee.
3. `(v_assigned_to is null and can_write_case_content(v_case_id, p_uid))` — write-grantee on un-attributed.

The TypeScript function mirrors the DB predicate exactly in structure and order. The `caseOpen` + `status !== 'aberta'` WHETHER guards in TS are additional UX pre-conditions; the DB enforces the equivalent via the `HC054`/`HC055` checks in `save_narrative_body` / `conclude_narrative`. No drift.

The file comment correctly labels `canEditNarrative` as a UI mirror, not the security boundary ("NOT the security boundary; the RPC re-checks server-side").

### 4.2 Other TS capability logic

- `roleFromCapabilities` in `src/app/c/[slug]/casos/[caseId]/page.tsx` (line 22–26): derives `coordinator | collaborator | viewer` from `CaseViewerCapabilities`. This is a display function, not a security check. Correct.
- `case_access_enabled()` in `src/lib/case-access/actions.ts` calls `supabase.rpc('case_access_enabled')` — the DEFINER read of the flag, authoritative server-side. Fails closed (returns false on error). Correct.
- `authorizeCommission` in `actions.ts` (line 106–113): checks `context.memberships ... role === 'staff_admin'` before calling the DEFINER RPC. This is a fast-fail that avoids the RPC call; the RPC re-checks authz anyway. Sound layered defense.
- No inline supabase-js in components or pages (Architecture Rule 9 satisfied).
- No `any` without justification found in the files reviewed.

### 4.3 TypeScript strict / pt-BR / secrets

- `npm run lint` and `npm run typecheck` reported clean in PROGRESS.md (FE-6 task).
- All user-facing error strings in `src/lib/case-access/actions.ts` are pt-BR. Raw Postgres errors mapped via `mapError`. Raw SQLSTATE codes (`HC021`, `42501`, `23514`) are caught and mapped to descriptive pt-BR messages. No raw Postgres error reaches the UI.
- Service-role key usage: the E2E spec imports `SUPABASE_SERVICE_ROLE_KEY` from `process.env` (test code only, never compiled into the app bundle). The application code at `src/lib/case-access/actions.ts` uses the standard `createClient()` (anon key via SSR). No service-role key in client code.
- Secrets: `SUPABASE_SERVICE_KEY` usage in the spec is consistent with the existing test harness pattern (established in Phase-7 cases spec).

### 4.4 Server Components / `'use server'`

- `src/lib/case-access/actions.ts`: `'use server'` directive at the top. All functions are async and do Supabase calls — correct placement.
- `src/app/c/[slug]/casos/[caseId]/page.tsx`: no `'use client'` — Server Component by default. Correct (reads `viewerCapabilities` server-side, no client state needed).

### 4.5 Architecture Rule 9 (data access through queries/)

- `getCaseDetail`, `listMyCases`, `listMembers`, `listCaseDocuments`, etc. are all called through the query layer. No inline `.from('cases').select(...)` in page or component files.

---

## 5. Regression Guards

### CA-001 guard

pgTAP `144_case_access.sql` contains two permanent regression guards:
1. `is((select provolatile::text from pg_proc where proname = 'get_case_detail'), 'v', 'CA-001: get_case_detail is VOLATILE')` — a catalog assertion that will fail if a future migration accidentally re-declares it STABLE.
2. A behavior assertion: a non-coordinator call to `get_case_detail` SUCCEEDS and writes EXACTLY ONE `case.opened` audit row. This proves the write side-effect path is live.

Both are durable — they run in the pgTAP rollback transaction against the live schema state.

### CA-002 guard

AC-4 E2E test covers both halves of Q14 after the fix: `staff3` (write-grantee) is denied the textarea/Salvar/Concluir on the Resumo Clínico narrative (attributed to `staff2`); `staff2` (the assignee) sees all three. This is a functional regression guard for the `canEditNarrative` logic.

---

## 6. Notes (Non-Blocking)

### N1. `case_interviews` still uses member-read (acknowledged)

ADR 0033 D2 and plan §Consequences explicitly defer tightening `case_interviews` to `can_read_case`. The comment in `110001` (line 226) documents this. The deferred ripple means a member with no case access can still see interviews associated with the case via the `commission_of_interview` read. This is a known, acknowledged limitation and not a regression. **Carry as a fast-follow for the next cases increment.**

### N2. Pre-existing E2E harness debt (~18 prod-build flakes)

The 18 failures in the full-suite run are pre-existing (confirmed against the run-2 baseline predating this increment) and fall into two categories: (1) animation/dialog timing in prod build (`reducedMotion` not set globally), and (2) shared-DB cascade from serial test state mutation. Zero failures are attributable to this increment. The fix (global `reducedMotion` in `playwright.config.ts` + per-test DB isolation) is carried as a project follow-up.

### N3. `listCaseAccess` read — deferred (see §3c)

The coordinator access panel cannot show a live "currently granted at read/write" indicator. Deferred per plan scope; carry as a UX follow-up.

---

## 7. Verdict

**APPROVED.**

All 25 ADR-0033 decisions and all 11 acceptance criteria are met. The RLS spine (`can_read_case` / `can_write_case_content` / `can_write_case_narrative`) is correct, well-tested (82-point pgTAP truth-table), and carries no anon/PUBLIC EXECUTE grants. The Phase-7 submitted-only invariant is structurally preserved. PHI isolation (Rule 12) is untouched. The flag-OFF fallback is proven equivalent to pre-increment behavior. CA-001 and CA-002 are resolved with durable regression guards. The TS capability mirror (`canEditNarrative`) matches the DB predicate exactly post-fix. No blocking or major findings. Three flagged items are explicitly ACCEPTABLE (coverage partitioning sound, error-code shift is unreachable on the new UI path, deferred display is a UX improvement not a security requirement).
