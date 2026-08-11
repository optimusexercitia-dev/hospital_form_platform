"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, UserPlus, UserRound, X } from "lucide-react";

import {
  assignReferralReviewer,
  cancelReferralAssignment,
  updateReferralAssignment,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import {
  REFERRAL_ASSIGNMENT_ROLE_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_TOKENS,
  type ReferralAssignment,
  type ReferralAssignmentRole,
  type ReferralAssignmentStatus,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { referralStatusChipClass } from "./format";
import { formatDateTime } from "./format";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

const ROLE_ORDER: ReferralAssignmentRole[] = [
  "referral_coordinator",
  "primary_reviewer",
  "secondary_reviewer",
  "clinical_reviewer",
  "legal_reviewer",
  "committee_chair",
];

const STATUS_ORDER: ReferralAssignmentStatus[] = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
];

/** A member of the viewer's side the coordinator may assign (id + display name). */
export interface AssignableMember {
  userId: string;
  fullName: string | null;
}

/** ISO → `datetime-local` value; `null`/unparseable → `""`. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * The responsibility (assignments) panel on the referral detail (RV2 R4). Shows WHO
 * is responsible on either side — PHI-free governance metadata — and, for a
 * coordinator of THIS viewer's side, the controls to assign a reviewer, edit an
 * assignment (role/status/due), and cancel one. ASSIGNMENT ≠ ACCESS: a row grants
 * the assignee NO read of the referral (the RPCs re-check authority: 42501 for a
 * non-coordinator, HC0A7 for an invalid role/commission/non-member assignee).
 *
 * The viewer may act only on THEIR side's assignments (`commissionId ===
 * myCommissionId`); other-side rows render read-only.
 */
export function ReferralAssignmentPanel({
  referralId,
  assignments,
  canManage,
  myCommissionId,
  members,
}: {
  referralId: string;
  assignments: ReferralAssignment[];
  /** Whether the viewer coordinates their side (may assign/edit/cancel). */
  canManage: boolean;
  /** The commission side the viewer may assign on (source OR target). */
  myCommissionId: string;
  /** Members of `myCommissionId` for the assignee picker. `[]` when !canManage. */
  members: AssignableMember[];
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<ReferralAssignment | null>(null);

  const ordered = [...assignments].sort(
    (a, b) => Date.parse(a.assignedAt) - Date.parse(b.assignedAt),
  );

  return (
    <section
      aria-labelledby="referral-assignments-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserRound
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h2
            id="referral-assignments-heading"
            className="text-sm font-semibold"
          >
            Responsáveis
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {assignments.length}
          </span>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={() => setAssignOpen(true)}
            disabled={members.length === 0}
          >
            <UserPlus aria-hidden="true" />
            Atribuir responsável
          </Button>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground text-pretty">
          Nenhum responsável atribuído a este encaminhamento.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((a) => {
            const mine = a.commissionId === myCommissionId && canManage;
            return (
              <li
                key={a.id}
                className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {a.assigneeName ?? "Membro"}
                  </span>
                  <span
                    className={cn(
                      CHIP_BASE,
                      referralStatusChipClass(
                        REFERRAL_ASSIGNMENT_STATUS_TOKENS[a.status],
                      ),
                    )}
                  >
                    {REFERRAL_ASSIGNMENT_STATUS_LABELS[a.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{REFERRAL_ASSIGNMENT_ROLE_LABELS[a.assignmentRole]}</span>
                  {a.dueAt && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CalendarClock aria-hidden="true" className="size-3.5" />
                      {formatDateTime(a.dueAt)}
                    </span>
                  )}
                  {a.assignedByName && <span>por {a.assignedByName}</span>}
                </div>
                {mine && a.status !== "cancelled" && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(a)}
                    >
                      Editar
                    </Button>
                    <CancelButton assignmentId={a.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <AssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          referralId={referralId}
          commissionId={myCommissionId}
          members={members}
        />
      )}
      {canManage && editing && (
        <EditAssignmentDialog
          key={editing.id}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          assignment={editing}
        />
      )}
    </section>
  );
}

/** Cancel a single assignment (status → cancelled). */
function CancelButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelReferralAssignment(assignmentId);
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={cancel}
        disabled={isPending}
      >
        <X aria-hidden="true" />
        Cancelar
      </Button>
      {error && (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

/** Assign a reviewer on the viewer's side (RV2 R4). */
function AssignDialog({
  open,
  onOpenChange,
  referralId,
  commissionId,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralId: string;
  commissionId: string;
  members: AssignableMember[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [role, setRole] = useState<ReferralAssignmentRole>("primary_reviewer");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAssigneeUserId("");
      setRole("primary_reviewer");
      setDueAt("");
      setError(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!assigneeUserId) return setError(REFERRAL_MESSAGES.assigneeRequired);
    startTransition(async () => {
      const result = await assignReferralReviewer({
        referralId,
        commissionId,
        assigneeUserId,
        assignmentRole: role,
        dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : null,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir responsável</DialogTitle>
          <DialogDescription>
            Registre quem, na sua comissão, é responsável por este encaminhamento.
            A atribuição não concede acesso ao encaminhamento — é apenas um
            registro de responsabilidade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Responsável</span>
            <NativeSelect
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              required
              className="py-2"
            >
              <option value="" disabled>
                Selecione um membro…
              </option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName ?? "Membro"}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Papel</span>
            <NativeSelect
              value={role}
              onChange={(e) =>
                setRole(e.target.value as ReferralAssignmentRole)
              }
              className="py-2"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {REFERRAL_ASSIGNMENT_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Prazo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Atribuindo…" : "Atribuir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Edit an assignment's role / status / due (RV2 R4). */
function EditAssignmentDialog({
  open,
  onOpenChange,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ReferralAssignment;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<ReferralAssignmentRole>(
    assignment.assignmentRole,
  );
  const [status, setStatus] = useState<ReferralAssignmentStatus>(
    assignment.status,
  );
  const [dueAt, setDueAt] = useState(isoToLocalInput(assignment.dueAt));
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateReferralAssignment({
        assignmentId: assignment.id,
        assignmentRole: role,
        status,
        dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : null,
      });
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar atribuição</DialogTitle>
          <DialogDescription>
            Atualize o papel, o estado ou o prazo de{" "}
            {assignment.assigneeName ?? "este responsável"}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Papel</span>
            <NativeSelect
              value={role}
              onChange={(e) =>
                setRole(e.target.value as ReferralAssignmentRole)
              }
              className="py-2"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {REFERRAL_ASSIGNMENT_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Estado</span>
            <NativeSelect
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as ReferralAssignmentStatus)
              }
              className="py-2"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {REFERRAL_ASSIGNMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Prazo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={FIELD_CLASS}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
