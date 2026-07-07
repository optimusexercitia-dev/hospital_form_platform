"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative animated brand panel for the auth screens — a slow, drifting mesh
 * of connected nodes in the platform's blue accent, rendered in two parallax
 * depth layers so the field reads as an atmospheric, instrument-lit surface.
 * Pointer movement gently parallaxes both the field and the brand copy (via
 * `[data-parallax]` handles in the layout). Purely atmospheric.
 *
 * Constraints (team-lead, Phase 2 + login redesign):
 *  - GSAP is dynamically imported so it never sits on the critical path; the
 *    canvas paints only after mount, behind the form, so it has no LCP/CLS hit.
 *    No three.js — a tuned 2D field keeps the shared auth bundle lean while
 *    still feeling alive.
 *  - `aria-hidden` and not focusable — zero impact on keyboard/focus order.
 *  - `prefers-reduced-motion`: we render a single static frame and start NO
 *    animation loop (no canvas churn, no pointer parallax), honoring the
 *    preference fully.
 *  - Pauses the ticker when the tab is hidden; clamps devicePixelRatio; only
 *    ever mounts inside the `lg:` brand panel, so phones do no canvas work.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Depth 0..1 — drives size, brightness and parallax response. */
  depth: number;
}

const NODE_COUNT = 40;
const LINK_DISTANCE = 150; // px (CSS) within which nodes are threaded together
const POINTER_EASE = 0.06; // how quickly the parallax target is approached
const POINTER_SHIFT = 26; // max px the deepest layer shifts with the pointer

export function AuthHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Brand-copy elements that follow the pointer a touch (parallax handles set
    // in the layout). Scoped to the brand panel via the canvas's parent.
    const panel = canvas.parentElement;
    const parallaxTargets = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>("[data-parallax]"))
      : [];

    let width = 0;
    let height = 0;
    let dpr = 1;
    const nodes: Node[] = [];

    // Pointer parallax state (target vs eased current), normalized to [-1, 1].
    const pointer = { tx: 0, ty: 0, x: 0, y: 0 };

    // Resolve the accent color from the design tokens so the hero always tracks
    // the theme rather than hard-coding a hex.
    const accent =
      getComputedStyle(canvas).getPropertyValue("--hero-accent").trim() ||
      "rgba(46, 116, 192, 1)";

    function seed() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        const depth = Math.random();
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          // Very slow drift; deeper nodes drift a touch faster (nearer camera).
          vx: (Math.random() - 0.5) * (0.08 + depth * 0.1),
          vy: (Math.random() - 0.5) * (0.08 + depth * 0.1),
          r: 1 + depth * 2.2,
          depth,
        });
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seed();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      const shiftX = pointer.x * POINTER_SHIFT;
      const shiftY = pointer.y * POINTER_SHIFT;

      // Threads between nearby nodes — opacity falls off with distance and
      // rises with depth so nearer threads read brighter.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const ax = a.x + shiftX * a.depth;
          const ay = a.y + shiftY * a.depth;
          const bx = b.x + shiftX * b.depth;
          const by = b.y + shiftY * b.depth;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const depth = (a.depth + b.depth) / 2;
            const alpha = (1 - dist / LINK_DISTANCE) * (0.12 + depth * 0.24);
            ctx!.strokeStyle = withAlpha(accent, alpha);
            ctx!.lineWidth = 0.6 + depth * 0.7;
            ctx!.beginPath();
            ctx!.moveTo(ax, ay);
            ctx!.lineTo(bx, by);
            ctx!.stroke();
          }
        }
      }

      // Nodes — deeper nodes are larger and brighter with a soft glow.
      for (const n of nodes) {
        const x = n.x + shiftX * n.depth;
        const y = n.y + shiftY * n.depth;
        ctx!.fillStyle = withAlpha(accent, 0.35 + n.depth * 0.5);
        ctx!.beginPath();
        ctx!.arc(x, y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      // Ease the pointer parallax toward its target.
      pointer.x += (pointer.tx - pointer.x) * POINTER_EASE;
      pointer.y += (pointer.ty - pointer.y) * POINTER_EASE;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // Soft wrap so the field feels continuous.
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }

      // Nudge the brand copy the opposite way for a subtle depth cue.
      for (const el of parallaxTargets) {
        const factor = Number(el.dataset.parallax) || 0;
        el.style.transform = `translate3d(${(-pointer.x * 10 * factor).toFixed(2)}px, ${(-pointer.y * 8 * factor).toFixed(2)}px, 0)`;
      }

      draw();
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }

    function onPointerLeave() {
      pointer.tx = 0;
      pointer.ty = 0;
    }

    resize();
    window.addEventListener("resize", resize);

    // Reduced motion: one static frame, no loop, no GSAP, no pointer parallax —
    // nothing churns.
    if (reduceMotion) {
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    // First static paint, then animate via GSAP's ticker (dynamically imported
    // so it stays off the critical path). If the import fails for any reason we
    // simply keep the static frame already drawn.
    draw();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    if (panel) panel.addEventListener("pointerleave", onPointerLeave);

    let tickerHandler: (() => void) | null = null;
    let gsapRef: typeof import("gsap").gsap | null = null;
    let cancelled = false;

    // Pause the loop while the tab is hidden to save battery/CPU.
    function onVisibility() {
      if (!gsapRef || !tickerHandler) return;
      if (document.hidden) {
        gsapRef.ticker.remove(tickerHandler);
      } else {
        gsapRef.ticker.add(tickerHandler);
      }
    }

    import("gsap")
      .then(({ gsap }) => {
        if (cancelled) return;
        gsapRef = gsap;
        tickerHandler = () => step();
        gsap.ticker.fps(30); // gentle; saves battery and keeps motion calm
        if (!document.hidden) gsap.ticker.add(tickerHandler);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        /* static frame is fine */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      if (panel) panel.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      if (gsapRef && tickerHandler) gsapRef.ticker.remove(tickerHandler);
      // Reset any parallax transforms we applied.
      for (const el of parallaxTargets) el.style.transform = "";
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full [--hero-accent:oklch(0.68_0.13_252)]"
    />
  );
}

/**
 * Returns the accent color with the given alpha. Handles the two forms the
 * token may resolve to: an `oklch(...)` string or an `rgb/rgba(...)` string.
 */
function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha)).toFixed(3);
  if (color.startsWith("oklch")) {
    // oklch(L C H) → oklch(L C H / a)
    const inner = color.slice(color.indexOf("(") + 1, color.lastIndexOf(")"));
    const base = inner.split("/")[0].trim();
    return `oklch(${base} / ${a})`;
  }
  if (color.startsWith("rgb")) {
    const nums = color.replace(/rgba?\(|\)/g, "").split(",").slice(0, 3);
    return `rgba(${nums.map((n) => n.trim()).join(", ")}, ${a})`;
  }
  return color;
}
