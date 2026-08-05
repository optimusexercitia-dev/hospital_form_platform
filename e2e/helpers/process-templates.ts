import type { APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Post-TV (ADR 0096 + Amendment 1) helpers for resolving a process template's
 * VERSION-grained data via raw PostgREST calls.
 *
 * `process_templates` is identity-only (`id`, `commission_id`, `created_by`,
 * `created_at`, `updated_at`) — `status`, `title`, `description`,
 * `collects_patient` and `case_type_id` all moved onto `process_template_versions`
 * (D1). Every spec that used to do `process_templates?status=eq.active` or
 * `...&title=eq.X` or `...&collects_patient=eq.X` in one PostgREST call now needs
 * TWO: candidate identity ids for the commission, then the matching version among
 * them. This file is the single place that shape lives, so the next schema move
 * touches one helper instead of every call site (12 of them, pre-TV).
 *
 * ⚠ Always resolve the PUBLISHED version explicitly. Once a template has an open
 * draft it carries TWO versions, and grabbing "the newest" or "the only match"
 * would silently pick the wrong one — a failure that reads like a product bug,
 * not a fixture bug. If a caller genuinely needs the draft, that's a distinct,
 * explicitly-named function (see {@link getDraftTemplateVersion}), never an
 * implicit fallback inside the published resolver.
 */

export interface RestAuth {
  baseUrl: string
  apikey: string
  bearerToken: string
}

export interface ResolvedTemplateVersion {
  /** The TEMPLATE IDENTITY id — what `create_case_from_template`'s `p_template_id` /
   * the create-case dialog's `templateId` select value take (both stay identity-grained;
   * `create_case_from_template` resolves the published version itself). */
  templateId: string
  /** The VERSION id — what version-grained RPCs (`set_template_collects_patient`,
   * `set_template_case_type`, `add_template_phase`, …) and
   * `cases.template_version_id` / provenance reads take. */
  versionId: string
  versionNumber: number
  title: string
}

/**
 * Service-role fixture helper: create a fresh template IDENTITY + v1 DRAFT
 * version directly (bypassing the `create_process_template` RPC — used by specs
 * that build an ad-hoc template as a fixture, e.g. to test phase-results or
 * recommend_when). Returns both ids: `templateId` (identity — for
 * `publish_process_template`'s `p_template_id`) and `versionId` (for every
 * version-grained authoring RPC's `p_template_version_id`: `add_template_phase`,
 * `add_template_narrative`, `set_process_outcomes`, `set_template_case_type`,
 * `set_template_collects_patient`, `set_template_phase_blocks`, custom-field
 * setters — ADR 0096 Design).
 */
export async function createDraftTemplateDirect(
  request: APIRequestContext,
  auth: RestAuth,
  opts: {
    commissionId: string
    title: string
    description?: string
    createdBy: string
  },
): Promise<ResolvedTemplateVersion> {
  const headers = {
    apikey: auth.apikey,
    Authorization: `Bearer ${auth.bearerToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  const identityResp = await request.post(`${auth.baseUrl}/rest/v1/process_templates`, {
    headers,
    data: { commission_id: opts.commissionId, created_by: opts.createdBy },
  })
  expect(
    identityResp.ok(),
    `createDraftTemplateDirect: identity insert failed: ${await identityResp.text()}`,
  ).toBeTruthy()
  const identityRows = (await identityResp.json()) as Array<{ id: string }>
  const templateId = identityRows[0].id

  const versionResp = await request.post(`${auth.baseUrl}/rest/v1/process_template_versions`, {
    headers,
    data: {
      template_id: templateId,
      version_number: 1,
      status: 'draft',
      title: opts.title,
      description: opts.description ?? null,
      created_by: opts.createdBy,
    },
  })
  expect(
    versionResp.ok(),
    `createDraftTemplateDirect: v1 insert failed: ${await versionResp.text()}`,
  ).toBeTruthy()
  const versionRows = (await versionResp.json()) as Array<{ id: string; version_number: number; title: string }>
  const v = versionRows[0]

  return { templateId, versionId: v.id, versionNumber: v.version_number, title: v.title }
}

async function candidateTemplateIds(
  request: APIRequestContext,
  auth: RestAuth,
  commissionId: string,
): Promise<string[]> {
  const headers = { apikey: auth.apikey, Authorization: `Bearer ${auth.bearerToken}` }
  const resp = await request.get(
    `${auth.baseUrl}/rest/v1/process_templates?commission_id=eq.${commissionId}&select=id`,
    { headers },
  )
  expect(resp.ok(), `process_templates lookup failed: ${await resp.text()}`).toBeTruthy()
  const rows = (await resp.json()) as Array<{ id: string }>
  return rows.map((r) => r.id)
}

/** Shared published-version lookup body — `titleFilter` is `null` for "any". */
async function publishedVersionLookup(
  request: APIRequestContext,
  auth: RestAuth,
  commissionId: string,
  titleFilter: string | null,
  opts: { collectsPatient?: boolean },
): Promise<ResolvedTemplateVersion> {
  const headers = { apikey: auth.apikey, Authorization: `Bearer ${auth.bearerToken}` }
  const ids = await candidateTemplateIds(request, auth, commissionId)
  expect(ids.length, `no process_templates rows for commission ${commissionId}`).toBeGreaterThan(0)

  const collectsFilter =
    opts.collectsPatient != null ? `&collects_patient=eq.${opts.collectsPatient}` : ''
  const verResp = await request.get(
    `${auth.baseUrl}/rest/v1/process_template_versions?status=eq.published&template_id=in.(${ids.join(',')})${collectsFilter}&select=id,template_id,version_number,title`,
    { headers },
  )
  expect(verResp.ok(), `process_template_versions lookup failed: ${await verResp.text()}`).toBeTruthy()
  const versions = (await verResp.json()) as Array<{
    id: string
    template_id: string
    version_number: number
    title: string
  }>
  const match = titleFilter != null ? versions.find((v) => v.title === titleFilter) : versions[0]
  expect(
    match,
    `no PUBLISHED template version found (commission=${commissionId}, title=${titleFilter ?? '<any>'}, collectsPatient=${opts.collectsPatient ?? '<any>'}, candidates=${versions.length})`,
  ).toBeTruthy()

  const m = match as NonNullable<typeof match>
  return { templateId: m.template_id, versionId: m.id, versionNumber: m.version_number, title: m.title }
}

/**
 * Resolve ONE PUBLISHED template version for a commission, by its EXACT `title`.
 *
 * `title` is REQUIRED. `process_template_versions` carries no ordering guarantee,
 * and once a commission has MORE THAN ONE published template — routine once the
 * TV spec runs, since it publishes several fresh templates into the shared CCIH
 * commission over its lifetime — an untitled "pick the first row" is an ARBITRARY
 * pick, not a deterministic one. That used to be this function's own signature
 * (title optional, `versions[0]` on omission): it silently bound nine unrelated
 * specs to "whichever template happens to sort first", which stayed invisible
 * for as long as CCIH had only one published template to find. Once this spec
 * started publishing more, some of those nine started resolving to a DIFFERENT
 * template than the one they meant.
 *
 * If a caller genuinely does not care WHICH published template it gets — only
 * that one exists matching some other predicate — use
 * {@link getAnyPublishedTemplateVersion} instead. That function makes the same
 * arbitrary pick, but its NAME says so, rather than leaving it implicit in an
 * omitted argument.
 */
export async function getPublishedTemplateVersion(
  request: APIRequestContext,
  auth: RestAuth,
  commissionId: string,
  title: string,
  opts: { collectsPatient?: boolean } = {},
): Promise<ResolvedTemplateVersion> {
  return publishedVersionLookup(request, auth, commissionId, title, opts)
}

/**
 * Resolve ANY ONE published template version matching `opts` — for callers that
 * deliberately do not care WHICH template, only that a match exists (e.g. "a
 * template that does NOT collect patient data", to prove a UI affordance
 * disappears for it). The pick among multiple matches is ARBITRARY (no `order`
 * clause) — see {@link getPublishedTemplateVersion}'s docs for why that used to
 * be a silent trap and is now this function's explicit, load-bearing name.
 */
export async function getAnyPublishedTemplateVersion(
  request: APIRequestContext,
  auth: RestAuth,
  commissionId: string,
  opts: { collectsPatient?: boolean } = {},
): Promise<ResolvedTemplateVersion> {
  return publishedVersionLookup(request, auth, commissionId, null, opts)
}

/**
 * Resolve ONE OPEN DRAFT version for a commission (optionally narrowed by title).
 * Distinct function, never a fallback branch of {@link getPublishedTemplateVersion} —
 * see the file-header warning.
 */
export async function getDraftTemplateVersion(
  request: APIRequestContext,
  auth: RestAuth,
  commissionId: string,
  opts: { title?: string } = {},
): Promise<ResolvedTemplateVersion> {
  const headers = { apikey: auth.apikey, Authorization: `Bearer ${auth.bearerToken}` }
  const ids = await candidateTemplateIds(request, auth, commissionId)
  expect(ids.length, `no process_templates rows for commission ${commissionId}`).toBeGreaterThan(0)

  const verResp = await request.get(
    `${auth.baseUrl}/rest/v1/process_template_versions?status=eq.draft&template_id=in.(${ids.join(',')})&select=id,template_id,version_number,title`,
    { headers },
  )
  expect(verResp.ok(), `process_template_versions lookup failed: ${await verResp.text()}`).toBeTruthy()
  const versions = (await verResp.json()) as Array<{
    id: string
    template_id: string
    version_number: number
    title: string
  }>
  const match = opts.title ? versions.find((v) => v.title === opts.title) : versions[0]
  expect(
    match,
    `no DRAFT template version found (commission=${commissionId}, title=${opts.title ?? '<any>'})`,
  ).toBeTruthy()

  const m = match as NonNullable<typeof match>
  return { templateId: m.template_id, versionId: m.id, versionNumber: m.version_number, title: m.title }
}
