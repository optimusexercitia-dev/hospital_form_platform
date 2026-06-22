import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'

/**
 * Audit-trail data-access (Phase 13 — Audit Trail; Architecture Rule 9 — all
 * reads go through `src/lib/queries/`; Rule 11 — the append-only, tamper-evident
 * audit log). Backs the read-only audit timeline at `/c/[slug]/manage/audit`
 * (staff_admin, own commission) and `/admin/audit` (admin, cross-commission),
 * plus the "Verificar integridade" control.
 *
 * RLS (the security boundary, mirrors submissions.ts):
 *  - `audit_log` SELECT = `app.is_admin()` (all rows) OR
 *    `is_staff_admin_of(commission_id)` (own commission's rows only). Plain
 *    `staff` and `anon` read NOTHING. So `listAudit` reads through the ordinary
 *    cookie-wired (RLS-scoped) client — NO definer RPC for the list path; a
 *    foreign/unauthorized caller simply gets an empty page.
 *  - `verifyAuditChain` IS a DEFINER RPC (`verify_audit_chain`) because it must
 *    recompute the hash over the FULL chain (including rows the caller might be
 *    RLS-scoped away from at chain edges); it is `is_staff_admin_of`/admin-gated
 *    internally and returns the first broken `seq` or OK.
 *  - The log NEVER stores answer payloads / `*_md` / free-text bodies (Rule 1 +
 *    Rule 11): `metadata` is an old→new diff over a curated NON-SENSITIVE column
 *    allow-list only. `summary` is a short pt-BR label, never clinical content.
 */

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN action / entity vocabulary
// ---------------------------------------------------------------------------

/**
 * The audit `entity_type` union — one slug per instrumented entity kind. Stable
 * storage values (ASCII), localized for display via {@link AUDIT_ENTITY_LABELS}.
 * The instrumented set grows additively as later track phases land (CAPA,
 * indicators, etc.); add the new slug here when its triggers ship.
 */
export type AuditEntityType =
  | 'form'
  | 'form_version'
  | 'form_section'
  | 'form_item'
  | 'commission'
  | 'commission_member'
  | 'response'
  | 'signoff'
  | 'case'
  | 'case_phase'
  | 'meeting'
  | 'meeting_signature'
  | 'interview'
  | 'audit'
  // patient-safety / NSP (Phase 14a)
  | 'safety_event'
  | 'event_custody'
  | 'event_patient'
  // patient-safety / NSP triage (Phase 14b)
  | 'event_triage'
  // patient-safety / NSP RCA (Phase 14c)
  | 'rca'
  // patient-safety / NSP CAPA (Phase 14d)
  | 'capa_plan'
  // inter-committee referrals (Phase 22)
  | 'referral'
  | 'referral_patient'
  // patient identity & cross-committee linkage (Phase 23; ADR 0039) — the
  // GLOBAL-chain QPS lookup trail. NOT a PHI entity; "patient" here is referenced
  // by a non-reversible key-derived UUID, never an identifier.
  | 'patient'

/**
 * The audit `action` union — `'<entity>.<verb>'`. These are the verbs emitted by
 * the B3 instrumentation triggers + the B5 explicit `.read`/`.export` call sites.
 * Stable storage values, localized via {@link AUDIT_ACTION_LABELS}. The list is
 * the frozen vocabulary for the action filter dropdown; later phases append new
 * keys (never repurpose an existing one).
 */
export type AuditAction =
  // forms / versions / structure
  | 'form.created'
  | 'form.updated'
  | 'form.deleted'
  | 'form_version.created'
  | 'form_version.published'
  | 'form_version.archived'
  | 'form_section.created'
  | 'form_section.updated'
  | 'form_section.deleted'
  | 'form_item.created'
  | 'form_item.updated'
  | 'form_item.deleted'
  // membership
  | 'commission.created'
  | 'commission.updated'
  | 'commission_member.added'
  | 'commission_member.role_changed'
  | 'commission_member.removed'
  // responses + sign-offs (status flips only — NEVER answer payloads)
  | 'response.submitted'
  | 'response.opened_foreign'
  | 'signoff.recorded'
  // cases (status transitions)
  | 'case.created'
  | 'case.status_changed'
  | 'case_phase.status_changed'
  // meetings
  | 'meeting.created'
  | 'meeting.status_changed'
  | 'meeting.signed'
  // interviews
  | 'interview.created'
  | 'interview.status_changed'
  // patient-safety / NSP (Phase 14a) — mutation triggers (PHI-free metadata)
  | 'safety_event.reported'
  | 'safety_event.acknowledged'
  | 'safety_event.cancelled'
  | 'safety_event.status_changed'
  | 'event_custody.transferred'
  | 'event_patient.updated'
  // patient-safety PHI DISPOSAL (WS C) — the mutation row dispose_event_phi emits;
  // metadata carries the CONSTRAINED reason category only (PHI-free, Rule 11/12).
  | 'event_patient.disposed'
  // patient-safety PHI READ — explicit `.read` call site (Rule 11/12; HIPAA)
  | 'event_patient.read'
  // patient-safety / NSP triage (Phase 14b) — PHI-free metadata allow-list
  | 'triage.saved'
  | 'triage.confirmed'
  | 'triage.reopened'
  // patient-safety / NSP RCA (Phase 14c) — PHI-free metadata allow-list (status only)
  | 'rca.created'
  | 'rca.status_changed'
  | 'rca.submitted'
  | 'rca.completed'
  | 'rca.reopened'
  // patient-safety / NSP CAPA (Phase 14d) — PHI-free metadata allow-list
  | 'capa.opened'
  | 'capa.status_changed'
  | 'capa.closed'
  | 'capa.cancelled'
  | 'capa.reopened'
  | 'capa.effectiveness_recorded'
  // exports (logged via explicit `.export` writer calls in the route layer)
  | 'response.exported'
  | 'audit.exported'
  // PHI-bearing clinical-detail READS (WS B; Rule 11/12) — emitted app-layer by the
  // query helpers on the existing RLS-scoped reads (`.viewed` distinguishes them from
  // mutation verbs). The residual app-layer bypass is the accepted tradeoff (ADR 0030).
  | 'safety_event.viewed'
  | 'triage.viewed'
  | 'rca.viewed'
  | 'capa.viewed'
  | 'meeting.viewed'
  | 'interview.viewed'
  // inter-committee referrals (Phase 22) — mutation verbs (PHI-free metadata) +
  // the audited PHI-identifier read + PHI-bearing detail/document open.
  | 'referral.created'
  | 'referral.updated'
  | 'referral.status_changed'
  | 'referral_patient.updated'
  | 'referral_patient.read'
  | 'referral.viewed'
  // patient identity & cross-committee linkage (Phase 23; ADR 0039) — the QPS
  // reassembly trail on the GLOBAL chain; KEY-ONLY metadata, never a raw MRN/name.
  | 'patient.searched'
  | 'patient.viewed'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the ASCII slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the entity-type filter. */
export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  form: 'Formulário',
  form_version: 'Versão de formulário',
  form_section: 'Seção',
  form_item: 'Item',
  commission: 'Comissão',
  commission_member: 'Membro',
  response: 'Resposta',
  signoff: 'Assinatura de seção',
  case: 'Caso',
  case_phase: 'Fase do caso',
  meeting: 'Reunião',
  meeting_signature: 'Assinatura de ata',
  interview: 'Entrevista',
  audit: 'Trilha de auditoria',
  safety_event: 'Evento de segurança',
  event_custody: 'Custódia de evento',
  event_patient: 'Dados do paciente (evento)',
  event_triage: 'Triagem de evento',
  rca: 'Análise de causa raiz',
  capa_plan: 'Plano de ação (CAPA)',
  referral: 'Encaminhamento',
  referral_patient: 'Dados do paciente (encaminhamento)',
  patient: 'Paciente (vínculo entre comissões)',
}

/** pt-BR labels for the action filter (short verb phrases). */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'form.created': 'Formulário criado',
  'form.updated': 'Formulário atualizado',
  'form.deleted': 'Formulário excluído',
  'form_version.created': 'Versão criada',
  'form_version.published': 'Versão publicada',
  'form_version.archived': 'Versão arquivada',
  'form_section.created': 'Seção criada',
  'form_section.updated': 'Seção atualizada',
  'form_section.deleted': 'Seção excluída',
  'form_item.created': 'Item criado',
  'form_item.updated': 'Item atualizado',
  'form_item.deleted': 'Item excluído',
  'commission.created': 'Comissão criada',
  'commission.updated': 'Comissão atualizada',
  'commission_member.added': 'Membro adicionado',
  'commission_member.role_changed': 'Função alterada',
  'commission_member.removed': 'Membro removido',
  'response.submitted': 'Resposta enviada',
  'response.opened_foreign': 'Resposta de terceiro visualizada',
  'signoff.recorded': 'Seção assinada',
  'case.created': 'Caso criado',
  'case.status_changed': 'Status do caso alterado',
  'case_phase.status_changed': 'Status da fase alterado',
  'meeting.created': 'Reunião criada',
  'meeting.status_changed': 'Status da reunião alterado',
  'meeting.signed': 'Ata assinada',
  'interview.created': 'Entrevista criada',
  'interview.status_changed': 'Status da entrevista alterado',
  'safety_event.reported': 'Evento de segurança notificado',
  'safety_event.acknowledged': 'Evento reconhecido pelo NSP',
  'safety_event.cancelled': 'Evento cancelado',
  'safety_event.status_changed': 'Status do evento alterado',
  'event_custody.transferred': 'Custódia do evento transferida',
  'event_patient.updated': 'Dados do paciente atualizados',
  'event_patient.read': 'Dados do paciente visualizados',
  'event_patient.disposed': 'Dados do paciente descartados',
  'triage.saved': 'Triagem salva',
  'triage.confirmed': 'Triagem confirmada',
  'triage.reopened': 'Triagem reaberta',
  'rca.created': 'Análise de causa raiz criada',
  'rca.status_changed': 'Status da análise alterado',
  'rca.submitted': 'Análise enviada para revisão',
  'rca.completed': 'Análise concluída',
  'rca.reopened': 'Análise reaberta',
  'capa.opened': 'Plano de ação aberto',
  'capa.status_changed': 'Status do plano alterado',
  'capa.closed': 'Plano de ação encerrado',
  'capa.cancelled': 'Plano de ação cancelado',
  'capa.reopened': 'Plano de ação reaberto',
  'capa.effectiveness_recorded': 'Eficácia verificada',
  'safety_event.viewed': 'Detalhe do evento visualizado',
  'triage.viewed': 'Triagem visualizada',
  'rca.viewed': 'Análise de causa raiz visualizada',
  'capa.viewed': 'Plano de ação (CAPA) visualizado',
  'meeting.viewed': 'Detalhe da reunião visualizado',
  'interview.viewed': 'Detalhe da entrevista visualizado',
  'referral.created': 'Encaminhamento criado',
  'referral.updated': 'Encaminhamento atualizado',
  'referral.status_changed': 'Status do encaminhamento alterado',
  'referral_patient.updated': 'Dados do paciente (encaminhamento) atualizados',
  'referral_patient.read': 'Dados do paciente (encaminhamento) visualizados',
  'referral.viewed': 'Detalhe do encaminhamento visualizado',
  'patient.searched': 'Paciente pesquisado entre comissões',
  'patient.viewed': 'Trajetória do paciente visualizada',
  'response.exported': 'Respostas exportadas',
  'audit.exported': 'Trilha de auditoria exportada',
}

// ---------------------------------------------------------------------------
// Domain types — the audit-timeline contract
// ---------------------------------------------------------------------------

/**
 * One audit-log row, as the UI consumes it. METADATA-ONLY by construction: the
 * `metadata` diff is a curated NON-SENSITIVE column allow-list (old→new), NEVER
 * answer payloads or free-text/Markdown bodies (Rule 1 + Rule 11). `summary` is
 * a short pt-BR label resolved by the writer.
 */
export interface AuditLogEntry {
  id: string
  /** ISO timestamp of when the action occurred. */
  occurredAt: string
  /** The acting profile id; `null` for system / service-role actions. */
  actorId: string | null
  /** Display name of the actor; `null` for system or when the profile is gone. */
  actorName: string | null
  /** Snapshot of the actor's admin flag AT THE TIME of the action. */
  actorIsAdmin: boolean
  /** The action's commission; `null` for global/admin (cross-commission) actions. */
  commissionId: string | null
  /** Resolved commission name for the admin cross-commission view; `null` when
   * the action is global or the name is unavailable. */
  commissionName: string | null
  /** `'<entity>.<verb>'` (e.g. `form_version.published`). */
  action: AuditAction
  entityType: AuditEntityType
  /** The affected row's id (a uuid for most entities). */
  entityId: string
  /** A short pt-BR human summary (resolved by the writer; never clinical text). */
  summary: string
  /**
   * The curated non-sensitive old→new diff (e.g.
   * `{ "status": { "old": "in_progress", "new": "submitted" } }`). Shape is
   * intentionally loose (`Json`) — the UI renders it generically as key/old/new.
   */
  metadata: Json
  /** The per-commission (or global) monotone sequence number. */
  seq: number
}

/** Filters for the audit list. All optional; `from`/`to` are inclusive ISO
 * dates (`YYYY-MM-DD`) on `occurred_at`. `page`/`pageSize` drive pagination. */
export interface AuditFilters {
  actorId?: string
  action?: AuditAction
  entityType?: AuditEntityType
  from?: string
  to?: string
  /** 1-based page index (default 1). */
  page?: number
  /** Rows per page (default in the impl; cap enforced server-side). */
  pageSize?: number
}

/** A page of audit entries plus the total count for pagination chrome. */
export interface AuditPage {
  entries: AuditLogEntry[]
  /** Total rows matching the filters (for the page count); RLS-scoped. */
  total: number
  page: number
  pageSize: number
}

/**
 * The result of a chain-integrity check. `ok: true` → the recomputed hash chain
 * matches end-to-end; `ok: false` carries the FIRST `seq` whose stored `row_hash`
 * disagrees with the recomputed value (the tamper point).
 */
export type AuditChainResult =
  | { ok: true }
  | { ok: false; brokenSeq: number }

/** An actor option for the audit list's actor filter (distinct actors with ≥1
 * audit row the caller may read). `null` id = the system/service-role actor. */
export interface AuditFilterActor {
  actorId: string | null
  name: string | null
}

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds) + mapper
// ---------------------------------------------------------------------------

interface AuditListRow {
  id: string
  occurred_at: string
  actor_id: string | null
  actor_is_admin: boolean
  commission_id: string | null
  action: string
  entity_type: string
  entity_id: string
  summary: string
  metadata: Json
  seq: number
  profiles: { full_name: string | null } | null
  commissions: { name: string } | null
}

/** The PostgREST select string for an audit row (+ actor name + commission name
 * for the admin cross-commission view). */
const AUDIT_SELECT =
  'id, occurred_at, actor_id, actor_is_admin, commission_id, action, ' +
  'entity_type, entity_id, summary, metadata, seq, ' +
  'profiles:actor_id(full_name), commissions:commission_id(name)'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

function mapAuditRow(r: AuditListRow): AuditLogEntry {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    actorId: r.actor_id,
    actorName: r.profiles?.full_name ?? null,
    actorIsAdmin: r.actor_is_admin,
    commissionId: r.commission_id,
    commissionName: r.commissions?.name ?? null,
    // The action/entity slugs are constrained by the writer to the unions above;
    // the DB has no enum, so we trust the writer's vocabulary (cast, not parse).
    action: r.action as AuditAction,
    entityType: r.entity_type as AuditEntityType,
    entityId: r.entity_id,
    summary: r.summary,
    metadata: r.metadata,
    seq: r.seq,
  }
}

// ---------------------------------------------------------------------------
// Queries — list is RLS-scoped (cookie client); verify is a DEFINER RPC
// ---------------------------------------------------------------------------

/**
 * One page of audit entries, newest-first, filtered by actor/action/entity/date.
 * RLS-scoped: a staff_admin reads only their commission's rows; a plain `staff` /
 * foreign caller gets an empty page (RLS denies). When `commissionId` is a uuid,
 * the list is filtered to that commission; when `null`, it is the cross-commission
 * stream for the ADMIN view (RLS still scopes a non-admin to nothing, and the
 * global `commission_id IS NULL` rows are admin-only by the SELECT policy).
 */
export async function listAudit(
  commissionId: string | null,
  filters: AuditFilters,
): Promise<AuditPage> {
  const supabase = await createClient()

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_log')
    .select(AUDIT_SELECT, { count: 'exact' })

  if (commissionId) query = query.eq('commission_id', commissionId)
  if (filters.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.entityType) query = query.eq('entity_type', filters.entityType)
  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', `${filters.to}T23:59:59.999Z`)

  const { data, count } = await query
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })
    .range(offset, offset + pageSize - 1)
    .returns<AuditListRow[]>()

  return {
    entries: (data ?? []).map(mapAuditRow),
    total: count ?? 0,
    page,
    pageSize,
  }
}

/**
 * Recompute the hash chain and report integrity. `commissionId` scopes to one
 * commission's chain; `undefined` (admin only) verifies the global chain + every
 * commission chain. Backed by the `verify_audit_chain` DEFINER RPC
 * (`is_staff_admin_of`/admin-gated). Returns `{ ok: true }` when intact, else the
 * first broken `seq`. A forbidden/failed call surfaces as `{ ok: false,
 * brokenSeq: -1 }` so the caller (the action layer) maps it to a generic pt-BR
 * error rather than asserting integrity.
 */
export async function verifyAuditChain(
  commissionId?: string,
): Promise<AuditChainResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('verify_audit_chain', { p_commission: commissionId ?? undefined })
    .returns<{ ok: boolean; broken_seq: number | null }[]>()

  if (error || !data || data.length === 0) {
    // -1 is an out-of-band sentinel (real seqs are >= 1): "could not verify".
    return { ok: false, brokenSeq: -1 }
  }
  const row = data[0]
  if (row.ok) return { ok: true }
  return { ok: false, brokenSeq: row.broken_seq ?? -1 }
}

/** Whether the `audit_trail` feature flag is ON (TS-layer gate; mirrors
 * `meetingsEnabled`/`interviewsEnabled`). Backed by the `audit_trail_enabled`
 * DEFINER read; defaults to `false` on any error. */
export async function auditTrailEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('audit_trail_enabled')
  if (error) return false
  return data === true
}

/** Distinct actor options for the actor filter (actors with ≥1 readable audit
 * row in scope). RLS-scoped; `[]` when none are readable. Resolves names from the
 * embedded profile; a `null` actor (system) is surfaced as a single option. */
export async function listAuditFilterActors(
  commissionId: string | null,
): Promise<AuditFilterActor[]> {
  const supabase = await createClient()

  let query = supabase
    .from('audit_log')
    .select('actor_id, profiles:actor_id(full_name)')
  if (commissionId) query = query.eq('commission_id', commissionId)

  const { data } = await query.returns<
    { actor_id: string | null; profiles: { full_name: string | null } | null }[]
  >()

  const byId = new Map<string, AuditFilterActor>()
  let hasSystem = false
  for (const r of data ?? []) {
    if (r.actor_id === null) {
      hasSystem = true
      continue
    }
    if (!byId.has(r.actor_id)) {
      byId.set(r.actor_id, { actorId: r.actor_id, name: r.profiles?.full_name ?? null })
    }
  }
  const out = Array.from(byId.values()).sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'),
  )
  // Surface the system actor as a selectable option when present.
  if (hasSystem) out.push({ actorId: null, name: null })
  return out
}
