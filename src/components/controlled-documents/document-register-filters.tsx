"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The status filter chips (ADR 0081 F-A). `all` clears the `view` param. */
const VIEW_CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "awaiting", label: "Aguardando aprovação" },
  { key: "effective", label: "Vigentes" },
  { key: "draft", label: "Rascunhos" },
  { key: "revision", label: "Em revisão" },
  { key: "archived", label: "Arquivados" },
];

/**
 * Register filters (Phase 17 v2, F-A): status chips + a title/code search box + a
 * free-text category combobox (autocomplete from existing values, ADR 0081 O1).
 * All URL-driven (`?view=&q=&category=`) so the Server Component re-renders and
 * re-filters. Search + category are debounced (300 ms); chips apply immediately.
 * Every control is labelled and keyboard-operable.
 */
export function DocumentRegisterFilters({
  view,
  q,
  category,
  categories,
}: {
  view: string;
  q: string;
  category: string;
  /** Distinct category values in the register, for the datalist autocomplete. */
  categories: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [qDraft, setQDraft] = useState(q);
  const [catDraft, setCatDraft] = useState(category);
  const searchId = useId();
  const catId = useId();
  const listId = useId();

  function replaceWith(next: URLSearchParams) {
    if (next.toString() === searchParams.toString()) return;
    startTransition(() => {
      router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, {
        scroll: false,
      });
    });
  }

  function setView(key: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (key === "all") next.delete("view");
    else next.set("view", key);
    replaceWith(next);
  }

  // Debounce the free-text inputs into the URL (title/code + category).
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmedQ = qDraft.trim();
      const trimmedCat = catDraft.trim();
      if (trimmedQ) next.set("q", trimmedQ);
      else next.delete("q");
      if (trimmedCat) next.set("category", trimmedCat);
      else next.delete("category");
      replaceWith(next);
    }, 300);
    return () => clearTimeout(handle);
    // replaceWith is derived from the same closure values; listing the primitives
    // it reads keeps this exhaustive without re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDraft, catDraft, searchParams, pathname, router]);

  const activeView = view || "all";
  const hasTextFilter = qDraft.trim() !== "" || catDraft.trim() !== "";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-opacity",
        isPending && "opacity-60",
      )}
      aria-busy={isPending}
    >
      <div
        role="group"
        aria-label="Filtrar por situação"
        className="flex flex-wrap gap-2"
      >
        {VIEW_CHIPS.map((chip) => {
          const active = chip.key === activeView;
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => setView(chip.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={searchId}>Buscar</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Título ou código do documento"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor={catId}>Categoria</Label>
          <Input
            id={catId}
            list={listId}
            value={catDraft}
            onChange={(e) => setCatDraft(e.target.value)}
            placeholder="Todas as categorias"
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {hasTextFilter ? (
          <button
            type="button"
            onClick={() => {
              setQDraft("");
              setCatDraft("");
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:self-end"
          >
            <X aria-hidden="true" className="size-4" />
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}
