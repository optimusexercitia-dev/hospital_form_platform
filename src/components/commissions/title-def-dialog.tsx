"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Type from the client-safe canonical path; mutations from the `'use server'`
// actions module (`titles.ts` is now `server-only`).
import type { MemberTitle } from "@/lib/commissions/titles-types";
import {
  createMemberTitle,
  renameMemberTitle,
} from "@/lib/commissions/titles-actions";
import type { ActionState as MutationActionState } from "@/lib/safety/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / rename a committee member title (ADR 0051 Decision 6) — a single
 * `name` field, mirroring {@link ResultDefDialog}'s create/edit shape. Fully
 * keyboard-operable (the platform's designated keyboard-only flow candidate for
 * this phase): tab order is name field → Cancelar → submit, both buttons are
 * real `<button>`s, and the dialog traps focus (Radix `Dialog` primitive).
 */
export function TitleDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  title,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  title?: MemberTitle;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<MutationActionState | null>(null);
  const [name, setName] = useState(title?.name ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setName(title?.name ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const next =
        mode === "create"
          ? await createMemberTitle(commissionId, trimmed)
          : await renameMemberTitle(title!.id, trimmed);
      setState(next);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo título" : "Renomear título"}
          </DialogTitle>
          <DialogDescription>
            Títulos são apenas exibidos — Presidente, Vice-Presidente,
            Secretário(a) — e não concedem permissões adicionais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={FIELD_CLASS}
              placeholder="Ex.: Presidente"
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending || !name.trim()}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Criar título"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
