'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { finalizeDocumentUpload, openDocumentVersion } from '@/lib/documents/actions'
import { SAFETY_MESSAGES, mapRcaError } from '@/lib/safety/messages'
import { mapNspEvidenceErrorCode } from '@/lib/safety/evidence-contract'
import { narrowDocumentEvidenceError } from '@/lib/safety/evidence-mapping'
import type { ActionState } from '@/lib/safety/types'
import type {
  RcaFactorInput,
  RcaMemberInput,
  RcaMemberRole,
  RcaRootCauseInput,
  RcaTimelineEntryInput,
  RootCauseClassification,
  RootCauseType,
  UpdateRcaInput,
} from '@/lib/safety/rca-types'
import type {
  NspEvidenceActionState,
  NspEvidenceErrorCode,
  NspEvidenceLinkInput,
  NspEvidenceUploadRequest,
  NspEvidenceUploadTicket,
  RcaEvidenceCitationInput,
} from '@/lib/safety/evidence-contract'

// Result + input shapes live in the CLIENT-SAFE `@/lib/safety/{types,rca-types}`
// (a `"use server"` module may export only async functions, and the client binds its
// forms to these) — see P14a-002. This module exports ONLY the action functions below.

/**
 * Patient-safety / NSP RCA server actions (Phase 14c — Root Cause Analysis;
 * Architecture Rules 9, 10, 11). Every write routes through a SECURITY DEFINER RPC
 * authorized by `app.can_write_rca` (PQS/admin OR a non-observer assigned team
 * member) — RLS + the RPC's gate are the authority. The RPC raises HC047 for a
 * wrong-state/frozen RCA, HC048 for an unauthorized writer, and `check_violation`
 * (with a distinct pt-BR message) for an invalid evidence shape.
 *
 * The INPUT shapes + the action SIGNATURES are the FROZEN contract the frontend
 * binds its forms to. All user-facing strings are pt-BR (centralized in
 * `./messages.ts` via `mapRcaError`); raw Supabase/Postgres errors NEVER reach the UI.
 */

// NSP-per-org (ADR 0042): console moved /admin/nsp → /o/[org]/nsp/**. Revalidate the
// per-org NSP LAYOUT across all [org] values (Next-15 dynamic-segment form; 'layout'
// covers the layout + every page beneath it). RLS-scoped data → no cross-org leak.
const NSP_PATH = '/o/[org]/nsp'

function revalidateNsp(): void {
  revalidatePath(NSP_PATH, 'layout')
}


// ---------------------------------------------------------------------------
// RCA lifecycle
// ---------------------------------------------------------------------------

/** Edit the problem statement + findings summary (also bumps `draft → in_progress`). */
export async function updateRca(
  rcaId: string,
  input: UpdateRcaInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca', {
    p_rca_id: rcaId,
    p_what_md: input.whatMd ?? undefined,
    p_expected_md: input.expectedMd ?? undefined,
    p_detected: input.detected ?? undefined,
    p_impact: input.impact ?? undefined,
    p_scope: input.scope ?? undefined,
    p_summary_md: input.summaryMd ?? undefined,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaUpdated }
}

export async function submitRcaForReview(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_rca_for_review', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaSubmitted }
}

export async function completeRca(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_rca', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaCompleted }
}

export async function reopenRca(rcaId: string): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reopen_rca', { p_rca_id: rcaId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaReopened }
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export async function addRcaMember(
  rcaId: string,
  input: RcaMemberInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  const hasUser = !!input.userId
  const hasExternal = !!input.externalName?.trim()
  if (hasUser === hasExternal) {
    return { ok: false, error: SAFETY_MESSAGES.rcaMemberShapeInvalid }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_member', {
    p_rca_id: rcaId,
    p_user_id: input.userId ?? undefined,
    p_external_name: input.externalName?.trim() ?? undefined,
    p_role: input.role,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberAdded }
}

export async function updateRcaMemberRole(
  memberId: string,
  role: RcaMemberRole,
): Promise<ActionState> {
  if (!memberId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_member_role', {
    p_member_id: memberId,
    p_role: role,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberUpdated }
}

export async function removeRcaMember(memberId: string): Promise<ActionState> {
  if (!memberId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_member', { p_member_id: memberId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaMemberRemoved }
}

// ---------------------------------------------------------------------------
// Incident timeline
// ---------------------------------------------------------------------------

export async function addRcaTimelineEntry(
  rcaId: string,
  input: RcaTimelineEntryInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.description?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaTimelineDescriptionRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_timeline_entry', {
    p_rca_id: rcaId,
    p_occurred_at: input.occurredAt,
    p_description: input.description.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function updateRcaTimelineEntry(
  entryId: string,
  input: RcaTimelineEntryInput,
): Promise<ActionState> {
  if (!entryId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.description?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaTimelineDescriptionRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_timeline_entry', {
    p_entry_id: entryId,
    p_occurred_at: input.occurredAt,
    p_description: input.description.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function removeRcaTimelineEntry(entryId: string): Promise<ActionState> {
  if (!entryId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_timeline_entry', { p_entry_id: entryId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

export async function reorderRcaTimeline(
  rcaId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_rca_timeline', {
    p_rca_id: rcaId,
    p_ordered_ids: orderedIds,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaTimelineSaved }
}

// ---------------------------------------------------------------------------
// Evidence (upload XOR link XOR citation; soft-delete)
// ---------------------------------------------------------------------------



export async function deleteRcaEvidence(evidenceId: string): Promise<ActionState> {
  if (!evidenceId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_rca_evidence', { p_evidence_id: evidenceId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaEvidenceRemoved }
}

// ---------------------------------------------------------------------------
// Fishbone factors
// ---------------------------------------------------------------------------

export async function addRcaFactor(
  rcaId: string,
  input: RcaFactorInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaFactorTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_factor', {
    p_rca_id: rcaId,
    p_category: input.category,
    p_text: input.text.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function updateRcaFactor(
  factorId: string,
  text: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!text?.trim()) return { ok: false, error: SAFETY_MESSAGES.rcaFactorTextRequired }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_factor', {
    p_factor_id: factorId,
    p_text: text.trim(),
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function setRcaFactorKey(
  factorId: string,
  isKey: boolean,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_factor_key', {
    p_factor_id: factorId,
    p_is_key: isKey,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

export async function removeRcaFactor(factorId: string): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_factor', { p_factor_id: factorId })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaFactorSaved }
}

// ---------------------------------------------------------------------------
// 5-Whys (keyed by factor; lazily created)
// ---------------------------------------------------------------------------

export async function setRcaWhyStep(
  factorId: string,
  index: number,
  text: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_why_step', {
    p_factor_id: factorId,
    p_index: index,
    p_text: text,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaWhySaved }
}

export async function setRcaWhyRoot(
  factorId: string,
  rootText: string,
): Promise<ActionState> {
  if (!factorId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_rca_why_root', {
    p_factor_id: factorId,
    p_root_text: rootText,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaWhySaved }
}

// ---------------------------------------------------------------------------
// Root causes (stage 3) — the FK target for Phase-14d capa_action
// ---------------------------------------------------------------------------

export async function addRcaRootCause(
  rcaId: string,
  input: RcaRootCauseInput,
): Promise<ActionState> {
  if (!rcaId) return { ok: false, error: SAFETY_MESSAGES.rcaMissing }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaRootCauseTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_root_cause', {
    p_rca_id: rcaId,
    p_text: input.text.trim(),
    p_category: input.category ?? undefined,
    p_classification: input.classification,
    p_type: input.type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function updateRcaRootCause(
  rootCauseId: string,
  input: RcaRootCauseInput,
): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }
  if (!input.text?.trim()) {
    return { ok: false, error: SAFETY_MESSAGES.rcaRootCauseTextRequired }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_rca_root_cause', {
    p_root_cause_id: rootCauseId,
    p_text: input.text.trim(),
    p_category: input.category ?? undefined,
    p_classification: input.classification,
    p_type: input.type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function setRcaRootCauseClassification(
  rootCauseId: string,
  classification: RootCauseClassification,
  type: RootCauseType,
): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }

  // Reuse update_rca_root_cause's classification/type fields without re-sending text:
  // the dedicated set keeps text/category untouched by reading the current row first.
  const supabase = await createClient()
  const { data: current } = await supabase
    .from('rca_root_causes')
    .select('text, category')
    .eq('id', rootCauseId)
    .maybeSingle()
    .returns<{ text: string; category: string | null } | null>()
  if (!current) return { ok: false, error: SAFETY_MESSAGES.generic }

  const { error } = await supabase.rpc('update_rca_root_cause', {
    p_root_cause_id: rootCauseId,
    p_text: current.text,
    p_category: current.category ?? undefined,
    p_classification: classification,
    p_type: type,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

export async function removeRcaRootCause(rootCauseId: string): Promise<ActionState> {
  if (!rootCauseId) return { ok: false, error: SAFETY_MESSAGES.generic }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_rca_root_cause', {
    p_root_cause_id: rootCauseId,
  })
  if (error) return { ok: false, error: mapRcaError(error) }

  revalidateNsp()
  return { ok: true, message: SAFETY_MESSAGES.rcaRootCauseSaved }
}

// ---------------------------------------------------------------------------
// DM5 S2 CONTRACT — posted before implementation (contract-first). Bodies land
// with migrations 20260927000100-000299. Signatures are STABLE once posted.
// Contract + error union: `src/lib/safety/evidence-contract.ts`.
// ---------------------------------------------------------------------------

/**
 * SQLSTATE → contract code, CODE ALONE (Rule 10 — raw Postgres text never
 * reaches the UI). Private helper: a `"use server"` module may export only
 * async functions.
 */
function evidenceErrCode(error: { code?: string | null } | null): NspEvidenceErrorCode {
  return mapNspEvidenceErrorCode(error?.code ?? null)
}

/**
 * Reserve an upload for a `document`-kind RCA evidence file.
 *
 * Replaces `uploadRcaEvidenceFile`, which minted its own `{event}/{rca}/{uuid}`
 * path and PUT straight to `nsp-evidence`. Bucket and path are now derived
 * server-side from the `rca` securable resource (ADR 0114 D8/D9, ADR 0120 D1).
 * Declared size/MIME are re-derived and re-verified at finalize; nothing the
 * caller says about the bytes is trusted.
 */
export async function beginRcaEvidenceUpload(
  rcaId: string,
  request: NspEvidenceUploadRequest,
): Promise<NspEvidenceActionState & { ticket?: NspEvidenceUploadTicket }> {
  if (!rcaId || !request?.title?.trim() || !request.declaredFileName?.trim()) {
    return { ok: false, code: 'invalid_input' }
  }

  // The DM2 corridor with the home PINNED server-side: resource type and id are
  // never client inputs (ADR 0114 D8). The DB owns authority — `rca` routes
  // `app.can_write_document` → `app.can_write_rca` — and derives bucket, path
  // and tier itself. `p_confidentiality_level` is deliberately not passed: NSP
  // evidence has no clearance plane, so an enforcing label there is readable by
  // nobody (`app.can_read_document`'s fail-closed backstop).
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('begin_document_upload', {
    p_resource_type: 'rca',
    p_resource_id: rcaId,
    p_title: request.title.trim(),
    p_declared_file_name: request.declaredFileName,
    p_declared_mime: request.declaredMime,
    p_declared_size: request.declaredSize,
  })
  if (error || !data) return { ok: false, code: evidenceErrCode(error) }
  const r = data as Record<string, string>

  // Coordinates never cross PostgREST (ADR 0118 topology): the door returned
  // IDS ONLY; the service client resolves bucket/path and hands out a
  // short-TTL credential.
  const admin = createAdminClient()
  const { data: file, error: fileError } = await admin
    .from('file_objects')
    .select('storage_bucket, storage_path')
    .eq('id', r.file_object_id)
    .single()
  if (fileError || !file) return { ok: false, code: 'unknown' }
  const { data: signed, error: signError } = await admin.storage
    .from(file.storage_bucket)
    .createSignedUploadUrl(file.storage_path)
  if (signError || !signed) return { ok: false, code: 'unknown' }

  return {
    ok: true,
    ticket: {
      uploadSessionId: r.upload_session_id,
      upload: {
        method: 'PUT',
        url: signed.signedUrl,
        headers: { 'x-upsert': 'false' },
        expiresAt: r.expires_at,
      },
    },
  }
}

/** Verify the uploaded bytes server-side and create the evidence row atomically. */
export async function finalizeRcaEvidenceUpload(
  uploadSessionId: string,
): Promise<NspEvidenceActionState & { evidenceId?: string }> {
  if (!uploadSessionId) return { ok: false, code: 'invalid_input' }

  // Step 1 — the D9 verifier, REUSED not copied: `finalizeDocumentUpload` runs
  // `finalize_document_upload` → service-role download → sha256 →
  // `complete_document_upload_verification`. Re-implementing it here would put
  // two copies of the byte verifier in the tree; `terminal` is its ruling,
  // relayed unchanged (`failed` has no outbound arc in the D9 machine).
  const finalized = await finalizeDocumentUpload(uploadSessionId)
  if (!finalized.ok) {
    const code = narrowDocumentEvidenceError(finalized.error)
    return finalized.terminal ? { ok: false, code, terminal: true } : { ok: false, code }
  }

  // Step 2 — resolve the document behind the reservation.
  // ⚠ NOT from `finalized.documentId`: on the RPC's IDEMPOTENT arm
  // (`upload_sessions.state = 'consumed'`) `finalize_document_upload` returns
  // no `document_id` at all (catalog-read: it returns upload_session_id /
  // file_object_id / document_version_id / upload_state), so the twin yields
  // `''` there and this call would die on an invalid uuid. The version id is
  // present on BOTH arms. Service client: authority was settled by the door
  // above (`reserved_by = auth.uid()`) and is settled again by
  // `add_rca_evidence` below — this read resolves STRUCTURE, not authority.
  const admin = createAdminClient()
  const { data: version } = await admin
    .from('document_versions')
    .select('documents!document_versions_document_id_fkey ( id, title, home_resource_id )')
    .eq('id', finalized.documentVersionId)
    .maybeSingle()
    .returns<{ documents: { id: string; title: string; home_resource_id: string } } | null>()
  const doc = version?.documents
  if (!doc) return { ok: false, code: 'unknown' }

  const supabase = await createClient()

  // Step 3 — idempotency guard. `finalizeDocumentUpload` is idempotent by
  // contract, so a retried/duplicated finalize must not mint a SECOND evidence
  // row over the same document (nothing in the schema forbids it — there is no
  // unique index on `document_id`). RLS-scoped: the writer reads its own rows.
  const { data: existing } = await supabase
    .from('rca_evidence')
    .select('id')
    .eq('document_id', doc.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()
    .returns<{ id: string } | null>()
  if (existing) return { ok: true, evidenceId: existing.id }

  // Step 4 — the evidence row. `p_rca_id` comes from the document's OWN home,
  // which is exactly what the RPC re-verifies (`d.home_resource_id = p_rca_id`
  // AND `s.resource_type = 'rca'`), so the caller never restates it.
  const { data: evidence, error } = await supabase.rpc('add_rca_evidence', {
    p_rca_id: doc.home_resource_id,
    p_kind: 'document',
    p_title: doc.title,
    p_document_id: doc.id,
  })
  if (error || !evidence) return { ok: false, code: evidenceErrCode(error) }

  revalidateNsp()
  return { ok: true, evidenceId: evidence.id }
}

/** Add a `link`-kind row. No bytes; untouched by the substrate move — listed so
 *  frontend sees the whole surface, not only the parts that change. */
export async function addRcaEvidenceLink(
  rcaId: string,
  input: NspEvidenceLinkInput,
): Promise<NspEvidenceActionState> {
  if (!rcaId || !input?.title?.trim() || !input.externalUrl?.trim()) {
    return { ok: false, code: 'invalid_input' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_evidence', {
    p_rca_id: rcaId,
    p_kind: 'link',
    p_title: input.title.trim(),
    p_external_url: input.externalUrl.trim(),
  })
  if (error) return { ok: false, code: evidenceErrCode(error) }

  revalidateNsp()
  return { ok: true }
}

/**
 * Add a `citation`-kind row.
 *
 * ⚠ The SECOND, INDEPENDENT seam: `cited_document_id` is the citation slot
 * (`kind = 'citation'`, mutually exclusive with the uploaded byte). S2 un-parks
 * it by dropping BOTH the `HC0DM` arm and the table CHECK
 * `rca_evidence_cited_document_parked`, then adding the real FK. Passing
 * `citationTarget: 'document'` is refused today and accepted after S2.
 */
export async function addRcaEvidenceCitation(
  rcaId: string,
  input: RcaEvidenceCitationInput,
): Promise<NspEvidenceActionState> {
  if (
    !rcaId ||
    !input?.title?.trim() ||
    !input.citedEntityId ||
    !input.citationLabel?.trim() ||
    !input.citationTarget
  ) {
    return { ok: false, code: 'invalid_input' }
  }

  // The `document` target is now an AUTHORIZATION gate, not a refusal: the RPC
  // raises HC0D8 (`unavailable`) unless `app.can_read_document` admits the
  // caller — you may only cite what you may read. HC0DM is gone; if it ever
  // resurfaces it must land on `unknown` (loud), which is why the contract map
  // has no entry for it.
  const supabase = await createClient()
  const { error } = await supabase.rpc('add_rca_evidence', {
    p_rca_id: rcaId,
    p_kind: 'citation',
    p_title: input.title.trim(),
    p_citation_target: input.citationTarget,
    p_cited_entity_id: input.citedEntityId,
    p_citation_label: input.citationLabel.trim(),
  })
  if (error) return { ok: false, code: evidenceErrCode(error) }

  revalidateNsp()
  return { ok: true }
}

/** Resolve a short-TTL signed URL through the single audited door. Emits the
 *  Rule-11 read row; never called from a list. */
export async function openRcaEvidence(
  evidenceId: string,
): Promise<NspEvidenceActionState & { url?: string }> {
  if (!evidenceId) return { ok: false, code: 'invalid_input' }

  // RLS-scoped read: `rca_evidence_select` is `can_read_event(event_of_rca())`,
  // the SAME predicate `app.can_read_document`'s `rca` arm uses — so a caller
  // who cannot see the row cannot see the document either. Absence ≡ denial.
  const supabase = await createClient()
  const { data: ev } = await supabase
    .from('rca_evidence')
    .select('kind, document_id')
    .eq('id', evidenceId)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<{ kind: string; document_id: string | null } | null>()
  if (!ev || ev.kind !== 'document' || !ev.document_id) return { ok: false, code: 'not_found' }

  // The version to serve is the document's latest — evidence uploads always
  // mint a fresh document (begin is never called with `p_document_id`), so in
  // practice there is exactly one; taking the max keeps this correct if that
  // ever changes and matches the documents projection's `latestVersion`.
  const { data: version } = await supabase
    .from('document_versions')
    .select('id')
    .eq('document_id', ev.document_id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<{ id: string } | null>()
  if (!version) return { ok: false, code: 'unavailable' }

  // THE audited byte door, reused whole (`open_document_version`): it re-runs
  // the kernel + the D15 ceiling, refuses disposed/non-servable bytes, emits
  // the Rule-11 `document.opened` row, and only then does the command layer
  // sign — 120 s for a PHI-tier object, 300 s standard (ADR 0114 O4). The
  // retired list-time `createSignedUrl(path, 3600)` is what this replaces.
  const opened = await openDocumentVersion(version.id)
  if (!opened.ok) return { ok: false, code: narrowDocumentEvidenceError(opened.error) }
  return { ok: true, url: opened.url }
}
