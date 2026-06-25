import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info, Users } from "lucide-react";

import { requireUser } from "@/lib/queries/session";
import {
  getPatientTrajectoryForEntity,
  patientIndexEnabled,
} from "@/lib/queries/patient-index";
import type { PatientXrefModule } from "@/lib/patient-index/types";
import { PatientSearchView } from "@/components/patient-index/patient-search-view";
import { TrajectoryResult } from "@/components/patient-index/trajectory-result";

export const metadata: Metadata = {
  title: "NSP — pacientes",
};

/**
 * The QPS-only CROSS-COMMITTEE patient view (Phase 23 — `patient_index`; ADR
 * 0039). The single place a QPS/PQS reviewer can search by MRN and/or encounter
 * and see a patient's PHI-FREE trajectory across ALL committees (cases /
 * safety-events / referrals) plus the cross-committee access audit.
 *
 * Audience = the QPS/PQS roster (`is_pqs_member`), NOT plain admins. The data
 * layer is PQS-gated SERVER-SIDE inside the DEFINER RPCs, so a non-PQS admin who
 * reaches this page simply gets empty results — that's expected (duty separation,
 * ADR 0030/0039; RLS is the boundary, not UI hiding).
 *
 * Gating mirrors the NSP encaminhamentos page: the admin layout enforces
 * `isAdmin`; re-checked here defensively, plus the `patient_index` flag → 404 when
 * off. PHI-FREE throughout — this surface NEVER shows a name or MRN; raw
 * identifiers appear only behind each module's existing audited per-record door.
 *
 * Two entry points (ADR 0039 Q7), which COEXIST: (a) the typed search form (MRN
 * and/or encounter); (b) a deep-link `?entity=<module>:<id>` from a
 * case/event/referral detail. The entity deep-link resolves the trajectory
 * SERVER-SIDE via `getPatientTrajectoryForEntity` (which emits `patient.viewed`,
 * not `patient.searched`) and renders the SAME {@link TrajectoryResult} as the
 * search path. A malformed/unknown-module param or an out-of-scope/keyless entity
 * (helper → `null`) degrades gracefully to a calm note + the search form — never a
 * crash. The cross-committee ACCESS AUDIT stays on the SEARCH path: its query is
 * MRN-keyed (ADR 0039) and the deep-link holds no identifier, so the deep-link
 * notes that the audit is available via search rather than faking an entity-keyed
 * read.
 */
export default async function NspPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const context = await requireUser();
  if (!context.isAdmin) {
    notFound();
  }
  if (!(await patientIndexEnabled())) {
    notFound();
  }

  const sp = await searchParams;
  // Parse the `?entity=<module>:<id>` deep-link param. A present-but-malformed or
  // unknown-module value yields `null` here → we silently fall back to the search
  // view (defensive; no crash). Only resolve the trajectory when the param parses.
  const deepLink = parseEntityParam(sp.entity);
  const deepLinkTrajectory = deepLink
    ? await getPatientTrajectoryForEntity(deepLink.module, deepLink.id)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/nsp"
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Núcleo de Segurança do Paciente
        </Link>
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <Users aria-hidden="true" className="size-7 text-primary" />
          Pacientes entre comissões
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Pesquise um paciente por prontuário e/ou atendimento para ver sua
          trajetória entre comissões — casos, eventos de segurança e
          encaminhamentos — e quem acessou seus dados. Esta visão não exibe a
          identificação do paciente; os dados sensíveis permanecem em cada
          registro, com acesso registrado.
        </p>
      </header>

      {/* Deep-link trajectory (when `?entity=` resolved): the SAME result block as
          the search path. The access audit stays on search (its query is
          MRN-keyed; the deep-link holds no identifier — ADR 0039). */}
      {deepLinkTrajectory && (
        <section
          aria-labelledby="patient-deeplink-heading"
          className="flex flex-col gap-4"
        >
          <TrajectoryResult
            result={deepLinkTrajectory}
            headingId="patient-deeplink-heading"
          >
            <p className="flex items-start gap-2 rounded-xl border border-border bg-card/50 px-3.5 py-2.5 text-sm text-muted-foreground text-pretty">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Para ver quem acessou os dados deste paciente, pesquise pelo
                prontuário ou atendimento abaixo.
              </span>
            </p>
          </TrajectoryResult>
        </section>
      )}

      {/* Param was present but did not resolve to a trajectory (fora de escopo,
          sem chave de paciente, ou não indexado) — a calm note, then the search. */}
      {deepLink && !deepLinkTrajectory && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-accent/60 px-4 py-3 text-sm text-accent-foreground text-pretty"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Não foi possível abrir a trajetória a partir deste registro. Pesquise
            o paciente pelo prontuário e/ou atendimento abaixo.
          </span>
        </div>
      )}

      <PatientSearchView />
    </div>
  );
}

/** The valid PHI-module slugs a deep-link may target (mirrors the CHECK + the
 *  `PatientXrefModule` union; used to narrow the untrusted param defensively). */
const VALID_MODULES: readonly PatientXrefModule[] = ["event", "referral", "case"];

/**
 * Parse an `?entity=<module>:<id>` deep-link param into a typed
 * {@link PatientXrefModule} + id, or `null` when absent/malformed/unknown-module.
 * PHI-FREE (module slug + opaque id only). Kept here so the URL contract is stable
 * for the case/event/referral detail "ver trajetória" links. The `module` field
 * is a property key (not a variable assignment), so it does not trip Next's
 * `no-assign-module-variable` rule.
 */
function parseEntityParam(
  raw: string | undefined,
): { module: PatientXrefModule; id: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0 || idx === raw.length - 1) return null;
  const slug = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  const match = VALID_MODULES.find((m) => m === slug);
  if (!match) return null;
  return { module: match, id };
}
