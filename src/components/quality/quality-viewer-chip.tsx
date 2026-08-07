import { Eye } from "lucide-react";

/**
 * The case-header chip a quality reviewer sees in place of {@link CaseRoleChip}
 * (ADR 0100 D10).
 *
 * `roleFromCapabilities` would resolve a reviewer to `"viewer"` — accurate about
 * the capability, but it reads as "a colleague who was granted read access to
 * this case", which is a materially different standing from "the quality office,
 * reviewing under a standing oversight mandate". Naming the office is also what
 * makes the read-only framing legible to the reviewer themselves.
 *
 * Deliberately NOT an extension of `MyCaseRole` — that union is a backend type
 * in `@/lib/queries/cases`, and D10's whole point is that the reviewer never
 * enters a role taxonomy the write gates read from.
 */
export function QualityViewerChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Eye aria-hidden="true" className="size-3.5" />
      Escritório da Qualidade · somente leitura
    </span>
  );
}
