#!/usr/bin/env node
/**
 * GATE 14 — `supabase/config.toml`'s `[api].schemas` list is PINNED.
 *
 * WHY THIS GATE EXISTS. Schema `app` holds 467 functions, **237** of which are
 * `anon`-executable (measured 2026-08-22 from the live catalog;
 * `docs/followups/FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md`). The dominant
 * mechanism is not a deliberate grant — it is `proacl IS NULL`, the Postgres default,
 * which includes PUBLIC. Those grants confer nothing today for exactly one reason:
 * PostgREST is not told to expose `app`. That instruction is ONE LINE of ONE FILE, the
 * `schemas` assignment this gate reads. If it ever gains `"app"`, 237 functions become
 * directly `anon`-callable **in the same edit**, and a reader auditing the ACLs would
 * conclude the ACLs were holding the line. They are not.
 *
 * ⭐ AND IT IS NOT MERELY A DOCUMENTED POSTURE — it is the premise of a LIVE ASSERTION
 * (rulings R9 + R2, unit PRIVILEGE-SURFACE). `supabase/tests/320_act_expiry_and_acl_hardening.sql`
 * §U1 pins the `app` PUBLIC-executable population at 236 and argues its own severity from
 * this file, verbatim at `320:285-287`:
 *
 *     -- Calibration, so this number is not read as an open door: `config.toml`
 *     -- exposes ONLY the `public` schema, so an `app` function with PUBLIC EXECUTE is
 *     -- not PostgREST-reachable. This is defence-in-depth.
 *
 * and again at `320:186-188`: *"`app` is not a PostgREST-exposed schema, so this was a
 * hardening gap rather than a live hole — but 'unreachable today' is a property of
 * config.toml, not of the grant, and config.toml can change in one line."* Until this
 * gate, **nothing in the tree noticed if that line changed**: the only two programmatic
 * readers of `config.toml` (`src/components/shell/nav-scope-exclusivity.test.ts`,
 * `src/lib/queries/session-grants.test.ts`) match `project_id` only. So this gate
 * protects an existing pgTAP assertion's premise, not just a posture.
 *
 * SIX IN-TREE PROSE PREMISES rest on this line. Each was read at its own site and quoted,
 * not taken from a summary (*a-paraphrase-can-invert-the-sentence-it-summarizes*):
 *   1. `supabase/tests/320_act_expiry_and_acl_hardening.sql:285-287` (+ `:186-188`) — above.
 *   2. `docs/backend-state.md:3547-3549` — *"It lives in `public`, not `app`: config.toml
 *      exposes only `["public","graphql_public"]`, so an `app.*` function is unreachable
 *      from `supabase.rpc()`."* (why `session_context()` is where it is)
 *   3. `docs/design/authz-ae1-revoke-partition.md:44` — the UNCHANGED partition's rationale:
 *      *"PostgREST exposes only `["public","graphql_public"]`, so no sweep — old or new —
 *      has ever looked at it"*.
 *   4. `docs/design/authz-definer-classification-ae1.md:41` + `:484-486` (F7) — *"no `app`
 *      function is client-invocable"*, the premise under 320 `app` DEFINERs' EXECUTE grants
 *      and under 213 of AE1's 233 proposed revokes.
 *   5. `docs/followups/FUP-UI-AUTHZ-WRAPPERS-DUPLICATE-THE-ENFORCING-PREDICATE.md:15-18` —
 *      the `public` wrappers *"are NOT redundant, and must not be 'simplified' away"*,
 *      because the exposure, not the grant, is what makes them load-bearing.
 *   6. `docs/phases/ethics-e4-participant-seating.md:40-43` — *"Every new door goes in
 *      `public`… an `app.*` RPC is a PostgREST 404 no client can reach"*.
 * ⚠ That list is the six VERIFIED sites, not a proof there are only six — `grep -rn
 * graphql_public` finds further citations in reviews and progress records. It is a floor.
 *
 * ---------------------------------------------------------------------------
 * ⛔ THE BOUND — WHAT THIS GATE DOES **NOT** BUY (ruling R18, in the plan's own terms)
 * ---------------------------------------------------------------------------
 * This gate proves the **FILE** never gains `app`. It does **NOT** prove the **DEPLOYED**
 * PostgREST configuration matches the file. `supabase/config.toml` governs the LOCAL
 * stack; the hosted project's exposed schemas are set in the Supabase dashboard / project
 * settings and could diverge from this file without any commit. Nothing here observes
 * that, and ⛔ probing production is a network action against the live project that is the
 * PO's to authorise — deliberately not done. There is also **no behavioural test anywhere**
 * asserting `app.*` is unreachable over PostgREST: an e2e probe of `rpc/member_can` was
 * deliberately rewritten away because it silently 404'd, i.e. the one behavioural witness
 * was removed for being indistinguishable from a broken test. That gap is filed as
 * `FUP-AUTHZ-NO-BEHAVIOURAL-PROOF-APP-SCHEMA-UNREACHABLE-OVER-POSTGREST`. ⇒ **This gate is a
 * PROXY for reachability, not the property.** A closure or record that does not carry this
 * bound claims more than the gate buys.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS PINNED, EXACTLY
 * ---------------------------------------------------------------------------
 * The pinned artefact is the assignment's **value text**: `["public", "graphql_public"]`,
 * character for character. Everything OUTSIDE it is tolerated — indentation, spacing
 * around `=`, a trailing `# …` comment, and the file's line endings. That split is what
 * lets the gate be strict about the thing six documents cite while staying silent about
 * cosmetics no reader depends on. Consequences, stated so neither is a surprise:
 *   - a reformat that preserves the value (`["public","graphql_public"]`) still reds, as a
 *     REVIEW event naming the rendering — the line is quoted verbatim in six places and a
 *     silent re-render rots those quotations;
 *   - ORDER is significant, not cosmetic: PostgREST's first schema is the default profile,
 *     so `["graphql_public", "public"]` is a behaviour change, not a sort.
 *
 * TWO FAILURE TEXTS, DELIBERATELY DISTINCT (ruling R16 is a hard condition):
 *   N1  `app` is in the list          → a **SECURITY EVENT**. The message names the
 *                                       consequence: 237 `app` functions become directly
 *                                       `anon`-callable in the same edit.
 *   N2  any other change to the list  → a **REVIEW EVENT**. The list is pinned; a new
 *                                       exposure needs a note. N2a = value/order changed,
 *                                       N2b = same value, re-rendered.
 * A reader who meets the red must know from ONE line which of the two happened. N1 is
 * reported first and alone when both hold.
 *
 * POSITIVES BEFORE THE NEGATIVE (plan §3.3). A gate that "found nothing" must not pass:
 *   P1  the file exists and is non-empty
 *   P2  an `[api]` table exists
 *   P3  EXACTLY ONE parseable `schemas = [...]` inside `[api]`, parsing to a NON-EMPTY
 *       list  ⭐ the anti-vacuity assertion — zero matches AND two matches both red
 *   P4  the load-bearing comment sentinel sits in the comment block immediately above it
 * Only then N1, then N2.
 *
 * ⛔ A MULTI-LINE ARRAY IS REFUSED, NOT PARSED. `schemas = [` with its `]` on a later line
 * is reported as unreadable and reds. It must never parse the first line and pass — that
 * is how a gate reports green over a list it never saw.
 *
 * ⚠ CRLF IS NORMALISED BEFORE ANYTHING ELSE, and this is not hypothetical here.
 * `.gitattributes` says `* text=auto eol=lf`, `git check-attr` agrees, `git status` is
 * clean — and `git ls-files --eol supabase/config.toml` reports **`i/lf w/crlf`**: the
 * index is LF and the working tree this gate reads is CRLF (451 CR bytes, measured
 * 2026-09-08). That is the Batch 6 lesson recurring on this very file: a CRLF checkout
 * made `lint:rules` blame each rule's *content* for its own reader's line-ending
 * assumption, and cost a session. ⛔ A claim about a file's CONTENT is not a claim about
 * the BYTES A GATE READS.
 *
 * SELF-TEST, run before every real scan, exit 2 if the checker cannot fail (R13 house
 * shape). Fixtures are MUTATIONS OF THE REAL FILE written to `os.tmpdir()` — ⛔ plants
 * never touch the real tree — with a byte-difference guard on every mutation, because
 * *a mutation that did not fully apply reports green*.
 *
 *   node scripts/check-supabase-config-schemas.mjs [--self-test] [--print]
 *
 * EXIT CODES: 0 clean · 1 a finding (P1–P4, N1, N2, or an unreadable assignment) ·
 *             2 the checker itself is broken.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG_REL = 'supabase/config.toml'
const CONFIG_PATH = join(process.cwd(), 'supabase', 'config.toml')

/** The pinned value text, character for character. */
export const PINNED_VALUE_TEXT = '["public", "graphql_public"]'
/** The pinned list, in order. Order is behaviour: PostgREST's first schema is the default. */
export const PINNED_LIST = ['public', 'graphql_public']
/**
 * P4's sentinel — ONE stable line, not the whole comment block, so the block's prose can
 * be edited freely while DELETING the warning still reds.
 */
export const SENTINEL = '⛔ LOAD-BEARING — DO NOT ADD "app" TO THIS LIST.'

// ---------------------------------------------------------------------------
// Text handling
// ---------------------------------------------------------------------------

/** ⛔ FIRST, always: line endings and a BOM are the reader's problem, never a finding. */
export function normalise(raw) {
  return String(raw).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Drop a trailing `# …` comment that is OUTSIDE quotes. Hand-rolled rather than a regex
 * because the whole question is context: `#` inside a TOML basic or literal string is
 * data, and `schemas = ["a#b"] # note` must keep the value and lose the note.
 */
export function stripTrailingComment(line) {
  let out = ''
  let i = 0
  const n = line.length
  while (i < n) {
    const c = line[i]
    if (c === '#') return out
    if (c === '"') {
      out += c
      i++
      while (i < n) {
        if (line[i] === '\\' && i + 1 < n) {
          out += line[i] + line[i + 1]
          i += 2
          continue
        }
        out += line[i]
        if (line[i] === '"') {
          i++
          break
        }
        i++
      }
      continue
    }
    if (c === "'") {
      // TOML literal string: no escapes at all.
      out += c
      i++
      while (i < n) {
        out += line[i]
        if (line[i] === "'") {
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * Parse a single-line TOML array of strings. Returns `{ ok, items }` or `{ ok:false, reason }`
 * with reason `multiline` | `not-an-array` | `malformed`.
 * ⛔ `multiline` is a REFUSAL, never a partial parse.
 */
export function parseArrayLiteral(valueText) {
  const t = valueText.trim()
  if (!t.startsWith('[')) return { ok: false, reason: 'not-an-array' }
  if (!t.includes(']')) return { ok: false, reason: 'multiline' }
  if (!t.endsWith(']')) return { ok: false, reason: 'malformed' }
  const inner = t.slice(1, -1)
  const items = []
  let i = 0
  const n = inner.length
  let expectItem = true
  while (i < n) {
    const c = inner[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === ',') {
      if (expectItem) return { ok: false, reason: 'malformed' }
      expectItem = true
      i++
      continue
    }
    if (!expectItem) return { ok: false, reason: 'malformed' }
    if (c === '"' || c === "'") {
      const quote = c
      i++
      let s = ''
      let closed = false
      while (i < n) {
        if (quote === '"' && inner[i] === '\\' && i + 1 < n) {
          s += inner[i + 1]
          i += 2
          continue
        }
        if (inner[i] === quote) {
          i++
          closed = true
          break
        }
        s += inner[i]
        i++
      }
      if (!closed) return { ok: false, reason: 'malformed' }
      items.push(s)
      expectItem = false
      continue
    }
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true, items }
}

// ---------------------------------------------------------------------------
// The checker. One function, so the self-test and the real scan cannot diverge.
// ---------------------------------------------------------------------------

/**
 * @param {string|null} raw  file contents, or `null` when the file does not exist.
 * @returns {{code: string, detail: object}} `code` is `OK` or one finding id.
 */
export function inspect(raw) {
  // ---- P1 — the file exists and is non-empty --------------------------------
  if (raw === null || raw === undefined) return { code: 'P1_MISSING', detail: {} }
  const text = normalise(raw)
  if (text.trim() === '') return { code: 'P1_EMPTY', detail: {} }

  const lines = text.split('\n')
  let table = null // current TOML table header; null = document root
  let sawApiTable = false
  const hits = [] // parseable `schemas = [...]` inside [api]
  const unreadable = [] // `schemas` inside [api] the gate refuses to interpret

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const trimmed = rawLine.trim()
    if (trimmed === '') continue
    // A line whose first non-space character is `#` is a comment, whole.
    if (trimmed.startsWith('#')) continue

    const body = stripTrailingComment(rawLine).trim()
    if (body === '') continue

    // ---- table header. `schemas` is only meaningful under [api]; the same key
    // under [api.tls] or [db] is a DIFFERENT key and must not be read as this one.
    const header = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(body)
    if (header) {
      table = header[1].trim()
      if (table === 'api') sawApiTable = true
      continue
    }

    const kv = /^schemas\s*=\s*(.+)$/.exec(body)
    if (!kv) continue
    if (table !== 'api') continue

    const valueText = kv[1].trim()
    const parsed = parseArrayLiteral(valueText)
    if (!parsed.ok) {
      unreadable.push({ line: idx + 1, valueText, reason: parsed.reason })
      continue
    }
    hits.push({ line: idx + 1, valueText, items: parsed.items })
  }

  // ---- P2 — an [api] table exists ------------------------------------------
  if (!sawApiTable) return { code: 'P2_NO_API_TABLE', detail: {} }

  // ---- P3's precondition — anything unreadable is REFUSED, never skipped ----
  // Ordered ahead of the count so a multi-line array can never degrade into
  // "zero assignments found", which reads as a different (and wrong) defect.
  if (unreadable.length > 0) {
    const u = unreadable[0]
    return {
      code: u.reason === 'multiline' ? 'P3_MULTILINE' : 'P3_UNREADABLE',
      detail: u,
    }
  }

  // ---- P3 — exactly one, parsing to a NON-EMPTY list ------------------------
  if (hits.length === 0) return { code: 'P3_NONE', detail: {} }
  if (hits.length > 1) return { code: 'P3_DUPLICATE', detail: { hits } }
  const hit = hits[0]
  if (hit.items.length === 0) return { code: 'P3_EMPTY_LIST', detail: hit }

  // ---- P4 — the sentinel is in the comment block immediately above ----------
  // "Immediately above" = the maximal run of consecutive comment lines directly
  // preceding the assignment. Deliberately the BLOCK and not line N-1: the block's
  // prose must be editable without redding, while deleting the warning still reds.
  const block = []
  for (let k = hit.line - 2; k >= 0; k--) {
    const t = lines[k].trim()
    if (!t.startsWith('#')) break
    block.push(t.replace(/^#+\s?/, '').trim())
  }
  if (!block.includes(SENTINEL)) return { code: 'P4_NO_SENTINEL', detail: hit }

  // ---- N1 — the security event ---------------------------------------------
  if (hit.items.includes('app')) return { code: 'N1_APP_EXPOSED', detail: hit }

  // ---- N2 — the review event ------------------------------------------------
  const sameValue =
    hit.items.length === PINNED_LIST.length && hit.items.every((s, i) => s === PINNED_LIST[i])
  if (!sameValue) return { code: 'N2A_LIST_CHANGED', detail: hit }
  if (hit.valueText !== PINNED_VALUE_TEXT) return { code: 'N2B_RERENDERED', detail: hit }

  return { code: 'OK', detail: hit }
}

// ---------------------------------------------------------------------------
// Messages. N1 and N2 must not read alike (R16).
// ---------------------------------------------------------------------------

function report(code, detail) {
  const at = detail && detail.line ? `${CONFIG_REL}:${detail.line}` : CONFIG_REL
  switch (code) {
    case 'P1_MISSING':
      return `${CONFIG_REL} does not exist. The gate has no subject: it cannot assert anything about the exposed schemas, and a missing subject is a finding, never a pass.`
    case 'P1_EMPTY':
      return `${CONFIG_REL} is empty. The gate has no subject; an empty file is a finding, never a pass.`
    case 'P2_NO_API_TABLE':
      return `${CONFIG_REL} has no \`[api]\` table. \`schemas\` is only meaningful inside \`[api]\`, so with no such table there is nothing to pin — and a gate that found nothing must not pass.`
    case 'P3_MULTILINE':
      return `${at}: \`schemas\` is written as a MULTI-LINE array (\`${detail.valueText}\`). ⛔ THIS GATE CANNOT READ IT, and refuses to guess: parsing the first line and passing would report green over a list it never saw. Put the array on one line, or extend this gate deliberately.`
    case 'P3_UNREADABLE':
      return `${at}: \`schemas\` value \`${detail.valueText}\` is not a readable single-line array of strings (${detail.reason}). The gate refuses rather than guessing.`
    case 'P3_NONE':
      return `${CONFIG_REL}: found NO parseable \`schemas = [...]\` assignment inside \`[api]\`. ⭐ This is the anti-vacuity red: a gate that found nothing has not checked anything, so zero matches fails exactly like a wrong value. Was the line deleted, commented out, or moved under another table (\`[api.tls]\` is a different table)?`
    case 'P3_DUPLICATE':
      return `${CONFIG_REL}: found ${detail.hits.length} \`schemas\` assignments inside \`[api]\` (lines ${detail.hits.map((h) => h.line).join(', ')}). ⭐ Ambiguous by construction — the gate cannot know which one the CLI honours, so two matches fails exactly like zero.`
    case 'P3_EMPTY_LIST':
      return `${at}: \`schemas\` parses to an EMPTY list. A gate that pins an empty population asserts nothing; this reds rather than passing.`
    case 'P4_NO_SENTINEL':
      return `${at}: the load-bearing comment sentinel is missing from the comment block immediately above the \`schemas\` assignment. Expected this line, verbatim:\n\n    # ${SENTINEL}\n\nThe block's prose may be edited freely; the sentinel is what must survive, because it is the only thing telling the next editor that this line is the whole bound on 237 \`anon\`-executable \`app\` functions.`
    case 'N1_APP_EXPOSED':
      return [
        `⛔⛔ SECURITY EVENT — ${at}: \`"app"\` HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS.`,
        ``,
        `    ${detail.valueText}`,
        ``,
        `THE CONSEQUENCE, in this same edit: schema \`app\` holds 467 functions, of which **237**`,
        `are \`anon\`-executable — mostly through \`proacl IS NULL\`, the Postgres default nobody`,
        `wrote, which includes PUBLIC. They confer nothing today ONLY because \`app\` is not`,
        `exposed. Exposing it makes all 237 directly callable by \`anon\` over PostgREST`,
        `(\`POST /rest/v1/rpc/<fn>\`) with no other change anywhere. The ACLs are not holding this`,
        `line; this list is.`,
        ``,
        `It also invalidates the severity argument of a LIVE assertion —`,
        `\`supabase/tests/320_act_expiry_and_acl_hardening.sql\` §U1 pins the \`app\``,
        `PUBLIC-executable set at 236 and calls it defence-in-depth *because* this file exposes`,
        `only \`public\` — plus five further in-tree premises listed in this script's header.`,
        ``,
        `⛔ Do not "fix" this by editing the gate. If exposing \`app\` is genuinely intended, it`,
        `is a PO decision with an ACL programme attached (default-REVOKE \`app\` from PUBLIC`,
        `first), not a config edit — see FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.`,
      ].join('\n')
    case 'N2A_LIST_CHANGED':
      return [
        `REVIEW EVENT — ${at}: the pinned \`[api].schemas\` list CHANGED VALUE.`,
        ``,
        `    expected  ${PINNED_VALUE_TEXT}`,
        `    found     ${detail.valueText}`,
        ``,
        `This list is pinned: a new exposure needs a note. Six in-tree documents argue their own`,
        `severity from "only \`public\`/\`graphql_public\` are exposed" (listed in this script's`,
        `header) and every one of them is invalidated by ANY added schema, not just \`app\`.`,
        `Order is significant too — PostgREST's FIRST schema is the default profile, so a`,
        `re-order is a behaviour change, not a sort.`,
        ``,
        `To proceed deliberately: update PINNED_VALUE_TEXT/PINNED_LIST in this script, and in the`,
        `same commit say in the config block WHY the exposure changed and which premises were`,
        `re-checked. ⛔ Editing the pin alone converts a decision into a silent baseline.`,
      ].join('\n')
    case 'N2B_RERENDERED':
      return [
        `REVIEW EVENT — ${at}: the \`[api].schemas\` VALUE IS UNCHANGED but the line was RE-RENDERED.`,
        ``,
        `    pinned    ${PINNED_VALUE_TEXT}`,
        `    found     ${detail.valueText}`,
        ``,
        `No schema was added or removed, so this is NOT the security event — it is a formatting`,
        `change to a line quoted verbatim in six documents, which a silent re-render rots. Either`,
        `restore the pinned rendering, or update PINNED_VALUE_TEXT here in the same commit as the`,
        `re-render. (Indentation, spacing around \`=\`, a trailing comment and line endings are all`,
        `tolerated; the array literal itself is what is pinned.)`,
      ].join('\n')
    default:
      return `${CONFIG_REL}: unclassified finding \`${code}\`.`
  }
}

// ---------------------------------------------------------------------------
// SELF-TEST — mutations of the REAL file, in os.tmpdir(), never in the tree.
// ---------------------------------------------------------------------------

/**
 * ⭐⭐ DERIVE A CLEAN FIXTURE BASELINE FROM THE REAL FILE.
 *
 * Every fixture is a mutation of the real file, which is what makes them structurally
 * honest — real tables, real comments, real line endings, never a hand-written copy of
 * production text. But it creates a trap that was MEASURED, not theorised: plant `"app"`
 * in the real file and the fixtures inherit it, so B1's mutation becomes a no-op, G1/G2/G3
 * are all "falsely caught", and the gate exits **2 — the checker is broken** instead of
 * exit 1 with the SECURITY message. The single most important red this gate exists to
 * produce would be unreachable, hidden behind a verdict about the instrument. That is
 * *the positive control contaminating its subject*, and R16's "a reader must know in one
 * line which happened" fails outright.
 *
 * The fix is to separate the two questions the run conflates:
 *   the SELF-TEST asks "can this checker fail, and can it pass?" — about the CHECKER;
 *   the REAL SCAN asks "is this file pinned?" — about the FILE.
 * So the fixture baseline is the real file with the pinned value text and the sentinel
 * FORCED on, i.e. clean by construction whatever the file on disk says. When the file is
 * clean the two are byte-identical and G1 is literally the real file's current bytes, as
 * the plan's §3.4 table asks. When it is not, the self-test still measures the checker and
 * the real scan reports the finding — and the output says which of the two happened.
 */
function canonicaliseBaseline(raw) {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  let t = raw.replace(
    /^(\s*schemas\s*=\s*)\[[^\]]*\](.*)$/m,
    (_m, lhs, rest) => `${lhs}${PINNED_VALUE_TEXT}${rest}`,
  )
  if (!t.includes(SENTINEL)) {
    t = t.replace(/^([ \t]*)(schemas\s*=)/m, (_m, indent, kv) => `${indent}# ${SENTINEL}${eol}${indent}${kv}`)
  }
  return t
}

/** Replace the pinned value text on the `schemas` line, keeping everything else. */
function withValue(baseline, newValueText) {
  return baseline.replace(
    /^(\s*schemas\s*=\s*)\[[^\]]*\](.*)$/m,
    (_m, lhs, rest) => `${lhs}${newValueText}${rest}`,
  )
}

function dropLineMatching(baseline, re) {
  const eol = baseline.includes('\r\n') ? '\r\n' : '\n'
  return baseline
    .split(/\r?\n/)
    .filter((l) => !re.test(l))
    .join(eol)
}

function buildFixtures(baseline) {
  const eol = baseline.includes('\r\n') ? '\r\n' : '\n'
  const schemasLine = baseline.split(/\r?\n/).find((l) => /^\s*schemas\s*=/.test(l))

  /** @type {{id:string,name:string,text:string,mustCatch:boolean,expect?:string}[]} */
  const fx = [
    // ---- the eight BAD fixtures from the plan's §3.4 table -----------------
    {
      id: 'B1',
      name: 'the list contains "app"',
      text: withValue(baseline, '["public", "graphql_public", "app"]'),
      mustCatch: true,
      expect: 'N1_APP_EXPOSED',
    },
    {
      id: 'B2',
      name: 'no spaces inside the array literal (value identical, rendering moved)',
      text: withValue(baseline, '["public","graphql_public"]'),
      mustCatch: true,
      expect: 'N2B_RERENDERED',
    },
    {
      id: 'B3',
      name: 'different order (PostgREST\'s first schema is the default profile)',
      text: withValue(baseline, '["graphql_public", "public"]'),
      mustCatch: true,
      expect: 'N2A_LIST_CHANGED',
    },
    {
      id: 'B4',
      name: 'the sentinel comment line is deleted',
      // ⚠ Keyed on the sentinel's own distinctive clause, not on `LOAD-BEARING`: the block
      // above the assignment says "LOAD-BEARING" in its banner too, and a mutation that
      // deletes two lines is testing something other than what it claims to.
      text: dropLineMatching(baseline, /DO NOT ADD "app" TO THIS LIST/),
      mustCatch: true,
      expect: 'P4_NO_SENTINEL',
    },
    {
      id: 'B5',
      name: 'the schemas line is deleted outright',
      text: dropLineMatching(baseline, /^\s*schemas\s*=/),
      mustCatch: true,
      expect: 'P3_NONE',
      // ⛔ B5, B6 and B8 all land on P3_NONE. Three fixtures sharing one verdict is
      // precisely where a mutation that did not apply hides, so each carries a structural
      // assertion that it is the thing it claims to be, not a duplicate of a sibling.
      shape: (t) => !/^\s*#?\s*schemas\s*=/m.test(t) || 'no `schemas` line should remain at all',
    },
    {
      id: 'B6',
      name: 'the schemas line is commented out',
      text: baseline.replace(/^(\s*)(schemas\s*=)/m, '$1# $2'),
      mustCatch: true,
      expect: 'P3_NONE',
      shape: (t) =>
        (/^\s*#\s*schemas\s*=/m.test(t) && !/^\s*schemas\s*=/m.test(t)) ||
        'the line must survive as a COMMENT, not be deleted',
    },
    {
      id: 'B7',
      name: 'the array is written across multiple lines',
      text: baseline.replace(
        /^\s*schemas\s*=.*$/m,
        ['schemas = [', '  "public",', '  "graphql_public",', ']'].join(eol),
      ),
      mustCatch: true,
      expect: 'P3_MULTILINE',
      shape: (t) =>
        /^\s*schemas\s*=\s*\[\s*$/m.test(t) || 'the array must actually open and not close on its line',
    },
    {
      id: 'B8',
      name: 'schemas moved under [api.tls] — a different table, a different key',
      text: dropLineMatching(baseline, /^\s*schemas\s*=/).replace(
        /^\[api\.tls\]$/m,
        `[api.tls]${eol}${schemasLine}`,
      ),
      mustCatch: true,
      expect: 'P3_NONE',
      // ⛔ Without this, a failed `[api.tls]` match would silently degrade B8 into a copy
      // of B5 (the line merely deleted) — same verdict, same green, a fixture that no
      // longer tests the table-scoping rule at all.
      shape: (t) => {
        const ls = t.split(/\r?\n/)
        const tls = ls.findIndex((l) => l.trim() === '[api.tls]')
        const sch = ls.findIndex((l) => /^\s*schemas\s*=/.test(l))
        const api = ls.findIndex((l) => l.trim() === '[api]')
        if (sch === -1) return 'the `schemas` line must be MOVED, not deleted'
        if (api === -1) return 'the `[api]` table must survive, so P2 still passes'
        if (tls === -1 || sch < tls) return 'the `schemas` line must sit UNDER `[api.tls]`'
        return true
      },
    },

    // ---- ADDED beyond the briefed eleven, and flagged as such -------------
    // P1 and P2 are assertions this gate makes; an assertion with no fixture is
    // an unexercised cell, which is the shape this repo keeps paying for.
    {
      id: 'B9+',
      name: '[ADDED] empty file — exercises P1, which the briefed eleven leave untested',
      text: '\n   \n',
      mustCatch: true,
      expect: 'P1_EMPTY',
    },
    {
      id: 'B10+',
      name: '[ADDED] no [api] table at all — exercises P2, likewise untested',
      text: dropLineMatching(baseline, /^\[api\]$/),
      mustCatch: true,
      expect: 'P2_NO_API_TABLE',
    },

    // ---- the GOOD fixtures — the discrimination control -------------------
    {
      id: 'G1',
      name: 'the real file, unmutated',
      text: baseline,
      mustCatch: false,
      mustDifferFromBaseline: false,
    },
    {
      id: 'G2',
      name: 'real file + inline trailing comment + extra whitespace outside the literal',
      text: baseline.replace(
        /^(\s*)schemas(\s*)=(\s*)(\[[^\]]*\])(.*)$/m,
        (_m, _i, _a, _b, arr) => `  schemas   =   ${arr}   # inline note, extra whitespace`,
      ),
      mustCatch: false,
    },
    // ⭐ G3 IS RUN IN BOTH DIRECTIONS, and the reason is a measurement, not symmetry.
    // The plan's table says "the real file with CRLF endings". But `git ls-files --eol
    // supabase/config.toml` reports **`i/lf w/crlf`**: the index is LF and the WORKING
    // TREE — the bytes this gate actually reads — is already CRLF, while `.gitattributes`
    // says `eol=lf`, `git check-attr` agrees, and `git status` is clean. So the fixture as
    // briefed is BYTE-IDENTICAL to G1: it re-runs the unmutated control under a new name
    // and proves nothing about normalisation. The LF form is the direction that is
    // actually novel here. Both run, and the pair guard below is what makes each of them
    // non-vacuous — ⛔ these two are deliberately exempt from the "must differ from the
    // baseline" rule, because ONE of them is expected to equal it and WHICH one is an
    // accident of the checkout.
    {
      id: 'G3-crlf',
      name: 'the same content with CRLF endings throughout',
      text: baseline.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'),
      mustCatch: false,
      mustDifferFromBaseline: false,
      eolPair: 'crlf',
    },
    {
      id: 'G3-lf',
      name: 'the same content with LF endings throughout',
      text: baseline.replace(/\r\n/g, '\n'),
      mustCatch: false,
      mustDifferFromBaseline: false,
      eolPair: 'lf',
    },
  ]
  return fx
}

/**
 * @returns {0|1|2} 0 = the checker is sound (and the fixture baseline is the real file's
 *                      own bytes, i.e. the file is clean);
 *                  1 = the checker could not be exercised because no clean baseline can be
 *                      derived from this file — NOT a broken checker, so the real scan
 *                      below reports the file's own finding with its own exit code;
 *                  2 = the checker cannot fail on a bad fixture, or cannot pass on a good
 *                      one. ⛔ Nothing it says about the real file is believable.
 */
function selfTest({ verbose } = {}) {
  if (!existsSync(CONFIG_PATH)) {
    console.error(
      `config-schemas SELF-TEST: cannot build fixtures — ${CONFIG_REL} is absent, so there is no baseline to mutate.`,
    )
    return 1 // the real scan reports P1_MISSING, which is the true finding.
  }
  const onDisk = readFileSync(CONFIG_PATH, 'utf8')
  const baseline = canonicaliseBaseline(onDisk)
  const baseVerdict = inspect(baseline)
  if (baseVerdict.code !== 'OK') {
    console.error(
      `config-schemas SELF-TEST: cannot derive a clean fixture baseline from ${CONFIG_REL} (${baseVerdict.code}), so the checker was NOT exercised this run. ⚠ This is a statement about the FIXTURES, not a verdict on the file — the real scan below reports that.`,
    )
    return 1
  }
  const derivedBaseline = baseline !== onDisk
  const fixtures = buildFixtures(baseline)

  const dir = mkdtempSync(join(tmpdir(), 'cfg-schemas-'))
  let broken = 0
  const lines = []

  // ⛔ The line-ending pair is proven against ITSELF, never against the baseline, because
  // the baseline's own endings are an accident of the checkout (measured: `w/crlf` here,
  // `i/lf` in the index). Without this, whichever variant happens to match the checkout is
  // a silent duplicate of G1 — a good fixture that discriminates nothing.
  const crlf = fixtures.find((f) => f.eolPair === 'crlf')
  const lf = fixtures.find((f) => f.eolPair === 'lf')
  if (!crlf || !lf || crlf.text === lf.text || !crlf.text.includes('\r\n') || lf.text.includes('\r')) {
    broken++
    lines.push(
      '  G3 PAIR IS NOT A PAIR — the CRLF and LF fixtures must differ from each other, and each must actually carry the endings it claims',
    )
  }

  try {
    for (const f of fixtures) {
      // ⛔ A mutation that did not apply reports green. Every fixture whose whole point is
      // a mutation must differ from the baseline in BYTES.
      if (f.mustDifferFromBaseline !== false && f.text === baseline) {
        broken++
        lines.push(`  ${f.id} DID NOT APPLY — fixture bytes identical to the baseline: ${f.name}`)
        continue
      }
      // A byte difference proves SOMETHING changed, never that the intended thing did.
      if (f.shape) {
        const shaped = f.shape(f.text)
        if (shaped !== true) {
          broken++
          lines.push(`  ${f.id} MUTATION APPLIED WRONG — ${shaped}: ${f.name}`)
          continue
        }
      }
      const path = join(dir, `${f.id}.toml`)
      writeFileSync(path, f.text, 'utf8')
      const got = inspect(readFileSync(path, 'utf8'))
      const caught = got.code !== 'OK'
      if (caught !== f.mustCatch) {
        broken++
        lines.push(
          `  ${f.id} ${f.mustCatch ? 'NOT CAUGHT' : 'FALSELY CAUGHT'} (${got.code}) — ${f.name}`,
        )
        continue
      }
      if (f.expect && got.code !== f.expect) {
        broken++
        lines.push(`  ${f.id} caught for the WRONG REASON: expected ${f.expect}, got ${got.code}`)
        continue
      }
      if (verbose) {
        lines.push(
          `  ${f.id} ${f.mustCatch ? `caught ${got.code}` : 'clean'} — ${f.name}`,
        )
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  const bad = fixtures.filter((f) => f.mustCatch).length
  const good = fixtures.length - bad
  if (lines.length) console.error(lines.join('\n'))
  if (broken > 0) {
    console.error(
      `config-schemas SELF-TEST FAILED — ${broken} fixture(s) misclassified. ⛔ The checker cannot be trusted about the real file; fix the checker, do not read its verdict.`,
    )
    return 2
  }
  console.log(
    `config-schemas self-test: OK (${bad} bad fixtures each caught for its own reason, ${good} good fixtures each clean — the discrimination control; ` +
      `G1 = ${derivedBaseline ? "the real file CANONICALISED — the bytes on disk are NOT clean, see the finding below" : "the real file's current bytes"})`,
  )
  return 0
}

// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const argv = process.argv.slice(2)
  const st = selfTest({ verbose: argv.includes('--self-test') })
  if (st === 2) process.exit(2)
  if (argv.includes('--self-test')) process.exit(0)

  const raw = existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, 'utf8') : null
  const { code, detail } = inspect(raw)

  if (code !== 'OK') {
    console.error(`\n${report(code, detail)}\n`)
    process.exit(1)
  }

  // ⭐ A gate whose output does not name its subject cannot be audited from a log.
  console.log(
    `config-schemas gate: OK — ${CONFIG_REL}:${detail.line} [api].schemas = ${detail.valueText} ` +
      `→ parsed ${JSON.stringify(detail.items)} (${detail.items.length} schemas, sentinel present above). ` +
      `⚠ BOUND: this pins the FILE; the DEPLOYED PostgREST config is NOT checked — see this script's header.`,
  )
}
