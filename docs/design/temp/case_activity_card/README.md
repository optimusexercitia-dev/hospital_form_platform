# Handoff: "Atividade" Card (unified activity feed)

## Overview
Reusable card component from the Action Item Detail page of the Hospital Case
Management Platform. It combines an update composer with a chronological
timeline that mixes **team updates** (authored posts, typed) and **system
events** (lifecycle changes), plus filter pills. This handoff documents it so
it can be replicated in another section of the platform.

## About the Design Files
The files in this bundle are **design references created in HTML/React
(in-browser Babel prototype)** — they show intended look and behavior, not
production code to copy directly. Recreate the component in the target
codebase's existing environment (framework, component library, state layer)
using its established patterns. If no environment exists yet, choose the most
appropriate framework and implement there.

## Fidelity
**High-fidelity.** Colors, typography, spacing and states are final ("Clinical
Calm" design system, oklch tokens). Recreate pixel-perfectly.

## Anatomy
```
┌ Card (.crd) ─────────────────────────────────────────────┐
│ Header: title "Atividade" + subtitle   [Tudo|Atualizações|Sistema] │
│ ┌ Composer (contributors only) ──────────────────────┐   │
│ │ [Progresso|Nota|Impedimento|Alteração de prazo]    │   │
│ │ textarea (2 rows)                                  │   │
│ │                        [→ Registrar atualização]   │   │
│ └────────────────────────────────────────────────────┘   │
│ ● Update item   author · type chip · timestamp           │
│ │               body text                                │
│ ● System item   "**Actor** did X"          timestamp     │
│ └ (vertical connector line between icons)                │
└──────────────────────────────────────────────────────────┘
```

## Layout & Components

### Card shell (`.crd`)
- `background: #fff; border: 1px solid var(--border); border-radius: 16px;
  padding: 18px 20px; box-shadow: 0 1px 2px rgb(35 45 60/.05), 0 1px 3px rgb(35 45 60/.05)`
- Entrance: fade + 10px rise, 320ms `cubic-bezier(.22,1,.36,1)`, staggered delay.

### Header (`.crd-hd`)
- Flex row, gap 8, margin-bottom 14.
- Title (`.crd-t`): IBM Plex Serif 600 15.5px, letter-spacing -0.01em — "Atividade".
- Subtitle (`.crd-sub`): IBM Plex Sans 400 12.5px, color `var(--muted-fg)` —
  "Atualizações da equipe e eventos do ciclo de vida, em ordem cronológica."
- Right slot: filter pills (`.fchips`), pushed right with margin-left auto.

### Filter pills (`.fchips`)
- Options: **Tudo · Atualizações · Sistema** (single-select, default Tudo).
- Pill: 1px `var(--border)` border, white bg, radius 999px, padding 3px 11px,
  500 12px sans, color `var(--muted-fg)`; gap 6 between pills.
- Active: `background/border var(--primary)`, text `var(--primary-fg)`, weight 600.
- Filtering: Tudo = all; Atualizações = kind `update`; Sistema = kind `system`.
- Empty filter result (`.empty`): dashed 1px border box, radius 10, padding 12,
  centered 12px muted text — "Nada por aqui com este filtro."

### Composer (contributors only — hidden for read-only roles)
- Wrapper: 1px `var(--border)` border, radius 12, padding 12, margin-bottom 18,
  background `color-mix(in oklab, var(--muted) 35%, transparent)`.
- Segmented control (`.seg`), role=tablist "Tipo de atualização", margin-bottom 8:
  bg `var(--muted)`, radius 10, padding 3, gap 2; segment buttons radius 8,
  padding 4px 11px, 500 12px, muted color; active segment: white bg, card
  shadow, weight 600, `var(--fg)`. Types: Progresso / Nota / Impedimento /
  Alteração de prazo.
- Textarea (`.txa`): rows 2, min-height 64, full width, 1px border radius 10,
  400 13px sans, padding 7px 11px; focus: border `var(--ring)` +
  `0 0 0 3px color-mix(in oklab, var(--ring) 18%, transparent)` ring.
  Placeholder swaps by type — blocker: "Descreva o impedimento e o que é
  necessário para destravá-lo…"; others: "Descreva o andamento, uma nota ou uma
  mudança de prazo…".
- Submit row: flex end, margin-top 8. Primary small button, send icon,
  "Registrar atualização"; disabled until text is non-blank; submit clears the
  textarea and prepends the entry to the feed.

### Timeline (`.tl` / `.tl-i`)
- Each item: CSS grid `32px 1fr`, column-gap 12, padding-bottom 16.
- Connector: every item except the last draws a 2px vertical line
  (`var(--border)`, radius 2) at left 15px, from top 36px to bottom 2px.
- Icon circle (`.tl-c`): 32×32, round, grid-centered, default
  `var(--muted)` bg / `var(--muted-fg)` icon. Type tints:
  - `prog` (Progresso): bg `var(--acc)`, icon `var(--acc-fg)`
  - `note` (Nota): default muted
  - `blk` (Impedimento): bg destructive @10%, icon `var(--destructive)`
  - `ddl` (Alteração de prazo): bg warning @12%, icon `var(--warning)`
- Icons (Lucide, stroke 2, 15px update / 14px system): progress & note
  `message-square`, blocker `alert-circle`, deadline `calendar-clock`; system
  events carry their own icon (play, check, plus, pencil, link…).

**Update item**
- Top row (`.tl-top`): flex wrap, gap 6, min-height 32 (vertically centers
  against the icon): author (`.tl-a` 600 13px) → type chip → timestamp
  (`.tl-when` 400 11.5px muted, tabular-nums, margin-left auto, nowrap).
- Type chip (`.chip`): radius 999, padding 1.5px 8px, 600 10.5px; same tint
  scheme as the icon circle (note = muted).
- Body (`.tl-x`): 400 13.5px, margin-top 2, `text-wrap: pretty`.

**System item**
- Single row: sentence (`.tl-sys` 400 12.5px muted, actor/object names bolded
  600 in `var(--fg)`) + timestamp right-aligned. No body text.

## Interactions & Behavior
- Filter pills switch instantly (no animation), preserving order (newest first).
- Composer type selection persists while the page is open; an external
  "Registrar impedimento" action elsewhere on the page can preset type =
  Impedimento and focus the textarea.
- Buttons: hover bg shifts (~150ms), `:active` translateY(1px), disabled
  opacity .5 + pointer-events none.
- New entries appear at the top with author = current user, chip per type.

## State Management
- `items[]`: `{ id, kind: "update"|"system", type?, author?, text?, icon?,
  html?, at }`, newest first.
- Local UI state: `filter` ("all"|"upd"|"sys"), `composerType`
  ("progress"|"note"|"blocker"|"deadline_change"), `text`.
- `canContribute` (permission) gates the composer.
- Submitting posts an update (server) and prepends it locally; system items are
  emitted by lifecycle mutations elsewhere.

## Design Tokens (oklch — Clinical Calm)
- `--fg` oklch(.23 .018 230) · `--card` #fff · `--border` oklch(.9 .008 250)
- `--primary` oklch(.475 .11 252) · `--primary-fg` oklch(.99 .005 250)
- `--muted` oklch(.962 .006 245) · `--muted-fg` oklch(.52 .022 252)
- `--acc` oklch(.95 .022 250) · `--acc-fg` oklch(.42 .105 252)
- `--destructive` oklch(.55 .2 25) · `--warning` oklch(.62 .13 65)
- `--ring` = primary
- Fonts: IBM Plex Sans (UI), IBM Plex Serif (card title). Feature settings
  `"tnum" 1, "ss01" 1` on the page root.
- Radii: card 16 / composer 12 / inputs & seg 10 / seg button 8 / pills & chips 999.

## Assets
Lucide icons only (inline SVG, 24 viewBox, stroke currentColor, width 2, round
caps/joins). No images.

## Files
- `ai-detail-main.jsx` — `AidActivity` component (the Atividade card) at the
  bottom of the file.
- `ai-detail-ui.jsx` — shared primitives it uses: `AiCard`, `AiBtn`, `AiIcon`,
  and the `AID_UPD` / `AID_UPD_ICON` type maps.
- `ai-detail.css` — sections: cards, buttons, timeline, composer + inputs
  (`.crd*`, `.btn*`, `.tl*`, `.chip`, `.seg`, `.txa`, `.fchips`, `.empty`).
- `Action Item Detail.html` in the project root renders the full page for live
  reference.
