import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { printCurrencyFrom } from "@/components/printing/currency";
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
 * Never cache a verdict — and the reason is BROADER than this comment used to
 * claim.
 *
 * The original rationale read: *a revoked or superseded document must stop
 * reporting "vigente" the moment its STATUS changes*. Both halves have gone
 * stale, and the decision they justify is now MORE necessary than they state:
 *
 *  - **`active` never meant "vigente"** (ADR 0126 D3). Registry status records
 *    DELIBERATE acts only — re-mint supersession and revocation — while
 *    CURRENCY is derived at read time from the source. A print is legally
 *    `active` AND not current. (The page itself asserted that conflation in its
 *    `active` copy until ADR 0126 Amendment 1 §K; this comment was the other
 *    half of the same mistake.)
 *  - **Currency moves with NO status change at all.** `reject_correction`,
 *    `reopen_meeting`, `approve_correction` (both the pointer move and a void)
 *    and a minutes disposal each change what this page must answer while the
 *    `printed_documents` row is untouched.
 *
 * ⛔ So a cached answer can go wrong along an axis that leaves NO trace in the
 * registry row — worse than the revocation case the old text named, because
 * nothing about the cached row looks stale. Do not weaken this on the belief
 * that status is the only mover.
 *
 * ADR 0104 D6/D8 · ADR 0126 D2/D3/D4 · ADR 0125 Amendment 1 §D (the two
 * backwards doors).
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

  // ADR 0126 D2/D4 — CURRENCY, stated as its own fact beside authenticity and
  // registry status. Derived at read time (D3), never stamped.
  //
  // ⛔ `printCurrencyFrom` is the ONE adapter, and it takes `boolean | null` —
  // never `undefined`. A `revoked` print reports `null` (the door performs no
  // source join at all, which is what preserves `312` t76's independence), and
  // that maps to `notApplicable`: the page says ANULADO and says NOTHING about
  // currency. A NON-revoked print with a null verdict is a contract violation,
  // not a deliberate non-evaluation, and maps to `indeterminate` instead — the
  // two absences must never share a rendering.
  const currency =
    outcome.state === "found"
      ? printCurrencyFrom(outcome.verification.status, outcome.verification.isCurrent)
      : undefined;

  return <VerificationResult outcome={outcome} currency={currency} />;
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
