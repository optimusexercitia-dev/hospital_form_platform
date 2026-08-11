"use client";

import { useState } from "react";
import { ChevronDown, Plus, ShieldQuestion, Star, Users } from "lucide-react";

import type { CaseParticipant } from "@/lib/queries/cases";
import type { CaseParticipantRoleOption } from "@/lib/queries/participants";
import type { AddableUser } from "@/lib/queries/members";
import {
  removeCaseParticipant,
  setCaseParticipantRole,
  setPrimarySubject,
} from "@/lib/participants/actions";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AddParticipantDialog } from "@/components/cases/add-participant-dialog";
import { ResolveLinkageDialog } from "@/components/cases/resolve-linkage-dialog";
import { useCaseAction } from "@/components/cases/use-case-action";

/** The row's own name-resolution rule (ADR 0108 D3), reused for the incumbent
 *  primary's name inside the "alterar sujeito principal" confirmation body. */
function participantDisplayName(p: CaseParticipant): string {
  return p.professionalFullName ?? p.displayName ?? "";
}

function ParticipantRow({
  participant,
  index,
  roles,
  platformUsers,
  incumbentPrimary,
  canManageLifecycle,
}: {
  participant: CaseParticipant;
  index: number;
  roles: CaseParticipantRoleOption[];
  platformUsers: AddableUser[];
  /** The case's CURRENT primary subject, or `null` when none is set yet — the
   *  "alterar sujeito principal" confirmation names this participant when it
   *  is about to be demoted (ADR 0108 D2's move semantics; lead ruling). */
  incumbentPrimary: CaseParticipant | null;
  canManageLifecycle: boolean;
}) {
  const { run, isPending, error } = useCaseAction();
  const [resolveOpen, setResolveOpen] = useState(false);

  const displayName = participantDisplayName(participant);
  const showResolveLinkage =
    canManageLifecycle &&
    participant.linkState === "unknown" &&
    Boolean(participant.professionalProfileId);

  const roleOptions = roles.filter((r) =>
    r.allowedParticipantTypes.includes(participant.participantType),
  );

  return (
    <li
      data-rise
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
      className="animate-rise-in flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {displayName || "Sem identificação"}
            </span>
            {participant.isPrimarySubject && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase">
                <Star aria-hidden="true" className="size-3" />
                Sujeito principal
              </span>
            )}
          </div>
          {participant.roleLabel && (
            <p className="text-xs text-muted-foreground">
              {participant.roleLabel}
            </p>
          )}
          {participant.involvementSummary && (
            <p className="mt-0.5 text-sm text-foreground/90 text-pretty whitespace-pre-wrap">
              {participant.involvementSummary}
            </p>
          )}
        </div>

        {canManageLifecycle && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {showResolveLinkage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="border-warning/40 text-warning hover:bg-warning/10"
                onClick={() => setResolveOpen(true)}
              >
                <ShieldQuestion aria-hidden="true" />
                Resolver vínculo
              </Button>
            )}
            {!participant.isPrimarySubject &&
              (incumbentPrimary ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                    >
                      Definir como sujeito principal
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Alterar o sujeito principal?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {participantDisplayName(incumbentPrimary)} deixará de
                        ser o sujeito principal deste caso, e{" "}
                        {displayName || "este participante"} passará a ser.
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPending}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={isPending}
                        className={buttonVariants({
                          variant: "default",
                          size: "lg",
                        })}
                        onClick={() =>
                          run(() => setPrimarySubject(participant.id))
                        }
                      >
                        Alterar sujeito principal
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => setPrimarySubject(participant.id))}
                >
                  Definir como sujeito principal
                </Button>
              ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending || roleOptions.length === 0}
                >
                  Alterar papel
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Definir papel</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {roleOptions.map((r) => (
                  <DropdownMenuItem
                    key={r.id}
                    disabled={r.id === participant.roleId}
                    onSelect={() =>
                      run(() => setCaseParticipantRole(participant.id, r.id))
                    }
                  >
                    {r.displayName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Remover
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover participante?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {displayName || "Este participante"} será removido do
                    caso. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isPending}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isPending}
                    onClick={() =>
                      run(() => removeCaseParticipant(participant.id))
                    }
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {showResolveLinkage && participant.professionalProfileId && (
        <ResolveLinkageDialog
          professionalProfileId={participant.professionalProfileId}
          professionalName={displayName}
          platformUsers={platformUsers}
          open={resolveOpen}
          onOpenChange={setResolveOpen}
        />
      )}
    </li>
  );
}

/**
 * The case's participant roster — a MAIN-COLUMN surface (ADR 0108 D7), distinct
 * from the read-only rail card ({@link import('./case-primary-subject-panel')},
 * left untouched): participant, role, involvement summary, and the
 * primary-subject marker, with add / remove / set-role / set-primary /
 * resolve-linkage affordances gated on `canManageLifecycle`.
 *
 * A plain client component fed server-loaded props (mirrors
 * `CaseActionItemsPanel`) rather than a literal server/client file split —
 * every row here carries interactive state (pending transitions, the
 * alterar-papel menu, the resolve-linkage dialog), so there is no
 * meaningfully-sized non-interactive shell to keep on the server inside one
 * owned file.
 */
export function CaseParticipantsPanel({
  caseId,
  organizationId,
  participants,
  roles,
  platformUsers,
  canManageLifecycle,
}: {
  caseId: string;
  organizationId: string;
  participants: CaseParticipant[];
  /** The case's full active role vocabulary (org-wide + this case type's own). */
  roles: CaseParticipantRoleOption[];
  /** The org roster for the "possui conta" platform-user pick. */
  platformUsers: AddableUser[];
  canManageLifecycle: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const incumbentPrimary =
    participants.find((p) => p.isPrimarySubject) ?? null;

  return (
    <section
      aria-labelledby="case-participants-heading"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="case-participants-heading" className="text-base font-semibold">
            Participantes
          </h2>
        </div>
        {canManageLifecycle && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" />
            Adicionar participante
          </Button>
        )}
      </div>

      {participants.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum participante registrado.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {participants.map((p, i) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              index={i}
              roles={roles}
              platformUsers={platformUsers}
              incumbentPrimary={
                p.isPrimarySubject ? null : incumbentPrimary
              }
              canManageLifecycle={canManageLifecycle}
            />
          ))}
        </ul>
      )}

      {canManageLifecycle && (
        <AddParticipantDialog
          caseId={caseId}
          organizationId={organizationId}
          roles={roles}
          platformUsers={platformUsers}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      )}
    </section>
  );
}
