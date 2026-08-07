import { FolderOpen, ShieldCheck, BarChart3 } from "lucide-react";

type Variant = "no-commissions" | "no-cases" | "no-dashboards";

const COPY: Record<
  Variant,
  { icon: typeof FolderOpen; title: string; body: string }
> = {
  /**
   * The reviewer holds the seat but no commission of their hospital(s) has been
   * opted in. `quality_oversight` defaults to `'excluded'` and fails closed
   * (ADR 0100 D8), so this is the EXPECTED first-day state, not a fault — the
   * copy says who acts next and deliberately offers no button, because the
   * reviewer genuinely cannot self-serve here (the door is
   * hospital_admin/org_admin only, D9).
   */
  "no-commissions": {
    icon: ShieldCheck,
    title: "Nenhuma comissão sob supervisão",
    body: "A administração do hospital define quais comissões ficam visíveis para o Escritório da Qualidade. Assim que a primeira for habilitada, os casos aparecem aqui.",
  },
  "no-cases": {
    icon: FolderOpen,
    title: "Nenhum caso visível no momento",
    body: "As comissões sob supervisão ainda não registraram casos que você possa acompanhar.",
  },
  "no-dashboards": {
    icon: BarChart3,
    title: "Ainda não há respostas enviadas",
    body: "Quando as comissões sob supervisão enviarem formulários, as estatísticas agregadas aparecem aqui.",
  },
};

/**
 * The console's three empty states. Calm and factual: an empty oversight board
 * is a normal condition, so none of these renders as a warning.
 */
export function QualityEmptyState({
  variant,
  note,
}: {
  variant: Variant;
  /**
   * An optional extra line — used by the board to carry the PHI-free locked
   * count (ADR 0100 D6) when the visible population is empty but a restricted
   * one exists, so "nothing here" is not mistaken for "nothing exists".
   */
  note?: string;
}) {
  const { icon: Icon, title, body } = COPY[variant];
  return (
    <section
      aria-label={title}
      className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        {body}
      </p>
      {note ? (
        <p className="text-sm text-muted-foreground tabular-nums">{note}</p>
      ) : null}
    </section>
  );
}
