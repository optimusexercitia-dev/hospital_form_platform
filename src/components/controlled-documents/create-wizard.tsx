"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  GitBranchPlus,
  Save,
  Send,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import { commissionHref } from "@/lib/routing";
import type { ApproverCandidate } from "@/lib/queries/controlled-documents";
import type { DocType } from "@/lib/controlled-documents/types";
import { DOC_TYPE_LABELS } from "@/lib/controlled-documents/types";
import type { DocumentUploadCredential } from "@/lib/documents/types";
import {
  DOCUMENT_ACCEPTED_MIME_TYPES,
  DOCUMENT_MAX_SIZE_BYTES,
} from "@/lib/documents/types";
import { uploadDocumentFile } from "@/lib/documents/upload-client";
// DM3·S2: the wizard now DRIVES a multi-step chain rather than posting one
// FormData to one action, so it value-imports the `"use server"` verbs it
// sequences (the Wave-A dialect — see `documents/document-upload-dialog.tsx`).
// This is legal and is not the client/server-import hazard: that gate is about
// importing a server QUERY module (which drags `next/headers` into the bundle
// and aborts `next build`). Server ACTIONS are exactly what a client island is
// meant to call.
import {
  beginControlledVersionUpload,
  createDraftOnly,
  finalizeControlledVersionUpload,
  submitDocumentForApproval,
  supersedeDocument,
} from "@/lib/controlled-documents/actions";
import { documentErrorMessage } from "@/components/documents/document-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
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
} from "@/components/controlled-documents/checklist-rail";
import { DocumentTypeBadge } from "@/components/controlled-documents/document-badges";
import {
  formatDateOnly,
  formatVersionNumber,
} from "@/components/controlled-documents/format";
import {
  ReviewerPicker,
  type ChosenApprover,
} from "@/components/controlled-documents/reviewer-picker";

/** The three `?aviso=` keys `DetailNotice` renders. Enumerated, not free-form. */
type Aviso = "enviado" | "rascunho" | "incompleto";

/** Which leg of the chain is in flight — drives the live region + button copy. */
type WizardPhase =
  | "idle"
  | "creating"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "submitting";

const PHASE_MESSAGE: Record<Exclude<WizardPhase, "idle">, string> = {
  creating: "Criando a versão…",
  preparing: "Preparando o envio…",
  uploading: "Enviando arquivo…",
  finalizing: "Verificando arquivo…",
  submitting: "Enviando para aprovação…",
};

/**
 * Outcome of the begin → PUT → finalize leg.
 *
 * `recoverable` distinguishes the two failure classes the wizard MUST treat
 * differently, and it is about DOMAIN STATE, not about severity:
 * - `true`  — nothing was written (begin refused, or the PUT left no object),
 *             so staying on the wizard and trying again is honest.
 * - `false` — finalize ran and the version may already be bound, so the truth
 *             now lives on the document detail and that is where the user goes.
 */
type AttachOutcome =
  | { ok: true }
  | { ok: false; message: string; recoverable: boolean };

/**
 * Which flow the wizard drives: a brand-new document (`create`), a new version of
 * an effective one (`newversion`), or revising a `changes_requested` version in
 * place after an approver requested changes (`revise`). `newversion` and `revise`
 * both lock the document identity; `revise` additionally pre-fills the prior
 * approver set and targets an existing version (no version bump).
 */
export type WizardMode = "create" | "newversion" | "revise";

/**
 * The frozen identity of the document a new version is being created for
 * (new-version mode only). All fields are read-only in the wizard — a new version
 * inherits the header verbatim; only the artifact + approvers change (ADR 0081).
 */
export interface LockedIdentity {
  documentId: string;
  code: string;
  title: string;
  docType: DocType;
  category: string | null;
  currentVersionNumber: number;
  nextVersionNumber: number;
}

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
  summaryOfChangesMd: 1,
  approvers: 2,
  approvalDueDate: 2,
};

/**
 * All-in-one wizard (Phase 17 v2, F-B) — THREE modes over one flow. Every mode
 * ends in the same four legs (begin → PUT → finalize → submit); they differ only
 * in how a version comes to exist for those legs to run against:
 *
 * - **create** (default): Detalhes → Documento → Aprovadores → Confirmação.
 *   `createDraftOnly` mints the document and its v1. Committee is implicit from
 *   the route. This is the only mode with a "Salvar rascunho" exit, which stops
 *   after the upload legs and never submits.
 * - **newversion** (ADR 0081 Wave 2.5b): Step 1 is a **locked-identity** panel —
 *   the header is inherited verbatim; only the artifact + approvers change.
 *   `supersedeDocument` mints the new draft over the current effective version.
 *   No draft exit (the detail-page supersede is the blank-draft fallback).
 * - **revise** (ADR 0081 — `changes_requested`): a locked-identity flow like
 *   `newversion`, but the version ALREADY EXISTS and is revised IN PLACE (no
 *   version bump), so it has no step 1 at all — `versionId` is a prop. The
 *   approver step is pre-filled with the version's prior set (`initialApprovers`).
 *
 * That difference is not cosmetic: it is exactly what decides whether a failed
 * upload can be retried here or has to be finished on the document detail.
 *
 * ## DM3·S2 — why the terminal step is a chain the CLIENT drives
 *
 * The terminal step used to be one server action that received the `File` in
 * FormData and did create → upload → submit server-side. That shape is no longer
 * expressible: bytes now move client-side to a signed credential, and
 * `beginControlledVersionUpload` needs `{commissionId, documentId, versionId}` —
 * i.e. the version must ALREADY EXIST before an upload can start. So the wizard
 * sequences the legs itself:
 *
 *   create/supersede (metadata only) → begin → PUT → finalize → submit
 *
 * This does NOT introduce partial failure — the chain was never transactional
 * across Storage and the DB, and the recovery has always been the same: land the
 * user on the created draft's detail with `?aviso=incompleto`, where the
 * add-version form and the submit form both live. What it changes is only WHO
 * decides the landing, and the rule is deliberately blunt so it cannot rot:
 *
 * - a failure BEFORE the document/version exists keeps the user here, inline;
 * - any failure AFTER it exists lands on the detail, and never retries in place
 *   — a retry after step 1 would create a SECOND document.
 *
 * The `?aviso=` set is unchanged and closed ({@link Aviso}); growing it is a
 * lead call, not a local one. Branching is on WHICH LEG failed plus the
 * contract's error codes — never on message text.
 */
export function CreateWizard({
  mode = "create",
  locked,
  org,
  commission,
  commissionId,
  versionId,
  candidates,
  categories,
  initialApprovers,
  defaultDocType = "sop",
  allowDraftExit = false,
}: {
  /** `create` (default), `newversion`, or `revise` — see the component doc. */
  mode?: WizardMode;
  /** The frozen document identity — REQUIRED in `newversion`/`revise` mode, ignored otherwise. */
  locked?: LockedIdentity;
  org: string;
  commission: string;
  commissionId: string;
  /** The `changes_requested` version revised in place — REQUIRED in `revise` mode. */
  versionId?: string;
  candidates: ApproverCandidate[];
  /** Existing category values for the autocomplete datalist (create mode). */
  categories: string[];
  /** Pre-selected approvers (revise mode — the version's prior approver set). */
  initialApprovers?: ChosenApprover[];
  defaultDocType?: DocType;
  /**
   * Offer the "Salvar rascunho" exit. Create mode only — the locked-identity
   * modes have no draft exit because the version already exists.
   */
  allowDraftExit?: boolean;
}) {
  const router = useRouter();
  const isNewVersion = mode === "newversion";
  const isRevise = mode === "revise";
  // Both new-version and revise lock the header and require the change summary.
  const isLockedIdentity = isNewVersion || isRevise;
  const summaryRequired = isLockedIdentity;
  const [phase, setPhase] = useState<WizardPhase>("idle");
  const isPending = phase !== "idle";
  const headingRef = useRef<HTMLHeadingElement>(null);
  const categoryListId = "wizard-category-list";

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  // Step 1 — details (create mode only; locked in new-version mode).
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>(defaultDocType);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [reviewCycleMonths, setReviewCycleMonths] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Step 2 — document.
  const [file, setFile] = useState<File | null>(null);
  const [proposedEffectiveDate, setProposedEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [summary, setSummary] = useState("");

  // Step 3 — reviewers. Pre-filled in revise mode with the version's prior set.
  const [approvers, setApprovers] = useState<ChosenApprover[]>(
    initialApprovers ?? [],
  );
  const [approvalDueDate, setApprovalDueDate] = useState("");

  const [banner, setBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Validity — the identity is locked in new-version/revise mode (title always
  // valid); the change summary is REQUIRED there (both actions reject a blank summary).
  const titleValid = isLockedIdentity || title.trim() !== "";
  const fileValid = file != null;
  const summaryValid = summary.trim() !== "";
  const reviewersValid = approvers.length > 0;
  const documentStepValid = fileValid && (!summaryRequired || summaryValid);
  const readyToSubmit = titleValid && documentStepValid && reviewersValid;

  const stepValid = [
    isLockedIdentity ? true : titleValid,
    documentStepValid,
    reviewersValid,
    readyToSubmit,
  ];

  const checklist: ChecklistItem[] = isLockedIdentity
    ? [
        { label: "Arquivo anexado", done: fileValid },
        { label: "Resumo das alterações", done: summaryValid },
        { label: "Ao menos um aprovador", done: reviewersValid },
      ]
    : [
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

  /** Step-1 metadata for a brand-new document (create mode only). */
  function buildCreateFormData(): FormData {
    const fd = new FormData();
    fd.set("commissionId", commissionId);
    fd.set("title", title.trim());
    fd.set("docType", docType);
    if (category.trim()) fd.set("category", category.trim());
    if (description.trim()) fd.set("description", description.trim());
    fd.set("tags", JSON.stringify(tags));
    if (reviewCycleMonths.trim())
      fd.set("reviewCycleMonths", reviewCycleMonths.trim());
    return fd;
  }

  /** The final leg: approvers + the two approval dates, for a known version. */
  function buildSubmitFormData(targetVersionId: string): FormData {
    const fd = new FormData();
    fd.set("versionId", targetVersionId);
    if (proposedEffectiveDate)
      fd.set("proposedEffectiveDate", proposedEffectiveDate);
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

  /** Land on the document detail with one of the three known notices. */
  function landOnDetail(targetDocumentId: string, aviso: Aviso) {
    router.push(
      `${commissionHref(org, commission, "manage", "documentos", targetDocumentId)}?aviso=${aviso}`,
    );
  }

  /** Surface an inline failure and jump back to the earliest errored step. */
  function failInline(result: {
    error?: string;
    fieldErrors?: Record<string, string>;
  }) {
    const errs = result.fieldErrors ?? {};
    setFieldErrors(errs);
    setBanner(result.error ?? null);
    setPhase("idle");
    const errSteps = Object.keys(errs)
      .map((k) => FIELD_STEP[k])
      .filter((n) => n != null);
    if (errSteps.length > 0) goTo(Math.min(...errSteps));
  }

  /**
   * Refuse a trivially invalid file BEFORE step 1 creates anything.
   *
   * The server action this replaced validated the file up front for exactly
   * this reason ("avoid an orphan draft on trivially invalid input — nothing is
   * created if these fail"). With the chain client-side that ordering is now
   * MINE to preserve: checking inside `attachFile` would mean a 30 MB PDF
   * leaves behind a created document and an empty draft version.
   *
   * These are pre-flight refusals only. `finalize` re-derives size and MIME
   * server-side and is the authority (ADR 0114 D9).
   */
  function fileRejection(bytes: File): string | null {
    if (bytes.size > DOCUMENT_MAX_SIZE_BYTES) {
      return documentErrorMessage("file_too_large");
    }
    if (bytes.type && !DOCUMENT_ACCEPTED_MIME_TYPES.includes(bytes.type)) {
      return documentErrorMessage("file_type_not_allowed");
    }
    return null;
  }

  /** begin → PUT → finalize, against a version that already exists. */
  async function attachFile(
    targetDocumentId: string,
    targetVersionId: string,
    bytes: File,
  ): Promise<AttachOutcome> {
    setPhase("preparing");
    let reservation: {
      id: string;
      coreDocumentVersionId: string;
      credential: DocumentUploadCredential;
    };
    try {
      const begun = await beginControlledVersionUpload({
        commissionId,
        documentId: targetDocumentId,
        versionId: targetVersionId,
        fileName: bytes.name,
        mimeType: bytes.type || "application/octet-stream",
        sizeBytes: bytes.size,
      });
      if (!begun.ok) {
        // Machine code → pt-BR here; never branch on message text.
        return {
          ok: false,
          message: documentErrorMessage(begun.code),
          recoverable: true,
        };
      }
      reservation = {
        id: begun.uploadSessionId,
        coreDocumentVersionId: begun.coreDocumentVersionId,
        credential: begun.credential,
      };
    } catch {
      return {
        ok: false,
        message: documentErrorMessage("unknown"),
        recoverable: true,
      };
    }

    setPhase("uploading");
    const put = await uploadDocumentFile(reservation.credential, bytes);
    if (!put.ok) {
      // A failed or partial PUT leaves NO object, so nothing is bound yet.
      return {
        ok: false,
        message: documentErrorMessage("upload_incomplete"),
        recoverable: true,
      };
    }

    setPhase("finalizing");
    try {
      const finalized = await finalizeControlledVersionUpload({
        versionId: targetVersionId,
        uploadSessionId: reservation.id,
        coreDocumentVersionId: reservation.coreDocumentVersionId,
        summaryOfChangesMd: summary.trim() || null,
        expiryDate: expiryDate || null,
      });
      if (!finalized.ok) {
        return {
          ok: false,
          message: finalized.error ?? documentErrorMessage("unknown"),
          // Finalize ran: the version may already be bound, and a `terminal`
          // result means the reservation is spent for good. Either way the
          // recovery lives on the detail page, not in this wizard.
          recoverable: false,
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: documentErrorMessage("unknown"),
        recoverable: false,
      };
    }
  }

  /**
   * Step 1 — make sure a version exists to upload into, and return its ids.
   *
   * `revise` already has one (the `changes_requested` version revised in place,
   * no bump), `newversion` supersedes to get one, `create` mints the document
   * and its v1. `existed` says whether step 1 CHANGED anything, which is what
   * decides where a later failure lands.
   */
  async function ensureVersion(): Promise<
    | { ok: true; documentId: string; versionId: string; existed: boolean }
    | { ok: false; landOn?: string }
  > {
    if (isRevise && locked && versionId) {
      return {
        ok: true,
        documentId: locked.documentId,
        versionId,
        existed: true,
      };
    }

    setPhase("creating");
    if (isNewVersion && locked) {
      const fd = new FormData();
      fd.set("documentId", locked.documentId);
      const sup = await supersedeDocument(undefined, fd);
      if (!sup.ok || !sup.versionId) {
        // Supersede refused (e.g. the document is no longer `effective`, or a
        // draft opened underneath us). Nothing was created, but the document
        // exists and its detail is where the real state is.
        setBanner(sup.error ?? null);
        setPhase("idle");
        return { ok: false, landOn: locked.documentId };
      }
      return {
        ok: true,
        documentId: locked.documentId,
        versionId: sup.versionId,
        existed: false,
      };
    }

    const created = await createDraftOnly(undefined, buildCreateFormData());
    if (!created.ok || !created.documentId || !created.versionId) {
      if (created.documentId) {
        // The header landed but we have no version to upload into — the draft
        // is real and recoverable, so finish on its detail.
        return { ok: false, landOn: created.documentId };
      }
      failInline(created);
      return { ok: false };
    }
    return {
      ok: true,
      documentId: created.documentId,
      versionId: created.versionId,
      existed: false,
    };
  }

  /** The terminal "enviar para aprovação" chain, in all three modes. */
  async function runSubmit() {
    if (isPending || !file) return;
    setBanner(null);
    setFieldErrors({});

    const rejected = fileRejection(file);
    if (rejected) {
      failInline({ fieldErrors: { file: rejected } });
      return;
    }

    const step1 = await ensureVersion();
    if (!step1.ok) {
      if (step1.landOn) landOnDetail(step1.landOn, "incompleto");
      return;
    }

    const attached = await attachFile(step1.documentId, step1.versionId, file);
    if (!attached.ok) {
      // Recoverable ⇒ nothing was written by THIS leg. Staying is only honest
      // when step 1 wrote nothing either; if it created a document, retrying
      // here would create a second one.
      if (attached.recoverable && step1.existed) {
        setBanner(attached.message);
        setPhase("idle");
        return;
      }
      landOnDetail(step1.documentId, "incompleto");
      return;
    }

    setPhase("submitting");
    const submitted = await submitDocumentForApproval(
      undefined,
      buildSubmitFormData(step1.versionId),
    );
    if (!submitted.ok) {
      landOnDetail(step1.documentId, "incompleto");
      return;
    }
    landOnDetail(step1.documentId, "enviado");
  }

  /** The "Salvar rascunho" exit — create mode only. The file is optional here. */
  async function runDraft() {
    if (isPending) return;
    setBanner(null);
    setFieldErrors({});

    if (file) {
      const rejected = fileRejection(file);
      if (rejected) {
        failInline({ fieldErrors: { file: rejected } });
        return;
      }
    }

    const step1 = await ensureVersion();
    if (!step1.ok) {
      if (step1.landOn) landOnDetail(step1.landOn, "incompleto");
      return;
    }

    if (file) {
      const attached = await attachFile(step1.documentId, step1.versionId, file);
      if (!attached.ok) {
        landOnDetail(step1.documentId, "incompleto");
        return;
      }
    }
    landOnDetail(step1.documentId, "rascunho");
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

        {/* The chain now has five legs and a slow one in the middle (the byte
            PUT). A keyboard or screen-reader user must hear which one is
            running, not just that a button went disabled. */}
        <p role="status" aria-live="polite" className="sr-only">
          {isPending ? PHASE_MESSAGE[phase as Exclude<WizardPhase, "idle">] : ""}
        </p>

        <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          {step === 0 ? (
            isLockedIdentity && locked ? (
              <StepLockedIdentity
                headingRef={headingRef}
                locked={locked}
                variant={isRevise ? "revise" : "newversion"}
              />
            ) : (
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
                description={description}
                setDescription={setDescription}
                reviewCycleMonths={reviewCycleMonths}
                setReviewCycleMonths={setReviewCycleMonths}
                tags={tags}
                setTags={setTags}
                fieldErrors={fieldErrors}
              />
            )
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
              summaryRequired={summaryRequired}
              nextVersionNumber={isNewVersion ? locked?.nextVersionNumber ?? null : null}
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
              locked={isLockedIdentity ? locked : undefined}
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
            {/* Save-as-draft exit (create mode only) — available at any step once a
                title exists. Locked-identity modes (new-version / revise) have no
                draft exit: the version already exists. */}
            {!isLockedIdentity && allowDraftExit ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void runDraft()}
                disabled={isPending || !titleValid}
              >
                <Save aria-hidden="true" className="size-4" />
                Salvar rascunho
              </Button>
            ) : null}
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
                onClick={() => void runSubmit()}
                disabled={isPending || !readyToSubmit}
              >
                <Send aria-hidden="true" className="size-4" />
                {isPending
                  ? PHASE_MESSAGE[phase as Exclude<WizardPhase, "idle">]
                  : isRevise
                    ? "Enviar versão revisada"
                    : "Enviar para aprovação"}
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
  description,
  setDescription,
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
  description: string;
  setDescription: (v: string) => void;
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
        <FieldLabel htmlFor="wizard-doctype">Tipo</FieldLabel>
        <NativeSelect
          id="wizard-doctype"
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
        >
          {DOC_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
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
        <FieldLabel htmlFor="wizard-description">Descrição</FieldLabel>
        <Textarea
          id="wizard-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ex.: Diretrizes de higienização das mãos aplicáveis a toda a unidade."
        />
        <FieldDescription>
          Opcional — um resumo do propósito do documento, exibido no cabeçalho.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="wizard-tags">Etiquetas</FieldLabel>
        <TagField id="wizard-tags" value={tags} onChange={setTags} />
        <FieldDescription>Opcional — pressione Enter para adicionar.</FieldDescription>
      </Field>
    </div>
  );
}

/**
 * Step 1 in the locked-identity modes: the frozen document identity + a mode-specific
 * callout. Everything is read-only — to change the header the user edits the document
 * instead (ADR 0081 Wave 2.5b).
 *
 * - `newversion`: "you are creating v{next} which replaces v{current}".
 * - `revise`: "v{current} received change requests; the corrected artifact goes back
 *   into approval and the version number is kept" (revise in place, no bump).
 */
function StepLockedIdentity({
  headingRef,
  locked,
  variant,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  locked: LockedIdentity;
  variant: "newversion" | "revise";
}) {
  const isRevise = variant === "revise";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {isRevise ? "Revisar versão" : "Nova versão"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRevise
            ? "A identidade do documento é mantida. Anexe o arquivo corrigido e confirme os aprovadores nas próximas etapas."
            : "A identidade do documento é mantida. Anexe o novo arquivo e indique os aprovadores nas próximas etapas."}
        </p>
      </div>

      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl border p-3.5 text-sm text-foreground",
          isRevise
            ? "border-warning/30 bg-warning/12"
            : "border-primary/20 bg-accent/30",
        )}
      >
        {isRevise ? (
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
        ) : (
          <GitBranchPlus
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
        )}
        <p className="text-pretty">
          {isRevise ? (
            <>
              A{" "}
              <strong className="font-semibold">
                {formatVersionNumber(locked.currentVersionNumber)}
              </strong>{" "}
              recebeu solicitações de alteração. Envie a versão corrigida para uma
              nova rodada de aprovação — o número da versão é mantido.
            </>
          ) : (
            <>
              Você está criando a{" "}
              <strong className="font-semibold">
                {formatVersionNumber(locked.nextVersionNumber)}
              </strong>
              ; ao aprovar, ela substitui a{" "}
              {formatVersionNumber(locked.currentVersionNumber)} vigente.
            </>
          )}
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-muted/20">
        <IdentityRow label="Documento">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{locked.title}</span>
            <DocumentTypeBadge docType={locked.docType} />
          </span>
        </IdentityRow>
        <IdentityRow label="Código">
          <span className="font-mono text-primary">{locked.code}</span>
        </IdentityRow>
        <IdentityRow label="Categoria">
          <span className="text-foreground">{locked.category ?? "—"}</span>
        </IdentityRow>
        <IdentityRow label={isRevise ? "Versão" : "Nova versão"}>
          <span className="font-mono tabular-nums text-foreground">
            {formatVersionNumber(
              isRevise ? locked.currentVersionNumber : locked.nextVersionNumber,
            )}
          </span>
        </IdentityRow>
      </dl>

      <p className="text-xs text-muted-foreground text-pretty">
        Para alterar o título, o tipo ou a categoria, edite o documento — não é
        possível alterá-los {isRevise ? "ao revisar uma versão" : "ao criar uma nova versão"}.
      </p>
    </div>
  );
}

function IdentityRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
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
  summaryRequired,
  nextVersionNumber,
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
  /** New-version mode requires the change summary; create mode leaves it optional. */
  summaryRequired: boolean;
  /** Read-only target version ("v3") in new-version mode; null in create mode. */
  nextVersionNumber: number | null;
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

      {nextVersionNumber != null ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Versão a criar</span>
          <span className="font-mono tabular-nums font-semibold text-foreground">
            {formatVersionNumber(nextVersionNumber)}
          </span>
        </div>
      ) : null}

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
        <FieldLabel htmlFor="wizard-summary">
          Resumo das alterações{summaryRequired ? " *" : ""}
        </FieldLabel>
        <Textarea
          id="wizard-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          placeholder="Descreva o que esta versão traz. Fica registrado no histórico."
          aria-invalid={fieldErrors.summaryOfChangesMd ? true : undefined}
          aria-describedby="wizard-summary-description"
        />
        <FieldDescription id="wizard-summary-description">
          {summaryRequired
            ? "Obrigatório — descreve o que muda em relação à versão vigente."
            : "Opcional — registrado permanentemente no histórico da versão."}
        </FieldDescription>
        <FieldError>{fieldErrors.summaryOfChangesMd}</FieldError>
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
          Aprovadores ({approvers.length}{" "}
          {plural(approvers.length, "selecionado", "selecionados")})
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
  locked,
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
  /** Set in new-version mode — the confirm card reflects the frozen identity. */
  locked?: LockedIdentity;
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
  const displayTitle = locked ? locked.title : title || "Sem título";
  const displayDocType = locked ? locked.docType : docType;
  const displayCategory = locked ? locked.category ?? "" : category;
  const displayVersion = locked
    ? formatVersionNumber(locked.nextVersionNumber)
    : "v1";
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
            <h3 className="truncate font-semibold">{displayTitle}</h3>
            <DocumentTypeBadge docType={displayDocType} />
            <span className="font-mono text-xs text-muted-foreground">
              {displayVersion}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {displayCategory ? displayCategory : "Sem categoria"}
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
