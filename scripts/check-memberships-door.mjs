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
 * ⛔ STATUS as of this write: AE1.3 has NOT landed on this branch — verify before
 * touching this switch: `grep -rl "finalize_invited_person_for" supabase/migrations/`
 * finds nothing (re-check the live catalog, not this comment, if in doubt — migration
 * text is stale by design, but "zero migrations named it" is a file-existence fact this
 * grep can answer honestly). Flipping `ENFORCE_PERSON_AUTHORITY_DOORS` to `true` before
 * those doors exist reds `npm run lint` for every session on this branch, because the
 * TEN pre-AE1.3 raw-DML sites on these two tables (measured: AE0.4 census, family
 * `from-verb`) are exactly the writes the doors are meant to replace — the gate would
 * have nothing to allow them through.
 *
 * Flip to `true` in the SAME change that lands AE1.3's door migrations (or immediately
 * after, same phase) — never speculatively, and never as an isolated edit to this file.
 */
const ENFORCE_PERSON_AUTHORITY_DOORS = false // AE1.4 — flip only once AE1.3's six doors exist

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
  // the switch comment above. OFF today: AE1.3's doors do not exist yet.
  ...(ENFORCE_PERSON_AUTHORITY_DOORS ? PERSON_AUTHORITY_TABLES : []),
])

/** Files permitted to hold raw DML, each with a recorded reason. */
const ALLOWLIST = new Map([
  [
    'src/lib/auth/actions.ts',
    'updatePassword clears profiles.must_change_password on the CALLER’S OWN row ' +
      "(`.eq('id', user.id)` where user.id comes from `supabase.auth.getUser()` on the " +
      'SAME request) — self-scoped by construction, not an admin-on-another-person write. ' +
      'AE1.3 (ADR 0155 Phase AE1) deliberately excludes this site from door conversion: ' +
      '"converting it adds a door with no second principal." Only takes effect once ' +
      'ENFORCE_PERSON_AUTHORITY_DOORS above is flipped true and `profiles` enters ' +
      'GATED_TABLES — inert allowlisting of an already-ungated table today.',
  ],
])

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

const violations = []

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (ALLOWLIST.has(rel)) continue
    const src = readFileSync(file, 'utf8')

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
