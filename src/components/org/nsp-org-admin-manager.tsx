"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, UserCog } from "lucide-react";

import type { PqsEligibleUser } from "@/lib/pqs/roster-types";
import type { RoleHolder } from "@/lib/queries/org";
import { assignNspOrgAdmin, revokeNspOrgAdmin } from "@/lib/org/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { initials, formatGrantedAt } from "@/components/org/format";

function personLabel(p: { fullName: string | null; email: string | null }): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The org_admin's `nsp_org_admin` appointment surface (ADR 0051 Decision 4) —
 * a roster of current holders, plus a "Nomear administração do NSP" dialog
 * holding the person picker. Mirrors {@link HospitalAdminManager}'s shape.
 * Current holders come from the reconciled `listNspOrgAdmins(orgId)` read (A9).
 */
export function NspOrgAdminManager({
  orgId,
  eligibleUsers,
  currentAdmins = [],
}: {
  orgId: string;
  eligibleUsers: PqsEligibleUser[];
  /** Current `nsp_org_admin`s of this org (from `listNspOrgAdmins`). */
  currentAdmins?: RoleHolder[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h3 className="text-sm font-medium text-muted-foreground">
            Administração atual
          </h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {currentAdmins.length}
          </span>
        </div>
        <AssignNspOrgAdminDialog
          orgId={orgId}
          eligibleUsers={eligibleUsers}
          currentAdmins={currentAdmins}
        />
      </div>

      {currentAdmins.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          Nenhuma administração do NSP nomeada. Nomeie alguém com o botão
          acima.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {currentAdmins.map((person) => {
            const label = personLabel(person);
            return (
              <li
                key={person.userId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                  >
                    {initials(label)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                        Administração do NSP
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email ? `${person.email} · ` : ""}
                      desde {formatGrantedAt(person.grantedAt)}
                    </p>
                  </div>
                </div>
                <RevokeButton orgId={orgId} userId={person.userId} label={label} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The "Nomear administração do NSP" trigger + dialog holding the person picker. */
function AssignNspOrgAdminDialog({
  orgId,
  eligibleUsers,
  currentAdmins,
}: {
  orgId: string;
  eligibleUsers: PqsEligibleUser[];
  currentAdmins: RoleHolder[];
}) {
  const router = useRouter();
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentIds = useMemo(
    () => new Set(currentAdmins.map((c) => c.userId)),
    [currentAdmins],
  );
  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !currentIds.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, currentIds],
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setSelected("");
    }
  }

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await assignNspOrgAdmin(orgId, selected);
      if (!result.ok) {
        setError(
          result.error ?? "Não foi possível nomear a administração do NSP.",
        );
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus aria-hidden="true" />
          Nomear administração do NSP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={handleAppoint}
          className="flex flex-col gap-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <UserCog aria-hidden="true" className="size-4 text-primary" />
              Nomear administração do NSP
            </DialogTitle>
            <DialogDescription>
              A administração do NSP da organização nomeia coordenadores em
              qualquer hospital, mas não lê dados de segurança do paciente
              nesta fase.
            </DialogDescription>
          </DialogHeader>

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium">
              Pessoa da organização
            </label>
            <NativeSelect
              id={selectId}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={isPending || candidates.length === 0}
            >
              <option value="">
                {candidates.length === 0
                  ? "Nenhuma pessoa disponível"
                  : "Selecione uma pessoa…"}
              </option>
              {candidates.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {personLabel(u)}
                  {u.fullName?.trim() && u.email ? ` · ${u.email}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !selected}>
              {isPending ? "Nomeando…" : "Nomear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({
  orgId,
  userId,
  label,
}: {
  orgId: string;
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeNspOrgAdmin(orgId, userId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remover ${label} da administração do NSP`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remover da administração do NSP?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {label} deixará de administrar o NSP da organização. Esta ação
            pode ser refeita nomeando a pessoa novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}

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
            onClick={handleRevoke}
          >
            {isPending ? "Removendo…" : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
