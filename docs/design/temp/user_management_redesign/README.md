# Handoff: Gestão de Usuários (User Management Redesign)

> ⚠ **Where this README disagrees with ADR 0133, the ADR wins.** Known stale points:
> the "escape hatch" below (line: *"invite now, configure later"*) is **NOT built**
> (0133 D8); CPF is **required**, never "(opcional)" (D6); step 1 is identifier-first
> (D7); CPF renders presence-only, no masked digits (D12); and the ADR 0097 D14
> field-ownership invariant cited under "Existing code to build on" is **amended by
> 0133 D1–D3** — a footprint-scoped hospital_admin now holds person-level authority.

Target codebase: `optimusexercitia-dev/hospital_form_platform` (Next.js App Router + Tailwind v4 + shadcn-style components, pt-BR).

## Overview
Redesign of the org-level user-management area (`/o/[org]/manage/usuarios`) to give it clear visual hierarchy: a person's **status → hospital affiliations → committee memberships → personal data → professional registrations**, in that order of prominence. Three screens:

1. **Diretório de usuários** — dense, scannable table with status filter pills (replaces the current card list).
2. **Perfil do usuário** — identity band + main column / side rail layout (replaces the current stacked-cards page).
3. **Registrar pessoa** — 3-step wizard with an "invite now, configure later" escape hatch (restructures the current register flow).

## About the Design Files
The bundled files are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. The task is to **recreate these designs inside the existing Next.js codebase**, using its established patterns: Tailwind token classes, the `src/components/ui/*` primitives (Button, Input, NativeSelect, AlertDialog, Stepper), lucide-react icons, existing server actions and RLS-scoped queries. Do not ship the HTML.

Open `Gestão de Usuários.dc.html` in a browser (keep `support.js` next to it). It shows two design options; **implement this combination**:

- Option **1a** → "Diretório — tabela" and "Perfil do usuário — faixa de identidade + trilho"
- Option **1b** → "Registrar pessoa — assistente em etapas" (the wizard; ignore 1a's slide-over panel)

Ignore everything else in the file (1b directory cards, 1b profile tiles).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy are final and are drawn from the codebase's own "Clinical Calm" tokens (`src/app/globals.css`). Recreate pixel-close, but always express values through the existing Tailwind tokens (e.g. `bg-accent text-accent-foreground`, `border-border`, `rounded-2xl`) — never hardcode oklch values.

## Existing code to build on
- Routes: `src/app/o/[org]/manage/usuarios/page.tsx`, `usuarios/[userId]/page.tsx`, `usuarios/novo/page.tsx`
- Components: `src/components/users/*` (user-directory-list, user-directory-search, user-status-badge, user-lifecycle-actions, affiliations-panel, credentials-editor, committee-role-assigner, user-profile-edit-form, register-person-flow, user-pagination)
- Primitives: `src/components/ui/button.tsx`, `input.tsx`, `native-select.tsx`, `alert-dialog.tsx`, `stepper.tsx`, `label.tsx`
- Keep all documented invariants: RLS scoping, org_admin vs hospital_admin field ownership (ADR 0097 D14), "empty never means no-permission", zero-committee users are a legible expected state.

---

## Screen 1 — Diretório de usuários (table)

**Route:** `/o/[org]/manage/usuarios` · **Purpose:** find a person fast and read their platform standing at a glance.

### Layout
Existing org-manage sidebar shell unchanged. Content column (`max-w-7xl`, existing padding), vertical stack, gap 24px:
1. Page header (unchanged pattern): org eyebrow (uppercase, `tracking-[0.16em] text-primary`), `h1` "Usuários" (serif display, ~30px) with primary button **"Registrar pessoa"** (UserPlus icon) right-aligned; muted description line below.
2. Toolbar row (`flex justify-between flex-wrap gap-3`):
   - Left: **status filter pills** — Todos · N / Ativos · N / Atenção · N / Desativados · N. Pill: `rounded-full px-3 py-1.5 text-xs font-semibold border`. Active: `bg-primary text-primary-foreground border-primary`. Inactive: `bg-card text-muted-foreground border-border`, hover `bg-muted`. "Atenção" = suspended ∪ pending.
   - Right: search input (~250px, placeholder "Buscar por nome, e-mail ou registro…") + hospital `<select>` (org_admin: "Hospital: todos"; hospital_admin: existing HospitalSwitcher behavior).
3. **Table card**: `bg-card border border-border rounded-xl overflow-hidden`.
   - Grid template: `minmax(230px,1.5fr) 96px minmax(150px,0.9fr) minmax(190px,1.2fr) 118px 22px`, column gap 12px, row padding `py-3 px-4.5`.
   - Header row: uppercase 10.5px, `font-semibold tracking-wider text-muted-foreground`, background `bg-muted/55`, bottom border. Columns: Pessoa · Situação · Vínculo hospitalar · Comissões · Registro · (chevron).
   - Row (entire row is a Link to the user page): top border `border-border/60`, hover `bg-accent/35`, focus-visible ring per codebase convention. Deactivated rows at `opacity-60`.
     - **Pessoa**: 34px round avatar (`bg-accent text-accent-foreground`, initials, 12px semibold) + name (13px, semibold, truncate) over email (11.5px, muted, truncate).
     - **Situação**: existing `UserStatusBadge` (pill, uppercase 10px).
     - **Vínculo hospitalar**: hospital name 12.5px; multiple → "2 hospitais"; none → "Sem vínculo hospitalar" in `text-muted-foreground` (expected state, not an error).
     - **Comissões**: wrap of chips `rounded-full px-2 py-0.5 text-[11px]`. Member: `bg-muted text-muted-foreground` ("CCIH · Membro"). Coordinator: `bg-accent text-accent-foreground` ("CCIH · Coordenadora"). Zero committees: dashed-border transparent chip "Sem comissão" (never an empty cell).
     - **Registro**: council credential in mono (`font-mono text-[11px] text-muted-foreground`, e.g. "CRM/SP 152.984"); "—" when none.
   - Footer row: "N pessoas" left, pagination right (reuse `UserPagination`), `text-xs text-muted-foreground`, top border.

### Behavior
- Filter pills set a `?status=` search param (server-filtered alongside existing `?search=` and `?hospital=`); counts computed from the unfiltered scoped set.
- Empty state: keep the existing dashed empty card and its exact copy rules (filtered vs org vs hospital wording).
- Row entrance: existing `.animate-rise-in` with 40ms stagger.

---

## Screen 2 — Perfil do usuário (identity band + rail)

**Route:** `/o/[org]/manage/usuarios/[userId]` · **Purpose:** everything about one person, hierarchy: status → hospitals → committees → personal → professional.

### Layout
Back link "← Todos os usuários" (existing pattern), then:

**Identity band** — `bg-card border border-border rounded-2xl p-6`, horizontal flex, gap 18px, items-center, wraps:
- 54px round avatar, initials 18px semibold, `bg-accent text-accent-foreground`.
- Center block: name (serif, ~22–24px, semibold) + `UserStatusBadge` inline; second line "email · categoria — especialidade" (13px muted); third line chips: mono credential chip `bg-muted rounded-full px-2.5 py-1 font-mono text-[11px]` with inline "✓ verificado" in `text-success` when verified, + "Na organização desde {data}" chip.
- Right: lifecycle actions (existing `UserLifecycleActions` semantics + AlertDialog confirms): "Suspender" outline; "Desativar" outline with `text-destructive hover:bg-destructive/10`; "Reenviar convite" (outline, Mail icon) only when status = pending; "Reativar" replaces both when deactivated. Visible only when `canManageAccountStatus`; otherwise render the existing hospital-admin explanation note (ShieldAlert + copy about `end_affiliation`) under the band.

**Two-column grid** — `grid grid-cols-[1fr_320px] gap-5 items-start` (stacks to one column < lg).

Main column (cards `bg-card border border-border rounded-2xl p-6`, gap 20px stack):
1. **Vínculos hospitalares** — serif h2 16px + muted caption ("Onde esta pessoa trabalha. Encerrar um vínculo preserva o histórico e não afeta a conta."), right-aligned dashed ghost button "＋ Adicionar vínculo" (`border-dashed text-primary`).
   Rows: inner bordered rows `border border-border/60 rounded-xl px-4 py-3 flex justify-between items-center`: hospital name (13.5px semibold) over "Matrícula {n} · desde {data}" (12px muted); right: status pill (Ativo: `bg-success/12 text-success`; Encerrado: `bg-muted text-muted-foreground`) + "Encerrar" text button (`text-destructive text-xs font-semibold`, AlertDialog confirm). Ended affiliations at `opacity-60` with date range.
2. **Comissões** — same card anatomy, action "＋ Adicionar a uma comissão". Rows: commission full name over "hospital · desde {data}"; right: role pill (Coordenador(a): `bg-accent text-accent-foreground`; Membro: `bg-muted text-muted-foreground`) + "Alterar papel" text button (`text-primary`). Reuse `CommitteeRoleAssigner` actions.

Rail (320px, gap 20px stack, cards `p-5`):
1. **Dados pessoais** — header + "Editar" text button (`text-primary text-xs font-semibold`; opens existing `UserProfileEditForm`, e.g. in a dialog or inline swap). Definition rows `flex justify-between text-[12.5px]`: CPF (masked, mono) · Nascimento · Telefone · Categoria. Footer note (11px muted, top border): "Fatos sobre a pessoa — editáveis apenas pela administração da organização." Non-org_admin: hide "Editar", keep note.
2. **Registros profissionais** — header + "Editar" (org_admin only; hospital_admin gets the existing read-only ShieldAlert note). Credential rows: bordered `rounded-lg px-3 py-2 flex justify-between`, mono number left, "✓ Verificado" (`text-success text-[11px] font-semibold`) right. Caption: "Conselhos de classe (CRM, COREN, CRF…). Editar limpa a verificação atual."

---

## Screen 3 — Registrar pessoa (3-step wizard)

**Route:** `/o/[org]/manage/usuarios/novo` · **Purpose:** create a person with as little or as much setup as the admin wants.

### Layout
Centered column, 620px wide, on the page background (no sidebar changes):
1. Back link "← Usuários", org eyebrow, serif h1 "Registrar pessoa", caption: "O convite por e-mail é enviado ao concluir — ou a qualquer momento, pulando as etapas restantes."
2. **Stepper** (reuse/extend `src/components/ui/stepper.tsx`): 3 steps — **Identificação → Vínculo hospitalar → Comissões**. Done: 26px filled `bg-primary` circle with check, label `text-primary`. Current: white circle, 2px `border-primary`, number, label semibold. Upcoming: `bg-muted text-muted-foreground`. Connectors: 2px line, `bg-primary` behind completed, `bg-border` ahead.
3. **Step card** — `bg-card border border-border rounded-2xl p-6`, serif step title 16px + muted caption, fields gap 15px, footer row split by top border: left "← Voltar" ghost; right "Pular etapa" outline + "Continuar →" primary. Final step: primary becomes "Registrar e enviar convite".
4. Footnote under card (11.5px muted): "Precisa só convidar? **Enviar convite agora** registra a pessoa apenas com nome e e-mail — vínculos e comissões podem ser configurados depois." — the bold part is a link/button that submits immediately with whatever is valid so far.

### Steps & fields
- **1 · Identificação** (required to proceed): Nome completo, E-mail, Categoria profissional (select from `listProfessionalCategories`), CPF (opcional, existing `CpfField`), Registro profissional (opcional — council + UF + number, existing `CredentialsEditor` in draft mode).
- **2 · Vínculo hospitalar** (skippable): Hospital (select; hospital_admin pre-locked via `?hospital=` as today), Matrícula, Data de início. Caption: "Você pode pular esta etapa — a pessoa fica registrada na organização sem vínculo hospitalar."
- **3 · Comissões** (skippable): repeatable rows of Comissão (select, scoped to caller) + Papel (Membro / Coordenador(a)), "＋ Adicionar outra comissão".

### Behavior & state
- Wizard state client-side (existing `register-person-flow.tsx` is the base — restructure into steps, one submit at the end via existing register action).
- "Pular etapa" advances without validating that step; "Enviar convite agora" is enabled once step 1 validates.
- Field labels 11.5px semibold; inputs `border border-input rounded-lg px-3 py-2 text-[13px]`; validation errors via existing `FormBanner` / field error patterns.
- On success: redirect to the new user's profile page; the person's status is **Pendente** until the invite is accepted.

---

## Design Tokens (already in `src/app/globals.css` — use, don't redefine)
- Colors: `--background` porcelain, `--card` white, `--foreground` slate ink, `--primary` calm blue oklch(0.475 0.11 252), `--accent` / `--accent-foreground` soft blue tint, `--muted` / `--muted-foreground`, `--border`, `--success` (verified, active affiliation), `--warning` (suspended: `bg-warning/15 text-warning`), `--destructive` (deactivated: `bg-destructive/10 text-destructive`; destructive actions).
- Type: IBM Plex Sans body (`font-feature-settings "tnum"` already global), IBM Plex Serif for h1–h3 (global), IBM Plex Mono for CPF/matrícula/council numbers (`font-mono`).
- Radii: cards `rounded-2xl` (~18px), inner rows/inputs `rounded-lg`–`rounded-xl`, pills `rounded-full`.
- Motion: `.animate-rise-in` + `--rise-delay` staggering; durations/easings from `@theme` motion tokens. Respect reduced motion (already global).
- Status pill mapping = existing `UserStatusBadge` (pending muted, active accent, suspended warning, deactivated destructive-muted). Keep label + color together — never color alone.

## Assets
No new assets. Icons: lucide-react (`UserPlus`, `Users`, `Building2`, `Mail`, `Lock`, `Unlock`, `PauseCircle`, `ShieldAlert`, `ArrowLeft`, `ChevronRight`, `Check`). Avatars are initials-based (existing `avatar.tsx` fallback).

## Files in this bundle
- `Gestão de Usuários.dc.html` — the interactive design reference (open in a browser; `support.js` must sit alongside). Use option **1a** directory + profile and the **1b** wizard.
- `support.js` — runtime for the reference file only; not part of the implementation.
