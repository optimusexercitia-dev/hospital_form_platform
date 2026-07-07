import { getIndicatorKpis } from "@/lib/queries/indicators";
import { qualityIndicatorsEnabled } from "@/lib/queries/feature-flags";

import { IndicatorsPanel } from "./indicators-panel";

/**
 * Suspense boundary for {@link IndicatorsPanel}: the flag check + KPI read are
 * a secondary dashboard block that must not block the primary chart's first
 * paint (frontend-audit-2026-07 #2). Renders nothing when the flag is off.
 */
export async function IndicatorsPanelAsync({
  commissionId,
  indicatorsHref,
}: {
  commissionId: string;
  indicatorsHref: string;
}) {
  const indicatorsOn = await qualityIndicatorsEnabled();
  if (!indicatorsOn) return null;

  const kpis = await getIndicatorKpis(commissionId);
  return <IndicatorsPanel kpis={kpis} indicatorsHref={indicatorsHref} />;
}
