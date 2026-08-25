#!/usr/bin/env node
/**
 * check-mojibake — fails on double-encoded UTF-8 in tracked text files.
 *
 * THE DEFECT THIS GATES. A tool reads a UTF-8 file while assuming cp1252, then writes
 * it back as UTF-8. Nothing errors. `⬛` (bytes E2 AC 9B) is read as three cp1252 chars
 * `â` `¬` `›` and re-saved as six bytes, so the corruption is now really on disk and
 * every later reader sees it. It COMPOUNDS: each repeat adds another layer.
 *
 * Found live 2026-08-24: 2,061+ affected lines across follow-ups.md, the A0 authz
 * review, and follow-ups-archive.md — all pre-existing, none detected by any gate,
 * in documents sessions read and believe. On Windows a shell round-trip (`sed -i`,
 * `>` redirection through a cp1252 console) is the usual mechanism, which is why
 * repo tooling edits these files with explicit UTF-8 instead.
 *
 * WHY A REGEX OVER THE DECODED TEXT, not a byte sniff: after the bad save the file IS
 * valid UTF-8 — there is no invalid byte to find. The only evidence is that the decoded
 * characters spell out a UTF-8 byte sequence. So the signature is derived from the UTF-8
 * grammar itself:
 *     lead byte     C2-DF (2-byte) | E0-EF (3-byte) | F0-F4 (4-byte)  => C2-F4
 *     continuation  80-BF, always
 * i.e. a cp1252 char from byte C2-F4 immediately followed by one from byte 80-BF.
 *
 * ⚠ The first version of this detector used a hand-picked LEAD set (Â Ã â Å Ä) and
 * missed EVERY 4-byte emoji, because those start at byte F0 -> `ð`. It reported a total
 * that was really a floor. Derive the set from the grammar; never from examples.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** cp1252 byte 0x80-0x9F -> the char it decodes to (the rest of 0x00-0xFF is identity). */
const HIGH_BYTE_TO_CHAR = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};
const CHAR_TO_HIGH_BYTE = Object.fromEntries(
  Object.entries(HIGH_BYTE_TO_CHAR).map(([b, c]) => [c, Number(b)]),
);

const esc = (c) => "\\u" + c.codePointAt(0).toString(16).padStart(4, "0").toUpperCase();
const CONT_NAMED = Object.values(HIGH_BYTE_TO_CHAR).map(esc).join("");
const LEAD = "[\\u00C2-\\u00F4]";
// ⚠ Bytes 81/8D/8F/90/9D are UNDEFINED in cp1252 and pass through as raw C1 controls,
// so they must count as continuations too. Omitting them missed every character whose
// UTF-8 contains one — `⭐` is E2 AD 90, and the self-test below reds without this.
const CONT_UNDEFINED = "\\u0081\\u008D\\u008F\\u0090\\u009D";
const CONT = `[\\u00A0-\\u00BF${CONT_NAMED}${CONT_UNDEFINED}]`;
/** Candidate runs. Matching is NOT proof — each run is then tested for decodability. */
const RUN = new RegExp(`${LEAD}${CONT}+`, "g");

/**
 * ⚠ PATTERN MATCHING ALONE FALSE-POSITIVES ON CORRECT TEXT. `por quê…` is valid pt-BR:
 * `ê` (byte EA, a lead) followed by `…` (byte 85, a continuation) matches the shape while
 * being nobody's mojibake. Two live instances were flagged this way in src/components.
 * The discriminator is DECODABILITY: real mojibake reverses to valid UTF-8 because it
 * WAS valid UTF-8; an accidental adjacency does not. `ê…` -> EA 85 is truncated and
 * fails. So a run counts only if it round-trips.
 */
function decodeRun(run) {
  const bytes = [];
  for (const ch of run) {
    const b = ch in CHAR_TO_HIGH_BYTE ? CHAR_TO_HIGH_BYTE[ch] : ch.codePointAt(0);
    if (b > 0xff) return null;
    bytes.push(b);
  }
  const decoded = Buffer.from(bytes).toString("utf8");
  if (decoded.includes("�")) return null; // not valid UTF-8 -> not mojibake
  if (decoded.length >= run.length) return null; // must COLLAPSE chars; else nothing was joined
  return decoded;
}

/** True when the line contains at least one run that genuinely decodes. */
export function hasMojibake(line) {
  RUN.lastIndex = 0;
  for (const m of line.matchAll(RUN)) if (decodeRun(m[0]) !== null) return true;
  return false;
}

/**
 * Repair every decodable run, leaving everything else byte-for-byte alone. Works on a
 * line that mixes real emoji with mojibake, which a whole-line transform cannot.
 */
export function unmojibake(line) {
  return line.replace(RUN, (run) => decodeRun(run) ?? run);
}

/** Encode truth INTO the accident — used only to red-prove the detector below. */
const toMojibake = (s) =>
  [...Buffer.from(s, "utf8")]
    .map((b) => HIGH_BYTE_TO_CHAR[b] ?? String.fromCharCode(b))
    .join("");

/**
 * Self-test. A detector that finds nothing must be proven able to find something, and
 * one that finds a lot must be proven not to fire on correct text. Both run every time.
 */
function selfTest() {
  const problems = [];
  // Correct text that must NOT be flagged. The last two are the shapes that actually
  // false-positived a pattern-only detector: an accented letter immediately followed by
  // a cp1252-named punctuation char. `por quê…` is real pt-BR and was live in
  // src/components/{cases/file-correction-control,dashboard/correct-submission-button}.tsx.
  for (const ok of [
    "Ação corretiva — não conformidade identificada",
    "câmbio, três, você, coração, señor, mañana",
    "✅ ⚠ ⛔ ⭐ 🟡 ⬛ 🔴 — → · ≥ §",
    "temperatura 37°C, ±2, ½ dose, «citação», ¿qué?, ¡hola!",
    "José, María, Ángel, Über, façade, naïve, résumé",
    'placeholder="Explique o que precisa ser corrigido e por quê…"',
    "olá… três… você… café… ação—agora",
  ]) {
    if (hasMojibake(ok)) problems.push(`false positive on ${JSON.stringify(ok.slice(0, 46))}`);
    if (unmojibake(ok) !== ok) problems.push(`would ALTER correct text: ${JSON.stringify(ok.slice(0, 46))}`);
  }
  // Every glyph the trackers use must be caught AND repaired exactly.
  for (const truth of ["⬛", "—", "✅", "§", "🟡", "🔴", "🟠", "⚠", "⭐", "↩", "→", "·", "≥", "Ação"]) {
    const bad = toMojibake(truth);
    if (!hasMojibake(bad)) problems.push(`missed mojibake for ${JSON.stringify(truth)}`);
    if (unmojibake(bad) !== truth) problems.push(`bad repair for ${JSON.stringify(truth)}`);
    if (hasMojibake(truth)) problems.push(`not idempotent for ${JSON.stringify(truth)}`);
  }
  // A line MIXING a real emoji with mojibake must have only the mojibake repaired.
  const mixed = "🟡 real " + toMojibake("—") + " end";
  if (unmojibake(mixed) !== "🟡 real — end") problems.push("mixed line not repaired in place");
  return problems;
}

const TEXT = /\.(md|sql|ts|tsx|js|jsx|mjs|cjs|txt|json|yml|yaml|css|sh)$/i;
// graphify-out/ is GENERATED by an external tool and rewritten wholesale on refresh;
// repairing it by hand would be undone, and its corruption says nothing about our edits.
const EXCLUDE = [/^graphify-out\//];

function main() {
  const problems = selfTest();
  if (problems.length) {
    console.error("check-mojibake: SELF-TEST FAILED — the detector is not trustworthy");
    for (const p of problems) console.error("  ✗ " + p);
    process.exit(2);
  }

  const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && TEXT.test(f) && !EXCLUDE.some((re) => re.test(f)));

  const findings = [];
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (!hasMojibake(text)) continue; // whole-file fast path
    text.split("\n").forEach((line, i) => {
      if (hasMojibake(line)) findings.push({ file: f, line: i + 1, text: line });
    });
  }

  if (!findings.length) {
    console.log(`check-mojibake: OK (self-test passes; ${files.length} tracked text files clean)`);
    return;
  }

  const byFile = new Map();
  for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
  console.error(`check-mojibake: ${findings.length} double-encoded line(s) in ${byFile.size} file(s)`);
  console.error("");
  for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
    console.error(`  ✗ ${file} — ${n} line(s)`);
  }
  const sample = findings[0];
  console.error("");
  console.error(`  first: ${sample.file}:${sample.line}`);
  console.error(`    is:     ${JSON.stringify(sample.text.slice(0, 72))}`);
  console.error(`    should: ${JSON.stringify((unmojibake(sample.text) ?? "(not safely reversible)").slice(0, 72))}`);
  console.error("");
  console.error("  Repair with an explicit UTF-8 round-trip; never with a shell rewrite,");
  console.error("  which is the mechanism that causes this. See ADR 0143.");
  process.exit(1);
}

// Run as a gate only when invoked directly, so the repair tool can import the SAME
// verified detector rather than growing a second copy that drifts from it.
// process.argv[1] is undefined under `node -e`, where this module is only ever imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
