import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The user directory's status filter pills (AFF2 F1, handoff §Screen 1).
 *
 * ⚠ SERVER COMPONENT, and deliberately so. The design reference draws these as
 * `<button onClick>`, which would force a client component for something that is
 * purely "navigate to the same page with one more search param". As `<Link>`s they
 * ship zero JS, are natively keyboard- and middle-clickable, survive a hard reload,
 * and get a real `aria-current` instead of a colour change.
 *
 * ⛔ COUNTS ARE NOT DERIVED HERE, AND NOT IN THE PAGE EITHER. They come from the
 * UNFILTERED scoped set, which only the query can see (backend task B7). Deriving
 * them frontend-side would mean either a second copy of `deriveUserStatus` or an
 * unpaged read — a parallel derivation and a broken pager respectively. While
 * `counts` is absent each pill renders its label alone: a fabricated "· 0" is a
 * false measurement, which is worse than a missing one.
 */

/**
 * F1 INTERIM — backend task **B7** exports the canonical union from
 * `src/lib/users/types.ts` and owns the `?status=` parse. Values are English to
 * match the `?status=` precedent already set by `ReferralStatus` / `EventStatus`
 * (`/o/[org]/nsp`), and CLAUDE.md §8's "code in English".
 *
 * ⛔ `attention` is NOT a `UserStatus`. It is the composite suspended ∪ pending,
 * which is why this union cannot simply reuse `UserStatus`.
 *
 * Swap the declaration for an import once B7 lands — one line, no other change.
 */
export type UserDirectoryStatusFilter = "active" | "attention" | "deactivated";

/** Pill counts over the unfiltered scoped set (B7). */
export interface UserDirectoryStatusCounts {
  all: number;
  active: number;
  attention: number;
  deactivated: number;
}

/** Narrow an untrusted `?status=` value; anything else means "no filter". */
export function parseStatusFilter(
  raw: string | undefined,
): UserDirectoryStatusFilter | null {
  return raw === "active" || raw === "attention" || raw === "deactivated"
    ? raw
    : null;
}

/** pt-BR labels, also used by the directory's empty state. */
export const STATUS_FILTER_LABEL: Record<UserDirectoryStatusFilter, string> = {
  active: "Ativos",
  attention: "Atenção",
  deactivated: "Desativados",
};

const PILLS: {
  id: UserDirectoryStatusFilter | null;
  label: string;
  countKey: keyof UserDirectoryStatusCounts;
}[] = [
  { id: null, label: "Todos", countKey: "all" },
  { id: "active", label: STATUS_FILTER_LABEL.active, countKey: "active" },
  { id: "attention", label: STATUS_FILTER_LABEL.attention, countKey: "attention" },
  {
    id: "deactivated",
    label: STATUS_FILTER_LABEL.deactivated,
    countKey: "deactivated",
  },
];

export function UserDirectoryStatusPills({
  basePath,
  searchParams,
  current,
  counts,
}: {
  /** The directory's own path, e.g. `orgHref(org, "manage", "usuarios")`. */
  basePath: string;
  /**
   * The page's current search params. Every one of them is carried across a pill
   * click except `status` (the pill sets it) and `page` (a new filter always starts
   * at page 1) — so `?search=` and `?hospital=` survive, and so will anything a
   * later slice adds without touching this component.
   */
  searchParams: Record<string, string | undefined>;
  current: UserDirectoryStatusFilter | null;
  counts?: UserDirectoryStatusCounts;
}) {
  function hrefFor(id: UserDirectoryStatusFilter | null): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "status" && key !== "page") params.set(key, value);
    }
    if (id) params.set("status", id);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
      {PILLS.map((pill) => {
        const isActive = pill.id === current;
        const count = counts?.[pill.countKey];
        return (
          <Link
            key={pill.id ?? "all"}
            href={hrefFor(pill.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span>{pill.label}</span>
            {count === undefined ? null : (
              <>
                <span aria-hidden="true" className="mx-1.5 opacity-60">
                  ·
                </span>
                <span className="tabular-nums">{count}</span>
                <span className="sr-only">
                  {count === 1 ? " pessoa" : " pessoas"}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
