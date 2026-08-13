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
/** Paths are {org}/{file_object_id}/{generation}: walk exactly three levels.
 *
 * MINOR-1 (QA r1): pages are ACCUMULATED — the old loop returned only the
 * LAST page (a 1500-entry directory kept 500; exactly 1000 returned `[]`,
 * losing the whole directory), and offset paging without a stable sort can
 * skip or duplicate. Every lost object became a false MISSING and hid real
 * ORPHANs in the same page. Unreachable at the production census — proven
 * with a planted 1001-entry directory, not the census. */
async function listBucketPaths(bucket) {
  const paths = new Set()
  const listDir = async (prefix) => {
    const entries = []
    let offset = 0
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
      if (!data || data.length === 0) return entries
      entries.push(...data)
      if (data.length < 1000) return entries
      offset += data.length
    }
  }
  // level 1: orgs
  const orgs = await listDir('')
  for (const org of orgs) {
    if (org.id) {
      // A FILE at the bucket root (MINOR-2's ":59" — the old comment promised
      // to record it and `continue`d recording nothing): no legal row path has
      // one segment, so it can never be accounted — it is drift, reported.
      report.orphans.push({ bucket, path: org.name })
      continue
    }
    const files = await listDir(org.name)
    for (const fo of files) {
      if (fo.id) {
        // Same promise one level down: a FILE at {org}/x (two segments) is
        // unaccountable — the old walk silently listed it as a prefix.
        report.orphans.push({ bucket, path: `${org.name}/${fo.name}` })
        continue
      }
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
  verifyingSwept: 0,
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
    // MINOR-2 (QA r1): `.eq('state','reserved')` re-checks state IN the
    // UPDATE. The read above and this write are two REST calls; a finalize
    // whose transaction began before the expiry instant (its `now()` is the
    // txn start, so its predicate passed) can commit `consumed` in the
    // window, and the unguarded update stomped it to `expired` — a lost
    // update, reproduced with a real two-session interleaving before the
    // guard was added. `expiredSwept` now counts rows actually swept, not
    // rows read.
    const { data: sweptSessions, error: sErr } = await admin
      .from('upload_sessions')
      .update({ state: 'expired' })
      .in('id', lapsed.map((s) => s.id))
      .eq('state', 'reserved')
      .select('id')
    if (sErr) {
      console.error('expiry sweep (sessions) failed:', sErr.message)
      process.exit(2)
    }
    report.expiredSwept = sweptSessions?.length ?? 0
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

// MINOR-3 (QA r1): a file stuck in `verifying` was swept by NOTHING — the
// expiry sweep above only sees state='reserved' sessions, but a process that
// dies between finalize (file 'verifying', session 'consumed') and the
// verification door leaves a version with no binding and a reader staring at
// the eternal 'pending' BUG-DM2-001 was filed about, by a second route.
// After STUCK_VERIFYING_MINUTES (far beyond any live verifier's
// download+hash of a ≤25 MB object; 4x the 15-minute reservation TTL) the
// file is marked 'failed' — a legal verifying→failed arc — so the reader's
// 'pending' becomes the observable failure state and the bytes surface as
// UNDISPOSED drift below instead of hiding as bytes-required. Deliberately
// NOT auto-re-verified here: the verifier lives in
// src/lib/documents/actions.ts and a second implementation in an ops script
// is evaluator drift; a caller re-driving finalize on a consumed session
// re-enters verification legitimately (actions.test.ts T4) — the threshold
// is what reconciles the two: a live verifier is minutes old, this sweep
// needs an hour. The update re-checks state IN the statement (the MINOR-2
// lesson): a verification completing in the window is not stomped.
const STUCK_VERIFYING_MINUTES = 60
{
  const cutoff = new Date(Date.now() - STUCK_VERIFYING_MINUTES * 60_000).toISOString()
  const { data: stuck, error: stuckErr } = await admin
    .from('file_objects')
    .update({ upload_state: 'failed' })
    .eq('upload_state', 'verifying')
    .lt('uploaded_at', cutoff)
    .select('id')
  if (stuckErr) {
    console.error('stuck-verifying sweep failed:', stuckErr.message)
    process.exit(2)
  }
  report.verifyingSwept = stuck?.length ?? 0
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
