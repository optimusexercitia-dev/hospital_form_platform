import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getQualidadeAccessByOrg } from "@/lib/queries/session";
import { getQualityBoardSummary } from "@/lib/queries/quality";
import { listCasesBoard } from "@/lib/queries/cases";
import type { CaseBoardRow } from "@/lib/queries/cases";
import { QualityKpiStrip } from "@/components/quality/quality-kpi-strip";
import { QualityBoardView } from "@/components/quality/quality-board-view";
import { QualityEmptyState } from "@/components/quality/quality-empty-state";

export const metadata: Metadata = {
  title: "Qualidade — casos sob supervisão",
};

/**
 * The cross-committee oversight board (ADR 0100 D10) — the quality office's
 * landing surface. Server Component.
 *
 * Access: the `/o/[org]/qualidade` layout gates console entry
 * (`getQualidadeAccessByOrg`); here we re-resolve it to pin the org id. Every
 * number and row below is re-gated at its own door, which is the real boundary
 * (Rule 1):
 *
 *  - `quality_board_summary` is SECURITY DEFINER and self-gates on ≥1 unexpired
 *    `quality_reviewer` membership in the org (else 42501 → `[]` here). It is
 *    also the ONLY thing that can count the locked population, because those
 *    rows are RLS-invisible to the reviewer by design (D6).
 *  - `listCasesBoard` filters every row through `app.can_read_case` with no
 *    short-circuit, so the reviewer gets exactly their readable cases via the S7
 *    arm — `explicit_grants_only` cases never appear, and neither does anything
 *    from a commission classified `'excluded'`.
 *
 * `?hospital=` is a DATA FILTER, never a segment (ADR 0041 D8). An absent or
 * unknown value means "all hospitals I review", which is a safe default here
 * precisely because the arm carries no PHI (D5).
 */
export default async function QualityBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hospital?: string; comissao?: string }>;
}) {
  const [{ org }, sp] = await Promise.all([params, searchParams]);
  const access = await getQualidadeAccessByOrg(org);
  if (!access) {
    notFound();
  }

  const summary = await getQualityBoardSummary(access.orgId);

  // Hospital filter. An unknown id collapses to "all" rather than to an empty
  // board — a tampered or stale query string should not look like "you have
  // lost your access".
  const knownHospital = access.hospitals.some(
    (h) => h.hospital.id === sp.hospital,
  );
  const hospitalFilter = knownHospital ? (sp.hospital ?? null) : null;
  const commissions = hospitalFilter
    ? summary.filter((c) => c.hospitalId === hospitalFilter)
    : summary;

  // Fan out the SAME commission board read per visible commission. Deliberately
  // not a new "reviewer board" query: `list_cases_board` already serves the
  // reviewer the right rows, and a second implementation of "which cases may
  // this principal see" is a second thing to keep correct.
  //
  // `Promise.allSettled`, not `all`: one commission failing must degrade to that
  // commission being empty, never blank the whole board.
  const settled = await Promise.allSettled(
    commissions.map((c) => listCasesBoard(c.commissionId)),
  );
  const rows: CaseBoardRow[] = settled.flatMap((r) =>
    r.status === "fulfilled" ? r.value.rows : [],
  );
  const failedCommissions = commissions
    .filter((_, i) => settled[i].status === "rejected")
    .map((c) => c.commissionName);

  const commissionSlugById = Object.fromEntries(
    commissions.map((c) => [c.commissionId, c.commissionSlug]),
  );
  const commissionNameById = Object.fromEntries(
    commissions.map((c) => [c.commissionId, c.commissionName]),
  );

  const lockedTotal = commissions.reduce((n, c) => n + c.lockedCases, 0);
  const lockedNote =
    lockedTotal > 0
      ? `${lockedTotal} ${lockedTotal === 1 ? "caso restrito não aparece" : "casos restritos não aparecem"} nesta lista.`
      : undefined;

  // `?comissao=` is resolved against the VISIBLE set — an id for a commission
  // outside this hospital filter (or outside oversight entirely) collapses to
  // "all" rather than to an empty board.
  const initialCommissionId =
    sp.comissao && commissions.some((c) => c.commissionId === sp.comissao)
      ? sp.comissao
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Escritório da Qualidade · {access.organization.name}
        </p>
        <h1 className="text-3xl text-balance">Casos sob supervisão</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Casos das comissões clínicas cuja supervisão foi habilitada. Esta é uma
          visão de leitura: acompanhe o andamento, abra um caso para ler o
          conteúdo e registre suas observações fora do sistema da comissão.
        </p>
      </header>

      {commissions.length === 0 ? (
        <QualityEmptyState variant="no-commissions" />
      ) : (
        <>
          <QualityKpiStrip commissions={commissions} />

          {failedCommissions.length > 0 ? (
            <p
              role="status"
              className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
            >
              Não foi possível carregar os casos de{" "}
              {failedCommissions.join(", ")}. Os demais aparecem normalmente.
            </p>
          ) : null}

          {rows.length === 0 ? (
            <QualityEmptyState variant="no-cases" note={lockedNote} />
          ) : (
            <>
              <QualityBoardView
                rows={rows}
                org={org}
                commissions={commissions.map((c) => ({
                  commissionId: c.commissionId,
                  commissionName: c.commissionName,
                  totalCases: c.totalCases,
                  lockedCases: c.lockedCases,
                }))}
                commissionSlugById={commissionSlugById}
                commissionNameById={commissionNameById}
                initialCommissionId={initialCommissionId}
              />
              {lockedNote ? (
                <p className="text-sm text-muted-foreground text-pretty">
                  Algumas comissões mantêm casos com acesso restrito —{" "}
                  {lockedNote}
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  );
}
