import { ARTIFACT_KIND_LABELS, type EvidenceItem } from "@/lib/accreditation/types";
import { cn } from "@/lib/utils";
import { EvidenceStatusChip } from "@/components/accreditation/status-chips";
import { UnlinkEvidenceButton } from "@/components/accreditation/unlink-evidence-button";

/**
 * The evidence links backing one standard (`getReadinessEvidence`). A
 * restricted link (case/ethics_procedure the caller cannot read — D8) already
 * arrives MASKED from the door — `label` is the literal "Evidência restrita",
 * `note` is `null` — this component only needs to style that state
 * distinctly, never re-derive the masking itself. `note` is PLAIN free text
 * (`evidence_links.note` — NOT Markdown, unlike the assessment's `note_md`),
 * so it renders as plain text.
 */
export function EvidenceList({
  items,
  canEdit,
}: {
  items: EvidenceItem[];
  /** Whether the viewer may unlink (staff_admin of the commission). */
  canEdit: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
        Nenhuma evidência vinculada a este padrão ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
          className="flex animate-rise-in flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                {ARTIFACT_KIND_LABELS[item.artifactKind]}
              </span>
              <EvidenceStatusChip status={item.status} />
              {item.restricted && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
                  Acesso restrito
                </span>
              )}
            </div>
            <p className={cn("text-sm font-medium", item.restricted && "text-muted-foreground italic")}>
              {item.label}
            </p>
            {item.note && <p className="text-sm text-muted-foreground text-pretty">{item.note}</p>}
            <p className="text-xs text-muted-foreground">
              Vinculada {item.linkedByName ? `por ${item.linkedByName} ` : ""}
              em {formatLinkedAt(item.linkedAt)}
            </p>
          </div>
          {canEdit && <UnlinkEvidenceButton evidenceLinkId={item.id} label={item.label} />}
        </li>
      ))}
    </ul>
  );
}

function formatLinkedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}
