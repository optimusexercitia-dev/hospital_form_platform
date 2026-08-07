import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { documentPrintingEnabled } from "@/lib/queries/feature-flags";

export const metadata: Metadata = {
  title: "Verificar documento",
  // A verification tool, not a landing page — keep it out of search indexes.
  robots: { index: false, follow: false },
};

/** Longest short code we will forward to the lookup. Not a format assertion —
 * backend owns the code format — just a guard so a pasted essay never becomes a
 * URL path segment. */
const MAX_CODE_LENGTH = 64;

/**
 * `/verificar` — the entry point for someone holding a printed document whose QR
 * code will not scan (PDF·P1; ADR 0104 D10, "human-readable short code beside
 * the QR as damage fallback").
 *
 * Server Component, and the form is a plain `<form>` posting to an inline server
 * action that redirects. That is deliberate: this is the fallback path for a
 * damaged QR, so it must work in the weakest environment we can imagine —
 * including with JavaScript disabled. No client bundle participates in getting
 * an auditor from a typed code to an answer.
 *
 * The short code and the QR token are different credentials, and a URL path
 * segment cannot say which one it carries. Rather than sniff the format (a guess
 * about a backend-owned shape, and the kind that goes stale silently), the form
 * marks its own route explicitly with `?via=codigo`; a scanned QR arrives
 * without it and is read as a token. One lookup per visit, no format guessing.
 */
export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // Flag gate (ADR 0104 D15 — the module ships OFF, platform-wide). The
  // server-only, service-role reader, NOT `featureEnabled`: this page is
  // unauthenticated, `get_feature_flags()` has no anon EXECUTE, and granting it
  // one to save a round trip would widen a public surface for a convenience read.
  if (!(await documentPrintingEnabled())) notFound();

  const { erro } = await searchParams;
  const error = erro === "vazio" ? "Digite o código impresso no documento." : null;

  return (
    <section aria-labelledby="verificar-heading" className="flex flex-col gap-8">
      <header className="animate-rise-in flex flex-col gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"
        >
          <ShieldCheck className="size-5.5" />
        </span>
        <h1 id="verificar-heading" className="text-3xl text-balance">
          Verificar documento
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-pretty text-muted-foreground">
          Digite o código impresso ao lado do QR code para confirmar se o
          documento é autêntico e se continua sendo a emissão mais recente.
        </p>
      </header>

      <form
        action={goToVerification}
        className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        style={{ ["--rise-delay" as string]: "80ms" }}
      >
        <Field>
          <FieldLabel htmlFor="verificar-codigo">
            Código de verificação
          </FieldLabel>
          <Input
            id="verificar-codigo"
            name="codigo"
            required
            maxLength={MAX_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Ex.: 7K4P-2M9X"
            aria-describedby="verificar-codigo-description"
            aria-invalid={error ? true : undefined}
          />
          <FieldDescription id="verificar-codigo-description">
            O código aparece impresso junto ao QR code, no rodapé do documento.
            Espaços são ignorados.
          </FieldDescription>
          <FieldError>{error}</FieldError>
        </Field>

        <div>
          <Button type="submit" size="lg">
            Verificar
          </Button>
        </div>
      </form>

      <p
        className="animate-fade-in max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground"
        style={{ ["--rise-delay" as string]: "160ms" }}
      >
        Se o QR code do documento estiver legível, apontar a câmera para ele leva
        direto ao resultado — não é necessário digitar nada.
      </p>
    </section>
  );
}

/**
 * Normalizes the typed code and forwards to the result route.
 *
 * Whitespace-only normalization is intentional. Printed codes are commonly
 * grouped for legibility ("7K4P 2M9X") and people retype the grouping, so spaces
 * must go — but case and punctuation are left exactly as typed, because the code
 * format belongs to backend and folding it here would be this module guessing at
 * a shape it does not own. Case-insensitive matching, if wanted, belongs in the
 * lookup, where the stored value actually lives.
 *
 * Performs no data access: it normalizes and redirects. The lookup happens on
 * the result page, under the rate limit.
 */
async function goToVerification(formData: FormData) {
  "use server";

  const raw = formData.get("codigo");
  const code = (typeof raw === "string" ? raw : "").replace(/\s+/g, "");

  if (!code || code.length > MAX_CODE_LENGTH) {
    redirect("/verificar?erro=vazio");
  }

  redirect(`/verificar/${encodeURIComponent(code)}?via=codigo`);
}
