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
])

/** Files permitted to hold raw DML, each with a recorded reason. */
const ALLOWLIST = new Map([
  // (empty — every application writer goes through the door as of W3/T3.3)
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
