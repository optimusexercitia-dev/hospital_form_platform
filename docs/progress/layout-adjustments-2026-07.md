# Layout-adjustments batch — task detail (2026-07-02)

> Archived from PROGRESS.md "Current Phase Tasks" on 2026-07-02 at the §7 cleanup.
> Five scoped UI/UX adjustments delivered direct (no phase gate, human-approved), all
> verified live in the running app. PROGRESS.md keeps only a one-line pointer.

### Layout-adjustments batch (2026-07-02) — direct, no phase gate

Five scoped UI/UX adjustments (lead↔human interview; delivery = direct impl + lint/typecheck + live preview verify, no tester/qa gate — human-approved). All verified live in the running app (coordinator persona, `rede-a`/`ccih`).

| # | Change | Files | Status |
| - | ------ | ----- | ------ |
| L1 | "Minhas respostas" → bordered divider-row **list** (mirrors Casos), whole-row link + chevron (in_progress→resume, submitted→view) | `respostas/page.tsx`, `my-response-card.tsx` | ✅ verified |
| L2 | Status **pill badges**: "Em andamento" = blue (`accent`), "Enviada" = green (`success/12`); reuses `TOKEN_STYLES` | `my-response-card.tsx` | ✅ verified (computed colors) |
| L3 | Moved **Narrativas** builder from Configurações → **Construtor** page (route-based tabs "Formulários"/"Narrativas"); old `settings/narrativas` deleted (404s); `SettingsTabs` prop dropped; flag-gated | new `manage/forms/narrativas/page.tsx` + `construtor-tabs.tsx`; `manage/forms/page.tsx`; `settings-tabs.tsx` + 3 settings callers; `case-narratives/actions.ts` revalidate path | ✅ verified (tab loads; old route 404) |
| L4 | Fill-wizard `free_text` textarea starting height **doubled** (`min-h-20`→`min-h-40`, 80→160px); still `field-sizing-content`; other textareas untouched | `wizard/input-item.tsx` | ✅ verified (computed 160px) |
| L5 | Coordinators add **only already-registered** org users via searchable picker (invite-by-email removed); DEFINER RPC `list_addable_commission_members` (coordinator-gated, org-scoped, excludes members + `is_admin`), reworked `addStaff(userId)` action w/ server-side re-verify | migration `20260705000000`; `database.ts` (hand-added RPC type — regen on next `gen types`); `queries/members.ts`; `members/actions.ts`; new `add-member-picker.tsx`; `manage/members/page.tsx`; deleted `invite-staff-form.tsx` | ✅ verified end-to-end (add flow works; email path gone; t19 REVOKE ok) |

✅ Follow-up RESOLVED (2026-07-07): remote confirmed to already have `20260705000000`; `supabase gen types --local` regen was byte-identical (hand-added `list_addable_commission_members` type already matched — now authoritative), and the RPC was added to `docs/backend-state.md`.
