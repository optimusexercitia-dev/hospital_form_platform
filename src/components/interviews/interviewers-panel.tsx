"use client";

import { useState } from "react";
import { Pencil, UserPlus, UsersRound } from "lucide-react";

import type { InterviewInterviewer } from "@/lib/queries/interviews";
import { removeInterviewInterviewer } from "@/lib/interviews/actions";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { InterviewerRoleBadge } from "./interview-badges";
import {
  InterviewerForm,
  type InterviewerMemberOption,
} from "./interviewer-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";

function InterviewerRow({
  interviewer,
  members,
  canEdit,
}: {
  interviewer: InterviewInterviewer;
  members: InterviewerMemberOption[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const name = interviewer.displayName ?? "Entrevistador";
  const isExternal = interviewer.userId == null;

  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <AssigneeAvatar name={name} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">
            {name}
            {isExternal && (
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.6rem] font-medium tracking-wide text-muted-foreground uppercase">
                Externo
              </span>
            )}
          </span>
          {isExternal && interviewer.externalOrg && (
            <span className="truncate text-xs text-muted-foreground">
              {interviewer.externalOrg}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <InterviewerRoleBadge role={interviewer.role} />
        {canEdit && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar ${name}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <ConfirmDeleteButton
              action={() => removeInterviewInterviewer(interviewer.id)}
              label={`Remover ${name}`}
              title="Remover este entrevistador?"
              description={`${name} será removido da lista de entrevistadores.`}
            />
          </>
        )}
      </div>

      {canEdit && (
        <InterviewerForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          interviewId={interviewer.interviewId}
          interviewer={interviewer}
          members={members}
        />
      )}
    </li>
  );
}

/**
 * Interviewers panel. Lists each entrevistador (member or external) with their
 * fixed committee role; the writer adds/edits/removes. A registered member
 * interviewer gains row-level write on the interview (the new RLS shape). The
 * member picker excludes members already added as an interviewer.
 */
export function InterviewersPanel({
  interviewId,
  interviewers,
  members,
  canEdit,
}: {
  interviewId: string;
  interviewers: InterviewInterviewer[];
  /** Commission roster for the member picker. */
  members: InterviewerMemberOption[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const usedUserIds = new Set(
    interviewers.map((i) => i.userId).filter((id): id is string => id != null),
  );
  const availableMembers = members.filter((m) => !usedUserIds.has(m.userId));

  return (
    <section
      aria-labelledby="interview-interviewers-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersRound
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="interview-interviewers-heading"
            className="text-base font-semibold"
          >
            Entrevistadores
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {interviewers.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus aria-hidden="true" />
            Adicionar
          </Button>
        )}
      </div>

      {interviewers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum entrevistador. Adicione os membros que conduzem a entrevista."
            : "Nenhum entrevistador registrado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {interviewers.map((iv) => (
            <InterviewerRow
              key={iv.id}
              interviewer={iv}
              members={availableMembers}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <InterviewerForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          interviewId={interviewId}
          members={availableMembers}
        />
      )}
    </section>
  );
}
