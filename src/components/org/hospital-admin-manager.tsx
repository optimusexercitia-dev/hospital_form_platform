"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserCog } from "lucide-react";

import type { HospitalRef } from "@/lib/queries/session";
import type { PqsEligibleUser } from "@/lib/pqs/roster-types";
import { assignHospitalAdmin, revokeHospitalAdmin } from "@/lib/org/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
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

function personLabel(p: { fullName: string | null; email: string | null }): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The org_admin's `hospital_admin` appointment manager (ADR 0051 Decisions 1/4).
 * Appoint picks BOTH a hospital and a person (a hospital_admin grant is per
 * hospital); revoke is scoped to one `(hospital, user)` pair. Mirrors
 * {@link NspCoordinatorManager}'s interaction shape, extended with the hospital
 * dimension.
 *
 * KNOWN GAP (flagged to the lead): there is no A0 read yet for "current
 * `hospital_admin`s of hospital X" — only the CALLER's own `hospitalAdminOf` is
 * exposed on the session, not the full per-hospital roster an org_admin needs
 * here. `currentAdminsByHospital` is typed to accept that roster the moment a
 * dedicated read lands (A4/A5); until then it defaults to empty and the
 * "administradores atuais" list reads as empty for every hospital, while
 * appoint/revoke already call the real actions.
 */
export function HospitalAdminManager({
  hospitals,
  eligibleUsers,
  currentAdminsByHospital = {},
}: {
  hospitals: HospitalRef[];
  eligibleUsers: PqsEligibleUser[];
  /** Map of hospitalId → its current hospital_admins. Empty until a dedicated
   * backend read lands (see the doc comment above). */
  currentAdminsByHospital?: Record<string, PqsEligibleUser[]>;
}) {
  const router = useRouter();
  const hospitalFieldId = useId();
  const personFieldId = useId();
  const [isPending, startTransition] = useTransition();
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentIdsForHospital = useMemo(() => {
    const set = new Set(
      (currentAdminsByHospital[selectedHospital] ?? []).map((c) => c.userId),
    );
    return set;
  }, [currentAdminsByHospital, selectedHospital]);

  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !currentIdsForHospital.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, currentIdsForHospital],
  );

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHospital || !selectedPerson) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await assignHospitalAdmin(selectedHospital, selectedPerson);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível nomear o administrador.");
        return;
      }
      setSuccess(result.message ?? "Administrador(a) de hospital nomeado(a).");
      setSelectedPerson("");
      router.refresh();
    });
  }

  const hospitalsWithAdmins = hospitals.filter(
    (h) => (currentAdminsByHospital[h.id] ?? []).length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleAppoint}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-base font-semibold">
            Nomear administrador(a) de hospital
          </h3>
        </div>

        {error && <FormBanner tone="error">{error}</FormBanner>}
        {success && <FormBanner tone="success">{success}</FormBanner>}

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
              disabled={isPending || !selectedHospital || candidates.length === 0}
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

        <p className="text-xs text-muted-foreground text-pretty">
          O(a) administrador(a) do hospital passa a gerenciar comissões,
          usuários e coordenação apenas dentro do hospital escolhido.
        </p>

        <Button
          type="submit"
          size="lg"
          className="self-start"
          disabled={isPending || !selectedHospital || !selectedPerson}
        >
          {isPending ? "Nomeando…" : "Nomear"}
        </Button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Administradores atuais
          </h3>
        </div>

        {hospitalsWithAdmins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
            Nenhum administrador de hospital nomeado ainda.
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
                    const showEmail = Boolean(
                      person.email && person.fullName?.trim(),
                    );
                    return (
                      <li
                        key={person.userId}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label}</p>
                          {showEmail ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {person.email}
                            </p>
                          ) : null}
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
    </div>
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
