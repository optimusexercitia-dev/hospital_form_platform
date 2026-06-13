"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { SectionSignoff } from "./types";
import { SignoffStatus } from "./signoff-status";

/**
 * The sign affordance attached to a `staff_admin`-role sign-off section on the
 * review-and-sign screen (F2). Optional note → `signSection({responseId,
 * sectionId, note})`. On success the section shows the F4 "assinado por você em
 * DATA" badge and the page refreshes so the response leaves the queue. A server
 * rejection (RLS signer-role, P0014 not-visible, P0015 already-signed) is
 * surfaced as a pt-BR banner — raw PG errors never reach the UI.
 *
 * The action is injected as a prop (route-page adapter, the `WizardRunner`
 * pattern) so this component stays decoupled from B3's exact signature.
 */
export function SignSectionPanel({
  responseId,
  sectionId,
  existing,
  onSign,
}: {
  responseId: string;
  sectionId: string;
  /** Existing sign-off for this section, if already signed. */
  existing: SectionSignoff | null;
  onSign: (input: {
    responseId: string;
    sectionId: string;
    note: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed (loaded from the server or just signed this session): show
  // the canonical metadata, no form.
  if (existing) {
    return (
      <SignoffStatus signoff={existing} role="staff_admin" className="mt-1" />
    );
  }

  const noteId = `signoff-note-${sectionId}`;

  async function handleSign() {
    setSaving(true);
    setError(null);
    const trimmed = note.trim();
    const result = await onSign({
      responseId,
      sectionId,
      note: trimmed === "" ? null : trimmed,
    });
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error ?? "Não foi possível registrar a assinatura. Tente novamente.",
      );
      return;
    }
    // Success: refresh so the server re-reads (the row now exists and the
    // response leaves the queue).
    router.refresh();
  }

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold">Assinatura da chefia</h4>
        <p className="text-sm text-muted-foreground text-pretty">
          Ao assinar, você confirma a revisão desta seção. A resposta só poderá
          ser enviada após esta assinatura.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}

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
          placeholder="Ex.: revisado e de acordo."
          className="resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSign}
          disabled={saving}
          aria-busy={saving || undefined}
        >
          <PenLine aria-hidden="true" />
          {saving ? "Assinando…" : "Assinar seção"}
        </Button>
      </div>
    </div>
  );
}
