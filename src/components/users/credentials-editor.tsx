"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Plus } from "lucide-react";

import type { ProfessionalCredential } from "@/lib/users/types";
import type { CredentialInput } from "@/lib/users/actions";
import { upsertCredential, removeCredential } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, useFieldIds } from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EMPTY_DRAFT: CredentialInput = {
  issuingCountry: "BR",
  issuingState: "",
  issuingAuthority: "",
  registrationNumber: "",
  expiresOn: null,
};

/**
 * Repeating professional-credentials sub-form (plan Q5), shared shape between:
 * - `mode="collect"` (FE-2, register form): no user yet — rows live in local
 *   state and bubble up via `onChange` as `CredentialInput[]`, batched into
 *   `RegisterUserInput.credentials`.
 * - `mode="live"` (FE-3, manage page): `userId` is required — add/edit calls
 *   `upsertCredential` directly, remove calls `removeCredential`, each via
 *   `useTransition` (contract-first stubs are plain typed functions, not
 *   `useActionState`-shaped). Editing an existing credential CLEARS its
 *   `verifiedAt` server-side — shown here as a note, never hidden.
 */
export function CredentialsEditor({
  mode,
  userId,
  credentials,
  onChange,
}: {
  mode: "collect" | "live";
  /** Required when `mode === "live"`. */
  userId?: string;
  /** `live`: full `ProfessionalCredential[]` (has id/verifiedAt). `collect`: plain drafts. */
  credentials: ProfessionalCredential[] | CredentialInput[];
  onChange?: (next: CredentialInput[]) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CredentialInput>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CredentialInput>(EMPTY_DRAFT);

  const isLive = mode === "live";
  const rows = credentials as (ProfessionalCredential & Partial<CredentialInput>)[];

  function resetAddForm() {
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  }

  function commitAdd() {
    if (!draft.issuingState || !draft.issuingAuthority || !draft.registrationNumber) {
      setError("Preencha estado, órgão emissor e número de registro.");
      return;
    }
    setError(null);

    if (!isLive) {
      const next = [...(credentials as CredentialInput[]), draft];
      onChange?.(next);
      resetAddForm();
      return;
    }

    if (!userId) return;
    startTransition(async () => {
      const result = await upsertCredential({ ...draft, userId });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar a credencial.");
        return;
      }
      resetAddForm();
      router.refresh();
    });
  }

  function commitEditSave(id: string) {
    if (!isLive || !userId) return;
    setError(null);
    startTransition(async () => {
      const result = await upsertCredential({ ...editDraft, userId, id });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar a credencial.");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function commitRemove(index: number, id?: string) {
    if (!isLive) {
      const next = (credentials as CredentialInput[]).filter((_, i) => i !== index);
      onChange?.(next);
      return;
    }
    if (!id) return;
    setError(null);
    startTransition(async () => {
      const result = await removeCredential(id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover a credencial.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {rows.length === 0 && !adding ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground text-pretty">
          Nenhum registro profissional cadastrado.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((c, index) => {
            const key = c.id ?? `draft-${index}`;
            const isEditing = isLive && editingId === c.id;
            if (isEditing) {
              return (
                <li
                  key={key}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <CredentialFields
                    draft={editDraft}
                    setDraft={setEditDraft}
                    idPrefix={`edit-${c.id}`}
                    disabled={isPending}
                  />
                  <p className="mt-2 text-xs text-muted-foreground text-pretty">
                    Editar limpa a verificação atual desta credencial.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => c.id && commitEditSave(c.id)}
                    >
                      {isPending ? "Salvando…" : "Salvar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </li>
              );
            }
            return (
              <li
                key={key}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.issuingAuthority} {c.registrationNumber}
                    {c.verifiedAt ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-medium text-accent-foreground"
                        title={`Verificado em ${formatDate(c.verifiedAt)}`}
                      >
                        <BadgeCheck aria-hidden="true" className="size-3" />
                        Verificado
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.issuingState} · {c.issuingCountry}
                    {c.expiresOn
                      ? ` · válido até ${formatDate(c.expiresOn)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {isLive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        setEditingId(c.id ?? null);
                        setEditDraft({
                          issuingCountry: c.issuingCountry,
                          issuingState: c.issuingState,
                          issuingAuthority: c.issuingAuthority,
                          registrationNumber: c.registrationNumber,
                          expiresOn: c.expiresOn,
                        });
                      }}
                    >
                      Editar
                    </Button>
                  ) : null}
                  <RemoveCredentialButton
                    label={`${c.issuingAuthority} ${c.registrationNumber}`}
                    isPending={isPending}
                    onConfirm={() => commitRemove(index, c.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <CredentialFields
            draft={draft}
            setDraft={setDraft}
            idPrefix="new"
            disabled={isPending}
          />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={commitAdd}
            >
              {isPending ? "Salvando…" : "Adicionar credencial"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={resetAddForm}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar registro profissional
        </Button>
      )}
    </div>
  );
}

function CredentialFields({
  draft,
  setDraft,
  idPrefix,
  disabled,
}: {
  draft: CredentialInput;
  setDraft: (next: CredentialInput) => void;
  idPrefix: string;
  disabled: boolean;
}) {
  const countryField = useFieldIds(`${idPrefix}-issuingCountry`);
  const stateField = useFieldIds(`${idPrefix}-issuingState`);
  const authorityField = useFieldIds(`${idPrefix}-issuingAuthority`);
  const numberField = useFieldIds(`${idPrefix}-registrationNumber`);
  const expiresField = useFieldIds(`${idPrefix}-expiresOn`);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={countryField.controlProps.id}>País</FieldLabel>
        <Input
          {...countryField.controlProps}
          value={draft.issuingCountry}
          disabled={disabled}
          onChange={(e) =>
            setDraft({ ...draft, issuingCountry: e.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={stateField.controlProps.id}>
          Estado (UF)
        </FieldLabel>
        <Input
          {...stateField.controlProps}
          value={draft.issuingState}
          disabled={disabled}
          placeholder="SP"
          required
          onChange={(e) =>
            setDraft({ ...draft, issuingState: e.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={authorityField.controlProps.id}>
          Órgão emissor
        </FieldLabel>
        <Input
          {...authorityField.controlProps}
          value={draft.issuingAuthority}
          disabled={disabled}
          placeholder="CRM, COREN, CRF…"
          required
          onChange={(e) =>
            setDraft({ ...draft, issuingAuthority: e.target.value })
          }
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={numberField.controlProps.id}>
          Número de registro
        </FieldLabel>
        <Input
          {...numberField.controlProps}
          value={draft.registrationNumber}
          disabled={disabled}
          required
          onChange={(e) =>
            setDraft({ ...draft, registrationNumber: e.target.value })
          }
        />
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={expiresField.controlProps.id}>
          Validade (opcional)
        </FieldLabel>
        <Input
          {...expiresField.controlProps}
          type="date"
          value={draft.expiresOn ?? ""}
          disabled={disabled}
          onChange={(e) =>
            setDraft({ ...draft, expiresOn: e.target.value || null })
          }
        />
      </Field>
    </div>
  );
}

function RemoveCredentialButton({
  label,
  isPending,
  onConfirm,
}: {
  label: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remover credencial ${label}`}
        >
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover credencial?</AlertDialogTitle>
          <AlertDialogDescription>
            O registro profissional {label} será removido. Esta ação pode ser
            desfeita cadastrando a credencial novamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {isPending ? "Removendo…" : "Remover"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Formats an ISO date (YYYY-MM-DD or full timestamp) as pt-BR, or the raw value if unparseable. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
