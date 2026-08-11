"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserCog } from "lucide-react";

import type { CaseType } from "@/lib/cases/case-types";
import {
  PARTICIPANT_TYPES,
  PARTICIPANT_TYPE_LABELS,
  type ParticipantType,
} from "@/lib/forms/reference-constants";
import {
  createCaseParticipantRole,
  setCaseParticipantRoleActive,
  updateCaseParticipantRole,
  type CaseParticipantRoleInput,
} from "@/lib/vocabulary/actions";
// Type-only, therefore fully erased at compile time — a client module may not
// pull a VALUE from a `server-only` module (`lint:client-server-imports`).
import type { CaseParticipantRoleAdminRow } from "@/lib/queries/participants";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";

/**
 * The org_admin's `case_participant_roles` vocabulary surface (ETH·E4 §4;
 * ADR 0108). A role is what a case's roster offers on the "Papel" select — the
 * seven seeded roles (`respondent_doctor` → "Médico denunciado", `complainant`
 * → "Denunciante", …) become editable in-app here for the first time.
 *
 * Reuses the platform's canonical, SQL-mirrored `PARTICIPANT_TYPES` /
 * `PARTICIPANT_TYPE_LABELS` (`@/lib/forms/reference-constants`) for the
 * "tipos aceitos" checkboxes — the same vocabulary `ReferenceConfigEditor`
 * offers the form builder, so this never drifts into a second, invented list
 * (the mistake corrected in `add-participant-dialog.tsx`'s free-text
 * `professionalType` field: only build a picker over a vocabulary that
 * genuinely exists in the schema).
 *
 * No delete — only Ativar/Desativar. `case_participants.role_id` FKs a role
 * row, so removing one would either fail on the constraint or orphan seated
 * participants; `key` is IMMUTABLE once created (`trg_guard_case_participant_role_key`
 * refuses any change, `HC0F3`, because `app.is_case_respondent` resolves the
 * exclusion through `key = 'respondent_doctor'`) — the edit dialog renders it
 * read-only outside create.
 */
export function CaseParticipantRoleManager({
  organizationId,
  caseTypes,
  roles,
}: {
  organizationId: string;
  /** For the optional "restringir a um tipo de caso" scoping select. */
  caseTypes: CaseType[];
  /** Active AND inactive — the admin list shows both (unlike the `Papel` picker's read). */
  roles: CaseParticipantRoleAdminRow[];
}) {
  const active = roles.filter((r) => r.isActive);
  const inactive = roles.filter((r) => !r.isActive);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog aria-hidden="true" className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Papéis ativos
          </h3>
        </div>
        <CaseParticipantRoleDialog
          mode="create"
          organizationId={organizationId}
          caseTypes={caseTypes}
        />
      </div>

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground text-pretty">
          Nenhum papel cadastrado. Um papel define a função que um
          participante pode exercer em um caso (ex.: &quot;Médico
          denunciado&quot;, &quot;Denunciante&quot;).
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((r, i) => (
            <CaseParticipantRoleRow
              key={r.id}
              role={r}
              index={i}
              organizationId={organizationId}
              caseTypes={caseTypes}
            />
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <section
          aria-labelledby="retired-participant-roles"
          className="flex flex-col gap-3"
        >
          <h3
            id="retired-participant-roles"
            className="text-sm font-medium text-muted-foreground"
          >
            Papéis desativados
          </h3>
          <ul className="flex flex-col gap-3">
            {inactive.map((r, i) => (
              <CaseParticipantRoleRow
                key={r.id}
                role={r}
                index={i}
                organizationId={organizationId}
                caseTypes={caseTypes}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CaseParticipantRoleRow({
  role,
  index,
  organizationId,
  caseTypes,
}: {
  role: CaseParticipantRoleAdminRow;
  index: number;
  organizationId: string;
  caseTypes: CaseType[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const scopeType = role.caseTypeId
    ? (caseTypes.find((t) => t.id === role.caseTypeId) ?? null)
    : null;

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const res = await setCaseParticipantRoleActive(
        organizationId,
        role.id,
        !role.isActive,
      );
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:items-start sm:justify-between"
      style={{ "--rise-delay": `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold">{role.displayName}</h4>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {role.key}
          </code>
          {!role.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Desativado
            </span>
          )}
          {role.isPrimarySubjectCandidate && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Pode ser sujeito principal
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {role.allowedParticipantTypes.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {PARTICIPANT_TYPE_LABELS[t]}
            </span>
          ))}
        </div>

        {scopeType && (
          <p className="text-xs text-muted-foreground">
            Restrito ao tipo de caso: {scopeType.displayName}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <CaseParticipantRoleDialog
          mode="edit"
          organizationId={organizationId}
          caseTypes={caseTypes}
          role={role}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={toggleActive}
        >
          {role.isActive ? "Desativar" : "Ativar"}
        </Button>
      </div>
    </li>
  );
}

const EMPTY_ROLE_INPUT: CaseParticipantRoleInput = {
  key: "",
  displayName: "",
  allowedParticipantTypes: [],
  isPrimarySubjectCandidate: false,
  caseTypeId: null,
};

function CaseParticipantRoleDialog({
  mode,
  organizationId,
  caseTypes,
  role,
}: {
  mode: "create" | "edit";
  organizationId: string;
  caseTypes: CaseType[];
  role?: CaseParticipantRoleAdminRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<CaseParticipantRoleInput>(
    role
      ? {
          key: role.key,
          displayName: role.displayName,
          allowedParticipantTypes: role.allowedParticipantTypes,
          isPrimarySubjectCandidate: role.isPrimarySubjectCandidate,
          caseTypeId: role.caseTypeId,
        }
      : EMPTY_ROLE_INPUT,
  );

  const keyField = useFieldIds("role-key", { hasDescription: true });
  const nameField = useFieldIds("role-name");
  const scopeField = useFieldIds("role-scope");

  function toggleType(type: ParticipantType, checked: boolean) {
    const set = new Set(draft.allowedParticipantTypes);
    if (checked) set.add(type);
    else set.delete(type);
    // Preserve the canonical order (matches `ReferenceConfigEditor`'s rule) so
    // two admins ticking the same boxes produce the same stored array.
    setDraft({
      ...draft,
      allowedParticipantTypes: PARTICIPANT_TYPES.filter((t) => set.has(t)),
    });
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createCaseParticipantRole(organizationId, draft)
          : await updateCaseParticipantRole(organizationId, role!.id, draft);

      if (!res.ok) {
        setError(res.error ?? null);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isPending) setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button type="button" size="lg">
            <Plus aria-hidden="true" className="size-4" />
            Novo papel
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm">
            Editar
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo papel" : "Editar papel"}
          </DialogTitle>
          <DialogDescription>
            Um papel define a função que um participante pode exercer em um
            caso (ex.: &quot;Médico denunciado&quot;, &quot;Denunciante&quot;).
          </DialogDescription>
        </DialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={nameField.controlProps.id}>
              Nome exibido
            </FieldLabel>
            <Input
              id={nameField.controlProps.id}
              value={draft.displayName}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.displayName)}
              onChange={(e) =>
                setDraft({ ...draft, displayName: e.target.value })
              }
            />
            <FieldError>{fieldErrors.displayName}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={keyField.controlProps.id}>Chave</FieldLabel>
            <Input
              id={keyField.controlProps.id}
              value={draft.key}
              disabled={isPending || mode === "edit"}
              aria-describedby={keyField.descriptionId}
              aria-invalid={Boolean(fieldErrors.key)}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
            <FieldDescription id={keyField.descriptionId}>
              {mode === "edit"
                ? "A chave não pode ser alterada depois de criada — o impedimento automático do denunciado depende dela permanecer estável. Para trocar, desative este papel e crie outro."
                : "Identificador interno, sem acentos ou espaços (ex.: complainant)."}
            </FieldDescription>
            <FieldError>{fieldErrors.key}</FieldError>
          </Field>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <legend className="px-1 text-sm font-medium">
              Tipos de participante aceitos
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PARTICIPANT_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-sm"
                >
                  <Checkbox
                    checked={draft.allowedParticipantTypes.includes(type)}
                    disabled={isPending}
                    onCheckedChange={(c) => toggleType(type, c === true)}
                  />
                  {PARTICIPANT_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
            <FieldError>{fieldErrors.allowedParticipantTypes}</FieldError>
          </fieldset>

          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox
              checked={draft.isPrimarySubjectCandidate}
              disabled={isPending}
              onCheckedChange={(c) =>
                setDraft({ ...draft, isPrimarySubjectCandidate: c === true })
              }
            />
            Pode ser definido como sujeito principal do caso
          </label>

          <Field>
            <FieldLabel htmlFor={scopeField.controlProps.id}>
              Restringir a um tipo de caso{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </FieldLabel>
            <NativeSelect
              id={scopeField.controlProps.id}
              value={draft.caseTypeId ?? ""}
              disabled={isPending}
              onChange={(e) =>
                setDraft({ ...draft, caseTypeId: e.target.value || null })
              }
            >
              <option value="">Toda a organização</option>
              {caseTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={isPending} onClick={submit}>
            {mode === "create" ? "Criar papel" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
