# Phase 3 QA Review — Admin Area & User Management

**Verdict: APPROVED**
**Reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-12
**Baseline:** ARCHITECTURE.md Rules 1–10 + PHASES.md Phase 3 acceptance criteria
**Test baseline:** pgTAP 70/70; Vitest 20/20; Playwright 43/43 (tester gate run 2026-06-12)
**Phase commit:** `cb28ef3`

---

## Summary

Phase 3 deliverables are complete, the security boundary is sound, and no blocking
findings were raised. The service-role client is correctly server-only guarded. All
authorization is re-verified server-side and commission-scoped before any
service-role write; the target role is hard-coded per action so a tampered form
cannot escalate privileges. The email-denormalization migration (M9/ADR 0010) opens
zero new RLS surface, is backed by 5 new pgTAP tests, and the nullable type is
handled correctly throughout the UI. All user-facing strings are pt-BR; raw Postgres
errors do not reach the UI; accessible input wiring and AlertDialog keyboard
operability are confirmed by E2E.

Two MINOR findings were raised during initial review; both were resolved in commit
`cb28ef3` (same session). One INFO item is carried to Phase 4 test-hardening.

---

## Detailed Findings

### MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` did not revalidate the detail page

**RESOLVED** in `cb28ef3` via `revalidateCommissionPages` helper in
`src/lib/admin/actions.ts:78-95`.

**File:** `src/lib/admin/actions.ts` (pre-fix lines 207, 246)
**Requirement:** CLAUDE.md §8 — UX quality bar; stale UI after mutation is a
quality defect.

`assignStaffAdmin` and `removeStaffAdmin` called `revalidatePath('/admin')` only.
Because both actions are invoked from `StaffAdminManager` on the detail page
(`/admin/comissoes/[slug]`), the coordinator roster on that page appeared stale
after mutation until the user navigated away and back. The list page (`/admin`)
refreshed correctly.

Fix applied: a `revalidateCommissionPages(client, commissionId)` helper resolves
the slug from `commissionId` (a small DB read against the RLS-scoped cookie client
so no service-role usage is introduced) and calls both `revalidatePath('/admin')` and
`revalidatePath('/admin/comissoes/${slug}')`. Called from both `assignStaffAdmin`
(line 236) and `removeStaffAdmin` (line 275). `updateCommission` already revalidated
both paths (lines 177, 178) and was unaffected.

Post-fix verification: lint + typecheck + Vitest 20/20 green; E2E 43/43 unchanged
(non-runtime fix — the revalidation gap was a UX issue, not a test-detectable
correctness failure at the time).

---

### MINOR-2 — `ConfirmRemoveButton` imported `AuthState` from `@/lib/auth/actions` for its action type

**RESOLVED** in `cb28ef3` at `src/components/admin/confirm-remove-button.tsx:8`.

**File:** `src/components/admin/confirm-remove-button.tsx:5` (pre-fix)
**Requirement:** ARCHITECTURE.md Rule 9 — clean module boundaries.

`ConfirmRemoveButton` typed its `action` prop against `AuthState` from
`@/lib/auth/actions`, while the actions it wraps (`removeStaffAdmin`,
`removeStaff`) return `ActionState` from their own modules. The two interfaces
were structurally identical at the time, so TypeScript accepted it and there was
no runtime issue. However, a future divergence between the two types would silently
widen `ConfirmRemoveButton`'s accepted action type and could mask incorrect callers
at compile time.

Fix applied: the import now references `ActionState` from `@/lib/admin/actions`
(which owns the canonical shape used by both admin and member server actions in
Phase 3). A brief inline comment notes that `members/actions` ActionState is
structurally identical, so the import from one module is intentional rather than
arbitrary.

Post-fix verification: lint + typecheck green; no runtime change.

---

### INFO-1 — AC1 E2E does not assert the "Coordenação" role badge renders

**Severity:** INFO (carried to Phase 4)

**File:** `e2e/phase3-admin-members.spec.ts:173-176`
**Requirement:** PHASES.md Phase 3 — admin assigns a staff_admin; staff_admin of
commission A cannot manage commission B.

AC1's "assigns a staff_admin by email" test asserts the assigned coordinator's
email appears in the "Coordenadores atuais" roster after the action (`toBeVisible`
on the email text). It does not also assert that the `RoleBadge` renders
"Coordenação" for that row, which would prove the role was written as `staff_admin`
and not `staff`. The functional requirement (role stored correctly at `staff_admin`)
is proven by the DB-level RLS pgTAP suite (`40_rls.sql` — escalation guard, insert
WITH CHECK). No correctness gap exists; this is a depth-of-E2E-coverage
observation.

Carry to Phase 4 test-hardening: add an assertion that the "Coordenação" badge is
visible in the same roster row as the assigned coordinator's email.

---

## Security / RLS Audit

### Service-role containment

| Check | Result | Evidence |
| ----- | ------ | -------- |
| `admin.ts` guarded by `import 'server-only'` | PASS | `src/lib/supabase/admin.ts:1` |
| `invite.ts` guarded by `import 'server-only'` | PASS | `src/lib/members/invite.ts:1` |
| `SUPABASE_SERVICE_ROLE_KEY` not `NEXT_PUBLIC_`-prefixed | PASS | `.env.local:12` — `SUPABASE_SERVICE_ROLE_KEY=...` only |
| `createAdminClient` called only from authorized action files | PASS | Zero hits in `src/app/**` and `src/components/**` (grep verified) |
| No service-role read on the display path (member/admin lists) | PASS | `listMembers` and `listCommissionsForAdmin` use the cookie client only |

### Authorization server-side and commission-scoped

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Admin actions re-verify `isAdmin` before any write | PASS | `requireAdmin()` at top of each action in `src/lib/admin/actions.ts` |
| `assignStaffAdmin` role hard-coded `'staff_admin'` | PASS | `src/lib/admin/actions.ts:196` — never read from `formData` |
| `inviteStaff` authorizes commission-scoped BEFORE service-role work | PASS | `authorizeStaffOps(commissionId)` at `src/lib/members/actions.ts:87` |
| `inviteStaff` role hard-coded `'staff'` with `ignoreDuplicates: true` | PASS | `src/lib/members/actions.ts:114-115` — tampered form cannot escalate; re-invite cannot demote a staff_admin |
| `removeStaff` has explicit `.eq('role', 'staff')` filter | PASS | `src/lib/members/actions.ts:162` |
| `removeStaffAdmin` uses cookie (RLS-scoped) client + `.eq('role', 'staff_admin')` | PASS | `src/lib/admin/actions.ts:232-241` |

### RLS policies — Phase 3 surfaces

| Policy / rule | Result | Evidence |
| ------------- | ------ | -------- |
| M6 `commission_members_staff_admin_insert` — `role='staff'` in WITH CHECK | PASS | `20260612100006_rls_policies.sql:152-154` |
| M8 `commission_members_staff_admin_update` — `role='staff'` in USING (demotion guard) | PASS | `20260612100008_rls_hardening.sql:13-14`; pgTAP `40_rls.sql:172-196` |
| M6 `commission_members_staff_admin_delete` — `role='staff'` in USING | PASS | `20260612100006_rls_policies.sql:162-163` |
| `profiles_select_self_or_admin` covers co-member email visibility (zero new policy surface for ADR 0010) | PASS | `20260612100006_rls_policies.sql:94-107` |
| `manage/members` page gate is server-side (not menu-hiding) | PASS | `src/app/c/[slug]/manage/members/page.tsx:32` — `notFound()` unless `staff_admin` of commission OR admin |
| `admin/layout.tsx` gate is server-side | PASS | `src/app/admin/layout.tsx:21-23` — `requireUser()` + `!isAdmin` → `notFound()` |

### Migration M9 / ADR 0010 (email denormalization)

| Check | Result | Notes |
| ----- | ------ | ----- |
| Column type `extensions.citext`, nullable | PASS | `20260612100009_profiles_email.sql:20` |
| Partial unique index (`where email is not null`) | PASS | `20260612100009_profiles_email.sql:33-35` |
| `handle_new_user()` updated with `CREATE OR REPLACE` preserving SECURITY DEFINER | PASS | `20260612100009_profiles_email.sql:43-59` |
| Email-change sync trigger fires only on distinct change | PASS | `sync_profile_email()` guards with `if new.email is distinct from old.email` (`20260612100009_profiles_email.sql:73`) |
| Nullable type `string \| null` propagated to generated types | PASS | `src/lib/types/database.ts` diff — `email: string \| null` in Row/Insert/Update |
| UI falls back gracefully on null email | PASS | All display sites use `fullName?.trim() \|\| email \|\| 'Sem identificação'` pattern |
| pgTAP coverage: signup, email-change, co-member read, foreign-commission denial | PASS | `supabase/tests/45_email_denorm.sql` — 5 tests, all green (total pgTAP 70/70) |

---

## Code Quality Audit

| Check | Result | Notes |
| ----- | ------ | ----- |
| Data access goes through `src/lib/queries/` (Architecture Rule 9) | PASS | Zero inline supabase queries in `src/app/**` or `src/components/**` |
| No `any` types without inline justification | PASS | No `any` annotations or `as any` casts found in Phase 3 files |
| Server Components by default | PASS | All new pages are Server Components; `"use client"` limited to interactive islands |
| File ownership respected (backend: `src/lib/**`, `supabase/**`; frontend: `src/app/**`, `src/components/**`) | PASS | Git status confirms no crossover |
| Generated types regenerated after M9 | PASS | `src/lib/types/database.ts` diff adds `email: string \| null` to profiles shape |
| `'use server'` on all action files | PASS | `src/lib/admin/actions.ts:1`, `src/lib/members/actions.ts:1`, `src/lib/auth/actions.ts:1` |
| Migration is forward-only / additive | PASS | M9 adds a column, creates triggers, creates index — no DROP or ALTER of prior constraints |

---

## UX & Accessibility Audit

| Check | Result | Notes |
| ----- | ------ | ----- |
| All user-facing strings pt-BR | PASS | Consistent throughout admin, commission manage, and error boundaries |
| Raw Postgres/Supabase errors never reach the UI | PASS | All action catch branches return `MESSAGES.generic`; error boundaries render pt-BR copy only |
| `htmlFor` / `aria-describedby` / `aria-invalid` wired correctly | PASS | `useFieldIds` pattern used in all new forms (`CommissionCreateForm`, `CommissionEditForm`, `StaffAdminManager`, `InviteStaffForm`) |
| AlertDialog keyboard operability (Enter open, Esc cancel, Tab+Enter confirm) | PASS | AC4 E2E test covers all three flows end-to-end |
| `StatCount` respects `prefers-reduced-motion` | PASS | Noted in F5 task notes; Radix + CSS guard in place |
| No dead `#` links | PASS | "em breve" items rendered as `<span aria-disabled="true">`, not `<a>` |
| Loading and error boundaries present for new routes | PASS | `admin/loading.tsx`, `admin/error.tsx`, `admin/comissoes/[slug]/loading.tsx`, `admin/comissoes/[slug]/error.tsx`, `manage/members/loading.tsx`, `manage/members/error.tsx` — all render pt-BR copy, no raw error exposed |

---

## Requirements / Acceptance Audit

| Acceptance criterion (PHASES.md Phase 3) | Status | Notes |
| ---------------------------------------- | ------ | ----- |
| Admin creates a commission and it appears in the list | PASS | AC1 E2E — commission name + slug asserted as exact visible text values |
| Admin opens commission detail page | PASS | AC1 E2E — `getByRole('heading', { level: 1 })` asserts commission name |
| Admin assigns a staff_admin by email; coordinator appears in roster | PASS | AC1 E2E — email asserted visible in "Coordenadores atuais" roster |
| Staff_admin invites a novel staff user via Mailpit intercept | PASS | AC2 E2E — Mailpit REST API confirms delivery to exact address |
| Staff_admin removes a staff member via AlertDialog | PASS | AC2 E2E — member row asserts not visible after confirm; Cancel keeps row |
| Staff_admin of commission A cannot manage commission B | PASS | AC3 E2E — `chefe.farm` → `/c/ccih/manage/members` → 404; no ccih member data visible |
| Staff (non-coordinator) cannot reach manage/members | PASS | AC3 E2E — `staff1.ccih` → `/c/ccih/manage/members` → 404 |
| Non-admin cannot reach `/admin` | PASS | AC3 E2E — HTTP 404 + rendered 404 page; no admin UI visible |
| Admin can access any commission's manage page | PASS | AC3 E2E — `admin@test.local` → `/c/farmacia/manage/members` → 200 + member UI |
| Keyboard-only commission create | PASS | AC4 E2E — focus, fill, Tab, Enter all via keyboard |
| AlertDialog keyboard ops (Enter open, Esc cancel, Tab+Enter confirm) | PASS | AC4 E2E — all three verified |

---

## Hygiene Audit

| Check | Result | Notes |
| ----- | ------ | ----- |
| ADR 0010 exists and is sound | PASS | `docs/decisions/0010-denormalize-email-on-profiles.md` — rationale, alternatives, consequences documented |
| `PROGRESS.md` accurately reflects Phase 3 state | PASS | All tasks marked done; Bug Log empty (no application bugs filed); Test Run Summary accurate |
| Secrets only in `.env.local` | PASS | `SUPABASE_SERVICE_ROLE_KEY` not `NEXT_PUBLIC_`-prefixed; `.env.local` is gitignored |

---

## Checklist Summary

| Area | Result |
| ---- | ------ |
| Requirements / Acceptance (all 11 AC bullets) | PASS |
| Service-role containment | PASS |
| Authorization server-side and commission-scoped | PASS |
| RLS policies cover all Phase 3 write surfaces | PASS |
| Migration M9 / ADR 0010 sound | PASS |
| TypeScript strict — no unjustified `any` | PASS |
| Data access through `src/lib/queries/` | PASS |
| Server Components by default | PASS |
| File ownership respected | PASS |
| pt-BR user-facing strings | PASS |
| No raw Postgres errors in UI | PASS |
| Accessible inputs + keyboard flows | PASS |
| ADRs for non-trivial decisions | PASS |
| `PROGRESS.md` reflects reality | PASS |
| Secrets only in `.env.local` | PASS |
| MINOR-1 revalidation gap | RESOLVED (`cb28ef3`) |
| MINOR-2 cross-module `AuthState` import | RESOLVED (`cb28ef3`) |
| INFO-1 AC1 role-badge assertion depth | CARRIED to Phase 4 |

---

## Verdict

**APPROVED**

No blocking requirements, RLS holes, or service-role leaks found. Both MINOR
findings were addressed in commit `cb28ef3` before the phase was recorded. The
INFO item (AC1 E2E should also assert the "Coordenação" RoleBadge for the assigned
coordinator) is a test-depth improvement carried to Phase 4.
