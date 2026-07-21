# Document Control — Frontend Handoff

Developer handoff for the **Controlled Document Lifecycle** section of the Concord Review hospital committee platform. This describes every screen, its layout, the data model, component inventory, state/routing, and interaction behavior so the frontend can be rebuilt in a production stack (React/Vue/etc.).

The reference implementation is `Controlled Documents.html` + the `docs-*` files. It reuses the platform design system (`mm.css`), shared primitives (`ui.jsx`, `admin-nav.jsx`, `shell.jsx`), and the tweaks panel. This document is self-contained; you do not need to read the prototype to rebuild.

---

## 1. Purpose & scope

Administrators create **controlled documents** (SOPs, clinical protocols, committee charters, guidelines). Each document is routed to committee members for **parallel review & approval** (all assigned reviewers must sign off independently). Approved documents are locked; any change requires creating a **new version**, which re-enters review. Every version is retained for audit.

Four screens, one section:

| Screen | Route/view key | Primary user |
|--------|----------------|--------------|
| Document register (library) | `library` | Administrator |
| Create new document (wizard/single form) | `create` (`mode: "create"`) | Administrator |
| Create new version (same flow) | `create` (`mode: "newversion"`) | Administrator |
| Document detail (versions + approvals + compare) | `detail` | Administrator |

---

## 2. Design system (inherited — do not reinvent)

**Fonts** (Google Fonts): IBM Plex Serif (headings/titles/brand), IBM Plex Sans (UI/body), IBM Plex Mono (IDs, version numbers, dates, file names). Numbers use `font-variant-numeric: tabular-nums` (class `.tnum`).

**Tokens** are CSS custom properties, theme-scoped via a class on the root container (`.mm.theme-calm | .theme-command | .theme-ledger`). Key tokens:

- Surfaces: `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`
- Ink: `--ink`, `--ink-2`, `--ink-3`
- Accent: `--accent`, `--accent-2`, `--accent-soft`, `--accent-ink`
- Sidebar: `--sidebar-bg`, `--sidebar-ink`, `--sidebar-active-bg`, `--sidebar-active-ink`
- Elevation: `--shadow`, `--shadow-lg`
- **Status accents** (reused as document lifecycle colors): `--st-screen/-bg` (slate), `--st-sched/-bg` (blue), `--st-review/-bg` (purple), `--st-action/-bg` (amber), `--st-closed/-bg` (green)
- **Severity scale** (borrowed for emphasis): `--sev-death/-bg` (red), `--sev-temp/-bg` (amber)

**Shape:** controls 36–38px tall; radii — pills `999px`, chips/buttons/inputs `8px`, cards `12–14px`; hairlines `1px solid var(--line)`, input borders `var(--line-strong)`. Page gutters 28px.

**Theming rule:** everything is driven by tokens. The three themes only swap token values (calm = light blue rail; command = dark navy rail with `dark` flag; ledger = warm teal). Components must never hardcode hex.

---

## 3. Data model

```ts
type DocTypeKey   = "protocol" | "charter" | "sop" | "guideline";
type StatusKey    = "draft" | "review" | "approved" | "revision" | "superseded" | "retired";
type SignState    = "signed" | "pending" | "changes";

interface Approval {
  id: string;          // member id
  name: string;        // "Dr. Helena Cruz"
  init: string;        // "HC"
  role: string;        // "Committee Chair"
  state: SignState;
  date: string | null; // "Jul 19" when signed/changes, null when pending
}

interface Version {
  v: string;           // "4.0" (mono display "v4.0")
  status: StatusKey;   // review | approved | superseded | draft | retired
  date: string;        // submitted date, e.g. "Jul 18, 2026"
  effective: string;   // "Apr 1, 2026" or "—"
  author: string;
  file: { name: string; kind: "pdf" | "docx"; size: string };
  summary: string;     // reason for this version — permanent in history
  approvals: Approval[]; // empty for a pure draft
}

interface Document {
  id: string;          // "SOP-2026-0114" (mono, colored --accent)
  title: string;
  type: DocTypeKey;
  committee: string;   // owning committee name
  category: string;
  owner: string; ownerInit: string;
  status: StatusKey;   // document-level rollup status
  version: string;     // current/latest version number
  effective: string;   // current effective date or "—"
  nextReview: string;  // "Jun 2027" or "—"
  desc: string;
  tags: string[];
  versions: Version[]; // NEWEST FIRST (index 0 = current/latest)
}
```

**Lookup tables** (labels, colors, descriptions):

- `DOC_TYPES`: `protocol` → "Clinical Protocol" (short "Protocol", `--st-review`); `charter` → "Committee Charter" (short "Charter", `--accent`); `sop` → "SOP" (`--st-sched`); `guideline` → "Clinical Guideline" (short "Guideline", `--st-closed`).
- `DOC_STATUS`: `draft` "Draft" (`--st-screen`) · `review` "In review" (`--st-review`) · `approved` "Effective" (`--st-closed`) · `revision` "Under revision" (`--st-action`) · `superseded` "Superseded" (`--ink-3`) · `retired` "Retired" (`--ink-3`). Each has `{label, color, bg, desc}`.
- `SIGN`: `signed` "Approved" (green) · `pending` "Awaiting" (neutral) · `changes` "Changes requested" (amber).
- `MEMBERS`: pool of 9 committee members (`{id, name, init, role}`) available as reviewers.
- `COMMITTEES`: 5 committee names. `CATEGORIES`: 7 category names.

**Important semantics**
- `versions[0]` is always the current/latest version.
- Document-level `status` mirrors `versions[0].status` for review/draft, and rolls up to `approved` (Effective), `revision` (a newer draft exists over an effective version), `superseded`/`retired` for archive.
- Approval model is **parallel + unanimous**: a version becomes effective only when every approval is `signed`. This is fixed for controlled documents (not configurable per doc).
- Archive filter = `superseded` OR `retired`.

---

## 4. Component inventory

Shared/platform (reuse as-is):
- **Card** `{pad, style}` — white surface, hairline, radius 14, `--shadow`.
- **Avatar** `{initials, size}` — circle, accent-on-accent-soft initials; dashed circle + "—" when null.
- **Icon set** — 1.6px stroke, `currentColor`. `I.*` (check, chevR, chevD, clock, flag, search…) and `DI.*` (doc, docCheck, upload, download, history, compare, layers, inbox, archive, shieldDoc, calendar, x, eye, send, file).
- **SearchBox**, **Dot**, **Chip**, **TONE/TONE_BG** tone maps.

Document-Control-specific (built here — `docs-fields.jsx`):
- **DBtn** `{kind: primary|ghost|soft|quiet|danger, icon, size: sm|md, onClick, disabled}` — the interactive button (the platform's `Btn` is static/decorative).
- **StatusTag** `{k, size}` — lifecycle pill (dot + label), colored from `DOC_STATUS`.
- **TypeTag** `{k}` — document-type chip from `DOC_TYPES`.
- **FileGlyph** `{kind, size}` — file icon with "PDF"/"DOC" overlay (red for pdf, blue for docx).
- **Field** `{label, hint, required, children}` — label row (`*` in red for required, muted hint after `·`) + control.
- **TextInput / TextArea / SelectField** — 38px tokened inputs; focus ring `0 0 0 3px var(--accent-soft)` + accent border.
- **Segmented** `{value, options, onChange}` — inline segmented control (doc type, version increment, wizard layout).
- **TagField** `{value[], onChange}` — chip input, Enter to add, × to remove.
- **Dropzone** `{value, onChange, sample}` — dashed upload target → filled file card (glyph, mono name, kind·size·"Attached", Remove). In the prototype a click attaches a `sample` file object; production wires a real file input / drag-drop.
- **ReviewerPicker** `{selected[], onChange}` — grid of member toggle cards (avatar + name + role + check), multi-select.

---

## 5. App shell, routing & state (`docs-app.jsx`)

Root component `DocControlApp` owns everything.

**Layout:** flex row — `DocRail` (236px, fixed) + main column (`--bg`) with a sticky-style topbar (`--surface`, bottom hairline, `18px 28px`) over a scrolling content area. Content is centered with `max-width: 1180px` on the library, `1120px` on create/detail; content padding `24px 28px 64px` (comfortable) or `18px 28px 56px` (compact).

**State:**
```
docs        // mutable Document[] (seeded from DOCS) — create/new-version write back
view        // "library" | "detail" | "create"
activeId    // selected document id (detail / new-version target)
createMode  // "create" | "newversion"
banner      // success message string | null (shown on library + detail after submit)
t           // tweak values: { theme, density, createFlow }
```

**Navigation actions:** `openDoc(id)` → detail; `startCreate()` → create (mode create); `startNewVersion(id)` → create (mode newversion, activeId=id); rail items return to the register.

**Submit handler** (`handleSubmit(payload)`):
- Builds `approvals[]` from selected reviewer ids, all `state: "pending"`.
- Builds a new `Version` `{v, status:"review", date:"today", effective, author, file, summary, approvals}`.
- **new version:** prepend to target doc's `versions`, set doc `status:"review"` + `version`.
- **create:** construct a new `Document` (status `review`, one version) and prepend to `docs`.
- Sets a success `banner`, routes to that document's `detail`.

**Topbar** contents vary by view:
- library → serif title "Document Control" + subtitle; right: `SearchBox` + primary "New document".
- create → title "New controlled document" / "New version" + subtitle; right: muted "Controlled workflow" affordance.
- detail → title "Document Control" + `{id} · {committee}` subtitle; no right actions (actions live in the detail header card).

---

## 6. Screen — Document register (library) · `docs-library.jsx`

The default landing view. Top to bottom:

1. **Success banner** (conditional) — green-tinted bar with check icon, message, dismiss ×. Appears after a create/new-version submit.
2. **KPI strip** — 4-up grid (`repeat(4,1fr)`, gap 12) of `DocKpi` cards `{icon, tone, label, value, sub}`:
   - Controlled documents (accent) · Awaiting review (warn/amber) · Currently effective (good/green) · In revision / draft (plain). Values are computed from `docs`. Card = icon chip + label, big tabular value (27px/700), tinted sub-line with a dot.
3. **Register card** (`Card pad={false}`):
   - **Header row:** "Document register" + "{n} shown" muted + right-aligned **filter chips**: `All · Awaiting review · Effective · Drafts · Under revision · Archived` (active chip = solid `--accent`/white pill; others = ghost). Filters map to status (Archived = superseded|retired).
   - **Column header:** uppercase 11px eyebrow on `--surface-2`.
   - **Grid columns:** `minmax(0,2.5fr) 140px 76px 132px 34px`, gap 14, cell padding `13px 18px` → **Document · Committee · Version · Status/approval · (chevron)**.
   - **Rows** (zebra `--surface`/`--surface-2`, hairline between, hover = `--accent-soft`, whole row clickable → detail):
     - **Document:** 38px type-tinted icon tile + title (14/600, **truncates**) + `TypeTag`; second line = mono `--accent` document ID (nowrap) + `· category` (truncates). Cell is `minWidth:0; overflow:hidden`; the title span is `flex:0 1 auto; minWidth:0` so ellipsis engages at narrow widths.
     - **Committee:** committee name (truncates) + small avatar + owner name.
     - **Version:** mono `v{version}` + "Eff. {date}" / "Not effective".
     - **Status/approval:** `StatusTag`; for `review` docs, an `ApprovalMini` progress bar (`signed/total`, amber if any "changes requested", else purple) below.
     - **Chevron** right-aligned.
   - Empty state: centered muted "No documents in this view."

**Interactions to wire (prod):** row click → detail; filter chips → filter list; search box → filter by title/ID/committee; "New document" → create.

---

## 7. Screen — Create / New-version flow · `docs-create.jsx` (PRIMARY SCREEN)

One component, `CreateFlow`, drives **two modes** (`create` | `newversion`) and **two layouts** (`wizard` | `single`, from the `createFlow` tweak). The four content sections are identical across layouts — only the chrome differs (wizard shows one section at a time with a stepper + Back/Continue; single form stacks all four with one submit).

### 7.1 Page layout

Two-column grid: **main** (`minmax(0,1fr)`) + **right rail** (300px), gap 20, `align-items: start`.

- **Main (wizard):** `Stepper` (top) → `Card` (`22px 24px`) containing the active `FormSection` → footer nav bar.
- **Main (single form):** same `Card`, all four `FormSection`s stacked with 34px gaps, single footer with Submit.
- **Right rail (sticky):** `ChecklistRail` — "Ready to submit" progress card + "How approval works" explainer.

### 7.2 Stepper (wizard only)

Horizontal, 4 steps: **Details · Document (or "New file") · Reviewers · Confirm**. Each step = numbered circle + label joined by a flexible connector line. States: **done** (accent fill + check, connector accent) · **current** (accent ring + accent-soft fill, bold label) · **upcoming** (hairline circle, muted). Visited steps are clickable to jump back (`maxReached` gates forward jumps). Container is `overflow:hidden` and connectors shrink (`flex:1; minWidth:8; margin:0 9px`) so it never bleeds into the rail at narrow desktop widths.

### 7.3 The four sections

**Step 1 — Document details / identity**
- *create mode:* `Field`s — Document title (required); a 2-col row of Document type (`Segmented`: Protocol/Charter/SOP/Guideline) + Document ID (auto-assigned, read-only mono, prefix by type: `PROT/CHTR/SOP/GUID` + `-2026-0xxx`); a 2-col row of Owning committee (`SelectField`, required) + Category (`SelectField`); Description (`TextArea`); Tags (`TagField`).
- *newversion mode:* identity is **locked** — a `LockedMeta` panel (2-col read-only grid: Title, Type, Committee, Category, Document ID, Owner) with a "carried over from v{current} — locked" header, plus an amber callout: "You're creating v{next}. When approved it will supersede v{current}." (No editable metadata — versioning must not fork identity.)

**Step 2 — Upload document / new version**
- `Dropzone` (required) — "PDF or DOCX · up to 25 MB · a locked copy is stored per version."
- 2-col row:
  - *create:* Version (auto read-only `v1.0`). *newversion:* Version increment `Segmented` — Major (`v{maj+1}.0`) / Minor (`v{maj}.{min+1}`), computed from the current version.
  - Proposed effective date (`<input type="date">`) — "applies once fully approved."
- Change summary / "Reason for this revision" (`TextArea`, **required**) — "recorded permanently in the version history."

**Step 3 — Reviewers & approval**
- Purple callout explaining **parallel review** (all must approve).
- Assign reviewers (`ReviewerPicker`, required ≥1; shows "{n} selected").
- 2-col row: Review due date (`date`, required) + Approval policy (read-only "Unanimous sign-off", fixed).

**Step 4 — Review & submit**
- Summary card: type-tinted icon + title + mono ID + mono `v{next}` + `TypeTag`; 2×2 read-only grid (Committee, Category, Effective date, Review due).
- Attached file (echoes the `Dropzone` filled state, or a red "No file attached — go back to step 2").
- Change summary (read-only panel).
- Reviewers ({n}) — "all must approve" — avatar chips (or red "No reviewers assigned").

### 7.4 Right rail — `ChecklistRail`

- **Ready to submit** card: percent (green at 100%) + progress bar + 6 checklist items with check bullets that fill as satisfied: Title · Owning committee · Document file attached · Change summary · At least one reviewer · Review due date. (In new-version mode Title/Committee are pre-satisfied via inherited identity.)
- **How approval works** card: explains that on submit the document/version → **In review**; each reviewer signs off independently; all must approve; the current effective version stays in force until then.

### 7.5 Footer nav & validation

- Left: `Cancel` (quiet) → returns to detail (new-version) or library (create).
- *wizard:* `Back` (steps > 0) and, right-aligned, "Step {n} of 4" + `Continue` (disabled until the current step is valid). On the last step, `Submit for review` (primary, send icon, disabled until all checklist items pass).
- *single form:* just `Submit for review` (same gating).
- Per-step validity: step 1 = title+committee (create) / always (newversion); step 2 = file+summary; step 3 = ≥1 reviewer + due date; step 4 = all.

---

## 8. Screen — Document detail · `docs-detail.jsx`

Top to bottom:

1. **Back link** — "‹ All documents" → library.
2. **Header card** (`Card`): 48px type-tinted icon; title (serif 22) + `TypeTag` + `StatusTag`; meta line (mono ID `--accent` · committee · "Current v{version}"); description (max-width 720). Right: stacked actions — primary **"Create new version"** (→ new-version flow) + ghost **"Download current"**.
3. **Two-column body** (`minmax(0,1fr) 300px`, gap 16):
   - **Left — Version history** (heading + "{n} versions" + a **Compare** button that enables when exactly 2 versions are selected). A list of `VersionCard`s, newest first:
     - **VersionCard** header: mono `v{n}` + `StatusTag` + "Latest" tag on the current one; right — a **Compare** select toggle (checkbox affordance; selecting a 3rd replaces the oldest of the pair) + "PDF" download.
     - Body: Author / Submitted / Effective triple; a file row (`FileGlyph` + mono name + kind·size + "Open"); "Reason for this version" summary; **Approvals** section (only if any) — "parallel · all required" + "{signed}/{total} signed", then one `ApprovalRow` per approver (avatar, name, role, date, state pill; a "Remind" action on pending approvers of the current version). Current version card is accent-bordered with `--shadow-lg`.
   - **Right rail:**
     - **Document details** card: Document ID (mono), Type, Committee, Category, Owner (avatar+name), Effective, Next review; tag chips below a divider.
     - **Controlled document** card: shield icon + three check bullets — "Approved versions are read-only." / "Any change requires a new version and fresh sign-off." / "All prior versions are retained for audit."
4. **Compare modal** (`CompareModal`) — overlay (`position:absolute; inset:0` within the app container, dim scrim, click-out to close). A 3-column table (`140px 1fr 1fr`): row-label / older ("Before") / newer ("After"), comparing Status, Submitted, Effective, Author, File, Approvals. Changed cells in the "After" column are highlighted (`--accent-soft`, bold, "changed" tag). Below the table, the newer version's change summary in a callout.

---

## 9. Tweaks (design-time options)

Exposed via the floating Tweaks panel; persisted through the host protocol. Defaults `{ theme:"calm", density:"comfortable", createFlow:"wizard" }`.

- **Create/new-version layout** — `wizard` (guided 4-step) vs `single` (one scrollable form). Same four sections either way.
- **Density** — comfortable / compact (content padding).
- **Theme** — Clinical calm (blue) / Command (navy rail) / Ledger (teal).

For production these map to: a user/admin preference (create layout), a workspace density setting, and the platform theme.

---

## 10. Rebuild notes / gotchas

- **Versions array is newest-first** everywhere (`versions[0]` = current). Keep this or invert consistently.
- **Locked identity on new versions is intentional** — do not let the new-version flow edit title/type/committee/ID/owner; a version supersedes, it does not fork.
- **Parallel + unanimous approval is a business rule**, not a UI toggle — render it as fixed. Effective status requires all `signed`.
- **Status is a rollup** of the latest version plus effective/superseded/retired lifecycle; compute it rather than storing divergent copies.
- **`DBtn` vs platform `Btn`:** the platform's `Btn` is presentational (no onClick). Use a real button (here `DBtn`) for anything interactive.
- **Truncation:** every table/rail cell that holds variable text needs `minWidth:0` on the grid item (and `overflow:hidden` on the cell) for the inner ellipsis to work — the register grid depends on this.
- **All color via tokens.** Adding a new lifecycle state = add a `DOC_STATUS` entry (label/color/bg/desc); everything else (pills, filters, progress) reads from it.
- **Prototype-only stubs to replace:** real file upload/storage per version; reviewer notifications on submit; "Remind" action; PDF/Open/Download; search; and persistence (prototype state resets on reload — back with an API/store).
- **Accessibility to add in prod:** focus management between wizard steps, `aria-current` on the stepper, labelled form controls (Field already pairs label↔control), and modal focus trap on the compare dialog.
