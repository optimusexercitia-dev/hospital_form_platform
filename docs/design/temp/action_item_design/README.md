# Handoff: Action Item Detail — Redesign

## Overview
Redesign of the Action Item detail page at
`src/app/o/[org]/c/[commission]/itens-de-acao/[itemId]/page.tsx` in
`optimusexercitia-dev/hospital_form_platform`. The current page stacks two cards
("Detalhes" and "Acompanhamento") in one column with weak hierarchy. The redesign
moves to a **work column + metadata side rail** layout, adds a lifecycle stepper,
an overdue escalation banner, a unified activity timeline (team updates + system
events), and several data-model extensions (priority, watchers, linked items,
item code). All copy is pt-BR.

## About the Design Files
The files in this bundle are **design references created in HTML/React (Babel
in-browser)** — a prototype showing intended look and behavior, **not production
code to copy directly**. The task is to recreate this design in the existing
Next.js App Router codebase using its established patterns: Tailwind v4 +
shadcn/ui components, the token set in `src/app/globals.css`, lucide-react
icons, `src/lib/queries/` for reads, server actions for mutations, RLS as the
authority, pt-BR user-facing strings (Rule 10).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final and are
drawn from the app's own `globals.css` tokens (the prototype re-declares them as
plain CSS; the real implementation should use the existing Tailwind classes —
`bg-card`, `text-muted-foreground`, `rounded-2xl`, `shadow-xs`,
`animate-rise-in`, etc. — never new hex values). Recreate pixel-perfectly.

## Layout
App shell is unchanged (existing `AppSidebar` + `max-w-7xl` main). Inside the
page:

```
grid-template-columns: minmax(0,1fr) 316px;  gap: 24px;  align-items: start
├─ Work column (flex col, gap 18px)          ├─ Side rail (sticky top-28px, gap 14px)
│  1. Back link "Meus itens de ação"         │  A. Detalhes (meta card)
│  2. Escalation banner (conditional)        │  B. Lembretes
│  3. Header (badges, h1, actions, desc)     │  C. Observadores
│  4. Lifecycle stepper card                 │  D. Itens vinculados
│  5. Checklist card
│  6. Atividade card (composer + timeline)
```
Collapse to one column below ~1080px (rail follows the work column). Cards:
`bg-card border border-border rounded-2xl shadow-xs`, padding `18px 20px`,
entrance `animate-rise-in` staggered ~40ms per card via `--rise-delay`.

## Screens / Components

### 1. Header (no card — sits on the page background)
- Eyebrow row (flex wrap, gap 8px) of badges, in order:
  - **Item code** `AI-2026-0114` — outline pill, `font-mono`, 11px/500.
  - **Status pill** — uppercase, 11px/600, tracking .04em. Tones:
    `open` = `bg-secondary text-secondary-foreground` · `in_progress` =
    `bg-accent text-accent-foreground` · `done` = `bg-success/12 text-success` ·
    `cancelled` = `bg-muted text-muted-foreground`. (Render the tenant
    `statusLabel`, keyed by status key — matches `ActionItemStatusBadge`.)
  - **Priority badge** — flag icon; `alta` = warning tint
    (`border-warning/30 bg-warning/10 text-warning`), `critica` =
    `bg-destructive/10 text-destructive`, `media` = secondary, `baixa` = muted.
  - **Source badge** — outline pill, folder-open icon, "Caso" / "Reunião" /
    "Item avulso" (existing `ActionItemSourceBadge`).
  - **Visibility badge** — existing `VisibilityScopeBadge` (lock, warning tint
    for `case_restricted`; `committee` stays unbadged).
- Title: h1, IBM Plex Serif 600, 27px/1.25, `text-balance`, letter-spacing -0.01em.
- Right of the title (same row, wraps under on narrow): **contextual actions**
  - `open` → primary "Iniciar item" (play icon)
  - `in_progress` → primary "Concluir item" (check icon)
  - active + coordinator → ghost destructive "Cancelar" (ban icon)
  - `done`/`cancelled` → outline "Reabrir item" (rotate-ccw icon)
  - Buttons: h-34px (h-9 is fine), radius 10px, 13px/500.
- Description: 14px `text-muted-foreground text-pretty`, max-width 62ch.

### 2. Escalation banner (conditional, above the header)
- Shown when the item is active and `dueDate < today`:
  radius 14px, `border-destructive/25`, bg = destructive mixed ~6% into white,
  34px icon chip (`bg-destructive/12 text-destructive`, alert-triangle).
  Title 13.5px/600 destructive: "Prazo vencido há N dias"; sub 12.5px muted:
  "O prazo era DD/MM/AAAA. Registre um impedimento ou ajuste o prazo com a
  coordenação." Right-aligned small buttons: "Registrar impedimento" (sets the
  composer type to `blocker` and focuses it) and, coordinator only,
  "Alterar prazo" (opens the due-date editor in the rail).
- When `status = done`: success variant — check-circle icon, "Item concluído",
  "Concluído por {nome} em {data}."
- Hidden when cancelled or no due date.

### 3. Lifecycle stepper (card)
- Three equal steps: **Aberto → Em andamento → Concluído**; each step = 26px
  circle + connector line + label 13px/600 + date 11.5px muted (tabular).
  - done: circle `bg-success border-success text-white` with check; connector
    tinted success.
  - current: white circle, `border-primary text-primary`, 3px ring
    `primary/15`, solid 8px dot inside.
  - pending: muted border/label.
- `cancelled` replaces the stepper with one muted line: ban icon chip + "Este
  item foi cancelado em {data}. Reabra-o para retomar o acompanhamento."
- Dates: opened = createdAt date, started = first transition to in_progress,
  completed = completedAt.

### 4. Checklist (card)
- Header: serif title "Checklist", sub "Divida esta ação em passos
  verificáveis.", right-aligned "N de M concluídas" (12.5px muted, tabular).
- Progress row: 6px full-width bar (`bg-muted` track, `bg-primary` fill,
  radius 999, width transition 300ms `--ease-out-soft`) + "NN%" 12.5px/600.
- Rows: 18px rounded-md custom checkbox (checked = `bg-primary` + white check),
  title 13.5px; done rows: strikethrough + muted, right meta "{quem} · {DD/MM}"
  11.5px muted. Row hover: faint muted bg, radius 10px.
- Add row (contributors only): input "Nova subtarefa…" + outline "Adicionar"
  (plus icon), Enter submits. Reuse `checklist-section.tsx` mutations.

### 5. Atividade (card) — unified timeline
- Header: serif "Atividade", sub "Atualizações da equipe e eventos do ciclo de
  vida, em ordem cronológica." Right: filter pills **Tudo · Atualizações ·
  Sistema** (active = `bg-primary text-primary-foreground`).
- **Composer** (top, contributors only): inset panel (border, radius 12px, bg
  muted/35): segmented control for type — Progresso · Nota · Impedimento ·
  Alteração de prazo (order from `UPDATE_TYPE_ORDER`) — textarea (blocker type
  swaps the placeholder to "Descreva o impedimento e o que é necessário para
  destravá-lo…"), primary sm "Registrar atualização" (send icon), disabled when
  empty.
- **Feed** (newest first). Two entry kinds sharing a 32px icon column with a 2px
  connector line between entries:
  - *Update*: icon chip tinted by type (progress = accent, blocker =
    destructive/10, deadline_change = warning/12, note = muted — reuse
    `UPDATE_TYPE_META`), author 13px/600, type chip (10.5px/600 pill, same
    tint), right-aligned timestamp 11.5px muted, body 13.5px.
  - *System event*: single muted 12.5px line with bold entities ("**Enf.
    Beatriz Santoro** iniciou o item — status alterado para **Em andamento**"),
    plain muted icon chip (plus/user/flag/play/check/bell/calendar-clock/ban),
    right-aligned timestamp. System events to emit: created, assigned,
    priority set/changed, status transitions, subtask completed, reminder sent,
    due date changed, reopened, cancelled.

### Rail A — Detalhes (card)
Stacked label/value rows divided by faint hairlines. Labels: 10.5px/600
uppercase, tracking .06em, muted. Values 13.5px.
- **Responsável**: 24px avatar (initials on `bg-accent text-accent-foreground`)
  + name. Coordinator: ghost sm "Alterar" (pencil) in the label row → inline
  member select; change emits a system event.
- **Prazo**: calendar-clock icon + DD/MM/AAAA (tabular). Overdue on an active
  item → destructive 600 + " · Atrasado" (icon + word + color, never color
  alone). Coordinator "Alterar" → inline date input + "Salvar"; emits a
  deadline system event. No due date → muted "Sem prazo".
- **Prioridade**: coordinator sees a select (Baixa/Média/Alta/Crítica); member
  sees the badge.
- **Origem**: existing source link ("Caso 0008 — {label}", arrow-up-right,
  hover underline; same `case_access`-flag suppression as today).
- **Visibilidade**: scope badge with its title tooltip.
- **Criado por**: "{nome} · {data, hora}" (existing `formatDateTime`).

### Rail B — Lembretes (card)
- Rows: border radius 10px, bell icon + sentence from `describeReminder`
  ("7 dias antes do prazo", "No dia do prazo", "2 dias após o prazo").
- Coordinator (existing `canManageReminders`): × remove per row; add control =
  type select (Antes do prazo / No dia do prazo / Após o prazo) + days number
  input (hidden for on_due) + "Adicionar". Member: read-only, sub "Definidos
  pela coordenação." Empty: dashed empty state "Nenhum lembrete configurado."

### Rail C — Observadores (card) — NEW
- Overlapping 28px avatar stack (2px card-colored border, -7px overlap), count
  "N pessoas", right button "Seguir" (eye icon) ↔ "Seguindo" (check icon).
  Sub: "Recebem notificações das atualizações."

### Rail D — Itens vinculados (card) — NEW
- Rows: 8px status dot (open = muted-fg, in_progress = primary, done = success)
  + title 13px/500 + meta line "Status · Prazo/Concluído em …" 11.5px muted.
  Each row links to that item's detail page.

## Interactions & Behavior
- Status transitions append a system event and update stepper/banner/badges
  instantly (optimistic; server action behind it).
- "Concluir item" sets `completed_at` + `completed_by`; "Reabrir" clears them.
- Cancel is coordinator-only (hide, and enforce server-side).
- Composer submit prepends an update to the feed and clears the textarea.
- Checklist toggle updates the bar/percent and emits a "Subtarefa concluída"
  system event on completion.
- Banner "Registrar impedimento": composerType = blocker + focus the textarea
  (do NOT use scrollIntoView; plain `.focus()` is enough).
- Permission gates (mirror the current page): `canManageReminders` =
  coordinator; `canContribute` (composer, checklist, status actions) =
  coordinator or assignee; everyone else read-only. Reassign / due date /
  priority / cancel = coordinator.
- Motion: cards `animate-rise-in` staggered 0/40/80/120/160ms; honor
  `prefers-reduced-motion` (already global).

## State Management
Client island state (extends `ActionItemSatellitesPanel`): item header fields
that mutate (status, dueDate, priority, assignee), checklist[], reminders[],
activity[], watchers + `following`, composerType, inline-editor open flags.
All reads stay in `src/lib/queries/`; mutations as server actions with RLS.

## Data-model extensions (NOT in the current hub schema)
1. `priority` enum (baixa/media/alta/critica) on `action_items` — default media.
2. Human-readable item code (e.g. per-commission counter rendered
   "AI-YYYY-NNNN") — display alongside the uuid.
3. `action_item_watchers` (item_id, user_id) + notification fan-out.
4. `action_item_links` (item_id, linked_item_id) for related items.
5. Unified activity: either a real `action_item_events` table for system events
   or a view merging updates + audit rows. Existing `action_item_updates` rows
   are the "update" kind.
Everything else maps to existing tables/queries (`getActionItem`, the three
satellites).

## Design Tokens
Use the existing `globals.css` tokens — no new values. The ones this design
leans on: `--background --card --border --primary --secondary --muted
--muted-foreground --accent --accent-foreground --destructive --success
--warning --ring`, radius scale from `--radius: .75rem` (cards = rounded-2xl),
`--shadow-xs`, motion `--ease-out-soft --dur-base`, fonts `--font-sans /
--font-display (IBM Plex Serif) / --font-mono`. Soft tints are opacity mixes of
semantic tokens (e.g. `success/12`, `destructive/10`, `warning/10`), matching
`satellite-labels.ts` conventions.

## Assets
No images. Icons are lucide (already in the codebase): arrow-left,
arrow-up-right, check, check-circle-2, play, plus, x, bell, triangle-alert,
circle-alert, lock, folder-open, user, users, calendar-clock, flag, send,
message-square, rotate-ccw, pencil, eye, ban.

## Files in this bundle
- `Action Item Detail.html` — entry point (open in a browser to see the design)
- `ai-detail.css` — all component styling + token declarations
- `ai-detail-data.js` — seed data showing the intended shapes
- `ai-detail-ui.jsx` — badges, avatar, buttons, card, status/priority/update maps
- `ai-detail-main.jsx` — banner, header, stepper, checklist, activity feed
- `ai-detail-rail.jsx` — details meta, reminders, watchers, linked items
- `ai-detail-app.jsx` — shell, state wiring, role toggle
- `tweaks-panel.jsx` — prototype-only role switcher; ignore for implementation
