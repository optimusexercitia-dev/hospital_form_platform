# Case Timeline — Implementation Spec

A timeline feature for a **case** that is composed of many **events**. Two interchangeable
layouts render from the **same event array**:

- **Duration (horizontal / Gantt)** — event *width encodes its duration in days*; weekend bands + a live “today” marker give temporal context.
- **Feed (vertical)** — strictly chronological; duration is shown **only as text**, never as size.

This document specifies **layout, composition, geometry, states, and the data model**. It does
**not** prescribe colors, radii, or fonts — map every visual role to your existing design tokens
(see [§2 Token mapping](#2-design-token-mapping)). All pixel values are *layout intent*; adapt
them to your spacing scale.

---

## 1. Data model (shared by both layouts)

A case has one ordered list of events. Each event is **either** a durational *phase* **or** a
*single-day* event. The only structural difference is `start`/`end` (phase) vs `day` (single-day).

```ts
type EventType =
  | "milestone"   // a point-in-time state change: incident reported, reviewer assigned
  | "phase"       // a DURATIONAL span (may overlap other phases)
  | "document"    // a file/record added on a day
  | "interview"   // a conversation held on a day
  | "meeting"     // a scheduled gathering on a day
  | "action";     // a follow-up issued on a day

interface CaseEvent {
  id: string;
  type: EventType;
  title: string;
  // Exactly ONE of the following shapes:
  day?: number;          // single-day events  (point in time)
  start?: number;        // phase only
  end?: number;          // phase only (inclusive)
  people?: string[];     // assignee initials/ids → avatars
  note?: string;         // optional secondary line ("42 pp · OR notes")
}
```

> In the reference build `day`/`start`/`end` are **day-of-month integers** within a single month
> window. In production use real `Date`/ISO strings and derive the integer day-offset from the axis
> start. Keep the *phase vs single-day* distinction — it is what drives the two layouts.

### Derived helpers (single source of truth — both layouts use these)

```ts
const anchor = (e: CaseEvent) => e.day ?? e.start!;          // sort key + feed position
const endDay = (e: CaseEvent) => e.day ?? e.end!;
const durationDays = (e: CaseEvent) => (e.day != null ? 1 : e.end! - e.start! + 1);

type Status = "done" | "active" | "upcoming";
function statusOf(e: CaseEvent, today: number): Status {
  if (endDay(e) < today) return "done";
  if (anchor(e) <= today && today <= endDay(e)) return "active";   // spans today
  return "upcoming";
}
```

### Event-type metadata

Each type maps to **one icon** and **one color role**. Keep this map central; both layouts and the
legend read from it.

| `type`      | Meaning                                  | Icon (suggested) | Color role (map to your palette) |
|-------------|------------------------------------------|------------------|----------------------------------|
| `milestone` | Key state change (incident, assignment)  | flag             | **critical / danger**            |
| `phase`     | Durational span                          | clock            | **accent / primary**             |
| `document`  | File or record added                     | paperclip        | **neutral / slate**              |
| `interview` | Conversation                             | users            | **violet**                       |
| `meeting`   | Scheduled gathering                      | calendar         | **info / blue**                  |
| `action`    | Follow-up issued                         | check            | **warning / amber**              |

Each color role needs a **strong** value (icon/border/text) and a **soft** value (chip/icon-chip
background ~8–12% tint).

### Seed data (the reference case — de-identified)

```json
[
  { "id": "e1",  "type": "milestone", "title": "Incident reported",           "day": 2,  "people": [],                       "note": "Sentinel event flagged" },
  { "id": "e2",  "type": "phase",     "title": "Case intake & triage",        "start": 2,  "end": 4,  "people": ["HC"] },
  { "id": "e3",  "type": "document",  "title": "Medical record assembled",    "day": 4,  "people": ["HC"],                   "note": "42 pp · OR + PACU notes" },
  { "id": "e4",  "type": "milestone", "title": "Reviewer assigned",           "day": 5,  "people": ["AO"],                   "note": "Dr. Okafor · Gen. Surgery" },
  { "id": "e5",  "type": "phase",     "title": "Chart review",                "start": 6,  "end": 12, "people": ["AO"] },
  { "id": "e6",  "type": "interview", "title": "Attending surgeon interview", "day": 9,  "people": ["AO", "HC"] },
  { "id": "e7",  "type": "interview", "title": "Nursing staff interview",     "day": 10, "people": ["AO"] },
  { "id": "e8",  "type": "document",  "title": "Pathology addendum filed",    "day": 11, "people": ["MR"] },
  { "id": "e9",  "type": "phase",     "title": "Root cause analysis",         "start": 12, "end": 17, "people": ["AO", "MR"] },
  { "id": "e10", "type": "meeting",   "title": "Pre-meeting case briefing",   "day": 15, "people": ["HC", "AO"] },
  { "id": "e11", "type": "meeting",   "title": "M&M committee meeting",       "day": 18, "people": ["HC", "AO", "MR", "RP"], "note": "Conf. Rm B · 7:00 AM" },
  { "id": "e12", "type": "phase",     "title": "Deliberation & disposition",  "start": 18, "end": 20, "people": ["HC"] },
  { "id": "e13", "type": "action",    "title": "Action items issued",         "day": 22, "people": ["AO"],                   "note": "RCA + process changes" }
]
```
Axis window for this data: **day 1 → 24**, **today = 16**.

---

## 2. Design token mapping

The timeline introduces **no new visual language**. Map each semantic role below to an existing
token in your system. Names on the left are how they’re referenced throughout this spec.

| Role            | Used for                                             |
|-----------------|------------------------------------------------------|
| `surface`       | Card / bar background, sticky axis background        |
| `surface-2`     | Subtle fills: weekend bands, segmented-control track, upcoming-state bars |
| `line`          | Hairline borders, grid lines, row separators         |
| `line-strong`   | Stronger borders, dashed “upcoming” outlines         |
| `ink`           | Primary text (titles)                                |
| `ink-2`         | Secondary text (meta)                                |
| `ink-3`         | Tertiary text (axis labels, captions)               |
| `accent`        | “Today” marker, active-state ring, view-switch selection |
| `accent-soft`   | Accent tints                                         |
| `shadow`        | Resting card/bar elevation                           |
| `shadow-lg`     | Hover elevation                                      |
| `radius-card`   | Cards & bars (reference used ~9–12px)                |
| 6× type colors  | Per [§1 type table](#event-type-metadata) — strong + soft each |

---

## 3. Layout A — Duration (horizontal / Gantt)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ JUNE                                                            ← sticky    │  ← group/month row
│ M  T  W  T  F  S  S  M  T  W  T  F  S  S  M  T  W  T  F  S  S  M  T  W       │  ← day cells (weekday + #)
│ 1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24       │
├──────────────────────────────────────────────────────│today│──────────────┤
│  ▣ Incident reported                                  ┊                     │  ← single-day pin
│   ▭▭▭ Case intake & triage (bar = 3 days)             ┊                     │  ← phase bar (width=days)
│         ▣ Medical record assembled                    ┊                     │
│            ▣ Reviewer assigned                        ┊                     │
│              ▭▭▭▭▭▭▭ Chart review (7 days)            ┊                     │
│                   ▣ Attending interview               ┊                     │
│                            ▭▭▭▭▭▭ Root cause analysis ┊▭  (crosses today)   │  ← ACTIVE phase
│                                          ▭▭▭ Deliberation (upcoming, dashed) │
│                                              ▣ Action items issued (R-anchor)│
└──────────────────────────────────────────────────────────────────────────┘
  ▣ Milestone   ⏱ Phase   📎 Document   👥 Interview   📅 Meeting   ✓ Action     ← legend
```

**Disposition:** one event **per row**, top-to-bottom in data order. There is **no left label
column** — titles live inside bars (phases) or in a chip-card pinned to the day (single-day events),
exactly like the reference. The grid scrolls **horizontally**.

### 3.1 Geometry constants (recommended; adapt to your scale)

| Const     | Value                         | Notes |
|-----------|-------------------------------|-------|
| `DAY_W`   | `46px`                        | width of one day column |
| `ROW_H`   | `64px` (compact `50px`)       | one event row |
| `BAR_H`   | `min(44, ROW_H − 16)`         | bar/pin height, vertically centered in row |
| axis      | 2 rows, **sticky top**, ~`56px` | month-group row + day-cell row |
| `GRID_W`  | `numDays × DAY_W`             | total inner width (scrolls x) |

Coordinate helpers (axisStart = first day shown):
```
xOf(d)      = (d − axisStart) × DAY_W
todayX      = xOf(today) + DAY_W/2
phase.left  = xOf(start) + 2          phase.width = (end − start + 1) × DAY_W − 4
single.cx   = xOf(day) + DAY_W/2      // center of the day column
```

### 3.2 Axis header
- **Row 1**: month/group label, left-aligned, uppercase, tracked. (Spans its days; add more cells if the window crosses months.)
- **Row 2**: one cell per day, `DAY_W` wide, centered: weekday letter (`M T W T F S S`) above the day number. Today’s cell uses `accent` text + bold; weekend cells get `surface-2` background.
- The whole header is `position: sticky; top: 0; z-index: 6` so it stays while the page scrolls vertically.

### 3.3 Background layers (behind events)
1. **Weekend bands** — full-height column at each weekend day, `surface-2` + a faint diagonal hatch (`repeating-linear-gradient(-45deg, transparent 0 5px, line 5px 6px)`), `opacity .5`, `pointer-events:none`. Weekend test (Monday-indexed): `((d − 1) % 7) >= 5`.
2. **Grid lines** — 1px vertical line at each `xOf(d)`, `line` @ `opacity .5`.
3. **Row hover layer** — one transparent strip per row (`ROW_H` tall); on hover tint `accent @ ~5%`.
4. **Today marker** — 2px vertical line at `todayX` in `accent`, full body height, with a 9px accent dot capping the top. `z-index: 2` (sits **behind** event cards so it never slashes through text).

### 3.4 Phase bars (width = duration)
A rounded bar from `phase.left` for `phase.width`, vertically centered, `radius-card`, with:
- a **4px accent strip** down the left edge in the type color;
- **title** (always) — `ink`, 13px/600, truncated with ellipsis;
- progressive disclosure by available width:
  - show **date range** meta (`Jun 6 – Jun 12`) when `width ≥ 116px`;
  - show **avatar stack** (right-aligned) when `width ≥ 232px`;
  - below those thresholds, drop them gracefully (title only). *(Optional: for ultra-narrow phases, render the title in a label immediately to the right of the bar.)*

### 3.5 Single-day pins
Anchored to the day’s **center** (`single.cx`): a **26px icon chip** (`radius 7`, type-soft bg, type
color icon) followed by an inline card — title (`ink` 13/600) + meta line (`note` or the date) +
avatar stack. The chip visually “sits on” the day; the card extends to the **right**.
- **Right-edge guard:** if the event falls within the **last ~4 day-columns** (`day ≥ axisEnd − 4`), **right-anchor** the card instead (chip on the right, text extends left) so it never overflows the grid edge.

### 3.6 Event states (visual)

| Status     | Bar / pin treatment |
|------------|---------------------|
| `done`     | `surface` card, `line` hairline border, resting `shadow` |
| `active`   | `surface` card **+ 1.5px `accent` ring** (outer shadow), meta gets a “· in progress” suffix |
| `upcoming` | `surface-2` background, **dashed `line-strong` border**, muted `ink-2` text, type strip at reduced opacity |

### 3.7 Behavior
- Container `overflow-x: auto` (custom thin scrollbar). Consider initial scroll so **today** is in view.
- Hover lifts bars/pins (`translateY(-1px)` + `shadow-lg`); whole bar/pin is the click target → open event detail (recommend a right-side panel).
- A **legend** strip (the 6 types) pins to the bottom of the view.

---

## 4. Layout B — Feed (vertical)

```
        │  (continuous spine)
   2    ●━━━━┐  Incident reported                         [Completed]
  JUN   │    │  ▣ Milestone · Jun 2 · Sentinel event flagged        (HC)
        │    └────────────────────────────────────────────────────────
   2    ●  Case intake & triage                            [Completed]
  JUN   │  ⏱ Phase · Jun 2 – Jun 4 · 3 days                          (HC)
        │
   6    ●  Chart review                                     [Completed]
  JUN   │  ⏱ Phase · Jun 6 – Jun 12 · 7 days                         (AO)
        │
 TODAY  ◉  Jun 16, 2026  ───────────────────────────────────────────   ← divider
        │
  18    ○  M&M committee meeting                            [Upcoming]
  JUN   ┊  📅 Meeting · Jun 18 · Conf. Rm B · 7:00 AM      (HC AO MR RP)
```

**Disposition:** events sorted **ascending by `anchor`** (stable). A **continuous vertical spine**
runs through the column; each event is **one equal-height node** regardless of duration — duration
appears **only as text** (`· 7 days`). A **“Today” divider** is inserted immediately before the
first `upcoming` event. Centered column, `max-width ≈ 760px`.

### 4.1 Row structure (3 columns)

| Column      | Width   | Content |
|-------------|---------|---------|
| Date rail   | `56px`, right-aligned | day number (bold) over month (uppercase, `ink-3`) |
| Spine       | `30px`  | 2px center line (the continuous spine) + a **30px node dot** |
| Card        | flex    | the event card |

Row vertical gap: `18px` (compact `10px`). The spine line spans the full height *including the gap*
so it reads as unbroken between nodes.

### 4.2 Node dot
30px circle centered on the spine, `box-shadow: 0 0 0 4px <page-bg>` to “cut” the spine cleanly:
- `done` / `active`: type-soft background, **solid 1.5px type-color border**, type icon in type color.
- `upcoming`: `surface` background, **dashed `line-strong` border**, `ink-3` icon (hollow look).

### 4.3 Card anatomy
`surface`, `radius-card`, `line` border, resting `shadow`, padding ~`13px 16px`:
- **Header row:** title (`ink`, 15px/600) on the left; **status pill** on the right (`Completed` / `In progress` / `Upcoming`, using your closed/warning/neutral roles; `active` pill carries a small dot).
- **Meta row** (wraps): type chip (icon + label, type colors) · date text (`Jun 6 – Jun 12` for phases, `Jun 4` for single-day) · for phases append `· N days` · optional `note` · **avatar stack pushed to the far right** (`margin-left:auto`).
- `upcoming` cards render at `opacity ~.92`.

> **Critical:** the vertical layout must **never** encode duration as height/length — only the
> `· N days` text. That is the deliberate contrast with Layout A.

### 4.4 Today divider
A full-width row: `TODAY` label in the date rail, a solid `accent` dot on the spine, then
`Jun 16, 2026` + a faded `accent` horizontal rule filling the remaining width.

---

## 5. Shared chrome (optional — reuse your existing components)

If the case page already has a header/tabs/toolbar, only the **view switch** is new.

- **View switch** — a 2-option segmented control: **Duration** | **Feed**, each with an icon. Selected option uses `surface` + `accent` text + `shadow` on a `surface-2` track. Persist the choice (URL param or local state).
- **Toolbar** — Search · Filter · Sort, then the view switch. Show a **month stepper** (`‹ June 2026 ›`) **only in Duration** view (it has no meaning in the feed).
- **Avatar stack** — overlapping circles: `20–22px`, `margin-left:-7px` on all but the first, each with a 2px `surface` ring.

---

## 6. Shared component inventory

| Component        | Used by        | Responsibility |
|------------------|----------------|----------------|
| `timelineData`   | both           | event array + `anchor` / `endDay` / `durationDays` / `statusOf` / type map |
| `TypeIcon`       | both, legend   | maps `type` → icon |
| `AvatarStack`    | both           | overlapping assignee avatars |
| `TimelineGantt`  | Duration       | axis, bands, today marker, bars, pins, legend |
| `TimelineFeed`   | Feed           | spine, date rail, nodes, cards, today divider |
| `ViewSwitch`     | chrome         | Duration ↔ Feed |

Both views are **pure functions of `(events, today, density)`** — no internal state. State (current
view, density) lives at the page level.

---

## 7. Acceptance checklist

- [ ] One event array drives both layouts; phases and single-day events both render in each.
- [ ] **Duration view:** phase bar width is proportional to day count; single-day events are pins, not bars.
- [ ] Weekend bands + a today marker at the correct column; axis header sticks on vertical scroll; grid scrolls horizontally.
- [ ] Phase bars progressively reveal date/avatars by width; pins right-anchor near the grid edge.
- [ ] **Feed view:** all nodes equal height; duration appears **only** as `· N days` text; Today divider sits before the first upcoming event.
- [ ] `done` / `active` / `upcoming` states are visually distinct in both layouts and derived from `statusOf`.
- [ ] All colors/radii/shadows resolve to **existing project tokens** — no hard-coded values introduced.
- [ ] Hover elevation on bars/cards; bar/card is the click target for an event detail affordance.
```
