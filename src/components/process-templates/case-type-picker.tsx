"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tags } from "lucide-react";

import { setTemplateCaseType } from "@/lib/process-templates/actions";
import type { CaseType } from "@/lib/cases/case-types";
import {
  CONFIDENTIALITY_LEVEL_LABELS,
  VISIBILITY_POLICY_LABELS,
} from "@/lib/cases/case-types";
import { NativeSelect } from "@/components/ui/native-select";
import { useFieldIds } from "@/components/ui/field";

/**
 * The process "Tipo de caso" picker (ADR 0064 Decision 4).
 *
 * The template DECLARES a case type; every case created from it SNAPSHOTS that type
 * and inherits the type's default visibility + confidentiality. This is the channel
 * that makes an Ethics process open `explicit_grants_only` cases instead of cases
 * visible to the whole commission — before it existed, the type could not be set from
 * the app at all and the inherited posture never applied.
 *
 * DRAFT-ONLY since ADR 0137 **D14**, like {@link PatientModePicker} and every other
 * authoring control on that screen. ⛔ This block previously read *"Not draft-only …
 * a live untyped process must stay fixable"* and cited **ADR 0064 D4**.
 * ⚠ This comment then said that citation "never existed (ADR 0064 carries no
 * numbered decisions)" — MEASURED FALSE at QA (C-4): ADR 0064 carries `Decision 1`
 * … `Decision 4`, and Decision 4 is *"Dedicated `case_types` table (config
 * layer)"*. The conclusion survives on a corrected premise: Decision 4 defines the
 * TABLE and rules nothing about when the picker is editable, so the draft-gating
 * rule did live only in a comment and D14 is the first ratified rule on the
 * question. D14 accepts the named risk: a PUBLISHED process with no type is
 * re-drafted to be typed, not patched in place. Existing cases keep the posture
 * they snapshotted either way.
 *
 * `editable = false` renders the same card read-only — heading, explanation and the
 * inherited-posture summary all stay, because a published process's type is exactly
 * what a coordinator comes here to read.
 *
 * Persists immediately; optimistic with revert on failure.
 */
export function CaseTypePicker({
  templateVersionId,
  caseTypeId,
  caseTypes,
  editable = true,
}: {
  templateVersionId: string;
  /** The template's currently declared type, or `null` when untyped. */
  caseTypeId: string | null;
  /** The organization's ACTIVE case types (empty → the card explains and disables). */
  caseTypes: CaseType[];
  /**
   * Whether the declaration may be CHANGED — the builder passes the version's own
   * `editable` (`status === 'draft'`), mirroring {@link CustomFieldsCard}. `false`
   * renders the current type read-only. Default `true` keeps the component usable
   * standalone; the builder always passes an explicit value.
   *
   * ⚠ UX only. `set_template_case_type` refuses a non-draft version itself, so a
   * disagreement here would produce a pt-BR error, never a silent write.
   */
  editable?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(caseTypeId ?? "");
  const field = useFieldIds("template-case-type", { hasDescription: true });

  const current = caseTypes.find((t) => t.id === selected) ?? null;

  function change(next: string) {
    const prev = selected;
    setSelected(next);
    setError(null);
    startTransition(async () => {
      const res = await setTemplateCaseType(templateVersionId, next || null);
      if (!res.ok) {
        setSelected(prev);
        setError(res.error ?? "Não foi possível salvar o tipo de caso.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="template-case-type-heading"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id="template-case-type-heading"
          className="inline-flex items-center gap-2 text-lg font-semibold"
        >
          <Tags aria-hidden="true" className="size-4 text-muted-foreground" />
          Tipo de caso
        </h2>
        <p
          id={field.descriptionId}
          className="max-w-prose text-sm text-muted-foreground text-pretty"
        >
          Define o vocabulário e o nível de acesso padrão dos casos abertos por este
          processo. Aplica-se apenas a casos novos — casos já existentes mantêm o que
          foi definido na criação.
          {!editable && " Só pode ser alterado em uma versão em rascunho."}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {caseTypes.length === 0 && editable ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground text-pretty">
          Nenhum tipo de caso cadastrado nesta organização. Um administrador da
          organização pode cadastrá-los em Gestão da organização → Tipos de caso.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {editable ? (
            <>
              <label htmlFor={field.controlProps.id} className="text-sm font-medium">
                Tipo de caso deste processo
              </label>
              <NativeSelect
                id={field.controlProps.id}
                value={selected}
                disabled={isPending}
                aria-describedby={field.descriptionId}
                onChange={(e) => change(e.target.value)}
              >
                <option value="">Sem tipo definido</option>
                {caseTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </NativeSelect>
            </>
          ) : (
            // Read-only (published / archived version — ADR 0137 D14). A definition
            // list, NOT a disabled <select>: a disabled control invites a click that
            // does nothing and reads as broken, while dt/dd states the fact and
            // matches the inherited-posture summary directly below it.
            <dl className="flex flex-col gap-1">
              <dt className="text-sm font-medium">Tipo de caso deste processo</dt>
              <dd className="text-sm text-muted-foreground">
                {current?.displayName ?? "Sem tipo definido"}
              </dd>
            </dl>
          )}

          {current && (
            <dl className="mt-1 grid gap-1 rounded-lg bg-muted/60 px-3 py-2 text-xs sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Visibilidade padrão:</dt>
                <dd className="font-medium">
                  {VISIBILITY_POLICY_LABELS[current.defaultVisibilityPolicy]}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Confidencialidade:</dt>
                <dd className="font-medium">
                  {CONFIDENTIALITY_LEVEL_LABELS[current.defaultConfidentialityLevel]}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
