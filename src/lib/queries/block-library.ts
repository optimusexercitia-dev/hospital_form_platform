import type { ItemType } from '@/lib/queries/forms'

/**
 * FF-4 (ADR 0092) — the commission block library: READ surface (Architecture
 * Rule 9). Ruling 7: browsing the library is a plain INVOKER read behind the
 * ruling-1 RLS perimeter (`form_block_library_select` — staff_admin /
 * commission-admin of the OWNING commission only, `library_rls_tenant_scoped`
 * pins it). Unlike the two writers in `src/lib/forms/actions.ts`, no DEFINER
 * door fronts a read whose perimeter already exists.
 *
 * ⚠ SERVER-ONLY once BE-2 lands: this module will value-import the server
 * Supabase client, so a Client Component that value-imports from here would
 * abort `next build` (BUG-FBE-005). Render the library browser from a Server
 * Component page, or wrap this in a server action the way `references.ts` is
 * wrapped by `searchReferenceCandidates` in `src/lib/responses/actions.ts`.
 *
 * ============================ CONTRACT-FIRST STUB ============================
 * BE-1 (ADR 0092). `form_block_library` does not exist until BE-2's migration
 * lands; `listBlockLibraryEntries` throws until then. The exported TYPES below
 * are the frozen contract `frontend`'s FE-1 (library browser) builds against —
 * see PROGRESS.md's FF-4 task table.
 * ===========================================================================
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

function notImplementedFF4(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (FF-4 BE-2 — contract stub, ADR 0092)`)
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
  return notImplementedFF4('listBlockLibraryEntries', commissionId)
}
