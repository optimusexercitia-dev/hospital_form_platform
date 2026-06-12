"use client";

import { useCallback, useEffect, useRef } from "react";

// Type-only import of GSAP's real Flip plugin type; the runtime import stays
// dynamic (below) so GSAP never sits on the critical path.
import type { Flip as FlipPlugin } from "gsap/Flip";

/**
 * Animates up/down reorder of a list with GSAP Flip — the items visually slide
 * to their new positions instead of jumping. Used by the builder's section,
 * block, and option lists (reorder is plain up/down controls; no drag-and-drop
 * in v1, but the swap is animated so the change reads clearly).
 *
 * Motion guardrails (mirroring `StatCount` / `AuthHero`, ARCHITECTURE/CLAUDE
 * motion policy):
 *  - GSAP + the Flip plugin are **dynamically imported**, off the critical path.
 *  - `prefers-reduced-motion` (or an import failure) → NO animation; the list
 *    simply re-renders in its new order. Correctness never depends on motion.
 *
 * Usage:
 *   const { containerRef, captureBeforeReorder } = useFlipReorder<HTMLUListElement>();
 *   // call captureBeforeReorder() immediately BEFORE the state update that
 *   // changes the order; the effect plays the Flip after the DOM commits.
 *
 * Each reorderable child must carry a stable `data-flip-id` so Flip can match
 * elements across the reorder.
 */

/** The Flip plugin object exposes static methods; we use getState + from. */
type FlipApi = typeof FlipPlugin;
type FlipState = ReturnType<FlipApi["getState"]>;

export function useFlipReorder<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  const pendingState = useRef<FlipState | null>(null);
  // Resolved once on first capture; subsequent reorders reuse it.
  const flipRef = useRef<FlipApi | null>(null);

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /**
   * Snapshot the current positions of the reorderable children. Call this
   * synchronously, right before the state update that reorders them.
   */
  const captureBeforeReorder = useCallback(() => {
    const container = containerRef.current;
    if (!container || prefersReducedMotion()) return;

    const flip = flipRef.current;
    if (!flip) {
      // Plugin not loaded yet — load gsap core + the Flip plugin, REGISTER it
      // (Flip.getState needs the registered plugin), and skip animating this
      // first reorder (it just re-renders). Keeps GSAP off the critical path.
      void Promise.all([import("gsap"), import("gsap/Flip")])
        .then(([gsapMod, flipMod]) => {
          const gsap = gsapMod.gsap ?? gsapMod.default;
          const flipPlugin = flipMod.Flip ?? flipMod.default;
          if (gsap && flipPlugin) {
            gsap.registerPlugin(flipPlugin);
            flipRef.current = flipPlugin;
          }
        })
        .catch(() => {
          /* no motion — list still reorders correctly */
        });
      return;
    }

    const targets = container.querySelectorAll("[data-flip-id]");
    if (targets.length === 0) return;
    try {
      pendingState.current = flip.getState(targets);
    } catch {
      // Motion is strictly best-effort (CLAUDE motion policy): a GSAP failure
      // must NEVER block the reorder, which happens via the server action next.
      pendingState.current = null;
    }
  }, [prefersReducedMotion]);

  // After the DOM commits the new order, play the Flip from the snapshot.
  useEffect(() => {
    const state = pendingState.current;
    const flip = flipRef.current;
    if (!state || !flip) return;
    pendingState.current = null;

    try {
      flip.from(state, {
        duration: 0.32,
        ease: "power2.out",
        absolute: true,
      });
    } catch {
      /* no-op: animation is best-effort and never affects correctness */
    }
  });

  return { containerRef, captureBeforeReorder };
}
