# Handoff: Casos board redesign (`manage/cases`)

## Overview
Redesign of the per-commission cases board at `src/app/o/[org]/c/[commission]/manage/cases/page.tsx` ("Casos"). Goals: make the KPI strip actionable, and make filtering — the chair's most-used feature — fast for common filters while offering granular options. All UI copy is pt-BR.

Changes vs. the current implementation:
1. **Clickable KPI cards** that apply their corresponding filter (toggle on/off; active card gets a ring + "Filtrando" tag). New KPI set: Em aberto, Fases ativas, Etapas pendentes, **Fases atrasadas** (new — overdue active/pending phases by `dueDate`), Encerrados no mês, Itens de ação em atraso (a link out to the action-items page, not a filter).
2. **Outcome breakdown compacted** from a large panel into a one-line collapsible strip: stacked proportional bar + "% adversos (n/total)" + expand chevron revealing per-outcome rows.
3. **Filtering system**: saved-view tabs → quick chip row → active-filters summary → advanced side panel (details below).
4. Table and Kanban views unchanged in structure, driven by the shared filter state.

## About the Design Files
The files in this bundle are **design references created in HTML/React (Babel-in-browser)** — prototypes showing intended look and behavior, NOT production code to copy. Recreate them in the existing Next.js + Tailwind v4 + shadcn-style codebase using its established patterns: existing tokens in `src/app/globals.css`, `cn()`, lucide-react icons, `NativeSelect`, badge components in `src/components/cases/case-status-badge.tsx`, and the derivation helpers in `src/components/cases/case-derive.ts`.

## Fidelity
**High-fidelity.** Colors, spacing and type match the app's existing "Clinical Calm" tokens (`globals.css`). Recreate pixel-perfectly but express every color through the existing CSS variables / Tailwind semantic classes — never hardcoded values.

## Existing code to build on (repo: optimusexercitia-dev/hospital_form_platform)
- `src/app/o/[org]/c/[commission]/manage/cases/page.tsx` — server page; keep its gating, data loading, empty state, create dialogs, `?view=` param.
- `src/components/cases/cases-view.tsx` — client orchestrator; this is the file the redesign mostly replaces/extends.
- `src/components/cases/cases-table.tsx`, `cases-kanban.tsx` — keep as-is (minor: kanban card gains an "· Atrasada" marker when `hasOverdueWork`).
- `src/components/cases/cases-kpi-strip.tsx` — rework per below.
- `src/components/cases/case-derive.ts` — add `isOverduePhase` / `hasOverdueWork` / overdue counts (twin of the `isOverdue` in `format.ts`).
- `src/lib/cases/case-status.ts` — fixed 5-status enum, labels, `CASE_STATUSES` order. Unchanged.

## Layout (top → bottom, single column, gap 20px, max-width 1280px)
1. **Header** — unchanged from current page: uppercase commission eyebrow (primary color, tracking .16em), serif h1 "Casos", muted description; right: outline "Múltiplos casos" + primary "Novo caso".
2. **KPI strip** — `grid-cols-6` (collapse to 3 below ~1100px), gap 12.
3. **Desfechos strip** — full-width card, only when ≥1 case has an outcome.
4. **Toolbar row** — saved-view tabs (left) · search input + Tabela/Kanban segmented toggle (right).
5. **Quick chip row**.
6. **Active-filters summary bar** (conditional).
7. **Count line** — "N casos" / "N de M casos".
8. **Table or Kanban**.

## Components

### KPI card (button)
- Card: `bg-card border border-border rounded-[14px] shadow-xs p-[14px_16px]`, text-left.
- Label 11.5px/600 muted → value 27px/700 tabular → sub-line: 6px tone dot + 11.5px muted text.
- Hover: border tints toward primary + larger shadow. Active (its filter applied): `border-primary` + 3px ring `ring/18%` + tiny "Filtrando" pill top-right (10px/600, primary on accent bg).
- Click mapping (toggle semantics — clicking an active card clears only its own fields):
  - Em aberto → status = open (non-terminal) — a virtual "abertos" status value
  - Fases ativas → status = `in_review`
  - Etapas pendentes → status = `pending`
  - Fases atrasadas → overdue = true
  - Encerrados no mês → status = `completed` + period = "Este mês"
  - Itens de ação em atraso → **not a filter**; a link (`<a>`) to the action-items page, external-link icon beside the label, value in destructive when overdue > 0, sub "de N abertos".
- Applying a KPI filter **resets other filters** (keeps search query) so the number shown ≈ the rows listed.

### Desfechos strip (collapsible)
- Header row (whole row is the toggle button, p 12px 16px): "Desfechos" 13.5/600 · "N casos com desfecho" 12px muted · flex-1 stacked bar (h 8px, rounded-full, segments sized count/total, colored by the outcome's palette token via `TOKEN_COLOR_VAR`) · "P% adversos (a/n)" 12.5/600 destructive · chevron (rotates 180° when open).
- Expanded body: top hairline, grid `auto-fill minmax(220px,1fr)`, rows = outcome badge (`CaseStatusBadge`) + optional uppercase "ADVERSO" marker + right-aligned "count · pct%" muted tabular.

### Saved views (tabs)
- Segmented-tab container: `bg-muted border border-border rounded-[11px] p-[3px]`; tabs h30, 12.5px/500, radius 8; active = `bg-card` + shadow-xs + 600.
- Built-in views: **Todos os casos** (no filters), **Fila de revisão** (status `in_review`), **Atrasados** (overdue), **Adversos em aberto** (status open + apenas adversos).
- User views: persisted (suggest `localStorage` per commission or a `user_case_views` table); deletable via an × that appears on hover.
- Active tab = deep-compare current filter state (ignoring search query) against each view. When no view matches, a "**Salvar visão**" tab appears (bookmark icon, primary color) opening a small name dialog ("Os filtros atuais ficarão disponíveis como uma aba…", input + Cancelar/Salvar; Enter submits).

### Quick chip row
Pills h30, radius full, 12px/500, `bg-card border-border` muted text; gap 6, wraps.
- **Status filter** — two variants in this bundle; implement ONE (product decision):
  - **Variant A (fixed chips)** — `Casos (Cases Board).html`: "Todos" + the five fixed statuses in `CASE_STATUSES` order. Each carries a 7px status-color dot (from `TOKEN_COLOR_VAR`) + a live count pill (11px/600 tabular on `bg-muted`). Single-select; active chip = `bg-primary text-primary-foreground` (count pill goes translucent white). Followed by a hairline divider (1×20px).
  - **Variant B (dropdown chip)** — `Casos (Cases Board) — Status Dropdown.html`: a "Status" drop-chip like Desfecho/Período. Popover: "Todos os status" (with total count), divider, then one item per status with its 7px color dot, label, right-aligned muted count, and a checkmark on the selected item. Set-state chip reads "Status: <label>" with accent styling. In the prototype the variant is toggled by `window.STATUS_AS_DROPDOWN = true` set in the variant HTML before the JSX loads.
- **Desfecho drop-chip**: chip with chevron; when set, label reads "Desfecho: <label>" and chip gets accent styling (`bg-accent text-accent-foreground`, 600). Popover menu (min 230px, radius 12, shadow-lg, p 6): "Todos os desfechos", "Sem desfecho", divider, then one item per outcome rendered as its badge; checkmark on the selected item. Single-select.
- **Período drop-chip**: presets Qualquer data / Últimos 7 dias / Últimos 30 dias / Últimos 90 dias / Este mês, divider, uppercase micro-header "Intervalo personalizado" + two date inputs (De/Até). Filters on `case.createdAt`. Set-state chip reads "Período: <preset|dd mmm – dd mmm>".
- **"Fase atrasada" toggle chip**: alert-triangle icon; active state = destructive tint (`bg destructive/8 on white, border destructive/35, text destructive`). True when any active/pending phase has `dueDate < today` on a non-terminal case.
- **"Mais filtros" button** (right-aligned, `margin-left:auto`): filter icon + label + count badge (17px round, primary bg) showing how many panel-owned filters are active; border/text go primary when count > 0. Opens the side panel.

### Advanced filter panel (right sheet)
- Overlay `rgb(20 28 40/.32)`; sheet 380px (max 92vw), `bg-card`, left hairline, shadow-lg; slides in 220ms cubic-bezier(.22,1,.36,1). Esc/overlay click closes.
- Header: serif "Filtros avançados" + ghost "Limpar" (resets panel-owned fields only) + × .
- Body sections (each: uppercase 11px/600 muted title, hairline separators; a "Limpar" micro-link appears when the section has selections):
  1. **Responsável** — checkbox list of commission members, multi; right-aligned per-option count of matching cases (11.5px muted tabular). Checkbox: 16px rounded-[5px], checked = primary bg + white check.
  2. **Tipo de caso** — same checkbox list pattern (org case types).
  3. **Etiquetas** — toggle chips (h28, pill); multi, OR semantics.
  4. **Unidade / setor** — checkbox list (hospital departments), with counts.
  5. **Progresso das fases** — single-select chips: Qualquer / Nenhuma concluída / Em andamento / Todas concluídas (uses `phaseProgress` done vs total).
  6. Switches: **Sem responsável** (`hasUnassignedWork`), **Apenas desfechos adversos** (`outcome.isAdverse`). Switch 30×18, primary when on.
- The panel edits a **draft** copy; footer: live preview count "N casos" (left) + outline Cancelar + primary "Aplicar filtros" (flex-1). Apply commits the draft.

### Active-filters summary bar
- Rendered when ≥1 filter (other than search) is active. Container: `bg-accent`, border `accent-foreground/14%`, radius 11, p 9px 12px.
- "N filtros ativos" 11.5/600 accent-fg, then one removable chip per filter value: white pill h24 with `<b>Category</b> · value` and an × button (hover → destructive). One chip per selected value (e.g. each responsável separately).
- Right: "Limpar tudo" text button (resets everything but search).

### Search + view toggle
- Search: h34, w220, rounded-[10px], `bg-card border-border`, leading search icon; placeholder "Buscar caso, rótulo ou etiqueta". Searches case number, formatted "Caso NNNN", label, and tag names (plus custom-field labels/values when that flag is on, as today).
- Segmented Tabela/Kanban: as current, with table/kanban glyphs; keep `?view=` History-API sync from `cases-view.tsx`.

## Filter state (client)
```ts
{
  status: "todos" | "abertos" | CaseStatus,   // "abertos" = any non-terminal
  outcome: null | "sem" | outcomeId,          // single-select
  period: "all" | "7d" | "30d" | "90d" | "month" | { from?: ISO, to?: ISO },
  overdue: boolean,
  resp: string[], types: string[], tags: string[], depts: string[],  // multi, OR within a group
  semResp: boolean, adverseOnly: boolean,
  progress: "any" | "none" | "partial" | "all",
  q: string,
}
```
All groups AND together; values within a multi group OR. All filtering stays client-side over the loaded board rows (as today). Chip counts are computed over the **unfiltered** row set; the panel preview count over the draft filter.

## Interactions & animation
- Row/card click → case detail (keep the `staffCaseRoute` fork).
- Cards/KPIs rise in (`animate-rise-in`, 60ms stagger for KPIs, 40ms for kanban cards).
- Popovers close on outside click and Esc.
- Table sorting unchanged: Caso (default desc) / Status / Criado.
- Empty filtered table: "Nenhum caso corresponde aos filtros."

## Design tokens (from `src/app/globals.css` — use the variables, not these literals)
- bg `oklch(.985 .004 95)` · card `#fff` · border `oklch(.9 .008 250)` · fg `oklch(.23 .018 230)` · muted-fg `oklch(.52 .022 252)`
- primary `oklch(.475 .11 252)` · accent `oklch(.95 .022 250)` / accent-fg `oklch(.42 .105 252)`
- destructive `oklch(.55 .2 25)` · success `oklch(.55 .09 158)` · warning `oklch(.62 .13 65)`
- Status colors ONLY via `CASE_STATUS_META` + `TOKEN_COLOR_VAR` / `TOKEN_STYLES` (case-status-badge.tsx). Never re-map.
- Fonts: IBM Plex Sans (UI), IBM Plex Serif (h1/section titles/panel title), IBM Plex Mono (case ids). Tabular numerals everywhere.
- Radii: chips/pills 999px · buttons/inputs/popover items 8–10px · cards 14px · table/panel containers 16px · popovers/sheets 12px.
- Shadows: `shadow-xs` on cards; `0 8px 30px rgb(35 45 60/.12)` on popovers/sheet.

## Assets
None. Icons are lucide-react equivalents: search, plus, layers, filter, x, chevron-down, clock, calendar, calendar-clock, check, alert-triangle, bookmark, external-link, table, kanban-square, arrow-up/down, chevrons-up-down.

## Files in this bundle
- `Casos (Cases Board).html` — entry point, status Variant A (open in a browser)
- `Casos (Cases Board) — Status Dropdown.html` — status Variant B (same sources, `window.STATUS_AS_DROPDOWN = true`)
- `cases-redesign.css` — all styles (token block mirrors globals.css)
- `cases-data.js` — sample rows in the `CaseBoardRow`-like shape + derivation twins
- `cases-ui.jsx` — icons/badges/avatar/phase-dots primitives
- `cases-filters.jsx` — filter model, saved views, chips, popovers, side panel, summary bar
- `cases-views.jsx` — table + kanban
- `cases-app.jsx` — shell, KPI strip, outcome strip, orchestration
