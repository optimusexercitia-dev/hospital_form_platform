#!/usr/bin/env node
/**
 * AE0.4 (ADR 0155 / docs/plans/authz-evolution.md) — service-role write census.
 *
 * THE PROPERTY, NOT THE SYNTAX. A site is IN SCOPE when a write is issued through a
 * Supabase client that was constructed with the service-role key — i.e. traces back
 * to `createAdminClient()` in `src/lib/supabase/admin.ts` (the ONLY factory in this
 * repo that reads `SUPABASE_SERVICE_ROLE_KEY`; verified separately — see the doc).
 * "Write" means one of four families, because a `.from(` grep alone silently misses
 * three of them:
 *   A. `<client>.from('<table>').{insert,upsert,update,delete}(...)`
 *   B. `<client>.rpc('<name>', ...)`                                   (opaque — see below)
 *   C. `<client>.storage.from('<bucket>').{upload,update,remove,move,copy}(...)`
 *   C'. `<client>.storage.from('<bucket>').createSignedUploadUrl(...)` — mints upload
 *       capability rather than writing bytes; tracked as its own 'storage-sign' family
 *   D. `<client>.auth.admin.{createUser,updateUserById,deleteUser,inviteUserByEmail,generateLink}(...)`
 *
 * CLIENT IDENTIFICATION (the hard half). For each write call, the base of the member
 * chain is traced to its declaration:
 *   - a local `const x = createAdminClient()` (or `await createAdminClient()`)        -> SERVICE_ROLE
 *   - a local `const x = await createClient()` from '@/lib/supabase/server' or
 *     '@/lib/supabase/browser'                                                       -> USER_SESSION
 *   - an inline call at the write site itself (no intermediate variable)              -> classified directly
 *   - a function parameter typed `SupabaseClient<...>` (generic — the caller decides)
 *     -> ONE hop: every call site of the enclosing named function, anywhere in `src/`,
 *        is inspected; the argument at the matching position is classified the same way.
 *        If every caller passes a USER_SESSION-classified client, the site is OUT_OF_SCOPE
 *        (noted, not silently dropped). If any caller passes SERVICE_ROLE, the site is
 *        IN_SCOPE, attributed to that call path. Anything left ambiguous (anonymous
 *        function, zero discoverable callers, a second-hop parameter, a non-identifier
 *        argument) is UNRESOLVED.
 *   - anything else (a `this.` member, a destructure this script does not model, no
 *     declaration found) -> UNRESOLVED, with the node shape recorded.
 *
 * THREE BUCKETS, NEVER TWO. IN_SCOPE / OUT_OF_SCOPE / UNRESOLVED. An UNRESOLVED site is
 * NOT "probably fine" — it is a site this script could not decide, and the doc must carry
 * it forward for a human (or a live-catalog read) to close. Test files (`*.test.ts(x)`,
 * `*.spec.ts(x)`) are walked but reported in a fourth, separate bucket (EXCLUDED_TEST) since
 * they exercise mocked clients, not a production write path — excluded from IN_SCOPE, never
 * silently dropped.
 *
 * RPC ACTOR-VALIDATION HEURISTIC. This script can only see the JS call site, never the SQL
 * body (migration text is stale by design — CLAUDE.md's binding rule). So for every
 * SERVICE_ROLE `.rpc()` site it records two independent, checkable-from-JS signals and
 * leaves the SQL-side verdict to a human with catalog access:
 *   - `nameSuggestsFor`: does the RPC name end in `_for` (this repo's convention for a
 *     service-role sibling that takes an explicit actor — see check-memberships-door.mjs)?
 *   - `actorArgPresent`: does the options object passed to `.rpc()` have a key that looks
 *     like an actor parameter (`p_actor`, `actor_id`, `p_caller`, `caller_id`, `acting_...`)?
 *   Both flags are call-site evidence only. `actorValidating` is reported as
 *   'UNRESOLVED (SQL body not read — see doc)' regardless of the flags, per the task's
 *   explicit instruction not to trust migration file text.
 *
 * SELF-TEST (`--self-test`): proves the detector can (a) find a known site and (b) miss a
 * site once that site is neutralized, then that it returns to baseline once restored. See
 * the bottom of this file. Exits non-zero on any mismatch.
 *
 * Usage:
 *   node scripts/service-role-dml-census.mjs            # full census, human-readable
 *   node scripts/service-role-dml-census.mjs --json      # machine-readable
 *   node scripts/service-role-dml-census.mjs --self-test # detector-can-fail proof
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = process.cwd()
const SCAN_DIR = join(ROOT, 'src')
const EXTENSIONS = ['.ts', '.tsx']

const WRITE_VERBS = new Set(['insert', 'upsert', 'update', 'delete'])
const STORAGE_WRITE_VERBS = new Set(['upload', 'update', 'remove', 'move', 'copy'])
// `createSignedUploadUrl` writes no bytes itself but MINTS the capability for a client
// to perform a future PUT — an authorization-relevant act done BY the service-role
// client, so it is tracked as its own family rather than folded into "write" (which
// would conflate two different guarantees) or silently dropped as a "read".
const STORAGE_SIGN_UPLOAD_VERBS = new Set(['createSignedUploadUrl'])
const STORAGE_READ_VERBS = new Set(['list', 'download', 'getPublicUrl', 'createSignedUrl'])
const AUTH_ADMIN_WRITE_METHODS = new Set([
  'createUser',
  'updateUserById',
  'deleteUser',
  'inviteUserByEmail',
  'generateLink',
])
const AUTH_ADMIN_READ_METHODS = new Set(['listUsers', 'getUserById'])

const ADMIN_FACTORY_MODULE = '@/lib/supabase/admin'
const ADMIN_FACTORY_NAME = 'createAdminClient'
const USER_SESSION_MODULES = new Set(['@/lib/supabase/server', '@/lib/supabase/browser'])
const USER_SESSION_FACTORY_NAME = 'createClient'

const ACTOR_ARG_RE = /^(p_)?(actor|caller|acting)[_a-z]*$|actor_id$|caller_id$/i

function isTestFile(relPath) {
  return /\.(test|spec)\.tsx?$/.test(relPath)
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walk(full, out)
    } else if (EXTENSIONS.some((e) => entry.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

/** Parse one file, returning {sourceFile, text, rel}. Parent pointers are set. */
function parseFile(absPath) {
  const text = readFileSync(absPath, 'utf8')
  const rel = relative(ROOT, absPath).split(sep).join('/')
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  return { sourceFile, text, rel }
}

/** Every ImportDeclaration's named specifiers as {localName -> {importedName, moduleSpecifier}}. */
function buildImportTable(sourceFile) {
  const table = new Map()
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    const moduleSpecifier = stmt.moduleSpecifier.text
    const clause = stmt.importClause
    if (!clause || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue
    for (const el of clause.namedBindings.elements) {
      const localName = el.name.text
      const importedName = el.propertyName ? el.propertyName.text : el.name.text
      table.set(localName, { importedName, moduleSpecifier })
    }
  }
  return table
}

function unwrapExpr(node) {
  let cur = node
  for (;;) {
    if (ts.isParenthesizedExpression(cur)) {
      cur = cur.expression
    } else if (ts.isAsExpression(cur) || ts.isNonNullExpression(cur)) {
      cur = cur.expression
    } else if (ts.isAwaitExpression(cur)) {
      cur = cur.expression
    } else {
      return cur
    }
  }
}

function functionLikeAncestor(node) {
  let cur = node.parent
  while (cur) {
    if (
      ts.isFunctionDeclaration(cur) ||
      ts.isFunctionExpression(cur) ||
      ts.isArrowFunction(cur) ||
      ts.isMethodDeclaration(cur)
    ) {
      return cur
    }
    cur = cur.parent
  }
  return undefined
}

function getFunctionName(fnNode) {
  if (!fnNode) return undefined
  if ((ts.isFunctionDeclaration(fnNode) || ts.isFunctionExpression(fnNode)) && fnNode.name) {
    return fnNode.name.text
  }
  if (fnNode.parent && ts.isVariableDeclaration(fnNode.parent) && ts.isIdentifier(fnNode.parent.name)) {
    return fnNode.parent.name.text
  }
  if (ts.isMethodDeclaration(fnNode) && fnNode.name && ts.isIdentifier(fnNode.name)) {
    return fnNode.name.text
  }
  return undefined
}

/** Nearest *named* enclosing symbol, for reporting (module scope if none). */
function enclosingSymbolName(node) {
  const fn = functionLikeAncestor(node)
  const name = getFunctionName(fn)
  if (name) return name
  if (fn) return '<anonymous function>'
  return '<module scope>'
}

/**
 * Find the declaration of an identifier by walking outward through enclosing
 * function scopes (nearest wins), stopping at the first scope that declares it as
 * either a parameter or a `const`/`let`/`var` with that name. Deliberately does not
 * attempt full lexical/hoisting fidelity — this project's style is flat (one
 * `const admin = createAdminClient()` per function), and anything it can't resolve
 * this way is reported UNRESOLVED rather than guessed at.
 */
function findDeclarationForIdentifier(idNode) {
  const name = idNode.text
  let scope = functionLikeAncestor(idNode) // undefined => search whole file (module scope)
  const scopeBoundary = (n) => {
    if (!scope) return true // whole source file is the boundary when scope is undefined
    // stop descending into a *nested* function-like node other than `scope` itself
    return (
      n === scope ||
      !(
        ts.isFunctionDeclaration(n) ||
        ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) ||
        ts.isMethodDeclaration(n)
      )
    )
  }

  for (;;) {
    const root = scope ?? idNode.getSourceFile()
    let found

    // Parameters of this scope, if it is a function-like node.
    if (scope && scope.parameters) {
      for (const p of scope.parameters) {
        if (ts.isIdentifier(p.name) && p.name.text === name) {
          found = { kind: 'param', node: p, fnNode: scope }
          break
        }
      }
    }

    if (!found) {
      const visit = (n) => {
        if (found) return
        if (n !== root && !scopeBoundary(n)) return // don't descend into a nested function
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
          found = { kind: 'var', node: n }
          return
        }
        ts.forEachChild(n, visit)
      }
      visit(root)
    }

    if (found) return found

    if (!scope) return { kind: 'no-declaration' } // already searched the whole file
    const outer = functionLikeAncestor(scope)
    scope = outer
  }
}

/**
 * Whether a parameter's type annotation denotes a Supabase client, resolving one level
 * of local `type X = ...` alias and recognizing the `Awaited<ReturnType<typeof
 * create(Admin)?Client>>` shape (used where the client is threaded through without
 * importing `SupabaseClient` by name). Not a type-checker — a textual heuristic bounded
 * to what a single file states about itself.
 */
function looksLikeSupabaseClientType(typeText, sourceFile) {
  if (/SupabaseClient/.test(typeText)) return true
  if (/ReturnType<\s*typeof\s+create(Admin)?Client\s*>/.test(typeText)) return true
  const bareIdentifier = typeText.trim()
  if (/^[A-Za-z_$][\w$]*$/.test(bareIdentifier)) {
    for (const stmt of sourceFile.statements) {
      if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === bareIdentifier) {
        return looksLikeSupabaseClientType(stmt.type.getText(), sourceFile)
      }
    }
  }
  return false
}

/** Classify an already-resolved initializer/argument expression directly (no identifier hop). */
function classifyExpressionDirect(expr, importTable) {
  const e = unwrapExpr(expr)
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    const callee = e.expression.text
    const imp = importTable.get(callee)
    if (imp && imp.importedName === ADMIN_FACTORY_NAME && imp.moduleSpecifier === ADMIN_FACTORY_MODULE) {
      return { classification: 'SERVICE_ROLE', detail: `inline ${callee}()` }
    }
    if (
      imp &&
      imp.importedName === USER_SESSION_FACTORY_NAME &&
      USER_SESSION_MODULES.has(imp.moduleSpecifier)
    ) {
      return { classification: 'USER_SESSION', detail: `inline ${callee}() from ${imp.moduleSpecifier}` }
    }
    return { classification: 'UNRESOLVED', detail: `inline call to unresolved factory '${callee}(...)'` }
  }
  if (ts.isIdentifier(e)) {
    return classifyIdentifier(e, importTable)
  }
  return {
    classification: 'UNRESOLVED',
    detail: `non-identifier, non-call expression (kind=${ts.SyntaxKind[e.kind]}): ${e.getText().slice(0, 80)}`,
  }
}

function classifyIdentifier(idNode, importTable) {
  const decl = findDeclarationForIdentifier(idNode)
  if (decl.kind === 'no-declaration') {
    return {
      classification: 'UNRESOLVED',
      detail: `no local declaration found for '${idNode.text}' (module-level import or global?)`,
    }
  }
  if (decl.kind === 'param') {
    const typeNode = decl.node.type
    const typeText = typeNode ? typeNode.getText() : '<untyped>'
    if (looksLikeSupabaseClientType(typeText, idNode.getSourceFile())) {
      const fnName = getFunctionName(decl.fnNode)
      const paramIndex = decl.fnNode.parameters.indexOf(decl.node)
      if (!fnName) {
        return {
          classification: 'UNRESOLVED',
          detail: `parameter '${idNode.text}: ${typeText}' of an anonymous function — cannot trace callers`,
        }
      }
      return {
        classification: 'PARAM_GENERIC',
        detail: `parameter '${idNode.text}: ${typeText}' of function '${fnName}' (param #${paramIndex})`,
        fnName,
        paramIndex,
      }
    }
    return {
      classification: 'UNRESOLVED',
      detail: `parameter '${idNode.text}' has non-SupabaseClient type '${typeText}'`,
    }
  }
  // decl.kind === 'var'
  const varDecl = decl.node
  if (!varDecl.initializer) {
    return { classification: 'UNRESOLVED', detail: `'${idNode.text}' declared without initializer` }
  }
  return classifyExpressionDirect(varDecl.initializer, importTable)
}

/** Root of a member-access chain: `admin` in `admin.from('x').update(...)`. */
function classifyRoot(rootExpr, importTable) {
  const e = unwrapExpr(rootExpr)
  if (ts.isIdentifier(e)) return classifyIdentifier(e, importTable)
  if (ts.isCallExpression(e)) return classifyExpressionDirect(e, importTable)
  return {
    classification: 'UNRESOLVED',
    detail: `unmodeled root shape (kind=${ts.SyntaxKind[e.kind]}): ${e.getText().slice(0, 80)}`,
  }
}

function literalOrDynamic(argNode) {
  if (!argNode) return '<none>'
  if (ts.isStringLiteralLike(argNode)) return argNode.text
  return `<dynamic:${argNode.getText().slice(0, 60)}>`
}

/** Collect every write-shaped call candidate in one source file (Families A-D). */
function collectCandidates(sourceFile) {
  const candidates = []

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const verb = node.expression.name.text
      const object = node.expression.expression

      // Family A: <root>.from('table').VERB(...)
      if (WRITE_VERBS.has(verb) && ts.isCallExpression(object) && ts.isPropertyAccessExpression(object.expression)) {
        const fromCallee = object.expression
        if (fromCallee.name.text === 'from') {
          candidates.push({
            family: 'from-verb',
            verb,
            target: literalOrDynamic(object.arguments[0]),
            rootExpr: fromCallee.expression,
            node,
          })
        }
      }

      // Family B: <root>.rpc('name', opts)
      if (verb === 'rpc') {
        candidates.push({
          family: 'rpc',
          verb: 'rpc',
          target: literalOrDynamic(node.arguments[0]),
          rootExpr: object,
          node,
          rpcArgs: node.arguments[1],
        })
      }

      // Family C: <root>.storage.from('bucket').VERB(...)
      if (
        (STORAGE_WRITE_VERBS.has(verb) ||
          STORAGE_SIGN_UPLOAD_VERBS.has(verb) ||
          STORAGE_READ_VERBS.has(verb)) &&
        ts.isCallExpression(object) &&
        ts.isPropertyAccessExpression(object.expression) &&
        object.expression.name.text === 'from' &&
        ts.isPropertyAccessExpression(object.expression.expression) &&
        object.expression.expression.name.text === 'storage'
      ) {
        if (STORAGE_WRITE_VERBS.has(verb)) {
          candidates.push({
            family: 'storage',
            verb: `storage-${verb}`,
            target: literalOrDynamic(object.arguments[0]),
            rootExpr: object.expression.expression.expression,
            node,
          })
        } else if (STORAGE_SIGN_UPLOAD_VERBS.has(verb)) {
          candidates.push({
            family: 'storage-sign',
            verb: `storage-sign-upload`,
            target: literalOrDynamic(object.arguments[0]),
            rootExpr: object.expression.expression.expression,
            node,
          })
        }
        // storage reads deliberately not collected as candidates (out of the DML property)
      }

      // Family D: <root>.auth.admin.METHOD(...)
      if (
        (AUTH_ADMIN_WRITE_METHODS.has(verb) || AUTH_ADMIN_READ_METHODS.has(verb)) &&
        ts.isPropertyAccessExpression(object) &&
        object.name.text === 'admin' &&
        ts.isPropertyAccessExpression(object.expression) &&
        object.expression.name.text === 'auth'
      ) {
        if (AUTH_ADMIN_WRITE_METHODS.has(verb)) {
          candidates.push({
            family: 'auth-admin',
            verb: `auth-admin-${verb}`,
            target: verb,
            rootExpr: object.expression.expression,
            node,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return candidates
}

const RPC_READ_PREFIX_RE = /^(get_|list_|lookup_|is_|has_|fetch_|check_|find_)/i
const RPC_WRITE_PREFIX_RE =
  /^(create_|update_|delete_|insert_|upsert_|set_|grant_|revoke_|assign_|remove_|affiliate_|end_|void_|complete_|fail_|cancel_|close_|reopen_|disable_|enable_|log_|reclassify_|clone_)/i

/**
 * Name-prefix heuristic ONLY — not a substitute for reading the function body. Purely
 * to sub-classify the RPC bucket for the recorded doc; never changes IN/OUT/UNRESOLVED
 * bucketing, which is decided by client identification alone.
 */
function rpcLikelyKind(rpcName) {
  if (rpcName.startsWith('<dynamic')) return 'unknown (dynamic name)'
  if (RPC_READ_PREFIX_RE.test(rpcName)) return 'read-like'
  if (RPC_WRITE_PREFIX_RE.test(rpcName)) return 'write-like'
  return 'ambiguous'
}

function classifyRpcActor(cand) {
  const nameSuggestsFor = /_for$/.test(cand.target) // literal name only; dynamic names can't be checked
  let actorArgPresent = false
  if (cand.rpcArgs && ts.isObjectLiteralExpression(cand.rpcArgs)) {
    for (const prop of cand.rpcArgs.properties) {
      const key =
        (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
        ts.isIdentifier(prop.name)
          ? prop.name.text
          : undefined
      if (key && ACTOR_ARG_RE.test(key)) {
        actorArgPresent = true
        break
      }
    }
  }
  return { nameSuggestsFor, actorArgPresent }
}

// ---------------------------------------------------------------------------
// Pass 1: parse every file once; collect per-file import tables + write candidates.
// ---------------------------------------------------------------------------

function scanAll(files) {
  const parsed = files.map(parseFile)
  const perFile = parsed.map(({ sourceFile, rel }) => {
    const importTable = buildImportTable(sourceFile)
    const candidates = collectCandidates(sourceFile)
    return { rel, sourceFile, importTable, candidates }
  })
  return perFile
}

/**
 * Tier-2 resolution: for a PARAM_GENERIC root, find every call site of `fnName`
 * across the whole scanned corpus (best-effort identifier-name match — this script
 * does not type-check or resolve module identity across files, which is a stated
 * limitation, not a silent one) and classify the argument at `paramIndex`.
 */
function resolveParamGeneric(fnName, paramIndex, perFile) {
  const callSites = []
  for (const { rel, sourceFile, importTable } of perFile) {
    // Test files call the real function against a MOCKED client — that is not a
    // production invocation, so it must not count as caller evidence either way (it
    // would otherwise manufacture false ambiguity: nine mock call sites can outvote
    // the one real, non-test caller). Excluded here for the same reason production
    // sites are separated into EXCLUDED_TEST rather than folded into a bucket.
    if (isTestFile(rel)) continue
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fnName) {
        const arg = node.arguments[paramIndex]
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
        if (!arg) {
          callSites.push({ rel, line, classification: 'UNRESOLVED', detail: 'call site has no argument at that position' })
        } else if (ts.isIdentifier(arg)) {
          callSites.push({ rel, line, ...classifyIdentifier(arg, importTable) })
        } else {
          callSites.push({ rel, line, ...classifyExpressionDirect(arg, importTable) })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return callSites
}

function runCensus(perFile) {
  const rows = []
  for (const { rel, sourceFile, importTable, candidates } of perFile) {
    const excluded = isTestFile(rel)
    for (const cand of candidates) {
      const line = sourceFile.getLineAndCharacterOfPosition(cand.node.getStart()).line + 1
      const symbol = enclosingSymbolName(cand.node)
      const rootClass = classifyRoot(cand.rootExpr, importTable)

      let bucket
      let resolutionNote = rootClass.detail

      if (excluded) {
        bucket = 'EXCLUDED_TEST'
      } else if (rootClass.classification === 'SERVICE_ROLE') {
        bucket = 'IN_SCOPE'
      } else if (rootClass.classification === 'USER_SESSION') {
        bucket = 'OUT_OF_SCOPE'
      } else if (rootClass.classification === 'PARAM_GENERIC') {
        const callSites = resolveParamGeneric(rootClass.fnName, rootClass.paramIndex, perFile)
        if (callSites.length === 0) {
          bucket = 'UNRESOLVED'
          resolutionNote = `${rootClass.detail}; zero call sites of '${rootClass.fnName}' found in src/ — may be invoked from e2e/ or dynamically`
        } else {
          const anyServiceRole = callSites.some((c) => c.classification === 'SERVICE_ROLE')
          const allUserSession = callSites.every((c) => c.classification === 'USER_SESSION')
          if (anyServiceRole) {
            bucket = 'IN_SCOPE'
            const via = callSites.find((c) => c.classification === 'SERVICE_ROLE')
            resolutionNote = `${rootClass.detail}; traced via caller ${via.rel}:${via.line} passing a SERVICE_ROLE client`
          } else if (allUserSession) {
            bucket = 'OUT_OF_SCOPE'
            resolutionNote = `${rootClass.detail}; all ${callSites.length} discoverable caller(s) pass a USER_SESSION client`
          } else {
            bucket = 'UNRESOLVED'
            const detailList = callSites.map((c) => `${c.rel}:${c.line}=${c.classification}`).join('; ')
            resolutionNote = `${rootClass.detail}; caller resolution ambiguous: ${detailList}`
          }
        }
      } else {
        bucket = 'UNRESOLVED'
      }

      let actorValidating
      let rpcHeuristics
      let rpcKind
      if (cand.family === 'rpc') {
        rpcHeuristics = classifyRpcActor(cand)
        actorValidating = 'UNRESOLVED (SQL body not read — see doc)'
        rpcKind = rpcLikelyKind(cand.target)
      }

      rows.push({
        rel,
        line, // volatile — reported for orientation only, not identity
        symbol,
        family: cand.family,
        writeKind: cand.verb,
        target: cand.target,
        bucket,
        rootClassification: rootClass.classification,
        resolutionNote,
        actorValidating,
        rpcHeuristics,
        rpcKind,
      })
    }
  }
  // Stable sort: file, then symbol, then write kind, then target — NOT line number,
  // so the census is diffable across a refactor that only moves lines around.
  rows.sort((a, b) => {
    return (
      a.rel.localeCompare(b.rel) ||
      a.symbol.localeCompare(b.symbol) ||
      a.writeKind.localeCompare(b.writeKind) ||
      a.target.localeCompare(b.target) ||
      a.line - b.line
    )
  })
  return rows
}

function printReport(rows) {
  const buckets = { IN_SCOPE: [], OUT_OF_SCOPE: [], UNRESOLVED: [], EXCLUDED_TEST: [] }
  for (const r of rows) buckets[r.bucket].push(r)

  console.log(`service-role DML census — ${rows.length} write-shaped call sites found\n`)
  console.log(
    `  IN_SCOPE=${buckets.IN_SCOPE.length}  OUT_OF_SCOPE=${buckets.OUT_OF_SCOPE.length}  ` +
      `UNRESOLVED=${buckets.UNRESOLVED.length}  EXCLUDED_TEST=${buckets.EXCLUDED_TEST.length}\n`,
  )

  for (const bucketName of ['IN_SCOPE', 'UNRESOLVED', 'OUT_OF_SCOPE', 'EXCLUDED_TEST']) {
    const list = buckets[bucketName]
    console.log(`--- ${bucketName} (${list.length}) ---`)
    for (const r of list) {
      const actorPart =
        r.family === 'rpc'
          ? ` [rpcKind=${r.rpcKind}; actorValidating=${r.actorValidating}; nameSuggestsFor=${r.rpcHeuristics.nameSuggestsFor}; actorArgPresent=${r.rpcHeuristics.actorArgPresent}]`
          : ''
      console.log(`  ${r.rel} :: ${r.symbol} :: ${r.writeKind}('${r.target}')${actorPart}  (L${r.line}, volatile)`)
      // Direct SERVICE_ROLE/USER_SESSION sites carry a self-evident note ('inline
      // createAdminClient()' etc.) — print it for every indirect (PARAM_GENERIC-traced)
      // site always, and for direct sites outside IN_SCOPE (so a reviewer never has to
      // guess why something landed OUT_OF_SCOPE or UNRESOLVED).
      if (bucketName !== 'IN_SCOPE' || r.rootClassification === 'PARAM_GENERIC') {
        console.log(`      -> ${r.resolutionNote}`)
      }
    }
    console.log('')
  }
}

// ---------------------------------------------------------------------------
// Self-test: prove the detector can find a known site, and can miss one.
// ---------------------------------------------------------------------------

function selfTest() {
  const KNOWN_FILE = join(SCAN_DIR, 'lib', 'users', 'actions.ts')
  const KNOWN_TABLE = 'profiles'

  function census() {
    const files = walk(SCAN_DIR)
    const perFile = scanAll(files)
    return runCensus(perFile)
  }

  console.log('[self-test] (a) baseline: detector must find the known profiles writes...')
  const baseline = census()
  const knownHits = baseline.filter(
    (r) => r.rel === 'src/lib/users/actions.ts' && r.bucket === 'IN_SCOPE' && r.target === KNOWN_TABLE,
  )
  if (knownHits.length === 0) {
    console.error('[self-test] FAIL: found ZERO IN_SCOPE profiles writes in src/lib/users/actions.ts')
    process.exit(1)
  }
  console.log(`[self-test]   OK: found ${knownHits.length} IN_SCOPE profiles write site(s)`)
  const baselineInScopeCount = baseline.filter((r) => r.bucket === 'IN_SCOPE').length

  console.log('[self-test] (b) neutralizing one known site (rename admin -> admin_neutered)...')
  const original = readFileSync(KNOWN_FILE, 'utf8')
  const marker = "const admin = createAdminClient()"
  const idx = original.indexOf(marker)
  if (idx === -1) {
    console.error('[self-test] FAIL: could not find the marker to neutralize — file shape changed?')
    process.exit(1)
  }
  // Rename only the FIRST binding + its uses up to the next function boundary is
  // hard to do surgically without a parser; instead, neutralize the import itself
  // temporarily is too broad (kills every function in the file). Rename just the
  // first `const admin = createAdminClient()` occurrence's variable name AND every
  // subsequent bare `admin.` in this file to `admin_neutered.` — this is restored
  // byte-for-byte afterwards and only ever touches the in-memory/on-disk copy for
  // the duration of this self-test.
  const neutered = original
    .split('\n')
    .map((line) => line.replace(/\badmin\b/g, 'admin_neutered'))
    .join('\n')

  try {
    writeFileSyncUtf8(KNOWN_FILE, neutered)
    const withNeutered = census()
    const neuteredHits = withNeutered.filter(
      (r) => r.rel === 'src/lib/users/actions.ts' && r.bucket === 'IN_SCOPE' && r.target === KNOWN_TABLE,
    )
    if (neuteredHits.length !== 0) {
      console.error(
        `[self-test] FAIL: still found ${neuteredHits.length} IN_SCOPE profiles site(s) after neutralizing — detector cannot be shown to move`,
      )
      process.exit(1)
    }
    console.log('[self-test]   OK: neutralized file shows ZERO IN_SCOPE profiles write sites in this file')
  } finally {
    writeFileSyncUtf8(KNOWN_FILE, original)
  }

  console.log('[self-test] (c) restoring and confirming return to baseline...')
  const restored = census()
  const restoredInScopeCount = restored.filter((r) => r.bucket === 'IN_SCOPE').length
  if (restoredInScopeCount !== baselineInScopeCount) {
    console.error(
      `[self-test] FAIL: restored count (${restoredInScopeCount}) != baseline (${baselineInScopeCount})`,
    )
    process.exit(1)
  }
  console.log(`[self-test]   OK: restored IN_SCOPE count matches baseline (${restoredInScopeCount})`)
  console.log('\n[self-test] PASS: detector demonstrably finds a known site and can be made to miss one.')
}

// Minimal UTF-8, no-BOM write used only by the self-test to round-trip the ONE file it
// perturbs. Avoids any shell redirection (Windows cp1252 round-trip corruption).
import { writeFileSync } from 'node:fs'
function writeFileSyncUtf8(path, content) {
  writeFileSync(path, content, { encoding: 'utf8' })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.includes('--self-test')) {
  selfTest()
} else {
  const files = walk(SCAN_DIR)
  const perFile = scanAll(files)
  const rows = runCensus(perFile)
  if (args.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2))
  } else {
    printReport(rows)
  }
}
