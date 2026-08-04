import { cn } from "@/lib/utils";

/**
 * Compact per-standard evidence indicator for the standards tree row. ADR
 * 0093 D5: "a link is a claim, not proof" — stale evidence must never
 * silently count as evidenced, so this NEVER renders a single merged number.
 * Every non-zero freshness/masking bucket gets its own dot + count; a caller
 * scanning the tree sees "1 vencida" rather than a bare "2" that reads as
 * fully evidenced. See `src/lib/accreditation/rollups.ts` for the same
 * invariant applied to the level/chapter rollups.
 */
export function EvidenceCountBadge({
  valida,
  atencao,
  vencida,
  restrita,
  className,
}: {
  valida: number;
  atencao: number;
  vencida: number;
  restrita: number;
  className?: string;
}) {
  const total = valida + atencao + vencida + restrita;

  if (total === 0) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[0.7rem] text-muted-foreground",
          className,
        )}
      >
        Sem evidências
      </span>
    );
  }

  // Literal singular/plural forms, never derived by string concatenation —
  // "em atenção" pluralizes irregularly ("em atenções", the same -ão -> -ões
  // pattern as "padrão" -> "padrões"), so a generic `${word}s` suffix silently
  // produces "em atençãos" whenever atencao > 1 (BUG-P16-005's sibling, found
  // by sweeping this file for the same string-concatenation pattern).
  const segments = [
    { key: "valida", count: valida, dot: "bg-success", singular: "válida", plural: "válidas" },
    { key: "atencao", count: atencao, dot: "bg-warning", singular: "em atenção", plural: "em atenções" },
    { key: "vencida", count: vencida, dot: "bg-destructive", singular: "vencida", plural: "vencidas" },
    { key: "restrita", count: restrita, dot: "bg-muted-foreground", singular: "restrita", plural: "restritas" },
  ].filter((segment) => segment.count > 0);

  const summary = segments
    .map((s) => `${s.count} ${s.count === 1 ? s.singular : s.plural}`)
    .join(", ");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-2 py-0.5 text-[0.7rem] text-muted-foreground",
        className,
      )}
      title={`${total} evidência${total === 1 ? "" : "s"} — ${summary}`}
    >
      <span className="sr-only">
        {total} evidência{total === 1 ? "" : "s"} — {summary}
      </span>
      <span aria-hidden="true" className="flex items-center gap-2">
        {segments.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", segment.dot)} />
            {segment.count}
          </span>
        ))}
      </span>
    </span>
  );
}
