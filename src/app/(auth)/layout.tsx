import { AuthHero } from "@/components/auth/auth-hero";

/**
 * Shared shell for the public auth screens (login, password reset, set new
 * password, invite acceptance). A split canvas: an atmospheric brand panel on
 * the left (decorative animated hero + layered depth) and the form card on the
 * right. On small screens the brand panel collapses and only the form shows, so
 * no heavy canvas work runs on phones.
 *
 * Server Component — the only client island is the decorative <AuthHero/>. The
 * brand copy uses the shared CSS entrance utilities (`animate-rise-in` /
 * `animate-fade-in`), which already collapse under `prefers-reduced-motion`.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand / atmosphere panel — hidden on small screens. The AuthHero paints
          the animated field; the gradient washes below add depth without any
          extra JS. */}
      <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-14">
        <AuthHero />

        {/* Static atmospheric wash — layered radial glows evoking a calm,
            instrument-lit surface. Purely decorative, zero JS. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(120% 90% at 12% 8%, oklch(0.6 0.12 252 / 0.28), transparent 55%), radial-gradient(110% 80% at 88% 100%, oklch(0.55 0.1 200 / 0.22), transparent 60%)",
          }}
        />
        {/* Fine top edge highlight so the panel reads as a lit surface. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-background/15"
        />

        {/* Wordmark. */}
        <div
          className="animate-fade-in relative z-10 flex items-center gap-3"
          data-parallax="0.4"
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl border border-background/20 bg-background/10 backdrop-blur-sm"
          >
            <PulseMark className="size-4.5 text-background" />
          </span>
          <p className="text-sm font-medium tracking-[0.18em] text-background/75 uppercase">
            Comissões Hospitalares
          </p>
        </div>

        {/* Headline block — subtle parallax handle so the hero can nudge it. */}
        <div
          className="animate-rise-in relative z-10 max-w-md"
          style={{ ["--rise-delay" as string]: "120ms" }}
          data-parallax="0.9"
        >
          <h2 className="text-4xl leading-[1.1] text-balance text-background">
            Checklists e formulários das comissões, agora digitais.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-pretty text-background/70">
            Padronize o preenchimento, acompanhe processos e gere estatísticas
            automaticamente — sem tabulação manual.
          </p>
        </div>

        {/* Compliance footer — accurate under the platform's LGPD/HIPAA posture
            (ADR 0030): patient data lives only in dedicated, safeguarded
            modules. The old "no patient data" claim was removed. */}
        <p
          className="animate-fade-in relative z-10 max-w-sm text-xs leading-relaxed text-background/50"
          style={{ ["--rise-delay" as string]: "220ms" }}
          data-parallax="0.4"
        >
          Dados protegidos conforme a LGPD. Informações de pacientes ficam
          restritas a módulos dedicados, com acesso controlado e auditado.
        </p>
      </aside>

      {/* Form panel. */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div
          className="animate-rise-in w-full max-w-sm"
          style={{ ["--rise-delay" as string]: "60ms" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/**
 * Small decorative brand glyph — a "pulse" mark suggesting measurement and
 * clinical vital signs. Inline, static SVG (no runtime cost); `aria-hidden` via
 * the wrapping span.
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
