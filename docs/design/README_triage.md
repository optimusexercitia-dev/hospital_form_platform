# Patient Safety Event Triage — Implementation Spec

The **front door** of the platform. Committees report events to the **Patient Quality & Safety
(PQS)** department, which triages each one through the **Joint Commission patient-safety-event
framework** to a disposition — culminating in whether a **Root Cause Analysis (RCA)** is mandated.

The triage is a **4-step guided decision flow** over one worksheet per event:

1. **Patient safety event?** — gate. If no, classify the closure reason and stop.
2. **Did it reach the patient?** — place on the **reach-and-harm spectrum** (5 levels).
3. **Harm severity** — the 6-tier harm scale (only when harm reached the patient).
4. **Sentinel-event screen** — JC criteria + designated categories → sentinel determination.

The screen is a **three-pane workstation**: intake **Queue** (left) · guided **Flow** (center) · live
**Disposition** rail (right) that assembles the verdict and routes a mandated RCA onward.

This document specifies **data model, decision logic, layout, and states**. It does **not** prescribe
colors, radii, or fonts — map every visual role to your existing tokens ([§2](#2-design-token-mapping)).
Pixel values are *layout intent*.

---

## 1. Data model

### 1.1 The triage worksheet (one per event)

```ts
interface Triage {
  pse:           boolean | null;          // step 1: is it a patient safety event?
  pseReason:     ReasonId | null;         // if pse === false
  reach:         ReachId | null;          // step 2
  severity:      HarmId | null;           // step 3
  naturalCourse: boolean | null;          // step 4: related to natural course of illness?
  designated:    string | null;           // step 4: chosen JC designated category, if any
  rca:           boolean | null;          // final mandate (auto-suggested from the screen)
  notes:         string;
}
const BLANK: Triage = { pse:null, pseReason:null, reach:null, severity:null,
                        naturalCourse:null, designated:null, rca:null, notes:"" };
```

### 1.2 Reach & harm spectrum — `ReachId` (ordered, escalating)

The hero control. `level` is the spectrum position; `reached`/`harmful` drive downstream gating.

| `k`        | Label            | reached | harmful | level | Color role | Definition |
|------------|------------------|:------:|:-------:|:-----:|------------|------------|
| `unsafe`   | Unsafe condition | ✗ | ✗ | 0 | neutral / slate | A circumstance that increases the probability of an event. None has occurred yet. |
| `near`     | Near miss        | ✗ | ✗ | 1 | success / green | Did not reach the patient — caught or intercepted. |
| `noharm`   | No-harm event    | ✓ | ✗ | 2 | info / blue | Reached the patient but caused no detectable harm. |
| `adverse`  | Adverse event    | ✓ | ✓ | 3 | warning / orange | Reached the patient and resulted in harm. |
| `sentinel` | Sentinel event   | ✓ | ✓ | 4 | danger / red | Resulted in death, permanent, or severe temporary harm. Mandates comprehensive review. |

Levels 0–1 = "Did not reach the patient"; levels 2–4 = "Reached the patient" (render as two bracket
groups over the 5 stops). Colors form a **green → red escalation ramp** left to right.

### 1.3 Harm severity — `HarmId` (NCC MERP / JC tiers)

| `k`     | Label                   | tier | severe | Color role |
|---------|-------------------------|:----:|:------:|------------|
| `none`  | No harm                 | 0 | ✗ | success / green |
| `mild`  | Mild temporary harm     | 1 | ✗ | caution / amber |
| `mod`   | Moderate temporary harm | 2 | ✗ | caution / amber |
| `severe`| Severe temporary harm   | 3 | ✓ | warning / orange |
| `perm`  | Permanent harm          | 4 | ✓ | warning / orange |
| `death` | Death                   | 5 | ✓ | danger / red |

`severe: true` (the **sentinel tier** — severe/permanent/death) is what can elevate an adverse event
to sentinel. Tag those three visually as "Sentinel tier."

### 1.4 Sentinel designated categories (JC "always review")

Selecting any one **auto-qualifies** the event as sentinel regardless of harm tier.

```
Surgery on the wrong site, wrong patient, or wrong procedure
Unintended retention of a foreign object
Suicide or self-harm in a staffed care setting
Unanticipated death of a full-term infant
Severe maternal morbidity or maternal death
Fall resulting in death, permanent, or severe harm
Hemolytic transfusion reaction (major incompatibility)
Fire, flame, or unanticipated burn during direct care
Patient abduction or elopement resulting in harm
Discharge of an infant to the wrong family
```

### 1.5 Not-a-PSE closure reasons — `ReasonId`

| `k`           | Label                          | Definition |
|---------------|--------------------------------|------------|
| `natural`     | Natural course of illness      | Outcome attributable to the underlying condition, not to care. |
| `expected`    | Known / expected complication  | A documented, consented risk of the procedure or therapy. |
| `nonclinical` | Non-clinical concern           | Service, billing, or facilities matter — route elsewhere. |
| `duplicate`   | Duplicate report               | Already captured under another event record. |

### 1.6 Reporting committees (intake sources)

Each event arrives from a committee. Map each to a label + color chip.

```
mm    → M&M Committee            pharm → Pharmacy & Therapeutics
nurse → Nursing Quality          infx  → Infection Control
anes  → Anesthesiology QA        rel   → Patient Relations
```

### 1.7 Intake event

```ts
interface IntakeEvent {
  id: string;                 // "PQS-2451"
  caseId: string | null;      // links to a downstream case/RCA record where relevant
  src: SourceId;              // reporting committee
  recv: string; recvFull: string;   // "2h ago" / "Jun 18, 07:14"
  pt: string; mrn: string;    // de-identified patient line ("67 M" / "•••4821")
  svc: string; loc: string;
  brief: string;              // one-line event description
  reporter: string;
  priority: "high" | "medium" | "low";
  triage: Triage;             // worksheet (BLANK if untriaged)
}
```

### 1.8 Seed events (de-identified reference)

> Ship a spread of states so both the working and resolved experiences are visible. The first
> untriaged event auto-selects on load.

| id | src | priority | brief (abбrev.) | seeded triage |
|----|-----|----------|------------------|---------------|
| PQS-2451 | mm | high | Post-op intra-abdominal hemorrhage after colectomy; escalation delayed; patient died | **untriaged** → walks to sentinel/RCA |
| PQS-2450 | pharm | medium | Expired epinephrine found stocked in crash cart; not administered | untriaged → unsafe condition |
| PQS-2449 | nurse | medium | Heparin infusion at 2× rate; intercepted by double-check | untriaged → near miss |
| PQS-2448 | mm | medium | Insulin dosing error; transient hypoglycemia; full recovery | `pse, reach:adverse, sev:mod, natural:false` → not sentinel |
| PQS-2447 | mm | high | Retained surgical sponge post-partum; second procedure | `pse, reach:sentinel, sev:mod, designated:"…foreign object", rca:true` |
| PQS-2446 | nurse | high | Inpatient fall → displaced hip fracture; operative repair | `pse, reach:sentinel, sev:perm, designated:"Fall…", rca:true` |
| PQS-2445 | anes | medium | Wrong-site block prepared; caught at time-out before incision | `pse, reach:near, sev:none, rca:false` |
| PQS-2444 | rel | low | Complaint re: weekend discharge timing | `pse:false, reason:nonclinical` |

Full patient/reporter fields per event are de-identified (age/sex, masked MRN, service, location).

---

## 2. Design token mapping

No new visual language. Map each role to an existing token.

| Role | Used for |
|------|----------|
| `surface` / `surface-2` | Cards & panels / queue background, segmented tracks, inactive fills |
| `line` / `line-strong` | Hairlines & separators / stronger + dashed borders |
| `ink` / `ink-2` / `ink-3` | Primary / secondary / tertiary text |
| `accent` (+ soft, + ink) | Active step, primary buttons, selection rings, "Nursing" source |
| `success` (+ soft) | Near miss, "No harm", "No RCA required", saved indicator, met-criteria |
| `caution` / amber (+ soft) | Mild/moderate harm tiers |
| `warning` / orange (+ soft) | Adverse event, severe/permanent harm |
| `danger` / red (+ soft) | Sentinel, death, "RCA mandated", high-priority, alert criteria |
| `info` / blue (+ soft) | No-harm event, "in triage" status |
| status hues ×N | The six committee source chips (reuse your categorical palette) |
| `shadow` / `shadow-lg` | Card elevation / selected + hover |
| `radius-card` | Cards ~14–16px, chips ~6px |
| serif font | Page/section/verdict titles (optional — sans is fine) |
| mono font | Event ids, case ids, level numbers |

> The reach spectrum and harm scale **must read as ordered color ramps** (green→red). If your palette
> lacks distinct steps, reuse hues but keep level 0/1 cool, level 3 warm, level 4 red.

---

## 3. Layout — three-pane workstation

```
┌─ sidebar ─┬─────────────────────────────────────────────────────────────────────┐
│ (app nav) │ 🛡 Patient Quality & Safety        2 Awaiting · 14 Sentinel · 6 RCA  ◷ │ dept topbar
│           ├──────────────┬───────────────────────────────────┬──────────────────┤
│           │ ▣ Event      │ PQS-2451  [M&M]  [High]   Jun 18    │ TRIAGE           │
│           │   intake  2● │ Post-op hemorrhage after colectomy… │ DISPOSITION      │
│           │ [All][Await] │ 👤 67 M · MRN ••4821 · Gen Surgery   │ Source   [M&M]   │
│           │ [Triaged]    ├─────────────────────────────────────┤ Safety   ✓Conf.  │
│           │ ┌──────────┐ │ ① Is this a patient safety event?   │ Class    Sentinel│
│           │ │M&M    2h │ │   [ Yes ─ PSE ] [ No ─ not a PSE ]  │ Harm     Death   │
│           │ │Post-op…  │ │ ② Did it reach the patient?         │ Sentinel ⚠ Yes   │
│           │ │ Awaiting │ │   ┌0─┬1──┬2───┬3────┬4─────┐ spectrum│ ┌──────────────┐ │
│           │ ├──────────┤ │   │Uns│Near│Noh│Adv │SENT │        │ │ ⟳ RCA        │ │
│           │ │Pharmacy  │ │ ③ Harm severity  [No…Death scale]   │ │   MANDATED   │ │
│           │ │ …        │ │ ④ Sentinel screen → determination   │ │ Due Aug 2    │ │
│           │ └──────────┘ │                                     │ └──────────────┘ │
│           │              │                                     │ [Open RCA →]     │
│           │              │                                     │ [Route][Monitor] │
└───────────┴──────────────┴─────────────────────────────────────┴──────────────────┘
```

- Reuse the app shell/sidebar. The triage area is its own department topbar + 3 panes.
- **Topbar**: department icon + "Patient Quality & Safety" / "Event intake & triage · Joint Commission framework", then right-aligned **stat readouts** (Awaiting triage / Sentinel YTD / RCAs active) + an **auto-save pill** (flips to "Saved" ~1.5s after each edit).
- **Pane widths**: Queue `~312px` (fixed) · Center **flex, `min-width ≈ 468px`** · Disposition `~320px` (fixed). The pane row is `overflow-x: auto` so below the combined min width it scrolls horizontally rather than crushing the center (target ≥1280px shows all three with no scroll). On narrow/responsive targets, prefer collapsing the Queue to a drawer and the Disposition to a bottom sheet.

---

## 4. Queue (left)

- Header: inbox icon + "Event intake" + a "N new" danger/amber badge (count of untriaged).
- **Filter tabs**: All · Awaiting · Triaged, each with a count. "Awaiting" includes both untriaged and in-progress worksheets.
- **Event card**: priority dot (high=danger / medium=amber / low=neutral) · source chip · received-age · 2-line brief clamp · event id (mono) · a **status badge**:
  - untriaged → "Awaiting triage" (amber)
  - in progress → "In triage" (info)
  - triaged & not PSE → "Not a PSE" (neutral)
  - triaged → "Triaged" (success), or **"RCA"** with a cycle icon (danger) when the verdict is sentinel.
- Selected card: accent border + raised shadow.

**Stage derivation** (drives badges + tab grouping):
```
stage(t) = t.pse === null            ? "untriaged"
         : t.pse === false           ? "triaged"      // closed as not-a-PSE
         : complete(t)               ? "triaged"
                                     : "in";
complete(t) = t.reach && (!harmful(t.reach) || t.severity)
              && (!reached(t.reach) || !severe(t.severity) || t.naturalCourse !== null || !!t.designated);
```

---

## 5. Flow (center)

A scrollable column (`max-width ≈ 760px`). Header strip = event context: id (mono) · source chip ·
priority flag · received time, then the brief as a serif headline, then a meta line (patient · MRN ·
service · location · reporter · linked case id).

Each step is a **card** with a numbered head (badge: accent=active, success+check=done, outline=todo)
+ serif title + sub. Steps 2–4 render **dimmed + non-interactive** until step 1 = Yes; step 3/4 dim
until a reach is chosen.

### Step 1 — PseGate
Two large choice cards: **Yes — patient safety event** (accent) / **No — not a safety event**
(neutral). Selecting "No" reveals a 2×2 grid of **closure reasons** (§1.5) and ends the flow.

### Step 2 — ReachSpectrum (hero)
- Two bracket labels above: "Did not reach the patient" (over stops 0–1) · "Reached the patient"
  (over stops 2–4), each a centered hairline-flanked caption.
- **Five stops** in a row, each a button: a top **color bar** (the escalation ramp; full when
  selected, ~50% otherwise), the mono `level` number, a check when selected, and the label.
  Selected stop: colored border + soft bg + raised (`translateY(-2px)`) + `shadow-lg`.
- Below: a **definition card** for the selected stop, tinted in its color, with a "reached patient"
  vs "did not reach" icon.

### Step 3 — HarmScale
- If the chosen reach is **not harmful** (`unsafe`/`near`/`noharm`): render a resolved success banner
  — "No harm. A {reach} does not reach the patient with harm — severity grading not applicable." (No picker.)
- Otherwise: **six tiles** (No harm → Death). Each tile has a short **bar whose width grows with tier**
  (`30% + tier·12%`) in the tier color, the label, and a "Sentinel tier" tag on severe/perm/death.
  Selected = colored border + soft bg. Below: one-line definition of the selection.

### Step 4 — SentinelScreen
Two columns:
- **General criteria** (auto-evaluated checkmarks, green when met, neutral-✗ when not):
  1. Reached the patient *(from reach.reached)*
  2. Death, permanent, or severe temporary harm *(from severity.severe)*
  3. **Unrelated to natural course of illness** — this one has a **Unrelated / Natural** segmented
     toggle (sets `naturalCourse`); the checkmark lights only when "Unrelated".
- **Designated category**: a dropdown of §1.4 (plus "None"). Any selection auto-qualifies as sentinel.
- **Determination banner** (bottom, full width):
  - **Sentinel** (danger): "Meets sentinel-event criteria" + reason (by criteria vs designated) + an
    "RCA mandated" chip.
  - **Not sentinel** (success): "Does not meet sentinel criteria — continue with committee review."

---

## 6. Disposition rail (right)

Header "TRIAGE DISPOSITION". A list of **summary rows** that fill in live:

| Row | Content |
|-----|---------|
| Source | committee chip + "Received {time} · {reporter}" |
| Safety event | "Confirmed" (accent) / "Not a PSE" (neutral) / — |
| Reason | *(only when not a PSE)* the closure reason |
| Classification | reach chip in its color / — |
| Harm | harm chip (or "No harm" for non-harmful reach) / — |
| Sentinel | "Sentinel" (danger) / "No" (success) / — |

Then the **verdict block**:

```
verdict = !pse            ? "closed"   // not a PSE
        : isSentinel      ? "rca"      // → RCA mandated
        : reach chosen    ? "review"   // no RCA required
                          : "pending";
```

- **rca** (danger): "RCA mandated" + "A comprehensive root cause analysis must be completed within
  45 days of the event." + a due-date chip (event date + 45 days).
- **review** (success): "No RCA required — route to the originating committee for standard review."
- **closed** (neutral): "Close & route — not a patient safety event."
- **pending** (dashed): "Disposition pending — complete the steps to determine routing."

**Sentinel determination** (shared with the screen):
```
reached  = reach?.reached
severe   = severity?.severe
isSentinel = (reached && severe && naturalCourse === false) || !!designated;
```

**Actions** (footer): when verdict = rca → primary **"Open RCA workspace →"** (danger; navigates to
the RCA feature, passing the event/case id). Otherwise → **"Confirm disposition"** (accent). Always a
secondary **Route** + **Monitor** pair.

---

## 7. State, reducer & persistence

- One reducer keyed by event id; every edit dispatches `{ type, id, value }`. Operations: set `pse`
  (clears reach/severity when false), set reason, set `reach`, set `severity`, set `naturalCourse`,
  set `designated`, set `rca`, set `notes`.
- **Cross-field rules** on `reach` change:
  - non-harmful reach (`unsafe`/`near`/`noharm`) → force `severity = "none"`, `naturalCourse = null`.
  - `reach = "sentinel"` while severity is below the sentinel tier → bump `severity` to `"severe"`.
- **Autosave** the whole map (localStorage in reference; your store in prod). Flash the "Saved" pill.
- First **untriaged** event auto-selects on load.

---

## 8. Component inventory

| Component | Pane | Responsibility |
|-----------|------|----------------|
| `TriageWorkstation` | shell | topbar, 3-pane layout, reducer, autosave, tweaks |
| `Queue` + `QueueCard` | left | filterable intake list, stage badges |
| `EventHeader` | center | patient/event context strip |
| `PseGate` | center | step 1 + closure reasons |
| `ReachSpectrum` | center | step 2 hero spectrum + definition |
| `HarmScale` | center | step 3 tiers (or resolved "no harm") |
| `SentinelScreen` | center | step 4 criteria + designated + determination |
| `Disposition` | right | summary rows, verdict block, actions |
| `deriveVerdict(triage)` | shared | reached / severe / isSentinel logic |
| `triageStage(triage)` | shared | untriaged / in / triaged |

---

## 9. Acceptance checklist

- [ ] One worksheet per event drives queue badge, flow, and disposition; all derive from `deriveVerdict` / `triageStage`.
- [ ] Step gating: 2–4 dim until PSE = Yes; 3–4 dim until a reach is chosen; "No" reveals closure reasons and ends the flow.
- [ ] Reach spectrum reads as an ordered green→red ramp with the two reach brackets; selection shows its definition.
- [ ] Harm scale shows growing-width tiers, flags the sentinel tier, and auto-resolves to "No harm" for non-harmful reach.
- [ ] Sentinel screen auto-checks reached + severe; the natural-course toggle and designated dropdown both feed the determination; banner flips danger/success correctly.
- [ ] Disposition rail fills live and shows the right verdict (rca / review / closed / pending); RCA verdict surfaces the 45-day due date + "Open RCA workspace".
- [ ] Cross-field rules fire (non-harmful reach → no harm; sentinel reach → ≥ severe).
- [ ] Autosave + "Saved" pill; first untriaged auto-selects; queue filters group by stage.
- [ ] All colors/radii/fonts resolve to **existing project tokens** — no hard-coded values introduced.
- [ ] Three panes fit at ≥1280px; narrower widths scroll/collapse without crushing the center.
```
