"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * User-directory pagination chrome (`?page=`), the same shape as
 * `AuditPagination` — kept as its own small component (not a shared import)
 * so the audit and user-directory features stay decoupled per file-ownership
 * boundaries, matching how `AuditPagination` itself is scoped to audit.
 */
export function UserPagination({
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

  if (totalPages <= 1) return null;

  const rangeStart = (current - 1) * pageSize + 1;
  const rangeEnd = Math.min(current * pageSize, total);

  return (
    <nav
      aria-label="Paginação de usuários"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground tabular-nums" role="status">
        Página {current} de {totalPages}
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        {rangeStart}–{rangeEnd} de {total}{" "}
        {total === 1 ? "usuário" : "usuários"}
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
