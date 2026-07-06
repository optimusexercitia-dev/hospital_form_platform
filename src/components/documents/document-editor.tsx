"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commissionHref } from "@/lib/routing";
import type { ControlledDocument, DocType } from "@/lib/documents/types";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
// Type-only imports of the server-action module — the action functions are passed
// in as props by the server page (the WizardRunner boundary pattern), so this
// client component never value-imports a `"use server"` module.
import type {
  ActionState,
  CreateDocumentState,
} from "@/lib/documents/actions";

type CreateAction = (
  prev: CreateDocumentState | undefined,
  formData: FormData,
) => Promise<CreateDocumentState>;
type UpdateAction = (
  prev: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

const DOC_TYPES: DocType[] = [
  "politica",
  "pop",
  "protocolo",
  "regimento",
  "manual",
  "outro",
];

/**
 * The controlled-document editor (Phase 17, F2). One native `<form>` posting the
 * header metadata (title, type, review-cycle) to `createControlledDocument` (or
 * `updateDocument` when editing) via `useActionState`. Coordinator-only screen —
 * the RPC is the write authority; this is the UX.
 *
 * The document's FILE is uploaded separately as a VERSION (`addDocumentVersion`,
 * an atomic upload) from the detail view — a header carries no file, its current
 * version does. So creating a document lands on the detail page where the author
 * uploads the first version.
 *
 * Actions are passed in as props (never value-imported here); the post-create
 * detail href is built HERE via the pure, client-safe `commissionHref` — a
 * function/closure must never cross the server→client boundary (BUG-QI-001).
 */
export function DocumentEditor({
  createAction,
  updateAction,
  commissionId,
  org,
  commission,
  listHref,
  existing,
}: {
  createAction?: CreateAction;
  updateAction?: UpdateAction;
  commissionId: string;
  org: string;
  commission: string;
  /** The register href (cancel target — a plain serializable string). */
  listHref: string;
  /** When present, the editor updates this document's header instead of creating. */
  existing?: ControlledDocument;
}) {
  const router = useRouter();
  const isEditing = Boolean(existing);

  const detailHref = (documentId: string) =>
    commissionHref(org, commission, "manage", "documentos", documentId);

  if (isEditing) {
    return (
      <EditForm
        updateAction={updateAction!}
        commissionId={commissionId}
        existing={existing!}
        listHref={listHref}
        onDone={() => router.push(detailHref(existing!.id))}
      />
    );
  }
  return (
    <CreateForm
      createAction={createAction!}
      commissionId={commissionId}
      listHref={listHref}
      onCreated={(id) => router.push(detailHref(id))}
    />
  );
}

function CreateForm({
  createAction,
  commissionId,
  listHref,
  onCreated,
}: {
  createAction: CreateAction;
  commissionId: string;
  listHref: string;
  onCreated: (id: string) => void;
}) {
  const [state, formAction, pending] = useActionState(createAction, undefined);
  const createdRef = useRef(false);

  useEffect(() => {
    if (state?.ok && state.documentId && !createdRef.current) {
      createdRef.current = true;
      onCreated(state.documentId);
    }
  }, [state, onCreated]);

  return (
    <EditorFields
      formAction={formAction}
      pending={pending}
      error={state?.error}
      fieldErrors={state?.fieldErrors}
      commissionId={commissionId}
      submitLabel="Criar documento"
      listHref={listHref}
    />
  );
}

function EditForm({
  updateAction,
  commissionId,
  existing,
  listHref,
  onDone,
}: {
  updateAction: UpdateAction;
  commissionId: string;
  existing: ControlledDocument;
  listHref: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateAction, undefined);
  const doneRef = useRef(false);

  useEffect(() => {
    if (state?.ok && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [state, onDone]);

  return (
    <EditorFields
      formAction={formAction}
      pending={pending}
      error={state?.error}
      fieldErrors={state?.fieldErrors}
      commissionId={commissionId}
      submitLabel="Salvar alterações"
      listHref={listHref}
      existing={existing}
    />
  );
}

function EditorFields({
  formAction,
  pending,
  error,
  fieldErrors,
  commissionId,
  submitLabel,
  listHref,
  existing,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  commissionId: string;
  submitLabel: string;
  listHref: string;
  existing?: ControlledDocument;
}) {
  const [docType, setDocType] = useState<DocType>(existing?.docType ?? "pop");

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="commissionId" value={commissionId} />
      {existing ? (
        <input type="hidden" name="documentId" value={existing.id} />
      ) : null}
      {/* Mirror the controlled select into a hidden field so it always posts. */}
      <input type="hidden" name="docType" value={docType} />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section
        aria-labelledby="def-heading"
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="def-heading" className="text-lg font-semibold">
          Definição
        </h2>

        <Field>
          <FieldLabel htmlFor="title">Título do documento</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={existing?.title ?? ""}
            required
            maxLength={200}
            placeholder="Ex.: Política de higienização das mãos"
            aria-invalid={fieldErrors?.title ? true : undefined}
            aria-describedby={fieldErrors?.title ? "title-error" : undefined}
          />
          <FieldError id="title-error">{fieldErrors?.title}</FieldError>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="docType">Tipo</FieldLabel>
            <NativeSelect
              id="docType"
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
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
                existing?.reviewCycleMonths != null
                  ? String(existing.reviewCycleMonths)
                  : ""
              }
              placeholder="Ex.: 24"
              aria-describedby="reviewCycleMonths-description"
              aria-invalid={fieldErrors?.reviewCycleMonths ? true : undefined}
            />
            <FieldDescription id="reviewCycleMonths-description">
              Opcional. Usado para calcular a data de revisão a partir da
              vigência.
            </FieldDescription>
            <FieldError>{fieldErrors?.reviewCycleMonths}</FieldError>
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <a href={listHref}>Cancelar</a>
        </Button>
      </div>
    </form>
  );
}
