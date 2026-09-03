#!/usr/bin/env node
/**
 * features:index — generate docs/features/INDEX.md from hub frontmatter (ADR 0185 D1;
 * ADR 0186 D1/D2 — this is now the ONLY projection of hub frontmatter, PROGRESS.md carries
 * one link to it, not a copy). Same shape as build-adr-index.mjs: a generated artifact whose
 * source and output must agree, byte-compared by `--check` (run by `lint:registers`).
 *
 *   node scripts/build-features-index.mjs --write   # rewrite docs/features/INDEX.md
 *   node scripts/build-features-index.mjs --check   # exit 1 on drift
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { listHubs, ROOT, PATHS } from './check-docs-registers.mjs'

const STATUS_RANK = { in_progress: 0, gated: 1, planned: 2, parked: 3, complete: 4 }
const STATUS_LABEL = {
  in_progress: '🟢 in progress',
  gated: '🚧 gated',
  planned: '🔜 planned',
  parked: '⏸ parked',
  complete: '✅ complete',
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const branchCell = (fm) => (fm.branch ? `\`${fm.branch}\`` : '—')
const label = (fm) => STATUS_LABEL[fm.status] ?? fm.status
const count = (hubs, s) => hubs.filter((h) => h.fm?.status === s).length

export function sorted(hubs) {
  return [...hubs]
    .filter((h) => h.fm && h.fm.id)
    .sort((a, b) => (STATUS_RANK[a.fm.status] ?? 9) - (STATUS_RANK[b.fm.status] ?? 9) || String(a.fm.id).localeCompare(String(b.fm.id)))
}

export function renderIndex(hubs) {
  const rows = sorted(hubs).map(
    (h) => `| ${h.fm.id} | ${esc(h.fm.title)} | ${label(h.fm)} | ${h.fm.kind} | ${h.fm.program ?? '—'} | ${branchCell(h.fm)} | [${basename(h.file)}](${basename(h.file)}) |`,
  )
  return [
    '# Feature hubs — index',
    '',
    "> ⚙ **GENERATED FILE — do not edit by hand.** Every row is derived from a hub's YAML frontmatter",
    '> (`docs/features/<slug>.md`). Rebuild with `npm run features:index`; `npm run lint:registers`',
    '> (gate 13 of `npm run lint`) reds when this file is out of date. ADR 0185 D1; ADR 0186 D1 —',
    '> this file is the only projection of hub frontmatter; nothing else lists it separately.',
    '>',
    '> **This file IS the live list** — sorted `in_progress` → `gated` → `planned` → `parked` →',
    "> `complete`, so \"what is in flight\" reads off its first rows. A hub exists **before** a",
    '> branch is cut. Codes for historical work that never had a hub:',
    '> [legacy-codes.md](../followups/legacy-codes.md).',
    "> A hub's `## Current state` is its summary; its progress record's `## Session log`",
    '> (`docs/progress/<code>.md`) is its detail (ADR 0186 D3).',
    '',
    `**${rows.length} hubs** · in progress ${count(hubs, 'in_progress')} · gated ${count(hubs, 'gated')} · planned ${count(hubs, 'planned')} · parked ${count(hubs, 'parked')} · complete ${count(hubs, 'complete')}`,
    '',
    '| ID | Title | Status | Kind | Program | Branch | Hub |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

function main() {
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null
  if (!mode) {
    console.error('usage: build-features-index.mjs --write | --check')
    process.exit(2)
  }
  const hubs = listHubs()
  const bad = hubs.filter((h) => !h.fm)
  if (bad.length) {
    console.error(`build-features-index: ${bad.length} hub(s) without parseable frontmatter — lint:registers reports which`)
    process.exit(1)
  }
  const indexPath = join(ROOT, PATHS.featuresIndex)
  const wantIndex = renderIndex(hubs)
  if (mode === 'write') {
    writeFileSync(indexPath, wantIndex)
    console.log(`build-features-index: wrote ${PATHS.featuresIndex} (${hubs.length} hubs)`)
    return
  }
  const haveIndex = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null
  if (haveIndex !== wantIndex) {
    console.error(`build-features-index: STALE — ${PATHS.featuresIndex}; run \`npm run features:index\``)
    process.exit(1)
  }
  console.log(`build-features-index: OK (${hubs.length} hubs; index in sync)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
