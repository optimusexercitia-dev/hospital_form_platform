#!/usr/bin/env node
/**
 * DM5 S0 — manifest-first storage retirement tool (ADR 0120 **D9**).
 *
 * ## Why this exists
 *
 * The parent plan's retirement method — "prove zero objects via the Storage API,
 * then delete the bucket" — is WITHDRAWN by D9 because it cannot work. The
 * Storage API lists *from* `storage.objects`; a DB reset truncates that table;
 * the bytes survive it. Measured at DM5 step 0 on the local stack:
 * `storage.objects` = 0 rows against 699 objects / 7,023,687 bytes on the
 * volume, 198 of them PHI-tier, with `list` returning `[]` for all 12 buckets.
 * Run after a reset, the old method proves emptiness against a truncated table,
 * deletes nothing, and reports success while PHI bytes persist.
 *
 * ⭐ The fix is not a better query — no query against the metadata table can see
 * this. The fix is an ORDERING INVARIANT: capture the authoritative key list
 * BEFORE any destructive step, delete BY KEY, and assert
 * `deleted_count == manifest_count`. That turns an unfalsifiable negative
 * ("nothing is there") into a positive count comparison, where a truncated
 * table yields a visibly ZERO-LENGTH MANIFEST instead of a silent pass.
 *
 * ## Gate vs. proof (D9, binding — do not blur these)
 *
 *   GATE  — `capture` / `verify` / `delete` use the **Storage API only**. No
 *           docker, no SQL, no filesystem. Backend-agnostic, so it transfers to
 *           Supabase Cloud unchanged.
 *   PROOF — `walk` reads the storage backend's volume directly and is the only
 *           thing here that can SEE an orphan. It depends on
 *           `STORAGE_BACKEND=file` and is therefore LOCAL-ONLY.
 *
 * ⚠ RESIDUAL, UNVERIFIED — do not let this read as solved. On Cloud there may be
 * NO customer-accessible tool that can see an orphan: the dashboard, the CLI and
 * supabase-js all list from `storage.objects`, and the S3-protocol endpoint is
 * UNPROBED (the local probe returned HTTP 400 — it wants SigV4, not a Bearer
 * token, and the standing directive forbids touching the remote project). The
 * gate is what transfers; the proof is not. Cloud orphaning requires a
 * destructive metadata truncation, whose only in-repo path is
 * `npm run db:reset:linked`.
 *
 * ## Commands
 *
 *   capture   Enumerate authoritative keys per bucket (API) and write a
 *             manifest. Cross-checks against the local volume when available and
 *             records a per-bucket verdict. NON-DESTRUCTIVE.
 *   verify    Re-enumerate and diff against a manifest. NON-DESTRUCTIVE.
 *   walk      Local volume census only (the proof harness). NON-DESTRUCTIVE.
 *   delete    Delete by key from a manifest, then assert deleted == manifest
 *             count. DRY-RUN unless `--execute`. S0 never runs this with
 *             `--execute`; S4 does.
 *   selftest  Prove the tool ABLE TO FAIL before anything trusts it — a known
 *             orphan it must find, and a deliberate mismatch it must refuse.
 *             Creates and destroys its OWN scratch bucket; touches no project
 *             data. Requires local docker (it must manufacture the orphan).
 *
 * Exit codes: 0 clean · 1 drift/mismatch (a verdict, not a crash) · 2 error.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from
 * `.env.local` when present), same contract as
 * `scripts/document-reconciliation.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// The DM5 retirement manifest — EIGHT buckets (ADR 0120 D8).
// `meeting-attachments` is NOT here: it does not exist, retired by
// 20260921000300 and already pinned by supabase/tests/325_legacy_bucket_policy_pin.sql.
// The parent plan's ninth entry is stale.
// `form-assets` and `meeting-audio` are OUT OF SCOPE (ADR 0114 D13) but are
// still CENSUSED by `walk`, because they share the volume and any orphan
// cleanup would touch them — a deliberate inclusion, not an oversight.
// ---------------------------------------------------------------------------
const RETIREMENT_BUCKETS = [
  'attachments',
  'attachments-phi',
  'case-documents',
  'interview-attachments',
  'nsp-evidence',
  'referral-attachments',
  'controlled-documents',
  'printed-documents',
]
const OUT_OF_SCOPE_BUCKETS = ['form-assets', 'meeting-audio']
const CORE_BUCKETS = ['documents-standard', 'documents-phi']
const ALL_KNOWN_BUCKETS = [...RETIREMENT_BUCKETS, ...CORE_BUCKETS, ...OUT_OF_SCOPE_BUCKETS]

/** PHI-tier locations, for the report's PHI subtotal. `printed-documents` is
 *  mixed: `pd_storage_path_derived` puts PHI prints under `phi/` and the rest
 *  under `std/`, so it is classified by PREFIX, not by bucket. */
const PHI_BUCKETS = new Set(['attachments-phi', 'documents-phi'])
const PHI_PREFIXES = [{ bucket: 'printed-documents', prefix: 'phi/' }]

const DEFAULT_MANIFEST = 'supabase/manifests/dm5-retirement-baseline.json'
const SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

function adminClient() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(2)
  }
  return { admin: createClient(url, key, { auth: { persistSession: false } }), url }
}

// ---------------------------------------------------------------------------
// GATE half — Storage API only. Portable to Cloud.
// ---------------------------------------------------------------------------

/**
 * Depth-agnostic recursive key enumeration.
 *
 * `document-reconciliation.mjs` walks exactly three levels because the core
 * buckets have a fixed `{org}/{file_object_id}/{generation}` shape. The
 * retirement buckets do NOT share one shape — measured at step 0:
 * `attachments/meeting/<id>/<uuid>.pdf` (4), `controlled-documents/<org>/<doc>/<file>.pdf` (4),
 * `printed-documents/std/<id>.pdf` (2), `documents-phi/<org>/<a>/<b>` (3).
 * A fixed-depth walk would silently return an EMPTY set for every bucket whose
 * depth it guessed wrong — the exact "proves emptiness against nothing" defect
 * this tool exists to kill. So: recurse until entries stop being prefixes.
 *
 * Pagination follows the MINOR-1 lesson from the sibling script: ACCUMULATE
 * pages under a stable sort. Returning only the last page loses whole
 * directories, and every lost object becomes a false "already empty".
 */
async function listBucketKeys(admin, bucket, { maxDepth = 12 } = {}) {
  const keys = []
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
  const recurse = async (prefix, depth) => {
    if (depth > maxDepth) throw new Error(`${bucket}: exceeded maxDepth ${maxDepth} at "${prefix}"`)
    for (const entry of await listDir(prefix)) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name
      // An entry with an `id` is an OBJECT; without one it is a synthetic
      // prefix row. This is the same discriminator the sibling script uses.
      if (entry.id) keys.push(full)
      else await recurse(full, depth + 1)
    }
  }
  await recurse('', 0)
  return keys.sort()
}

async function bucketExists(admin, bucket) {
  const { error } = await admin.storage.getBucket(bucket)
  return !error
}

// ---------------------------------------------------------------------------
// PROOF half — local volume walk. LOCAL-ONLY (STORAGE_BACKEND=file).
// ---------------------------------------------------------------------------

function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Locate the storage container and its object root.
 *
 * Nothing here is hardcoded: the container is found by name pattern and the
 * root is DERIVED from the container's own env, then CONFIRMED by checking that
 * its children intersect the known bucket list. A path guessed from a comment
 * is the "a comment is an assertion that goes stale silently" class; a path
 * confirmed against the bucket names cannot drift silently.
 */
function locateVolume() {
  let name
  try {
    name = docker(['ps', '--filter', 'name=supabase_storage', '--format', '{{.Names}}'])
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)[0]
  } catch {
    return { available: false, reason: 'docker is not available on PATH' }
  }
  if (!name) return { available: false, reason: 'no running supabase_storage container' }

  let env
  try {
    env = docker(['inspect', name, '--format', '{{range .Config.Env}}{{println .}}{{end}}'])
  } catch (e) {
    return { available: false, reason: `docker inspect failed: ${String(e)}` }
  }
  const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) ?? [])[1]
  const backend = get('STORAGE_BACKEND')
  if (backend !== 'file') {
    // The honest Cloud answer. Not a failure — an UNVERIFIED.
    return { available: false, reason: `STORAGE_BACKEND=${backend ?? '(unset)'}, not 'file'` }
  }
  const base = get('FILE_STORAGE_BACKEND_PATH') ?? '/mnt'
  const s3 = get('GLOBAL_S3_BUCKET') ?? 'stub'

  // Confirm the root by intersecting its children with the known bucket names,
  // rather than trusting a layout convention that has changed between versions.
  for (const candidate of [`${base}/${s3}/${s3}`, `${base}/${s3}`, base]) {
    let children
    try {
      children = docker(['exec', name, 'sh', '-c', `ls -1 ${candidate} 2>/dev/null`])
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    } catch {
      continue
    }
    if (children.some((c) => ALL_KNOWN_BUCKETS.includes(c))) {
      return { available: true, container: name, root: candidate, buckets: children }
    }
  }
  return { available: false, reason: `no object root under ${base} contained a known bucket name` }
}

/**
 * Per-bucket census of what is ACTUALLY on disk.
 *
 * The file backend stores each OBJECT KEY as a DIRECTORY containing one file
 * per version, so the object key is the leaf file's path minus its last
 * segment. Counting files instead of keys would over-report on any versioned
 * object; step 0 measured keys == files (1 version each), but that is a
 * property of the current data, not a guarantee.
 */
function volumeCensus(loc, buckets) {
  const out = {}
  for (const b of buckets) {
    let raw
    try {
      // ⭐ The absence marker is load-bearing, and selftest C5 is why it exists.
      // The first version ran `if [ -d ] ; then find ... ; fi`, which emits
      // EMPTY OUTPUT for a directory that does not exist AND for one that is
      // empty — so the walk reported `present: true, files: 0` for a bucket that
      // was never on the volume. A detector that returns the same answer for
      // "nothing here" and "no such place" cannot be trusted to mean either, and
      // it would have made every already-retired bucket read as verified-empty.
      // Caught by C5 on the harness's own second run, not by review.
      raw = docker([
        'exec',
        loc.container,
        'sh',
        '-c',
        `cd ${loc.root} && if [ -d "${b}" ]; then find "${b}" -type f -exec sh -c 'printf "%s|" "$1"; wc -c < "$1"' _ {} \\; ; else echo __ABSENT__; fi`,
      ])
    } catch (e) {
      out[b] = { present: false, error: String(e), keys: [], files: 0, bytes: 0 }
      continue
    }
    if (raw.includes('__ABSENT__')) {
      out[b] = { present: false, keys: [], files: 0, bytes: 0 }
      continue
    }
    const keys = new Set()
    let files = 0
    let bytes = 0
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t) continue
      const idx = t.lastIndexOf('|')
      if (idx < 0) continue
      const path = t.slice(0, idx)
      const size = Number.parseInt(t.slice(idx + 1), 10)
      files += 1
      bytes += Number.isFinite(size) ? size : 0
      // strip the leading "<bucket>/" and the trailing version filename
      const rel = path.startsWith(`${b}/`) ? path.slice(b.length + 1) : path
      const cut = rel.lastIndexOf('/')
      keys.add(cut < 0 ? rel : rel.slice(0, cut))
    }
    out[b] = { present: true, keys: [...keys].sort(), files, bytes }
  }
  return out
}

function isPhi(bucket, key) {
  if (PHI_BUCKETS.has(bucket)) return true
  return PHI_PREFIXES.some((p) => p.bucket === bucket && key.startsWith(p.prefix))
}

// ---------------------------------------------------------------------------
// verdicts
// ---------------------------------------------------------------------------

/**
 * Per-bucket verdict combining the gate (API) and the proof (volume).
 *
 * ⭐ The load-bearing case is ORPHANED_BYTES with `apiKeys === 0`: that is the
 * exact state a reset leaves, and the state in which the WITHDRAWN method
 * reported success. It must be loud and it must be a non-zero exit.
 */
function verdictFor({ exists, apiKeys, proof }) {
  if (!exists) return 'BUCKET_ABSENT'
  if (!proof || !proof.present) {
    return proof === null ? 'UNVERIFIED_NO_LOCAL_PROOF' : 'CONSISTENT_EMPTY'
  }
  const apiSet = new Set(apiKeys)
  const volSet = new Set(proof.keys)
  const onlyVolume = proof.keys.filter((k) => !apiSet.has(k))
  const onlyApi = apiKeys.filter((k) => !volSet.has(k))
  if (onlyVolume.length && onlyApi.length) return 'DIVERGED_BOTH_WAYS'
  if (onlyVolume.length) return 'ORPHANED_BYTES'
  if (onlyApi.length) return 'MISSING_BYTES'
  return apiKeys.length === 0 ? 'CONSISTENT_EMPTY' : 'CONSISTENT'
}

const CLEAN_VERDICTS = new Set(['CONSISTENT', 'CONSISTENT_EMPTY', 'BUCKET_ABSENT'])

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

async function cmdCapture(argv) {
  const { admin, url } = adminClient()
  const outPath = argFlag(argv, '--out') ?? DEFAULT_MANIFEST
  const scope = argFlag(argv, '--buckets')
  const buckets = scope ? scope.split(',').map((s) => s.trim()) : RETIREMENT_BUCKETS
  const allowOrphans = argv.includes('--allow-orphans')

  const loc = locateVolume()
  const proof = loc.available
    ? volumeCensus(loc, [...new Set([...buckets, ...CORE_BUCKETS, ...OUT_OF_SCOPE_BUCKETS])])
    : null

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    supabaseUrl: url,
    gate: 'storage-api',
    localProof: loc.available
      ? { available: true, container: loc.container, root: loc.root }
      : { available: false, reason: loc.reason, note: 'UNVERIFIED — see the header residual' },
    buckets: {},
    totals: { keys: 0, orphanKeys: 0, orphanFiles: 0, orphanBytes: 0, phiOrphanKeys: 0 },
    residuals: [],
  }

  for (const b of buckets) {
    const exists = await bucketExists(admin, b)
    const apiKeys = exists ? await listBucketKeys(admin, b) : []
    const p = proof ? (proof[b] ?? { present: false, keys: [], files: 0, bytes: 0 }) : null
    const verdict = verdictFor({ exists, apiKeys, proof: p })
    const apiSet = new Set(apiKeys)
    const orphanKeys = p && p.present ? p.keys.filter((k) => !apiSet.has(k)) : []
    manifest.buckets[b] = {
      exists,
      keyCount: apiKeys.length,
      keys: apiKeys,
      verdict,
      proof: p
        ? { absent: !p.present, files: p.files, bytes: p.bytes, keyCount: p.keys.length, orphanKeys }
        : { unverified: true },
    }
    manifest.totals.keys += apiKeys.length
    manifest.totals.orphanKeys += orphanKeys.length
    manifest.totals.phiOrphanKeys += orphanKeys.filter((k) => isPhi(b, k)).length
    if (p && p.present && orphanKeys.length) {
      manifest.totals.orphanFiles += p.files
      manifest.totals.orphanBytes += p.bytes
    }
  }

  // The out-of-scope buckets are censused but never captured for deletion.
  if (proof) {
    manifest.outOfScopeCensus = {}
    for (const b of [...CORE_BUCKETS, ...OUT_OF_SCOPE_BUCKETS]) {
      const p = proof[b]
      if (p?.present) manifest.outOfScopeCensus[b] = { files: p.files, bytes: p.bytes, keyCount: p.keys.length }
    }
  }

  if (!loc.available) {
    manifest.residuals.push(
      `LOCAL PROOF UNAVAILABLE (${loc.reason}). Orphaned bytes CANNOT be detected from here. ` +
        'On Cloud this is expected and UNVERIFIED: dashboard, CLI and supabase-js all list from ' +
        'storage.objects, and the S3 endpoint is unprobed. The count-comparison gate still holds.',
    )
  }
  // ⭐ The degenerate case, stated in the artifact rather than left to be
  // inferred. A manifest of zero keys is exactly what a truncated
  // `storage.objects` produces, and D9's whole point is that this should be a
  // VISIBLY WRONG ARTIFACT rather than a silent pass. It is legitimate only
  // when the volume also shows nothing — otherwise the capture happened AFTER
  // the destructive step it was supposed to precede, and it authorizes the
  // deletion of nothing.
  if (manifest.totals.keys === 0 && manifest.totals.orphanKeys > 0) {
    manifest.residuals.push(
      'DEGENERATE BASELINE: zero API-visible keys across every bucket while bytes exist on the volume. ' +
        'This is the post-reset state, not a retired one. This manifest authorizes the deletion of NOTHING ' +
        'and MUST NOT be reused as S4 input — re-capture on a stack whose metadata has not been truncated.',
    )
  }
  if (manifest.totals.orphanKeys > 0) {
    manifest.residuals.push(
      `${manifest.totals.orphanKeys} orphaned object key(s) present on the volume with NO metadata row ` +
        `(${manifest.totals.phiOrphanKeys} PHI-tier). These are INVISIBLE to the Storage API and cannot ` +
        'be deleted by key. They are a data-at-rest / disposal-assertion problem (Rule 12, LGPD), not a ' +
        'live exposure — every Storage read path resolves metadata first, so they are unservable.',
    )
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  printManifestSummary(manifest)
  console.log(`\nmanifest written: ${outPath}`)

  const dirty = Object.values(manifest.buckets).filter((v) => !CLEAN_VERDICTS.has(v.verdict))
  if (dirty.length && !allowOrphans) {
    console.log(
      `\nCAPTURE NOT CLEAN: ${dirty.length} bucket(s) disagree between the API and the volume. ` +
        'Re-run with --allow-orphans to record this deliberately as a baseline.',
    )
    process.exitCode = 1
    return
  }
  console.log(dirty.length ? '\nBASELINE RECORDED (orphans acknowledged via --allow-orphans)' : '\nCAPTURE CLEAN')
  process.exitCode = 0
}

function printManifestSummary(m) {
  console.log(`captured: ${m.capturedAt}   gate: ${m.gate}   local proof: ${m.localProof.available}`)
  console.log('')
  console.log('bucket                    exists  api_keys  vol_keys  vol_files    vol_bytes  verdict')
  for (const [b, v] of Object.entries(m.buckets)) {
    const p = v.proof
    // `?` = no local proof (Cloud) · `—` = no directory on the volume ·
    // `0` = a directory that is genuinely empty. Printing 0 for all three is
    // the same conflation selftest C5 caught one layer down.
    const cell = (n) => (p.unverified ? '?' : p.absent ? '—' : String(n))
    console.log(
      `${b.padEnd(24)}  ${String(v.exists).padEnd(6)}  ${String(v.keyCount).padStart(8)}  ` +
        `${cell(p.keyCount).padStart(8)}  ${cell(p.files).padStart(9)}  ` +
        `${cell(p.bytes).padStart(11)}  ${v.verdict}`,
    )
  }
  console.log('')
  console.log(
    `TOTAL api_keys=${m.totals.keys}  orphan_keys=${m.totals.orphanKeys} ` +
      `(PHI-tier ${m.totals.phiOrphanKeys})  orphan_files=${m.totals.orphanFiles}  orphan_bytes=${m.totals.orphanBytes}`,
  )
  for (const r of m.residuals) console.log(`\n⚠ RESIDUAL: ${r}`)
}

async function cmdVerify(argv) {
  const { admin } = adminClient()
  const path = argFlag(argv, '--manifest') ?? DEFAULT_MANIFEST
  if (!existsSync(path)) {
    console.error(`manifest not found: ${path}`)
    process.exit(2)
  }
  const m = JSON.parse(readFileSync(path, 'utf8'))
  let drift = 0
  console.log(`verifying against ${path} (captured ${m.capturedAt})\n`)
  for (const [b, rec] of Object.entries(m.buckets)) {
    const exists = await bucketExists(admin, b)
    const now = exists ? await listBucketKeys(admin, b) : []
    const was = new Set(rec.keys)
    const is = new Set(now)
    const added = now.filter((k) => !was.has(k))
    const removed = rec.keys.filter((k) => !is.has(k))
    if (added.length || removed.length || exists !== rec.exists) drift += added.length + removed.length
    console.log(
      `${b.padEnd(24)} manifest=${String(rec.keyCount).padStart(5)} now=${String(now.length).padStart(5)} ` +
        `+${added.length} -${removed.length}${exists === rec.exists ? '' : `  EXISTS ${rec.exists}→${exists}`}`,
    )
  }
  console.log(drift === 0 ? '\nMANIFEST MATCHES CURRENT STATE' : `\nDRIFT: ${drift} key difference(s)`)
  process.exitCode = drift === 0 ? 0 : 1
}

async function cmdWalk(argv) {
  const scope = argFlag(argv, '--buckets')
  const buckets = scope ? scope.split(',').map((s) => s.trim()) : ALL_KNOWN_BUCKETS
  const loc = locateVolume()
  if (!loc.available) {
    console.log(`LOCAL PROOF UNAVAILABLE — ${loc.reason}`)
    console.log('UNVERIFIED: orphaned bytes cannot be enumerated from here. This is the Cloud residual.')
    process.exitCode = 2
    return
  }
  console.log(`container=${loc.container}  root=${loc.root}\n`)
  const census = volumeCensus(loc, buckets)
  let files = 0
  let bytes = 0
  let phi = 0
  console.log('bucket                     keys     files        bytes   phi_files')
  for (const b of buckets) {
    const p = census[b]
    if (!p?.present) {
      console.log(`${b.padEnd(24)}  (no directory on the volume)`)
      continue
    }
    const phiFiles = p.keys.filter((k) => isPhi(b, k)).length
    files += p.files
    bytes += p.bytes
    phi += phiFiles
    console.log(
      `${b.padEnd(24)} ${String(p.keys.length).padStart(6)} ${String(p.files).padStart(9)} ` +
        `${String(p.bytes).padStart(12)} ${String(phiFiles).padStart(11)}`,
    )
  }
  console.log(`\nTOTAL files=${files} bytes=${bytes} phi_tier_keys=${phi}`)
  process.exitCode = 0
}

/**
 * Delete BY KEY from a manifest, then assert `deleted == manifest count`.
 *
 * ⭐ This is the whole point. Deletion is never driven by "list what is there
 * and remove it" — that re-introduces the metadata dependency the manifest
 * exists to break. It is driven by a key list captured BEFORE anything
 * destructive, and its success criterion is a POSITIVE COUNT MATCH.
 */
async function cmdDelete(argv) {
  const { admin } = adminClient()
  const path = argFlag(argv, '--manifest') ?? DEFAULT_MANIFEST
  const execute = argv.includes('--execute')
  if (!existsSync(path)) {
    console.error(`manifest not found: ${path}`)
    process.exit(2)
  }
  const m = JSON.parse(readFileSync(path, 'utf8'))
  const ageDays = (Date.now() - Date.parse(m.capturedAt)) / 86_400_000
  console.log(`${execute ? 'EXECUTING' : 'DRY RUN'} from ${path} (captured ${m.capturedAt}, ${ageDays.toFixed(1)}d ago)\n`)

  let mismatches = 0
  for (const [b, rec] of Object.entries(m.buckets)) {
    if (!rec.exists) {
      console.log(`${b.padEnd(24)} SKIP (bucket absent at capture time)`)
      continue
    }
    if (!execute) {
      console.log(`${b.padEnd(24)} would delete ${rec.keyCount} key(s)`)
      continue
    }
    let deleted = 0
    for (let i = 0; i < rec.keys.length; i += 500) {
      const batch = rec.keys.slice(i, i + 500)
      const { data, error } = await admin.storage.from(b).remove(batch)
      if (error) {
        console.error(`${b}: remove failed: ${error.message}`)
        process.exitCode = 2
        return
      }
      deleted += data?.length ?? 0
    }
    const ok = deleted === rec.keyCount
    if (!ok) mismatches += 1
    console.log(
      `${b.padEnd(24)} deleted=${deleted} manifest=${rec.keyCount}  ${ok ? 'MATCH' : '⛔ COUNT MISMATCH'}`,
    )
  }

  if (!execute) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --execute (S4 only).')
    process.exitCode = 0
    return
  }
  if (mismatches) {
    console.log(`\n⛔ REFUSED: ${mismatches} bucket(s) did not match their manifest count. Do NOT delete the bucket row.`)
    process.exitCode = 1
    return
  }
  console.log('\nALL BUCKETS MATCHED THEIR MANIFEST COUNT')
  const loc = locateVolume()
  if (loc.available) {
    const census = volumeCensus(loc, Object.keys(m.buckets))
    const left = Object.entries(census).filter(([, p]) => p.present && p.files > 0)
    if (left.length) {
      console.log('\n⚠ LOCAL PROOF: bytes REMAIN after a matched deletion — these are pre-existing orphans:')
      for (const [b, p] of left) console.log(`   ${b}: ${p.files} file(s), ${p.bytes} bytes`)
      process.exitCode = 1
      return
    }
    console.log('LOCAL PROOF: zero bytes remain on the volume for every manifest bucket.')
  } else {
    console.log(`\n⚠ LOCAL PROOF UNAVAILABLE (${loc.reason}) — byte removal is UNVERIFIED from here.`)
  }
  process.exitCode = 0
}

// ---------------------------------------------------------------------------
// selftest — prove the tool ABLE TO FAIL
//
// ⭐ "A manifest tool that reports a clean comparison is indistinguishable from
// one that compares two empty sets." Every control below is designed so that a
// BROKEN tool passes the naive check and FAILS here.
//
// Runs entirely inside a scratch bucket it creates and destroys. It touches no
// project bucket and no project row. It needs local docker, because manufacturing
// an orphan means deleting metadata while keeping bytes — which is exactly what
// no supported API can do.
// ---------------------------------------------------------------------------
async function cmdSelftest() {
  const { admin } = adminClient()
  const loc = locateVolume()
  if (!loc.available) {
    console.error(`selftest requires the local file backend (${loc.reason})`)
    process.exit(2)
  }
  const bucket = `dm5-selftest-${randomUUID().slice(0, 8)}`
  const results = []
  const check = (name, pass, detail) => {
    results.push({ name, pass, detail })
    console.log(`${pass ? '  ok  ' : ' NOT OK '} ${name}${detail ? ` — ${detail}` : ''}`)
  }

  try {
    const { error: ce } = await admin.storage.createBucket(bucket, { public: false })
    if (ce) throw new Error(`createBucket: ${ce.message}`)
    console.log(`scratch bucket: ${bucket}\n`)

    // ---- C1: the enumerator finds what is really there (depth-agnostic) ----
    // Deliberately MIXED depths. A fixed-depth walk — the defect class this
    // tool replaces — returns a partial or empty set here and C1 goes red.
    const planted = ['a.txt', 'one/b.txt', 'one/two/c.txt', 'one/two/three/d.txt']
    for (const k of planted) {
      const { error } = await admin.storage.from(bucket).upload(k, new Blob([`x-${k}`]))
      if (error) throw new Error(`upload ${k}: ${error.message}`)
    }
    const seen = await listBucketKeys(admin, bucket)
    check(
      'C1 enumerator finds all 4 planted keys across 4 different depths',
      seen.length === 4 && planted.every((k) => seen.includes(k)),
      `saw ${seen.length}: ${seen.join(', ')}`,
    )

    // ---- C8: the PERMISSIVE TWIN — a matching manifest deletes cleanly ----
    // ⭐ C2 below proves the tool REFUSES a bad manifest. On its own that is
    // half a proof: a tool hardwired to refuse everything passes C2 and is
    // useless. The refusal is only meaningful beside a permitted case that
    // actually succeeds — the same both-polarities discipline D4 was held to.
    // Ordered BEFORE C2 so C2 still runs against a fully-planted bucket and
    // tests "almost right" (4 of 5) rather than the weaker "nothing there".
    const goodManifest = {
      schemaVersion: SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      buckets: { [bucket]: { exists: true, keyCount: planted.length, keys: [...planted] } },
    }
    const goodPath = `${process.env.TEMP ?? '.'}/dm5-selftest-good-${bucket}.json`
    writeFileSync(goodPath, JSON.stringify(goodManifest), 'utf8')
    const savedGood = process.exitCode
    await cmdDelete(['--manifest', goodPath, '--execute'])
    const accepted = process.exitCode === 0
    process.exitCode = savedGood
    const emptiedApi = await listBucketKeys(admin, bucket)
    const emptiedVol = volumeCensus(loc, [bucket])[bucket]
    check(
      'C8 delete ACCEPTS a matching manifest, exits 0, and leaves zero keys and zero bytes',
      accepted && emptiedApi.length === 0 && (emptiedVol.files ?? 0) === 0,
      `exit=${accepted ? 0 : 'nonzero'} api=${emptiedApi.length} vol_files=${emptiedVol.files ?? 0}`,
    )

    // Re-plant for C2, so the mismatch it refuses is 4-of-5, not 0-of-5.
    for (const k of planted) {
      const { error } = await admin.storage.from(bucket).upload(k, new Blob([`x-${k}`]))
      if (error) throw new Error(`replant ${k}: ${error.message}`)
    }

    // ---- C2: a manifest whose count exceeds reality is REFUSED ----------
    // The deliberate mismatch. A tool that reports success on "delete whatever
    // is there" passes trivially; only a COUNT COMPARISON catches this.
    const phantomManifest = {
      schemaVersion: SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      buckets: { [bucket]: { exists: true, keyCount: 5, keys: [...planted, 'ghost/never-existed.txt'] } },
    }
    const tmp = `${process.env.TEMP ?? '.'}/dm5-selftest-manifest-${bucket}.json`
    writeFileSync(tmp, JSON.stringify(phantomManifest), 'utf8')
    const savedCode = process.exitCode
    await cmdDelete(['--manifest', tmp, '--execute'])
    const refused = process.exitCode === 1
    process.exitCode = savedCode
    check('C2 delete REFUSES a manifest whose count exceeds reality (COUNT MISMATCH)', refused,
      refused ? 'exit 1 as required' : `exit ${process.exitCode} — a mismatch was accepted`)

    // ---- C3: the API is BLIND to an orphan (the premise, measured) --------
    // Manufacture the exact post-reset state: bytes on the volume with NO
    // metadata row.
    //
    // ⚠ The obvious route — `delete from storage.objects` — is BLOCKED on this
    // stack by `storage.protect_delete()` ("Direct deletion from storage tables
    // is not allowed"), discovered by this harness on its first run. That guard
    // does NOT make the orphan class impossible: `supabase db reset` still
    // clears the table (a DELETE trigger does not fire on the reset path), which
    // is how the 699 live orphans got there. So the state is real; only that one
    // route to it is closed.
    //
    // Manufacturing from the BYTE side instead is strictly better as a control:
    // it produces the identical end state, touches `storage.objects` not at all,
    // and stays inside the scratch bucket's own directory. The on-disk layout is
    // `<root>/<bucket>/<object key>/<version uuid>` — an object KEY is a
    // DIRECTORY, which is why the walk strips the leaf segment.
    const orphans = ['orphan/one.bin', 'orphan/two.bin']
    for (const k of orphans) {
      docker([
        'exec',
        loc.container,
        'sh',
        '-c',
        `mkdir -p '${loc.root}/${bucket}/${k}' && printf 'bytes-%s' '${k}' > '${loc.root}/${bucket}/${k}/${randomUUID()}'`,
      ])
    }
    const afterPlant = await listBucketKeys(admin, bucket)
    check('C3 Storage API reports EMPTY while bytes remain (the withdrawn method would pass here)',
      afterPlant.length === 0, `api returned ${afterPlant.length} key(s)`)

    // ---- C4: the volume walk FINDS the known orphans (positive control) ---
    // This is the control that matters. A walk that silently returns nothing —
    // wrong root, wrong container, a swallowed error — passes every other check
    // in this file and fails only here.
    const census = volumeCensus(loc, [bucket])
    const found = census[bucket]?.keys ?? []
    check('C4 volume walk FINDS the 2 known orphans the API cannot see',
      found.length === 2 && orphans.every((k) => found.includes(k)),
      `walk found ${found.length}: ${found.join(', ')}`)

    // ---- C5: the walk can report ABSENCE, not just zero -------------------
    // A detector that returns 0 for "not present" and 0 for "present but empty"
    // cannot be trusted to mean either.
    const absent = volumeCensus(loc, [`${bucket}-does-not-exist`])
    check('C5 walk distinguishes ABSENT from EMPTY', absent[`${bucket}-does-not-exist`]?.present === false,
      `present=${absent[`${bucket}-does-not-exist`]?.present}`)

    // ---- C6: capture VERDICT flags the orphan rather than reporting clean --
    const verdict = verdictFor({ exists: true, apiKeys: [], proof: census[bucket] })
    check('C6 verdict is ORPHANED_BYTES, not CONSISTENT_EMPTY', verdict === 'ORPHANED_BYTES', `verdict=${verdict}`)

    // ---- C7: the verdict function is not a constant -----------------------
    // C6 alone would pass if verdictFor always said ORPHANED_BYTES.
    const clean = verdictFor({ exists: true, apiKeys: ['k'], proof: { present: true, keys: ['k'], files: 1, bytes: 1 } })
    check('C7 the same verdict function returns CONSISTENT on agreeing inputs', clean === 'CONSISTENT', `verdict=${clean}`)
  } catch (e) {
    console.error(`\nselftest error: ${String(e)}`)
    process.exitCode = 2
    return
  } finally {
    // Cleanup: API remove clears whatever metadata still exists; the volume
    // directory is removed directly because orphaned bytes have no API handle
    // (which is the whole finding).
    try {
      const left = await listBucketKeys(admin, bucket)
      if (left.length) await admin.storage.from(bucket).remove(left)
    } catch { /* best effort */ }
    try {
      docker(['exec', loc.container, 'sh', '-c', `rm -rf ${loc.root}/${bucket}`])
    } catch { /* best effort */ }
    try {
      await admin.storage.deleteBucket(bucket)
    } catch { /* best effort */ }
    console.log(`\nscratch bucket ${bucket} removed`)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} controls passed`)
  if (failed.length) {
    console.log('⛔ SELFTEST FAILED — the tool is NOT proven able to fail; do not trust its verdicts.')
    process.exitCode = 1
    return
  }
  console.log('✅ SELFTEST PASSED — the tool detects a known orphan and refuses a deliberate mismatch.')
  process.exitCode = 0
}

// ---------------------------------------------------------------------------
function argFlag(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const [, , cmd, ...argv] = process.argv
switch (cmd) {
  case 'capture':
    await cmdCapture(argv)
    break
  case 'verify':
    await cmdVerify(argv)
    break
  case 'walk':
    await cmdWalk(argv)
    break
  case 'delete':
    await cmdDelete(argv)
    break
  case 'selftest':
    await cmdSelftest()
    break
  default:
    console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n/, ''))
    process.exitCode = cmd ? 2 : 0
}
