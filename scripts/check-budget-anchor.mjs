#!/usr/bin/env node
/**
 * GATE 15 — the privilege budget's CEILING has ONE HOME, and every copy is gated.
 *
 * WHY THIS GATE EXISTS (ruling R10, unit PRIVILEGE-SURFACE, pre-AE5 Batch 7).
 * `supabase/tests/mutation/p0-authz-invariant.sh` (`run_arm_census`) carries a standing
 * prohibition, filed after a literal `(407 reachable)` drifted to 427 while printing
 * beside four green arms:
 *
 *     # ⚠ DERIVED, NEVER FROZEN … A number a banner states about a population
 *     # NOTHING re-derives is a claim with no owner, and this arm exists to stop
 *     # exactly that shape.
 *
 * The privilege budget's pgTAP ratchet (`320` §U4) is a different object: it RE-DERIVES
 * the population from the live catalog every run and compares it to a committed number
 * that is a **PO DECISION**, not a description. ⛔ But that defence collapses the moment
 * the decision gets TWO HOMES — `docs/backend-state.md` prose and a pgTAP literal can
 * drift, and the drifted one is a number with no owner, i.e. the very disease.
 *
 * ⇒ THE CEILING'S ONE HOME IS `docs/backend-state.md` § Privilege budget. `320` §U4 holds
 * a MIRROR. This gate is what turns "two homes" into "one home plus a gated mirror".
 *
 * ⛔ NOT FOLDED INTO `lint:config-schemas` (gate 14), deliberately. One exit code for two
 * unrelated subjects is exactly what the plan rejected for `lint:set-local`: a red would
 * not say which subject moved, and a reader would have to open the script to find out.
 *
 * ---------------------------------------------------------------------------
 * ⛔ THE BOUND — WHAT THIS GATE DOES **NOT** BUY
 * ---------------------------------------------------------------------------
 * It compares **two committed texts**. It can never observe the live population: that
 * needs a database, so it lives in pgTAP (`320` §U4-§U6) under `npm run test:db`. ⇒ This
 * gate buys "the doc and the pin cannot drift apart between commits". The *budget itself*
 * is watched by the Phase Gate, not by the commit — recorded as
 * `FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN`'s ⭐ **amended by measurement**
 * (ruling R12), never as delivered as asked.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS PINNED, EXACTLY, AND WHERE
 * ---------------------------------------------------------------------------
 * THE HOME — `docs/backend-state.md`, two artefacts that must agree with each other:
 *   1. the machine-readable anchor, one line, all four keys required:
 *        <!-- BUDGET-ANCHOR ceiling=759 app=326 public=433 total=759 -->
 *   2. the prose the humans read:  **CEILING: 759.**
 *
 * THE MIRROR — `supabase/tests/320_act_expiry_and_acl_hardening.sql` §U4, where each
 * pinned literal carries its key on ITS OWN LINE, so the gate reads the ACTUAL pgTAP
 * literal and never a comment that merely restates it:
 *
 *       326,  -- BUDGET-ANCHOR app
 *
 * ⭐ That shape is load-bearing. If the gate compared the doc's anchor against a *comment*
 * in the SQL, two comments could agree while the `is()` literal said something else
 * entirely — a mirror that mirrors nothing. The number the gate reads IS the number pgTAP
 * asserts.
 *
 * THE CHECKS, in order (positives first — a gate that found nothing must not pass):
 *   P1  both files exist and are non-empty
 *   P2  EXACTLY ONE well-formed anchor comment in the doc  ⭐ zero AND two both red
 *   P3  EXACTLY ONE prose `**CEILING: N`
 *   P4  EXACTLY ONE mirror line per key, and all three keys present
 *   D   prose ceiling == anchor ceiling        (the one home is internally consistent)
 *   A   anchor app + anchor public == anchor total  (a census whose parts don't sum is wrong)
 *   C   anchor total <= anchor ceiling         ⭐ THE BUDGET INVARIANT
 *   B   each mirror literal == its anchor figure    (the mirror has not drifted)
 *
 * ⭐ WHY CHECK C IS THE ONE THAT MATTERS. Raising `320`'s pin without a ruling now forces
 * the doc's `total` up too (or B reds), and a `total` above `ceiling` reds at C. So the
 * only way to pass with a higher population is to ALSO move `CEILING`, which the merge
 * rule reserves to the PO. ⛔ C is `<=`, not `==`: the observed population may legitimately
 * sit BELOW the ceiling (that is what a ceiling is), and G3 in the self-test is the
 * fixture that proves this gate does not quietly demand equality.
 *
 * ⚠ POLARITY, SAID OUT LOUD (ruling R11). C is one-directional by design and is silent on
 * a FALL. That is not an oversight and it is not a claim that a fall is fine — the falling
 * half is `320` §U6, which is exact-equality and reds either way. Two instruments, two
 * polarities, stated rather than inherited.
 *
 * SELF-TEST, run before every real scan, exit 2 if the checker cannot fail (R13 house
 * shape). ⭐⭐ FIXTURE BASELINES ARE CANONICALISED (ruling R28, Track B's measured F2): a
 * fixture derived from the real artefact is poisoned by the very plant it exists to
 * detect — deriving gate 14's fixtures raw meant a planted `"app"` made every fixture a
 * no-op and the run exited 2 (checker broken) instead of 1 (the finding), hiding the one
 * red the gate exists for behind a verdict about the instrument. So:
 *   the SELF-TEST asks "can this checker fail, and can it pass?" — about the CHECKER;
 *   the REAL SCAN asks "do the home and the mirror agree?" — about the FILES.
 * When the tree is clean the two coincide and G1 is the real bytes; when it is not, the
 * self-test still measures the checker and the scan reports the real finding, and the
 * output says which happened.
 *
 *   node scripts/check-budget-anchor.mjs [--self-test] [--print]
 *
 * EXIT CODES: 0 clean · 1 a finding · 2 the checker itself is broken.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DOC_REL = 'docs/backend-state.md'
const SQL_REL = 'supabase/tests/320_act_expiry_and_acl_hardening.sql'
const DOC_PATH = join(process.cwd(), 'docs', 'backend-state.md')
const SQL_PATH = join(process.cwd(), 'supabase', 'tests', '320_act_expiry_and_acl_hardening.sql')

/** The three keys the mirror must carry. `ceiling` lives only in the home. */
export const MIRROR_KEYS = ['app', 'public', 'total']
/** Canonical values used ONLY to build self-test fixtures — never to judge the real files. */
const CANON = { ceiling: 759, app: 326, public: 433, total: 759 }

// ---------------------------------------------------------------------------
// Text handling
// ---------------------------------------------------------------------------

/** ⛔ FIRST, always. `git ls-files --eol` reports `w/crlf` on tracked files in this
 *  checkout while the index is LF; line endings are the reader's problem, never a finding. */
export function normalise(raw) {
  return String(raw).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

const ANCHOR_RE = /^[ \t]*<!--[ \t]*BUDGET-ANCHOR\b([^>]*?)-->[ \t]*$/
/** ⚠ The same pattern with `m`, for whole-document operations. `inspect` matches LINE BY
 *  LINE, so it uses the unflagged form; a `^…$` regex applied to a whole file without `m`
 *  matches nothing at all, which would make every fixture that uses it a silent no-op. */
const ANCHOR_RE_M = new RegExp(ANCHOR_RE.source, 'm')
const PROSE_RE = /\*\*CEILING:[ \t]*(\d+)/
/** ⚠ Anchored to a line that is a bare integer + comma + the marker, so the prose
 *  sentence in `320` that MENTIONS `-- BUDGET-ANCHOR` cannot be mistaken for a pin. */
const MIRROR_RE = /^[ \t]*(\d+)[ \t]*,[ \t]*--[ \t]*BUDGET-ANCHOR[ \t]+([a-z]+)[ \t]*$/

/** Parse `ceiling=759 app=326 …` into an object, or report why it cannot. */
export function parseAnchorBody(body) {
  const out = {}
  for (const tok of body.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([a-z]+)=(\d+)$/.exec(tok)
    if (!m) return { ok: false, reason: `token \`${tok}\` is not \`key=<integer>\`` }
    if (out[m[1]] !== undefined) return { ok: false, reason: `key \`${m[1]}\` appears twice` }
    out[m[1]] = Number(m[2])
  }
  for (const k of ['ceiling', ...MIRROR_KEYS]) {
    if (out[k] === undefined) return { ok: false, reason: `key \`${k}\` is missing` }
  }
  return { ok: true, values: out }
}

// ---------------------------------------------------------------------------
// The checker. ONE function, so the self-test and the real scan cannot diverge.
// ---------------------------------------------------------------------------

/**
 * @param {string|null} docRaw
 * @param {string|null} sqlRaw
 * @returns {{code: string, detail: object}} `code` is `OK` or one finding id.
 */
export function inspect(docRaw, sqlRaw) {
  // ---- P1 ------------------------------------------------------------------
  if (docRaw === null || docRaw === undefined) return { code: 'P1_DOC_MISSING', detail: {} }
  if (sqlRaw === null || sqlRaw === undefined) return { code: 'P1_SQL_MISSING', detail: {} }
  const doc = normalise(docRaw)
  const sql = normalise(sqlRaw)
  if (doc.trim() === '') return { code: 'P1_DOC_EMPTY', detail: {} }
  if (sql.trim() === '') return { code: 'P1_SQL_EMPTY', detail: {} }

  // ---- P2 — exactly one well-formed anchor comment -------------------------
  const anchors = []
  const malformed = []
  doc.split('\n').forEach((line, i) => {
    const m = ANCHOR_RE.exec(line)
    if (!m) return
    const parsed = parseAnchorBody(m[1])
    if (!parsed.ok) malformed.push({ line: i + 1, reason: parsed.reason, text: line.trim() })
    else anchors.push({ line: i + 1, values: parsed.values })
  })
  if (malformed.length > 0) return { code: 'P2_MALFORMED', detail: malformed[0] }
  if (anchors.length === 0) return { code: 'P2_NONE', detail: {} }
  if (anchors.length > 1) return { code: 'P2_DUPLICATE', detail: { anchors } }
  const anchor = anchors[0]

  // ---- P3 — exactly one prose CEILING --------------------------------------
  const prose = []
  doc.split('\n').forEach((line, i) => {
    const m = PROSE_RE.exec(line)
    if (m) prose.push({ line: i + 1, value: Number(m[1]) })
  })
  if (prose.length === 0) return { code: 'P3_NONE', detail: {} }
  if (prose.length > 1) return { code: 'P3_DUPLICATE', detail: { prose } }

  // ---- P4 — exactly one mirror line per key, all keys present --------------
  /** @type {Record<string, {line:number, value:number}[]>} */
  const mirror = {}
  const unknownKeys = []
  sql.split('\n').forEach((line, i) => {
    const m = MIRROR_RE.exec(line)
    if (!m) return
    const key = m[2]
    if (!MIRROR_KEYS.includes(key)) {
      unknownKeys.push({ line: i + 1, key, text: line.trim() })
      return
    }
    ;(mirror[key] ||= []).push({ line: i + 1, value: Number(m[1]) })
  })
  if (unknownKeys.length > 0) return { code: 'P4_UNKNOWN_KEY', detail: unknownKeys[0] }
  for (const key of MIRROR_KEYS) {
    const hits = mirror[key] || []
    if (hits.length === 0) return { code: 'P4_MISSING', detail: { key } }
    if (hits.length > 1) return { code: 'P4_DUPLICATE', detail: { key, hits } }
  }

  // ---- D — the one home must agree with itself -----------------------------
  if (prose[0].value !== anchor.values.ceiling) {
    return {
      code: 'D_HOME_SELF_DISAGREES',
      detail: { proseLine: prose[0].line, prose: prose[0].value, anchorLine: anchor.line, anchor: anchor.values.ceiling },
    }
  }

  // ---- A — the parts must sum to the whole ---------------------------------
  const { app, public: pub, total, ceiling } = anchor.values
  if (app + pub !== total) {
    return { code: 'A_PARTS_DO_NOT_SUM', detail: { line: anchor.line, app, pub, total } }
  }

  // ---- C — the budget invariant --------------------------------------------
  if (total > ceiling) {
    return { code: 'C_OVER_CEILING', detail: { line: anchor.line, total, ceiling } }
  }

  // ---- B — the mirror has not drifted --------------------------------------
  for (const key of MIRROR_KEYS) {
    const got = mirror[key][0]
    const want = anchor.values[key]
    if (got.value !== want) {
      return { code: 'B_MIRROR_DRIFT', detail: { key, sqlLine: got.line, got: got.value, want, docLine: anchor.line } }
    }
  }

  return { code: 'OK', detail: { anchor, prose: prose[0], mirror } }
}

// ---------------------------------------------------------------------------
// Messages. Each names its own subject; a reader must not have to open the script.
// ---------------------------------------------------------------------------

function report(code, d) {
  switch (code) {
    case 'P1_DOC_MISSING':
      return `${DOC_REL} does not exist. That file is the ceiling's ONE HOME; with no home there is nothing to mirror against, and a missing subject is a finding, never a pass.`
    case 'P1_SQL_MISSING':
      return `${SQL_REL} does not exist. That file holds the gated mirror (§U4). ⛔ Do not "fix" this by creating a new test file: ruling R15 says the budget pin EXTENDS 320 rather than standing beside it, and a rename orphans every name-keyed citation.`
    case 'P1_DOC_EMPTY':
      return `${DOC_REL} is empty. The gate has no subject.`
    case 'P1_SQL_EMPTY':
      return `${SQL_REL} is empty. The gate has no subject.`
    case 'P2_MALFORMED':
      return `${DOC_REL}:${d.line}: the BUDGET-ANCHOR comment is malformed — ${d.reason}.\n\n    found     ${d.text}\n    expected  <!-- BUDGET-ANCHOR ceiling=<n> app=<n> public=<n> total=<n> -->\n\nAll four keys are required. The gate refuses to guess rather than reading three of four and passing.`
    case 'P2_NONE':
      return `${DOC_REL}: found NO \`<!-- BUDGET-ANCHOR … -->\` comment. ⭐ This is the anti-vacuity red: a gate that found nothing has not checked anything, so zero matches fails exactly like a wrong value. The ceiling's one home is § Privilege budget in that file — was the anchor deleted, or the section rotated out?`
    case 'P2_DUPLICATE':
      return `${DOC_REL}: found ${d.anchors.length} BUDGET-ANCHOR comments (lines ${d.anchors.map((a) => a.line).join(', ')}). ⭐ Ambiguous by construction — the ceiling has ONE home, and the gate cannot know which of two anchors is it, so two fails exactly like zero.`
    case 'P3_NONE':
      return `${DOC_REL}: found no \`**CEILING: <n>\` in the prose. The machine anchor and the sentence humans read are BOTH required — an anchor nobody reads is how the figure goes stale in the one place people look.`
    case 'P3_DUPLICATE':
      return `${DOC_REL}: found ${d.prose.length} \`**CEILING: <n>\` statements (lines ${d.prose.map((p) => p.line).join(', ')}). Two prose ceilings is two homes inside one file. Keep one; quote a superseded value as text (\`\\\`CEILING: 752\\\`\`), not as another bold statement.`
    case 'P4_UNKNOWN_KEY':
      return `${SQL_REL}:${d.line}: BUDGET-ANCHOR marker names an unknown key \`${d.key}\`.\n\n    found  ${d.text}\n\nKnown keys: ${MIRROR_KEYS.join(', ')}. A typo'd key would otherwise leave its real pin unmirrored and this gate green.`
    case 'P4_MISSING':
      return `${SQL_REL}: no pinned literal is tagged \`-- BUDGET-ANCHOR ${d.key}\`. The mirror must carry all of ${MIRROR_KEYS.join(', ')}, each on the literal's own line:\n\n    326,  -- BUDGET-ANCHOR app\n\n⛔ Tagging a COMMENT instead of the literal defeats the gate: two comments can agree while the \`is()\` literal says something else.`
    case 'P4_DUPLICATE':
      return `${SQL_REL}: key \`${d.key}\` is tagged ${d.hits.length} times (lines ${d.hits.map((h) => h.line).join(', ')}). Ambiguous: the gate cannot know which literal is the mirror, so two fails exactly like zero.`
    case 'D_HOME_SELF_DISAGREES':
      return [
        `${DOC_REL}: THE ONE HOME DISAGREES WITH ITSELF.`,
        ``,
        `    prose  :${d.proseLine}  **CEILING: ${d.prose}`,
        `    anchor :${d.anchorLine}  ceiling=${d.anchor}`,
        ``,
        `The sentence a human reads and the value a machine reads are the same decision. Fix the one`,
        `that is wrong — ⛔ and if the ceiling genuinely moved, it moved by PO RULING, so the ruling`,
        `goes in the record in the same commit. An edited ceiling with no ruling beside it is exactly`,
        `what FUP-PRIVILEGE-BUDGET-CEILING-BREACHED-BY-SEVEN forbids: it converts a breach into a baseline.`,
      ].join('\n')
    case 'A_PARTS_DO_NOT_SUM':
      return [
        `${DOC_REL}:${d.line}: THE PARTS DO NOT SUM TO THE WHOLE.`,
        ``,
        `    app ${d.app} + public ${d.pub} = ${d.app + d.pub}, but total = ${d.total}`,
        ``,
        `A census whose parts do not sum is wrong somewhere, and which half moved is exactly the`,
        `question a total-only figure cannot answer. Re-derive both halves from the live catalog:`,
        ``,
        `    select n.nspname, count(*) filter (where p.prosecdef and has_function_privilege('authenticated', p.oid,'EXECUTE'))`,
        `      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public') group by 1;`,
      ].join('\n')
    case 'C_OVER_CEILING':
      return [
        `⛔⛔ ${DOC_REL}:${d.line}: THE BUDGET IS OVER ITS CEILING — total ${d.total} > ceiling ${d.ceiling}.`,
        ``,
        `The \`authenticated\`-executable SECURITY DEFINER population of \`app\` + \`public\` is a BUDGET:`,
        `it falls only by a revoke, and no revoke has ever been executed on this tree. It rises`,
        `silently, one convenient \`grant execute … to authenticated\` at a time, each individually`,
        `defensible — which is what the ceiling exists to stop.`,
        ``,
        `⛔ DO NOT EDIT THE CEILING TO MATCH. The MERGE RULE in ${DOC_REL} § Privilege budget reserves`,
        `that to the PO: "no increment may raise the count without a named justification in its own`,
        `gate record, and the ceiling moves only by PO ruling". The last time this happened the`,
        `increment was seven functions arriving unattributed over five days.`,
        ``,
        `WHAT TO DO: diff the \`authenticated\`-executable DEFINER SET (not the count — a +1 is equally`,
        `consistent with 4 added and 3 removed) between the last ruled head and this one, name each`,
        `new member and the migration that granted it, and take the aggregate to the PO.`,
      ].join('\n')
    case 'B_MIRROR_DRIFT':
      return [
        `THE MIRROR HAS DRIFTED FROM ITS HOME — key \`${d.key}\`.`,
        ``,
        `    home    ${DOC_REL}:${d.docLine}   ${d.key}=${d.want}`,
        `    mirror  ${SQL_REL}:${d.sqlLine}   ${d.got}`,
        ``,
        `${SQL_REL} §U4 pins this population; ${DOC_REL} § Privilege budget owns the decision. This`,
        `gate exists so the two cannot disagree, because a drifted copy is "a number a banner states`,
        `about a population nothing re-derives" — the shape ARM=census was written to stop.`,
        ``,
        `⛔ Decide which one is the DECISION before editing either. If the live population moved, the`,
        `pgTAP pin reds first (npm run test:db) and the answer is an attribution + a PO ruling, not an`,
        `edit here. If the doc was corrected by a ruling, update the §U4 literal in the same commit.`,
      ].join('\n')
    default:
      return `unclassified finding \`${code}\`.`
  }
}

// ---------------------------------------------------------------------------
// SELF-TEST — fixture PAIRS in os.tmpdir(); plants never touch the tree.
// ---------------------------------------------------------------------------

/**
 * ⭐⭐ CANONICALISE (ruling R28). Force the home's anchor + prose and the mirror's three
 * literals to known-good values, INSERTING them when absent, so the fixture baseline is
 * clean by construction whatever the working tree says. Without this, a real over-ceiling
 * or a real drift poisons every fixture at once and the run exits 2 (checker broken)
 * instead of 1 (the finding) — measured on gate 14, not theorised.
 */
function canonicaliseDoc(raw) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const anchorLine = `<!-- BUDGET-ANCHOR ceiling=${CANON.ceiling} app=${CANON.app} public=${CANON.public} total=${CANON.total} -->`
  let t = raw
  const lines = t.split(/\r?\n/)
  const anchorIdxs = lines.map((l, i) => (ANCHOR_RE.test(l) ? i : -1)).filter((i) => i >= 0)
  if (anchorIdxs.length === 0) lines.unshift(anchorLine)
  else {
    // Keep the first, force its value; drop any others so the baseline has exactly one.
    lines[anchorIdxs[0]] = anchorLine
    for (const i of anchorIdxs.slice(1).reverse()) lines.splice(i, 1)
  }
  const proseIdxs = lines.map((l, i) => (PROSE_RE.test(l) ? i : -1)).filter((i) => i >= 0)
  const proseLine = `**CEILING: ${CANON.ceiling}.**`
  if (proseIdxs.length === 0) lines.unshift(proseLine)
  else {
    lines[proseIdxs[0]] = lines[proseIdxs[0]].replace(PROSE_RE, `**CEILING: ${CANON.ceiling}`)
    for (const i of proseIdxs.slice(1).reverse()) lines.splice(i, 1)
  }
  t = lines.join(eol)
  return t
}

function canonicaliseSql(raw) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const lines = raw.split(/\r?\n/)
  const seen = new Set()
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = MIRROR_RE.exec(lines[i])
    if (!m) continue
    if (!MIRROR_KEYS.includes(m[2]) || seen.has(m[2])) {
      lines.splice(i, 1) // drop unknown keys and duplicates, keeping the FIRST of each
      continue
    }
    seen.add(m[2])
  }
  for (const key of MIRROR_KEYS) {
    if (!seen.has(key)) lines.unshift(`  ${CANON[key]},  -- BUDGET-ANCHOR ${key}`)
  }
  return lines
    .map((l) => {
      const m = MIRROR_RE.exec(l)
      return m && MIRROR_KEYS.includes(m[2]) ? `  ${CANON[m[2]]},  -- BUDGET-ANCHOR ${m[2]}` : l
    })
    .join(eol)
}

const setAnchor = (doc, patch) => {
  const v = { ...CANON, ...patch }
  return doc.replace(
    ANCHOR_RE_M,
    () => `<!-- BUDGET-ANCHOR ceiling=${v.ceiling} app=${v.app} public=${v.public} total=${v.total} -->`,
  )
}

const setMirror = (sql, key, value) =>
  sql.replace(new RegExp(`^[ \\t]*\\d+[ \\t]*,[ \\t]*--[ \\t]*BUDGET-ANCHOR[ \\t]+${key}[ \\t]*$`, 'm'), `  ${value},  -- BUDGET-ANCHOR ${key}`)

const dropLine = (text, re) => {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  return text.split(/\r?\n/).filter((l) => !re.test(l)).join(eol)
}

function buildFixtures(doc, sql) {
  const eol = doc.includes('\r\n') ? '\r\n' : '\n'
  const anchorText = doc.split(/\r?\n/).find((l) => ANCHOR_RE.test(l))
  /** @type {any[]} */
  return [
    // ---- BAD -------------------------------------------------------------
    { id: 'B1', name: 'anchor: app raised so the parts no longer sum', doc: setAnchor(doc, { app: 327 }), sql, mustCatch: true, expect: 'A_PARTS_DO_NOT_SUM' },
    { id: 'B2', name: '⭐ anchor: a consistent census that is OVER the ceiling', doc: setAnchor(doc, { public: 434, total: 760 }), sql: setMirror(setMirror(sql, 'public', 434), 'total', 760), mustCatch: true, expect: 'C_OVER_CEILING' },
    { id: 'B3', name: 'mirror: the §U4 `app` literal drifted', doc, sql: setMirror(sql, 'app', 327), mustCatch: true, expect: 'B_MIRROR_DRIFT' },
    { id: 'B4', name: 'mirror: the §U4 `public` literal drifted', doc, sql: setMirror(sql, 'public', 434), mustCatch: true, expect: 'B_MIRROR_DRIFT' },
    { id: 'B5', name: 'mirror: the §U4 `total` literal drifted', doc, sql: setMirror(sql, 'total', 760), mustCatch: true, expect: 'B_MIRROR_DRIFT' },
    { id: 'B6', name: '⭐ the home disagrees with itself — prose says the SUPERSEDED 752', doc: doc.replace(PROSE_RE, '**CEILING: 752'), sql, mustCatch: true, expect: 'D_HOME_SELF_DISAGREES' },
    { id: 'B7', name: 'the anchor comment is deleted outright', doc: dropLine(doc, ANCHOR_RE), sql, mustCatch: true, expect: 'P2_NONE' },
    { id: 'B8', name: 'the anchor comment appears twice — two homes', doc: doc.replace(ANCHOR_RE_M, (m) => `${m}${eol}${m}`), sql, mustCatch: true, expect: 'P2_DUPLICATE' },
    { id: 'B9', name: 'the anchor is missing one of its four keys', doc: doc.replace(ANCHOR_RE_M, `<!-- BUDGET-ANCHOR ceiling=${CANON.ceiling} app=${CANON.app} total=${CANON.total} -->`), sql, mustCatch: true, expect: 'P2_MALFORMED' },
    { id: 'B10', name: 'the prose CEILING is deleted', doc: dropLine(doc, PROSE_RE), sql, mustCatch: true, expect: 'P3_NONE' },
    { id: 'B11', name: 'a mirror marker line is deleted', doc, sql: dropLine(sql, /--[ \t]*BUDGET-ANCHOR[ \t]+total[ \t]*$/), sql_shape: (t) => !/BUDGET-ANCHOR[ \t]+total[ \t]*$/m.test(t) || 'the `total` marker line must actually be gone', mustCatch: true, expect: 'P4_MISSING' },
    { id: 'B12', name: 'a mirror key is tagged twice', doc, sql: sql.replace(/^([ \t]*\d+[ \t]*,[ \t]*--[ \t]*BUDGET-ANCHOR[ \t]+app[ \t]*)$/m, `$1${eol}$1`), mustCatch: true, expect: 'P4_DUPLICATE' },
    { id: 'B13', name: 'a mirror marker names an unknown key (a typo would leave a real pin unmirrored)', doc, sql: sql.replace(/(--[ \t]*BUDGET-ANCHOR[ \t]+)app([ \t]*)$/m, '$1aap$2'), mustCatch: true, expect: 'P4_UNKNOWN_KEY' },
    { id: 'B14', name: '[P1] the mirror file is missing entirely', doc, sql: null, mustCatch: true, expect: 'P1_SQL_MISSING' },
    { id: 'B15', name: '[P1] the home file is empty', doc: '\n  \n', sql, mustCatch: true, expect: 'P1_DOC_EMPTY' },

    // ---- GOOD — the discrimination control -------------------------------
    { id: 'G1', name: 'the canonical pair, unmutated', doc, sql, mustCatch: false, mustDiffer: false },
    {
      id: 'G2',
      name: 'cosmetics outside the values: indentation and spacing',
      doc: doc.replace(ANCHOR_RE_M, (m) => `   ${m.trim()}   `),
      sql: sql.replace(/^([ \t]*)(\d+)([ \t]*),([ \t]*)(--[ \t]*BUDGET-ANCHOR[ \t]+app[ \t]*)$/m, '        $2 ,   $5'),
      mustCatch: false,
    },
    {
      // ⭐ THE FIXTURE THAT PROVES C IS `<=` AND NOT `==`. Without it, a gate that demanded
      // total == ceiling would pass every bad fixture above and every good one too, and
      // nothing here would tell them apart: a budget legitimately UNDER its ceiling would red.
      id: 'G3',
      name: '⭐ a ceiling ABOVE the observed total is legal — a ceiling is not an equality',
      doc: setAnchor(doc, { ceiling: 800 }).replace(PROSE_RE, '**CEILING: 800'),
      sql,
      mustCatch: false,
    },
    // ⭐ G4 IS A PAIR, PROVEN AGAINST ITSELF (ruling R29). "The real file with CRLF" is
    // vacuous whenever the real file already IS CRLF — and `git status` cannot tell you,
    // by design (`.gitattributes` normalises on the way in). Both directions run; each is
    // exempt from "must differ from the baseline" because ONE of them is expected to equal
    // it and WHICH one is an accident of the checkout.
    { id: 'G4-crlf', name: 'the same pair with CRLF endings throughout', doc: doc.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), sql: sql.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), mustCatch: false, mustDiffer: false, eolPair: 'crlf' },
    { id: 'G4-lf', name: 'the same pair with LF endings throughout', doc: doc.replace(/\r\n/g, '\n'), sql: sql.replace(/\r\n/g, '\n'), mustCatch: false, mustDiffer: false, eolPair: 'lf' },
  ].map((f) => ({ ...f, anchorText }))
}

/**
 * @returns {0|1|2} 0 = the checker is sound; 1 = no clean baseline could be derived, so the
 *                  checker was NOT exercised (the real scan reports the true finding);
 *                  2 = the checker cannot fail on a bad pair or cannot pass on a good one.
 */
function selfTest({ verbose } = {}) {
  if (!existsSync(DOC_PATH) || !existsSync(SQL_PATH)) {
    console.error('budget-anchor SELF-TEST: cannot build fixtures — a subject file is absent, so there is no baseline to mutate.')
    return 1
  }
  const docDisk = readFileSync(DOC_PATH, 'utf8')
  const sqlDisk = readFileSync(SQL_PATH, 'utf8')
  const doc = canonicaliseDoc(docDisk)
  const sql = canonicaliseSql(sqlDisk)
  const base = inspect(doc, sql)
  if (base.code !== 'OK') {
    console.error(
      `budget-anchor SELF-TEST: cannot derive a clean fixture baseline (${base.code}), so the checker was NOT exercised this run. ⚠ That is a statement about the FIXTURES, not a verdict on the files — the real scan below reports that.`,
    )
    return 1
  }
  const derived = doc !== docDisk || sql !== sqlDisk
  const fixtures = buildFixtures(doc, sql)

  const dir = mkdtempSync(join(tmpdir(), 'budget-anchor-'))
  let broken = 0
  const lines = []

  // ⛔ The line-ending pair is proven against ITSELF, never against the baseline, whose
  // own endings are an accident of the checkout.
  const crlf = fixtures.find((f) => f.eolPair === 'crlf')
  const lf = fixtures.find((f) => f.eolPair === 'lf')
  if (!crlf || !lf || crlf.doc === lf.doc || !crlf.doc.includes('\r\n') || lf.doc.includes('\r')) {
    broken++
    lines.push('  G4 PAIR IS NOT A PAIR — the CRLF and LF fixtures must differ from each other, and each must actually carry the endings it claims')
  }

  try {
    for (const f of fixtures) {
      // ⛔ A mutation that did not apply reports green.
      if (f.mustDiffer !== false && f.doc === doc && f.sql === sql) {
        broken++
        lines.push(`  ${f.id} DID NOT APPLY — both fixture files byte-identical to the baseline: ${f.name}`)
        continue
      }
      if (f.sql_shape) {
        const shaped = f.sql_shape(f.sql ?? '')
        if (shaped !== true) {
          broken++
          lines.push(`  ${f.id} MUTATION APPLIED WRONG — ${shaped}: ${f.name}`)
          continue
        }
      }
      const dp = join(dir, `${f.id}.doc.md`)
      const sp = join(dir, `${f.id}.sql`)
      writeFileSync(dp, f.doc ?? '', 'utf8')
      if (f.sql !== null) writeFileSync(sp, f.sql, 'utf8')
      const got = inspect(f.doc === null ? null : readFileSync(dp, 'utf8'), f.sql === null ? null : readFileSync(sp, 'utf8'))
      const caught = got.code !== 'OK'
      if (caught !== f.mustCatch) {
        broken++
        lines.push(`  ${f.id} ${f.mustCatch ? 'NOT CAUGHT' : 'FALSELY CAUGHT'} (${got.code}) — ${f.name}`)
        continue
      }
      if (f.expect && got.code !== f.expect) {
        broken++
        lines.push(`  ${f.id} caught for the WRONG REASON: expected ${f.expect}, got ${got.code} — ${f.name}`)
        continue
      }
      if (verbose) lines.push(`  ${f.id} ${f.mustCatch ? `caught ${got.code}` : 'clean'} — ${f.name}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  const bad = fixtures.filter((f) => f.mustCatch).length
  const good = fixtures.length - bad
  if (lines.length) console.error(lines.join('\n'))
  if (broken > 0) {
    console.error(`budget-anchor SELF-TEST FAILED — ${broken} fixture(s) misclassified. ⛔ The checker cannot be trusted about the real files; fix the checker, do not read its verdict.`)
    return 2
  }
  console.log(
    `budget-anchor self-test: OK (${bad} bad pairs each caught for its own reason, ${good} good pairs each clean — the discrimination control; ` +
      `baseline = ${derived ? 'the real files CANONICALISED — the bytes on disk are NOT clean, see the finding below' : "the real files' current bytes"})`,
  )
  return 0
}

// ---------------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const argv = process.argv.slice(2)
  const st = selfTest({ verbose: argv.includes('--self-test') })
  if (st === 2) process.exit(2)
  if (argv.includes('--self-test')) process.exit(0)

  const docRaw = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : null
  const sqlRaw = existsSync(SQL_PATH) ? readFileSync(SQL_PATH, 'utf8') : null
  const { code, detail } = inspect(docRaw, sqlRaw)

  if (code !== 'OK') {
    console.error(`\n${report(code, detail)}\n`)
    process.exit(1)
  }

  const v = detail.anchor.values
  console.log(
    `budget-anchor gate: OK — ${DOC_REL}:${detail.anchor.line} ceiling=${v.ceiling} app=${v.app} public=${v.public} total=${v.total} ` +
      `(parts sum; total ${v.total} <= ceiling ${v.ceiling}; prose CEILING at :${detail.prose.line} agrees), mirrored by ${SQL_REL} ` +
      `§U4 at lines ${MIRROR_KEYS.map((k) => `${k}=:${detail.mirror[k][0].line}`).join(' ')}. ` +
      `⚠ BOUND: this compares two committed TEXTS; the LIVE population is measured by 320 §U4 under npm run test:db, not here.`,
  )
}
