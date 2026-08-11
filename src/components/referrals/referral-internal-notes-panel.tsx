"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Lock, Plus, X } from "lucide-react";

import { createReferralInternalNote } from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type {
  ReferralInternalNote,
  ReferralNoteType,
} from "@/lib/referrals/types";
import { SectionTextEditor } from "@/components/forms/section-text-editor";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";
import { ReferralNoteCard } from "./referral-note-card";
import { ReferralNoteTypeManager } from "./referral-note-type-manager";
import type { AssignableMember } from "./referral-assignment-panel";

const FIELD_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

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
 */
export function ReferralInternalNotesPanel({
  referralId,
  committeeId,
  notes,
  noteTypes,
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
  /** The commission's NON-archived type vocabulary (picker + manage dialog). */
  noteTypes: ReferralNoteType[];
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noteTypeId, setNoteTypeId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A viewer who belongs to neither side (QPS) sees nothing here — the door already
  // returns [] for them (K-R5-1); render nothing so no misleading empty panel shows.
  if (!committeeId) return null;

  const open = notes.filter((n) => n.status !== "concluded");
  const concluded = notes.filter((n) => n.status === "concluded");

  function reset() {
    setTitle("");
    setBody("");
    setNoteTypeId("");
    setAssignedTo("");
    setFieldError(null);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!body.trim()) {
      setFieldError(REFERRAL_MESSAGES.noteBodyRequired);
      return;
    }
    startTransition(async () => {
      const result = await createReferralInternalNote({
        referralId,
        committeeId: committeeId as string,
        bodyMd: body.trim(),
        title: title.trim() || null,
        noteTypeId: noteTypeId || null,
        assignedTo: assignedTo || null,
      });
      if (!result.ok) {
        if (result.fieldErrors?.bodyMd) setFieldError(result.fieldErrors.bodyMd);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      reset();
      setComposing(false);
      router.refresh();
    });
  }

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
        noteTypes={noteTypes}
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
        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <ReferralNoteTypeManager
              commissionId={committeeId}
              noteTypes={noteTypes}
            />
          ) : null}
          {canCreate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (composing) reset();
                setComposing((prev) => !prev);
              }}
              aria-expanded={composing}
            >
              {composing ? (
                <>
                  <X aria-hidden="true" />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus aria-hidden="true" />
                  Adicionar registro
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="inline-flex items-start gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-pretty">
        <EyeOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Registros internos — visíveis apenas à sua comissão. A outra comissão e o
        NSP não têm acesso.
      </p>

      {canCreate && composing ? (
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4"
        >
          <h3 className="text-sm font-semibold">Novo registro</h3>

          {error ? <FormBanner tone="error">{error}</FormBanner> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Título <span className="font-normal">(opcional)</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD_CLASS}
                placeholder="Ex.: Alinhamento com a farmácia"
                disabled={isPending}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Tipo
              </span>
              <NativeSelect
                value={noteTypeId}
                onChange={(e) => setNoteTypeId(e.target.value)}
                disabled={isPending || noteTypes.length === 0}
                className="py-2"
              >
                <option value="">Sem tipo</option>
                {noteTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>

          {canManage && members.length > 0 ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Responsável <span className="font-normal">(opcional)</span>
              </span>
              <NativeSelect
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={isPending}
                className="py-2"
              >
                <option value="">Sem responsável</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName ?? "Membro"}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {/* `SectionTextEditor` owns the textarea, so the field label must point
                at it by id rather than wrap it. */}
            <label
              htmlFor="referral-new-note-body"
              className="text-xs font-medium text-muted-foreground"
            >
              Registro
            </label>
            <SectionTextEditor
              value={body}
              onChange={setBody}
              disabled={isPending}
              textareaId="referral-new-note-body"
              describedById={
                fieldError ? "referral-internal-note-error" : undefined
              }
              placeholder="Escreva este registro em Markdown… Visível apenas à sua comissão."
            />
            {fieldError ? (
              <span
                id="referral-internal-note-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </span>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              <Plus aria-hidden="true" />
              {isPending ? "Salvando…" : "Registrar"}
            </Button>
          </div>
        </form>
      ) : null}

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
    </section>
  );
}
