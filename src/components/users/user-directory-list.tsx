import Link from "next/link";
import { Users2 } from "lucide-react";

import type { OrgUserListItem } from "@/lib/users/types";
import { orgHref } from "@/lib/routing";
import { UserStatusBadge } from "@/components/users/user-status-badge";

/**
 * The user directory's row list. Pure presentational — Server-Component-safe,
 * no client interaction of its own — each row links to the per-user
 * management page. Staggered entrance via `.animate-rise-in`.
 */
export function UserDirectoryList({
  org,
  users,
  filtered,
}: {
  org: string;
  users: OrgUserListItem[];
  filtered: boolean;
}) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
        <Users2 aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {filtered
            ? "Nenhum usuário encontrado para essa busca."
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {u.homeHospitalName ?? "Sem hospital de origem"}
                  <span aria-hidden="true" className="mx-1.5">
                    ·
                  </span>
                  {u.committeeCount === 0
                    ? "Nenhuma comissão"
                    : u.committeeCount === 1
                      ? "1 comissão"
                      : `${u.committeeCount} comissões`}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
