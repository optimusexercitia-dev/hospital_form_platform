"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

import type { SignoffRole } from "@/lib/queries/forms";
import { Button } from "@/components/ui/button";
import { SignoffStatus } from "@/components/signoffs/signoff-status";
import type { SectionSignoff } from "@/components/signoffs/types";

/**
 * The respondent sign-off affordance on the wizard review screen (F3). For a
 * visible `requires_signoff` section:
 *  - `respondent` role + unsigned → an explicit "Assinar e confirmar esta
 *    seção" action (optional note) that records the sign-off; once signed it
 *    shows the F4 "Assinado por você em DATA" badge.
 *  - `staff_admin` role → status only ("Pendente — chefia" / signed), since the
 *    coordinator signs from the queue (F2), not here.
 *
 * Submission is gated by the parent until every visible sign-off section has a
 * row; the server (`submit_response` P0012) stays the authority.
 */
export function RespondentSignoff({
  role,
  signoff,
  saving,
  onSign,
}: {
  role: SignoffRole | null;
  signoff: SectionSignoff | null;
  saving: boolean;
  onSign: (note: string | null) => void;
}) {
  const [note, setNote] = useState("");

  // Signed (by anyone) → the canonical badge. `isRespondent` is irrelevant once
  // signed; for the pending label below it drives the role-aware copy.
  if (signoff) {
    return <SignoffStatus signoff={signoff} role={role} />;
  }

  // staff_admin sections are signed via the queue — show status only here.
  if (role !== "respondent") {
    return <SignoffStatus signoff={null} role={role} />;
  }

  const noteId = `respondent-signoff-note`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Sua assinatura é necessária</h3>
        <p className="text-sm text-muted-foreground text-pretty">
          Confirme que revisou esta seção. A resposta só poderá ser enviada após
          a sua assinatura.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium">
          Observação{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
          rows={2}
          maxLength={500}
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            const trimmed = note.trim();
            onSign(trimmed === "" ? null : trimmed);
          }}
          disabled={saving}
          aria-busy={saving || undefined}
        >
          <PenLine aria-hidden="true" />
          Assinar e confirmar esta seção
        </Button>
      </div>
    </div>
  );
}
