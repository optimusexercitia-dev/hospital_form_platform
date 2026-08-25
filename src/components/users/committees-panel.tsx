"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { UserCommitteeMembership } from "@/lib/users/types";
import { assignCommitteeRole, removeCommittee } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CardAddButton,
  CardTextButton,
  ProfileCard,
  StatusPill,
} from "@/components/users/profile-cards";
import { ProfileDialogShell } from "@/components/users/profile-dialog-shell";
import {
  RoleChoiceCards,
  committeeRoleLabel,
  type CommitteeRole,
} from "@/components/users/role-choice-cards";

/**
 * The profile's "Comissões" card (redesign 2a + dialogs 3d / "Alterar papel").
 *
 * A commission seat is a CAPABILITY: it is what lets the person answer that committee's
 * forms, and — at `staff_admin` — manage its members and publications. That is the whole
 * reason this card is separate from "Vínculos hospitalares" one card above: an
 * affiliation says where someone WORKS and grants nothing, a membership says what
 * someone may DO. Two facts that look alike in a roster and are not alike at all.
 *
 * ⚠ NEW COMPONENT, DELIBERATELY NOT A REDESIGN OF `CommitteeRoleAssigner`. That control
 * is SHARED with `register-person-wizard` in `mode="collect"`, where there is no user id
 * yet and rows are held in local state for the create payload. Reshaping it for this
 * page would have put the registration wizard's only committee control at risk for a
 * layout change. This card owns the `live` half — the same two server actions, a shape
 * that suits one existing person.
 *
 * ⚠ ZERO COMMITTEES IS A LEGIBLE EXPECTED STATE, never a hidden card. Plenty of
 * registered people hold no seat, and a card that vanishes reads as "failed to load" —
 * or worse, as "you are not allowed to see this", which is the ambiguity this codebase
 * bans.
 *
 * ⚠ Architecture Rule 1: `assignCommitteeRole` / `removeCommittee` re-derive the
 * caller's authority server-side and refuse in pt-BR. Rendering a control here is a
 * convenience, never a permission.
 */

/** A commission this person could be added to, for dialog 3d's picker. */
export interface CommitteeOptionRow {
  id: string;
  name: string;
  /** Rendered as "Nome da comissão — Hospital"; omitted when the hospital is not visible. */
  hospitalName: string | null;
}

export function CommitteesPanel({
  userId,
  personName,
  memberships,
  commissions,
}: {
  userId: string;
  personName: string;
  memberships: UserCommitteeMembership[];
  /** Every commission in the caller's scope. Current seats are filtered out below. */
  commissions: CommitteeOptionRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserCommitteeMembership | null>(null);
  const [removing, setRemoving] = useState<UserCommitteeMembership | null>(null);

  const assignedIds = useMemo(
    () => new Set(memberships.map((m) => m.commissionId)),
    [memberships],
  );
  const candidates = useMemo(
    () =>
      commissions
        .filter((c) => !assignedIds.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [commissions, assignedIds],
  );

  /**
   * ⚠ ONE DOOR FOR BOTH ADD AND ROLE CHANGE, and that is `assignCommitteeRole`'s own
   * contract rather than a shortcut: it is idempotent on the membership PK and UPDATES
   * the role when a seat already exists. Re-adding is how a role changes.
   */
  function commitAssign(commissionId: string, role: CommitteeRole) {
    setError(null);
    startTransition(async () => {
      const result = await assignCommitteeRole(userId, { commissionId, role });
      // Close either way. The refusal renders in the PAGE, and everything outside an
      // open modal is `aria-hidden` — a message left behind the overlay is invisible to
      // assistive tech and looks like a button that did nothing.
      setAddOpen(false);
      setEditing(null);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar a comissão.");
        return;
      }
      router.refresh();
    });
  }

  function commitRemove(commissionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCommittee(userId, commissionId);
      setRemoving(null);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover a comissão.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <ProfileCard
      titleId="comissoes-heading"
      title="Comissões"
      caption="Onde esta pessoa participa, e o papel em cada uma."
      riseDelay="80ms"
      action={
        candidates.length > 0 ? (
          <CardAddButton onClick={() => setAddOpen(true)} disabled={isPending}>
            <span aria-hidden="true">＋</span>
            Adicionar a uma comissão
          </CardAddButton>
        ) : null
      }
    >
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {memberships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-xs text-muted-foreground text-pretty">
          Sem comissão. Esta pessoa ainda não participa de nenhuma comissão desta
          organização.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {memberships.map((m, index) => (
            <li
              key={m.commissionId}
              className="animate-rise-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
              style={{ ["--rise-delay" as string]: `${index * 50}ms` }}
            >
              <div className="min-w-0">
                <p className="truncate text-[0.84rem] font-semibold">
                  {m.commissionName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    m.hospitalName,
                    m.since ? `desde ${formatMonthYear(m.since)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <StatusPill tone={m.role === "staff_admin" ? "accent" : "muted"}>
                  {committeeRoleLabel(m.role)}
                </StatusPill>
                <CardTextButton
                  onClick={() => setEditing(m)}
                  disabled={isPending}
                  aria-label={`Alterar papel em ${m.commissionName}`}
                >
                  Alterar papel
                </CardTextButton>
                <CardTextButton
                  tone="destructive"
                  onClick={() => setRemoving(m)}
                  disabled={isPending}
                  aria-label={`Remover de ${m.commissionName}`}
                >
                  Remover
                </CardTextButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addOpen ? (
        <AddCommitteeDialog
          personName={personName}
          candidates={candidates}
          currentNames={memberships.map((m) => m.commissionName)}
          isPending={isPending}
          onSubmit={commitAssign}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {editing ? (
        <ChangeRoleDialog
          key={editing.commissionId}
          personName={personName}
          membership={editing}
          isPending={isPending}
          onSubmit={(role) => commitAssign(editing.commissionId, role)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {personName} de {removing?.commissionName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixa de participar desta comissão e perde o acesso aos
              formulários e às pautas dela. O histórico do que já respondeu é
              preservado, e a atribuição pode ser refeita depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              onClick={() => {
                if (removing) commitRemove(removing.commissionId);
              }}
            >
              {isPending ? "Removendo…" : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProfileCard>
  );
}

/** Dialog 3d — pick a commission, pick the seat. */
function AddCommitteeDialog({
  personName,
  candidates,
  currentNames,
  isPending,
  onSubmit,
  onClose,
}: {
  personName: string;
  candidates: CommitteeOptionRow[];
  /** Named in the helper text, so the omission from the list is explained, not silent. */
  currentNames: string[];
  isPending: boolean;
  onSubmit: (commissionId: string, role: CommitteeRole) => void;
  onClose: () => void;
}) {
  const [commissionId, setCommissionId] = useState(candidates[0]?.id ?? "");
  const [role, setRole] = useState<CommitteeRole>("staff");
  const commissionField = useFieldIds("addCommittee", {
    required: true,
    hasDescription: currentNames.length > 0,
  });

  return (
    <ProfileDialogShell
      open
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      title="Adicionar a uma comissão"
      subtitle={`${personName} · comissões desta organização em que ainda não participa.`}
      onSubmit={() => {
        if (commissionId) onSubmit(commissionId, role);
      }}
      submitLabel="Adicionar à comissão"
      pendingLabel="Adicionando…"
      isPending={isPending}
      submitDisabled={!commissionId}
    >
      <Field>
        <FieldLabel htmlFor={commissionField.controlProps.id}>
          Comissão
        </FieldLabel>
        <NativeSelect
          {...commissionField.controlProps}
          className="h-10"
          value={commissionId}
          disabled={isPending}
          onChange={(e) => setCommissionId(e.target.value)}
        >
          <option value="" disabled>
            Selecione uma comissão
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.hospitalName ? `${c.name} — ${c.hospitalName}` : c.name}
            </option>
          ))}
        </NativeSelect>
        {currentNames.length > 0 ? (
          <FieldDescription
            id={commissionField.descriptionId}
            className="text-[0.7rem]"
          >
            {currentNames.join(", ")} não {currentNames.length > 1 ? "aparecem" : "aparece"}{" "}
            na lista — a pessoa já participa.
          </FieldDescription>
        ) : null}
      </Field>

      <RoleChoiceCards value={role} onChange={setRole} disabled={isPending} />
    </ProfileDialogShell>
  );
}

/**
 * "Alterar papel" — the same two choice-cards as 3d, over a seat that already exists.
 *
 * Deliberately a dialog rather than an inline select: changing someone from Membro to
 * Coordenador(a) hands them control of the committee's members and publications, and the
 * cards are what state that in words. A two-option dropdown states nothing.
 */
function ChangeRoleDialog({
  personName,
  membership,
  isPending,
  onSubmit,
  onClose,
}: {
  personName: string;
  membership: UserCommitteeMembership;
  isPending: boolean;
  onSubmit: (role: CommitteeRole) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<CommitteeRole>(membership.role);

  return (
    <ProfileDialogShell
      open
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
      title="Alterar papel"
      subtitle={`${personName} · ${membership.commissionName}.`}
      onSubmit={() => {
        if (role === membership.role) {
          onClose();
          return;
        }
        onSubmit(role);
      }}
      submitLabel="Salvar papel"
      pendingLabel="Salvando…"
      isPending={isPending}
    >
      <RoleChoiceCards value={role} onChange={setRole} disabled={isPending} />
    </ProfileDialogShell>
  );
}

/**
 * `mar 2024` — the seat's start, from `memberships.granted_at`.
 *
 * A TIMESTAMP, so it is safe to parse as an instant; the DATE columns elsewhere on this
 * page are not, and are read as local calendar parts instead.
 */
function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\.$/, "");
}
