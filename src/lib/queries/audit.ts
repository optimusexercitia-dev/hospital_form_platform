import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { Json } from '@/lib/types/database'
// The ADR 0106 single source of the pt-BR role vocabulary. It lived under
// `src/components/role/` until 2026-08-25 and was moved to `src/lib/role/` precisely so
// this import could exist: a query module reaching into `src/components` inverts the
// layering, and as the first of its kind it would have been the precedent every later
// query module copied. The module was always pure (no directive, no I/O, and it already
// imported only from `src/lib`), so re-homing it was the honest fix — copying the label
// map here would have been a THIRD copy of it.
import { platformRoleLabel } from '@/lib/role/role-catalog'

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
  // MEM (S1): membership entity type replaces the retired commission_member (the
  // blanket trg_audit_memberships emits entity_type = 'membership').
  | 'membership'
  | 'response'
  | 'signoff'
  | 'case'
  | 'case_phase'
  // case_patient — the THIRD PHI module (isolated identifiers; Rule 12; ADR 0038).
  | 'case_patient'
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
  // centralized attachments (Phase F2; ADR 0063) — the audit trigger + PHI door.
  | 'attachment'
  // hospital employment links (ADR 0097 D1/D4) — emitted by
  // `app.trg_audit_hospital_affiliations`. Rows are HOSPITAL-tier (commission_id NULL,
  // hospital_id set), which is what scopes who can read them; see the RLS note on
  // {@link listPersonAccountHistory}.
  | 'hospital_affiliation'

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
  // membership — MEM (S1) unified verbs (D1 HARD-CUT: the legacy commission_member.* /
  // organization_member.* / pqs_member.* families are RETIRED, no aliases). One
  // membership.* family across all three tiers; scope-ids in metadata preserve the tier.
  | 'commission.created'
  | 'commission.updated'
  | 'membership.granted'
  | 'membership.role_changed'
  | 'membership.revoked'
  // ADR 0094 W2/T2.3 — the expiry arm of `app.trg_audit_memberships`. APPENDED late
  // (2026-08-25): the trigger has emitted this verb since ADR 0094 and the union never
  // carried it, so the action filter could not offer it and `mapAuditRow`'s cast quietly
  // widened the type at the boundary. Found while reading the live trigger body for the
  // person timeline, which surfaces exactly these rows.
  | 'membership.expiry_changed'
  // hospital employment links (ADR 0097 D1/D4) — `app.trg_audit_hospital_affiliations`.
  // `affiliation.deleted` is the trigger's DELETE arm: reachable ONLY under
  // `session_replication_role = replica` (the BEFORE guard raises otherwise), and it
  // exists so that the one window in which D4 can be violated is not also invisible.
  | 'affiliation.created'
  | 'affiliation.ended'
  | 'affiliation.updated'
  | 'affiliation.deleted'
  // responses + sign-offs (status flips only — NEVER answer payloads)
  | 'response.submitted'
  | 'response.opened_foreign'
  | 'signoff.recorded'
  // cases (status transitions)
  | 'case.created'
  | 'case.status_changed'
  | 'case_phase.status_changed'
  // case_patient PHI (THIRD PHI module; Rule 12; ADR 0038) — the audited read door
  // (get_case_patient), the mutation trigger, and the disposal. Reason-only /
  // PHI-free metadata; mirrors the event_patient action set.
  | 'case_patient.read'
  | 'case_patient.updated'
  | 'case_patient.disposed'
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
  // referral PHI DISPOSAL — the mutation row dispose_referral_phi emits (reason-only
  // metadata, PHI-free; mirrors event_patient.disposed).
  | 'referral_patient.disposed'
  | 'referral.viewed'
  // patient identity & cross-committee linkage (Phase 23; ADR 0039) — the QPS
  // reassembly trail on the GLOBAL chain; KEY-ONLY metadata, never a raw MRN/name.
  | 'patient.searched'
  | 'patient.viewed'
  // centralized attachments (Phase F2; ADR 0063) — mutation verbs (PHI-free metadata:
  // owner/kind/tier/label/bucket/scan/legal_hold/reason/deleted_at) + the audited PHI
  // blob-open read. title/description/path/sha256/subject are NEVER audited (Rule 11).
  // ⚠ HISTORICAL since DM1 (ADR 0114 D5): the attachments substrate was dropped
  // by 20260923000100 and nothing emits these anymore — they stay here because
  // the audit log is append-only and existing rows must keep rendering.
  | 'attachment.created'
  | 'attachment.updated'
  | 'attachment.reclassified'
  | 'attachment.deleted'
  | 'attachment.phi_disposed'
  | 'attachment.read'
  // document model (DM, ADR 0114 D11) — the audited document open, emitted by
  // DM2's open_document_version through log_audit_access.
  | 'document.opened'
  // charters & cadence — S4·CH (ADR 0080). Commission-level config; emitted by the
  // upsert_commission_charter DEFINER RPC (CH-BE-3) with entity_type 'commission'
  // (entity_id = commission_id). PHI-free metadata (Rule 12).
  | 'charter.upserted'

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
  membership: 'Função',
  response: 'Resposta',
  signoff: 'Assinatura de seção',
  case: 'Caso',
  case_phase: 'Fase do caso',
  case_patient: 'Dados do paciente (caso)',
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
  attachment: 'Anexo',
  hospital_affiliation: 'Vínculo hospitalar',
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
  'membership.granted': 'Função concedida',
  'membership.role_changed': 'Função alterada',
  'membership.revoked': 'Função revogada',
  'membership.expiry_changed': 'Validade da função alterada',
  'affiliation.created': 'Vínculo hospitalar criado',
  'affiliation.ended': 'Vínculo hospitalar encerrado',
  'affiliation.updated': 'Vínculo hospitalar atualizado',
  'affiliation.deleted': 'Vínculo hospitalar excluído',
  'response.submitted': 'Resposta enviada',
  'response.opened_foreign': 'Resposta de terceiro visualizada',
  'signoff.recorded': 'Seção assinada',
  'case.created': 'Caso criado',
  'case.status_changed': 'Status do caso alterado',
  'case_phase.status_changed': 'Status da fase alterado',
  'case_patient.read': 'Dados do paciente (caso) acessados',
  'case_patient.updated': 'Dados do paciente (caso) atualizados',
  'case_patient.disposed': 'Dados do paciente (caso) descartados',
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
  'referral_patient.disposed': 'Dados do paciente (encaminhamento) descartados',
  'referral.viewed': 'Detalhe do encaminhamento visualizado',
  'patient.searched': 'Paciente pesquisado entre comissões',
  'patient.viewed': 'Trajetória do paciente visualizada',
  'response.exported': 'Respostas exportadas',
  'audit.exported': 'Trilha de auditoria exportada',
  'attachment.created': 'Anexo criado',
  'attachment.updated': 'Anexo atualizado',
  'attachment.reclassified': 'Anexo reclassificado',
  'attachment.deleted': 'Anexo removido',
  'attachment.phi_disposed': 'Dados do anexo descartados',
  'attachment.read': 'Anexo (PHI) aberto',
  'document.opened': 'Documento aberto',
  'charter.upserted': 'Regimento e cadência atualizados',
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
 * One page of audit entries for an ORGANIZATION (multi-tenancy Phase C), for the
 * `/o/[org]/manage` org-tier audit. Filters to `organization_id = orgId`.
 *
 * ⭐ THE QUERY ASKS FOR THREE TIERS AND SINCE ADR 0146 RLS RETURNS THREE. `.eq('organization_id')`
 * matches the org chain, every commission chain (those rows carry the trigger-derived
 * `organization_id`) AND every HOSPITAL-tier row of the org. All three are now readable by an
 * `org_admin`: leg 2 `is_tenancy_admin_of(commission_id)` carries the commission chains, and the
 * org leg — `(commission_id IS NULL) AND is_org_admin_of(organization_id)` — carries the org and
 * hospital chains together.
 *
 * ⛔ THIS COMMENT DOCUMENTED THE OPPOSITE UNTIL 2026-08-25, and the history matters because the
 * bug was invisible from this file. The org leg used to carry a third conjunct,
 * `(hospital_id IS NULL)`, so every hospital-tier row this query asked for was silently dropped:
 * an org_admin saw NO hospital-scope membership grant (hospital_admin, nsp_coordinator,
 * technical_director…) and NO affiliation event, ever. Measured before the fix, org A:
 * 173/173 commission-tier, **0/19** hospital-tier, 16/16 org-tier. After: 173/19/16 visible
 * against 173/19/16 existing — exact parity with what the table holds.
 *
 * The tell was that `verify_audit_chain` had ALWAYS let an org_admin attest a hospital chain it
 * could not read. Migration 20261003002300 removed the conjunct; keystone
 * `supabase/tests/369_audit_org_leg_hospital_tier.sql`.
 *
 * RLS-scoped: empty for a caller who is not org_admin of `orgId`. Same shape/pagination as
 * `listAudit`.
 */
export async function listAuditForOrg(
  orgId: string,
  filters: AuditFilters,
): Promise<AuditPage> {
  const supabase = await createClient()

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_log')
    .select(AUDIT_SELECT, { count: 'exact' })
    .eq('organization_id', orgId)

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
 * One page of audit entries for a HOSPITAL (ADR 0051 — the hospital audit tier),
 * for the `/o/[org]/manage` hospital-tier audit viewed by a `hospital_admin`.
 * Filters to `hospital_id = hospitalId`, which matches the hospital chain
 * (`commission_id IS NULL`) AND every commission chain under the hospital (each
 * commission-tier row carries the trigger-derived `hospital_id`).
 *
 * ⭐ SINCE ADR 0146 AN `org_admin` GETS THE SAME UNION. It reaches the hospital chain through
 * the org leg (`commission_id IS NULL AND is_org_admin_of(organization_id)`) and the commission
 * chains through `is_tenancy_admin_of`, so both callers see both halves.
 *
 * ⚠ THIS COMMENT RECORDED A GAP HERE UNTIL 2026-08-25 — measured then on the same hospital:
 * `hospitaladmin.a1` → 13 hospital-tier + 167 commission-tier, `orgadmin.a` → **0** hospital-tier
 * + 167 commission-tier. The hospital-chain half vanished for an org_admin. Migration
 * 20261003002300 closed it; the two roles no longer differ on THIS function. They still differ
 * elsewhere: a `hospital_admin` reads only its own hospital, an `org_admin` every hospital in
 * its org (test 369 §4.2 pins that leg 3 stayed hospital-bounded).
 *
 * ⚠ NO LIVE SURFACE HITS THAT CASE TODAY: `/o/[org]/manage/audit` routes `isOrgAdmin` to
 * {@link listAuditForOrg} and only ever calls this one for a `hospital_admin`. The behaviour
 * is recorded because it is a property of THIS FUNCTION, and the next caller will not know
 * the page happens to shield it.
 *
 * Same shape/pagination as {@link listAudit} / {@link listAuditForOrg}.
 */
export async function listAuditForHospital(
  hospitalId: string,
  filters: AuditFilters,
): Promise<AuditPage> {
  const supabase = await createClient()

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE))
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_log')
    .select(AUDIT_SELECT, { count: 'exact' })
    .eq('hospital_id', hospitalId)

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
 * Recompute the hash chain and report integrity, per TIER (ADR 0051 — the audit
 * log is now a 4-tier chain: platform / org / hospital / commission). Pass exactly
 * one scope:
 *  - `{ commissionId }` → that commission's chain (authz: staff_admin OR
 *    org_admin of the commission's org OR hospital_admin of its hospital).
 *  - `{ hospitalId }` → that hospital's chain, `commission_id IS NULL` (authz:
 *    hospital_admin of the hospital OR org_admin of its org).
 *  - `{ organizationId }` → that org's chain, `hospital_id IS NULL AND
 *    commission_id IS NULL` (authz: org_admin of the org).
 *  - neither → the PLATFORM chain only (authz: platform_admin).
 * Backed by the `verify_audit_chain(p_commission, p_organization, p_hospital)`
 * DEFINER RPC (the `p_hospital` param is threaded in A3). Returns `{ ok: true }`
 * when intact, else the first broken `seq`. A forbidden/failed call surfaces as
 * `{ ok: false, brokenSeq: -1 }`.
 */
export async function verifyAuditChain(
  scope?:
    | string
    | { commissionId?: string; organizationId?: string; hospitalId?: string },
): Promise<AuditChainResult> {
  const supabase = await createClient()

  // Backward-compatible: a bare string is the legacy commission-id form (the
  // existing `/c/.../manage/audit` caller); the object form adds the org +
  // hospital tiers.
  const commissionId =
    typeof scope === 'string' ? scope : scope?.commissionId
  const organizationId =
    typeof scope === 'string' ? undefined : scope?.organizationId
  const hospitalId =
    typeof scope === 'string' ? undefined : scope?.hospitalId

  const { data, error } = await supabase
    .rpc('verify_audit_chain', {
      p_commission: commissionId ?? undefined,
      p_organization: organizationId ?? undefined,
      p_hospital: hospitalId ?? undefined,
    })
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
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read so many
  // *_enabled() calls in one render collapse to a single round trip. Signature +
  // safe-default (false) preserved so existing callers are unaffected.
  return featureEnabled('audit_trail')
}

/** Distinct actor options for the actor filter (actors with ≥1 readable audit
 * row in scope). RLS-scoped; `[]` when none are readable. Resolves names from the
 * embedded profile; a `null` actor (system) is surfaced as a single option. */
export async function listAuditFilterActors(
  commissionId: string | null,
): Promise<AuditFilterActor[]> {
  const supabase = await createClient()

  // P2 (WS-6): distinct actors are resolved IN THE DB via the SECURITY INVOKER
  // `list_audit_filter_actors` RPC (SELECT DISTINCT ON), not by fetching every
  // audit row and de-duping in JS. The RPC runs under the caller's RLS, so the
  // visible actor set is identical to the former client-side scan's.
  const { data } = await supabase
    .rpc('list_audit_filter_actors', {
      p_commission: commissionId ?? undefined,
    })
    .returns<{ actor_id: string | null; full_name: string | null }[]>()

  const actors: AuditFilterActor[] = []
  let hasSystem = false
  for (const r of data ?? []) {
    if (r.actor_id === null) {
      hasSystem = true
      continue
    }
    actors.push({ actorId: r.actor_id, name: r.full_name })
  }
  actors.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'))
  // Surface the system actor as a selectable option when present.
  if (hasSystem) actors.push({ actorId: null, name: null })
  return actors
}

// ---------------------------------------------------------------------------
// Per-person account history (user-profile redesign) — the "Histórico da conta"
// timeline on `/o/[org]/manage/usuarios/[userId]`.
// ---------------------------------------------------------------------------

/**
 * One event on a person's account timeline, COMPOSED SERVER-SIDE.
 *
 * `title` / `detail` are finished pt-BR strings rather than a slug plus ids, because the
 * composition needs the role vocabulary, the commission/hospital names and the actor —
 * four joins the renderer has no business performing (Architecture Rule 9), and a rule
 * the dashboard would otherwise re-derive differently from the audit page.
 */
export interface PersonAccountEvent {
  id: string
  /** ISO timestamp of when the action occurred. */
  occurredAt: string
  /** pt-BR bold lead, e.g. `"Papel alterado para Coordenador(a) de comissão"`. */
  title: string
  /** pt-BR muted tail, e.g. `"na CCIH, por Renata Vaz"`; `null` when nothing to add. */
  detail: string | null
  /** Timeline dot: membership/lifecycle | verification | creation. */
  tone: 'primary' | 'success' | 'muted'
}

/**
 * The entity types whose rows are ABOUT a person rather than about a commission artifact.
 *
 * ⛔ THESE ROWS ARE NOT KEYED BY `entity_id = userId` — `entity_id` is the affiliation /
 * membership ROW id. Both emitting triggers put the subject in `metadata.user_id`
 * (`app.trg_audit_hospital_affiliations` and `app.trg_audit_memberships`, read from
 * `pg_proc` on 2026-08-25, not from migration text). Filtering on `entity_id` returns
 * nothing and looks like "this person has no history".
 */
const PERSON_HISTORY_ENTITY_TYPES: AuditEntityType[] = [
  'hospital_affiliation',
  'membership',
]

const DEFAULT_PERSON_HISTORY_LIMIT = 12
const MAX_PERSON_HISTORY_LIMIT = 100

interface PersonHistoryRow {
  id: string
  occurred_at: string
  action: string
  actor_id: string | null
  metadata: Json
  profiles: { full_name: string | null } | null
  commissions: { name: string } | null
}

/** Read one string key out of the loose `Json` metadata; `null` for anything else. */
function metaString(metadata: Json, key: string): string | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }
  const value = (metadata as { [k: string]: Json | undefined })[key]
  return typeof value === 'string' ? value : null
}

/**
 * The timeline dot.
 *
 * ⚠ `'success'` IS CURRENTLY UNREACHABLE, and that is a fact about the DATABASE, not an
 * oversight here. It is meant for credential verification, and `professional_credentials`
 * carries NO audit trigger (checked against `pg_trigger`, 2026-08-25) — nothing anywhere
 * emits a verification event. The arm stays in the union so the surface does not have to
 * change shape when one is instrumented.
 *
 * `affiliation.created` takes `'muted'` as the "creation" class: it is the first thing
 * that happens to a person at a hospital and is the earliest event on a typical timeline,
 * which is where the design puts the muted dot. Everything else is `'primary'`.
 */
function personEventTone(action: string): PersonAccountEvent['tone'] {
  return action === 'affiliation.created' ? 'muted' : 'primary'
}

/**
 * The bold lead. Falls back to the shared {@link AUDIT_ACTION_LABELS} so a verb added to
 * the vocabulary renders sensibly here without a second edit; only the three role-bearing
 * membership verbs are special-cased, because naming the role is the whole point of them.
 */
function personEventTitle(action: string, roleLabel: string | null): string {
  if (roleLabel) {
    if (action === 'membership.granted') return `Função concedida: ${roleLabel}`
    if (action === 'membership.role_changed') return `Papel alterado para ${roleLabel}`
    if (action === 'membership.revoked') return `Função revogada: ${roleLabel}`
  }
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action
}

/**
 * A person's account history, newest first — affiliation and membership events, composed
 * into finished pt-BR lines.
 *
 * ⚠ RLS-SCOPED, ON THE ORDINARY COOKIE CLIENT (never the admin client): this is a read of
 * the audit log and the caller must see exactly what `audit_log_select` grants them.
 *
 * ⭐ AN `org_admin` NOW SEES HOSPITAL-TIER EVENTS HERE (ADR 0146, migration 20261003002300).
 * `audit_log_select`'s org leg is `(commission_id IS NULL) AND is_org_admin_of(organization_id)`,
 * so the org and hospital chains both reach an org_admin, and `is_tenancy_admin_of(commission_id)`
 * carries the commission chains.
 *
 * ⛔ UNTIL 2026-08-25 THAT LEG ALSO REQUIRED `hospital_id IS NULL`, and this timeline was where
 * it hurt most — the page IS the org-admin surface, so it was the common case, not an edge one.
 * It silently removed:
 *   · every `affiliation.*` event (hospital-tier by construction), AND
 *   · every HOSPITAL-SCOPE membership grant — `hospital_admin`, `nsp_coordinator`,
 *     `technical_director`, and anything else seated at hospital tier.
 * Only COMMISSION-tier membership events survived. Measured then: for `nsp_coordinator c1`,
 * whose only event is a hospital-tier grant, the timeline was 1 row for a superuser and **0**
 * for `orgadmin.a` — an entirely empty history for a real person. Org A now measures at exact
 * parity: 173/19/16 visible against 173/19/16 existing.
 *
 * ⛔ WHOLE CLASSES OF EVENT DO NOT EXIST YET, and none are synthesised: `profiles` carries
 * no audit trigger at all (only the three guard triggers), so account CREATED, DEACTIVATED,
 * SUSPENDED, REACTIVATED, invite ACCEPTED / email VERIFIED and profile-field EDITS emit
 * nothing. This returns what the log actually holds.
 *
 * An EMPTY result is therefore a legitimate state and must never be rendered as
 * "no permission".
 */
export async function listPersonAccountHistory(
  userId: string,
  limit: number = DEFAULT_PERSON_HISTORY_LIMIT,
): Promise<PersonAccountEvent[]> {
  const supabase = await createClient()
  const capped = Math.min(MAX_PERSON_HISTORY_LIMIT, Math.max(1, limit))

  const { data } = await supabase
    .from('audit_log')
    .select(
      'id, occurred_at, action, actor_id, metadata, ' +
        'profiles:actor_id(full_name), commissions:commission_id(name)',
    )
    .in('entity_type', PERSON_HISTORY_ENTITY_TYPES)
    // The subject lives in the JSONB, not in `entity_id` — see the note on
    // PERSON_HISTORY_ENTITY_TYPES. Verified against the live PostgREST, because a
    // `.select()`/filter string is a STRING and a wrong one typechecks perfectly.
    .eq('metadata->>user_id', userId)
    .order('occurred_at', { ascending: false })
    .order('seq', { ascending: false })
    .limit(capped)
    .returns<PersonHistoryRow[]>()

  const rows = data ?? []
  if (rows.length === 0) return []

  // Hospital names need a SECOND read: there is no foreign key from `audit_log.hospital_id`
  // to `hospitals` (checked against pg_constraint), so PostgREST cannot embed it the way it
  // embeds the commission. RLS-scoped like everything else — an unresolvable hospital simply
  // drops the scope phrase rather than rendering an id.
  const hospitalIds = Array.from(
    new Set(
      rows
        .map((r) => metaString(r.metadata, 'hospital_id'))
        .filter((id): id is string => id !== null),
    ),
  )
  const hospitalNames = new Map<string, string>()
  if (hospitalIds.length > 0) {
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('id, name')
      .in('id', hospitalIds)
      .returns<{ id: string; name: string }[]>()
    for (const h of hospitals ?? []) hospitalNames.set(h.id, h.name)
  }

  return rows.map((r) => {
    const role = metaString(r.metadata, 'role')
    const hospitalId = metaString(r.metadata, 'hospital_id')

    // The commission wins over the hospital when both are known: a commission-tier seat is
    // the more specific fact, and naming its hospital too would read as two scopes.
    const commissionName = r.commissions?.name ?? null
    const hospitalName = hospitalId ? (hospitalNames.get(hospitalId) ?? null) : null

    const parts: string[] = []
    if (commissionName) parts.push(`na ${commissionName}`)
    else if (hospitalName) parts.push(`no ${hospitalName}`)
    // A null actor is the system/service-role writer (seeded and machine-run rows), which
    // is a real answer to "who did this" and is stated rather than left blank.
    parts.push(r.profiles?.full_name ? `por ${r.profiles.full_name}` : 'pelo sistema')

    return {
      id: r.id,
      occurredAt: r.occurred_at,
      title: personEventTitle(r.action, role ? platformRoleLabel(role) : null),
      detail: parts.length > 0 ? parts.join(', ') : null,
      tone: personEventTone(r.action),
    }
  })
}
