import { createClient } from '@/lib/supabase/server'

/**
 * Cases-Extras feature-flag gate for the R1/R3/R4 server actions whose writes
 * are DIRECT table operations (documents/events, tags, action items) rather than
 * RPCs that self-gate like the R2 status RPCs. Calls the SECURITY DEFINER
 * `cases_extras_enabled` read so the gate is authoritative server-side (the flag
 * lives in the locked-down `app` schema). Returns `false` on any error (fail
 * closed — a dark feature stays dark).
 */
export async function casesExtrasEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cases_extras_enabled')
  if (error) return false
  return data === true
}
