"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Lock, Send } from "lucide-react";

import {
  createReferralInternalNote,
  redactReferralNote,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type { ReferralInternalNote } from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { ReferralRedactDialog } from "./referral-redact-dialog";
import { formatDateTime } from "./format";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The PRIVATE per-committee internal-notes panel (RV2 R5) on the referral detail.
 * The security keystone (K-R5-1): a note belongs to exactly ONE committee side and
 * is readable ONLY by a member of THAT side — source members never read a
 * target-owned note and vice-versa, and QPS reads NEITHER. The server page loads the
 * caller's OWN-side notes via the audited `listReferralInternalNotes` door and passes
 * them here; the privacy is stated explicitly in the UI so an author is never misled
 * about who can see a note.
 *
 * Create: any member of `committeeId` (the viewer's side) may add a note. Redact
 * (append-only, `[redigido]`): a coordinator of the owning side only — the real body
 * is retained + audited, distinct from disposal.
 */
export function ReferralInternalNotesPanel({
  referralId,
  committeeId,
  notes,
  canCreate,
  canRedact,
}: {
  referralId: string;
  /** The viewer's OWN committee side (source OR target), or `null` when the viewer
   * belongs to neither side (e.g. QPS) — then notes are neither read nor written. */
  committeeId: string | null;
  notes: ReferralInternalNote[];
  /** Whether the viewer may create a note (a member of `committeeId`). */
  canCreate: boolean;
  /** Whether the viewer may redact a note (a coordinator of the owning side). */
  canRedact: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redacting, setRedacting] = useState<ReferralInternalNote | null>(null);

  // A viewer who belongs to neither side (QPS) sees nothing here — the door already
  // returns [] for them (K-R5-1); render nothing so no misleading empty panel shows.
  if (!committeeId) return null;

  const ordered = [...notes].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

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
      });
      if (!result.ok) {
        if (result.fieldErrors?.body) setFieldError(result.fieldErrors.body);
        else setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="referral-internal-notes-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <Lock aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="referral-internal-notes-heading"
          className="text-base font-semibold"
        >
          Notas internas
        </h2>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted-foreground tabular-nums">
          {notes.length}
        </span>
      </div>

      <p className="inline-flex items-start gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-pretty">
        <EyeOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Notas internas — visíveis apenas à sua comissão. A outra comissão e o NSP
        não têm acesso.
      </p>

      {ordered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma nota interna registrada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ordered.map((n) => {
            const redacted = Boolean(n.redactedAt);
            return (
              <li
                key={n.id}
                className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {n.authorName ?? "Membro"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
                {redacted ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground italic">
                    <EyeOff aria-hidden="true" className="size-3.5" />
                    [redigido]
                    {n.redactedReason ? ` — ${n.redactedReason}` : ""}
                  </p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-foreground text-pretty">
                    {n.bodyMd}
                  </p>
                )}
                {canRedact && !redacted && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRedacting(n)}
                    >
                      <EyeOff aria-hidden="true" />
                      Tarjar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canCreate && (
        <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="sr-only">Nova nota interna</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className={FIELD_CLASS}
              placeholder="Escreva uma nota visível apenas à sua comissão…"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={
                fieldError ? "referral-internal-note-error" : undefined
              }
            />
            {fieldError && (
              <span
                id="referral-internal-note-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </span>
            )}
          </label>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isPending}>
              <Send aria-hidden="true" />
              {isPending ? "Salvando…" : "Adicionar nota"}
            </Button>
          </div>
        </form>
      )}

      {canRedact && redacting && (
        <ReferralRedactDialog
          key={redacting.id}
          open={Boolean(redacting)}
          onOpenChange={(open) => !open && setRedacting(null)}
          kind="note"
          onRedact={(reason) =>
            redactReferralNote({ noteId: redacting.id, reason })
          }
        />
      )}
    </section>
  );
}
