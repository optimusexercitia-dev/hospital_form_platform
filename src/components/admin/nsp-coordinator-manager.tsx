"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserCog } from "lucide-react";

import type { PqsEligibleUser } from "@/lib/pqs/roster-types";
import {
  appointNspCoordinator,
  revokeNspCoordinator,
} from "@/lib/org/actions";
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

const SELECT_CLASSES = cn(
  "h-11 w-full min-w-44 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color]",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
);

function personLabel(p: {
  fullName: string | null;
  email: string | null;
}): string {
  return p.fullName?.trim() || p.email || "Sem identificação";
}

/**
 * The focused "Coordenação do NSP" manager (NSP-per-org, ADR 0042). Lets an
 * `org_admin` appoint / revoke the per-org `nsp_coordinator` grant
 * (`organization_members.role`). This is the FIRST of the three-way duty
 * separation: the org_admin appoints the coordinator, who then curates the PQS
 * roster ("Equipe do NSP" in the NSP console), whose members read PHI.
 *
 * Deliberately NARROW — this is NOT a general org-member management UI (that is a
 * separate, broader gap). It only toggles the one role. Appoint is a picker over
 * the org's members; revoke is guarded by a confirm. Both are the direct-call
 * (`orgId, userId`) `org_admin`-gated server actions, run in a transition; on
 * success we `router.refresh()`.
 *
 * Note: appointing the coordinator does NOT grant PHI access — the coordinator
 * must still enroll themselves into the roster to read. Keyboard-operable;
 * pt-BR copy.
 */
export function NspCoordinatorManager({
  orgId,
  coordinators,
  eligibleUsers,
}: {
  orgId: string;
  coordinators: PqsEligibleUser[];
  eligibleUsers: PqsEligibleUser[];
}) {
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The picker offers only org members who are NOT already coordinators.
  const coordinatorIds = useMemo(
    () => new Set(coordinators.map((c) => c.userId)),
    [coordinators],
  );
  const candidates = useMemo(
    () =>
      eligibleUsers
        .filter((u) => !coordinatorIds.has(u.userId))
        .sort((a, b) => personLabel(a).localeCompare(personLabel(b), "pt-BR")),
    [eligibleUsers, coordinatorIds],
  );

  function handleAppoint(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await appointNspCoordinator(orgId, selected);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível nomear o coordenador.");
        return;
      }
      setSuccess(result.message ?? "Coordenador(a) do NSP nomeado(a).");
      setSelected("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Appoint */}
      <form
        onSubmit={handleAppoint}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="size-4 text-primary" />
          <h3 className="text-base font-semibold">Nomear coordenador(a)</h3>
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
              {isPending ? "Nomeando…" : "Nomear"}
            </Button>
          </div>
          <p id={`${selectId}-help`} className="text-xs text-muted-foreground text-pretty">
            O(a) coordenador(a) gerencia a equipe do NSP (quem lê os dados de
            segurança do paciente). Nomear não concede, por si só, acesso aos
            dados — o(a) coordenador(a) precisa entrar na equipe para ler.
          </p>
        </div>
      </form>

      {/* Current coordinators */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Coordenação atual
          </h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {coordinators.length}
          </span>
        </div>

        {coordinators.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
            Nenhum(a) coordenador(a) do NSP nomeado(a). Nomeie alguém acima para
            que possa gerenciar a equipe do NSP.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {coordinators.map((person) => {
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
                  </div>
                  <RevokeCoordinatorButton
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
 * A guarded "remover" control for one coordinator, wired to the direct-call
 * `revokeNspCoordinator(orgId, userId)` action. Stays open on error, closes on
 * success (the page revalidates).
 */
function RevokeCoordinatorButton({
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
      const result = await revokeNspCoordinator(orgId, userId);
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
            {label} deixará de gerenciar a equipe do NSP. Os membros já na equipe
            continuam com acesso; apenas a curadoria da equipe é afetada. Esta
            ação pode ser refeita nomeando a pessoa novamente.
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
