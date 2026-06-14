import type {
  FormDashboard,
  QuestionDistribution,
  FreeTextSample,
} from "@/lib/queries/dashboard";

import { DistributionChart } from "./distribution-chart";
import { FreeTextSamples } from "./free-text-samples";
import { VolumeTrend } from "./volume-trend";

/**
 * The dashboard body for one form (F2): the submission-volume trend, then the
 * choice-question distributions and free-text samples GROUPED BY SECTION (ordered
 * by section position, then item position). Each distribution carries its own
 * denominator caption; each chart pairs with a data table (in the chart
 * components). Presentational and prop-driven — no hooks here, so it renders
 * inside the client `DashboardForms` shell (its chart children are the client
 * pieces).
 */
export function DashboardCharts({ dashboard }: { dashboard: FormDashboard }) {
  const groups = groupBySection(dashboard);

  return (
    <div className="flex flex-col gap-7">
      <VolumeTrend
        points={dashboard.submissionsOverTime}
        byMember={dashboard.completionByMember}
      />

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
          Este formulário não tem perguntas para exibir estatísticas.
        </p>
      ) : (
        groups.map((group) => (
          <SectionGroup key={group.key} group={group} />
        ))
      )}
    </div>
  );
}

interface SectionEntry {
  itemPosition: number;
  kind: "distribution" | "freeText";
  distribution?: QuestionDistribution;
  freeText?: FreeTextSample;
}

interface SectionGroupData {
  key: string;
  title: string | null;
  position: number;
  entries: SectionEntry[];
}

/**
 * Merge distributions + free-text samples into one section-keyed, item-ordered
 * structure. Both carry `sectionPosition`/`sectionTitle`/`itemPosition`, so a
 * section's questions render in their authored order regardless of kind.
 */
function groupBySection(dashboard: FormDashboard): SectionGroupData[] {
  const map = new Map<number, SectionGroupData>();

  const ensure = (position: number, title: string | null) => {
    let g = map.get(position);
    if (!g) {
      g = { key: `sec-${position}`, title, position, entries: [] };
      map.set(position, g);
    }
    return g;
  };

  for (const d of dashboard.distributions) {
    ensure(d.sectionPosition, d.sectionTitle).entries.push({
      itemPosition: d.itemPosition,
      kind: "distribution",
      distribution: d,
    });
  }
  for (const f of dashboard.freeTextSamples) {
    ensure(f.sectionPosition, f.sectionTitle).entries.push({
      itemPosition: f.itemPosition,
      kind: "freeText",
      freeText: f,
    });
  }

  const groups = [...map.values()].sort((a, b) => a.position - b.position);
  for (const g of groups) {
    g.entries.sort((a, b) => a.itemPosition - b.itemPosition);
  }
  return groups;
}

function SectionGroup({ group }: { group: SectionGroupData }) {
  const headingId = `dash-section-${group.position}`;
  // A null title is the default/flat section — no section chrome, just the
  // charts (mirrors the read-only-tree flat-render rule).
  const heading = group.title;

  return (
    <section
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : "Perguntas do formulário"}
      className="flex flex-col gap-3"
    >
      {heading && (
        <h3 id={headingId} className="text-lg font-semibold text-balance">
          {heading}
        </h3>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {group.entries.map((entry) =>
          entry.kind === "distribution" && entry.distribution ? (
            <DistributionChart
              key={`d-${entry.distribution.questionKey}`}
              distribution={entry.distribution}
            />
          ) : entry.freeText ? (
            <FreeTextSamples
              key={`f-${entry.freeText.questionKey}`}
              sample={entry.freeText}
            />
          ) : null,
        )}
      </div>
    </section>
  );
}
