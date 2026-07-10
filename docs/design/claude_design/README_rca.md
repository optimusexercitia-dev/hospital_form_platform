# Root Cause Analysis (RCA + PDCA) — Implementation Spec

A guided workspace for performing a **Root Cause Analysis** on a clinical case, then driving each
finding through a **Plan-Do-Check-Act** improvement cycle. Triggered when a case review surfaces a
serious, preventable problem (e.g. a sentinel event).

The feature is a **4-stage linear flow** over a single shared analysis object:

1. **Problem** — frame what happened vs. what should have happened.
2. **Causal analysis** — an **Ishikawa (fishbone)** of contributing factors, with a **5 Whys** drill on the key ones.
3. **Root causes** — distil the analysis into classified causal statements.
4. **Corrective actions** — each root cause is addressed by an action tracked through a **PDCA** cycle.

This document specifies **data model, flow, layout, geometry, and states**. It does **not** prescribe
colors, radii, or fonts — map every visual role to your existing tokens (see [§2](#2-design-token-mapping)).
Pixel values are *layout intent*; adapt to your spacing scale.

---

## 1. Data model (single shared analysis object)

One RCA belongs to one case. The whole feature is a pure function of this object + dispatched edits.

```ts
interface RCA {
  problem: Problem;
  causes:  Record<CategoryId, Cause[]>;   // fishbone: factors grouped by category
  whys:    Record<CauseId, WhyChain>;     // 5-Whys, keyed by the cause being drilled
  roots:   RootCause[];                    // distilled statements (stage 3)
  actions: CorrectiveAction[];             // PDCA-tracked actions (stage 4)
}

interface Problem {
  what: string;        // objective description of the event
  expected: string;    // what should have happened (the ideal course)
  detected: string;    // where/when detected, e.g. "PACU, ~25 min after onset"
  impact: string;      // e.g. "Patient death · sentinel event"
  scope: string;       // e.g. "Perioperative & PACU · General Surgery"
}

type CategoryId = "people" | "comm" | "process" | "equip" | "env" | "policy";

interface Cause {       // one contributing factor on a fishbone rib
  id: string;
  text: string;
  key: boolean;         // flagged → carried into 5-Whys analysis
}

interface WhyChain {    // 5-Whys drill for one key factor
  factor: string;       // mirrors the Cause.text being analyzed
  steps: string[];      // up to 5 "because…" answers; "" = not yet answered
  root: string;         // the underlying root cause reached
}

interface RootCause {                 // stage 3
  id: string;
  text: string;
  cat: CategoryId;                     // which fishbone category it came from
  cls: "system" | "human" | "environment" | "external";
  type: "root" | "contributing";
  action: string | null;              // id of the CorrectiveAction addressing it
}

type PdcaStageId = "plan" | "do" | "check" | "act";
type CellStatus  = "todo" | "active" | "done";

interface CorrectiveAction {          // stage 4
  id: string;
  title: string;
  root: string | null;                // RootCause.id this addresses
  owner: string;  oi: string | null;  // owner name + avatar initials
  due: string;                        // target date
  priority: "high" | "medium";
  measure: string;                    // measure of success / target metric
  pdca: Record<PdcaStageId, { status: CellStatus; note: string }>;
}
```

### 1.1 Fishbone categories (clinical Ishikawa — the six ribs)

Fixed set. Each maps to one icon + one color role.

| `id`      | Label                    | Icon (suggested) | Color role |
|-----------|--------------------------|------------------|------------|
| `people`  | People & Staffing        | people           | role A     |
| `comm`    | Communication            | chat bubble      | role B     |
| `process` | Process & Procedure      | process/swap     | **accent** |
| `equip`   | Equipment & Tech         | wrench           | role C     |
| `env`     | Environment              | droplet/leaf     | role D     |
| `policy`  | Policy & Organization    | building         | role E     |

Each color role needs a **strong** value (icon/accent strip) + a **soft** ~8–12% tint (chip bg).

### 1.2 Root-cause classification

Single-select per root cause; renders as a segmented control.

| `cls`         | Label       | Color role |
|---------------|-------------|------------|
| `system`      | System      | role B     |
| `human`       | Human       | role A     |
| `environment` | Environment | role D     |
| `external`    | External    | role C     |

`type` is a binary flag rendered as a pill: **Root cause** (danger role) vs **Contributing** (warning role).

### 1.3 PDCA stages (the wheel)

Fixed, ordered, traversed clockwise.

| `id`    | Letter | Label | Blurb                  | Color role |
|---------|--------|-------|------------------------|------------|
| `plan`  | P      | Plan  | Define change & target | role B     |
| `do`    | D      | Do    | Pilot on small scale   | **accent** |
| `check` | C      | Check | Measure against target | role amber |
| `act`   | A      | Act   | Adopt, adjust, abandon | role green |

Cell status maps to: `todo` → neutral, `active` → amber/warning, `done` → green/closed.

### 1.4 Seed data (de-identified reference — case "MM-2026-0142")

> Ships partly complete so depth is visible immediately; some 5-Whys chains and one action are left
> empty to invite interaction.

```json
{
  "problem": {
    "what": "During recovery from an elective laparoscopic colectomy, the patient developed post-operative intra-abdominal hemorrhage. Hypotension was recognized in PACU but escalation to the attending surgeon and activation of the massive-transfusion protocol were delayed, contributing to the patient's death.",
    "expected": "Post-operative hypotension should trigger an immediate, protocolized escalation: attending notified within 10 minutes, hemorrhage pathway activated, and transfusion products mobilized in parallel.",
    "detected": "PACU, ~25 min after onset of hypotension",
    "impact": "Patient death · sentinel event",
    "scope": "Perioperative & PACU · General Surgery"
  },
  "causes": {
    "people":  [ { "id": "p1", "text": "Junior resident first responder overnight", "key": true },
                 { "id": "p2", "text": "End-of-list surgical team fatigue", "key": false } ],
    "comm":    [ { "id": "c1", "text": "Escalation to attending delayed ~25 min", "key": true },
                 { "id": "c2", "text": "Hand-off omitted anticoagulation plan", "key": true } ],
    "process": [ { "id": "r1", "text": "No standardized PACU hypotension pathway", "key": true },
                 { "id": "r2", "text": "Vital-sign recheck cadence not protocolized", "key": false } ],
    "equip":   [ { "id": "e1", "text": "Telemetry alarm thresholds set too wide", "key": false },
                 { "id": "e2", "text": "Delay obtaining massive-transfusion products", "key": false } ],
    "env":     [ { "id": "v1", "text": "PACU at high census / short-staffed", "key": false } ],
    "policy":  [ { "id": "o1", "text": "Escalation criteria undefined in policy", "key": true },
                 { "id": "o2", "text": "RCA trigger not auto-flagged for sentinel", "key": false } ]
  },
  "whys": {
    "c1": { "factor": "Escalation to attending delayed ~25 minutes",
            "steps": [ "Bedside nurse continued monitoring before calling the attending.",
                       "It was unclear who to call and at what threshold.",
                       "No standardized escalation pathway exists for post-operative bleeding.",
                       "PACU escalation thresholds were never defined in policy.",
                       "Pathway work was de-prioritized after a prior near-miss." ],
            "root": "Absence of a governed escalation pathway for post-op deterioration." },
    "r1": { "factor": "No standardized PACU post-operative hypotension pathway",
            "steps": [ "Hypotension response relied on individual clinician judgment.",
                       "No protocol defined triggers, actions, or escalation.",
                       "PACU protocols were never formally developed for surgical bleeding.",
                       "Quality governance had no owner for perioperative pathways.", "" ],
            "root": "No owned, standardized PACU deterioration protocol." }
  },
  "roots": [
    { "id": "rc1", "text": "No standardized, governed PACU escalation pathway for post-operative deterioration.", "cat": "process", "cls": "system", "type": "root", "action": "ca1" },
    { "id": "rc2", "text": "Hand-off process does not reliably transfer anticoagulation / bleeding-risk plans.", "cat": "comm", "cls": "system", "type": "root", "action": "ca2" },
    { "id": "rc3", "text": "Telemetry alarm thresholds not tuned for the post-surgical cohort.", "cat": "equip", "cls": "system", "type": "contributing", "action": "ca3" }
  ],
  "actions": [
    { "id": "ca1", "title": "Implement standardized PACU escalation pathway", "root": "rc1",
      "owner": "Dr. A. Okafor", "oi": "AO", "due": "Jul 15", "priority": "high",
      "measure": "Median time-to-escalation < 10 min on post-op hypotension",
      "pdca": { "plan":  { "status": "done",   "note": "Pathway drafted with PACU + surgery; thresholds agreed." },
                "do":    { "status": "active", "note": "Piloting on surgical floor; staff in-serviced." },
                "check": { "status": "todo",   "note": "Audit 30 cases for escalation timing." },
                "act":   { "status": "todo",   "note": "Standardize house-wide or adjust thresholds." } } },
    { "id": "ca2", "title": "Adopt SBAR hand-off with anticoagulation checklist", "root": "rc2",
      "owner": "Dr. M. Reyes", "oi": "MR", "due": "Jun 30", "priority": "high",
      "measure": "≥ 95% of hand-offs include documented anticoagulation plan",
      "pdca": { "plan":  { "status": "done",   "note": "SBAR template + checklist built into EHR hand-off." },
                "do":    { "status": "done",   "note": "Rolled out across perioperative units." },
                "check": { "status": "active", "note": "Sampling hand-offs weekly; at 88% compliance." },
                "act":   { "status": "todo",   "note": "Targeted coaching for low-compliance shifts." } } },
    { "id": "ca3", "title": "Re-tune telemetry alarm thresholds for post-op cohort", "root": "rc3",
      "owner": "Dr. D. Cho", "oi": "DC", "due": "Aug 1", "priority": "medium",
      "measure": "Reduce missed actionable alarms to < 2% without alarm fatigue",
      "pdca": { "plan":  { "status": "active", "note": "Reviewing alarm data with Biomedical Engineering." },
                "do":    { "status": "todo", "note": "" }, "check": { "status": "todo", "note": "" }, "act": { "status": "todo", "note": "" } } }
  ]
}
```

### 1.5 Derived values (single source of truth)

```ts
// fishbone → key factors carried into 5 Whys
keyFactors = categories.flatMap(cat =>
  causes[cat.id].filter(c => c.key).map(c => ({ ...c, cat: cat.id })));

// per-stage completion (drives stepper checkmarks + progress dial)
done.problem  = !!(problem.what && problem.expected);
done.analysis = Object.values(whys).some(w => w.root.trim());
done.roots    = roots.length > 0 && roots.every(r => r.text.trim());
done.actions  = actions.length > 0 &&
                actions.every(a => Object.values(a.pdca).some(p => p.status !== "todo"));

// PDCA rollup for the header ("N steps closed")
pdcaDone = actions.flatMap(a => Object.values(a.pdca)).filter(p => p.status === "done").length;
```

---

## 2. Design token mapping

The RCA introduces **no new visual language**. Map each role to an existing token.

| Role            | Used for |
|-----------------|----------|
| `surface`       | Cards, panels, wheel center, active-stage rings |
| `surface-2`     | Subtle fills: segmented-control tracks, fact tiles, "to do" states, category blocks |
| `line`          | Hairline borders, separators, spine connectors |
| `line-strong`   | Stronger borders, dashed/empty outlines, fishbone ribs & spine |
| `ink` / `ink-2` / `ink-3` | Primary / secondary / tertiary text |
| `accent` / `accent-soft` / `accent-ink` | Active step, primary buttons, "Process" category, "Do" stage |
| `danger` + soft | Sentinel/effect head, "Root cause" pill, harm severity |
| `warning` + soft| "Check" stage, "active/doing" status, "Contributing" pill |
| `success` + soft| "Act" stage, "done" status, completed steps, saved indicator |
| `shadow` / `shadow-lg` | Card elevation / hover |
| `radius-card`   | Cards (reference ~14px), chips (~7px) |
| serif font      | Page title + card titles | (optional — sans is fine) |
| mono font       | Case id, CA-NN labels, numeric counts |

> All six category colors, the four PDCA colors, and the four classification colors should resolve to
> **distinct existing hues** in your palette. If you have fewer, reuse — but keep `process`/`do` = accent.

---

## 3. Shell & header

Reuse the app's existing sidebar/topbar. The RCA page adds:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Cases / MM-2026-0142 / RCA                          ◷ Saved  [Export][Submit]│  breadcrumb + actions
│                                                                            │
│ ⟳ Root Cause Analysis   [In review]   ⚠ Sentinel event                     │
│ Fatal post-op hemorrhage after elective colectomy            2/4 stages    │  title + progress
│ MM-2026-0142 · General Surgery · PACU · (AO) Dr. Okafor leading  4 steps closed│
│                                                                            │
│ ①─Problem──②─Causal analysis──③─Root causes──④─Corrective actions          │  stepper
└──────────────────────────────────────────────────────────────────────────┘
```

- **Breadcrumb** (left) + **save indicator** + **Export RCA** (ghost) + **Submit for review** (primary) (right).
- **Save indicator**: pill that flips to "Saved" (success) for ~1.6s after each edit, else "Draft" (neutral). Autosave the whole RCA object on every change (debounce optional). Persist current stage too.
- **Title block**: an "RCA" eyebrow with a cycle icon, a status pill, a **Sentinel event** danger chip, the case summary (serif, ~22px), then a meta row (case id mono · service · location · owner avatar).
- **Progress readout** (right of title): `N/4 stages` + `N PDCA steps closed`, plus 4 vertical bars — green if that stage is done, accent if it's current, else `line-strong`.
- **Stepper**: 4 segments joined by 2px connector lines. Each = a circular badge (number, or a check when `done[stage]`) + label + sub-label. Active segment gets a `surface` card with an `accent` border + shadow; badge is accent (current) / success (done) / `surface-2` outline (todo). Clicking a segment jumps to it (free navigation — not gated).
- **Footer nav bar** (sticky bottom): `‹ Back` (disabled on stage 1) · "Stage N of 4 · {label}" · `Continue ›` (primary) which becomes `✓ Complete RCA` (success) on the last stage.

Body is a centered column, `max-width ≈ 1180px`, scrollable. Comfortable/compact density just changes body padding.

---

## 4. Stage 1 — Problem

Two-column: main (flex) + sidebar (`~300px`).

- **"What happened"** card — danger-tinted icon, serif heading, auto-growing textarea (objective description).
- **"What should have happened"** card — success-tinted icon, textarea, plus a hint line: *"The gap between these two statements is the problem this RCA analyzes."*
- **Sidebar — "Event facts"** card: a harm-severity tile (danger) + fact rows for *When detected*, *Impact*, *Scope* (icon tile + value + label).
- **Sidebar — "RCA mandated"** callout (accent-soft): explains the sentinel trigger requires a full RCA + PDCA before closure.

---

## 5. Stage 2 — Causal analysis

A segmented toggle switches between two sub-views (count badges on each): **Fishbone** | **5 Whys**.

### 5.1 Fishbone (Ishikawa) diagram

```
   ┌ People ┐   ┌ Comm ┐   ┌ Process ┐         ← 3 category blocks (align bottom)
   └────┬───┘   └───┬──┘   └────┬─────┘
         ╲          │          ╱                ← ribs angle into the spine
   ═══════════════════════════════════▶ ┌─────────────┐
                                          │ ⚠ EFFECT     │   ← effect head (danger)
   ════════════════════════════════════▶ │ Fatal post-  │
         ╱          │          ╲           │ op hemorrhage│
   ┌────┴───┐   ┌───┴──┐   ┌────┴─────┐    └─────────────┘
   │ Equip  │   │ Env  │   │ Policy   │         ← 3 category blocks (align top)
   └────────┘   └──────┘   └──────────┘
```

**Construction** (the diagram is presentational; the category blocks hold the real UI):
- Container card. Inside, vertical stack: **top grid (3 cols) → up-ribs → spine row → down-ribs → bottom grid (3 cols)**.
- Each grid reserves `~210px` on the right for the **effect head** (`width: calc(100% - 210px)`), so blocks sit left of it. Top grid aligns its items to `end`, bottom to `start`, so they hug the spine.
- **Ribs**: a 30px-tall strip with 3 absolutely-positioned 2px lines at the column centers (`16.667% / 50% / 83.333%`), rotated `±26°` (up-ribs lean one way, down-ribs the other) — they read as diagonals feeding the spine.
- **Spine**: a 3px horizontal bar (gradient `line-strong → ink-3`) spanning to the head, ending in a CSS triangle **arrowhead** pointing into the head.
- **Effect head**: danger-tinted rounded box pinned right, "EFFECT" eyebrow + the effect statement.
- **Category block** (the interactive part): `surface-2`, rounded, with a header (icon chip in the category color + label + a count badge) and a vertical list of **cause cards**. A text-button "+ Add factor" in the category color appends a blank card.
- **Cause card**: `surface`, hairline border; if `key`, show a 3px **inset left strip** in the category color. Click text to edit inline; a **target-icon** toggle marks/unmarks it as a key factor (colored when on); a trash icon removes it.

Responsive: below ~900px, collapse both grids to a single column and render the effect head as a full-width banner above them (drop the ribs/spine).

### 5.2 5 Whys

One card per key factor (from §1.5). Empty state if none are flagged: prompt the user to mark factors with the target icon in the Fishbone.

```
┌─────────────────────────────────────────────────────────┐
│ ◎ KEY FACTOR  Escalation to attending delayed ~25 minutes │
├─────────────────────────────────────────────────────────┤
│ ①─ Why? — did this happen                                 │
│ │   [ Because… bedside nurse kept monitoring…        ]    │
│ ②─ Why?                                                   │
│ │   [ Because… unclear who to call / at what threshold]   │
│ … up to ⑤                                                 │
│ 💡 ROOT CAUSE REACHED                                     │
│     [ Absence of a governed escalation pathway…      ]    │
└─────────────────────────────────────────────────────────┘
```

- Header: target-icon chip + "KEY FACTOR" eyebrow + the factor text.
- Up to **5 numbered steps** down a connecting vertical line. Step badge fills accent when answered, else `surface-2` outline. Each step is an auto-growing "Because…" textarea. A step is **dimmed** until the previous one is answered (sequential disclosure; placeholder reads "Answer the previous why first").
- Terminal **"Root cause reached"** row: success-tinted bulb badge + textarea for the underlying root cause.

---

## 6. Stage 3 — Root causes

Intro line + an **"Add root cause"** primary button. Then a list of root-cause cards:

```
┌────────────────────────────────────────────────────────────────┐
│ 01  [⚙ Process]  [Root cause]                            🗑       │
│ [ No standardized, governed PACU escalation pathway…        ]    │  ← textarea
│ Classification [ System | Human | Environment | External ]   🔗 Linked│
└────────────────────────────────────────────────────────────────┘
```

- **Header**: mono index badge (`01`), a **category chip** (icon + label, in category color), a **type pill** (Root cause = danger / Contributing = warning), trash at far right.
- **Body**: auto-growing textarea for the statement.
- **Footer**: "Classification" + a 4-option segmented control (selected = that class's color, white text); right-aligned "Linked to corrective action" hint (link icon, accent) when `action` is set.

---

## 7. Stage 4 — Corrective actions (PDCA)

Intro line + **"Add action"** primary button. Then one card per action:

```
┌──────────────────────────────────────────────────────────────────────┐
│ CA-01  [High priority]                                          🗑      │
│ Implement standardized PACU escalation pathway        ← editable title  │
│ 🔗 Addresses: No standardized, governed PACU escalation pathway…        │
├──────────────────┬─────────────────────────────────────────────────────┤
│      P            │ ┌ P  Plan   · Define change & target  [To do|Doing|Done]│
│   ╭───────╮       │ │   [ notes… ]                                        │
│ A │  2/4   │ D    │ ├ D  Do     · Pilot on small scale    [···]           │
│   │ Doing  │      │ │   [ notes… ]                                        │
│   ╰───────╯       │ ├ C  Check  · Measure against target  [···]           │
│      C            │ ├ A  Act    · Adopt, adjust, abandon  [···]           │
│  (AO) Dr. Okafor  │                                                       │
│  ◷ Due Jul 15     │                                                       │
│  ◎ Measure: …     │                                                       │
└──────────────────┴─────────────────────────────────────────────────────┘
```

- **Header**: mono `CA-NN` + a **priority pill** (high = danger / medium = warning), trash at right. Editable **title** (borderless input, serif). A "🔗 Addresses: {root cause text}" line links back to the root cause.
- **Body grid**: left rail `~200px` + right content (collapse to single column under ~720px).
- **Left rail**:
  - **PDCA wheel** (see §7.1).
  - Owner (avatar + name), Due (icon + date), and a **"Measure of success"** tile (`surface-2`, target icon).
- **Right column**: 4 **PDCA stage rows**. Each: letter chip (in stage color) + label + blurb + a **status segmented control** (To do / Doing / Done). The active row gets the stage's soft background. Below each, an auto-growing notes textarea.

### 7.1 PDCA wheel (the signature visual)

A ~140px circular SVG: **four arcs** arranged on a compass — **Plan top, Do right, Check bottom, Act left** — read **clockwise**.

```
const center = { plan: 270°, do: 360°, check: 90°, act: 180° };  // SVG y-down degrees
arc(stage)   = arcPath(cx, cy, r, center[stage] − 37, center[stage] + 37);  // ~74° sweep, gaps between
r            = size/2 − 16;
```

- Each arc's **stroke** = its stage color when `done` or `active`, else `line-strong`. `todo` arcs are thinner (`~6px`) and ~40% opacity; engaged arcs are `~9px`, full opacity, round caps.
- A small **dot** at each arc's leading end (clockwise) on engaged stages suggests flow direction.
- **Compass letters** (P/D/C/A) positioned at each arc's center angle, colored by stage (muted when `todo`).
- **Center**: `done/4` count (large) + the current active stage's label (or "Closed" when 4/4, "—" when none).

This wheel is purely derived from `action.pdca[*].status` — no separate state.

---

## 8. Edit operations (reducer surface)

All edits flow through one reducer. Operations to support:

| Area | Ops |
|------|-----|
| Problem  | set field (`what` / `expected` / …) |
| Fishbone | add cause (cat), edit text, toggle `key`, remove |
| 5 Whys   | set step `i`, set `root` (keyed by cause id; lazily create the chain) |
| Roots    | add, edit text, set `cls`, remove (type/category may be set similarly) |
| Actions  | add, edit title, remove; set `pdca[stage].status`; set `pdca[stage].note` |

New ids are generated client-side. Adding an action seeds all four PDCA cells to `{status:"todo", note:""}`.

---

## 9. States & persistence

- **Autosave**: persist the entire RCA object on every edit (localStorage in the reference; your DB/API in production). Persist the active stage so a refresh resumes in place. Show the transient "Saved" pill.
- **Empty states**: 5 Whys with no key factors; Stage 3/4 with no items (the Add buttons are always present).
- **Inline-editable** text everywhere (textareas auto-grow; cause text and action title edit in place).
- **Free navigation**: any stage reachable from the stepper; completion badges are informational, not gates. (Add gating only if your workflow requires it.)

---

## 10. Component inventory

| Component        | Stage      | Responsibility |
|------------------|------------|----------------|
| `RCAWorkspace`   | shell      | header, progress, stepper, stage routing, autosave, footer nav |
| `Stepper`        | shell      | 4-stage progress nav |
| `ProblemPanel`   | 1          | what / expected + event facts + mandate callout |
| `AnalysisPanel`  | 2          | Fishbone ↔ 5 Whys toggle + derive key factors |
| `Fishbone`       | 2          | spine / ribs / effect head + 6 `CatBlock`s |
| `CatBlock` + `CauseCard` | 2  | a category's factors; inline edit, key-toggle, remove |
| `WhysPanel` + `WhyChain` | 2  | per-key-factor 5-Whys + captured root |
| `RootsPanel` + `RootCard` | 3 | distilled statements, classification, type |
| `ActionsPanel` + `ActionCard` | 4 | corrective actions |
| `PdcaWheel`      | 4          | 4-arc compass dial (derived) |
| `StatusSeg`      | 4          | To do / Doing / Done segmented control |

Each panel is a pure function of `(slice of RCA, dispatch)`. Stage + density live at the workspace level.

---

## 11. Acceptance checklist

- [ ] One RCA object drives all four stages; every visual derives from it (no duplicated state).
- [ ] Stepper shows current stage, marks completed stages with a check, and allows free navigation; footer Back/Continue mirror it.
- [ ] **Problem**: what vs. expected captured; event-fact sidebar + mandate callout present.
- [ ] **Fishbone**: six fixed categories around a spine→effect head; factors add/edit/remove inline; "key" toggle marks the left strip and feeds 5 Whys.
- [ ] **5 Whys**: one chain per key factor; steps disclose sequentially; terminal root-cause field; empty state when nothing flagged.
- [ ] **Root causes**: add/remove; classification (4) + type (root/contributing) selectable; category chip shown.
- [ ] **PDCA**: each action shows the 4-arc wheel reflecting per-stage status; status + notes editable per stage; owner / due / measure shown; priority pill correct.
- [ ] Progress dial + "N PDCA steps closed" update live; "Saved" pill flashes on edit; stage + data persist across refresh.
- [ ] All colors/radii/shadows/fonts resolve to **existing project tokens** — no hard-coded values introduced.
- [ ] Layout holds at narrow widths (fishbone collapses to a column; action card collapses left rail).
```
