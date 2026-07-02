"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * URL-driven search box for the user directory (`?search=`), mirroring the
 * audit filter bar's URL pattern: submitting resets `?page=` to 1 (via
 * omission) so a new filter always starts at the first page.
 */
export function UserDirectorySearch({
  initialSearch,
}: {
  initialSearch: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
      className="flex gap-2"
    >
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar por nome, e-mail ou categoria…"
          aria-label="Buscar por nome, e-mail ou categoria"
          className="pl-9.5"
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Buscando…" : "Buscar"}
      </Button>
    </form>
  );
}
