/**
 * Visual-token mapping for the RCA workspace (Phase 14c). PURE + client-safe: maps
 * each spec role (README_rca §2) to an EXISTING project token — no hard-coded
 * colors/radii/fonts. The six fishbone categories, four classifications, and the
 * root/contributing type each resolve to a distinct existing hue; `process` is the
 * accent per the spec. Status is always conveyed by icon + text + shape too.
 */

import {
  Building2,
  Cog,
  Leaf,
  MessagesSquare,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type {
  FishboneCategory,
  RootCauseClassification,
} from "@/lib/safety/rca-types";

/** Per-category icon + token classes (strong strip/icon + soft chip bg). */
export const CATEGORY_VISUAL: Record<
  FishboneCategory,
  { icon: LucideIcon; chip: string; strip: string; iconText: string }
> = {
  people: {
    icon: Users,
    chip: "border-[var(--chart-1)]/30 bg-[var(--chart-1)]/12 text-foreground",
    strip: "bg-[var(--chart-1)]",
    iconText: "text-[var(--chart-1)]",
  },
  communication: {
    icon: MessagesSquare,
    chip: "border-[var(--chart-2)]/30 bg-[var(--chart-2)]/12 text-foreground",
    strip: "bg-[var(--chart-2)]",
    iconText: "text-[var(--chart-2)]",
  },
  // process = accent (per spec)
  process: {
    icon: Workflow,
    chip: "border-primary/30 bg-primary/10 text-primary",
    strip: "bg-primary",
    iconText: "text-primary",
  },
  equipment: {
    icon: Cog,
    chip: "border-[var(--chart-4)]/30 bg-[var(--chart-4)]/12 text-foreground",
    strip: "bg-[var(--chart-4)]",
    iconText: "text-[var(--chart-4)]",
  },
  environment: {
    icon: Leaf,
    chip: "border-[var(--chart-5)]/30 bg-[var(--chart-5)]/12 text-foreground",
    strip: "bg-[var(--chart-5)]",
    iconText: "text-[var(--chart-5)]",
  },
  policy: {
    icon: Building2,
    chip: "border-[var(--chart-3)]/30 bg-[var(--chart-3)]/12 text-foreground",
    strip: "bg-[var(--chart-3)]",
    iconText: "text-[var(--chart-3)]",
  },
};

/**
 * Per-classification selected-state classes for the segmented control (selected =
 * filled hue + readable foreground). Four distinct existing hues.
 */
export const CLASSIFICATION_SELECTED: Record<RootCauseClassification, string> = {
  system: "bg-primary text-primary-foreground",
  human: "bg-[var(--chart-1)] text-primary-foreground",
  environment: "bg-[var(--chart-5)] text-primary-foreground",
  external: "bg-[var(--chart-4)] text-primary-foreground",
};
