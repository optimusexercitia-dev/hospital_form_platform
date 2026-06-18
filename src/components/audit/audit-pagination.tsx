"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * F3 — audit-list pagination chrome, driven by {@link AuditPage}'s
 * `total`/`page`/`pageSize`. URL-driven (`?page=`) so the Server Component
 * re-queries; the prev/next buttons are real buttons with the project focus ring
 * and disable at the ends. An accessible summary ("Página 1 de 4 · 73 registros")
 * sits between them and is announced as a `status` region.
 */
export function AuditPagination({
  total,
  page,
  pageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, page), totalPages);

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(next));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Single page → nothing to paginate.
  if (totalPages <= 1) return null;

  const rangeStart = (current - 1) * pageSize + 1;
  const rangeEnd = Math.min(current * pageSize, total);

  return (
    <nav
      aria-label="Paginação dos registros de auditoria"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground tabular-nums" role="status">
        Página {current} de {totalPages}
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        {rangeStart}–{rangeEnd} de {total}{" "}
        {total === 1 ? "registro" : "registros"}
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => goTo(current - 1)}
          disabled={current <= 1}
        >
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => goTo(current + 1)}
          disabled={current >= totalPages}
        >
          Próxima
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
