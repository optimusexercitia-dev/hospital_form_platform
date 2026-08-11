"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert, Tags } from "lucide-react";

import {
  type CaseConfidentialityLevel,
  type CaseType,
  type CaseVisibilityPolicy,
  type PrimarySubjectKind,
  CONFIDENTIALITY_LEVEL_LABELS,
  CONFIDENTIALITY_LEVELS,
  PRIMARY_SUBJECT_KIND_LABELS,
  PRIMARY_SUBJECT_KINDS,
  VISIBILITY_POLICY_LABELS,
  VISIBILITY_POLICIES,
} from "@/lib/cases/case-types";
import {
  createCaseType,
  setCaseTypeActive,
  updateCaseType,
  type CaseTypeInput,
} from "@/lib/case-types/actions";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/auth/form-banner";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import {
  DEFAULT_CASE_TERMINOLOGY,
  type CaseTypeTerminology,
} from "@/lib/cases/terminology";
import type { CaseParticipantRoleAdminRow } from "@/lib/vocabulary/actions";
import { CaseTypeTerminologyDialog } from "@/components/org/case-type-terminology-dialog";
import { CaseParticipantRoleManager } from "@/components/org/case-participant-role-manager";

/**
 * The org_admin's case-TYPE vocabulary surface (ADR 0064 Decision 4).
 *
 * A case type is the unit a process template DECLARES and a case SNAPSHOTS. Its
 * `defaultVisibilityPolicy` / `defaultConfidentialityLevel` are inherited by every case
 * created from a template carrying the type — so this screen configures ACCESS, not just
 * wording. The form says so explicitly, because getting it wrong is how ethics cases end
 * up visible to a whole commission.
 *
 * Retiring a type hides it from the pickers without touching anything that already
 * references it (existing cases keep the posture snapshotted at creation).
 */
export function CaseTypeManager({
  organizationId,
  caseTypes,
  terminologyByCaseTypeId,
  participantRoles,
}: {
  organizationId: string;
  /** ALL of the org's types, active and retired (the manager shows both). */
  caseTypes: CaseType[];
  /**
   * ETH·E4 §4 — each case type's RESOLVED terminology (`getCaseTypeTerminology`,
   * fetched server-side per type), keyed by `caseType.id`. Feeds each row's
   * "Terminologia" dialog. A type absent from this map (should not happen — the
   * host fetches one entry per `caseTypes` row) falls back to the platform
   * default bundle rather than a crash.
   */
  terminologyByCaseTypeId: Record<string, CaseTypeTerminology>;
  /** ETH·E4 §4 — the org's full `case_participant_roles` vocabulary, active AND
   *  inactive (the admin list, unlike the `Papel` picker's read). */
  participantRoles: CaseParticipantRoleAdminRow[];
}) {
  const active = caseTypes.filter((t) => t.isActive);
  const retired = caseTypes.filter((t) => !t.isActive);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tags aria-hidden="true" className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Tipos ativos
            </h3>
          </div>
          <CaseTypeDialog mode="create" organizationId={organizationId} />
        </div>

        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground text-pretty">
            Nenhum tipo de caso cadastrado. Crie um para definir o vocabulário e o
            nível de acesso padrão dos casos de um processo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((t, i) => (
              <CaseTypeRow
                key={t.id}
                caseType={t}
                index={i}
                terminology={terminologyByCaseTypeId[t.id]}
              />
            ))}
          </ul>
        )}

        {retired.length > 0 && (
          <section aria-labelledby="retired-case-types" className="flex flex-col gap-3">
            <h3
              id="retired-case-types"
              className="text-sm font-medium text-muted-foreground"
            >
              Tipos desativados
            </h3>
            <ul className="flex flex-col gap-3">
              {retired.map((t, i) => (
                <CaseTypeRow
                  key={t.id}
                  caseType={t}
                  index={i}
                  terminology={terminologyByCaseTypeId[t.id]}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <section
        aria-labelledby="participant-roles-heading"
        className="flex flex-col gap-5 border-t border-border pt-8"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="participant-roles-heading" className="text-lg font-semibold">
            Papéis de participante
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground text-pretty">
            Os papéis definem quem pode ser vinculado a um caso e em qual
            função — ex.: &quot;Médico denunciado&quot;, &quot;Denunciante&quot;,
            &quot;Testemunha&quot;. Cada caso oferece os papéis da organização
            mais os do seu tipo.
          </p>
        </div>
        <CaseParticipantRoleManager
          organizationId={organizationId}
          caseTypes={caseTypes}
          roles={participantRoles}
        />
      </section>
    </div>
  );
}

function CaseTypeRow({
  caseType,
  index,
  terminology,
}: {
  caseType: CaseType;
  index: number;
  /** This type's resolved terminology, for the "Terminologia" dialog. */
  terminology: CaseTypeTerminology;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restrictive = caseType.defaultVisibilityPolicy === "explicit_grants_only";

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const res = await setCaseTypeActive(caseType.id, !caseType.isActive);
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
          <h4 className="text-base font-semibold">{caseType.displayName}</h4>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {caseType.key}
          </code>
          {!caseType.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Desativado
            </span>
          )}
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Sujeito:</dt>
            <dd className="font-medium">
              {PRIMARY_SUBJECT_KIND_LABELS[caseType.primarySubjectKind]}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted-foreground">Visibilidade:</dt>
            <dd className="inline-flex items-center gap-1 font-medium">
              {restrictive && (
                <ShieldAlert
                  aria-hidden="true"
                  className="size-3.5 text-warning"
                />
              )}
              {VISIBILITY_POLICY_LABELS[caseType.defaultVisibilityPolicy]}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Confidencialidade:</dt>
            <dd className="font-medium">
              {CONFIDENTIALITY_LEVEL_LABELS[caseType.defaultConfidentialityLevel]}
            </dd>
          </div>
          {caseType.defaultCaseLabel && (
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Nome do caso:</dt>
              <dd className="font-medium">{caseType.defaultCaseLabel}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <CaseTypeTerminologyDialog
          organizationId={caseType.organizationId}
          caseType={caseType}
          terminology={
            terminology ?? { ...DEFAULT_CASE_TERMINOLOGY, caseTypeId: caseType.id }
          }
        />
        <CaseTypeDialog
          mode="edit"
          organizationId={caseType.organizationId}
          caseType={caseType}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={toggleActive}
        >
          {caseType.isActive ? "Desativar" : "Reativar"}
        </Button>
      </div>
    </li>
  );
}

const EMPTY: CaseTypeInput = {
  key: "",
  displayName: "",
  primarySubjectKind: "none",
  defaultVisibilityPolicy: "commission_default",
  defaultConfidentialityLevel: "non_phi_internal",
  defaultCaseLabel: null,
};

function CaseTypeDialog({
  mode,
  organizationId,
  caseType,
}: {
  mode: "create" | "edit";
  organizationId: string;
  caseType?: CaseType;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<CaseTypeInput>(
    caseType
      ? {
          key: caseType.key,
          displayName: caseType.displayName,
          primarySubjectKind: caseType.primarySubjectKind,
          defaultVisibilityPolicy: caseType.defaultVisibilityPolicy,
          defaultConfidentialityLevel: caseType.defaultConfidentialityLevel,
          defaultCaseLabel: caseType.defaultCaseLabel,
        }
      : EMPTY,
  );

  const keyField = useFieldIds("case-type-key", { hasDescription: true });
  const nameField = useFieldIds("case-type-name");
  const subjectField = useFieldIds("case-type-subject");
  const visibilityField = useFieldIds("case-type-visibility", {
    hasDescription: true,
  });
  const confidentialityField = useFieldIds("case-type-confidentiality");
  const caseLabelField = useFieldIds("case-type-case-label", {
    hasDescription: true,
  });

  function submit() {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createCaseType(organizationId, draft)
          : await updateCaseType(caseType!.id, draft);

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button type="button" size="lg">
            <Plus aria-hidden="true" className="size-4" />
            Novo tipo de caso
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
            {mode === "create" ? "Novo tipo de caso" : "Editar tipo de caso"}
          </DialogTitle>
          <DialogDescription>
            O tipo define o vocabulário e — importante — o nível de acesso padrão
            dos casos abertos pelos processos que o declararem.
          </DialogDescription>
        </DialogHeader>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
            <Input
              id={nameField.controlProps.id}
              value={draft.displayName}
              disabled={isPending}
              aria-invalid={Boolean(fieldErrors.displayName)}
              onChange={(e) =>
                setDraft({ ...draft, displayName: e.target.value })
              }
            />
            {fieldErrors.displayName && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {fieldErrors.displayName}
              </span>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor={keyField.controlProps.id}>Chave</FieldLabel>
            <Input
              id={keyField.controlProps.id}
              value={draft.key}
              disabled={isPending}
              aria-describedby={keyField.descriptionId}
              aria-invalid={Boolean(fieldErrors.key)}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
            <FieldDescription id={keyField.descriptionId}>
              Identificador interno, sem acentos ou espaços (ex.: etica).
            </FieldDescription>
            {fieldErrors.key && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {fieldErrors.key}
              </span>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor={subjectField.controlProps.id}>
              Sujeito principal
            </FieldLabel>
            <NativeSelect
              id={subjectField.controlProps.id}
              value={draft.primarySubjectKind}
              disabled={isPending}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  primarySubjectKind: e.target.value as PrimarySubjectKind,
                })
              }
            >
              {PRIMARY_SUBJECT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PRIMARY_SUBJECT_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor={visibilityField.controlProps.id}>
              Visibilidade padrão
            </FieldLabel>
            <NativeSelect
              id={visibilityField.controlProps.id}
              value={draft.defaultVisibilityPolicy}
              disabled={isPending}
              aria-describedby={visibilityField.descriptionId}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultVisibilityPolicy: e.target
                    .value as CaseVisibilityPolicy,
                })
              }
            >
              {VISIBILITY_POLICIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_POLICY_LABELS[v]}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription id={visibilityField.descriptionId}>
              &quot;Somente quem receber acesso&quot; restringe cada caso às pessoas
              explicitamente autorizadas — indicado para processos sensíveis, como
              ética.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={confidentialityField.controlProps.id}>
              Confidencialidade padrão
            </FieldLabel>
            <NativeSelect
              id={confidentialityField.controlProps.id}
              value={draft.defaultConfidentialityLevel}
              disabled={isPending}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultConfidentialityLevel: e.target
                    .value as CaseConfidentialityLevel,
                })
              }
            >
              {CONFIDENTIALITY_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {CONFIDENTIALITY_LEVEL_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor={caseLabelField.controlProps.id}>
              Como chamar um caso (opcional)
            </FieldLabel>
            <Input
              id={caseLabelField.controlProps.id}
              value={draft.defaultCaseLabel ?? ""}
              disabled={isPending}
              aria-describedby={caseLabelField.descriptionId}
              onChange={(e) =>
                setDraft({ ...draft, defaultCaseLabel: e.target.value })
              }
            />
            <FieldDescription id={caseLabelField.descriptionId}>
              Ex.: &quot;Denúncia&quot;. Deixe em branco para usar &quot;Caso&quot;.
            </FieldDescription>
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
            {mode === "create" ? "Criar tipo" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
