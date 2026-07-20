import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarClock, FilePlus2, ScrollText } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { chartersEnabled } from "@/lib/queries/feature-flags";
import { getCharter, getMeetingCadenceStatus } from "@/lib/queries/charters";
import { listDocuments } from "@/lib/queries/documents";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { CadenceStatusBadge } from "@/components/charters/cadence-status-badge";
import { CharterForm } from "@/components/charters/charter-form";
import {
  MEETING_FREQUENCY_LABELS,
  MEETING_FREQUENCY_WINDOW_LABELS,
} from "@/components/charters/labels";
import { DocumentStatusChip } from "@/components/documents/document-badges";
import { saveCharter } from "./actions";

export const metadata: Metadata = {
  title: "Regimento & Cadência",
};

/** Format a full ISO timestamp as a pt-BR long date. */
function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** Format a date-only `YYYY-MM-DD` as a pt-BR long date (no timezone shift). */
function formatDateOnly(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * Committee charter — "Regimento & Cadência" (CH-FE-1; ADR 0080 D9). Coordinator
 * area: the `charters` flag + `staff_admin` role gate the route (RLS remains the
 * ultimate boundary; the write RPC re-enforces HC0K0). Shows the live meeting-cadence
 * status, lets the coordinator set the meeting frequency + link the commission's
 * regimento controlled document, and links out to the Phase-17 create flow
 * (`doc_type=regimento` pre-filled) to author a new regimento. No PHI (Rule 12).
 */
export default async function CharterPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;

  if (!(await chartersEnabled())) {
    notFound();
  }

  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const commissionId = access.commission.id;
  const [charter, cadence, regimentoDocs] = await Promise.all([
    getCharter(commissionId),
    getMeetingCadenceStatus(commissionId),
    listDocuments(commissionId, { docType: "regimento" }),
  ]);

  const linkedDoc = charter?.controlledDocumentId
    ? (regimentoDocs.find((d) => d.id === charter.controlledDocumentId) ?? null)
    : null;

  const createNewHref =
    commissionHref(org, commission, "manage", "documentos", "novo") +
    "?docType=regimento";

  // Cadence context sentence per status (the badge carries the label; this adds the
  // "why" so a coordinator knows what to do next). `meetingFrequency`/`lastHeldAt`
  // are non-null exactly where each branch reads them.
  const freqLabel = cadence?.meetingFrequency
    ? MEETING_FREQUENCY_LABELS[cadence.meetingFrequency].toLowerCase()
    : "";
  const windowLabel = cadence?.meetingFrequency
    ? MEETING_FREQUENCY_WINDOW_LABELS[cadence.meetingFrequency]
    : "";
  let cadenceContext = "";
  if (cadence) {
    switch (cadence.status) {
      case "em_dia":
        cadenceContext = cadence.lastHeldAt
          ? `Última reunião plenária realizada em ${formatTimestamp(cadence.lastHeldAt)}, dentro da periodicidade ${freqLabel} (${windowLabel}).`
          : `A comissão está em dia com a periodicidade ${freqLabel}.`;
        break;
      case "em_atraso":
        cadenceContext = cadence.lastHeldAt
          ? `A última reunião plenária foi em ${formatTimestamp(cadence.lastHeldAt)}, além da periodicidade ${freqLabel} (${windowLabel}). Registre ou agende a próxima reunião.`
          : `A comissão está fora da periodicidade ${freqLabel}. Registre ou agende a próxima reunião.`;
        break;
      case "sem_reunioes":
        cadenceContext = `A periodicidade está definida como ${freqLabel} (${windowLabel}), mas nenhuma reunião plenária foi registrada ainda.`;
        break;
      case "sem_regimento":
        cadenceContext =
          "Nenhuma periodicidade de reuniões foi configurada para esta comissão. Defina a periodicidade abaixo para acompanhar a cadência.";
        break;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="animate-rise-in flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {access.commission.name}
        </p>
        <h1 className="text-3xl text-balance">Regimento &amp; Cadência</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Defina a periodicidade das reuniões da comissão e vincule o seu regimento
          interno como documento controlado. A cadência é avaliada automaticamente a
          partir das reuniões plenárias realizadas.
        </p>
      </header>

      {/* Live cadence status. Omitted only when the member-scoped RPC returns null. */}
      {cadence ? (
        <section
          aria-labelledby="cadence-heading"
          className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
          style={{ "--rise-delay": "60ms" } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="cadence-heading"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <CalendarClock
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
              Situação da cadência
            </h2>
            <CadenceStatusBadge status={cadence.status} />
          </div>
          {cadenceContext ? (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              {cadenceContext}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* The editable configuration — frequency + regimento link in one upsert. */}
      <section
        aria-labelledby="config-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        style={{ "--rise-delay": "120ms" } as React.CSSProperties}
      >
        <h2 id="config-heading" className="text-lg font-semibold">
          Periodicidade e regimento
        </h2>
        <CharterForm
          action={saveCharter}
          commissionId={commissionId}
          org={org}
          commission={commission}
          initialFrequency={charter?.meetingFrequency ?? null}
          initialDocId={charter?.controlledDocumentId ?? null}
          regimentoOptions={regimentoDocs.map((d) => ({
            id: d.id,
            code: d.code,
            title: d.title,
          }))}
        />
      </section>

      {/* The linked regimento controlled document (view) + create-new handoff. */}
      <section
        aria-labelledby="regimento-heading"
        className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        style={{ "--rise-delay": "180ms" } as React.CSSProperties}
      >
        <h2
          id="regimento-heading"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <ScrollText
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          Documento do regimento
        </h2>

        {linkedDoc ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <DocumentStatusChip status={linkedDoc.status} />
              <span className="font-mono text-xs text-muted-foreground">
                {linkedDoc.code}
              </span>
            </div>
            <p className="font-medium text-foreground text-pretty">
              {linkedDoc.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {linkedDoc.reviewDueDate
                ? `Revisão prevista até ${formatDateOnly(linkedDoc.reviewDueDate)}.`
                : "Sem data de revisão definida."}
            </p>
            <div>
              <Button asChild variant="outline" size="lg">
                <Link
                  href={commissionHref(
                    org,
                    commission,
                    "manage",
                    "documentos",
                    linkedDoc.id,
                  )}
                >
                  Ver documento
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Nenhum regimento controlado está vinculado a esta comissão. Crie um novo
            regimento — ele passa pelo ciclo de documentos controlados (rascunho →
            aprovação → vigência) — e depois vincule-o acima.
          </p>
        )}

        <div>
          <Button asChild size="lg" variant={linkedDoc ? "ghost" : "default"}>
            <Link href={createNewHref}>
              <FilePlus2 aria-hidden="true" className="size-4" />
              Criar novo regimento
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
