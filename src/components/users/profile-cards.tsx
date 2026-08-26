import { cn } from "@/lib/utils";

/**
 * The card shells shared by the user-profile screen (redesign 2a).
 *
 * ⚠ DIRECTIVE-FREE ON PURPOSE. `AccountHistoryCard` is a Server Component and
 * `PersonalDataCard` / `AccessCard` / `CredentialsCard` are Client Components; a module
 * with no `"use client"` can be imported by both, and simply becomes part of the client
 * bundle where a client component pulls it in. Adding the directive here would drag the
 * history card's tree across the boundary for nothing.
 *
 * Purely presentational: no state, no actions, no data access.
 */

/**
 * A main-column card (Vínculos, Comissões, Histórico).
 *
 * ⛔ `titleId` IS REQUIRED, and it is not decoration. Each of these renders a named
 * `region` landmark whose accessible name — "Vínculos hospitalares", "Comissões",
 * "Histórico da conta" — is how the E2E suite addresses the section. A card that renders
 * a heading without wiring `aria-labelledby` to it looks identical on screen and is
 * anonymous to assistive tech and to `getByRole('region', { name })`.
 */
export function ProfileCard({
  titleId,
  title,
  caption,
  action,
  riseDelay,
  children,
  className,
}: {
  titleId: string;
  title: string;
  /** The muted line under the heading. Explains what the card is FOR, never how it works. */
  caption?: string;
  /** The header's trailing affordance (the dashed "＋ Adicionar …" trigger). */
  action?: React.ReactNode;
  /** Stagger step for `.animate-rise-in`, e.g. `"40ms"`. */
  riseDelay?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "animate-rise-in flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-6 shadow-xs",
        className,
      )}
      style={riseDelay ? { ["--rise-delay" as string]: riseDelay } : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {caption ? (
            <p className="mt-1 max-w-prose text-xs text-muted-foreground text-pretty">
              {caption}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A rail card (Dados pessoais, Registros profissionais, Acesso). Same rules as above. */
export function RailCard({
  titleId,
  title,
  action,
  riseDelay,
  children,
  className,
}: {
  titleId: string;
  title: string;
  action?: React.ReactNode;
  riseDelay?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
      style={riseDelay ? { ["--rise-delay" as string]: riseDelay } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-[0.95rem] font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * One label→value line in a rail card.
 *
 * The value cell is `text-right` and truncating, so a long phone or category never
 * pushes the label off its own row. Callers pass an already-rendered value, which is
 * what lets each card keep its own "not informed" wording instead of this component
 * inventing one — the distinction between "not informed" and "withheld" belongs to the
 * card that knows which it is.
 */
export function DefinitionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

/** The muted rule-and-note that closes a rail card. */
export function CardFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border pt-2.5 text-[0.7rem] text-muted-foreground text-pretty">
      {children}
    </p>
  );
}

/**
 * The trailing text button in a card header ("Editar", "Alterar papel") and the dashed
 * ghost trigger ("＋ Adicionar vínculo").
 *
 * Both are `<button>`s, never styled spans: keyboard operability and the focus ring come
 * from the element, not from the class list.
 */
export function CardTextButton({
  className,
  tone = "primary",
  ...props
}: React.ComponentProps<"button"> & { tone?: "primary" | "destructive" }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md text-xs font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        tone === "destructive"
          ? "text-destructive hover:text-destructive/80"
          : "text-primary hover:text-primary/80",
        className,
      )}
      {...props}
    />
  );
}

/** The dashed "＋ Adicionar …" trigger that opens a card's dialog. */
export function CardAddButton({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A small status pill. Label and colour always travel together — colour alone is never
 * the carrier of a state (the same rule `UserStatusBadge` follows).
 */
export function StatusPill({
  tone,
  uppercase = false,
  children,
}: {
  tone: "success" | "accent" | "muted" | "destructive";
  uppercase?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 font-semibold",
        uppercase
          ? "text-[0.625rem] tracking-wide uppercase"
          : "text-[0.66rem]",
        tone === "success" && "bg-success/12 text-success",
        tone === "accent" && "bg-accent text-accent-foreground",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "destructive" && "bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </span>
  );
}
