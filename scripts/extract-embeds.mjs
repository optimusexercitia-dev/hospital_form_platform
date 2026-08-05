// Mechanically enumerate every PostgREST (relation, select-string) pair in src/.
// Boundary is derived from the code's own query chains via the TS AST -- not from
// a filename list, not from memory.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.argv[2]
const ts = (
  await import(pathToFileURL(path.join(ROOT, 'node_modules', 'typescript', 'lib', 'typescript.js')).href)
).default
const SRC = path.join(ROOT, 'src')

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walkFiles(SRC)
const results = []
const unresolved = []

// Pass 1: collect every const initializer NODE across ALL files (constants are
// imported across module boundaries -- e.g. MEETING_LIST_COLUMNS). Resolution is
// lazy + memoized so a const defined in terms of another const still resolves.
const sources = new Map()
const constNodes = new Map() // name -> initializer node
for (const file of files) {
  const sf = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  sources.set(file, sf)
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (!constNodes.has(node.name.text)) constNodes.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, collect)
  }
  collect(sf)
}

const memo = new Map()
function literalOf(node, seen = new Set()) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return literalOf(node.expression, seen)
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = literalOf(node.left, seen)
    const r = literalOf(node.right, seen)
    return l !== null && r !== null ? l + r : null
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) {
      const v = literalOf(span.expression, seen)
      if (v === null) return null
      out += v + span.literal.text
    }
    return out
  }
  if (ts.isIdentifier(node)) {
    const name = node.text
    if (seen.has(name)) return null
    if (memo.has(name)) return memo.get(name)
    const init = constNodes.get(name)
    if (!init) return null
    seen.add(name)
    const v = literalOf(init, seen)
    memo.set(name, v)
    return v
  }
  return null
}

for (const file of files) {
  const sf = sources.get(file)

  // Walk the receiver chain from a `.select(...)` call back to its `.from('x')`.
  function baseRelationOf(selectCall) {
    let cur = selectCall.expression // PropertyAccess(<receiver>, 'select')
    while (cur) {
      if (ts.isPropertyAccessExpression(cur)) {
        cur = cur.expression
        continue
      }
      if (ts.isCallExpression(cur)) {
        const callee = cur.expression
        if (ts.isPropertyAccessExpression(callee)) {
          const name = callee.name.text
          if (name === 'from' || name === 'rpc' || name === 'schema') {
            const arg = cur.arguments[0]
            if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
              return { kind: name, relation: arg.text }
            }
            return { kind: name, relation: null }
          }
          cur = callee.expression
          continue
        }
        cur = cur.expression
        continue
      }
      if (ts.isIdentifier(cur)) return { kind: 'identifier', relation: null, via: cur.text }
      if (ts.isAwaitExpression(cur) || ts.isNonNullExpression(cur) || ts.isParenthesizedExpression(cur)) {
        cur = cur.expression
        continue
      }
      return { kind: 'unknown', relation: null }
    }
    return { kind: 'unknown', relation: null }
  }

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'select'
    ) {
      const arg = node.arguments[0]
      const sel = arg ? literalOf(arg) : ''
      const base = baseRelationOf(node)
      // Use the `select` identifier token, NOT node.getStart(): a CallExpression
      // spans the whole chain, so getStart() lands on `supabase`, not `.select(`.
      const { line } = sf.getLineAndCharacterOfPosition(node.expression.name.getStart())
      const rec = {
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: line + 1,
        base: base.kind,
        relation: base.relation,
        select: sel,
        raw: arg ? arg.getText().slice(0, 120) : '(no arg)',
      }
      if (sel === null || base.relation === null) unresolved.push(rec)
      else results.push(rec)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

fs.writeFileSync(
  path.join(process.argv[3], 'embeds.json'),
  JSON.stringify({ results, unresolved }, null, 2),
)
console.log('resolved select sites :', results.length)
console.log('unresolved select sites:', unresolved.length)
console.log('of resolved, with an embed (contains "("):', results.filter((r) => r.select.includes('(')).length)
