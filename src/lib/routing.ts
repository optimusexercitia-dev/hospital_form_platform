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
