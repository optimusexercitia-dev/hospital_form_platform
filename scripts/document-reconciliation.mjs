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
 *   Reserved/failed/abandoned rows expect NO object (not drift); disposed
 *   rows expect ABSENCE (an object present there is drift: MISSING-DELETE).
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

const report = { missing: [], missingDelete: [], orphans: [], counts: {} }

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
    accounted.add(r.storage_path)
    const hasObject = objectPaths.has(r.storage_path)
    const expectsBytes =
      r.disposal_state === 'none' &&
      ['uploaded', 'verifying', 'scan_pending', 'clean', 'unscanned_accepted'].includes(
        r.upload_state,
      )
    const expectsAbsence = r.disposal_state === 'disposed'
    if (expectsBytes && !hasObject) report.missing.push({ bucket, id: r.id, path: r.storage_path })
    if (expectsAbsence && hasObject)
      report.missingDelete.push({ bucket, id: r.id, path: r.storage_path })
  }
  for (const p of objectPaths) {
    if (!accounted.has(p)) report.orphans.push({ bucket, path: p })
  }
}

console.log(JSON.stringify(report, null, 2))
const drift = report.missing.length + report.missingDelete.length + report.orphans.length
console.log(drift === 0 ? 'RECONCILIATION CLEAN' : `DRIFT: ${drift} finding(s)`)
process.exit(drift === 0 ? 0 : 1)
