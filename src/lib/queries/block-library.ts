import { createClient } from '@/lib/supabase/server'
import type { ItemType } from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'

/**
 * FF-4 (ADR 0092) — the commission block library: READ surface (Architecture
 * Rule 9). Ruling 7: browsing the library is a plain INVOKER read behind the
 * ruling-1 RLS perimeter (`form_block_library_select` — staff_admin /
 * commission-admin of the OWNING commission only, `library_rls_tenant_scoped`
 * pins it). Unlike the two writers in `src/lib/forms/actions.ts`, no DEFINER
 * door fronts a read whose perimeter already exists.
 *
 * ⚠ SERVER-ONLY: this module value-imports the server Supabase client, so a
 * Client Component that value-imports from here aborts `next build`
 * (BUG-FBE-005). Render the library browser from a Server Component page, or
 * wrap this in a server action the way `references.ts` is wrapped by
 * `searchReferenceCandidates` in `src/lib/responses/actions.ts`.
 */

/**
 * Denormalized provenance, captured at SAVE time (ADR 0092 ruling 2) — NOT a
 * foreign key, to `form_versions` or to `profiles`. Renaming the saving
 * profile, or editing/republishing/deleting the source form, never changes an
 * existing entry: the whole point of ruling 2 is that a snapshot must not
 * become a live link, and "any FK present will eventually be joined" is the
 * ADR's own stated reason for leaving every one of these four fields un-keyed.
 */
export interface BlockLibraryProvenance {
  /** The profile id of the staff_admin who saved this entry — carried for
   *  reference only, never joined back to `profiles` from this read path
   *  (that join is exactly the temptation ruling 2 removes). */
  savedById: string
  /** The saver's display name, captured at save time. */
  savedByName: string
  savedAt: string
  /** The title of the form the block was copied from, captured at save time. */
  sourceFormTitle: string
  /** The `form_versions.version_number` of the source version, captured at
   *  save time. Never re-resolved against the live version, which may since
   *  have been edited, republished, or deleted. */
  sourceVersionNumber: number
}

/**
 * Enough to render a library entry's card WITHOUT opening it — the `snapshot`
 * jsonb itself stays unfetched on the list path.
 */
export interface BlockLibrarySummary {
  /** Every item in the snapshot subtree — the root item plus every
   *  descendant (e.g. a `repeating_group` with 3 children counts as 4). */
  itemCount: number
  /** The root item's type — what the entry fundamentally IS ("Grupo",
   *  "Múltipla escolha", …), for the browser's primary badge. */
  rootItemType: ItemType
  /** Distinct item types present anywhere in the subtree, root included, for
   *  a compact type-mix indicator (e.g. a group containing a matrix and two
   *  choice items). */
  itemTypes: ItemType[]
}

export interface BlockLibraryEntry {
  id: string
  commissionId: string
  name: string
  description: string | null
  provenance: BlockLibraryProvenance
  summary: BlockLibrarySummary
}

/** Raw `form_block_library` row shape, before camel-casing — shared by the
 *  list read here and by `saveBlockToLibrary`'s RPC response in
 *  `src/lib/forms/actions.ts` (the door RETURNS a full row). */
export interface BlockLibraryRow {
  id: string
  commission_id: string
  name: string
  description: string | null
  snapshot: Json
  saved_by_id: string
  saved_by_name: string
  saved_at: string
  source_form_title: string
  source_version_number: number
}

/**
 * One entry of the flat snapshot array (`save_block_to_library`'s shape —
 * see the migration comment in `20260903000200_ff4_save_block_to_library.sql`).
 * Narrowed just enough to derive {@link BlockLibrarySummary}; the full shape
 * (options/matrix axes/validations) is `insert_block_from_library`'s concern,
 * never read back out on the TS side.
 */
interface SnapshotEntry {
  is_child?: boolean
  item_type?: string
}

/**
 * `form_block_library.snapshot` -> {@link BlockLibrarySummary}. Defensive
 * against a malformed/empty array (never expected from the door, but this is
 * a READ path and must not throw on a row it didn't write) — an empty or
 * unrecognized snapshot summarizes as zero items with `'group'` as a
 * harmless placeholder root type, never a crash.
 */
function toSummary(snapshot: Json): BlockLibrarySummary {
  const entries: SnapshotEntry[] = Array.isArray(snapshot)
    ? (snapshot as unknown as SnapshotEntry[])
    : []
  const itemTypes = new Set<string>()
  let rootItemType: string | undefined
  for (const entry of entries) {
    if (typeof entry?.item_type !== 'string') continue
    itemTypes.add(entry.item_type)
    if (entry.is_child !== true) rootItemType = entry.item_type
  }
  return {
    itemCount: entries.length,
    rootItemType: (rootItemType ?? 'group') as ItemType,
    itemTypes: Array.from(itemTypes) as ItemType[],
  }
}

/** {@link BlockLibraryRow} -> {@link BlockLibraryEntry}. Exported so
 *  `saveBlockToLibrary` (`src/lib/forms/actions.ts`) maps the DEFINER door's
 *  returned row through the SAME function this list path uses — one mapper,
 *  not two definitions of "what a library entry is" that could drift. */
export function toBlockLibraryEntry(row: BlockLibraryRow): BlockLibraryEntry {
  return {
    id: row.id,
    commissionId: row.commission_id,
    name: row.name,
    description: row.description,
    provenance: {
      savedById: row.saved_by_id,
      savedByName: row.saved_by_name,
      savedAt: row.saved_at,
      sourceFormTitle: row.source_form_title,
      sourceVersionNumber: row.source_version_number,
    },
    summary: toSummary(row.snapshot),
  }
}

/**
 * The commission's saved blocks, newest-saved first. Empty (never an error)
 * when the caller is not a staff_admin/commission-admin of `commissionId`
 * (RLS — ruling 1) or `power_authoring` is off for the commission — both read
 * as "no rows" from here, the same flag-dark convention `listReferenceCandidates`
 * documents in `references.ts`.
 */
export async function listBlockLibraryEntries(
  commissionId: string,
): Promise<BlockLibraryEntry[]> {
  if (!commissionId) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('form_block_library')
    .select(
      'id, commission_id, name, description, snapshot, saved_by_id, ' +
        'saved_by_name, saved_at, source_form_title, source_version_number',
    )
    .eq('commission_id', commissionId)
    .order('saved_at', { ascending: false })
    .returns<BlockLibraryRow[]>()

  return (data ?? []).map(toBlockLibraryEntry)
}
