import { AuthHero } from "@/components/auth/auth-hero";

/**
 * Shared shell for the public auth screens (login, password reset, set new
 * password, invite acceptance). A split canvas: an atmospheric brand panel on
 * the left (decorative mesh hero) and the form card on the right. On small
 * screens the brand panel collapses and only the form shows.
 *
 * Server Component — the only client island is the decorative <AuthHero/>.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand / atmosphere panel — hidden on small screens. */}
      <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <AuthHero />
        <div className="animate-fade-in relative z-10">
          <p className="text-sm font-medium tracking-[0.18em] text-background/70 uppercase">
            Comissões Hospitalares
          </p>
        </div>
        <div
          className="animate-rise-in relative z-10 max-w-md"
          style={{ ["--rise-delay" as string]: "120ms" }}
        >
          <h2 className="text-3xl leading-tight text-balance text-background">
            Checklists e formulários das comissões, agora digitais.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-background/70 text-pretty">
            Padronize o preenchimento e gere estatísticas automaticamente — sem
            tabulação manual.
          </p>
        </div>
        <p className="relative z-10 text-xs text-background/50">
          Nenhum dado de paciente é coletado nesta plataforma.
        </p>
      </aside>

      {/* Form panel. */}
      <main className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
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
