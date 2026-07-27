#!/usr/bin/env node
/**
 * Lint-gate guard: reject Tailwind's v3-only bare `[--var]` arbitrary value.
 *
 * Tailwind 3.4 let an arbitrary value that started with `--` mean "wrap this in
 * var()", so `max-h-[--radix-popper-available-height]` compiled to
 * `max-height: var(--radix-popper-available-height)`. **Tailwind v4 removed that
 * shorthand.** The same class now compiles to the literal
 * `max-height: --radix-popper-available-height`, which is invalid CSS. The
 * browser's parser drops the declaration, and the utility silently does nothing.
 *
 * Why this needs a gate rather than review: the failure is invisible to tsc,
 * eslint, unit tests, `next build` AND to a human reading the diff — the class
 * *reads* correct. It surfaces only as "the UI looks slightly off". In FF-2
 * (BUG-FF2-003) one such class left the block-type menu uncapped, pushing 7 of
 * 14 items — including the phase's own feature — off a 1280x720 viewport with no
 * way to scroll to them, by mouse or keyboard. A sweep then found nine more:
 * `duration-[--dur-*]` / `ease-[--ease-*]` motion tokens that had been running on
 * browser defaults instead of the design system's values, in shipped code, unnoticed.
 *
 * The valid v4 forms are `max-h-(--x)` (shorthand) and `max-h-[var(--x)]`
 * (explicit); both are accepted here.
 *
 * Scope includes e2e/ because Tailwind v4 scans it as source — a class literal
 * inside a *comment* there mints a real (dead) selector into the production bundle.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src', 'e2e']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'])
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage'])

// A utility ending in `-[--foo]`: an arbitrary value that is a bare custom
// property. `-[var(--foo)]` does not match, because `v` follows the bracket.
const BARE_CSS_VAR = /-\[--[A-Za-z0-9_-]+\]/g

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) out.push(full)
  }
}

const files = []
for (const root of ROOTS) {
  try {
    walk(root, files)
  } catch {
    // A root that does not exist is not an error — keep the guard portable.
  }
}

const findings = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const match of line.matchAll(BARE_CSS_VAR)) {
      findings.push({ file: relative(process.cwd(), file), line: i + 1, text: match[0] })
    }
  })
}

if (findings.length > 0) {
  console.error(
    `\nTailwind v4: ${findings.length} bare [--var] arbitrary value(s) found.\n` +
      `These compile to INVALID CSS and are silently dropped by the browser.\n`,
  )
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.text}`)
  }
  console.error(
    `\nFix: use the v4 CSS-variable syntax.\n` +
      `  max-h-[--radix-popper-available-height]        <- dropped, does nothing\n` +
      `  max-h-(--radix-popper-available-height)        <- correct (shorthand)\n` +
      `  max-h-[var(--radix-popper-available-height)]   <- correct (explicit)\n\n` +
      `In e2e/, this applies inside COMMENTS too: Tailwind scans that directory as\n` +
      `source, so a class literal in a comment mints a dead selector into the bundle.\n` +
      `Rationale: ADR 0089 / BUG-FF2-003.\n`,
  )
  process.exit(1)
}
