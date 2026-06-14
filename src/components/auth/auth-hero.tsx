"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative animated brand panel for the auth screens — a slow, drifting mesh
 * of connected nodes in the platform's blue accent. Purely atmospheric.
 *
 * Constraints (team-lead, Phase 2):
 *  - GSAP is dynamically imported so it never sits on the critical path; the
 *    canvas paints only after mount, behind the form, so it has no LCP/CLS hit.
 *  - `aria-hidden` and not focusable — zero impact on keyboard/focus order.
 *  - `prefers-reduced-motion`: we render a single static frame and start NO
 *    animation loop (no canvas churn), honoring the user's preference fully.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const NODE_COUNT = 32;
const LINK_DISTANCE = 150; // px (CSS) within which nodes are threaded together

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

    let width = 0;
    let height = 0;
    let dpr = 1;
    const nodes: Node[] = [];

    // Resolve the accent color from the design tokens so the hero always tracks
    // the theme rather than hard-coding a hex.
    const accent =
      getComputedStyle(canvas).getPropertyValue("--hero-accent").trim() ||
      "rgba(46, 116, 192, 1)";

    function seed() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          // Very slow drift; halved further so motion reads as "breathing".
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: 1 + Math.random() * 1.8,
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

      // Threads between nearby nodes — opacity falls off with distance.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const alpha = (1 - dist / LINK_DISTANCE) * 0.32;
            ctx!.strokeStyle = withAlpha(accent, alpha);
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // Nodes.
      for (const n of nodes) {
        ctx!.fillStyle = withAlpha(accent, 0.7);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // Soft wrap so the field feels continuous.
        if (n.x < -10) n.x = width + 10;
        if (n.x > width + 10) n.x = -10;
        if (n.y < -10) n.y = height + 10;
        if (n.y > height + 10) n.y = -10;
      }
      draw();
    }

    resize();
    window.addEventListener("resize", resize);

    // Reduced motion: one static frame, no loop, no GSAP — nothing churns.
    if (reduceMotion) {
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    // Animate via GSAP's ticker, dynamically imported so it stays off the
    // critical path. If the import fails for any reason, we simply show the
    // static frame already drawn.
    draw();
    let tickerHandler: (() => void) | null = null;
    let gsapRef: typeof import("gsap").gsap | null = null;
    let cancelled = false;

    import("gsap")
      .then(({ gsap }) => {
        if (cancelled) return;
        gsapRef = gsap;
        tickerHandler = () => step();
        gsap.ticker.fps(30); // gentle; saves battery and keeps motion calm
        gsap.ticker.add(tickerHandler);
      })
      .catch(() => {
        /* static frame is fine */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (gsapRef && tickerHandler) gsapRef.ticker.remove(tickerHandler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full [--hero-accent:oklch(0.6_0.12_252)]"
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
