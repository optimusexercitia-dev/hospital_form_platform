# PROGRESS archive — Phase 3

> Archived from `PROGRESS.md` to keep the live file small. Cross-phase logs
> (Bug Log, Test Run Summary, QA Verdicts, Decisions, Follow-ups) remain in
> `PROGRESS.md`. This file is the detailed record of Phase 3's tasks.

**Phase 3 — Admin Area & User Management** (completed 2026-06-12)

<details><summary>Phase 3 tasks</summary>

Scope (PHASES.md §Phase 3): `/admin` commission CRUD + assign/remove
staff_admins; `/c/[slug]/manage/members` staff_admin invites staff by email
(service-role server route), removes staff, sees member list. Acceptance: admin
creates a commission + assigns a staff_admin; staff_admin invites a staff user
(invite intercepted in tests); staff_admin of A cannot manage B.

Lead notes carried into this phase:
- Existing RLS (M6) already authorizes the full model: admin → commissions +
  commission_members ALL; staff_admin → insert/update/delete `staff` of own
  commission with an escalation guard (cannot create/promote staff_admin).
  Backend verifies this holds; a new migration is expected ONLY for member-email
  display (profiles has `full_name`, not email).
- staff_admin assignment is **by email** (assign existing user, or invite a new
  one) to mirror the staff invite flow. Service role required for invite +
  existing-user lookup; authorization re-checked server-side, never trusted from
  the client. Invite email is intercepted in E2E (Inbucket locally).

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| B1 · Plan: RLS coverage audit + member-email display decision (migration if needed) + type regen | backend | done | – | Lead-approved. RLS audit confirmed M6/M8 cover all Phase 3 authorization (no auth migration). Migration `20260612100009_profiles_email.sql`: `profiles.email citext` + backfill + signup-trigger update + email-change sync trigger (`on_auth_user_email_changed`) + partial unique index. ADR 0010. Types regenerated → `email: string \| null`. Backfill verified (8/8 personas). |
| B2 · Service-role server client factory (`src/lib/supabase/admin.ts`) | backend | done | – | `createAdminClient()`; `import 'server-only'` first line (build-time client-bundle guard); `SUPABASE_SERVICE_ROLE_KEY` + URL; `persistSession:false, autoRefreshToken:false`. `server-only@^0.0.1` pinned (lead-approved). |
| B3 · Admin queries (`src/lib/queries/commissions.ts`) | backend | done | B1 | `listCommissionsForAdmin()` → {id,name,slug,createdAt,memberCount,staffAdmins[]}; `getCommissionForAdmin(slug)` → detail + roster \| null. RLS-scoped cookie client; pt-BR sort. Signatures posted to lead/frontend. |
| B4 · Member queries (`src/lib/queries/members.ts`) | backend | done | B1 | `listMembers(commissionId)` → {userId,fullName,email,role,joinedAt}[]; staff_admin-first then name (pt-BR). Exported `sortMembers` helper. Canonical for member page + admin detail. |
| B5 · Server actions: commission CRUD + staff_admin assign/remove (admin); invite/remove staff (staff_admin\|admin) | backend | done | B2, B3, B4 | `src/lib/admin/actions.ts` (createCommission, updateCommission [name-only], assignStaffAdmin, removeStaffAdmin) + `src/lib/members/actions.ts` (inviteStaff, removeStaff) + shared `src/lib/members/invite.ts` (`resolveOrInviteUser`). `useActionState`-shaped, pt-BR, no raw PG errors. **Role hard-coded per action; authz re-verified server-side, commission-scoped, BEFORE any service-role write.** DB upsert behaviors verified via SQL. **QA MINOR-1 resolved:** `assignStaffAdmin`/`removeStaffAdmin` now also revalidate `/admin/comissoes/[slug]` (slug resolved from commissionId via the client already held) so the StaffAdminManager roster refreshes without navigation. Single-file change; no DB impact. lint + typecheck green (full project). |
| B6 · Seed touch-ups (if needed) + type regen + pgTAP regression check | backend | done | B1, B5 | No seed change needed (personas cover E2E; tests invite a novel address → Mailpit). New `45_email_denorm.sql` (5 tests: signup-sets-email, email-change-sync, co-member-reads-email, foreign-cannot). pgTAP **70/70** (was 65). Types regenerated, no drift. Backend-owned files typecheck+lint clean. |
| F1 · Admin commissions list + create (`/admin` real + create flow) | frontend | done | B3, B5 | Done 2026-06-12. Lead-approved. `frontend-design` applied (read SKILL.md from plugin dir — not invocable in runtime). `admin/page.tsx` replaces the "em breve" placeholder: `listCommissionsForAdmin()` → commission cards (name, mono slug, member count w/ GSAP count-up `StatCount`, coordinators) + "Nova comissão" `CommissionCreateForm` (name + auto-suggested slug). Verified: admin sees both seeded commissions; create action works end-to-end (then `db reset` to clean). lint+typecheck green. |
| F2 · Admin commission detail — edit + manage staff_admins (`/admin/comissoes/[slug]`) | frontend | done | B3, B5, F1 | Done 2026-06-12. Lead-approved. New route `admin/comissoes/[slug]/page.tsx`: `getCommissionForAdmin(slug)` → `notFound()` on null; `CommissionEditForm` (name editable, slug read-only/disabled — `updateCommission` is name-only); `StaffAdminManager` (assign-by-email `assignStaffAdmin` invite-if-new + roster + `removeStaffAdmin` behind `AlertDialog` confirm). Mutate actions key on hidden `commissionId` (per B5 impl) — wired accordingly. Verified: detail renders; assign works; unknown slug → 404 UI; AlertDialog keyboard-operable. |
| F3 · Commission member management (`/c/[slug]/manage/members`) | frontend | done | B4, B5 | Done 2026-06-12. Lead-approved. New `manage/members` route under `c/[slug]`: server-gated via `getCommissionAccess` → `notFound()` unless `staff_admin` of the commission OR admin (lead chose 404, no 403); `listMembers(commissionId)` roster (name/email/`RoleBadge`), `InviteStaffForm` (`inviteStaff`), `removeStaff` per staff row behind `AlertDialog` (own row + coordinators excluded). Verified per persona: chefe.ccih → 200 + list/invite; staff1.ccih → 404; cross-commission farmacia → 404; admin override → 200. |
| F4 · Wire nav + landing affordances | frontend | done | F1, F2, F3 | Done 2026-06-12. `nav-menu.tsx`: "Gerenciar" → real Link `manage/members` (staff_admin) — verified active/highlighted. `c/[slug]/page.tsx`: card model gained optional `path`; "Gerenciar membros" coordinator card now live (arrow affordance, no "em breve"); unshipped areas keep the tag. `/admin` placeholder fully replaced by F1. |
| F5 · Loading/error states + a11y + pt-BR polish for new screens | frontend | done | F1, F2, F3 | Done 2026-06-12. `loading.tsx`+`error.tsx` for `/admin`, `/admin/comissoes/[slug]`, `/c/[slug]/manage/members` (skeletons mirror each layout; pt-BR error boundaries, no raw PG errors — all surfaced via action state). a11y: every input has `<label>` via `Field`/`useFieldIds`; AlertDialog Enter-opens/Esc-closes (verified keyboard); `StatCount` respects `prefers-reduced-motion`. New primitive `ui/alert-dialog.tsx` (Radix). |

Phase 3 frontend notes:
- Adopted nullable `email: string \| null` (per B1/100009 — denormalized `profiles.email`, backfilled but nullable) by importing backend interfaces directly (`AdminCommissionListItem`, `StaffAdminSummary`, `MemberListItem`) so UI shapes can't drift; display falls back name→email→"Sem identificação".
- Mutation actions key on hidden `commissionId` (per B5 impl: `updateCommission`/`assignStaffAdmin`/`removeStaffAdmin`/`inviteStaff`/`removeStaff`); only `createCommission` reads `name`+`slug`. Forms send `commissionId` from the server-loaded id.
- Components added: `ui/alert-dialog.tsx`, `admin/{stat-count,commission-list,commission-create-form,commission-edit-form,staff-admin-manager,confirm-remove-button}.tsx`, `members/{role-badge,member-list,invite-staff-form}.tsx`.
- Success convention: actions return `{ ok:true, error:<pt-BR success copy> }`; banners now prefer the action's returned message (fallback to a default). `ConfirmRemoveButton` shows its error banner only when `!ok` so the success-copy-in-`error` never flashes as an error during the dialog's success-close. Re-verified 2026-06-12 against final backend modules: lint+typecheck green; 11/11 manual checks (gating matrix all personas + create→assign→remove lifecycle; success banner renders backend copy "Coordenador(a) atribuído(a) com sucesso."); DB reset to leave seed pristine.
- QA MINOR-2 resolved 2026-06-12: `ConfirmRemoveButton` now types its `action` prop against `ActionState` from `@/lib/admin/actions` (was incidentally `AuthState` from `@/lib/auth/actions`); structurally identical, so `removeStaff` stays assignable. lint+typecheck green, no behavior change.

</details>
