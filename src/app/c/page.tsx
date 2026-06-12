import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requireUser } from "@/lib/queries/session";

export const metadata: Metadata = {
  title: "Suas comissões",
};

const ROLE_LABEL = {
  staff: "Membro",
  staff_admin: "Coordenação",
} as const;

/**
 * Commission picker for users who belong to more than one commission. Reached
 * from the root role-landing when `memberships.length > 1`. Defensive
 * shortcuts keep the page coherent if entered directly: a single membership
 * jumps straight in, and a member-less non-admin is sent to the no-access
 * landing (`/`).
 */
export default async function CommissionPickerPage() {
  const context = await requireUser();
  const { memberships } = context;

  if (memberships.length === 1) {
    redirect(`/c/${memberships[0].commission.slug}`);
  }
  if (memberships.length === 0) {
    // Admins land on /admin from the root; a non-admin with no commissions
    // belongs on the friendly no-access screen.
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header
        className="animate-rise-in flex flex-col gap-2"
        style={{ ["--rise-delay" as string]: "40ms" }}
      >
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Comissões Hospitalares
        </p>
        <h1 className="text-3xl text-balance">Escolha uma comissão</h1>
        <p className="text-muted-foreground text-pretty">
          Você participa de mais de uma comissão. Selecione com qual deseja
          trabalhar agora.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {memberships.map((m, i) => (
          <li
            key={m.commission.id}
            className="animate-rise-in"
            style={{ ["--rise-delay" as string]: `${80 + i * 60}ms` }}
          >
            <Link
              href={`/c/${m.commission.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                {commissionInitials(m.commission.name)}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{m.commission.name}</span>
                <span className="text-sm text-muted-foreground">
                  {ROLE_LABEL[m.role]}
                </span>
              </span>
              <ArrowRight
                className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Up to two initials from the commission name for the card badge. */
function commissionInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
