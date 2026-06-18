"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

import {
  FISHBONE_CATEGORY_ORDER,
  type FishboneCategory,
  type RcaFactor,
} from "@/lib/safety/rca-types";
import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";
import { CatBlock } from "./cat-block";

/**
 * The Ishikawa (fishbone) diagram (README_rca §5.1): six fixed category blocks
 * arranged around a horizontal spine that points into a danger-tinted effect head.
 * The spine/ribs/head are PRESENTATIONAL (`aria-hidden`) — the {@link CatBlock}s
 * hold the real, accessible UI. Below ~900px the ribs/spine drop and the head
 * becomes a full-width banner over a single column (the diagram is decorative; the
 * blocks stay fully usable).
 *
 * Motion: a best-effort GSAP reveal of the spine width + ribs + head on mount,
 * reduced-motion-safe (renders the final state with no JS).
 */
export function Fishbone({
  rcaId,
  effect,
  factorsByCategory,
  canEdit,
}: {
  rcaId: string;
  /** The effect-head statement (the event title / problem). */
  effect: string;
  factorsByCategory: Map<FishboneCategory, RcaFactor[]>;
  canEdit: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const top = FISHBONE_CATEGORY_ORDER.slice(0, 3);
  const bottom = FISHBONE_CATEGORY_ORDER.slice(3);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cancelled || !rootRef.current) return;
        ctx = gsap.context(() => {
          const spine = rootRef.current?.querySelector("[data-spine]");
          const ribs = rootRef.current?.querySelectorAll("[data-rib]");
          const head = rootRef.current?.querySelector("[data-effect-head]");
          if (spine) {
            gsap.from(spine, {
              scaleX: 0,
              transformOrigin: "left center",
              duration: 0.45,
              ease: "power3.out",
            });
          }
          if (ribs && ribs.length) {
            gsap.from(Array.from(ribs), {
              opacity: 0,
              duration: 0.32,
              ease: "power2.out",
              stagger: 0.04,
              delay: 0.15,
            });
          }
          if (head) {
            gsap.from(head, { opacity: 0, x: 12, duration: 0.4, ease: "power3.out" });
          }
        }, root);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      {/* Effect head — full-width banner on narrow, pinned right on wide (lg). */}
      <div
        data-effect-head
        className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 lg:hidden"
      >
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] font-semibold tracking-wide text-destructive uppercase">
            Efeito
          </span>
          <span className="text-sm text-foreground text-pretty">{effect}</span>
        </div>
      </div>

      {/* Narrow: single column of all six blocks. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {FISHBONE_CATEGORY_ORDER.map((cat) => (
          <CatBlock
            key={cat}
            rcaId={rcaId}
            category={cat}
            factors={factorsByCategory.get(cat) ?? []}
            canEdit={canEdit}
          />
        ))}
      </div>

      {/* Wide (lg+): top grid → up-ribs → spine+head → down-ribs → bottom grid. */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-3 items-end gap-3 pr-[210px]">
          {top.map((cat) => (
            <CatBlock
              key={cat}
              rcaId={rcaId}
              category={cat}
              factors={factorsByCategory.get(cat) ?? []}
              canEdit={canEdit}
            />
          ))}
        </div>

        <Ribs direction="down" />

        {/* Spine row + effect head */}
        <div className="relative flex items-center">
          <div
            data-spine
            aria-hidden="true"
            className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-border to-muted-foreground"
          />
          <span
            aria-hidden="true"
            className="size-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-muted-foreground"
          />
          <div className="ml-2 flex w-[200px] shrink-0 items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <AlertTriangle
              aria-hidden="true"
              className="size-4 shrink-0 text-destructive"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.65rem] font-semibold tracking-wide text-destructive uppercase">
                Efeito
              </span>
              <span className="text-sm text-foreground text-pretty">{effect}</span>
            </div>
          </div>
        </div>

        <Ribs direction="up" />

        <div className="grid grid-cols-3 items-start gap-3 pr-[210px]">
          {bottom.map((cat) => (
            <CatBlock
              key={cat}
              rcaId={rcaId}
              category={cat}
              factors={factorsByCategory.get(cat) ?? []}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The diagonal ribs strip feeding the spine (decorative, three lines). */
function Ribs({ direction }: { direction: "up" | "down" }) {
  const rotation = direction === "down" ? "rotate-[26deg]" : "-rotate-[26deg]";
  return (
    <div aria-hidden="true" className="relative h-[30px] pr-[210px]">
      {["16.667%", "50%", "83.333%"].map((left) => (
        <span
          key={left}
          data-rib
          className={`absolute top-1/2 h-[2px] w-8 -translate-x-1/2 bg-border ${rotation}`}
          style={{ left }}
        />
      ))}
    </div>
  );
}
