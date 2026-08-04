import type { AccreditationStandard, AssessmentStatus, EvidenceItem } from "@/lib/accreditation/types";
import { MarkdownRenderer } from "@/components/forms/markdown/markdown-renderer";
import { LevelBadge } from "@/components/accreditation/status-chips";
import { AssessmentForm } from "@/components/accreditation/assessment-form";
import { EvidenceList } from "@/components/accreditation/evidence-list";
import { LinkEvidenceDialogTrigger } from "@/components/accreditation/evidence-picker";

/**
 * One standard's detail: description (sanitized Markdown, `description_md` —
 * `null` on every global-pack row, D2), the commission's self-assessment
 * form, and its evidence list. Server-Component-safe wrapper; the assessment
 * form and each evidence row's unlink control are client islands.
 */
export function StandardPanel({
  standard,
  assessmentStatus,
  assessmentNoteMd,
  evidence,
  commissionId,
  canEdit,
}: {
  standard: AccreditationStandard;
  assessmentStatus: AssessmentStatus | null;
  assessmentNoteMd: string | null;
  evidence: EvidenceItem[];
  commissionId: string;
  /** Whether the viewer may assess/link/unlink (staff_admin of this commission). */
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{standard.code}</span>
          {standard.level != null && <LevelBadge level={standard.level} />}
        </div>
        <h1 className="text-2xl font-semibold text-balance">{standard.title}</h1>
        {standard.descriptionMd ? (
          <MarkdownRenderer content={standard.descriptionMd} className="max-w-prose" />
        ) : (
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Este padrão ainda não tem descrição — pacotes globais trazem apenas código,
            título e hierarquia (nunca o texto do manual licenciado). Clone o framework
            para colar a descrição completa sob a licença da sua instituição.
          </p>
        )}
      </header>

      <section aria-labelledby="assessment-heading" className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 id="assessment-heading" className="mb-4 text-lg font-semibold">
          Autoavaliação
        </h2>
        <AssessmentForm
          commissionId={commissionId}
          standardId={standard.id}
          currentStatus={assessmentStatus}
          currentNoteMd={assessmentNoteMd}
          canEdit={canEdit}
        />
      </section>

      <section aria-labelledby="evidence-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="evidence-heading" className="text-lg font-semibold">
            Evidências
          </h2>
          {canEdit && (
            <LinkEvidenceDialogTrigger commissionId={commissionId} standardId={standard.id} />
          )}
        </div>
        <EvidenceList items={evidence} canEdit={canEdit} />
      </section>
    </div>
  );
}
