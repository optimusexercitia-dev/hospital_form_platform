"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";

import type { ReferralListItem } from "@/lib/referrals/types";
import { cn } from "@/lib/utils";
import {
  ReferralStatusChip,
  ReferralTypeChip,
  ResponseExpectedChip,
} from "./referral-chips";
import {
  formatCaseNumber,
  formatDate,
  formatReferralCode,
} from "./format";
import { RESOLVED_REFERRAL_STATUSES } from "@/lib/referrals/types";

/**
 * The QPS cross-commission referral table (Decision 6/13) with an inline,
 * expandable trajectory drill-down. PHI-free — every column is governance
 * metadata; patient context is never shown here (it lives behind the audited
 * per-referral PHI door, not on this macro view).
 *
 * The drill-down is INLINE (an expandable row) rather than a deep link, because a
 * pure QPS member (PQS roster) may not be a member of either commission, so the
 * commission-scoped detail route (`c/[slug]/...`) isn't a safe target for them.
 * The trajectory it reveals — source → target, both case numbers, the lifecycle
 * stamps, reply presence — is all already in the PHI-free list item.
 */
export function ReferralDashboardTable({
  referrals,
}: {
  referrals: ReferralListItem[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (referrals.length === 0) {
    return (
      <section
        aria-label="Nenhum encaminhamento"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FolderOpen aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Nenhum encaminhamento</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Nenhum encaminhamento corresponde ao recorte atual. Ajuste os filtros
          para ampliar a busca.
        </p>
      </section>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="w-8 px-2 py-2.5" />
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Encaminhamento
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Origem → Destino
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Tipo
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase"
            >
              Criado
            </th>
          </tr>
        </thead>
        <tbody>
          {referrals.map((r) => {
            const isOpen = expanded === r.id;
            const inFlight = !RESOLVED_REFERRAL_STATUSES.has(r.status);
            return (
              <RowGroup
                key={r.id}
                referral={r}
                isOpen={isOpen}
                inFlight={inFlight}
                onToggle={() => setExpanded(isOpen ? null : r.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  referral: r,
  isOpen,
  inFlight,
  onToggle,
}: {
  referral: ReferralListItem;
  isOpen: boolean;
  inFlight: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-border/70 transition-colors hover:bg-muted/30",
          isOpen ? "bg-muted/30" : "odd:bg-card even:bg-muted/20",
        )}
      >
        <td className="px-2 py-2.5 align-middle">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-label={
              isOpen ? "Recolher trajetória" : "Expandir trajetória"
            }
            className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {isOpen ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4" />
            )}
          </button>
        </td>
        <td className="max-w-[20rem] px-3 py-2.5 align-middle">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-xs text-muted-foreground">
              {formatReferralCode(r.code)}
            </span>
            <span className="truncate font-medium text-foreground">
              {r.subject}
            </span>
            {r.responseExpected && inFlight && (
              <span className="mt-0.5">
                <ResponseExpectedChip />
              </span>
            )}
          </div>
        </td>
        <td className="max-w-[16rem] px-3 py-2.5 align-middle text-muted-foreground">
          <span className="line-clamp-2 text-pretty">
            {r.sourceCommissionName ?? "—"}
            {" → "}
            {r.targetCommissionName ?? "—"}
          </span>
        </td>
        <td className="px-3 py-2.5 align-middle">
          <ReferralTypeChip label={r.typeLabel} colorToken={r.typeColorToken} />
        </td>
        <td className="px-3 py-2.5 align-middle">
          <ReferralStatusChip status={r.status} />
        </td>
        <td className="px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {formatDate(r.createdAt)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-border/70 bg-muted/10">
          <td />
          <td colSpan={5} className="px-3 py-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <Detail
                label="Caso de origem"
                value={
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <FolderOpen aria-hidden="true" className="size-3.5" />
                    {formatCaseNumber(r.sourceCaseNumber)}
                  </span>
                }
              />
              <Detail
                label="Caso vinculado"
                value={
                  r.targetCaseNumber != null ? (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <FolderOpen aria-hidden="true" className="size-3.5" />
                      {formatCaseNumber(r.targetCaseNumber)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">
                      Sem vínculo
                    </span>
                  )
                }
              />
              <Detail
                label="Resposta esperada"
                value={r.responseExpected ? "Sim" : "Apenas ciência"}
              />
              <Detail
                label="Resposta entregue"
                value={
                  r.hasReply ? (
                    <span className="text-success">Sim</span>
                  ) : (
                    <span className="text-muted-foreground/70">Não</span>
                  )
                }
              />
              <Detail label="Enviado" value={formatDate(r.sentAt)} />
              <Detail
                label="Identificação do paciente"
                value={
                  r.hasPatient ? (
                    <span className="text-warning">Registrada</span>
                  ) : (
                    <span className="text-muted-foreground/70">Não</span>
                  )
                }
              />
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
