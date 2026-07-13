import { createClient } from '@/lib/supabase/server'

/**
 * Batched lookup resolving a notification's `commission_id` into the
 * org/commission slugs `notificationHref` (`@/lib/routing`) needs to build a
 * signoff/meeting deep link. Split out of `queries/notifications.ts`
 * (Architecture Rule 9 — the "batched keyset-safe .in(...) lookup" idiom,
 * precedent: SUP's `resolveSupersessionBadge`) so `listNotifications` stays a
 * single readable function: fetch rows, resolve slugs in one batched round
 * trip, join in memory, compute `href` per row via the pure `notificationHref`.
 *
 * CAPA notifications need NO lookup here — they route to the static personal
 * page `/conta/itens-de-acao` (BUG-N-001, ADR 0076); the former
 * `resolveCapaHrefContext` (capa_plan → hospital → org join) was removed when
 * the href retargeted off the PQS-gated CAPA workspace.
 */

interface CommissionSlugRow {
  id: string
  slug: string
  organizations: { slug: string } | null
}

/** commission_id -> { orgSlug, commissionSlug }, for signoff/meeting notifications. */
export async function resolveCommissionSlugs(
  commissionIds: string[],
): Promise<Map<string, { orgSlug: string; commissionSlug: string }>> {
  const out = new Map<string, { orgSlug: string; commissionSlug: string }>()
  const ids = [...new Set(commissionIds)]
  if (ids.length === 0) return out

  const supabase = await createClient()
  const { data } = await supabase
    .from('commissions')
    .select('id, slug, organizations:organization_id(slug)')
    .in('id', ids)
    .returns<CommissionSlugRow[]>()

  for (const row of data ?? []) {
    if (row.organizations?.slug) {
      out.set(row.id, { orgSlug: row.organizations.slug, commissionSlug: row.slug })
    }
  }
  return out
}
