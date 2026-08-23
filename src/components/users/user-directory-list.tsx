import Link from "next/link";
import { ChevronRight, UserRoundX } from "lucide-react";

import type { OrgUserListItem } from "@/lib/users/types";
import { orgHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import {
  STATUS_FILTER_LABEL,
  type UserDirectoryStatusFilter,
} from "@/components/users/user-directory-status-pills";

/**
 * The user directory's table (AFF2 F1, handoff §Screen 1 option 1a).
 *
 * ⚠ SERVER COMPONENT — no client interaction of its own. The entrance is CSS
 * (`.animate-rise-in` + `--rise-delay`), deliberately NOT `RiseInGroup`: that is a
 * client component, and wrapping twenty decorative rows in GSAP would push
 * `"use client"` around the whole table to buy nothing. Reduced motion is handled
 * globally in `globals.css`.
 *
 * ⚠ NOT A `<table>`, and that is a constraint rather than a preference: the whole
 * row is one link, and an `<a>` may not wrap a `<tr>`. So it is a `<ul>` of `<li>`s
 * whose `<Link>` IS the grid. The column-header strip is therefore decoration
 * (`aria-hidden`) and every cell self-labels with an `sr-only` prefix instead — a
 * screen-reader user hears exactly the facts the sighted row shows.
 *
 * ⛔ EVERY VISIBLE STRING SITS IN ITS OWN ELEMENT, never as a bare text node beside
 * its `sr-only` prefix. `textContent` fuses siblings with NO separator, so
 * `<span class="sr-only">Comissões: </span>Sem comissão` serialises to
 * "Comissões: Sem comissão" and defeats any exact-text matcher (E2E asserts
 * `getByText('Sem comissão', { exact: true })`). The prefix and the value are two
 * elements; this is load-bearing, not tidiness.
 *
 * ⚠ AFF W3/T3.2 (ADR 0097 D2). The hospital fact is derived from
 * `hospital_affiliations`, not from a dropped `profiles` column, and a person may
 * work at more than one hospital — that is the scenario that workstream exists for.
 *
 * ⛔ NEVER AN EMPTY CELL. A blank cell reads as "you lack permission", an ambiguity
 * this codebase bans: the RLS-scoped reads and `list_org_people` both return nothing
 * rather than raising, precisely so a probe cannot tell the two apart. Every column
 * has an explicit empty rendering ("Sem comissão" dashed, "Sem vínculo hospitalar"
 * muted, "—" for Registro), and the empty-state copy says "none found", never
 * "not allowed".
 */

/**
 * F1 INTERIM — the three facts this table shows that today's `OrgUserListItem`
 * does not carry. They are backend task **B7** (widening `OrgUserListItem` in
 * `src/lib/users/types.ts`, which `backend` owns); the Registro column additionally
 * needs B2's `professional_credentials` SELECT widening before a hospital_admin can
 * see anything in it (ADR 0133 D13).
 *
 * ⛔ OPTIONAL ON PURPOSE. Until B7 lands each column falls back to the fact the
 * current row does carry, and never to a blank. When B7 lands, `DirectoryRow`
 * collapses to `OrgUserListItem`, the three `?? fallback` branches below go, and
 * this block is deleted — a type change, not a rewrite.
 */
export interface DirectoryRowExtras {
  /** ACTIVE affiliations by name. An ARRAY, not the joined string: "N hospitais"
   * cannot be recovered from a `', '`-join when a hospital name may contain a comma. */
  hospitalNames: string[];
  committees: {
    commissionId: string;
    commissionName: string;
    role: "staff" | "staff_admin";
  }[];
  /** Pre-formatted for display, e.g. "CRM/SP 152.984". Null when none is visible. */
  councilRegistration: string | null;
}

export type DirectoryRow = OrgUserListItem & Partial<DirectoryRowExtras>;

/**
 * Role labels come from the codebase's own vocabulary
 * (`committee-role-assigner.tsx`, `affiliations-panel.tsx`), NOT from the design
 * reference — which renders "Coordenadora", gendered feminine for whichever person
 * happens to hold the seat.
 */
const ROLE_LABEL: Record<"staff" | "staff_admin", string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
};

/**
 * The six-column track, shared by the header strip and every row so the two can
 * never drift. Below `lg` the row stacks instead of scrolling sideways: the track's
 * own minimums total ~866px, and a horizontal trough would need its own
 * keyboard-scrollable region to stay accessible.
 */
const ROW_GRID =
  "lg:grid lg:grid-cols-[minmax(230px,1.5fr)_96px_minmax(150px,0.9fr)_minmax(190px,1.2fr)_118px_22px] lg:items-center lg:gap-3";

/** Initials for the avatar: first + last word of the name, else the e-mail's first letter. */
function initialsOf(fullName: string | null, email: string | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0]!.charAt(0);
    const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
    return (first + last).toUpperCase();
  }
  return (email ?? "").trim().charAt(0).toUpperCase() || "?";
}

/** The "Vínculo hospitalar" cell's text, and whether it is the muted "none" variant. */
function hospitalCell(user: DirectoryRow): { text: string; muted: boolean } {
  const names = user.hospitalNames;
  if (names !== undefined) {
    if (names.length === 0) return { text: "Sem vínculo hospitalar", muted: true };
    if (names.length === 1) return { text: names[0]!, muted: false };
    return { text: `${names.length} hospitais`, muted: false };
  }
  // Pre-B7: the `', '`-joined string. One affiliation renders exactly as it will
  // afterwards; several render the joined names rather than a count, because the
  // count is not recoverable from the join.
  return user.homeHospitalName
    ? { text: user.homeHospitalName, muted: false }
    : { text: "Sem vínculo hospitalar", muted: true };
}

export function UserDirectoryList({
  org,
  users,
  total,
  filtered,
  statusFilter = null,
  scope = "org",
  pagination,
}: {
  org: string;
  users: DirectoryRow[];
  /** Total rows in the CURRENT filter, across all pages — the footer's "N pessoas". */
  total: number;
  /** Whether a `?search=` term is active (changes the empty-state copy). */
  filtered: boolean;
  /** Which status pill is active, if any (also changes the empty-state copy). */
  statusFilter?: UserDirectoryStatusFilter | null;
  /** Which directory this is — the empty state says something different for each. */
  scope?: "org" | "hospital";
  /**
   * The pager, rendered into the table's footer. A slot rather than a prop bundle:
   * `UserPagination` is a Client Component and this one is not, so the page owns
   * the boundary and hands the finished element down.
   */
  pagination?: React.ReactNode;
}) {
  if (users.length === 0) {
    return <DirectoryEmptyState filtered={filtered} statusFilter={statusFilter} scope={scope} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Decoration: each cell below carries its own `sr-only` label, so announcing
          this strip too would double every row. */}
      <div
        aria-hidden="true"
        className={cn(
          "hidden border-b border-border bg-muted/55 px-4.5 py-2.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase",
          ROW_GRID,
        )}
      >
        <span>Pessoa</span>
        <span>Situação</span>
        <span>Vínculo hospitalar</span>
        <span>Comissões</span>
        <span>Registro</span>
        <span />
      </div>

      <ul>
        {users.map((user, index) => {
          const displayName = user.fullName?.trim() || user.email || "Sem identificação";
          const hospital = hospitalCell(user);
          return (
            <li
              key={user.id}
              className={cn(
                "animate-rise-in border-t border-border/60 first:border-t-0",
                user.status === "deactivated" ? "opacity-60" : null,
              )}
              style={{ ["--rise-delay" as string]: `${index * 40}ms` }}
            >
              <Link
                href={orgHref(org, "manage", "usuarios", user.id)}
                className={cn(
                  "relative flex flex-col gap-2.5 px-4.5 py-3 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:bg-accent/35 focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset focus-visible:outline-none",
                  ROW_GRID,
                )}
              >
                {/* Pessoa */}
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-8.5 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  >
                    {initialsOf(user.fullName, user.email)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {displayName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email ?? "Sem e-mail"}
                    </span>
                  </span>
                </span>

                {/* Below `lg` these four facts wrap into one row under the person;
                    at `lg` and up `contents` dissolves the wrapper so they become
                    grid cells 2–5. */}
                <span className="flex flex-wrap items-center gap-2 lg:contents">
                  {/* Situação */}
                  <span className="lg:justify-self-start">
                    <span className="sr-only">Situação: </span>
                    <UserStatusBadge status={user.status} />
                  </span>

                  {/* Vínculo hospitalar */}
                  <span className="min-w-0">
                    <span className="sr-only">Vínculo hospitalar: </span>
                    <span
                      className={cn(
                        "block truncate text-xs",
                        hospital.muted ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {hospital.text}
                    </span>
                  </span>

                  {/* Comissões */}
                  <span className="flex flex-wrap gap-1">
                    <span className="sr-only">Comissões: </span>
                    <CommitteeChips user={user} />
                  </span>

                  {/* Registro */}
                  <span className="min-w-0">
                    {user.councilRegistration ? (
                      <>
                        <span className="sr-only">Registro profissional: </span>
                        <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                          {user.councilRegistration}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="sr-only">
                          Registro profissional: sem registro
                        </span>
                        <span
                          aria-hidden="true"
                          className="block font-mono text-[0.7rem] text-muted-foreground"
                        >
                          —
                        </span>
                      </>
                    )}
                  </span>
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className="hidden size-4 text-muted-foreground lg:block"
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4.5 py-2.5 text-xs text-muted-foreground">
        <p className="tabular-nums">
          {total} {total === 1 ? "pessoa" : "pessoas"}
        </p>
        {pagination}
      </div>
    </div>
  );
}

/**
 * The Comissões cell. Zero committees is an EXPECTED state, not a data error — the
 * professional who has been hired but not yet seated on anything is exactly the
 * person their hospital's admin opened this directory to find. It gets a dashed
 * chip of its own, never a blank cell, and the "none" variant is carried by wording
 * plus a dashed outline together, never by colour alone.
 */
function CommitteeChips({ user }: { user: DirectoryRow }) {
  const committees = user.committees;

  if (committees === undefined) {
    // Pre-B7: only a count is available. Render the count rather than invent names.
    return user.committeeCount === 0 ? (
      <Chip variant="none">Sem comissão</Chip>
    ) : (
      <Chip variant="member">
        {user.committeeCount === 1
          ? "1 comissão"
          : `${user.committeeCount} comissões`}
      </Chip>
    );
  }

  if (committees.length === 0) return <Chip variant="none">Sem comissão</Chip>;

  return (
    <>
      {committees.map((c) => (
        <Chip
          key={c.commissionId}
          variant={c.role === "staff_admin" ? "coordinator" : "member"}
        >
          {`${c.commissionName} · ${ROLE_LABEL[c.role]}`}
        </Chip>
      ))}
    </>
  );
}

const CHIP_VARIANT = {
  coordinator: "border-transparent bg-accent text-accent-foreground",
  member: "border-transparent bg-muted text-muted-foreground",
  none: "border-dashed border-border text-muted-foreground",
} as const;

function Chip({
  variant,
  children,
}: {
  variant: keyof typeof CHIP_VARIANT;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
        CHIP_VARIANT[variant],
      )}
    >
      {children}
    </span>
  );
}

/**
 * ⛔ An empty list NEVER means "you lack permission". `list_org_people` and the
 * RLS-scoped reads both return nothing rather than raising — deliberately, so a
 * probe cannot distinguish the two — which is exactly why this copy has to say
 * "none found" and offer the way forward.
 */
function DirectoryEmptyState({
  filtered,
  statusFilter,
  scope,
}: {
  filtered: boolean;
  statusFilter: UserDirectoryStatusFilter | null;
  scope: "org" | "hospital";
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
      <UserRoundX aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        {emptyCopy(filtered, statusFilter, scope)}
      </p>
    </div>
  );
}

/** Per-filter empty copy. A status pill with no matches must not read as "no users at all". */
const STATUS_EMPTY_COPY: Record<UserDirectoryStatusFilter, string> = {
  active: "Ninguém com a conta ativa no momento.",
  attention:
    "Ninguém precisa de atenção no momento — nenhuma conta suspensa nem convite pendente.",
  deactivated: "Nenhuma conta desativada.",
};

function emptyCopy(
  filtered: boolean,
  statusFilter: UserDirectoryStatusFilter | null,
  scope: "org" | "hospital",
): string {
  if (filtered && statusFilter) {
    return `Nenhum usuário encontrado para essa busca em “${STATUS_FILTER_LABEL[statusFilter]}”.`;
  }
  if (filtered) return "Nenhum usuário encontrado para essa busca.";
  if (statusFilter) return STATUS_EMPTY_COPY[statusFilter];
  return scope === "hospital"
    ? "Ninguém vinculado a este hospital ainda. Use “Registrar pessoa” para vincular ou cadastrar alguém."
    : "Nenhum usuário registrado ainda. Use “Registrar pessoa” para começar.";
}
