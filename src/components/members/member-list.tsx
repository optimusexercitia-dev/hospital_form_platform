import type { MemberListItem, MemberCapability } from "@/lib/queries/members";
import type { MemberTitle } from "@/lib/commissions/titles-types";
import { removeStaff } from "@/lib/members/actions";
import { ConfirmRemoveButton } from "@/components/admin/confirm-remove-button";
import { TitleBadge } from "@/components/commissions/title-badge";
import { TitleAssignControl } from "@/components/commissions/title-assign-control";

import { RoleBadge } from "./role-badge";
import { MemberAdministrativoControls } from "./member-administrativo-controls";

/**
 * Commission member roster (name, e-mail, role, title) with a guarded "remover"
 * control per removable row. Server Component — the client islands are the
 * removal confirm and the title-assignment select.
 *
 * The title badge + assignment control (ADR 0051 Decision 6) bind to the
 * canonical {@link MemberListItem} fields (`memberId`/`titleId`/`titleName`);
 * the assignment select renders whenever `titles` is non-empty. Removal is
 * offered ONLY for `staff` rows, and never for the current user's own row
 * (`currentUserId`) — coordinators are managed from the admin area, and you
 * can't remove yourself here. RLS + the `removeStaff` action remain the
 * authority regardless of what the UI offers.
 */
export function MemberList({
  commissionId,
  members,
  currentUserId,
  titles = [],
  administrativoEnabled = false,
  appointedUserIds = [],
  capabilitiesByUser = {},
  showPhiNotice = false,
}: {
  commissionId: string;
  members: MemberListItem[];
  currentUserId: string;
  /** The commission's title vocabulary, for the per-row assignment select. */
  titles?: MemberTitle[];
  /**
   * Administrativo delegation (ADR 0061). When the `administrativo` feature is on,
   * each `staff` row gains the appoint control + capability checklist, and appointed
   * members show an "Administrativo" badge. When off, none of this renders.
   */
  administrativoEnabled?: boolean;
  /** User ids appointed as Administrativo in this commission. */
  appointedUserIds?: string[];
  /** Granted capabilities per appointed user id. */
  capabilitiesByUser?: Record<string, MemberCapability[]>;
  /** Whether the `create_cases` capability carries the PHI/minimum-necessary note. */
  showPhiNotice?: boolean;
}) {
  const appointed = new Set(appointedUserIds);
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
        const isAppointed = appointed.has(member.userId);

        return (
          <li key={member.userId} className="flex flex-col px-4 py-3">
            <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  <span className="truncate">{displayName}</span>
                  {isSelf ? (
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      (você)
                    </span>
                  ) : null}
                  {member.titleName ? <TitleBadge name={member.titleName} /> : null}
                </p>
                {showEmail ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {titles.length > 0 ? (
                <TitleAssignControl
                  memberId={member.memberId}
                  currentTitleId={member.titleId}
                  titles={titles}
                  memberName={displayName}
                />
              ) : null}
              {member.role === "staff_admin" ? (
                <RoleBadge role={member.role} />
              ) : null}
              {administrativoEnabled && isAppointed ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Administrativo
                </span>
              ) : null}
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
            </div>

            {administrativoEnabled && member.role === "staff" && !isSelf ? (
              <MemberAdministrativoControls
                commissionId={commissionId}
                userId={member.userId}
                memberName={displayName}
                initialAppointed={isAppointed}
                initialCapabilities={capabilitiesByUser[member.userId] ?? []}
                showPhiNotice={showPhiNotice}
              />
            ) : null}

            {administrativoEnabled && member.role === "staff_admin" ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground text-pretty">
                Como coordenador(a), esta pessoa já possui estas permissões.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
