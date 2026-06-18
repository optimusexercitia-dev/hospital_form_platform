"use client";

import { useState } from "react";
import { Pencil, UserPlus, UsersRound } from "lucide-react";

import type { AssignableUser, RcaMember } from "@/lib/safety/rca-types";
import { removeRcaMember } from "@/lib/safety/rca-actions";
import { Button } from "@/components/ui/button";
import { AssigneeAvatar } from "@/components/cases/assignee-avatar";
import { RcaMemberRoleBadge } from "./rca-badges";
import { RcaConfirmDelete } from "./rca-confirm-delete";
import { RcaMemberForm } from "./rca-member-form";

function MemberRow({
  member,
  users,
  usedUserIds,
  canEdit,
}: {
  member: RcaMember;
  users: AssignableUser[];
  usedUserIds: Set<string>;
  canEdit: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const name = member.name ?? member.externalName ?? "Integrante";
  const isExternal = member.userId == null;

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
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <RcaMemberRoleBadge role={member.role} />
        {canEdit && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar papel de ${name}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <RcaConfirmDelete
              action={() => removeRcaMember(member.id)}
              label={`Remover ${name}`}
              title="Remover este integrante?"
              description={`${name} será removido da equipe da análise.`}
            />
          </>
        )}
      </div>

      {canEdit && (
        <RcaMemberForm
          mode="edit"
          open={editOpen}
          onOpenChange={setEditOpen}
          rcaId={member.rcaId}
          member={member}
          users={users}
          usedUserIds={usedUserIds}
        />
      )}
    </li>
  );
}

/**
 * The RCA TEAM panel (track-doc deliverable). Lists each member (platform user or
 * external) with their fixed role; the writer adds/edits-role/removes. A registered
 * non-observer member gains row-level write on the RCA. Mirrors `InterviewersPanel`.
 */
export function RcaTeamPanel({
  rcaId,
  members,
  users,
  canEdit,
}: {
  rcaId: string;
  members: RcaMember[];
  /** The admin/PQS-wide assignable-user roster (`listAssignableUsers`). */
  users: AssignableUser[];
  canEdit: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const usedUserIds = new Set(
    members.map((m) => m.userId).filter((id): id is string => id != null),
  );

  return (
    <section
      aria-labelledby="rca-team-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersRound aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="rca-team-heading" className="text-base font-semibold">
            Equipe da análise
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {members.length}
          </span>
        </div>
        {canEdit && (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus aria-hidden="true" />
            Adicionar
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? "Nenhum integrante. Adicione o líder, o facilitador e os especialistas."
            : "Nenhum integrante registrado."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/70">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              users={users}
              usedUserIds={usedUserIds}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

      {canEdit && (
        <RcaMemberForm
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          rcaId={rcaId}
          users={users}
          usedUserIds={usedUserIds}
        />
      )}
    </section>
  );
}
