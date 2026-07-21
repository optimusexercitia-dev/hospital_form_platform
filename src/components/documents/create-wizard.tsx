"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Save,
  Send,
  Users,
} from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type { ApproverCandidate } from "@/lib/queries/documents";
import type { DocType } from "@/lib/documents/types";
import { DOC_TYPE_LABELS } from "@/lib/documents/types";
// Type-only import of the server-action module — the action functions are passed
// in as props by the server page (WizardRunner boundary), so this client component
// never value-imports a `"use server"` module.
import type { CreateDocumentState } from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/ui/segmented";
import { Dropzone } from "@/components/ui/dropzone";
import { TagField } from "@/components/ui/tag-field";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import {
  ChecklistRail,
  type ChecklistItem,
} from "@/components/documents/checklist-rail";
import { DocumentTypeBadge } from "@/components/documents/document-badges";
import { formatDateOnly } from "@/components/documents/format";
import {
  ReviewerPicker,
  type ChosenApprover,
} from "@/components/documents/reviewer-picker";

type CreateAction = (
  prev: CreateDocumentState | undefined,
  formData: FormData,
) => Promise<CreateDocumentState>;

const DOC_TYPE_OPTIONS: { value: DocType; label: string }[] = (
  ["policy", "sop", "protocol", "bylaws", "manual", "other"] as DocType[]
).map((value) => ({ value, label: DOC_TYPE_LABELS[value] }));

const STEPS = [
  { label: "Detalhes" },
  { label: "Documento" },
  { label: "Aprovadores" },
  { label: "Confirmação" },
];

/** Which wizard step owns each server-returned field error (for the jump-back). */
const FIELD_STEP: Record<string, number> = {
  title: 0,
  docType: 0,
  reviewCycleMonths: 0,
  file: 1,
  expiryDate: 1,
  proposedEffectiveDate: 1,
  approvers: 2,
  approvalDueDate: 2,
};

/**
 * All-in-one create wizard (Phase 17 v2, F-B). Four guided steps (Detalhes →
 * Documento → Aprovadores → Confirmação) + a sticky readiness rail. The committee
 * is implicit from the route (no selector). The terminal step submits for approval
 * via `createAndSubmitDocument`; "Salvar rascunho" exits at draft via
 * `createDraftOnly`. On a post-create partial failure the action returns the new
 * `documentId`, so we land the user on the recoverable draft's detail with an
 * `?aviso=` banner. Client boundary: actions are props; `@/lib/**` is type-only.
 */
export function CreateWizard({
  org,
  commission,
  commissionId,
  candidates,
  categories,
  defaultDocType = "sop",
  submitAction,
  draftAction,
}: {
  org: string;
  commission: string;
  commissionId: string;
  candidates: ApproverCandidate[];
  /** Existing category values for the autocomplete datalist. */
  categories: string[];
  defaultDocType?: DocType;
  submitAction: CreateAction;
  draftAction: CreateAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const categoryListId = "wizard-category-list";

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  // Step 1 — details.
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>(defaultDocType);
  const [category, setCategory] = useState("");
  const [reviewCycleMonths, setReviewCycleMonths] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Step 2 — document.
  const [file, setFile] = useState<File | null>(null);
  const [proposedEffectiveDate, setProposedEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [summary, setSummary] = useState("");

  // Step 3 — reviewers.
  const [approvers, setApprovers] = useState<ChosenApprover[]>([]);
  const [approvalDueDate, setApprovalDueDate] = useState("");

  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const titleValid = title.trim() !== "";
  const fileValid = file != null;
  const reviewersValid = approvers.length > 0;
  const readyToSubmit = titleValid && fileValid && reviewersValid;

  const stepValid = [titleValid, fileValid, reviewersValid, readyToSubmit];

  const checklist: ChecklistItem[] = [
    { label: "Título do documento", done: titleValid },
    { label: "Arquivo anexado", done: fileValid },
    { label: "Ao menos um aprovador", done: reviewersValid },
  ];

  function focusHeading() {
    // Move focus to the new step heading each transition (a11y — plan §6).
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function goTo(next: number) {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    focusHeading();
  }

  function goNext() {
    if (step < STEPS.length - 1 && stepValid[step]) goTo(step + 1);
  }

  function goBack() {
    if (step > 0) goTo(step - 1);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("commissionId", commissionId);
    fd.set("title", title.trim());
    fd.set("docType", docType);
    if (category.trim()) fd.set("category", category.trim());
    fd.set("tags", JSON.stringify(tags));
    if (reviewCycleMonths.trim()) fd.set("reviewCycleMonths", reviewCycleMonths.trim());
    if (file) fd.set("file", file);
    if (summary.trim()) fd.set("summaryOfChangesMd", summary.trim());
    if (proposedEffectiveDate) fd.set("proposedEffectiveDate", proposedEffectiveDate);
    if (expiryDate) fd.set("expiryDate", expiryDate);
    if (approvalDueDate) fd.set("approvalDueDate", approvalDueDate);
    fd.set(
      "approvers",
      JSON.stringify(
        approvers.map((a) => ({
          approverId: a.approverId,
          approverTitle: a.approverTitle.trim() || null,
        })),
      ),
    );
    return fd;
  }

  function handleResult(result: CreateDocumentState, kind: "submit" | "draft") {
    if (result.ok && result.documentId) {
      const aviso = kind === "submit" ? "enviado" : "rascunho";
      router.push(
        `${commissionHref(org, commission, "manage", "documentos", result.documentId)}?aviso=${aviso}`,
      );
      return;
    }
    if (!result.ok && result.documentId) {
      // Partial failure — the draft is saved; finish on its detail (banner there).
      router.push(
        `${commissionHref(org, commission, "manage", "documentos", result.documentId)}?aviso=incompleto`,
      );
      return;
    }
    // Pure validation failure — surface inline + jump to the earliest errored step.
    const errs = result.fieldErrors ?? {};
    setFieldErrors(errs);
    setBanner(result.error ?? null);
    const errSteps = Object.keys(errs)
      .map((k) => FIELD_STEP[k])
      .filter((n) => n != null);
    if (errSteps.length > 0) goTo(Math.min(...errSteps));
  }

  function runAction(action: CreateAction, kind: "submit" | "draft") {
    setBanner(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action(undefined, buildFormData());
      handleResult(result, kind);
    });
  }

  const cancelHref = commissionHref(org, commission, "manage", "documentos");

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-5">
        <Stepper
          steps={STEPS}
          current={step}
          maxReached={maxReached}
          onStepClick={(i) => goTo(i)}
        />

        {banner ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {banner}
          </p>
        ) : null}

        <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          {step === 0 ? (
            <StepDetails
              headingRef={headingRef}
              title={title}
              setTitle={setTitle}
              docType={docType}
              setDocType={setDocType}
              category={category}
              setCategory={setCategory}
              categories={categories}
              categoryListId={categoryListId}
              reviewCycleMonths={reviewCycleMonths}
              setReviewCycleMonths={setReviewCycleMonths}
              tags={tags}
              setTags={setTags}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {step === 1 ? (
            <StepDocument
              headingRef={headingRef}
              file={file}
              setFile={setFile}
              proposedEffectiveDate={proposedEffectiveDate}
              setProposedEffectiveDate={setProposedEffectiveDate}
              expiryDate={expiryDate}
              setExpiryDate={setExpiryDate}
              summary={summary}
              setSummary={setSummary}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {step === 2 ? (
            <StepReviewers
              headingRef={headingRef}
              candidates={candidates}
              approvers={approvers}
              setApprovers={setApprovers}
              approvalDueDate={approvalDueDate}
              setApprovalDueDate={setApprovalDueDate}
              fieldErrors={fieldErrors}
            />
          ) : null}

          {step === 3 ? (
            <StepConfirm
              headingRef={headingRef}
              title={title}
              docType={docType}
              category={category}
              tags={tags}
              file={file}
              summary={summary}
              approvers={approvers}
              candidates={candidates}
              proposedEffectiveDate={proposedEffectiveDate}
            />
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="lg">
              <a href={cancelHref}>Cancelar</a>
            </Button>
            {/* Save-as-draft exit — available at any step once a title exists. */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => runAction(draftAction, "draft")}
              disabled={isPending || !titleValid}
            >
              <Save aria-hidden="true" className="size-4" />
              Salvar rascunho
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={goBack}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Voltar
              </Button>
            ) : null}

            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                size="lg"
                onClick={goNext}
                disabled={!stepValid[step]}
              >
                Continuar
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={() => runAction(submitAction, "submit")}
                disabled={isPending || !readyToSubmit}
              >
                <Send aria-hidden="true" className="size-4" />
                {isPending ? "Enviando…" : "Enviar para aprovação"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <ChecklistRail items={checklist} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function StepDetails({
  headingRef,
  title,
  setTitle,
  docType,
  setDocType,
  category,
  setCategory,
  categories,
  categoryListId,
  reviewCycleMonths,
  setReviewCycleMonths,
  tags,
  setTags,
  fieldErrors,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  setTitle: (v: string) => void;
  docType: DocType;
  setDocType: (v: DocType) => void;
  category: string;
  setCategory: (v: string) => void;
  categories: string[];
  categoryListId: string;
  reviewCycleMonths: string;
  setReviewCycleMonths: (v: string) => void;
  tags: string[];
  setTags: (v: string[]) => void;
  fieldErrors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Detalhes do documento
        </h2>
        <p className="text-sm text-muted-foreground">
          O código será atribuído automaticamente ao criar.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-title">Título</FieldLabel>
        <Input
          id="wizard-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ex.: Política de higienização das mãos"
          aria-invalid={fieldErrors.title ? true : undefined}
        />
        <FieldError>{fieldErrors.title}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="wizard-doctype-label" id="wizard-doctype-label">
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
          <FieldLabel htmlFor="wizard-category">Categoria</FieldLabel>
          <Input
            id="wizard-category"
            list={categoryListId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex.: Prevenção de infecção"
          />
          <datalist id={categoryListId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FieldDescription>Opcional — agrupa documentos no registro.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="wizard-cycle">Ciclo de revisão (meses)</FieldLabel>
          <Input
            id="wizard-cycle"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            step={1}
            value={reviewCycleMonths}
            onChange={(e) => setReviewCycleMonths(e.target.value)}
            placeholder="Ex.: 24"
            aria-invalid={fieldErrors.reviewCycleMonths ? true : undefined}
          />
          <FieldDescription>Opcional — calcula a data de revisão a partir da vigência.</FieldDescription>
          <FieldError>{fieldErrors.reviewCycleMonths}</FieldError>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-tags">Etiquetas</FieldLabel>
        <TagField id="wizard-tags" value={tags} onChange={setTags} />
        <FieldDescription>Opcional — pressione Enter para adicionar.</FieldDescription>
      </Field>
    </div>
  );
}

function StepDocument({
  headingRef,
  file,
  setFile,
  proposedEffectiveDate,
  setProposedEffectiveDate,
  expiryDate,
  setExpiryDate,
  summary,
  setSummary,
  fieldErrors,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  file: File | null;
  setFile: (f: File | null) => void;
  proposedEffectiveDate: string;
  setProposedEffectiveDate: (v: string) => void;
  expiryDate: string;
  setExpiryDate: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  fieldErrors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Arquivo da versão
        </h2>
        <p className="text-sm text-muted-foreground">
          Uma cópia é armazenada de forma imutável para cada versão.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-file">Arquivo</FieldLabel>
        <Dropzone
          id="wizard-file"
          file={file}
          onFileChange={setFile}
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.ppt,.pptx,.csv,.txt"
          describedBy="wizard-file-description"
          invalid={Boolean(fieldErrors.file)}
          hint="PDF, DOCX e outros formatos · até 25 MB"
        />
        <FieldDescription id="wizard-file-description">
          O aprovador baixa este arquivo para revisar antes de assinar.
        </FieldDescription>
        <FieldError>{fieldErrors.file}</FieldError>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="wizard-effective">Vigência prevista</FieldLabel>
          <Input
            id="wizard-effective"
            type="date"
            value={proposedEffectiveDate}
            onChange={(e) => setProposedEffectiveDate(e.target.value)}
            aria-invalid={fieldErrors.proposedEffectiveDate ? true : undefined}
          />
          <FieldDescription>Aplica-se após a aprovação total.</FieldDescription>
          <FieldError>{fieldErrors.proposedEffectiveDate}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="wizard-expiry">Expiração</FieldLabel>
          <Input
            id="wizard-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            aria-invalid={fieldErrors.expiryDate ? true : undefined}
          />
          <FieldDescription>Opcional.</FieldDescription>
          <FieldError>{fieldErrors.expiryDate}</FieldError>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-summary">Resumo das alterações</FieldLabel>
        <Textarea
          id="wizard-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          placeholder="Descreva o que esta versão traz. Fica registrado no histórico."
        />
        <FieldDescription>Opcional — registrado permanentemente no histórico da versão.</FieldDescription>
      </Field>
    </div>
  );
}

function StepReviewers({
  headingRef,
  candidates,
  approvers,
  setApprovers,
  approvalDueDate,
  setApprovalDueDate,
  fieldErrors,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  candidates: ApproverCandidate[];
  approvers: ChosenApprover[];
  setApprovers: (v: ChosenApprover[]) => void;
  approvalDueDate: string;
  setApprovalDueDate: (v: string) => void;
  fieldErrors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Aprovadores
        </h2>
        <p className="text-sm text-muted-foreground">
          Indique quem deve assinar. Todos aprovam de forma independente e a
          aprovação é unânime.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-accent/30 p-3.5 text-sm text-foreground">
        <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-pretty">
          Ao enviar, cada aprovador recebe uma notificação. O documento só fica
          vigente quando todos aprovarem.
        </p>
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-reviewers" id="wizard-reviewers">
          Aprovadores ({approvers.length} selecionado{approvers.length === 1 ? "" : "s"})
        </FieldLabel>
        <ReviewerPicker
          candidates={candidates}
          value={approvers}
          onChange={setApprovers}
          describedBy="wizard-reviewers"
          invalid={Boolean(fieldErrors.approvers)}
        />
        <FieldError>{fieldErrors.approvers}</FieldError>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="wizard-due">Prazo para aprovação</FieldLabel>
          <Input
            id="wizard-due"
            type="date"
            value={approvalDueDate}
            onChange={(e) => setApprovalDueDate(e.target.value)}
            aria-invalid={fieldErrors.approvalDueDate ? true : undefined}
          />
          <FieldDescription>Opcional — usado nos lembretes de aprovação.</FieldDescription>
          <FieldError>{fieldErrors.approvalDueDate}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="wizard-policy">Política de aprovação</FieldLabel>
          <Input id="wizard-policy" value="Aprovação unânime" readOnly disabled />
          <FieldDescription>Fixo para documentos controlados.</FieldDescription>
        </Field>
      </div>
    </div>
  );
}

function StepConfirm({
  headingRef,
  title,
  docType,
  category,
  tags,
  file,
  summary,
  approvers,
  candidates,
  proposedEffectiveDate,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  docType: DocType;
  category: string;
  tags: string[];
  file: File | null;
  summary: string;
  approvers: ChosenApprover[];
  candidates: ApproverCandidate[];
  proposedEffectiveDate: string;
}) {
  const nameById = new Map(candidates.map((c) => [c.id, c.name]));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          Confirmação
        </h2>
        <p className="text-sm text-muted-foreground">
          Revise antes de enviar para aprovação.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FileText aria-hidden="true" className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{title || "Sem título"}</h3>
            <DocumentTypeBadge docType={docType} />
            <span className="font-mono text-xs text-muted-foreground">v1</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {category ? category : "Sem categoria"}
          </p>
        </div>
      </div>

      <ConfirmRow label="Arquivo">
        {file ? (
          <span className="font-mono text-sm text-foreground">{file.name}</span>
        ) : (
          <span className="text-sm font-medium text-destructive">
            Nenhum arquivo — volte à etapa Documento.
          </span>
        )}
      </ConfirmRow>

      <ConfirmRow label="Vigência prevista">
        <span className="text-sm tabular-nums">
          {proposedEffectiveDate
            ? formatDateOnly(proposedEffectiveDate)
            : "Definida na publicação"}
        </span>
      </ConfirmRow>

      {tags.length > 0 ? (
        <ConfirmRow label="Etiquetas">
          <span className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </span>
        </ConfirmRow>
      ) : null}

      <ConfirmRow label={`Aprovadores (${approvers.length})`}>
        {approvers.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {approvers.map((a) => (
              <span
                key={a.approverId}
                className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
              >
                {nameById.get(a.approverId) ?? "Aprovador"}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-sm font-medium text-destructive">
            Nenhum aprovador — volte à etapa Aprovadores.
          </span>
        )}
      </ConfirmRow>

      {summary.trim() ? (
        <ConfirmRow label="Resumo das alterações">
          <p className="text-sm whitespace-pre-wrap text-foreground">{summary}</p>
        </ConfirmRow>
      ) : null}
    </div>
  );
}

function ConfirmRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border/60 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground sm:w-44 sm:shrink-0">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
