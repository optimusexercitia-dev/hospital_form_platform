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
 * (⚠ Historical figures, and the bucket count with them: DM5 S4 retired 8 of
 * those 12 — `documents-standard`, `documents-phi`, `form-assets` and
 * `meeting-audio` survive. RETIREMENT_BUCKETS below is retained deliberately so
 * a resurrected bucket is still enumerated rather than silently skipped.)
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
 *   rehearse  DM5 S5.R — run the REAL deploy sequence end to end against a
 *             purpose-made disposable bucket populated THROUGH the Storage API,
 *             so `storage.objects` rows exist. See cmdRehearse's header for why
 *             the with-metadata condition is the whole point.
 *
 * Exit codes: 0 clean · 1 drift/mismatch (a verdict, not a crash) · 2 error.
 *
 * ⚠ Flags are REJECTED when unrecognised, and a value-taking flag with no value
 * is an error rather than a silent fallback. FUP-DM5-MANIFEST-FLAG: `capture`
 * takes `--out`, `delete`/`verify` take `--manifest`, and passing the wrong one
 * used to fall through to DEFAULT_MANIFEST and OVERWRITE the committed baseline
 * — the authoritative record of what existed immediately before an irreversible
 * deletion. A tool whose failure mode on a typo is to destroy the previous
 * authoritative record must be hostile to wrong-but-plausible input.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from
 * `.env.local` when present), same contract as
 * `scripts/document-reconciliation.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
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

/** PHI-tier locations, for the report's PHI subtotal.
 *
 *  ⚠ DM5 S3 UPDATE — the `printed-documents` prefix rule is now HISTORICAL, and
 *  it is deliberately RETAINED rather than deleted. ADR 0120 D7 retired
 *  `pd_storage_path_derived` and moved print bytes onto the core substrate,
 *  where the PHI split is the BUCKET (`documents-phi`, CHECK-pinned to
 *  `file_objects.sensitivity_tier` by `file_objects_bucket_from_tier`) instead of
 *  a `phi/`|`std/` path prefix. New prints therefore land under `documents-phi`
 *  and are counted by the bucket rule above.
 *
 *  The prefix entry stays because this tool's job is to enumerate what is
 *  ACTUALLY ON THE VOLUME for S4's manifest-first retirement, and pre-cutover
 *  objects with the old `phi/` prefix still exist there — a reset truncates
 *  `storage.objects` and LEAVES the bytes (ADR 0120 D9, measured: 0 metadata rows
 *  vs 699 objects). Dropping this rule would silently under-count the PHI
 *  subtotal of exactly the orphans the manifest exists to catch. */
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
  if (!exists) {
    // ⭐ DM5 S5 FIX — this used to `return 'BUCKET_ABSENT'` unconditionally, on
    // the very first line, BEFORE consulting the volume proof. Because
    // BUCKET_ABSENT is a CLEAN verdict, a bucket whose row is gone while its
    // bytes are still on the volume produced `CAPTURE CLEAN` and exit 0 — the
    // orphan reached `totals.orphanKeys` and the residuals text, but neither
    // the exit code nor the headline, so anything gating on the success signal
    // could not learn about it. REPRODUCED before fixing (S5 record): a
    // manufactured row-absent/bytes-present bucket reported `orphan_keys=1`
    // and `CAPTURE CLEAN`, exit 0.
    //
    // This is the same shape as the defect the whole tool exists to kill —
    // "prove emptiness against a table that no longer knows" — one layer up, in
    // the tool's OWN success signal. Dropping a bucket row does not delete a
    // byte; a verdict that treats a missing row as proof of a missing object is
    // exactly the withdrawn method wearing the tool's badge.
    return proof && proof.present && proof.keys.length > 0 ? 'BUCKET_ABSENT_ORPHANED_BYTES' : 'BUCKET_ABSENT'
  }
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

// `BUCKET_ABSENT_ORPHANED_BYTES` is deliberately NOT here: a dropped bucket row
// over surviving bytes is the loudest thing this tool can find, not a clean one.
// `BUCKET_ABSENT` (row gone AND nothing on the volume) stays clean — that is the
// post-retirement steady state the eight S4 buckets are in, and reddening it
// would make the tool useless for confirming a completed retirement.
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
      // ⭐ DM5 S5 — this used to say, flatly, "these are pre-existing orphans".
      // It is the single most consequential line this tool prints: it appears
      // only after a DESTRUCTIVE run, and the two possible causes lead an
      // operator to OPPOSITE actions. "Pre-existing orphans" reads as *the
      // deletion was fine, proceed*. But S5.R's R3b measured the other cause:
      // an UNDER-COUNT manifest deletes every key it lists, the count comparison
      // MATCHES, and the survivors are keys the manifest never knew about —
      // still API-VISIBLE, still holding metadata rows, and therefore NOT
      // orphans at all. That case means *your manifest is incomplete, STOP*.
      // The two are distinguishable, so the tool must distinguish them rather
      // than name the reassuring one. Where it cannot tell (the re-list fails),
      // it says INDETERMINATE instead of guessing.
      console.log('\n⚠ LOCAL PROOF: bytes REMAIN after a deletion whose count matched its manifest.')
      let missedTotal = 0
      let orphanTotal = 0
      let indeterminate = 0
      for (const [b, p] of left) {
        // ⛔ FOUND BY REHEARSAL R3d, and it inverts the premise of this branch.
        // `.list('')` on a bucket whose ROW IS GONE returns `{data: [], error:
        // null}` — an EMPTY LIST, not an error. Measured, not assumed: R3d
        // dropped the bucket row, left one file on the volume, and the first
        // version of this classifier reported "PRE-EXISTING METADATA-LESS
        // ORPHANS … not a failure of this deletion" — the REASSURING arm — for a
        // bucket it could not interrogate at all. "I could not ask" and "I asked
        // and there is nothing" are the same value here — the second instance of
        // the class filed as FUP-DM5-NO-ANSWER-VS-NOTHING (the first being
        // `--allow-orphans`, which mutes the same two facts one layer up).
        // So existence is established FIRST, with `getBucket`, which DOES error.
        if (!(await bucketExists(admin, b))) {
          indeterminate += 1
          console.log(
            `   ${b}: ${p.files} file(s), ${p.bytes} bytes — ⚠ INDETERMINATE: the bucket ROW IS ABSENT, so a ` +
              'Storage listing returns an empty list whether or not objects once existed. These bytes CANNOT ' +
              'be classified from the API. Treat as unsafe.',
          )
          continue
        }
        let apiNow
        try {
          apiNow = await listBucketKeys(admin, b)
        } catch (e) {
          indeterminate += 1
          console.log(`   ${b}: ${p.files} file(s), ${p.bytes} bytes — ⚠ INDETERMINATE: could not re-list the bucket (${String(e.message ?? e)}), so these bytes CANNOT be classified. Treat as unsafe.`)
          continue
        }
        const apiSet = new Set(apiNow)
        const orphaned = p.keys.filter((k) => !apiSet.has(k))
        missedTotal += apiNow.length
        orphanTotal += orphaned.length
        console.log(`   ${b}: ${p.files} file(s), ${p.bytes} bytes on the volume`)
        if (apiNow.length) {
          console.log(
            `       ⛔ ${apiNow.length} key(s) MISSED BY THE MANIFEST — still API-VISIBLE, so they hold metadata ` +
              'rows and are NOT orphans. The manifest was captured against an incomplete reality.',
          )
          for (const k of apiNow.slice(0, 10)) console.log(`          still present: ${k}`)
          if (apiNow.length > 10) console.log(`          … and ${apiNow.length - 10} more`)
        }
        if (orphaned.length) {
          console.log(
            `       ${orphaned.length} key(s) are PRE-EXISTING METADATA-LESS ORPHANS — invisible to the API, ` +
              'so no key can address them; this run neither created nor could delete them.',
          )
        }
      }
      if (missedTotal || indeterminate) {
        // The parts are assembled rather than interpolated because the
        // indeterminate-only case (row absent + bytes present, rehearsal R3d)
        // otherwise prints "0 key(s) survived that the manifest did not list",
        // which reads as a reassurance inside a refusal. A refusal whose own
        // numbers look benign is how a STOP gets ignored.
        const parts = []
        if (missedTotal) parts.push(`${missedTotal} key(s) survived that the manifest did not list`)
        if (indeterminate) parts.push(`${indeterminate} bucket(s) could not be classified at all`)
        console.log(
          `\n⛔ DO NOT PROCEED. ${parts.join(' and ')}. ` +
            'Do NOT retire the bucket row. Re-capture and find out why the manifest was incomplete.',
        )
      } else {
        console.log(
          `\n⚠ ${orphanTotal} pre-existing orphan key(s) remain. Every manifested key was deleted and none ` +
            'survived, but these bytes predate this run and are unreachable through the Storage API — a ' +
            'data-at-rest / disposal-assertion problem (Rule 12, LGPD), not a failure of this deletion.',
        )
      }
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

    // ---- C9: a DROPPED BUCKET ROW does not launder surviving bytes ---------
    // ⭐ DM5 S5. `verdictFor` used to return BUCKET_ABSENT unconditionally on
    // its first line, before consulting the volume proof — and BUCKET_ABSENT is
    // a CLEAN verdict, so this state produced `CAPTURE CLEAN` and exit 0.
    // Reproduced live before the fix. It is the tool's own success signal
    // committing the error the tool exists to prevent: treating a missing
    // METADATA row as proof of a missing OBJECT. All eight S4-retired buckets
    // sit in the row-absent state permanently, so this is the state the tool
    // will be pointed at for the rest of the program.
    const ghostBytes = verdictFor({ exists: false, apiKeys: [], proof: { present: true, keys: ['left/behind.bin'], files: 1, bytes: 9 } })
    check('C9 bucket row ABSENT with bytes still on the volume is NOT clean', ghostBytes === 'BUCKET_ABSENT_ORPHANED_BYTES' && !CLEAN_VERDICTS.has(ghostBytes), `verdict=${ghostBytes}`)

    // ---- C10: the permissive twin for C9 -----------------------------------
    // Without this, C9 is satisfied by a tool that calls every absent bucket
    // dirty — which would red the completed S4 retirement forever.
    const ghostEmpty = verdictFor({ exists: false, apiKeys: [], proof: { present: false, keys: [], files: 0, bytes: 0 } })
    check('C10 bucket row absent AND no bytes stays BUCKET_ABSENT and CLEAN (the completed-retirement state)', ghostEmpty === 'BUCKET_ABSENT' && CLEAN_VERDICTS.has(ghostEmpty), `verdict=${ghostEmpty}`)

    // ---- C11/C12/C13: flag hostility (FUP-DM5-MANIFEST-FLAG) ---------------
    // The filed incident, as an executable assertion. C12 is its permissive
    // twin: a validator that rejected everything would pass C11 and C13 and
    // make the tool unusable.
    const wrongFlag = flagErrors('capture', ['--manifest', '/tmp/x.json'])
    check('C11 capture REJECTS delete\'s --manifest flag instead of falling back to the committed baseline',
      wrongFlag.some((e) => e.includes('unknown flag "--manifest"') && e.includes('"delete"')),
      wrongFlag.join(' | ') || 'accepted silently')
    const rightFlags = flagErrors('capture', ['--out', '/tmp/x.json', '--buckets', 'a,b', '--allow-orphans'])
    check('C12 capture ACCEPTS its own full flag set (the permissive twin)', rightFlags.length === 0, rightFlags.join(' | '))
    const danglingValue = flagErrors('capture', ['--out'])
    const flagAsValue = flagErrors('capture', ['--out', '--allow-orphans'])
    check('C13 a value-taking flag with no value is an ERROR, not a silent fallback to the default path',
      danglingValue.length === 1 && flagAsValue.length === 1,
      `--out alone → ${danglingValue.length} error(s); --out --allow-orphans → ${flagAsValue.length} error(s)`)
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
// rehearse — DM5 S5.R: run the REAL sequence against real bytes WITH METADATA
//
// ## Why this exists, and why it is not `selftest`
//
// S4 retired the eight bucket rows, but its byte half was a NO-OP: every
// retirement byte was a metadata-less orphan, so `delete --execute` had nothing
// to delete and has therefore NEVER run against a populated bucket. The
// sequence's correctness rested entirely on `selftest` — controls the tool runs
// against itself — plus zero execution against real bytes.
//
// ⭐ The trap this command is shaped to avoid: metadata-less orphans are the ONE
// condition under which the manifest sequence has nothing to do, because the
// Storage API lists *from* `storage.objects`. Production is in the opposite
// condition. A rehearsal that reproduced S4's setup would re-prove the no-op and
// read as coverage. So the with-metadata precondition is asserted FIRST, in the
// tool's own vocabulary and in two independent ways: the capture verdict must be
// `CONSISTENT` with `keyCount > 0` (S4's was `BUCKET_ABSENT` over a degenerate
// zero-key manifest), and `storage.objects` must independently show the rows.
//
// ## Both polarities, always
//
// Every control here runs beside an opposite-polarity twin against the SAME
// subject in the SAME run: accept vs refuse, orphan-found vs orphan-gone,
// guard-refuses vs guard-admits. A harness that only ever observes PASS cannot
// distinguish a working sequence from a hardwired one.
//
// ## Safety
//
// The target bucket is ALLOWLISTED by prefix (fails CLOSED on a typo, a null,
// or any bucket added later) and additionally denylisted against every known
// project bucket. The four survivors — `documents-standard`, `documents-phi`,
// `form-assets`, `meeting-audio` — back the seed and ~900 E2E tests and are
// never in a delete path here. Cleanup is verified, not assumed: a rehearsal of
// a disposal that leaves orphans behind refutes itself.
// ---------------------------------------------------------------------------
const REHEARSAL_PREFIX = 'dm5-s5-rehearsal-'
const REHEARSAL_NAME_RE = /^dm5-s5-rehearsal-[0-9a-f]{8}$/
const RETIREMENT_MIGRATION = 'supabase/migrations/20260927000400_dm5_s4_retire_legacy_buckets.sql'

/**
 * Fail-CLOSED target check. An allowlist, per the D18 lesson that an exclusion's
 * two directions fail oppositely: a denylist (`name is not one of ours`) admits
 * anything not on the list — a new bucket, a typo, a null — while an allowlist
 * admits only what it recognises. The denylist is kept as well; defence in depth
 * is nearly free and the failure mode here is byte loss with no backstop.
 */
function assertDisposableBucket(name) {
  if (typeof name !== 'string' || !REHEARSAL_NAME_RE.test(name)) {
    throw new Error(`refusing to operate on "${name}": not a rehearsal-prefixed disposable bucket (${REHEARSAL_PREFIX}xxxxxxxx)`)
  }
  if (ALL_KNOWN_BUCKETS.includes(name)) {
    throw new Error(`refusing to operate on "${name}": it is a known project bucket`)
  }
  return name
}

function dbContainer() {
  const name = docker(['ps', '--filter', 'name=supabase_db', '--format', '{{.Names}}'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0]
  if (!name) throw new Error('no running supabase_db container — the rehearsal needs the local stack')
  return name
}

/** Run SQL in the local DB container. Returns the outcome rather than throwing,
 *  because "this statement RAISED" is a result the rehearsal asserts on. */
function dbExec(container, sql) {
  try {
    const out = execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, stdout: out.trim(), stderr: '' }
  } catch (e) {
    return { ok: false, stdout: String(e.stdout ?? '').trim(), stderr: String(e.stderr ?? e.message ?? '').trim() }
  }
}

/**
 * The retirement guard, EXTRACTED FROM THE MIGRATION AT RUN TIME rather than
 * transcribed.
 *
 * ⭐ Transcribing it would mean rehearsing my copy of the guard, which is the
 * "a comment is an assertion that goes stale silently" class one level up: the
 * copy would keep passing after the original changed. Reading the file is
 * legitimate HERE, specifically, and the distinction matters — this repo's rule
 * is that migration TEXT is stale because some migrations rewrite FUNCTION
 * BODIES at runtime via pg_get_functiondef()+replace()+execute, so `pg_proc` is
 * truth. A `do $$ … $$` block leaves NO catalog artifact at all: there is no
 * `pg_proc` row to consult, the file is the only form it has, and we are not
 * making a claim ABOUT the migration — we are executing its own text.
 */
function retirementGuardSql(buckets) {
  if (!existsSync(RETIREMENT_MIGRATION)) throw new Error(`retirement migration not found: ${RETIREMENT_MIGRATION}`)
  const src = readFileSync(RETIREMENT_MIGRATION, 'utf8')
  const block = src.match(/do \$\$[\s\S]*?\$\$;/)
  if (!block) throw new Error(`could not extract a "do $$ … $$;" block from ${RETIREMENT_MIGRATION}`)
  const literal = buckets.map((b) => `'${assertDisposableBucket(b)}'`).join(', ')
  const sql = block[0].replace(/(v_retired constant text\[\] := array\[)[\s\S]*?(\];)/, `$1${literal}$2`)
  if (!sql.includes(literal)) throw new Error('bucket-array substitution did not apply — refusing to run the guard against its real target list')
  // Fail closed: after substitution NO project bucket name may survive in the SQL.
  const leaked = ALL_KNOWN_BUCKETS.filter((b) => sql.includes(`'${b}'`))
  if (leaked.length) throw new Error(`guard SQL still names project bucket(s) after substitution: ${leaked.join(', ')}`)
  if (!/select count\(\*\)[\s\S]*from storage\.objects/.test(sql)) {
    throw new Error('extracted block does not read storage.objects — wrong block extracted')
  }
  return sql
}

async function cmdRehearse() {
  const { admin } = adminClient()
  const loc = locateVolume()
  if (!loc.available) {
    console.error(`rehearse requires the local file backend (${loc.reason})`)
    process.exit(2)
  }
  const db = dbContainer()
  const bucket = assertDisposableBucket(`${REHEARSAL_PREFIX}${randomUUID().slice(0, 8)}`)
  const planted = ['r1.bin', 'a/r2.bin', 'a/b/r3.bin', 'a/b/c/r4.bin', 'z/r5.bin']
  const results = []
  const check = (name, pass, detail) => {
    results.push({ name, pass, detail })
    console.log(`${pass ? '  ok  ' : ' NOT OK '} ${name}${detail ? ` — ${detail}` : ''}`)
  }
  const tmp = (label) => join(tmpdir(), `${bucket}-${label}.json`)
  const runCapture = async (out, extra = []) => {
    const saved = process.exitCode
    await cmdCapture(['--buckets', bucket, '--out', out, ...extra])
    const exit = process.exitCode ?? 0
    process.exitCode = saved
    return { exit, manifest: JSON.parse(readFileSync(out, 'utf8')) }
  }
  // Captures stdout as well as the exit code: the S5 message fix means the WORDING
  // on the destructive path is itself a pinned property, not just the exit code.
  // A message proven wrong once and left unpinned comes back.
  const runDelete = async (manifestPath, exec = true) => {
    const saved = process.exitCode
    const lines = []
    const realLog = console.log
    console.log = (...a) => {
      lines.push(a.map(String).join(' '))
      realLog(...a)
    }
    try {
      await cmdDelete(['--manifest', manifestPath, ...(exec ? ['--execute'] : [])])
    } finally {
      console.log = realLog
    }
    const exit = process.exitCode ?? 0
    process.exitCode = saved
    return { exit, out: lines.join('\n') }
  }
  const volOf = () => volumeCensus(loc, [bucket])[bucket]
  const metadataRows = () => Number(dbExec(db, `select count(*) from storage.objects where bucket_id = '${bucket}';`).stdout)
  const replant = async () => {
    const left = await listBucketKeys(admin, bucket)
    if (left.length) await admin.storage.from(bucket).remove(left)
    docker(['exec', loc.container, 'sh', '-c', `rm -rf ${loc.root}/${bucket}`])
    for (const k of planted) {
      const { error } = await admin.storage.from(bucket).upload(k, new Blob([`rehearsal-${k}-${randomUUID()}`]))
      if (error) throw new Error(`upload ${k}: ${error.message}`)
    }
  }

  console.log(`disposable bucket: ${bucket}   db: ${db}   volume: ${loc.container}:${loc.root}\n`)

  try {
    const { error: ce } = await admin.storage.createBucket(bucket, { public: false })
    if (ce) throw new Error(`createBucket: ${ce.message}`)
    await replant()

    // ---- R0: the WITH-METADATA precondition — the whole point ---------------
    // Two independent measurements. If either is zero, this run is reproducing
    // S4's conditions and everything after it would be vacuous.
    const apiSeen = await listBucketKeys(admin, bucket)
    const rows = metadataRows()
    const volSeen = volOf()
    check(
      'R0 populated THROUGH the Storage API: metadata rows exist (this is what S4 lacked)',
      apiSeen.length === planted.length && rows === planted.length && volSeen.files === planted.length,
      `api=${apiSeen.length} storage.objects=${rows} volume_files=${volSeen.files}`,
    )
    if (rows === 0) throw new Error('REFUSING TO CONTINUE: zero metadata rows — this run would re-prove S4\'s no-op')

    // ---- R1: capture is CONSISTENT with keyCount > 0 ------------------------
    // ⭐ The discriminator against S4, stated in the tool's own vocabulary:
    // S4's capture was BUCKET_ABSENT over a degenerate zero-key manifest.
    const cap1 = await runCapture(tmp('cap1'))
    const b1 = cap1.manifest.buckets[bucket]
    check(
      'R1 capture verdict CONSISTENT with keyCount>0 (S4 captured BUCKET_ABSENT / zero keys)',
      cap1.exit === 0 && b1.verdict === 'CONSISTENT' && b1.keyCount === planted.length &&
        planted.every((k) => b1.keys.includes(k)) && b1.proof.orphanKeys.length === 0,
      `exit=${cap1.exit} verdict=${b1.verdict} keys=${b1.keyCount} orphans=${b1.proof.orphanKeys.length}`,
    )

    // ---- R4a: the retirement guard REFUSES while metadata rows survive ------
    const guard1 = dbExec(db, retirementGuardSql([bucket]))
    check(
      'R4a retirement guard REFUSES while storage.objects rows survive, naming bucket and count',
      !guard1.ok && guard1.stderr.includes(bucket) && /still holds 5 storage\.objects row/.test(guard1.stderr),
      guard1.ok ? 'guard ADMITTED a populated bucket' : guard1.stderr.split('\n')[0].slice(0, 150),
    )

    // ---- R2: a manufactured extra orphan is FOUND ---------------------------
    // A key on the VOLUME that is absent from the manifest and invisible to the
    // API. R1 above is its negative control (same detector, orphans=0).
    const orphanKey = 'sneaky/extra.bin'
    docker(['exec', loc.container, 'sh', '-c',
      `mkdir -p '${loc.root}/${bucket}/${orphanKey}' && printf 'orphan' > '${loc.root}/${bucket}/${orphanKey}/${randomUUID()}'`])
    const cap2 = await runCapture(tmp('cap2'))
    const b2 = cap2.manifest.buckets[bucket]
    check(
      'R2 a manufactured extra orphan (volume key absent from the manifest) is FOUND',
      cap2.exit === 1 && b2.verdict === 'ORPHANED_BYTES' && b2.proof.orphanKeys.includes(orphanKey),
      `exit=${cap2.exit} verdict=${b2.verdict} orphanKeys=[${b2.proof.orphanKeys.join(', ')}]`,
    )
    docker(['exec', loc.container, 'sh', '-c', `rm -rf '${loc.root}/${bucket}/sneaky'`])
    const cap3 = await runCapture(tmp('cap3'))
    check(
      'R2b the orphan detector is NOT a constant — removing the orphan restores CONSISTENT',
      cap3.exit === 0 && cap3.manifest.buckets[bucket].verdict === 'CONSISTENT',
      `exit=${cap3.exit} verdict=${cap3.manifest.buckets[bucket].verdict}`,
    )

    // ---- R3a: an OVER-COUNT manifest is REFUSED -----------------------------
    // manifest 6 > reality 5. The count comparison catches it. API-only.
    const over = JSON.parse(readFileSync(tmp('cap3'), 'utf8'))
    over.buckets[bucket].keys = [...planted, 'ghost/never-existed.bin']
    over.buckets[bucket].keyCount = planted.length + 1
    writeFileSync(tmp('over'), JSON.stringify(over), 'utf8')
    const over1 = await runDelete(tmp('over'))
    check(
      'R3a delete REFUSES an OVER-COUNT manifest (deleted < manifest ⇒ COUNT MISMATCH)',
      over1.exit === 1 && /COUNT MISMATCH/.test(over1.out),
      `exit=${over1.exit}`,
    )

    // ---- R3b: an UNDER-COUNT manifest — the control that actually matters ---
    // ⭐ manifest 4 < reality 5. The count comparison MATCHES (4 deleted == 4
    // manifested) and the run prints "ALL BUCKETS MATCHED THEIR MANIFEST COUNT"
    // while a real file SURVIVES. Only the LOCAL VOLUME PROOF turns this into a
    // non-zero exit — and the local volume proof does not exist on Cloud. This
    // is the 221-file shape: a manifest captured against an incomplete reality,
    // a deletion that reports success, and bytes left behind.
    await replant()
    const cap4 = await runCapture(tmp('cap4'))
    const under = JSON.parse(readFileSync(tmp('cap4'), 'utf8'))
    const missed = under.buckets[bucket].keys.pop()
    under.buckets[bucket].keyCount = under.buckets[bucket].keys.length
    writeFileSync(tmp('under'), JSON.stringify(under), 'utf8')
    const under1 = await runDelete(tmp('under'))
    const survivorsApi = await listBucketKeys(admin, bucket)
    const survivorsVol = volOf()
    check(
      'R3b delete REFUSES an UNDER-COUNT manifest — count MATCHES, bytes survive, exit is still 1',
      cap4.exit === 0 && under1.exit === 1 && survivorsVol.files === 1 && /ALL BUCKETS MATCHED THEIR MANIFEST COUNT/.test(under1.out),
      `exit=${under1.exit} surviving_volume_files=${survivorsVol.files} surviving_api_keys=${survivorsApi.length}`,
    )
    // ⭐ The MESSAGE is pinned, not only the state. The old wording called this
    // survivor a "pre-existing orphan"; it is API-visible, so it has a metadata
    // row and is a key the manifest MISSED. The two readings send an operator in
    // opposite directions on a destructive path, so the distinction is asserted.
    check(
      'R3b-diagnosis the survivor is API-VISIBLE and is REPORTED as MISSED BY THE MANIFEST, not as an orphan',
      survivorsApi.length === 1 && survivorsApi[0] === missed &&
        /MISSED BY THE MANIFEST/.test(under1.out) && /DO NOT PROCEED/.test(under1.out) &&
        !/PRE-EXISTING METADATA-LESS ORPHANS/.test(under1.out),
      `missed="${missed}" api=[${survivorsApi.join(', ')}] message_classified_as=${/MISSED BY THE MANIFEST/.test(under1.out) ? 'MISSED' : 'not-missed'}`,
    )

    // ---- R3c: the classifier's PERMISSIVE TWIN -----------------------------
    // Without this, R3b is satisfied by a classifier hardwired to shout MISSED.
    // Genuine metadata-less orphans must still be reported as orphans, and must
    // NOT trigger "DO NOT PROCEED" — they are a Rule-12 disposal problem, not a
    // failed deletion, and conflating them would make the loud case ignorable.
    await replant()
    const cap4b = await runCapture(tmp('cap4b'))
    docker(['exec', loc.container, 'sh', '-c',
      `mkdir -p '${loc.root}/${bucket}/ghosttown/old.bin' && printf 'orphan' > '${loc.root}/${bucket}/ghosttown/old.bin/${randomUUID()}'`])
    const orphanRun = await runDelete(tmp('cap4b'))
    check(
      'R3c the same classifier reports GENUINE metadata-less orphans as orphans, without DO NOT PROCEED',
      cap4b.exit === 0 && orphanRun.exit === 1 &&
        /PRE-EXISTING METADATA-LESS ORPHANS/.test(orphanRun.out) &&
        !/MISSED BY THE MANIFEST/.test(orphanRun.out) && !/DO NOT PROCEED/.test(orphanRun.out),
      `exit=${orphanRun.exit} classified_as=${/PRE-EXISTING METADATA-LESS ORPHANS/.test(orphanRun.out) ? 'ORPHAN' : 'not-orphan'}`,
    )

    // ---- R1x: the PERMISSIVE TWIN — the real sequence, end to end ----------
    await replant()
    const cap5 = await runCapture(tmp('cap5'))
    const dryRun = await runDelete(tmp('cap5'), false)
    const rowsBefore = metadataRows()
    const execRun = await runDelete(tmp('cap5'), true)
    const cap6 = await runCapture(tmp('cap6'))
    const b6 = cap6.manifest.buckets[bucket]
    const rowsAfter = metadataRows()
    check(
      'R1x THE SEQUENCE: capture → dry-run → delete --execute → re-capture reads EMPTY',
      cap5.exit === 0 && dryRun.exit === 0 && execRun.exit === 0 && cap6.exit === 0 &&
        /DRY RUN — nothing deleted/.test(dryRun.out) && /LOCAL PROOF: zero bytes remain/.test(execRun.out) &&
        b6.verdict === 'CONSISTENT_EMPTY' && b6.keyCount === 0 && b6.proof.files === 0 &&
        rowsBefore === planted.length && rowsAfter === 0,
      `capture=${cap5.exit} dry=${dryRun.exit} exec=${execRun.exit} recapture=${cap6.exit} verdict=${b6.verdict} ` +
        `vol_files=${b6.proof.files} storage.objects ${rowsBefore}→${rowsAfter}`,
    )

    // ---- R4b: the guard ADMITS once the rows are gone -----------------------
    const guard2 = dbExec(db, retirementGuardSql([bucket]))
    check('R4b the same guard ADMITS once storage.objects rows are gone', guard2.ok,
      guard2.ok ? 'no exception' : guard2.stderr.split('\n')[0].slice(0, 150))

    // ---- R6: WHICH CONTROLS SURVIVE WITHOUT THE LOCAL VOLUME PROOF ---------
    //
    // ⭐ The most consequential thing this rehearsal produces, and NOT what it
    // was chartered to find. R3b showed that an under-count manifest passes the
    // count comparison and is caught ONLY by the local volume proof. The local
    // volume proof is `locateVolume()`, whose preconditions are a running
    // `supabase_storage` DOCKER CONTAINER on the operator's own machine and
    // `STORAGE_BACKEND=file`. Neither can hold for a Supabase Cloud project.
    //
    // So the controls are re-run here with `locateVolume()` forced down its
    // ALREADY-EXISTING unavailable branch — by removing `docker` from PATH, not
    // by stubbing anything — and the exit codes are compared arm to arm. The two
    // arms differ in exactly ONE variable: whether the proof is available.
    //
    // ⚠ WHAT THIS DOES AND DOES NOT ESTABLISH. It establishes a property of THIS
    // TOOL's code: with no local proof, an under-count `delete --execute` exits
    // 0 while bytes survive. It does NOT establish anything about Supabase
    // Cloud's storage internals, and nothing here was run against Cloud (it must
    // not be). The bridge is the absence of a precondition readable in the
    // source, not "the same mechanism class" — which is the reasoning D17's
    // remote half got wrong. Whether Cloud offers some OTHER orphan-visible
    // surface (the S3 endpoint is UNPROBED) stays unsettled.
    const noDocker = join(tmpdir(), 'dm5-s5-no-docker-on-path')
    const realPath = process.env.PATH
    await replant()
    const cap7 = await runCapture(tmp('cap7'))
    const under2 = JSON.parse(readFileSync(tmp('cap7'), 'utf8'))
    under2.buckets[bucket].keys.pop()
    under2.buckets[bucket].keyCount = under2.buckets[bucket].keys.length
    writeFileSync(tmp('under2'), JSON.stringify(under2), 'utf8')
    const over2 = JSON.parse(readFileSync(tmp('cap7'), 'utf8'))
    over2.buckets[bucket].keys = [...over2.buckets[bucket].keys, 'ghost/never-existed.bin']
    over2.buckets[bucket].keyCount = over2.buckets[bucket].keys.length
    writeFileSync(tmp('over2'), JSON.stringify(over2), 'utf8')

    let blindUnder, blindOver, blindCapture
    try {
      process.env.PATH = noDocker
      if (locateVolume().available) throw new Error('could not force the no-local-proof branch — the arm would be vacuous')
      blindCapture = await runCapture(tmp('cap8'))
      blindUnder = await runDelete(tmp('under2'))
    } finally {
      process.env.PATH = realPath
    }
    const survivedBlind = volOf()
    check(
      'R6 ⛔ WITHOUT the local proof an UNDER-COUNT delete reports SUCCESS (exit 0) while a real file SURVIVES',
      blindUnder.exit === 0 && survivedBlind.files === 1 && /LOCAL PROOF UNAVAILABLE/.test(blindUnder.out) &&
        !/MISSED BY THE MANIFEST/.test(blindUnder.out),
      `exit=${blindUnder.exit} (R3b, same manifest shape WITH the proof, exited 1) surviving_volume_files=${survivedBlind.files}`,
    )
    check(
      'R6-capture WITHOUT the local proof, capture cannot judge at all — UNVERIFIED_NO_LOCAL_PROOF, exit 1',
      blindCapture.exit === 1 && blindCapture.manifest.buckets[bucket].verdict === 'UNVERIFIED_NO_LOCAL_PROOF',
      `exit=${blindCapture.exit} verdict=${blindCapture.manifest.buckets[bucket].verdict}`,
    )
    // The other direction — the control that DOES survive. Without this, R6
    // reads as "nothing works on Cloud", which is false and would be its own
    // vacuity: the count comparison is Storage-API-only and transfers intact.
    await replant()
    try {
      process.env.PATH = noDocker
      blindOver = await runDelete(tmp('over2'))
    } finally {
      process.env.PATH = realPath
    }
    check(
      'R6b the OVER-COUNT refusal SURVIVES without the local proof (the count comparison is API-only)',
      blindOver.exit === 1 && /COUNT MISMATCH/.test(blindOver.out),
      `exit=${blindOver.exit}`,
    )

    // ---- R3d: the THIRD classifier arm — INDETERMINATE ---------------------
    //
    // ⭐ The S5 message fix has THREE outcomes; R3b and R3c cover two. This is
    // the third, and it had no control anywhere in this tool. Step 0 named the
    // state precisely — bucket ROW ABSENT while BYTES REMAIN — as never having
    // been observed, with no control that constructs it, because `verdictFor()`
    // short-circuits to BUCKET_ABSENT before it ever consults the volume proof.
    // It is reachable here: with the row gone, the re-list THROWS, so the
    // classifier genuinely cannot tell a missed key from an orphan.
    //
    // The assertion pins the EXIT CODE next to the wording deliberately. A
    // frightening message that exits 0 is the same defect one layer down — the
    // shape this whole message fix exists to remove — so "says INDETERMINATE"
    // and "exits 1" are asserted as one property, not two.
    //
    // The manifest here is the DEGENERATE shape S4 actually produced in
    // production: `exists: true` with zero keys. So the count comparison MATCHES
    // (0 deleted of 0 listed) and, once again, only the byte side objects.
    await replant()
    const preAbsent = await listBucketKeys(admin, bucket)
    if (preAbsent.length) await admin.storage.from(bucket).remove(preAbsent)
    const { error: dbe } = await admin.storage.deleteBucket(bucket)
    if (dbe) throw new Error(`R3d could not drop the bucket row: ${dbe.message}`)
    // Bytes planted AFTER the row is gone, so no Storage-service cleanup can
    // race them away, and no metadata row can exist for them by construction.
    docker(['exec', loc.container, 'sh', '-c',
      `mkdir -p '${loc.root}/${bucket}/ghosttown/absent.bin' && printf 'orphan' > '${loc.root}/${bucket}/ghosttown/absent.bin/${randomUUID()}'`])
    const absentVol = volOf()
    writeFileSync(tmp('absent'), JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      capturedAt: new Date().toISOString(),
      buckets: { [bucket]: { exists: true, keyCount: 0, keys: [] } },
    }), 'utf8')
    const absentRun = await runDelete(tmp('absent'))
    check(
      'R3d INDETERMINATE arm: row ABSENT + bytes PRESENT ⇒ refuses to classify, SAYS so, and the EXIT CODE agrees (1)',
      absentVol.present && absentVol.files === 1 && absentRun.exit === 1 &&
        /INDETERMINATE/.test(absentRun.out) && /DO NOT PROCEED/.test(absentRun.out) &&
        !/PRE-EXISTING METADATA-LESS ORPHANS/.test(absentRun.out) && !/MISSED BY THE MANIFEST/.test(absentRun.out),
      `exit=${absentRun.exit} volume_files=${absentVol.files} classified_as=` +
        `${/INDETERMINATE/.test(absentRun.out) ? 'INDETERMINATE' : 'something-else'}`,
    )
    // Restore the row so R5's verified teardown runs its normal path rather than
    // erroring on a missing bucket and reporting a cleanup failure that isn't one.
    const { error: rce } = await admin.storage.createBucket(bucket, { public: false })
    if (rce) throw new Error(`R3d could not restore the bucket row for teardown: ${rce.message}`)
  } catch (e) {
    console.error(`\nrehearsal error: ${String(e)}`)
    check('REHEARSAL COMPLETED WITHOUT ERROR', false, String(e))
  } finally {
    // ---- R5: cleanup, and VERIFY it — a disposal rehearsal that leaves
    // orphans behind refutes itself.
    let cleanupDetail = ''
    let cleanupOk = false
    try {
      const left = await listBucketKeys(admin, bucket)
      if (left.length) await admin.storage.from(bucket).remove(left)
      await admin.storage.deleteBucket(bucket)
      docker(['exec', loc.container, 'sh', '-c', `rm -rf ${loc.root}/${assertDisposableBucket(bucket)}`])
      const rowGone = Number(dbExec(db, `select count(*) from storage.buckets where id = '${bucket}';`).stdout) === 0
      const objGone = Number(dbExec(db, `select count(*) from storage.objects where bucket_id = '${bucket}';`).stdout) === 0
      const volGone = volOf().present === false
      // Verified through the tool's OWN eyes as well, exercising the S5 verdict
      // fix: row absent + no bytes must read BUCKET_ABSENT and CLEAN.
      const capZ = await runCapture(tmp('cleanup'))
      const vz = capZ.manifest.buckets[bucket].verdict
      cleanupOk = rowGone && objGone && volGone && capZ.exit === 0 && vz === 'BUCKET_ABSENT'
      cleanupDetail = `bucket_row_gone=${rowGone} objects_gone=${objGone} volume_dir_absent=${volGone} recapture=${vz}/exit${capZ.exit}`
    } catch (e) {
      cleanupDetail = `cleanup error: ${String(e)}`
    }
    check('R5 CLEANUP VERIFIED: bucket row gone, metadata gone, volume directory ABSENT', cleanupOk, cleanupDetail)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} rehearsal controls passed`)
  console.log(
    '\nDOMAIN: LOCAL stack only. A green rehearsal here does NOT license the Cloud sequence — R2 and the\n' +
      'byte-side half of R3b depend on the local volume proof (STORAGE_BACKEND=file + a docker container on\n' +
      'the operator\'s machine), neither of which exists against Supabase Cloud. See the S5 record.',
  )
  if (failed.length) {
    console.log('⛔ REHEARSAL FAILED — the deploy-time byte path is NOT rehearsed.')
    process.exitCode = 1
    return
  }
  console.log('✅ REHEARSAL PASSED — capture → delete --execute → re-capture ran against real bytes WITH metadata rows.')
  process.exitCode = 0
}

// ---------------------------------------------------------------------------
// flag validation — FUP-DM5-MANIFEST-FLAG
//
// ⭐ The filed incident: `capture --manifest <path>` (the flag `delete` takes,
// not the one `capture` takes) did not error. `argFlag` found no `--out`,
// returned undefined, `?? DEFAULT_MANIFEST` took over, and the run OVERWROTE
// `supabase/manifests/dm5-retirement-baseline.json` — the committed, authoritative
// enumeration of what existed immediately before an irreversible deletion.
// Reproduced deliberately at S5 before this fix (exit 0, scratch path never
// written, baseline blob hash changed c4cf429→217e55e, restored with
// `git checkout` and re-verified byte-identical). The diff showed what was at
// stake: the S0 baseline's 221 enumerated orphan keys replaced by an
// all-BUCKET_ABSENT post-retirement capture — not merely a clobbered file, the
// destruction of the only record of WHICH files existed.
//
// ⚠ A SECOND instance of the same footgun, found while fixing the first and not
// named in the follow-up: `argFlag` returns `argv[i + 1]` blindly, so
// `capture --out` (value omitted, flag last) and `capture --out --allow-orphans`
// (next token is another flag) BOTH resolve wrong — the first silently falls
// back to DEFAULT_MANIFEST, the second writes a manifest to a file literally
// named `--allow-orphans`. A value-taking flag with no value is therefore an
// error here, not a fallback.
// ---------------------------------------------------------------------------
const FLAG_SPEC = {
  capture: { value: ['--out', '--buckets'], boolean: ['--allow-orphans'] },
  verify: { value: ['--manifest'], boolean: [] },
  walk: { value: ['--buckets'], boolean: [] },
  delete: { value: ['--manifest'], boolean: ['--execute'] },
  selftest: { value: [], boolean: [] },
  rehearse: { value: [], boolean: [] },
}

/**
 * Returns an array of human-readable errors; empty means the argv is acceptable.
 * Exported shape (pure, argv in / errors out) so `selftest` can assert BOTH
 * polarities directly rather than shelling out.
 */
function flagErrors(cmd, argv) {
  const spec = FLAG_SPEC[cmd]
  if (!spec) return [`unknown command: ${cmd}`]
  const known = new Set([...spec.value, ...spec.boolean])
  const errors = []
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i]
    if (!tok.startsWith('--')) {
      errors.push(`unexpected positional argument "${tok}" — this tool takes flags only`)
      continue
    }
    if (!known.has(tok)) {
      const alt = Object.entries(FLAG_SPEC)
        .filter(([c, s]) => c !== cmd && [...s.value, ...s.boolean].includes(tok))
        .map(([c]) => c)
      errors.push(
        `unknown flag "${tok}" for "${cmd}"` +
          (alt.length ? ` — that is ${alt.map((c) => `"${c}"`).join('/')}'s flag` : '') +
          `. Accepted: ${[...known].join(' ') || '(none)'}`,
      )
      continue
    }
    if (spec.value.includes(tok)) {
      const v = argv[i + 1]
      if (v === undefined || v.startsWith('--')) {
        errors.push(`flag "${tok}" requires a value${v === undefined ? '' : ` (got the flag "${v}")`}`)
        continue
      }
      i += 1 // consume the value so it is not parsed as a token
    }
  }
  return errors
}

function argFlag(argv, name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const [, , cmd, ...argv] = process.argv
if (FLAG_SPEC[cmd]) {
  const errors = flagErrors(cmd, argv)
  if (errors.length) {
    for (const e of errors) console.error(`⛔ ${e}`)
    console.error(
      '\nRefusing to run. This tool writes the authoritative pre-deletion record; a ' +
        'wrong-but-plausible flag must not silently fall back to a default path (FUP-DM5-MANIFEST-FLAG).',
    )
    process.exit(2)
  }
}
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
  case 'rehearse':
    await cmdRehearse(argv)
    break
  default:
    console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n/, ''))
    process.exitCode = cmd ? 2 : 0
}
