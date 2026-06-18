"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";
import {
  PDCA_META,
  PDCA_ORDER,
  activePdcaStage,
  countPdcaDone,
  type PdcaCellStatus,
  type PdcaStageId,
} from "./capa-derive";
import { PDCA_TONE } from "./capa-visuals";

/** SVG y-down compass centres: Plan top, Do right, Check bottom, Act left. */
const CENTER_DEG: Record<PdcaStageId, number> = {
  plan: 270,
  do: 0,
  check: 90,
  act: 180,
};
const SWEEP = 37; // half-arc degrees → ~74° arcs with gaps between

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** An SVG arc path from `startDeg` to `endDeg` (clockwise, y-down). */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * The plan-level PDCA wheel (README_rca §7.1): four compass arcs (Plan top · Do
 * right · Check bottom · Act left, clockwise), PURELY derived from the plan's PDCA
 * cell statuses. Engaged arcs (done/active) are thick + full opacity with a leading
 * dot; todo arcs are thin + faint. The centre shows `done/4` + the active cell label
 * (or "Concluído"/"Cancelado"/"—"). Decorative GSAP draw, reduced-motion-safe.
 */
export function PdcaWheel({
  cells,
  size = 152,
  terminalLabel,
}: {
  cells: Record<PdcaStageId, PdcaCellStatus>;
  size?: number;
  /** Overrides the centre label when the plan is concluded/cancelled. */
  terminalLabel?: string | null;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const doneCount = countPdcaDone(cells);
  const active = activePdcaStage(cells);
  const centerLabel =
    terminalLabel ?? (active ? PDCA_META[active].label : "—");

  useEffect(() => {
    const svg = ref.current;
    if (!svg || reduced) return;
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cancelled || !ref.current) return;
        ctx = gsap.context(() => {
          const arcs = ref.current?.querySelectorAll<SVGPathElement>("[data-arc]");
          if (arcs && arcs.length) {
            arcs.forEach((arc) => {
              const len = arc.getTotalLength();
              gsap.fromTo(
                arc,
                { strokeDasharray: len, strokeDashoffset: len },
                {
                  strokeDashoffset: 0,
                  duration: 0.5,
                  ease: "power2.out",
                  clearProps: "strokeDasharray,strokeDashoffset",
                },
              );
            });
          }
        }, svg);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced, cells]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          ref={ref}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`Ciclo PDCA: ${doneCount} de 4 etapas concluídas`}
        >
          {PDCA_ORDER.map((stage) => {
            const status = cells[stage];
            const center = CENTER_DEG[stage];
            const engaged = status === "done" || status === "active";
            const tone = PDCA_TONE[stage];
            const lead = polar(cx, cy, r, center + SWEEP);
            return (
              <g key={stage}>
                <path
                  data-arc
                  d={arcPath(cx, cy, r, center - SWEEP, center + SWEEP)}
                  fill="none"
                  stroke={engaged ? tone.stroke : "var(--border)"}
                  strokeWidth={engaged ? 9 : 6}
                  strokeOpacity={engaged ? 1 : 0.4}
                  strokeLinecap="round"
                />
                {engaged && (
                  <circle cx={lead.x} cy={lead.y} r={3.5} fill={tone.stroke} />
                )}
              </g>
            );
          })}
        </svg>

        {/* Compass letters */}
        {PDCA_ORDER.map((stage) => {
          const center = CENTER_DEG[stage];
          const pos = polar(cx, cy, r, center);
          const status = cells[stage];
          const tone = PDCA_TONE[stage];
          return (
            <span
              key={stage}
              aria-hidden="true"
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold",
                status === "todo" ? "text-muted-foreground/60" : tone.text,
              )}
              style={{ left: pos.x, top: pos.y }}
            >
              {PDCA_META[stage].letter}
            </span>
          );
        })}

        {/* Center count + active label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{doneCount}/4</span>
          <span className="max-w-20 text-center text-[0.65rem] text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend (icon+text, never colour alone) */}
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.7rem]">
        {PDCA_ORDER.map((stage) => {
          const status = cells[stage];
          const tone = PDCA_TONE[stage];
          return (
            <li key={stage} className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  status === "todo" ? "bg-muted-foreground/40" : "",
                )}
                style={
                  status === "todo" ? undefined : { backgroundColor: tone.stroke }
                }
              />
              <span
                className={cn(
                  status === "todo" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {PDCA_META[stage].label}
                {status === "done" ? " ✓" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
