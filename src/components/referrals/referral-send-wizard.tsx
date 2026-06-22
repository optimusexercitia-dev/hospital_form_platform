"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import {
  addReferralSharedItem,
  createReferralDraft,
  sendReferral,
  setReferralPatient,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import type {
  ReferralPatient,
  ReferralType,
} from "@/lib/referrals/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { cn } from "@/lib/utils";
import {
  EMPTY_REFERRAL_PATIENT_DRAFT,
  ReferralPatientFields,
  referralPatientDraftHasData,
  referralPatientDraftToInput,
  type ReferralPatientDraft,
} from "./referral-patient-fields";
import { ReferralTypeChip } from "./referral-chips";
import { formatFileSize } from "./format";

const FIELD_CLASS =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** A target commission the source coordinator may refer TO (id + name). */
export interface ReferralTargetCommission {
  id: string;
  name: string;
}

/** A case narrative the wizard can snapshot (only those WITH a body are pickable). */
export interface PickableNarrative {
  id: string;
  /** Snapshotted slot label (or per-slot title). */
  label: string;
  bodyMd: string;
}

/** A case document the wizard can snapshot (the storage reference freezes). */
export interface PickableDocument {
  id: string;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

/** Pre-fill sourced from the case's own `case_patient` OR a linked safety event
 * (an AUDITED PHI read — ADR 0038). Loaded LAZILY on the wizard's patient step (not
 * eagerly at card mount), so the audited read (`case_patient.read` or the fallback
 * `event_patient.read`) fires only when a coordinator actually reaches the patient
 * block — minimum-necessary access. `null` = no source with PHI, or the caller
 * isn't entitled. */
export interface SafetyEventPrefill {
  /** Which origin the identifiers were copied from (drives the caption; ADR 0038):
   * `'case'` (the case's own `case_patient`) or `'event'` (a linked event). */
  source: "case" | "event";
  /** Opaque provenance id (not surfaced as a code): the source case id when
   * `source === 'case'`, the linked event id when `source === 'event'`. */
  eventId: string;
  patient: ReferralPatient;
}

type StepId = "details" | "snapshot" | "patient" | "review";

const STEPS: { id: StepId; label: string }[] = [
  { id: "details", label: "Detalhes" },
  { id: "snapshot", label: "Conteúdo" },
  { id: "patient", label: "Paciente" },
  { id: "review", label: "Revisão" },
];

/** Map a {@link SafetyEventPrefill} patient into the editable draft (strings). */
function prefillToDraft(patient: ReferralPatient): ReferralPatientDraft {
  return {
    name: patient.name ?? "",
    mrn: patient.mrn ?? "",
    dateOfBirth: patient.dateOfBirth ?? "",
    ageYears: patient.ageYears != null ? String(patient.ageYears) : "",
    sex: patient.sex,
    encounterRef: patient.encounterRef ?? "",
    unit: patient.unit ?? "",
    attending: patient.attending ?? "",
  };
}

/**
 * The send-referral wizard (Decision 1/3/9/16). A `"use client"` multi-step
 * dialog a SOURCE coordinator drives to refer a case to another committee:
 *   1. Detalhes — type (seeds the reply-expected toggle from the type's
 *      `defaultResponseExpected`) + target commission + subject + description.
 *      Submitting opens the draft (`createReferralDraft`).
 *   2. Conteúdo — curate the snapshot: multi-select the case's narratives +
 *      documents; each pick freezes a copy onto the draft (`addReferralSharedItem`).
 *   3. Paciente (opcional) — minimum-necessary PHI (`setReferralPatient`); when the
 *      case has a linked safety event, offer to pre-fill from it.
 *   4. Revisão — review, then send (`sendReferral` freezes the snapshot server-side).
 *
 * The flow is incremental: the draft + its shared items are persisted as the
 * coordinator advances, so a mistaken close leaves a `rascunho` they can resume
 * from the hub (rather than losing work). Only `sendReferral` makes it visible to
 * the target.
 */
export function ReferralSendWizard({
  open,
  onOpenChange,
  sourceCaseId,
  sourceCaseNumber,
  referralTypes,
  targetCommissions,
  narratives,
  documents,
  onLoadSafetyPrefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCaseId: string;
  sourceCaseNumber: number | null;
  referralTypes: ReferralType[];
  targetCommissions: ReferralTargetCommission[];
  narratives: PickableNarrative[];
  documents: PickableDocument[];
  /** Lazily loads the linked-safety-event PHI pre-fill on the patient step (an
   * AUDITED read — see {@link SafetyEventPrefill}). Absent when the case can never
   * have a prefill. Returns `null` when none / out of scope. */
  onLoadSafetyPrefill?: () => Promise<SafetyEventPrefill | null>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<StepId>("details");
  const [error, setError] = useState<string | null>(null);

  // The minted draft id, set once step 1 succeeds; subsequent steps target it.
  const [referralId, setReferralId] = useState<string | null>(null);

  // Step 1 fields.
  const [referralTypeId, setReferralTypeId] = useState("");
  const [targetCommissionId, setTargetCommissionId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [responseExpected, setResponseExpected] = useState(true);

  // Step 2 selection: source ids the coordinator picked (kept local; each toggle
  // calls the freeze/remove RPC so the server stays the source of truth).
  const [pickedNarratives, setPickedNarratives] = useState<Set<string>>(new Set());
  const [pickedDocuments, setPickedDocuments] = useState<Set<string>>(new Set());

  // Step 3 PHI draft + the lazily-loaded safety-event prefill (audited read,
  // fetched once when the patient step is first reached).
  const [patient, setPatient] = useState<ReferralPatientDraft>(
    EMPTY_REFERRAL_PATIENT_DRAFT,
  );
  const [patientSaved, setPatientSaved] = useState(false);
  const [prefill, setPrefill] = useState<SafetyEventPrefill | null>(null);
  const [prefillState, setPrefillState] = useState<
    "idle" | "loading" | "loaded" | "none"
  >("idle");

  const selectedType = useMemo(
    () => referralTypes.find((t) => t.id === referralTypeId) ?? null,
    [referralTypes, referralTypeId],
  );
  const targetName = useMemo(
    () =>
      targetCommissions.find((c) => c.id === targetCommissionId)?.name ?? null,
    [targetCommissions, targetCommissionId],
  );

  // Reset the whole wizard when it (re)opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("details");
      setError(null);
      setReferralId(null);
      setReferralTypeId("");
      setTargetCommissionId("");
      setSubject("");
      setDescription("");
      setResponseExpected(true);
      setPickedNarratives(new Set());
      setPickedDocuments(new Set());
      setPatient(EMPTY_REFERRAL_PATIENT_DRAFT);
      setPatientSaved(false);
      setPrefill(null);
      setPrefillState("idle");
    }
  }

  /** Advance to the patient step, lazily firing the AUDITED prefill read the first
   * time it is reached (so the `event_patient.read` audit fires on intent, not on
   * card mount). Idempotent — only fetches once. */
  function goToPatientStep() {
    setStep("patient");
    if (prefillState !== "idle" || !onLoadSafetyPrefill) return;
    setPrefillState("loading");
    startTransition(async () => {
      try {
        const result = await onLoadSafetyPrefill();
        setPrefill(result);
        setPrefillState(result ? "loaded" : "none");
      } catch {
        // Best-effort — a prefill failure must never block manual PHI entry.
        setPrefillState("none");
      }
    });
  }

  /** Picking a type seeds the reply-expected toggle from its default. */
  function handleTypeChange(id: string) {
    setReferralTypeId(id);
    const t = referralTypes.find((x) => x.id === id);
    if (t) setResponseExpected(t.defaultResponseExpected);
  }

  // ---- Step 1 → create draft -------------------------------------------------
  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!referralTypeId) return setError(REFERRAL_MESSAGES.referralTypeRequired);
    if (!targetCommissionId)
      return setError(REFERRAL_MESSAGES.targetCommissionRequired);
    if (!subject.trim()) return setError(REFERRAL_MESSAGES.subjectRequired);

    startTransition(async () => {
      // If the draft already exists (the coordinator went back to step 1 and
      // re-submitted), keep it — re-creating would orphan the first. In v1 we
      // only create once; editing the draft's header is a hub affordance.
      if (referralId) {
        setStep("snapshot");
        return;
      }
      const result = await createReferralDraft({
        sourceCaseId,
        targetCommissionId,
        referralTypeId,
        subject: subject.trim(),
        descriptionMd: description.trim() || null,
        responseExpected,
      });
      if (!result.ok || !result.referralId) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      setReferralId(result.referralId);
      setStep("snapshot");
    });
  }

  // ---- Step 2 → toggle a shared item ----------------------------------------
  function toggleNarrative(id: string) {
    if (!referralId) return;
    const isPicked = pickedNarratives.has(id);
    setError(null);
    startTransition(async () => {
      const result = await addReferralSharedItem({
        referralId,
        kind: "narrative",
        sourceNarrativeId: isPicked ? null : id,
        sourceDocumentId: null,
      });
      // NOTE: removal is a hub-draft affordance in v1; here we only ADD. Toggling
      // OFF an already-frozen item before send is handled by the draft editor.
      // We optimistically reflect the ADD; a failed add reverts.
      if (!isPicked) {
        if (!result.ok) {
          setError(result.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        setPickedNarratives((prev) => new Set(prev).add(id));
      } else {
        setPickedNarratives((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function toggleDocument(id: string) {
    if (!referralId) return;
    const isPicked = pickedDocuments.has(id);
    setError(null);
    startTransition(async () => {
      const result = await addReferralSharedItem({
        referralId,
        kind: "document",
        sourceNarrativeId: null,
        sourceDocumentId: isPicked ? null : id,
      });
      if (!isPicked) {
        if (!result.ok) {
          setError(result.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        setPickedDocuments((prev) => new Set(prev).add(id));
      } else {
        setPickedDocuments((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  // ---- Step 3 → save patient PHI --------------------------------------------
  function savePatientThenAdvance() {
    setError(null);
    if (!referralId) return;
    if (!referralPatientDraftHasData(patient)) {
      // Nothing to save — skip straight to review.
      setStep("review");
      return;
    }
    startTransition(async () => {
      const result = await setReferralPatient(
        referralId,
        referralPatientDraftToInput(patient),
      );
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      setPatientSaved(true);
      setStep("review");
    });
  }

  function applyPrefill() {
    if (prefill) setPatient(prefillToDraft(prefill.patient));
  }

  // ---- Step 4 → send ---------------------------------------------------------
  function send() {
    setError(null);
    if (!referralId) return;
    startTransition(async () => {
      const result = await sendReferral(referralId);
      if (!result.ok) {
        setError(result.error ?? REFERRAL_MESSAGES.generic);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const sharedCount = pickedNarratives.size + pickedDocuments.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Encaminhar{" "}
            {sourceCaseNumber != null
              ? `Caso ${String(sourceCaseNumber).padStart(4, "0")}`
              : "caso"}
          </DialogTitle>
          <DialogDescription>
            Compartilhe uma visão selecionada deste caso com outra comissão para
            análise ou ciência.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator — pure presentational; the heading carries the meaning. */}
        <ol className="flex items-center gap-1.5" aria-label="Etapas">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} className="flex flex-1 items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:inline",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="h-px flex-1 bg-border"
                  />
                )}
              </li>
            );
          })}
        </ol>

        {error && <FormBanner tone="error">{error}</FormBanner>}

        {/* ---- Step 1: Detalhes ---- */}
        {step === "details" && (
          <form onSubmit={submitDetails} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tipo de encaminhamento</span>
              <select
                value={referralTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                required
                className={FIELD_CLASS}
              >
                <option value="" disabled>
                  Selecione um tipo…
                </option>
                {referralTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {selectedType?.description && (
                <span className="text-xs text-muted-foreground text-pretty">
                  {selectedType.description}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Comissão de destino</span>
              <select
                value={targetCommissionId}
                onChange={(e) => setTargetCommissionId(e.target.value)}
                required
                className={FIELD_CLASS}
              >
                <option value="" disabled>
                  Selecione a comissão…
                </option>
                {targetCommissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {targetCommissions.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Nenhuma outra comissão disponível para encaminhamento.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Assunto</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={200}
                className={FIELD_CLASS}
                placeholder="Resumo de uma linha (sem dados do paciente)"
              />
              <span className="text-xs text-muted-foreground">
                Visível em listas e painéis — não inclua identificação do
                paciente aqui.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Descrição{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={FIELD_CLASS}
                placeholder="Contexto para a comissão de destino. Aceita Markdown."
              />
            </label>

            <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <input
                type="checkbox"
                checked={responseExpected}
                onChange={(e) => setResponseExpected(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Aguardar resposta</span>
                <span className="text-xs text-muted-foreground text-pretty">
                  A comissão de destino deverá registrar um resultado. Enquanto a
                  resposta estiver pendente, o caso de origem não pode ser
                  encerrado.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "Salvando…" : "Continuar"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </form>
        )}

        {/* ---- Step 2: Conteúdo (snapshot curation) ---- */}
        {step === "snapshot" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground text-pretty">
              Selecione as narrativas e os documentos a compartilhar. A comissão
              de destino verá apenas uma cópia congelada destes itens — não o caso
              ao vivo. Edições posteriores no caso de origem não alteram o que foi
              enviado.
            </p>

            <section
              aria-labelledby="wizard-narratives-heading"
              className="flex flex-col gap-2"
            >
              <h3
                id="wizard-narratives-heading"
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                Narrativas
              </h3>
              {narratives.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                  Nenhuma narrativa preenchida neste caso.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {narratives.map((n) => {
                    const picked = pickedNarratives.has(n.id);
                    return (
                      <li key={n.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                            picked
                              ? "border-primary/40 bg-accent/40"
                              : "border-border bg-card hover:bg-muted/30",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={picked}
                            onChange={() => toggleNarrative(n.id)}
                            disabled={isPending}
                            className="mt-0.5 size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                          />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground">
                              {n.label}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground text-pretty">
                              {n.bodyMd}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="wizard-documents-heading"
              className="flex flex-col gap-2"
            >
              <h3
                id="wizard-documents-heading"
                className="inline-flex items-center gap-2 text-sm font-semibold"
              >
                <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" />
                Documentos
              </h3>
              {documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                  Nenhum documento neste caso.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {documents.map((d) => {
                    const picked = pickedDocuments.has(d.id);
                    const size = formatFileSize(d.sizeBytes);
                    return (
                      <li key={d.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                            picked
                              ? "border-primary/40 bg-accent/40"
                              : "border-border bg-card hover:bg-muted/30",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={picked}
                            onChange={() => toggleDocument(d.id)}
                            disabled={isPending}
                            className="size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {d.title}
                            </span>
                            {size && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {size}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setStep("details")}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={goToPatientStep}
                disabled={isPending}
              >
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- Step 3: Paciente (opcional) ---- */}
        {step === "patient" && (
          <div className="flex flex-col gap-4">
            {prefillState === "loading" && (
              <p className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" />
                Verificando identificação do paciente vinculada…
              </p>
            )}
            {prefillState === "loaded" && prefill && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-accent/40 p-3">
                <p className="inline-flex items-center gap-2 text-sm text-accent-foreground">
                  <Sparkles aria-hidden="true" className="size-4 text-primary" />
                  {prefill.source === "case"
                    ? "Este caso tem identificação do paciente registrada."
                    : "Há um evento de segurança vinculado a este caso."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyPrefill}
                  disabled={isPending}
                >
                  {prefill.source === "case"
                    ? "Pré-preencher do caso"
                    : "Pré-preencher do evento"}
                </Button>
              </div>
            )}

            <ReferralPatientFields
              draft={patient}
              onChange={setPatient}
              disabled={isPending}
              idPrefix="referral-wizard-patient"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setStep("snapshot")}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={savePatientThenAdvance}
                disabled={isPending}
              >
                {isPending ? "Salvando…" : "Continuar"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* ---- Step 4: Revisão ---- */}
        {step === "review" && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Tipo
                </dt>
                <dd className="text-sm">
                  {selectedType ? (
                    <ReferralTypeChip
                      label={selectedType.label}
                      colorToken={selectedType.colorToken}
                    />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Destino
                </dt>
                <dd className="text-sm text-foreground">{targetName ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:col-span-2">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Assunto
                </dt>
                <dd className="text-sm text-foreground">{subject}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Resposta
                </dt>
                <dd className="text-sm text-foreground">
                  {responseExpected ? "Aguarda resposta" : "Apenas ciência"}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Itens compartilhados
                </dt>
                <dd className="text-sm text-foreground tabular-nums">
                  {pickedNarratives.size}{" "}
                  {pickedNarratives.size === 1 ? "narrativa" : "narrativas"},{" "}
                  {pickedDocuments.size}{" "}
                  {pickedDocuments.size === 1 ? "documento" : "documentos"}
                </dd>
              </div>
              {(patientSaved || referralPatientDraftHasData(patient)) && (
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Paciente
                  </dt>
                  <dd className="inline-flex items-center gap-1.5 text-sm text-warning">
                    <ShieldAlert aria-hidden="true" className="size-3.5" />
                    Identificação registrada (dados sensíveis)
                  </dd>
                </div>
              )}
            </dl>

            {sharedCount === 0 && (
              <FormBanner tone="info">
                Nenhum item selecionado. Você pode enviar apenas com o assunto e a
                descrição, ou voltar e adicionar narrativas/documentos.
              </FormBanner>
            )}

            <p className="text-xs text-muted-foreground text-pretty">
              Ao enviar, o conteúdo compartilhado é congelado e a comissão de
              destino é notificada. Você poderá retirar o encaminhamento, mas não
              alterar o que foi enviado.
            </p>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setStep("patient")}
                disabled={isPending}
              >
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
              <Button type="button" size="lg" onClick={send} disabled={isPending}>
                <Send aria-hidden="true" />
                {isPending ? "Enviando…" : "Enviar encaminhamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
