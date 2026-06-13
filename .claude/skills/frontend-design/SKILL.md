---
name: frontend-design
description: The binding design system for the Hospital Commission Forms Platform — "calm clinical precision". Invoke BEFORE building or restyling any screen, page, route group, or component. Covers the color tokens, typography (Fraunces/Spline Sans), spacing/radius, the shared motion system (GSAP + CSS, reduced-motion-safe), accessibility requirements, and the component conventions every UI must follow so screens stay cohesive.
---

# Frontend Design — "calm clinical precision"

This is the **single source of truth** for how this platform looks, moves, and
feels. The `frontend-engineer` role is required to invoke and follow it before
building any new screen. It codifies the system already implemented in
`src/app/globals.css` and `src/app/layout.tsx` — do not invent a parallel
direction; extend this one.

> **Aesthetic in one line:** a deep petrol/teal accent (clinical but warm,
> distinct from generic SaaS blue) on faintly-warm porcelain neutrals. Refined,
> spacious, instrument-like. Editorial serif headings over a precise humanist
> sans. Professional first; engaging through restraint and tasteful micro-motion.

The platform brief (CLAUDE.md §1) asks for an experience that is "professional,
but also interactive and engaging, with micro animations using things like GSAP
and three.js." Read that as: motion and depth **earn their place** by clarifying
or delighting — never decoration for its own sake, never at the cost of
legibility, performance, or accessibility.

---

## 1. Before you build (checklist)

1. **Reuse first.** Search `src/components/ui/**` (shadcn primitives) and
   existing feature components before creating anything. Match the closest
   existing screen's structure and class patterns.
2. **Server Component by default.** Add `"use client"` only where interaction
   genuinely requires it. Keep data-loading on the server; pass plain props down.
3. **Tokens only.** Never hardcode colors, fonts, or hex values. Use the
   semantic Tailwind tokens below.
4. **Plan the motion.** Decide the entrance (usually `.animate-rise-in` with a
   stagger) and any micro-interactions up front; confirm every one collapses
   under `prefers-reduced-motion`.
5. **Accessibility is not a pass at the end.** Labels, keyboard path, focus
   rings, landmarks, and pt-BR copy are designed in from the first render.

---

## 2. Color — semantic tokens (never raw values)

Tokens are defined in oklch in `globals.css` with light + `.dark` variants, under
the standard shadcn names so primitives keep working. **Always** style via the
semantic Tailwind utilities; never reach for `bg-[#...]`, `text-slate-700`, etc.

| Purpose | Token utility | Notes |
| --- | --- | --- |
| Page background | `bg-background` | warm porcelain |
| Body text | `text-foreground` | deep slate-petrol ink |
| Secondary/help text | `text-muted-foreground` | captions, descriptions, metadata |
| Surfaces / cards | `bg-card` `text-card-foreground` | raised content |
| Brand / primary action | `bg-primary` `text-primary-foreground` | **the petrol accent** |
| Soft hover/fill tint | `bg-accent` `text-accent-foreground` | gentle petrol tint |
| Muted fill | `bg-muted` `text-muted-foreground` | inert chips, skeleton base |
| Borders & inputs | `border-border` `border-input` | hairline `oklch(0.9 …)` |
| Focus ring | `ring-ring` | petrol; see focus pattern below |
| Error/danger | `text-destructive` `bg-destructive/10` `border-destructive/30` | |
| Charts | `--chart-1..5` (Recharts) | ramp built around the petrol accent |

Rules:
- The petrol **primary is precious** — use it for the single most important
  action per view, active nav, key stats. Don't flood screens with it.
- Convey status with **icon + text + shape**, never color alone (accessibility).
- Dark mode is already tokenized; if you add a new color need, add a token in
  both `:root` and `.dark` (request via the lead if it crosses into shared CSS).

---

## 3. Typography

Fonts are wired in `layout.tsx` as CSS variables; `globals.css` maps them.

- **Display serif — Fraunces** (`--font-display`, `font-optical-sizing: auto`):
  applied automatically to `h1, h2, h3` with `letter-spacing: -0.01em`. This is
  the platform's editorial, trustworthy character. Use real heading elements so
  they pick it up; for a serif accent elsewhere use `font-display`.
- **Body/UI sans — Spline Sans** (`--font-sans`, the `html` default): precise and
  legible for dense forms. All body, labels, controls.
- **Mono — Spline Sans Mono** (`--font-mono`): slugs, ids, code-ish values.
- Body sets `font-feature-settings: "cv05", "ss01"` globally — don't override.
- Scale with Tailwind's type scale; favor generous `leading` and `max-w-prose`
  for running text. Headings can use `text-balance`; paragraphs `text-pretty`.

---

## 4. Spacing, radius, layout

- **Radius scale** keys off `--radius: 0.75rem`: `rounded-lg` (base),
  `rounded-xl`, `rounded-2xl` for cards/panels, up to `rounded-4xl`. Cards in
  this app read as **`rounded-2xl border border-border bg-card shadow-xs`** with
  internal padding `p-5`/`p-6` — match that.
- **Spacious by default.** Stack sections with `flex flex-col gap-6`/`gap-7`;
  don't crowd. Whitespace is part of the "instrument-like" calm.
- Constrain reading/forms width (e.g. `mx-auto w-full max-w-2xl`); let dashboards
  use wider grids. Use responsive grids (`grid gap-4 sm:grid-cols-2 …`) for card
  collections.

---

## 5. Motion system (shared — do not freelance durations/easings)

Defined once in `globals.css` so entrance and micro-interaction feel cohesive.
CSS-first so baseline motion works without JS; **GSAP** layers richer
orchestration where it earns its weight; **three.js** only for a deliberate hero
moment (e.g. the auth canvas), always `aria-hidden`, off the critical path, with
a static reduced-motion frame.

Tokens (consume these, don't hardcode): easings `--ease-out-soft`,
`--ease-in-out-soft`; durations `--dur-fast` (180ms), `--dur-base` (320ms),
`--dur-slow` (560ms).

Ready-made utilities:
- `.animate-rise-in` — the standard entrance (fade + 12px rise). For **staggered
  groups** (card grids, list rows) set `style={{ "--rise-delay": \`${i * 60}ms\` }}`
  per item.
- `.animate-fade-in` — gentle fade for review screens, swaps, banners.

Rules:
- **Reduced motion is mandatory and already enforced** — the global
  `@media (prefers-reduced-motion: reduce)` collapses all animation/transition to
  a single frame. Any JS/GSAP/three motion you add MUST also check
  `window.matchMedia("(prefers-reduced-motion: reduce)")` and no-op (render the
  final state). Never gate meaning or availability on an animation completing.
- **GSAP is a dynamic import off the critical path** (`const { gsap } = await
  import("gsap")`), behind interaction or `useEffect`, never blocking first
  paint. Register plugins on import and wrap plugin calls in try/catch so a
  motion failure can NEVER block the underlying action (see the Flip-reorder
  lesson: decorative motion is best-effort).
- Micro-interactions: subtle transforms/opacity/color transitions on hover/press
  using the easing tokens. Keep them quick (`--dur-fast`) and purposeful —
  progress bars, count-ups, step cross-fades, staggered reveals. No bounce-heavy
  or attention-grabbing effects; this is a clinical tool.

---

## 6. Accessibility (non-negotiable — CLAUDE.md §8)

- Every input has an associated `<label>` (use the `Field`/`useFieldIds`
  primitives). Group radios/checkboxes in `<fieldset>` with a `<legend>`.
- `question_explanation` / helper text is wired to its control via
  `aria-describedby`; validation errors via `aria-invalid` + an error region.
- **Visible focus everywhere**: the project pattern is
  `focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none`.
  Never remove focus outlines without an equivalent visible replacement.
- Full keyboard operability — every flow completes without a mouse (the tester
  runs at least one keyboard-only path per phase). Radix primitives give correct
  roles/focus management; prefer them over hand-rolled menus/dialogs.
- Semantic landmarks: `<section aria-labelledby>` + a real heading per section,
  `<h1>` once per page, ordered heading levels. Status/error banners use
  `role="status"` (polite) or `role="alert"` (assertive) appropriately.
- Respect `prefers-reduced-motion` (above). Don't convey state by color alone.

---

## 7. Content & component conventions

- **All user-facing text is pt-BR** (Rule 10); code/comments/commits English.
  Keep copy calm, precise, and human. Dates via `Intl.DateTimeFormat('pt-BR')`.
- **Raw Supabase/Postgres errors never reach the UI** — surface mapped pt-BR
  messages from the action layer; render a banner, not a stack trace.
- **Markdown** (`section_text`, rich explanations) renders ONLY through the
  project's sanitizing renderer (`react-markdown` + `rehype-sanitize`), never
  `dangerouslySetInnerHTML` with author content (stored-XSS; ARCHITECTURE Rule 7).
- **Empty / loading / error states are part of every screen**: a friendly pt-BR
  empty state, a `loading.tsx` skeleton mirroring the real layout, and an
  `error.tsx` boundary. Skeletons use `bg-muted` and the same radii as content.
- **Cards & lists**: `rounded-2xl border border-border bg-card shadow-xs`,
  staggered `.animate-rise-in`, a clear primary affordance (arrow/link), hover
  lift via a quick token-eased transition.
- **Client/server boundary**: client components import `src/lib/**` as
  **type-only**; never value-import a server-only query module into a client
  component (it drags `next/headers` into the bundle and breaks the build).
  Mirror the `WizardRunner` pattern — the server page loads data and binds server
  actions, passing plain props to the client tree.

---

## 8. Do / Don't

**Do:** reuse shadcn primitives and existing patterns · style via semantic
tokens · headings as real `h1/h2/h3` (Fraunces) · stagger entrances with
`--rise-delay` · guard every motion with reduced-motion · design the keyboard
path and focus rings first · keep the petrol accent scarce and intentional.

**Don't:** hardcode colors/hex/fonts · use the primary accent everywhere ·
add bouncy/attention-seeking animation · block an action on a GSAP/three effect ·
ship a screen without empty/loading/error states · convey status by color alone ·
`dangerouslySetInnerHTML` author content · put English in the UI.
