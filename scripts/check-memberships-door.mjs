#!/usr/bin/env node
/**
 * ADR 0094 W3/T3.4 — the raw-`memberships`-DML repo gate.
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
 * WHAT IS CHECKED: the supabase-js DML verb applied DIRECTLY to a `memberships`
 * query builder — `.from('memberships').insert|upsert|update|delete(`. Reads
 * (`.select(`) are allowed and used deliberately: several actions must know what a
 * principal already holds before deciding what to ask the door for.
 *
 * Matching the verb that immediately follows `.from('memberships')` — rather than
 * grepping the file for both tokens — is what keeps this from firing on an unrelated
 * `.delete()` elsewhere in the same function.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src']
const EXTENSIONS = ['.ts', '.tsx']
const DML_VERBS = ['insert', 'upsert', 'update', 'delete']

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

    // Every `.from('memberships')` / `.from("memberships")` occurrence.
    const fromRe = /\.from\(\s*['"]memberships['"]\s*\)/g
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
      violations.push({ rel, line, verb: next[1] })
    }
  }
}

if (violations.length > 0) {
  console.error(
    '\n[31mRaw `memberships` DML is not allowed (ADR 0094 W3/T3.4).[0m\n',
  )
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  .from('memberships').${v.verb}(...)`)
  }
  console.error(
    '\nUse the door instead, so PostgreSQL re-derives the actor’s authority:\n' +
      "  cookie-authenticated  ->  supabase.rpc('grant_role' | 'revoke_role', { ... })\n" +
      "  service-role paths    ->  admin.rpc('grant_role_for' | 'revoke_role_for', { p_actor, ... })\n" +
      '\n`.select(...)` on memberships is fine — only insert/upsert/update/delete are gated.\n',
  )
  process.exit(1)
}

console.log(
  `memberships-door gate: OK (no raw DML in ${SCAN_DIRS.join(', ')})`,
)
