import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  History,
  SearchX,
} from "lucide-react";

import {
  VerificationSeal,
  type SealTone,
} from "@/components/verification/verification-seal";
import {
  DOCUMENT_KIND_LABELS,
  formatDatePtBrLong,
} from "@/components/printing/labels";
import type { PrintedDocumentVerification } from "@/lib/queries/printed-documents";

/**
 * What one verification lookup produced. `unavailable` is a first-class outcome,
 * not an afterthought: the lookup can fail (and, while the PDF·P1 backend stubs
 * are in place, always does), and a public page must answer that honestly in
 * pt-BR rather than leaking a stack trace or — worse — implying the document is
 * fake. "We could not check" and "this is not authentic" are different answers
 * and must never be rendered as the same one.
 */
export type VerificationOutcome =
  | { state: "found"; verification: PrintedDocumentVerification }
  | { state: "not_found" }
  | { state: "unavailable" };

/**
 * The public verification answer (ADR 0104 D10).
 *
 * Renders ONLY the anemic tuple — authentic yes/no, status, mint date, document
 * kind, hospital name. Never patient anything, never case numbers, never actor
 * names, never bytes. The download affordance appears only when the lookup
 * itself returned a document id, which the server sets exclusively for an
 * authenticated caller who passes the source-visibility door; an anonymous
 * visitor always receives `null` and therefore never sees a link. The rule is
 * enforced server-side — this component is not the control, it just refuses to
 * invent a link it was not given.
 */
export function VerificationResult({
  outcome,
}: {
  outcome: VerificationOutcome;
}) {
  const view = describe(outcome);

  return (
    <section
      aria-labelledby="verification-heading"
      className="flex flex-col gap-7"
    >
      <div className="animate-rise-in flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <VerificationSeal tone={view.tone}>{view.icon}</VerificationSeal>
        <div className="flex flex-col gap-2">
          <h1 id="verification-heading" className="text-3xl text-balance">
            {view.heading}
          </h1>
          <p className="max-w-prose text-base leading-relaxed text-pretty text-muted-foreground">
            {view.summary}
          </p>
        </div>
      </div>

      {view.notice ? (
        <p
          className="animate-rise-in max-w-prose rounded-xl border border-warning/30 bg-warning/12 px-4 py-3 text-sm leading-relaxed text-pretty text-foreground"
          style={{ ["--rise-delay" as string]: "80ms" }}
        >
          {view.notice}
        </p>
      ) : null}

      {outcome.state === "found" ? (
        <dl
          className="animate-rise-in grid gap-x-8 gap-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2"
          style={{ ["--rise-delay" as string]: "140ms" }}
        >
          <DetailRow
            term="Tipo de documento"
            value={DOCUMENT_KIND_LABELS[outcome.verification.sourceKind]}
          />
          <DetailRow term="Hospital" value={outcome.verification.hospitalName} />
          <DetailRow
            term="Emitido em"
            value={formatDatePtBrLong(outcome.verification.mintedAt)}
            className="sm:col-span-2"
          />
        </dl>
      ) : null}

      {outcome.state === "found" ? (
        <DownloadAffordance verification={outcome.verification} />
      ) : null}

      <p
        className="animate-rise-in text-sm text-muted-foreground"
        style={{ ["--rise-delay" as string]: "220ms" }}
      >
        <Link
          href="/verificar"
          className="rounded underline underline-offset-4 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Verificar outro documento
        </Link>
      </p>
    </section>
  );
}

/** One term/value pair of the anemic tuple. */
function DetailRow({
  term,
  value,
  className,
}: {
  term: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {term}
      </dt>
      <dd className="mt-1 text-base text-foreground">{value}</dd>
    </div>
  );
}

/**
 * The authenticated-viewer download path (ADR 0104 D10/D11). Rendered only when
 * the server-side lookup attached a document id. Links into the serving route,
 * which re-evaluates authority at download time and audits the read — never a
 * Storage URL (D8).
 */
function DownloadAffordance({
  verification,
}: {
  verification: PrintedDocumentVerification;
}) {
  if (!verification.documentId) return null;

  return (
    <div
      className="animate-rise-in flex flex-col gap-2"
      style={{ ["--rise-delay" as string]: "180ms" }}
    >
      <Link
        href={`/api/documents/${verification.documentId}`}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Download aria-hidden="true" className="size-4" />
        Baixar o documento
      </Link>
      <p className="text-sm text-muted-foreground">
        Disponível porque você está autenticado e tem acesso à origem deste
        documento. O download é registrado na auditoria.
      </p>
    </div>
  );
}

interface VerificationView {
  tone: SealTone;
  icon: React.ReactNode;
  heading: string;
  summary: string;
  notice?: string;
}

/**
 * Maps an outcome to its pt-BR presentation. The wording is load-bearing, not
 * copywriting:
 *
 * - `superseded` MUST read as recency, never as error (ADR 0104 D6). Someone
 *   holding a superseded print holds an authentic document; supersession says a
 *   newer print exists, not that this one is wrong. So the heading stays
 *   "autêntico" and the recency fact moves to a neutral notice.
 * - `not_found` stays calm and gives no oracle — it is deliberately
 *   indistinguishable from "never existed", and it suggests a typo (the likely
 *   cause when someone hand-types a short code) without confirming anything.
 */
function describe(outcome: VerificationOutcome): VerificationView {
  if (outcome.state === "unavailable") {
    return {
      tone: "neutral",
      icon: <AlertTriangle aria-hidden="true" className="size-7" />,
      heading: "Não foi possível verificar agora",
      summary:
        "O serviço de verificação está indisponível no momento. Tente novamente em alguns minutos. Isso não diz nada sobre a autenticidade do documento.",
    };
  }

  if (outcome.state === "not_found") {
    return {
      tone: "neutral",
      icon: <SearchX aria-hidden="true" className="size-7" />,
      heading: "Documento não reconhecido",
      summary:
        "Não encontramos nenhuma emissão com este código. Confira se o código foi digitado exatamente como aparece no documento.",
    };
  }

  switch (outcome.verification.status) {
    case "active":
      return {
        tone: "success",
        icon: <CheckCircle2 aria-hidden="true" className="size-7" />,
        heading: "Documento autêntico",
        summary:
          "Esta emissão foi gerada pela plataforma e é a emissão vigente deste documento.",
      };
    case "superseded":
      return {
        tone: "warning",
        icon: <History aria-hidden="true" className="size-7" />,
        heading: "Documento autêntico",
        summary: "Esta emissão foi gerada pela plataforma.",
        notice:
          "Existe uma emissão mais recente deste documento. A via em mãos continua autêntica — apenas deixou de ser a emissão mais recente.",
      };
    case "revoked":
      return {
        tone: "danger",
        icon: <Ban aria-hidden="true" className="size-7" />,
        heading: "Documento anulado",
        summary:
          "Esta emissão foi anulada pela comissão responsável e não deve ser usada como via válida.",
      };
  }
}
