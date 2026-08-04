import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";

import type { ChapterRollup, GapItem, LevelRollup, ReadinessRollups } from "@/lib/accreditation/rollups";
import { STANDARD_LEVEL_LABELS } from "@/lib/accreditation/types";
import { cn } from "@/lib/utils";
import { ReadinessChartLoader } from "@/components/accreditation/readiness-chart-loader";
import { EvidenceCountBadge } from "@/components/accreditation/evidence-count-badge";
import { AssessmentStatusChip } from "@/components/accreditation/status-chips";

/**
 * The framework's readiness/gap overview — a framework's landing view
 * (`[framework]/page.tsx`). Pure presentation over
 * {@link computeReadinessRollups}'s output; this component does NOT
 * recompute anything — every number here is the pure-TS rollup math already
 * unit-tested in `rollups.test.ts`.
 *
 * Leveled (ONA) → one card + one cumulative "o que bloqueia o Nível N?" gap
 * list per level (D3). Non-leveled (JCI) → overall % + one gap list per
 * chapter. The evidence split is NEVER collapsed (D5) — every gap row shows
 * {@link EvidenceCountBadge}, not a bare count.
 */
export function ReadinessDashboard({
  rollups,
  standardHref,
}: {
  rollups: ReadinessRollups;
  standardHref: (standardId: string) => string;
}) {
  const isEmpty =
    !rollups.leveled && rollups.chapters.length === 0 && rollups.overallPct === null;

  if (isEmpty) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Este framework ainda não tem padrões cadastrados.
        </p>
      </div>
    );
  }

  if (rollups.leveled) {
    const bars = rollups.levels.map((level) => ({
      key: String(level.level),
      label: `Nível ${level.level}`,
      pct: level.readinessPct,
      highlight: level.certifiable,
    }));

    return (
      <div className="flex flex-col gap-6">
        <ReadinessChartLoader bars={bars} />
        <div className="grid gap-4 sm:grid-cols-3">
          {rollups.levels.map((level) => (
            <LevelCard key={level.level} level={level} />
          ))}
        </div>
        {rollups.levels.map((level) => (
          <GapListSection
            key={level.level}
            title={`O que bloqueia o Nível ${level.level}?`}
            emptyLabel={`Sem lacunas até o Nível ${level.level} — pronto.`}
            gaps={level.blockingGaps}
            standardHref={standardHref}
          />
        ))}
      </div>
    );
  }

  const bars = rollups.chapters.map((chapter) => ({
    key: chapter.chapterId,
    label: chapter.chapterCode,
    pct: chapter.readinessPct,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <span className="text-sm font-medium text-muted-foreground">Prontidão geral</span>
        <span className="text-2xl font-semibold tabular-nums">
          {rollups.overallPct != null ? `${formatPct(rollups.overallPct)}%` : "—"}
        </span>
      </div>

      <ReadinessChartLoader bars={bars} />

      {rollups.chapters.map((chapter) => (
        <GapListSection
          key={chapter.chapterId}
          title={`${chapter.chapterCode} — ${chapter.chapterTitle}`}
          emptyLabel="Sem lacunas neste capítulo."
          gaps={chapter.gaps}
          standardHref={standardHref}
        />
      ))}
    </div>
  );
}

function formatPct(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
}

function LevelCard({ level }: { level: LevelRollup }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Nível {level.level}
          </span>
          <span className="text-base font-semibold">{STANDARD_LEVEL_LABELS[level.level]}</span>
        </div>
        {level.certifiable ? (
          <span
            className="flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-success uppercase"
            title="Cumulativo: todos os padrões deste nível e dos anteriores estão conformes."
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Pronto
          </span>
        ) : (
          <span
            className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-warning uppercase"
            title="Cumulativo: um padrão deste nível ou de um nível anterior ainda bloqueia."
          >
            <CircleAlert aria-hidden="true" className="size-3.5" />
            Bloqueado
          </span>
        )}
      </div>

      <p className="text-3xl font-semibold tabular-nums">
        {formatPct(level.readinessPct)}%
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">próprio nível</span>
      </p>

      <p className="text-xs text-muted-foreground">
        {level.cleanStandards} de {level.totalStandards}{" "}
        {level.totalStandards === 1 ? "padrão" : "padrões"} conforme
        {level.cleanStandards === 1 ? "" : "s"} (não cumulativo)
      </p>

      <EvidenceCountBadge
        valida={level.evidenceValida}
        atencao={level.evidenceAtencao}
        vencida={level.evidenceVencida}
        restrita={level.evidenceRestrita}
        className="w-fit"
      />
    </div>
  );
}

function GapListSection({
  title,
  emptyLabel,
  gaps,
  standardHref,
}: {
  title: string;
  emptyLabel: string;
  gaps: GapItem[] | ChapterRollup["gaps"];
  standardHref: (standardId: string) => string;
}) {
  return (
    <section aria-labelledby={`gap-${title}`} className="flex flex-col gap-3">
      <h3 id={`gap-${title}`} className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {gaps.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {gaps.map((gap, index) => (
            <li
              key={gap.standardId}
              style={{ ["--rise-delay" as string]: `${index * 40}ms` }}
              className={cn(
                "animate-rise-in flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 shadow-xs",
              )}
            >
              <Link
                href={standardHref(gap.standardId)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{gap.standardCode}</span>
                <span className="truncate font-medium">{gap.standardTitle}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <AssessmentStatusChip status={gap.assessmentStatus} />
                <EvidenceCountBadge
                  valida={gap.evidenceValida}
                  atencao={gap.evidenceAtencao}
                  vencida={gap.evidenceVencida}
                  restrita={gap.evidenceRestrita}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
