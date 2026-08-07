import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  VerificationResult,
  type VerificationOutcome,
} from "@/components/verification/verification-result";
import { documentPrintingEnabled } from "@/lib/queries/feature-flags";
import {
  lookupPrintedDocumentVerification,
  type VerificationLookupKey,
} from "@/lib/queries/printed-documents";

export const metadata: Metadata = {
  title: "Resultado da verificação",
  robots: { index: false, follow: false },
};

/**
 * Never cache a verdict. A revoked or superseded document must stop reporting
 * "vigente" the moment its status changes — a cached `active` answer served
 * after a revocation is precisely the failure this module exists to prevent
 * (ADR 0104 D6/D8).
 */
export const dynamic = "force-dynamic";

/**
 * `/verificar/<token>` — the answer a QR scan lands on (PDF·P1; ADR 0104 D10).
 *
 * Unauthenticated by design. Renders only the anemic tuple; the download link
 * appears solely when the server-side lookup attached a document id, which it
 * does only for an authenticated caller who passes the source-visibility door.
 *
 * Two credentials share this route (see the landing page's note): a scanned QR
 * carries the verification TOKEN, while the typed short code arrives with
 * `?via=codigo`. The marker picks the lookup key explicitly instead of the page
 * guessing from the string's shape, and instead of trying both keys — trying
 * both would double the rate-limited surface and turn a failed lookup into a
 * weak oracle about which credential space a string falls in.
 */
export default async function VerificacaoResultadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  // Flag gate (ADR 0104 D15) — the server-only, service-role reader, since this
  // page is unauthenticated and `get_feature_flags()` has no anon EXECUTE.
  if (!(await documentPrintingEnabled())) notFound();

  const { token } = await params;
  const { via } = await searchParams;

  const byShortCode = via === "codigo";
  const key: VerificationLookupKey = byShortCode
    ? { shortCode: token }
    : { token };

  const outcome = await lookup(key, byShortCode);

  return <VerificationResult outcome={outcome} />;
}

/**
 * Runs the lookup and maps every possible ending onto a renderable outcome.
 *
 * A thrown lookup becomes `unavailable`, NOT `not_found`: telling someone their
 * genuine document is unrecognised because our service is down would be a lie
 * with real consequences on a page an auditor reads. The raw error never reaches
 * the UI (Rule 10) and is logged WITHOUT the credential — the token is a
 * single-purpose secret printed on paper, and an application log is not where it
 * belongs.
 */
async function lookup(
  key: VerificationLookupKey,
  byShortCode: boolean,
): Promise<VerificationOutcome> {
  try {
    const verification = await lookupPrintedDocumentVerification(key);
    return verification
      ? { state: "found", verification }
      : { state: "not_found" };
  } catch (error) {
    console.error(
      `[verificar] lookup failed (via=${byShortCode ? "codigo" : "qr"})`,
      error,
    );
    return { state: "unavailable" };
  }
}
