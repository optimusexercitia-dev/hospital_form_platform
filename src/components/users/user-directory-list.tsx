import Link from "next/link";
import { Building2, Users2, UserRoundX } from "lucide-react";

import type { OrgUserListItem } from "@/lib/users/types";
import { orgHref } from "@/lib/routing";
import { UserStatusBadge } from "@/components/users/user-status-badge";

/**
 * The user directory's row list. Pure presentational — Server-Component-safe,
 * no client interaction of its own — each row links to the per-user
 * management page. Staggered entrance via `.animate-rise-in`.
 *
 * ⚠ AFF W3/T3.2 (ADR 0097 D2). The hospital line is now derived from
 * `hospital_affiliations`, not from a dropped `profiles` column, and a person may show
 * more than one hospital — that is the scenario this workstream exists for.
 *
 * ⚠ A person with ZERO committees MUST be legible, not look like a data error. That is
 * the entire point of the affiliation table: a commission-derived roster silently drops
 * the professional who has been hired but not yet seated on anything, which is exactly
 * the person their hospital's admin needs to find in order to seat them. So the two
 * facts get their own chips — employment and committees are different things, and
 * "nenhuma comissão" is a real, expected state with a neutral chip of its own, never an
 * empty cell.
 *
 * ⚠ An empty list NEVER means "you lack permission" (`list_org_people` and the
 * RLS-scoped reads both return nothing rather than raising, deliberately, so a probe
 * cannot distinguish the two). The empty copy says "none found", never "not allowed".
 */
export function UserDirectoryList({
  org,
  users,
  filtered,
  scope = "org",
}: {
  org: string;
  users: OrgUserListItem[];
  filtered: boolean;
  /** Which directory this is — the empty state says something different for each. */
  scope?: "org" | "hospital";
}) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
        <UserRoundX aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {filtered
            ? "Nenhum usuário encontrado para essa busca."
            : scope === "hospital"
              ? "Ninguém vinculado a este hospital ainda. Use “Registrar pessoa” para vincular ou cadastrar alguém."
              : "Nenhum usuário registrado ainda. Use “Registrar pessoa” para começar."}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {users.map((u, index) => {
        const displayName = u.fullName?.trim() || u.email || "Sem identificação";
        return (
          <li
            key={u.id}
            className="animate-rise-in"
            style={{ ["--rise-delay" as string]: `${index * 40}ms` }}
          >
            <Link
              href={orgHref(org, "manage", "usuarios", u.id)}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {displayName}
                  </p>
                  <UserStatusBadge status={u.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {u.email ?? "Sem e-mail"}
                  {u.categoryLabel ? ` · ${u.categoryLabel}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Chip
                    icon={
                      <Building2 aria-hidden="true" className="size-3.5" />
                    }
                    muted={!u.homeHospitalName}
                  >
                    {u.homeHospitalName ?? "Sem vínculo hospitalar"}
                  </Chip>
                  <Chip
                    icon={<Users2 aria-hidden="true" className="size-3.5" />}
                    muted={u.committeeCount === 0}
                  >
                    {u.committeeCount === 0
                      ? "Sem comissão"
                      : u.committeeCount === 1
                        ? "1 comissão"
                        : `${u.committeeCount} comissões`}
                  </Chip>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A directory fact chip. `muted` marks the "none" variant — an expected state, not a
 * warning — and is carried by icon + wording + a dashed outline together, never by
 * colour alone (design system §6).
 */
function Chip({
  icon,
  muted,
  children,
}: {
  icon: React.ReactNode;
  muted: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={
        muted
          ? "inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
          : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
      }
    >
      {icon}
      {children}
    </span>
  );
}
