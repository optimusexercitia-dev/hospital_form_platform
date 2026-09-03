#!/usr/bin/env node
// One-off migration (ADR 0186 D4, plan 5.2): split docs/followups/follow-ups-open.md
// from "index + body together" into "index entry + optional body file".
//
// Idempotent: running it twice makes no further changes the second time.
//
// Usage: node scripts/migrate-fup-bodies.mjs [--check]
//   --check   report what would change, write nothing (exit 1 if changes are pending)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OPEN_PATH = path.join(ROOT, 'docs/followups/follow-ups-open.md');
const FOLLOWUPS_DIR = path.join(ROOT, 'docs/followups');

const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Structural classification of the `##` headings in the file (verified by
// hand against the live text 2026-09-03; matched by exact text so a
// re-run stays correct even if line numbers shift).
// ---------------------------------------------------------------------------

// `##` headings that are part of an entry's BODY (they belong to the entry
// immediately above them) — left untouched, they simply ride along inside
// whatever entry chunk contains them.
const _INSIDE_BODY_H2 = new Set([
  '## ⛔ STILL OPEN — two limits `frontend` stated about its own sweep',
  '## ✅ PO-RULED 2026-08-20 — INVERT the `useFieldIds` default (assigned to `frontend`; a SEPARATE change after Slice 3)',
  '## § MEASUREMENT 2026-08-29 — the property, derived; and two corrections to THIS ITEM',
  '## Why this is a gap and not a curiosity',
  '## Shape of a fix — ⛔ FILED, NOT BUILT',
  '## The fix',
  '## ⭐ The methodology note, which is the transferable part',
]);

// `##` headings that are grouping headers between entries (batch context,
// not any one entry's body). Kept as standalone structural blocks, verbatim,
// re-emitted immediately before the entry that follows them.
const GROUPING_H2 = new Set([
  '## Bodies moved here 2026-08-14 (the PROGRESS.md size rotation) — items whose ONLY record was the live line',
]);

// The three "index the archive, no body" stubs — deleted outright (5.2).
const _STUB_HEADING_RE =
  /^### ⬛ Resolved — rotated [^\n]*\[follow-ups-archive\.md\]\([^\n]*\)\s*$/;

// Entry boundary: an H3 heading naming a FUP id.
const ENTRY_HEADING_RE = /^### .*\bFUP-[A-Z0-9][A-Z0-9-]*/;
const FUP_ID_RE = /FUP-[A-Z0-9][A-Z0-9-]*/;

const CANONICAL_OWNER_ORDER = ['lead', 'backend', 'frontend', 'tester', 'qa', 'PO'];

function normalizeOwner(raw) {
  if (!raw) return { normalized: 'unassigned', found: [] };
  const text = raw.toLowerCase();
  const found = new Set();
  if (/\blead\b/.test(text)) found.add('lead');
  if (/\bbackend\b/.test(text)) found.add('backend');
  if (/\bfrontend\b/.test(text)) found.add('frontend');
  if (/\btester\b/.test(text)) found.add('tester');
  if (/\bqa\b/.test(text)) found.add('qa');
  if (/\bpo\b/.test(text)) found.add('PO');
  if (found.size === 0) {
    return { normalized: 'unassigned', found: [] };
  }
  const ordered = CANONICAL_OWNER_ORDER.filter((r) => found.has(r));
  return { normalized: ordered.join(' + '), found: ordered };
}

function isBlank(line) {
  return line.trim() === '';
}

function skipBlanks(lines, i) {
  while (i < lines.length && isBlank(lines[i])) i++;
  return i;
}

// Strip leading "**Register line**" / "**Parked**" marker lines from a
// body-lines array. Both markers are, verified against the live text, always
// a single physical line (123/123 Register-line markers are followed by a
// blank line; the "**Parked**" boilerplate sentence is one line even in the
// 23/27 cases where the NEXT line is body content with no blank in between —
// so this must consume exactly one line, never "until the next blank line",
// or it swallows the first line of the real body).
// Returns { remaining, registerLineRemoved, parkedMarkerRemoved }.
function stripLeadingMarkerParagraphs(lines) {
  let i = 0;
  let registerLineRemoved = 0;
  let parkedMarkerRemoved = 0;
  for (;;) {
    i = skipBlanks(lines, i);
    if (i >= lines.length) break;
    if (/^\*\*Register line\*\*/.test(lines[i])) {
      i++;
      registerLineRemoved++;
      continue;
    }
    if (/^\*\*Parked\*\*/.test(lines[i])) {
      i++;
      parkedMarkerRemoved++;
      continue;
    }
    break;
  }
  return { remaining: lines.slice(i), registerLineRemoved, parkedMarkerRemoved };
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && isBlank(lines[start])) start++;
  while (end > start && isBlank(lines[end - 1])) end--;
  return lines.slice(start, end);
}

// ---------------------------------------------------------------------------

function main() {
  const raw = fs.readFileSync(OPEN_PATH, 'utf8');
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  // Locate the preface: everything through the end of the "Standing notes"
  // H2 section, i.e. up to (not including) the first real entry heading.
  // The how-to section's own template line sits inside the preface and must
  // NOT be mistaken for an entry — excluded by exact text, not by a line
  // number (the preface's length changes as it is hand-edited).
  const TEMPLATE_LINE =
    '### <severity> FUP-<SCREAMING-KEBAB-ID> — <the claim, in one line>';
  let firstEntryIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (ENTRY_HEADING_RE.test(lines[i]) && lines[i] !== TEMPLATE_LINE) {
      firstEntryIdx = i;
      break;
    }
  }
  if (firstEntryIdx === -1) {
    console.error('Could not locate the first entry heading. Aborting.');
    process.exit(2);
  }

  // Trim trailing blank lines from the preface: the join below adds its own
  // single blank-line separator, and the source already ends the preface
  // with one blank line before the first entry heading.
  let prefaceEnd = firstEntryIdx;
  while (prefaceEnd > 0 && isBlank(lines[prefaceEnd - 1])) prefaceEnd--;
  const prefaceLines = lines.slice(0, prefaceEnd);
  let bodyRegionText = lines.slice(firstEntryIdx).join('\n');

  // Delete the three "Resolved — rotated" stubs outright (heading + content
  // up to the next H2/H3 heading).
  let stubsDeleted = 0;
  bodyRegionText = bodyRegionText.replace(
    /^### ⬛ Resolved — rotated[^\n]*\[follow-ups-archive\.md\]\([^\n]*\)\s*\n(?:(?!^#{2,3} ).*\n?)*/gm,
    () => {
      stubsDeleted++;
      return '';
    }
  );

  const bodyLines = bodyRegionText.split('\n');

  // Find entry boundaries.
  const boundaries = [];
  for (let i = 0; i < bodyLines.length; i++) {
    if (ENTRY_HEADING_RE.test(bodyLines[i])) boundaries.push(i);
  }
  if (boundaries.length === 0) {
    console.error('No entries found after stub removal. Aborting.');
    process.exit(2);
  }

  // Chunks: raw line ranges [start, end) per entry, in file order.
  const chunks = [];
  for (let k = 0; k < boundaries.length; k++) {
    const start = boundaries[k];
    const end = k + 1 < boundaries.length ? boundaries[k + 1] : bodyLines.length;
    chunks.push(bodyLines.slice(start, end));
  }

  const ownerMap = new Map(); // raw -> { normalized, count }
  const parkedCount = { yes: 0, no: 0 };
  const inlineVsFile = { inline: 0, file: 0, alreadyFile: 0 };
  let registerLineTotal = 0;
  let parkedMarkerTotal = 0;
  const filesWritten = [];
  const problems = [];
  const outputBlocks = []; // strings, one per emitted unit (entry or floating block)
  const seenIds = new Set();

  for (const chunk of chunks) {
    // Peel off a trailing floating (grouping) H2 block, if this chunk's tail
    // contains one — it belongs to the NEXT entry's neighbourhood, not this
    // entry's body.
    let mainChunk = chunk;
    let floatingBlock = null;
    for (let i = 0; i < chunk.length; i++) {
      if (GROUPING_H2.has(chunk[i])) {
        mainChunk = chunk.slice(0, i);
        floatingBlock = chunk.slice(i);
        break;
      }
    }

    const heading = mainChunk[0];
    const idMatch = heading.match(FUP_ID_RE);
    const id = idMatch ? idMatch[0] : null;
    if (!id) {
      problems.push(`No FUP id parsed from heading: ${heading}`);
      outputBlocks.push(trimBlankEdges(mainChunk).join('\n'));
      if (floatingBlock) outputBlocks.push(trimBlankEdges(floatingBlock).join('\n'));
      continue;
    }
    if (seenIds.has(id)) {
      problems.push(`Duplicate id in open register: ${id}`);
    }
    seenIds.add(id);

    // Parse the field block: consecutive lines right after the heading
    // (skipping one blank) that match known field patterns.
    let i = 1;
    i = skipBlanks(mainChunk, i);

    let filedLine = null;
    let closesLine = null;
    let statusLineExisting = null;
    let revisitLine = null;
    let bodyLinkLineExisting = null;

    while (i < mainChunk.length) {
      const l = mainChunk[i];
      if (/^\*\*Filed:\*\*/.test(l)) {
        filedLine = l;
        i++;
      } else if (/^\*\*Closes when:\*\*/.test(l)) {
        closesLine = l;
        i++;
      } else if (/^\*\*Status:\*\*/.test(l)) {
        statusLineExisting = l;
        i++;
      } else if (/^\*\*Revisit when:\*\*/.test(l)) {
        revisitLine = l;
        i++;
      } else if (/^\*\*Body:\*\*/.test(l)) {
        bodyLinkLineExisting = l;
        i++;
      } else {
        break;
      }
    }

    if (!filedLine || !closesLine) {
      problems.push(`${id}: missing Filed/Closes when field line(s) — left unchanged`);
      outputBlocks.push(trimBlankEdges(mainChunk).join('\n'));
      if (floatingBlock) outputBlocks.push(trimBlankEdges(floatingBlock).join('\n'));
      continue;
    }

    // Normalize Owner within the Filed/Owner/Severity combined line.
    const fosMatch = filedLine.match(
      /^\*\*Filed:\*\*\s*(.*?)\s*·\s*\*\*Owner:\*\*\s*(.*?)\s*·\s*\*\*Severity:\*\*\s*(.*)$/
    );
    let rebuiltFiledLine = filedLine;
    let filedDate = null;
    if (fosMatch) {
      const [, filedText, ownerRaw, severityText] = fosMatch;
      const { normalized } = normalizeOwner(ownerRaw);
      const entry = ownerMap.get(ownerRaw) || { normalized, count: 0 };
      entry.count++;
      ownerMap.set(ownerRaw, entry);
      rebuiltFiledLine = `**Filed:** ${filedText} · **Owner:** ${normalized} · **Severity:** ${severityText}`;
      const dm = filedText.match(/^\d{4}-\d{2}-\d{2}/);
      filedDate = dm ? dm[0] : filedText.trim();
    } else {
      problems.push(`${id}: Filed/Owner/Severity line did not match the expected shape`);
      const dm = filedLine.match(/\d{4}-\d{2}-\d{2}/);
      filedDate = dm ? dm[0] : 'unknown';
    }

    const isParked = Boolean(revisitLine) || (statusLineExisting && /parked/.test(statusLineExisting));
    parkedCount[isParked ? 'yes' : 'no']++;

    // Everything after the field block (and the blank line that follows it)
    // is body content.
    let bodyStart = skipBlanks(mainChunk, i);
    let rawBody = mainChunk.slice(bodyStart);
    const stripped = stripLeadingMarkerParagraphs(rawBody);
    registerLineTotal += stripped.registerLineRemoved;
    parkedMarkerTotal += stripped.parkedMarkerRemoved;
    const body = trimBlankEdges(stripped.remaining);

    // Already-externalized body (idempotent second run): body is just the
    // "**Body:** [ID.md](ID.md)" line (possibly recognized above as
    // bodyLinkLineExisting, or still sitting in the stripped body).
    const soleBodyLink =
      body.length === 1 && /^\*\*Body:\*\*\s*\[.+\]\(.+\.md\)\s*$/.test(body[0])
        ? body[0]
        : bodyLinkLineExisting && body.length === 0
        ? bodyLinkLineExisting
        : null;

    const fieldBlockLines = [rebuiltFiledLine, closesLine, `**Status:** ${isParked ? 'parked' : 'open'}`];
    if (isParked) {
      fieldBlockLines.push(revisitLine || '**Revisit when:** PO to rule');
    }

    let entryText;
    if (soleBodyLink) {
      inlineVsFile.alreadyFile++;
      fieldBlockLines.push(soleBodyLink);
      entryText = [heading, '', ...fieldBlockLines].join('\n');
    } else if (body.length > 10) {
      inlineVsFile.file++;
      const bodyFileName = `${id}.md`;
      const bodyFilePath = path.join(FOLLOWUPS_DIR, bodyFileName);
      const claimLine = heading.replace(/^###\s*/, '');
      const claimNoEmoji = claimLine.slice(claimLine.indexOf('FUP-'));
      const bodyFileContent =
        [
          `# ${claimNoEmoji}`,
          '',
          `Index entry: [follow-ups-open.md](follow-ups-open.md) · filed ${filedDate} · status ${
            isParked ? 'parked' : 'open'
          }`,
          '',
          ...body,
        ].join('\n') + '\n';
      if (!CHECK) fs.writeFileSync(bodyFilePath, bodyFileContent, 'utf8');
      filesWritten.push(bodyFileName);
      fieldBlockLines.push(`**Body:** [${bodyFileName}](${bodyFileName})`);
      entryText = [heading, '', ...fieldBlockLines].join('\n');
    } else {
      inlineVsFile.inline++;
      entryText = [heading, '', ...fieldBlockLines, ...(body.length ? ['', ...body] : [])].join('\n');
    }

    outputBlocks.push(entryText);
    if (floatingBlock) {
      outputBlocks.push(trimBlankEdges(floatingBlock).join('\n'));
    }
  }

  const newBodyRegion = outputBlocks.join('\n\n');
  const newText = prefaceLines.join('\n') + '\n\n' + newBodyRegion + '\n';

  const changed = newText !== text;

  console.log('--- migrate-fup-bodies.mjs summary ---');
  console.log(`Entries processed: ${chunks.length}`);
  console.log(`Stub "Resolved — rotated" sections deleted: ${stubsDeleted}`);
  console.log(`Register-line paragraphs deleted: ${registerLineTotal}`);
  console.log(`Parked-marker paragraphs deleted: ${parkedMarkerTotal}`);
  console.log(`Parked: ${parkedCount.yes} · Open: ${parkedCount.no}`);
  console.log(
    `Body placement — inline: ${inlineVsFile.inline} · new file: ${inlineVsFile.file} · already a file: ${inlineVsFile.alreadyFile}`
  );
  console.log(`Body files written this run: ${filesWritten.length}`);
  console.log('Owner mapping (raw -> normalized, count):');
  for (const [raw, { normalized, count }] of ownerMap) {
    console.log(`  "${raw}" -> "${normalized}" (${count})`);
  }
  if (problems.length) {
    console.log(`Problems (${problems.length}):`);
    for (const p of problems) console.log(`  - ${p}`);
  }
  console.log(`File changed: ${changed}`);

  if (CHECK) {
    process.exit(changed ? 1 : 0);
  }

  if (changed) {
    fs.writeFileSync(OPEN_PATH, newText, 'utf8');
  }
}

main();
