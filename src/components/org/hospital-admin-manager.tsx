"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, UserCog } from "lucide-react";

import type { HospitalRef } from "@/lib/queries/session";
import type { PqsEligibleUser } from "@/lib/pqs/roster-types";
import type { RoleHolder } from "@/lib/queries/org";
import { assignHospitalAdmin, revokeHospitalAdmin } from "@/lib/org/actions";
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
 * The org_admin's `hospital_admin` appointment surface (ADR 0051 Decisions
 * 1/4) — a roster of current holders grouped by hospital, plus a "Nomear
 * administrador(a)" dialog holding the hospital+person picker. Mirrors
 * {@link NspOrgAdminManager}'s shape, extended with the hospital dimension.
 * Current holders come from the batched `listHospitalAdminsForOrg` read (A3),
 * assembled by the page into a map.
 */
export function HospitalAdminManager({
  hospitals,
  eligibleUsers,
  currentAdminsByHospital = {},
}: {
  hospitals: HospitalRef[];
  eligibleUsers: PqsEligibleUser[];
  /** Map of hospitalId → its current hospital_admins (from `listHospitalAdminsForOrg`). */
  currentAdminsByHospital?: Record<string, RoleHolder[]>;
}) {
  const hospitalsWithAdmins = hospitals.filter(
    (h) => (currentAdminsByHospital[h.id] ?? []).length > 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h3 className="text-sm font-medium text-muted-foreground">
            Administradores atuais
          </h3>
        </div>
        <AssignHospitalAdminDialog
          hospitals={hospitals}
          eligibleUsers={eligibleUsers}
          currentAdminsByHospital={currentAdminsByHospital}
        />
      </div>

      {hospitalsWithAdmins.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
          Nenhum administrador de hospital nomeado ainda. Nomeie alguém com o
          botão acima.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {hospitalsWithAdmins.map((hospital) => (
            <div key={hospital.id} className="flex flex-col gap-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {hospital.name}
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {(currentAdminsByHospital[hospital.id] ?? []).map((person) => {
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
                            <p className="truncate text-sm font-medium">
                              {label}
                            </p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                              Administrador(a) de hospital
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.email ? `${person.email} · ` : ""}
                            desde {formatGrantedAt(person.grantedAt)}
                          </p>
                        </div>
                      </div>
                      <RevokeButton
                        hospitalId={hospital.id}
                        userId={person.userId}
                        label={label}
                        hospitalName={hospital.name}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The "Nomear administrador(a)" trigger + dialog holding the hospital+person picker. */
function AssignHospitalAdminDialog({
  hospitals,
  eligibleUsers,
  currentAdminsByHospital,
}: {
  hospitals: HospitalRef[];
  eligibleUsers: PqsEligibleUser[];
  currentAdminsByHospital: Record<string, RoleHolder[]>;
}) {
  const router = useRouter();
  const hospitalFieldId = useId();
  const personFieldId = useId();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentIdsForHospital = useMemo(() => {
    return new Set(
      (currentAdminsByHospital[selectedHospital] ?? []).map((c) => c.userId),
    );
  }, [currentAdminsByHospital, selectedHospital]);

  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !currentIdsForHospital.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, currentIdsForHospital],
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setSelectedHospital("");
      setSelectedPerson("");
    }
  }

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHospital || !selectedPerson) return;
    setError(null);
    startTransition(async () => {
      const result = await assignHospitalAdmin(selectedHospital, selectedPerson);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível nomear o administrador.");
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
          Nomear administrador(a)
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
              Nomear administrador(a) de hospital
            </DialogTitle>
            <DialogDescription>
              O(a) administrador(a) do hospital passa a gerenciar comissões,
              usuários e coordenação apenas dentro do hospital escolhido.
            </DialogDescription>
          </DialogHeader>

          {error && <FormBanner tone="error">{error}</FormBanner>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={hospitalFieldId} className="text-sm font-medium">
                Hospital
              </label>
              <NativeSelect
                id={hospitalFieldId}
                value={selectedHospital}
                onChange={(e) => {
                  setSelectedHospital(e.target.value);
                  setSelectedPerson("");
                }}
                disabled={isPending || hospitals.length === 0}
              >
                <option value="">
                  {hospitals.length === 0
                    ? "Nenhum hospital cadastrado"
                    : "Selecione um hospital…"}
                </option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={personFieldId} className="text-sm font-medium">
                Pessoa da organização
              </label>
              <NativeSelect
                id={personFieldId}
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                disabled={
                  isPending || !selectedHospital || candidates.length === 0
                }
              >
                <option value="">
                  {!selectedHospital
                    ? "Escolha um hospital primeiro"
                    : candidates.length === 0
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
            <Button
              type="submit"
              disabled={isPending || !selectedHospital || !selectedPerson}
            >
              {isPending ? "Nomeando…" : "Nomear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({
  hospitalId,
  userId,
  label,
  hospitalName,
}: {
  hospitalId: string;
  userId: string;
  label: string;
  hospitalName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeHospitalAdmin(hospitalId, userId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover o administrador.");
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
          aria-label={`Remover ${label} da administração de ${hospitalName}`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover administrador(a) de hospital?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} deixará de administrar {hospitalName}. Esta ação pode ser
            refeita nomeando a pessoa novamente.
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
