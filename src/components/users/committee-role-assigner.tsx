"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users2 } from "lucide-react";

import type { CommitteeAssignmentInput } from "@/lib/users/actions";
import { assignCommitteeRole, removeCommittee } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** A committee option for the picker (the org's commissions). */
export interface CommitteeOption {
  id: string;
  name: string;
}

/** One row shown in the current-assignments list (committee + role, labeled). */
export interface CommitteeAssignmentRow {
  commissionId: string;
  commissionName: string;
  role: "staff" | "staff_admin";
}

const ROLE_LABEL: Record<"staff" | "staff_admin", string> = {
  staff: "Membro",
  staff_admin: "Coordenação",
};

/**
 * Shared committee + role assignment control (plan Q8), used by BOTH the
 * register-user form (FE-2, `mode="collect"`) and the per-user management page
 * (FE-3, `mode="live"`).
 *
 * - `collect` mode: no `userId` yet (the user doesn't exist). Rows are held in
 *   local state and bubbled up via `onChange` as `CommitteeAssignmentInput[]`
 *   for the parent create-form to submit as part of `RegisterUserInput`.
 * - `live` mode: `userId` is required. Each add/remove calls
 *   `assignCommitteeRole`/`removeCommittee` directly (typed DTOs, not
 *   `useActionState`-shaped — the contract-first stubs export plain async
 *   functions) via `useTransition`, mirroring `NspCoordinatorManager`. On
 *   success we `router.refresh()` so the server-loaded roster stays the
 *   source of truth.
 *
 * A committee already assigned is removed from the picker (one row per
 * committee — re-adding an already-assigned committee changes its role
 * instead, matching `assignCommitteeRole`'s "idempotent on the membership PK"
 * contract).
 */
export function CommitteeRoleAssigner({
  mode,
  userId,
  commissions,
  assignments,
  onChange,
}: {
  mode: "collect" | "live";
  /** Required when `mode === "live"`. */
  userId?: string;
  commissions: CommitteeOption[];
  assignments: CommitteeAssignmentRow[];
  /** Called with the full updated list; only meaningful in `collect` mode. */
  onChange?: (next: CommitteeAssignmentRow[]) => void;
}) {
  const router = useRouter();
  const committeeSelectId = useId();
  const roleSelectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selectedCommittee, setSelectedCommittee] = useState("");
  const [selectedRole, setSelectedRole] = useState<"staff" | "staff_admin">(
    "staff",
  );
  const [error, setError] = useState<string | null>(null);

  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.commissionId)),
    [assignments],
  );
  const candidates = useMemo(
    () =>
      commissions
        .filter((c) => !assignedIds.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [commissions, assignedIds],
  );

  function commitAdd(commissionId: string, role: "staff" | "staff_admin") {
    const commission = commissions.find((c) => c.id === commissionId);
    if (!commission) return;

    if (mode === "collect") {
      onChange?.([
        ...assignments,
        { commissionId, commissionName: commission.name, role },
      ]);
      setSelectedCommittee("");
      setSelectedRole("staff");
      return;
    }

    if (!userId) return;
    setError(null);
    const input: CommitteeAssignmentInput = { commissionId, role };
    startTransition(async () => {
      const result = await assignCommitteeRole(userId, input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível atribuir a comissão.");
        return;
      }
      setSelectedCommittee("");
      setSelectedRole("staff");
      router.refresh();
    });
  }

  function commitRemove(commissionId: string) {
    if (mode === "collect") {
      onChange?.(assignments.filter((a) => a.commissionId !== commissionId));
      return;
    }
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const result = await removeCommittee(userId, commissionId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover a comissão.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={committeeSelectId} className="text-sm font-medium">
            Comissão
          </label>
          <NativeSelect
            id={committeeSelectId}
            value={selectedCommittee}
            onChange={(e) => setSelectedCommittee(e.target.value)}
            disabled={isPending || candidates.length === 0}
          >
            <option value="">
              {candidates.length === 0
                ? "Nenhuma comissão disponível"
                : "Selecione uma comissão…"}
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={roleSelectId} className="text-sm font-medium">
            Papel
          </label>
          <NativeSelect
            id={roleSelectId}
            value={selectedRole}
            onChange={(e) =>
              setSelectedRole(e.target.value as "staff" | "staff_admin")
            }
            disabled={isPending}
            className="sm:w-44"
          >
            <option value="staff">Membro</option>
            <option value="staff_admin">Coordenação</option>
          </NativeSelect>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={isPending || !selectedCommittee}
          onClick={() => commitAdd(selectedCommittee, selectedRole)}
          className="shrink-0"
        >
          {isPending ? "Adicionando…" : "Adicionar comissão"}
        </Button>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Users2 aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Comissões atribuídas
          </h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {assignments.length}
          </span>
        </div>

        {assignments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
            Nenhuma comissão atribuída ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {assignments.map((a) => (
              <li
                key={a.commissionId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {a.commissionName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABEL[a.role]}
                  </p>
                </div>
                {mode === "collect" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remover ${a.commissionName}`}
                    onClick={() => commitRemove(a.commissionId)}
                  >
                    Remover
                  </Button>
                ) : (
                  <ConfirmRemoveButtonLive
                    isPending={isPending}
                    label={a.commissionName}
                    onConfirm={() => commitRemove(a.commissionId)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Guarded remove confirm for `live` mode. `ConfirmRemoveButton` (admin/) is
 * wired to a `useActionState`-shaped action; here the action is a direct typed
 * call driven by this control's own `useTransition`, so a small local variant
 * reuses the same AlertDialog shell instead.
 */
function ConfirmRemoveButtonLive({
  isPending,
  label,
  onConfirm,
}: {
  isPending: boolean;
  label: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <RemoveDialog
      open={open}
      onOpenChange={setOpen}
      isPending={isPending}
      title="Remover comissão?"
      description={`A pessoa deixará de participar de "${label}". A atribuição pode ser refeita depois.`}
      triggerLabel="Remover"
      triggerAriaLabel={`Remover ${label}`}
      onConfirm={() => {
        onConfirm();
      }}
    />
  );
}

/**
 * Local minimal AlertDialog wrapper — a one-off variant of
 * `ConfirmRemoveButton` (admin/) for direct-call typed actions instead of
 * `useActionState`-shaped ones, kept in this file since it's not reused
 * elsewhere.
 */
function RemoveDialog({
  open,
  onOpenChange,
  isPending,
  title,
  description,
  triggerLabel,
  triggerAriaLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  title: string;
  description: string;
  triggerLabel: string;
  triggerAriaLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={triggerAriaLabel}
        >
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {isPending ? "Removendo…" : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
