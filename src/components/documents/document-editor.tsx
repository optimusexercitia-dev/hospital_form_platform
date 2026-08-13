"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commissionHref } from "@/lib/routing";
import type { ControlledDocument, DocType } from "@/lib/controlled-documents/types";
import { DOC_TYPE_LABELS } from "@/lib/controlled-documents/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/ui/segmented";
import { TagField } from "@/components/ui/tag-field";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
// Type-only import of the server-action module — the action is passed in as a prop
// by the server page (WizardRunner boundary), so this client component never
// value-imports a `"use server"` module.
import type { ActionState } from "@/lib/controlled-documents/actions";

type UpdateAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = (
  ["policy", "sop", "protocol", "bylaws", "manual", "other"] as DocType[]
).map((value) => ({ value, label: DOC_TYPE_LABELS[value] }));

/**
 * The controlled-document header editor (Phase 17 v2, F-B — edit). One native
 * `<form>` posting title/type/category/tags/review-cycle to
 * `updateControlledDocument` via `useActionState`. Editable ONLY while the current
 * version is `draft` (HC089 otherwise). Category + tags are pre-filled and posted
 * on save — the RPC overwrites both, so omitting them would wipe the values the
 * create wizard set (ADR 0081 B4). The file lives on a version (detail page).
 *
 * The action is passed in as a prop (never value-imported); the post-save detail
 * href is built HERE via the pure, client-safe `commissionHref`.
 */
export function DocumentEditor({
  updateAction,
  commissionId,
  org,
  commission,
  listHref,
  existing,
}: {
  updateAction: UpdateAction;
  commissionId: string;
  org: string;
  commission: string;
  /** The register href (cancel target — a plain serializable string). */
  listHref: string;
  existing: ControlledDocument;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateAction, undefined);
  const doneRef = useRef(false);

  const [docType, setDocType] = useState<DocType>(existing.docType);
  const [tags, setTags] = useState<string[]>(existing.tags);

  const detailHref = commissionHref(
    org,
    commission,
    "manage",
    "documentos",
    existing.id,
  );

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      router.push(detailHref);
    }
  }, [state, router, detailHref]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="commissionId" value={commissionId} />
      <input type="hidden" name="documentId" value={existing.id} />
      {/* Mirror the controlled Segmented + TagField into hidden fields so they post. */}
      <input type="hidden" name="docType" value={docType} />
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />

      {state?.error && !state.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <section
        aria-labelledby="def-heading"
        className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="def-heading" className="text-lg font-semibold">
          Definição
        </h2>

        <Field>
          <FieldLabel htmlFor="title">Título do documento</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={existing.title}
            required
            maxLength={200}
            placeholder="Ex.: Política de higienização das mãos"
            aria-invalid={state?.fieldErrors?.title ? true : undefined}
            aria-describedby={state?.fieldErrors?.title ? "title-error" : undefined}
          />
          <FieldError id="title-error">{state?.fieldErrors?.title}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="docType-label" id="docType-label">
            Tipo
          </FieldLabel>
          <Segmented
            value={docType}
            options={DOC_TYPE_OPTIONS}
            onChange={setDocType}
            ariaLabel="Tipo de documento"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="category">Categoria</FieldLabel>
            <Input
              id="category"
              name="category"
              defaultValue={existing.category ?? ""}
              maxLength={120}
              placeholder="Ex.: Prevenção de infecção"
            />
            <FieldDescription>Opcional — agrupa documentos no registro.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="reviewCycleMonths">
              Ciclo de revisão (meses)
            </FieldLabel>
            <Input
              id="reviewCycleMonths"
              name="reviewCycleMonths"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              step={1}
              defaultValue={
                existing.reviewCycleMonths != null
                  ? String(existing.reviewCycleMonths)
                  : ""
              }
              placeholder="Ex.: 24"
              aria-describedby="reviewCycleMonths-description"
              aria-invalid={state?.fieldErrors?.reviewCycleMonths ? true : undefined}
            />
            <FieldDescription id="reviewCycleMonths-description">
              Opcional. Usado para calcular a data de revisão a partir da
              vigência.
            </FieldDescription>
            <FieldError>{state?.fieldErrors?.reviewCycleMonths}</FieldError>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description">Descrição</FieldLabel>
          {/* Native field with `name` → always posts (even blank). The RPC overwrites
              the column, so omitting it would wipe the value the wizard set (ADR 0081). */}
          <Textarea
            id="description"
            name="description"
            defaultValue={existing.description ?? ""}
            rows={3}
            maxLength={1000}
            placeholder="Ex.: Diretrizes de higienização das mãos aplicáveis a toda a unidade."
          />
          <FieldDescription>
            Opcional — um resumo do propósito do documento, exibido no cabeçalho.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="edit-tags">Etiquetas</FieldLabel>
          <TagField id="edit-tags" value={tags} onChange={setTags} />
          <FieldDescription>Opcional — pressione Enter para adicionar.</FieldDescription>
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={listHref}>Cancelar</a>
        </Button>
      </div>
    </form>
  );
}
