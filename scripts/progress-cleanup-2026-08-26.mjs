#!/usr/bin/env node
// One-shot PROGRESS.md cleanup prepared 2026-08-26 (§ Decisions + § State only).
//
// WHY THIS IS A SCRIPT AND NOT AN EDIT: it was authored while the AFF4 build was live in
// this same working tree. A hand-edit was applied and then clobbered by the concurrent
// session inside ten minutes, leaving the ARCHIVES holding rotated copies whose source
// rows were still in PROGRESS.md — duplication wearing a rotation's label. Run this only
// on a QUIET TREE (`git status` clean of PROGRESS.md, no other session mid-wave).
//
// It touches ONLY § Decisions and § State. It does NOT touch § Now or § Phase Status
// (lead-owned), and it does NOT rotate § Follow-ups: all 84 index lines were audited
// 2026-08-26 and NONE was eligible — every ✅ there is a partial, so a marker-driven
// sweep would have archived live open work.
//
// Idempotent: every step aborts if already applied. Nothing is written unless all
// transforms verify.
//
// USAGE
//   node scripts/progress-cleanup-2026-08-26.mjs            # steps 1,2,4 (no live figures)
//   MIGRATIONS=.. HEAD_VERSION=.. USERS=.. NONTEST=.. FLAGS=.. TRACKED=.. ONDISK=.. \
//     node scripts/progress-cleanup-2026-08-26.mjs          # + step 3 (§ State)
//
// ⛔ Step 3 refuses to run without freshly MEASURED figures. Do not copy the numbers from
// the old row, from this file's history, or from any document — a figure written into the
// commit that carries it is off by one BY CONSTRUCTION (.claude/rules/live-facts-measure-dont-quote.md).
// Measure them:
//   remote:  select count(*), max(version) from supabase_migrations.schema_migrations;
//            select count(*) from auth.users;
//            select count(*) from auth.users where email not like '%@test.local';
//            select count(*) from app.feature_flags where enabled;
//   local:   git ls-files supabase/migrations/*.sql | wc -l     -> TRACKED
//            ls supabase/migrations/*.sql | wc -l               -> ONDISK
// ⛔ Record NO sha. `main == origin/main` is measured, never written down.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROGRESS = `${ROOT}/PROGRESS.md`
const Q3 = `${ROOT}/docs/progress/2026-Q3.md`
const LOG = `${ROOT}/docs/progress/decisions-log.md`

const notes = []
const say = (m) => notes.push(m)

// ---------------------------------------------------------------- link repointing
// ORDER MATTERS: docs/progress/ is stripped before the generic docs/ -> ../ rule, or
// docs/progress/x.md becomes ../progress/x.md instead of x.md.
const repoint = (s) =>
  s
    .replaceAll('](docs/progress/', '](')
    .replaceAll('](docs/', '](../')
    .replaceAll('](.claude/', '](../../.claude/')

const inverse = (s) =>
  s
    .replaceAll('](../../.claude/', '](.claude/')
    .replaceAll('](../', '](docs/')
    .replaceAll('](2026-Q3.md)', '](docs/progress/2026-Q3.md)')
    .replaceAll('](decisions-log.md)', '](docs/progress/decisions-log.md)')
    .replaceAll('](follow-ups.md)', '](docs/progress/follow-ups.md)')

/** Move `lines` verbatim to `destPath` under `heading`, proving the move round-trips. */
function rotate(lines, destPath, heading, preamble) {
  const rotated = lines.map(repoint)
  if (rotated.join('\n') === lines.join('\n')) throw new Error(`${heading}: repoint was a no-op — control vacuous`)
  const back = rotated.map(inverse)
  for (let i = 0; i < lines.length; i++) {
    if (back[i] !== lines[i]) throw new Error(`${heading}: inverse transform did not reproduce line ${i} — ABORT`)
  }
  const dest = readFileSync(destPath, 'utf8')
  if (dest.includes(heading)) throw new Error(`${heading}: destination already has this section — ABORT (double-append)`)
  writeFileSync(destPath, dest.replace(/\s*$/, '\n') + `\n## ${heading}\n\n${preamble}\n\n${rotated.join('\n')}\n`, 'utf8')
  const after = readFileSync(destPath, 'utf8')
  for (const l of rotated) if (l.trim() !== '' && !after.includes(l)) throw new Error(`${heading}: destination missing a rotated line verbatim`)
  return rotated
}

let text = readFileSync(PROGRESS, 'utf8')
let lines = text.split('\n')
const before = Buffer.byteLength(text, 'utf8')

// ------------------------------------------------- STEP 1: the two missing decision rows
// ADR 0152 and 0153 were both ACCEPTED 2026-08-26 and had no § Decisions row at all.
// Cells stay under the gate's 300-char cap: rationale belongs in the ADR, not the row.
const R0152 =
  '| 2026-08-26 | **PostgREST maps SQLSTATE class `P0*` → HTTP 500** (`P0001` excepted), refuting AFF4 pre-step P1’s premise. P1 re-scoped *fix* → *diagnose + re-file*; the live defect is a **73-function `public` P-class class**, NOT built here | ADR [0152](docs/decisions/0152-postgrest-p-class-sqlstate-maps-to-500.md) — **amends 0151 D16a** |'
const R0153 =
  '| 2026-08-26 | **A subset door-sweep writes to SCRATCH; the committed `authz-door-audit-findings.md` is never opened for write** — retires ADR 0079 Amdt 1’s `git checkout --` restore. Fixed in **four** sweeps, not one | ADR [0153](docs/decisions/0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) — **amends 0079 Amdt 1** |'

if (text.includes('0152-postgrest-p-class-sqlstate-maps-to-500.md) — **amends')) {
  say('step 1 SKIPPED — the 0152/0153 rows are already present')
} else {
  const hdr = lines.findIndex((l) => l.startsWith('| Date | Decision | Ref |'))
  if (hdr === -1) throw new Error('step 1: § Decisions table header not found — ABORT')
  lines.splice(hdr + 2, 0, R0152, R0153)
  say('step 1 — added the ADR 0152 + 0153 decision rows')
}

// ------------------------------------- STEP 2: a decision row must not carry live status
// The 0151 row ended "…Phase 2 named. Build NOT started", which went false at the build go.
{
  const i = lines.findIndex((l) => l.includes('**AFF4 ruled**') && l.includes('Build NOT started'))
  if (i === -1) say('step 2 SKIPPED — the 0151 row no longer carries "Build NOT started"')
  else {
    lines[i] = lines[i].replace('. Build NOT started |', ' |')
    if (lines[i].includes('Build NOT started')) throw new Error('step 2: strip did not apply — ABORT')
    say('step 2 — stripped the stale "Build NOT started" status from the ADR 0151 row')
  }
}

// ------------------------------------------- STEP 3: § State, re-measured (figures REQUIRED)
const F = {
  MIGRATIONS: process.env.MIGRATIONS,
  HEAD_VERSION: process.env.HEAD_VERSION,
  USERS: process.env.USERS,
  NONTEST: process.env.NONTEST,
  FLAGS: process.env.FLAGS,
  TRACKED: process.env.TRACKED,
  ONDISK: process.env.ONDISK,
}
const missing = Object.entries(F).filter(([, v]) => v === undefined || v === '').map(([k]) => k)

const stateIdx = lines.findIndex((l) => l.startsWith('| ✅ **REMOTE IS CURRENT'))
if (stateIdx === -1) {
  say('step 3 SKIPPED — no "REMOTE IS CURRENT" § State row found (already re-measured?)')
} else if (missing.length) {
  say(`step 3 SKIPPED — ${missing.join(', ')} not supplied. § State may only be MEASURED, never quoted; see this file's header for the queries.`)
} else {
  // Closure is a THREE-way identity: registered (remote) == tracked (git) == on disk.
  // Comparing only two of the three is how "463 registered == 465 tracked == 465 on disk"
  // gets written down as closure holding. Name each gap separately — they mean different
  // things: tracked > registered is committed-but-UNPUSHED, on disk > tracked is UNTRACKED.
  const [reg, trk, dsk] = [Number(F.MIGRATIONS), Number(F.TRACKED), Number(F.ONDISK)]
  if ([reg, trk, dsk].some(Number.isNaN)) throw new Error('step 3: MIGRATIONS/TRACKED/ONDISK must be numbers — ABORT')
  const gaps = []
  if (trk > reg) gaps.push(`**${trk - reg} committed but NOT PUSHED** (tracked **${trk}** > registered **${reg}**)`)
  if (reg > trk) gaps.push(`⛔ **${reg - trk} registered on the remote with NO tracked file** (registered **${reg}** > tracked **${trk}**) — investigate before anything else`)
  if (dsk > trk) gaps.push(`**${dsk - trk} UNTRACKED on disk** (on disk **${dsk}** > tracked **${trk}**)`)
  if (trk > dsk) gaps.push(`⛔ **${trk - dsk} tracked file(s) MISSING from disk**`)
  const closure = gaps.length
    ? `⛔ **Registry closure does NOT hold, and the difference is the point:** ${gaps.join('; ')}. Head registered is \`${F.HEAD_VERSION}\` — anything above it exists only locally.`
    : `✅ Registry closure holds three ways — **${reg}** registered == **${trk}** git-tracked == **${dsk}** on disk.`

  rotate(
    [lines[stateIdx]],
    Q3,
    'Rotated from PROGRESS.md § State 2026-08-26 — the SUPERSEDED § State remote row',
    '⛔ Verbatim; links repointed for this directory. **Superseded by a re-measurement, not by a push.**\n' +
      'Only the row’s **git anchor** went stale — exactly the failure\n' +
      '[`live-facts-measure-dont-quote`](../../.claude/rules/live-facts-measure-dont-quote.md) records, which is why its\n' +
      'successor **drops the sha** instead of updating it.'
  )

  lines[stateIdx] =
    `| ✅ **REMOTE IS CURRENT — re-measured 2026-08-26.** ⭐ **Measured in the REMOTE CATALOG, never from \`db push\`’s report:** ` +
    `\`schema_migrations\` = **${F.MIGRATIONS}**, head **\`${F.HEAD_VERSION}\`**; \`auth.users\` = **${F.USERS}**, **${F.NONTEST}** non-\`@test.local\` ` +
    `(still the E2E seed fixture, no real customer data); \`app.feature_flags\` enabled = **${F.FLAGS}**. ` +
    `⭐ **No sha is recorded here, deliberately** — \`main\` == \`origin/main\` measured current on the day, and a sha written into the commit that ` +
    `carries it is off by one BY CONSTRUCTION ([rule \`live-facts-measure-dont-quote\`](.claude/rules/live-facts-measure-dont-quote.md)). ` +
    `${closure} ` +
    `✅ Production runs the **node 24** toolchain (PO-confirmed 2026-08-25) — ⛔ testimony, not a measurement; no gate can read Coolify. ` +
    `⛔ **Coolify auto-deploys on the \`git push\` and its outcome is NOT measured here** — check Coolify, never this row. ` +
    `⛔ Superseded by the next remote-affecting change — **re-measure, do not quote.** The superseded row was rotated verbatim → ` +
    `[2026-Q3.md](docs/progress/2026-Q3.md) § "Rotated from PROGRESS.md § State 2026-08-26". |`
  say(`step 3 — § State re-measured (${F.MIGRATIONS} migrations, ${F.USERS} users, ${F.FLAGS} flags); superseded row rotated to 2026-Q3.md`)
}

// --------------------------- STEP 4: collapse the § Decisions rotation-NOTE bookkeeping
// 7 notes / ~2.9 KB describing PAST rotations, in a section whose contract is one line per
// DECISION. Each rotation is already recorded at the destination under its own dated heading;
// the notes are kept only for the two corrections they carry, which were never duplicated.
{
  const start = lines.findIndex((l) => l.startsWith('> ↩ **6 concluded rows of the PDF'))
  const stateHdr = lines.findIndex((l) => l.startsWith('## State — the three live remote facts'))
  if (start === -1) say('step 4 SKIPPED — the rotation-note block is already collapsed')
  else if (stateHdr === -1) throw new Error('step 4: § State heading not found — ABORT')
  else {
    let end = stateHdr - 1
    while (end > start && lines[end].trim() === '') end--
    const block = lines.slice(start, end + 1)
    const shape = (l) => l.trim() === '' || l.startsWith('> ↩ ') || l.startsWith('| _pre-2026-07_ |')
    const bad = block.find((l) => !shape(l))
    if (bad) throw new Error(`step 4: block holds a non-note line, refusing to rotate: ${JSON.stringify(bad.slice(0, 120))}`)

    const n = block.filter((l) => l.startsWith('> ↩ ')).length
    rotate(
      block,
      LOG,
      'Rotated from PROGRESS.md § Decisions 2026-08-26 — the rotation-NOTE block itself',
      `⛔ Verbatim; links repointed for this directory. These ${n} lines were bookkeeping **about** past\n` +
        'rotations — not decisions — accumulated to ~2.9 KB in a section whose contract is *one line per\n' +
        'decision*. Every rotation they describe is already recorded here under its own dated § heading, so\n' +
        'they are kept for their **corrections**, the only part never duplicated: the PDF·P3 row’s *"push NOT\n' +
        'made"* supersession, and the 2026-08-18 note’s record that its own word *"above"* went stale on\n' +
        '2026-08-20.'
    )

    lines.splice(
      start,
      end + 1 - start,
      '> ↩ **This table is the HEAD of the log, not the log.** Eight rotations (2026-08-04 · 08-17 · 08-18 · ' +
        '08-20 ×2 · 08-24 · 08-25 ×2) moved **125 concluded/superseded rows** verbatim → ' +
        '**[decisions-log.md](docs/progress/decisions-log.md)**, each under its own dated § heading there. The ' +
        `${n} per-rotation notes that stood here — **including the two corrections they carried** — were themselves ` +
        'rotated 2026-08-26 → § "Rotated from PROGRESS.md § Decisions 2026-08-26".'
    )
    say(`step 4 — collapsed ${n} rotation notes (${Buffer.byteLength(block.join('\n'), 'utf8')} bytes) into one line`)
  }
}

writeFileSync(PROGRESS, lines.join('\n'), 'utf8')
const after = Buffer.byteLength(readFileSync(PROGRESS, 'utf8'), 'utf8')

console.log(notes.map((n) => `  · ${n}`).join('\n'))
console.log(`\nPROGRESS.md ${before} -> ${after} bytes (cap 81920, headroom ${81920 - after})`)
console.log('Now run: npm run lint:progress')
