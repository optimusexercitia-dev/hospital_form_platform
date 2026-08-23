"use client";

import { useId, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * URL-driven search box for the user directory (`?search=`), mirroring the audit
 * filter bar's URL pattern: submitting resets `?page=` to 1 (via omission) so a new
 * term always starts at the first page, while `?status=` and `?hospital=` are
 * preserved — searching *within* a status pill is the point of having both.
 *
 * ⛔ NO `name` ON THE INPUT, and that is deliberate rather than an oversight. This
 * form is `useState`-controlled and navigates via `router.push` with an explicit
 * `params.set("search", …)`; it never builds a `FormData` and nothing reads it by
 * name. Per `useFieldIds`' closed union the three reasons to emit a `name` are
 * `formData` / `radioGroup` / `autofill`, and none applies — so the hook's inverted
 * default (omit) is correct here. A needless `name` looks deliberate forever once
 * added; this comment exists so nobody "fixes" its absence.
 *
 * ⚠ THE LABEL SAYS ONLY WHAT THE QUERY ACTUALLY SEARCHES. `listOrgUsers` /
 * `listHospitalUsers` build `full_name.ilike ∨ email.ilike` and nothing else — the
 * previous "…ou categoria" wording promised a category match that was never
 * implemented (the module's own doc comment carried the same claim). The design
 * handoff's "…ou registro…" would over-promise the same way until a
 * `professional_credentials` join-filter exists; that is deferred, so the copy
 * stays honest. PO-ruled 2026-08-23.
 */
export function UserDirectorySearch({
  initialSearch,
}: {
  initialSearch: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputId = useId();
  const [value, setValue] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();
    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Buscar usuários"
      className="flex flex-1 gap-2 sm:flex-none"
    >
      <div className="relative flex-1 sm:w-[250px] sm:flex-none">
        {/* A real <label>, visually hidden — the toolbar has no room for a visible
            one, and an `aria-label` is a weaker substitute for an actual label
            element. */}
        <label htmlFor={inputId} className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="pl-9.5"
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Buscando…" : "Buscar"}
      </Button>
    </form>
  );
}
