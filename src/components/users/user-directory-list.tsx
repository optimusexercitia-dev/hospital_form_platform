import Link from "next/link";
import { ChevronRight, UserRoundX } from "lucide-react";

import type {
  AffiliationStatus,
  OrgUserListItem,
  UserDirectoryStatusFilter,
} from "@/lib/users/types";
import { orgHref } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { AffiliationStatusBadge } from "@/components/users/affiliation-status-badge";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { PersonAvatar } from "@/components/users/person-avatar";
import { STATUS_FILTER_LABEL } from "@/components/users/user-directory-status-pills";

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

/** The "Vínculo hospitalar" cell's text, and whether it is the muted "none" variant. */
function hospitalCell(user: OrgUserListItem): { text: string; muted: boolean } {
  const names = user.hospitalNames;
  if (names.length === 0) return { text: "Sem vínculo hospitalar", muted: true };
  if (names.length === 1) return { text: names[0]!, muted: false };
  // ⛔ COUNTED FROM THE ARRAY, never from a joined string: a hospital name may contain
  // a comma, and splitting one back apart silently inflates the count.
  return { text: `${names.length} hospitais`, muted: false };
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
  users: OrgUserListItem[];
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
                  <PersonAvatar fullName={user.fullName} email={user.email} />
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {/* ⛔ `truncate text-sm font-semibold` IS A CONTRACT, not styling
                          preference: `e2e/aff2-directory.spec.ts:116` selects this node by
                          exactly those three classes. The flex parent was added around it
                          rather than onto it precisely so that locator keeps resolving —
                          this repo has a recorded incident of a restyle silently
                          re-scoping E2E locators. `block` became redundant under the flex
                          parent and is the only class dropped. */}
                      <span className="truncate text-sm font-semibold">
                        {displayName}
                      </span>
                      <OrgTenseChip status={user.orgAffiliationStatus} />
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
 * The person's ORG-affiliation tense (AFF4 F6; ADR 0151 D10 / ADR 0154) — the other half
 * of the "incluir desligados" toggle.
 *
 * ⛔ RENDERED ONLY FOR `encerrado`, AND THAT IS NOT THE BANNED EMPTY CELL. The default
 * roster is active-only, so with the toggle OFF this never renders and adds no noise; the
 * chip exists to mark exactly the rows the toggle brought in. It also is not a cell of its
 * own — it sits INSIDE the Pessoa cell, which always carries the name and the e-mail — so
 * there is no column that can read as blank-therefore-forbidden.
 *
 * ⛔ NOT A SECOND BADGE IN "Situação". That column holds the ACCOUNT lifecycle and is 96px
 * wide. Two pills there would both be able to read "Ativo" while meaning different things
 * — an account that works versus an employment that is current — which is worse than
 * either alone. The `sr-only` prefix below is what keeps the two apart for a screen-reader
 * user, who hears them in sequence down the row.
 *
 * ⛔ `null` IS A FINDING, NOT A STATE. `listOrgUsers` cannot produce one (its roster
 * predicate IS the org affiliation) and `listHospitalUsers` always does (it never reads
 * `organization_affiliations`). So this renders nothing for `null` — deliberately
 * indistinguishable from `ativo`, because on the hospital directory that is the honest
 * answer: not "they are current", but "this surface cannot know". Do NOT add a
 * "desconhecido" rendering; it would put a scope limitation in front of users as if it
 * were a fact about the person.
 *
 * ⚠ VOCABULARY: the badge says *Encerrado* (the affiliation's tense), while the toggle
 * says *"Incluir desligados"* (the offboarding ACTION's participle). Both are the
 * established pt-BR of this codebase — `org-offboarding-wizard.tsx` uses "Desligar da
 * organização" for the action and "o vínculo … foi encerrado" for the resulting state —
 * and the shared `AffiliationStatusBadge` is reused rather than forked so the three tenses
 * read identically here and on the per-user panel.
 */
function OrgTenseChip({ status }: { status: AffiliationStatus | null }) {
  if (status !== "encerrado") return null;
  return (
    <span className="shrink-0">
      <span className="sr-only">Vínculo com a organização: </span>
      <AffiliationStatusBadge status={status} />
    </span>
  );
}

/**
 * The Comissões cell. Zero committees is an EXPECTED state, not a data error — the
 * professional who has been hired but not yet seated on anything is exactly the
 * person their hospital's admin opened this directory to find. It gets a dashed
 * chip of its own, never a blank cell, and the "none" variant is carried by wording
 * plus a dashed outline together, never by colour alone.
 */
function CommitteeChips({ user }: { user: OrgUserListItem }) {
  if (user.committees.length === 0) return <Chip variant="none">Sem comissão</Chip>;

  return (
    <>
      {user.committees.map((c) => (
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
