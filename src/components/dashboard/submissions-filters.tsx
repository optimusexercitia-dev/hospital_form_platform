"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import type {
  SubmissionFilterForm,
  SubmissionFilterMember,
} from "@/lib/queries/submissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DatePicker } from "@/components/ui/date-picker";
import { usePendingFocus } from "@/components/ui/use-pending-focus";

/**
 * F4 — submissions-browser filters: member, form, date range, and the explicit
 * opt-in "incluir em andamento" toggle. All URL-driven (`?member=&form=&from=&
 * to=&inProgress=`) so the Server Component re-queries — no client data fetching.
 * Every control has an associated label and the project focus ring, so the whole
 * bar is keyboard-operable.
 *
 * The in_progress toggle only changes which rows are LISTED (metadata-only); it
 * never reveals another member's answers (enforced by the query + the row UI).
 */
export function SubmissionsFilters({
  members,
  forms,
  member,
  form,
  from,
  to,
  includeInProgress,
}: {
  members: SubmissionFilterMember[];
  forms: SubmissionFilterForm[];
  member: string | null;
  form: string | null;
  from: string | null;
  to: string | null;
  includeInProgress: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memberId = useId();
  const formId = useId();
  const fromId = useId();
  const toId = useId();
  const inProgressId = useId();
  const [isPending, startTransition] = useTransition();
  // FUP-0137-PERSIST-REFRESH-DROPS-FOCUS, same class as the patient-mode picker:
  // every control below is `disabled={isPending}` and every one of them starts that
  // transition itself, so narrowing by member dropped focus to `<body>` and a
  // keyboard user re-Tabbed the whole bar to reach the next filter. The docblock's
  // "the whole bar is keyboard-operable" was true of reaching the controls and false
  // of using two in a row.
  const parkFocus = usePendingFocus(isPending);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // Any filter change invalidates the keyset cursor (it encodes a position in
    // the OLD result set), so reset to the first page (WS-6 P3).
    next.delete("cursor");
    parkFocus();
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasAnyFilter = Boolean(
    member || form || from || to || includeInProgress,
  );

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
          <Label htmlFor={memberId}>Membro</Label>
          <NativeSelect
            id={memberId}
            value={member ?? ""}
            onChange={(e) => setParam("member", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todos os membros</option>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.name ?? "Membro removido"}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={formId}>Formulário</Label>
          <NativeSelect
            id={formId}
            value={form ?? ""}
            onChange={(e) => setParam("form", e.target.value)}
            disabled={isPending}
            className="min-w-44"
          >
            <option value="">Todos os formulários</option>
            {forms.map((f) => (
              <option key={f.formId} value={f.formId}>
                {f.title}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fromId}>De</Label>
          <DatePicker
            id={fromId}
            value={from ?? ""}
            onChange={(v) => setParam("from", v)}
            max={to ?? undefined}
            disabled={isPending}
            className="w-auto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={toId}>Até</Label>
          <DatePicker
            id={toId}
            value={to ?? ""}
            onChange={(v) => setParam("to", v)}
            min={from ?? undefined}
            disabled={isPending}
            className="w-auto"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2.5">
          <Checkbox
            id={inProgressId}
            checked={includeInProgress}
            onCheckedChange={(checked) =>
              setParam("inProgress", checked === true ? "1" : "")
            }
            disabled={isPending}
          />
          <Label htmlFor={inProgressId} className="cursor-pointer font-normal">
            Incluir respostas em andamento
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
