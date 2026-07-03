"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hospital, ShieldCheck, Users } from "lucide-react";

import type {
  PqsEligibleUser,
  PqsRosterMember,
} from "@/lib/pqs/roster-types";
import { addPqsMember, removePqsMember } from "@/lib/pqs/actions";
import {
  assignNspCoordinator,
  revokeNspCoordinator,
} from "@/lib/org/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/components/safety/format";

/** Best display label for a person: name, else email, else a neutral fallback. */
function personLabel(p: {
  fullName: string | null;
  email: string | null;
}): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/** The per-hospital data the org NSP-admin curates (staff identity only — PHI-free). */
export interface NspOrgHospitalCuration {
  hospitalId: string;
  hospitalName: string;
  coordinator: PqsEligibleUser | null;
  members: PqsRosterMember[];
  /** Everyone in the hospital eligible to be a coordinator or roster member. */
  eligibleUsers: PqsEligibleUser[];
}

/**
 * The org NSP-admin's per-hospital coordinator + roster curation card (NSP-per-
 * hospital, ADR 0052, decisions 3/12/13). One card per hospital: appoint/revoke the
 * hospital's `nsp_coordinator` (`assignNspCoordinator`/`revokeNspCoordinator`), and
 * add/remove roster members (`addPqsMember`/`removePqsMember`) — both curated org-
 * wide by the `nsp_org_admin`, who reads ZERO patient data.
 *
 * The pickers offer the hospital's eligible users (from
 * `listHospitalEligibleUsersForPqs`); every mutation runs in a transition and
 * `router.refresh()`es on success. All strings pt-BR; keyboard-operable (labeled
 * `<select>` + buttons + confirm dialogs, visible focus). PHI-FREE.
 */
export function NspOrgHospitalManager({
  hospital,
}: {
  hospital: NspOrgHospitalCuration;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
      <h3 className="inline-flex items-center gap-2 text-base font-semibold text-balance">
        <Hospital aria-hidden="true" className="size-4 text-muted-foreground" />
        {hospital.hospitalName}
      </h3>

      <CoordinatorSection
        hospitalId={hospital.hospitalId}
        coordinator={hospital.coordinator}
        eligibleUsers={hospital.eligibleUsers}
      />

      <RosterSection
        hospitalId={hospital.hospitalId}
        members={hospital.members}
        eligibleUsers={hospital.eligibleUsers}
      />
    </article>
  );
}

/** Appoint / revoke the hospital's single `nsp_coordinator`. */
function CoordinatorSection({
  hospitalId,
  coordinator,
  eligibleUsers,
}: {
  hospitalId: string;
  coordinator: PqsEligibleUser | null;
  eligibleUsers: PqsEligibleUser[];
}) {
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => u.userId !== coordinator?.userId)
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, coordinator],
  );

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await assignNspCoordinator(hospitalId, selected);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível nomear a coordenação.");
        return;
      }
      setSuccess(result.message ?? "Coordenação do NSP nomeada.");
      setSelected("");
      router.refresh();
    });
  }

  return (
    <section aria-label="Coordenação" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
        <h4 className="text-sm font-semibold">Coordenação do NSP</h4>
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {success && <FormBanner tone="success">{success}</FormBanner>}

      {coordinator ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {personLabel(coordinator)}
            </p>
            {coordinator.email && coordinator.fullName?.trim() ? (
              <p className="truncate text-xs text-muted-foreground">
                {coordinator.email}
              </p>
            ) : null}
          </div>
          <RevokeCoordinatorButton
            hospitalId={hospitalId}
            userId={coordinator.userId}
            label={personLabel(coordinator)}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4 text-center text-sm text-muted-foreground text-pretty">
          Este hospital ainda não tem coordenação do NSP. Nomeie alguém abaixo.
        </p>
      )}

      <form
        onSubmit={handleAppoint}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            {coordinator ? "Substituir coordenação" : "Nomear coordenação"}
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
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !selected}
          className="shrink-0"
        >
          {isPending ? "Nomeando…" : "Nomear"}
        </Button>
      </form>
    </section>
  );
}

function RevokeCoordinatorButton({
  hospitalId,
  userId,
  label,
}: {
  hospitalId: string;
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
      const result = await revokeNspCoordinator(hospitalId, userId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover a coordenação.");
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
          aria-label={`Remover ${label} da coordenação do NSP`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover da coordenação do NSP?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} deixará de coordenar o NSP deste hospital. Os membros já na
            equipe continuam com acesso; apenas a coordenação é afetada. Esta ação
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

/** Add / remove enrolled roster members of the hospital. */
function RosterSection({
  hospitalId,
  members,
  eligibleUsers,
}: {
  hospitalId: string;
  members: PqsRosterMember[];
  eligibleUsers: PqsEligibleUser[];
}) {
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const enrolledIds = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  );
  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !enrolledIds.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, enrolledIds],
  );

  function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addPqsMember(hospitalId, selected);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível adicionar à equipe.");
        return;
      }
      setSuccess(result.message ?? "Membro adicionado à equipe do NSP.");
      setSelected("");
      router.refresh();
    });
  }

  return (
    <section
      aria-label="Equipe"
      className="flex flex-col gap-3 border-t border-border pt-5"
    >
      <div className="flex items-center gap-2">
        <Users aria-hidden="true" className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Equipe do NSP</h4>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {members.length}
        </span>
      </div>

      {error && <FormBanner tone="error">{error}</FormBanner>}
      {success && <FormBanner tone="success">{success}</FormBanner>}

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4 text-center text-sm text-muted-foreground text-pretty">
          Nenhum membro na equipe deste hospital.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {members.map((person) => {
            const label = personLabel(person);
            const showEmail = Boolean(person.email && person.fullName?.trim());
            return (
              <li
                key={person.userId}
                className="flex items-center justify-between gap-3 bg-background/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{label}</p>
                  {showEmail ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email}
                    </p>
                  ) : null}
                  {person.addedAt ? (
                    <p className="text-xs text-muted-foreground/80 tabular-nums">
                      Na equipe desde {formatDate(person.addedAt)}
                    </p>
                  ) : null}
                </div>
                <RemoveMemberButton
                  hospitalId={hospitalId}
                  userId={person.userId}
                  label={label}
                />
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={handleEnroll}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            Adicionar à equipe
          </label>
          <NativeSelect
            id={selectId}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isPending || candidates.length === 0}
            aria-describedby={`${selectId}-help`}
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
          <p id={`${selectId}-help`} className="text-xs text-muted-foreground text-pretty">
            Quem entra na equipe passa a ler os dados sensíveis de segurança do
            paciente deste hospital. O acesso é registrado em trilha de auditoria.
          </p>
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !selected}
          className="shrink-0"
        >
          {isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </form>
    </section>
  );
}

function RemoveMemberButton({
  hospitalId,
  userId,
  label,
}: {
  hospitalId: string;
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removePqsMember(hospitalId, userId);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover da equipe.");
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
          aria-label={`Remover ${label} da equipe do NSP`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover da equipe do NSP?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} deixará de ter acesso aos dados de segurança do paciente deste
            hospital. Esta ação pode ser refeita adicionando a pessoa novamente.
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
            onClick={handleRemove}
          >
            {isPending ? "Removendo…" : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
