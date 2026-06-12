import type { MemberListItem } from "@/lib/queries/members";
import { removeStaff } from "@/lib/members/actions";
import { ConfirmRemoveButton } from "@/components/admin/confirm-remove-button";

import { RoleBadge } from "./role-badge";

/**
 * Commission member roster (name, e-mail, role) with a guarded "remover" control
 * per removable row. Server Component — the only client islands are the role
 * badge's siblings (`ConfirmRemoveButton`).
 *
 * Removal is offered ONLY for `staff` rows, and never for the current user's own
 * row (`currentUserId`) — coordinators are managed from the admin area, and you
 * can't remove yourself here. RLS + the `removeStaff` action remain the
 * authority regardless of what the UI offers.
 */
export function MemberList({
  commissionId,
  members,
  currentUserId,
}: {
  commissionId: string;
  members: MemberListItem[];
  currentUserId: string;
}) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
        Esta comissão ainda não tem membros.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {members.map((member) => {
        const displayName =
          member.fullName?.trim() || member.email || "Sem identificação";
        const showEmail = Boolean(member.email && member.fullName?.trim());
        const isSelf = member.userId === currentUserId;
        const canRemove = member.role === "staff" && !isSelf;

        return (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <span className="truncate">{displayName}</span>
                  {isSelf ? (
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      (você)
                    </span>
                  ) : null}
                </p>
                {showEmail ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <RoleBadge role={member.role} />
              {canRemove ? (
                <ConfirmRemoveButton
                  action={removeStaff}
                  hiddenFields={{ commissionId, userId: member.userId }}
                  triggerLabel="Remover"
                  triggerAriaLabel={`Remover ${displayName} da comissão`}
                  title="Remover membro?"
                  description={`${displayName} perderá o acesso a esta comissão. As respostas já enviadas são preservadas. Você poderá convidar a pessoa novamente depois.`}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
