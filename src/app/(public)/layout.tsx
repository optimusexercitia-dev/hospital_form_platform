/**
 * Shell for the platform's PUBLIC, unauthenticated surfaces (PDF·P1; ADR 0104
 * D10). Today that is only `/verificar` — the page someone reaches by scanning
 * the QR code on a printed document, or by typing its short code.
 *
 * Deliberately NOT the `(auth)` split-canvas shell. That layout is sign-in
 * framing: a brand panel plus an animated hero canvas, sized for someone about
 * to authenticate. A verification visitor is the opposite case — an auditor, a
 * lawyer, an inspector holding paper, who wants one fact and must not be nudged
 * toward a login they have no account for. So this shell is a calm centred
 * column: wordmark, content, a short footer stating what the page does and does
 * not reveal.
 *
 * Server Component; zero client JS from the shell itself. The entrance uses the
 * shared CSS utilities (`animate-rise-in` / `animate-fade-in`), which already
 * collapse under `prefers-reduced-motion` (globals.css §5).
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-5">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card shadow-xs"
          >
            <PulseMark className="size-4.5 text-primary" />
          </span>
          <p className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Comissões Hospitalares
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
        {children}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto w-full max-w-2xl px-6 py-6">
          <p className="max-w-prose text-xs leading-relaxed text-pretty text-muted-foreground">
            Esta página confirma apenas a autenticidade e a situação de um
            documento emitido pela plataforma. O conteúdo do documento, os dados
            de pacientes e as pessoas envolvidas não são exibidos aqui.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Brand glyph — a "pulse" mark suggesting measurement and clinical vital signs.
 * Inline static SVG, no runtime cost, `aria-hidden` via the wrapping span.
 * Mirrors the mark defined locally in `(auth)/layout.tsx`; each shell carrying
 * its own copy is the existing house pattern for this glyph.
 */
function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12h4l2.5-6 4 12 3-9 2 3h4.5" />
    </svg>
  );
}
