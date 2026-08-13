#!/usr/bin/env node
/**
 * Document-model reconciliation (DM2·S2, ADR 0114 plan step 1; lead FINDING 3:
 * a service-role ops SCRIPT — no UI, no route; DM5 step 4 names the
 * operational owner and cadence).
 *
 * Compares `public.file_objects` against the two document buckets IN BOTH
 * DIRECTIONS (the 2026-08-11 census had drift both ways):
 *   - MISSING: a row whose state promises bytes (uploaded → clean /
 *     unscanned_accepted) but no storage object exists.
 *   - ORPHAN: a storage object no row accounts for.
 *   - MISSING-DELETE: a disposed row whose object is still present.
 *   - UNDISPOSED (QA r1 MAJOR-2): a terminal-failure row (failed / abandoned /
 *     infected / rejected) still holding bytes. This phase made byte-holding
 *     `failed` (BUG-DM2-001 binds after a successful PUT) and `abandoned`
 *     (the expiry sweep's own product) REACHABLE; such objects have no
 *     serving path and nothing else ever asks for their disposition, so a
 *     reconciliation that ignores them retains PHI indefinitely under a
 *     CLEAN banner. Bytes present = reported; bytes absent = fine (an upload
 *     that never landed left nothing to dispose).
 *   - UNCLASSIFIED: a (upload_state, disposal_state) pair this classifier
 *     does not recognize. Reported AND deliberately NOT accounted, so its
 *     object also surfaces as ORPHAN — a future state fails loud in both
 *     directions instead of being silently swallowed (the pre-fix defect:
 *     `accounted.add` was unconditional, so unjudged rows hid their bytes).
 *   Indeterminate by design, accounted, never drift: `reserved` (in-flight
 *   PUT window — the sweep above has already expired lapsed sessions) and
 *   `disposal_pending` (the Storage delete legitimately precedes the
 *   completion door's absence check, so bytes may or may not exist in the
 *   window; a stuck pending row is disposal-job latency, not an accounting
 *   hole — the completion door is its owner).
 *
 * Invocation (documented per FINDING 3):
 *   node scripts/document-reconciliation.mjs
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from
 * .env.local when present). Exit 0 = clean, 1 = drift found, 2 = error.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}
const admin = createClient(url, key, { auth: { persistSession: false } })

const BUCKETS = ['documents-standard', 'documents-phi']
/** Paths are {org}/{file_object_id}/{generation}: walk exactly three levels. */
async function listBucketPaths(bucket) {
  const paths = new Set()
  const listDir = async (prefix) => {
    let offset = 0
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset })
      if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
      if (!data || data.length === 0) return []
      offset += data.length
      if (data.length < 1000) return data
    }
  }
  // level 1: orgs
  const orgs = await listDir('')
  for (const org of orgs) {
    if (org.id) continue // a file at the root would itself be drift; record it
    const files = await listDir(org.name)
    for (const fo of files) {
      const gens = await listDir(`${org.name}/${fo.name}`)
      for (const gen of gens) {
        paths.add(`${org.name}/${fo.name}/${gen.name}`)
      }
    }
  }
  return paths
}

const report = {
  missing: [],
  missingDelete: [],
  orphans: [],
  undisposed: [],
  unclassified: [],
  expiredSwept: 0,
  abandonedSwept: 0,
  counts: {},
  classCounts: {},
}

// BUG-DM2-003 (lead ruling): expiry MARKING lives here, not in the refusal
// path — finalize's refusal is predicate-based (expires_at < now()) and a
// refusal that must also persist state fights its own transaction. This sweep
// runs in its own transaction and makes the state columns truthful:
// lapsed reserved sessions -> 'expired'; their still-reserved files ->
// 'abandoned' (both legal machine transitions; reported, not silent).
{
  const { data: lapsed, error: lapsedError } = await admin
    .from('upload_sessions')
    .select('id, file_object_id')
    .eq('state', 'reserved')
    .lt('expires_at', new Date().toISOString())
  if (lapsedError) {
    console.error('expiry sweep read failed:', lapsedError.message)
    process.exit(2)
  }
  if (lapsed && lapsed.length > 0) {
    const { error: sErr } = await admin
      .from('upload_sessions')
      .update({ state: 'expired' })
      .in('id', lapsed.map((s) => s.id))
    if (sErr) {
      console.error('expiry sweep (sessions) failed:', sErr.message)
      process.exit(2)
    }
    report.expiredSwept = lapsed.length
    const { data: swept, error: fErr } = await admin
      .from('file_objects')
      .update({ upload_state: 'abandoned' })
      .in('id', lapsed.map((s) => s.file_object_id))
      .eq('upload_state', 'reserved')
      .select('id')
    if (fErr) {
      console.error('expiry sweep (files) failed:', fErr.message)
      process.exit(2)
    }
    report.abandonedSwept = swept?.length ?? 0
  }
}

const { data: rows, error: rowsError } = await admin
  .from('file_objects')
  .select('id, storage_bucket, storage_path, upload_state, disposal_state')
if (rowsError) {
  console.error('file_objects read failed:', rowsError.message)
  process.exit(2)
}

for (const bucket of BUCKETS) {
  let objectPaths
  try {
    objectPaths = await listBucketPaths(bucket)
  } catch (e) {
    console.error(String(e))
    process.exit(2)
  }
  const bucketRows = rows.filter((r) => r.storage_bucket === bucket)
  report.counts[bucket] = { objects: objectPaths.size, rows: bucketRows.length }

  const accounted = new Set()
  for (const r of bucketRows) {
    const hasObject = objectPaths.has(r.storage_path)
    // TOTAL first-match classification (MAJOR-2): every row lands in exactly
    // ONE class — the classCounts sum equals the row count by construction —
    // and only a JUDGED row may account for its path.
    let cls
    if (r.disposal_state === 'disposed') cls = 'absence-required'
    else if (r.disposal_state === 'disposal_pending') cls = 'indeterminate'
    else if (
      r.disposal_state === 'none' &&
      ['uploaded', 'verifying', 'scan_pending', 'clean', 'unscanned_accepted'].includes(
        r.upload_state,
      )
    )
      cls = 'bytes-required'
    else if (r.disposal_state === 'none' && r.upload_state === 'reserved') cls = 'indeterminate'
    else if (
      r.disposal_state === 'none' &&
      ['failed', 'abandoned', 'infected', 'rejected'].includes(r.upload_state)
    )
      cls = 'terminal'
    else cls = 'unclassified'

    report.classCounts[cls] = (report.classCounts[cls] ?? 0) + 1
    if (cls !== 'unclassified') accounted.add(r.storage_path)

    if (cls === 'bytes-required' && !hasObject)
      report.missing.push({ bucket, id: r.id, path: r.storage_path })
    if (cls === 'absence-required' && hasObject)
      report.missingDelete.push({ bucket, id: r.id, path: r.storage_path })
    if (cls === 'terminal' && hasObject)
      report.undisposed.push({
        bucket,
        id: r.id,
        path: r.storage_path,
        upload_state: r.upload_state,
      })
    if (cls === 'unclassified')
      report.unclassified.push({
        bucket,
        id: r.id,
        path: r.storage_path,
        upload_state: r.upload_state,
        disposal_state: r.disposal_state,
      })
  }
  for (const p of objectPaths) {
    if (!accounted.has(p)) report.orphans.push({ bucket, path: p })
  }
}

console.log(JSON.stringify(report, null, 2))
const drift =
  report.missing.length +
  report.missingDelete.length +
  report.orphans.length +
  report.undisposed.length +
  report.unclassified.length
console.log(drift === 0 ? 'RECONCILIATION CLEAN' : `DRIFT: ${drift} finding(s)`)
process.exit(drift === 0 ? 0 : 1)
