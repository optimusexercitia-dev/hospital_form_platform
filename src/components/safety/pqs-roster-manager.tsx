"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import type {
  PqsEligibleUser,
  PqsRosterMember,
} from "@/lib/pqs/roster-types";
import { addPqsMember, removePqsMember } from "@/lib/pqs/actions";
import { cn } from "@/lib/utils";
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
import { formatDate } from "./format";

const SELECT_CLASSES = cn(
  "h-11 w-full min-w-44 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
);

/** Best display label for a person: name, else email, else a neutral fallback. */
function personLabel(p: {
  fullName: string | null;
  email: string | null;
}): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The per-org PQS roster manager ("Equipe do NSP" — NSP-per-org, ADR 0042).
 * Coordinator-only (the page gates on `isNspCoordinatorOfSelf`; the
 * `add`/`remove` RPCs re-gate server-side with 42501). Enrollment in this roster
 * is what grants the org's PHI **read** — so this is the single door that admits
 * a reader. Three-way duty separation: the org_admin appoints the coordinator,
 * the coordinator curates this roster, an enrolled member reads PHI.
 *
 * Enroll is a picker over the org's eligible users (those not already enrolled);
 * remove is guarded by a confirm dialog. Both mutations are the direct-call
 * (`orgId, userId`) server actions, run in a transition; on success we
 * `router.refresh()` so the server-loaded roster + picker re-resolve.
 *
 * Fully keyboard-operable: a labeled native `<select>` + buttons, visible focus
 * rings, `role="status"`/`role="alert"` regions. All copy pt-BR.
 */
export function PqsRosterManager({
  orgId,
  members,
  eligibleUsers,
}: {
  orgId: string;
  members: PqsRosterMember[];
  eligibleUsers: PqsEligibleUser[];
}) {
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The picker offers only users who are NOT already on the roster.
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
      const result = await addPqsMember(orgId, selected);
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
    <div className="flex flex-col gap-6">
      {/* Enroll */}
      <form
        onSubmit={handleEnroll}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <UserPlus aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-base font-semibold">Adicionar à equipe</h3>
        </div>

        {error && <FormBanner tone="error">{error}</FormBanner>}
        {success && <FormBanner tone="success">{success}</FormBanner>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-sm font-medium">
            Pessoa da organização
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              id={selectId}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={isPending || candidates.length === 0}
              className={SELECT_CLASSES}
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
            </select>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !selected}
              className="shrink-0"
            >
              {isPending ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
          <p id={`${selectId}-help`} className="text-xs text-muted-foreground text-pretty">
            Quem entra na equipe passa a ler os dados sensíveis de segurança do
            paciente desta organização. O acesso é registrado em trilha de
            auditoria.
          </p>
        </div>
      </form>

      {/* Roster */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Equipe atual
          </h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {members.length}
          </span>
        </div>

        {members.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
            A equipe do NSP ainda não tem membros. Adicione pessoas acima para
            conceder acesso aos dados de segurança do paciente.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {members.map((person) => {
              const label = personLabel(person);
              const showEmail = Boolean(person.email && person.fullName?.trim());
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
                    {person.addedAt ? (
                      <p className="text-xs text-muted-foreground/80 tabular-nums">
                        Na equipe desde {formatDate(person.addedAt)}
                      </p>
                    ) : null}
                  </div>
                  <RemoveMemberButton
                    orgId={orgId}
                    userId={person.userId}
                    label={label}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * A guarded "remover" control for one roster member, wired to the direct-call
 * `removePqsMember(orgId, userId)` action. The dialog stays open on error (so the
 * pt-BR message shows) and closes on success (the page revalidates, the row
 * disappears).
 */
function RemoveMemberButton({
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

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removePqsMember(orgId, userId);
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
            {label} deixará de ter acesso aos dados de segurança do paciente
            desta organização. Esta ação pode ser refeita adicionando a pessoa
            novamente.
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
