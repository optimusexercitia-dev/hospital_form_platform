import type { Section } from "@/lib/queries/forms";

/**
 * Small "condicional" pill shown on a section that carries a `visible_when`
 * condition. Purely indicative; the full condition is edited in the section
 * settings dialog. Server-Component-safe.
 */
export function SectionConditionBadge({ section }: { section: Section }) {
  if (!section.visibleWhen) return null;
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-secondary-foreground uppercase">
      condicional
    </span>
  );
}
