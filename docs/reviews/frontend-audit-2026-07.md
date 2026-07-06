# Frontend Audit — External Consultant Review (2026-07-05)

**Scope:** `src/app` (155 files, 73 pages) + `src/components` (334 files), Next.js 16.2.9 /
React 19.2, Tailwind v4 + shadcn, Supabase SSR. Audited against: Vercel React
best-practices, Next.js best-practices, Web Interface Guidelines, component-composition
patterns, and the project's own `frontend-design` ("Clinical Calm") system.

**Method:** exhaustive static pattern scans across the whole tree (client/server boundary,
color-token usage, motion guards, focus styles, image usage, Suspense/streaming, data-fetch
shapes) + in-depth reads of representative files (root layout, org audit page, wizard
runner, field/input/button/dialog primitives, options editor, motion wrappers).

---

## Verdict

**This is a genuinely well-built frontend.** The failure modes that dominate most React
codebases of this size are absent: design-token discipline is near-perfect (zero hardcoded
hex values, zero arbitrary color classes), the client/server boundary is clean (the only
value-imports of `lib/queries` from client code are the intentionally isomorphic condition
evaluator), Markdown is sanitized with no `dangerouslySetInnerHTML` anywhere, GSAP is
dynamically imported off the critical path with a shared reduced-motion hook, accessibility
primitives (`Field`/`useFieldIds`, `fieldset`/`legend` groups, `aria-current` nav, visible
focus rings on every primitive) are systematically used, all 71 dynamic pages correctly
`await params`/`searchParams` (Next 15+), metadata coverage is 72/73 pages, and there is no
legacy `forwardRef`. The findings below are refinements, not rescues.

The suggested changes, ordered by criticality:

| # | Finding | Criticality | Effort |
|---|---------|-------------|--------|
| 1 | No root/global error boundary | **High** | Low |
| 2 | No streaming (`<Suspense>`) + no pending state on URL-driven filters | **Medium-High** | Medium |
| 3 | Sequential await waterfalls in ~16 pages | **Medium** | Low-Medium |
| 4 | `server-only` installed but never imported | **Medium** | Trivial |
| 5 | 4 near-identical GSAP motion wrappers (~320 lines duplicated) | **Medium-Low** | Low |
| 6 | Oversized client components (5 files > 650 lines) | **Medium-Low** | Medium |
| 7 | Raw `amber-*` palette classes bypass the `--warning` token in 5 files | **Low** | Trivial |
| 8 | `key={index}` on reorderable options list | **Low** | Low |
| 9 | Missing `viewport`/`themeColor` export | **Low** | Trivial |
| 10 | Wizard `InputItem` not memoized | **Low** | Low |

---

## 1. No root or global error boundary — **HIGH**

**Evidence:** `src/app/error.tsx` and `src/app/global-error.tsx` do not exist. 31 nested
`error.tsx` files give good coverage *inside* the commission area, but there is **no
boundary at all** for: the entire `(auth)` group (login, convite, primeiro-acesso,
recuperar/redefinir-senha), `/o` and `/o/[org]` root pages, `/c`, `conta-inativa`, the
`nsp-org` area, and org-level pages like `/o/[org]/manage/usuarios`.

**Why it matters:** any uncaught render/data error on those routes falls through to
Next.js's built-in production error screen — an unstyled, **English** "Application error: a
client-side exception has occurred" page. That simultaneously violates two of the project's
own hard rules (all user-facing text pt-BR; raw errors never reach the UI) on the routes a
hospital user hits *first* (login). An error inside the root layout itself (font loading,
shell) has no `global-error.tsx` to catch it at all.

**Fix:** add `src/app/error.tsx` and `src/app/global-error.tsx` in the "Clinical Calm"
style (calm pt-BR copy, retry button calling `reset()`). One-file-each; reuse the visual
pattern from an existing nested `error.tsx`.

## 2. No streaming anywhere + filters give no pending feedback — **MEDIUM-HIGH**

**Evidence:** `<Suspense>` appears **zero** times in the codebase. Every page awaits all of
its data before rendering anything, relying solely on route-level `loading.tsx` (39 exist).
Meanwhile the URL-driven filter components (`components/audit/audit-filters.tsx:117`,
`components/dashboard/submissions-filters.tsx:63`, and siblings) call `router.replace(...)`
with **no `useTransition`/`isPending`** state.

**Why it matters — two distinct symptoms:**

1. **First load:** slow secondary data blocks the whole page. Example: the org audit page
   (`app/o/[org]/manage/audit/page.tsx:111`) blocks its entire render on
   `listAuditFilterActors` — a filter-dropdown population — even though the feed is the
   content the user came for. Same shape on dashboards (charts + free-text samples + tag
   report all block each other's paint).
2. **Filter changes:** a searchParams-only navigation is a React transition — the old UI
   stays on screen until the server round-trip completes, and because nothing reads
   `isPending`, the screen simply *does nothing* for the full RTT (DigitalOcean droplet →
   Supabase Cloud). Users click the filter again, or assume it's broken. This is the single
   biggest perceived-performance defect in the app, and it's on the most-browsed screens
   (audit trail, submissions browser, dashboard).

**Fix (in priority order):**
- Add `useTransition` around every `router.replace` in filter components and wire
  `isPending` to a subtle busy state (opacity on the results region + disabled controls,
  or the small spinner pattern). ~10 lines per component; do this first.
- On the 3–4 heaviest pages (dashboard, audit, submissions), move the primary content and
  each secondary block into separate async components wrapped in `<Suspense>` with
  skeleton fallbacks, so the header + primary content paint without waiting for the
  slowest query (per `async-suspense-boundaries`).

## 3. Sequential-await waterfalls in ~16 pages — **MEDIUM**

**Evidence:** 43 pages already use `Promise.all` (good), but 16 pages run 4–7 sequential
`await`s with none. Concrete example — `app/o/[org]/manage/audit/page.tsx` runs, in
series: `getSessionContext()` → `auditTrailEnabled()` → `listAuditForOrg(...)` →
`listAuditFilterActors(null)`. The last three are mutually independent (the flag check
doesn't gate *issuing* the reads — RLS is the boundary), so 4 round-trips could be 2.
Worst offenders: `manage/audit` (7 awaits), `cases/[caseId]/phase/.../responder` (6),
`encaminhamentos`, `nsp/pacientes`, `manage/usuarios`, `manage/comissoes[...]` (5 each).

**Why it matters:** each avoidable sequential hop adds a full app-server→Supabase RTT to
TTFB — on the production topology that's tens-to-hundreds of ms per hop, multiplied across
the most data-dense pages. This is the top-priority category in the Vercel guidelines
(`async-parallel`).

**Fix:** in each flagged page, group independent reads into `Promise.all` after the cheap
sync/session gate. Keep genuinely dependent chains (e.g. resolve commission → then read by
id) as-is. Mechanical, low-risk; combine with the Suspense work in #2 where it overlaps.

## 4. `server-only` is a dependency but never imported — **MEDIUM**

**Evidence:** `server-only` is in `package.json`, yet `grep` finds **zero** imports of it.
`src/lib/supabase/server.ts` and all 30 server query modules are protected only
*implicitly* (they transitively import `next/headers`).

**Why it matters:** the implicit protection works today, but it fails **late and
confusingly** (a deep transitive build error) rather than **at the offending import**, and
it evaporates for any future helper module that reads PHI without touching `next/headers`
(e.g. a pure formatter over patient rows that someone later imports into a client
component). For a platform whose whole security posture is "PHI never leaves the audited
server path", the one-line canary is disproportionately valuable.

**Fix:** add `import "server-only";` at the top of `lib/supabase/server.ts`,
`lib/queries/session.ts`, and the PHI-bearing query modules (`safety-events`,
`patient-index`, `referrals`, `case-narratives`, …) at minimum; ideally every non-isomorphic
module in `lib/queries/` (all except `conditions.ts`, which is intentionally shared with
the wizard).

## 5. Four copies of the same GSAP rise-in wrapper — **MEDIUM-LOW**

**Evidence:** `components/audit/audit-motion.tsx` (73 lines),
`components/safety/safety-motion.tsx` (73), `components/timeline/timeline-motion.tsx`
(111), `components/cases/case-detail-motion.tsx` (61) are near-identical
"dynamically-import GSAP, stagger `[data-rise]` children, bail under reduced motion"
wrappers — `audit-motion.tsx` even says "Mirrors `timeline-motion.tsx`" in its docblock.
Each hand-copies the motion tokens as magic numbers (`duration: 0.32 // ≈ --dur-base`,
`ease: "power3.out" // ≈ --ease-out-soft`).

**Why it matters:** the design system's own rule is "motion system is shared — do not
freelance durations/easings." Four copies means the next tweak (or the next copy) drifts.
The hand-approximated constants are already a soft violation. Also, the shared
`useReducedMotion` hook lives in `components/dashboard/use-reduced-motion.ts` but is
consumed by 10 files across audit/safety/timeline/auth — it's a platform utility stranded
in a feature folder.

**Fix:** consolidate into one `components/motion/rise-in-group.tsx` (props: `runKey`,
optional stagger/selector) reading the duration/easing from CSS custom properties (or a
single exported constants module), and move `use-reduced-motion.ts` to
`components/motion/` (or `lib/hooks/`). Pure refactor; behavior unchanged.

## 6. Oversized client components — **MEDIUM-LOW**

**Evidence:** `process-templates/recommend-when-editor.tsx` (1,179 lines),
`referrals/referral-send-wizard.tsx` (856), `process-templates/result-ruleset-editor.tsx`
(808), `responses/wizard/input-item.tsx` (764), `wizard/wizard-client.tsx` (659),
`referrals/referral-actions.tsx` (575). All are `"use client"`.

**Why it matters:** these are the highest-churn, highest-risk surfaces (condition editors,
the referral wizard, the filling wizard) and single-file scale makes review, testing, and
safe change progressively harder — the composition-patterns guidance (compound components,
explicit variant components, children-over-render-props) exists precisely for
multi-step-wizard and rule-editor shapes. `wizard-client.tsx` is actually in decent shape
internally (state via `use-wizard`, callbacks memoized); the two 800–1,200-line rule
editors are the ones that would benefit most.

**Fix (opportunistic, not urgent):** next time each file is touched, split by step/variant:
e.g. `referral-send-wizard` → one component per wizard step sharing a small context;
`recommend-when-editor` / `result-ruleset-editor` → extract the shared rule-row,
predicate-picker, and preview subcomponents (they visibly duplicate each other's concerns —
both value-import `walkResultRuleset`). Don't do a big-bang rewrite; these work and are
tested.

## 7. Raw amber classes bypass the `--warning` token — **LOW**

**Evidence:** exactly 5 files still use raw palette classes, all amber:
`components/forms/status-badge.tsx:23`, `components/process-templates/template-status-badge.tsx:21`,
`components/responses/wizard/submit-panel.tsx:42`, `components/signoffs/signoff-status.tsx:104`,
`components/users/user-status-badge.tsx:24` — each hand-rolling light+dark variants
(`bg-amber-100 text-amber-900 dark:bg-amber-400/15 …`) that predate the `--warning` token
(`globals.css:100`).

**Why it matters:** these are the only 5 deviations from an otherwise perfectly tokenized
codebase; hand-rolled dark variants will drift from the token if the warning hue is ever
tuned, and "draft/pending" status color becomes inconsistent between old and new screens.

**Fix:** replace with `bg-warning/12 text-warning` (+ border variants) per the design-system
table. Trivial, five files, visually near-identical.

## 8. `key={index}` on a reorderable, controlled list — **LOW**

**Evidence:** `components/forms/options-editor.tsx:192` keys option rows by array index
while supporting add/remove/**reorder**; ids for label/score/analytics inputs are also
index-derived (`${groupId}-option-${index}`). (`components/forms/block-card.tsx` has the
same pattern; the 26 `key={i}` uses in `loading.tsx` skeletons are fine.)

**Why it matters:** because rows are fully controlled with no internal state, this doesn't
corrupt data today — but on move/remove, DOM nodes are recycled across logical options:
keyboard focus stays on the *position* rather than following the moved option (the
clicked "move up" button ends up pointing at a different option), and screen-reader users
get re-targeted `label`/`id` pairs mid-interaction.

**Fix:** give options a stable client-side id (e.g. `crypto.randomUUID()` in
`blankOption`) used for `key` and input ids; optionally move focus to the row's new
position after reorder. Same treatment for `block-card.tsx`.

## 9. No `viewport` export — **LOW**

**Evidence:** no `export const viewport` / `themeColor` anywhere in `src/app`.

**Why it matters:** mobile browser chrome won't match the porcelain/dark background
(cosmetic), and it's a two-line add in `layout.tsx` via Next's `Viewport` API
(`themeColor` with light/dark media entries).

## 10. Wizard `InputItem` re-renders per keystroke — **LOW**

**Evidence:** `wizard-client.tsx` holds answers in shared state; `InputItem` (764 lines,
`components/responses/wizard/input-item.tsx`) is not wrapped in `memo`, so typing in a
`free_text` item re-renders every item in the section.

**Why it matters:** invisible at typical section sizes (< 20 items), but the platform lets
staff_admins build arbitrarily long sections, and each item renders a non-trivial tree.
Cheap insurance: `memo(InputItem)` — the handlers passed down are already `useCallback`-stable
(`wizard-client.tsx:166–439`), so memoization will actually hold (per `rerender-memo`).

---

## Noted, no action recommended

- **`<img>` in `image-preview.tsx`** — correctly justified (short-lived signed Storage
  URLs; `next/image` optimization would re-fetch and cache-bust) with an inline eslint
  disable. Keep.
- **Icon buttons at 24–32 px** (`button.tsx` `icon-xs`=24, `icon-sm`=28, `icon`=32) — meets
  WCAG 2.2 AA (24 px minimum) and matches shadcn norms; below the 44 px comfort bar for
  touch. Fine for the current desktop-first committee workflow; revisit if tablet use at
  the bedside becomes a pilot reality.
- **No toast library** — feedback via inline `role="status"`/`role="alert"` regions (83
  files) is deliberate, consistent, and more accessible than toasts for form-heavy flows.
- **`radix-ui` unified-package imports** (9 files) and **recharts/lucide-react** — all
  covered by Next's default `optimizePackageImports`; no barrel-import risk found. GSAP is
  already a dynamic import everywhere (10 sites).
- **No PPR / `use cache`** — nearly every page is per-user RLS-scoped and cookie-bound;
  static/partial prerendering has little to offer here. Not worth the complexity now.
- **Bundle analyzer** — nice-to-have: add `@next/bundle-analyzer` as a dev dependency and
  an `npm run analyze` script so bundle regressions are visible; the recharts-bearing
  dashboard route is the one to watch.

## Suggested sequencing

1. **Now (small, high value):** #1 root error boundaries · #4 `server-only` imports ·
   #7 warning-token migration · #9 viewport export — together well under a day.
2. **Next sprint:** #2 `useTransition` pending states (first) + Suspense on the 3–4
   heaviest pages · #3 `Promise.all` sweep over the 16 flagged pages.
3. **Opportunistic:** #5 motion-wrapper consolidation · #8 stable option keys ·
   #10 `memo(InputItem)` · #6 rule-editor decomposition as those files are next touched.
