"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { setTemplateCollectsPatient } from "@/lib/cases/actions";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useFieldIds } from "@/components/ui/field";

/**
 * The process "Coletar identificação do paciente" toggle (ADR 0038 — the THIRD
 * PHI module; draft-only). When ON (and the `case_patient` feature flag is on),
 * cases minted from this process OFFER an optional patient-identifier block at
 * creation and a reveal panel on the case detail. The flag is SNAPSHOTTED into
 * `cases.patient_enabled` at creation (immutable per case), so toggling here only
 * affects FUTURE cases. Default OFF — existing/other processes stay PHI-free.
 *
 * Persists immediately via `setTemplateCollectsPatient` (a draft-only DEFINER
 * setter; the shell mounts this for drafts only, mirroring {@link ProcessOutcomesPicker}).
 * The control is optimistic + reverts on failure; the route refreshes on success.
 *
 * Only rendered when the global `case_patient` flag is on — when off, the platform
 * is byte-identical to before this feature (the shell omits this section entirely).
 */
export function CollectsPatientPicker({
  templateId,
  collectsPatient,
}: {
  templateId: string;
  /** The template's current `collects_patient` config (drives the toggle). */
  collectsPatient: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collects, setCollects] = useState(collectsPatient);
  const field = useFieldIds("collects-patient", { hasDescription: true });

  function toggle(next: boolean) {
    const prev = collects;
    setCollects(next);
    setError(null);
    startTransition(async () => {
      const res = await setTemplateCollectsPatient(templateId, next);
      if (!res.ok) {
        setCollects(prev);
        setError(
          res.error ?? "Não foi possível salvar a configuração de identificação.",
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="collects-patient-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id="collects-patient-heading"
          className="inline-flex items-center gap-2 text-lg font-semibold"
        >
          <ShieldAlert aria-hidden="true" className="size-4 text-muted-foreground" />
          Identificação do paciente
        </h2>
        <p id={field.descriptionId} className="max-w-prose text-sm text-muted-foreground text-pretty">
          Permite registrar identificadores do paciente (nome, prontuário, entre
          outros) nos casos criados a partir deste processo. Os dados são sensíveis,
          ficam isolados e todo acesso é registrado em auditoria. Aplica-se apenas a
          casos novos.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <label
        className={cn(
          "flex items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-accent/40",
          isPending && "opacity-70",
        )}
      >
        <Checkbox
          checked={collects}
          onCheckedChange={(v) => toggle(v === true)}
          disabled={isPending}
          aria-describedby={field.descriptionId}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Coletar identificação do paciente</span>
          <span className="text-xs text-muted-foreground text-pretty">
            Quando ativado, o formulário de criação de caso oferece um bloco
            opcional de identificação do paciente.
          </span>
        </span>
      </label>
    </section>
  );
}
