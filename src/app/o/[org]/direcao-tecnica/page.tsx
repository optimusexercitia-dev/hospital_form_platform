import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stethoscope } from "lucide-react";

import { getTechnicalDirectionAccessByOrg } from "@/lib/queries/session";
import {
  listTechnicalDirectionReferrals,
  referralsEnabled,
} from "@/lib/queries/referrals";
import { getFeatureFlags } from "@/lib/queries/feature-flags";
import { ReferralsList } from "@/components/referrals/referrals-list";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Direção técnica — Encaminhamentos",
};

/**
 * The Diretor Técnico's referral inbox (ADR 0094 W4 / FUP-MEM-3b).
 *
 * W4 shipped the DT referral plane with no reader: RLS admits the technical direction
 * (`can_read_referral_metadata` carries an `is_technical_director_of_for` arm) but every
 * referral SURFACE was closed to them — the commission hub needs
 * `getCommissionAccessByOrg`, `/conta/encaminhamentos` lists only explicit assignments,
 * and the NSP hub is the PQS surface. The office could be addressed and could not read.
 * This route is that reader.
 *
 * ⚠ It lives at the ORG level, not under `/o/[org]/c/[commission]`, because the office
 * has no commission. That is the whole reason it needs its own route rather than a tab
 * on an existing one — every commission-scoped gate refuses a DT by construction, and
 * would look like a bug rather than a boundary.
 *
 * INCOMING ONLY, and that is structural rather than a simplification: the office cannot
 * author a referral, because `create_referral_draft` gates the send on coordinating the
 * SOURCE COMMISSION. So there is no "Enviados" half to show — rendering an empty one
 * would imply a capability that cannot exist.
 *
 * Titular and deputy see exactly the same thing (decision D1: a substituto who cannot
 * decide is decorative, and a referral would stall whenever the titular was away).
 * PHI-free: the list projects governance metadata only; patient context appears on
 * drill-down to an authorized reader, audited.
 */
export default async function TechnicalDirectionReferralsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ cursor?: string; hospital?: string }>;
}) {
  const [{ org }, { cursor, hospital }, flagOn, flags] = await Promise.all([
    params,
    searchParams,
    referralsEnabled(),
    getFeatureFlags(),
  ]);

  // Both flags gate this surface: `case_referrals` owns the referral plane,
  // `technical_director` owns the office. A dark flag confers nothing.
  if (!flagOn || flags.technical_director !== true) {
    notFound();
  }

  const access = await getTechnicalDirectionAccessByOrg(org);
  if (!access) {
    notFound();
  }

  // A DT normally holds one hospital; the switcher exists for the rare dual case. An
  // unknown/foreign `?hospital=` falls back to the first HELD hospital rather than
  // trusting the query string — and RLS re-gates the read regardless, so a tampered id
  // yields an empty list, never another hospital's referrals.
  const selected =
    access.hospitals.find((h) => h.hospital.id === hospital) ??
    access.hospitals[0];

  const { rows: referrals, nextCursor } = await listTechnicalDirectionReferrals(
    selected.hospital.id,
    { cursor },
  );

  const basePath = `/o/${org}/direcao-tecnica`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          {selected.hospital.name}
        </p>
        <h1 className="inline-flex items-center gap-2.5 text-3xl text-balance">
          <Stethoscope aria-hidden="true" className="size-7 text-primary" />
          Encaminhamentos à direção técnica
        </h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Casos encaminhados pelas comissões deste hospital à direção técnica.{" "}
          {selected.role === "technical_director_deputy"
            ? "Como substituto(a), você responde com a mesma autoridade do(a) titular."
            : "Você responde tecnicamente por todas as comissões deste hospital."}
        </p>
      </header>

      {access.hospitals.length > 1 && (
        <nav aria-label="Selecionar hospital" className="flex flex-wrap gap-2">
          {access.hospitals.map((h) => {
            const isCurrent = h.hospital.id === selected.hospital.id;
            return (
              <Link
                key={h.hospital.id}
                href={`${basePath}?hospital=${h.hospital.id}`}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "rounded-xl border px-3.5 py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                  isCurrent
                    ? "border-primary/40 bg-accent/30 font-medium text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30",
                )}
              >
                {h.hospital.name}
              </Link>
            );
          })}
        </nav>
      )}

      <section
        aria-labelledby="dt-referrals-heading"
        className="animate-rise-in flex flex-col gap-4"
      >
        <h2 id="dt-referrals-heading" className="sr-only">
          Encaminhamentos recebidos
        </h2>
        <ReferralsList
          org={org}
          slug=""
          direction="incoming"
          referrals={referrals}
          hrefBase={basePath}
        />
      </section>

      <CursorPagination nextCursor={nextCursor} />
    </div>
  );
}
