"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Department } from "@/lib/hospitals/departments";
import {
  createDepartment,
  renameDepartment,
  type DepartmentActionState,
} from "@/lib/hospitals/actions";
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
 * Create / rename a hospital department ("Unidade / setor") — a single `name`
 * field, mirroring {@link TitleDefDialog}'s create/edit shape. Fully
 * keyboard-operable: tab order is name field → Cancelar → submit, both buttons
 * are real `<button>`s, and the dialog traps focus (Radix `Dialog`). Errors are
 * surfaced in pt-BR (duplicate name, forbidden, blank) — never a raw Postgres
 * error.
 */
export function DepartmentDefDialog({
  mode,
  open,
  onOpenChange,
  hospitalId,
  department,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalId: string;
  /** Required for `edit`. */
  department?: Department;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<DepartmentActionState | null>(null);
  const [name, setName] = useState(department?.name ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setName(department?.name ?? "");
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
          ? await createDepartment(hospitalId, trimmed)
          : await renameDepartment(department!.id, trimmed);
      setState(next);
    });
  }

  const fieldError = state && !state.ok ? state.fieldErrors?.name : undefined;
  const bannerError =
    state && !state.ok && !state.fieldErrors?.name ? state.error : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo setor" : "Renomear setor"}
          </DialogTitle>
          <DialogDescription>
            Os setores (unidades) deste hospital ficam disponíveis ao criar um
            caso. São apenas organizacionais e não contêm dados de paciente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {bannerError && <FormBanner tone="error">{bannerError}</FormBanner>}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className={FIELD_CLASS}
              placeholder="Ex.: UTI Adulto"
              aria-invalid={fieldError ? true : undefined}
            />
            {fieldError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {fieldError}
              </span>
            )}
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
                  ? "Criar setor"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
