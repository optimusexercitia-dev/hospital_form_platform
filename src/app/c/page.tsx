import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requireUser, type Membership } from "@/lib/queries/session";
import { commissionHref } from "@/lib/routing";

export const metadata: Metadata = {
  title: "Suas comissões",
};

const ROLE_LABEL = {
  staff: "Membro",
  staff_admin: "Coordenação",
} as const;

/**
 * Commission picker for users who belong to more than one commission. Reached
 * from the root role-landing when `memberships.length > 1`. Entries are grouped
 * by organization, since a commission slug is unique only per org now and a user
 * may bridge commissions across orgs — the org heading keeps the choice
 * unambiguous. Defensive shortcuts keep the page coherent if entered directly: a
 * single membership jumps straight in, and a member-less user is sent to the
 * no-access landing (`/`).
 */
export default async function CommissionPickerPage() {
  const context = await requireUser();
  const { memberships } = context;

  if (memberships.length === 1) {
    const { commission } = memberships[0];
    redirect(commissionHref(commission.organization.slug, commission.slug));
  }
  if (memberships.length === 0) {
    // platform/org admins land elsewhere from the root; a user with no
    // commissions belongs on the friendly no-access screen.
    redirect("/");
  }

  // Group memberships by organization, preserving the pt-BR membership sort.
  const byOrg = new Map<
    string,
    { name: string; items: Membership[] }
  >();
  for (const m of memberships) {
    const org = m.commission.organization;
    const group = byOrg.get(org.id);
    if (group) {
      group.items.push(m);
    } else {
      byOrg.set(org.id, { name: org.name, items: [m] });
    }
  }
  const groups = [...byOrg.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const multiOrg = groups.length > 1;

  // Precompute a continuous stagger index across all groups so the entrance
  // animation cascades naturally; computed up front (no render-time mutation).
  const delayByCommissionId = new Map<string, number>();
  let runningIndex = 0;
  for (const group of groups) {
    for (const m of group.items) {
      delayByCommissionId.set(m.commission.id, 80 + runningIndex * 60);
      runningIndex += 1;
    }
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

      <div className="flex flex-col gap-7">
        {groups.map((group) => (
          <section
            key={group.name}
            aria-labelledby={`org-${slugifyHeading(group.name)}-heading`}
            className="flex flex-col gap-3"
          >
            {multiOrg ? (
              <h2
                id={`org-${slugifyHeading(group.name)}-heading`}
                className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
              >
                {group.name}
              </h2>
            ) : (
              // Single-org users get a screen-reader-only heading so the
              // landmark still has an accessible name without visual chrome.
              <h2
                id={`org-${slugifyHeading(group.name)}-heading`}
                className="sr-only"
              >
                {group.name}
              </h2>
            )}
            <ul className="flex flex-col gap-3">
              {group.items.map((m) => {
                const delay = delayByCommissionId.get(m.commission.id) ?? 80;
                return (
                  <li
                    key={m.commission.id}
                    className="animate-rise-in"
                    style={{ ["--rise-delay" as string]: `${delay}ms` }}
                  >
                    <Link
                      href={commissionHref(
                        m.commission.organization.slug,
                        m.commission.slug,
                      )}
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
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

/** Up to two initials from the commission name for the card badge. */
function commissionInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A DOM-id-safe token from an org name for the section's aria id. */
function slugifyHeading(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
