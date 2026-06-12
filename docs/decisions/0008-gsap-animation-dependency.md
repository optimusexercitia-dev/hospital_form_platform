# ADR 0008 — GSAP as the animation dependency

**Date:** 2026-06-12 · **Status:** accepted · **Owner:** frontend

## Context

CLAUDE.md §1 calls for a professional but engaging UI with "micro animations
using things like GSAP and three.js." Phase 2 introduces the first interactive
surfaces (auth screens, app shell), so we needed to choose an animation
approach: pure CSS, GSAP, three.js, or some combination.

## Decision

Add **`gsap@3.15.0`** (exact pin) as the animation library; **defer three.js**
to a later phase. GSAP drives the shared entrance/stagger motion and the
decorative login canvas hero (a 2D `<canvas>` particle mesh, no WebGL). The
login hero is built on GSAP's ticker rather than three.js, so Phase 2 needs no
3D/WebGL dependency. Lead-approved (GSAP is endorsed by the brief, not a stack
deviation; three.js deferral approved).

License: GSAP 3.12+ is free under GreenSock's standard "no-charge" license for
this kind of use (no Club-only plugins are used — core GSAP only).

## Rationale

- GSAP is small, has no peer dependencies, and gives us one cohesive motion
  system (eased entrances, staggers, the ticker-driven hero) instead of
  scattering bespoke CSS/JS.
- three.js would add significant WebGL weight for a purely decorative login
  background; a GSAP-driven 2D canvas achieves the same atmosphere for a few KB
  of our own code, so 3D is deferred until a feature genuinely needs it.

## Consequences

- The hero is held to strict guardrails (team-lead, Phase 2): GSAP is
  **dynamically/lazily imported** so it never sits on the critical path; the
  canvas is `aria-hidden` and not focusable (no keyboard/focus impact); under
  `prefers-reduced-motion` it renders a single static frame and starts **no**
  animation loop; and it paints behind the form after mount, so there is no
  LCP/CLS cost. If the dynamic import ever fails, the static frame remains.
- The exact pin (`--save-exact`) keeps motion behaviour reproducible; bumping
  GSAP is a deliberate change. `frontend` owns this dependency edit.
- Revisit when a feature needs real 3D — at that point add three.js under its
  own ADR rather than retrofitting it into the hero.
