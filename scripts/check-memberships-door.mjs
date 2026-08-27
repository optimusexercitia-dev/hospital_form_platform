#!/usr/bin/env node
/**
 * ADR 0094 W3/T3.4 (+ ADR 0098 W2.1) — the raw-DML repo gate for DOOR-ONLY tables.
 *
 * Package B's end state is that application code performs NO direct DML on
 * `public.memberships`: every grant and revoke goes through `grant_role` /
 * `revoke_role` (cookie-authenticated) or `grant_role_for` / `revoke_role_for`
 * (service-role), so authority is re-derived in PostgreSQL for a named actor.
 *
 * That end state has to survive future phases, and review does not scale to it —
 * ADR 0075's split was itself a documented, reviewed decision, and it still left
 * `grant_role` with ZERO callers while every real grant went around it. A phase that
 * adds "just one" `.from('memberships').insert(...)` re-opens the hole silently,
 * because the row it writes looks identical to a door-written one.
 *
 * So the rule is enforced mechanically, in the `npm run lint` family.
 *
 * ⚠ AFF W2 ADDS `hospital_affiliations` (ADR 0097 D13 / ADR 0098 W2.1). It is the same
 * posture for the same reason — a write that grants read access to a person's profile
 * is an authorization mutation regardless of its HR clothing — and it is here rather
 * than in an ADR paragraph because W1 shipped exactly the raw `.insert()` this gate
 * forbids, and nothing but a re-read caught it. A convention in prose is the class of
 * claim that goes stale silently.
 *
 * WHAT IS CHECKED: the supabase-js DML verb applied DIRECTLY to a gated table's query
 * builder — `.from('<table>').insert|upsert|update|delete(`. Reads (`.select(`) are
 * allowed and used deliberately: several actions must know what a principal already
 * holds before deciding what to ask the door for.
 *
 * Matching the verb that immediately follows `.from('<table>')` — rather than grepping
 * the file for both tokens — is what keeps this from firing on an unrelated `.delete()`
 * elsewhere in the same function.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src']
const EXTENSIONS = ['.ts', '.tsx']
const DML_VERBS = ['insert', 'upsert', 'update', 'delete']

/**
 * AE1.4 SWITCH (ADR 0155 Phase AE1; docs/plans/authz-evolution.md § AE1.3/AE1.4).
 * `profiles` + `professional_credentials` are BECOMING door-only tables — AE1.3 converts
 * the person-authority raw DML in `src/lib/users/actions.ts` (+ the one self-scoped write
 * in `src/lib/auth/actions.ts`) to six service-role doors: `finalize_invited_person_for`,
 * `update_person_fields_for` (incl. its `cpf_change` capability arm), `set_person_active_for`,
 * `suspend_person_for`, `upsert_credential_for`, `delete_credential_for`.
 *
 * ✅ STATUS: AE1.3 HAS landed on this branch, so the switch is ON. Verified two
 * ways before the flip, because either alone is weak: `grep -rl
 * "finalize_invited_person_for" supabase/migrations/` names
 * `20261003004610_person_profile_doors.sql`, AND the live catalog carries all six
 * doors (`pg_proc` count = 6). The catalog is the authority — migration text is stale
 * by design, and the grep only answers the file-existence half.
 *
 * ⛔ Turning this back OFF is not a rollback, it is a hole: the ten pre-AE1.3 raw-DML
 * sites it used to permit are gone, so OFF now buys nothing and merely stops the gate
 * from noticing if one comes back.
 */
const ENFORCE_PERSON_AUTHORITY_DOORS = true // AE1.3's six doors exist (catalog-verified)

/** AE1.3's target shape for `profiles` / `professional_credentials` (see switch above). */
const PERSON_AUTHORITY_TABLES = [
  [
    'profiles',
    {
      cookie:
        '(none — a write to another person’s profile is always an admin action issued ' +
        'via the service-role client; a self-scoped write, e.g. clearing ' +
        'must_change_password on the caller’s OWN row, is exempted via ALLOWLIST below ' +
        'instead of doored — AE1.3 deliberately excludes it, "converting it adds a door ' +
        'with no second principal")',
      service:
        "admin.rpc('finalize_invited_person_for' | 'update_person_fields_for' | " +
        "'set_person_active_for' | 'suspend_person_for', { p_actor, ... })",
      adr: 'AE1.3, ADR 0155 Phase AE1 (docs/plans/authz-evolution.md)',
    },
  ],
  [
    'professional_credentials',
    {
      cookie: '(none — same posture as profiles above; no self-scoped exception exists here)',
      service:
        "admin.rpc('upsert_credential_for' | 'delete_credential_for', { p_actor, ... })",
      adr: 'AE1.3, ADR 0155 Phase AE1 (docs/plans/authz-evolution.md)',
    },
  ],
]

/** Door-only tables: table -> the doors that own its writes (used in the error copy). */
const GATED_TABLES = new Map([
  [
    'memberships',
    {
      cookie: "supabase.rpc('grant_role' | 'revoke_role', { ... })",
      service: "admin.rpc('grant_role_for' | 'revoke_role_for', { p_actor, ... })",
      adr: 'ADR 0094 W3/T3.4',
    },
  ],
  [
    'hospital_affiliations',
    {
      cookie: "supabase.rpc('affiliate_person' | 'end_affiliation', { ... })",
      service:
        "admin.rpc('affiliate_person_for' | 'end_affiliation_for', { p_actor, ... })",
      adr: 'ADR 0097 D13 / ADR 0098 W2.1',
    },
  ],
  // ENFORCE_PERSON_AUTHORITY_DOORS gates whether the two lines below are active — see
  // the switch comment above. ON since AE1.3's doors landed.
  ...(ENFORCE_PERSON_AUTHORITY_DOORS ? PERSON_AUTHORITY_TABLES : []),
])

/** Files permitted to hold raw DML, each with a recorded reason. */
// SITE-scoped, never FILE-scoped. The earlier shape was `Map<relPath, reason>` checked as
// `if (ALLOWLIST.has(rel)) continue`, which skipped the WHOLE FILE - so any future raw
// `profiles` / `professional_credentials` DML anywhere in `src/lib/auth/actions.ts` would have
// passed silently. This script's own docstring argues against exactly that ("allowlisting the
// file would grant it blanket permission for REAL raw DML, which is strictly more than the
// problem asks for") and then did it; corrected 2026-08-27 (QA finding m2). The plan asked for
// a "named allowlist entry for the self-scoped must_change_password SITE" - a site.
//
// A site is (file, table, verb) PLUS a marker that must appear in the statement window. The
// marker is what makes it a site: a different raw write to the same table in the same file does
// not carry it, and reds.
const ALLOWLIST = [
  {
    rel: 'src/lib/auth/actions.ts',
    table: 'profiles',
    verb: 'update',
    marker: 'must_change_password',
    reason:
      'updatePassword clears profiles.must_change_password on the CALLER OWN row ' +
      "(`.eq('id', user.id)` where user.id comes from `supabase.auth.getUser()` on the " +
      'SAME request) - self-scoped by construction, not an admin-on-another-person write. ' +
      'AE1.3 (ADR 0155 Phase AE1) deliberately excludes this site from door conversion: ' +
      '"converting it adds a door with no second principal." LIVE, not inert: ' +
      'ENFORCE_PERSON_AUTHORITY_DOORS is now true and `profiles` is in GATED_TABLES, so this ' +
      'entry is the only thing keeping the site green.',
  },
]

/** Window a marker must appear in: the `.from(` match onward. Bounded on purpose - a
 *  whole-file search would re-create the file scope this replaced. */
const SITE_WINDOW = 400

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walk(full, out)
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

/**
 * Replace COMMENT CONTENT with spaces, preserving every newline and the total character
 * count so `m.index`-derived line numbers stay exact.
 *
 * ⛔ Without this the gate matches PROSE ABOUT the code it gates. It flagged
 * `d14-person-level.test.ts`, whose docstring says the person writes "moved from raw
 * `.from('profiles').update({…})` to `public.*_for` doors" — the sentence documenting the
 * very migration that removed the raw DML. That is the `ui-copy-forbidden-strings` class:
 * source cannot separate live code from prose about it, so the matcher must.
 *
 * The alternatives were worse. Rewording the docstring to dodge a text matcher makes the
 * documentation serve the tool; allowlisting the file would grant it blanket permission
 * for REAL raw DML, which is strictly more than the problem asks for.
 *
 * String-aware on purpose: a naive stripper treats the `//` in a URL literal as a comment
 * start and blanks the rest of that line, which would SILENCE a finding rather than
 * surface one. Regex literals need no special case — `//` is an empty regex (invalid) and
 * a `/*` opener is a quantifier with nothing to repeat (invalid), so neither can start a
 * comment.
 */
function blankComments(src) {
  const NL = '\n'
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== NL) {
        out += ' '
        i++
      }
      continue
    }
    if (c === '/' && d === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === NL ? NL : ' '
        i++
      }
      if (i < n) out += '  '
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n) {
        // 92 = backslash. Written numerically because a literal escape does not
        // survive every shell round-trip on Windows (it silently collapses).
        if (src.charCodeAt(i) === 92) {
          out += src.slice(i, i + 2)
          i += 2
          continue
        }
        out += src[i]
        if (src[i] === quote) {
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

const violations = []

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    // Comments blanked first — see `blankComments`: the gate must not match prose
    // about the very code it gates.
    const src = blankComments(readFileSync(file, 'utf8'))

    // Every `.from('<gated table>')` / `.from("<gated table>")` occurrence. The table
    // name is captured so a new gated table needs only a GATED_TABLES entry.
    const fromRe = new RegExp(
      `\\.from\\(\\s*['"](${[...GATED_TABLES.keys()].join('|')})['"]\\s*\\)`,
      'g',
    )
    let m
    while ((m = fromRe.exec(src)) !== null) {
      // The next method call in the chain decides the verdict. Whitespace, newlines
      // and comments may sit between, so skip them rather than assuming one line.
      const rest = src
        .slice(m.index + m[0].length)
        .replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '')
      const next = /^\.(\w+)\s*\(/.exec(rest)
      if (!next) continue
      if (!DML_VERBS.includes(next[1])) continue

      const line = src.slice(0, m.index).split('\n').length
      // Site-scoped exemption: the marker must appear in THIS statement's window.
      const win = src.slice(m.index, m.index + SITE_WINDOW)
      if (
        ALLOWLIST.some(
          (a) =>
            a.rel === rel && a.table === m[1] && a.verb === next[1] && win.includes(a.marker),
        )
      )
        continue

      violations.push({ rel, line, table: m[1], verb: next[1] })
    }
  }
}

if (violations.length > 0) {
  console.error('\n[31mRaw DML on a door-only table is not allowed.[0m\n')
  for (const v of violations) {
    const door = GATED_TABLES.get(v.table)
    console.error(
      `  ${v.rel}:${v.line}  .from('${v.table}').${v.verb}(...)   [${door.adr}]\n` +
        `      cookie-authenticated  ->  ${door.cookie}\n` +
        `      service-role paths    ->  ${door.service}`,
    )
  }
  console.error(
    '\nUse the door, so PostgreSQL re-derives the actor’s authority for a NAMED actor.\n' +
      '`.select(...)` on these tables is fine — only insert/upsert/update/delete are gated.\n',
  )
  process.exit(1)
}

console.log(
  `door gate: OK (no raw DML on ${[...GATED_TABLES.keys()].join(', ')} in ${SCAN_DIRS.join(', ')})`,
)
