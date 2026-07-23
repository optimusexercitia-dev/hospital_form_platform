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

/** Whether the three required trio fields (UF, órgão emissor, número) are filled. */
function isDraftComplete(draft: CredentialInput): boolean {
  return Boolean(
    draft.issuingState.trim() &&
      draft.issuingAuthority.trim() &&
      draft.registrationNumber.trim(),
  );
}

/**
 * Whether the draft has ANY user input across the fields that matter for the
 * "partially filled" hint. `issuingCountry` defaults to "BR" and is excluded —
 * it must never count as "the user started typing" on its own.
 */
function hasAnyDraftInput(draft: CredentialInput): boolean {
  return Boolean(
    draft.issuingState.trim() ||
      draft.issuingAuthority.trim() ||
      draft.registrationNumber.trim() ||
      draft.expiresOn,
  );
}

/**
 * Single professional-registry editor (plan Q5 amendment — UI-only; the
 * backend stays 1→N via `professional_credentials`, and `CredentialFields` /
 * `upsertCredential` / `removeCredential` are unchanged). Configures exactly
 * ONE optional registry:
 * - `mode="collect"` (register-user form, no user yet): one inline,
 *   always-visible, optional `CredentialFields` block. Bubbles up
 *   `onChange([draft])` only when the required trio (UF + órgão emissor +
 *   número) is complete, `onChange([])` otherwise — so the parent's
 *   `RegisterUserInput.credentials` payload stays valid-or-empty even
 *   mid-typing.
 * - `mode="live"` (per-user manage page): the FIRST credential renders as a
 *   read-only summary card (Editar reveals the inline fields →
 *   `upsertCredential`, which always clears `verifiedAt`; Remover → the
 *   existing confirm dialog → `removeCredential`). Zero credentials shows a
 *   dashed empty state with a single "Cadastrar registro profissional"
 *   button. Legacy multi-credential users still see credentials 2..n, listed
 *   read-only under a muted note, so an admin can converge to one without any
 *   backend change.
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
  /** `live`: full `ProfessionalCredential[]` (has id/verifiedAt). `collect`: plain drafts (0 or 1). */
  credentials: ProfessionalCredential[] | CredentialInput[];
  onChange?: (next: CredentialInput[]) => void;
}) {
  if (mode === "collect") {
    return <CollectRegistry onChange={onChange} />;
  }
  return (
    <LiveRegistry
      userId={userId}
      credentials={credentials as ProfessionalCredential[]}
    />
  );
}

/** `mode="collect"` — the register-user form's inline, optional single registry. */
function CollectRegistry({
  onChange,
}: {
  onChange?: (next: CredentialInput[]) => void;
}) {
  const [draft, setDraft] = useState<CredentialInput>(EMPTY_DRAFT);

  function handleChange(next: CredentialInput) {
    setDraft(next);
    onChange?.(isDraftComplete(next) ? [next] : []);
  }

  const showHint = hasAnyDraftInput(draft) && !isDraftComplete(draft);

  return (
    <div className="flex flex-col gap-3">
      <CredentialFields
        draft={draft}
        setDraft={handleChange}
        idPrefix="collect"
        disabled={false}
      />
      {showHint ? (
        <FormBanner tone="info">
          Preencha também estado, órgão emissor e número de registro para
          incluir o registro profissional — ou deixe os três em branco.
        </FormBanner>
      ) : null}
    </div>
  );
}

/** `mode="live"` — the per-user manage page's single-registry editor + legacy overflow. */
function LiveRegistry({
  userId,
  credentials,
}: {
  userId?: string;
  credentials: ProfessionalCredential[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState<CredentialInput>(EMPTY_DRAFT);

  const primary = credentials[0] ?? null;
  const legacy = credentials.slice(1);
  const editingId = formOpen === "edit" ? (primary?.id ?? undefined) : undefined;

  function openAdd() {
    setError(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen("add");
  }

  function openEdit(credential: ProfessionalCredential) {
    setError(null);
    setDraft({
      issuingCountry: credential.issuingCountry,
      issuingState: credential.issuingState,
      issuingAuthority: credential.issuingAuthority,
      registrationNumber: credential.registrationNumber,
      expiresOn: credential.expiresOn,
    });
    setFormOpen("edit");
  }

  function commitSave(id?: string) {
    if (!userId) return;
    if (!isDraftComplete(draft)) {
      setError("Preencha estado, órgão emissor e número de registro.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await upsertCredential({ ...draft, userId, id });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar o registro.");
        return;
      }
      setFormOpen(null);
      router.refresh();
    });
  }

  function commitRemove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCredential(id);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível remover o registro.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {formOpen ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <CredentialFields
            draft={draft}
            setDraft={setDraft}
            idPrefix={formOpen}
            disabled={isPending}
          />
          {formOpen === "edit" ? (
            <p className="mt-2 text-xs text-muted-foreground text-pretty">
              Editar limpa a verificação atual deste registro.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => commitSave(editingId)}
            >
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setFormOpen(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : primary ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {primary.issuingAuthority} {primary.registrationNumber}
              {primary.verifiedAt ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-medium text-accent-foreground"
                  title={`Verificado em ${formatDate(primary.verifiedAt)}`}
                >
                  <BadgeCheck aria-hidden="true" className="size-3" />
                  Verificado
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {primary.issuingState} · {primary.issuingCountry}
              {primary.expiresOn
                ? ` · válido até ${formatDate(primary.expiresOn)}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => openEdit(primary)}
            >
              Editar
            </Button>
            <RemoveCredentialButton
              label={`${primary.issuingAuthority} ${primary.registrationNumber}`}
              isPending={isPending}
              onConfirm={() => commitRemove(primary.id)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground text-pretty">
            Nenhum registro profissional cadastrado.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={openAdd}>
            <Plus aria-hidden="true" />
            Cadastrar registro profissional
          </Button>
        </div>
      )}

      {legacy.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground text-pretty">
            Registros adicionais — este cadastro passou a ter um único
            registro; os registros abaixo permanecem visíveis até serem
            removidos.
          </p>
          <ul className="flex flex-col gap-2">
            {legacy.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.issuingAuthority} {c.registrationNumber}
                  </span>{" "}
                  · {c.issuingState} · {c.issuingCountry}
                </div>
                <RemoveCredentialButton
                  label={`${c.issuingAuthority} ${c.registrationNumber}`}
                  isPending={isPending}
                  onConfirm={() => commitRemove(c.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
