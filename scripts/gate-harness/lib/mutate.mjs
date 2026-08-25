// Revert ONE fix in a COPY of scripts/e2e-prod-gate.sh, so a keystone can prove that fix is
// what closes its reproduction. Used by the keystones beside this file; never run on the
// real script.
//
//   node scripts/gate-harness/lib/mutate.mjs <copied-script> <mode>
//
// Modes: pre-retention | no-a | no-b   (see MODES below)
//
// ⛔ Every replacement asserts it matched EXACTLY ONCE. A mutation that silently fails to
// apply leaves the fix in place and the keystone then reports the mutant as "still red",
// which reads as independence when it is really a no-op. Drift in the gate script must break
// this file loudly, not quietly.
import { readFileSync, writeFileSync } from 'node:fs';

const [file, mode] = process.argv.slice(2);
if (!file || !mode) {
  console.error('usage: mutate.mjs <copied-script> <pre-retention|no-a|no-b>');
  process.exit(2);
}

const MODES = {
  // Restore the pre-fix evidence handling: one fixed truncating server.log, surfaced only on
  // start failure, and no durable gate-exit.
  'pre-retention': [
    ['  SERVER_LOG="$(server_log_path)"', '  SERVER_LOG="$GATE_LOGDIR/server.log"'],
    [
      '      echo "[$(LOG_TS)]   server log RETAINED at: $SERVER_LOG"\n' +
      "      tail -40 \"$SERVER_LOG\" 2>/dev/null | sed 's/^/[srv] /'\n",
      '',
    ],
    [
      "printf 'GATE_EXIT=RUNNING\\npid=%s\\nstarted=%s\\n' \"$$\" \"$(NOW_ISO)\" > \"$GATE_EXIT_FILE\"",
      ':',
    ],
    [
      "  printf 'GATE_EXIT=%s\\nverdict=%s\\nfinished=%s\\nlogdir=%s\\n' \\\n" +
      '    "$1" "${2:-}" "$(NOW_ISO)" "$GATE_LOGDIR" > "$GATE_EXIT_FILE"',
      '  :',
    ],
    [
      "  printf 'GATE_EXIT=%s\\nverdict=%s\\nfinished=%s\\nlogdir=%s\\n' \"$rc\" \\",
      "  false && printf 'x' \\",
    ],
  ],

  // FALSE-GREEN VECTOR A: restore the original wait loop — HTTP probe before the liveness
  // check, and no server-identity verification at all.
  'no-a': [
    [
      '  for _ in $(seq 1 45); do\n' +
      '    # ⚠ THE ORDER IS THE FIX. Reversed (curl first), a spawned server that died of\n' +
      '    # EADDRINUSE was masked by whatever else answered the port — see vector A above.\n' +
      '    kill -0 "$SERVER_PID" 2>/dev/null || {\n' +
      '      echo "[$(LOG_TS)]   the server process this gate started is GONE before it ever served (log: $SERVER_LOG)"\n' +
      '      return 1\n' +
      '    }\n' +
      '    if curl -sf -o /dev/null "http://localhost:$PORT/login"; then\n' +
      '      verify_server_identity || return 1\n' +
      '      return 0\n' +
      '    fi\n' +
      '    sleep 2\n' +
      '  done',
      '  for _ in $(seq 1 45); do\n' +
      '    curl -sf -o /dev/null "http://localhost:$PORT/login" && return 0\n' +
      '    kill -0 "$SERVER_PID" 2>/dev/null || return 1\n' +
      '    sleep 2\n' +
      '  done',
    ],
  ],

  // FALSE-GREEN VECTOR B: restore the silent exp=0 — no fallback, no announcement, no
  // list-failed reason.
  'no-b': [
    [
      '  exp_guessed=0\n' +
      '  if [ "$exp" = "0" ]; then\n' +
      '    exp_guessed=1\n' +
      '    EXP_UNKNOWN_BATCHES=$(( EXP_UNKNOWN_BATCHES + 1 ))\n' +
      '    [ "$BATCH_TESTS" -gt 0 ] && exp=$BATCH_TESTS\n',
      '  exp_guessed=0\n' +
      '  if false; then\n',
    ],
    ['  [ "$exp_guessed" = "1" ] && reasons="$reasons,list-failed(exp guessed $exp)"\n', ''],
  ],
};

const edits = MODES[mode];
if (!edits) {
  console.error(`mutate.mjs: unknown mode '${mode}'`);
  process.exit(2);
}

let src = readFileSync(file, 'utf8');
edits.forEach(([from, to], i) => {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.error(
      `mutate.mjs[${mode}] edit ${i + 1}: matched ${n} times, expected exactly 1.\n` +
        `The gate script drifted from what this mutator expects. Fix the mutator; do NOT\n` +
        `relax the assertion — a mutation that does not apply reports a false PASS.\n` +
        `--- expected to find ---\n${from}\n`,
    );
    process.exit(3);
  }
  src = src.replace(from, to);
});
writeFileSync(file, src, 'utf8');
console.log(`mutate.mjs: applied '${mode}' (${edits.length} edit(s))`);
