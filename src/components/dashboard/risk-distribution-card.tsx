import type { RiskDistribution } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

/**
 * FF-2 (ADR 0089 · FUP-FF2-2) — one `risk_matrix` question, rendered as the
 * severity × likelihood heatmap it is, plus the numeric summary.
 *
 * ## The score is read, never derived
 *
 * Every score shown here is `RiskPairTally.score` — the durable
 * `answer_risk_matrix.risk_score` as stored. It is NOT recomputed from the axis
 * weights, because the labels resolve to the latest published version while the
 * scores belong to the responses that were actually submitted; a re-weighting
 * must not retroactively restate a historical figure.
 *
 * ## Colour encodes SCORE, and never alone
 *
 * A risk matrix's visual language is low-to-high, so tint follows the score
 * rather than the frequency — but RELATIVE to the range actually observed,
 * because `config.riskBands` is per-item authoring config and is deliberately
 * not part of this aggregate. Calling an absolute level the data cannot support
 * would be worse than saying nothing. Both numbers are printed in every cell,
 * and the caption states what the tint means, so the ramp is redundant.
 *
 * Same table-not-Recharts reasoning as {@link MatrixDistributionCard}: the grid
 * is the natural form, and a real table is chart and text alternative at once.
 */
export function RiskDistributionCard({
  distribution,
}: {
  distribution: RiskDistribution;
}) {
  const { label, pairs, n, average, minimum, maximum, questionKey } = distribution;
  const headingId = `risk-${questionKey}`;

  const severities = uniqueBy(
    pairs.map((p) => ({
      code: p.severityCode,
      label: p.severityLabel,
      position: p.severityPosition,
    })),
  );
  const likelihoods = uniqueBy(
    pairs.map((p) => ({
      code: p.likelihoodCode,
      label: p.likelihoodLabel,
      position: p.likelihoodPosition,
    })),
  );
  const at = new Map(
    pairs.map((p) => [`${p.severityCode} ${p.likelihoodCode}`, p]),
  );

  // The observed score range drives the relative ramp.
  const scores = pairs.filter((p) => p.count > 0).map((p) => p.score);
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;
  const highest = scores.length > 0 ? Math.max(...scores) : 0;

  const hasData = n > 0 && pairs.some((p) => p.count > 0);

  return (
    <article
      aria-labelledby={headingId}
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h4 id={headingId} className="text-sm font-semibold text-balance">
          {label}
        </h4>
        <p className="text-xs text-muted-foreground">
          {n} {n === 1 ? "classificação registrada" : "classificações registradas"}
        </p>
      </div>

      {hasData ? (
        <>
          <dl className="grid grid-cols-3 gap-2">
            <Stat label="Média" value={formatScore(average)} />
            <Stat label="Mínima" value={formatScore(minimum)} />
            <Stat label="Máxima" value={formatScore(maximum)} />
          </dl>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Classificações de risco para: {label}. Severidade nas linhas,
                probabilidade nas colunas. Cada célula mostra quantas
                classificações caíram naquela combinação e a pontuação
                registrada dela.
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th scope="col" className="px-3 py-2 text-left">
                    <span className="sr-only">Severidade</span>
                    <span
                      aria-hidden="true"
                      className="flex flex-col text-[0.65rem] leading-tight font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      <span>Severidade ↓</span>
                      <span>Probabilidade →</span>
                    </span>
                  </th>
                  {likelihoods.map((col) => (
                    <th
                      key={col.code}
                      scope="col"
                      className="px-3 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {severities.map((row) => (
                  <tr
                    key={row.code}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="max-w-56 px-3 py-2 text-left font-medium text-pretty"
                    >
                      {row.label}
                    </th>
                    {likelihoods.map((col) => {
                      const pair = at.get(`${row.code} ${col.code}`);
                      const count = pair?.count ?? 0;
                      return (
                        <td
                          key={col.code}
                          className={cn(
                            "px-3 py-2 text-center tabular-nums",
                            count > 0 && pair
                              ? tintForScore(pair.score, lowest, highest)
                              : "",
                          )}
                        >
                          {count > 0 && pair ? (
                            <span className="flex flex-col leading-tight">
                              <span className="font-medium">
                                {count}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {count === 1 ? "resp." : "resps."}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatScore(pair.score)} pts
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Tons mais fortes indicam pontuação maior dentro do intervalo
            observado ({formatScore(lowest)} a {formatScore(highest)}). A
            pontuação é a registrada em cada resposta.
          </p>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
          Sem classificações de risco para esta pergunta.
        </p>
      )}
    </article>
  );
}

/** One numeric summary tile. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-2">
      <dt className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Tint by score, relative to the observed range, in four discrete steps using
 * the semantic risk tokens (success → warning → destructive). Redundant with
 * the printed score and explained in the caption; never the sole channel.
 */
function tintForScore(score: number, lowest: number, highest: number): string {
  if (highest <= lowest) return "bg-warning/12";
  const t = (score - lowest) / (highest - lowest);
  if (t < 0.25) return "bg-success/12";
  if (t < 0.5) return "bg-warning/12";
  if (t < 0.75) return "bg-warning/25";
  return "bg-destructive/15";
}

/** pt-BR number; an absent summary reads as an em dash rather than 0. */
function formatScore(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function uniqueBy(
  entries: { code: string; label: string; position: number }[],
): { code: string; label: string; position: number }[] {
  const byCode = new Map<string, { code: string; label: string; position: number }>();
  for (const e of entries) if (!byCode.has(e.code)) byCode.set(e.code, e);
  return [...byCode.values()].sort((a, b) => a.position - b.position);
}
