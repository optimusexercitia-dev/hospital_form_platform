import { AlertTriangle, ClipboardCheck, Users } from "lucide-react";

import type {
  NspEventRollupRow,
  NspCapaRollupRow,
} from "@/lib/pqs/roster-types";
import {
  EVENT_STATUS_LABELS,
  SUSPECTED_HARM_LABELS,
  type EventStatus,
  type SuspectedHarmLevel,
} from "@/lib/safety/types";

/**
 * The org NSP-admin console's per-hospital ROLLUP surface (NSP-per-hospital, ADR
 * 0052, decision 13). Server Component — pure presentation of PHI-FREE aggregates.
 *
 * SECURITY (Rule 12 keystone): this component renders ONLY counts + status labels +
 * hospital names. It receives NO patient column, event title, narrative, or
 * free-text — the `getNspOrg*Rollup` doors are proven PHI-free upstream, and this
 * component's props are integer counts + status-bucket maps + hospital identity.
 * Never add a patient/PHI field here.
 *
 * One card per hospital: event totals broken down by triage status + suspected-harm
 * band, and CAPA counts (open / overdue / closed). Ordered by the rollup query
 * (name-sorted). Calm, scannable — no primary-accent flooding.
 */
export function NspOrgRollups({
  events,
  capa,
}: {
  events: NspEventRollupRow[];
  capa: NspCapaRollupRow[];
}) {
  // Join events + CAPA by hospital so each hospital shows one combined card, even
  // if one of the two rollups has no row for it (defensive: show zeros).
  const capaByHospital = new Map(capa.map((c) => [c.hospitalId, c]));
  const hospitalIds = new Set<string>([
    ...events.map((e) => e.hospitalId),
    ...capa.map((c) => c.hospitalId),
  ]);
  const eventByHospital = new Map(events.map((e) => [e.hospitalId, e]));

  const rows = [...hospitalIds]
    .map((hospitalId) => {
      const e = eventByHospital.get(hospitalId);
      const c = capaByHospital.get(hospitalId);
      return {
        hospitalId,
        hospitalName: e?.hospitalName ?? c?.hospitalName ?? "Hospital",
        event: e ?? null,
        capa: c ?? null,
      };
    })
    .sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, "pt-BR"));

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground text-pretty">
        Nenhum hospital com atividade de segurança do paciente registrada ainda.
        Os indicadores aparecem aqui à medida que as comissões notificam eventos.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row, i) => (
        <article
          key={row.hospitalId}
          data-rise
          style={{ ["--rise-delay" as string]: `${i * 60}ms` }}
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-xs"
        >
          <h3 className="text-base font-semibold text-balance">
            {row.hospitalName}
          </h3>

          {/* Events */}
          <section
            aria-label={`Eventos — ${row.hospitalName}`}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertTriangle aria-hidden="true" className="size-4" />
                Eventos de segurança
              </div>
              <span className="text-2xl font-semibold tabular-nums">
                {row.event?.total ?? 0}
              </span>
            </div>
            <CountChips
              counts={row.event?.byStatus ?? {}}
              labelFor={(k) =>
                EVENT_STATUS_LABELS[k as EventStatus] ?? k
              }
              emptyText="Sem eventos"
            />
            {row.event && Object.keys(row.event.byHarm).length > 0 ? (
              <CountChips
                counts={row.event.byHarm}
                labelFor={(k) =>
                  SUSPECTED_HARM_LABELS[k as SuspectedHarmLevel] ?? k
                }
                tone="muted"
              />
            ) : null}
          </section>

          {/* CAPA */}
          <section
            aria-label={`Planos de ação — ${row.hospitalName}`}
            className="flex flex-col gap-3 border-t border-border pt-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardCheck aria-hidden="true" className="size-4" />
              Planos de ação (CAPA)
            </div>
            <dl className="grid grid-cols-3 gap-2">
              <CapaStat label="Abertos" value={row.capa?.open ?? 0} />
              <CapaStat
                label="Atrasados"
                value={row.capa?.overdue ?? 0}
                tone={row.capa && row.capa.overdue > 0 ? "warning" : "neutral"}
              />
              <CapaStat label="Concluídos" value={row.capa?.closed ?? 0} />
            </dl>
          </section>
        </article>
      ))}
    </div>
  );
}

/** A wrapped set of "label · count" chips over a status-bucket map (PHI-free). */
function CountChips({
  counts,
  labelFor,
  emptyText,
  tone = "default",
}: {
  counts: Record<string, number>;
  labelFor: (key: string) => string;
  emptyText?: string;
  tone?: "default" | "muted";
}) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) {
    return emptyText ? (
      <p className="text-xs text-muted-foreground">{emptyText}</p>
    ) : null;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.map(([key, n]) => (
        <li
          key={key}
          className={
            tone === "muted"
              ? "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              : "inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2.5 py-1 text-xs text-accent-foreground"
          }
        >
          <span>{labelFor(key)}</span>
          <span className="font-semibold tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** One CAPA lifecycle stat (PHI-free integer). */
function CapaStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "warning" && value > 0
            ? "text-xl font-semibold text-warning tabular-nums"
            : "text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/** The roster summary block — one row per hospital, coordinator + member count.
 *  Staff identity only (PHI-free). Kept a distinct export so the overview page can
 *  compose it beside the rollups without a second component file. */
export function NspOrgRosterSummary({
  rosters,
}: {
  rosters: {
    hospitalId: string;
    hospitalName: string;
    coordinatorLabel: string | null;
    memberCount: number;
  }[];
}) {
  if (rosters.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
        Nenhuma equipe de NSP configurada nos hospitais desta organização.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rosters.map((r) => (
        <li
          key={r.hospitalId}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.hospitalName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {r.coordinatorLabel
                ? `Coordenação: ${r.coordinatorLabel}`
                : "Sem coordenação nomeada"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Users aria-hidden="true" className="size-3.5" />
            <span className="font-semibold tabular-nums">{r.memberCount}</span>
            {r.memberCount === 1 ? "membro" : "membros"}
          </span>
        </li>
      ))}
    </ul>
  );
}
