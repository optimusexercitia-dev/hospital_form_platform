"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CommissionMeetingType } from "@/lib/queries/meetings";
import {
  createMeetingType,
  renameMeetingType,
  type ActionState,
  type CreateMeetingTypeState,
} from "@/lib/meetings/actions";
import type { CaseStatusColorToken } from "@/lib/cases/case-status";
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
import { ColorTokenPicker } from "@/components/cases/color-token-picker";
import { MeetingTypeChip } from "./meeting-badges";

/** The 7 palette tokens the picker offers; the stored token is coerced into this set. */
const PALETTE_TOKENS: readonly CaseStatusColorToken[] = [
  "slate",
  "blue",
  "amber",
  "green",
  "red",
  "violet",
  "muted",
];

/** Coerce a stored (free-string) colour token to one the palette picker accepts. */
function toPaletteToken(token: string | null | undefined): CaseStatusColorToken {
  return PALETTE_TOKENS.includes(token as CaseStatusColorToken)
    ? (token as CaseStatusColorToken)
    : "slate";
}

/**
 * Create / rename + recolour a meeting type (F5). Mirrors the cases
 * `TagDefDialog`: arg-based actions run inside a transition, errors stay on
 * screen, and the route refreshes on success. A live chip previews name + colour.
 * staff_admin only (the server re-enforces).
 */
export function MeetingTypeDefDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  type,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  type?: CommissionMeetingType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<
    (CreateMeetingTypeState & ActionState) | null
  >(null);

  const [name, setName] = useState(type?.name ?? "");
  const [colorToken, setColorToken] = useState<CaseStatusColorToken>(
    toPaletteToken(type?.colorToken),
  );

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setName(type?.name ?? "");
      setColorToken(toPaletteToken(type?.colorToken));
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
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createMeetingType(commissionId, trimmed, colorToken)
          : await renameMeetingType(type!.id, trimmed, colorToken);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo tipo de reunião" : "Editar tipo de reunião"}
          </DialogTitle>
          <DialogDescription>
            Use tipos para categorizar as reuniões em relatórios e tendências.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.name && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Ex.: Ordinária"
              aria-invalid={state?.fieldErrors?.name ? true : undefined}
            />
            {state?.fieldErrors?.name && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.name}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Cor</span>
            <ColorTokenPicker value={colorToken} onChange={setColorToken} />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Pré-visualização</span>
            <MeetingTypeChip
              name={name.trim() || "Sem nome"}
              colorToken={colorToken}
              className="w-fit"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Criar tipo"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
