"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createReferralInternalNote,
  updateReferralInternalNote,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type { ReferralInternalNote } from "@/lib/referrals/types";
import {
  CASE_EVENT_KINDS,
  CASE_EVENT_KIND_LABELS,
  type CaseEventKind,
} from "@/lib/cases/registro-kinds";
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
import type { AssignableMember } from "./referral-assignment-panel";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a "Registro interno" — the referral-side mirror of the case detail's
 * {@link import('@/components/cases/case-event-form').CaseEventForm}: one DIALOG serving
 * both modes, opened from the panel's "Adicionar registro" button or a card's "Editar".
 *
 * ⚠ PLAIN TEXT, deliberately. A registro is free-text working notes, exactly like a case
 * "Registro" — there is no Markdown editor and no Markdown renderer on this surface. The
 * body is written in a bare `<textarea>` and read back through React text interpolation
 * with `whitespace-pre-wrap`, which ESCAPES its content. That makes Rule 7 (stored-XSS)
 * unconditionally satisfied here: the stored body is never parsed as markup on any path.
 * The storage column is still named `body_md` (no migration was in scope) — the NAME is
 * historical, the treatment is not. Do not reintroduce a Markdown renderer without also
 * reintroducing a sanitizing one.
 *
 * K-R5-1 is untouched: the committee side is fixed by the caller from the audited door's
 * own scoping, never chosen in this form.
 */
export function ReferralRegistroDialog(
  props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The viewer's-side roster for the assignee picker; `[]` when unavailable. */
    members: AssignableMember[];
    /** Whether the viewer COORDINATES this side and so may set an assignee. */
    canAssign: boolean;
  } & (
    | {
        mode: "create";
        referralId: string;
        /** The viewer's OWN committee side — the registro's owner (K-R5-1). */
        committeeId: string;
      }
    | { mode: "edit"; note: ReferralInternalNote }
  ),
) {
  const { open, onOpenChange, members, canAssign } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initial =
    props.mode === "edit"
      ? {
          title: props.note.title ?? "",
          body: props.note.bodyMd,
          kind: props.note.kind,
        }
      : { title: "", body: "", kind: "note" as CaseEventKind };

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [kind, setKind] = useState<CaseEventKind>(initial.kind);
  const [assignedTo, setAssignedTo] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed every field each time the dialog opens: a create dialog starts blank, an
  // edit dialog starts from the registro as it stands NOW (a stale draft from a
  // previous open would otherwise silently overwrite a newer body).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(initial.title);
      setBody(initial.body);
      setKind(initial.kind);
      setAssignedTo("");
      setFieldError(null);
      setError(null);
    }
  }

  const bodyId =
    props.mode === "edit"
      ? `referral-registro-body-${props.note.id}`
      : "referral-registro-body-new";
  const errorId = `${bodyId}-error`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (!body.trim()) {
      setFieldError(REFERRAL_MESSAGES.noteBodyRequired);
      return;
    }
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createReferralInternalNote({
              referralId: props.referralId,
              committeeId: props.committeeId,
              bodyMd: body.trim(),
              title: title.trim() || null,
              kind,
              assignedTo: assignedTo || null,
            })
          : await updateReferralInternalNote({
              noteId: props.note.id,
              title: title.trim() || null,
              bodyMd: body.trim(),
              kind,
            });
      if (!result.ok) {
        if (result.fieldErrors?.bodyMd) setFieldError(result.fieldErrors.bodyMd);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
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
          <DialogTitle>
            {props.mode === "create"
              ? "Adicionar registro"
              : "Editar registro"}
          </DialogTitle>
          <DialogDescription>
            Registre uma nota, reunião, decisão, atualização ou acompanhamento
            deste encaminhamento. Visível apenas à sua comissão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tipo</span>
            <NativeSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as CaseEventKind)}
              disabled={isPending}
              className="py-2"
            >
              {CASE_EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CASE_EVENT_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </label>

          {/* The assignee is set at CREATION only; an existing registro is reassigned
              from its own card's "Atribuir" menu, which is the surface the RPC gate
              (`assign_referral_note`) was built for. */}
          {props.mode === "create" && canAssign && members.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Responsável{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
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
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Título{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD_CLASS}
              disabled={isPending}
              placeholder="Ex.: Alinhamento com a farmácia"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Descrição</span>
            <textarea
              id={bodyId}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              className={FIELD_CLASS}
              disabled={isPending}
              placeholder="Descreva o registro…"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? errorId : undefined}
            />
            {fieldError && (
              <span
                id={errorId}
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </span>
            )}
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
              {isPending
                ? "Salvando…"
                : props.mode === "create"
                  ? "Adicionar"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
