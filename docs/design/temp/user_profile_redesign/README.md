# Handoff: Perfil do Usuário + Diálogos (User Detail Page & Dialogs)

Target codebase: `optimusexercitia-dev/hospital_form_platform` (Next.js App Router + Tailwind v4 + shadcn-style components, pt-BR).

## Overview
The complete **user detail page** — the screen shown when a person is selected from the user directory at `/o/[org]/manage/usuarios` — plus the four dialogs opened from it:

1. **Perfil do usuário** (`/o/[org]/manage/usuarios/[userId]`) — full page in the org-manage shell.
2. **Editar dados pessoais** — dialog.
3. **Editar registros profissionais** — dialog.
4. **Adicionar vínculo hospitalar** — dialog.
5. **Adicionar a uma comissão** — dialog.

Information hierarchy on the page, in order of prominence: **situação da conta → vínculos hospitalares → comissões → dados pessoais → registros profissionais**.

## About the Design Files
The bundled files are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. The task is to **recreate these designs inside the existing Next.js codebase**, using its established patterns: Tailwind token classes, the `src/components/ui/*` primitives (Button, Input, NativeSelect, Dialog/AlertDialog, Label), lucide-react icons, existing server actions and RLS-scoped queries. Do not ship the HTML.

Open `Gestão de Usuários.dc.html` in a browser (keep `support.js` next to it). Implement:
- Section **Turno 2**, frame **2a** — the user detail page.
- Section **Turno 3**, frames **3a–3d** — the four dialogs.

Ignore the Turno 1 section (directory/register explorations covered by a separate handoff).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final and drawn from the codebase's own "Clinical Calm" tokens (`src/app/globals.css`). Recreate pixel-close, but always express values through the existing Tailwind tokens (`bg-accent text-accent-foreground`, `border-border`, `rounded-2xl`, `text-success`…) — never hardcode oklch values.

## Existing code to build on
- Route: `src/app/o/[org]/manage/usuarios/[userId]/page.tsx`
- Components: `src/components/users/user-lifecycle-actions.tsx`, `user-status-badge.tsx`, `affiliations-panel.tsx`, `credentials-editor.tsx`, `committee-role-assigner.tsx`, `user-profile-edit-form.tsx`
- Primitives: `src/components/ui/button.tsx`, `input.tsx`, `native-select.tsx`, `alert-dialog.tsx`, `label.tsx`
- Keep all documented invariants: RLS scoping, org_admin vs hospital_admin field ownership (ADR 0097 D14), "empty never means no-permission", zero-committee users are a legible expected state.

---

## Screen — Perfil do usuário (2a)

**Route:** `/o/[org]/manage/usuarios/[userId]` · **Purpose:** everything about one person, with account lifecycle actions.

### Page frame
Existing org-manage sidebar shell unchanged ("Usuários" active). Content column: existing padding (~24–32px), vertical stack gap 16px.

### 1 · Breadcrumb
`Usuários / Ana Beatriz Rocha` — 12px, muted; "Usuários" is a link back to the directory (hover: foreground color); current name `font-semibold text-foreground`. Separator "/".

### 2 · Identity band
Card: `bg-card border border-border rounded-2xl p-6`, horizontal flex, gap 18px, items-center, wraps.
- **Avatar**: 56px round, `bg-accent text-accent-foreground`, initials 18px semibold (existing avatar fallback).
- **Center block** (flex-1, min-width 260px, gap 5px):
  - Line 1: name — serif (IBM Plex Serif), 22px, semibold, `tracking-tight` — with `UserStatusBadge` inline (pill, uppercase 10px, `bg-accent text-accent-foreground` for Ativo).
  - Line 2: `ana.rocha@redea.org.br · Médica — Infectologia` — 13px, `text-muted-foreground`.
  - Line 3, chip row (gap 6px, wrap), all `rounded-full px-2.5 py-1 text-[11px] bg-muted`:
    - Credential chip: mono `CRM/SP 152.984` + inline `✓ verificado` in `text-success font-semibold` (sans) when verified.
    - `Na organização desde 12/03/2024` (muted, medium).
    - `Último acesso há 2 h` (muted, medium).
- **Actions** (right, gap 8px, wrap) — reuse `UserLifecycleActions` semantics with AlertDialog confirms:
  - `Reenviar convite` — outline; only when status = **pending**.
  - `Suspender` — outline, foreground text.
  - `Desativar` — outline, `text-destructive`, hover `bg-destructive/10`.
  - When deactivated: single `Reativar` primary replaces suspend/desativar.
  - Buttons: `rounded-lg px-3 py-2 text-xs font-semibold border border-border bg-card`, hover `bg-muted`.
  - Visible only when `canManageAccountStatus`; otherwise render the existing hospital-admin explanation note (ShieldAlert + `end_affiliation` copy) instead.

### 3 · Two-column grid
`grid grid-cols-[1fr_316px] gap-4 items-start`; stacks to one column below `lg`.

#### Main column (stack, gap 16px)

**Situação banner** — `bg-muted/60 border border-border rounded-xl px-4.5 py-3`, flex gap 10px, info glyph (ⓘ / lucide `Info`) + 12px muted text:
> **Situação: ativa.** Suspender ou desativar encerra o acesso em toda a plataforma, inclusive em outros hospitais. Para desligar apenas de um hospital, encerre o vínculo hospitalar abaixo.

Bold lead reflects current status (ativa / suspensa até {data} / pendente / desativada); rest of copy adapts accordingly.

**Vínculos hospitalares card** — `bg-card border border-border rounded-2xl p-6`, stack gap 14px.
- Header row (justify-between): serif h2 16px "Vínculos hospitalares" + caption 12px muted "Onde esta pessoa trabalha. Encerrar um vínculo preserva o histórico e não afeta a conta." Right: dashed ghost button `＋ Adicionar vínculo` (`border border-dashed border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-primary`, hover `bg-accent/50`) → opens dialog **3c**.
- Affiliation rows: `border border-border/60 rounded-xl px-4 py-3 flex justify-between items-center gap-3`:
  - Left: hospital name 13.5px semibold over `Matrícula 48.291 · desde 12/03/2024` (12px muted).
  - Right (gap 12px): status pill — Ativo: `bg-success/12 text-success` uppercase 10px semibold; Encerrado: `bg-muted text-muted-foreground` — plus `Encerrar` text button (`text-destructive text-xs font-semibold`, AlertDialog confirm) on active rows only.
  - Ended rows at `opacity-60` with date range (`fev 2021 – nov 2023`), no action.

**Comissões card** — same anatomy. Caption: "Onde esta pessoa participa, e o papel em cada uma." Action `＋ Adicionar a uma comissão` → dialog **3d**.
- Rows: commission full name (13.5px semibold) over `Hospital Santa Clara · desde mar 2024` (12px muted).
- Right (gap 12px): role pill — Coordenador(a): `bg-accent text-accent-foreground`; Membro: `bg-muted text-muted-foreground`; 10.5px semibold, `rounded-full px-2 py-0.5` — plus text buttons `Alterar papel` (`text-primary`) and `Remover` (`text-destructive`), both 12px semibold. Reuse `CommitteeRoleAssigner` actions; both confirm/act via existing patterns.
- Zero committees: dashed empty row "Sem comissão" (legible expected state — never hide the card).

**Histórico da conta card** — same card shell. Serif h2 16px. Vertical timeline:
- Each event: 2-col grid `14px 1fr`, gap 12px. Left: 8px dot (`bg-primary` for membership/lifecycle events, `bg-success` for verification, `bg-muted-foreground` for creation) + 1.5px connector line `bg-border/60` to the next event (omit after last).
- Right: line 1 — 12.5px, `<strong>` event title + muted detail (e.g. **Papel alterado para Coordenadora** na CCIH, por Renata Vaz (admin)); line 2 — timestamp `03/02/2025 14:12`, 11px mono muted. 14px bottom padding between events.
- Data source: existing audit-trail entries scoped to this user, newest first.

#### Rail (316px, stack gap 16px, cards `bg-card border border-border rounded-2xl p-5`)

**Dados pessoais** — header row: serif h3 15px + `Editar` text button (`text-primary text-xs font-semibold`) → dialog **3a**; org_admin only (hide button otherwise, keep note).
- Definition rows `flex justify-between text-[12.5px]` gap 9px: CPF (masked `412.•••.•84-20`, mono 11.5px) · Nascimento `14/02/1985` · Telefone `(11) 98123-4402` · Categoria `Médica` · Especialidade `Infectologia`.
- Footer note (11px muted, top border, pt-2.5): "Fatos sobre a pessoa — editáveis apenas pela administração da organização."

**Registros profissionais** — header + `Editar` → dialog **3b** (org_admin only; hospital_admin gets the existing read-only ShieldAlert note).
- Credential row: `border border-border/60 rounded-lg px-3 py-2 flex justify-between items-center`, mono 12px `CRM/SP 152.984` left, `✓ Verificado` (`text-success text-[11px] font-semibold`) right.
- Caption 11px muted: "Conselhos de classe (CRM, COREN, CRF…). Editar limpa a verificação atual."

**Acesso** — serif h3 15px, no edit action.
- Rows (12.5px, justify-between): Conta criada `12/03/2024` · Último acesso `hoje, 09:41` · Convite — `Aceito` in `text-success font-semibold` (or `Pendente` muted).
- Footer action (top border, pt-2.5): `Enviar redefinição de senha` — `text-primary text-xs font-semibold`, triggers existing reset action with confirm.

---

## Dialogs (3a–3d)

### Shared dialog anatomy
Modal over `bg-foreground/26` backdrop (use existing Dialog primitive). Panel: 460px wide, `bg-card border border-border rounded-2xl`, shadow `shadow-xl`, three zones:
- **Header** — `px-5.5 py-4.5 border-b border-border/60`, justify-between: serif title 17px semibold + subtitle 11.5px muted (always names the person: "Ana Beatriz Rocha · …"); ✕ close button (muted, 16px) top-right.
- **Body** — `px-5.5 py-4.5`, stack gap 13px. Labels 11.5px semibold; optional markers `(opcional)` in regular muted. Inputs/selects: `border border-input rounded-lg px-3 py-2 text-[13px]`; numeric identifiers (CPF, matrícula, council number) in `font-mono text-[12.5px]`.
- **Footer** — `px-5.5 py-3.5 border-t border-border/60`, right-aligned, gap 9px: `Cancelar` outline + primary CTA (`bg-primary text-primary-foreground rounded-lg px-3.5 py-2 text-xs font-semibold`, hover darker).

Focus states, ESC/overlay close, and focus trap per existing Dialog primitive. All submits go through existing server actions; on success close the dialog and revalidate the profile page; errors via existing `FormBanner` at the top of the body.

### 3a · Editar dados pessoais
Subtitle: "Ana Beatriz Rocha · fatos sobre a pessoa, visíveis em toda a organização."
Fields: Nome completo (full width) · CPF (mono) + Nascimento (2-col) · Telefone (full) · Categoria profissional (select from `listProfessionalCategories`) + Especialidade (opcional) (2-col).
Footer note 11px muted above buttons: "Alterações ficam registradas na trilha de auditoria da organização."
CTA: **Salvar alterações**. Base: existing `UserProfileEditForm`, moved into this dialog.

### 3b · Editar registros profissionais
Subtitle: "Ana Beatriz Rocha · conselhos de classe (CRM, COREN, CRF…)."
- **Warning banner** first: `bg-warning/12 border border-warning/30 rounded-lg px-3 py-2.5`, ⚠ glyph, 11.5px warning-tinted text: "Alterar o número ou o conselho **limpa a verificação atual** — o registro volta a ser verificado automaticamente no conselho."
- Repeatable **credential group**: `border border-border/60 rounded-xl p-3.5`, header row: `REGISTRO 1` (11px uppercase semibold muted) + inline `· ✓ verificado` (`text-success`, only if currently verified) — right: `Remover` (`text-destructive text-xs font-semibold`). Fields grid `1.1fr 0.7fr 1.2fr` gap 10px: Conselho (select: CRM/COREN/CRF/CRN…) · UF (select) · Número (mono input).
- `＋ Adicionar registro` dashed ghost button below.
- CTA: **Salvar registros**. Base: existing `CredentialsEditor`. Verification clears only for groups whose conselho/UF/número changed.

### 3c · Adicionar vínculo hospitalar
Subtitle: "Ana Beatriz Rocha passa a aparecer para os administradores do hospital escolhido."
- Hospital (select) with helper 11px muted below: "Já vinculada ao Hospital Santa Clara — hospitais com vínculo ativo não aparecem na lista." (options exclude hospitals with an active affiliation; hospital_admin: pre-locked to their hospital).
- Matrícula (mono) + Data de início (defaults to today) — 2-col.
- CTA: **Adicionar vínculo**. Base: existing `AffiliationsPanel` add action.

### 3d · Adicionar a uma comissão
Subtitle: "Ana Beatriz Rocha · comissões dos hospitais onde ela tem vínculo ativo."
- Comissão (select, options as "Nome da comissão — Hospital"; scoped to active-affiliation hospitals AND caller's scope) with helper: "CCIH e Revisão de Óbitos não aparecem — ela já participa." (exclude current memberships).
- **Papel** — two radio choice-cards, 2-col grid gap 10px, `rounded-xl p-3`:
  - Selected: `border-2 border-primary bg-accent/40`, filled radio dot.
  - Unselected: `border border-border`, hover `border-primary/45`, empty radio.
  - **Membro** — "Participa das reuniões e responde formulários da comissão."
  - **Coordenador(a)** — "Gerencia membros, pautas e publicações da comissão."
  - Card title 12.5px semibold; description 11px muted. Default: Membro.
- Início na comissão — date input, ~150px, defaults to today.
- CTA: **Adicionar à comissão**. Base: existing `CommitteeRoleAssigner` add action.

---

## Interactions & Behavior
- Row hover on affiliation/commission rows: none (rows are containers; only their inner text buttons are interactive). All destructive text buttons (`Encerrar`, `Remover`, `Desativar`) require AlertDialog confirmation.
- Card/section entrance: existing `.animate-rise-in` with staggered `--rise-delay`.
- Dialogs open from their triggers on the profile page; after a successful mutation, close + revalidate so the profile reflects the change (new affiliation row, new committee row, updated data, new timeline event).
- Responsive: below `lg` the rail stacks under the main column; identity band wraps (actions drop below the center block).
- Reduced motion respected globally.

## State Management
- Profile page: server component fetching user + affiliations + memberships + credentials + audit events (RLS-scoped).
- Dialogs: client components with local form state; submit via existing server actions; `useFormStatus`-style pending on CTAs.
- Status filter of visible actions derives from `status` + caller role (`canManageAccountStatus`, org_admin vs hospital_admin) — never hide data, only actions.

## Design Tokens (already in `src/app/globals.css` — use, don't redefine)
- Colors: `--background` porcelain, `--card` white, `--foreground` slate ink, `--primary` calm blue oklch(0.475 0.11 252), `--accent`/`--accent-foreground` soft blue tint, `--muted`/`--muted-foreground`, `--border`, `--success`, `--warning`, `--destructive`.
- Type: IBM Plex Sans body (tnum on), IBM Plex Serif for headings, IBM Plex Mono for CPF/matrícula/council numbers/timestamps.
- Radii: cards + dialogs `rounded-2xl` (~16–18px), inner rows/inputs `rounded-lg`–`rounded-xl`, pills `rounded-full`.
- Status pill mapping = existing `UserStatusBadge`. Keep label + color together — never color alone.

## Assets
No new assets. Icons: lucide-react (`Info`, `TriangleAlert`, `X`, `Check`, `ShieldAlert`, `Mail`, `PauseCircle`, `Lock`, `Unlock`, `Plus`). Avatars are initials-based (existing `avatar.tsx` fallback).

## Files in this bundle
- `Gestão de Usuários.dc.html` — interactive design reference (open in a browser; `support.js` must sit alongside). Implement **Turno 2 (2a)** and **Turno 3 (3a–3d)**.
- `support.js` — runtime for the reference file only; not part of the implementation.
