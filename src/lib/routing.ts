/**
 * Centralized route construction for the multi-tenant URL space
 * (`/o/[org]/c/[commission]/...`). This is the SINGLE place that knows the base
 * path shape: every `/o/...` / `/c/...` link in the app is built through these
 * helpers, so the route layout can be changed in one file and a grep for raw
 * `/c/` or `/o/` literals becomes the completeness check for the route move.
 *
 * Pure path construction — no I/O, safe to import from client and server
 * components alike. Slugs are already URL-safe (validated by the DB slug-format
 * CHECK), but each segment is encoded defensively so a stray reserved character
 * can never break a URL. Query strings are NOT handled here — callers append
 * `?...` to the returned string (matching the existing
 * `dashboard/export?${qs}` pattern); these helpers build path only.
 */

/** Join path segments under a base, encoding each and avoiding double slashes. */
function buildPath(
  base: string,
  segments: Array<string | number>,
): string {
  const tail = segments
    .filter((segment) => segment !== '' && segment != null)
    .map((segment) => encodeURIComponent(String(segment)))
    .join('/')
  return tail ? `${base}/${tail}` : base
}

/**
 * A commission's URL within its organization: `/o/{org}/c/{commission}` plus any
 * nested path segments. The org and commission slugs are encoded as the base;
 * additional segments are the path beneath the commission area.
 *
 * @example commissionHref('org-a', 'ccih')                       // /o/org-a/c/ccih
 * @example commissionHref('org-a', 'ccih', 'manage', 'forms')    // /o/org-a/c/ccih/manage/forms
 * @example commissionHref('org-a', 'ccih', 'forms', formId)      // /o/org-a/c/ccih/forms/<formId>
 */
export function commissionHref(
  org: string,
  commission: string,
  ...segments: Array<string | number>
): string {
  const base = `/o/${encodeURIComponent(org)}/c/${encodeURIComponent(commission)}`
  return buildPath(base, segments)
}

/**
 * An organization's URL: `/o/{org}` plus any nested path segments. Backs the
 * org-admin area (`/o/{org}/manage/...`) and the org picker.
 *
 * @example orgHref('org-a')                       // /o/org-a
 * @example orgHref('org-a', 'manage')             // /o/org-a/manage
 * @example orgHref('org-a', 'manage', 'comissoes')// /o/org-a/manage/comissoes
 */
export function orgHref(
  org: string,
  ...segments: Array<string | number>
): string {
  const base = `/o/${encodeURIComponent(org)}`
  return buildPath(base, segments)
}

/**
 * The per-org NSP (Núcleo de Segurança do Paciente) console URL:
 * `/o/{org}/nsp` plus any nested path segments. Backs the standalone NSP area
 * (inbox / triagem / event / rca / capa / encaminhamentos / pacientes /
 * configuracoes / equipe), gated per-org on PQS membership or the
 * `nsp_coordinator` grant (NSP-per-org, ADR 0042).
 *
 * @example nspHref('org-a')                         // /o/org-a/nsp
 * @example nspHref('org-a', 'triagem')              // /o/org-a/nsp/triagem
 * @example nspHref('org-a', 'rca', rcaId)           // /o/org-a/nsp/rca/<rcaId>
 */
export function nspHref(
  org: string,
  ...segments: Array<string | number>
): string {
  const base = `/o/${encodeURIComponent(org)}/nsp`
  return buildPath(base, segments)
}

/**
 * Deep-link target for a S1·N notification (Phase 20, ADR 0076). Pure path
 * construction — the caller (`queries/notifications.ts`) resolves the
 * org/commission slugs and, for CAPA, the `capa_plan` id via batched `.in(...)`
 * lookups (`@/lib/notifications/routing-context`) before calling this; the
 * function itself does no I/O, matching the file's other helpers.
 *
 * Deviates from the plan doc's literal `notificationHref(entity_type,
 * entity_id, commission?)` sketch: `orgSlug` is required for the tenant-scoped
 * branches (every `/o/{org}/...` route needs it; the sketch omitted it).
 *
 * Per-branch routing:
 *   - `capa_action` → the STATIC global personal page `/conta/itens-de-acao`
 *     (BUG-N-001, ADR 0076 / PO Option A). A CAPA action can be assigned to a
 *     non-PQS user who has no access to the PQS-gated CAPA workspace, so the
 *     link must NOT depend on org/commission/capa-plan resolution — a static
 *     route dissolves the dead-'#' at the root (no per-recipient lookup can
 *     fail). `orgSlug`/`entityId` are unused here.
 *   - `action_item` → the SAME static personal page `/conta/itens-de-acao`
 *     (BE-6·N). A shared action-item reminder can reach an assignee who lacks
 *     workspace access; the personal "Meus itens de ação" list is universally
 *     reachable and is exactly where the notification should land. Same
 *     rationale as `capa_action`; `orgSlug`/`entityId` unused.
 *   - `response_section_signoff` → the commission's sign-off queue
 *     (`/manage/assinaturas`); no per-response detail page exists, so
 *     `entityId` is unused for this branch.
 *   - `meeting` → the meeting detail page.
 *
 * @example notificationHref({ entityType: 'meeting', entityId: meetingId, orgSlug: 'org-a', commissionSlug: 'ccih' })
 *   // /o/org-a/c/ccih/meetings/<meetingId>
 * @example notificationHref({ entityType: 'response_section_signoff', entityId: responseId, orgSlug: 'org-a', commissionSlug: 'ccih' })
 *   // /o/org-a/c/ccih/manage/assinaturas
 * @example notificationHref({ entityType: 'capa_action', entityId: actionId })
 *   // /conta/itens-de-acao
 * @example notificationHref({ entityType: 'action_item', entityId: itemId })
 *   // /conta/itens-de-acao
 */
export function notificationHref(params: {
  entityType: 'capa_action' | 'response_section_signoff' | 'meeting' | 'action_item'
  entityId: string
  /** Required for 'response_section_signoff' and 'meeting'; unused for the static 'capa_action'/'action_item' routes. */
  orgSlug?: string
  /** Required for 'response_section_signoff' and 'meeting'; unused for the static 'capa_action'/'action_item' routes. */
  commissionSlug?: string | null
}): string {
  const { entityType, entityId, orgSlug, commissionSlug } = params

  switch (entityType) {
    case 'capa_action':
    case 'action_item':
      // Static — reachable by ANY assignee regardless of workspace access
      // (BUG-N-001 / BE-6·N).
      return '/conta/itens-de-acao'
    case 'meeting':
      return orgSlug && commissionSlug
        ? commissionHref(orgSlug, commissionSlug, 'meetings', entityId)
        : '#'
    case 'response_section_signoff':
      return orgSlug && commissionSlug
        ? commissionHref(orgSlug, commissionSlug, 'manage', 'assinaturas')
        : '#'
    default:
      return '#'
  }
}
