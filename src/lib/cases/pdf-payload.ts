import { buildResponseSections } from '@/lib/forms/pdf-payload'
import { printSourceWatermark } from '@/lib/pdf/documents/print-source'
import { formatDate, formatDateTime } from '@/lib/pdf/format'
import { documentProvenance, type MintRenderContext } from '@/lib/pdf/provenance'
import type {
  CaseActionItemEntry,
  CaseCorrectionEntry,
  CaseDocumentManifestEntry,
  CaseInterviewEntry,
  CaseMeetingEntry,
  CaseNarrativeEntry,
  CaseParticipantEntry,
  CasePatientEntry,
  CasePhaseEntry,
  CaseReferralEntry,
  CaseTimelineEntry,
  DocumentPayload,
} from '@/lib/pdf/types'
import type { PdfBuildOptions } from '@/lib/pdf-mint/providers'
import { listCaseActionItems } from '@/lib/queries/case-action-items'
import { listCaseEvents } from '@/lib/queries/case-documents'
import { listCaseTagsForCase } from '@/lib/queries/case-tags'
import { listCaseMeetings } from '@/lib/queries/case-timeline'
import { getCaseDetail, getCasePatients } from '@/lib/queries/cases'
import { listCaseCorrectionRequests } from '@/lib/queries/corrections'
import { listDocumentsForResource } from '@/lib/queries/documents'
import { listCaseDocumentHashes } from '@/lib/queries/document-hashes'
import {
  getInterviewDetail,
  listCaseInterviews,
  listInterviewInterviewers,
  listInterviewSubjects,
} from '@/lib/queries/interviews'
import { getCasePrintContext } from '@/lib/queries/printed-documents'
import { getReferralDetail, listCaseOutboundReferrals } from '@/lib/queries/referrals'
import { CASE_STATUS_META } from './case-status'
import { formatCaseNumberWithTerm } from './format'
import {
  ACTION_ITEM_STATUS_LABEL,
  CORRECTION_KIND_LABEL,
  CORRECTION_STATUS_LABEL,
  EVENT_KIND_LABEL,
} from './labels'
import { CONFIDENTIALITY_LEVEL_LABELS } from './case-types'

/**
 * The case DOSSIER data provider (PDF·P3; ADR 0104 D15 step 3; ADR 0144).
 *
 * Reads run UNDER THE CALLER'S SESSION via `src/lib/queries/` (Rule 9) — every
 * leg routes the case capability chain through RLS, so a caller who cannot see a
 * part of the case gets nothing for it and the mint fails closed upstream.
 * ⛔ **The provider grants nothing.** No `createAdminClient()` appears here, and
 * none may be added: a service-role read inside a payload builder hands the
 * builder sight the caller does not have, and the bytes it produces are then
 * downloadable by everyone the A7 arm admits.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE D5 FORK, AND WHY `variant` IS ASSIGNED FROM THE ANSWER, NOT THE REQUEST
 * ═══════════════════════════════════════════════════════════════════════════
 * `public.get_case_patients` — the case domain's audited PHI reader (DEFINER,
 * gated on `app.can_read_case_patient`, emitting `case_patient.read` per patient
 * row) — has THREE distinguishable answers, and each gets its own outcome:
 *
 *   answer            | identified request        | de-identified request
 *   ------------------|---------------------------|-------------------------
 *   `null` unentitled | THROW (pt-BR)             | render without demographics
 *   `[]`  none on file| THROW, naming the variant | render without demographics
 *   rows              | variant: 'identified'     | render age/sex/unit only
 *
 * ⛔ The two throws are what make `variant: 'identified'` PROVABLY EQUIVALENT to
 * "the patient identification section was rendered". Without them, an identified
 * request that legitimately produced no identifiers would still be LABELLED
 * `case_identified` by `templateFor`, minted into the identified series, and
 * would SUPERSEDE a real identified dossier with one that has none — while the
 * committed `case_identified` fingerprint pinned a structure that never shipped.
 * ⛔ Silently downgrading to de-identified is equally rejected: a silent
 * downgrade on a PHI choice teaches the user to distrust every other label on
 * the page.
 *
 * ⚠ **A DE-IDENTIFIED PRINT BY A PHI-CAPABLE MINTER EMITS `case_patient.read`,
 * AND THAT IS CORRECT.** `age_years` / `sex` / `unit` live on
 * `public.patient_identifiers`, a Class-1 PHI table, and reading them IS a PHI
 * read — Rule 11 requires the row. It is not noise and must not be suppressed.
 *
 * ⚠ **ADR 0144 Amendment 2 — the bounded A7 exception.** Because the
 * demographics come through a gated door, the de-identified dossier is NOT
 * byte-identical between minters: a minter with `read_standard_phi` renders
 * three fields a minter without it does not. The bound is exact — three
 * de-identification-floor demographics, never an identifier. A7's remedy
 * (refuse the mint) would mean a granted content-reader without the PHI door
 * can print NOTHING, deleting the variant's purpose for the readers it exists
 * for and breaking D14's floor. ⛔ The absence renders with NO MARKER: a "dados
 * indisponíveis" line would print the minter's entitlement onto the page.
 */

/**
 * ⚠ Never the raw identifier — QA MINOR-7's rule (Rule 10 on a permanent
 * record). A widened DB enum renders "—" until its label is added.
 *
 * ⛔ **DO NOT WIDEN THE IMPORTED MAPS' ANNOTATIONS TO MAKE A LOOKUP FIT.** The
 * maps in `./labels` are typed `Record<AnyCaseEventKind, string>` etc., and that
 * union annotation is the only thing that can catch a missing or invented key.
 * A `Record<string, string>` holding-pattern copy of these maps lived here for
 * part of this phase, and because it had NO union to check against it silently
 * drifted: 13 real `AnyCaseEventKind` members were absent (every ethics
 * procedural kind among them — an ethics dossier's whole timeline would have
 * printed as a column of em-dashes), 5 keys were invented that are not members
 * at all, and 4 words differed from the UI. Nothing could catch it; the
 * annotation is what catches it.
 */
const ENUM_FALLBACK = '—'
const label = <K extends string>(
  map: Record<K, string>,
  key: string | null | undefined,
) => (key && key in map ? map[key as K] : ENUM_FALLBACK)

const NOT_FOUND = 'Caso não encontrado ou sem autorização de leitura.'
const NO_PATIENT_ACCESS =
  'Sem autorização para emitir a versão identificada deste caso.'
const NO_PATIENT_ON_FILE =
  'Este caso não possui dados de paciente registrados; emita a versão não identificada.'

const ageDisplay = (years: number | null) =>
  years === null || years === undefined ? null : `${years} anos`

const SEX_LABEL: Record<string, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  unknown: 'Não informado',
  F: 'Feminino',
  M: 'Masculino',
}

/*
 * ⛔ THERE IS DELIBERATELY NO LOCAL ROW TYPE HERE ANY MORE.
 *
 * A hand-written `RawPatientRow` used to sit at this spot declaring the
 * SNAKE_CASE table shape, and `resolvePatients` read the door's result through
 * `as RawPatientRow[] | null`. But `getCasePatients` returns `CasePatient` —
 * CAMEL_CASE, mapped by `mapCasePatient`. The two shapes agree on five names
 * (`name` `mrn` `sex` `unit` `attending`) and disagree on three
 * (`age_years`/`ageYears`, `date_of_birth`/`dateOfBirth`,
 * `encounter_ref`/`encounterRef`), so THREE OF EIGHT PATIENT FIELDS read
 * `undefined` and printed as nothing — including AGE, one third of ADR 0144 D5's
 * de-identification floor, on a dossier whose justification is that *"strip it
 * and the ONA demand gets a dossier about nobody"* (BUG-P3-PATIENT-FIELD-MAPPING).
 *
 * ⭐ THE `as` CAST WAS THE ENTIRE REASON `tsc` STAYED GREEN on an eight-field
 * contract mismatch, and the optional `?` on each field is why `p.age_years ??
 * null` compiled to a silent `null` rather than an error. The fix is therefore
 * NOT to rename fields inside the cast — that re-arms the class the moment either
 * shape moves. The cast is gone, `CasePatient` comes from the module that
 * produces it, and the compiler holds the contract (verified: a snake_case read
 * now fails with "Property 'age_years' does not exist on type 'CasePatient'").
 *
 * ⚠ The bug was INVISIBLE ON THE PAGE by design: ADR 0144 Amendment 2 pt 3
 * renders a missing demographic with NO MARKER, because a "dados indisponíveis"
 * line would print the minter's entitlement onto the page. That decision was and
 * remains correct — and it meant a correctness bug was indistinguishable from a
 * legitimate entitlement-driven absence to reader and reviewer alike. Which is
 * why this is closed by a TYPE and by `pdf-payload.test.ts`, not by looking harder.
 *
 * ⛔ `patient_key` / `encounter_key` still print in NEITHER variant (D5). They
 * are absent from `CasePatient` altogether, so that guarantee is now structural
 * rather than a field we remember not to read.
 */

/**
 * Resolve the D5 patient block.
 *
 * Returns the entries AND the variant that was actually achieved — never the
 * one that was requested. See this module's header for the three-answer table.
 */
async function resolvePatients(
  caseId: string,
  includePhi: boolean,
): Promise<{ patients: CasePatientEntry[]; variant: 'deidentified' | 'identified' }> {
  // ⛔ THE ONLY DOOR. `patient_identifiers` has RLS on, zero policies and no
  // `authenticated` ACL — `public.get_case_patients` is the entire read surface,
  // and it is DEFINER-gated on `app.can_read_case_patient` and audited per row.
  // ⚠ This is also the DE-IDENTIFIED path's door: `age_years` / `sex` / `unit`
  // live on the same Class-1 table as the identifiers, so there is no
  // "identifier-free" read to make. Going around it is not possible and must
  // not be attempted.
  // ⛔ NO CAST. `getCasePatients` returns `CasePatient[] | null`, and the three
  // answers ARE the contract: `null` = out of scope, `[]` = entitled but no PHI
  // on file, rows = entitled with PHI.
  const rows = await getCasePatients(caseId)

  if (includePhi) {
    if (rows === null) throw new Error(NO_PATIENT_ACCESS)
    if (rows.length === 0) throw new Error(NO_PATIENT_ON_FILE)
    return {
      variant: 'identified',
      patients: rows.map((p) => ({
        ageDisplay: ageDisplay(p.ageYears),
        sexDisplay: p.sex ? (SEX_LABEL[p.sex] ?? ENUM_FALLBACK) : null,
        unitDisplay: p.unit,
        name: p.name,
        mrn: p.mrn,
        dateOfBirthDisplay: p.dateOfBirth ? formatDate(p.dateOfBirth) : null,
        attending: p.attending,
        encounterRef: p.encounterRef,
      })),
    }
  }

  // De-identified: `null` (unentitled) and `[]` (none on file) BOTH render
  // without demographics, and neither throws. ⛔ A throw here would stop a
  // granted content-reader minting at all, breaking ADR 0144 D14's floor
  // ("case-view without the PHI door → de-identified ALLOWED").
  return {
    variant: 'deidentified',
    patients: (rows ?? []).map((p) => ({
      ageDisplay: ageDisplay(p.ageYears),
      sexDisplay: p.sex ? (SEX_LABEL[p.sex] ?? ENUM_FALLBACK) : null,
      unitDisplay: p.unit,
      // ⛔ THE FIVE IDENTIFIED FIELDS ARE NEVER COPIED ON THIS PATH. The
      // template renders what it is given, so a template edit cannot widen the
      // disclosure — the guarantee lives here, at the only place that has them.
      name: null,
      mrn: null,
      dateOfBirthDisplay: null,
      attending: null,
      encounterRef: null,
    })),
  }
}

/** Build the full {@link DocumentPayload} for a case the caller can reach.
 * Throws a pt-BR Error when it is unreachable (indistinguishable from
 * nonexistent, deliberately). */
export async function buildCasePayload(
  caseId: string,
  ctx: MintRenderContext,
  options?: PdfBuildOptions,
): Promise<DocumentPayload> {
  const includePhi = options?.includePhi ?? false

  const [detail, context, tags, interviews, events, meetings, actionItems, corrections, documents] =
    await Promise.all([
      getCaseDetail(caseId),
      getCasePrintContext(caseId),
      listCaseTagsForCase(caseId),
      listCaseInterviews(caseId),
      listCaseEvents(caseId),
      listCaseMeetings(caseId),
      listCaseActionItems(caseId),
      listCaseCorrectionRequests(caseId),
      listDocumentsForResource('case', caseId),
    ])
  // ⚠ `context` null means the DOOR refused (`public.print_source_state` gates
  // on `app.can_view_printed_document`), not merely that RLS hid the case — see
  // `getCasePrintContext`. Either way the mint must not proceed.
  if (!detail || !context) throw new Error(NOT_FOUND)

  const { patients, variant } = await resolvePatients(caseId, includePhi)

  // ── Phases, with their answers INLINE (D2) ────────────────────────────────
  // ⭐ Rendered by `buildResponseSections`, the SAME function the standalone
  // form print uses. Two renderers for one answer would put two versions of one
  // record on paper. A phase whose response the caller cannot read yields null
  // and contributes an answer-less phase rather than failing the whole dossier.
  const phases: CasePhaseEntry[] = await Promise.all(
    detail.phases.map(async (phase) => {
      const rendered = phase.responseId
        ? await buildResponseSections(phase.responseId)
        : null
      return {
        title: phase.title ?? phase.formTitle ?? 'Fase',
        statusDisplay: phase.status,
        respondentDisplay: phase.assigneeName ?? null,
        submittedAtDisplay: phase.submittedAt ? formatDateTime(phase.submittedAt) : null,
        resultDisplay: phase.result?.label ?? null,
        items: rendered ? rendered.sections.flatMap((s) => s.items) : [],
      }
    }),
  )

  // ── Interviews (D2: inline; P4 then adds only the standalone KIND) ────────
  const interviewEntries: CaseInterviewEntry[] = await Promise.all(
    interviews.map(async (i) => {
      const [full, subjects, interviewers] = await Promise.all([
        getInterviewDetail(i.id),
        listInterviewSubjects(i.id),
        listInterviewInterviewers(i.id),
      ])
      return {
        title: i.title ?? `Entrevista nº ${i.interviewNumber}`,
        statusDisplay: i.status,
        dateDisplay: i.concludedAt ? formatDateTime(i.concludedAt) : null,
        subjects: subjects.map((s) => s.displayName ?? s.externalName ?? 'Entrevistado'),
        interviewers: interviewers.map(
          (s) => s.displayName ?? s.externalName ?? 'Entrevistador',
        ),
        // ⚠ null after `dispose_case_phi`, which nulls `summary_md`.
        summaryMd: full?.summaryMd ?? null,
      }
    }),
  )

  // ── Referrals: the frozen snapshot AND the structured reply (D2) ──────────
  // ⚠ `getReferralDetail`'s SECOND ARGUMENT is the VIEWER's commission, not the
  // referral's target. For an outbound referral from this case the two coincide
  // — which is exactly the kind of coincidence that holds until it does not, so
  // it is passed explicitly from the case rather than defaulted or inferred.
  const referralList = await listCaseOutboundReferrals(caseId)
  const referrals: CaseReferralEntry[] = (
    await Promise.all(
      referralList.map(async (r): Promise<CaseReferralEntry | null> => {
        const full = await getReferralDetail(r.id, detail.case.commissionId)
        // A referral the caller cannot open contributes NOTHING rather than
        // failing the dossier — and the A7 arm has already refused a caller who
        // cannot read any of them (`can_read_full_case_content` axis G).
        if (!full) return null
        return {
          directionDisplay: 'Encaminhamento enviado',
          counterpartDisplay: r.targetCommissionName ?? ENUM_FALLBACK,
          statusDisplay: r.status,
          sentAtDisplay: r.sentAt ? formatDateTime(r.sentAt) : null,
          question: r.subject ?? null,
          snapshot: full.sharedItems
            .filter((s) => s.frozenTitle !== null || s.frozenBodyMd !== null)
            .map((s) => ({
              label: s.frozenTitle ?? 'Item compartilhado',
              value: s.frozenBodyMd ?? ENUM_FALLBACK,
            })),
          replyStatusDisplay: full.reply?.outcomeLabel ?? null,
          replyBody: full.reply?.resultMd ?? null,
          repliedAtDisplay: full.reply?.repliedAt
            ? formatDateTime(full.reply.repliedAt)
            : null,
        }
      }),
    )
  ).filter((r): r is CaseReferralEntry => r !== null)

  // ── The uploaded-document MANIFEST (D2) — with content hashes ─────────────
  // ⚠ `listDocumentsForResource`, NOT `listCaseDocuments`: the latter delegates
  // to the PARKED `listAttachments`, whose body is `return []`, so the manifest
  // would render EMPTY on every case forever and nothing would go red (an empty
  // array is a legal answer at every layer). See FUP-CASE-DOCS-DEAD-READER.
  const hashes = await listCaseDocumentHashes(documents.map((d) => d.id))
  const manifest: CaseDocumentManifestEntry[] = documents.map((d) => ({
    title: d.title,
    uploaderDisplay: d.createdByName,
    dateDisplay: d.createdAt ? formatDate(d.createdAt) : null,
    // Absent ⇒ "—". The hash read is RLS-scoped like everything else here, so a
    // file the caller cannot reach simply has no hash printed — fail-closed.
    contentHash: hashes.get(d.id) ?? null,
  }))

  const participants: CaseParticipantEntry[] = detail.participants.map((p) => ({
    name: p.professionalFullName ?? p.displayName,
    roleDisplay: p.roleLabel,
    // ADR 0144 D11 — name + role/title only; council registrations deferred.
    titleDisplay: p.involvementSummary ?? null,
    // ⛔ ALWAYS null in v1 — there is no per-participant recusal reader
    // (`CaseDetail.myRecusal` is the CALLER'S OWN recusal only). Populating it
    // from that would make the artifact vary by minter for no D5-style reason —
    // a SECOND A7 exception with none of the first one's justification.
    // FUP-P3-DOSSIER-HAS-NO-RECUSAL-ROSTER.
    recusalDisplay: null,
  }))

  const narratives: CaseNarrativeEntry[] = detail.narratives.map((n) => ({
    title: n.title ?? n.displayLabel,
    authorDisplay: n.assigneeName,
    dateDisplay: n.concludedAt ? formatDateTime(n.concludedAt) : null,
    bodyMd: n.bodyMd,
  }))

  const timeline: CaseTimelineEntry[] = events.map((e) => ({
    dateDisplay: e.occurredAt ? formatDate(e.occurredAt) : formatDate(e.createdAt),
    kindDisplay: label(EVENT_KIND_LABEL, e.kind),
    title: e.title ?? ENUM_FALLBACK,
    body: e.body,
    authorDisplay: e.createdByName,
  }))

  const meetingEntries: CaseMeetingEntry[] = meetings.map((m) => ({
    meetingDisplay: `Reunião nº ${m.meeting.meetingNumber}${
      m.meeting.title ? ` — ${m.meeting.title}` : ''
    }`,
    dateDisplay: m.meeting.scheduledStart ? formatDateTime(m.meeting.scheduledStart) : null,
    summary: m.summary,
    decision: m.decision,
  }))

  const actions: CaseActionItemEntry[] = actionItems.map((a) => ({
    title: a.title,
    statusDisplay: label(ACTION_ITEM_STATUS_LABEL, a.status),
    assigneeDisplay: a.assigneeName,
    dueDisplay: a.dueDate ? formatDate(a.dueDate) : null,
  }))

  const correctionEntries: CaseCorrectionEntry[] = corrections.map((c) => ({
    requestedByDisplay: null, // no joined display name exists on this reader
    dateDisplay: c.requestedAt ? formatDateTime(c.requestedAt) : null,
    statusDisplay: label(CORRECTION_STATUS_LABEL, c.status),
    kindDisplay: label(CORRECTION_KIND_LABEL, c.kind),
    justification: c.reason,
  }))

  // ── ADR 0144 D6 — `containsPhi`, ONE honest rule ──────────────────────────
  // Presence-derived and NON-SUPPRESSIBLE (the A8 mirror), and it is NOT the D9
  // per-mint choice: it is TRUE for both variants whenever the dossier carries
  // masked-class content.
  //
  // ⭐ THE SECOND DISJUNCT IS LOAD-BEARING FOR ART. 18, NOT FOR THE BAND. Keyed
  // on free text alone, a thin case (no narratives, no bodied events, no
  // answers) minted WITH demographics or identifiers would derive false, land in
  // `documents-standard` at `sensitivity_tier = 'standard'`, and
  // `dispose_case_phi` block (f) — which filters `sensitivity_tier = 'phi'` —
  // would SKIP it. Patient data would survive an Art. 18 erasure in Storage.
  // Any field sourced from `patient_identifiers` counts, demographics included:
  // D6's point was that free text ALONE suffices, never that identifiers do not.
  //
  // ⚠ `includePhi` is deliberately NOT a term. With the `[]`-throws rule an
  // identified mint always renders identifiers, so it is subsumed by the
  // patient-field disjunct — and a term for the REQUEST rather than the RENDER
  // is the class of mistake `variant` exists to avoid.
  const renderedPatientField = patients.some(
    (p) =>
      p.ageDisplay !== null ||
      p.sexDisplay !== null ||
      p.unitDisplay !== null ||
      p.name !== null ||
      p.mrn !== null ||
      p.dateOfBirthDisplay !== null ||
      p.attending !== null ||
      p.encounterRef !== null,
  )
  const hasMaskedFreeText =
    narratives.some((n) => n.bodyMd !== null) ||
    interviewEntries.some((i) => i.summaryMd !== null) ||
    timeline.some((e) => e.body !== null) ||
    meetingEntries.some((m) => m.summary !== null || m.decision !== null) ||
    referrals.some((r) => r.replyBody !== null || r.snapshot.length > 0) ||
    phases.some((p) => p.items.length > 0)
  const containsPhi = hasMaskedFreeText || renderedPatientField

  return {
    letterhead: {
      hospitalName: context.hospitalName,
      hospitalAddress: null,
      logoDataUri: null,
      commissionName: context.commissionName,
    },
    provenance: documentProvenance(
      ctx,
      printSourceWatermark('case', {
        status: context.status,
        // ADR 0144 D3 — the tandem term. `dispose_case_phi` guts the rendered
        // content while leaving `cases.status` untouched, so the status term
        // alone cannot see it. Sourced from the DEFINER door, never from an
        // RLS-scoped read: absent would default false and stamp FINAL.
        caseDisposed: context.caseDisposed,
      }),
    ),
    // The dossier carries no per-section attestations; the case surface has no
    // sign-off model of its own (a phase response's sign-offs belong to that
    // response's own print, not to the dossier that quotes its answers).
    signatures: [],
    containsPhi,
    // ADR 0126 D9 / ADR 0144 D4+D15 — the revision OBSERVED here, at build time.
    // ⛔ Must never be re-read closer to the mint call: the door would then
    // compare its own current value against itself and HC0DU would go vacuous.
    sourceRevision: context.revision,
    body: {
      kind: 'case',
      variant,
      // ⭐ F4 — the app's OWN formatter, TERM-AWARE. `formatCaseNumberWithTerm`
      // renders "Denúncia 0042" for an ethics case and "Caso 0042" for a
      // type-less one (ADR 0064 D4); the plain `formatCaseNumber` would print
      // the wrong NOUN on every ethics dossier — a wrong word on an
      // accreditation record. ⛔ Never a local `padStart`: that second authority
      // is exactly what made the running header read "Caso 1" while the app said
      // "Caso 0001", on the same page as a user-authored interview title using
      // the app's form.
      // ⚠ This makes the dossier consistent with ONE of the eight
      // implementations of this display rule in the codebase; the other seven
      // are filed separately and are not this phase's work. ⛔ Do not describe
      // it as "the dossier now uses the canonical formatter".
      caseDisplay: formatCaseNumberWithTerm(
        detail.terminology?.case?.singular ?? 'Caso',
        detail.case.caseNumber,
      ),
      title: detail.case.label,
      statusDisplay: CASE_STATUS_META[detail.case.status]?.label ?? ENUM_FALLBACK,
      confidentialityDisplay:
        CONFIDENTIALITY_LEVEL_LABELS[detail.confidentialityLevel] ?? ENUM_FALLBACK,
      // ⚠ `terminology.case.singular` is the per-case-type label for the word
      // "caso" itself (e.g. "Ocorrência", "Processo ético"), which IS the case
      // type as a reader recognises it. `terminology` has no top-level
      // `singular` — the five slots each carry their own term.
      caseTypeDisplay: detail.terminology?.case?.singular ?? null,
      outcomeDisplay: detail.outcome?.label ?? null,
      departmentDisplay: detail.case.departmentName ?? detail.case.departmentOther,
      tags: tags.map((t) => t.name),
      openedAtDisplay: formatDate(detail.case.createdAt),
      closedAtDisplay: detail.case.closedAt ? formatDate(detail.case.closedAt) : null,
      phiDisposed: context.caseDisposed,
      patients,
      participants,
      phases,
      narratives,
      interviews: interviewEntries,
      referrals,
      timeline,
      meetings: meetingEntries,
      actionItems: actions,
      corrections: correctionEntries,
      documents: manifest,
    },
  }
}
