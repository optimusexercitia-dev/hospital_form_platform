#!/usr/bin/env node
/**
 * FUP-DM5-SETLOCAL-MIGRATION (DM-FUP TRIAGE #7) — `SET LOCAL` at the top level of a
 * migration is not guaranteed to be inside a transaction.
 *
 * THE DEFECT. `set local` only has effect inside a transaction. If the migration runner
 * does not wrap the file in one, the statement is a SILENT no-op — Postgres emits a
 * `25P01` WARNING ("there is no transaction in progress") and carries on. A plain
 * `supabase db reset --local` emits six of them today. Nothing fails, so it passes every
 * local gate.
 *
 * WHY THAT IS DANGEROUS RATHER THAN UNTIDY. The load-bearing uses of `set local` here are
 * GUCs that open an immutability guard around a DATA-DEPENDENT BACKFILL. On a fresh local
 * reset the backfill matches zero rows, the guard never fires, and the no-op is invisible.
 * On a data-bearing target — the remote — it is not. See the
 * `backfill-guard-wrap-data-dependent-migration` record.
 *
 * THE REMEDY this gate enforces: put the GUC and the statements it protects inside ONE
 * `do $$ ... $$` block (a plpgsql block always runs in a transaction), or inside an
 * explicit `begin; ... commit;`. Either removes the dependency on the runner's behaviour.
 *
 * ---------------------------------------------------------------------------
 * THE WATERMARK IS A GRANDFATHER LINE. DO NOT BUMP IT ON A PUSH.
 * ---------------------------------------------------------------------------
 * Twelve migrations already contain `set local`; all twelve sit at or below the
 * watermark, and applied history may not be edited in place (that creates the drift that
 * blocks `db push` — restore, don't repair). So the line grandfathers exactly those, and
 * everything ABOVE it is checked forever.
 *
 * It is NOT a pointer at the remote's HEAD. Advancing it after each `db push` would
 * grandfather the files you just wrote — converting this gate from one that rots toward
 * STRICTER into one that rots toward WEAKER. That trade was made deliberately in the
 * other direction:
 *
 *   an ALLOWLIST rots weaker  — an entry outlives its file and silently skips it
 *                               (FUP-AUTHZ-ALLOWLIST-ROT: six such entries, filing named one)
 *   a WATERMARK rots stricter — it starts checking newly-frozen files and reds LOUDLY
 *
 * Given a choice of rot, choose the one that fails loud.
 *
 * SELF-TEST, run on every invocation before the scan. A gate nobody has seen fire is not
 * a gate — and the failure mode that matters here is a scanner that enters a dollar quote
 * and never leaves, which would pass EVERY file in the repo silently. The fixture "bare
 * set local AFTER a closed do-block" is the only one that can catch that.
 *
 *   node scripts/check-migration-set-local.mjs [--self-test] [--list]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

/** Grandfather line — read the block above before touching this. */
const WATERMARK = '20260928000500'

/**
 * Scan one migration body and return the 1-based line numbers of `SET LOCAL` statements
 * that sit at the top level: outside every dollar-quoted body and outside any explicit
 * transaction.
 *
 * Hand-rolled rather than regex because the whole question is CONTEXT — the same eight
 * characters are a defect at top level, correct inside `do $$`, and irrelevant inside a
 * comment or a string literal. A regex cannot tell those apart, which is why
 * `grep -l 'set local'` bounded by SYNTAX finds 12 files where the BEHAVIOUR finds 4.
 */
export function findTopLevelSetLocal(sql) {
  const hits = []
  let i = 0
  let tx = 0 // depth of explicit begin/commit
  const n = sql.length
  const lineAt = (idx) => sql.slice(0, idx).split('\n').length

  while (i < n) {
    const c = sql[i]

    // --- line comment -----------------------------------------------------
    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i)
      i = nl === -1 ? n : nl + 1
      continue
    }

    // --- block comment (Postgres nests these) -----------------------------
    if (c === '/' && sql[i + 1] === '*') {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2; continue }
        if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2; continue }
        i++
      }
      continue
    }

    // --- single-quoted string ('' is an escaped quote) ---------------------
    if (c === "'") {
      i++
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue }
        if (sql[i] === "'") { i++; break }
        i++
      }
      continue
    }

    // --- double-quoted identifier -----------------------------------------
    if (c === '"') {
      i++
      while (i < n) {
        if (sql[i] === '"' && sql[i + 1] === '"') { i += 2; continue }
        if (sql[i] === '"') { i++; break }
        i++
      }
      continue
    }

    // --- dollar quote: $$ or $tag$ (NOT $1, a positional parameter) --------
    // Consumed WHOLE: everything between the delimiters is a body, so a `set local`
    // inside it is correct by construction and never reaches the word branch below.
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i))
      if (m) {
        const tag = m[0]
        const close = sql.indexOf(tag, i + tag.length)
        // An unterminated dollar quote means the rest of the file is body. Treating it
        // as such under-reports rather than mis-reports, which is the safe direction.
        if (close === -1) break
        i = close + tag.length
        continue
      }
      i++
      continue
    }

    // --- bare words we care about -----------------------------------------
    if (/[A-Za-z_]/.test(c)) {
      const w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i))[0]
      const lw = w.toLowerCase()
      const rest = sql.slice(i + w.length)

      if (lw === 'begin' || lw === 'start') {
        // Dollar bodies are consumed whole above, so plpgsql's `begin` cannot reach
        // here. At this point `begin` can only be opening a transaction.
        if (lw === 'begin' || /^\s+transaction\b/i.test(rest)) tx++
      } else if (lw === 'commit' || lw === 'rollback' || lw === 'end') {
        if (tx > 0) tx--
      } else if (lw === 'set') {
        if (/^\s+local\b/i.test(rest) && tx === 0) hits.push(lineAt(i))
      }

      i += w.length
      continue
    }

    i++
  }

  return hits
}

/** A migration is in scope iff its leading version is strictly ABOVE the watermark. */
export function isInScope(filename) {
  const v = /^(\d+)_/.exec(filename)
  return v ? v[1] > WATERMARK : false
}

// ---------------------------------------------------------------------------
// Self-test — the positive control the ruling requires.
// ---------------------------------------------------------------------------

const FIXTURES = [
  // ---- must FLAG ----
  { flag: true, name: 'bare set local at top level', sql: `set local role postgres;` },
  { flag: true, name: 'uppercase SET LOCAL', sql: `SET LOCAL app.x = '1';` },
  { flag: true, name: 'newline between set and local', sql: `set\n  local app.x = '1';` },
  // THE ONE THAT MATTERS: a scanner that enters $$ and never leaves would pass every
  // file in the repo silently. This is the only fixture that can catch that.
  { flag: true, name: 'bare set local AFTER a closed do-block', sql: `do $$ begin perform 1; end $$;\nset local app.x = '1';` },
  { flag: true, name: 'bare set local AFTER a closed transaction', sql: `begin;\nselect 1;\ncommit;\nset local app.x = '1';` },
  { flag: true, name: 'set local after a comment containing $$', sql: `-- careful with $$ here\nset local app.x = '1';` },
  { flag: true, name: 'set local after a string containing $$', sql: `select '$$';\nset local app.x = '1';` },
  { flag: true, name: 'set local after a TAGGED block closes', sql: `do $fn$ begin perform 1; end $fn$;\nset local app.x = '1';` },

  // ---- must stay CLEAN ----
  { flag: false, name: 'set local inside do $$', sql: `do $$ begin set local app.x = '1'; perform 1; end $$;` },
  { flag: false, name: 'set local inside a tagged do block', sql: `do $fn$ begin set local app.x = '1'; end $fn$;` },
  { flag: false, name: 'set local inside begin; ... commit;', sql: `begin;\nset local app.x = '1';\ncommit;` },
  { flag: false, name: 'set local inside a function body', sql: `create function f() returns void language plpgsql as $$ begin set local app.x = '1'; end $$;` },
  { flag: false, name: 'set local only in a line comment', sql: `-- set local app.x = '1';\nselect 1;` },
  { flag: false, name: 'set local only in a block comment', sql: `/* set local app.x = '1'; */\nselect 1;` },
  { flag: false, name: 'set local only in a string literal', sql: `select 'set local app.x';` },
  { flag: false, name: 'plain SET (not LOCAL) is out of scope', sql: `set search_path = public;` },
  { flag: false, name: '$1 positional param is not a quote opener', sql: `create function f(int) returns int language sql as $q$ select $1 $q$;\nselect 1;` },
  { flag: false, name: 'nested block comment closes correctly', sql: `/* a /* b */ set local x = 1; */\nselect 1;` },
  { flag: false, name: 'set local inside start transaction', sql: `start transaction;\nset local app.x = '1';\ncommit;` },
]

const SCOPE_FIXTURES = [
  { want: false, name: 'a pre-watermark offender is grandfathered', file: '20260921000300_retire.sql' },
  { want: false, name: 'the watermark file ITSELF is grandfathered', file: `${WATERMARK}_finalize.sql` },
  { want: true, name: 'the first file above the watermark is checked', file: '20260928000600_dvf.sql' },
  { want: false, name: 'a non-migration filename is ignored', file: 'README.md' },
]

function selfTest() {
  let bad = 0
  for (const f of FIXTURES) {
    let got
    try {
      got = findTopLevelSetLocal(f.sql).length > 0
    } catch (err) {
      console.error(`  FIXTURE THREW: "${f.name}" -- ${err.message}`)
      bad++
      continue
    }
    if (got !== f.flag) {
      bad++
      console.error(
        `  MISCLASSIFIED: "${f.name}" -- expected ${f.flag ? 'FLAG' : 'clean'}, got ${got ? 'FLAG' : 'clean'}`,
      )
    }
  }
  for (const f of SCOPE_FIXTURES) {
    const got = isInScope(f.file)
    if (got !== f.want) {
      bad++
      console.error(`  SCOPE MISCLASSIFIED: "${f.name}" -- expected ${f.want}, got ${got}`)
    }
  }
  const total = FIXTURES.length + SCOPE_FIXTURES.length
  console.log(`self-test: ${total - bad}/${total} OK${bad ? ' -- DETECTOR IS UNSOUND' : ''}`)
  return bad === 0
}

// ---------------------------------------------------------------------------

// `findTopLevelSetLocal` / `isInScope` are exported so a test can reuse them. Without
// this guard, merely IMPORTING the module runs the scan below and can `process.exit(1)`,
// killing the importing test run. Observed, not theorised.
const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (!isMain) {
  // imported as a library — export only
} else {
const argv = process.argv.slice(2)

if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)

if (!selfTest()) {
  console.error('Refusing to report: the detector failed its own fixtures.')
  process.exit(1)
}

const all = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
const inScope = all.filter(isInScope)

if (argv.includes('--list')) {
  console.log(inScope.join('\n') || '(none above the watermark)')
  process.exit(0)
}

const violations = []
for (const f of inScope) {
  for (const line of findTopLevelSetLocal(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))) {
    violations.push({ f, line })
  }
}

if (violations.length > 0) {
  console.error('\nTop-level `SET LOCAL` in a migration is not allowed.\n')
  for (const v of violations) console.error(`  supabase/migrations/${v.f}:${v.line}`)
  console.error(
    '\n`set local` outside a transaction is a SILENT no-op -- Postgres warns 25P01 and\n' +
      'continues, so it passes every local gate. Where it wraps a data-dependent backfill,\n' +
      'a fresh reset matches zero rows and hides it; a data-bearing target does not.\n\n' +
      'Fix: put the GUC and the statements it protects in ONE `do $$ ... $$` block.\n' +
      '  do $$ begin\n' +
      "    set local app.some_guc = 'on';\n" +
      '    update ...;\n' +
      '  end $$;\n\n' +
      'See FUP-DM5-SETLOCAL-MIGRATION in docs/followups/follow-ups-open.md.\n',
  )
  process.exit(1)
}

console.log(
  `set-local gate: OK (${inScope.length} migration${inScope.length === 1 ? '' : 's'} above watermark ${WATERMARK}; ${all.length - inScope.length} grandfathered)`,
)
}
