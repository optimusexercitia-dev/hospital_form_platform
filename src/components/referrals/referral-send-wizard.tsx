"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
  removeReferralSharedItem,
  sendReferral,
  setReferralPatient,
  updateReferralDraft,
} from "@/lib/referrals/actions";
import { REFERRAL_MESSAGES } from "@/lib/referrals/messages";
import {
  REFERRAL_PRIORITY_LABELS,
  type ReferralDetail,
  type ReferralPatient,
  type ReferralPriority,
  type ReferralRequestedAction,
  type ReferralType,
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
import { NativeSelect } from "@/components/ui/native-select";
import { PhiInputHint } from "@/components/ui/phi-input-hint";
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

/** Priority options in ascending severity (RV2 R2), for the wizard's select. */
const PRIORITY_ORDER: ReferralPriority[] = [
  "routine",
  "high",
  "urgent",
  "critical",
];

/** Convert a `datetime-local` value (`YYYY-MM-DDTHH:mm`, local wall-clock) to an
 * ISO timestamp for the SLA deadline; `""` → `null` (no deadline). Best-effort — an
 * unparseable value yields `null` rather than throwing (the RPC also rejects a past
 * date via HC0A4). */
function localDateTimeToIso(value: string): string | null {
  if (!value.trim()) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/** The current local wall-clock as a `datetime-local` value (`YYYY-MM-DDTHH:mm`),
 * used as the deadline input's `min` so a past date can't be picked (the RPC also
 * rejects it via HC0A4). */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * `Salvar rascunho` — present on ALL FOUR steps (ADR 0137 D5), always to the LEFT of
 * the step's primary action.
 *
 * ⚠ Disabled until step 1's three required fields are filled, and that is a hard
 * dependency rather than a UX nicety: `create_referral_draft` cannot be called
 * without type + destination + subject, so an enabled button here would offer an act
 * the platform cannot perform. The `title` explains the disabled state instead of
 * leaving it inert and unexplained.
 */
function SaveDraftButton({
  onSave,
  disabled,
  ready,
  busy,
}: {
  onSave: () => void;
  disabled: boolean;
  /** Whether step 1's required fields are complete (drives the explanatory title). */
  ready: boolean;
  busy: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onSave}
      disabled={disabled}
      title={
        ready
          ? undefined
          : "Preencha tipo, destino e assunto para salvar um rascunho."
      }
    >
      {busy ? "Salvando…" : "Salvar rascunho"}
    </Button>
  );
}

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
 *   2. Conteúdo — curate the snapshot: multi-select the case's narratives + documents.
 *   3. Paciente — minimum-necessary PHI; when the case has a linked safety event or
 *      its own identifiers, offer to pre-fill from them (an AUDITED read, on intent).
 *   4. Revisão — review, then send.
 *
 * ## Creation is DEFERRED (ADR 0137 **D5**) — this is the load-bearing change
 *
 * Every step buffers CLIENT-SIDE. Nothing is persisted until the coordinator presses
 * `Enviar` or `Salvar rascunho`, which run {@link flush} — create draft → add each
 * picked item → save PHI → send. Two things follow, and both were the point:
 *
 *  - **A `rascunho` is now an explicit act.** Step 1 used to mint the draft on
 *    "Continuar", so abandoning the wizard left litter nobody asked for.
 *  - ⭐ **The un-pick defect dies structurally.** The old steps 2–3 round-tripped per
 *    toggle, and the un-pick branch called `addReferralSharedItem` with BOTH source
 *    ids null and then ignored the result — dropping the item locally while the
 *    frozen row survived server-side, so an un-picked narrative was still shipped to
 *    the receiving committee. With buffers there is no call to ignore: the flush only
 *    ever ADDs, and it adds exactly what the Set holds at press time.
 *
 * ⚠ The flush is multi-step and NON-ATOMIC — no transaction spans those RPCs. Its
 * partial-failure policy is stated on {@link flush} and is part of the contract, not
 * an implementation detail.
 */
export function ReferralSendWizard({
  open,
  onOpenChange,
  sourceCaseId,
  sourceCaseNumber,
  referralTypes,
  requestedActions,
  targetCommissions,
  technicalDirectionHospitalId,
  narratives,
  documents,
  parentReferralId,
  onLoadSafetyPrefill,
  resumeReferralId = null,
  onLoadDraft,
  onLoadPatient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceCaseId: string;
  sourceCaseNumber: number | null;
  referralTypes: ReferralType[];
  /** RV2 R2: the active requested-action vocabulary ("o que se pede"). */
  requestedActions: ReferralRequestedAction[];
  targetCommissions: ReferralTargetCommission[];
  /**
   * ADR 0094 W4 / FUP-MEM-3 — the SOURCE commission's own hospital, enabling the
   * "direção técnica" destination. `null`/absent hides that arm entirely (the
   * `technical_director` flag is off, or the commission has no hospital).
   *
   * An id and no name, deliberately: `hospitals_select` does not admit a plain
   * commission member, so the coordinator driving this wizard generally cannot read
   * the hospital's NAME. It costs nothing here — a commission belongs to exactly one
   * hospital, so "a direção técnica do hospital" is unambiguous from inside it, and
   * naming it would mean adding a read path (and a new authz gate) for a label.
   *
   * The RPC refuses any OTHER hospital with HC071, so this is never a free choice.
   */
  technicalDirectionHospitalId?: string | null;
  narratives: PickableNarrative[];
  documents: PickableDocument[];
  /** RV2 R3: when set, this draft is a FORWARD ("Encaminhar adiante") — the new
   * referral's `parent_referral_id` lineage back-pointer. `null`/absent for a root
   * referral. The child shares NOTHING from the parent automatically (D15). */
  parentReferralId?: string | null;
  /** Lazily loads the linked-safety-event PHI pre-fill on the patient step (an
   * AUDITED read — see {@link SafetyEventPrefill}). Absent when the case can never
   * have a prefill. Returns `null` when none / out of scope. */
  onLoadSafetyPrefill?: () => Promise<SafetyEventPrefill | null>;
  /**
   * RESUME (ADR 0137 **D6**): the `rascunho` this wizard should reopen and continue,
   * or `null`/absent for a fresh referral. Set by the case's Encaminhamentos card
   * when a `draft` row is clicked; non-draft statuses keep navigating to the detail
   * page.
   */
  resumeReferralId?: string | null;
  /**
   * Loads the draft named by {@link resumeReferralId}. Injected rather than imported
   * because `getReferralDetail` lives in a server QUERY module — a client
   * value-import of it aborts `next build` while every static gate stays green. The
   * host binds the `'use server'` `loadReferralDraft`, which returns `null` for a
   * miss, a non-draft, or an unentitled caller.
   *
   * ⛔ **REQUIRED, and that is the point.** While this was optional, {@link flush}
   * carried a documented bound — a host that omitted it could not remove a
   * previously-frozen un-picked item, so the send had to fail closed. Making it
   * non-optional deletes that whole branch: the bound is now structurally impossible
   * instead of merely written down, and a reader cannot violate a signature the way
   * they can overlook a caveat.
   */
  onLoadDraft: (referralId: string) => Promise<ReferralDetail | null>;
  /**
   * Loads the draft's ALREADY-SAVED patient identifiers, lazily, when the patient
   * step is first reached on a resume (the audited `get_referral_patient` door —
   * `referral_patient.read`). Kept off the resume load itself so reopening a draft
   * to fix its subject never touches PHI.
   */
  onLoadPatient?: (referralId: string) => Promise<ReferralPatient | null>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Stable ids so the "Aguardar resposta" checkbox is labelled by its title only
  // and describes its helper text via aria-describedby (accessible name a11y).
  const responseExpectedId = useId();
  const responseExpectedHelpId = useId();

  const [step, setStep] = useState<StepId>("details");
  const [error, setError] = useState<string | null>(null);

  // The minted draft id. `null` until the FIRST flush succeeds in creating it; from
  // then on it is never re-minted for this wizard session (flush policy 1).
  const [referralId, setReferralId] = useState<string | null>(null);
  /**
   * SOURCE id → the `referral_shared_item` id already frozen for it on the server.
   *
   * ⭐ This is the diff basis, and it is deliberately SERVER TRUTH rather than local
   * bookkeeping: {@link flush} refreshes it from `onLoadDraft` before computing what
   * to add and what to remove. That single choice makes three things fall out —
   * retrying after a partial failure re-adds nothing (the successes are already in
   * here), resuming a draft knows what is on it, and un-picking a previously-frozen
   * item can actually REMOVE it, because removal needs the shared-item id and this is
   * where that id lives. A local "what I added" set could do the first and neither of
   * the other two.
   */
  const [frozenItems, setFrozenItems] = useState<Map<string, string>>(new Map());
  /** Resume lifecycle (D6). `error` keeps the wizard open with a pt-BR message. */
  const [resumeState, setResumeState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  /** PHI-prefill lifecycle for a resumed draft (fires on reaching the step).
   *
   * ⛔ THIS IS A STATE MACHINE AND NOT A BOOLEAN, AND THE REASON IS A FIXED BUG
   * (`FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE`). The boolean it replaces was
   * latched to `true` BEFORE the await and the failure was swallowed, so one
   * transient read error meant the saved PHI never loaded again for the whole
   * session — and the next keystroke's full-replace upsert then BLANKED the stored
   * `mrn` / `name` / `date_of_birth`. D4's send gate catches only the MRN.
   *
   * ⚠ `error` is load-bearing in TWO places and must stay distinguishable from
   * `idle`: it permits a RETRY on re-entry (which `idle` also would), and it makes
   * the flush refuse to write PHI (which `idle` must NOT, because an untouched
   * never-visited step is not a failed read). Collapsing them re-opens the bug. */
  const [resumePatientState, setResumePatientState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const isResume = Boolean(resumeReferralId);

  // Step 1 fields.
  const [referralTypeId, setReferralTypeId] = useState("");
  // ADR 0094 W4 — the destination is a SUM TYPE, so the UI models it as one: a kind
  // plus the payload the kind needs, never two independent fields that could both be
  // set. `technical_director` carries no payload beyond the source hospital, which is
  // fixed, so there is nothing to pick once it is chosen.
  const [targetKind, setTargetKind] = useState<"commission" | "technical_director">(
    "commission",
  );
  const [targetCommissionId, setTargetCommissionId] = useState("");
  const technicalDirectionAvailable = Boolean(technicalDirectionHospitalId);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [responseExpected, setResponseExpected] = useState(true);
  // RV2 R2 triage fields (PHI-free): priority (defaults `routine`), the picked
  // requested-action, and an optional SLA deadline (local wall-clock in the input).
  const [priority, setPriority] = useState<ReferralPriority>("routine");
  const [requestedActionId, setRequestedActionId] = useState("");
  const [responseDueAt, setResponseDueAt] = useState("");

  // Step 2 selection (ADR 0137 **D5**): PURE LOCAL BUFFERS. Nothing is persisted
  // until `flush()`. Before D5 each toggle round-tripped to the server, which is
  // what made the un-pick defect possible; see `flush` for the whole rationale.
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
      targetKind === "technical_director"
        ? "Direção técnica do hospital"
        : (targetCommissions.find((c) => c.id === targetCommissionId)?.name ??
          null),
    [targetCommissions, targetCommissionId, targetKind],
  );
  const requestedActionLabel = useMemo(
    () =>
      requestedActions.find((a) => a.id === requestedActionId)?.label ?? null,
    [requestedActions, requestedActionId],
  );

  // Reset the whole wizard when it (re)opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("details");
      setError(null);
      setReferralId(null);
      setFrozenItems(new Map());
      setResumeState("idle");
      // Back to `idle`, not `error` — reopening the dialog is the recovery path the
      // `patientReloadFailed` message tells the coordinator to take, so a fresh open
      // must be allowed to re-attempt the audited read.
      setResumePatientState("idle");
      setReferralTypeId("");
      setTargetCommissionId("");
      setSubject("");
      setDescription("");
      setResponseExpected(true);
      setPriority("routine");
      setRequestedActionId("");
      setResponseDueAt("");
      setPickedNarratives(new Set());
      setPickedDocuments(new Set());
      setPatient(EMPTY_REFERRAL_PATIENT_DRAFT);
      setPatientSaved(false);
      setPrefill(null);
      setPrefillState("idle");
    }
  }

  /**
   * RESUME (D6): hydrate the wizard from an existing `rascunho` — header fields, the
   * picked source ids, and the shared-item ids those picks correspond to.
   *
   * ⛔ PHI is NOT loaded here. Reopening a draft to fix its subject must not fire
   * `referral_patient.read`; that read happens on reaching the patient step
   * ({@link goToPatientStep}), so the audit reflects intent (Rule 11 / Rule 12
   * minimum-necessary), exactly as the safety-event prefill already does.
   */
  // ⚠ The once-only guard is a REF, not `resumeState`. Reading state here and
  // setting it in the effect body is a synchronous setState inside an effect, which
  // cascades renders and fails `react-hooks/set-state-in-effect`. A ref guards the
  // fetch without a render, and the visible state moves inside the transition.
  const resumeRequested = useRef(false);
  useEffect(() => {
    if (!open || !resumeReferralId) return;
    if (resumeRequested.current) return;
    resumeRequested.current = true;
    startTransition(async () => {
      setResumeState("loading");
      const detail = await onLoadDraft(resumeReferralId);
      if (!detail) {
        // `loadReferralDraft` returns null for a miss, a NON-draft, or an unentitled
        // caller. All three are "this is not a resumable draft" to the coordinator.
        setResumeState("error");
        // Reusing the existing message rather than minting one: `messages.ts` is
        // backend-owned this increment, and "Encaminhamento não encontrado." is
        // accurate for the dominant case (a draft discarded in another tab). It reads
        // slightly off for the race where the draft was SENT meanwhile — rare, since
        // the card offers resume only on a `draft` row.
        setError(REFERRAL_MESSAGES.missingReferral);
        return;
      }
      setReferralId(detail.id);
      setReferralTypeId(detail.referralTypeId ?? "");
      setTargetKind(
        detail.targetType === "technical_director"
          ? "technical_director"
          : "commission",
      );
      setTargetCommissionId(detail.targetCommissionId ?? "");
      setSubject(detail.subject);
      setDescription(detail.descriptionMd ?? "");
      setResponseExpected(detail.responseExpected);
      setPriority(detail.priority);
      setRequestedActionId(detail.requestedActionId ?? "");
      // Rehydrate the picks from the frozen items' provenance back-pointers. A
      // `sourceNarrativeId`/`sourceDocumentId` of null means the source row was
      // deleted after sharing — the frozen copy survives but there is nothing to
      // map it back to, so it cannot be represented as a "pick" and is skipped.
      const narrativeIds = new Set<string>();
      const documentIds = new Set<string>();
      const frozen = new Map<string, string>();
      for (const item of detail.sharedItems) {
        const sourceId =
          item.kind === "narrative" ? item.sourceNarrativeId : item.sourceDocumentId;
        if (!sourceId) continue;
        frozen.set(sourceId, item.id);
        if (item.kind === "narrative") narrativeIds.add(sourceId);
        else documentIds.add(sourceId);
      }
      setPickedNarratives(narrativeIds);
      setPickedDocuments(documentIds);
      setFrozenItems(frozen);
      setResumeState("loaded");
    });
    // Deps are COMPLETE — no suppression needed. Moving the once-only guard to a ref
    // removed `resumeState` from this effect, which is what made the honest dep array
    // possible; the earlier version needed a disable directive to hide it.
  }, [open, resumeReferralId, onLoadDraft]);

  /** Advance to the patient step, lazily firing the AUDITED prefill read the first
   * time it is reached (so the `event_patient.read` audit fires on intent, not on
   * card mount). Idempotent — only fetches once. */
  function goToPatientStep() {
    setStep("patient");
    // RESUME (D6): fetch the identifiers already saved on this draft, once, through
    // the audited `get_referral_patient` door. Fires here rather than on the resume
    // load so `referral_patient.read` records reaching the PHI step, not reopening
    // the draft.
    if (
      isResume &&
      referralId &&
      onLoadPatient &&
      (resumePatientState === "idle" || resumePatientState === "error")
    ) {
      setResumePatientState("loading");
      startTransition(async () => {
        try {
          const saved = await onLoadPatient(referralId);
          if (saved) {
            setPatient(prefillToDraft(saved));
            setPatientSaved(true);
          }
          setResumePatientState("loaded");
        } catch {
          // ⛔ FAIL CLOSED, AND DO NOT LATCH. The previous version marked the load
          // done before awaiting and swallowed this silently, which turned one
          // transient read failure into a PHI OVERWRITE: `patient` stayed empty,
          // and the first keystroke made the flush's full-replace upsert blank the
          // stored identifiers. `error` both permits a retry on re-entry and stops
          // the flush from writing (see `flush` step 3).
          setResumePatientState("error");
        }
      });
    }
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

  // ---- Step 1 → validate locally (NO persistence; ADR 0137 D5) ---------------
  /** Whether step 1 carries everything `create_referral_draft` needs. Also gates
   * `Salvar rascunho` on every step — the RPC cannot be called without these three. */
  const detailsComplete =
    Boolean(referralTypeId) &&
    (targetKind === "commission"
      ? Boolean(targetCommissionId)
      : Boolean(technicalDirectionHospitalId)) &&
    Boolean(subject.trim());

  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!referralTypeId) return setError(REFERRAL_MESSAGES.referralTypeRequired);
    if (targetKind === "commission" && !targetCommissionId)
      return setError(REFERRAL_MESSAGES.targetCommissionRequired);
    if (targetKind === "technical_director" && !technicalDirectionHospitalId)
      return setError(REFERRAL_MESSAGES.referralTargetRequired);
    if (!subject.trim()) return setError(REFERRAL_MESSAGES.subjectRequired);
    // ⛔ NOTHING IS PERSISTED HERE ANY MORE (D5). Step 1 used to mint the draft, which
    // is why an abandoned wizard left `rascunho` litter behind and why steps 2–3 had a
    // server round trip to hang the un-pick bug on. Creation is now an explicit act.
    setStep("snapshot");
  }

  // ---- Step 2 → toggle a PURE LOCAL pick (no I/O) ----------------------------
  // ⭐ THE UN-PICK DEFECT DIES HERE, and it is worth naming what it was: the old
  // toggles called `addReferralSharedItem` with BOTH source ids null on an un-pick,
  // then read `result.ok` only on the ADD branch — so the refusal was discarded and
  // local state dropped the item while the frozen row survived server-side. The item
  // vanished from the coordinator's screen and was still shipped to the receiving
  // committee. A Set toggle cannot reproduce that: there is no call to ignore.
  function toggleNarrative(id: string) {
    setError(null);
    setPickedNarratives((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function toggleDocument(id: string) {
    setError(null);
    setPickedDocuments((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function applyPrefill() {
    if (prefill) setPatient(prefillToDraft(prefill.patient));
  }

  // ---- The FLUSH — the only thing that writes (ADR 0137 D5) ------------------
  /**
   * Persist the buffered wizard in order: create the draft → add each picked item →
   * save the PHI buffer → send (when `mode === 'send'`).
   *
   * ⛔ **PARTIAL-FAILURE POLICY, and it is stated here because there is no
   * transaction across these RPCs.** Each step is its own round trip, so a later one
   * can fail with the draft already minted. The policy, in order of importance:
   *
   *  1. **The minted id is KEPT in `referralId` and never re-created.** If the draft
   *     exists and a later step fails, retrying calls `create_referral_draft` again
   *     ONLY if `referralId` is still null. Re-creating would orphan the first draft —
   *     an invisible duplicate the coordinator cannot see or discard from here.
   *  2. **The item diff is computed against SERVER TRUTH, re-read each flush.** When
   *     the draft already exists, `frozenItems` is refreshed from `onLoadDraft` before
   *     anything is written, and adds/removes are the difference between that and the
   *     buffers. The RPC has no upsert semantics, so a retry after a mid-list failure
   *     would otherwise duplicate every item that had already succeeded.
   *  3. **The user retries; we never auto-retry.** The error surfaces in the banner and
   *     the wizard stays open on its current step with the buffers intact, so a retry
   *     resumes rather than restarts.
   *
   * ⭐ Re-reading is also what makes UN-PICKING correct on a resumed draft. Removal
   * needs the `referral_shared_item` id, which the wizard's source-keyed buffers do
   * not carry; `frozenItems` is the map that supplies it. Without this the resume path
   * would silently reproduce the very defect D5 exists to kill — an item un-picked on
   * screen and still shipped.
   *
   * ⭐ **The governing principle, which outlived the code that implemented it:**
   * *refuse rather than ship more than the screen shows.* An earlier version made
   * `onLoadDraft` optional and had to fail the send closed when a host omitted it,
   * because the refresh that supplies the removal ids could not run. `onLoadDraft` is
   * now REQUIRED, so that configuration cannot be constructed and the branch is gone —
   * but the principle is why the branch existed, and it is what any future change here
   * must preserve. Sending an item the coordinator un-picked is the one outcome D5
   * forbids.
   *
   * ⚠ What this deliberately does NOT do: roll back a partial flush. A half-flushed
   * draft is a real, reachable state — `rascunho`, invisible to the target, resumable,
   * and discardable from the referral detail page. That is the accepted outcome.
   */
  function flush(mode: "draft" | "send") {
    setError(null);
    if (!detailsComplete) {
      setError(REFERRAL_MESSAGES.subjectRequired);
      return;
    }
    startTransition(async () => {
      // 1. The draft — created at most ONCE per session (policy 1), otherwise its
      //    header is UPDATED so edits made after a first flush are not lost.
      //    `update_referral_draft` takes no target argument: the destination is
      //    immutable by design (D7).
      let id = referralId;
      let frozen = frozenItems;
      if (!id) {
        const created = await createReferralDraft({
          sourceCaseId,
          // Exactly one arm reaches the RPC — the other is explicitly null, never ""
          // or undefined-by-omission, so the action's two-sided check reads the
          // intent rather than the absence.
          targetCommissionId:
            targetKind === "commission" ? targetCommissionId : null,
          targetHospitalId:
            targetKind === "technical_director"
              ? (technicalDirectionHospitalId ?? null)
              : null,
          referralTypeId,
          subject: subject.trim(),
          descriptionMd: description.trim() || null,
          responseExpected,
          priority,
          requestedActionId: requestedActionId || null,
          responseDueAt: localDateTimeToIso(responseDueAt),
          parentReferralId: parentReferralId ?? null,
        });
        if (!created.ok || !created.referralId) {
          setError(created.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        id = created.referralId;
        // Committed to state IMMEDIATELY, before any step that can fail — this is
        // what makes policy 1 hold across a retry.
        setReferralId(id);
      } else {
        const updated = await updateReferralDraft(id, {
          referralTypeId,
          subject: subject.trim(),
          descriptionMd: description.trim() || null,
          responseExpected,
          priority,
          requestedActionId: requestedActionId || null,
          responseDueAt: localDateTimeToIso(responseDueAt),
        });
        if (!updated.ok) {
          setError(updated.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        // Policy 2 — re-read what is actually frozen before diffing against it.
        // Unconditional: `onLoadDraft` is required, so there is no configuration in
        // which this refresh can be skipped.
        const fresh = await onLoadDraft(id);
        // ⛔ FAIL CLOSED (FUP-0137-FLUSH-FAILS-OPEN). This re-read is the ONLY thing
        // that keeps step 3 from re-adding items already frozen — the ADD step
        // records no new ids — so proceeding against the stale map on a null re-read
        // contradicted the docblock's own *refuse rather than ship more than the
        // screen shows* principle. ⚠ It became reachable rather than theoretical
        // when D4 made retries ordinary: `HC0T4` leaves this dialog open so the
        // coordinator supplies the MRN and flushes again.
        if (!fresh) {
          setError(REFERRAL_MESSAGES.draftReloadFailed);
          return;
        }
        frozen = new Map<string, string>();
        for (const item of fresh.sharedItems) {
          const sourceId =
            item.kind === "narrative"
              ? item.sourceNarrativeId
              : item.sourceDocumentId;
          if (sourceId) frozen.set(sourceId, item.id);
        }
        setFrozenItems(frozen);
      }

      // 2. REMOVE what the coordinator un-picked. Runs BEFORE the adds so a draft
      //    never transiently holds more than the screen shows.
      const picked = new Set([...pickedNarratives, ...pickedDocuments]);
      const staleFrozen = [...frozen].filter(([sourceId]) => !picked.has(sourceId));
      for (const [sourceId, sharedItemId] of staleFrozen) {
        const removed = await removeReferralSharedItem(sharedItemId);
        if (!removed.ok) {
          setError(removed.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        setFrozenItems((prev) => {
          const next = new Map(prev);
          next.delete(sourceId);
          return next;
        });
      }

      // 3. ADD what is picked and not yet frozen.
      const pendingNarratives = [...pickedNarratives].filter((n) => !frozen.has(n));
      const pendingDocuments = [...pickedDocuments].filter((d) => !frozen.has(d));
      for (const sourceNarrativeId of pendingNarratives) {
        const added = await addReferralSharedItem({
          referralId: id,
          kind: "narrative",
          sourceNarrativeId,
          sourceDocumentId: null,
        });
        if (!added.ok) {
          setError(added.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
      }
      for (const sourceDocumentId of pendingDocuments) {
        const added = await addReferralSharedItem({
          referralId: id,
          kind: "document",
          sourceNarrativeId: null,
          sourceDocumentId,
        });
        if (!added.ok) {
          setError(added.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
      }

      // 3. The PHI buffer, only when it carries something. `save_referral_patient`
      // keeps its own `name OR mrn` floor (D4) — a partially-typed draft is savable.
      //
      // ⛔ REFUSE RATHER THAN OVERWRITE (FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE).
      // `set_referral_patient` full-replaces EVERY column, so writing a buffer that
      // never received the saved identifiers blanks them. When the audited prefill
      // read FAILED we do not know what is stored, so the only safe move is to stop
      // and say so — the same *refuse rather than ship more than the screen shows*
      // principle this function's docblock states, applied to PHI.
      // ⚠ Scoped to `error`, NOT to "anything other than loaded": a coordinator who
      // never opened the patient step sits at `idle` with an empty buffer, which the
      // `referralPatientDraftHasData` guard below already handles correctly.
      if (isResume && resumePatientState === "error") {
        setError(REFERRAL_MESSAGES.patientReloadFailed);
        return;
      }
      if (referralPatientDraftHasData(patient)) {
        const saved = await setReferralPatient(
          id,
          referralPatientDraftToInput(patient),
        );
        if (!saved.ok) {
          setError(saved.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
        setPatientSaved(true);
      }

      // 4. Send, when that is what was asked. `send_referral` enforces the D4 MRN
      // requirement server-side and returns a pt-BR refusal we surface as-is.
      if (mode === "send") {
        const sent = await sendReferral(id);
        if (!sent.ok) {
          setError(sent.error ?? REFERRAL_MESSAGES.generic);
          return;
        }
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const sharedCount = pickedNarratives.size + pickedDocuments.size;

  /**
   * Whether the review step may warn that `send_referral` will refuse this draft for
   * a missing MRN (ADR 0137 D4 / `HC0T4`; FUP-REFERRAL-REVIEW-STEP-MRN-WARNING).
   *
   * ⛔⛔ THE NAIVE VERSION IS WRONG, AND WRONG IN THE DIRECTION THAT TEACHES PEOPLE TO
   * IGNORE WARNINGS. The `patient` buffer is only AUTHORITATIVE once this session has
   * actually loaded what the server holds, and the audited prefill fires lazily, in
   * `goToPatientStep()`. Three cases:
   *
   * | case | buffer is truth? | render | reachable at review? |
   * |---|---|---|---|
   * | fresh draft — nothing is persisted until `flush` | ✅ | warn (the majority path) | yes |
   * | resume, prefill `loaded` | ✅ | warn | yes |
   * | resume, prefill `error` — the read failed | ⛔ | **nothing** | yes |
   * | resume, prefill `loading` — still in flight | ⛔ | **nothing** | yes (racy) |
   * | resume, `idle` — never visited | ⛔ | **nothing** | ⚠ no, see below |
   *
   * ⚠ MEASURED, not assumed: `idle` cannot currently be observed HERE, because the
   * only route to `review` is the patient step's own Continuar and reaching that step
   * fires the load (the indicator `<ol>` is not clickable — verified). The guard is
   * written over the STATE rather than over that routing, because the routing is one
   * button away from changing and the failure mode is silent. The `error` row is the
   * one that pays for itself today: on a failed prefill the inputs are disabled and
   * the buffer is empty, so an unguarded warning would fire on precisely the draft
   * whose stored MRN this session could not read.
   *
   * ⭐ The silence in case 3 is the ANSWER, not a gap: *"I could not look" is not "I
   * looked and found nothing."* Warning there would tell a coordinator their referral
   * has no MRN when the server holds a perfectly good one, and push them to re-enter
   * PHI that already exists.
   *
   * ⛔ AND DO NOT FETCH TO POWER IT. `get_referral_patient` emits an audited
   * `referral_patient.read`, fired deliberately on INTENT rather than on mount;
   * a warning that fetched would emit a PHI-read row for merely REACHING review,
   * quietly changing what that audit event means (Rules 11/12). That is a lead
   * decision, not a component one.
   */
  const mrnBufferAuthoritative = !isResume || resumePatientState === "loaded";
  const mrnWarningVisible =
    step === "review" &&
    mrnBufferAuthoritative &&
    (patient.mrn ?? "").trim() === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {parentReferralId ? "Encaminhar adiante" : "Encaminhar"}{" "}
            {sourceCaseNumber != null
              ? `Caso ${String(sourceCaseNumber).padStart(4, "0")}`
              : "caso"}
          </DialogTitle>
          <DialogDescription>
            {parentReferralId
              ? "Encaminhe este caso a outra comissão, mantendo o vínculo de origem com o encaminhamento anterior. O novo encaminhamento não compartilha automaticamente nada do anterior."
              : "Compartilhe uma visão selecionada deste caso com outra comissão para análise ou ciência."}
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

        {/* Resume in flight (D6): the fields below are still empty at this point, so
            say why rather than showing a blank step-1 form that looks like a new
            referral. */}
        {resumeState === "loading" && (
          <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            Carregando o rascunho…
          </p>
        )}

        {/* ---- Step 1: Detalhes ---- */}
        {step === "details" && (
          <form onSubmit={submitDetails} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tipo de encaminhamento</span>
              <NativeSelect
                value={referralTypeId}
                onChange={(e) => handleTypeChange(e.target.value)}
                required
                className="py-2"
              >
                <option value="" disabled>
                  Selecione um tipo…
                </option>
                {referralTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
              {selectedType?.description && (
                <span className="text-xs text-muted-foreground text-pretty">
                  {selectedType.description}
                </span>
              )}
            </label>

            {/* ADR 0137 **D7** — a draft's destination is IMMUTABLE, so on resume both
                destination controls are replaced by a read-only statement plus the way
                out. ⚠ An accepted limitation, not an oversight: `update_referral_draft`
                takes no target argument, and widening it means a new DEFINER arm with
                its own authz re-verification, which this batch does not buy. Saying so
                in place is what stops it reading as a broken control. */}
            {isResume && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <span className="font-medium">Destino</span>
                <span className="text-foreground">{targetName ?? "—"}</span>
                <span className="text-xs text-pretty text-muted-foreground">
                  O destino não pode ser alterado depois que o rascunho é criado. Para
                  encaminhar a outra comissão, descarte este rascunho e crie um novo.
                </span>
              </div>
            )}

            {/* ADR 0094 W4 — destination kind. Rendered only when the technical
                direction is actually reachable; with a single arm there is nothing to
                choose, and a radio group of one is noise. */}
            {!isResume && technicalDirectionAvailable && (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="mb-1.5 font-medium">Destino</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { key: "commission", label: "Outra comissão" },
                      {
                        key: "technical_director",
                        label: "Direção técnica do hospital",
                      },
                    ] as const
                  ).map((option) => {
                    const checked = targetKind === option.key;
                    return (
                      <label
                        key={option.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors",
                          checked
                            ? "border-primary/40 bg-accent/30"
                            : "border-border bg-card hover:border-primary/30",
                        )}
                      >
                        <input
                          type="radio"
                          name="referral-target-kind"
                          value={option.key}
                          checked={checked}
                          onChange={() => {
                            setTargetKind(option.key);
                            if (option.key === "technical_director") {
                              setTargetCommissionId("");
                            }
                          }}
                          className="size-4 accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {targetKind === "technical_director" && (
                  <span className="text-xs text-pretty text-muted-foreground">
                    O(a) diretor(a) técnico(a) responde tecnicamente por todas as
                    comissões deste hospital. Substitutos(as) designados(as) têm a
                    mesma autoridade.
                  </span>
                )}
              </fieldset>
            )}

            {!isResume && targetKind === "commission" && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Comissão de destino</span>
                <NativeSelect
                  value={targetCommissionId}
                  onChange={(e) => setTargetCommissionId(e.target.value)}
                  required
                  className="py-2"
                >
                  <option value="" disabled>
                    Selecione a comissão…
                  </option>
                  {targetCommissions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
                {targetCommissions.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Nenhuma outra comissão disponível para encaminhamento.
                  </span>
                )}
              </label>
            )}

            {/* ⚠ This field was ALREADY warned, in bespoke copy, INSIDE the
                <label> — which made the sentence part of the control's ACCESSIBLE
                NAME ("Assunto Visível em listas e painéis — não inclua…"). Moved
                out and onto `aria-describedby`, and onto the shared ADR 0131
                constant so the fourteen annotated sites cannot drift apart. The
                name is now plainly "Assunto". */}
            <PhiInputHint>
              {(hintId) => (
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
                    aria-describedby={hintId}
                  />
                </label>
              )}
            </PhiInputHint>

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

            {/* RV2 R2 triage — priority + what is asked of the target committee. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Prioridade</span>
                <NativeSelect
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as ReferralPriority)
                  }
                  className="py-2"
                >
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {REFERRAL_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  Ação solicitada{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </span>
                <NativeSelect
                  value={requestedActionId}
                  onChange={(e) => setRequestedActionId(e.target.value)}
                  className="py-2"
                  disabled={requestedActions.length === 0}
                >
                  <option value="">Não especificar</option>
                  {requestedActions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Prazo de resposta{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              <input
                type="datetime-local"
                value={responseDueAt}
                min={nowLocalInput()}
                onChange={(e) => setResponseDueAt(e.target.value)}
                className={FIELD_CLASS}
              />
              <span className="text-xs text-muted-foreground">
                Data-limite para a comissão de destino responder. Deixe em branco
                se não houver prazo.
              </span>
            </label>

            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <input
                id={responseExpectedId}
                type="checkbox"
                checked={responseExpected}
                onChange={(e) => setResponseExpected(e.target.checked)}
                aria-describedby={responseExpectedHelpId}
                className="mt-0.5 size-4 rounded border-input accent-[var(--primary)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
              />
              <span className="flex flex-col gap-0.5">
                <label htmlFor={responseExpectedId} className="font-medium">
                  Aguardar resposta
                </label>
                <span
                  id={responseExpectedHelpId}
                  className="text-xs text-muted-foreground text-pretty"
                >
                  A comissão de destino deverá registrar um resultado. Enquanto a
                  resposta estiver pendente, o caso de origem não pode ser
                  encerrado.
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <SaveDraftButton
                onSave={() => flush("draft")}
                disabled={isPending || !detailsComplete}
                ready={detailsComplete}
                busy={isPending}
              />
              <Button type="submit" size="lg" disabled={isPending}>
                Continuar
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

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
              <div className="flex flex-wrap items-center gap-2">
                <SaveDraftButton
                  onSave={() => flush("draft")}
                  disabled={isPending || !detailsComplete}
                  ready={detailsComplete}
                  busy={isPending}
                />
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

            {/* The audited prefill read failed, so the fields below are empty while
                the draft may hold identifiers. Said HERE, before the coordinator
                types, because the flush will refuse rather than overwrite them
                (FUP-0137-RESUME-SWALLOW-SILENT-PHI-OVERWRITE) — a refusal that
                arrives only on `Salvar` reads as a broken button. */}
            {resumePatientState === "error" && (
              <FormBanner tone="error">
                {REFERRAL_MESSAGES.patientFieldsLocked}
              </FormBanner>
            )}

            <ReferralPatientFields
              draft={patient}
              onChange={setPatient}
              disabled={isPending || resumePatientState === "error"}
              idPrefix="referral-wizard-patient"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
              <div className="flex flex-wrap items-center gap-2">
                <SaveDraftButton
                  onSave={() => flush("draft")}
                  disabled={isPending || !detailsComplete}
                  ready={detailsComplete}
                  busy={isPending}
                />
                {/* No longer saves — the PHI buffer flushes with everything else.
                    Advancing is now a pure step change (D5). */}
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setStep("review")}
                  disabled={isPending}
                >
                  Continuar
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
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
                  Prioridade
                </dt>
                <dd className="text-sm text-foreground">
                  {REFERRAL_PRIORITY_LABELS[priority]}
                </dd>
              </div>
              {requestedActionLabel && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Ação solicitada
                  </dt>
                  <dd className="text-sm text-foreground">
                    {requestedActionLabel}
                  </dd>
                </div>
              )}
              {responseDueAt.trim() && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Prazo de resposta
                  </dt>
                  <dd className="text-sm text-foreground tabular-nums">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(responseDueAt))}
                  </dd>
                </div>
              )}
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

            {/* ADR 0137 D4, surfaced BEFORE the round trip
                (FUP-REFERRAL-REVIEW-STEP-MRN-WARNING). `send_referral` refuses an
                MRN-less draft with HC0T4 unconditionally — measured from the live
                catalog, and NOT exempted by a `none`-mode source case — so the
                coordinator otherwise learns it only by pressing Enviar.
                ⛔ Non-blocking, and it does NOT touch the MRN input's `required`:
                the DB is the authority (D3's three-layer model) and `Salvar
                rascunho` must keep working on a name-only PHI block (pgTAP `363
                §1.2a` pins that).
                ⛔ ONE string, reused verbatim — `sendRequiresMrn` already reads as
                advance notice. Two sentences for one rule is the drift class this
                repo keeps paying for. */}
            {mrnWarningVisible && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3 py-2.5 text-sm font-medium text-pretty"
              >
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-warning"
                />
                <span>{REFERRAL_MESSAGES.sendRequiresMrn}</span>
              </p>
            )}

            <p className="text-xs text-muted-foreground text-pretty">
              Ao enviar, o conteúdo compartilhado é congelado e a comissão de
              destino é notificada. Você poderá retirar o encaminhamento, mas não
              alterar o que foi enviado.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
              <div className="flex flex-wrap items-center gap-2">
                <SaveDraftButton
                  onSave={() => flush("draft")}
                  disabled={isPending || !detailsComplete}
                  ready={detailsComplete}
                  busy={isPending}
                />
                <Button
                  type="button"
                  size="lg"
                  onClick={() => flush("send")}
                  disabled={isPending}
                >
                  <Send aria-hidden="true" />
                  {isPending ? "Enviando…" : "Enviar encaminhamento"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
