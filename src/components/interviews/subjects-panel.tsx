"use client";

import { useState } from "react";
import { Pencil, UserPlus, Users } from "lucide-react";

import type { InterviewSubject } from "@/lib/queries/interviews";
import { removeInterviewSubject } from "@/lib/interviews/actions";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { SubjectForm, type SubjectMemberOption } from "./subject-form";
import { ConfirmDeleteButton } from "./confirm-delete-button";

function SubjectRow({
  subject,
  members,
  canEdit,
}: {
  subject: InterviewSubject;
  members: SubjectMemberOption[];
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const name = subject.displayName ?? "Entrevistado";
  const isExternal = subject.userId == null;

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
          {(subject.clinicalRole || subject.note) && (
            <span className="truncate text-xs text-muted-foreground">
              {subject.clinicalRole}
              {subject.clinicalRole && subject.note ? " · " : ""}
              {subject.note}
            </span>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1.5">
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
            action={() => removeInterviewSubject(subject.id)}
            label={`Remover ${name}`}
            title="Remover este entrevistado?"
            description={`${name} será removido da lista de entrevistados.`}
          />
        </div>
      )}

      {canEdit && (
        <SubjectForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          interviewId={subject.interviewId}
          subject={subject}
          members={members}
        />
      )}
    </li>
  );
}

/**
 * Interviewees (subjects) panel. Lists each entrevistado (member or external)
 * with their free-text clinical role; the writer adds/edits/removes. Read-only for
 * non-writers and once the interview is locked. The member picker excludes members
 * already added as a subject.
 */
export function SubjectsPanel({
  interviewId,
  subjects,
  members,
  canEdit,
}: {
  interviewId: string;
  subjects: InterviewSubject[];
  /** Commission roster for the member picker. */
  members: SubjectMemberOption[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const usedUserIds = new Set(
    subjects.map((s) => s.userId).filter((id): id is string => id != null),
  );
  const availableMembers = members.filter((m) => !usedUserIds.has(m.userId));

  return (
    <section
      aria-labelledby="interview-subjects-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="interview-subjects-heading"
            className="text-base font-semibold"
          >
            Entrevistados
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {subjects.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus aria-hidden="true" />
            Adicionar
          </Button>
        )}
      </div>

      {subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum entrevistado. Adicione os profissionais entrevistados neste caso."
            : "Nenhum entrevistado registrado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {subjects.map((s) => (
            <SubjectRow
              key={s.id}
              subject={s}
              members={availableMembers}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <SubjectForm
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
