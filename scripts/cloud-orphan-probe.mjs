#!/usr/bin/env node
/**
 * cloud-orphan-probe.mjs — FUP-DM5-CLOUD-ORPHAN-SURFACE.
 *
 * QUESTION (the only one this tool answers): on Supabase **Cloud**, does ANY
 * customer-reachable surface enumerate or serve a **byte-orphan** — a file in the
 * storage backing store with **no `storage.objects` row**?
 *
 * METHOD, as ruled by DM-FUP TRIAGE #1 (2026-08-18): **CONSTRUCT an orphan; do not
 * probe for one.** The remote holds 0 objects, so a read-only probe can only show
 * that an endpoint *answers* — never that it would *reveal*. A detector run against
 * a population with nothing to find returns clean either way.
 *
 * EVERY surface is measured against these objects, in BOTH states:
 *     control.bin        — uploaded, metadata row LEFT INTACT -> the positive control
 *     orphan.bin         — uploaded, metadata row DELETED     -> the enumeration subject
 *     retrieval-only.bin — uploaded, metadata row DELETED, and NEVER requested until
 *                          the after-state -> the retrieval subject (CDN-proof; see
 *                          the RETRIEVAL note below)
 *   A surface that does not see `control.bin` is INVALID, not a "no". Without that
 *   arm a broken signature, a wrong bucket or a typo'd prefix reads as "Cloud
 *   exposes no orphan surface" — the exact vacuity this record keeps paying for.
 *   See docs/progress/follow-ups-open.md - FUP-DM5-CLOUD-ORPHAN-SURFACE.
 *
 * DOMAIN GUARD: Cloud only, and only the project whose ref is passed in. The
 * sibling failure in `storage-manifest.mjs` (`locateVolume()` finding the wrong
 * project's volume by container name) was *worse than no proof* — a proof about the
 * wrong bytes passes silently. So this script refuses a local origin, refuses a
 * host/ref mismatch, refuses keys minted for another project, and prints the ref it
 * is actually measuring.
 *
 * The `storage.objects` DELETE is NOT done here: it needs SQL against the linked
 * project, and it is guarded platform-side by `storage.protect_delete`. `construct`
 * prints the exact statement; run it through the sanctioned SQL path, then verify
 * before `measure`. The phases are deliberately separate so every mutating step on
 * a production project is a visible, individually authorized act.
 *
 * USAGE
 *   node scripts/cloud-orphan-probe.mjs preflight
 *   node scripts/cloud-orphan-probe.mjs construct
 *   node scripts/cloud-orphan-probe.mjs measure  --orphan-confirmed
 *   node scripts/cloud-orphan-probe.mjs cleanup
 *   node scripts/cloud-orphan-probe.mjs report
 *
 * CREDENTIALS (env; nothing is read from .env.local implicitly — pass them):
 *   PROBE_PROJECT_REF        required, e.g. azkbbhskturikxpgmafq
 *   PROBE_REGION             default sa-east-1
 *   PROBE_ANON_KEY           required — legacy JWT anon key (S3 session-token auth)
 *   PROBE_SERVICE_ROLE_KEY   required — legacy JWT service_role key
 *   PROBE_S3_ACCESS_KEY_ID   optional — dashboard-minted S3 key (2nd auth mode)
 *   PROBE_S3_SECRET_KEY      optional
 *   PROBE_STATE_DIR          default: OS temp
 */

import { createHmac, createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'

// -- config -------------------------------------------------------------------
const REF = process.env.PROBE_PROJECT_REF || ''
const ANON = process.env.PROBE_ANON_KEY || ''
const SRK = process.env.PROBE_SERVICE_ROLE_KEY || ''
const S3_ID = process.env.PROBE_S3_ACCESS_KEY_ID || ''
const S3_SECRET = process.env.PROBE_S3_SECRET_KEY || ''

// REHEARSAL runs the whole instrument against the LOCAL stack. It exists to prove
// the tool can find something before its one-shot run on a production project — the
// standing lesson that a detector which has never found anything has not been shown
// able to. It is NOT a measurement: a local stack cannot answer a question about
// Cloud, and every phase says so and refuses to emit a Cloud verdict.
const REHEARSAL = process.env.PROBE_ALLOW_LOCAL_REHEARSAL === '1'
const LOCAL_URL = process.env.PROBE_LOCAL_URL || 'http://127.0.0.1:54321'
const REGION = process.env.PROBE_REGION || (REHEARSAL ? 'local' : 'sa-east-1')
const STATE_DIR =
  process.env.PROBE_STATE_DIR || join(tmpdir(), 'cloud-orphan-probe')
const STATE_FILE = join(
  STATE_DIR,
  REHEARSAL ? 'state-rehearsal.json' : 'state.json',
)

const API = REHEARSAL ? LOCAL_URL : `https://${REF}.supabase.co` // REST storage API
const S3_ORIGIN = REHEARSAL ? LOCAL_URL : `https://${REF}.storage.supabase.co` // direct storage hostname (docs)
const S3_BASE = '/storage/v1/s3'

const CONTROL = 'control.bin'
const ORPHAN = 'orphan.bin'
// The retrieval arm needs its OWN subject, because a CDN sits in front of Cloud GETs
// and a cache-buster query param does NOT defeat it (measured: `cf-cache-status: HIT`
// survived a unique `?probe_cb=`). The only reliable defense is a path that has never
// been requested at all, so this object is uploaded, its row deleted, and it is GET
// exactly once — in the after-state. Its proof-of-life comes from the control.
const RETRIEVAL = 'retrieval-only.bin'

// -- small helpers ------------------------------------------------------------
const die = (m) => {
  console.error(`\nSTOP: ${m}\n`)
  process.exit(1)
}
const ok = (m) => console.log(`  [ok]   ${m}`)
const no = (m) => console.log(`  [!!]   ${m}`)
const info = (m) => console.log(`  ...    ${m}`)
const hr = (t) => console.log(`\n${'-'.repeat(78)}\n${t}\n${'-'.repeat(78)}`)

function jwtClaims(token, label) {
  try {
    const p = token.split('.')[1]
    return JSON.parse(
      Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf8',
      ),
    )
  } catch {
    return die(
      `${label} is not a decodable JWT (this probe needs the LEGACY key format)`,
    )
  }
}

function loadState() {
  if (!existsSync(STATE_FILE))
    die(`no run state at ${STATE_FILE} — run \`construct\` first`)
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}
function saveState(s) {
  mkdirSync(STATE_DIR, { recursive: true })
  const body = JSON.stringify(s, null, 2) + '\n'
  writeFileSync(STATE_FILE, body) // latest-run pointer
  // Per-run copy, never overwritten by a LATER run. A first run of this probe
  // produced an anomalous arm result whose raw output was destroyed by the re-run
  // that followed, leaving it permanently unexplainable — the same loss recorded in
  // FUP-GATE-PDFP1-FLAKE. Evidence outlives the run that produced it.
  writeFileSync(join(STATE_DIR, `run-${s.runId}.json`), body)
}

// -- DOMAIN GUARD -------------------------------------------------------------
// Refuse anything that is not the named Cloud project. A measurement of the wrong
// project would still print a clean verdict — that is the failure mode guarded here.
function assertDomain() {
  if (REHEARSAL) {
    const u = new URL(API)
    if (!/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) {
      die(
        `REHEARSAL mode is LOCAL-ONLY, but PROBE_LOCAL_URL points at ${u.hostname}.\n` +
          '   Rehearsal against a remote origin would construct a real orphan while labelling\n' +
          '   the run "not a measurement" — the worst of both. Refusing.',
      )
    }
    if (!ANON || !SRK)
      die(
        'REHEARSAL still needs PROBE_ANON_KEY / PROBE_SERVICE_ROLE_KEY (the LOCAL stack keys)',
      )
    console.log(
      '\n*** REHEARSAL — INSTRUMENT TEST ONLY, LOCAL STACK. This run CANNOT answer the',
    )
    console.log(
      `*** Cloud question and will not emit a Cloud verdict. Origin: ${API}\n`,
    )
    return {
      anonClaims: jwtClaims(ANON, 'PROBE_ANON_KEY'),
      srkClaims: jwtClaims(SRK, 'PROBE_SERVICE_ROLE_KEY'),
    }
  }
  if (!REF)
    die(
      'PROBE_PROJECT_REF is required — this probe refuses to guess its subject',
    )
  if (!/^[a-z]{20}$/.test(REF))
    die(`PROBE_PROJECT_REF "${REF}" is not a Supabase project ref`)
  if (!ANON) die('PROBE_ANON_KEY is required (S3 session-token auth secret)')
  if (!SRK) die('PROBE_SERVICE_ROLE_KEY is required')
  const u = new URL(API)
  if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) {
    die(
      'this probe is CLOUD-ONLY — a local origin cannot answer the Cloud question',
    )
  }
  if (!u.hostname.startsWith(`${REF}.`))
    die(`host ${u.hostname} does not belong to ref ${REF}`)

  const a = jwtClaims(ANON, 'PROBE_ANON_KEY')
  const s = jwtClaims(SRK, 'PROBE_SERVICE_ROLE_KEY')
  if (a.role !== 'anon')
    die(`PROBE_ANON_KEY carries role="${a.role}", expected "anon"`)
  if (s.role !== 'service_role')
    die(
      `PROBE_SERVICE_ROLE_KEY carries role="${s.role}", expected "service_role"`,
    )
  if (a.ref !== REF)
    die(`PROBE_ANON_KEY is for project "${a.ref}", not "${REF}"`)
  if (s.ref !== REF)
    die(`PROBE_SERVICE_ROLE_KEY is for project "${s.ref}", not "${REF}"`)
  const now = Math.floor(Date.now() / 1000)
  for (const [k, c] of [
    ['anon', a],
    ['service_role', s],
  ]) {
    if (c.exp && c.exp < now)
      die(`${k} key expired ${new Date(c.exp * 1000).toISOString()}`)
  }
  return { anonClaims: a, srkClaims: s }
}

// -- Storage REST API (service_role — bypasses RLS) ---------------------------
const restHeaders = (extra = {}) => ({
  apikey: SRK,
  authorization: `Bearer ${SRK}`,
  ...extra,
})

async function rest(method, path, { body, json, raw } = {}) {
  const headers = restHeaders(
    json
      ? { 'content-type': 'application/json' }
      : body
        ? { 'content-type': 'application/octet-stream' }
        : {},
  )
  const res = await fetch(`${API}/storage/v1${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : body,
  })
  const bytes = raw ? Buffer.from(await res.arrayBuffer()) : null
  const text = raw
    ? bytes.toString('utf8').slice(0, 500)
    : await res.text().catch(() => '')
  return {
    status: res.status,
    ok: res.ok,
    text,
    bytes,
    cache: res.headers.get('cf-cache-status'),
  }
}

// -- AWS SigV4 (hand-rolled: no @aws-sdk dependency) --------------------------
// A wrong signature returns 403 SignatureDoesNotMatch — LOUD, and distinguishable
// from "listed nothing". The control arm catches the quiet failures.
const sha256hex = (d) => createHash('sha256').update(d).digest('hex')
const hmac = (k, d) => createHmac('sha256', k).update(d).digest()

function sigv4Get({
  origin,
  path,
  query,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  region,
  service = 's3',
}) {
  const host = new URL(origin).host // includes :port, which SigV4 requires in the host header
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // 20260818T101112Z
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256hex('')

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (sessionToken) headers['x-amz-security-token'] = sessionToken

  const signedHeaders = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()
    .join(';')
  const canonicalHeaders = Object.keys(headers)
    .map((h) => [h.toLowerCase(), String(headers[h]).trim()])
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([k, v]) => `${k}:${v}\n`)
    .join('')

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join('\n')

  let key = hmac(`AWS4${secretAccessKey}`, dateStamp)
  key = hmac(key, region)
  key = hmac(key, service)
  key = hmac(key, 'aws4_request')
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex')

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { headers, url: `${origin}${path}?${canonicalQuery}` }
}

async function s3List({ bucket, prefix, mode }) {
  // Session-token auth (docs): access_key_id = project_ref, secret = anonKey,
  // session_token = a valid JWT. Locally the id is the literal string `stub`.
  const creds =
    mode === 'accesskey'
      ? { accessKeyId: S3_ID, secretAccessKey: S3_SECRET, sessionToken: null }
      : {
          accessKeyId: REHEARSAL ? 'stub' : REF,
          secretAccessKey: ANON,
          sessionToken: SRK,
        }
  const { headers, url } = sigv4Get({
    origin: S3_ORIGIN,
    path: `${S3_BASE}/${bucket}`,
    query: { 'list-type': '2', prefix },
    region: REGION,
    ...creds,
  })
  const res = await fetch(url, { headers })
  const body = await res.text()
  const keys = [...body.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1])
  return { status: res.status, keys, body }
}

// -- surface measurement ------------------------------------------------------
// Each surface answers the SAME two questions, so a "no" is only ever reportable
// alongside a proven-working detector.
function classify(name, controlSeen, orphanSeen, detail) {
  let verdict
  if (!controlSeen)
    verdict = 'INVALID' // detector unproven — NOT a "no"
  else if (orphanSeen)
    verdict = 'ORPHAN-VISIBLE' // Cloud CAN see a byte-orphan
  else verdict = 'METADATA-BOUND' // sees only what has a row
  return { surface: name, controlSeen, orphanSeen, verdict, detail }
}

async function measureSurfaces(state, phase) {
  const { bucket, prefix } = state
  const results = []

  // S1 — S3 protocol, session-token auth (project_ref / anon / service_role JWT).
  {
    const r = await s3List({ bucket, prefix, mode: 'session' })
    const hit = (n) => r.keys.some((k) => k.endsWith(n))
    results.push(
      classify(
        'S3 ListObjectsV2 (session-token auth)',
        hit(CONTROL),
        hit(ORPHAN),
        `HTTP ${r.status}; keys=[${r.keys.join(', ')}]${r.status >= 400 ? ` body=${r.body.slice(0, 400)}` : ''}`,
      ),
    )
  }

  // S1b — S3 protocol, dashboard access keys. A different auth path may be a
  // different code path; measured separately rather than assumed equivalent.
  if (S3_ID && S3_SECRET) {
    const r = await s3List({ bucket, prefix, mode: 'accesskey' })
    const hit = (n) => r.keys.some((k) => k.endsWith(n))
    results.push(
      classify(
        'S3 ListObjectsV2 (dashboard access keys)',
        hit(CONTROL),
        hit(ORPHAN),
        `HTTP ${r.status}; keys=[${r.keys.join(', ')}]${r.status >= 400 ? ` body=${r.body.slice(0, 400)}` : ''}`,
      ),
    )
  } else {
    results.push({
      surface: 'S3 ListObjectsV2 (dashboard access keys)',
      controlSeen: null,
      orphanSeen: null,
      verdict: 'NOT RUN',
      detail: 'PROBE_S3_ACCESS_KEY_ID / PROBE_S3_SECRET_KEY not supplied',
    })
  }

  // S2 — Storage REST list (what supabase-js `.list()` and the dashboard explorer use).
  {
    const r = await rest('POST', `/object/list/${bucket}`, {
      json: { prefix, limit: 100, offset: 0 },
    })
    let names = []
    try {
      names = JSON.parse(r.text).map((o) => o.name)
    } catch {
      /* non-JSON body kept in detail */
    }
    results.push(
      classify(
        'Storage REST /object/list (service_role)',
        names.includes(CONTROL),
        names.includes(ORPHAN),
        `HTTP ${r.status}; names=[${names.join(', ')}]${r.status >= 400 ? ` body=${r.text.slice(0, 300)}` : ''}`,
      ),
    )
  }

  // S3d — DOWNLOAD, not enumeration. The consequential arm: if the byte still serves
  // with no metadata row, the orphan is an EGRESS path, not merely a listing entry.
  //
  // MEASURED 2026-08-18, and it inverted this arm's first result. Cloud fronts these
  // GETs with a CDN; the before-state GET — this probe's own proof-of-life — populated
  // that cache, so the after-state GET was served a cached 200 for a byte the origin
  // was already refusing, and the arm reported ORPHAN-VISIBLE. The detector's positive
  // control contaminated its own subject. A `?cb=` param does NOT fix it (HIT survived
  // one). So the two phases use DIFFERENT objects: the before-state proves retrieval
  // works on `orphan.bin` while it still has a row; the after-state asks about
  // `retrieval-only.bin`, whose path is requested for the first time ever at that
  // moment, so no cache entry for it can exist. Do not collapse these back into one.
  {
    const subject = phase === 'before' ? ORPHAN : RETRIEVAL
    const c = await rest('GET', `/object/${bucket}/${prefix}/${CONTROL}`, {
      raw: true,
    })
    const o = await rest('GET', `/object/${bucket}/${prefix}/${subject}`, {
      raw: true,
    })
    results.push(
      classify(
        'Storage REST GET /object (byte retrieval, service_role)',
        c.status === 200,
        o.status === 200,
        `control HTTP ${c.status} (${c.bytes?.length ?? 0} B) - subject ${subject} HTTP ${o.status} ` +
          `(${o.bytes?.length ?? 0} B) cf-cache=${o.cache ?? 'n/a'}`,
      ),
    )
  }

  // S4 — the CLI, asked whether it differs from a `storage.objects` query.
  {
    let detail
    let controlSeen = false
    let orphanSeen = false
    // `--linked` targets the REMOTE. In a local rehearsal that would enumerate a
    // different stack than the one holding the orphan and quietly report "not seen".
    const target = REHEARSAL ? '--local' : '--linked'
    try {
      // Node >=20 refuses to spawn a bare `.cmd` without a shell (EINVAL), so Windows
      // needs shell:true here. All arguments are script-generated, never user input.
      const out = execFileSync(
        'npx',
        [
          '--yes',
          'supabase',
          'storage',
          'ls',
          '-r',
          `ss:///${bucket}`,
          target,
          '--experimental',
        ],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 180000,
          shell: process.platform === 'win32',
        },
      )
      controlSeen = out.includes(CONTROL)
      orphanSeen = out.includes(ORPHAN)
      detail = `stdout: ${out.trim().split('\n').join(' | ').slice(0, 400)}`
    } catch (e) {
      detail = `CLI failed: ${(e.stderr || e.message || '').toString().trim().slice(0, 300)}`
    }
    // The label names the flag actually passed: a surface labelled `--linked` while
    // `--local` ran is a record that misstates its own subject.
    results.push(
      classify(
        `supabase storage ls ${target} --experimental`,
        controlSeen,
        orphanSeen,
        detail,
      ),
    )
  }

  return results
}

// -- phases -------------------------------------------------------------------
async function preflight() {
  hr('PREFLIGHT — read-only')
  const { anonClaims, srkClaims } = assertDomain()
  info(
    `subject             : ${REHEARSAL ? 'LOCAL STACK (rehearsal — not a measurement)' : `project ${REF}`}   (region ${REGION})`,
  )
  info(`REST API            : ${API}`)
  info(`S3 endpoint         : ${S3_ORIGIN}${S3_BASE}`)
  info(
    `anon key            : role=${anonClaims.role} exp=${anonClaims.exp ? new Date(anonClaims.exp * 1000).toISOString() : 'none'}`,
  )
  info(
    `service_role key    : role=${srkClaims.role} exp=${srkClaims.exp ? new Date(srkClaims.exp * 1000).toISOString() : 'none'}`,
  )
  info(
    `S3 access keys      : ${S3_ID && S3_SECRET ? 'supplied (2nd auth mode WILL run)' : 'absent (2nd auth mode NOT RUN)'}`,
  )

  const b = await rest('GET', '/bucket')
  if (!b.ok) die(`bucket list failed: HTTP ${b.status} ${b.text.slice(0, 200)}`)
  const buckets = JSON.parse(b.text)
  ok(
    `REST reachable — ${buckets.length} buckets: ${buckets.map((x) => x.id).join(', ')}`,
  )

  // Does the S3 endpoint answer at all, with the credentials we hold?
  for (const mode of S3_ID && S3_SECRET
    ? ['session', 'accesskey']
    : ['session']) {
    const s = await s3List({
      bucket: buckets[0]?.id ?? 'none',
      prefix: '__probe_preflight__',
      mode,
    })
    if (s.status === 200)
      ok(
        `S3 endpoint answers with ${mode} auth (HTTP 200, ${s.keys.length} keys for a nonexistent prefix)`,
      )
    else no(`S3 ${mode} auth: HTTP ${s.status} — ${s.body.slice(0, 300)}`)
  }
  console.log(
    '\nAn endpoint that ANSWERS has proved nothing about orphans. That is what `construct` is for.\n',
  )
}

async function construct() {
  hr(
    `CONSTRUCT — writes to ${REHEARSAL ? 'the LOCAL stack' : 'the linked project'}`,
  )
  assertDomain()
  const runId =
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' +
    randomBytes(3).toString('hex')
  const bucket = `orphan-probe-${runId}`
  const prefix = 'probe'

  const mk = await rest('POST', '/bucket', {
    json: { id: bucket, name: bucket, public: false },
  })
  if (!mk.ok)
    die(`bucket create failed: HTTP ${mk.status} ${mk.text.slice(0, 300)}`)
  ok(`scratch bucket created: ${bucket} (private)`)

  // Synthetic, non-PHI. Self-describing so a stray survivor is identifiable.
  const payload = (which) =>
    Buffer.from(
      `SYNTHETIC NON-PHI PROBE BYTE — FUP-DM5-CLOUD-ORPHAN-SURFACE\nrun=${runId} role=${which}\n` +
        'If you are reading this outside a probe run, it is RESIDUE: delete it and reopen the item.\n',
    )

  for (const name of [CONTROL, ORPHAN, RETRIEVAL]) {
    const up = await rest('POST', `/object/${bucket}/${prefix}/${name}`, {
      body: payload(name),
    })
    if (!up.ok)
      die(`upload ${name} failed: HTTP ${up.status} ${up.text.slice(0, 300)}`)
    ok(`uploaded ${prefix}/${name} (${payload(name).length} B)`)
  }

  const state = {
    runId,
    bucket,
    prefix,
    control: CONTROL,
    orphan: ORPHAN,
    ref: REHEARSAL ? 'LOCAL-REHEARSAL' : REF,
    rehearsal: REHEARSAL,
    region: REGION,
    constructedAt: new Date().toISOString(),
    before: null,
    after: null,
  }

  // BEFORE-state: every surface must see BOTH objects while both have rows. This is
  // the detector's proof-of-life at full strength; the after-state's control arm
  // then isolates the single variable that changed.
  console.log(
    '\n  Measuring BEFORE state (both objects have metadata rows) ...',
  )
  state.before = await measureSurfaces(state, 'before')
  for (const r of state.before)
    console.log(
      `    ${r.verdict.padEnd(15)} ${r.surface}  (control=${r.controlSeen} orphan=${r.orphanSeen})`,
    )
  saveState(state)

  hr(
    `NEXT STEP — run this SQL against ${REHEARSAL ? 'the LOCAL database' : 'the linked project'}, then verify`,
  )
  console.log(`-- 1. CAPTURE THE ROW FIRST. Cleanup has to restore it with its ORIGINAL \`version\`:
--    the Storage API deletes the backing path <bucket>/<name>/<version>, so a restore
--    that invents a version deletes nothing and leaves the byte behind — this probe
--    would then ADD to the orphan population it was measuring. Record this output.
select name, id, version, owner, metadata from storage.objects
where bucket_id = '${bucket}' and name in ('${prefix}/${ORPHAN}', '${prefix}/${RETRIEVAL}')
order by name;

-- 2. Construct the byte-orphan: remove the metadata row, leave the byte.
--    storage.protect_delete blocks a bare DELETE; the GUC is set LOCAL inside a single
--    DO block so it cannot leak past this statement (a top-level \`set local\` outside a
--    transaction is a silent no-op — see lint:set-local / FUP-DM5-SETLOCAL-MIGRATION).
do $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
  where bucket_id = '${bucket}' and name in ('${prefix}/${ORPHAN}', '${prefix}/${RETRIEVAL}');
end $$;

-- 3. VERIFY before measuring — ONLY control.bin should remain:
select name, version from storage.objects where bucket_id = '${bucket}' order by name;
`)
  console.log(
    'Then: node scripts/cloud-orphan-probe.mjs measure --orphan-confirmed\n',
  )
}

async function measure() {
  hr('MEASURE — after-state')
  assertDomain()
  if (!process.argv.includes('--orphan-confirmed')) {
    die(
      'refusing to measure: pass --orphan-confirmed only AFTER a `storage.objects` query has shown\n' +
        '   the control row PRESENT and the orphan row ABSENT. Measuring an unconstructed orphan\n' +
        '   returns "no orphan visible" from every surface and reads exactly like a real answer.',
    )
  }
  const state = loadState()
  const expected = REHEARSAL ? 'LOCAL-REHEARSAL' : REF
  if (state.ref !== expected)
    die(
      `state file is for "${state.ref}", this invocation is for "${expected}"`,
    )
  state.after = await measureSurfaces(state, 'after')
  state.measuredAt = new Date().toISOString()
  saveState(state)

  console.log(`\nBucket ${state.bucket}, prefix ${state.prefix}/\n`)
  for (const r of state.after) {
    const line = `${r.verdict.padEnd(15)} ${r.surface}`
    if (r.verdict === 'ORPHAN-VISIBLE') no(line)
    else if (r.verdict === 'METADATA-BOUND') ok(line)
    else info(line)
    console.log(`         control=${r.controlSeen} orphan=${r.orphanSeen}`)
    console.log(`         ${r.detail}`)
  }

  // PROOF-OF-LIFE, checked before any verdict is read: in the BEFORE state both
  // objects had rows, so a surface that failed to see BOTH there has never been
  // shown able to see this object at all, and its AFTER "not seen" is worthless.
  hr('INSTRUMENT — proof-of-life from the BEFORE state (both objects had rows)')
  const proven = new Set()
  for (const b of state.before ?? []) {
    if (b.verdict === 'NOT RUN') continue
    const live = b.controlSeen && b.orphanSeen
    if (live) proven.add(b.surface)
    ;(live ? ok : no)(
      `${live ? 'PROVEN  ' : 'UNPROVEN'} ${b.surface} (control=${b.controlSeen} orphan=${b.orphanSeen})`,
    )
  }

  const valid = state.after.filter(
    (r) => r.verdict !== 'NOT RUN' && proven.has(r.surface),
  )
  const unproven = state.after.filter(
    (r) => r.verdict !== 'NOT RUN' && !proven.has(r.surface),
  )
  const invalid = valid.filter((r) => r.verdict === 'INVALID')
  const visible = valid.filter((r) => r.verdict === 'ORPHAN-VISIBLE')

  hr(
    REHEARSAL
      ? 'REHEARSAL RESULT — instrument only, NOT a Cloud answer'
      : 'VERDICT',
  )
  if (unproven.length) {
    console.log(
      `${unproven.length} surface(s) never saw either object even WITH rows present, so their`,
    )
    console.log(
      `  after-state says nothing: ${unproven.map((u) => u.surface).join(', ')}\n`,
    )
  }
  if (invalid.length) {
    console.log(
      `WARNING: ${invalid.length} surface(s) INVALID — the detector lost sight of the CONTROL between`,
    )
    console.log(
      '  the two states, so the run changed more than the one variable. Not a "no".\n',
    )
  }
  if (REHEARSAL) {
    console.log(
      `Instrument: ${proven.size} surface(s) proved able to see an object that exists, and the`,
    )
    console.log(
      `construct/measure/cleanup sequence executed end to end against a real stack.`,
    )
    console.log(
      `Local orphan visibility (${visible.length} surface(s): ${visible.map((v) => v.surface).join(', ') || 'none'})`,
    )
    console.log(
      'is a property of the LOCAL file backend and must NOT be carried over to Cloud —',
    )
    console.log(
      'that inference is the exact "same mechanism class" error this item exists to avoid.',
    )
  } else {
    console.log(
      visible.length
        ? `ORPHAN-VISIBLE on ${visible.length} surface(s) => Cloud HAS an orphan-visible surface;\n   ADR 0120 D9's byte-side controls are RECOVERABLE on Cloud via ${visible.map((v) => v.surface).join(', ')}.`
        : 'No surface saw the orphan while every proven surface saw the control => every measured\n   Cloud surface is METADATA-BOUND; the byte half is structurally unverifiable there.',
    )
  }
  console.log(
    `\nNow run \`cleanup\` — this run has left a real byte-orphan on ${REHEARSAL ? 'the local stack' : 'a production project'}.\n`,
  )
}

async function cleanup() {
  hr('CLEANUP')
  assertDomain()
  const state = loadState()
  const { bucket, prefix } = state

  const del = await rest('DELETE', `/object/${bucket}`, {
    json: {
      prefixes: [
        `${prefix}/${state.control}`,
        `${prefix}/${state.orphan}`,
        `${prefix}/${RETRIEVAL}`,
      ],
    },
  })
  info(`object delete: HTTP ${del.status} ${del.text.slice(0, 300)}`)

  const rb = await rest('DELETE', `/bucket/${bucket}`)
  if (rb.ok) ok(`bucket ${bucket} removed`)
  else
    no(
      `bucket delete: HTTP ${rb.status} ${rb.text.slice(0, 300)} — the bucket must be EMPTY first`,
    )

  state.cleanedAt = new Date().toISOString()
  state.cleanupDetail = { objectDelete: del.status, bucketDelete: rb.status }
  saveState(state)

  console.log(`
The orphan has no metadata row, so the API delete above could not address it. Restore
the row using the version captured at construct time — NOT a fresh uuid — then re-run
cleanup so the API removes the BYTE and not merely a row:

  insert into storage.objects (bucket_id, name, owner, version, metadata)
  values ('${bucket}', '${prefix}/${state.orphan}', null, '<VERSION-CAPTURED-AT-CONSTRUCT>', '{}'::jsonb)
  on conflict do nothing;

Proven locally: with the original version the bytes go; with a wrong one the API
reports success and the file stays on disk. Then verify 0 rows remain for ${bucket},
and record any residue EXPLICITLY — a cleanup that cannot prove the byte is gone is
not a clean run, and this probe must not add to the population it measures.
`)
}

function report() {
  const s = loadState()
  const cell = (v) => (v === null ? '–' : v ? 'seen' : 'not seen')
  const row = (r) =>
    `| ${r.surface} | ${r.controlSeen === null ? '–' : r.controlSeen ? 'seen' : '**NOT seen**'} | ${r.orphanSeen === null ? '–' : r.orphanSeen ? '**SEEN**' : 'not seen'} | ${r.verdict} | ${r.detail.replace(/\|/g, '\\|')} |`
  void cell
  const tbl = (rs) =>
    [
      '| Surface | control | orphan | Verdict | Detail |',
      '| --- | --- | --- | --- | --- |',
      ...rs.map(row),
    ].join('\n')
  console.log(`Run \`${s.runId}\` · project \`${s.ref}\` · bucket \`${s.bucket}\`
constructed ${s.constructedAt} · measured ${s.measuredAt ?? '—'} · cleaned ${s.cleanedAt ?? '—'}

### BEFORE — both objects hold metadata rows (detector proof-of-life)

${s.before ? tbl(s.before) : '_not captured_'}

### AFTER — \`${s.prefix}/${s.orphan}\` metadata row deleted, byte left

${s.after ? tbl(s.after) : '_not captured_'}
`)
}

const CMDS = { preflight, construct, measure, cleanup, report }
const cmd = process.argv[2]
if (!CMDS[cmd])
  die(
    `usage: node scripts/cloud-orphan-probe.mjs <${Object.keys(CMDS).join('|')}> [--orphan-confirmed]`,
  )
await CMDS[cmd]()
