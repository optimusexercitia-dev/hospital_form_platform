"use client";

import { useState } from "react";
import { EyeOff, Lock, MessageSquarePlus } from "lucide-react";

import type { ReferralInternalNote } from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { ReferralNoteCard } from "./referral-note-card";
import { ReferralRegistroDialog } from "./referral-registro-dialog";
import type { AssignableMember } from "./referral-assignment-panel";

/**
 * "Registros internos" — the PRIVATE per-committee record panel on the referral
 * detail (RV2 R5, promoted by RDR / ADR 0109 from the flat "Notas internas" list).
 *
 * The security keystone (K-R5-1) is unchanged: a registro belongs to exactly ONE
 * committee side and is readable ONLY by a member of THAT side — source members
 * never read a target-owned registro and vice-versa, and QPS reads NEITHER. The
 * server page loads the caller's OWN-side registros via the audited
 * `listReferralInternalNotes` door and passes them here; the privacy is stated in
 * the UI so an author is never misled about who can see one.
 *
 * ⚠ ORDER IS THE DOOR'S. The RPC returns open registros first, then concluded,
 * `created_at` DESC within each group. This panel PARTITIONS by status to label the
 * two groups — a filter, which preserves the door's relative order — and never
 * sorts. A `.sort()` here would silently override the grouping the door computed.
 *
 * A registro files under the SAME fixed kinds as the case timeline's "Registros"
 * (`CASE_EVENT_KINDS`), and is now WRITTEN the same way too: "Adicionar registro"
 * opens {@link ReferralRegistroDialog} rather than expanding an inline form, so this
 * panel mirrors the case detail's "Registros" card end to end.
 */
export function ReferralInternalNotesPanel({
  referralId,
  committeeId,
  notes,
  members,
  viewerUserId,
  canCreate,
  canManage,
  canRedact,
}: {
  referralId: string;
  /** The viewer's OWN committee side (source OR target), or `null` when the viewer
   * belongs to neither side (e.g. QPS) — then registros are neither read nor written. */
  committeeId: string | null;
  notes: ReferralInternalNote[];
  /** The viewer's-side roster for the assignee pickers; `[]` when !canManage. */
  members: AssignableMember[];
  /** The viewing user's id — decides authorship/assignment for the edit gate. */
  viewerUserId: string | null;
  /** Whether the viewer may create a registro (a member of `committeeId`). */
  canCreate: boolean;
  /** Whether the viewer COORDINATES this side (assign, and edit any registro). */
  canManage: boolean;
  /** Whether the viewer may redact (a coordinator of the owning side). */
  canRedact: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  // A viewer who belongs to neither side (QPS) sees nothing here — the door already
  // returns [] for them (K-R5-1); render nothing so no misleading empty panel shows.
  if (!committeeId) return null;

  const open = notes.filter((n) => n.status !== "concluded");
  const concluded = notes.filter((n) => n.status === "concluded");

  /** The UI mirror of `app.can_edit_referral_internal_note` (the RPC re-checks). */
  function canEditNote(note: ReferralInternalNote): boolean {
    if (note.status === "concluded" || note.redactedAt) return false;
    if (canManage) return true;
    if (viewerUserId == null) return false;
    return note.authorUserId === viewerUserId || note.assignedTo === viewerUserId;
  }

  function renderNote(note: ReferralInternalNote) {
    return (
      <ReferralNoteCard
        key={note.id}
        note={note}
        canEdit={canEditNote(note)}
        canAssign={canManage && note.status !== "concluded" && !note.redactedAt}
        canRedact={canRedact}
        members={members}
      />
    );
  }

  return (
    <section
      aria-labelledby="referral-internal-notes-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2
            id="referral-internal-notes-heading"
            className="text-base font-semibold"
          >
            Registros internos
          </h2>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
            {notes.length}
          </span>
        </div>
        {canCreate ? (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <MessageSquarePlus aria-hidden="true" />
            Adicionar registro
          </Button>
        ) : null}
      </div>

      <p className="inline-flex items-start gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-pretty">
        <EyeOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Registros internos — visíveis apenas à sua comissão. A outra comissão e o
        NSP não têm acesso.
      </p>

      {notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum registro interno ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {open.length > 0 ? (
            <ul className="flex flex-col gap-2.5">{open.map(renderNote)}</ul>
          ) : null}

          {concluded.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Concluídos
              </h3>
              <ul className="flex flex-col gap-2.5">
                {concluded.map(renderNote)}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {canCreate ? (
        <ReferralRegistroDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          referralId={referralId}
          committeeId={committeeId}
          members={members}
          canAssign={canManage}
        />
      ) : null}
    </section>
  );
}
