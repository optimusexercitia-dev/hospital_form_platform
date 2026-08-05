import Link from "next/link";
import { Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CaseTemplateProvenance as TemplateProvenance } from "@/lib/queries/process-templates";
import { TemplateVersionStatusBadge } from "@/components/process-templates/template-version-status-badge";

/**
 * "Which process version did this case run under?" — the case-side half of ADR
 * 0096 D3.
 *
 * ## `null` is an answer, not a failure
 *
 * `getCaseTemplateProvenance` returns `null` for a PROCESSLESS case (one created
 * via `create_case` with no template at all). That is a fully supported shape, and
 * this component renders it as the plain statement "Sem processo" — never as an
 * error, a skeleton, or an empty slot. Making the `null` branch the component's
 * FIRST rendered state, rather than an early `return null`, is deliberate: it means
 * a processless case cannot silently lose this row, and there is no code path where
 * "no template" and "failed to load" look the same.
 *
 * ## What is actually being claimed
 *
 * Only the labelling is new. A case has always been self-describing — its phases,
 * pinned `form_version_id`s, blocks, rulesets and frozen vocabularies are all
 * snapshotted at creation, so a template edit never reached a live case even before
 * versioning existed (ADR 0096's Context is explicit that this is not a provenance
 * repair). What genuinely was not recoverable is the version NUMBER and the title
 * as authored at that time — which is exactly what this row shows.
 *
 * The status badge appears only when the version is no longer the published one,
 * because that is the only case where it carries information: it tells the reader
 * "this case predates the process as it stands today". Rendering `Publicada` on a
 * case running the current version would be noise.
 *
 * A Server Component; `templateVersionHref` is a plain string (built by the caller
 * with `commissionHref`), never a server function (BUG-QI-001). It is optional
 * because only the coordinator route can reach the template builder — the staff
 * case view passes nothing and gets the same information as static text.
 */
export function CaseTemplateProvenance({
  provenance,
  templateVersionHref,
  className,
}: {
  /** `null` for a processless case — a supported state, see the component docs. */
  provenance: TemplateProvenance | null;
  /** Link target for the exact version, when the viewer may open the builder. */
  templateVersionHref?: string | null;
  className?: string;
}) {
  const rowClass = cn(
    "inline-flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground",
    className,
  );

  if (!provenance) {
    return (
      <p className={rowClass}>
        <Workflow aria-hidden="true" className="size-3.5 shrink-0" />
        Sem processo
      </p>
    );
  }

  const label = `${provenance.title} · versão ${provenance.versionNumber}`;

  return (
    <p className={rowClass}>
      <Workflow aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">Processo do caso: </span>
      {templateVersionHref ? (
        <Link
          href={templateVersionHref}
          className="rounded underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
      {provenance.status !== "published" && (
        <TemplateVersionStatusBadge status={provenance.status} />
      )}
    </p>
  );
}
