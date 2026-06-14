
This document covers the design language (color, typography, spacing) and two screens:
**Overview (KPI + Table)** and **Case Review Board (Kanban)**.

Tone: clinical & calm — confident, professional, generous whitespace, but **dense and
scannable** for committee chairs who read a lot of data quickly.

---

## 1. Tech assumptions

- Any component framework (React/Vue/Svelte) or plain HTML/CSS. Examples below use
  framework-agnostic markup + CSS custom properties.
- Numbers use **tabular figures** everywhere (`font-variant-numeric: tabular-nums`).
- Severity color is **locked across the whole app** — never recolor harm levels per screen.
  This is a patient-safety choice: "Death" must look identical everywhere.

---

## 2. Typography

Load IBM Plex (Google Fonts):

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
```

| Role | Family | Usage |
|------|--------|-------|
| Display / headings / wordmark / case titles | **IBM Plex Serif** (600) | Page titles (`h1`, ~21px), section headers, brand |
| UI / labels / body | **IBM Plex Sans** (400–700) | Everything else |
| Data / identifiers | **IBM Plex Mono** (500–600) | Case IDs (`MM-2026-0142`), MRNs, numeric codes |

```css
:root {
  --font-sans:  "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-serif: "IBM Plex Serif", Georgia, serif;
  --font-mono:  "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Common sizes (px): page title 21 (serif/600), card title 14.5 (700), table cell 13,
labels/uppercase eyebrows 11 (700, letter-spacing .05em, uppercase), KPI value 27 (700),
micro/meta 11–11.5.

Base: `line-height: 1.4`, `-webkit-font-smoothing: antialiased`,
`font-feature-settings: "tnum" 1, "ss01" 1`.

---

## 3. Color tokens

### 3.1 Theme — "Clinical Calm" (the palette used on both screens)

```css
:root {
  /* neutrals + surfaces */
  --bg:           #f4f7fb;   /* app background */
  --surface:      #ffffff;   /* cards, tables, topbar, sidebar */
  --surface-2:    #f8fafd;   /* zebra rows, inset wells, column bodies */
  --line:         #e2e9f1;   /* hairline borders */
  --line-strong:  #cdd9e6;   /* input borders, dividers */

  /* ink (text) */
  --ink:    #18222e;         /* primary text */
  --ink-2:  #4a5a6a;         /* secondary text */
  --ink-3:  #8294a5;         /* muted / meta / placeholders */

  /* brand accent — calm blue */
  --accent:       #1f5c9e;   /* primary buttons, active nav, links, case IDs */
  --accent-2:     #2e74c0;   /* hover / brighter accent */
  --accent-soft:  #e7f0fa;   /* tinted backgrounds, avatars, active nav bg */
  --accent-ink:   #ffffff;   /* text on accent */

  /* sidebar (light variant used on these screens) */
  --sidebar-bg:          #ffffff;
  --sidebar-ink:         #43566a;
  --sidebar-active-bg:   #e7f0fa;
  --sidebar-active-ink:  #1f5c9e;

  /* elevation */
  --shadow:    0 1px 2px rgba(24,34,46,.04), 0 1px 3px rgba(24,34,46,.06);
  --shadow-lg: 0 4px 16px rgba(24,34,46,.08), 0 1px 3px rgba(24,34,46,.06);
}
```


### 3.3 Review-status accents (stable)

```css
:root {
  --st-screen: #64748b; --st-screen-bg: #eef1f5;  /* Screening    */
  --st-sched:  #2563a8; --st-sched-bg:  #e7f0fa;  /* Scheduled    */
  --st-review: #6d4aa6; --st-review-bg: #f0eafa;  /* Under review */
  --st-action: #b45309; --st-action-bg: #fbf0df;  /* Action items */
  --st-closed: #3f7d58; --st-closed-bg: #e8f3ec;  /* Closed       */
}
```

---

## 4. Spacing, radii, shape

- **Spacing scale** (px): 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28. Page gutters 28px.
- **Radii**: pills/status `999px`; chips/buttons/inputs `8px`; cards `12–14px`;
  small swatches/avatars circle or `5–9px`.
- **Borders**: `1px solid var(--line)` hairlines; `1px solid var(--line-strong)` for
  inputs/buttons.
- **Buttons / inputs**: height `36px`.
- **Avatars**: circle, `24–32px`; initials in `--accent` on `--accent-soft`, weight 700.
  Unassigned = dashed circle with an em-dash.

---


## 6. Shared components

### Status Pill
Rounded `999px` pill: 6px dot + label. Color `--st-*`, background `--st-*-bg`.
11.5px / weight 600.

### Avatar
Circle with initials (`--accent` on `--accent-soft`, weight 700). Null → dashed circle + "—".

### KPI Card
White card, `--shadow`, radius 12, padding `14px 16px`. Stacked: label (11.5/600/`--ink-2`)
→ value (27/700/`--ink`, tabular) → sub-line with a tiny dot tinted by tone
(`warn`=`--sev-temp`, `danger`=`--sev-death`, `good`=`--sev-near`, `accent`=`--accent`, `plain`=`--ink-2`).

### Sidebar (232px)
White, right hairline border. Brand block (caduceus mark in `--accent` + "Concord Review" /
"Riverside Medical Center"), an uppercase "Committee" eyebrow, nav items (Overview, Cases,
Meetings, Analytics, Committee) with 17px icons; active item uses `--sidebar-active-bg` /
`--sidebar-active-ink` and 600 weight. Cases shows a count badge. Footer: Settings + a
user card (avatar + "Dr. Helena Cruz · Committee Chair").

### Topbar
White, bottom hairline, padding `18px 28px`. Left: serif `h1` title + 12.5px `--ink-2`
subtitle. Right: search box (36px, icon + placeholder), ghost/secondary buttons, one
primary button. Buttons: primary = `--accent`/white; ghost = white + `--line-strong`
border + `--ink-2`; soft = `--accent-soft`/`--accent`.

Icons: simple 1.6px-stroke line icons (`currentColor`), ~16–17px.

---

## 7. Screen A — Overview (KPI + Table)

**Layout:** `Sidebar(active="overview")` + main column on `--bg`.

**Topbar:** title "Committee Name"; subtitle "Next session · Wed Jun 18, 7:00 AM ·
Conf. Room 2B — agenda closes in 4 days". Actions: Search, ghost "Filters", primary "New case".

**KPI strip:** 6-column grid (`repeat(6,1fr)`, gap 12) of KPI Cards:

| label | value | sub | tone |
|-------|-------|-----|------|
| Awaiting screening | 7 | 2 over 30 days | warn |
| On next agenda | 4 | Jun 18 meeting | accent |
| Under review | 6 | 3 with chair | plain |
| Overdue review | 2 | Action required | danger |
| Closed YTD | 38 | +5 this month | good |

**Cases table card:** white, radius 14, `--shadow`.
- Card header: "Active cases" (14.5/700) + "13 open" muted + right-aligned **filter chips**:
  `All · Needs me · Screening · Scheduled · Sentinel only` (active chip = `--accent`/white pill).
- **Grid columns** (CSS grid, gap 14, padding `11px 18px`):
  `150px 64px 80px 130px 1fr 132px 118px 70px 140px`
  → **Case · Patient · Event · Service · Summary · Harm · Preventability · Lead · Status**
- Header row: uppercase 11px eyebrow on `--surface-2`.
- Body rows: zebra striping (`--surface` / `--surface-2`), hairline between rows,
  `align-items:center`.
  - **Case** cell: mono ID in `--accent` (12.5/600); if `flags` present, a second line with a
    flag icon + flag text in `--sev-death` (10.5/700).
  - **Patient/Event**: tabular text. **Summary**: single line, ellipsis truncation.
  - **Harm**: Severity Tag. **Preventability**: Preventability Chip. **Lead**: Avatar.
  - **Status**: Status Pill.
- Table body scrolls; header sticky-friendly.

Interactions to wire: row click → case detail; chips filter the list; column sort on
Case/Event/Service/Status; "New case" → intake.

---

## 8. Screen B — Case Review Board (Kanban)

**Layout:** `Sidebar(active="cases")` + main column on `--bg`.

**Topbar:** title "Case Review Board"; subtitle "Drag cases between stages · 13 active across
the committee". Actions: Search, ghost "Service", primary "New case".

**Board:** 5-column grid (`repeat(5,1fr)`, gap 14, full height), one column per status in
order: **Screening, Scheduled, Under review, Action items, Closed**.

**Column** = `--surface-2` panel, `--line` border, radius 14:
- Header on `--surface`: status dot (`--st-*` color) + label (13/700) + right-aligned count
  pill; second line is a muted note per column (`New & triage`, `Jun 18 agenda`, `In analysis`,
  `Follow-up open`, `Resolved`).
- Body: vertical stack of cards, gap 10, padding 10, scrollable.

**Case card** (white, radius 10, `--shadow`), with a **3px left border tinted by severity**
(`--sev-*`):
1. Top row: mono case ID (`--accent`) + optional `SENTINEL` tag (9.5/800, `--sev-death` on
   `--sev-death-bg`) when `flags` includes "Sentinel".
2. Summary line (12.5/500/`--ink`, ~2 lines).
3. Severity Tag + service name (muted).
4. Footer (top hairline): Avatar + "Dr. {reviewer}" (or "Unassigned") + right-aligned
   clock icon with age chip (`21d`, or `today` when age 0).

Interactions to wire: drag-and-drop between columns updates `status`; card click → detail;
"New case" → intake; "Service" → filter by service line.

---
