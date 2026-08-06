"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { UpdateUserProfileInput } from "@/lib/users/actions";
import { updateUserProfile } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";
import { CpfField } from "@/components/users/cpf-field";

/**
 * PERSON-LEVEL fields on the per-user management page (AFF W3/T3.3 — ADR 0097 D14).
 *
 * Everything here is a fact about the HUMAN — name, CPF, professional category — and
 * is therefore `org_admin`-only: two hospital admins editing the same person's name is
 * a silent cross-hospital write. Employment facts (which hospital, matrícula, start,
 * end) moved out to `AffiliationsPanel`, where a hospital's own admin owns them.
 *
 * ⚠ `canEditPersonFields` IS UX, NOT SECURITY (Architecture Rule 1). The boundary is
 * `updateUserProfile`, which re-derives the caller's authority server-side and compares
 * the submitted person-level values against the CURRENT row — only an actual CHANGE is
 * a person-level write — refusing with `MESSAGES.orgAdminOnly`. That refusal is
 * rendered by this component in pt-BR; hiding the controls only spares an admin the
 * pointless attempt. Never read the hidden state as the protection.
 *
 * ⚠ CPF IS WRITE-ONLY HERE, and that is deliberate (D7 / audit HIGH-1). `cpf` is
 * excluded from the `authenticated` column grants on `profiles`, so no admin surface
 * reads another person's CPF at all — the row policies admit co-commission members and
 * a national ID must not ride along on a colleague's row read. Leaving the field blank
 * keeps the stored value; the action only writes the column when the key is present.
 */
export function UserProfileEditForm({
  user,
  categories,
  canEditPersonFields,
}: {
  user: OrgUserDetail;
  categories: ProfessionalCategory[];
  /**
   * Whether the caller is an `org_admin` of this person's organisation. UX only —
   * see the component note above.
   */
  canEditPersonFields: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [categoryId, setCategoryId] = useState(
    user.professionalCategoryId ?? "",
  );
  const [cpf, setCpf] = useState("");

  const fullNameField = useFieldIds("fullName", {
    hasError: Boolean(fieldErrors.fullName),
    required: true,
  });
  const categoryField = useFieldIds("professionalCategoryId");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    const input: UpdateUserProfileInput = {
      userId: user.id,
      fullName: fullName.trim(),
      professionalCategoryId: categoryId || null,
      // Omit the key entirely when untouched: the action writes `cpf` only when it is
      // present, so an empty field can never null out a stored CPF.
      ...(cpf ? { cpf } : {}),
    };

    startTransition(async () => {
      const result = await updateUserProfile(input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar as alterações.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSuccess(true);
      setCpf("");
      router.refresh();
    });
  }

  // Read-only rendering for a caller who does not own these fields. No disabled form,
  // no submit that will be refused — the values are simply shown, with the reason.
  if (!canEditPersonFields) {
    return (
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="font-medium">E-mail</dt>
            <dd className="text-muted-foreground">
              {user.email ?? "Sem e-mail"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium">Nome completo</dt>
            <dd className="text-muted-foreground">
              {user.fullName?.trim() || "Sem nome"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium">Categoria profissional</dt>
            <dd className="text-muted-foreground">
              {user.categoryLabel ?? "Nenhuma"}
            </dd>
          </div>
        </dl>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground text-pretty">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Nome, CPF e categoria profissional são dados da pessoa, não do
          hospital, e só podem ser alterados por um administrador da organização.
          O vínculo com o seu hospital e a matrícula você gerencia abaixo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {success ? (
        <FormBanner tone="success">Perfil atualizado.</FormBanner>
      ) : (
        <FormBanner tone="error">{error}</FormBanner>
      )}

      <Field>
        <FieldLabel>E-mail</FieldLabel>
        <p className="text-sm text-muted-foreground">
          {user.email ?? "Sem e-mail"}
        </p>
      </Field>

      <Field>
        <FieldLabel htmlFor={fullNameField.controlProps.id}>
          Nome completo
        </FieldLabel>
        <Input
          {...fullNameField.controlProps}
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <FieldError id={fullNameField.errorId}>
          {fieldErrors.fullName}
        </FieldError>
      </Field>

      <CpfField
        value={cpf}
        onChange={setCpf}
        required={false}
        label="CPF"
        error={fieldErrors.cpf}
        description="Por privacidade, o CPF cadastrado não é exibido. Preencha apenas para substituí-lo; em branco, o valor atual é mantido."
      />

      <Field>
        <FieldLabel htmlFor={categoryField.controlProps.id}>
          Categoria profissional
        </FieldLabel>
        <NativeSelect
          {...categoryField.controlProps}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Nenhuma</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.labelPt}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Button type="submit" size="lg" className="self-start" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
