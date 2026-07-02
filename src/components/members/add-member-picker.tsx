"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import { addStaff } from "@/lib/members/actions";
import type { AddableUser } from "@/lib/queries/members";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, useFieldIds } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormBanner } from "@/components/auth/form-banner";
import { cn } from "@/lib/utils";

/**
 * Add an ALREADY-REGISTERED user to the commission (staff). Replaces the old
 * invite-by-e-mail flow: coordinators may only add existing platform users, so
 * this is a searchable picker over the org's addable roster (`candidates` — active
 * org users not already members) wired to the `addStaff` server action via
 * `useActionState`. Brand-new people are registered by an org_admin, not here.
 *
 * Filtering is client-side over the pre-loaded roster; one user is selected then
 * submitted. On success the list revalidates and the selection clears.
 */
export function AddMemberPicker({
  commissionId,
  candidates,
}: {
  commissionId: string;
  candidates: AddableUser[];
}) {
  const [state, formAction, isPending] = useActionState(addStaff, undefined);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Clear the picker once per successful add — the React-sanctioned "adjust state
  // during render" pattern (no effect). Tracking the state object's identity (a
  // fresh object per submit) resets correctly on consecutive adds too. The form is
  // fully controlled, so clearing these two values is a complete reset.
  const [handled, setHandled] =
    useState<Awaited<ReturnType<typeof addStaff>>>();
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      setSelectedId(null);
      setQuery("");
    }
  }

  const searchIds = useFieldIds("add-member-search", {
    hasError: Boolean(state?.fieldErrors?.user),
    hasDescription: false,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (u) =>
        (u.fullName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const selected = candidates.find((u) => u.userId === selectedId) ?? null;

  if (candidates.length === 0) {
    return (
      <p className="max-w-prose text-sm text-muted-foreground text-pretty">
        Nenhuma pessoa cadastrada está disponível para adicionar. Novos usuários
        são cadastrados pela administração da organização.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="commissionId" value={commissionId} />
      <input type="hidden" name="userId" value={selectedId ?? ""} />

      {/* On success the action returns { ok: true, error: <pt-BR success
          message> } — prefer that authoritative copy, falling back to a default. */}
      {state?.ok ? (
        <FormBanner tone="success">
          {state.error ?? "Pessoa adicionada à comissão."}
        </FormBanner>
      ) : (
        <FormBanner tone="error">{state?.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={searchIds.controlProps.id}>
          Buscar pessoa
        </FieldLabel>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            {...searchIds.controlProps}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedId(null);
            }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Nome ou e-mail"
            className="pl-9"
          />
        </div>
        <FieldError id={searchIds.errorId}>
          {state?.fieldErrors?.user}
        </FieldError>
      </Field>

      <ul
        aria-label="Pessoas cadastradas disponíveis"
        className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border"
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Nenhum resultado para “{query.trim()}”.
          </li>
        ) : (
          filtered.map((u) => {
            const active = u.userId === selectedId;
            return (
              <li key={u.userId}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(active ? null : u.userId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none focus-visible:ring-inset",
                    active && "bg-accent/60",
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {u.fullName ?? u.email ?? "Usuário"}
                    </span>
                    {u.email && u.fullName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    )}
                  </span>
                  {active && (
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selected
            ? `Selecionado: ${selected.fullName ?? selected.email ?? "usuário"}`
            : "Selecione uma pessoa para adicionar."}
        </p>
        <Button type="submit" size="lg" disabled={isPending || !selectedId}>
          {isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}
