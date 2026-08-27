import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'

type PublicFunctions = Database['public']['Functions']

/**
 * Every PostgreSQL function argument accepts NULL. `supabase gen types` does not model
 * that: it emits `p_x?: T` for an argument carrying a DEFAULT and `p_x: T` for one
 * without, and **never** `| null` for either. So a door call that legitimately passes an
 * explicit NULL fails `tsc` against types that are under-expressive rather than wrong
 * about anything the database enforces.
 *
 * The widening lives here, once, instead of in the call sites, because the two shapes
 * `gen:types` produces need OPPOSITE workarounds and nothing at a call site distinguishes
 * them:
 *
 * - argument WITH a `DEFAULT NULL` (`p_cpf?: string`) — omitting the key falls through to
 *   that default, so `?? undefined` happens to be equivalent **today**;
 * - argument with NO default (`p_id: string`) — omitting the key leaves PostgREST unable
 *   to resolve the overload. That is a **PGRST202 at runtime with `tsc` green**, which is
 *   the failure mode this file exists to make unreachable.
 *
 * ⚠ So this admits `null`; it never converts a `null` into an absent key. NULL and OMITTED
 * are different wire values, and only NULL means the same thing at both shapes.
 *
 * ⛔ Do not "fix" this by hand-editing `database.ts` — Rule 8 regenerates that file after
 * every migration, which would silently revert the patch.
 */
type NullableArgs<A> = { [K in keyof A]: A[K] | null }

/**
 * Call a database function whose arguments include an explicit NULL, with the argument
 * NAMES and the surrounding value types still fully checked against the generated types.
 *
 * Drop-in for `client.rpc(fn, args)` — the only difference is that `null` is accepted
 * wherever SQL accepts it.
 */
export function callDoor<N extends keyof PublicFunctions & string>(
  client: SupabaseClient<Database>,
  fn: N,
  args: NullableArgs<PublicFunctions[N]['Args']>,
) {
  return client.rpc(fn, args as PublicFunctions[N]['Args'])
}
