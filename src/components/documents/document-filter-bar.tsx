"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import type { DocStatus, DocType } from "@/lib/documents/types";
import { DOC_STATUS_LABELS, DOC_TYPE_LABELS } from "@/lib/documents/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const DOC_TYPES: DocType[] = [
  "politica",
  "pop",
  "protocolo",
  "regimento",
  "manual",
  "outro",
];
const DOC_STATUSES: DocStatus[] = [
  "draft",
  "in_approval",
  "effective",
  "obsolete",
];

/**
 * Register filters (Phase 17, F1): document type, lifecycle status, and a
 * "revisão vencida" toggle. All URL-driven (`?docType=&status=&reviewOverdue=`)
 * so the Server Component page re-queries — no client data fetching. Every
 * control has an associated label and the project focus ring, so the whole bar
 * is keyboard-operable (mirrors `SubmissionsFilters`).
 */
export function DocumentFilterBar({
  docType,
  status,
  reviewOverdue,
}: {
  docType: DocType | null;
  status: DocStatus | null;
  reviewOverdue: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeId = useId();
  const statusId = useId();
  const overdueId = useId();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasAnyFilter = Boolean(docType || status || reviewOverdue);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs transition-opacity duration-200",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={typeId}>Tipo</Label>
          <NativeSelect
            id={typeId}
            value={docType ?? ""}
            onChange={(e) => setParam("docType", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todos os tipos</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={statusId}>Situação</Label>
          <NativeSelect
            id={statusId}
            value={status ?? ""}
            onChange={(e) => setParam("status", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todas as situações</option>
            {DOC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DOC_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id={overdueId}
            checked={reviewOverdue}
            onCheckedChange={(checked) =>
              setParam("reviewOverdue", checked === true ? "1" : "")
            }
            disabled={isPending}
          />
          <Label htmlFor={overdueId} className="cursor-pointer font-normal">
            Somente com revisão vencida
          </Label>
        </div>

        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={isPending}
          >
            <X aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
