"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ReadinessRow, StandardTreeNode } from "@/lib/accreditation/types";
import { AssessmentStatusChip, LevelBadge } from "@/components/accreditation/status-chips";
import { EvidenceCountBadge } from "@/components/accreditation/evidence-count-badge";

/**
 * The framework's standard hierarchy as a semantic PROGRESSIVE-DISCLOSURE
 * list — a native `<button aria-expanded>` per branch, a `<Link>` per
 * standard, per ADR 0093's Wave 2 plan: "Do NOT build a `role=tree` widget —
 * there is no precedent in this codebase and it carries a full
 * roving-tabindex keyboard contract." Every branch/leaf is independently Tab-
 * reachable; disclosure state is per-branch `useState`, not a shared
 * roving-tabindex manager. Hierarchy cues (indentation, a hairline connector)
 * follow `src/components/forms/read-only-tree.tsx`; the status/evidence chips
 * follow `src/components/cases/case-phase-list.tsx`'s stagger + chip pattern.
 */
export function StandardsTree({
  nodes,
  readinessByStandardId,
  standardHref,
}: {
  nodes: StandardTreeNode[];
  /** Assessment + evidence-count context, keyed by standard id. Omit for a bare (no-commission) framework browse. */
  readinessByStandardId?: Record<string, ReadinessRow>;
  standardHref: (standardId: string) => string;
}) {
  if (nodes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
        Nenhum padrão cadastrado neste framework.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5" aria-label="Padrões do framework">
      {nodes.map((node, index) => (
        <li key={node.id} style={{ ["--rise-delay" as string]: `${index * 40}ms` }} className="animate-rise-in">
          <StandardTreeBranch
            node={node}
            depth={0}
            readinessByStandardId={readinessByStandardId}
            standardHref={standardHref}
          />
        </li>
      ))}
    </ul>
  );
}

function StandardTreeBranch({
  node,
  depth,
  readinessByStandardId,
  standardHref,
}: {
  node: StandardTreeNode;
  depth: number;
  readinessByStandardId?: Record<string, ReadinessRow>;
  standardHref: (standardId: string) => string;
}) {
  const hasChildren = node.children.length > 0;
  // Progressive disclosure: top-level branches start open, deeper ones start
  // closed — keeps a large ONA/JCI tree scannable on first render.
  const [expanded, setExpanded] = useState(depth < 1);
  const row = readinessByStandardId?.[node.id];

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-lg py-1.5 pr-2 hover:bg-accent/40"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn("size-4 transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]", expanded && "rotate-90")}
            />
            <span className="sr-only">
              {expanded ? `Recolher ${node.code} — ${node.title}` : `Expandir ${node.code} — ${node.title}`}
            </span>
          </button>
        ) : (
          <span aria-hidden="true" className="size-6 shrink-0" />
        )}

        <Link
          href={standardHref(node.id)}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 py-0.5 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{node.code}</span>
          <span className="truncate font-medium">{node.title}</span>
          {node.level != null && <LevelBadge level={node.level} />}
          {row && <AssessmentStatusChip status={row.assessmentStatus} />}
          {row && (
            <EvidenceCountBadge
              valida={row.evidenceValida}
              atencao={row.evidenceAtencao}
              vencida={row.evidenceVencida}
              restrita={row.evidenceRestrita}
            />
          )}
        </Link>
      </div>

      {hasChildren && expanded && (
        <ul className="flex flex-col gap-0.5 border-l border-dashed border-border" style={{ marginLeft: `${depth * 1.25 + 0.75}rem` }}>
          {node.children.map((child) => (
            <li key={child.id}>
              <StandardTreeBranch
                node={child}
                depth={depth + 1}
                readinessByStandardId={readinessByStandardId}
                standardHref={standardHref}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
