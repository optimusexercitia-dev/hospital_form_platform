#!/usr/bin/env node
/**
 * GATE 14 — `supabase/config.toml`'s `[api].schemas` list is PINNED.
 *
 * WHY THIS GATE EXISTS. Schema `app` holds **526** functions, **236** of which are
 * `anon`-executable. The dominant mechanism is not a deliberate grant — it is
 * `proacl IS NULL`, the Postgres default, which includes PUBLIC. Those grants confer
 * nothing today for exactly one reason: PostgREST is not told to expose `app`. That
 * instruction is ONE LINE of ONE FILE, the `schemas` assignment this gate reads. If it
 * ever gains `"app"`, 236 functions become directly `anon`-callable **in the same edit**,
 * and a reader auditing the ACLs would conclude the ACLs were holding the line. They are
 * not.
 *
 * ⛔ BOTH FIGURES CARRY THEIR PREDICATE AND THEIR DATE, because they are live counts and
 * this comment is not gated. Measured 2026-09-08 on a fresh `supabase db reset` at head
 * `20261003007350` (524 migrations — the pair, per R19):
 *   526 = `count(*)` over `pg_proc` in `app` with `prokind = 'f'`
 *   236 = of those, `has_function_privilege('anon', p.oid, 'EXECUTE')` — the EFFECTIVE
 *         predicate, run as its own query
 * ⭐ SUPERSEDED, quoted so the edit is legible: this block read *"467 functions, **237**
 * of which are `anon`-executable (measured 2026-08-22)"*
 * (`docs/followups/FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED.md`). Both halves had
 * moved: +59 functions landed in the intervening migrations, and the `anon`-executable
 * set fell by one when AE4.7b (`20261003007210`) revoked the PUBLIC grant on
 * `app.is_staff_admin_of`.
 *
 * ⛔ DO NOT INFER 236 FROM `320` §U1's 236 — that is ruling R26's exact error, and it is
 * the reason this figure is re-measured rather than copied. §U1 pins the ACL-SHAPED set
 * (`proacl IS NULL` or an explicit PUBLIC grant); the figure above is the EFFECTIVE set.
 * The two coincide at 236 today — measured, not assumed, and the disagreement query
 * returned zero rows — but they are provably capable of disagreeing on this very schema:
 * granting EXECUTE to `anon` alone on one `app` function moved the effective count to 237
 * while the ACL-shaped count stayed at 236 (probe run inside `begin … rollback`, zero
 * residue, 2026-09-08). A coincidence that has been measured is still a coincidence.
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
 *   N1  `app` is in the list          → a **SECURITY EVENT**. The consequence is on the
 *                                       HEADLINE, not five lines down: 236 `app`
 *                                       functions become directly `anon`-callable in the
 *                                       same edit.
 *   N2  any other change to the list  → a **REVIEW EVENT**. The list is pinned; a new
 *                                       exposure needs a note. N2a = value/order changed,
 *                                       N2b = same value, re-rendered.
 * A reader who meets the red must know from ONE line which of the two happened. N1 is
 * reported first and alone when both hold.
 * ⭐ R16's condition is HELD BY A FIXTURE, not by reading: `M1+` asserts the N1 and N2
 * headlines are distinct strings, and it is the only place in the SELF-TEST that calls
 * `report()`. Until 2026-09-08 the self-test compared codes only, so the condition on the
 * PROSE was enforced by nobody — in a gate whose whole subject is that a sentence is not
 * an enforcer.
 * ⚠ CORRECTED 2026-09-08 (re-review N1). That sentence read *"the only place in this FILE
 * that calls `report()`"*, which is false of the file it sits in: `report()` recurses at
 * its own `N1_APP_EXPOSED_WITH_DEFECT` branch and the real scan calls it to print any
 * finding. The true and load-bearing claim is the one about the SELF-TEST.
 *
 * POSITIVES BEFORE THE NEGATIVE (plan §3.3). A gate that "found nothing" must not pass:
 *   P1  the file exists and is non-empty
 *   P2  an `[api]` table exists
 *   P3  EXACTLY ONE parseable `schemas = [...]` inside `[api]`, parsing to a NON-EMPTY
 *       list  ⭐ the anti-vacuity assertion — zero matches AND two matches both red
 *   P4  the load-bearing comment sentinel sits in the comment block immediately above it
 * Only then N1, then N2.
 *
 * ⛔⛔ BUT THE SECURITY EVENT ESCALATES OVER THE POSITIVES, and this was a real hole.
 * Ordering the positives first means `"app"` added **AND the sentinel deleted in the same
 * commit** returned `P4_NO_SENTINEL` — a formatting complaint whose headline never says
 * the word `app`. That is precisely the edit the sentinel exists to survive, and it was
 * the one edit for which the gate stopped naming the security event. (Measured
 * 2026-09-08: `inspect()` on that combination returned `P4_NO_SENTINEL`.) The two
 * fixtures were also strictly separate, so no arm of the self-test had ever asked what
 * happens when both hold — *a mutation list keyed on assertions cannot see an unexercised
 * cell*, inside the gate built to answer that class.
 * ⇒ Whenever a `schemas` assignment anywhere in the file names `app`, a P2/P3/P4 finding
 * is escalated to `N1_APP_EXPOSED_WITH_DEFECT`: the N1 SECURITY headline first, the
 * structural finding kept underneath it, never traded away. P1 is exempt — a missing or
 * empty file has no list to name `app`.
 *
 * ⛔ A MULTI-LINE ARRAY IS REFUSED, NOT PARSED. `schemas = [` with its `]` on a later line
 * is reported as unreadable and reds. It must never parse the first line and pass — that
 * is how a gate reports green over a list it never saw.
 * ⚠ REFUSED AS A POSITIVE ≠ UNREAD BY THE SIGHTING, and conflating the two was finding B1
 * of the 2026-09-08 re-review. P3 still refuses a multi-line array outright; the `app`
 * sighting reads its whole BODY anyway (`collectArrayBody`), so `"app"` added multi-line
 * escalates to the SECURITY headline with `P3_MULTILINE` kept underneath — on EITHER side
 * of the line break, which is what `B12+` and `B13+` pin.
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
 * SELF-TEST, ATTEMPTED before every real scan, exit 2 if the checker cannot fail (R13
 * house shape). Fixtures are MUTATIONS OF THE REAL FILE written to `os.tmpdir()` — ⛔
 * plants never touch the real tree — with a byte-difference guard on every mutation whose
 * point IS a mutation, because *a mutation that did not fully apply reports green*.
 *
 * ⚠ THREE PRECISIONS, each one a claim this header used to overstate (2026-09-08):
 *   (a) "run before every real scan" was wrong: in the `return 1` branch no fixture is
 *       ever built and the scan proceeds with an UNEXERCISED instrument. It is not a hole
 *       — every state reaching that branch also reds the real scan — but the JSDoc on
 *       `selfTest()` was honest about it and this header was not. Hence "ATTEMPTED".
 *   (b) "a byte-difference guard on EVERY mutation" was wrong: `B9+` is a hand-written
 *       literal rather than a mutation of anything, and `mustDifferFromBaseline: false`
 *       exempts G1 and the G3 pair — one of which is byte-identical to the baseline on
 *       any CRLF checkout, which is why the `eolPair` guard exists to keep the pair
 *       non-vacuous. The fixtures are sound; the word "every" was not.
 *   (c) the fixture baseline is NOT "clean by construction whatever the file on disk
 *       says" — see the note above `canonicaliseBaseline`, corrected there.
 *
 *   node scripts/check-supabase-config-schemas.mjs [--self-test]
 *
 * ⚠ `--print` was advertised here until 2026-09-08 and never read: the only `argv` reads
 * are `--self-test`. It is removed from the usage line rather than implemented. ⭐ The
 * same false advertisement stood in `scripts/check-budget-anchor.mjs` and is corrected
 * there in the same commit — a review had recorded gate 15 as honouring the flag, and
 * measuring `argv` in both files is what showed neither did.
 *
 * EXIT CODES: 0 clean · 1 a finding (P1–P4, N1, N2, or an unreadable assignment) ·
 *             2 the checker itself is broken.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG_REL = 'supabase/config.toml'
// ⛔ Resolved from THIS FILE, never from `process.cwd()`. Until 2026-09-08 it was
// `join(process.cwd(), …)`, so running the gate from any directory but the repo root
// exited 1 with `P1_MISSING` — *"does not exist. The gate has no subject"* — a FALSE RED
// that sends a reader hunting for a config nobody deleted. Latent under `npm run lint`
// (always repo root) and it failed loudly rather than green, so it was never a hole; it
// is fixed because the message misdescribed the result, and because message-text
// assertions are only writable as an importable test if the module resolves its own
// subject.
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const CONFIG_PATH = join(REPO_ROOT, 'supabase', 'config.toml')

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

/**
 * ⭐⭐ THE `app` SIGHTING'S SUBJECT: the WHOLE array body, never one line.
 *
 * ⚠ ADDED 2026-09-08 (QA re-review, finding B1 — a defect the previous fix loop
 * INTRODUCED). The sighting probe used to read `kv[1]` alone, i.e. everything after
 * `schemas =` ON THE ASSIGNMENT LINE. For `schemas = [` with the items below it that text
 * is just `[`: `parseArrayLiteral('[')` refuses, the fallback `/["']app["']/` sees nothing,
 * and no later line matches `^schemas\s*=`, so the word never entered the probe and `"app"`
 * added multi-line came back `P3_MULTILINE` — a rendering complaint whose headline never
 * says `app`, which is the exact regression the escalation was built to close.
 * ⛔ And the coverage was VALUE-DEPENDENT: `schemas = ["app",` escalated while
 * `schemas = [` + newline + `"app",` did not, so whether the SECURITY headline appeared
 * turned on where the editor happened to break the line. *A structural binding can be
 * value-dependent* — fixtures `B12+` and `B13+` pin BOTH placements for that reason, and
 * one fixture on either side of the break would have proven nothing about the class.
 *
 * The scan is deliberately DUMB and bounded: comment-stripped, non-blank lines are appended
 * until one contains `]`. A TOML table header contains `]` too, so a never-closed array
 * stops at the next header instead of swallowing the file; a body that never closes at all
 * stops at EOF. Over-collecting can only ever ESCALATE a red that is already firing (the
 * positives are decided by the single-line parse below, untouched), which is the safe
 * direction for this probe.
 *
 * ⛔ WHAT IT STILL DOES NOT BUY — stated here so this comment is not the next false claim
 * nailed over an unexercised cell. It is a TEXT probe for the literal quoted word: a basic
 * string spelling it by escape (`"app"`) defeats both arms, because the parse path
 * decodes backslash escapes only. The claim is *"the word `app`, wherever it sits inside
 * the array"*, NOT *"any expression denoting that schema"*.
 *
 * @param {string[]} lines      the normalised file, split on `\n`.
 * @param {number}   startIdx   0-based index of the `schemas = …` line.
 * @param {string}   valueText  everything after `schemas =` on that line, trimmed.
 * @returns {{text: string, closed: boolean, endLine: number}}
 */
export function collectArrayBody(lines, startIdx, valueText) {
  // Single-line (or not an array at all): the body IS the value text. Unchanged behaviour.
  if (!valueText.startsWith('[') || valueText.includes(']')) {
    return { text: valueText, closed: valueText.includes(']'), endLine: startIdx + 1 }
  }
  const parts = [valueText]
  for (let k = startIdx + 1; k < lines.length; k++) {
    const body = stripTrailingComment(lines[k]).trim()
    if (body === '') continue
    parts.push(body)
    if (body.includes(']')) return { text: parts.join(' '), closed: true, endLine: k + 1 }
  }
  return { text: parts.join(' '), closed: false, endLine: lines.length }
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
  // ⛔⛔ The escalation sighting: ANY `schemas` assignment anywhere in the file that names
  // `app`, recorded independently of the positives so a structural defect in the same
  // edit cannot bury the security event. See the header's escalation note.
  let appSighting = null

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

    // ⛔ Deliberately BEFORE the `[api]` filter and before the parse: the question this
    // answers is "did this edit name `app`?", which is a fact about the EDIT, not about
    // which table the key landed under. An unparseable value still gets a text probe, and
    // the probe's subject is the WHOLE ARRAY BODY — see `collectArrayBody` — so neither a
    // multi-line nor a malformed array is a way to smuggle the word past the headline.
    //
    // ⚠ CORRECTED 2026-09-08 (QA re-review B1). The sentence above stood over code that
    // probed ONE LINE, so its multi-line half was false. Superseded text, quoted verbatim
    // so the claim and its refutation stay together rather than the claim just vanishing:
    //     "An unparseable value still gets a text probe, because a multi-line or malformed
    //      array must not be a way to smuggle the word past the headline."
    // The malformed half WAS honoured (`schemas = "app"` escalated correctly); the
    // multi-line half was not, and it was named first. ⭐ A false claim nailed over an
    // unexercised cell is the defect class this gate exists to close, so the repair is the
    // code plus two fixtures, never a narrower sentence.
    {
      const anyValueText = kv[1].trim()
      const probed = collectArrayBody(lines, idx, anyValueText)
      const anyParsed = parseArrayLiteral(probed.text)
      const namesApp = anyParsed.ok
        ? anyParsed.items.includes('app')
        : /["']app["']/.test(probed.text)
      if (namesApp && !appSighting) {
        appSighting = { line: idx + 1, valueText: probed.text, table }
      }
    }

    if (table !== 'api') continue

    const valueText = kv[1].trim()
    const parsed = parseArrayLiteral(valueText)
    if (!parsed.ok) {
      unreadable.push({ line: idx + 1, valueText, reason: parsed.reason })
      continue
    }
    hits.push({ line: idx + 1, valueText, items: parsed.items })
  }

  // ⛔⛔ ESCALATION. A positive (P2/P3/P4) is a statement about the file's SHAPE; N1 is a
  // statement about what the file now EXPOSES. When both hold, the second one is the
  // headline — otherwise `"app"` added and the sentinel deleted in one commit reds as a
  // formatting problem and the word `app` never reaches the reader. The structural
  // finding is kept, never traded away: it rides underneath, named in `detail.under`.
  const positive = (code, detail) =>
    appSighting
      ? {
          code: 'N1_APP_EXPOSED_WITH_DEFECT',
          detail: {
            ...detail,
            under: code,
            line: appSighting.line,
            valueText: appSighting.valueText,
            table: appSighting.table,
          },
        }
      : { code, detail }

  // ---- P2 — an [api] table exists ------------------------------------------
  if (!sawApiTable) return positive('P2_NO_API_TABLE', {})

  // ---- P3's precondition — anything unreadable is REFUSED, never skipped ----
  // Ordered ahead of the count so a multi-line array can never degrade into
  // "zero assignments found", which reads as a different (and wrong) defect.
  if (unreadable.length > 0) {
    const u = unreadable[0]
    return positive(u.reason === 'multiline' ? 'P3_MULTILINE' : 'P3_UNREADABLE', u)
  }

  // ---- P3 — exactly one, parsing to a NON-EMPTY list ------------------------
  if (hits.length === 0) return positive('P3_NONE', {})
  if (hits.length > 1) return positive('P3_DUPLICATE', { hits })
  const hit = hits[0]
  if (hit.items.length === 0) return positive('P3_EMPTY_LIST', hit)

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
  if (!block.includes(SENTINEL)) return positive('P4_NO_SENTINEL', hit)

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

/**
 * ⭐ EXPORTED since 2026-09-08 so the self-test can assert R16's condition on the MESSAGE
 * TEXT. Until then the self-test compared `got.code` against `f.expect` and never called
 * this function once, so "N1 and N2 must not produce the same message" — a hard condition
 * — was held by reading the file, not by anything that could red. Fixture `M1+` closes it.
 */
export function report(code, detail) {
  const at = detail && detail.line ? `${CONFIG_REL}:${detail.line}` : CONFIG_REL
  // The consequence figures. ⛔ Live counts: see the header for their predicates, their
  // date and why the effective one is NOT inferred from `320` §U1's ACL-shaped 236.
  const APP_FN_TOTAL = 526
  const APP_FN_ANON_EXECUTABLE = 236
  const n1Headline = `⛔⛔ SECURITY EVENT — ${at}: \`"app"\` HAS BEEN ADDED TO THE POSTGREST-EXPOSED SCHEMAS — ${APP_FN_ANON_EXECUTABLE} \`app\` functions become directly \`anon\`-callable in this same edit.`
  const n1Body = [
    ``,
    `    ${detail && detail.valueText ? detail.valueText : '(list unreadable — see below)'}`,
    ``,
    `THE CONSEQUENCE, in this same edit: schema \`app\` holds ${APP_FN_TOTAL} functions, of which`,
    `**${APP_FN_ANON_EXECUTABLE}** are \`anon\`-executable — mostly through \`proacl IS NULL\`, the Postgres default`,
    `nobody wrote, which includes PUBLIC. They confer nothing today ONLY because \`app\` is not`,
    `exposed. Exposing it makes all ${APP_FN_ANON_EXECUTABLE} directly callable by \`anon\` over PostgREST`,
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
  ]
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
      return `${at}: the load-bearing comment sentinel is missing from the comment block immediately above the \`schemas\` assignment. Expected this line, verbatim:\n\n    # ${SENTINEL}\n\nThe block's prose may be edited freely; the sentinel is what must survive, because it is the only thing telling the next editor that this line is the whole bound on ${APP_FN_ANON_EXECUTABLE} \`anon\`-executable \`app\` functions.`
    case 'N1_APP_EXPOSED':
      return [n1Headline, ...n1Body].join('\n')
    case 'N1_APP_EXPOSED_WITH_DEFECT':
      return [
        n1Headline,
        ``,
        `⚠ AND THE FILE IS ALSO STRUCTURALLY BROKEN IN THE SAME EDIT (${detail.under}). The`,
        `security event is reported FIRST and the structural finding is kept, not traded away:`,
        `read both, fix both. Before 2026-09-08 this combination reported only the structural`,
        `code — so \`"app"\` added together with a deleted sentinel reds as a formatting`,
        `complaint whose headline never said the word \`app\`, which is exactly the edit the`,
        `sentinel exists to survive.`,
        ...n1Body,
        ``,
        `── THE STRUCTURAL FINDING UNDERNEATH (${detail.under}) ──`,
        ``,
        report(detail.under, detail),
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
 * FORCED on. When the file is clean the two are byte-identical and G1 is literally the
 * real file's current bytes, as the plan's §3.4 table asks. When it is not, the self-test
 * still measures the checker and the real scan reports the finding — and the output says
 * which of the two happened.
 *
 * ⚠ CORRECTED 2026-09-08. This paragraph used to end *"i.e. clean by construction whatever
 * the file on disk says"*, and that is FALSE. The repair below is narrow by design: it
 * rewrites the VALUE TEXT (first match only, no `/g`) and re-inserts a GLOBALLY ABSENT
 * sentinel. It cannot produce `OK` from a deleted `schemas` line, a duplicate assignment,
 * a multi-line array, a missing `[api]` table, or a sentinel that still exists somewhere
 * else in the file. ⭐ That is not a defect — `selfTest()`'s `return 1` branch exists
 * precisely for those cases and says so — but "whatever the file says" claimed a totality
 * the code never had.
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

  /**
   * @type {{id:string,name:string,text:string,mustCatch:boolean,expect?:string,
   *         expectUnder?:string,mustDifferFromBaseline?:boolean,eolPair?:string,
   *         shape?:(t:string)=>true|string}[]}
   */
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
    // ⭐⭐ THE COMBINATION CELL. B1 and B4 were strictly separate fixtures, so no arm of
    // this self-test had ever asked what happens when BOTH hold — and the answer was
    // wrong: `P4_NO_SENTINEL`, a formatting complaint whose headline never says `app`.
    // *A mutation list keyed on assertions cannot see an unexercised cell*, inside the
    // gate built to answer that class. ⛔ It is not enough that this reds; it must red as
    // the SECURITY event, which is what pinning `expect` here asserts.
    {
      id: 'B11+',
      name: '[ADDED] "app" added AND the sentinel deleted in the same edit — the combination cell',
      text: dropLineMatching(
        withValue(baseline, '["public", "graphql_public", "app"]'),
        /DO NOT ADD "app" TO THIS LIST/,
      ),
      mustCatch: true,
      expect: 'N1_APP_EXPOSED_WITH_DEFECT',
      expectUnder: 'P4_NO_SENTINEL',
      // ⛔ Both halves must actually be present, or this silently degrades into a copy of
      // B1 (sentinel never removed) or of B4 (value never changed) — same green, a
      // fixture that no longer tests the combination at all.
      shape: (t) => {
        if (/DO NOT ADD "app" TO THIS LIST/.test(t)) return 'the sentinel must be GONE'
        if (!/^\s*schemas\s*=.*"app"/m.test(t)) return 'the schemas line must NAME "app"'
        return true
      },
    },

    // ⭐⭐ THE MULTI-LINE COMBINATION CELL, IN BOTH ITS PLACEMENTS (re-review B1).
    // `B7` is multi-line WITHOUT `app`; `B11+` is single-line WITH it. Neither asked what
    // happens when a list is REFORMATTED WHILE BEING EXTENDED — the second-most-predictable
    // way to add a schema — and the answer was `P3_MULTILINE`, a rendering complaint whose
    // headline never says `app`.
    // ⛔ TWO fixtures, not one, and the reason is a measurement: before the repair, the
    // opening-line placement ESCALATED (the word was inside `kv[1]`) and the later-line
    // placement did NOT. A single fixture that happened to sit on the escalating side would
    // have been green from birth and would have proven nothing about the class —
    // *a structural binding can be value-dependent*. Each shape guard therefore pins WHICH
    // side of the break its own word sits on, so neither can drift into a copy of the other.
    // ⚠ `^[ \t]*`, NOT `^\s*`, and that is a MEASUREMENT, not a style choice. `\s` matches
    // `\n`, and JS's multiline `^` also matches after a lone `\r` — so on this CRLF working
    // tree (`git ls-files --eol` = `i/lf w/crlf`) `/^\s*schemas/m` matched starting at the
    // `\n` of the PREVIOUS line's CRLF and the replacement swallowed it, gluing the sentinel
    // line and the new opening line together behind a bare `\r`. Both shape guards below
    // caught it on their first run (`the schemas assignment must survive`) — which is the
    // guard earning its place — and `split(/\r\n|\r|\n/)` is used rather than `/\r?\n/` so
    // the guard reads lines the way `normalise()` does, not the way a LF tree would.
    {
      id: 'B12+',
      name: '[ADDED] multi-line array with "app" ON THE OPENING LINE — the placement that already escalated',
      text: baseline.replace(
        /^[ \t]*schemas[ \t]*=.*$/m,
        ['schemas = ["app",', '  "public",', '  "graphql_public",', ']'].join(eol),
      ),
      mustCatch: true,
      expect: 'N1_APP_EXPOSED_WITH_DEFECT',
      expectUnder: 'P3_MULTILINE',
      shape: (t) => {
        const ls = t.split(/\r\n|\r|\n/)
        const i = ls.findIndex((l) => /^\s*schemas\s*=/.test(l))
        if (i === -1) return 'the `schemas` assignment must survive'
        if (!/^\s*schemas\s*=\s*\[[^\]]*$/.test(ls[i])) {
          return 'the array must OPEN on the assignment line and must NOT close on it'
        }
        if (!/"app"/.test(ls[i])) {
          return 'this cell puts "app" ON THE OPENING LINE — that placement is the whole difference from B13+'
        }
        return true
      },
    },
    {
      id: 'B13+',
      name: '[ADDED] multi-line array with "app" on a LATER line — the cell that returned P3_MULTILINE and never said `app`',
      text: baseline.replace(
        /^[ \t]*schemas[ \t]*=.*$/m,
        ['schemas = [', '  "public",', '  "graphql_public",', '  "app",', ']'].join(eol),
      ),
      mustCatch: true,
      expect: 'N1_APP_EXPOSED_WITH_DEFECT',
      expectUnder: 'P3_MULTILINE',
      shape: (t) => {
        const ls = t.split(/\r\n|\r|\n/)
        const i = ls.findIndex((l) => /^\s*schemas\s*=/.test(l))
        if (i === -1) return 'the `schemas` assignment must survive'
        if (!/^\s*schemas\s*=\s*\[\s*$/.test(ls[i])) {
          return 'the opening line must carry NOTHING after `[` — that `kv[1]` is exactly `[` IS the defect this cell reproduces'
        }
        if (/"app"/.test(ls[i])) return '"app" must NOT be on the opening line — that cell is B12+'
        const close = ls.findIndex((l, k) => k > i && l.includes(']'))
        if (close === -1) return 'the array must CLOSE, or this is testing an unterminated file instead'
        if (!ls.slice(i + 1, close + 1).some((l) => /"app"/.test(l))) {
          return '"app" must appear on a line AFTER the opening line and inside the array body'
        }
        return true
      },
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

  // ⭐⭐ M1+ — R16's HARD CONDITION, asserted on the MESSAGE instead of read off the file.
  // "N1 and N2 must not produce the same message … a reader who meets the red must be
  // able to tell in ONE LINE which of the two happened." Every fixture above compares
  // `got.code`; none of them had ever called `report()`, so the condition on the PROSE was
  // enforced by nobody — in a gate whose whole subject is that a sentence is not an
  // enforcer.
  {
    const d = { line: 51, valueText: '["public", "graphql_public", "app"]', under: 'P4_NO_SENTINEL' }
    const headline = (code) => String(report(code, d)).split('\n')[0]
    const fail = (why) => {
      broken++
      lines.push(`  M1+ R16 MESSAGE CONDITION — ${why}`)
    }
    const n1 = headline('N1_APP_EXPOSED')
    const n1d = headline('N1_APP_EXPOSED_WITH_DEFECT')
    const n2a = headline('N2A_LIST_CHANGED')
    const n2b = headline('N2B_RERENDERED')

    // ⛔ THE DEAD-INSTRUMENT GUARD, first. Two `undefined`s are also "distinct" from
    // nothing and identical to each other; a distinctness check over empty strings proves
    // nothing. Each headline must be a real, substantial line before its difference means
    // anything.
    for (const [name, h] of [['N1', n1], ['N1+defect', n1d], ['N2A', n2a], ['N2B', n2b]]) {
      if (typeof h !== 'string' || h.trim().length < 40) {
        fail(`${name}'s headline is not a substantial string (got ${JSON.stringify(h)}) — a distinctness result over this would be vacuous`)
      }
    }
    // ⭐ POSITIVE CONTROL on the comparator itself: it must be able to say SAME, or
    // "they differ" is a verdict from an instrument that can only ever return one answer.
    if (headline('N2A_LIST_CHANGED') !== n2a) {
      fail('the comparator cannot recognise two identical headlines as identical — it can only ever report "distinct", which is not a measurement')
    }

    if (n1 === n2a || n1 === n2b) fail('the N1 and N2 headlines are the SAME STRING')
    if (n1d === n2a || n1d === n2b) fail('the escalated N1 headline is the same string as an N2 headline')
    // ⛔ B4's condition, held here and nowhere else: the security event must NAME ITS
    // SUBJECT on line one, in BOTH the plain and the escalated form. The escalated form is
    // the one that used to come back as `P4_NO_SENTINEL` with `app` nowhere in sight.
    if (!/\bapp\b/.test(n1)) fail('the N1 headline does not contain the word `app`')
    if (!/\bapp\b/.test(n1d)) fail('the ESCALATED N1 headline does not contain the word `app` — this is the exact regression B4 records')
    if (!/SECURITY EVENT/.test(n1d)) fail('the escalated headline does not announce a SECURITY EVENT')
    // R16 also requires the N1 text to name the consequence; the header claims it does so
    // on the headline, so assert that rather than trusting the claim.
    if (!/\d{2,}/.test(n1)) fail('the N1 headline does not carry the consequence COUNT, though the header says it does')
    // And the review event must not masquerade as the security one.
    if (/SECURITY EVENT/.test(n2a) || /SECURITY EVENT/.test(n2b)) {
      fail('an N2 REVIEW-event headline announces itself as a SECURITY EVENT')
    }
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
      // ⛔ `expect` alone cannot see whether the STRUCTURAL finding survived UNDERNEATH an
      // escalated headline, and "kept, never traded away" is the whole content of B4's
      // repair. A fixture that names `expectUnder` asserts both halves. ⚠ A missing
      // `detail` fails here rather than passing silently — an absent field is not a match.
      if (f.expectUnder && (!got.detail || got.detail.under !== f.expectUnder)) {
        broken++
        lines.push(
          `  ${f.id} escalated over the WRONG structural finding: expected under=${f.expectUnder}, got under=${got.detail ? String(got.detail.under) : '(no detail)'}`,
        )
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
