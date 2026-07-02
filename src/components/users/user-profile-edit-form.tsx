"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { OrgUserDetail, ProfessionalCategory } from "@/lib/users/types";
import type { HospitalSummary } from "@/lib/queries/org";
import type { UpdateUserProfileInput } from "@/lib/users/actions";
import { updateUserProfile } from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Editable profile fields on the per-user management page (FE-3). Identity
 * e-mail is immutable here (per `UpdateUserProfileInput`'s shape). Driven by
 * `useTransition` since `updateUserProfile` is a plain typed function, not
 * `useActionState`-shaped.
 */
export function UserProfileEditForm({
  user,
  categories,
  hospitals,
}: {
  user: OrgUserDetail;
  categories: ProfessionalCategory[];
  hospitals: HospitalSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [categoryId, setCategoryId] = useState(user.professionalCategoryId ?? "");
  const [hospitalId, setHospitalId] = useState(user.homeHospitalId ?? "");
  const [employeeId, setEmployeeId] = useState(user.hospitalEmployeeId ?? "");

  const fullNameField = useFieldIds("fullName", {
    hasError: Boolean(fieldErrors.fullName),
  });
  const categoryField = useFieldIds("professionalCategoryId");
  const hospitalField = useFieldIds("homeHospitalId");
  const employeeIdField = useFieldIds("hospitalEmployeeId", {
    hasDescription: true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(false);

    const input: UpdateUserProfileInput = {
      userId: user.id,
      fullName: fullName.trim(),
      professionalCategoryId: categoryId || null,
      homeHospitalId: hospitalId || null,
      hospitalEmployeeId: employeeId.trim() || null,
    };

    startTransition(async () => {
      const result = await updateUserProfile(input);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível salvar as alterações.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSuccess(true);
      router.refresh();
    });
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

      <Field>
        <FieldLabel htmlFor={hospitalField.controlProps.id}>
          Hospital de origem
        </FieldLabel>
        <NativeSelect
          {...hospitalField.controlProps}
          value={hospitalId}
          onChange={(e) => setHospitalId(e.target.value)}
        >
          <option value="">Nenhum</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor={employeeIdField.controlProps.id}>
          Matrícula
        </FieldLabel>
        <Input
          {...employeeIdField.controlProps}
          type="text"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <FieldDescription id={employeeIdField.descriptionId}>
          Identificador funcional no hospital, se houver.
        </FieldDescription>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="self-start"
        disabled={isPending}
      >
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
